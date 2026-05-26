import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import yaml from 'js-yaml';

export const repoRoot = process.cwd();

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue != null && inlineValue !== '') {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

export async function readYamlFile(filePath) {
  const text = await fs.readFile(resolveRepoPath(filePath), 'utf8');
  return yaml.load(text);
}

export async function loadRegistry() {
  return readYamlFile('evals/registry.yaml');
}

export async function loadAgents() {
  return readYamlFile('evals/agents.yaml');
}

export async function readJsonlFile(filePath) {
  const resolved = resolveRepoPath(filePath);
  let text = '';
  try {
    text = await fs.readFile(resolved, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`${filePath}:${index + 1}: invalid JSONL: ${err.message}`);
      }
    });
}

export async function writeJsonl(filePath, rows) {
  const lines = rows.map((row) => JSON.stringify(row));
  await ensureDir(path.dirname(resolveRepoPath(filePath)));
  await fs.writeFile(resolveRepoPath(filePath), `${lines.join('\n')}${lines.length ? '\n' : ''}`);
}

export async function appendJsonl(filePath, row) {
  await ensureDir(path.dirname(resolveRepoPath(filePath)));
  await fs.appendFile(resolveRepoPath(filePath), `${JSON.stringify(row)}\n`);
}

export async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(resolveRepoPath(filePath), 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return '';
    throw err;
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

export function getResultRoot(registry) {
  return registry?.defaults?.resultRoot || '.eval-runs';
}

export function getSuiteRepairConfig(registry, suite) {
  return {
    ...(registry?.defaults?.repair || {}),
    ...(suite?.repair || {}),
  };
}

export function getSuiteById(registry, suiteId) {
  return (registry.suites || []).find((suite) => suite.id === suiteId);
}

export async function loadSuiteCases(suite) {
  const casesPath = suite.cases;
  if (!casesPath) return [];
  const cases = await readJsonlFile(casesPath);
  return cases.map((item) => ({ ...item, suiteId: suite.id }));
}

export async function loadAllCases(registry) {
  const all = [];
  for (const suite of registry.suites || []) {
    const cases = await loadSuiteCases(suite);
    for (const item of cases) all.push({ suite, caseItem: item });
  }
  return all;
}

export async function findLatestSummaries(resultRoot) {
  const root = resolveRepoPath(resultRoot);
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summaryPath = path.join(root, entry.name, 'summary.json');
    try {
      const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
      summaries.push(summary);
    } catch {
      // Ignore incomplete or legacy run folders.
    }
  }
  summaries.sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)));
  return summaries;
}

export function createRunId(suiteId) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${suiteId}-${suffix}`;
}

export async function runProcess(command, args = [], options = {}) {
  const {
    cwd = repoRoot,
    input = '',
    shell = false,
    timeoutMs = 10 * 60 * 1000,
    env = process.env,
  } = options;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      stderr += `\nProcess timed out after ${timeoutMs}ms`;
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, command, args });
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

export async function runShell(command, options = {}) {
  return runProcess(command, [], { ...options, shell: true });
}

export async function getGitStatus() {
  const result = await runProcess('git', ['status', '--porcelain'], { timeoutMs: 30_000 });
  return result.stdout.trim();
}

export async function getGitDiffSnapshot() {
  const [status, diff, changed] = await Promise.all([
    runProcess('git', ['status', '--porcelain'], { timeoutMs: 30_000 }),
    runProcess('git', ['diff'], { timeoutMs: 30_000 }),
    runProcess('git', ['diff', '--name-only'], { timeoutMs: 30_000 }),
  ]);
  const statusFiles = parseGitStatusFiles(status.stdout);
  const diffFiles = changed.stdout.split(/\r?\n/).filter(Boolean);
  return {
    status: status.stdout,
    diff: diff.stdout,
    changedFiles: [...new Set([...statusFiles, ...diffFiles])],
  };
}

function parseGitStatusFiles(statusText) {
  return statusText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const filePart = line.slice(3);
      if (!filePart.includes(' -> ')) return [filePart];
      return filePart.split(' -> ').slice(-1);
    })
    .filter(Boolean);
}

export function fileMatchesAny(filePath, patterns = []) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

function globToRegExp(pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  let source = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function formatSchedule(schedule) {
  if (!schedule?.cron) return '-';
  const action = schedule.action ? ` action=${schedule.action}` : '';
  const every = schedule.every ? ` every=${schedule.every}` : '';
  return `${schedule.cron} ${schedule.timezone || ''}${every}${action}`.trim();
}

export function formatOutcome(status) {
  if (!status) return '-';
  return status;
}

export function parseDurationMs(value, fallbackMs = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value || '').trim();
  if (!text) return fallbackMs;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

export async function readJsonFileIfExists(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(resolveRepoPath(filePath), 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJsonFile(filePath, value) {
  await ensureDir(path.dirname(resolveRepoPath(filePath)));
  await fs.writeFile(resolveRepoPath(filePath), `${JSON.stringify(value, null, 2)}\n`);
}
