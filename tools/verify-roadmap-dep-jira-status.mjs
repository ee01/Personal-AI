/**
 * Guards the Roadmap dep Jira-status bridge in source and the built
 * content script. A stale dist/ can return Target End only; the popover
 * then keeps showing 「未刷新」 after 「刷新 Jira」.
 *
 * Usage: node tools/verify-roadmap-dep-jira-status.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(repoRoot, 'src/contentScriptRoadmap.ts');
const distPath = path.join(repoRoot, 'dist/contentScriptRoadmap.js');

const failures = [];

function check(label, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(label);
}

function sliceAround(haystack, needle, radius = 240) {
  const index = haystack.indexOf(needle);
  if (index < 0) return '';
  return haystack.slice(Math.max(0, index - 80), index + needle.length + radius);
}

const src = fs.readFileSync(srcPath, 'utf8');
const fetchFn = src.split('async function handleFetchIssueDates')[1] || '';
check(
  'source handleFetchIssueDates requests status',
  fetchFn.includes("'status'") || fetchFn.includes('"status"'),
);
check(
  'source fetch-issue-dates-result posts status',
  src.includes('status: info.status'),
);

const distExists = fs.existsSync(distPath);
check('dist/contentScriptRoadmap.js exists', distExists, distPath);
if (distExists) {
  const dist = fs.readFileSync(distPath, 'utf8');
  const distFetch = dist.split('async function handleFetchIssueDates')[1] || '';
  const distResult = sliceAround(dist, 'pai-roadmap-fetch-issue-dates-result');
  check(
    'dist handleFetchIssueDates requests status',
    /['"]status['"]/.test(distFetch.slice(0, 800)),
  );
  check(
    'dist fetch-issue-dates-result posts status (not Target End only)',
    /status:\s*info\.status/.test(distResult) || /status:\s*\w+\.status/.test(distResult),
    distResult ? distResult.replace(/\s+/g, ' ').slice(0, 180) : 'result payload missing',
  );
  const refreshFn = dist.split('async function handleRefreshJiraIssues')[1] || '';
  check(
    'dist silent refresh field list includes status',
    /['"]status['"]/.test(refreshFn.slice(0, 1200)),
  );
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

console.log('\nroadmap dep Jira status bridge ok');
