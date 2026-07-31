import fs from 'node:fs';

import { ContextRecallService } from '../memory-service/src/core/ContextRecallService.js';
import {
  SourceMemoryCaptureService,
  type SourceMemoryCreateInput,
} from '../memory-service/src/core/SourceMemoryCaptureService.js';
import { SourceMemoryDistillationWorker } from '../memory-service/src/core/SourceMemoryDistillationWorker.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';

interface SourceMemoryDistillerEvalCase {
  id: string;
  title: string;
  kind: string;
  scenario: string;
  modelProfile: 'grounded' | 'visual_table' | 'ai_skill' | 'scene_trigger';
  sources: SourceMemoryCreateInput[];
  recallChecks?: Array<{
    key: 'matchingRecall' | 'mismatchedRecall';
    request: Record<string, unknown>;
    expected: boolean;
  }>;
  expectedBehavior: Record<string, number | boolean | string>;
}

interface ProofCheck {
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-source-memory-distiller.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as SourceMemoryDistillerEvalCase;

const db = getTestDb();

try {
  const capture = new SourceMemoryCaptureService(db);
  const capsules = caseItem.sources.map((source) => capture.createCapsule(source));
  let modelCalls = 0;
  const worker = new SourceMemoryDistillationWorker(db, {
    userId: 'source-memory-distiller-eval',
    llmClient: {
      generateJSON: async (prompt: string) => {
        modelCalls += 1;
        return buildModelResponse(caseItem.modelProfile, prompt);
      },
    },
  });
  const workerSummary = await worker.runDueJobs(Math.max(1, capsules.length + 2));
  const currentCapsules = capsules.map((capsule) => capture.getCapsule(capsule.id));
  const deepPacks = currentCapsules.map((capsule) =>
    asRecord(asRecord(capsule.metadata).distillation).deep,
  );

  const spanRows = db
    .prepare(
      `SELECT id, capsule_id, input_hash, span_kind
       FROM source_memory_evidence_spans`,
    )
    .all() as Array<{
    id: string;
    capsule_id: string;
    input_hash: string;
    span_kind: string;
  }>;
  const artifactRows = db
    .prepare(
      `SELECT capsule_id, input_hash, artifact_type, evidence_span_ids_json
       FROM source_memory_distilled_artifacts`,
    )
    .all() as Array<{
    capsule_id: string;
    input_hash: string;
    artifact_type: string;
    evidence_span_ids_json: string;
  }>;
  const takeawayRows = db
    .prepare(
      `SELECT capsule_id, distillation_input_hash, evidence_anchor_ids_json
       FROM source_memory_takeaways
       WHERE origin = 'deep_distillation'`,
    )
    .all() as Array<{
    capsule_id: string;
    distillation_input_hash: string;
    evidence_anchor_ids_json: string;
  }>;
  const triggerRows = db
    .prepare(
      `SELECT capsule_id, distillation_input_hash, matcher_json
       FROM source_memory_triggers
       WHERE origin = 'deep_distillation'`,
    )
    .all() as Array<{
    capsule_id: string;
    distillation_input_hash: string;
    matcher_json: string;
  }>;
  const validSpanKeys = new Set(
    spanRows.map((row) => `${row.capsule_id}:${row.input_hash}:${row.id}`),
  );
  const persistedReferences = [
    ...artifactRows.map((artifact) => ({
      capsuleId: artifact.capsule_id,
      inputHash: artifact.input_hash,
      refs: readStringArray(artifact.evidence_span_ids_json),
    })),
    ...takeawayRows.map((takeaway) => ({
      capsuleId: takeaway.capsule_id,
      inputHash: takeaway.distillation_input_hash,
      refs: readStringArray(takeaway.evidence_anchor_ids_json),
    })),
    ...triggerRows.map((trigger) => ({
      capsuleId: trigger.capsule_id,
      inputHash: trigger.distillation_input_hash,
      refs: readObjectStringArray(trigger.matcher_json, 'evidenceSpanIds'),
    })),
  ];
  const invalidArtifactRefs = persistedReferences.reduce(
    (count, item) =>
      count +
      item.refs.filter(
        (ref) =>
          !validSpanKeys.has(`${item.capsuleId}:${item.inputHash}:${ref}`),
      ).length,
    0,
  );

  const recallResults: Record<string, boolean> = {};
  for (const check of caseItem.recallChecks || []) {
    const result = await new ContextRecallService(
      db,
      'source-memory-distiller-eval',
    ).recall(check.request as never);
    recallResults[check.key] = result.matches.some((match) =>
      capsules.some((capsule) => match.id === `source-memory:${capsule.id}`),
    );
  }

  const actual = {
    p0ReadyCount: currentCapsules.filter(
      (capsule) => asRecord(asRecord(capsule.metadata).distillation).status === 'ready',
    ).length,
    deepReadyCount: deepPacks.filter((deep) => asRecord(deep).status === 'ready')
      .length,
    blockedCount: deepPacks.filter((deep) => asRecord(deep).status === 'blocked')
      .length,
    modelCalls,
    clusterSize: Math.max(
      0,
      ...deepPacks.map((deep) =>
        Number(asRecord(asRecord(deep).cluster).size || 0),
      ),
    ),
    relatedLinkCount: countRows(
      `SELECT COUNT(*) AS count FROM source_memory_links
       WHERE relation = 'distilled_related_source'`,
    ),
    visualTableSpanCount: spanRows.filter(
      (row) => row.span_kind === 'visual_table_row',
    ).length,
    invalidArtifactRefs,
    deepTakeawayCount: takeawayRows.length,
    sourceSkillSeedCount: artifactRows.filter(
      (row) => row.artifact_type === 'skill_seed',
    ).length,
    profileWriteCount: countRows('SELECT COUNT(*) AS count FROM user_profile_items'),
    actionProposalCount: countRows('SELECT COUNT(*) AS count FROM proposed_actions'),
    skillSuggestionCount: countRows('SELECT COUNT(*) AS count FROM personal_skills'),
    activeSkillCount: countRows(
      `SELECT COUNT(*) AS count FROM personal_skills WHERE status != 'suggestion'`,
    ),
    matchingRecall: recallResults.matchingRecall ?? false,
    mismatchedRecall: recallResults.mismatchedRecall ?? false,
  };
  const proofChecks = Object.entries(caseItem.expectedBehavior).map(
    ([key, expected]) => checkExpectation(key, expected, actual),
  );
  for (const recallCheck of caseItem.recallChecks || []) {
    proofChecks.push(
      checkExpectation(recallCheck.key, recallCheck.expected, actual),
    );
  }
  const failures = proofChecks.filter((check) => !check.passed);
  const status = failures.length === 0 ? 'pass' : 'fail';
  const scores = {
    groundingIntegrity: categoryScore(proofChecks, [
      'invalidArtifactRefs',
      'visualTableSpanCountMin',
      'deepTakeawayCount',
    ]),
    lifecycleFallback: categoryScore(proofChecks, [
      'p0ReadyCount',
      'deepReadyCount',
      'blockedCount',
      'modelCalls',
    ]),
    sideEffectBoundary: categoryScore(proofChecks, [
      'profileWriteCount',
      'actionProposalCount',
      'skillSuggestionCount',
      'activeSkillCount',
    ]),
    sceneRelevance: categoryScore(proofChecks, [
      'matchingRecall',
      'mismatchedRecall',
    ]),
    sourceAggregation: categoryScore(proofChecks, [
      'clusterSize',
      'relatedLinkCount',
    ]),
  };

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore: average(Object.values(scores)),
      why:
        failures.length > 0
          ? `${failures[0].key}: expected ${formatValue(failures[0].expected)}, got ${formatValue(failures[0].actual)}`
          : `全部 ${proofChecks.length} 项生产契约检查通过；P0=${actual.p0ReadyCount}，deep ready=${actual.deepReadyCount}，blocked=${actual.blockedCount}。`,
      userConclusion:
        status === 'pass'
          ? '通过：资料在保存后保留同步 P0，并按证据、场景和高责任写入边界生成深度候选。'
          : '不通过：深度蒸馏的证据引用、场景门控、回退或副作用边界至少有一项偏离预期。',
      improvementSuggestions:
        status === 'pass'
          ? ['继续补充真实资料分布样本，但保持确定性 hard-gate 作为发布回归线。']
          : failures.map(
              (failure) =>
                `${failure.key} 期望 ${formatValue(failure.expected)}，实际 ${formatValue(failure.actual)}。`,
            ),
      actualOutput: {
        workerSummary,
        capsuleIds: capsules.map((capsule) => capsule.id),
        actual,
        proofChecks,
      },
      topMatch: {
        id: capsules[0]?.id || caseItem.id,
        title: currentCapsules[0]?.sourceTitle || caseItem.title,
        sourceLabel: currentCapsules[0]?.sourceKind || caseItem.kind,
        displayPriority: status === 'pass' ? 'p1' : 'hidden',
        whyRelevant: proofChecks.map(
          (check) => `${check.key}=${check.passed ? 'pass' : 'fail'}`,
        ),
      },
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.log(
    JSON.stringify({
      status: 'error',
      verdict: 'error',
      scores: {
        groundingIntegrity: 0,
        lifecycleFallback: 0,
        sideEffectBoundary: 0,
        sceneRelevance: 0,
        sourceAggregation: 0,
      },
      overallScore: 0,
      why: message,
      userConclusion: 'Source Memory Distiller eval 执行失败，无法判断深度蒸馏契约。',
      improvementSuggestions: ['检查 case 输入、迁移、生产 service import 和 tsx runner 输出。'],
      actualOutput: { error: message },
    }),
  );
  process.exitCode = 1;
} finally {
  cleanupTestDb();
}

function buildModelResponse(
  profile: SourceMemoryDistillerEvalCase['modelProfile'],
  prompt: string,
): Record<string, unknown> {
  const firstSpan = prompt.match(/\[([^\]]+:S\d+)\]/)?.[1];
  const visualSpan = prompt.match(
    /\[([^\]]+:S\d+)\] kind=visual_table_row/,
  )?.[1];
  const evidenceSpan = profile === 'visual_table' ? visualSpan || firstSpan : firstSpan;
  if (!evidenceSpan) throw new Error('No deterministic evidence span in prompt.');
  const response: Record<string, unknown> = {
    oneLineCue: 'Bring back the grounded source memo only in a relevant scene.',
    compactMemo: 'This memo keeps every reusable claim attached to saved source evidence.',
    fullMemo:
      'The source remains authoritative only for what its labeled evidence spans state. Profile, action, skill activation, and external writeback stay outside this worker.',
    takeaways: [
      {
        title: 'Grounded source takeaway',
        body: 'Derived output must retain a valid source span.',
        confidence: 0.91,
        evidenceSpanIds: [evidenceSpan],
      },
      {
        title: 'Unsupported candidate',
        body: 'This deliberately invalid item must be discarded.',
        confidence: 0.99,
        evidenceSpanIds: ['missing:S999'],
      },
    ],
    triggerCards: [],
    factCandidates: [],
    openQuestions: [],
    skillSeeds: [],
    storylineSeeds: [],
    sourceReliability: {
      level: 'high',
      reason: 'The output is constrained to deterministic saved spans.',
    },
  };
  if (profile === 'visual_table') {
    response.factCandidates = [
      {
        title: 'Table row candidate',
        statement: 'The visual table row is retained as a source-only fact candidate.',
        authority: 'source_only',
        confidence: 0.88,
        evidenceSpanIds: [evidenceSpan],
      },
    ];
  }
  if (profile === 'ai_skill') {
    response.factCandidates = [
      {
        title: 'External AI statement',
        statement: 'This statement remains source-only and must not update the profile.',
        authority: 'source_only',
        confidence: 0.85,
        evidenceSpanIds: [evidenceSpan],
      },
    ];
    response.skillSeeds = [
      {
        seedKey: 'evidence-first-ai-handoff',
        title: 'Evidence-first AI handoff',
        summary: 'Carry evidence IDs through an AI handoff workflow.',
        trigger: 'When another AI conversation contains a reusable workflow.',
        steps: ['Label source evidence', 'Draft a candidate', 'Validate references'],
        tools: ['source-memory'],
        validation: ['Every output references a saved span'],
        failureCorrections: ['Discard unsupported claims'],
        confidence: 0.9,
        evidenceSpanIds: [evidenceSpan],
      },
    ];
  }
  if (profile === 'scene_trigger') {
    response.triggerCards = [
      {
        sceneType: 'ask',
        description: 'Show the compact memo for evidence-grounding questions in Ask.',
        showAs: 'source_card',
        budget: 'compact',
        keywords: ['grounding'],
        confidence: 0.9,
        evidenceSpanIds: [evidenceSpan],
      },
    ];
  }
  return response;
}

function checkExpectation(
  key: string,
  expected: number | boolean | string,
  actualValues: Record<string, unknown>,
): ProofCheck {
  const minimum = key.endsWith('Min');
  const maximum = key.endsWith('Max');
  const actualKey = minimum || maximum ? key.slice(0, -3) : key;
  const actual = actualValues[actualKey];
  const passed = minimum
    ? Number(actual) >= Number(expected)
    : maximum
      ? Number(actual) <= Number(expected)
      : Object.is(actual, expected);
  return { key, expected, actual, passed };
}

function categoryScore(checks: ProofCheck[], keys: string[]): number {
  const relevant = checks.filter((check) => keys.includes(check.key));
  if (relevant.length === 0) return 100;
  return Math.round(
    (relevant.filter((check) => check.passed).length / relevant.length) * 100,
  );
}

function countRows(sql: string): number {
  const row = db.prepare(sql).get() as { count?: number } | undefined;
  return Number(row?.count || 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readObjectStringArray(value: string, key: string): string[] {
  try {
    const parsed = asRecord(JSON.parse(value));
    return Array.isArray(parsed[key]) ? (parsed[key] as unknown[]).map(String) : [];
  } catch {
    return [];
  }
}

function average(values: number[]): number {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
