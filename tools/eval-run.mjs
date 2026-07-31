#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  appendJsonl,
  createRunId,
  ensureDir,
  fileMatchesAny,
  getGitDiffSnapshot,
  getGitStatus,
  getResultRoot,
  getSuiteById,
  getSuiteRepairConfig,
  loadAgents,
  loadAllCases,
  loadRegistry,
  loadSuiteCases,
  parseArgs,
  readTextIfExists,
  repoRoot,
  resolveRepoPath,
  runProcess,
  runShell,
} from './eval-lib.mjs';
import {
  buildReaderProofModel,
  readerProofLegacyLists,
} from './eval-reader-proof.mjs';

const args = parseArgs();
const registry = await loadRegistry();

if (args.rerender) {
  const rerendered = await rerenderExistingRun(args.rerender, registry);
  console.log(`RERENDERED ${rerendered.suiteId}: ${rerendered.reportPath}`);
  process.exit(0);
}

const agentsConfig = await loadAgents();
const selectedSuites = await selectSuites(registry, args);

if (!selectedSuites.length) {
  console.error('No eval suites selected. Use --suite <id>, --case <id>, or --scheduled.');
  process.exit(2);
}

const results = [];
for (const selection of selectedSuites) {
  const result = await runSuite(selection);
  results.push(result);
}

