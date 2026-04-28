import {
  MeetingPilotParticipant,
  MeetingPilotSessionSnapshot,
  MeetingPilotTranscriptChunk,
  MeetingPilotTranscriptTurn,
} from './protocol';
import {
  normalizeText,
  resolveParticipantByName,
} from './speakerResolver';
import { refreshTurnSpeakerNames } from './transcriptTurns';

export interface RenameOptions {
  /**
   * If newName matches an existing participant name/alias, treat the rename as
   * a merge of the source participant into that target.
   */
  allowMerge?: boolean;
}

export interface RenameResult {
  session: MeetingPilotSessionSnapshot;
  merged?: { fromId: string; toId: string };
  changed: boolean;
}

export interface MergeResult {
  session: MeetingPilotSessionSnapshot;
  changed: boolean;
}

function rewriteChunks(
  chunks: MeetingPilotTranscriptChunk[],
  fromId: string,
  toParticipant: MeetingPilotParticipant,
): MeetingPilotTranscriptChunk[] {
  return chunks.map((chunk) => {
    if (chunk.participantId !== fromId) return chunk;
    return { ...chunk, participantId: toParticipant.id, speaker: toParticipant.name };
  });
}

function rewriteTurns(
  turns: MeetingPilotTranscriptTurn[],
  fromId: string,
  toParticipant: MeetingPilotParticipant,
): MeetingPilotTranscriptTurn[] {
  return turns.map((turn) => {
    if (turn.participantId !== fromId) return turn;
    return {
      ...turn,
      participantId: toParticipant.id,
      speakerNameSnapshot: toParticipant.name,
    };
  });
}

/**
 * Merge `fromId` participant into `toId` participant.
 * Re-points all chunks/turns/stances to `toId` and removes the source.
 */
export function mergeParticipants(
  session: MeetingPilotSessionSnapshot,
  fromId: string,
  toId: string,
): MergeResult {
  if (fromId === toId) {
    return { session, changed: false };
  }
  const from = session.participants.find((p) => p.id === fromId);
  const to = session.participants.find((p) => p.id === toId);
  if (!from || !to) {
    return { session, changed: false };
  }

  const mergedAliases = Array.from(
    new Set(
      [
        ...(to.aliases || []),
        ...(from.aliases || []),
        from.name,
      ]
        .map((alias) => normalizeText(alias))
        .filter((alias) => alias && alias !== to.name),
    ),
  );

  const seenStanceTopics = new Set<string>();
  const mergedStances = [...(to.stances || []), ...(from.stances || [])].filter(
    (stance) => {
      if (!stance || !stance.topic) return false;
      const key = stance.topic;
      if (seenStanceTopics.has(key)) return false;
      seenStanceTopics.add(key);
      return true;
    },
  );

  const mergedSourceLabels = Array.from(
    new Set([...(to.sourceLabels || []), ...(from.sourceLabels || [])]),
  );

  const mergedTo: MeetingPilotParticipant = {
    ...to,
    aliases: mergedAliases,
    stances: mergedStances,
    sourceLabels: mergedSourceLabels.length ? mergedSourceLabels : undefined,
    isHost: to.isHost ?? from.isHost,
    isSelf: to.isSelf ?? from.isSelf,
  };

  const participants = session.participants
    .filter((p) => p.id !== fromId)
    .map((p) => (p.id === toId ? mergedTo : p));

  const transcript = rewriteChunks(session.transcript, fromId, mergedTo);
  const transcriptTurns = rewriteTurns(
    session.transcriptTurns,
    fromId,
    mergedTo,
  );

  return {
    session: {
      ...session,
      participants,
      transcript,
      transcriptTurns,
    },
    changed: true,
  };
}

/**
 * Rename a participant. If the new name matches an existing participant
 * (and allowMerge), perform a merge instead.
 */
export function renameParticipant(
  session: MeetingPilotSessionSnapshot,
  participantId: string,
  rawNewName: string,
  options: RenameOptions = {},
): RenameResult {
  const newName = normalizeText(rawNewName);
  if (!newName) {
    return { session, changed: false };
  }
  const target = session.participants.find((p) => p.id === participantId);
  if (!target) {
    return { session, changed: false };
  }
  if (normalizeText(target.name) === newName) {
    return { session, changed: false };
  }

  const conflict = resolveParticipantByName(session.participants, newName);
  if (conflict && conflict.id !== participantId) {
    if (!options.allowMerge) {
      return { session, changed: false };
    }
    const mergeResult = mergeParticipants(session, participantId, conflict.id);
    return {
      session: mergeResult.session,
      merged: { fromId: participantId, toId: conflict.id },
      changed: mergeResult.changed,
    };
  }

  const previousName = target.name;
  const renamedAliases = Array.from(
    new Set(
      [...(target.aliases || []), previousName]
        .map((alias) => normalizeText(alias))
        .filter((alias) => alias && alias !== newName),
    ),
  );

  const renamed: MeetingPilotParticipant = {
    ...target,
    name: newName,
    aliases: renamedAliases,
    resolutionState: 'user_named',
    resolutionConfidence: 1,
    sourceLabels: Array.from(
      new Set([...(target.sourceLabels || []), 'user']),
    ),
  };

  const participants = session.participants.map((p) =>
    p.id === participantId ? renamed : p,
  );
  const transcript = session.transcript.map((chunk) =>
    chunk.participantId === participantId
      ? { ...chunk, speaker: newName }
      : chunk,
  );
  const transcriptTurns = refreshTurnSpeakerNames(
    session.transcriptTurns,
    participants,
  );

  return {
    session: {
      ...session,
      participants,
      transcript,
      transcriptTurns,
    },
    changed: true,
  };
}

export interface AiResolutionCandidate {
  fromId: string;
  toId: string;
  confidence: number;
  evidence?: string;
}

/**
 * Apply AI-suggested participant resolutions with safety guards.
 * Only allowed: provisional/device -> roster/user_named, conf >= 0.85.
 */
export function applyAiParticipantResolutions(
  session: MeetingPilotSessionSnapshot,
  candidates: AiResolutionCandidate[],
  options: { minConfidence?: number } = {},
): MergeResult {
  const minConf = options.minConfidence ?? 0.85;
  let working = session;
  let changed = false;

  for (const candidate of candidates) {
    if (!candidate || candidate.fromId === candidate.toId) continue;
    if (candidate.confidence < minConf) continue;
    const from = working.participants.find((p) => p.id === candidate.fromId);
    const to = working.participants.find((p) => p.id === candidate.toId);
    if (!from || !to) continue;
    const fromState = from.resolutionState;
    const toState = to.resolutionState;
    if (fromState !== 'provisional' && fromState !== 'device') continue;
    if (toState !== 'roster' && toState !== 'user_named') continue;

    const result = mergeParticipants(working, from.id, to.id);
    if (result.changed) {
      working = result.session;
      changed = true;
    }
  }

  return { session: working, changed };
}
