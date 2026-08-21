import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDoneScheduleReactivation,
  shouldReactivateDoneMessageAfterScheduleChange,
} from '../scheduleStatusReactivation.js';
import type { ScheduledMessage } from '../types';

function createDoneOneTimeMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    ID: 'MSG-1',
    Topic: 'One-time message',
    Content: 'content',
    Schedule_Date: '2026-05-18',
    Schedule_Time: '09:00',
    Push_Method: 'AsMe',
    Target_Type: 'private',
    Status: 'Done',
    Last_Exec: '2026-05-18 09:00',
    Exec_Count: 1,
    Exec_Log: '✅ 推送成功',
    ...overrides,
  };
}

test('reactivates a Done one-time message when its schedule changes to the future', () => {
  const previousMessage = createDoneOneTimeMessage();
  const updatedMessage = {
    ...previousMessage,
    Schedule_Date: '2026-05-20',
    Schedule_Time: '10:30',
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      {
        Schedule_Date: '2026-05-20',
        Schedule_Time: '10:30',
      },
      new Date(2026, 4, 19, 9, 0),
    ),
    true,
  );
});

test('reactivates a Done one-time message that is converted into a repeating series', () => {
  const previousMessage = createDoneOneTimeMessage();
  const updatedMessage = {
    ...previousMessage,
    Repeat_Every: 1,
    Repeat_Unit: 'Week' as const,
    Repeat_Days: '1,3,5',
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      {
        Repeat_Every: 1,
        Repeat_Unit: 'Week',
        Repeat_Days: '1,3,5',
      },
      new Date(2026, 4, 19, 9, 0),
    ),
    true,
  );

  applyDoneScheduleReactivation(previousMessage, updatedMessage);
  assert.equal(updatedMessage.Status, 'Active');
  assert.equal(updatedMessage.Last_Exec, '');
  assert.equal(updatedMessage.Exec_Count, 0);
  assert.equal(updatedMessage.Exec_Log, '待执行');
});

test('does not reactivate a Done message when only non-schedule fields change', () => {
  const previousMessage = createDoneOneTimeMessage({
    Schedule_Date: '2026-05-20',
    Schedule_Time: '10:30',
  });
  const updatedMessage = {
    ...previousMessage,
    Content: 'updated content',
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      { Content: 'updated content' },
      new Date(2026, 4, 19, 9, 0),
    ),
    false,
  );
});

test('does not reactivate a repeating Done message whose Repeat_Count is already exhausted', () => {
  const previousMessage = createDoneOneTimeMessage({
    Repeat_Every: 1,
    Repeat_Unit: 'Week',
    Repeat_Count: 1,
    Exec_Count: 1,
  });
  const updatedMessage = {
    ...previousMessage,
    Schedule_Date: '2026-05-20',
    Schedule_Time: '10:30',
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      {
        Schedule_Date: '2026-05-20',
        Schedule_Time: '10:30',
      },
      new Date(2026, 4, 19, 9, 0),
    ),
    false,
  );
});

test('reactivates a repeating Done message when Repeat_Count is raised so a next run exists', () => {
  const previousMessage = createDoneOneTimeMessage({
    Repeat_Every: 1,
    Repeat_Unit: 'Week',
    Repeat_Count: 1,
    Exec_Count: 1,
  });
  const updatedMessage = {
    ...previousMessage,
    Repeat_Count: 4,
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      { Repeat_Count: 4 },
      new Date(2026, 4, 19, 9, 0),
    ),
    true,
  );
});

test('does not override explicit status updates', () => {
  const previousMessage = createDoneOneTimeMessage();
  const updatedMessage = {
    ...previousMessage,
    Schedule_Date: '2026-05-20',
    Status: 'Done' as const,
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      {
        Schedule_Date: '2026-05-20',
        Status: 'Done',
      },
      new Date(2026, 4, 19, 9, 0),
    ),
    false,
  );
});

test('detects implicit default time changes that move a Done message into the future', () => {
  const previousMessage = createDoneOneTimeMessage({
    Schedule_Date: '2026-05-19',
    Schedule_Time: '',
    Push_Method: 'Bot',
  });
  const updatedMessage = {
    ...previousMessage,
    Push_Method: 'AsMe' as const,
  };

  assert.equal(
    shouldReactivateDoneMessageAfterScheduleChange(
      previousMessage,
      updatedMessage,
      { Push_Method: 'AsMe' },
      new Date(2026, 4, 19, 8, 30),
    ),
    true,
  );
});