const exitCode = results.some((item) => item.status === 'error')
  ? 2
  : results.some((item) => item.status === 'fail')
    ? 1
    : 0;

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.suiteId}: ${result.reportPath}`);
}

process.exit(exitCode);

async function selectSuites(registryConfig, parsedArgs) {
  if (parsedArgs.case) {
    const allCases = await loadAllCases(registryConfig);
    const matched = allCases.find(({ caseItem }) => caseItem.id === parsedArgs.case);
    if (!matched) throw new Error(`Unknown eval case: ${parsedArgs.case}`);
    return [{ suite: matched.suite, caseIds: [parsedArgs.case] }];
  }

  if (parsedArgs.suite) {
    const suite = getSuiteById(registryConfig, parsedArgs.suite);
    if (!suite) throw new Error(`Unknown eval suite: ${parsedArgs.suite}`);
    return [{ suite }];
  }

  if (parsedArgs.scheduled) {
    return (registryConfig.suites || [])
      .filter((suite) => suite.enabled !== false && suite.runMode === 'scheduled')
      .map((suite) => ({ suite }));
  }

  return [];
}

async function runSuite(selection) {
  const { suite, caseIds } = selection;
  const runId = createRunId(suite.id);
  const resultRoot = getResultRoot(registry);
  const runDir = path.join(resultRoot, runId);
  await ensureDir(resolveRepoPath(runDir));

  const allCases = await loadSuiteCases(suite);
  const cases = caseIds?.length
    ? allCases.filter((caseItem) => caseIds.includes(caseItem.id))
    : allCases;
  const startedAt = new Date().toISOString();
  const workflowText = await readTextIfExists(suite.workflow);
  const rubricText = await readTextIfExists(suite.judge?.rubric);

  const runMeta = {
    runId,
    suiteId: suite.id,
    title: suite.title,
    startedAt,
    workflow: suite.workflow,
    casesPath: suite.cases,
    caseCount: cases.length,
    selectedCaseIds: caseIds || null,
    readerProof: suite.readerProof || null,
    args,
  };
  const reportPath = path.join(runDir, 'report.html');

  await fs.writeFile(resolveRepoPath(path.join(runDir, 'run.json')), JSON.stringify(runMeta, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'workflow.md')), workflowText || '');
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'rubric.md')), rubricText || '');

  if (!cases.length) {
    const summary = {
      ...runMeta,
      completedAt: new Date().toISOString(),
      status: 'skipped',
      repairStatus: 'not_requested',
      reason: 'no_cases',
      runDir,
      reportPath,
    };
    await writeSummary(runDir, summary, []);
    return { ...summary, reportPath };
  }

  const caseResults = [];
  for (const caseItem of cases) {
    const caseResult = await runCase({ suite, caseItem, runDir });
    caseResults.push(attachCaseMetadataToResult(caseResult, caseItem));
  }

  const reportContract = applyReportContract(caseResults);
  const status = summarizeStatus(caseResults, reportContract);
  let repairStatus = 'not_requested';
  if (shouldRunRepair(status, suite)) {
    const repairResult = await runRepair({ suite, runDir, caseResults });
    repairStatus = repairResult.status;
  }

  const summary = {
    ...runMeta,
    completedAt: new Date().toISOString(),
    status,
    repairStatus,
    reportContract,
    counts: countStatuses(caseResults),
    failedCaseIds: caseResults.filter((item) => item.status === 'fail').map((item) => item.caseId),
    runDir,
    reportPath,
  };
  await writeSummary(runDir, summary, caseResults);
  return { ...summary, reportPath };
}

function attachCaseMetadataToResult(caseResult, caseItem) {
  return {
    ...caseResult,
    manualVerification:
      caseResult.manualVerification ||
      caseItem.manualVerification ||
      caseItem.expectedBehavior?.manualVerification ||
      null,
  };
}

async function runCase({ suite, caseItem, runDir }) {
  const collected = await collectContext(caseItem);
  await appendJsonl(path.join(runDir, 'input.jsonl'), {
    caseId: caseItem.id,
    collectedAt: new Date().toISOString(),
    ...collected,
  });

  if (suite.id === 'ask-conversation-continuity') {
    return runAskConversationContinuityCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'ask-context-gap') {
    const request = buildAskContextGapRequest({ caseItem, collected });
    await appendJsonl(path.join(runDir, 'requests.jsonl'), { caseId: caseItem.id, request });

    const responseEnvelope = await postAskContextGap({ suite, caseItem, request });
    await appendJsonl(path.join(runDir, 'responses.jsonl'), {
      caseId: caseItem.id,
      ...responseEnvelope,
    });

    const heuristic = judgeAskContextGap({ caseItem, response: responseEnvelope.response });
    const status = responseEnvelope.ok ? heuristic.verdict : 'error';
    const result = {
      caseId: caseItem.id,
      suiteId: suite.id,
      caseKind: caseItem.kind,
      caseTitle: caseItem.title,
      query: caseItem.query,
      providedContext: caseItem.context,
      problemStatement: caseItem.problemStatement,
      expectedExtraction: caseItem.expectedExtraction,
      targetUrl: caseItem.canonicalUrl || caseItem.url,
      expectedTopics: caseItem.expectedTopics || [],
      mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
      expectedBehavior: caseItem.expectedBehavior,
      sampleDetails: buildAskContextGapSampleDetails(caseItem, collected),
      sampleSummary: summarizeSampleText(collected.primaryText),
      status,
      verdict: status,
      scores: heuristic.scores,
      overallScore: computeOverallScore(heuristic.scores, status),
      userConclusion: buildAskContextGapUserConclusion({
        status,
        heuristic,
        error: responseEnvelope.error,
      }),
      improvementSuggestions: buildAskContextGapImprovementSuggestions({
        caseItem,
        status,
        heuristic,
        error: responseEnvelope.error,
      }),
      why: heuristic.why,
      topMatch: heuristic.topMatch,
      contextMatch: heuristic.contextMatch,
      matchedExpectedTopics: heuristic.matchedExpectedTopics,
      matchedEvidenceTopics: heuristic.matchedEvidenceTopics,
      matchedMustNotReturnTopics: heuristic.matchedMustNotReturnTopics,
      missingInfo: heuristic.missingInfo,
      evidenceCount: heuristic.evidenceCount,
      actualOutput: summarizeAskContextGapActualOutput({
        response: responseEnvelope.response,
        error: responseEnvelope.ok ? undefined : responseEnvelope.error,
        statusCode: responseEnvelope.statusCode,
        durationMs: responseEnvelope.durationMs,
        timeoutMs: responseEnvelope.timeoutMs,
      }),
      judge: {
        heuristic,
        llm: null,
      },
      error: responseEnvelope.ok ? undefined : responseEnvelope.error,
    };
    await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
    return result;
  }

  if (suite.id === 'answer-memory-tracker') {
    return runAnswerMemoryTrackerCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'compose-assist') {
    return runComposeAssistCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'memory-lifecycle') {
    return runMemoryLifecycleCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'evidence-watch-contracts') {
    return runEvidenceWatchContractsCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'open-question-exit-contracts') {
    return runOpenQuestionExitContractsCase({
      suite,
      caseItem,
      runDir,
      collected,
    });
  }

  if (suite.id === 'action-readiness-contracts') {
    return runActionReadinessContractsCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'evidence-cohesion-gate') {
    return runEvidenceCohesionGateCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'source-memory-distiller') {
    return runSourceMemoryDistillerCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'change-memory-ledger') {
    return runChangeMemoryLedgerCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'scene-memory-autopilot') {
    return runSceneMemoryAutopilotCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'keystone-memory-briefs') {
    return runKeystoneMemoryBriefsCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'estimate-cue-compiler') {
    return runEstimateCueCompilerCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'meeting-outcome-binder') {
    return runMeetingOutcomeBinderCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id === 'compose-style-memory') {
    return runComposeStyleMemoryCase({ suite, caseItem, runDir, collected });
  }

  if (suite.id !== 'context-recall') {
    const skipped = {
      caseId: caseItem.id,
      suiteId: suite.id,
      caseKind: caseItem.kind,
      caseTitle: caseItem.title,
      status: 'skipped',
      verdict: 'skipped',
      reason: 'suite_runner_not_implemented',
      scores: {},
      sampleSummary: summarizeSampleText(collected.primaryText),
      expectedBehavior: caseItem.expectedBehavior,
      userConclusion: '这个 suite 还没有可执行 runner，无法产生真实体验评估。',
      improvementSuggestions: [
        '为该 suite 增加 runner，并让结果可归一化成 caseGoal、inputSummary、expectedSummary、actualSummary、proofChecks、conclusion 和 nextSteps。',
      ],
    };
    await appendJsonl(path.join(runDir, 'judge-results.jsonl'), skipped);
    return skipped;
  }

  const request = buildContextRecallRequest({ suite, caseItem, collected });
  await appendJsonl(path.join(runDir, 'requests.jsonl'), { caseId: caseItem.id, request });

  const responseEnvelope = await postContextRecall({ suite, caseItem, request });
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    ...responseEnvelope,
  });

  const heuristic = judgeContextRecall({ caseItem, response: responseEnvelope.response });
  let llmJudge = null;
  if (suite.judge?.llm && !args.noLlm) {
    llmJudge = await runOptionalExternalJudge({
      suite,
      caseItem,
      collected,
      response: responseEnvelope.response,
      heuristic,
    });
  }

  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseTitle: caseItem.title,
    targetUrl: caseItem.canonicalUrl || caseItem.url,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleSummary: summarizeSampleText(collected.primaryText),
    status: responseEnvelope.ok ? heuristic.verdict : 'error',
    verdict: responseEnvelope.ok ? heuristic.verdict : 'error',
    scores: heuristic.scores,
    overallScore: computeOverallScore(heuristic.scores, heuristic.verdict),
    userConclusion: buildUserConclusion({
      status: responseEnvelope.ok ? heuristic.verdict : 'error',
      heuristic,
      error: responseEnvelope.error,
    }),
    improvementSuggestions: buildImprovementSuggestions({
      caseItem,
      status: responseEnvelope.ok ? heuristic.verdict : 'error',
      heuristic,
      error: responseEnvelope.error,
    }),
    why: heuristic.why,
    topMatch: heuristic.topMatch,
    autopilot: heuristic.autopilot,
    judge: {
      heuristic,
      llm: llmJudge,
    },
    error: responseEnvelope.ok ? undefined : responseEnvelope.error,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runAskConversationContinuityCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const request = buildAskContextGapRequest({ caseItem, collected });
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const responseEnvelope = await postAskContextGap({ suite, caseItem, request });
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    ...responseEnvelope,
  });

  const heuristic = judgeAskConversationContinuity({
    caseItem,
    request,
    response: responseEnvelope.response,
  });
  const status = responseEnvelope.ok ? heuristic.verdict : 'error';
  const expectedReceipt = Boolean(caseItem.expectContinuityReceipt);
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    query: caseItem.query,
    problemStatement: caseItem.problemStatement,
    expectedExtraction: caseItem.expectedExtraction,
    expectedTopics: caseItem.expectedTopics || [],
    expectedSelectedTopics: caseItem.expectedSelectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      ...buildAskContextGapSampleDetails(caseItem, collected),
      contextHintsAgeHours: caseItem.contextHintsAgeHours,
      contextHints: request.contextHints || null,
      expectContinuityReceipt: expectedReceipt,
      requireFreshEvidence: Boolean(caseItem.requireFreshEvidence),
    },
    sampleSummary: summarizeSampleText(collected.primaryText),
    status,
    verdict: status,
    scores: heuristic.scores,
    overallScore: computeOverallScore(heuristic.scores, status),
    userConclusion: responseEnvelope.ok
      ? heuristic.userConclusion
      : `Ask 续接请求失败，无法判断体验：${responseEnvelope.error || 'unknown error'}`,
    improvementSuggestions: responseEnvelope.ok
      ? heuristic.improvementSuggestions
      : [
          '先恢复 Ask 服务或排除请求超时，再用同一真实场景重跑。',
          '不要把网络错误误判为续接检索质量问题。',
        ],
    why: responseEnvelope.ok ? heuristic.why : responseEnvelope.error,
    topMatch: heuristic.topMatch,
    contextMatch: heuristic.contextMatch,
    continuityReceipt: heuristic.continuityReceipt,
    matchedExpectedTopics: heuristic.matchedExpectedTopics,
    matchedEvidenceTopics: heuristic.matchedEvidenceTopics,
    matchedSelectedTopics: heuristic.matchedSelectedTopics,
    selectedTopicLabel: heuristic.selectedTopicLabel,
    matchedMustNotReturnTopics: heuristic.matchedMustNotReturnTopics,
    evidenceCount: heuristic.evidenceCount,
    actualOutput: summarizeAskContextGapActualOutput({
      response: responseEnvelope.response,
      error: responseEnvelope.ok ? undefined : responseEnvelope.error,
      statusCode: responseEnvelope.statusCode,
      durationMs: responseEnvelope.durationMs,
      timeoutMs: responseEnvelope.timeoutMs,
    }),
    judge: {
      heuristic,
      llm: null,
    },
    error: responseEnvelope.ok ? undefined : responseEnvelope.error,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runComposeAssistCase({ suite, caseItem, runDir, collected }) {
  if (caseItem.kind === 'compose_assist_persona_projection_contract') {
    return runComposeAssistPersonaProjectionCase({
      suite,
      caseItem,
      runDir,
      collected,
    });
  }

  if (
    caseItem.kind === 'compose_assist_context_pack' ||
    caseItem.kind === 'compose_assist_prompt_patch' ||
    caseItem.kind === 'compose_assist_prompt_rewrite'
  ) {
    return runComposeAssistContextPackCase({ suite, caseItem, runDir, collected });
  }

  if (caseItem.kind === 'compose_assist_lens_routing_contract') {
    return runComposeAssistLensRoutingContractCase({
      suite,
      caseItem,
      runDir,
      collected,
    });
  }

  if (caseItem.kind !== 'compose_assist_ambient_calibration') {
    const skipped = {
      caseId: caseItem.id,
      suiteId: suite.id,
      caseTitle: caseItem.title,
      status: 'skipped',
      verdict: 'skipped',
      reason: `unsupported_compose_assist_case_kind:${caseItem.kind || 'unknown'}`,
      scores: {},
      userConclusion: '这个 Compose Assist case 类型还没有 runner。',
      improvementSuggestions: ['为该 case kind 增加可执行 runner，避免只登记样本但无法判分。'],
    };
    await appendJsonl(path.join(runDir, 'judge-results.jsonl'), skipped);
    return skipped;
  }

  const simulatedTrace = buildComposeAmbientCalibrationTrace(caseItem);
  const request = {
    kind: caseItem.kind,
    sampleContext: redactComposeAmbientSample(caseItem.sampleContext || {}),
    expectedBehavior: caseItem.expectedBehavior,
  };
  const responseEnvelope = {
    ok: true,
    response: {
      assist: caseItem.expectedBehavior?.assist || null,
      ambientTrace: simulatedTrace,
    },
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), { caseId: caseItem.id, request });
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    ...responseEnvelope,
  });

  const heuristic = judgeComposeAmbientCalibration({
    caseItem,
    trace: simulatedTrace,
  });
  const status = heuristic.verdict;
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    sampleDetails: redactComposeAmbientSample(caseItem.sampleContext || {}),
    expectedBehavior: caseItem.expectedBehavior,
    sampleSummary: summarizeSampleText(collected.primaryText),
    status,
    verdict: status,
    scores: heuristic.scores,
    overallScore: heuristic.overallScore,
    userConclusion: heuristic.userConclusion,
    improvementSuggestions: heuristic.improvementSuggestions,
    why: heuristic.why,
    topMatch: {
      id: simulatedTrace.action,
      title: 'Ambient calibration trace',
      sourceLabel: simulatedTrace.surface,
      displayPriority: heuristic.verdict === 'pass' ? 'p1' : 'review',
      whyRelevant: heuristic.whyItems,
    },
    actualOutput: {
      assist: responseEnvelope.response.assist,
      ambientTrace: summarizeComposeAmbientTrace(simulatedTrace),
    },
    judge: {
      heuristic,
      llm: null,
    },
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runComposeAssistPersonaProjectionCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const sample = caseItem.sampleContext || {};
  const variants = Array.isArray(sample.variants) ? sample.variants : [];
  const request = {
    kind: caseItem.kind,
    variantCount: variants.length,
    profileItemCount: Array.isArray(sample.profileItems)
      ? sample.profileItems.length
      : 0,
    socialEdgeCount: Array.isArray(sample.socialEdges)
      ? sample.socialEdges.length
      : 0,
    expectedBehavior: caseItem.expectedBehavior,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  let actual = null;
  let error;
  try {
    const moduleUrl = new URL(
      '../memory-service/dist/core/PersonaProjectionService.js',
      import.meta.url,
    );
    const {
      PersonaProjectionService,
      formatPersonaProjectionForExternalContext,
      formatPersonaProjectionForGeneration,
    } = await import(moduleUrl.href);
    const db = buildPersonaProjectionEvalDb(sample);
    const service = new PersonaProjectionService(db);
    const projected = variants.map((variant) => {
      const projection = service.project({
        request: variant.request,
        suggestionType: variant.suggestionType || 'reply_context',
        timestamp: sample.timestamp,
      });
      return {
        id: variant.id,
        summary: projection.summary,
        controlKeys: projection.controls.map((slot) => slot.key),
        speakableKeys: projection.speakableContext.map((slot) => slot.key),
        softControlKeys: projection.softControls.map((slot) => slot.key),
        projectedValues: [
          ...projection.controls,
          ...projection.speakableContext,
          ...projection.softControls,
        ].map((slot) => slot.value),
        generationContext: formatPersonaProjectionForGeneration(projection),
        externalContext: formatPersonaProjectionForExternalContext(projection),
      };
    });
    actual = { variants: projected };
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const heuristic = judgeComposePersonaProjectionContract({
    caseItem,
    variants,
    actual,
    error,
  });
  const responseEnvelope = {
    ok: !error,
    response: summarizeComposePersonaProjectionOutput(actual),
    error,
  };
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    ...responseEnvelope,
  });

  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      variantCount: variants.length,
      profileItemCount: request.profileItemCount,
      socialEdgeCount: request.socialEdgeCount,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.title,
    ),
    status: error ? 'error' : heuristic.verdict,
    verdict: error ? 'error' : heuristic.verdict,
    scores: heuristic.scores,
    overallScore: error
      ? 0
      : Math.round(
          (Object.values(heuristic.scores).reduce(
            (sum, value) => sum + Number(value || 0),
            0,
          ) /
            (Object.keys(heuristic.scores).length * 3)) *
            100,
        ),
    userConclusion: error
      ? `身份投影策略 fixture 未执行：${error}`
      : heuristic.userConclusion,
    improvementSuggestions: error
      ? ['先运行 npm --prefix memory-service run build，再重跑 compose-assist eval。']
      : heuristic.improvementSuggestions,
    why: error || heuristic.why,
    actualOutput: summarizeComposePersonaProjectionOutput(actual),
    judge: { heuristic, llm: null },
    error,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

function buildPersonaProjectionEvalDb(sample) {
  const profileRows = (sample.profileItems || []).map((item, index) => ({
    item_type: item.itemType || 'preference',
    item_key: item.itemKey,
    item_value: item.itemValue,
    source_kind: item.confirmed === false ? 'inferred' : 'explicit',
    confidence: item.confidence ?? 0.9,
    user_confirmed: item.confirmed === false ? 0 : 1,
    status: item.confirmed === false ? 'pending_confirm' : 'active',
    salience_score: item.salienceScore ?? 0.9,
    valid_to: item.validTo ?? null,
    updated_at: item.updatedAt ?? index + 1,
  }));
  const socialRows = (sample.socialEdges || []).map((edge) => ({
    relation_type: edge.relationType,
    confidence: edge.confidence ?? 0.9,
    name: edge.name,
    aliases_json: JSON.stringify(edge.aliases || []),
  }));
  return {
    prepare(sql) {
      return {
        all() {
          if (String(sql).includes('FROM social_edges')) return socialRows;
          if (String(sql).includes('FROM user_profile_items')) {
            return profileRows;
          }
          throw new Error('unsupported_persona_projection_eval_query');
        },
      };
    },
  };
}

function judgeComposePersonaProjectionContract({
  caseItem,
  variants,
  actual,
  error,
}) {
  if (error || !actual) {
    return {
      verdict: 'error',
      scores: {
        contract_correctness: 0,
        privacy_suppression: 0,
        interaction_boundary: 0,
        scenario_differentiation: 0,
      },
      why: error || 'persona_projection_result_missing',
      userConclusion: '身份投影策略没有产生可判分结果。',
      improvementSuggestions: ['检查 memory-service build 产物和 fixture schema。'],
    };
  }

  const failures = [];
  const outputById = new Map(
    actual.variants.map((variant) => [variant.id, variant]),
  );
  let privacyChecks = 0;
  let privacyPasses = 0;
  let boundaryChecks = 0;
  let boundaryPasses = 0;

  for (const variant of variants) {
    const output = outputById.get(variant.id);
    const expected = variant.expected || {};
    if (!output) {
      failures.push(`${variant.id}: missing projection`);
      continue;
    }
    for (const field of [
      'audienceType',
      'audienceSource',
      'representationMode',
      'voiceMode',
      'requiresPreview',
    ]) {
      if (expected[field] === undefined) continue;
      boundaryChecks += 1;
      if (output.summary?.[field] === expected[field]) boundaryPasses += 1;
      else {
        failures.push(
          `${variant.id}: ${field} expected ${expected[field]} got ${output.summary?.[field]}`,
        );
      }
    }
    for (const [field, outputField] of [
      ['controlKeys', 'controlKeys'],
      ['softControlKeys', 'softControlKeys'],
      ['speakableKeys', 'speakableKeys'],
      ['reasonCodes', 'reasonCodes'],
    ]) {
      for (const expectedValue of expected[field] || []) {
        privacyChecks += 1;
        const actualValues =
          outputField === 'reasonCodes'
            ? output.summary?.reasonCodes || []
            : output[outputField] || [];
        if (actualValues.includes(expectedValue)) privacyPasses += 1;
        else failures.push(`${variant.id}: missing ${field} ${expectedValue}`);
      }
    }
    for (const forbiddenValue of expected.mustNotProjectValues || []) {
      privacyChecks += 1;
      const leaked = output.projectedValues.some((value) =>
        String(value).includes(forbiddenValue),
      );
      if (!leaked) privacyPasses += 1;
      else failures.push(`${variant.id}: projected forbidden profile value`);
    }
  }

  let differentiationChecks = 0;
  let differentiationPasses = 0;
  for (const pair of caseItem.expectedBehavior?.distinctProjectionPairs || []) {
    differentiationChecks += 1;
    const left = outputById.get(pair[0]);
    const right = outputById.get(pair[1]);
    const leftSignature = JSON.stringify({
      mode: left?.summary?.representationMode,
      controls: left?.controlKeys,
      soft: left?.softControlKeys,
    });
    const rightSignature = JSON.stringify({
      mode: right?.summary?.representationMode,
      controls: right?.controlKeys,
      soft: right?.softControlKeys,
    });
    if (left && right && leftSignature !== rightSignature) {
      differentiationPasses += 1;
    } else {
      failures.push(`${pair.join(' vs ')}: projection did not differ`);
    }
  }

  const verdict = failures.length ? 'fail' : 'pass';
  const score = (passes, checks) =>
    checks === 0 ? 3 : Math.round((passes / checks) * 3);
  return {
    verdict,
    scores: {
      contract_correctness: failures.length ? 1 : 3,
      privacy_suppression: score(privacyPasses, privacyChecks),
      interaction_boundary: score(boundaryPasses, boundaryChecks),
      scenario_differentiation: score(
        differentiationPasses,
        differentiationChecks,
      ),
    },
    why: failures.length
      ? failures.join('; ')
      : '实际 PersonaProjectionService 输出满足 fixture 中的身份、场景、slot 和预览边界。',
    userConclusion: failures.length
      ? '至少一个身份投影场景会错误使用身份信息或选择错误的交互模式。'
      : '身份投影在这些场景中能控制生成上下文，并保持该预览时预览、该排除时排除。',
    improvementSuggestions: failures.length
      ? ['检查 audience precedence、slot scope 和 representation mode 决策。']
      : ['继续用真实 compose API E2E 验证最终文本没有绕过 projection。'],
  };
}

function summarizeComposePersonaProjectionOutput(actual) {
  if (!actual) return null;
  return {
    variants: actual.variants.map((variant) => ({
      id: variant.id,
      summary: variant.summary,
      controlKeys: variant.controlKeys,
      speakableKeys: variant.speakableKeys,
      softControlKeys: variant.softControlKeys,
      projectedValueCount: variant.projectedValues.length,
    })),
  };
}

async function runComposeAssistLensRoutingContractCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const sample = caseItem.sampleContext || {};
  const expected = caseItem.expectedBehavior || {};
  const assistResponse = sample.assistResponse || {};
  const request = {
    kind: caseItem.kind,
    sampleContext: {
      site: sample.site,
      surface: sample.surface,
      contextType: sample.contextType,
      title: sample.title,
      draftTextLength: String(sample.draftText || '').length,
      assistResponse: summarizeComposeLensRoutingAssist(assistResponse),
      memoryLensMatches: summarizeComposeLensRoutingMatches(
        sample.memoryLensMatches || [],
      ),
    },
    expectedBehavior: expected,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const sourceChecks = await inspectComposeLensRoutingSourceContract();
  const actual = evaluateComposeLensRoutingContract({
    assistResponse,
    memoryLensMatches: sample.memoryLensMatches || [],
    sourceChecks,
  });
  const heuristic = judgeComposeLensRoutingContract({
    caseItem,
    actual,
    expected,
  });
  const responseEnvelope = {
    ok: heuristic.verdict !== 'error',
    response: actual,
  };
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    ...responseEnvelope,
  });

  const status = heuristic.verdict;
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: expected,
    sampleDetails: request.sampleContext,
    sampleSummary: summarizeSampleText(
      collected.primaryText || sample.primaryText || sample.title || caseItem.title,
    ),
    status,
    verdict: status,
    scores: heuristic.scores,
    overallScore: heuristic.overallScore,
    userConclusion: heuristic.userConclusion,
    improvementSuggestions: heuristic.improvementSuggestions,
    why: heuristic.why,
    actualOutput: actual,
    judge: {
      heuristic,
      llm: null,
    },
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runComposeAssistContextPackCase({ suite, caseItem, runDir, collected }) {
  const request = buildComposeAssistContextPackRequest({ caseItem, collected });
  const seed = await seedComposeAssistCaseMemories({ suite, caseItem });
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
    seed,
  });

  const responseEnvelope = seed.ok
    ? await postComposerAssist({
        suite,
        caseItem,
        request,
        userIdOverride: seed.userId,
      })
    : { ok: false, error: seed.error };
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    seed,
    ...responseEnvelope,
  });

  const heuristic = judgeComposeContextPack({
    caseItem,
    response: responseEnvelope.response,
    request,
  });
  const status = responseEnvelope.ok ? heuristic.verdict : 'error';
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    targetUrl: request.url,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      ...summarizeComposeContextPackSample(collected, request),
      seededMemoryCount: seed.seededCount || 0,
      seedUserId: seed.userId,
    },
    sampleSummary: summarizeSampleText(collected.primaryText || request.primaryText || ''),
    status,
    verdict: status,
    scores: heuristic.scores,
    overallScore: computeOverallScore(heuristic.scores, status),
    userConclusion: buildComposeContextPackUserConclusion({
      status,
      heuristic,
      error: responseEnvelope.error,
    }),
    improvementSuggestions: buildComposeContextPackImprovementSuggestions({
      caseItem,
      status,
      heuristic,
      error: responseEnvelope.error,
    }),
    why: responseEnvelope.ok ? heuristic.why : responseEnvelope.error,
    topMatch: heuristic.topMatch,
    actualOutput: summarizeComposeContextPackOutput(responseEnvelope.response),
    judge: {
      heuristic,
      llm: null,
    },
    error: responseEnvelope.ok ? undefined : responseEnvelope.error,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

function summarizeComposeLensRoutingAssist(assistResponse = {}) {
  return {
    available: Boolean(assistResponse.available),
    suggestionType: assistResponse.suggestionType,
    confidence: assistResponse.confidence,
    hasInsertText: Boolean(String(assistResponse.insertText || '').trim()),
    insertTextLength: String(assistResponse.insertText || '').length,
    evidenceCount: Array.isArray(assistResponse.evidence)
      ? assistResponse.evidence.length
      : 0,
    title: assistResponse.title,
    summary: truncateText(String(assistResponse.summary || ''), 220),
  };
}

function summarizeComposeLensRoutingMatches(matches = []) {
  return matches.slice(0, 5).map((match) => ({
    id: match.id,
    title: match.title,
    displayPriority: match.displayPriority,
    whyRelevant: (match.whyRelevant || []).slice(0, 3),
  }));
}

function looksLikeEvalSendableComposerText(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  if (/^我理解当前是在讨论[:：]/.test(cleaned)) return false;
  if (/^我这边先补充几个相关点[:：]/.test(cleaned)) return false;
  if (/^我补充一下相关背景[:：]/.test(cleaned)) return false;
  if (/Personal AI context|Please review/i.test(cleaned)) return false;
  return true;
}

async function inspectComposeLensRoutingSourceContract() {
  const [controller, previewPolicy, webIntelligence] = await Promise.all([
    fs.readFile(
      resolveRepoPath('src/composer-guard/ComposerGuardController.ts'),
      'utf8',
    ),
    fs.readFile(
      resolveRepoPath('src/composer-guard/assistPreviewPolicy.ts'),
      'utf8',
    ),
    fs.readFile(
      resolveRepoPath('src/contentScriptWebIntelligence.ts'),
      'utf8',
    ),
  ]);
  const shouldSuppressMatch = webIntelligence.match(
    /private shouldSuppressContextBubbleForComposerAssist[\s\S]*?\n    }\n/,
  );
  const suppressorBody = shouldSuppressMatch?.[0] || '';

  return {
    controllerRemovedContextOnlyBranch:
      !/hasContextOnlyAssist|contextOnly|上下文回执|只展示相关上下文/.test(
        controller,
      ),
    previewPolicyRemovedContextOnlyReceipt:
      !/contextOnly|上下文回执|只展示相关上下文/.test(previewPolicy),
    lensHasGlobalComposeSuppression:
      /COMPOSE_ASSIST_VISIBILITY_EVENT/.test(webIntelligence) &&
      /hasVisibleComposerAssistAffordance\(\)/.test(suppressorBody) &&
      !/isRingCentralMessagePage\(\)/.test(suppressorBody),
    selectedTextBypassesComposeSuppression:
      /payload\.contextType === 'selected_text'/.test(suppressorBody),
  };
}

function evaluateComposeLensRoutingContract({
  assistResponse = {},
  memoryLensMatches = [],
  sourceChecks = {},
}) {
  const confidence = Number(assistResponse.confidence);
  const composeAssistIconVisible = Boolean(
    assistResponse.available &&
      looksLikeEvalSendableComposerText(assistResponse.insertText) &&
      Number.isFinite(confidence) &&
      confidence >= 0.78,
  );
  const memoryLensEligible = Boolean(
    !composeAssistIconVisible &&
      (memoryLensMatches.length ||
        (Array.isArray(assistResponse.evidence) &&
          assistResponse.evidence.length)),
  );

  return {
    composeAssistIconVisible,
    memoryLensEligible,
    route:
      composeAssistIconVisible
        ? 'compose_assist'
        : memoryLensEligible
          ? 'memory_lens'
          : 'silent',
    sourceChecks,
    assistSummary: summarizeComposeLensRoutingAssist(assistResponse),
    memoryLensMatches: summarizeComposeLensRoutingMatches(memoryLensMatches),
  };
}

function judgeComposeLensRoutingContract({ caseItem, actual, expected }) {
  const failures = [];
  const warnings = [];
  const sourceChecks = actual.sourceChecks || {};

  if (
    typeof expected.composeAssistIconVisible === 'boolean' &&
    actual.composeAssistIconVisible !== expected.composeAssistIconVisible
  ) {
    failures.push(
      `Compose Assist icon visibility 应为 ${expected.composeAssistIconVisible}，实际为 ${actual.composeAssistIconVisible}`,
    );
  }
  if (
    typeof expected.memoryLensEligible === 'boolean' &&
    actual.memoryLensEligible !== expected.memoryLensEligible
  ) {
    failures.push(
      `Memory Lens eligible 应为 ${expected.memoryLensEligible}，实际为 ${actual.memoryLensEligible}`,
    );
  }
  if (expected.route && actual.route !== expected.route) {
    failures.push(`route 应为 ${expected.route}，实际为 ${actual.route}`);
  }

  const requiredSourceChecks = [
    'controllerRemovedContextOnlyBranch',
    'previewPolicyRemovedContextOnlyReceipt',
    'lensHasGlobalComposeSuppression',
    'selectedTextBypassesComposeSuppression',
  ];
  for (const key of requiredSourceChecks) {
    if (!sourceChecks[key]) {
      failures.push(`源码契约未满足：${key}`);
    }
  }

  if (!actual.memoryLensMatches?.length) {
    warnings.push('样本没有提供 Memory Lens matches，报告无法展示具体 lens 内容。');
  }

  const scores = {
    compose_icon_suppression: actual.composeAssistIconVisible === false ? 3 : 0,
    memory_lens_routing: actual.memoryLensEligible ? 3 : 0,
    source_context_only_removed:
      sourceChecks.controllerRemovedContextOnlyBranch &&
      sourceChecks.previewPolicyRemovedContextOnlyReceipt
        ? 3
        : 0,
    global_mutual_exclusion:
      sourceChecks.lensHasGlobalComposeSuppression &&
      sourceChecks.selectedTextBypassesComposeSuppression
        ? 3
        : 0,
  };
  const overallScore = computeOverallScore(scores, failures.length ? 'fail' : 'pass');
  const verdict = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';

  return {
    verdict,
    scores,
    overallScore,
    why:
      failures[0] ||
      warnings[0] ||
      '证据-only 的 composer 场景不会占用 Compose Assist icon，且可交给 Memory Lens 展示。',
    userConclusion: failures.length
      ? '不通过：只读关联记忆仍可能占用 composer 入口，或 Lens/Compose 互斥没有全页面生效。'
      : warnings.length
        ? '需关注：路由契约通过，但样本证据不够完整。'
        : '通过：无 insertText 的高相关证据走 Memory Lens；只有可插入草稿才显示 Compose Assist。',
    improvementSuggestions: failures.length
      ? failures
      : warnings.length
        ? warnings
        : [
            '保留这个 case 作为回归门；后续如果重新引入 context-only composer UI，需要先改产品契约和 eval。',
          ],
    caseTitle: caseItem.title,
  };
}

async function runMemoryLifecycleCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    scenario: caseItem.scenario,
    expectedBehavior: caseItem.expectedBehavior,
    memoryCount: caseItem.sampleContext?.memories?.length ?? 0,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-memory-lifecycle.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseMemoryLifecycleEvalOutput(commandResult);
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      memories: (caseItem.sampleContext?.memories || []).map((memory) => ({
        id: memory.id,
        ageDays: memory.ageDays,
        retrievalTier: memory.retrievalTier ?? 'no_metadata',
        consolidationLevel: memory.consolidationLevel,
        feedbackAction: memory.feedbackAction,
      })),
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 lifecycle eval 时出错，未能判断记忆是否正确降权或归档。'
        : 'Lifecycle eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runComposeStyleMemoryCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    traceCount: caseItem.sampleContext?.traces?.length ?? 0,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-compose-style-memory.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'compose_style_memory_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      traceCount: caseItem.sampleContext?.traces?.length ?? 0,
      composeRequest: caseItem.sampleContext?.composeRequest
        ? {
            surface: caseItem.sampleContext.composeRequest.surface,
            contextType: caseItem.sampleContext.composeRequest.contextType,
            scenario: caseItem.sampleContext.composeRequest.scenario,
            title: caseItem.sampleContext.composeRequest.title,
          }
        : null,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 compose style memory eval 时出错，未能判断写作风格是否晋升。'
        : 'Compose style memory eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runSceneMemoryAutopilotCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    memoryCount: caseItem.sampleContext?.memories?.length ?? 0,
    recallRequest: caseItem.request,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-scene-memory-autopilot.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'scene_memory_autopilot_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      collectionMode: collected.collectionMode,
      memoryCount: caseItem.sampleContext?.memories?.length ?? 0,
      sourceProvenance: caseItem.sampleContext?.sourceProvenance || [],
      request: caseItem.request,
    },
    sampleSummary: summarizeSampleText(collected.primaryText || caseItem.title),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Scene Memory Autopilot eval 时出错，未能判断静默策略。'
        : 'Scene Memory Autopilot eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    autopilot: response.autopilot || response.actualOutput?.autopilot,
    sourceProvenanceAudit:
      response.sourceProvenanceAudit ||
      response.actualOutput?.sourceProvenanceAudit,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runKeystoneMemoryBriefsCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request: {
      kind: caseItem.kind,
      title: caseItem.title,
      expectedBehavior: caseItem.expectedBehavior,
      brief: caseItem.sampleContext?.brief,
      sourceCount: caseItem.sampleContext?.sources?.length ?? 0,
      recallRequest: caseItem.sampleContext?.request,
      rawMatchCount: caseItem.sampleContext?.matches?.length ?? 0,
    },
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-keystone-memory-briefs.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'keystone_memory_briefs_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-5000),
    stderr: commandResult.stderr.slice(-5000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      collectionMode: collected.collectionMode,
      sourceProvenance: caseItem.sampleContext?.sourceProvenance || [],
      memoryCount: caseItem.sampleContext?.sources?.length ?? 0,
      request: caseItem.sampleContext?.request,
      brief: caseItem.sampleContext?.brief,
      rawMatches: caseItem.sampleContext?.matches || [],
    },
    sampleSummary: summarizeSampleText(collected.primaryText || caseItem.title),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Keystone Memory Briefs eval 时出错，未能判断简报边界。'
        : 'Keystone Memory Briefs eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runChangeMemoryLedgerCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request: {
      kind: caseItem.kind,
      title: caseItem.title,
      query: caseItem.query,
      expectedBehavior: caseItem.expectedBehavior,
      sourceCount: caseItem.sampleContext?.sources?.length ?? 0,
    },
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-change-memory-ledger.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'change_memory_ledger_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-5000),
    stderr: commandResult.stderr.slice(-5000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      collectionMode: collected.collectionMode,
      sourceCount: caseItem.sampleContext?.sources?.length ?? 0,
      query: caseItem.query,
    },
    sampleSummary: summarizeSampleText(collected.primaryText || caseItem.title),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Change Memory Ledger eval 时出错，未能判断变化脉络。'
        : 'Change Memory Ledger eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runEvidenceWatchContractsCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    scenario: caseItem.scenario,
    question: caseItem.question,
    expectedBehavior: caseItem.expectedBehavior,
    action: caseItem.action,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-evidence-watch-contracts.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'evidence_watch_contracts_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      question: caseItem.question,
      plan: {
        disposition: caseItem.plan?.disposition,
        reasonCode: caseItem.plan?.reasonCode,
        gapType: caseItem.plan?.gapType,
        sourceAnchor: caseItem.plan?.sourceAnchor,
        recommendedAction: caseItem.plan?.recommendedAction,
      },
      action: caseItem.action,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.question || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Evidence Watch eval 时出错，未能判断守望契约体验。'
        : 'Evidence Watch eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runOpenQuestionExitContractsCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    scenario: caseItem.scenario,
    question: caseItem.question,
    owner: caseItem.owner,
    existingOwner: caseItem.existingOwner,
    repeat: caseItem.repeat,
    resume: caseItem.resume,
    expectedBehavior: caseItem.expectedBehavior,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-open-question-exit-contracts.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'open_question_exit_contracts_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      question: caseItem.question,
      owner: caseItem.owner,
      existingOwner: caseItem.existingOwner,
      repeat: caseItem.repeat,
      resume: caseItem.resume,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.question || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Open Question Exit Contract eval 时出错，未能判断问题生命周期。'
        : 'Open Question Exit Contract eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runActionReadinessContractsCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    scenario: caseItem.scenario,
    action: caseItem.action,
    expectedBehavior: caseItem.expectedBehavior,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-action-readiness-contracts.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'action_readiness_contracts_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      action: caseItem.action,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.scenario || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Action Readiness eval 时出错，未能判断执行前门禁。'
        : 'Action Readiness eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runEvidenceCohesionGateCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    scenario: caseItem.scenario,
    gateRequest: caseItem.request,
    expectedBehavior: caseItem.expectedBehavior,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-evidence-cohesion-gate.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'evidence_cohesion_gate_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      gateRequest: caseItem.request,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.scenario || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Evidence Cohesion Gate eval 时出错，未能判断证据对齐边界。'
        : 'Evidence Cohesion Gate eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runMeetingOutcomeBinderCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request: {
      kind: caseItem.kind,
      title: caseItem.title,
      scenario: caseItem.scenario,
      previewSlotCount: caseItem.preview?.candidateSlots?.length || 0,
      meetingId: caseItem.meeting?.meetingId,
      evidenceCount:
        (caseItem.meeting?.decisions?.length || 0) +
        (caseItem.meeting?.actionItems?.length || 0) +
        (caseItem.meeting?.chapters?.length || 0) +
        (caseItem.meeting?.transcript?.length || 0),
      expectedBehavior: caseItem.expectedBehavior,
    },
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-meeting-outcome-binder.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'meeting_outcome_binder_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      preview: caseItem.preview,
      meeting: caseItem.meeting,
      llm: caseItem.llm,
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.scenario || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Meeting Outcome Binder eval 时出错，未能判断证据装订质量。'
        : 'Meeting Outcome Binder eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 migration、生产 service 与 tsx runner 可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runSourceMemoryDistillerCase({
  suite,
  caseItem,
  runDir,
  collected,
}) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request: {
      kind: caseItem.kind,
      title: caseItem.title,
      scenario: caseItem.scenario,
      sourceCount: caseItem.sources?.length ?? 0,
      recallChecks: caseItem.recallChecks || [],
      expectedBehavior: caseItem.expectedBehavior,
    },
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-source-memory-distiller.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'source_memory_distiller_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedBehavior: caseItem.expectedBehavior,
    sampleDetails: {
      scenario: caseItem.scenario,
      sourceCount: caseItem.sources?.length ?? 0,
      sourceKinds: (caseItem.sources || []).map((source) => source.sourceKind),
      modelProfile: caseItem.modelProfile,
      recallChecks: caseItem.recallChecks || [],
    },
    sampleSummary: summarizeSampleText(
      collected.primaryText || caseItem.scenario || caseItem.title || caseItem.id,
    ),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Source Memory Distiller eval 时出错，未能判断证据与副作用边界。'
        : 'Source Memory Distiller eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 migration、生产 service 与 tsx runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function runEstimateCueCompilerCase({ suite, caseItem, runDir, collected }) {
  const casePath = path.join(runDir, `${caseItem.id}.case.json`);
  await fs.writeFile(resolveRepoPath(casePath), JSON.stringify(caseItem, null, 2));

  const request = {
    kind: caseItem.kind,
    title: caseItem.title,
    expectedCue: caseItem.expectedCue,
    expectedOutcomes: caseItem.expectedOutcomes,
    memoryCount: caseItem.sampleContext?.memories?.length ?? 0,
    recallRequest: caseItem.request,
    composerRequest: caseItem.composerRequest
      ? {
          surface: caseItem.composerRequest.surface,
          contextType: caseItem.composerRequest.contextType,
          scenario: caseItem.composerRequest.scenario,
          title: caseItem.composerRequest.title,
          url: caseItem.composerRequest.url,
        }
      : undefined,
  };
  await appendJsonl(path.join(runDir, 'requests.jsonl'), {
    caseId: caseItem.id,
    request,
  });

  const commandResult = await runProcess(
    './node_modules/.bin/tsx',
    ['../tools/eval-estimate-cue-compiler.ts', resolveRepoPath(casePath)],
    {
      cwd: resolveRepoPath('memory-service'),
      timeoutMs: 60_000,
    },
  );
  const responseEnvelope = parseCommandJsonOutput(
    commandResult,
    'estimate_cue_compiler_eval',
  );
  await appendJsonl(path.join(runDir, 'responses.jsonl'), {
    caseId: caseItem.id,
    command: [commandResult.command, ...commandResult.args].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-4000),
    stderr: commandResult.stderr.slice(-4000),
    ...responseEnvelope,
  });

  const status =
    commandResult.code === 0 && responseEnvelope.response
      ? responseEnvelope.response.status
      : 'error';
  const response = responseEnvelope.response || {};
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    expectedBehavior: {
      expectedCue: caseItem.expectedCue,
      expectedOutcomes: caseItem.expectedOutcomes,
    },
    sampleDetails: {
      collectionMode: collected.collectionMode,
      memoryCount: caseItem.sampleContext?.memories?.length ?? 0,
      sourceProvenance: caseItem.sampleContext?.sourceProvenance || [],
      request: caseItem.request,
      composerRequest: caseItem.composerRequest
        ? {
            surface: caseItem.composerRequest.surface,
            contextType: caseItem.composerRequest.contextType,
            scenario: caseItem.composerRequest.scenario,
            title: caseItem.composerRequest.title,
            url: caseItem.composerRequest.url,
          }
        : undefined,
    },
    sampleSummary: summarizeSampleText(collected.primaryText || caseItem.title),
    status,
    verdict: status,
    scores: response.scores || {},
    overallScore:
      response.overallScore ?? computeOverallScore(response.scores || {}, status),
    userConclusion:
      response.userConclusion ||
      (status === 'error'
        ? '运行 Estimate Cue Compiler eval 时出错，未能判断人天口径 cue。'
        : 'Estimate Cue Compiler eval completed.'),
    improvementSuggestions: response.improvementSuggestions || [
      '检查 eval command stderr/stdout，确认 runner 是否可执行。',
    ],
    why: response.why || responseEnvelope.error,
    topMatch: response.topMatch,
    cue: response.cue,
    proofSummary: response.proofSummary,
    outcomeSamples: response.outcomeSamples,
    actualOutput:
      response.actualOutput || {
        ok: false,
        exitCode: commandResult.code,
        error: responseEnvelope.error,
      },
    judge: {
      heuristic: response,
      llm: null,
    },
    error: status === 'error' ? responseEnvelope.error : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

function parseMemoryLifecycleEvalOutput(commandResult) {
  return parseCommandJsonOutput(commandResult, 'memory_lifecycle_eval');
}

function parseCommandJsonOutput(commandResult, label) {
  if (commandResult.code !== 0) {
    return {
      ok: false,
      error: commandResult.stderr || commandResult.stdout || `${label}_failed`,
      response: null,
    };
  }

  const lines = String(commandResult.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const jsonLines = [...lines].reverse().filter((line) => line.startsWith('{'));
  if (!jsonLines.length) {
    return {
      ok: false,
      error: `${label}_returned_no_json`,
      response: null,
    };
  }

  let lastParseError = null;
  for (const line of jsonLines) {
    try {
      const response = JSON.parse(line);
      if (isCommandEvalResponse(response)) {
        return {
          ok: true,
          response,
        };
      }
    } catch (err) {
      lastParseError = err;
    }
  }

  try {
    const fallback = JSON.parse(jsonLines[0]);
    return {
      ok: false,
      error: `${label}_returned_json_but_no_eval_response`,
      response: fallback,
    };
  } catch (err) {
    return {
      ok: false,
      error: `${label}_invalid_json: ${(lastParseError || err).message}`,
      response: null,
    };
  }
}

function isCommandEvalResponse(value) {
  if (!value || typeof value !== 'object') return false;
  const status = value.status || value.verdict;
  if (!['pass', 'warn', 'fail', 'error'].includes(status)) return false;
  return (
    value.scores != null ||
    value.overallScore != null ||
    value.userConclusion != null ||
    value.actualOutput != null
  );
}

function summarizeComposeAmbientTrace(trace) {
  return {
    surface: trace.surface,
    sceneKey: trace.sceneKey,
    action: trace.action,
    strength: trace.strength,
    polarity: trace.polarity,
    privacyClass: trace.privacyClass,
    evidenceRefs: trace.evidenceRefs || [],
    redactedDiff: {
      rawTextStored: trace.redactedDiff?.rawTextStored,
      suggestionTextLength: trace.redactedDiff?.suggestionTextLength,
      finalTextLength: trace.redactedDiff?.finalTextLength,
      similarityScore: trace.redactedDiff?.similarityScore,
      editDistanceBand: trace.redactedDiff?.editDistanceBand,
      semanticRelation: trace.redactedDiff?.semanticRelation,
    },
    metadata: trace.metadata || {},
  };
}

async function collectContext(caseItem) {
  if (args.live && caseItem.kind === 'ringcentral_group') {
    const live = await collectLiveRingCentralContext(caseItem);
    if (live.ok) return live;
  }
  if (
    args.live &&
    (caseItem.kind === 'compose_assist_context_pack' ||
      caseItem.kind === 'compose_assist_prompt_patch' ||
      caseItem.kind === 'compose_assist_prompt_rewrite')
  ) {
    const live = await collectLiveWebAiComposerContext(caseItem);
    if (live.ok) return live;
    return {
      ...collectSnapshotContext(caseItem),
      collectionMode: 'snapshot_after_live_failed',
      liveError: live.error || live.reason || 'live_web_ai_context_unavailable',
    };
  }
  return collectSnapshotContext(caseItem);
}

function collectSnapshotContext(caseItem) {
  const snapshot = caseItem.sampleContext || {};
  return {
    ok: true,
    collectionMode: snapshot.collectionMode || 'snapshot',
    title: snapshot.title || caseItem.title,
    url: snapshot.url || caseItem.canonicalUrl || caseItem.url,
    primaryText: snapshot.primaryText || caseItem.expectedTopics?.join(', ') || caseItem.title,
    secondaryTexts: snapshot.secondaryTexts || [caseItem.title].filter(Boolean),
    draftText: snapshot.draftText,
    visibleMessages: snapshot.visibleMessages,
    raw: snapshot,
  };
}

function redactComposeAmbientSample(sampleContext = {}) {
  return {
    collectionMode: sampleContext.collectionMode || 'snapshot',
    site: sampleContext.site,
    composerType: sampleContext.composerType,
    currentThreadHash: sampleContext.currentThread
      ? stableHash(sampleContext.currentThread)
      : undefined,
    draftTextLength: String(sampleContext.draftText || '').length,
    suggestionTextLength: String(sampleContext.suggestionText || '').length,
    finalSentTextLength: String(sampleContext.finalSentText || '').length,
    evidenceRefs: (sampleContext.evidenceRefs || []).map((ref) => ({
      id: ref.id,
      type: ref.type,
      title: ref.title,
    })),
  };
}

function buildAskContextGapSampleDetails(caseItem, collected) {
  return {
    collectionMode: collected.collectionMode,
    problemStatement: caseItem.problemStatement,
    query: caseItem.query,
    context: caseItem.context,
    expectedExtraction: caseItem.expectedExtraction,
    scope: caseItem.scope,
    includeEvidence: caseItem.includeEvidence,
    primaryText: collected.primaryText,
    secondaryTexts: collected.secondaryTexts || [],
    contextGapSignals: caseItem.contextGapSignals || [],
    completionSignals: caseItem.completionSignals || [],
  };
}

function summarizeAskContextGapActualOutput({ response, error, statusCode, durationMs, timeoutMs }) {
  if (error) {
    return {
      ok: false,
      statusCode,
      durationMs,
      timeoutMs,
      error,
      answer: null,
      evidenceCount: 0,
      evidence: [],
      contextMatch: null,
      continuityReceipt: null,
      structuredAnswer: null,
    };
  }
  const evidence = Array.isArray(response?.evidence) ? response.evidence : [];
  return {
    ok: true,
    statusCode,
    durationMs,
    timeoutMs,
    queryTimeMs: response?.queryTimeMs,
    answer: truncateText(String(response?.answer || response?.structuredAnswer?.summary || ''), 600),
    evidenceCount: evidence.length,
    evidence: evidence.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.sourceTitle || item.source || item.type || item.id,
      source: item.source || item.type,
      snippet: truncateText(String(item.content || item.summary || ''), 220),
    })),
    contextMatch: summarizeAskContextMatch(response?.contextMatch),
    continuityReceipt: response?.continuityReceipt
      ? {
          source: response.continuityReceipt.source,
          localOnly: response.continuityReceipt.localOnly,
          usedAsHint: response.continuityReceipt.usedAsHint,
          reRetrieved: response.continuityReceipt.reRetrieved,
          detail: truncateText(String(response.continuityReceipt.detail || ''), 240),
        }
      : null,
    structuredAnswer: response?.structuredAnswer
      ? {
          summary: truncateText(String(response.structuredAnswer.summary || ''), 300),
          keyFindings: (response.structuredAnswer.keyFindings || []).slice(0, 5),
          missingInfo: (response.structuredAnswer.missingInfo || []).slice(0, 5),
        }
      : null,
  };
}

function buildComposeAmbientCalibrationTrace(caseItem) {
  const sample = caseItem.sampleContext || {};
  const suggestionText = String(sample.suggestionText || '');
  const finalText = String(sample.finalSentText || '');
  const similarity = textSimilarity(suggestionText, finalText);
  const action = classifyComposeAmbientAction({ suggestionText, finalText, similarity });
  const evidenceRole =
    action === 'sent_after_insert'
      ? 'used'
      : action === 'edited_before_send'
        ? 'corrected'
        : action === 'deleted_before_send'
          ? 'deleted'
          : 'ignored';
  const polarity =
    action === 'sent_after_insert'
      ? 'positive'
      : action === 'edited_before_send'
        ? 'correction'
        : 'negative';

  return {
    surface: 'compose_assist',
    sceneKey: `compose-assist:${stableHash(
      [sample.site, sample.composerType, sample.currentThread].filter(Boolean).join('|'),
    )}`,
    action,
    strength: action === 'sent_after_insert' ? 'strong' : 'strong',
    polarity,
    privacyClass: 'sensitive_redacted',
    evidenceRefs: (sample.evidenceRefs || []).map((ref) => ({
      id: ref.id,
      type: ref.type,
      title: ref.title,
      role: evidenceRole,
    })),
    redactedDiff: {
      rawTextStored: false,
      suggestionHash: stableHash(suggestionText),
      finalHash: stableHash(finalText),
      suggestionTextLength: suggestionText.length,
      finalTextLength: finalText.length,
      similarityScore: Number(similarity.toFixed(3)),
      editDistanceBand: editDistanceBand(similarity),
      semanticRelation:
        similarity >= 0.65
          ? 'same_intent'
          : similarity >= 0.35
            ? 'partially_rewritten'
            : 'different_intent',
    },
    metadata: {
      site: sample.site,
      composerType: sample.composerType,
      traceGeneratedBy: 'eval-runner',
    },
  };
}

function classifyComposeAmbientAction({ suggestionText, finalText, similarity }) {
  if (!String(finalText || '').trim()) return 'deleted_before_send';
  const normalizedSuggestion = normalizeForSimilarity(suggestionText);
  const normalizedFinal = normalizeForSimilarity(finalText);
  if (
    similarity >= 0.92 ||
    (normalizedSuggestion && normalizedFinal.includes(normalizedSuggestion))
  ) {
    return 'sent_after_insert';
  }
  if (similarity >= 0.35) return 'edited_before_send';
  return 'deleted_before_send';
}

function judgeComposeAmbientCalibration({ caseItem, trace }) {
  const expected = caseItem.expectedBehavior?.ambientTrace || {};
  const sample = caseItem.sampleContext || {};
  const failures = [];
  const warnings = [];

  if (expected.action && trace.action !== expected.action) {
    failures.push(`trace action 应为 ${expected.action}，实际为 ${trace.action}`);
  }
  if (expected.polarity && trace.polarity !== expected.polarity) {
    failures.push(`trace polarity 应为 ${expected.polarity}，实际为 ${trace.polarity}`);
  }
  if (expected.privacyClass && trace.privacyClass !== expected.privacyClass) {
    failures.push(`trace privacyClass 应为 ${expected.privacyClass}，实际为 ${trace.privacyClass}`);
  }

  const traceText = JSON.stringify(trace);
  for (const field of expected.mustNotStore || []) {
    const rawValue = sample[field];
    if (rawValue && traceText.includes(String(rawValue))) {
      failures.push(`trace 泄露了原始 ${field}`);
    }
  }
  for (const field of expected.mustStore || []) {
    if (trace[field] === undefined || trace[field] === null) {
      failures.push(`trace 缺少 ${field}`);
    }
  }
  if (trace.redactedDiff?.rawTextStored !== false) {
    failures.push('redactedDiff.rawTextStored 必须是 false');
  }
  if (!Array.isArray(trace.evidenceRefs) || !trace.evidenceRefs.length) {
    failures.push('trace 必须保留 evidenceRefs，后续才能回调召回质量');
  }
  if (!trace.redactedDiff?.suggestionHash || !trace.redactedDiff?.finalHash) {
    warnings.push('trace 缺少 hash，后续难以做去重或一致性诊断');
  }

  const scores = {
    calibration_action: expected.action && trace.action === expected.action ? 3 : 0,
    privacy_redaction: failures.some((item) => /泄露|rawTextStored|privacyClass/.test(item)) ? 0 : 3,
    evidence_refs: Array.isArray(trace.evidenceRefs) && trace.evidenceRefs.length ? 3 : 0,
    diff_quality:
      trace.redactedDiff?.suggestionHash &&
      trace.redactedDiff?.finalHash &&
      Number.isFinite(trace.redactedDiff?.similarityScore)
        ? 3
        : 1,
  };
  const scoreValues = Object.values(scores);
  const overallScore = Math.round(
    (scoreValues.reduce((sum, value) => sum + value, 0) /
      (scoreValues.length * 3)) *
      100,
  );
  const verdict = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';
  const whyItems = [
    `action=${trace.action}`,
    `polarity=${trace.polarity}`,
    `privacy=${trace.privacyClass}`,
    `similarity=${trace.redactedDiff?.similarityScore ?? '-'}`,
  ];

  return {
    verdict,
    scores,
    overallScore: verdict === 'fail' ? Math.min(overallScore, 49) : overallScore,
    why: failures[0] || warnings[0] || 'Compose Assist send-time edit produced a redacted calibration trace with evidence refs.',
    whyItems,
    userConclusion: failures.length
      ? '不通过：无感校准 trace 的动作、隐私或证据字段不符合预期。'
      : warnings.length
        ? '需关注：trace 可用，但诊断字段还不完整。'
        : '通过：send-time edit 能转成无感校准 trace，且没有保存原始发送文本。',
    improvementSuggestions: failures.length
      ? failures
      : warnings.length
        ? warnings
        : ['保持无感采样，不新增用户校准平台；继续补 Memory Lens / Today Pilot / Meeting Pilot 的自然动作 trace。'],
  };
}

function stableHash(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeForSimilarity(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textSimilarity(left, right) {
  const normalizedLeft = normalizeForSimilarity(left);
  const normalizedRight = normalizeForSimilarity(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return Math.min(normalizedLeft.length, normalizedRight.length) /
      Math.max(normalizedLeft.length, normalizedRight.length);
  }

  const leftTokens = new Set(tokenizeForSimilarity(normalizedLeft));
  const rightTokens = new Set(tokenizeForSimilarity(normalizedRight));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? overlap / union : 0;
}

function tokenizeForSimilarity(text) {
  const tokens = String(text || '').match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) || [];
  if (tokens.length > 1) return tokens;
  return Array.from(String(text || '').replace(/\s+/g, '')).filter(Boolean);
}

function editDistanceBand(score) {
  if (score >= 0.92) return 'none';
  if (score >= 0.65) return 'light';
  if (score >= 0.35) return 'material';
  return 'replacement';
}

async function collectLiveRingCentralContext(caseItem) {
  const mcporterConfig = process.env.MCPORTER_CONFIG || '/Users/Esone/.openclaw/config/mcporter.json';
  const url = caseItem.canonicalUrl || caseItem.url;
  const navigate = await runProcess(
    'mcporter',
    ['--config', mcporterConfig, 'call', 'webpage-mcp.chrome_navigate', `url=${url}`, 'target=newTab'],
    { timeoutMs: 30_000 },
  );
  if (navigate.code !== 0) {
    return { ok: false, collectionMode: 'live_failed', error: navigate.stderr || navigate.stdout };
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const code = `(() => {
    const title = document.querySelector('[data-test-automation-id="conversationTitle"], h1')?.innerText || document.title;
    const cards = [...document.querySelectorAll('.conversation-card__right, [class*="conversation-card"]')]
      .slice(-12)
      .map((el) => el.innerText)
      .filter(Boolean);
    return { title, cards };
  })()`;
  const page = await runProcess(
    'mcporter',
    ['--config', mcporterConfig, 'call', 'webpage-mcp.chrome_javascript', `code=${code}`],
    { timeoutMs: 30_000 },
  );
  if (page.code !== 0) {
    return { ok: false, collectionMode: 'live_failed', error: page.stderr || page.stdout };
  }
  const parsed = parseMaybeJson(page.stdout);
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
  return {
    ok: true,
    collectionMode: 'live_webpage',
    title: parsed?.title || caseItem.title,
    url,
    primaryText: cards.join('\n\n').slice(-1800) || caseItem.sampleContext?.primaryText || caseItem.title,
    secondaryTexts: [caseItem.title, ...(caseItem.sampleContext?.secondaryTexts || [])].filter(Boolean),
    raw: parsed || page.stdout,
  };
}

async function collectLiveWebAiComposerContext(caseItem) {
  const mcporterConfig = process.env.MCPORTER_CONFIG || '/Users/Esone/.openclaw/config/mcporter.json';
  const liveTarget = caseItem.liveTarget || {};
  const tabsResult = await runProcess(
    'mcporter',
    ['--config', mcporterConfig, 'call', 'webpage-mcp.get_windows_and_tabs'],
    { timeoutMs: 30_000 },
  );
  if (tabsResult.code !== 0) {
    return { ok: false, collectionMode: 'live_failed', error: tabsResult.stderr || tabsResult.stdout };
  }

  const tabsSnapshot = parseMaybeJson(tabsResult.stdout);
  let tab = pickLiveComposerTab(tabsSnapshot, caseItem);
  if (!tab && liveTarget.openUrl) {
    const navigate = await runProcess(
      'mcporter',
      [
        '--config',
        mcporterConfig,
        'call',
        'webpage-mcp.chrome_navigate',
        `url=${liveTarget.openUrl}`,
        'openMode=newTab',
      ],
      { timeoutMs: 30_000 },
    );
    if (navigate.code !== 0) {
      return { ok: false, collectionMode: 'live_failed', error: navigate.stderr || navigate.stdout };
    }
    await new Promise((resolve) => setTimeout(resolve, Number(liveTarget.waitMs || 3000)));
    const refreshedTabs = await runProcess(
      'mcporter',
      ['--config', mcporterConfig, 'call', 'webpage-mcp.get_windows_and_tabs'],
      { timeoutMs: 30_000 },
    );
    tab = pickLiveComposerTab(parseMaybeJson(refreshedTabs.stdout), caseItem);
  }

  if (!tab?.tabId) {
    return {
      ok: false,
      collectionMode: 'live_no_matching_tab',
      reason: 'no_matching_web_ai_or_codex_tab',
      tabs: summarizeBrowserTabs(tabsSnapshot),
    };
  }

  const code = `return (() => {
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const unique = (items) => {
      const seen = new Set();
      const out = [];
      for (const item of items) {
        const text = clean(item);
        if (!text || text.length < 8) continue;
        const key = text.slice(0, 160);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
      }
      return out;
    };
    const inputValues = unique([
      ...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]')
    ].map((el) => el.value || el.innerText || el.textContent || ''));
    const messageCandidates = unique([
      ...document.querySelectorAll('[data-message-author-role], article, main [role="listitem"], [class*="message"], [class*="conversation"], [class*="turn"]')
    ].map((el) => el.innerText || el.textContent || ''));
    const mainText = clean((document.querySelector('main') || document.body)?.innerText || '');
    return {
      title: document.title,
      url: location.href,
      focusedText: document.activeElement ? clean(document.activeElement.value || document.activeElement.innerText || document.activeElement.textContent || '') : '',
      inputValues: inputValues.slice(-6),
      messages: messageCandidates.slice(-12),
      bodyText: mainText.slice(-3500)
    };
  })();`;
  const page = await runProcess(
    'mcporter',
    [
      '--config',
      mcporterConfig,
      'call',
      'webpage-mcp.chrome_javascript',
      `tabId=${tab.tabId}`,
      `code=${code}`,
      'maxOutputBytes=60000',
    ],
    { timeoutMs: 30_000 },
  );
  if (page.code !== 0) {
    return { ok: false, collectionMode: 'live_failed', error: page.stderr || page.stdout };
  }

  const parsed = parseMaybeJson(page.stdout);
  const resultValue = parseMaybeJson(parsed?.result) || parsed?.result || parsed;
  const messages = Array.isArray(resultValue?.messages) ? resultValue.messages : [];
  const inputValues = Array.isArray(resultValue?.inputValues) ? resultValue.inputValues : [];
  const draftText =
    resultValue?.focusedText ||
    inputValues.find((value) => String(value || '').trim()) ||
    caseItem.sampleContext?.draftText;
  const primaryText =
    messages.join('\n\n') ||
    resultValue?.bodyText ||
    caseItem.sampleContext?.primaryText ||
    caseItem.title;

  return {
    ok: true,
    collectionMode: 'live_webpage_mcp',
    title: resultValue?.title || tab.title || caseItem.title,
    url: resultValue?.url || tab.url || caseItem.url,
    primaryText,
    secondaryTexts: [
      caseItem.title,
      ...(caseItem.sampleContext?.secondaryTexts || []),
    ].filter(Boolean),
    draftText,
    visibleMessages: messages.slice(-8).map((text, index) => ({
      id: `live-${index + 1}`,
      sender: 'visible-page',
      text,
    })),
    raw: {
      tab: {
        tabId: tab.tabId,
        title: tab.title,
        url: tab.url,
      },
      inputValues,
      bodyText: resultValue?.bodyText,
    },
  };
}

function pickLiveComposerTab(tabsSnapshot, caseItem) {
  const tabs = flattenBrowserTabs(tabsSnapshot).filter((tab) => !tab.restricted);
  const liveTarget = caseItem.liveTarget || {};
  const urlIncludes = normalizeArray(liveTarget.urlIncludes);
  const titleIncludes = normalizeArray(liveTarget.titleIncludes);
  const fallbackTerms = normalizeArray([
    liveTarget.provider,
    caseItem.sampleContext?.site,
    'chatgpt',
    'gemini',
    'claude',
    'doubao',
    'codex',
  ]);

  const scored = tabs.map((tab) => {
    const haystack = normalize([tab.title, tab.url].filter(Boolean).join(' '));
    let urlMatchCount = 0;
    let score = tab.active ? 1 : 0;
    for (const term of urlIncludes) {
      if (normalize(tab.url).includes(normalize(term))) {
        urlMatchCount += 1;
        score += 4;
      }
    }
    for (const term of titleIncludes) {
      if (normalize(tab.title).includes(normalize(term))) {
        score += 4;
      }
    }
    for (const term of fallbackTerms) {
      if (term && haystack.includes(normalize(term))) score += 1;
    }
    if (urlIncludes.length && urlMatchCount === 0 && !liveTarget.allowTitleOnly) {
      score = 0;
    }
    return { tab, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.score > 0 ? scored[0].tab : null;
}

function flattenBrowserTabs(tabsSnapshot) {
  const windows = Array.isArray(tabsSnapshot?.windows) ? tabsSnapshot.windows : [];
  return windows.flatMap((windowItem) =>
    (windowItem.tabs || []).map((tab) => ({
      ...tab,
      windowId: windowItem.windowId,
    })),
  );
}

function summarizeBrowserTabs(tabsSnapshot) {
  return flattenBrowserTabs(tabsSnapshot)
    .slice(0, 20)
    .map((tab) => ({
      tabId: tab.tabId,
      title: tab.title,
      url: tab.url,
      active: tab.active,
      restricted: tab.restricted,
    }));
}

function buildContextRecallRequest({ caseItem, collected }) {
  const url = caseItem.canonicalUrl || caseItem.url;
  const conversationId = caseItem.conversationId;
  return {
    surface: 'follow_thread',
    contextType: 'message_thread',
    title: collected.title || caseItem.title,
    url,
    primaryText: collected.primaryText,
    secondaryTexts: collected.secondaryTexts || [],
    sourceContext: {
      contextType: 'message_thread',
      sourceType: 'ringcentral_message',
      host: 'app.ringcentral.com',
      url,
      title: caseItem.title,
      groupId: conversationId,
      conversationId,
    },
    exclude: {
      urls: [url].filter(Boolean),
      groupIds: [conversationId].filter(Boolean),
      conversationIds: [conversationId].filter(Boolean),
    },
    sourceTypes: ['glip', 'manual', 'markdown', 'web', 'jira', 'system'],
    limit: 3,
    debug: true,
  };
}

async function postContextRecall({ suite, caseItem, request }) {
  const endpoint = process.env.EVAL_MEMORY_SERVICE_URL || suite.endpoint?.url;
  const userId = process.env.EVAL_USER_ID || suite.endpoint?.userId || caseItem.owner;
  if (!endpoint) return { ok: false, error: 'missing_context_recall_endpoint' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.EVAL_HTTP_TIMEOUT_MS || 20_000));
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const text = await res.text();
    const response = parseMaybeJson(text);
    return {
      ok: res.ok,
      statusCode: res.status,
      response,
      error: res.ok ? undefined : text,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function buildAskContextGapRequest({ caseItem }) {
  const request = {
    query: caseItem.query,
    includeEvidence: caseItem.includeEvidence ?? true,
    scope: caseItem.scope || 'work',
  };
  if (caseItem.context) request.context = caseItem.context;
  if (caseItem.contextHints) {
    const contextHints = { ...caseItem.contextHints };
    const ageHours = Number(caseItem.contextHintsAgeHours);
    if (Number.isFinite(ageHours) && ageHours >= 0) {
      contextHints.updatedAt = new Date(
        Date.now() - ageHours * 60 * 60 * 1000,
      ).toISOString();
    } else if (!contextHints.updatedAt) {
      contextHints.updatedAt = new Date().toISOString();
    }
    request.contextHints = contextHints;
  }
  return request;
}

async function postAskContextGap({ suite, caseItem, request }) {
  const endpoint = process.env.EVAL_ASK_URL || suite.endpoint?.url;
  const userId = process.env.EVAL_USER_ID || suite.endpoint?.userId || caseItem.owner;
  if (!endpoint) return { ok: false, error: 'missing_ask_endpoint' };
  if (!request.query) return { ok: false, error: 'missing_ask_query' };

  const controller = new AbortController();
  const timeoutMs = Number(process.env.EVAL_ASK_TIMEOUT_MS || process.env.EVAL_HTTP_TIMEOUT_MS || 90_000);
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const text = await res.text();
    const response = parseMaybeJson(text);
    return {
      ok: res.ok,
      statusCode: res.status,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      response,
      error: res.ok ? undefined : text,
    };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      error: isAbort ? `ask_request_timeout_after_${timeoutMs}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runAnswerMemoryTrackerCase({ suite, caseItem, runDir, collected }) {
  const steps = Array.isArray(caseItem.steps) ? caseItem.steps : [];
  if (!steps.length) {
    const result = {
      caseId: caseItem.id,
      suiteId: suite.id,
      caseKind: caseItem.kind,
      caseTitle: caseItem.title,
      status: 'error',
      verdict: 'error',
      scores: { answer_memory_tracking: 0 },
      overallScore: 0,
      userConclusion: '样本没有定义 steps，无法执行多轮 Ask。',
      improvementSuggestions: ['为 answer-memory-tracker case 增加 steps 数组。'],
      actualOutput: { ok: false, error: 'missing_steps' },
      judge: { heuristic: null, llm: null },
      error: 'missing_steps',
    };
    await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
    return result;
  }

  const stepResults = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const request = {
      query: step.query,
      context: step.context ?? caseItem.context,
      includeEvidence: step.includeEvidence ?? caseItem.includeEvidence ?? true,
      scope: step.scope ?? caseItem.scope ?? 'work',
    };
    if (!request.context) delete request.context;
    await appendJsonl(path.join(runDir, 'requests.jsonl'), {
      caseId: caseItem.id,
      stepId: step.id || `step-${index + 1}`,
      request,
    });
    const responseEnvelope = await postAskContextGap({ suite, caseItem, request });
    await appendJsonl(path.join(runDir, 'responses.jsonl'), {
      caseId: caseItem.id,
      stepId: step.id || `step-${index + 1}`,
      ...responseEnvelope,
    });
    stepResults.push({
      step,
      request,
      responseEnvelope,
      answerMemoryState: responseEnvelope.response?.answerMemory?.state,
      authorityDecision:
        responseEnvelope.response?.answerMemory?.authority?.decision || null,
    });
  }

  const heuristic = judgeAnswerMemoryTracker({ caseItem, stepResults });
  const anyError = stepResults.some((item) => !item.responseEnvelope.ok);
  const status = anyError ? 'error' : heuristic.verdict;
  const result = {
    caseId: caseItem.id,
    suiteId: suite.id,
    caseKind: caseItem.kind,
    caseTitle: caseItem.title,
    query: steps.map((step) => step.query).join(' -> '),
    providedContext: caseItem.context,
    problemStatement: caseItem.problemStatement,
    expectedExtraction: caseItem.expectedExtraction,
    expectedBehavior: caseItem.expectedBehavior,
    expectedTopics: caseItem.expectedTopics || [],
    mustNotReturnTopics: caseItem.mustNotReturnTopics || [],
    sampleDetails: buildAskContextGapSampleDetails(caseItem, collected),
    sampleSummary: summarizeSampleText(collected.primaryText),
    status,
    verdict: status,
    scores: heuristic.scores,
    overallScore: computeOverallScore(heuristic.scores, status),
    userConclusion: heuristic.userConclusion,
    improvementSuggestions: heuristic.improvementSuggestions,
    why: heuristic.why,
    contextMatch: heuristic.contextMatch,
    matchedExpectedTopics: heuristic.matchedExpectedTopics,
    matchedEvidenceTopics: heuristic.matchedEvidenceTopics,
    matchedMustNotReturnTopics: heuristic.matchedMustNotReturnTopics,
    evidenceCount: heuristic.evidenceCount,
    actualOutput: summarizeAnswerMemoryTrackerActualOutput(stepResults),
    judge: {
      heuristic,
      llm: null,
    },
    error: anyError
      ? stepResults.find((item) => !item.responseEnvelope.ok)?.responseEnvelope.error
      : undefined,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

function judgeAnswerMemoryTracker({ caseItem, stepResults }) {
  const expectedStates = stepResults.map((item, index) => {
    if (item.step.expectedAnswerMemoryState) {
      return item.step.expectedAnswerMemoryState;
    }
    return Array.isArray(caseItem.expectedAnswerMemoryStates)
      ? caseItem.expectedAnswerMemoryStates[index]
      : undefined;
  });
  const actualStates = stepResults.map((item) => item.answerMemoryState || null);
  const expectedAuthorityDecisions = stepResults.map((item, index) => {
    if (item.step.expectedAuthorityDecision) {
      return item.step.expectedAuthorityDecision;
    }
    return Array.isArray(caseItem.expectedAuthorityDecisions)
      ? caseItem.expectedAuthorityDecisions[index]
      : undefined;
  });
  const actualAuthorityDecisions = stepResults.map(
    (item) => item.authorityDecision || null,
  );
  const stateMatches = expectedStates.map((expected, index) => {
    if (!expected) return true;
    const actual = actualStates[index];
    return Array.isArray(expected)
      ? expected.includes(actual)
      : actual === expected;
  });
  const authorityMatches = expectedAuthorityDecisions.map((expected, index) => {
    if (!expected) return true;
    const actual = actualAuthorityDecisions[index];
    return Array.isArray(expected)
      ? expected.includes(actual)
      : actual === expected;
  });
  const lastResponse = stepResults.at(-1)?.responseEnvelope.response;
  const lastHeuristic = judgeAskContextGap({ caseItem, response: lastResponse });
  const stateMatchCount = stateMatches.filter(Boolean).length;
  const expectedAuthorityCount = expectedAuthorityDecisions.filter(Boolean).length;
  const authorityMatchCount = authorityMatches.filter((matched, index) =>
    Boolean(expectedAuthorityDecisions[index]) && matched,
  ).length;
  const trackingScore = Math.min(3, stateMatchCount);
  const authorityScore = expectedAuthorityCount
    ? Math.min(3, Math.round((authorityMatchCount / expectedAuthorityCount) * 3))
    : 3;
  const authorityObservable =
    expectedAuthorityCount > 0 || actualAuthorityDecisions.some(Boolean);
  const progressionOk = stateMatches.every(Boolean) && authorityMatches.every(Boolean);
  const evidenceOk = lastHeuristic.evidenceCount > 0;
  const verdict =
    progressionOk && lastHeuristic.verdict !== 'fail'
      ? 'pass'
      : progressionOk && evidenceOk
        ? 'warn'
        : 'fail';
  const mismatches = expectedStates
    .map((expected, index) => ({ expected, actual: actualStates[index], index }))
    .filter((item) => item.expected && !stateMatches[item.index]);
  const authorityMismatches = expectedAuthorityDecisions
    .map((expected, index) => ({
      expected,
      actual: actualAuthorityDecisions[index],
      index,
    }))
    .filter((item) => item.expected && !authorityMatches[item.index]);
  return {
    verdict,
    scores: {
      answer_memory_tracking: trackingScore,
      ...(expectedAuthorityCount
        ? { authority_contract: authorityScore }
        : {}),
      context_match: lastHeuristic.scores?.context_match ?? 0,
      evidence_grounding: lastHeuristic.scores?.evidence_grounding ?? 0,
      answer_quality: lastHeuristic.scores?.answer_quality ?? 0,
    },
    why: mismatches.length || authorityMismatches.length
      ? `Answer memory state mismatch: ${mismatches
          .map((item) => `step ${item.index + 1} expected ${item.expected} got ${item.actual || 'none'}`)
          .join('; ') || 'none'}${
          authorityMismatches.length
            ? `; authority mismatch: ${authorityMismatches
                .map((item) => `step ${item.index + 1} expected ${item.expected} got ${item.actual || 'none'}`)
                .join('; ')}`
            : ''
        }`
      : `Answer memory states matched: ${actualStates.join(' -> ')}${
          actualAuthorityDecisions.some(Boolean)
            ? `; authority decisions: ${actualAuthorityDecisions.map((item) => item || 'none').join(' -> ')}`
            : ''
        }`,
    userConclusion: progressionOk
      ? authorityObservable
        ? '多轮 Ask 返回了预期的 answerMemory 状态，活答案底层追踪和权威合约可观察。'
        : '多轮 Ask 返回了预期的 answerMemory 状态，活答案底层追踪可观察。'
      : '多轮 Ask 没有按预期完成 observation/promote/priorHit 递进。',
    improvementSuggestions: progressionOk
      ? ['继续检查新证据改变答案时是否返回 updated，并确认旧 prior 没有替代当前证据。']
      : [
          '检查 AnswerMemoryService 的 canonical key 是否在短问句和展开问句之间保持稳定。',
          '检查 /ask 是否在最终答案后 observe，并且 contextMatch 是否 locked。',
          '检查 answerMemory.authority 是否区分 current authority evidence、prior 和 derived/query evidence。',
        ],
    contextMatch: lastHeuristic.contextMatch,
    matchedExpectedTopics: lastHeuristic.matchedExpectedTopics,
    matchedEvidenceTopics: lastHeuristic.matchedEvidenceTopics,
    matchedMustNotReturnTopics: lastHeuristic.matchedMustNotReturnTopics,
    evidenceCount: lastHeuristic.evidenceCount,
    states: actualStates,
    authorityDecisions: actualAuthorityDecisions,
  };
}

function summarizeAnswerMemoryTrackerActualOutput(stepResults) {
  return {
    ok: stepResults.every((item) => item.responseEnvelope.ok),
    steps: stepResults.map((item, index) => ({
      id: item.step.id || `step-${index + 1}`,
      query: item.request.query,
      statusCode: item.responseEnvelope.statusCode,
      durationMs: item.responseEnvelope.durationMs,
      answerMemory: item.responseEnvelope.response?.answerMemory || null,
      authorityDecision:
        item.responseEnvelope.response?.answerMemory?.authority?.decision || null,
      contextMatch: summarizeAskContextMatch(item.responseEnvelope.response?.contextMatch),
      answer: truncateText(String(item.responseEnvelope.response?.answer || ''), 400),
      evidenceCount: Array.isArray(item.responseEnvelope.response?.evidence)
        ? item.responseEnvelope.response.evidence.length
        : 0,
      error: item.responseEnvelope.error,
    })),
  };
}

function buildComposeAssistContextPackRequest({ caseItem, collected }) {
  const sample = caseItem.sampleContext || {};
  const site = sample.site || sample.provider || 'chatgpt';
  const surface = normalizeComposeSurface(sample.surface || site);
  const visibleMessages = normalizeVisibleMessages(
    collected.visibleMessages || sample.visibleMessages,
    collected.primaryText || sample.primaryText,
  );
  const primaryText =
    collected.primaryText ||
    sample.primaryText ||
    sample.currentThread ||
    visibleMessages.map((message) => message.text).join('\n\n') ||
    caseItem.title;

  return {
    surface,
    contextType: 'web_agent_prompt',
    scenario: sample.scenario || caseItem.scenario || 'compose_to_ai',
    title: collected.title || sample.title || caseItem.title,
    url: collected.url || sample.url || caseItem.canonicalUrl || caseItem.url,
    draftText: collected.draftText || sample.draftText || caseItem.draftText,
    primaryText,
    secondaryTexts: [
      sample.currentThread,
      ...(collected.secondaryTexts || []),
      ...(sample.secondaryTexts || []),
    ]
      .filter(Boolean)
      .slice(0, 8),
    visibleMessages,
    audience: {
      conversationTitle: collected.title || sample.title || caseItem.title,
      provider: sample.provider || site,
    },
    identifiers: {
      provider: sample.provider || site,
      conversationId: sample.conversationId || caseItem.id,
    },
    sourceTypes: sample.sourceTypes || caseItem.sourceTypes || [
      'chatgpt',
      'doubao_chat',
      'codex_cli',
      'claude_code_cli',
      'cursor_agent_cli',
      'ai_chat',
      'doubao',
      'glip',
      'jira',
      'web',
      'manual',
      'system',
      'markdown',
      'reflection',
      'reflection_thread',
      'rehearsal',
    ],
    debug: true,
  };
}

function normalizeComposeSurface(value) {
  const normalized = normalize(value);
  if (normalized.includes('doubao')) return 'doubao';
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('codex_cli')) return 'codex_cli';
  if (normalized.includes('claude_code_cli')) return 'claude_code_cli';
  if (normalized.includes('cursor_agent_cli')) return 'cursor_agent_cli';
  return 'chatgpt';
}

