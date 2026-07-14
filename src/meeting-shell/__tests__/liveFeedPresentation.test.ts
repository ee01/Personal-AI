import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMeetingPilotLiveFeedReceipt,
  buildMeetingPilotLiveFeedItems,
  getVisibleMeetingMemoryCueRefs,
  normalizeMeetingFeedTimestamp,
} from '../liveFeedPresentation.ts';
import {
  MeetingPilotMemoryRef,
  createMeetingPilotSessionSnapshot,
} from '../protocol.ts';

function memoryRef(
  partial: Partial<MeetingPilotMemoryRef>,
): MeetingPilotMemoryRef {
  return {
    id: partial.id || 'memory-1',
    title: partial.title || 'Memory',
    snippet: partial.snippet || 'Useful meeting context.',
    score: partial.score ?? 0.8,
    sourceLabel: partial.sourceLabel || 'memory-service',
    ...partial,
  };
}

test('getVisibleMeetingMemoryCueRefs filters hidden refs before limiting', () => {
  const refs = getVisibleMeetingMemoryCueRefs(
    [
      memoryRef({ id: 'hidden-first', displayPriority: 'hidden' }),
      memoryRef({ id: 'visible-1', displayPriority: 'p1', whyRelevant: ['项目：Falcon'] }),
      memoryRef({ id: 'visible-2', displayPriority: 'p2', evidenceRole: 'action_item' }),
      memoryRef({ id: 'visible-3', whyRelevant: ['主题：launch'] }),
      memoryRef({ id: 'visible-4' }),
    ],
    3,
  );

  assert.deepEqual(
    refs.map((ref) => ref.id),
    ['visible-1', 'visible-2', 'visible-3'],
  );
});

test('buildMeetingPilotLiveFeedItems omits promoted and hidden memories', () => {
  const promoted = memoryRef({
    id: 'promoted-memory',
    displayPriority: 'p1',
    whyRelevant: ['项目：Falcon'],
    matchedAt: Date.now(),
  });
  const hidden = memoryRef({
    id: 'hidden-memory',
    displayPriority: 'hidden',
    matchedAt: Date.now() + 1000,
  });
  const overflow = memoryRef({
    id: 'overflow-memory',
    displayPriority: 'p2',
    evidenceRole: 'decision',
    timestamp: 1_779_325_200,
  });
  const session = createMeetingPilotSessionSnapshot({
    meetingId: 'meeting-live-feed',
    tabId: 12,
    url: 'https://v.ringcentral.com/conf/on/meeting-live-feed',
    memoryRefs: [promoted, hidden, overflow],
    alerts: [
      {
        id: 'alert-1',
        level: 'P1',
        title: 'Mentioned',
        body: 'You were mentioned.',
        source: 'mention',
        createdAt: 1_779_325_100_000,
      },
      {
        id: 'alert-resolved',
        level: 'P2',
        title: 'Resolved',
        body: 'Already handled.',
        source: 'summary',
        createdAt: 1_779_325_300_000,
        resolved: true,
      },
      {
        id: 'alert-context-only',
        level: 'P2',
        title: '当前主讲人切换',
        body: 'Alex 正在主讲，当前对话上下文已刷新。',
        source: 'summary',
        createdAt: 1_779_325_400_000,
      },
    ],
  });

  const items = buildMeetingPilotLiveFeedItems(session, [promoted]);
  const receipt = buildMeetingPilotLiveFeedReceipt(session, [promoted]);

  assert.deepEqual(
    items.map((item) => `${item.kind}:${item.id}`),
    ['memory:overflow-memory', 'alert:alert-1'],
  );
  assert.equal(receipt.surfacedAlertCount, 1);
  assert.equal(receipt.filteredContextAlertCount, 1);
  assert.equal(receipt.promotedMemoryCount, 1);
  assert.equal(receipt.feedMemoryCount, 1);
  assert.equal(receipt.hiddenMemoryCount, 1);
  assert.match(receipt.summary, /显示 1 条可操作会中提醒/);
  assert.match(receipt.summary, /降噪 1 条纯上下文刷新/);
  assert.match(receipt.summary, /顶部已提升 1 条关联记忆/);
  assert.match(receipt.boundary, /当前页面可见切片/);
  assert.match(receipt.boundary, /不会标记提醒已处理/);
});

test('normalizeMeetingFeedTimestamp accepts seconds and milliseconds', () => {
  assert.equal(normalizeMeetingFeedTimestamp(1_779_325_200), 1_779_325_200_000);
  assert.equal(
    normalizeMeetingFeedTimestamp(1_779_325_200_000),
    1_779_325_200_000,
  );
  assert.equal(normalizeMeetingFeedTimestamp(undefined), 0);
});
