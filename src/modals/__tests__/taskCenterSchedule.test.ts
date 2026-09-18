import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addRecipientTag,
  applyQuickSchedule,
  buildNotifyPayload,
  buildRecurrenceSpec,
  cloudLaneAllowsPluginNotify,
  hydrateTaskDraftFromTask,
  isTimelineRecurrenceSpec,
  notifyTargetIncomplete,
  recurrenceLabelFromSpec,
  resolveNotifyViaForLane,
  setDateDay,
  snapScheduleDateToWeekDays,
  taskKindSupportsTimelineTrigger,
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

test('hydrateTaskDraftFromTask keeps plan gate and dependency ids for a dev task', () => {
  const draft = hydrateTaskDraftFromTask(
    {
      title: 'lease 心跳',
      taskKind: 'dev',
      lane: 'memory_cron',
      dependsOn: ['task-a'],
      parentActionId: 'task-parent',
      params: { acceptance: 'lease 续上', planGate: true },
    },
    { botConfigured: false, asmeConfigured: false },
  );
  assert.equal(draft.taskKind, 'dev');
  assert.equal(draft.planGate, true);
  assert.deepEqual(draft.dependsOnIds, ['task-a']);
  assert.equal(draft.parentActionId, 'task-parent');
  assert.equal(draft.acceptance, 'lease 续上');
});

test('timeline recurrence writes trigger fields and not calendar Repeat_Every', () => {
  const spec = buildRecurrenceSpec({
    trigger: 'timeline',
    repeating: false,
    repeatEvery: 1,
    repeatUnit: 'Week',
    scheduleDate: '2026-09-11',
    scheduleTime: '09:00',
    weekDays: [],
    endDate: '',
    repeatCount: '',
    timelineProject: 'mThor',
    timelineMilestone: 'FF',
    timelineOffset: -1,
  });
  assert.equal(spec?.trigger, 'timeline');
  assert.equal(spec?.timelineProject, 'mThor');
  assert.equal(spec?.timelineMilestone, 'FF');
  assert.equal(spec?.timelineOffset, -1);
  assert.equal(spec?.scheduleTime, '09:00');
  assert.equal(spec?.repeatEvery, undefined);
  assert.equal(isTimelineRecurrenceSpec(spec), true);
  assert.match(recurrenceLabelFromSpec(spec), /每个版本/);
  assert.match(recurrenceLabelFromSpec(spec), /FF/);
  assert.match(recurrenceLabelFromSpec(spec), /前1天/);
});

test('hydrateTaskDraftFromTask restores Timeline trigger from recurrenceSpec', () => {
  const draft = hydrateTaskDraftFromTask(
    {
      title: 'FF 前提醒',
      taskKind: 'push',
      lane: 'jira_sheet',
      recurrenceSpec: {
        trigger: 'timeline',
        timelineProject: 'Nova',
        timelineMilestone: 'FF',
        timelineOffset: 0,
        scheduleTime: '10:30',
      },
      params: { content: '扫 bug', pushMethod: 'message' },
    },
    { botConfigured: true, asmeConfigured: false },
  );
  assert.equal(draft.trigger, 'timeline');
  assert.equal(draft.timelineProject, 'Nova');
  assert.equal(draft.timelineMilestone, 'FF');
  assert.equal(draft.timelineOffset, 0);
  assert.equal(draft.scheduleTime, '10:30');
  assert.equal(draft.repeating, false);
  assert.equal(draft.scheduleDate, '');
});

test('Agent 任务 and 定时推送 support Timeline; 提醒我不支持', () => {
  assert.equal(taskKindSupportsTimelineTrigger('push'), true);
  assert.equal(taskKindSupportsTimelineTrigger('agent'), true);
  assert.equal(taskKindSupportsTimelineTrigger('remind'), false);
  assert.equal(taskKindSupportsTimelineTrigger('dev'), false);
  assert.equal(taskKindSupportsTimelineTrigger('outreach'), false);
});

test('hydrates Agent Timeline tasks the same way as push Timeline', () => {
  const draft = hydrateTaskDraftFromTask(
    {
      title: 'FF 当天扫 Nova',
      taskKind: 'agent',
      lane: 'jira_sheet',
      recurrenceSpec: {
        trigger: 'timeline',
        timelineProject: 'Nova',
        timelineMilestone: 'FF',
        timelineOffset: -1,
        scheduleTime: '08:00',
      },
      params: { content: '查无 assignee', mode: 'read' },
    },
    { botConfigured: true, asmeConfigured: false },
  );
  assert.equal(draft.taskKind, 'agent');
  assert.equal(draft.trigger, 'timeline');
  assert.equal(draft.timelineProject, 'Nova');
  assert.equal(draft.timelineMilestone, 'FF');
  assert.equal(draft.timelineOffset, -1);
  assert.equal(draft.scheduleTime, '08:00');
  assert.equal(draft.repeating, false);
});

test('cloud jira_sheet lane cannot use Chrome plugin notifications', () => {
  assert.equal(cloudLaneAllowsPluginNotify('memory_cron'), true);
  assert.equal(cloudLaneAllowsPluginNotify('jira_sheet'), false);
  assert.equal(
    resolveNotifyViaForLane({
      lane: 'jira_sheet',
      notifyVia: 'plugin',
      botAvailable: true,
      asmeAvailable: false,
    }),
    'bot',
  );
  assert.equal(
    resolveNotifyViaForLane({
      lane: 'jira_sheet',
      notifyVia: 'plugin',
      botAvailable: false,
      asmeAvailable: true,
    }),
    'asme',
  );
  assert.equal(
    resolveNotifyViaForLane({
      lane: 'jira_sheet',
      notifyVia: 'plugin',
      botAvailable: false,
      asmeAvailable: false,
    }),
    'bot',
  );
  assert.equal(
    resolveNotifyViaForLane({
      lane: 'memory_cron',
      notifyVia: 'plugin',
      botAvailable: false,
      asmeAvailable: false,
    }),
    'plugin',
  );
  assert.equal(
    resolveNotifyViaForLane({
      lane: 'jira_sheet',
      notifyVia: 'asme',
      botAvailable: true,
      asmeAvailable: true,
    }),
    'asme',
  );
});

test('hydrateTaskDraftFromTask coerces leftover plugin + jira_sheet rows onto Bot', () => {
  const draft = hydrateTaskDraftFromTask(
    {
      title: '☁️ 任务中心镜像冒烟',
      taskKind: 'push',
      lane: 'jira_sheet',
      params: { content: 'do not send', notifyVia: 'plugin' },
    },
    { botConfigured: false, asmeConfigured: false },
  );
  assert.equal(draft.lane, 'jira_sheet');
  assert.equal(draft.notifyVia, 'bot');
});