function normalizeVisibleMessages(messages, fallbackText) {
  const rows = Array.isArray(messages) ? messages : [];
  const normalized = rows
    .map((message, index) => {
      if (typeof message === 'string') {
        return { id: `m-${index + 1}`, sender: 'visible-page', text: message };
      }
      return {
        id: message.id || `m-${index + 1}`,
        sender: message.sender || 'visible-page',
        text: message.text || message.content || '',
        timestampLabel: message.timestampLabel,
      };
    })
    .filter((message) => String(message.text || '').trim())
    .slice(-12);
  if (normalized.length) return normalized;
  const text = String(fallbackText || '').trim();
  return text ? [{ id: 'm-1', sender: 'visible-page', text }] : [];
}

async function seedComposeAssistCaseMemories({ suite, caseItem }) {
  const memories = Array.isArray(caseItem.sampleContext?.memories)
    ? caseItem.sampleContext.memories
    : [];
  if (!memories.length) {
    return { ok: true, seededCount: 0 };
  }

  const composerEndpoint =
    process.env.EVAL_COMPOSER_ASSIST_URL ||
    caseItem.endpoint?.url ||
    suite.endpoint?.url;
  if (!composerEndpoint) {
    return {
      ok: false,
      seededCount: 0,
      error: 'missing_composer_assist_endpoint_for_seed',
    };
  }

  const userId =
    process.env.EVAL_USER_ID ||
    caseItem.endpoint?.userId ||
    caseItem.sampleContext?.seedUserId ||
    `eval-${String(caseItem.id || 'compose-assist')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .slice(0, 80)}`;
  const endpoint = buildSiblingMemoryServiceEndpoint(
    composerEndpoint,
    '/api/v1/ingest',
  );
  const timeoutMs = Number(
    process.env.EVAL_COMPOSER_ASSIST_TIMEOUT_MS ||
      process.env.EVAL_HTTP_TIMEOUT_MS ||
      45_000,
  );
  let seededCount = 0;

  for (const [index, memory] of memories.entries()) {
    const content = String(memory.content || memory.text || '').trim();
    if (!content) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          content,
          scope: memory.scope || 'work',
          source: memory.source || `eval-${caseItem.id}`,
          sourceType: memory.sourceType || memory.type || 'manual',
          sourceTitle: memory.sourceTitle || memory.title || caseItem.title,
          sourceUrl: memory.sourceUrl || caseItem.canonicalUrl || caseItem.url,
          skipExtraction: memory.skipExtraction,
          metadata: {
            ...(memory.metadata || {}),
            evalSeed: true,
            evalCaseId: caseItem.id,
            evalSeedIndex: index + 1,
          },
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          ok: false,
          seededCount,
          userId,
          error: `seed_ingest_failed:${res.status}:${text}`,
        };
      }
      seededCount += 1;
    } catch (err) {
      const isAbort = err?.name === 'AbortError';
      return {
        ok: false,
        seededCount,
        userId,
        error: isAbort
          ? `seed_ingest_timeout_after_${timeoutMs}ms`
          : `seed_ingest_failed:${err.message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: true, seededCount, userId };
}

function buildSiblingMemoryServiceEndpoint(endpoint, pathname) {
  try {
    const url = new URL(endpoint);
    url.pathname = pathname;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return endpoint.replace(/\/api\/v1\/composer\/assist.*$/, pathname);
  }
}

async function postComposerAssist({
  suite,
  caseItem,
  request,
  userIdOverride,
}) {
  const endpoint =
    process.env.EVAL_COMPOSER_ASSIST_URL ||
    caseItem.endpoint?.url ||
    suite.endpoint?.url;
  const userId =
    process.env.EVAL_USER_ID ||
    userIdOverride ||
    caseItem.endpoint?.userId ||
    suite.endpoint?.userId ||
    caseItem.owner;
  if (!endpoint) return { ok: false, error: 'missing_composer_assist_endpoint' };
  const controller = new AbortController();
  const timeoutMs = Number(process.env.EVAL_COMPOSER_ASSIST_TIMEOUT_MS || process.env.EVAL_HTTP_TIMEOUT_MS || 45_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId || 'default',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const text = await res.text();
    const response = parseMaybeJson(text);
    return {
      ok: res.ok,
      statusCode: res.status,
      response,
      error: res.ok ? undefined : text,
    };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      error: isAbort ? `composer_assist_request_timeout_after_${timeoutMs}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function judgeContextRecall({ caseItem, response }) {
  const matches = Array.isArray(response?.matches) ? response.matches : [];
  const visibleMatches = matches.filter((match) => match.displayPriority !== 'hidden');
  const topMatch = visibleMatches[0] || matches[0] || null;
  const autopilot = summarizeContextRecallAutopilot(
    response?.autopilot || response?.debug?.autopilot,
  );
  const expected = caseItem.expectedTopics || [];
  const banned = caseItem.mustNotReturnTopics || [];
  const topText = matchText(topMatch);
  const matchedExpectedTopics = hitTerms(topText, expected);
  const matchedMustNotReturnTopics = hitTerms(topText, banned);
  const expectedHits = matchedExpectedTopics.length;
  const bannedHits = matchedMustNotReturnTopics.length;
  const hasWhyRelevant = Array.isArray(topMatch?.whyRelevant) && topMatch.whyRelevant.some(Boolean);
  const title = String(topMatch?.title || topMatch?.sourceTitle || '');
  const genericTitle = /^(ringcentral\s*消息|glip|message|消息|meeting|calendar|时间)$/i.test(title.trim());
  const autopilotSignal = autopilot ? 3 : 0;

  if (!matches.length || !visibleMatches.length) {
    return {
      verdict: 'hide_expected',
      scores: {
        context_relevance: 0,
        user_value: 0,
        specificity: 0,
        title_quality: 0,
        explanation_quality: 0,
        autopilot_signal: autopilotSignal,
        suppression_correctness:
          autopilot?.mode === 'silent' && autopilot.quietReasons.length ? 3 : 2,
      },
      why: 'No visible recall match surfaced.',
      topMatch: null,
      autopilot,
      matchedExpectedTopics,
      matchedMustNotReturnTopics,
      visibleMatchCount: visibleMatches.length,
    };
  }

  const contextRelevance = bannedHits ? 0 : Math.min(3, expectedHits);
  const specificity = Math.min(3, expectedHits + anchorCount(topMatch));
  const titleQuality = genericTitle ? 0 : expectedHits ? 3 : title.length >= 8 ? 2 : 1;
  const explanationQuality = hasWhyRelevant ? (expectedHits ? 3 : 2) : 0;
  const userValue = bannedHits ? 0 : Math.min(3, contextRelevance + (topMatch.displayPriority === 'p1' ? 1 : 0));
  const suppressionCorrectness = bannedHits
    ? 0
    : contextRelevance >= 2 && autopilotSignal >= 2
      ? 3
      : 1;

  let verdict = 'fail';
  if (bannedHits) {
    verdict = 'fail';
  } else if (
    contextRelevance >= 2 &&
    userValue >= 2 &&
    titleQuality >= 2 &&
    explanationQuality >= 2 &&
    autopilotSignal >= 2
  ) {
    verdict = 'pass';
  } else if (contextRelevance >= 1 || visibleMatches.some((match) => countHits(matchText(match), expected) > 0)) {
    verdict = 'warn';
  }

  return {
    verdict,
    scores: {
      context_relevance: contextRelevance,
      user_value: userValue,
      specificity,
      title_quality: titleQuality,
      explanation_quality: explanationQuality,
      autopilot_signal: autopilotSignal,
      suppression_correctness: suppressionCorrectness,
    },
    why: buildWhy({ expectedHits, bannedHits, genericTitle, hasWhyRelevant, topMatch }),
    topMatch: summarizeMatch(topMatch),
    autopilot,
    matchedExpectedTopics,
    matchedMustNotReturnTopics,
    visibleMatchCount: visibleMatches.length,
  };
}

function judgeAskConversationContinuity({ caseItem, request, response }) {
  const expected = caseItem.expectedTopics || [];
  const expectedSelectedTopics = caseItem.expectedSelectedTopics || [];
  const banned = caseItem.mustNotReturnTopics || [];
  const expectedReceipt = Boolean(caseItem.expectContinuityReceipt);
  const requireFreshEvidence = Boolean(caseItem.requireFreshEvidence);
  const answerText = askAnswerText(response);
  const evidence = Array.isArray(response?.evidence) ? response.evidence : [];
  const evidenceText = evidence.map(askEvidenceText).join('\n');
  const contextMatch = summarizeAskContextMatch(response?.contextMatch);
  const selectedTopicLabel = String(response?.contextMatch?.selectedTopic?.label || '');
  const selectedTopicText = [
    selectedTopicLabel,
    ...(response?.contextMatch?.selectedTopic?.aliases || []),
    ...(response?.contextMatch?.selectedTopic?.anchors || []),
    response?.contextMatch?.userFacingSummary,
  ]
    .filter(Boolean)
    .join('\n');
  const responseText = [
    answerText,
    evidenceText,
    JSON.stringify(response?.blocks || []),
    selectedTopicText,
  ]
    .filter(Boolean)
    .join('\n');
  const matchedExpectedTopics = hitTerms(responseText, expected);
  const matchedEvidenceTopics = hitTerms(evidenceText, expected);
  const matchedSelectedTopics = hitTerms(selectedTopicLabel, expectedSelectedTopics);
  const matchedMustNotReturnTopics = hitTerms(responseText, banned);
  const minExpectedHits = Number(caseItem.minExpectedTopicHits ?? 1);
  const minEvidenceHits = Number(caseItem.minEvidenceTopicHits ?? 1);
  const continuityReceipt = response?.continuityReceipt || null;
  const receiptMatches = expectedReceipt
    ? continuityReceipt?.source === 'local_ask_resume_snapshot' &&
      continuityReceipt?.localOnly === true &&
      continuityReceipt?.usedAsHint === true &&
      continuityReceipt?.reRetrieved === true
    : !continuityReceipt;
  const hintPresenceMatches = expectedReceipt
    ? request?.contextHints?.source === 'local_ask_resume_snapshot'
    : !request?.contextHints;
  const hasExpectedTopic = matchedExpectedTopics.length >= minExpectedHits;
  const selectedTopicMatches =
    expectedSelectedTopics.length === 0 || matchedSelectedTopics.length > 0;
  const hasGroundedFreshEvidence =
    !requireFreshEvidence ||
    (evidence.length > 0 && matchedEvidenceTopics.length >= minEvidenceHits);
  const hasReadableAnswer = answerText.trim().length >= 12;
  const hasBannedTopic = matchedMustNotReturnTopics.length > 0;
  const topMatch = summarizeAskEvidence(evidence[0]);

  const continuityContract = receiptMatches && hintPresenceMatches
    ? 3
    : continuityReceipt || request?.contextHints
      ? 1
      : 0;
  const evidenceRefresh = requireFreshEvidence
    ? hasGroundedFreshEvidence
      ? 3
      : evidence.length
        ? 1
        : 0
    : 3;
  const topicAlignment = hasBannedTopic
    ? 0
    : hasExpectedTopic
      ? 3
      : matchedExpectedTopics.length
        ? 1
        : 0;
  const contextIsolation = hasBannedTopic || (!expectedReceipt && continuityReceipt)
    ? 0
    : 3;
  const answerQuality = hasReadableAnswer
    ? answerText.trim().length >= 40
      ? 3
      : 2
    : answerText.trim()
      ? 1
      : 0;
  const topicSelection = expectedSelectedTopics.length === 0
    ? 3
    : selectedTopicMatches
      ? 3
      : 0;
  const hardPass =
    Boolean(response && typeof response === 'object') &&
    receiptMatches &&
    hintPresenceMatches &&
    hasExpectedTopic &&
    selectedTopicMatches &&
    hasGroundedFreshEvidence &&
    !hasBannedTopic &&
    hasReadableAnswer;
  const verdict = hardPass ? 'pass' : 'fail';
  const problems = [];
  if (!hintPresenceMatches) problems.push('request hint presence did not match the case');
  if (!receiptMatches) problems.push('continuity receipt contract did not match');
  if (!hasExpectedTopic) {
    problems.push(`expected topic hits ${matchedExpectedTopics.length}/${minExpectedHits}`);
  }
  if (!selectedTopicMatches) {
    problems.push(
      `selected topic "${selectedTopicLabel || 'none'}" did not match ${expectedSelectedTopics.join(', ')}`,
    );
  }
  if (!hasGroundedFreshEvidence) {
    problems.push(`grounded evidence hits ${matchedEvidenceTopics.length}/${minEvidenceHits}`);
  }
  if (hasBannedTopic) {
    problems.push(`banned topic leaked: ${matchedMustNotReturnTopics.join(', ')}`);
  }
  if (!hasReadableAnswer) problems.push('answer was empty or too short');

  const improvementSuggestions = [];
  if (!receiptMatches) {
    improvementSuggestions.push('检查 `/ask` 是否只在接收本机续聊 hint 时返回完整 continuityReceipt。');
  }
  if (!hasGroundedFreshEvidence) {
    improvementSuggestions.push('把 resume hint 只用于 topic boost，并确保最终回答重新走 recall/evidence 链路。');
  }
  if (!hasExpectedTopic) {
    improvementSuggestions.push('检查 topicTitle、previousQuestion 和 evidenceRefs 是否进入 context match / recall expansion。');
  }
  if (!selectedTopicMatches) {
    improvementSuggestions.push(
      '让显式续聊 topic 在 MemoryContextMatchService 中优先于近期环境 frame，并校验 selectedTopic 本身。',
    );
  }
  if (hasBannedTopic) {
    improvementSuggestions.push('检查“新问题”请求隔离和 recall rerank，避免上一轮 topic 泄漏。');
  }
  if (!improvementSuggestions.length) {
    improvementSuggestions.push('保留该真实场景回归；Ask prompt、recall 或续接契约变化后手动重跑。');
  }

  return {
    verdict,
    scores: {
      continuity_contract: continuityContract,
      evidence_refresh: evidenceRefresh,
      topic_alignment: topicAlignment,
      topic_selection: topicSelection,
      context_isolation: contextIsolation,
      answer_quality: answerQuality,
    },
    why: hardPass
      ? expectedReceipt
        ? `本机续聊回执完整，命中 ${matchedExpectedTopics.length} 个话题锚点和 ${matchedEvidenceTopics.length} 个 evidence 锚点。`
        : '新问题未携带续聊 hint、未返回续聊回执，也没有上一轮 topic 污染。'
      : problems.join('; '),
    userConclusion: hardPass
      ? expectedReceipt
        ? '重新打开 Ask 后可以直接追问；系统会沿用本机话题线索，但答案仍来自本轮重新检索。'
        : '点击“新问题”后得到的是干净上下文，不会静默继承上一轮 Ask。'
      : '当前续聊体验仍可能复述旧摘要、缺少证据或污染新问题，不能交付为可信连续性。',
    improvementSuggestions,
    topMatch,
    contextMatch,
    continuityReceipt,
    matchedExpectedTopics,
    matchedEvidenceTopics,
    matchedSelectedTopics,
    selectedTopicLabel,
    matchedMustNotReturnTopics,
    evidenceCount: evidence.length,
  };
}

function judgeAskContextGap({ caseItem, response }) {
  const expected = caseItem.expectedTopics || [];
  const banned = caseItem.mustNotReturnTopics || [];
  const answerText = askAnswerText(response);
  const evidence = Array.isArray(response?.evidence) ? response.evidence : [];
  const evidenceText = evidence.map(askEvidenceText).join('\n');
  const blocksText = JSON.stringify(response?.blocks || []);
  const contextMatch = summarizeAskContextMatch(response?.contextMatch);
  const contextMatchText = askContextMatchText(response?.contextMatch);
  const responseText = [answerText, evidenceText, blocksText, contextMatchText].filter(Boolean).join('\n');
  const matchedExpectedTopics = hitTerms(responseText, expected);
  const matchedEvidenceTopics = hitTerms(evidenceText, expected);
  const matchedContextMatchTopics = hitTerms(contextMatchText, expected);
  const matchedMustNotReturnTopics = hitTerms(responseText, banned);
  const minExpectedHits = Number(caseItem.minExpectedTopicHits ?? 2);
  const minEvidenceHits = Number(caseItem.minEvidenceTopicHits ?? 1);
  const missingInfo = Array.isArray(response?.missingInfo) ? response.missingInfo.filter(Boolean) : [];
  const hasEvidence = evidence.length > 0;
  const hasGroundedEvidence =
    hasEvidence && matchedEvidenceTopics.length >= Math.max(1, minEvidenceHits);
  const hasCompletionStance =
    countHits(answerText, caseItem.completionSignals || ['ready', '完成', '未完成', '没有', '不明确', '还没有', 'insufficient', 'not enough']) > 0;
  const hasGapFill =
    (matchedExpectedTopics.length >= minExpectedHits || matchedContextMatchTopics.length >= minExpectedHits) &&
    countHits(responseText, caseItem.contextGapSignals || ['BE', 'backend', '后端', 'AI VBG', 'MTR-141852']) > 0;
  const hasLockedContext = contextMatch?.state === 'locked';
  const hasAmbiguousContext = contextMatch?.state === 'ambiguous';
  const allowAmbiguous = Boolean(caseItem.allowAmbiguous);
  const ambiguousHasExpected =
    allowAmbiguous && hasAmbiguousContext && matchedContextMatchTopics.length >= minExpectedHits;
  const topMatch = summarizeAskEvidence(evidence[0]);

  if (!response || typeof response !== 'object') {
    return {
      verdict: 'fail',
      scores: {
        context_relevance: 0,
        evidence_grounding: 0,
        context_match: 0,
        gap_resolution: 0,
        specificity: 0,
        answer_quality: 0,
        suppression_correctness: 3,
      },
      why: 'Ask did not return a structured response.',
      topMatch: null,
      contextMatch: null,
      matchedExpectedTopics,
      matchedEvidenceTopics,
      matchedContextMatchTopics,
      matchedMustNotReturnTopics,
      missingInfo,
    };
  }

  const bannedHits = matchedMustNotReturnTopics.length;
  const contextRelevance = bannedHits ? 0 : Math.min(3, matchedExpectedTopics.length);
  const evidenceGrounding = bannedHits
    ? 0
    : ambiguousHasExpected
      ? 3
      : hasGroundedEvidence
        ? Math.min(3, matchedEvidenceTopics.length)
        : 0;
  const contextMatchScore = bannedHits
    ? 0
    : hasLockedContext && matchedContextMatchTopics.length >= minExpectedHits
      ? 3
      : hasLockedContext || (hasAmbiguousContext && matchedContextMatchTopics.length)
        ? 2
        : matchedContextMatchTopics.length
          ? 1
          : 0;
  const gapResolution = bannedHits
    ? 0
    : ambiguousHasExpected
      ? 3
      : hasGapFill && contextMatchScore >= 2
      ? 3
      : hasGapFill
        ? 2
        : matchedExpectedTopics.length
          ? 1
          : 0;
  const specificity = bannedHits
    ? 0
    : Math.min(3, matchedExpectedTopics.length + countDistinctEvidenceSources(evidence));
  const answerQuality = bannedHits
    ? 0
    : ambiguousHasExpected
      ? 2
    : hasCompletionStance && hasGroundedEvidence
      ? 3
      : hasCompletionStance || hasGroundedEvidence
        ? 2
        : answerText.length >= 40
          ? 1
          : 0;
  const suppressionCorrectness = bannedHits ? 0 : hasGapFill && hasGroundedEvidence ? 3 : 1;

  let verdict = 'fail';
  if (bannedHits) {
    verdict = 'fail';
  } else if (
    (ambiguousHasExpected ||
    (matchedExpectedTopics.length >= minExpectedHits &&
    matchedEvidenceTopics.length >= minEvidenceHits &&
    gapResolution >= 3 &&
    answerQuality >= 2))
  ) {
    verdict = 'pass';
  } else if (matchedExpectedTopics.length >= 1 || matchedEvidenceTopics.length >= 1 || missingInfo.length) {
    verdict = 'warn';
  }

  return {
    verdict,
    scores: {
      context_relevance: contextRelevance,
      evidence_grounding: evidenceGrounding,
      context_match: contextMatchScore,
      gap_resolution: gapResolution,
      specificity,
      answer_quality: answerQuality,
      suppression_correctness: suppressionCorrectness,
    },
    why: buildAskContextGapWhy({
      matchedExpectedTopics,
      matchedEvidenceTopics,
      matchedMustNotReturnTopics,
      hasGapFill,
      hasCompletionStance,
      contextMatch,
      matchedContextMatchTopics,
      allowAmbiguous,
      ambiguousHasExpected,
      missingInfo,
      evidenceCount: evidence.length,
    }),
    topMatch,
    contextMatch,
    allowAmbiguous,
    ambiguousHasExpected,
    matchedExpectedTopics,
    matchedEvidenceTopics,
    matchedContextMatchTopics,
    matchedMustNotReturnTopics,
    missingInfo,
    evidenceCount: evidence.length,
  };
}

function judgeComposeContextPack({ caseItem, response, request }) {
  const expected = caseItem.expectedTopics || [];
  const banned = caseItem.mustNotReturnTopics || [];
  const expectedBehavior = caseItem.expectedBehavior || {};
  const expectedSuggestionType = expectedBehavior.suggestionType || 'context_pack';
  const isPromptRewrite = expectedSuggestionType === 'rewrite_prompt';
  const insertText = String(response?.insertText || '');
  const evidence = Array.isArray(response?.evidence) ? response.evidence : [];
  const evidenceText = evidence.map(composeEvidenceText).join('\n');
  const contextPackMemoryText =
    expectedSuggestionType === 'prompt_patch' || isPromptRewrite
      ? [insertText, evidenceText].filter(Boolean).join('\n')
      : [
          extractContextPackSection(insertText, '相关记忆'),
          extractContextPackSection(insertText, '来源'),
          evidenceText,
        ]
          .filter(Boolean)
          .join('\n');
  const combinedText = [insertText, response?.summary, evidenceText].filter(Boolean).join('\n');
  const matchedExpectedTopics = hitTerms(contextPackMemoryText || evidenceText, expected);
  const matchedEvidenceTopics = hitTerms(evidenceText, expected);
  const matchedMustNotReturnTopics = hitTerms(combinedText, banned);
  const minExpectedHits = Number(caseItem.minExpectedTopicHits ?? 2);
  const minEvidenceHits = Number(caseItem.minEvidenceTopicHits ?? 1);
  const requireEvidence =
    expectedBehavior.requireEvidence == null
      ? !isPromptRewrite
      : Boolean(expectedBehavior.requireEvidence);
  const requiredSections = expectedBehavior.requiredSections ||
    (isPromptRewrite ? [] : ['相关上下文']);
  const matchedSections = hitTerms(insertText, requiredSections);
  const missingSections = requiredSections.filter((section) => !matchedSections.includes(section));
  const mustInclude = expectedBehavior.mustInclude || [];
  const mustNotInclude = expectedBehavior.mustNotInclude || [];
  const matchedMustInclude = hitTerms(contextPackMemoryText || insertText, mustInclude);
  const matchedMustNotInclude = hitTerms(insertText, mustNotInclude);
  const hasMustInclude = mustInclude.length === 0 || matchedMustInclude.length >= mustInclude.length;
  const hasExpectedSuggestionType = response?.suggestionType === expectedSuggestionType;
  const expectedInsertMode = expectedBehavior.insertMode ||
    (isPromptRewrite ? 'replace_draft' : 'append_patch');
  const insertModeMatches = response?.insertMode === expectedInsertMode;
  const expectedPreview = expectedBehavior.previewRequired;
  const previewMatches = expectedPreview == null || response?.previewRequired === expectedPreview;
  const expectedRisk = expectedBehavior.riskLevel;
  const riskMatches = !expectedRisk || response?.riskLevel === expectedRisk;
  const expectedLanguage = expectedBehavior.language;
  const hanCharacterCount = (insertText.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCharacterCount = (insertText.match(/[A-Za-z]/g) || []).length;
  const languageMatches =
    !expectedLanguage ||
    (expectedLanguage === 'zh'
      ? hanCharacterCount >= 8
      : expectedLanguage === 'en'
        ? latinCharacterCount >= 30 && hanCharacterCount <= 2
        : true);
  const hasContextPack =
    response?.available === true &&
    hasExpectedSuggestionType &&
    insertModeMatches &&
    insertText.length >= (isPromptRewrite ? 120 : 80);
  const hasGroundedEvidence =
    !requireEvidence ||
    (evidence.length > 0 && matchedEvidenceTopics.length >= minEvidenceHits);
  const hasRelevantText = matchedExpectedTopics.length >= minExpectedHits;
  const bannedHits = matchedMustNotReturnTopics.length + matchedMustNotInclude.length;

  if (!response || typeof response !== 'object') {
    return {
      verdict: 'fail',
      scores: {
        context_relevance: 0,
        evidence_grounding: 0,
        answer_quality: 0,
        specificity: 0,
        suppression_correctness: 0,
      },
      why: 'Composer Assist did not return a structured response.',
      topMatch: null,
      matchedExpectedTopics,
      matchedEvidenceTopics,
      matchedMustNotReturnTopics,
      missingSections,
    };
  }

  const contextRelevance = bannedHits ? 0 : Math.min(3, matchedExpectedTopics.length);
  const evidenceGrounding = bannedHits
    ? 0
    : !requireEvidence
      ? 3
      : hasGroundedEvidence
        ? Math.min(3, matchedEvidenceTopics.length)
        : 0;
  const answerQuality = bannedHits
    ? 0
    : hasContextPack && !missingSections.length && previewMatches && riskMatches
      && languageMatches
      && hasMustInclude
      ? 3
      : hasContextPack && matchedSections.length >= 3
        ? 2
        : insertText
          ? 1
          : 0;
  const specificity = bannedHits
    ? 0
    : Math.min(3, matchedExpectedTopics.length + matchedMustInclude.length + countDistinctComposerEvidenceSources(evidence));
  const suppressionCorrectness = bannedHits
    ? 0
    : expectedBehavior.assist === 'hide'
      ? response.available === false
        ? 3
        : 0
      : hasContextPack
        ? 3
        : 0;

  let verdict = 'fail';
  if (bannedHits) {
    verdict = 'fail';
  } else if (
    hasContextPack &&
    hasRelevantText &&
    hasGroundedEvidence &&
    hasMustInclude &&
    !missingSections.length &&
    previewMatches &&
    riskMatches &&
    languageMatches
  ) {
    verdict = 'pass';
  } else if (hasContextPack || hasRelevantText || hasGroundedEvidence) {
    verdict = 'warn';
  }

  return {
    verdict,
    scores: {
      context_relevance: contextRelevance,
      evidence_grounding: evidenceGrounding,
      answer_quality: answerQuality,
      specificity,
      suppression_correctness: suppressionCorrectness,
    },
    why: buildComposeContextPackWhy({
      response,
      request,
      matchedExpectedTopics,
      matchedEvidenceTopics,
      matchedMustNotReturnTopics,
      missingSections,
      matchedMustInclude,
      matchedMustNotInclude,
      hasExpectedSuggestionType,
      insertModeMatches,
      previewMatches,
      riskMatches,
      languageMatches,
      requireEvidence,
      evidenceCount: evidence.length,
      expectedSuggestionType,
    }),
    topMatch: summarizeComposeEvidence(evidence[0]),
    matchedExpectedTopics,
    matchedEvidenceTopics,
    matchedMustNotReturnTopics,
    missingSections,
    matchedMustInclude,
    matchedMustNotInclude,
    evidenceCount: evidence.length,
    suggestionType: response?.suggestionType,
    insertMode: response?.insertMode,
    available: response?.available,
  };
}

async function runOptionalExternalJudge(payload) {
  const command = process.env.EVAL_LLM_JUDGE_COMMAND;
  if (!command) {
    return {
      status: 'judge_degraded',
      reason: 'EVAL_LLM_JUDGE_COMMAND is not configured',
    };
  }
  const result = await runShell(command, {
    input: JSON.stringify(payload),
    timeoutMs: Number(process.env.EVAL_LLM_JUDGE_TIMEOUT_MS || 60_000),
  });
  if (result.code !== 0) {
    return {
      status: 'judge_degraded',
      reason: result.stderr || result.stdout || `command exited ${result.code}`,
    };
  }
  const parsed = parseMaybeJson(result.stdout);
  if (!parsed || typeof parsed !== 'object' || !parsed.verdict) {
    return {
      status: 'judge_degraded',
      reason: 'judge output did not match expected JSON shape',
      raw: result.stdout,
    };
  }
  return { status: 'ok', result: parsed };
}

async function runRepair({ suite, runDir, caseResults }) {
  const repairConfig = getSuiteRepairConfig(registry, suite);
  const statusBefore = await getGitStatus();
  const snapshotBefore = await getGitDiffSnapshot();
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'repair-git-status-before.txt')), statusBefore);
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'repair-git-diff-before.patch')), snapshotBefore.diff);

  if (repairConfig.requireCleanWorktree !== false && statusBefore.trim()) {
    const attempt = {
      startedAt: new Date().toISOString(),
      status: 'repair_blocked',
      reason: 'dirty_worktree',
      gitStatus: statusBefore,
    };
    await appendJsonl(path.join(runDir, 'repair-attempts.jsonl'), attempt);
    return attempt;
  }

  const agentId = repairConfig.agent || registry.defaults?.agent || agentsConfig.default;
  const agent = agentsConfig.agents?.[agentId];
  if (!agent) {
    const attempt = {
      startedAt: new Date().toISOString(),
      status: 'repair_blocked',
      reason: `unknown_agent:${agentId}`,
    };
    await appendJsonl(path.join(runDir, 'repair-attempts.jsonl'), attempt);
    return attempt;
  }

  const prompt = buildRepairPrompt({ suite, runDir, caseResults, repairConfig });
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'repair-prompt.md')), prompt);

  const commandArgs = (agent.args || []).map((value) =>
    String(value)
      .replaceAll('{repo}', repoRoot)
      .replaceAll('{prompt}', prompt),
  );
  const commandResult = await runProcess(agent.command, commandArgs, {
    input: agent.input === 'stdin' ? prompt : '',
    timeoutMs: Number(process.env.EVAL_AGENT_TIMEOUT_MS || 20 * 60 * 1000),
  });

  const snapshotAfter = await getGitDiffSnapshot();
  const changedAfter = snapshotAfter.changedFiles;
  const allowedPaths = repairConfig.allowedPaths || [];
  const outOfBounds = changedAfter.filter((file) => !fileMatchesAny(file, allowedPaths));
  let status = commandResult.code === 0 ? 'agent_completed' : 'agent_failed';
  if (outOfBounds.length) status = 'repair_blocked';

  const validationResults = [];
  if (status === 'agent_completed') {
    for (const command of repairConfig.validate || []) {
      const validation = await runShell(command, {
        timeoutMs: Number(process.env.EVAL_VALIDATE_TIMEOUT_MS || 10 * 60 * 1000),
      });
      validationResults.push({
        command,
        code: validation.code,
        stdout: validation.stdout.slice(-6000),
        stderr: validation.stderr.slice(-6000),
      });
    }
    status = validationResults.every((item) => item.code === 0)
      ? 'repaired_pending_review'
      : 'repair_validation_failed';
  }

  const attempt = {
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status,
    agent: agentId,
    command: [agent.command, ...commandArgs].join(' '),
    exitCode: commandResult.code,
    stdout: commandResult.stdout.slice(-6000),
    stderr: commandResult.stderr.slice(-6000),
    changedFiles: changedAfter,
    outOfBounds,
    validationResults,
  };
  await appendJsonl(path.join(runDir, 'repair-attempts.jsonl'), attempt);
  return attempt;
}

