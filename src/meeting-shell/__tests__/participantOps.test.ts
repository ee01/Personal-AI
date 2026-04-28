import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAiParticipantResolutions,
  mergeParticipants,
  renameParticipant,
} from '../participantOps';
import {
  MeetingPilotParticipant,
  MeetingPilotSessionSnapshot,
  MeetingPilotTranscriptChunk,
  MeetingPilotTranscriptTurn,
} from '../protocol';

function makeSession(
  participants: MeetingPilotParticipant[],
  transcript: MeetingPilotTranscriptChunk[] = [],
  turns: MeetingPilotTranscriptTurn[] = [],
): MeetingPilotSessionSnapshot {
  return {
    meetingId: 'm',
    tabId: 1,
    url: '',
    title: '',
    status: 'recording',
    inMeeting: true,
    shareState: 'unknown',
    selfSharing: false,
    participantCount: participants.length,
    capture: { kind: 'idle' } as any,
    digest: { status: 'idle' } as any,
    readiness: { status: 'ready' } as any,
    alerts: [],
    chapters: [],
    currentTopic: '',
    actionItems: [],
    decisions: [],
    timelineEvents: [],
    participants,
    transcript,
    transcriptTurns: turns,
    memoryRefs: [],
    summary: '',
    timelineProgress: 0,
    detectedAt: 0,
    updatedAt: 0,
  };
}

test('renameParticipant: rewrites name, archives old name as alias, updates turn snapshot', () => {
  const session = makeSession(
    [
      {
        id: 'p1',
        name: '说话人 1',
        role: 'Participant',
        speakingPct: 0,
        resolutionState: 'provisional',
      },
    ],
    [
      {
        id: 'c1',
        speaker: '说话人 1',
        participantId: 'p1',
        text: 'hi',
        ts: 1000,
      },
    ],
    [
      {
        id: 't1',
        participantId: 'p1',
        speakerNameSnapshot: '说话人 1',
        startTs: 1000,
        endTs: 1000,
        text: 'hi',
        chunkIds: ['c1'],
        resolutionSources: ['transcript'],
      },
    ],
  );
  const result = renameParticipant(session, 'p1', 'Alice');
  assert.equal(result.changed, true);
  const renamed = result.session.participants.find((p) => p.id === 'p1');
  assert.equal(renamed?.name, 'Alice');
  assert.equal(renamed?.resolutionState, 'user_named');
  assert.ok(renamed?.aliases?.includes('说话人 1'));
  assert.equal(result.session.transcript[0].speaker, 'Alice');
  assert.equal(result.session.transcriptTurns[0].speakerNameSnapshot, 'Alice');
});

test('renameParticipant: rename to existing name with allowMerge merges into target', () => {
  const session = makeSession(
    [
      {
        id: 'alice',
        name: 'Alice',
        role: 'PM',
        speakingPct: 0,
        resolutionState: 'roster',
      },
      {
        id: 'p1',
        name: '说话人 1',
        role: 'Participant',
        speakingPct: 0,
        resolutionState: 'provisional',
      },
    ],
    [{ id: 'c1', speaker: '说话人 1', participantId: 'p1', text: 'hi', ts: 1 }],
  );
  const result = renameParticipant(session, 'p1', 'Alice', { allowMerge: true });
  assert.equal(result.changed, true);
  assert.deepEqual(result.merged, { fromId: 'p1', toId: 'alice' });
  assert.equal(result.session.participants.length, 1);
  assert.equal(result.session.transcript[0].participantId, 'alice');
});

test('renameParticipant: rename to existing name without allowMerge is rejected', () => {
  const session = makeSession([
    { id: 'alice', name: 'Alice', role: 'PM', speakingPct: 0 },
    { id: 'p1', name: '说话人 1', role: 'Participant', speakingPct: 0 },
  ]);
  const result = renameParticipant(session, 'p1', 'Alice');
  assert.equal(result.changed, false);
});

test('mergeParticipants: re-points chunks/turns/stances to target id', () => {
  const session = makeSession(
    [
      {
        id: 'alice',
        name: 'Alice',
        role: 'PM',
        speakingPct: 0,
        resolutionState: 'roster',
        stances: [
          { topic: 'release', stance: '支持', keyQuote: 'lgtm' },
        ],
      },
      {
        id: 'p1',
        name: '说话人 1',
        role: 'Participant',
        speakingPct: 0,
        resolutionState: 'provisional',
        stances: [
          { topic: 'risk', stance: '质疑', keyQuote: 'concerns' },
        ],
      },
    ],
    [{ id: 'c1', speaker: '说话人 1', participantId: 'p1', text: 'a', ts: 1 }],
    [
      {
        id: 't1',
        participantId: 'p1',
        speakerNameSnapshot: '说话人 1',
        startTs: 1,
        endTs: 1,
        text: 'a',
        chunkIds: ['c1'],
        resolutionSources: ['transcript'],
      },
    ],
  );
  const result = mergeParticipants(session, 'p1', 'alice');
  assert.equal(result.changed, true);
  assert.equal(result.session.participants.length, 1);
  const target = result.session.participants[0];
  assert.equal(target.id, 'alice');
  assert.ok(target.aliases?.includes('说话人 1'));
  assert.equal(target.stances?.length, 2);
  assert.equal(result.session.transcript[0].participantId, 'alice');
  assert.equal(result.session.transcriptTurns[0].participantId, 'alice');
});

test('applyAiParticipantResolutions: confidence below threshold rejected', () => {
  const session = makeSession([
    {
      id: 'alice',
      name: 'Alice',
      role: 'PM',
      speakingPct: 0,
      resolutionState: 'roster',
    },
    {
      id: 'p1',
      name: '说话人 1',
      role: 'Participant',
      speakingPct: 0,
      resolutionState: 'provisional',
    },
  ]);
  const result = applyAiParticipantResolutions(session, [
    { fromId: 'p1', toId: 'alice', confidence: 0.6 },
  ]);
  assert.equal(result.changed, false);
});

test('applyAiParticipantResolutions: rejects merging two roster ids', () => {
  const session = makeSession([
    {
      id: 'alice',
      name: 'Alice',
      role: 'PM',
      speakingPct: 0,
      resolutionState: 'roster',
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Eng',
      speakingPct: 0,
      resolutionState: 'roster',
    },
  ]);
  const result = applyAiParticipantResolutions(session, [
    { fromId: 'alice', toId: 'bob', confidence: 0.99 },
  ]);
  assert.equal(result.changed, false);
});

test('applyAiParticipantResolutions: high-confidence provisional->roster merges', () => {
  const session = makeSession([
    {
      id: 'alice',
      name: 'Alice',
      role: 'PM',
      speakingPct: 0,
      resolutionState: 'roster',
    },
    {
      id: 'p1',
      name: '说话人 1',
      role: 'Participant',
      speakingPct: 0,
      resolutionState: 'provisional',
    },
  ]);
  const result = applyAiParticipantResolutions(session, [
    { fromId: 'p1', toId: 'alice', confidence: 0.9 },
  ]);
  assert.equal(result.changed, true);
  assert.equal(result.session.participants.length, 1);
});
