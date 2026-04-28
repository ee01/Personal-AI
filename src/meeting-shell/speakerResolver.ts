import {
  MeetingPilotParticipant,
  MeetingPilotResolutionState,
  MeetingPilotSessionSnapshot,
  MeetingPilotSpeakerSource,
  MeetingPilotTranscriptChunk,
} from './protocol';

const LEGACY_UNKNOWN_SPEAKER = 'Unknown participant';
const PROVISIONAL_NAME_PREFIX = '说话人';
const DEVICE_NAME_PREFIX = '会议室设备';
const DEVICE_NAME_PATTERN =
  /(conference\s*room|meeting\s*room|board ?room|poly|zoom\s*room|speakerphone|polycom|crestron|logitech\s*rally|cisco\s*room|webex\s*room|room\s*device|huddly)/i;
const SPEAKER_CONTINUITY_WINDOW_MS = 18_000;

export type ResolveSource = MeetingPilotSpeakerSource;

export interface SpeakerResolutionResult {
  participantId: string;
  resolvedName: string;
  source: MeetingPilotSpeakerSource;
  confidence: number;
  state: MeetingPilotResolutionState;
  newParticipant?: MeetingPilotParticipant;
  participantsAfter: MeetingPilotParticipant[];
}

interface ResolverOptions {
  resolveAlias?: (name: string) => string;
  now?: number;
}