function shouldRunRepair(status, suite) {
  if (args.noRepair) return false;
  if (args.repair === 'auto') return status === 'fail';
  if (['off', 'none', 'report', 'suggest'].includes(String(args.repair || ''))) {
    return false;
  }
  const repairConfig = getSuiteRepairConfig(registry, suite);
  const mode = repairConfig.mode;
  return status === 'fail' && mode === 'auto';
}

function buildRepairPrompt({ suite, runDir, caseResults, repairConfig }) {
  const failures = caseResults.filter((item) => item.status === 'fail' || item.status === 'error');
  return `You are fixing Personal AI eval failures.

Suite: ${suite.id} - ${suite.title}
Run directory: ${resolveRepoPath(runDir)}
HTML report: ${resolveRepoPath(path.join(runDir, 'report.html'))}

Allowed paths:
${(repairConfig.allowedPaths || []).map((item) => `- ${item}`).join('\n')}

Validation commands:
${(repairConfig.validate || []).map((item) => `- ${item}`).join('\n')}

Failures:
${failures.map((item) => `- ${item.caseId}: ${item.why || item.error || item.verdict}`).join('\n')}

Instructions:
- Inspect the run artifacts before editing.
- Keep changes scoped to allowed paths.
- Preserve the Eval Report Reader Contract: every runnable case must normalize into caseGoal, inputSummary, expectedSummary, actualSummary, proofChecks, conclusion, nextSteps, optional manualVerification, and debug artifact links.
- Do not commit or deploy.
- After editing, run the listed validation commands if practical.
- Leave a concise final summary of changed files and validation results.
`;
}

