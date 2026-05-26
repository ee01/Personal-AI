#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = [
  'src',
  'static',
  'desktop-app/app',
  'desktop-app/src',
  'memory-service/src',
];
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.vue',
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.json',
]);
const ALLOWLIST_PATTERNS = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)tests?(\/|$)/,
  /(^|\/)fixtures?(\/|$)/,
  /(^|\/)prompts?(\/|$)/,
  /(^|\/)docs?(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)_locales(\/|$)/,
  /(^|\/)i18n\.(js|ts)$/,
  /(^|\/)i18n\/.*\.(ts|tsx|js)$/,
  /manifest\.json$/,
  /app-script-template\.gs$/,
  /package(-lock)?\.json$/,
];
const USER_VISIBLE_PATTERNS = [
  /[\u4e00-\u9fff]/,
  /\bplaceholder\s*=/i,
  /\baria-label\s*=/i,
  /\btitle\s*=/i,
  /\btextContent\s*=/,
  /\binnerHTML\s*=/,
  /\bwindow\.confirm\s*\(/,
  /\bwindow\.alert\s*\(/,
  /\bsetStatus\s*\(/,
  /\bsetMessage\s*\(/,
];

function parseArgs(argv) {
  return {
    summary: argv.includes('--summary'),
    strict: argv.includes('--strict'),
    json: argv.includes('--json'),
  };
}

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', ...TARGET_DIRS], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((file) => CODE_EXTENSIONS.has(path.extname(file)));
}

function isAllowlisted(file) {
  return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(file));
}

function scanFile(file) {
  const absolutePath = path.join(ROOT, file);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, index) => {
    if (!USER_VISIBLE_PATTERNS.some((pattern) => pattern.test(line))) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) {
      return;
    }
    hits.push({
      line: index + 1,
      text: trimmed.slice(0, 180),
    });
  });
  return hits;
}

function summarizeByDir(results) {
  const counts = new Map();
  for (const result of results) {
    const dir = TARGET_DIRS.find(
      (targetDir) =>
        result.file === targetDir || result.file.startsWith(`${targetDir}/`),
    );
    const key = dir || result.file.split('/')[0] || '.';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = listTrackedFiles();
  const scanned = [];
  const allowlisted = [];

  for (const file of files) {
    if (isAllowlisted(file)) {
      allowlisted.push(file);
      continue;
    }
    const hits = scanFile(file);
    if (hits.length > 0) {
      scanned.push({ file, hits });
    }
  }

  const payload = {
    trackedCodeFiles: files.length,
    allowlistedFiles: allowlisted.length,
    filesWithPotentialUiCopy: scanned.length,
    findings: scanned,
    summaryByDir: summarizeByDir(scanned),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`Tracked code files: ${payload.trackedCodeFiles}`);
    console.log(`Allowlisted files: ${payload.allowlistedFiles}`);
    console.log(
      `Files with potential hardcoded UI copy: ${payload.filesWithPotentialUiCopy}`,
    );
    console.log('');
    console.log('By directory:');
    for (const [dir, count] of payload.summaryByDir) {
      console.log(`  ${dir}: ${count}`);
    }
    if (!options.summary) {
      console.log('');
      for (const result of scanned) {
        console.log(result.file);
        for (const hit of result.hits.slice(0, 8)) {
          console.log(`  ${hit.line}: ${hit.text}`);
        }
        if (result.hits.length > 8) {
          console.log(`  ... ${result.hits.length - 8} more`);
        }
      }
    }
  }

  if (options.strict && scanned.length > 0) {
    process.exitCode = 1;
  }
}

main();
