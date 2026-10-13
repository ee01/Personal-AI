/**
 * Guards Roadmap 「导入 Task」 JQL.
 *
 * NOVA-20213 is a User Story whose Epic Link is NOVA-19641. Filtering with
 * `issuetype = Task` dropped it (and QA sub-tasks) before the import request
 * was ever sent. Closed children such as NOVA-20077 must still be excluded.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JIRA_FIELD_PARENT_LINK } from '../jiraCreateMeta.js';
import { buildChildTaskSearchJql } from '../roadmapChildTaskJql.js';

const srcPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../contentScriptRoadmap.ts',
);
const src = fs.readFileSync(srcPath, 'utf8');

function childSearchBody(): string {
  const start = src.indexOf('async function handleSearchChildTasks');
  const next = src.indexOf('async function handleUpdateTargetDates', start);
  return src.slice(start, next);
}

test('Epic Link search keeps every issue type and drops Cancelled and Closed', () => {
  const jql = buildChildTaskSearchJql(null, ['NOVA-19641']);

  assert.equal(
    jql,
    '"Epic Link" in ("NOVA-19641") AND status not in (Cancelled, Closed) ORDER BY key ASC',
  );
  assert.equal(/issuetype\s*=/.test(jql), false);
  assert.match(jql, /status not in \(Cancelled, Closed\)/);
});

test('Parent Link and parent clauses stay type-agnostic', () => {
  assert.equal(
    buildChildTaskSearchJql(JIRA_FIELD_PARENT_LINK, ['NOVA-1']),
    '"Parent Link" in ("NOVA-1") AND status not in (Cancelled, Closed) ORDER BY key ASC',
  );
  assert.equal(
    buildChildTaskSearchJql('parent', ['NOVA-1', 'NOVA-2']),
    'parent in ("NOVA-1", "NOVA-2") AND status not in (Cancelled, Closed) ORDER BY key ASC',
  );
});

test('quotes inside an epic key are escaped', () => {
  const jql = buildChildTaskSearchJql(null, ['NOVA-"1']);
  assert.match(jql, /"Epic Link" in \("NOVA-\\"1"\)/);
});

test('the content script builds child search through the shared helper', () => {
  const body = childSearchBody();
  assert.match(body, /buildChildTaskSearchJql\(linkField, group\)/);
  assert.equal(/issuetype\s*=\s*Task/.test(body), false);
});