async function writeSummary(runDir, summary, caseResults) {
  const readerReport = buildReaderReportModel(summary, caseResults);
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'case-results.json')), JSON.stringify(caseResults, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'summary.json')), JSON.stringify(summary, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'reader-report.json')), JSON.stringify(readerReport, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'report.html')), buildReaderReportHtml(readerReport));
}

async function rerenderExistingRun(runPath, registryConfig) {
  const requestedPath = resolveRepoPath(String(runPath));
  const runDir = /\.(?:html|json)$/i.test(requestedPath)
    ? path.dirname(requestedPath)
    : requestedPath;
  const summary = JSON.parse(
    await fs.readFile(path.join(runDir, 'summary.json'), 'utf8'),
  );
  const caseResults = JSON.parse(
    await fs.readFile(path.join(runDir, 'case-results.json'), 'utf8'),
  );
  const suite = getSuiteById(registryConfig, summary.suiteId);
  if (!suite) throw new Error(`Unknown eval suite in existing run: ${summary.suiteId}`);

  const readerReport = buildReaderReportModel(
    {
      ...summary,
      readerProof: summary.readerProof || suite.readerProof || null,
    },
    caseResults,
  );
  await fs.writeFile(
    path.join(runDir, 'reader-report.json'),
    JSON.stringify(readerReport, null, 2),
  );
  await fs.writeFile(path.join(runDir, 'report.html'), buildReaderReportHtml(readerReport));
  return {
    suiteId: summary.suiteId,
    reportPath: path.relative(repoRoot, path.join(runDir, 'report.html')),
  };
}

function buildRunReportHtml(summary, caseResults) {
  return buildReaderReportHtml(buildReaderReportModel(summary, caseResults));
}

function buildReaderReportModel(summary, caseResults) {
  const counts = summary.counts || countStatuses(caseResults);
  const readerCases = caseResults.map((item, index) => buildReaderCase(item, index));
  const averageScore = averageCaseScore(caseResults);
  const readerProof = buildReaderProofModel({
    contract: summary.readerProof,
    caseResults,
  });
  const legacyProofLists = readerProofLegacyLists(readerProof);
  const artifactRows = [
    ['input.jsonl', '采集到的页面或快照上下文'],
    ['requests.jsonl', '发往服务端的请求证据'],
    ['responses.jsonl', '服务端原始返回'],
    ['judge-results.jsonl', '启发式和可选 LLM judge 判分'],
    ['case-results.json', '结构化评估结果'],
    ['reader-report.json', 'Reader Contract 归一化结果'],
    ['repair-attempts.jsonl', '仅在触发 repair 时生成'],
  ];
  return {
    summary: {
      suiteId: summary.suiteId,
      runId: summary.runId,
      title: reportTitle(summary),
      headline: runExecutiveConclusion(summary, caseResults),
      status: summary.status,
      averageScore,
      keyStats: [
        ['样本数', summary.caseCount],
        ['开始时间', summary.startedAt],
        ['完成时间', summary.completedAt || '-'],
        ['修复状态', localizeRepair(summary.repairStatus || 'not_requested')],
        ['运行目录', summary.runDir || '-'],
        ['结果分布', formatCounts(counts)],
        ['失败样本', (summary.failedCaseIds || []).join(', ') || '-'],
        ['报告契约', formatReportContract(summary.reportContract)],
      ],
      readerProof,
      proved: legacyProofLists.proved,
      notProved: legacyProofLists.notProved,
      nextSteps: buildRunNextSteps(summary, caseResults),
      reportContract: summary.reportContract,
    },
    cases: readerCases,
    artifacts: artifactRows.map(([file, description]) => ({ file, description })),
  };
}

function buildReaderReportHtml(model) {
  const { summary, cases, artifacts } = model;
  return buildHtmlShell({
    title: `体验评估 - ${summary.suiteId}`,
    body: `
      <section class="hero">
        <div>
          <p class="eyebrow">Personal AI Evals</p>
          <h1>${escapeHtml(summary.title)}</h1>
          <p class="muted">Run ID: <span class="mono">${escapeHtml(summary.runId)}</span></p>
          <p class="lead">${escapeHtml(summary.headline)}</p>
        </div>
        <div class="hero-status">
          ${statusBadge(summary.status)}
          ${summary.averageScore == null ? '' : `<strong>${escapeHtml(summary.averageScore)}/100</strong><span>平均体验分</span>`}
        </div>
      </section>

      <section class="grid">
        ${summary.keyStats.slice(0, 4).map(([label, value]) => metricCard(label, value)).join('\n')}
      </section>

      <section>
        <h2>本次结论</h2>
        <div class="summary-list">
          ${summary.keyStats.slice(4).map(([label, value]) => `<div><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('\n')}
        </div>
      </section>

      ${renderReaderProofSummary(summary)}

      <section>
        <h2>样本结果</h2>
        ${cases.length
          ? cases.map(renderReaderCaseCard).join('\n')
          : '<p class="muted">没有可展示的样本结果。</p>'}
      </section>

      <section>
        <h2>证据文件</h2>
        <table>
          <thead><tr><th>文件</th><th>说明</th></tr></thead>
          <tbody>
            ${artifacts.map(({ file, description }) => `<tr><td><a href="${escapeAttr(file)}">${escapeHtml(file)}</a></td><td>${escapeHtml(description)}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </section>

      ${summary.reportContract?.issueCount ? `
        <section>
          <h2>报告契约问题</h2>
          <p class="muted">这不是业务能力判分，而是 eval report 自身是否足够可读的检查。新 suite 必须让报告回答：跑了什么数据、期望什么、实际输出什么、如何判分、下一步怎么改。</p>
          ${renderReportContractIssues(cases)}
        </section>
      ` : ''}

      <section>
        <h2>建议动作</h2>
        <ul>${summary.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>
    `,
  });
}

function buildReaderCase(item, index) {
  const proof = item.proofSummary;
  const expectedNoCue = Boolean(item.expectedBehavior?.expectedCue?.expectNoCue);
  if (proof) {
    return {
      caseId: item.caseId,
      title: item.caseTitle || item.caseId,
      kindLabel: expectedNoCue
        ? '负例：防误触发'
        : item.actualOutput?.composer
          ? '正例：Compose Assist'
          : '正例：Memory Lens',
      status: item.status,
      score: item.overallScore ?? computeOverallScore(item.scores, item.status),
      caseGoal: proof.caseGoal || item.sampleSummary || '-',
      inputSummary: buildReaderInputSummary(item),
      expectedSummary: buildReaderExpectedSummary(item),
      actualSummary: {
        quote:
          proof.primaryCueText ||
          proof.primaryCue?.cueText ||
          item.actualOutput?.composer?.insertText ||
          '',
        emptyText: expectedNoCue ? '没有生成 compiled cue，符合本负例预期。' : '',
        rows: [
          ['sceneFrame', proof.sceneType],
          ['surface', proof.surface],
          ['cue action', proof.primaryCue?.actionType],
          ['compileStatus', proof.primaryCue?.compileStatus],
          ['confidence', proof.primaryCue?.confidence],
          ['sourceRefs', proof.primaryCue?.sourceRefCount],
        ],
      },
      proofChecks: normalizeProofChecks(proof.checks),
      outcomeSignals: buildReaderOutcomeSignalsFromProof(proof),
      conclusion: item.userConclusion || item.why || '-',
      nextSteps: item.improvementSuggestions || [],
      manualVerification: normalizeManualVerification(item.manualVerification),
      debugLinks: buildReaderDebugLinks(),
      scores: item.scores || {},
      reportContract: item.reportContract,
    };
  }

  return {
    caseId: item.caseId,
    title: item.caseTitle || item.caseId,
    kindLabel: readableCaseKind(item),
    status: item.status,
    score: item.overallScore ?? computeOverallScore(item.scores, item.status),
    caseGoal: deriveReaderCaseGoal(item),
    inputSummary: buildReaderInputSummary(item),
    expectedSummary: buildReaderExpectedSummary(item),
    actualSummary: buildReaderActualSummary(item),
    proofChecks: buildReaderProofChecks(item),
    outcomeSignals: buildReaderOutcomeSignals(item),
    conclusion: item.userConclusion || item.why || item.reason || '-',
    nextSteps: item.improvementSuggestions || [],
    manualVerification: normalizeManualVerification(item.manualVerification),
    debugLinks: buildReaderDebugLinks(),
    scores: item.scores || {},
    reportContract: item.reportContract,
  };
}

function normalizeManualVerification(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return { title: '手动体验验证', steps: [value] };
  }
  if (Array.isArray(value)) {
    return { title: '手动体验验证', steps: normalizeArray(value) };
  }
  if (typeof value !== 'object') return null;

  const normalized = {
    title: value.title || '手动体验验证',
    summary: value.summary || value.applicability || value.description || '',
    prerequisites: normalizeArray(value.prerequisites || value.setup),
    steps: normalizeArray(value.steps),
    expected: normalizeArray(value.expected || value.expectedResults),
    cleanup: normalizeArray(value.cleanup || value.teardown),
    evidence: normalizeArray(value.evidence || value.evidenceToKeep),
  };

  const hasContent = [
    normalized.summary,
    ...normalized.prerequisites,
    ...normalized.steps,
    ...normalized.expected,
    ...normalized.cleanup,
    ...normalized.evidence,
  ].some(Boolean);
  return hasContent ? normalized : null;
}

function readableCaseKind(item) {
  if (item.status === 'skipped') return '未执行样本';
  const labels = {
    'context-recall': 'Memory Lens / Context Recall',
    'scene-memory-autopilot': 'Scene Memory Autopilot',
    'keystone-memory-briefs': '关键记忆简报',
    'ask-context-gap': 'Ask 缺上下文',
    'ask-conversation-continuity': 'Ask 会话续接',
    'answer-memory-tracker': 'Ask 活答案记忆',
    'compose-assist': 'Compose Assist',
    'compose-style-memory': '写作风格记忆',
    'memory-lifecycle': 'Memory Lifecycle',
  };
  return labels[item.suiteId] || item.caseKind || item.suiteId || 'Eval case';
}

function deriveReaderCaseGoal(item) {
  if (item.problemStatement || item.sampleDetails?.problemStatement) {
    return item.problemStatement || item.sampleDetails.problemStatement;
  }
  if (item.suiteId === 'ask-context-gap') {
    return '验证 Ask 是否能从短问句补齐上下文，并用 evidence 给出有根据的回答。';
  }
  if (item.suiteId === 'ask-conversation-continuity') {
    return '验证本机 Ask 续聊线索是否只用于延续话题、重新检索证据，并在新问题中保持隔离。';
  }
  if (item.suiteId === 'answer-memory-tracker') {
    return '验证多轮 Ask 的 answerMemory 状态和权威决策是否按预期演进。';
  }
  if (['context-recall', 'scene-memory-autopilot'].includes(item.suiteId)) {
    return '验证当前场景下 Memory Lens / Autopilot 是否展示强相关记忆并静默弱噪音。';
  }
  if (item.suiteId === 'keystone-memory-briefs') {
    return '验证跨来源简报是否只在证据与场景足够时进入现有 Memory Lens，并在单源、冲突、过期或外发风险下正确降级。';
  }
  if (item.suiteId === 'compose-assist') {
    if (item.caseKind === 'compose_assist_lens_routing_contract') {
      return '验证证据-only 的 composer 场景是否只走 Memory Lens，不占用 Compose Assist 插入入口。';
    }
    return '验证 Compose Assist 是否基于当前 composer 场景生成可用、可追溯且隐私安全的结果。';
  }
  return item.caseTitle || item.sampleSummary || '验证该 eval case 的预期行为。';
}

function buildReaderInputSummary(item) {
  const sample = item.sampleDetails || {};
  const request = sample.request || sample.composerRequest || {};
  const sourceProvenanceAudit = getSourceProvenanceAudit(item);
  return {
    text: item.sampleSummary || sample.primaryText || item.caseTitle || '-',
    rows: [
      ['页面标题', request.title || sample.title],
      ['URL', request.url || sample.url || item.targetUrl],
      ['用户问句', item.query || sample.query],
      ['续聊来源', sample.contextHints?.source],
      ['续聊话题', sample.contextHints?.topicTitle],
      [
        '快照年龄',
        sample.contextHintsAgeHours == null
          ? undefined
          : `${sample.contextHintsAgeHours} 小时`,
      ],
      ['当前文本', request.primaryText || sample.primaryText],
      ['surface', request.surface || sample.surface || sample.site],
      ['contextType', request.contextType || sample.contextType],
      ['采集方式', sample.collectionMode],
      ['记忆样本数', sample.memoryCount],
      ['样本来源', summarizeSourceProvenance(sample.sourceProvenance)],
      ['样本来源审计', summarizeSourceProvenanceAudit(sourceProvenanceAudit)],
      ['来源状态分布', summarizeSourceProvenanceStatus(sourceProvenanceAudit)],
      ['来源告警', summarizeSourceProvenanceWarnings(sourceProvenanceAudit)],
    ],
    goodChips: item.expectedTopics || [],
    badChips: item.mustNotReturnTopics || [],
  };
}

function buildReaderExpectedSummary(item) {
  return {
    text: summarizeDetailValue(item.expectedBehavior || item.expectedTopics || '-'),
    rows: [
      ['期望行为', item.expectedBehavior],
      ['期望命中', item.expectedTopics || []],
      ['不能命中', item.mustNotReturnTopics || []],
    ],
  };
}

function buildReaderActualSummary(item) {
  const output = item.actualOutput || {};
  if (item.suiteId === 'keystone-memory-briefs') {
    const brief = output.brief || {};
    const presentation = output.presentation || {};
    return {
      quote: truncateText(
        String(brief.summary || brief.externalSummary || item.why || ''),
        700,
      ),
      emptyText: item.reason || item.error || '本 case 没有生成关键简报结果。',
      rows: [
        ['状态', brief.status || item.status],
        ['blocked reason', brief.blockedReason],
        ['来源数', brief.sourceCount],
        ['来源引用', brief.sourceRefs],
        ['freshness', brief.freshness],
        ['presentation mode', presentation.presentationMode],
        ['whyNow', presentation.whyNow],
        ['证据记忆', presentation.evidenceMatchIds],
        ['允许复制', brief.displayPolicy?.canCopyToDraft],
        ['仅本机来源', brief.displayPolicy?.hiddenSourceCount],
        ['外发摘要', brief.externalSummary],
        ['写入边界', brief.writeReceipt],
      ],
    };
  }
  if (item.suiteId === 'change-memory-ledger') {
    const projections = Array.isArray(output.projections) ? output.projections : [];
    const composeEvidence = Array.isArray(output.composeEvidence) ? output.composeEvidence : [];
    const projectionText = projections
      .map((projection) => `${projection.subjectKey || projection.chainKey} · ${projection.propertyKey} · ${projection.status}`)
      .join('；');
    return {
      quote: truncateText(String(output.prompt || projectionText || output.receipt?.detail || ''), 700),
      emptyText: item.reason || item.error || '本 case 没有形成变化投影。',
      rows: [
        ['状态', item.status],
        ['提取状态', output.receipt?.status],
        ['提取事件', output.receipt?.extractedCount],
        ['排除噪音', output.receipt?.excludedNoiseCount],
        ['投影数', projections.length],
        ['变化投影', projectionText],
        ['Ask 边界', output.prompt],
        ['Compose 证据', composeEvidence.map((evidence) => evidence.snippet || evidence.boundary)],
      ],
    };
  }
  const personaVariants = Array.isArray(output.variants)
    ? output.variants
    : [];
  const topMatch = item.topMatch;
  const contextMatch = output.contextMatch || item.contextMatch;
  const continuityReceipt = output.continuityReceipt || item.continuityReceipt;
  const answerMemory = output.steps?.at?.(-1)?.answerMemory || output.answerMemory;
  const quote =
    (personaVariants.length
      ? personaVariants
          .map(
            (variant) =>
              `${variant.id}: ${variant.summary?.audienceType || 'unknown'} / ${variant.summary?.representationMode || 'unknown'}`,
          )
          .join('；')
      : '') ||
    output.insertText ||
    output.answer ||
    output.assist ||
    output.route ||
    topMatch?.title ||
    output.summary ||
    '';
  const rows = [
    ['状态', item.status],
    ['错误', item.error || output.error],
    ['HTTP 状态', output.statusCode],
    ['请求耗时', output.durationMs == null ? undefined : `${output.durationMs}ms`],
    ['topMatch', topMatch?.title || topMatch?.id],
    ['displayPriority', topMatch?.displayPriority],
    ['Autopilot 模式', item.autopilot?.mode || output.autopilot?.mode],
    ['Context Match', contextMatch?.state],
    ['锁定话题', contextMatch?.selectedTopic?.label],
    ['Evidence 数量', output.evidenceCount ?? output.evidence?.length],
    ['续聊回执来源', continuityReceipt?.source],
    ['本机线索', continuityReceipt?.localOnly],
    ['仅作提示', continuityReceipt?.usedAsHint],
    ['本轮重新检索', continuityReceipt?.reRetrieved],
    ['续聊回执', continuityReceipt?.detail],
    ['available', output.available],
    ['suggestionType', output.suggestionType],
    ['riskLevel', output.riskLevel],
    ['previewRequired', output.previewRequired],
    ['投影变体数', personaVariants.length || undefined],
    [
      '投影场景',
      personaVariants.map(
        (variant) =>
          `${variant.id}:${variant.summary?.scene}/${variant.summary?.voiceMode}`,
      ),
    ],
    ['route', output.route],
    ['Compose icon 可见', output.composeAssistIconVisible],
    ['Memory Lens eligible', output.memoryLensEligible],
    ['移除 context-only 分支', output.sourceChecks?.controllerRemovedContextOnlyBranch],
    ['移除上下文回执', output.sourceChecks?.previewPolicyRemovedContextOnlyReceipt],
    ['全页面 Compose/Lens 互斥', output.sourceChecks?.lensHasGlobalComposeSuppression],
    ['划词检索不被互斥', output.sourceChecks?.selectedTextBypassesComposeSuppression],
    ['Trace action', output.ambientTrace?.action],
    ['Trace polarity', output.ambientTrace?.polarity],
    ['rawTextStored', output.ambientTrace?.redactedDiff?.rawTextStored],
    ['answerMemory.state', answerMemory?.state],
    ['authorityDecision', answerMemory?.authority?.decision || output.authorityDecision],
  ];
  return {
    quote: truncateText(String(quote || ''), 700),
    emptyText: item.reason || item.error || '没有结构化实际输出。',
    rows,
  };
}

function buildReaderProofChecks(item) {
  const checks = [
    {
      label: 'Case 状态',
      status: item.status,
      detail: item.why || item.reason || localizeStatus(item.status),
    },
  ];

  for (const [key, value] of Object.entries(item.scores || {})) {
    const numeric = Number(value);
    checks.push({
      label: localizeScoreKey(key),
      status: numeric >= 3 ? 'pass' : numeric >= 2 ? 'warn' : 'fail',
      detail: `${numeric}/3`,
    });
  }

  const output = item.actualOutput || {};
  if (item.topMatch || output.contextMatch || output.evidenceCount != null) {
    checks.push({
      label: '证据/上下文',
      status:
        item.topMatch || output.contextMatch?.state === 'locked' || Number(output.evidenceCount) > 0
          ? 'pass'
          : 'warn',
      detail: [
        item.topMatch ? `topMatch=${item.topMatch.title || item.topMatch.id}` : '',
        output.contextMatch?.state ? `contextMatch=${output.contextMatch.state}` : '',
        output.evidenceCount != null ? `evidence=${output.evidenceCount}` : '',
      ]
        .filter(Boolean)
        .join('；') || '没有可见上下文证据。',
    });
  }

  if (item.suiteId === 'ask-conversation-continuity') {
    const expectsReceipt = Boolean(item.expectedBehavior?.continuityReceipt);
    const receipt = output.continuityReceipt || item.continuityReceipt;
    const receiptMatches = expectsReceipt
      ? receipt?.source === 'local_ask_resume_snapshot' &&
        receipt?.localOnly === true &&
        receipt?.usedAsHint === true &&
        receipt?.reRetrieved === true
      : !receipt;
    checks.push({
      label: expectsReceipt ? '续聊回执契约' : '新问题隔离',
      status: receiptMatches ? 'pass' : 'fail',
      detail: expectsReceipt
        ? receiptMatches
          ? '本机线索、仅作提示和重新检索字段完整。'
          : '缺少或错误返回 continuityReceipt。'
        : receiptMatches
          ? '请求未继承续聊线索，响应也没有续聊回执。'
          : '新问题错误继承了续聊回执。',
    });
    if (item.expectedSelectedTopics?.length) {
      const selectedTopicLabel =
        output.contextMatch?.selectedTopic?.label || item.selectedTopicLabel || '';
      const selectedTopicMatches =
        hitTerms(selectedTopicLabel, item.expectedSelectedTopics).length > 0;
      checks.push({
        label: '显式续聊话题',
        status: selectedTopicMatches ? 'pass' : 'fail',
        detail: selectedTopicMatches
          ? `已锁定到 ${selectedTopicLabel}。`
          : `实际锁定到 ${selectedTopicLabel || 'none'}，预期 ${item.expectedSelectedTopics.join(' / ')}。`,
      });
    }
  }

  if (item.reportContract?.issues?.length) {
    checks.push({
      label: 'Reader Contract',
      status: 'warn',
      detail: item.reportContract.issues.join('；'),
    });
  }
  return checks;
}

function normalizeProofChecks(checks) {
  return (checks || []).map((check) => ({
    label: check.label || '-',
    status: check.status || 'unknown',
    detail: check.detail || '',
  }));
}

function buildReaderOutcomeSignalsFromProof(proof) {
  const actions = proof.outcomeActions || [];
  const cueIds = proof.cueIds || [];
  return [
    ...actions.map((action) => ({
      label: '行为',
      value: action,
      status: proof.outcomeCueIdsRetained ? 'pass' : 'warn',
    })),
    ...cueIds.map((cueId) => ({
      label: 'cueId',
      value: cueId,
      status: 'neutral',
    })),
  ];
}

function buildReaderOutcomeSignals(item) {
  const output = item.actualOutput || {};
  const signals = [];
  for (const outcome of item.outcomeSamples || []) {
    signals.push({
      label: String(outcome.surface || 'outcome'),
      value: String(outcome.action || outcome.interaction || 'recorded'),
      status: outcome.cue_id || outcome.metadata?.cueIds?.length ? 'pass' : 'neutral',
    });
  }
  if (output.ambientTrace) {
    signals.push({
      label: 'ambient trace',
      value: [output.ambientTrace.action, output.ambientTrace.polarity]
        .filter(Boolean)
        .join(' / '),
      status: 'neutral',
    });
  }
  if (output.steps?.length) {
    signals.push({
      label: 'steps',
      value: `${output.steps.length} steps`,
      status: 'neutral',
    });
  }
  return signals;
}

function buildReaderDebugLinks() {
  return [
    { file: 'case-results.json', label: '完整 case 结果' },
    { file: 'requests.jsonl', label: '请求证据' },
    { file: 'responses.jsonl', label: '原始响应' },
    { file: 'judge-results.jsonl', label: 'judge 判分' },
  ];
}

function renderReaderProofSummary(summary) {
  const readerProof = summary.readerProof;
  const structuredClaims = Array.isArray(readerProof?.claims)
    ? readerProof.claims
    : [];
  const provedClaims = structuredClaims.filter((claim) => claim.status === 'proved');
  const notProvedClaims = structuredClaims.filter((claim) => claim.status !== 'proved');
  const boundaries = Array.isArray(readerProof?.boundaries)
    ? readerProof.boundaries
    : [];
  const proofSourceText = readerProof?.source === 'suite_contract'
    ? '以下主张来自 suite 声明的需求验证契约，只有映射 case 全部运行、通过并达到证据门槛才会列为已证明。'
    : '以下结论由本次实际 case 结果归纳；该 suite 尚未声明完整的需求验证契约。';
  return `<section class="proof-section">
    <div class="proof-head">
      <div>
        <h2>这份 report 到底证明了什么</h2>
        <p class="muted">${escapeHtml(proofSourceText)} 报告字段完整性单独显示在“报告契约”。</p>
      </div>
      <div class="proof-status">${statusBadge(summary.status)}</div>
    </div>
    <div class="proof-grid">
      <div class="proof-panel proof-panel-good">
        <h3>已证明的需求行为</h3>
        <div class="proof-claim-list">${provedClaims.length
          ? provedClaims.map(renderRequirementProofClaim).join('')
          : (summary.proved || []).map((item) => `<p class="proof-claim-statement">${escapeHtml(item)}</p>`).join('') || '<p class="muted">本次没有形成需求级正向证明。</p>'}</div>
      </div>
      <div class="proof-panel proof-panel-boundary">
        <h3>未证明与验证边界</h3>
        <div class="proof-claim-list">${[
          ...notProvedClaims.map(renderRequirementProofClaim),
          ...boundaries.map((item) => `<div class="proof-boundary"><strong>边界</strong><p>${escapeHtml(item)}</p></div>`),
        ].join('') || (summary.notProved || []).map((item) => `<div class="proof-boundary"><p>${escapeHtml(item)}</p></div>`).join('') || '<p class="muted">没有记录验证边界。</p>'}</div>
      </div>
    </div>
  </section>`;
}

function renderRequirementProofClaim(claim) {
  const evidence = Array.isArray(claim.evidence) ? claim.evidence : [];
  return `<div class="proof-claim">
    <p class="proof-claim-statement">${escapeHtml(claim.statement)}</p>
    ${evidence.length ? `<ul class="proof-evidence-list">${evidence.map(renderRequirementProofEvidence).join('')}</ul>` : ''}
    ${claim.reason ? `<p class="proof-reason">${escapeHtml(claim.reason)}</p>` : ''}
  </div>`;
}

