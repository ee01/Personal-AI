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

const args = parseArgs();
const registry = await loadRegistry();
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
    caseResults.push(caseResult);
  }

  const status = summarizeStatus(caseResults);
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
    counts: countStatuses(caseResults),
    failedCaseIds: caseResults.filter((item) => item.status === 'fail').map((item) => item.caseId),
    runDir,
    reportPath,
  };
  await writeSummary(runDir, summary, caseResults);
  return { ...summary, reportPath };
}

async function runCase({ suite, caseItem, runDir }) {
  const collected = await collectContext(caseItem);
  await appendJsonl(path.join(runDir, 'input.jsonl'), {
    caseId: caseItem.id,
    collectedAt: new Date().toISOString(),
    ...collected,
  });

  if (suite.id !== 'context-recall') {
    const skipped = {
      caseId: caseItem.id,
      status: 'skipped',
      verdict: 'skipped',
      reason: 'suite_runner_not_implemented',
      scores: {},
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
    judge: {
      heuristic,
      llm: llmJudge,
    },
    error: responseEnvelope.ok ? undefined : responseEnvelope.error,
  };
  await appendJsonl(path.join(runDir, 'judge-results.jsonl'), result);
  return result;
}

async function collectContext(caseItem) {
  if (args.live && caseItem.kind === 'ringcentral_group') {
    const live = await collectLiveRingCentralContext(caseItem);
    if (live.ok) return live;
  }
  const snapshot = caseItem.sampleContext || {};
  return {
    ok: true,
    collectionMode: snapshot.collectionMode || 'snapshot',
    title: caseItem.title,
    url: caseItem.canonicalUrl || caseItem.url,
    primaryText: snapshot.primaryText || caseItem.expectedTopics?.join(', ') || caseItem.title,
    secondaryTexts: snapshot.secondaryTexts || [caseItem.title].filter(Boolean),
  };
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

function judgeContextRecall({ caseItem, response }) {
  const matches = Array.isArray(response?.matches) ? response.matches : [];
  const visibleMatches = matches.filter((match) => match.displayPriority !== 'hidden');
  const topMatch = visibleMatches[0] || matches[0] || null;
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

  if (!matches.length || !visibleMatches.length) {
    return {
      verdict: 'hide_expected',
      scores: {
        context_relevance: 0,
        user_value: 0,
        specificity: 0,
        title_quality: 0,
        explanation_quality: 0,
        suppression_correctness: 3,
      },
      why: 'No visible recall match surfaced.',
      topMatch: null,
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
  const suppressionCorrectness = bannedHits ? 0 : contextRelevance >= 2 ? 3 : 1;

  let verdict = 'fail';
  if (bannedHits) {
    verdict = 'fail';
  } else if (contextRelevance >= 2 && userValue >= 2 && titleQuality >= 2) {
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
      suppression_correctness: suppressionCorrectness,
    },
    why: buildWhy({ expectedHits, bannedHits, genericTitle, hasWhyRelevant, topMatch }),
    topMatch: summarizeMatch(topMatch),
    matchedExpectedTopics,
    matchedMustNotReturnTopics,
    visibleMatchCount: visibleMatches.length,
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
- Do not commit or deploy.
- After editing, run the listed validation commands if practical.
- Leave a concise final summary of changed files and validation results.
`;
}

async function writeSummary(runDir, summary, caseResults) {
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'case-results.json')), JSON.stringify(caseResults, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'summary.json')), JSON.stringify(summary, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'report.html')), buildRunReportHtml(summary, caseResults));
}

function buildRunReportHtml(summary, caseResults) {
  const isContextRecall = summary.suiteId === 'context-recall';
  const averageScore = averageCaseScore(caseResults);
  const artifactRows = [
    ['input.jsonl', '采集到的页面或快照上下文'],
    ['requests.jsonl', '发往服务端的请求证据'],
    ['responses.jsonl', '服务端原始返回'],
    ['judge-results.jsonl', '启发式和可选 LLM judge 判分'],
    ['case-results.json', '结构化评估结果'],
    ['repair-attempts.jsonl', '仅在触发 repair 时生成'],
  ];
  const nextSteps = summary.status === 'fail'
    ? [
        '优先查看失败 case 的“改进建议”，确认是召回门槛、标题摘要，还是解释质量问题。',
        '需要自动修复时，在 worktree 状态可控后运行 --repair=auto。',
      ]
    : summary.status === 'skipped'
      ? ['这个 suite 还没有可执行 case，先补 JSONL 样本再加入调度。']
      : ['本次没有必须立即处理的问题；仍建议查看 warn case 是否影响真实体验。'];
  return buildHtmlShell({
    title: `体验评估 - ${summary.suiteId}`,
    body: `
      <section class="hero">
        <div>
          <p class="eyebrow">Personal AI Evals</p>
          <h1>${escapeHtml(reportTitle(summary))}</h1>
          <p class="muted">Run ID: <span class="mono">${escapeHtml(summary.runId)}</span></p>
          <p class="lead">${escapeHtml(runExecutiveConclusion(summary, caseResults))}</p>
        </div>
        <div class="hero-status">
          ${statusBadge(summary.status)}
          ${averageScore == null ? '' : `<strong>${escapeHtml(averageScore)}/100</strong><span>平均体验分</span>`}
        </div>
      </section>

      <section class="grid">
        ${metricCard('样本数', summary.caseCount)}
        ${metricCard('开始时间', summary.startedAt)}
        ${metricCard('完成时间', summary.completedAt || '-')}
        ${metricCard('修复状态', localizeRepair(summary.repairStatus || 'not_requested'))}
      </section>

      <section>
        <h2>本次结论</h2>
        <div class="summary-list">
          <div><span>运行目录</span><code>${escapeHtml(summary.runDir || '-')}</code></div>
          <div><span>结果分布</span><span>${escapeHtml(formatCounts(summary.counts || {}))}</span></div>
          <div><span>失败样本</span><span>${escapeHtml((summary.failedCaseIds || []).join(', ') || '-')}</span></div>
        </div>
      </section>

      <section>
        <h2>${isContextRecall ? 'Memory Lens 群组样本' : '样本结果'}</h2>
        ${caseResults.length
          ? isContextRecall
            ? caseResults.map(renderContextRecallCaseCard).join('\n')
            : renderGenericCasesTable(caseResults)
          : '<p class="muted">没有可展示的样本结果。</p>'}
      </section>

      <section>
        <h2>证据文件</h2>
        <table>
          <thead><tr><th>文件</th><th>说明</th></tr></thead>
          <tbody>
            ${artifactRows.map(([file, description]) => `<tr><td><a href="${escapeAttr(file)}">${escapeHtml(file)}</a></td><td>${escapeHtml(description)}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </section>

      <section>
        <h2>建议动作</h2>
        <ul>${nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>
    `,
  });
}

function formatScores(scores = {}) {
  const entries = Object.entries(scores);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${localizeScoreKey(key)}:${value}`).join(', ');
}

function reportTitle(summary) {
  if (summary.suiteId === 'context-recall') return 'Memory Lens 真实群组关联评估';
  return summary.title || summary.suiteId;
}

function runExecutiveConclusion(summary, caseResults) {
  if (summary.status === 'skipped') return '本次没有执行样本，因此无法判断体验质量。';
  if (!caseResults.length) return '本次没有可展示的样本结果。';
  const counts = countStatuses(caseResults);
  const averageScore = averageCaseScore(caseResults);
  if (summary.suiteId === 'context-recall') {
    if ((counts.fail || 0) > 0) {
      return `这次 Memory Lens 真实群组评估未达标：${counts.fail || 0} 条明显不该展示，平均体验分 ${averageScore ?? '-'}。优先改进召回门槛、标题摘要和为什么相关的解释。`;
    }
    if ((counts.warn || 0) > 0) {
      return `这次 Memory Lens 没有硬失败，但有 ${counts.warn || 0} 条只达到“可能相关”，平均体验分 ${averageScore ?? '-'}。建议降级展示或补足更具体的关联理由。`;
    }
    return `这次 Memory Lens 关联结果整体可用，平均体验分 ${averageScore ?? '-'}。`;
  }
  if ((counts.fail || 0) > 0) return `本次有 ${counts.fail} 条失败样本，需要查看下方建议。`;
  if ((counts.warn || 0) > 0) return `本次有 ${counts.warn} 条需关注样本，建议人工复核。`;
  return '本次样本没有发现明显体验问题。';
}

function formatCounts(counts = {}) {
  const order = ['pass', 'warn', 'fail', 'error', 'hide_expected', 'skipped'];
  const labels = order
    .filter((key) => counts[key])
    .map((key) => `${localizeStatus(key)} ${counts[key]}`);
  return labels.length ? labels.join('，') : '-';
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
    specificity: 15,
    title_quality: 10,
    explanation_quality: 10,
    suppression_correctness: 10,
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

function summarizeStatus(caseResults) {
  if (caseResults.some((item) => item.status === 'error')) return 'error';
  if (caseResults.some((item) => item.status === 'fail')) return 'fail';
  if (caseResults.some((item) => item.status === 'warn')) return 'warn';
  if (caseResults.every((item) => item.status === 'skipped')) return 'skipped';
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

function renderGenericCasesTable(caseResults) {
  return `<table>
    <thead>
      <tr>
        <th>样本</th>
        <th>状态</th>
        <th>结论</th>
        <th>评分</th>
        <th>Top Match</th>
      </tr>
    </thead>
    <tbody>
      ${caseResults.map(renderCaseRow).join('\n')}
    </tbody>
  </table>`;
}

function renderContextRecallCaseCard(item) {
  const score = item.overallScore ?? computeOverallScore(item.scores, item.status);
  const topMatch = item.topMatch;
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
        ${renderChipGroup('期望命中', item.expectedTopics || [], 'chip-good')}
        ${renderChipGroup('不能命中', item.mustNotReturnTopics || [], 'chip-bad')}
      </div>
      <div>
        <h4>Lens 实际结果</h4>
        ${topMatch ? `
          <p class="result-title">${escapeHtml(topMatch.title || topMatch.sourceTitle || topMatch.id || '-')}</p>
          <p class="muted">${escapeHtml(topMatch.sourceLabel || '-')} · ${escapeHtml(topMatch.displayPriority || '-')}</p>
          ${renderChipGroup('关联理由', topMatch.whyRelevant || [], 'chip-neutral')}
        ` : '<p class="muted">没有展示可见关联记忆。</p>'}
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

    <div class="score-grid">
      ${renderScoreBars(item.scores || {})}
    </div>
  </article>`;
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
    context_relevance: '语义相关',
    user_value: '用户价值',
    specificity: '具体性',
    title_quality: '标题质量',
    explanation_quality: '解释质量',
    suppression_correctness: '静默正确性',
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
    h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
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
    .result-title { font-weight: 700; color: #243047; }
    .chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .chip-row > span { color: var(--muted); font-size: 12px; margin-right: 2px; }
    .chip { display: inline-flex; border-radius: 999px; padding: 3px 9px; font-style: normal; font-size: 12px; border: 1px solid transparent; }
    .chip-good { background: var(--accent-soft); color: #0f766e; border-color: #b6ded4; }
    .chip-bad { background: #fef3f2; color: #b42318; border-color: #fecdca; }
    .chip-neutral { background: #f2f4f7; color: #344054; border-color: #d0d5dd; }
    .score-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin-top: 16px; }
    .score-line { display: grid; grid-template-columns: 86px minmax(0, 1fr) 36px; gap: 8px; align-items: center; font-size: 12px; color: #475467; }
    .score-line div { height: 8px; border-radius: 999px; background: #ece5da; overflow: hidden; }
    .score-line i { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
    .score-line strong { text-align: right; font-weight: 700; color: #344054; }
    @media (max-width: 860px) {
      main { width: min(100vw - 24px, 1180px); margin-top: 16px; }
      .grid { grid-template-columns: 1fr 1fr; }
      .hero { display: block; }
      .hero-status { justify-items: start; margin-top: 16px; }
      .summary-list div { grid-template-columns: 1fr; gap: 4px; }
      .case-card-head, .case-grid { display: block; }
      .score-box { justify-items: start; margin-top: 12px; }
      .case-grid > div { margin-top: 14px; }
      .score-grid { grid-template-columns: 1fr; }
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
