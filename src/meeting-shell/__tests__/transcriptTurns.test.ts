import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTranscriptTurns, refreshTurnSpeakerNames } from '../transcriptTurns';
import {
  MeetingPilotParticipant,
  MeetingPilotTranscriptChunk,
} from '../protocol';

const participants: MeetingPilotParticipant[] = [
  { id: 'alice', name: 'Alice', role: 'PM', speakingPct: 0 },
  { id: 'bob', name: 'Bob', role: 'Eng', speakingPct: 0 },
];

function chunk(
  partial: Partial<MeetingPilotTranscriptChunk>,
): MeetingPilotTranscriptChunk {
  return {
    id: partial.id || 'c',
    speaker: partial.speaker || 'Alice',
    participantId: partial.participantId,
    text: partial.text || 'text',
    ts: partial.ts ?? 0,
    ...partial,
  };
}

test('buildTranscriptTurns: aggregates same speaker within gap', () => {
  const turns = buildTranscriptTurns(
    [
      chunk({ id: 'c1', participantId: 'alice', text: 'hi', ts: 1000 }),
      chunk({ id: 'c2', participantId: 'alice', text: 'there', ts: 4000 }),
      chunk({ id: 'c3', participantId: 'alice', text: 'team', ts: 7000 }),
    ],
    participants,
  );
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'hi there team');
  assert.equal(turns[0].chunkIds.length, 3);
});

test('buildTranscriptTurns: gap > 18s breaks turn', () => {
  const turns = buildTranscriptTurns(
    [
      chunk({ id: 'c1', participantId: 'alice', ts: 1000, text: 'a' }),
      chunk({ id: 'c2', participantId: 'alice', ts: 20_000, text: 'b' }),
    ],
    participants,
  );
  assert.equal(turns.length, 2);
});

test('buildTranscriptTurns: speaker change breaks turn', () => {
  const turns = buildTranscriptTurns(
    [
      chunk({ id: 'c1', participantId: 'alice', ts: 1000, text: 'hi' }),
      chunk({
        id: 'c2',
        participantId: 'bob',
        speaker: 'Bob',
        ts: 2000,
        text: 'yes',
      }),
      chunk({ id: 'c3', participantId: 'alice', ts: 3000, text: 'cool' }),
    ],
    participants,
  );
  assert.equal(turns.length, 3);
  assert.equal(turns[1].participantId, 'bob');
});

test('buildTranscriptTurns: chunks without participantId flush current and skip', () => {
  const turns = buildTranscriptTurns(
    [
      chunk({ id: 'c1', participantId: 'alice', ts: 1000 }),
      chunk({ id: 'c2', ts: 1500, participantId: undefined }),
      chunk({ id: 'c3', participantId: 'alice', ts: 2000 }),
    ],
    participants,
  );
  // c1 is its own turn, c2 is skipped, c3 starts new turn
  assert.equal(turns.length, 2);
});

test('refreshTurnSpeakerNames: updates snapshot to current participant name', () => {
  const turns = buildTranscriptTurns(
    [chunk({ id: 'c1', participantId: 'alice', ts: 1000 })],
    participants,
  );
  const updated = refreshTurnSpeakerNames(turns, [
    { ...participants[0], name: 'Alice Renamed' },
    participants[1],
  ]);
  assert.equal(updated[0].speakerNameSnapshot, 'Alice Renamed');
});
