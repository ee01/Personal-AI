#!/usr/bin/env node
/**
 * Scan frontend LLM call sites and ensure capability is annotated.
 *
 * Usage: node tools/check-llm-capability-coverage.mjs
 * Exit 1 when any handleLLMRequest / callLLMJsonAPI call lacks capability.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const CALL_RE =
  /\b(handleLLMRequest|callLLMJsonAPI|runMeetingIntelligenceLLM)\s*\(/g;

/** Files that define the helpers themselves (not call sites). */
const SKIP_FILES = new Set([
  path.join(SRC, 'llm.ts'),
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function extractCallBlock(source, startIdx) {
  let i = startIdx;
  while (i < source.length && source[i] !== '(') i += 1;
  if (i >= source.length) return null;
  let depth = 0;
  let inStr = null;
  let escaped = false;
  for (let j = i; j < source.length; j += 1) {
    const ch = source[j];
    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(i, j + 1);
    }
  }
  return null;
}

function hasCapability(callText) {
  return /capability\s*:/.test(callText);
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

const files = walk(SRC);
const missing = [];
let checked = 0;

for (const file of files) {
  if (SKIP_FILES.has(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  CALL_RE.lastIndex = 0;
  let match;
  while ((match = CALL_RE.exec(source))) {
    const block = extractCallBlock(source, match.index);
    if (!block) continue;
    checked += 1;
    // runMeetingIntelligenceLLM defaults capability internally.
    if (match[1] === 'runMeetingIntelligenceLLM') continue;
    if (!hasCapability(block)) {
      missing.push({
        file: path.relative(ROOT, file),
        line: lineNumber(source, match.index),
        callee: match[1],
        preview: block.replace(/\s+/g, ' ').slice(0, 120),
      });
    }
  }
}

console.log(`[capability-coverage] checked ${checked} call site(s)`);
if (missing.length === 0) {
  console.log('[capability-coverage] OK — all call sites annotate capability');
  process.exit(0);
}

console.error(
  `[capability-coverage] FAIL — ${missing.length} call site(s) missing capability:`,
);
for (const item of missing) {
  console.error(
    `  ${item.file}:${item.line} ${item.callee} → ${item.preview}`,
  );
}
process.exit(1);
