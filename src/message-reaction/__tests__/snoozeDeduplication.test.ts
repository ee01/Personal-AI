import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../../scheduled-messages/types.js';
import {
  findOpenSnoozeReminderForMessage,
  getSnoozeReminderSourceKey,
  isOpenSnoozeReminder,
  isOpenSnoozeReminderForMessage,
} from '../snoozeDeduplication.js';

const sourceLink = 'https://app.ringcentral.com/messages/123/456';

function makeMessage(
  overrides: Partial<ScheduledMessage> = {},
): ScheduledMessage {
  return {
    ID: 'msg-1',
    Topic: '稍后处理: Project update',
    Content: `source\n\n🔗 [点击查看原消息](${sourceLink})`,
    Push_Method: 'Bot',
    Target_Type: 'private',
    Status: 'Active',
    Category: 'Snooze,提醒',
    ...overrides,
  };
}

test('matches open Snooze reminders by source message link', () => {
  assert.equal(
    isOpenSnoozeReminderForMessage(makeMessage(), {
      messageLink: sourceLink,
    }),
    true,
  );
});

test('does not match completed Snooze reminders', () => {
  assert.equal(
    isOpenSnoozeReminderForMessage(makeMessage({ Status: 'Done' }), {
      messageLink: sourceLink,
    }),
    false,
  );
  assert.equal(
    isOpenSnoozeReminderForMessage(makeMessage({ Status: 'Completed' }), {
      messageLink: sourceLink,
    }),
    false,
  );
});

test('identifies open Snooze reminders for safe post-create actions', () => {
  assert.equal(isOpenSnoozeReminder(makeMessage()), true);
  assert.equal(isOpenSnoozeReminder(makeMessage({ Status: 'Done' })), false);
  assert.equal(
    isOpenSnoozeReminder(makeMessage({ Category: 'AutoReply' })),
    false,
  );
});

test('does not match non-Snooze messages or other source links', () => {
  assert.equal(
    isOpenSnoozeReminderForMessage(makeMessage({ Category: 'AutoReply' }), {
      messageLink: sourceLink,
    }),
    false,
  );
  assert.equal(
    isOpenSnoozeReminderForMessage(makeMessage(), {
      messageLink: 'https://app.ringcentral.com/messages/123/999',
    }),
    false,
  );
});

test('finds the first open reminder and ignores closed duplicates', () => {
  const openReminder = makeMessage({ ID: 'open' });
  assert.equal(
    findOpenSnoozeReminderForMessage(
      [
        makeMessage({ ID: 'done', Status: 'Done' }),
        openReminder,
        makeMessage({ ID: 'other', Content: 'different link' }),
      ],
      { messageLink: sourceLink },
    )?.ID,
    'open',
  );
});

test('builds a stable source key from message link or RingCentral ids', () => {
  assert.equal(
    getSnoozeReminderSourceKey({
      id: '456',
      groupId: '123',
      messageLink: ` ${sourceLink} `,
    }),
    sourceLink,
  );

  assert.equal(
    getSnoozeReminderSourceKey({
      id: '456',
      groupId: '123',
      messageLink: '',
    }),
    '123:456',
  );
});
