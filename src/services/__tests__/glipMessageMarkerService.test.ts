import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScheduledSnoozeMarkers,
  mergeMarkerIndexes,
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
  assert.equal(marker.label, '稍后处理');
  assert.equal(marker.source, 'sheet');
  assert.equal(marker.sourceId, 'snooze-1');
  assert.match(marker.tooltip || '', /提醒时间：2026-05-18 09:00/);
  assert.equal(markersByChatId['12345']?.['post-done'], undefined);
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
