import { MeetingDomSignals, MeetingFeatureState, MeetingSession, MeetingStatus } from './types';

export function extractMeetingIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/conf\/on\/([^/]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function isMeetingUrl(url: string): boolean {
  return extractMeetingIdFromUrl(url) !== null;
}

export function createEmptyMeetingFeatureState(): MeetingFeatureState {
  return {
    sessions: {},
  };
}

export function createMeetingSession(seed: {
  tabId: number;
  meetingUrl: string;
  meetingId?: string;
  pageTitle?: string;
  now?: number;
}): MeetingSession {
  const now = seed.now || Date.now();
  const meetingId = seed.meetingId || extractMeetingIdFromUrl(seed.meetingUrl) || 'unknown';
  return {
    sessionId: `meeting-${meetingId}-${seed.tabId}`,
    meetingId,
    meetingUrl: seed.meetingUrl,
    pageTitle: seed.pageTitle,
    tabId: seed.tabId,
    status: 'loading',
    captureState: 'idle',
    createdAt: now,
    updatedAt: now,
    participants: [],
    shareActive: false,
    selfSharing: 'unknown',
    durationMs: 0,
    digest: {
      status: 'idle',
    },
    insights: {
      summary: 'Meeting Pilot is waiting for the first useful signal.',
      currentTopic: 'Waiting for context',
      chapters: [],
      actions: [],
      decisions: [],
      memoryReferences: [],
      observations: [],
      alerts: [],
      transcript: [],
    },
  };
}

export function deriveMeetingStatus(signals: MeetingDomSignals, captureState: MeetingSession['captureState']): MeetingStatus {
  if (!signals.inMeeting) {
    return 'completed';
  }
  if (captureState === 'recording') {
    return 'recording';
  }
  return 'in_meeting';
}

export function applyDomSignals(session: MeetingSession, signals: MeetingDomSignals, now = Date.now()): MeetingSession {
  const nextDuration = session.startedAt ? now - session.startedAt : session.durationMs;
  return {
    ...session,
    pageTitle: signals.pageTitle || session.pageTitle,
    updatedAt: now,
    activeSpeaker: signals.activeSpeaker,
    shareOwner: signals.shareOwner,
    shareActive: signals.shareActive,
    selfSharing: signals.selfSharing,
    participants: signals.participants,
    status: deriveMeetingStatus(signals, session.captureState),
    startedAt: session.startedAt || (signals.inMeeting ? now : undefined),
    endedAt: !signals.inMeeting ? now : undefined,
    durationMs: Math.max(0, nextDuration || 0),
    insights: {
      ...session.insights,
      summary: buildSessionSummary(signals, session.captureState),
      currentTopic: signals.shareActive ? 'Shared screen review' : session.insights.currentTopic || 'Live discussion',
    },
  };
}

export function updateCaptureState(session: MeetingSession, captureState: MeetingSession['captureState'], now = Date.now()): MeetingSession {
  return {
    ...session,
    captureState,
    updatedAt: now,
    status: captureState === 'recording' ? 'recording' : session.status,
  };
}

export function buildSessionSummary(signals: MeetingDomSignals, captureState: MeetingSession['captureState']): string {
  const parts: string[] = [];
  parts.push(signals.shareActive ? `${signals.shareOwner || 'Someone'} is sharing the screen.` : 'No active screen share is detected.');
  if (signals.activeSpeaker) {
    parts.push(`Current speaker: ${signals.activeSpeaker}.`);
  }
  parts.push(captureState === 'recording' ? 'Meeting Pilot is recording.' : 'Meeting Pilot is ready to record.');
  return parts.join(' ');
}
