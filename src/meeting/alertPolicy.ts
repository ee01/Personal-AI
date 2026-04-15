import { MeetingAlert, MeetingDomSignals, MeetingMemoryReference, MeetingSession, TranscriptChunk } from './types';
import { inferScreenShareRequest } from './domSignals';

function alertId(prefix: string, seed: string): string {
  const normalized = seed.replace(/\s+/g, '-').toLowerCase();
  return `${prefix}-${normalized.slice(0, 64)}`;
}

export function createAlert(input: {
  level: MeetingAlert['level'];
  title: string;
  body: string;
  reason?: string;
  autoDismissMs?: number;
  now?: number;
}): MeetingAlert {
  return {
    id: alertId('meeting', `${input.level}-${input.title}`),
    level: input.level,
    title: input.title,
    body: input.body,
    reason: input.reason,
    createdAt: input.now || Date.now(),
    autoDismissMs: input.autoDismissMs,
  };
}

export function buildMeetingAlerts(params: {
  session: MeetingSession;
  signals?: MeetingDomSignals | null;
  latestTranscript?: TranscriptChunk;
  memoryReferences?: MeetingMemoryReference[];
}): MeetingAlert[] {
  const alerts: MeetingAlert[] = [];
  const { session, signals, latestTranscript } = params;
  const text = latestTranscript?.text || '';

  if (signals?.shareActive && session.selfSharing === 'yes' && inferScreenShareRequest(text, session.participants.filter((item) => item.isSelf).map((item) => item.name))) {
    alerts.push(createAlert({
      level: 'P0',
      title: 'Screen action requested',
      body: latestTranscript?.text || 'Someone asked you to operate the shared screen.',
      reason: 'self_share_request',
    }));
  }

  if (latestTranscript?.speaker && session.participants.some((item) => item.isSelf && latestTranscript.text.toLowerCase().includes(item.name.toLowerCase().replace(/\s+\(you\)$/i, '')))) {
    alerts.push(createAlert({
      level: 'P1',
      title: 'You were mentioned',
      body: latestTranscript.text,
      reason: 'mention',
      autoDismissMs: 8000,
    }));
  }

  const topMemory = (params.memoryReferences || []).slice().sort((a, b) => b.confidence - a.confidence)[0];
  if (topMemory && topMemory.confidence >= 0.8) {
    alerts.push(createAlert({
      level: topMemory.stale ? 'P2' : 'P1',
      title: `Memory match: ${topMemory.title}`,
      body: topMemory.reason,
      reason: 'memory_reference',
      autoDismissMs: topMemory.stale ? 7000 : 10000,
    }));
  }

  return alerts;
}
