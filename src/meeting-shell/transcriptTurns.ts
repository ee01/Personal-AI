import {
  MeetingPilotParticipant,
  MeetingPilotSpeakerSource,
  MeetingPilotTranscriptChunk,
  MeetingPilotTranscriptTurn,
} from './protocol';

export const DEFAULT_TURN_GAP_MS = 18_000;

interface BuildTurnsOptions {
  gapMs?: number;
}

function pickSpeakerName(
  chunk: MeetingPilotTranscriptChunk,
  participantId: string,
  participants: MeetingPilotParticipant[],
): string {
  const fromList = participants.find((p) => p.id === participantId);
  if (fromList?.name) return fromList.name;
  return chunk.speaker || participantId;
}

function shouldStartNewTurn(
  prevChunk: MeetingPilotTranscriptChunk,
  prevParticipantId: string,
  next: MeetingPilotTranscriptChunk,
  gapMs: number,
): boolean {
  if (next.participantId !== prevParticipantId) return true;
  if (next.ts - prevChunk.ts > gapMs) return true;
  return false;
}

export function buildTranscriptTurns(
  chunks: MeetingPilotTranscriptChunk[],
  participants: MeetingPilotParticipant[],
  options: BuildTurnsOptions = {},
): MeetingPilotTranscriptTurn[] {
  const gapMs = options.gapMs ?? DEFAULT_TURN_GAP_MS;
  if (!chunks.length) return [];

  const turns: MeetingPilotTranscriptTurn[] = [];
  let currentChunks: MeetingPilotTranscriptChunk[] = [];
  let currentParticipantId: string | undefined;
  let lastChunk: MeetingPilotTranscriptChunk | undefined;

  const flush = () => {
    if (!currentChunks.length || !currentParticipantId) return;
    const first = currentChunks[0];
    const last = currentChunks[currentChunks.length - 1];
    const sources = new Set<MeetingPilotSpeakerSource>();
    let hasLowConf = false;
    currentChunks.forEach((c) => {
      if (c.resolutionSource) sources.add(c.resolutionSource);
      if (c.lowConfidence) hasLowConf = true;
    });
    turns.push({
      id: `turn-${first.id}`,
      participantId: currentParticipantId,
      speakerNameSnapshot: pickSpeakerName(
        first,
        currentParticipantId,
        participants,
      ),
      startTs: first.ts,
      endTs: last.ts,
      text: currentChunks.map((c) => c.text).join(' ').trim(),
      chunkIds: currentChunks.map((c) => c.id),
      resolutionSources: Array.from(sources),
      lowConfidence: hasLowConf || undefined,
    });
  };

  for (const chunk of chunks) {
    const participantId = chunk.participantId;
    if (!participantId) {
      // Chunks without participantId can't be aggregated; flush previous and skip.
      flush();
      currentChunks = [];
      currentParticipantId = undefined;
      lastChunk = undefined;
      continue;
    }

    if (
      !currentParticipantId ||
      !lastChunk ||
      shouldStartNewTurn(lastChunk, currentParticipantId, chunk, gapMs)
    ) {
      flush();
      currentChunks = [chunk];
      currentParticipantId = participantId;
    } else {
      currentChunks.push(chunk);
    }
    lastChunk = chunk;
  }

  flush();
  return turns;
}

/**
 * Recompute snapshot names for turns when participants are renamed.
 * Pure helper used after rename / merge operations.
 */
export function refreshTurnSpeakerNames(
  turns: MeetingPilotTranscriptTurn[],
  participants: MeetingPilotParticipant[],
): MeetingPilotTranscriptTurn[] {
  return turns.map((turn) => {
    const participant = participants.find((p) => p.id === turn.participantId);
    if (!participant) return turn;
    if (participant.name === turn.speakerNameSnapshot) return turn;
    return { ...turn, speakerNameSnapshot: participant.name };
  });
}
