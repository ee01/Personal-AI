import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isUnknownSpeakerName,
  looksLikeDeviceName,
  resolveParticipantByName,
  resolveSpeakerForChunk,
} from '../speakerResolver';
import {
  MeetingPilotParticipant,
  MeetingPilotSessionSnapshot,
  MeetingPilotTranscriptChunk,
} from '../protocol';

function makeSession(
  participants: MeetingPilotParticipant[],
  overrides: Partial<MeetingPilotSessionSnapshot> = {},
): MeetingPilotSessionSnapshot {
  return {
    meetingId: 'm1',
    tabId: 1,
    url: '',
    title: 'test meeting',
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
    transcript: [],
    transcriptTurns: [],
    memoryRefs: [],
    summary: '',
    timelineProgress: 0,
    detectedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeChunk(
  partial: Partial<MeetingPilotTranscriptChunk> = {},
): MeetingPilotTranscriptChunk {
  return {
    id: partial.id || 'c1',
    speaker: partial.speaker ?? '',
    text: partial.text ?? 'hello',
    ts: partial.ts ?? 1000,
    ...partial,
  };
}

test('isUnknownSpeakerName treats empty / sentinel as unknown', () => {
  assert.equal(isUnknownSpeakerName(''), true);
  assert.equal(isUnknownSpeakerName('Unknown participant'), true);
  assert.equal(isUnknownSpeakerName('  unknown  participant '), true);
  assert.equal(isUnknownSpeakerName('Alice'), false);
});

test('looksLikeDeviceName matches common room devices', () => {
  assert.equal(looksLikeDeviceName('Meeting Room 5'), true);
  assert.equal(looksLikeDeviceName('Polycom Speaker'), true);
  assert.equal(looksLikeDeviceName('Alice Chen'), false);
});

test('resolveParticipantByName: id > exact name > alias > sanitize', () => {
  const participants: MeetingPilotParticipant[] = [
    {
      id: 'alice',
      name: 'Alice Chen',
      role: 'PM',
      speakingPct: 0,
      aliases: ['艾丽丝'],
      resolutionState: 'roster',
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Eng',
      speakingPct: 0,
      resolutionState: 'roster',
    },
  ];
  assert.equal(resolveParticipantByName(participants, 'alice')?.id, 'alice');
  assert.equal(resolveParticipantByName(participants, 'Alice Chen')?.id, 'alice');
  assert.equal(resolveParticipantByName(participants, '艾丽丝')?.id, 'alice');
  assert.equal(resolveParticipantByName(participants, 'alice-chen')?.id, 'alice');
  assert.equal(resolveParticipantByName(participants, 'Carol'), undefined);
});

test('resolveSpeakerForChunk: prefers transcript-provided name when matching roster', () => {
  const session = makeSession([
    {
      id: 'alice',
      name: 'Alice',
      role: 'PM',
      speakingPct: 0,
      resolutionState: 'roster',
    },
  ]);
  const result = resolveSpeakerForChunk(
    session,
    makeChunk({ speaker: 'Alice' }),
  );
  assert.equal(result.participantId, 'alice');
  assert.equal(result.source, 'transcript');
  assert.equal(result.newParticipant, undefined);
});

test('resolveSpeakerForChunk: falls back to DOM speakerLabel', () => {
  const session = makeSession(
    [
      {
        id: 'alice',
        name: 'Alice',
        role: 'PM',
        speakingPct: 0,
        resolutionState: 'roster',
      },
    ],
    { speakerLabel: 'Alice' },
  );
  const result = resolveSpeakerForChunk(session, makeChunk({ speaker: '' }));
  assert.equal(result.participantId, 'alice');
  assert.equal(result.source, 'dom');
});

test('resolveSpeakerForChunk: continuity sticks to previous speaker', () => {
  const session = makeSession(
    [
      {
        id: 'alice',
        name: 'Alice',
        role: 'PM',
        speakingPct: 0,
        resolutionState: 'roster',
      },
    ],
    {
      transcript: [
        makeChunk({
          id: 'c0',
          speaker: 'Alice',
          participantId: 'alice',
          ts: 5000,
        }),
      ],
    },
  );
  const result = resolveSpeakerForChunk(
    session,
    makeChunk({ id: 'c1', speaker: '', ts: 7000 }),
  );
  assert.equal(result.participantId, 'alice');
  assert.equal(result.source, 'continuity');
});

test('resolveSpeakerForChunk: gap > window breaks continuity and creates provisional', () => {
  const session = makeSession([], {
    transcript: [
      makeChunk({
        id: 'c0',
        speaker: 'Alice',
        participantId: 'alice',
        ts: 1000,
      }),
    ],
  });
  const result = resolveSpeakerForChunk(
    session,
    makeChunk({ id: 'c1', speaker: '', ts: 30_000 }),
  );
  assert.equal(result.state, 'provisional');
  assert.match(result.resolvedName, /说话人/);
  assert.ok(result.newParticipant);
});

test('resolveSpeakerForChunk: device names get device state', () => {
  const session = makeSession([]);
  const result = resolveSpeakerForChunk(
    session,
    makeChunk({ speaker: 'Conference Room 5' }),
  );
  assert.equal(result.state, 'device');
});
