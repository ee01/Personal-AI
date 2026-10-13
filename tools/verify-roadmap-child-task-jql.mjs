/**
 * Guards Roadmap 「导入 Task」 against a stale dist/.
 *
 * Source can already omit `issuetype = Task` while the unpacked extension
 * still loads an older `dist/contentScriptRoadmap.js` that filters User
 * Stories out (NOVA-20213 under NOVA-19641).
 *
 * Usage: node tools/verify-roadmap-child-task-jql.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(repoRoot, 'src/contentScriptRoadmap.ts');
const jqlPath = path.join(repoRoot, 'src/roadmapChildTaskJql.ts');
const distPath = path.join(repoRoot, 'dist/contentScriptRoadmap.js');

const failures = [];

function check(label, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(label);
}

const TYPE_FILTER = /issuetype\s*=\s*Task/;
const STATUS_FILTER = 'status not in (Cancelled, Closed)';

const src = fs.readFileSync(srcPath, 'utf8');
const jqlSrc = fs.readFileSync(jqlPath, 'utf8');
const srcStart = src.indexOf('async function handleSearchChildTasks');
const srcEnd = src.indexOf('async function handleUpdateTargetDates', srcStart);
const srcFn = src.slice(srcStart, srcEnd);

check('source child search uses buildChildTaskSearchJql', srcFn.includes('buildChildTaskSearchJql('));
check('source child search has no issuetype = Task', !TYPE_FILTER.test(srcFn) && !TYPE_FILTER.test(jqlSrc));
check('child-task JQL still excludes Cancelled and Closed', jqlSrc.includes(STATUS_FILTER));

const distExists = fs.existsSync(distPath);
check('dist/contentScriptRoadmap.js exists', distExists, distPath);
if (distExists) {
  const dist = fs.readFileSync(distPath, 'utf8');
  check('dist has no issuetype = Task', !TYPE_FILTER.test(dist));
  check(
    'dist still excludes Cancelled and Closed',
    dist.includes(STATUS_FILTER),
  );
  check(
    'dist still queries Epic Link children',
    dist.includes('"Epic Link" in'),
  );
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

console.log('\nroadmap child-task JQL ok');
