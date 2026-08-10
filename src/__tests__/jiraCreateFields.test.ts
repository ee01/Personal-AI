/**
 * The exact `fields` payload Roadmap posts to `/rest/api/2/issue`.
 *
 * Jira rejects the whole create when a single field id is not on that issue
 * type's create screen, so *which* optional fields get included is the part
 * worth pinning down — and it cannot be exercised against production Jira.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildJiraCreateFields,
  JIRA_FIELD_EPIC_LINK,
  JIRA_FIELD_EPIC_NAME,
  JIRA_FIELD_FIX_VERSIONS,
  JIRA_FIELD_PARENT_LINK,
  JIRA_FIELD_QUARTER,
  JIRA_FIELD_TARGET_END,
  JIRA_FIELD_TARGET_START,
  type JiraFieldMeta,
  type JiraIssueTypeMeta,
} from '../jiraCreateMeta.js';

function field(fieldId: string, overrides: Partial<JiraFieldMeta> = {}): JiraFieldMeta {
  return {
    fieldId,
    name: fieldId,
    required: false,
    hasDefaultValue: false,
    ...overrides,
  };
}

function issueType(
  name: string,
  fieldIds: string[],
  overrides: Partial<JiraIssueTypeMeta> = {},
): JiraIssueTypeMeta {
  return {
    id: '1',
    name,
    subtask: false,
    fields: Object.fromEntries(fieldIds.map((id) => [id, field(id)])),
    ...overrides,
  };
}

const DATE_FIELDS = [JIRA_FIELD_TARGET_START, JIRA_FIELD_TARGET_END];

test('an Epic parent carries Epic Name, the Gantt dates and the quarter', () => {
  const epic = issueType('Epic', [...DATE_FIELDS]);
  epic.fields[JIRA_FIELD_EPIC_NAME] = field(JIRA_FIELD_EPIC_NAME, {
    name: 'Epic Name',
    required: true,
  });
  epic.fields[JIRA_FIELD_QUARTER] = field(JIRA_FIELD_QUARTER, {
    name: 'Target Delivery Quarter',
    schemaType: 'option',
    allowedValues: [{ id: '900', value: '2026-Q3' }],
  });

  assert.deepEqual(
    buildJiraCreateFields({
      projectKey: 'NOVA',
      typeName: 'Epic',
      typeMeta: epic,
      summary: '低端机首帧优化',
      targetStart: '2026-08-03',
      targetEnd: '2026-08-16',
      quarter: '2026-Q3',
    }),
    {
      project: { key: 'NOVA' },
      issuetype: { name: 'Epic' },
      summary: '低端机首帧优化',
      [JIRA_FIELD_EPIC_NAME]: '低端机首帧优化',
      [JIRA_FIELD_TARGET_START]: '2026-08-03',
      [JIRA_FIELD_TARGET_END]: '2026-08-16',
      [JIRA_FIELD_QUARTER]: { id: '900' },
    },
  );
});

test('a Task under an Epic links through Epic Link and gets no Epic Name', () => {
  const task = issueType('Task', [JIRA_FIELD_EPIC_LINK]);

  assert.deepEqual(
    buildJiraCreateFields({
      projectKey: 'NOVA',
      typeName: 'Task',
      typeMeta: task,
      summary: '首帧埋点',
      link: { mode: 'field', fieldId: JIRA_FIELD_EPIC_LINK, parentKey: 'NOVA-900' },
    }),
    {
      project: { key: 'NOVA' },
      issuetype: { name: 'Task' },
      summary: '首帧埋点',
      [JIRA_FIELD_EPIC_LINK]: 'NOVA-900',
    },
  );
});

test('an Epic under an Initiative links through Parent Link and still needs Epic Name', () => {
  const epic = issueType('Epic', [JIRA_FIELD_PARENT_LINK]);
  epic.fields[JIRA_FIELD_EPIC_NAME] = field(JIRA_FIELD_EPIC_NAME, {
    name: 'Epic Name',
    required: true,
  });

  assert.deepEqual(
    buildJiraCreateFields({
      projectKey: 'INIT',
      typeName: 'Epic',
      typeMeta: epic,
      summary: '播放器重构',
      link: { mode: 'field', fieldId: JIRA_FIELD_PARENT_LINK, parentKey: 'INIT-12' },
    }),
    {
      project: { key: 'INIT' },
      issuetype: { name: 'Epic' },
      summary: '播放器重构',
      [JIRA_FIELD_PARENT_LINK]: 'INIT-12',
      [JIRA_FIELD_EPIC_NAME]: '播放器重构',
    },
  );
});

test('a real sub-task hangs off fields.parent, whatever the type is called', () => {
  const subtask = issueType('子任务', [], { subtask: true });

  assert.deepEqual(
    buildJiraCreateFields({
      projectKey: 'NOVA',
      typeName: '子任务',
      typeMeta: subtask,
      summary: '补充用例',
      link: { mode: 'parent', parentKey: 'NOVA-42' },
    }),
    {
      project: { key: 'NOVA' },
      issuetype: { name: '子任务' },
      summary: '补充用例',
      parent: { key: 'NOVA-42' },
    },
  );
});

test('fields the create screen does not expose are left out', () => {
  // Target start/end and quarter are absent from this type's createmeta;
  // sending them anyway would make Jira reject the entire create.
  const task = issueType('Task', [JIRA_FIELD_EPIC_LINK]);

  const fields = buildJiraCreateFields({
    projectKey: 'NOVA',
    typeName: 'Task',
    typeMeta: task,
    summary: '首帧埋点',
    targetStart: '2026-08-03',
    targetEnd: '2026-08-16',
    quarter: '2026-Q3',
    link: { mode: 'field', fieldId: JIRA_FIELD_EPIC_LINK, parentKey: 'NOVA-900' },
  });

  assert.equal(JIRA_FIELD_TARGET_START in fields, false);
  assert.equal(JIRA_FIELD_TARGET_END in fields, false);
  assert.equal(JIRA_FIELD_QUARTER in fields, false);
});

test('a quarter the field cannot accept is dropped rather than sent raw', () => {
  const epic = issueType('Epic', []);
  epic.fields[JIRA_FIELD_QUARTER] = field(JIRA_FIELD_QUARTER, {
    name: 'Target Delivery Quarter',
    schemaType: 'option',
    allowedValues: [{ id: '900', value: '2026-Q4' }],
  });

  const fields = buildJiraCreateFields({
    projectKey: 'NOVA',
    typeName: 'Epic',
    typeMeta: epic,
    summary: '低端机首帧优化',
    quarter: '2026-Q3',
  });

  assert.equal(JIRA_FIELD_QUARTER in fields, false);
});

test('without createmeta only Epic Name is guessed, and only for an Epic', () => {
  assert.deepEqual(
    buildJiraCreateFields({
      projectKey: 'NOVA',
      typeName: 'Epic',
      typeMeta: null,
      summary: '盲建 Epic',
      targetStart: '2026-08-03',
      quarter: '2026-Q3',
    }),
    {
      project: { key: 'NOVA' },
      issuetype: { name: 'Epic' },
      summary: '盲建 Epic',
      [JIRA_FIELD_EPIC_NAME]: '盲建 Epic',
    },
  );

  assert.deepEqual(
    buildJiraCreateFields({
      projectKey: 'NOVA',
      typeName: 'Task',
      typeMeta: null,
      summary: '盲建 Task',
    }),
    {
      project: { key: 'NOVA' },
      issuetype: { name: 'Task' },
      summary: '盲建 Task',
    },
  );
});

test('fixVersions uses exact match against createmeta allowed values', () => {
  const task = issueType('Task', [...DATE_FIELDS, JIRA_FIELD_FIX_VERSIONS]);
  task.fields[JIRA_FIELD_FIX_VERSIONS] = field(JIRA_FIELD_FIX_VERSIONS, {
    name: 'Fix Version/s',
    schemaType: 'array',
    schemaItems: 'version',
    allowedValues: [
      { id: '100', name: '26.3.220' },
      { id: '101', name: '26.4.10' },
    ],
  });

  const fields = buildJiraCreateFields({
    projectKey: 'NOVA',
    typeName: 'Task',
    typeMeta: task,
    summary: '带版本的任务',
    fixVersion: '26.3.220',
  });

  assert.deepEqual(fields[JIRA_FIELD_FIX_VERSIONS], [{ id: '100' }]);
});

test('fixVersions unique suffix match covers release-sheet vs Jira name prefixes', () => {
  const task = issueType('Task', [JIRA_FIELD_FIX_VERSIONS]);
  task.fields[JIRA_FIELD_FIX_VERSIONS] = field(JIRA_FIELD_FIX_VERSIONS, {
    name: 'Fix Version/s',
    schemaType: 'array',
    schemaItems: 'version',
    allowedValues: [
      { id: '200', name: 'Nova 26.3.220' },
      { id: '201', name: 'Nova 26.4.10' },
    ],
  });

  const fields = buildJiraCreateFields({
    projectKey: 'NOVA',
    typeName: 'Task',
    typeMeta: task,
    summary: '后缀匹配',
    fixVersion: '26.3.220',
  });

  assert.deepEqual(fields[JIRA_FIELD_FIX_VERSIONS], [{ id: '200' }]);
});

test('fixVersions drops the field with a warning when the suffix match is ambiguous', () => {
  const task = issueType('Task', [JIRA_FIELD_FIX_VERSIONS]);
  task.fields[JIRA_FIELD_FIX_VERSIONS] = field(JIRA_FIELD_FIX_VERSIONS, {
    name: 'Fix Version/s',
    schemaType: 'array',
    schemaItems: 'version',
    allowedValues: [
      { id: '300', name: 'Nova 26.3.220' },
      { id: '301', name: 'Jupiter 26.3.220' },
    ],
  });
  const warnings: string[] = [];

  const fields = buildJiraCreateFields({
    projectKey: 'NOVA',
    typeName: 'Task',
    typeMeta: task,
    summary: '歧义版本',
    fixVersion: '26.3.220',
    warnings,
  });

  assert.equal(JIRA_FIELD_FIX_VERSIONS in fields, false);
  assert.match(warnings[0] || '', /多个 Jira 版本/);
});

test('fixVersions drops the field with a warning when nothing matches', () => {
  const task = issueType('Task', [JIRA_FIELD_FIX_VERSIONS]);
  task.fields[JIRA_FIELD_FIX_VERSIONS] = field(JIRA_FIELD_FIX_VERSIONS, {
    name: 'Fix Version/s',
    schemaType: 'array',
    schemaItems: 'version',
    allowedValues: [{ id: '400', name: 'Nova 26.4.10' }],
  });
  const warnings: string[] = [];

  const fields = buildJiraCreateFields({
    projectKey: 'NOVA',
    typeName: 'Task',
    typeMeta: task,
    summary: '无匹配',
    fixVersion: '26.3.220',
    warnings,
  });

  assert.equal(JIRA_FIELD_FIX_VERSIONS in fields, false);
  assert.match(warnings[0] || '', /找不到匹配版本/);
});
