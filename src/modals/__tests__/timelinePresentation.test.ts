import test from 'node:test';
import assert from 'node:assert/strict';

import { mapRecallItemsToTimelineEvents } from '../timelinePresentation.js';
import type { RecallItem } from '../../services/MemoryServiceClient.js';

test('timeline events expose persisted recall feedback state', () => {
  const [event] = mapRecallItemsToTimelineEvents([
    {
      id: 'message-1',
      type: 'message',
      content: 'A remembered decision.',
      score: 0.8,
      metadata: {
        channels: ['time'],
        recallFeedback: 'negative',
      },
    } as RecallItem,
  ]);

  assert.equal(event.resultKey, 'message:message-1');
  assert.equal(event.feedbackAction, 'negative');
});

test('timeline events ignore invalid recall feedback metadata', () => {
  const [event] = mapRecallItemsToTimelineEvents([
    {
      id: 'message-2',
      type: 'message',
      content: 'Another remembered decision.',
      score: 0.8,
      metadata: {
        recallFeedback: 'clear',
      },
    } as RecallItem,
  ]);

  assert.equal(event.feedbackAction, undefined);
});
