import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addRecipientTag,
  applyQuickSchedule,
  buildNotifyPayload,
  buildRecurrenceSpec,
  hydrateTaskDraftFromTask,
  notifyTargetIncomplete,
  setDateDay,
  snapScheduleDateToWeekDays,
} from '../taskCenterSchedule.js';

test('private Bot/AsMe target stores Glip user names the same way as Scheduled Messages', () => {
  const added = addRecipientTag([], 'Esone Qiu');
  assert.deepEqual(added.tags, ['Esone Qiu']);
  const payload = buildNotifyPayload({
    notifyVia: 'bot',
    targetType: 'private',
    recipients: added.tags,
    glipTeamId: '',
  });
  assert.deepEqual(payload.notifyTarget, {
    type: 'private',
    targetUserId: 'esone.qiu',
    glipUserName: 'esone.qiu',
    glipUser: 'esone.qiu',
  });
});

test('group target requires a team id and does not use the leftover Glip 群组 channel', () => {
  const payload = buildNotifyPayload({
    notifyVia: 'asme',
    targetType: 'group',
    recipients: [],
    glipTeamId: '164506140678',
  });
  assert.equal(payload.notifyVia, 'asme');
  assert.deepEqual(payload.notifyTarget, {
    type: 'group',
    targetGroupId: '164506140678',
    glipTeamId: '164506140678',
  });
  assert.equal(
    notifyTargetIncomplete({
      notifyVia: 'asme',
      targetType: 'group',
      recipients: [],
      glipTeamId: '',
    }),
    true,
  );
});

test('weekly recurrence writes Repeat_Days as 0=Sunday..6=Saturday', () => {
  const spec = buildRecurrenceSpec({
    repeating: true,
    repeatEvery: 1,
    repeatUnit: 'Week',
    scheduleDate: '2026-09-07',
    scheduleTime: '09:00',
    weekDays: [1, 3, 5],
    endDate: '2026-12-31',
    repeatCount: 8,
  });
  assert.equal(spec?.repeatDays, '1,3,5');
  assert.equal(spec?.endDate, '2026-12-31');
  assert.equal(spec?.repeatCount, 8);
});

test('monthly 几号 is encoded on the schedule date, matching Scheduled Messages', () => {
  assert.equal(setDateDay('2026-09-04', 15), '2026-09-15');
  const spec = buildRecurrenceSpec({
    repeating: true,
    repeatEvery: 1,
    repeatUnit: 'Month',
    scheduleDate: '2026-09-15',
    scheduleTime: '17:32',
    weekDays: [],
    endDate: '',
    repeatCount: '',
  });
  assert.equal(spec?.scheduleDate, '2026-09-15');
  assert.equal(spec?.repeatUnit, 'Month');
});

test('weekday chips snap the schedule date forward to the next selected day', () => {
  assert.equal(snapScheduleDateToWeekDays('2026-09-04', [1]), '2026-09-07');
});

test('quick 1-minute reschedule matches Scheduled Messages', () => {
  const now = new Date(2026, 8, 4, 17, 32, 20);
  const next = applyQuickSchedule('one-minute', now);
  assert.equal(next.scheduleDate, '2026-09-04');
  assert.equal(next.scheduleTime, '17:33');
});

test('hydrateTaskDraftFromTask reuses create-dialog fields from a stored task', () => {
  const draft = hydrateTaskDraftFromTask(
    {
      title: '每天检查 bug',
      taskKind: 'push',
      lane: 'memory_cron',
      scheduledAt: Math.floor(new Date(2026, 8, 7, 9, 0).getTime() / 1000),
      recurrenceSpec: {
        repeatEvery: 1,
        repeatUnit: 'Week',
        repeatDays: '1,3,5',
        scheduleDate: '2026-09-07',
        scheduleTime: '09:00',
        endDate: '2026-12-31',
      },
      params: {
        content: 'assignee is EMPTY',
        pushMethod: 'message',
        notifyVia: 'bot',
        notifyTarget: { type: 'private', glipUserName: 'esone.qiu', targetUserId: 'esone.qiu' },
        metadata: {
          notifyVia: 'bot',
          notifyTarget: { type: 'private', glipUserName: 'esone.qiu', targetUserId: 'esone.qiu' },
        },
      },
    },
    { botConfigured: true, asmeConfigured: false },
  );
  assert.equal(draft.taskKind, 'push');
  assert.equal(draft.title, '每天检查 bug');
  assert.equal(draft.content, 'assignee is EMPTY');
  assert.equal(draft.notifyVia, 'bot');
  assert.equal(draft.targetType, 'private');
  assert.deepEqual(draft.recipients, ['Esone Qiu']);
  assert.equal(draft.repeating, true);
  assert.equal(draft.repeatUnit, 'Week');
  assert.deepEqual(draft.weekDays, [1, 3, 5]);
  assert.equal(draft.scheduleDate, '2026-09-07');
  assert.equal(draft.endDate, '2026-12-31');
});
