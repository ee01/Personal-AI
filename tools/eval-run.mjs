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
    };
    await writeSummary(runDir, summary, []);
    return { ...summary, reportPath: path.join(runDir, 'report.md') };
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
  };
  await writeSummary(runDir, summary, caseResults);
  return { ...summary, reportPath: path.join(runDir, 'report.md') };
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
    status: responseEnvelope.ok ? heuristic.verdict : 'error',
    verdict: responseEnvelope.ok ? heuristic.verdict : 'error',
    scores: heuristic.scores,
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
  const expectedHits = countHits(topText, expected);
  const bannedHits = countHits(topText, banned);
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
  const cliRepair = typeof args.repair === 'string' ? args.repair : null;
  const repairConfig = getSuiteRepairConfig(registry, suite);
  const mode = cliRepair || repairConfig.mode;
  return status === 'fail' && mode === 'auto';
}

function buildRepairPrompt({ suite, runDir, caseResults, repairConfig }) {
  const failures = caseResults.filter((item) => item.status === 'fail' || item.status === 'error');
  return `You are fixing Personal AI eval failures.

Suite: ${suite.id} - ${suite.title}
Run directory: ${resolveRepoPath(runDir)}
Report: ${resolveRepoPath(path.join(runDir, 'report.md'))}

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
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'summary.json')), JSON.stringify(summary, null, 2));
  await fs.writeFile(resolveRepoPath(path.join(runDir, 'report.md')), buildReport(summary, caseResults));
}

function buildReport(summary, caseResults) {
  const lines = [
    `# Eval Run: ${summary.suiteId}`,
    '',
    `- Run ID: \`${summary.runId}\``,
    `- Status: \`${summary.status}\``,
    `- Started: ${summary.startedAt}`,
    `- Completed: ${summary.completedAt || '-'}`,
    `- Repair: \`${summary.repairStatus || 'not_requested'}\``,
    '',
    '## Cases',
    '',
    '| Case | Status | Why | Top Match |',
    '|---|---|---|---|',
  ];
  if (!caseResults.length) {
    lines.push('| - | skipped | no cases | - |');
  }
  for (const item of caseResults) {
    lines.push(
      `| \`${item.caseId}\` | \`${item.status}\` | ${escapeTable(item.why || item.reason || item.error || '')} | ${escapeTable(item.topMatch?.title || item.topMatch?.id || '-')} |`,
    );
  }
  lines.push('', '## Next Steps', '');
  if (summary.status === 'fail') {
    lines.push('- Inspect `judge-results.jsonl`, `requests.jsonl`, and `responses.jsonl`.');
    lines.push('- Run with `--repair=auto` when the working tree is ready for automated repair.');
  } else if (summary.status === 'skipped') {
    lines.push('- Add JSONL cases for this suite before scheduling it.');
  } else {
    lines.push('- No immediate action required.');
  }
  lines.push('');
  return lines.join('\n');
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
  const normalized = normalize(text);
  return terms.filter((term) => normalized.includes(normalize(term))).length;
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

function escapeTable(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