function renderRequirementProofEvidence(evidence) {
  const scoreChecks = Array.isArray(evidence.scoreChecks)
    ? evidence.scoreChecks
    : [];
  const scoreText = scoreChecks.length
    ? `；门槛：${scoreChecks
      .map((check) =>
        `${localizeScoreKey(check.scoreKey)} ${check.actual ?? '缺失'}（要求 >= ${check.minimum}）`,
      )
      .join('，')}`
    : '';
  return `<li><span>${escapeHtml(evidence.title || evidence.caseId)}</span><small>${escapeHtml(evidence.caseId || '')} · ${escapeHtml(localizeStatus(evidence.status))}${escapeHtml(scoreText)}</small></li>`;
}

function renderReaderCaseCard(item, index) {
  return `<article class="case-card reader-case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">Case ${index + 1} · ${escapeHtml(item.kindLabel || 'Eval case')}</p>
        <h3>${escapeHtml(item.title || item.caseId)}</h3>
        <p class="muted">${escapeHtml(item.caseId)}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        ${item.score == null ? '' : `<strong>${escapeHtml(item.score)}</strong><span>体验分 / 100</span>`}
      </div>
    </div>

    <div class="proof-callout ${item.status === 'pass' ? 'proof-callout-good' : 'proof-callout-neutral'}">
      <span>这个 case 要证明</span>
      <p>${escapeHtml(item.caseGoal || '-')}</p>
    </div>

    <div class="case-grid reader-case-grid">
      <div>
        <h4>输入场景</h4>
        <p>${escapeHtml(item.inputSummary?.text || '-')}</p>
        ${renderKeyValueList(item.inputSummary?.rows || [])}
        ${renderChipGroup('期望命中', item.inputSummary?.goodChips || [], 'chip-good')}
        ${renderChipGroup('不能命中', item.inputSummary?.badChips || [], 'chip-bad')}
      </div>
      <div>
        <h4>期望评估什么</h4>
        <p>${escapeHtml(item.expectedSummary?.text || '-')}</p>
        ${renderKeyValueList(item.expectedSummary?.rows || [])}
      </div>
    </div>

    <div class="case-grid reader-case-grid">
      <div>
        <h4>实际输出/结果</h4>
        ${item.actualSummary?.quote
          ? `<blockquote class="cue-quote">${escapeHtml(item.actualSummary.quote)}</blockquote>`
          : `<div class="cue-empty">${escapeHtml(item.actualSummary?.emptyText || '没有结构化实际输出。')}</div>`}
        ${renderKeyValueList(item.actualSummary?.rows || [])}
      </div>
      <div>
        <h4>通过依据</h4>
        ${renderProofChecks(item.proofChecks || [])}
      </div>
    </div>

    <div class="case-grid reader-case-grid">
      <div>
        <h4>Outcome / 学习信号</h4>
        ${renderReaderOutcomeSignals(item.outcomeSignals || [])}
      </div>
      <div>
        <h4>结论与下一步</h4>
        <p>${escapeHtml(item.conclusion || '-')}</p>
        <ul>${(item.nextSteps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('') || '<li>没有记录改进建议。</li>'}</ul>
      </div>
    </div>

    ${renderManualVerification(item.manualVerification)}

    <div class="debug-links">
      <h4>完整 debug 在这里</h4>
      ${renderReaderDebugLinks(item.debugLinks || [])}
    </div>

    ${renderCaseReportContract(item)}
    <div class="score-grid">${renderScoreBars(item.scores || {})}</div>
  </article>`;
}

function renderManualVerification(manualVerification) {
  const manual = normalizeManualVerification(manualVerification);
  if (!manual) return '';
  const sections = [
    ['准备', manual.prerequisites],
    ['操作步骤', manual.steps],
    ['预期结果', manual.expected],
    ['清理', manual.cleanup],
    ['保留证据', manual.evidence],
  ].filter(([, items]) => items?.length);

  return `<div class="manual-verification">
    <div class="manual-verification-head">
      <div>
        <h4>${escapeHtml(manual.title || '手动体验验证')}</h4>
        ${manual.summary ? `<p>${escapeHtml(manual.summary)}</p>` : ''}
      </div>
      <span>不计入自动判分</span>
    </div>
    ${sections.length ? `<div class="manual-verification-grid">
      ${sections.map(([label, items]) => `<div>
        <strong>${escapeHtml(label)}</strong>
        ${label === '操作步骤'
          ? `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
          : `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`}
      </div>`).join('')}
    </div>` : ''}
  </div>`;
}

function renderReaderOutcomeSignals(signals) {
  const items = (signals || []).filter((item) => item?.value);
  if (!items.length) return '<p class="muted">本 case 没有单独的 outcome / 学习信号。</p>';
  return `<div class="chip-row"><span>信号</span>${items
    .map((item) => `<em class="chip ${escapeAttr(item.status === 'pass' ? 'chip-good' : item.status === 'fail' ? 'chip-bad' : 'chip-neutral')}">${escapeHtml([item.label, item.value].filter(Boolean).join(': '))}</em>`)
    .join('')}</div>`;
}

function renderReaderDebugLinks(links) {
  const items = (links || []).filter((item) => item?.file);
  if (!items.length) return '<p class="muted">没有 debug 链接。</p>';
  return `<div class="chip-row">${items
    .map((item) => `<a class="chip chip-neutral" href="${escapeAttr(item.file)}">${escapeHtml(item.label || item.file)}</a>`)
    .join('')}</div>`;
}

function formatScores(scores = {}) {
  const entries = Object.entries(scores);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${localizeScoreKey(key)}:${value}`).join(', ');
}

function reportTitle(summary) {
  if (summary.suiteId === 'context-recall') return 'Memory Lens 真实群组关联评估';
  if (summary.suiteId === 'scene-memory-autopilot')
    return 'Scene Memory Autopilot 本地过滤评估';
  if (summary.suiteId === 'keystone-memory-briefs')
    return '关键记忆简报来源与场景边界评估';
  if (summary.suiteId === 'ask-context-gap') return 'Ask 缺上下文回补评估';
  if (summary.suiteId === 'ask-conversation-continuity')
    return 'Ask 会话续接真实场景评估';
  if (summary.suiteId === 'answer-memory-tracker') return 'Ask 活答案记忆追踪评估';
  if (summary.suiteId === 'estimate-cue-compiler') return 'Estimate Cue + Outcome Loop 评估';
  return summary.title || summary.suiteId;
}

function runExecutiveConclusion(summary, caseResults) {
  if (summary.status === 'skipped') return '本次没有执行样本，因此无法判断体验质量。';
  if (!caseResults.length) return '本次没有可展示的样本结果。';
  const counts = countStatuses(caseResults);
  const averageScore = averageCaseScore(caseResults);
  if (summary.reportContract?.issueCount) {
    return `本次结果存在 ${summary.reportContract.issueCount} 个报告契约问题：即使业务判分可用，也需要先补齐“跑了什么、期望什么、实际输出、判断和建议”。`;
  }
  if (summary.suiteId === 'ask-context-gap') {
    if ((counts.error || 0) > 0) {
      return `这次 Ask 缺上下文评估没有拿到完整业务结果：${counts.error} 条请求错误或超时，平均体验分 ${averageScore ?? '-'}。优先看每个 case 的“实际运行结果”和服务端错误，再判断是否进入召回修复。`;
    }
    if ((counts.fail || 0) > 0) {
      return `这次 Ask 缺上下文评估未达标：${counts.fail} 条没有把短问句锁定到预期记忆话题或证据，平均体验分 ${averageScore ?? '-'}。优先检查 MemoryContextMatchService、context frames 和 evidence grounding。`;
    }
    if ((counts.warn || 0) > 0) {
      return `这次 Ask 缺上下文评估有 ${counts.warn} 条只补到了部分上下文，平均体验分 ${averageScore ?? '-'}。需要人工确认是否能接受。`;
    }
    return `这次 Ask 缺上下文评估通过，短问句能补齐上下文并用 evidence 回答，平均体验分 ${averageScore ?? '-'}.`;
  }
  if (summary.suiteId === 'ask-conversation-continuity') {
    if ((counts.error || 0) > 0) {
      return `这次 Ask 会话续接评估有 ${counts.error} 条请求错误或超时，不能据此判断能力，平均体验分 ${averageScore ?? '-'}。`;
    }
    if ((counts.fail || 0) > 0) {
      return `这次 Ask 会话续接评估未达标：${counts.fail} 条在回执、重新检索、话题延续或新问题隔离上失败，平均体验分 ${averageScore ?? '-'}。`;
    }
    return `这次 Ask 会话续接评估通过：本机线索能延续真实话题并重新检索，新问题保持隔离，平均体验分 ${averageScore ?? '-'}。`;
  }
  if (summary.suiteId === 'context-recall') {
    if ((counts.fail || 0) > 0) {
      return `这次 Memory Lens 真实群组评估未达标：${counts.fail || 0} 条明显不该展示，平均体验分 ${averageScore ?? '-'}。优先改进召回门槛、标题摘要和为什么相关的解释。`;
    }
    if ((counts.warn || 0) > 0) {
      return `这次 Memory Lens 没有硬失败，但有 ${counts.warn || 0} 条只达到“可能相关”，平均体验分 ${averageScore ?? '-'}。建议降级展示或补足更具体的关联理由。`;
    }
    return `这次 Memory Lens 关联结果整体可用，平均体验分 ${averageScore ?? '-'}。`;
  }
  if (summary.suiteId === 'scene-memory-autopilot') {
    if ((counts.fail || 0) > 0) {
      return `这次 Scene Memory Autopilot 本地过滤评估未达标：${counts.fail || 0} 条没有正确展示或静默，平均体验分 ${averageScore ?? '-'}。优先检查场景锚点、quietReasons 和 source cluster 去重。`;
    }
    if ((counts.warn || 0) > 0) {
      return `这次 Scene Memory Autopilot 有 ${counts.warn || 0} 条诊断不完整，平均体验分 ${averageScore ?? '-'}。需要补齐 Autopilot 摘要或解释锚点。`;
    }
    return `这次 Scene Memory Autopilot 本地过滤评估通过，弱关联和重复候选被静默，平均体验分 ${averageScore ?? '-'}。`;
  }
  if (summary.suiteId === 'keystone-memory-briefs') {
    if ((counts.fail || 0) > 0 || (counts.error || 0) > 0) {
      return `这次关键记忆简报评估未达标：${(counts.fail || 0) + (counts.error || 0)} 条在来源覆盖、场景命中、时效或外发边界上失败，平均体验分 ${averageScore ?? '-'}。`;
    }
    return `这次关键记忆简报评估通过：ready、candidate、partial、stale 与外发脱敏边界符合预期，平均体验分 ${averageScore ?? '-'}。`;
  }
  if (summary.suiteId === 'estimate-cue-compiler') {
    if ((counts.fail || 0) > 0) {
      return `这次 Estimate Cue Compiler 评估未达标：${counts.fail || 0} 条 cue 编译、稳定性或 outcome 关联失败。`;
    }
    if ((counts.warn || 0) > 0) {
      return `这次 Estimate Cue Compiler 核心链路通过，但有 ${counts.warn || 0} 条诊断信息不完整，需要人工复核。`;
    }
    return '这次证明窄闭环：在本地 synthetic Jira estimate fixture 中，Memory Lens/Compose Assist 可以稳定生成“人天口径” cue，并让展开、插入、发送或标记不相关的 outcome 触发 suppress、boost 和 Skill suggestion。';
  }
  if ((counts.fail || 0) > 0) return `本次有 ${counts.fail} 条失败样本，需要查看下方建议。`;
  if ((counts.warn || 0) > 0) return `本次有 ${counts.warn} 条需关注样本，建议人工复核。`;
  return '本次样本没有发现明显体验问题。';
}

function buildRunNextSteps(summary, caseResults) {
  if (summary.suiteId === 'ask-context-gap') {
    const hasError = caseResults.some((item) => item.status === 'error');
    const hasFail = caseResults.some((item) => item.status === 'fail');
    if (hasError) {
      return [
        '先处理 Ask 请求错误或超时；如果是 LLMClient/fetch 问题，本次不能用于判断召回质量。',
        '服务恢复后重跑同一 suite，再看“命中上下文锚点”和“命中证据锚点”。',
      ];
    }
    if (hasFail) {
      return [
        '优先检查 MemoryContextMatchService 是否先把短问句锁定到最近高频/强互动/强锚点话题。',
        '再检查 Ask 的 recall query 是否使用了锁定话题的 aliases、role terms、source anchors 和 source ids。',
      ];
    }
    return ['继续保留这条 suite，并从最新高频记忆定期补充新的短问句样本。'];
  }
  if (summary.suiteId === 'ask-conversation-continuity') {
    const hasError = caseResults.some((item) => item.status === 'error');
    const hasFail = caseResults.some((item) => item.status === 'fail');
    if (hasError) {
      return ['先恢复 Ask endpoint 或排除超时，再用同一请求重跑；错误结果不用于判断续接质量。'];
    }
    if (hasFail) {
      return [
        '先检查失败 case 的 continuityReceipt 和 requests.jsonl，确认前端 hint 与服务端回执边界。',
        '再检查 evidence 命中和禁入话题，避免用旧摘要代替本轮检索或污染新问题。',
      ];
    }
    return [
      'Ask prompt、recall、context match 或续接 payload 变化后手动重跑该 suite。',
      '在提供 no-write eval 模式前保持手动运行，避免真实用户 answer memory 被测试会话污染。',
    ];
  }
  if (summary.status === 'fail') {
    return [
      '优先查看失败 case 的“改进建议”，确认是召回门槛、标题摘要，还是解释质量问题。',
      '需要自动修复时，在 worktree 状态可控后运行 --repair=auto。',
    ];
  }
  if (summary.status === 'error') {
    return [
      '先查看错误 case 的 actualOutput/error、requests.jsonl 和 responses.jsonl。',
      '修复服务请求或 runner 错误后再判断业务体验质量。',
    ];
  }
  if (summary.status === 'skipped') return ['这个 suite 还没有可执行 case，先补 JSONL 样本再加入调度。'];
  if (summary.suiteId === 'estimate-cue-compiler') {
    return [
      '先把真实 Jira estimate / Glip 记忆样本加入 suite，覆盖更多字段名、语言变体和 outcome 序列。',
      '如果要证明线上体验，下一步需要部署 memory-service，并用真实 Jira 页面验证 Memory Lens / Compose Assist UI。',
    ];
  }
  return ['本次没有必须立即处理的问题；仍建议查看 warn case 是否影响真实体验。'];
}

function formatCounts(counts = {}) {
  const order = ['pass', 'warn', 'fail', 'error', 'hide_expected', 'skipped'];
  const labels = order
    .filter((key) => counts[key])
    .map((key) => `${localizeStatus(key)} ${counts[key]}`);
  return labels.length ? labels.join('，') : '-';
}

function formatReportContract(reportContract) {
  if (!reportContract) return '未检查';
  if (!reportContract.issueCount) return `通过，检查 ${reportContract.checkedCaseCount || 0} 个 case`;
  return `需补齐，${reportContract.issueCount} 个问题 / ${reportContract.checkedCaseCount || 0} 个 case`;
}

function averageCaseScore(caseResults) {
  const scores = caseResults
    .map((item) => item.overallScore ?? computeOverallScore(item.scores, item.status))
    .filter((value) => Number.isFinite(value));
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function computeOverallScore(scores = {}, status = '') {
  const weights = {
    context_relevance: 30,
    user_value: 25,
    evidence_grounding: 25,
    context_match: 25,
    gap_resolution: 25,
    continuity_contract: 30,
    evidence_refresh: 25,
    topic_alignment: 25,
    topic_selection: 25,
    context_isolation: 20,
    answer_memory_tracking: 30,
    authority_contract: 20,
    specificity: 15,
    title_quality: 10,
    explanation_quality: 10,
    answer_quality: 10,
    suppression_correctness: 10,
    compose_icon_suppression: 25,
    memory_lens_routing: 25,
    source_context_only_removed: 25,
    global_mutual_exclusion: 25,
  };
  const keys = Object.keys(weights).filter((key) => Number.isFinite(Number(scores[key])));
  if (!keys.length) return null;
  const weighted = keys.reduce((sum, key) => sum + (Number(scores[key]) / 3) * weights[key], 0);
  const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0);
  let score = Math.round((weighted / totalWeight) * 100);
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'fail') score = Math.min(score, 49);
  if (normalizedStatus === 'warn') score = Math.min(score, 69);
  if (normalizedStatus === 'error') score = 0;
  if (normalizedStatus === 'skipped') return null;
  return score;
}

function summarizeSampleText(text) {
  return truncateText(String(text || '').replace(/\s+/g, ' ').trim(), 220);
}

function truncateText(text, maxLength = 180) {
  if (!text || text.length <= maxLength) return text || '';
  return `${text.slice(0, maxLength - 1)}…`;
}

function buildUserConclusion({ status, heuristic, error }) {
  if (status === 'error') return `未完成：接口请求失败${error ? `（${error}）` : ''}。`;
  if (status === 'pass') return '可以展示：结果命中了具体锚点，用户大概率能看懂为什么相关。';
  if (status === 'warn') return '谨慎展示：有少量锚点，但贴近度还不够，应该降级为“可能相关”或补强解释。';
  if (status === 'fail') return '不建议展示：当前召回与群组上下文不匹配，会让用户觉得 Memory Lens 在打扰。';
  if (status === 'hide_expected') return '保持安静：没有找到足够强相关的记忆时，不展示 Lens 是正确方向。';
  return heuristic?.why || '需要人工复核这个样本。';
}

function buildAskContextGapUserConclusion({ status, heuristic, error }) {
  if (status === 'error') return `未完成：Ask 接口请求失败${error ? `（${error}）` : ''}。`;
  if (status === 'pass') return '通过：Ask 从短问句里补到了关键上下文，并用证据回答了缺失上下文问题。';
  if (status === 'warn') return '需复核：Ask 触到了部分相关锚点，但上下文补全或证据支撑还不够稳定。';
  if (status === 'fail') return '失败：Ask 没有把短问句关联到预期项目证据，用户仍需要自己补 ticket、群组或文档上下文。';
  return heuristic?.why || '需要人工复核这个 Ask 样本。';
}

function buildComposeContextPackUserConclusion({ status, heuristic, error }) {
  if (status === 'error') return `未完成：Composer Assist 请求失败${error ? `（${error}）` : ''}。`;
  if (status === 'pass') return '通过：AI 输入框场景生成了模式、语言、证据和预览边界都符合契约的 Prompt 建议。';
  if (status === 'warn') return '需复核：生成了 Prompt 建议，但专业结构、相关性、证据或替换边界还不够稳定。';
  if (status === 'fail') return '失败：没有生成可用的 Prompt 建议，或模式、语言、内容与当前草稿不匹配。';
  return heuristic?.why || '需要人工复核这个 Compose Assist 样本。';
}

function buildImprovementSuggestions({ caseItem, status, heuristic, error }) {
  if (status === 'error') {
    return [`先修复 eval 请求失败：${error || '未知错误'}`];
  }

  const suggestions = [];
  const expected = caseItem.expectedTopics || [];
  const matched = heuristic.matchedExpectedTopics || [];
  const missing = expected.filter((topic) => !matched.includes(topic));
  const topMatch = heuristic.topMatch;
  const scores = heuristic.scores || {};

  if (!topMatch) {
    suggestions.push('继续保持无强相关时安静；如果用户认为应该有结果，需要补充记忆覆盖或降低到用户主动点击后搜索。');
  }
  if (!heuristic.autopilot) {
    suggestions.push('context-recall 响应必须带 Autopilot 摘要，报告才能区分“无记忆”和“有候选但被静默”。');
  } else if (heuristic.autopilot.mode === 'silent' && !heuristic.autopilot.quietReasons?.length) {
    suggestions.push('Autopilot 静默时应返回 quietReasons，避免用户或 eval 看不出为什么没有提示。');
  }
  if (status === 'fail' || scores.context_relevance < 2) {
    suggestions.push(`强相关展示前至少命中 2 个当前场景锚点；本样本优先锚点是：${expected.slice(0, 5).join('、') || caseItem.title}。`);
  }
  if (missing.length && status !== 'pass') {
    suggestions.push(`召回或 rerank 应优先补齐这些缺失锚点：${missing.slice(0, 5).join('、')}。`);
  }
  if ((heuristic.matchedMustNotReturnTopics || []).length) {
    suggestions.push(`命中了禁止主题：${heuristic.matchedMustNotReturnTopics.join('、')}，这类结果应直接降为 hidden。`);
  }
  if (scores.title_quality < 2 || /^(ringcentral\s*消息|glip|message|消息|meeting|calendar|时间)$/i.test(String(topMatch?.title || '').trim())) {
    suggestions.push('Lens 加粗标题不要用来源类型或“时间”这类空标题，应该摘要成最能判断价值的事实短语。');
  }
  if (scores.explanation_quality < 2) {
    suggestions.push('补充“为什么相关”：展示命中的人、项目、主题和当前聊天句子之间的关系，而不只显示来源。');
  }
  if (topMatch?.displayPriority === 'p1' && status !== 'pass') {
    suggestions.push('当前结果不应以强相关 p1 展示；应降级为 p2/点击后搜索，或直接 hidden。');
  }
  if (!suggestions.length) suggestions.push('维持当前策略，并继续用真实群组样本回归。');
  return [...new Set(suggestions)];
}

function buildComposeContextPackImprovementSuggestions({ caseItem, status, heuristic, error }) {
  if (status === 'error') {
    return [`先修复 Composer Assist eval 请求失败：${error || '未知错误'}`];
  }

  const suggestions = [];
  const expected = caseItem.expectedTopics || [];
  const matched = heuristic.matchedExpectedTopics || [];
  const evidenceMatched = heuristic.matchedEvidenceTopics || [];
  const missing = expected.filter((topic) => !matched.includes(topic));
  const requiresEvidence = caseItem.expectedBehavior?.requireEvidence !== false;
  const isRewrite =
    caseItem.expectedBehavior?.suggestionType === 'rewrite_prompt';

  if (heuristic.available === false) {
    suggestions.push('如果当前 chat 有明确任务且记忆库有证据，不能只返回 available=false；优先查看 debug.rejectedReason 和 recallRequest。');
  }
  if (requiresEvidence && !heuristic.evidenceCount) {
    suggestions.push('context pack 必须带 evidence；没有证据时应该保持安静并在 report 里解释 rejectedReason。');
  }
  if (requiresEvidence && !evidenceMatched.length) {
    suggestions.push('证据没有命中预期锚点；检查 sourceTypes、当前 provider 自回声过滤，以及 web_agent_prompt 的 primaryText/draftText 是否进入 recall。');
  }
  if ((heuristic.missingSections || []).length) {
    suggestions.push(`补齐建议文本的要求结构：${heuristic.missingSections.join('、')}。`);
  }
  if (missing.length && status !== 'pass') {
    suggestions.push(`生成文本缺少当前任务锚点：${missing.slice(0, 6).join('、')}。`);
  }
  if ((heuristic.matchedMustNotReturnTopics || []).length || (heuristic.matchedMustNotInclude || []).length) {
    suggestions.push('生成文本包含禁止主题或无关旧上下文，应加强 rerank 和 egress 过滤。');
  }
  if ((heuristic.missingSections || []).length && (heuristic.scores?.answer_quality ?? 0) < 3) {
    suggestions.push(
      isRewrite
        ? '完整重写应补齐研究范围、证据层级、多维分析、个体化条件和输出结构。'
        : '补丁或上下文只保留直接有用的结构，不要恢复任务判断、工具推荐或通用来源壳。',
    );
  }
  if (!suggestions.length) suggestions.push('维持这条回归；后续用 --live 接入真实 ChatGPT/Codex 页面采样。');
  return [...new Set(suggestions)];
}

function buildAskContextGapImprovementSuggestions({ caseItem, status, heuristic, error }) {
  if (status === 'error') {
    return [`先修复 Ask eval 请求失败：${error || '未知错误'}`];
  }

  const suggestions = [];
  const expected = caseItem.expectedTopics || [];
  const matched = heuristic.matchedExpectedTopics || [];
  const evidenceMatched = heuristic.matchedEvidenceTopics || [];
  const missing = expected.filter((topic) => !matched.includes(topic));

  const ambiguousAllowedAndUseful = heuristic.allowAmbiguous && heuristic.ambiguousHasExpected;
  if (!heuristic.evidenceCount && !ambiguousAllowedAndUseful) {
    suggestions.push('Ask 应该返回 evidence；短问句不能只给泛化回答，否则无法判断上下文是否自动补齐。');
  }
  if (!heuristic.contextMatch || heuristic.contextMatch.state === 'none') {
    suggestions.push('Ask 应该返回 contextMatch，并在证据召回前说明是否锁定到某个近期高频话题。');
  } else if (heuristic.contextMatch.state === 'ambiguous' && !ambiguousAllowedAndUseful) {
    suggestions.push('contextMatch 已发现多个接近候选；Ask 应该先让用户确认候选，而不是直接编一个结论。');
  }
  if (status === 'fail' || (heuristic.scores?.gap_resolution ?? 0) < 3) {
    suggestions.push('缺上下文问句要先通过 Memory Context Match 锁定“近期话题 + 角色词 + 来源锚点”，再进入证据召回。');
  }
  if (!evidenceMatched.length && !ambiguousAllowedAndUseful) {
    suggestions.push('judge 没有在 evidence 中看到预期锚点；优先检查 Ask recall 是否使用了 contextMatch 的 aliases、source anchors、role terms 和 source ids。');
  }
  if (missing.length && status !== 'pass') {
    suggestions.push(`预期锚点缺失：${missing.slice(0, 6).join('、')}。`);
  }
  if ((heuristic.matchedMustNotReturnTopics || []).length) {
    suggestions.push(`命中了禁止主题：${heuristic.matchedMustNotReturnTopics.join('、')}，说明短问句被错误路由到噪音记忆。`);
  }
  if ((heuristic.scores?.answer_quality ?? 0) < 2 && !ambiguousAllowedAndUseful) {
    suggestions.push('回答需要明确说明“已完成 / 未完成 / 证据不足”，并列出支撑证据，而不是只复述搜索结果。');
  }
  if (!suggestions.length) suggestions.push('维持这条回归，并继续从最新高频记忆补充新的短问句样本。');
  return [...new Set(suggestions)];
}

function applyReportContract(caseResults) {
  let issueCount = 0;
  for (const result of caseResults) {
    const issues = reportContractIssues(result);
    result.reportContract = {
      status: issues.length ? 'warn' : 'pass',
      issues,
    };
    issueCount += issues.length;
  }
  return {
    status: issueCount ? 'warn' : 'pass',
    issueCount,
    checkedCaseCount: caseResults.length,
  };
}

function reportContractIssues(result) {
  if (!result || result.status === 'skipped') {
    return result?.reason === 'suite_runner_not_implemented'
      ? ['suite 没有 runner；无法生成可读体验报告。']
      : [];
  }
  const issues = [];
  const readerCase = buildReaderCase(result, 0);
  if (!hasReaderContractText(readerCase.caseGoal)) {
    issues.push('Reader Contract 缺少 caseGoal，读者看不出这个 case 要证明什么。');
  }
  if (
    !hasReaderContractText(readerCase.inputSummary?.text) &&
    !hasReaderContractRows(readerCase.inputSummary?.rows)
  ) {
    issues.push('Reader Contract 缺少 inputSummary，读者看不出跑了什么数据。');
  }
  if (
    !hasReaderContractText(readerCase.expectedSummary?.text) &&
    !hasReaderContractRows(readerCase.expectedSummary?.rows)
  ) {
    issues.push('Reader Contract 缺少 expectedSummary，读者看不出期望验证什么。');
  }
  if (
    !hasReaderContractText(readerCase.actualSummary?.quote) &&
    !hasReaderContractText(readerCase.actualSummary?.emptyText, {
      disallow: ['没有结构化实际输出。'],
    }) &&
    !hasReaderContractRows(readerCase.actualSummary?.rows, { ignoreLabels: ['状态'] })
  ) {
    issues.push('Reader Contract 缺少 actualSummary，读者看不出系统实际输出或错误。');
  }
  if (!Array.isArray(readerCase.proofChecks) || !readerCase.proofChecks.length) {
    issues.push('Reader Contract 缺少 proofChecks，读者看不出通过依据。');
  }
  if (!hasReaderContractText(readerCase.conclusion)) {
    issues.push('Reader Contract 缺少 conclusion，读者看不出用户视角结论。');
  }
  if (!Array.isArray(readerCase.nextSteps)) {
    issues.push('Reader Contract 缺少 nextSteps，读者看不出后续动作。');
  }
  return issues;
}

