import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateScheduledMessageNextExecution,
  getDefaultScheduleTime,
  getDefaultScheduleTimeLabel,
  getEmptyScheduleTimeHint,
} from '../scheduleNextExecution.js';

test('calculates one-time AsMe execution with the 09:00 default', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-05-03',
        Schedule_Time: '',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-03 09:00',
  );
});

test('calculates executor-driven one-time execution with the 08:00 default', () => {
  assert.equal(getDefaultScheduleTime({ Push_Method: 'Bot' }), '08:00');
  assert.equal(getDefaultScheduleTimeLabel({ Push_Method: 'Bot' }), '08:00 后');
  assert.equal(
    getEmptyScheduleTimeHint({ Push_Method: 'Bot' }),
    '留空则 08:00 后进入队列，每分钟执行一条。',
  );
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-05-03',
        Push_Method: 'Bot',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-03 08:00',
  );
});

test('describes AsMe empty schedule time with the 09:00 default', () => {
  assert.equal(getDefaultScheduleTime({ Push_Method: 'AsMe' }), '09:00');
  assert.equal(getDefaultScheduleTimeLabel({ Push_Method: 'AsMe' }), '09:00');
  assert.equal(
    getEmptyScheduleTimeHint({ Push_Method: 'AsMe' }),
    '留空则 09:00 左右推送。',
  );
});

test('only managed JiraAutomation API messages use the 08:00 executor queue default', () => {
  assert.equal(getDefaultScheduleTime({ Push_Method: 'JiraAutomation' }), '09:00');
  assert.equal(getDefaultScheduleTimeLabel({ Push_Method: 'JiraAutomation' }), '09:00');
  assert.equal(
    getEmptyScheduleTimeHint({ Push_Method: 'JiraAutomation' }),
    '留空则 09:00 左右推送。',
  );
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-05-03',
        Push_Method: 'JiraAutomation',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-03 09:00',
  );

  assert.equal(
    getDefaultScheduleTime({
      Push_Method: 'JiraAutomation',
      AI_Endpoint: 'POST https://example.com/report',
    }),
    '08:00',
  );
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-05-03',
        Push_Method: 'JiraAutomation',
        AI_Endpoint: 'POST https://example.com/report',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-03 08:00',
  );
});

test('keeps the configured time when calculating periodic next execution', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-04-29',
        Schedule_Time: '7:05',
        Repeat_Every: 1,
        Repeat_Unit: 'Day',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-04 07:05',
  );
});

test('rejects invalid schedule times instead of rolling them into another day', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-05-03',
        Schedule_Time: '25:00',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '',
  );

  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-05-03',
        Schedule_Time: '09:60',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '',
  );
});

test('uses Repeat_Days for the next weekly occurrence', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-04-27',
        Schedule_Time: '09:30',
        Repeat_Every: 1,
        Repeat_Unit: 'Week',
        Repeat_Days: '1,3,5',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-04 09:30',
  );
});

test('skips today for weekly Repeat_Days when the scheduled time already passed', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-04-27',
        Schedule_Time: '09:30',
        Repeat_Every: 1,
        Repeat_Unit: 'Week',
        Repeat_Days: '1,3,5',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 4, 10, 0),
    ),
    '2026-05-06 09:30',
  );
});

test('keeps today for weekly Repeat_Days when the scheduled time is still future', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-04-27',
        Schedule_Time: '09:30',
        Repeat_Every: 1,
        Repeat_Unit: 'Week',
        Repeat_Days: '1,3,5',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 4, 8, 0),
    ),
    '2026-05-04 09:30',
  );
});

test('honors every-N-weeks when Repeat_Days is present', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-04-27',
        Schedule_Time: '09:30',
        Repeat_Every: 2,
        Repeat_Unit: 'Week',
        Repeat_Days: '1,3,5',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 2, 12, 0),
    ),
    '2026-05-11 09:30',
  );
});

test('honors every-N-weeks after the selected time passes on a valid day', () => {
  assert.equal(
    calculateScheduledMessageNextExecution(
      {
        Schedule_Date: '2026-04-27',
        Schedule_Time: '09:30',
        Repeat_Every: 2,
        Repeat_Unit: 'Week',
        Repeat_Days: '1,3,5',
        Push_Method: 'AsMe',
      },
      new Date(2026, 4, 11, 10, 0),
    ),
    '2026-05-13 09:30',
  );
});
