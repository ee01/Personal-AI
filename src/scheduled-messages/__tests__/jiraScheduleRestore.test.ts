import test from 'node:test';
import assert from 'node:assert/strict';

import { getJiraScheduleRestoreTiming } from '../jiraScheduleRestore.js';

function withTimezone<T>(timezone: string, callback: () => T): T {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = timezone;

  try {
    return callback();
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
}

test('Jira restore time uses the user local timezone instead of a fixed UTC+8 offset', () => {
  withTimezone('America/Los_Angeles', () => {
    const timing = getJiraScheduleRestoreTiming({
      Schedule_Date: '2026-05-04',
      Schedule_Time: '09:15',
    });

    assert.equal(timing.localDate, '2026-05-04');
    assert.equal(timing.localTime, '09:15');
    assert.match(timing.timezoneLabel, /America\/Los_Angeles/);
    assert.equal(timing.utcTime, '16:15');
  });
});

test('Jira restore time keeps UTC+8 users on the existing schedule semantics', () => {
  withTimezone('Asia/Shanghai', () => {
    const timing = getJiraScheduleRestoreTiming({
      Schedule_Date: '2026-05-04',
      Schedule_Time: '09:15',
    });

    assert.match(timing.timezoneLabel, /Asia\/Shanghai/);
    assert.equal(timing.utcTime, '01:15');
  });
});