function hasReaderContractText(value, options = {}) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return false;
  return !(options.disallow || []).includes(text);
}

function hasReaderContractRows(rows, options = {}) {
  const ignored = new Set(options.ignoreLabels || []);
  return (rows || []).some(([label, value]) => {
    if (ignored.has(label)) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
    return hasReaderContractText(value);
  });
}

function summarizeStatus(caseResults, reportContract = null) {
  if (caseResults.some((item) => item.status === 'error')) return 'error';
  if (caseResults.some((item) => item.status === 'fail')) return 'fail';
  if (caseResults.some((item) => item.status === 'warn')) return 'warn';
  if (caseResults.every((item) => item.status === 'skipped')) return 'skipped';
  if (reportContract?.issueCount) return 'warn';
  return 'pass';
}

function countStatuses(caseResults) {
  return caseResults.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

function parseMaybeJson(text) {
  if (!text) return null;
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}$/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function countHits(text, terms) {
  return hitTerms(text, terms).length;
}

function hitTerms(text, terms) {
  const normalized = normalize(text);
  return terms.filter((term) => normalized.includes(normalize(term)));
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value == null || value === '') return [];
  return [String(value)];
}

function matchText(match) {
  if (!match) return '';
  return [
    match.title,
    match.uiSummary,
    match.snippet,
    match.sourceLabel,
    match.sourceTitle,
    match.whyMatched,
    ...(match.whyRelevant || []),
    ...(match.matchedAnchors?.people || []),
    ...(match.matchedAnchors?.topics || []),
    ...(match.matchedAnchors?.projects || []),
    ...(match.matchedAnchors?.source || []),
  ].filter(Boolean).join('\n');
}

function askAnswerText(response) {
  if (!response || typeof response !== 'object') return '';
  const structured = response.structuredAnswer || {};
  return [
    response.answer,
    ...(structured.keyFindings || []),
    ...(structured.insights || []),
    ...(structured.timeline || []).map((item) => `${item.date || ''} ${item.event || ''}`),
    ...(structured.relatedEntities || []).map((item) => `${item.name || ''} ${item.type || ''} ${item.relevance || ''}`),
    response.analysis?.summary,
    ...(response.analysis?.keyFindings || []),
    ...(response.analysis?.insights || []),
  ].filter(Boolean).join('\n');
}

function askEvidenceText(item) {
  if (!item) return '';
  return [
    item.id,
    item.type,
    item.content,
    item.summary,
    item.source,
    item.sourceTitle,
    item.sourceUrl,
    item.sender,
    item.groupName,
    JSON.stringify(item.metadata || {}),
  ].filter(Boolean).join('\n');
}

function summarizeAskEvidence(item) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.sourceTitle || item.source || item.type || item.id,
    sourceLabel: item.source || item.type,
    sourceTitle: item.sourceTitle,
    displayPriority: item.score == null ? undefined : `score:${Number(item.score).toFixed(3)}`,
    whyRelevant: [truncateText(String(item.content || item.summary || ''), 220)].filter(Boolean),
  };
}

function summarizeAskContextMatch(contextMatch) {
  if (!contextMatch || typeof contextMatch !== 'object') return null;
  return {
    state: contextMatch.state || 'none',
    selectedTopic: summarizeAskContextTopic(contextMatch.selectedTopic),
    userFacingSummary: contextMatch.userFacingSummary,
    expandedQuery: truncateText(String(contextMatch.expandedQuery || ''), 360),
    candidates: (Array.isArray(contextMatch.candidates) ? contextMatch.candidates : [])
      .slice(0, 5)
      .map(summarizeAskContextTopic)
      .filter(Boolean),
  };
}

function summarizeAskContextTopic(topic) {
  if (!topic || typeof topic !== 'object') return null;
  return {
    label: topic.label,
    score: formatContextScore(topic.score),
    confidence: formatContextScore(topic.confidence),
    reasons: (topic.reasons || []).slice(0, 6),
    anchors: (topic.anchors || []).slice(0, 8),
    roleTerms: (topic.roleTerms || []).slice(0, 6),
    aliases: (topic.aliases || []).slice(0, 8),
    sourceIds: (topic.sourceIds || []).slice(0, 6),
  };
}

function formatContextScore(value) {
  if (!Number.isFinite(Number(value))) return undefined;
  return Number(value).toFixed(3);
}

function askContextMatchText(contextMatch) {
  if (!contextMatch || typeof contextMatch !== 'object') return '';
  const candidates = Array.isArray(contextMatch.candidates) ? contextMatch.candidates : [];
  return [
    contextMatch.state,
    contextMatch.userFacingSummary,
    contextMatch.expandedQuery,
    topicToText(contextMatch.selectedTopic),
    ...candidates.slice(0, 5).map(topicToText),
  ].filter(Boolean).join('\n');
}

function topicToText(topic) {
  if (!topic || typeof topic !== 'object') return '';
  return [
    topic.label,
    ...(topic.reasons || []),
    ...(topic.anchors || []),
    ...(topic.roleTerms || []),
    ...(topic.aliases || []),
    ...(topic.sourceIds || []),
  ].filter(Boolean).join('\n');
}

function summarizeComposeContextPackSample(collected, request) {
  const visibleMessages = request.visibleMessages || [];
  return {
    collectionMode: collected.collectionMode,
    liveError: collected.liveError,
    site: request.surface,
    title: request.title,
    url: request.url,
    draftText: request.draftText || '',
    primaryText: truncateText(request.primaryText || '', 1200),
    visibleMessages: visibleMessages.map((message) => ({
      sender: message.sender,
      text: truncateText(message.text || '', 500),
    })),
    sourceTypes: request.sourceTypes || [],
  };
}

function summarizeComposeContextPackOutput(response) {
  if (!response || typeof response !== 'object') return null;
  return {
    available: response.available,
    suggestionType: response.suggestionType,
    insertMode: response.insertMode,
    title: response.title,
    summary: response.summary,
    insertText: response.insertText || '',
    riskLevel: response.riskLevel,
    previewRequired: response.previewRequired,
    confidence: response.confidence,
    evidence: (response.evidence || []).slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      sourceLabel: item.sourceLabel,
      sourceTitle: item.sourceTitle,
      snippet: truncateText(item.snippet || '', 420),
      whyRelevant: item.whyRelevant || [],
      displayPriority: item.displayPriority,
      score: item.score,
    })),
    debug: summarizeComposeDebug(response.debug),
  };
}

function summarizeComposeDebug(debug) {
  if (!debug || typeof debug !== 'object') return null;
  return {
    taskFrame: debug.taskFrame,
    targetToolFit: debug.targetToolFit,
    sourceMix: debug.sourceMix,
    egressRisk: debug.egressRisk,
    relatedAgentSessions: debug.relatedAgentSessions,
    rejectedReason: debug.rejectedReason,
    recallRejectedReason: debug.recall?.rejectedReason,
  };
}

function countDistinctEvidenceSources(evidence) {
  const sources = new Set();
  for (const item of evidence || []) {
    const key = item?.sourceUrl || item?.sourceTitle || item?.source || item?.id;
    if (key) sources.add(key);
  }
  return sources.size;
}

function countDistinctComposerEvidenceSources(evidence) {
  const sources = new Set();
  for (const item of evidence || []) {
    const key = item?.sourceUrl || item?.sourceTitle || item?.sourceLabel || item?.id;
    if (key) sources.add(key);
  }
  return sources.size;
}

function composeEvidenceText(item) {
  if (!item) return '';
  return [
    item.id,
    item.title,
    item.snippet,
    item.sourceLabel,
    item.sourceTitle,
    item.whyMatched,
    ...(item.whyRelevant || []),
    JSON.stringify(item.metadata || {}),
  ].filter(Boolean).join('\n');
}

function summarizeComposeEvidence(item) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title || item.sourceTitle || item.sourceLabel || item.id,
    sourceLabel: item.sourceLabel,
    sourceTitle: item.sourceTitle,
    displayPriority: item.displayPriority,
    whyRelevant: [
      ...(item.whyRelevant || []),
      truncateText(item.snippet || '', 220),
    ].filter(Boolean),
  };
}

