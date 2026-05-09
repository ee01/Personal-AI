import test from 'node:test';
import assert from 'node:assert/strict';

// Provide minimal chrome / browser globals before importing background.ts so
// module-level code does not crash. background.ts only references chrome
// inside functions, so a minimal stub is enough.
const chromeStub = {
  runtime: {
    getURL: (path: string) => `chrome-extension://test/${path}`,
    onMessage: { addListener: () => undefined },
    onInstalled: { addListener: () => undefined },
    onStartup: { addListener: () => undefined },
    sendMessage: () => Promise.resolve(),
  },
  tabs: {
    onUpdated: { addListener: () => undefined },
    onRemoved: { addListener: () => undefined },
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
  buildMeetingOwnerTranscriptLearningPayloads,
  mergeActionItemReviewStates,
  shouldGenerateMeetingArchiveTitle,
} from '../background.ts';
import { renameParticipant } from '../participantOps.ts';
import {
  MeetingPilotParticipant,
  MeetingPilotSessionSnapshot,
} from '../protocol.ts';

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

test('meeting owner transcript learning: only explicit self non-low-confidence turns create payloads', () => {
  const session = makeSession();
  const payloads = buildMeetingOwnerTranscriptLearningPayloads(
    {
      ...session,
      selfName: 'Esone Qiu',
      participants: [
        {
          id: 'self',
          name: 'Esone Qiu',
          role: 'You',
          speakingPct: 40,
          isSelf: true,
          resolutionState: 'roster',
        },
        {
          id: 'alice',
          name: 'Alice',
          role: 'Participant',
          speakingPct: 40,
          resolutionState: 'roster',
        },
        {
          id: 'provisional-1',
          name: '说话人 1',
          role: 'Participant',
          speakingPct: 20,
          isSelf: true,
          resolutionState: 'provisional',
        },
      ],
      transcriptTurns: [
        {
          id: 'turn-self',
          participantId: 'self',
          speakerNameSnapshot: 'Esone Qiu',
          startTs: 1500,
          endTs: 1600,
          text: 'I prefer short owner updates.',
          chunkIds: ['c-self'],
          resolutionSources: ['roster'],
        },
        {
          id: 'turn-low',
          participantId: 'self',
          speakerNameSnapshot: 'Esone Qiu',
          startTs: 1700,
          endTs: 1800,
          text: 'uncertain interim text',
          chunkIds: ['c-low'],
          resolutionSources: ['roster'],
          lowConfidence: true,
        },
        {
          id: 'turn-other',
          participantId: 'alice',
          speakerNameSnapshot: 'Alice',
          startTs: 1900,
          endTs: 2000,
          text: 'Alice should not be learned as owner.',
          chunkIds: ['c-other'],
          resolutionSources: ['roster'],
        },
        {
          id: 'turn-provisional',
          participantId: 'provisional-1',
          speakerNameSnapshot: '说话人 1',
          startTs: 2100,
          endTs: 2200,
          text: 'provisional self speaker should be skipped.',
          chunkIds: ['c-prov'],
          resolutionSources: ['transcript'],
        },
        {
          id: 'turn-unknown',
          participantId: 'unknown',
          speakerNameSnapshot: 'Unknown',
          startTs: 2300,
          endTs: 2400,
          text: 'unknown speaker should be skipped.',
          chunkIds: ['c-unknown'],
          resolutionSources: ['transcript'],
        },
      ],
    },
    'chrome-extension://test/meeting-panorama.html?meetingId=meeting-int-1&tabId=7',
  );

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].sourceType, 'meeting');
  assert.equal(payloads[0].content, 'I prefer short owner updates.');
  assert.equal(payloads[0].metadata?.meetingId, 'meeting-int-1');
  assert.equal(payloads[0].metadata?.turnId, 'turn-self');
  assert.equal(payloads[0].metadata?.participantId, 'self');
  assert.equal(payloads[0].metadata?.authorRole, 'owner');
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

test('action item review state is preserved across regenerated items', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-0',
        title: 'Send launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'pending',
        reviewState: 'suggested',
        source: 'llm',
      },
    ],
    [
      {
        id: 'action-old-1',
        title: 'Send launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'done',
        reviewState: 'confirmed',
        reviewedAt: 123,
        source: 'heuristic',
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'action-llm-0');
  assert.equal(merged[0].status, 'done');
  assert.equal(merged[0].reviewState, 'confirmed');
  assert.equal(merged[0].reviewedAt, 123);
});

test('generated action item id collision does not transfer review state', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-0',
        title: 'Prepare launch checklist',
        owner: 'Chris',
        deadline: 'Monday',
        status: 'pending',
        source: 'llm',
      },
    ],
    [
      {
        id: 'action-llm-0',
        title: 'Send launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'pending',
        reviewState: 'dismissed',
        reviewedAt: 123,
        source: 'llm',
      },
    ],
  );

  const newItem = merged.find(
    (item) => item.title === 'Prepare launch checklist',
  );
  const oldItem = merged.find((item) => item.title === 'Send launch checklist');

  assert.ok(newItem);
  assert.equal(newItem.reviewState, 'suggested');
  assert.equal(newItem.status, 'pending');
  assert.equal(newItem.reviewedAt, undefined);
  assert.ok(oldItem);
  assert.equal(oldItem.reviewState, 'dismissed');
});

test('meeting ingest excludes dismissed action items from recap payload', () => {
  const [summaryPayload] = buildMeetingIngestPayloads({
    ...makeSession(),
    actionItems: [
      {
        id: 'action-active',
        title: 'Prepare launch checklist',
        owner: 'Bella',
        status: 'pending',
        reviewState: 'confirmed',
      },
      {
        id: 'action-dismissed',
        title: 'Discuss vague owner',
        owner: 'Unknown',
        status: 'pending',
        reviewState: 'dismissed',
      },
    ],
  });

  assert.match(summaryPayload.content, /Prepare launch checklist/);
  assert.doesNotMatch(summaryPayload.content, /Discuss vague owner/);
  assert.equal((summaryPayload.metadata as any).actionItemCount, 1);
  assert.equal((summaryPayload.metadata as any).actionItems.length, 1);
  assert.equal((summaryPayload.metadata as any).allActionItems.length, 2);
});
