#!/usr/bin/env node
import path from 'node:path';

import {
  ensureDir,
  getResultRoot,
  loadRegistry,
  loadSuiteCases,
  parseArgs,
  parseDurationMs,
  readJsonFileIfExists,
  repoRoot,
  resolveRepoPath,
  runProcess,
  writeJsonFile,
} from './eval-lib.mjs';

const args = parseArgs();
const registry = await loadRegistry();
const scheduler = registry.scheduler || {};
const resultRoot = getResultRoot(registry);
const stateFile = scheduler.stateFile || path.join(resultRoot, 'scheduler-state.json');
const pollIntervalMs = parseDurationMs(args.pollInterval || scheduler.pollInterval, 30 * 60 * 1000);

if (scheduler.enabled === false && !args.force) {
  console.log('Eval scheduler is disabled in evals/registry.yaml.');
  process.exit(0);
}

if (args.once) {
  await runDueOnce();
} else {
  console.log(`Eval scheduler started. Poll interval: ${pollIntervalMs}ms`);
  for (;;) {
    await runDueOnce();
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function runDueOnce() {
  await ensureDir(resolveRepoPath(resultRoot));
  const state = await readJsonFileIfExists(stateFile, { version: 1, runs: {} });
  const items = await buildScheduleItems();
  const now = Date.now();
  const due = items.filter((item) => isDue(item, state, now));

  if (!due.length) {
    console.log('No eval cases due.');
    await generateReport();
    return;
  }

  for (const item of due) {
    const startedAt = new Date().toISOString();
    const commandArgs = buildRunArgs(item);
    console.log(`Running ${item.key}: node ${commandArgs.join(' ')}`);
    const result = await runProcess('node', commandArgs, {
      cwd: repoRoot,
      timeoutMs: Number(process.env.EVAL_SCHEDULER_RUN_TIMEOUT_MS || 30 * 60 * 1000),
    });
    const completedAt = new Date().toISOString();
    const reportPath = parseReportPath(result.stdout);
    const status = parseRunStatus(result.stdout, result.code);
    state.runs[item.key] = {
      suiteId: item.suite.id,
      caseId: item.caseId || null,
      action: item.action,
      every: item.every,
      lastStartedAt: startedAt,
      lastCompletedAt: completedAt,
      lastStatus: status,
      lastExitCode: result.code,
      reportPath,
      stdoutTail: result.stdout.slice(-4000),
      stderrTail: result.stderr.slice(-4000),
    };
    await writeJsonFile(stateFile, state);
  }

  await generateReport();
}

async function buildScheduleItems() {
  const items = [];
  const explicitSelection = Boolean(args.suite || args.case);
  for (const suite of registry.suites || []) {
    if (suite.enabled === false) continue;
    if (args.suite && args.suite !== suite.id) continue;
    const schedule = suite.schedule || {};
    if (schedule.enabled === false && !args.force) continue;
    if (!explicitSelection && suite.runMode !== 'scheduled' && !schedule.enabled) continue;

    const caseSchedules = Array.isArray(suite.caseSchedules) ? suite.caseSchedules : [];
    if (caseSchedules.length) {
      const cases = await loadSuiteCases(suite);
      const knownCaseIds = new Set(cases.map((item) => item.id));
      for (const caseSchedule of caseSchedules) {
        if (caseSchedule.enabled === false && !args.force) continue;
        if (args.case && args.case !== caseSchedule.caseId) continue;
        if (!knownCaseIds.has(caseSchedule.caseId)) {
          console.warn(`Skipping unknown scheduled case ${suite.id}:${caseSchedule.caseId}`);
          continue;
        }
        items.push({
          key: `${suite.id}:${caseSchedule.caseId}`,
          suite,
          caseId: caseSchedule.caseId,
          every: caseSchedule.every || schedule.every || '7d',
          action: caseSchedule.action || schedule.action || scheduler.defaultAction || 'report',
          live: caseSchedule.live ?? schedule.live,
        });
      }
      continue;
    }

    if (args.case) continue;
    items.push({
      key: `${suite.id}:suite`,
      suite,
      every: schedule.every || '7d',
      action: schedule.action || scheduler.defaultAction || 'report',
      live: schedule.live,
    });
  }
  return items;
}

function isDue(item, state, now) {
  if (args.force) return true;
  const previous = state.runs?.[item.key];
  if (!previous?.lastStartedAt) return true;
  const everyMs = parseDurationMs(item.every, 7 * 24 * 60 * 60 * 1000);
  return now - Date.parse(previous.lastStartedAt) >= everyMs;
}

function buildRunArgs(item) {
  const runArgs = ['tools/eval-run.mjs'];
  if (item.caseId) {
    runArgs.push('--case', item.caseId);
  } else {
    runArgs.push('--suite', item.suite.id);
  }
  if (item.live) runArgs.push('--live');
  if (item.action === 'repair') {
    runArgs.push('--repair=auto');
  } else {
    runArgs.push('--no-repair');
  }
  return runArgs;
}

function parseReportPath(stdout) {
  const match = String(stdout || '').match(/:\s+(.+?report\.html)\s*$/m);
  return match?.[1] || null;
}

function parseRunStatus(stdout, code) {
  const match = String(stdout || '').match(/^(PASS|WARN|FAIL|ERROR|SKIPPED)\s+/m);
  if (match) return match[1].toLowerCase();
  if (code === 0) return 'pass';
  if (code === 1) return 'fail';
  return 'error';
}

async function generateReport() {
  const result = await runProcess('node', ['tools/eval-report.mjs'], {
    cwd: repoRoot,
    timeoutMs: 60_000,
  });
  if (result.code === 0) {
    console.log(`Updated eval report: ${result.stdout.trim()}`);
  } else {
    console.warn(`Failed to update eval report: ${result.stderr || result.stdout}`);
  }
}