function extractContextPackSection(text, heading) {
  const value = String(text || '');
  const index = value.indexOf(`${heading}：`);
  if (index === -1) return '';
  const start = index + `${heading}：`.length;
  const rest = value.slice(start);
  const next = rest.search(/\n\S[^：\n]{0,20}：/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function buildAskContextGapWhy({
  matchedExpectedTopics,
  matchedEvidenceTopics,
  matchedMustNotReturnTopics,
  hasGapFill,
  hasCompletionStance,
  contextMatch,
  matchedContextMatchTopics,
  allowAmbiguous,
  ambiguousHasExpected,
  missingInfo,
  evidenceCount,
}) {
  if (matchedMustNotReturnTopics.length) return 'Ask response hit a banned/noise topic.';
  if (!contextMatch) return 'Ask did not return memory context match diagnostics, so the report cannot see how the missing context was resolved.';
  if (ambiguousHasExpected) return 'Memory context match correctly found multiple close candidates and included the expected topic for user clarification.';
  if (contextMatch.state === 'none') return 'Memory context match did not lock any recent topic before evidence recall.';
  if (contextMatch.state === 'ambiguous') {
    return allowAmbiguous
      ? 'Memory context match found multiple close candidates, but the expected topic was not visible enough in the candidate set.'
      : 'Memory context match found multiple close candidates and should ask the user to clarify.';
  }
  if (contextMatch.state === 'locked' && !matchedContextMatchTopics.length) return 'Memory context match locked a topic, but it did not contain expected anchors.';
  if (!evidenceCount) return 'Ask returned no evidence, so context gap recovery is not grounded.';
  if (!matchedEvidenceTopics.length) return 'Ask returned evidence, but it did not contain the expected project/context anchors.';
  if (!hasGapFill) return `Ask hit ${matchedExpectedTopics.length} expected topic(s), but did not clearly fill the context gap.`;
  if (!hasCompletionStance) return 'Ask found relevant context but did not clearly answer the completion/readiness question.';
  if (missingInfo.length) return 'Ask found context and also surfaced remaining missing information.';
  return `Ask locked the topic via memory context match and hit ${matchedExpectedTopics.length} expected topic(s), including ${matchedEvidenceTopics.length} grounded evidence anchor(s).`;
}

function buildComposeContextPackWhy({
  response,
  request,
  matchedExpectedTopics,
  matchedEvidenceTopics,
  matchedMustNotReturnTopics,
  missingSections,
  matchedMustInclude,
  matchedMustNotInclude,
  hasExpectedSuggestionType,
  insertModeMatches,
  previewMatches,
  riskMatches,
  languageMatches,
  requireEvidence,
  evidenceCount,
  expectedSuggestionType,
}) {
  if (matchedMustNotReturnTopics.length || matchedMustNotInclude.length) {
    return `Compose context pack included banned topic(s): ${[
      ...matchedMustNotReturnTopics,
      ...matchedMustNotInclude,
    ].join('、')}`;
  }
  if (!response?.available) {
    return `Composer Assist stayed quiet: ${response?.debug?.rejectedReason || response?.summary || 'available=false'}`;
  }
  if (!hasExpectedSuggestionType) {
    return `Expected ${expectedSuggestionType || 'context_pack'}, got ${response?.suggestionType || '-'}.`;
  }
  if (!insertModeMatches) {
    return `Insert mode mismatch for ${expectedSuggestionType}: got ${response?.insertMode || '-'}.`;
  }
  if (requireEvidence && !evidenceCount) {
    return 'Composer Assist generated no evidence-backed context.';
  }
  if (requireEvidence && !matchedEvidenceTopics.length) {
    return 'Evidence was returned, but it did not contain the expected memory anchors.';
  }
  if (missingSections.length) return `Prompt suggestion is missing section(s): ${missingSections.join('、')}.`;
  if (!languageMatches) {
    return 'Prompt Compiler output did not preserve the current draft language.';
  }
  if (!previewMatches || !riskMatches) {
    return `Privacy boundary mismatch: risk=${response?.riskLevel}, preview=${response?.previewRequired}.`;
  }
  if (!matchedExpectedTopics.length) return 'Context pack did not mention the expected current-task anchors.';
  if (!matchedMustInclude.length && request?.draftText) {
    return 'Context pack was generated, but it missed the case-specific must-include terms.';
  }
  return `${expectedSuggestionType} hit ${matchedExpectedTopics.length} expected topic(s) and ${matchedEvidenceTopics.length} evidence anchor(s).`;
}

function anchorCount(match) {
  if (!match?.matchedAnchors) return 0;
  return [
    ...(match.matchedAnchors.people || []),
    ...(match.matchedAnchors.topics || []),
    ...(match.matchedAnchors.projects || []),
    ...(match.matchedAnchors.source || []),
  ].filter(Boolean).length;
}

function buildWhy({ expectedHits, bannedHits, genericTitle, hasWhyRelevant, topMatch }) {
  if (!topMatch) return 'No match returned.';
  if (bannedHits) return 'Top match contains a must-not-return topic.';
  if (genericTitle) return 'Top match title is too generic.';
  if (!hasWhyRelevant) return 'Top match does not explain why it is relevant.';
  if (expectedHits) return `Top match hit ${expectedHits} expected topic(s).`;
  return 'Top match only has weak or generic overlap.';
}

function summarizeMatch(match) {
  if (!match) return null;
  return {
    id: match.id,
    title: match.title,
    sourceLabel: match.sourceLabel,
    sourceTitle: match.sourceTitle,
    displayPriority: match.displayPriority,
    whyRelevant: match.whyRelevant,
    matchedAnchors: match.matchedAnchors,
    suppressionReason: match.suppressionReason,
    mergedCount: match.mergedCount,
  };
}

function summarizeContextRecallAutopilot(autopilot) {
  if (!autopilot || typeof autopilot !== 'object') return null;
  return {
    mode: autopilot.mode,
    summary: autopilot.summary,
    candidateCount: autopilot.candidateCount,
    shownCount: autopilot.shownCount,
    strongCount: autopilot.strongCount,
    possibleCount: autopilot.possibleCount,
    quietedCount: autopilot.quietedCount,
    hiddenCount: autopilot.hiddenCount,
    lowInformationCount: autopilot.lowInformationCount,
    sourceExcludedCount: autopilot.sourceExcludedCount,
    duplicateMergedCount: autopilot.duplicateMergedCount,
    quietReasons: Array.isArray(autopilot.quietReasons)
      ? autopilot.quietReasons.map((item) => ({
          reason: item.reason,
          label: item.label,
          count: item.count,
        }))
      : [],
    sceneAnchors: autopilot.sceneAnchors,
    gates: Array.isArray(autopilot.gates) ? autopilot.gates : [],
  };
}

function renderCaseRow(item) {
  return `<tr>
    <td><code>${escapeHtml(item.caseId)}</code></td>
    <td>${statusBadge(item.status)}</td>
    <td>${escapeHtml(item.why || item.reason || item.error || '')}</td>
    <td><code>${escapeHtml(formatScores(item.scores))}</code></td>
    <td>${escapeHtml(item.topMatch?.title || item.topMatch?.id || '-')}</td>
  </tr>`;
}

function summarizeSourceProvenance(sourceProvenance) {
  const first = Array.isArray(sourceProvenance) ? sourceProvenance[0] : null;
  if (!first) return '';
  return [first.status, first.source].filter(Boolean).join(' · ');
}

function getSourceProvenanceAudit(item) {
  return (
    item.sourceProvenanceAudit ||
    item.actualOutput?.sourceProvenanceAudit ||
    item.judge?.heuristic?.sourceProvenanceAudit ||
    item.judge?.heuristic?.actualOutput?.sourceProvenanceAudit ||
    null
  );
}

function summarizeSourceProvenanceAudit(audit) {
  if (!audit || typeof audit !== 'object') return '';
  return audit.summary || '';
}

function summarizeSourceProvenanceStatus(audit) {
  if (!audit || typeof audit !== 'object') return '';
  return Object.entries(audit.byStatus || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
}

function summarizeSourceProvenanceWarnings(audit) {
  if (!audit || typeof audit !== 'object') return '';
  const warnings = Array.isArray(audit.warnings) ? audit.warnings : [];
  return warnings.join(' | ');
}

function renderProofChecks(checks) {
  const items = (checks || []).filter(Boolean);
  if (!items.length) return '<p class="muted">没有检查点。</p>';
  return `<ol class="proof-checks">
    ${items.map((check) => `<li>
      <span class="check-dot check-${escapeAttr(check.status || 'unknown')}">${escapeHtml(localizeStatus(check.status || 'unknown'))}</span>
      <div><strong>${escapeHtml(check.label || '-')}</strong><p>${escapeHtml(check.detail || '')}</p></div>
    </li>`).join('')}
  </ol>`;
}

function renderGenericCaseCards(caseResults) {
  return caseResults.map(renderGenericCaseCard).join('\n');
}

function renderGenericCaseCard(item) {
  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  return `<article class="case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">${escapeHtml(item.caseId)}</p>
        <h3>${escapeHtml(item.caseTitle || item.caseId)}</h3>
        <p class="muted">${escapeHtml(item.caseKind || item.suiteId || 'eval case')}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        ${score == null ? '' : `<strong>${escapeHtml(score)}</strong><span>体验分 / 100</span>`}
      </div>
    </div>
    <div class="case-grid">
      <div>
        <h4>跑了什么数据</h4>
        <p>${escapeHtml(item.sampleSummary || item.caseTitle || '-')}</p>
        ${item.sampleDetails ? renderKeyValueList(flattenDetailObject(item.sampleDetails)) : ''}
        ${renderChipGroup('期望命中', item.expectedTopics || [], 'chip-good')}
        ${renderChipGroup('不能命中', item.mustNotReturnTopics || [], 'chip-bad')}
      </div>
      <div>
        <h4>期望评估什么</h4>
        ${renderExpectedBehavior(item)}
      </div>
    </div>
    <div class="case-grid">
      <div>
        <h4>实际输出/结果</h4>
        ${item.actualOutput ? renderActualOutput(item.actualOutput) : item.topMatch ? `
          <p class="result-title">${escapeHtml(item.topMatch.title || item.topMatch.sourceTitle || item.topMatch.id || '-')}</p>
          <p class="muted">${escapeHtml(item.topMatch.sourceLabel || '-')} · ${escapeHtml(item.topMatch.displayPriority || '-')}</p>
          ${renderChipGroup('原因', item.topMatch.whyRelevant || [], 'chip-neutral')}
        ` : `<p class="muted">${escapeHtml(item.reason || item.error || '-')}</p>`}
      </div>
      <div>
        <h4>判断</h4>
        <p>${escapeHtml(item.userConclusion || item.why || item.reason || '-')}</p>
        <p class="muted">${escapeHtml(item.why || '')}</p>
      </div>
      <div>
        <h4>改进建议</h4>
        <ul>${(item.improvementSuggestions || []).map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('') || '<li>没有记录改进建议。</li>'}</ul>
      </div>
    </div>
    ${renderCaseReportContract(item)}
    <div class="score-grid">${renderScoreBars(item.scores || {})}</div>
  </article>`;
}

function renderAskContextGapCaseCard(item) {
  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  const sample = item.sampleDetails || {};
  const output = item.actualOutput || {};
  const heuristic = item.judge?.heuristic || {};
  return `<article class="case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">${escapeHtml(item.caseId)}</p>
        <h3>${escapeHtml(item.caseTitle || item.caseId)}</h3>
        <p class="muted">${escapeHtml(item.caseKind || 'ask_context_gap')}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        ${score == null ? '' : `<strong>${escapeHtml(score)}</strong><span>体验分 / 100</span>`}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>评估的问题</h4>
        ${renderKeyValueList([
          ['用户问句', item.query || sample.query],
          ['补充上下文', item.providedContext || sample.context],
          ['检索范围', sample.scope || 'work'],
          ['要验证的问题', item.problemStatement || sample.problemStatement],
          ['预期抽取', item.expectedExtraction || sample.expectedExtraction],
          ['预期行为', item.expectedBehavior],
        ])}
        ${renderChipGroup('期望命中', item.expectedTopics || [], 'chip-good')}
        ${renderChipGroup('不能命中', item.mustNotReturnTopics || [], 'chip-bad')}
      </div>
      <div>
        <h4>输入快照</h4>
        ${renderKeyValueList([
          ['采集方式', sample.collectionMode],
          ['includeEvidence', sample.includeEvidence],
          ['上下文缺口信号', sample.contextGapSignals || []],
          ['完成状态信号', sample.completionSignals || []],
        ])}
        ${sample.primaryText ? renderTextBlock(sample.primaryText) : '<p class="muted">没有样本快照。</p>'}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>实际运行结果</h4>
        ${renderKeyValueList([
          ['HTTP 状态', output.statusCode],
          ['请求耗时', output.durationMs == null ? undefined : `${output.durationMs}ms`],
          ['超时阈值', output.timeoutMs == null ? undefined : `${output.timeoutMs}ms`],
          ['Ask queryTimeMs', output.queryTimeMs == null ? undefined : `${output.queryTimeMs}ms`],
          ['错误', output.error],
          ['Evidence 数量', output.evidenceCount],
        ])}
        ${output.answer ? `<h4>Ask 回答</h4>${renderTextBlock(output.answer)}` : '<p class="muted">没有拿到 Ask 回答。</p>'}
      </div>
      <div>
        <h4>Memory Context Match</h4>
        ${renderAskContextMatchDetails(output.contextMatch || item.contextMatch)}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>Evidence</h4>
        ${renderAskEvidenceDetails(output.evidence || [])}
      </div>
      <div>
        <h4>提取出的缺口判断</h4>
        ${renderKeyValueList([
          ['contextMatch.state', output.contextMatch?.state || item.contextMatch?.state],
          ['锁定话题', output.contextMatch?.selectedTopic?.label || item.contextMatch?.selectedTopic?.label],
          ['命中 Context Match 锚点', item.matchedContextMatchTopics || heuristic.matchedContextMatchTopics || []],
          ['命中 Evidence 锚点', item.matchedEvidenceTopics || heuristic.matchedEvidenceTopics || []],
          ['评估结论', item.userConclusion || item.why],
        ])}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>评估结论</h4>
        <p>${escapeHtml(item.userConclusion || item.why || '-')}</p>
        <p class="muted">${escapeHtml(item.why || '')}</p>
        ${renderChipGroup('命中上下文锚点', item.matchedExpectedTopics || heuristic.matchedExpectedTopics || [], 'chip-good')}
        ${renderChipGroup('命中 Context Match 锚点', item.matchedContextMatchTopics || heuristic.matchedContextMatchTopics || [], 'chip-good')}
        ${renderChipGroup('命中 evidence 锚点', item.matchedEvidenceTopics || heuristic.matchedEvidenceTopics || [], 'chip-neutral')}
        ${renderChipGroup('命中禁止主题', item.matchedMustNotReturnTopics || heuristic.matchedMustNotReturnTopics || [], 'chip-bad')}
        ${renderChipGroup('仍缺信息', item.missingInfo || heuristic.missingInfo || [], 'chip-neutral')}
      </div>
      <div>
        <h4>提取出的问题 / 下一步</h4>
        <ul>${(item.improvementSuggestions || []).map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('') || '<li>没有记录改进建议。</li>'}</ul>
      </div>
    </div>

    <div class="score-grid">${renderScoreBars(item.scores || {})}</div>
  </article>`;
}

function renderAskContextMatchDetails(contextMatch) {
  if (!contextMatch) return '<p class="muted">没有 contextMatch，无法判断 Ask 是否先做了话题锁定。</p>';
  const selected = contextMatch.selectedTopic;
  return `<div class="context-match-box">
    ${renderKeyValueList([
      ['决策', contextMatch.state],
      ['锁定话题', selected?.label],
      ['锁定分数', selected?.score],
      ['锁定置信度', selected?.confidence],
      ['用户可见说明', contextMatch.userFacingSummary],
      ['expandedQuery', contextMatch.expandedQuery],
    ])}
    ${selected ? renderChipGroup('锁定原因', selected.reasons || [], 'chip-good') : ''}
    ${selected ? renderChipGroup('锁定锚点', selected.anchors || [], 'chip-neutral') : ''}
    ${selected ? renderChipGroup('角色词', selected.roleTerms || [], 'chip-neutral') : ''}
    <h4>候选话题</h4>
    ${renderAskContextCandidateTable(contextMatch.candidates || [])}
  </div>`;
}

function renderAskContextCandidateTable(candidates) {
  const rows = (candidates || []).filter(Boolean);
  if (!rows.length) return '<p class="muted">没有候选话题。</p>';
  return `<table class="compact-table"><thead><tr><th>候选</th><th>分数</th><th>置信度</th><th>原因 / 锚点</th></tr></thead><tbody>
    ${rows.map((item) => `<tr>
      <td>${escapeHtml(item.label || '-')}</td>
      <td>${escapeHtml(item.score ?? '-')}</td>
      <td>${escapeHtml(item.confidence ?? '-')}</td>
      <td>${escapeHtml([...(item.reasons || []), ...(item.anchors || [])].slice(0, 8).join('；') || '-')}</td>
    </tr>`).join('')}
  </tbody></table>`;
}

function renderAskEvidenceDetails(evidence) {
  const rows = (evidence || []).filter(Boolean);
  if (!rows.length) return '<p class="muted">没有 evidence，无法判断是否真的补齐上下文。</p>';
  return `<div class="message-list evidence-list">
    ${rows.map((item, index) => `<div>
      <span>${escapeHtml(`E${index + 1} · ${item.source || item.id || 'evidence'}`)}</span>
      <p><strong>${escapeHtml(item.title || item.id || '-')}</strong></p>
      <p>${escapeHtml(item.snippet || '')}</p>
    </div>`).join('')}
  </div>`;
}

function renderContextRecallCaseCard(item) {
  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  const topMatch = item.topMatch;
  const autopilot = item.autopilot || item.judge?.heuristic?.autopilot;
  const sourceProvenanceAudit =
    item.sourceProvenanceAudit ||
    item.actualOutput?.sourceProvenanceAudit ||
    item.judge?.heuristic?.sourceProvenanceAudit ||
    item.judge?.heuristic?.actualOutput?.sourceProvenanceAudit;
  return `<article class="case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">${escapeHtml(item.caseId)}</p>
        <h3>${escapeHtml(item.caseTitle || item.caseId)}</h3>
        <p class="muted">${item.targetUrl ? `<a href="${escapeAttr(item.targetUrl)}">${escapeHtml(item.targetUrl)}</a>` : '-'}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        <strong>${escapeHtml(score ?? '-')}</strong>
        <span>体验分 / 100</span>
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>跑了什么数据</h4>
        <p>${escapeHtml(item.sampleSummary || '-')}</p>
        ${renderSceneSourceProvenance(item.sampleDetails?.sourceProvenance)}
        ${renderSceneSourceProvenanceAudit(sourceProvenanceAudit)}
        ${renderChipGroup('期望命中', item.expectedTopics || [], 'chip-good')}
        ${renderChipGroup('不能命中', item.mustNotReturnTopics || [], 'chip-bad')}
      </div>
      <div>
        <h4>Lens 实际结果</h4>
        ${topMatch ? `
          <p class="result-title">${escapeHtml(topMatch.title || topMatch.sourceTitle || topMatch.id || '-')}</p>
          <p class="muted">${escapeHtml(topMatch.sourceLabel || '-')} · ${escapeHtml(topMatch.displayPriority || '-')}</p>
          ${renderChipGroup('关联理由', topMatch.whyRelevant || [], 'chip-neutral')}
          ${renderChipGroup('命中锚点', flattenSceneAnchors(topMatch.matchedAnchors), 'chip-good')}
        ` : '<p class="muted">没有展示可见关联记忆。</p>'}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>Autopilot 决策</h4>
        ${autopilot ? renderKeyValueList([
          ['模式', autopilot.mode],
          ['摘要', autopilot.summary],
          ['候选 / 展示', `${autopilot.candidateCount ?? 0} / ${autopilot.shownCount ?? 0}`],
          ['强相关 / 可能相关', `${autopilot.strongCount ?? 0} / ${autopilot.possibleCount ?? 0}`],
          ['静默 / hidden', `${autopilot.quietedCount ?? 0} / ${autopilot.hiddenCount ?? 0}`],
          ['低信息 / 来源排除 / 重复合并', `${autopilot.lowInformationCount ?? 0} / ${autopilot.sourceExcludedCount ?? 0} / ${autopilot.duplicateMergedCount ?? 0}`],
          ['门控', autopilot.gates || []],
        ]) : '<p class="muted">响应没有返回 Autopilot 摘要。</p>'}
        ${renderChipGroup('静默原因', (autopilot?.quietReasons || []).map((item) => `${item.label || item.reason} x${item.count}`), 'chip-neutral')}
      </div>
      <div>
        <h4>场景锚点</h4>
        ${autopilot?.sceneAnchors
          ? renderKeyValueList([
              ['人物', autopilot.sceneAnchors.people || []],
              ['主题', autopilot.sceneAnchors.topics || []],
              ['项目', autopilot.sceneAnchors.projects || []],
              ['来源', autopilot.sceneAnchors.source || []],
            ])
          : '<p class="muted">没有解析出可用场景锚点。</p>'}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>判断</h4>
        <p>${escapeHtml(item.userConclusion || item.why || '-')}</p>
        <p class="muted">${escapeHtml(item.why || '')}</p>
      </div>
      <div>
        <h4>改进建议</h4>
        <ul>${(item.improvementSuggestions || []).map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('')}</ul>
      </div>
    </div>

    ${renderCaseReportContract(item)}
    <div class="score-grid">
      ${renderScoreBars(item.scores || {})}
    </div>
  </article>`;
}

function renderSceneSourceProvenance(sourceProvenance) {
  const sources = Array.isArray(sourceProvenance) ? sourceProvenance : [];
  if (!sources.length) return '';
  return `<div class="source-provenance">
    <h5>样本来源</h5>
    <ul>
      ${sources
        .map(
          (source) => `<li>
            <strong>${escapeHtml(source.status || 'unknown')}</strong>
            <span>${source.source ? `<a href="${escapeAttr(source.source)}">${escapeHtml(source.source)}</a>` : '-'}</span>
            ${source.note ? `<em>${escapeHtml(source.note)}</em>` : ''}
          </li>`,
        )
        .join('')}
    </ul>
  </div>`;
}

function renderSceneSourceProvenanceAudit(audit) {
  if (!audit || typeof audit !== 'object') return '';
  const statusRows = Object.entries(audit.byStatus || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`);
  return `<div class="source-provenance">
    <h5>样本来源审计</h5>
    ${renderKeyValueList([
      ['摘要', audit.summary || '-'],
      ['来源数', audit.total ?? 0],
      ['可信输入', audit.trustedInputCount ?? 0],
      ['阻断来源', audit.blockedCount ?? 0],
      ['状态分布', statusRows],
    ])}
    ${renderChipGroup('来源告警', audit.warnings || [], 'chip-bad')}
  </div>`;
}

function renderComposeAssistCaseCard(item) {
  if (
    item.caseKind === 'compose_assist_context_pack' ||
    item.caseKind === 'compose_assist_prompt_patch' ||
    item.caseKind === 'compose_assist_prompt_rewrite'
  ) {
    return renderComposeContextPackCaseCard(item);
  }
  if (item.caseKind === 'compose_assist_lens_routing_contract') {
    return renderComposeLensRoutingContractCaseCard(item);
  }

  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  const sample = item.sampleDetails || {};
  const ambientExpected = item.expectedBehavior?.ambientTrace || {};
  const trace = item.actualOutput?.ambientTrace || {};
  return `<article class="case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">${escapeHtml(item.caseId)}</p>
        <h3>${escapeHtml(item.caseTitle || item.caseId)}</h3>
        <p class="muted">${escapeHtml(item.caseKind || 'compose_assist')}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        ${score == null ? '' : `<strong>${escapeHtml(score)}</strong><span>体验分 / 100</span>`}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>跑了什么数据</h4>
        ${renderKeyValueList([
          ['站点', sample.site],
          ['输入框类型', sample.composerType],
          ['当前线程 hash', sample.currentThreadHash],
          ['草稿长度', sample.draftTextLength],
          ['建议文本长度', sample.suggestionTextLength],
          ['最终发送文本长度', sample.finalSentTextLength],
        ])}
        ${renderEvidenceRefs(sample.evidenceRefs || [])}
        <p class="muted">报告只展示长度、hash 和证据引用，不展示原始 suggestion/finalSentText。</p>
      </div>
      <div>
        <h4>期望评估什么</h4>
        ${renderKeyValueList([
          ['Assist 行为', item.expectedBehavior?.assist],
          ['Trace action', ambientExpected.action],
          ['Trace polarity', ambientExpected.polarity],
          ['隐私等级', ambientExpected.privacyClass],
          ['不能存储', (ambientExpected.mustNotStore || []).join('、')],
          ['必须保留', (ambientExpected.mustStore || []).join('、')],
        ])}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>实际生成/评估结果</h4>
        ${renderKeyValueList([
          ['Assist 输出', item.actualOutput?.assist],
          ['Trace action', trace.action],
          ['Trace polarity', trace.polarity],
          ['隐私等级', trace.privacyClass],
          ['rawTextStored', trace.redactedDiff?.rawTextStored],
          ['相似度', trace.redactedDiff?.similarityScore],
          ['编辑距离段', trace.redactedDiff?.editDistanceBand],
          ['语义关系', trace.redactedDiff?.semanticRelation],
        ])}
        ${renderEvidenceRefs(trace.evidenceRefs || [])}
      </div>
      <div>
        <h4>用户视角结论</h4>
        <p>${escapeHtml(item.userConclusion || item.why || '-')}</p>
        <p class="muted">${escapeHtml(item.why || '')}</p>
        <h4>改进建议</h4>
        <ul>${(item.improvementSuggestions || []).map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('') || '<li>没有记录改进建议。</li>'}</ul>
      </div>
    </div>

    ${renderCaseReportContract(item)}
    <div class="score-grid">${renderScoreBars(item.scores || {})}</div>
  </article>`;
}

function renderComposeLensRoutingContractCaseCard(item) {
  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  const sample = item.sampleDetails || {};
  const output = item.actualOutput || {};
  const sourceChecks = output.sourceChecks || {};
  return `<article class="case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">${escapeHtml(item.caseId)}</p>
        <h3>${escapeHtml(item.caseTitle || item.caseId)}</h3>
        <p class="muted">${escapeHtml(item.caseKind || 'compose_assist_lens_routing_contract')}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        ${score == null ? '' : `<strong>${escapeHtml(score)}</strong><span>体验分 / 100</span>`}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>跑了什么 composer 场景</h4>
        ${renderKeyValueList([
          ['站点', sample.site],
          ['Surface', sample.surface],
          ['Context Type', sample.contextType],
          ['标题', sample.title],
          ['草稿长度', sample.draftTextLength],
          ['Assist available', sample.assistResponse?.available],
          ['Assist has insertText', sample.assistResponse?.hasInsertText],
          ['Evidence 数量', sample.assistResponse?.evidenceCount],
        ])}
        ${renderEvidenceRefs(sample.memoryLensMatches || [])}
      </div>
      <div>
        <h4>期望路由</h4>
        ${renderKeyValueList([
          ['期望 route', item.expectedBehavior?.route],
          ['Compose icon 可见', item.expectedBehavior?.composeAssistIconVisible],
          ['Memory Lens eligible', item.expectedBehavior?.memoryLensEligible],
        ])}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>实际路由</h4>
        ${renderKeyValueList([
          ['route', output.route],
          ['Compose icon 可见', output.composeAssistIconVisible],
          ['Memory Lens eligible', output.memoryLensEligible],
        ])}
      </div>
      <div>
        <h4>源码契约</h4>
        ${renderKeyValueList([
          ['移除 Controller context-only', sourceChecks.controllerRemovedContextOnlyBranch],
          ['移除上下文回执', sourceChecks.previewPolicyRemovedContextOnlyReceipt],
          ['全页面 Compose 抑制 Lens', sourceChecks.lensHasGlobalComposeSuppression],
          ['划词检索不被抑制', sourceChecks.selectedTextBypassesComposeSuppression],
        ])}
      </div>
    </div>

    <div>
      <h4>用户视角结论</h4>
      <p>${escapeHtml(item.userConclusion || item.why || '-')}</p>
      <p class="muted">${escapeHtml(item.why || '')}</p>
      <h4>改进建议</h4>
      <ul>${(item.improvementSuggestions || []).map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('') || '<li>没有记录改进建议。</li>'}</ul>
    </div>

    ${renderCaseReportContract(item)}
    <div class="score-grid">${renderScoreBars(item.scores || {})}</div>
  </article>`;
}

function renderExpectedBehavior(item) {
  const rows = [];
  if (item.expectedBehavior) rows.push(['期望行为', summarizeDetailValue(item.expectedBehavior)]);
  if (item.expectedTopics?.length) rows.push(['期望命中', item.expectedTopics.join('、')]);
  if (item.mustNotReturnTopics?.length) rows.push(['不能命中', item.mustNotReturnTopics.join('、')]);
  return renderKeyValueList(rows);
}

function renderActualOutput(output) {
  if (!output) return '<p class="muted">没有结构化实际输出。</p>';
  if (output.error) {
    return renderKeyValueList([
      ['错误', output.error],
      ['证据数', output.evidenceCount],
    ]);
  }
  const rows = flattenDetailObject(output).slice(0, 12);
  return renderKeyValueList(rows);
}

function flattenDetailObject(object, prefix = '') {
  const rows = [];
  for (const [key, value] of Object.entries(object || {})) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      rows.push([label, summarizeDetailValue(value)]);
    } else if (typeof value === 'object') {
      const nested = flattenDetailObject(value, label);
      if (nested.length) rows.push(...nested);
      else rows.push([label, summarizeDetailValue(value)]);
    } else {
      rows.push([label, value]);
    }
  }
  return rows;
}

function summarizeDetailValue(value) {
  if (typeof value === 'string') return truncateText(value, 260);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join('、');
  }
  if (typeof value === 'object') return truncateText(JSON.stringify(value), 320);
  return value;
}

function renderCaseReportContract(item) {
  const issues = item.reportContract?.issues || [];
  if (!issues.length) return '';
  return `<div class="contract-warning">
    <h4>报告契约缺口</h4>
    <ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>
  </div>`;
}

function renderReportContractIssues(caseResults) {
  const rows = caseResults
    .filter((item) => item.reportContract?.issues?.length)
    .map((item) => `<tr>
      <td><code>${escapeHtml(item.caseId)}</code></td>
      <td>${escapeHtml((item.reportContract.issues || []).join('；'))}</td>
    </tr>`);
  if (!rows.length) return '<p>没有报告契约问题。</p>';
  return `<table><thead><tr><th>Case</th><th>问题</th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`;
}

function renderComposeContextPackCaseCard(item) {
  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  const sample = item.sampleDetails || {};
  const output = item.actualOutput || {};
  const expected = item.expectedBehavior || {};
  return `<article class="case-card">
    <div class="case-card-head">
      <div>
        <p class="eyebrow">${escapeHtml(item.caseId)}</p>
        <h3>${escapeHtml(item.caseTitle || item.caseId)}</h3>
        <p class="muted">${escapeHtml(item.caseKind || 'compose_assist_context_pack')}</p>
      </div>
      <div class="score-box">
        ${statusBadge(item.status)}
        ${score == null ? '' : `<strong>${escapeHtml(score)}</strong><span>体验分 / 100</span>`}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>跑了什么 chat / 数据</h4>
        ${renderKeyValueList([
          ['采集方式', sample.collectionMode],
          ['live 失败', sample.liveError],
          ['站点', sample.site],
          ['标题', sample.title],
          ['URL', sample.url],
          ['草稿', sample.draftText],
          ['sourceTypes', sample.sourceTypes],
        ])}
        <h4>当前 chat 内容</h4>
        ${renderTextBlock(sample.primaryText || '-')}
        ${renderVisibleMessages(sample.visibleMessages || [])}
      </div>
      <div>
        <h4>期望评估什么</h4>
        ${renderKeyValueList([
          ['Assist 行为', expected.assist],
          ['Suggestion Type', expected.suggestionType],
          ['风险等级', expected.riskLevel],
          ['需要预览', expected.previewRequired],
          ['必须包含章节', expected.requiredSections || []],
          ['必须包含词', expected.mustInclude || []],
          ['禁止包含词', expected.mustNotInclude || []],
        ])}
        ${renderChipGroup('期望命中', item.expectedTopics || [], 'chip-good')}
        ${renderChipGroup('不能命中', item.mustNotReturnTopics || [], 'chip-bad')}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>Compose 文本</h4>
        ${output.insertText ? renderPreBlock(output.insertText) : '<p class="muted">没有生成 insertText。</p>'}
      </div>
      <div>
        <h4>服务端返回</h4>
        ${renderKeyValueList([
          ['available', output.available],
          ['suggestionType', output.suggestionType],
          ['标题', output.title],
          ['摘要', output.summary],
          ['riskLevel', output.riskLevel],
          ['previewRequired', output.previewRequired],
          ['confidence', output.confidence],
        ])}
        ${renderComposeEvidenceDetails(output.evidence || [])}
      </div>
    </div>

    <div class="case-grid">
      <div>
        <h4>评估结果</h4>
        <p>${escapeHtml(item.userConclusion || item.why || '-')}</p>
        <p class="muted">${escapeHtml(item.why || '')}</p>
        ${renderChipGroup('命中任务锚点', item.judge?.heuristic?.matchedExpectedTopics || [], 'chip-good')}
        ${renderChipGroup('命中证据锚点', item.judge?.heuristic?.matchedEvidenceTopics || [], 'chip-neutral')}
      </div>
      <div>
        <h4>改进建议</h4>
        <ul>${(item.improvementSuggestions || []).map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('') || '<li>没有记录改进建议。</li>'}</ul>
        ${output.debug ? `<h4>Debug 摘要</h4>${renderPreBlock(JSON.stringify(output.debug, null, 2))}` : ''}
      </div>
    </div>

    <div class="score-grid">${renderScoreBars(item.scores || {})}</div>
  </article>`;
}

function renderTextBlock(text) {
  return `<p class="text-block">${escapeHtml(text || '-')}</p>`;
}

function renderPreBlock(text) {
  return `<pre>${escapeHtml(text || '')}</pre>`;
}

function renderVisibleMessages(messages) {
  const rows = (messages || []).filter((message) => message?.text);
  if (!rows.length) return '';
  return `<div class="message-list">
    ${rows.map((message) => `<div><span>${escapeHtml(message.sender || 'message')}</span><p>${escapeHtml(message.text)}</p></div>`).join('')}
  </div>`;
}

function renderComposeEvidenceDetails(evidence) {
  const rows = (evidence || []).filter(Boolean);
  if (!rows.length) return '<p class="muted">没有 evidence。</p>';
  return `<div class="message-list evidence-list">
    ${rows.map((item, index) => `<div>
      <span>${escapeHtml(`M${index + 1} · ${item.sourceLabel || item.sourceTitle || item.id || 'evidence'}`)}</span>
      <p><strong>${escapeHtml(item.title || item.sourceTitle || item.id || '-')}</strong></p>
      <p>${escapeHtml(item.snippet || '')}</p>
      ${renderChipGroup('原因', item.whyRelevant || [], 'chip-neutral')}
    </div>`).join('')}
  </div>`;
}

function renderKeyValueList(rows) {
  const visibleRows = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!visibleRows.length) return '<p class="muted">没有结构化字段。</p>';
  return `<dl class="detail-list">
    ${visibleRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(formatDetailValue(value))}</dd></div>`).join('')}
  </dl>`;
}

function flattenSceneAnchors(anchors) {
  if (!anchors || typeof anchors !== 'object') return [];
  return [
    ...(anchors.people || []),
    ...(anchors.topics || []),
    ...(anchors.projects || []),
    ...(anchors.source || []),
  ].filter(Boolean);
}

function renderEvidenceRefs(refs) {
  const items = (refs || []).filter(Boolean);
  if (!items.length) return '';
  return `<div class="chip-row"><span>证据引用</span>${items.map((ref) => `<em class="chip chip-neutral">${escapeHtml([ref.id, ref.type, ref.role].filter(Boolean).join(' · '))}</em>`).join('')}</div>`;
}

function formatDetailValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function renderChipGroup(label, values, className = 'chip-neutral') {
  const chips = (values || []).filter(Boolean);
  if (!chips.length) return '';
  return `<div class="chip-row"><span>${escapeHtml(label)}</span>${chips.map((value) => `<em class="chip ${escapeAttr(className)}">${escapeHtml(value)}</em>`).join('')}</div>`;
}

function renderScoreBars(scores) {
  const entries = Object.entries(scores || {});
  if (!entries.length) return '';
  return entries.map(([key, value]) => {
    const width = Math.max(0, Math.min(100, Math.round((Number(value) / 3) * 100)));
    return `<div class="score-line">
      <span>${escapeHtml(localizeScoreKey(key))}</span>
      <div><i style="width:${escapeAttr(width)}%"></i></div>
      <strong>${escapeHtml(value)}/3</strong>
    </div>`;
  }).join('');
}

function localizeStatus(status) {
  const labels = {
    pass: '通过',
    warn: '需关注',
    fail: '失败',
    error: '错误',
    skipped: '跳过',
    hide_expected: '已静默',
    unknown: '未知',
  };
  return labels[String(status || 'unknown').toLowerCase()] || String(status || '-');
}

function localizeRepair(status) {
  const labels = {
    not_requested: '未触发',
    repair_blocked: '修复已阻止',
    repaired_pending_review: '已修复待 review',
    repair_validation_failed: '修复后验证失败',
    agent_failed: 'Agent 失败',
  };
  return labels[String(status || '')] || status || '-';
}

function localizeScoreKey(key) {
  const labels = {
    calibration_action: '校准动作',
    privacy_redaction: '隐私脱敏',
    evidence_refs: '证据引用',
    diff_quality: 'Diff 质量',
    context_relevance: '语义相关',
    user_value: '用户价值',
    evidence_grounding: '证据支撑',
    context_match: '话题锁定',
    gap_resolution: '缺口补齐',
    continuity_contract: '续聊回执',
    evidence_refresh: '重新检索',
    topic_alignment: '话题延续',
    topic_selection: '显式话题锁定',
    context_isolation: '新问题隔离',
    specificity: '具体性',
    title_quality: '标题质量',
    explanation_quality: '解释质量',
    autopilot_signal: 'Autopilot 摘要',
    answer_quality: '回答质量',
    suppression_correctness: '静默正确性',
    scene_filtering: '场景过滤',
    quiet_reasoning: '静默解释',
    deduplication: '同源去重',
    explainability: '解释质量',
    cue_compilation: 'Cue 编译',
    cue_stability: 'Cue 稳定',
    actionable_text: '可行动文案',
    outcome_linkage: 'Outcome 关联',
    sourceGrounding: '来源覆盖',
    sceneRelevance: '场景相关',
    statusAndFreshness: '状态与时效',
    privacyAndProjection: '隐私与投影',
    contractIntegrity: '契约完整性',
  };
  return labels[key] || key;
}

function metricCard(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '-')}</strong></div>`;
}

function statusBadge(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  return `<span class="badge badge-${escapeAttr(normalized)}">${escapeHtml(localizeStatus(normalized))}</span>`;
}

function buildHtmlShell({ title, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f5f0;
      --panel: #fffdf8;
      --ink: #20232a;
      --muted: #667085;
      --line: #e6dfd2;
      --accent: #0f766e;
      --accent-soft: #e6f4ef;
      --danger: #b42318;
      --warn: #b54708;
      --ok: #027a48;
      --skip: #475467;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main { width: min(1180px, calc(100vw - 48px)); margin: 32px auto 56px; }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
      margin-top: 16px;
      box-shadow: 0 10px 30px rgba(32, 35, 42, 0.05);
    }
    .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
    .hero-status { display: grid; justify-items: end; gap: 6px; min-width: 150px; }
    .hero-status strong { font-size: 28px; line-height: 1; }
    .hero-status span:last-child { color: var(--muted); font-size: 12px; }
    .eyebrow { margin: 0 0 6px; color: var(--accent); font-weight: 700; font-size: 13px; text-transform: uppercase; }
    h1 { margin: 0; font-size: 28px; letter-spacing: 0; line-height: 1.18; word-break: keep-all; }
    h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: 0; }
    h3 { margin: 0; font-size: 18px; letter-spacing: 0; }
    h4 { margin: 0 0 8px; font-size: 13px; color: #7a5b2e; letter-spacing: 0; }
    .lead { max-width: 760px; color: #475467; font-size: 15px; }
    .muted { color: var(--muted); }
    .mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; background: transparent; border: 0; box-shadow: none; padding: 0; }
    .metric { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-width: 0; }
    .metric span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .metric strong { display: block; font-size: 15px; overflow-wrap: anywhere; }
    .summary-list { display: grid; gap: 10px; }
    .summary-list div { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 12px; }
    .summary-list span:first-child { color: var(--muted); }
    .proof-section { background: #f8fbff; border-color: #cfe2ff; }
    .proof-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
    .proof-head h2 { margin-bottom: 6px; }
    .proof-status { flex: 0 0 auto; }
    .proof-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; }
    .proof-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff;
    }
    .proof-panel h3 { margin-bottom: 10px; font-size: 15px; }
    .proof-panel ul { margin: 0; padding-left: 18px; }
    .proof-panel li { margin: 7px 0; }
    .proof-claim-list { display: grid; gap: 12px; }
    .proof-claim { padding-bottom: 12px; border-bottom: 1px solid rgba(71, 84, 103, 0.16); }
    .proof-claim:last-child { padding-bottom: 0; border-bottom: 0; }
    .proof-claim-statement { margin: 0; color: #1d2939; font-weight: 700; overflow-wrap: anywhere; }
    .proof-evidence-list { display: grid; gap: 6px; margin-top: 8px !important; padding: 0 !important; list-style: none; }
    .proof-evidence-list li { display: grid; gap: 2px; margin: 0; color: #344054; }
    .proof-evidence-list small { color: var(--muted); overflow-wrap: anywhere; }
    .proof-reason { margin: 8px 0 0; color: #b54708; font-size: 13px; overflow-wrap: anywhere; }
    .proof-boundary { padding-bottom: 10px; border-bottom: 1px solid rgba(181, 71, 8, 0.14); }
    .proof-boundary:last-child { padding-bottom: 0; border-bottom: 0; }
    .proof-boundary strong { color: #b54708; font-size: 12px; }
    .proof-boundary p { margin: 3px 0 0; overflow-wrap: anywhere; }
    .proof-panel-good { border-color: #b6ded4; background: #f3fbf8; }
    .proof-panel-boundary { border-color: #fedf89; background: #fffcf2; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); padding: 10px 8px; }
    th { color: #344054; font-size: 12px; text-transform: uppercase; }
    td { overflow-wrap: anywhere; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge-pass { color: var(--ok); background: #ecfdf3; }
    .badge-warn { color: var(--warn); background: #fffaeb; }
    .badge-fail, .badge-error { color: var(--danger); background: #fef3f2; }
    .badge-skipped, .badge-hide_expected, .badge-unknown { color: var(--skip); background: #f2f4f7; }
    .case-card {
      border: 1px solid #dfcfb8;
      border-radius: 8px;
      padding: 18px;
      margin-top: 14px;
      background: #fffaf1;
    }
    .case-card-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .case-card-head .eyebrow { margin-bottom: 4px; color: #936b33; }
    .score-box { display: grid; justify-items: end; gap: 4px; min-width: 110px; }
    .score-box strong { font-size: 30px; line-height: 1; }
    .score-box span { color: var(--muted); font-size: 12px; }
    .case-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; margin-top: 16px; }
    .case-grid p { margin: 0 0 10px; }
    .estimate-case-card { background: #fffdf8; border-color: #d9e6ee; }
    .estimate-case-grid { grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); }
    .proof-callout {
      margin-top: 16px;
      border-radius: 8px;
      padding: 12px 14px;
      border: 1px solid #d0d5dd;
      background: #f8fafc;
    }
    .proof-callout span {
      display: block;
      margin-bottom: 5px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .proof-callout p { margin: 0; font-weight: 650; color: #243047; }
    .proof-callout-good { border-color: #b6ded4; background: #f3fbf8; }
    .proof-callout-neutral { border-color: #d0d5dd; background: #f8fafc; }
    .manual-verification {
      margin-top: 16px;
      border: 1px solid #b9d5e8;
      border-radius: 8px;
      padding: 14px;
      background: #f5fbff;
    }
    .manual-verification-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .manual-verification-head h4 { margin-bottom: 4px; color: #175cd3; }
    .manual-verification-head p { margin: 0; color: #475467; }
    .manual-verification-head span {
      flex: 0 0 auto;
      border: 1px solid #b9d5e8;
      border-radius: 999px;
      padding: 3px 9px;
      background: #fff;
      color: #175cd3;
      font-size: 12px;
      font-weight: 700;
    }
    .manual-verification-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .manual-verification-grid div {
      min-width: 0;
      border: 1px solid #d6eaf8;
      border-radius: 8px;
      padding: 10px 12px;
      background: #fff;
    }
    .manual-verification-grid strong { display: block; color: #243047; font-size: 13px; }
    .manual-verification-grid ol,
    .manual-verification-grid ul { margin: 8px 0 0; padding-left: 18px; }
    .manual-verification-grid li { margin: 5px 0; overflow-wrap: anywhere; }
    .cue-quote {
      margin: 0 0 12px;
      padding: 12px 14px;
      border-left: 4px solid var(--accent);
      border-radius: 0 8px 8px 0;
      background: #f3fbf8;
      color: #1d2939;
      font-weight: 650;
    }
    .cue-empty {
      margin-bottom: 12px;
      padding: 12px 14px;
      border: 1px dashed #98a2b3;
      border-radius: 8px;
      background: #f8fafc;
      color: #475467;
      font-weight: 650;
    }
    .proof-checks {
      display: grid;
      gap: 10px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .proof-checks li { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; align-items: start; }
    .proof-checks strong { display: block; margin-bottom: 2px; color: #243047; }
    .proof-checks p { margin: 0; color: #667085; }
    .check-dot {
      display: inline-flex;
      justify-content: center;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid transparent;
    }
    .check-pass { color: var(--ok); background: #ecfdf3; border-color: #abefc6; }
    .check-warn { color: var(--warn); background: #fffaeb; border-color: #fedf89; }
    .check-fail, .check-error { color: var(--danger); background: #fef3f2; border-color: #fecdca; }
    .check-unknown { color: var(--skip); background: #f2f4f7; border-color: #d0d5dd; }
    .result-title { font-weight: 700; color: #243047; }
    .chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .chip-row > span { color: var(--muted); font-size: 12px; margin-right: 2px; }
    .chip { display: inline-flex; border-radius: 999px; padding: 3px 9px; font-style: normal; font-size: 12px; border: 1px solid transparent; }
    .chip-good { background: var(--accent-soft); color: #0f766e; border-color: #b6ded4; }
    .chip-bad { background: #fef3f2; color: #b42318; border-color: #fecdca; }
    .chip-neutral { background: #f2f4f7; color: #344054; border-color: #d0d5dd; }
    .detail-list { display: grid; gap: 8px; margin: 0 0 10px; }
    .detail-list div { display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: 10px; align-items: start; }
    .detail-list dt { color: var(--muted); font-size: 12px; }
    .detail-list dd { margin: 0; overflow-wrap: anywhere; font-weight: 600; color: #344054; }
    .contract-warning {
      margin-top: 16px;
      padding: 12px;
      border: 1px solid #fedf89;
      border-radius: 8px;
      background: #fffaeb;
      color: #7a2e0e;
    }
    .contract-warning ul { margin: 6px 0 0; }
    .text-block {
      max-height: 280px;
      overflow: auto;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      white-space: pre-wrap;
    }
    pre {
      max-height: 420px;
      overflow: auto;
      margin: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      color: #243047;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .message-list { display: grid; gap: 8px; margin-top: 10px; }
    .message-list div {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      padding: 10px;
    }
    .message-list span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
    .message-list p { margin: 0 0 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .evidence-list { max-height: 420px; overflow: auto; }
    .context-match-box { display: grid; gap: 8px; }
    .compact-table { font-size: 12px; background: #fff; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .compact-table th, .compact-table td { padding: 8px; }
    .score-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin-top: 16px; }
    .score-line { display: grid; grid-template-columns: 86px minmax(0, 1fr) 36px; gap: 8px; align-items: center; font-size: 12px; color: #475467; }
    .score-line div { height: 8px; border-radius: 999px; background: #ece5da; overflow: hidden; }
    .score-line i { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
    .score-line strong { text-align: right; font-weight: 700; color: #344054; }
    @media (max-width: 860px) {
      main { width: min(100vw - 24px, 1180px); margin-top: 16px; }
      .grid { grid-template-columns: 1fr 1fr; }
      h1 { font-size: 24px; }
      .hero { display: block; }
      .hero-status { justify-items: start; margin-top: 16px; }
      .proof-head, .proof-grid { display: block; }
      .proof-status, .proof-panel { margin-top: 12px; }
      .summary-list div { grid-template-columns: 1fr; gap: 4px; }
      .case-card-head, .case-grid { display: block; }
      .score-box { justify-items: start; margin-top: 12px; }
      .case-grid > div { margin-top: 14px; }
      .proof-checks li { grid-template-columns: 1fr; }
      .score-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    ${body}
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
