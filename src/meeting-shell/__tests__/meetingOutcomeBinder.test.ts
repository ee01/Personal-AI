import test from 'node:test';
import assert from 'node:assert/strict';

import type { MeetingOutcomeBinder } from '../../services/MemoryServiceClient.ts';
import {
  getMeetingOutcomeLiveSlots,
  selectMeetingOutcomeBinderFromStorage,
} from '../meetingOutcomeBinder.ts';
import { createMeetingPilotSessionSnapshot } from '../protocol.ts';

function createBinder(id = 'binder-q3'): MeetingOutcomeBinder {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    id,
    userId: 'test',
    prepId: `prep-${id}`,
    eventExternalId: 'event-q3',
    eventSeriesKey: 'series-q3',
    eventTitle: '2026 Q3 planning for video mobile',
    eventStartAt: timestamp,
    status: 'planned',
    slots: [
      {
        id: 'slot-estimate',
        title: '确认 mobile QA estimate 估时口径',
        type: 'decision',
        status: 'planned',
        mentionState: 'not_seen',
        sourceEvidenceIds: ['calendar:event-q3'],
        evidence: [],
        confidence: 0.82,
      },
    ],
    sourceEvidence: [],
    sourceHash: 'source-q3',
    generatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    receipt: {
      source: 'Today Pilot 会前准备',
      coverage: '本场要闭环 1 项。',
      freshness: '刚刚更新',
      boundary: '只读派生结果，不写回外部系统。',
    },
  };
}

test('transcript mention stays mentioned instead of becoming resolved', () => {
  const session = createMeetingPilotSessionSnapshot({
    meetingId: '123456',
    tabId: 12,
    url: 'https://v.ringcentral.com/conf/on/123456',
    title: '2026 Q3 planning for video mobile',
    transcript: [
      {
        id: 'chunk-1',
        speaker: 'Esone',
        text: 'mobile QA estimate 估时口径今天要讨论。',
        ts: Date.now(),
      },
    ],
  });

  const [slot] = getMeetingOutcomeLiveSlots(createBinder(), session);

  assert.equal(slot.state, 'mentioned');
  assert.equal(slot.label, '已提到');
  assert.match(slot.detail, /不能视为已解决/);
});

test('matching action item is shown only as a post-meeting evidence candidate', () => {
  const session = createMeetingPilotSessionSnapshot({
    meetingId: '123456',
    tabId: 12,
    url: 'https://v.ringcentral.com/conf/on/123456',
    title: '2026 Q3 planning for video mobile',
    actionItems: [
      {
        id: 'action-1',
        title: '补齐 mobile QA estimate 估时口径',
        owner: 'Alex',
        status: 'pending',
      },
    ],
  });

  const [slot] = getMeetingOutcomeLiveSlots(createBinder(), session);

  assert.equal(slot.state, 'evidence_candidate');
  assert.equal(slot.label, '待会后核验');
});

test('archive selects the handoff whose RingCentral meeting id matches', () => {
  const session = createMeetingPilotSessionSnapshot({
    meetingId: '123456',
    tabId: 12,
    url: 'https://v.ringcentral.com/conf/on/123456',
    title: 'Archive title may already be rewritten',
  });
  const expected = createBinder('binder-matching');
  const selected = selectMeetingOutcomeBinderFromStorage(
    {
      meetingPrepHandoff: {
        createdAt: Date.now() - 1000,
        event: {
          title: 'Unrelated meeting',
          joinUrl: 'https://v.ringcentral.com/conf/on/999999',
        },
        outcomeBinder: createBinder('binder-unrelated'),
      },
      meetingPrepHandoffs: {
        matching: {
          createdAt: Date.now() - 2000,
          event: {
            title: '2026 Q3 planning for video mobile',
            joinUrl: 'https://v.ringcentral.com/conf/on/123456',
          },
          outcomeBinder: expected,
        },
      },
    },
    session,
  );

  assert.equal(selected?.id, expected.id);
});