export function normalizeText(value?: string | null): string {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeName(value?: string | null): string {
  return normalizeText(value)
    .replace(/\(you\)$/i, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '')
    .toLowerCase();
}

export function isUnknownSpeakerName(name?: string | null): boolean {
  const trimmed = normalizeText(name);
  if (!trimmed) return true;
  return trimmed.toLowerCase() === LEGACY_UNKNOWN_SPEAKER.toLowerCase();
}

export function looksLikeDeviceName(name?: string | null): boolean {
  const trimmed = normalizeText(name);
  if (!trimmed) return false;
  return DEVICE_NAME_PATTERN.test(trimmed);
}

/**
 * Match a raw name back to a canonical participant.
 * Order: id direct > exact name > aliases > sanitizeName.
 */
export function resolveParticipantByName(
  participants: MeetingPilotParticipant[],
  rawName?: string | null,
): MeetingPilotParticipant | undefined {
  const normalized = normalizeText(rawName);
  if (!normalized) return undefined;
  if (isUnknownSpeakerName(normalized)) return undefined;

  const directId = participants.find((p) => p.id === normalized);
  if (directId) return directId;

  const lower = normalized.toLowerCase();
  const exactName = participants.find(
    (p) => normalizeText(p.name).toLowerCase() === lower,
  );
  if (exactName) return exactName;

  const aliasMatch = participants.find((p) =>
    (p.aliases || []).some(
      (alias) => normalizeText(alias).toLowerCase() === lower,
    ),
  );
  if (aliasMatch) return aliasMatch;

  const sanitized = sanitizeName(normalized);
  if (!sanitized) return undefined;
  const fuzzy = participants.find((p) => {
    if (sanitizeName(p.name) === sanitized) return true;
    return (p.aliases || []).some((alias) => sanitizeName(alias) === sanitized);
  });
  return fuzzy;
}

function buildAliasResolver(aliasEntries?: string[]): (name: string) => string {
  if (!aliasEntries || !aliasEntries.length) {
    return (name) => name;
  }
  const pairs = aliasEntries
    .map((entry) => entry.split('=').map((part) => normalizeText(part)))
    .filter((parts) => parts.length === 2 && parts[0] && parts[1]);
  return (name: string) => {
    const sanitized = sanitizeName(name);
    const found = pairs.find(([alias]) => sanitizeName(alias) === sanitized);
    return found ? found[1] : name;
  };
}

export function createAliasResolverFromEnv(envValue?: string | null) {
  return buildAliasResolver(
    String(envValue || '')
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function nextProvisionalName(
  participants: MeetingPilotParticipant[],
  prefix: string,
): string {
  const numbers = participants
    .map((p) => {
      const match = normalizeText(p.name).match(
        new RegExp(`^${prefix}\\s*(\\d+)$`),
      );
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix} ${next}`;
}

function generateParticipantId(
  baseName: string,
  participants: MeetingPilotParticipant[],
  prefix = 'participant',
): string {
  const sanitized = sanitizeName(baseName);
  if (sanitized && !participants.some((p) => p.id === sanitized)) {
    return sanitized;
  }
  let counter = participants.length + 1;
  while (participants.some((p) => p.id === `${prefix}-${counter}`)) {
    counter += 1;
  }
  return `${prefix}-${counter}`;
}

function findContinuityParticipant(
  session: MeetingPilotSessionSnapshot,
  chunkTs: number,
  windowMs: number,
): MeetingPilotParticipant | undefined {
  const lastChunk = session.transcript[session.transcript.length - 1];
  if (!lastChunk || !lastChunk.participantId) return undefined;
  if (chunkTs - lastChunk.ts > windowMs) return undefined;
  return session.participants.find((p) => p.id === lastChunk.participantId);
}

/**
 * Resolve which participant a transcript chunk belongs to.
 * Priority (no mic in v1):
 *   1. chunk.speaker (transcript provider)
 *   2. session.speakerLabel (DOM)
 *   3. continuation: previous chunk's participant within window
 *   4. new provisional `说话人 N` / `会议室设备 N`
 */
export function resolveSpeakerForChunk(
  session: MeetingPilotSessionSnapshot,
  chunk: MeetingPilotTranscriptChunk,
  options: ResolverOptions = {},
): SpeakerResolutionResult {
  if (chunk.lowConfidence) {
    return {
      resolvedName: '',
      participantId: '',
      source: 'transcript',
      confidence: 0,
      state: 'provisional',
      participantsAfter: session.participants,
    };
  }
  const resolveAlias = options.resolveAlias || ((name: string) => name);
  const participants = [...session.participants];

  const tryName = (
    rawName: string,
    source: MeetingPilotSpeakerSource,
    confidence: number,
  ): SpeakerResolutionResult | undefined => {
    const aliased = resolveAlias(normalizeText(rawName));
    if (!aliased || isUnknownSpeakerName(aliased)) return undefined;

    const isDevice = looksLikeDeviceName(aliased);
    const existing = resolveParticipantByName(participants, aliased);

    if (existing) {
      return {
        participantId: existing.id,
        resolvedName: existing.name,
        source,
        confidence,
        state: existing.resolutionState || 'roster',
        participantsAfter: participants,
      };
    }

    const id = generateParticipantId(aliased, participants);
    const newParticipant: MeetingPilotParticipant = {
      id,
      name: aliased,
      role: isDevice ? 'Room Device' : 'Participant',
      speakingPct: 0,
      stances: [],
      resolutionState: isDevice ? 'device' : 'provisional',
      resolutionConfidence: confidence,
      sourceLabels: [source],
    };
    return {
      participantId: id,
      resolvedName: aliased,
      source,
      confidence,
      state: newParticipant.resolutionState!,
      newParticipant,
      participantsAfter: [...participants, newParticipant],
    };
  };

  // 1. transcript-provided speaker
  if (chunk.speaker && !isUnknownSpeakerName(chunk.speaker)) {
    const result = tryName(chunk.speaker, 'transcript', 0.85);
    if (result) return result;
  }

  // 2. DOM speakerLabel
  if (session.speakerLabel && !isUnknownSpeakerName(session.speakerLabel)) {
    const result = tryName(session.speakerLabel, 'dom', 0.7);
    if (result) return result;
  }

  // 3. continuity from previous chunk
  const continuity = findContinuityParticipant(
    session,
    chunk.ts,
    SPEAKER_CONTINUITY_WINDOW_MS,
  );
  if (continuity) {
    return {
      participantId: continuity.id,
      resolvedName: continuity.name,
      source: 'continuity',
      confidence: 0.4,
      state: continuity.resolutionState || 'provisional',
      participantsAfter: participants,
    };
  }

  // 4. new provisional speaker
  const provisionalName = nextProvisionalName(
    participants,
    PROVISIONAL_NAME_PREFIX,
  );
  const id = generateParticipantId(provisionalName, participants);
  const newParticipant: MeetingPilotParticipant = {
    id,
    name: provisionalName,
    role: 'Participant',
    speakingPct: 0,
    stances: [],
    resolutionState: 'provisional',
    resolutionConfidence: 0.2,
    sourceLabels: ['continuity'],
  };
  return {
    participantId: id,
    resolvedName: provisionalName,
    source: 'continuity',
    confidence: 0.2,
    state: 'provisional',
    newParticipant,
    participantsAfter: [...participants, newParticipant],
  };
}

export const __TESTING__ = {
  PROVISIONAL_NAME_PREFIX,
  DEVICE_NAME_PREFIX,
  DEVICE_NAME_PATTERN,
  nextProvisionalName,
  generateParticipantId,
  buildAliasResolver,
};
