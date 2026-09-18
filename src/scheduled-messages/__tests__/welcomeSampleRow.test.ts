import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGES_SCHEMA,
  buildWelcomeSampleRow,
  columnIndexToName,
} from '../SheetInitializer';
import {
  formatLocalScheduleDate,
  formatLocalScheduleTime,
} from '../scheduleDateTime';

test('welcome demo row follows MESSAGES_SCHEMA so Next_Exec is not written into Agent_Executor', () => {
  const now = new Date('2026-09-18T02:16:00+08:00');
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);
  const row = buildWelcomeSampleRow(now);
  const byName = Object.fromEntries(
    MESSAGES_SCHEMA.columns.map((column, index) => [column, row[index]]),
  );

  assert.equal(row.length, MESSAGES_SCHEMA.columns.length);
  assert.equal(byName.Agent_Executor, '');
  assert.equal(byName.Agent_Task_ID, '');
  assert.equal(byName.Status, 'Active');
  assert.equal(byName.Last_Exec, '');
  assert.equal(
    byName.Next_Exec,
    `${formatLocalScheduleDate(oneMinuteLater)} ${formatLocalScheduleTime(oneMinuteLater)}`,
  );
  assert.equal(byName.Exec_Count, 0);
  assert.equal(byName.Exec_Log, '待执行');
  assert.equal(byName.Push_Method, 'AsMe');
  assert.match(String(byName.ID), /^msg_welcome_/);
});

test('welcome demo A1 range covers every Messages schema column', () => {
  assert.equal(columnIndexToName(MESSAGES_SCHEMA.columns.length), 'AN');
  assert.notEqual(
    columnIndexToName(MESSAGES_SCHEMA.columns.length),
    'AA',
    'AA is the pre-AgentTask sample width and would truncate Agent_* / runtime columns',
  );
});
