import test from 'node:test';
import assert from 'node:assert/strict';

// Provide minimal chrome / browser globals before importing background.ts so
// module-level code does not crash. background.ts only references chrome
// inside functions, so a minimal stub is enough.
const chromeStub = {
  runtime: {
    getURL: (path: string) => `chrome-extension://test/${path}`,
    onMessage: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    sendMessage: () => Promise.resolve(),
  },
  tabs: {
    onUpdated: { addListener: () => {} },
    onRemoved: { addListener: () => {} },
    sendMessage: () => Promise.resolve(),
    query: () => Promise.resolve([]),
  },
  action: {
    setBadgeText: () => Promise.resolve(),
    setBadgeBackgroundColor: () => Promise.resolve(),
    setTitle: () => Promise.resolve(),
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    },
  },
  offscreen: undefined,
} as any;
(globalThis as any).chrome = chromeStub;

// Heavy ingestion deps (memory-service client, env config) are loaded by
// background.ts. We only call buildMeetingIngestPayloads which doesn't need
// network, so importing is fine as long as chrome is stubbed.
import {
  buildFallbackMeetingArchiveTitle,
  buildMeetingIngestPayloads,
  shouldGenerateMeetingArchiveTitle,
} from '../background';
import { renameParticipant } from '../participantOps';
import {
  MeetingPilotParticipant,
  MeetingPilotSessionSnapshot,
} from '../protocol';

function makeSession(): MeetingPilotSessionSnapshot {
  const participants: MeetingPilotParticipant[] = [
    {
      id: 'p1',
      name: '说话人 1',
      role: 'Participant',
      speakingPct: 50,
      resolutionState: 'provisional',
      stances: [
        {
          topic: 'release date',
          stance: '支持',
          keyQuote: 'we should ship Friday',
        },
      ],
    },
  ];
  return {
    meetingId: 'meeting-int-1',
    tabId: 7,
    url: 'https://example.com/meeting/123',
    title: 'Integration Meeting',
    status: 'recording',
    inMeeting: true,
    shareState: 'unknown',
    selfSharing: false,
    participantCount: 1,
    capture: { kind: 'idle', startedAt: 1000, stoppedAt: 2000 } as any,
    digest: { status: 'completed', lookupId: 'lookup-1' } as any,
    readiness: { status: 'ready' } as any,
    alerts: [],
    chapters: [],
    currentTopic: '',
    actionItems: [],
    decisions: [],
    timelineEvents: [],
    participants,
    transcript: [
      {
        id: 'c1',
        speaker: '说话人 1',
        participantId: 'p1',
        text: 'we should ship Friday',
        ts: 1500,
      },
    ],
    transcriptTurns: [
      {
        id: 'turn-c1',
        participantId: 'p1',
        speakerNameSnapshot: '说话人 1',
        startTs: 1500,
        endTs: 1500,
        text: 'we should ship Friday',
        chunkIds: ['c1'],
        resolutionSources: ['transcript'],
      },
    ],
    memoryRefs: [],
    summary: 'Discussed release date.',
    timelineProgress: 0,
    detectedAt: 1000,
    updatedAt: 2000,
  };
}

test('ingest after rename: participantStances use the final user-given name', () => {
  const session = makeSession();
  const renamed = renameParticipant(session, 'p1', 'Alice');
  assert.equal(renamed.changed, true);

  const [summaryPayload] = buildMeetingIngestPayloads(renamed.session);
  assert.ok(summaryPayload, 'summary payload is generated');

  const stances = (summaryPayload.metadata as any).participantStances as Array<{
    participant: string;
    topic: string;
  }>;
  assert.equal(stances.length, 1);
  assert.equal(stances[0].participant, 'Alice');
  assert.equal(stances[0].topic, 'release date');

  const participantList = (summaryPayload.metadata as any).participants;
  assert.deepEqual(participantList, ['Alice']);

  // The summary header text is built from session.participants names too.
  assert.match(summaryPayload.content, /Alice/);
  assert.doesNotMatch(summaryPayload.content, /说话人 1/);
});

test('ingest after merge: stances and participant lists collapse to the target', () => {
  // Two participants, then merge p1 into roster (target is "Alice")
  const base = makeSession();
  const sessionWithRoster: MeetingPilotSessionSnapshot = {
    ...base,
    participants: [
      ...base.participants,
      {
        id: 'alice',
        name: 'Alice',
        role: 'PM',
        speakingPct: 50,
        resolutionState: 'roster',
        stances: [],
      },
    ],
    participantCount: 2,
  };
  const renamed = renameParticipant(sessionWithRoster, 'p1', 'Alice', {
    allowMerge: true,
  });
  assert.deepEqual(renamed.merged, { fromId: 'p1', toId: 'alice' });

  const [summaryPayload] = buildMeetingIngestPayloads(renamed.session);
  const stances = (summaryPayload.metadata as any).participantStances as Array<{
    participant: string;
  }>;
  assert.equal(stances.length, 1);
  assert.equal(stances[0].participant, 'Alice');
  assert.deepEqual((summaryPayload.metadata as any).participants, ['Alice']);
});

test('archive title generation replaces generic RingCentral titles from meeting content', () => {
  const session: MeetingPilotSessionSnapshot = {
    ...makeSession(),
    title: 'RingCentral Video',
    currentTopic: 'Q2 预算与排期确认',
    chapters: [
      {
        id: 'chapter-budget',
        title: 'Q2 预算与排期确认',
        summary: '确认 Q2 预算和 Sprint 排期。',
        viewMode: 'outline',
        startLabel: '10:00',
        actionCount: 0,
        decisionCount: 1,
      },
    ],
  };

  assert.equal(
    shouldGenerateMeetingArchiveTitle(session.title, session.meetingId),
    true,
  );
  assert.equal(buildFallbackMeetingArchiveTitle(session), 'Q2 预算与排期确认');

  const [summaryPayload] = buildMeetingIngestPayloads({
    ...session,
    title: buildFallbackMeetingArchiveTitle(session)!,
  });
  assert.equal(summaryPayload.sourceTitle, 'Q2 预算与排期确认');
  assert.equal(summaryPayload.groupName, 'Q2 预算与排期确认');
});

test('archive title generation keeps an explicit meeting title', () => {
  assert.equal(
    shouldGenerateMeetingArchiveTitle('Design Review Weekly', 'meeting-int-1'),
    false,
  );
});
