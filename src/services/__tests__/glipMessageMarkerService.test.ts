import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCompactSnoozeMarkerLabel,
  buildScheduledSnoozeMarkers,
  mergeMarkerIndexes,
  pruneGlipPendingScheduledMessages,
} from '../GlipMessageMarkerService.js';

test('buildScheduledSnoozeMarkers marks open Snooze reminders on the original Glip message', () => {
  const markersByChatId = buildScheduledSnoozeMarkers([
    {
      ID: 'snooze-1',
      Topic: '稍后处理: Release owner',
      Content:
        '📌 **您设置了一个稍后处理提醒**\n\n🔗 [点击查看原消息](https://app.ringcentral.com/messages/12345/post-99)',
      Schedule_Date: '2026-05-18',
      Schedule_Time: '09:00',
      Push_Method: 'Bot',
      Target_Type: 'private',
      Category: 'Snooze,提醒',
      Status: 'Active',
    },
    {
      ID: 'done-snooze',
      Topic: '稍后处理: Done',
      Content:
        '🔗 [点击查看原消息](https://app.ringcentral.com/messages/12345/post-done)',
      Push_Method: 'Bot',
      Target_Type: 'private',
      Category: 'Snooze,提醒',
      Status: 'Completed',
    },
  ]);

  const marker = markersByChatId['12345']?.['post-99']?.[0];
  assert.ok(marker);
  assert.equal(marker.type, 'snooze_pending');
  assert.match(marker.label, /^稍后 (?:\d{4}\/)?5\/18 09:00$/);
  assert.equal(marker.source, 'sheet');
  assert.equal(marker.sourceId, 'snooze-1');
  assert.match(marker.tooltip || '', /提醒时间：2026-05-18 09:00/);
  assert.equal(markersByChatId['12345']?.['post-done'], undefined);
});

test('buildCompactSnoozeMarkerLabel shows due time without requiring hover', () => {
  assert.equal(
    buildCompactSnoozeMarkerLabel(
      {
        Schedule_Date: '2026-05-18',
        Schedule_Time: '9:05:00',
      },
      new Date('2026-06-01T12:00:00+08:00'),
    ),
    '稍后 5/18 09:05',
  );

  assert.equal(
    buildCompactSnoozeMarkerLabel(
      {
        Schedule_Date: '2027-01-03',
        Schedule_Time: '18:00',
      },
      new Date('2026-06-01T12:00:00+08:00'),
    ),
    '稍后 2027/1/3 18:00',
  );

  assert.equal(
    buildCompactSnoozeMarkerLabel(
      {
        Schedule_Date: '',
        Schedule_Time: '',
      },
      new Date('2026-06-01T12:00:00+08:00'),
    ),
    '稍后处理',
  );
});

test('mergeMarkerIndexes prioritizes active outreach before pending Snooze on the same message', () => {
  const merged = mergeMarkerIndexes(
    {
      chat: {
        post: [
          {
            id: 'snooze',
            type: 'snooze_pending',
            label: '稍后处理',
            chatId: 'chat',
            postId: 'post',
            source: 'sheet',
            sourceId: 'snooze',
            updatedAt: 1,
          },
        ],
      },
    },
    {
      chat: {
        post: [
          {
            id: 'outreach',
            type: 'outreach_initial_ask',
            label: '跟进中',
            chatId: 'chat',
            postId: 'post',
            source: 'memory_service',
            sourceId: 'outreach',
            updatedAt: 2,
          },
        ],
      },
    },
  );

  assert.deepEqual(
    merged.chat.post.map((marker) => marker.type),
    ['outreach_initial_ask', 'snooze_pending'],
  );
});

test('pruneGlipPendingScheduledMessages keeps pending compose messages sorted by schedule time', () => {
  const pending = pruneGlipPendingScheduledMessages(
    {
      '12345': [
        {
          id: 'late',
          chatId: '12345',
          messageId: 'msg-late',
          content: 'later',
          scheduledAt: '2026-06-03T12:00:00.000Z',
          targetType: 'group',
          createdAt: 2,
          updatedAt: 2,
        },
        {
          id: 'early',
          chatId: '12345',
          messageId: 'msg-early',
          content: 'earlier',
          scheduledAt: '2026-06-03T11:00:00.000Z',
          targetType: 'group',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    },
    { now: Date.parse('2026-06-03T10:00:00.000Z') },
  );

  assert.deepEqual(
    pending?.['12345']?.map((message) => message.id),
    ['early', 'late'],
  );
});

test('pruneGlipPendingScheduledMessages removes messages that already have successful logs', () => {
  const pending = pruneGlipPendingScheduledMessages(
    {
      '12345': [
        {
          id: 'scheduled-message',
          chatId: '12345',
          messageId: 'row-1',
          content: 'queued',
          scheduledAt: '2026-06-03T11:00:00.000Z',
          targetType: 'group',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    },
    {
      deliveredScheduledMessageIds: ['row-1'],
      now: Date.parse('2026-06-03T10:00:00.000Z'),
    },
  );

  assert.equal(pending?.['12345'], undefined);
});
