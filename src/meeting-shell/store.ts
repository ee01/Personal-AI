import {
  MEETING_PILOT_STORAGE_KEY,
  MeetingPilotAlert,
  MeetingPilotCaptureState,
  MeetingPilotDetectionPayload,
  MeetingPilotSessionSnapshot,
  createDefaultCaptureState,
  createDefaultReadinessState,
  createMeetingPilotSessionSnapshot,
} from './protocol';

type StoragePayload = {
  sessions: MeetingPilotSessionSnapshot[];
};

interface SessionSummaryFields {
  summary: string;
  shareSummary?: string;
  speakerSummary?: string;
}

export function buildSessionSummaryFields(
  payload: MeetingPilotDetectionPayload,
  existing?: MeetingPilotSessionSnapshot,
): SessionSummaryFields {
  let shareSummary: string | undefined;
  if (payload.shareState === 'active') {
    shareSummary = payload.selfSharing
      ? 'You are sharing your screen.'
      : `${payload.sharerName || 'Someone'} is sharing their screen.`;
  } else if (payload.shareState === 'minimized') {
    shareSummary = 'A shared application is minimized.';
  } else {
    shareSummary = 'No active screen share is detected.';
  }

  const speakerSummary = payload.speakerLabel
    ? `Current speaker: ${payload.speakerLabel}.`
    : undefined;

  const summaryParts: string[] = [];
  if (payload.participantCount) {
    summaryParts.push(`${payload.participantCount} participants detected.`);
  }
  if (existing?.capture.kind === 'recording') {
    summaryParts.push('Meeting Pilot is recording this meeting.');
  } else {
    summaryParts.push('Open the panel to start capture or follow the live map.');
  }

  return {
    summary: summaryParts.join(' '),
    shareSummary,
    speakerSummary,
  };
}

export class MeetingPilotRegistry {
  private sessions = new Map<number, MeetingPilotSessionSnapshot>();
  private activeMeetingId?: string;
  private hydrated = false;
  private hydratePromise: Promise<void> | null = null;

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    if (!this.hydratePromise) {
      this.hydratePromise = (async () => {
        const payload = await chrome.storage.local.get([
          MEETING_PILOT_STORAGE_KEY,
        ]);
        const stored = payload[MEETING_PILOT_STORAGE_KEY] as
          | StoragePayload
          | undefined;
        const sessions = stored?.sessions || [];
        this.sessions.clear();
        sessions.forEach((session) => {
          this.sessions.set(session.tabId, session);
          if (!this.activeMeetingId && session.status !== 'ended') {
            this.activeMeetingId = session.meetingId;
          }
        });
        this.hydrated = true;
      })();
    }
    await this.hydratePromise;
  }

  private async persist(): Promise<void> {
    const sessions = Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    await chrome.storage.local.set({
      [MEETING_PILOT_STORAGE_KEY]: { sessions },
    });
  }

  listSessions(): MeetingPilotSessionSnapshot[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  getActiveMeetingId(): string | undefined {
    return this.activeMeetingId;
  }

  getSessionByTabId(tabId: number): MeetingPilotSessionSnapshot | undefined {
    return this.sessions.get(tabId);
  }

  getSessionByMeetingId(
    meetingId: string,
  ): MeetingPilotSessionSnapshot | undefined {
    return this.listSessions().find(
      (session) => session.meetingId === meetingId,
    );
  }

  getActiveSession(): MeetingPilotSessionSnapshot | undefined {
    if (!this.activeMeetingId) {
      return undefined;
    }
    return this.listSessions().find(
      (session) => session.meetingId === this.activeMeetingId,
    );
  }

  async removeByTabId(
    tabId: number,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    const session = this.sessions.get(tabId);
    if (!session) return undefined;
    const shouldMarkCaptureStopped =
      session.capture.kind === 'armed' || session.capture.kind === 'recording';
    const ended = {
      ...session,
      status: 'ended' as const,
      inMeeting: false,
      endedAt: Date.now(),
      updatedAt: Date.now(),
      capture: shouldMarkCaptureStopped
        ? {
            ...session.capture,
            kind: 'stopped' as const,
            stoppedAt: Date.now(),
          }
        : session.capture,
    };
    this.sessions.set(tabId, ended);
    if (this.activeMeetingId === session.meetingId) {
      this.activeMeetingId = undefined;
    }
    await this.persist();
    return ended;
  }

  async upsertDetection(
    payload: MeetingPilotDetectionPayload,
  ): Promise<MeetingPilotSessionSnapshot> {
    await this.hydrate();
    const existing = this.sessions.get(payload.tabId);
    const reusableExisting =
      existing?.meetingId === payload.meetingId ? existing : undefined;
    const createdAt =
      reusableExisting?.detectedAt || payload.detectedAt || Date.now();
    const snapshot: MeetingPilotSessionSnapshot = {
      ...(reusableExisting ||
        createMeetingPilotSessionSnapshot({
          meetingId: payload.meetingId,
          tabId: payload.tabId,
          url: payload.url,
          title: payload.title,
          detectedAt: createdAt,
        })),
      meetingId: payload.meetingId,
      tabId: payload.tabId,
      url: payload.url,
      title: payload.title || reusableExisting?.title || 'RingCentral meeting',
      status: payload.inMeeting
        ? reusableExisting?.status === 'recording'
          ? 'recording'
          : 'ready'
        : 'ended',
      inMeeting: payload.inMeeting,
      shareState: payload.shareState,
      selfSharing: payload.selfSharing,
      sharerName: payload.sharerName || reusableExisting?.sharerName,
      speakerLabel: payload.speakerLabel || reusableExisting?.speakerLabel,
      participantCount:
        payload.participantCount ?? reusableExisting?.participantCount ?? 0,
      participants: payload.participants?.length
        ? payload.participants
        : reusableExisting?.participants || [],
      capture: reusableExisting?.capture || createDefaultCaptureState(),
      digest: reusableExisting?.digest || { status: 'idle' },
      readiness: reusableExisting?.readiness || createDefaultReadinessState(),
      alerts: reusableExisting?.alerts || [],
      chapters: reusableExisting?.chapters || [],
      currentTopic:
        reusableExisting?.currentTopic ||
        (payload.shareState === 'active'
          ? 'Shared screen review'
          : payload.speakerLabel
            ? `${payload.speakerLabel} speaking`
            : 'Live discussion'),
      actionItems: reusableExisting?.actionItems || [],
      decisions: reusableExisting?.decisions || [],
      timelineEvents: reusableExisting?.timelineEvents || [],
      transcript: reusableExisting?.transcript || [],
      transcriptTurns: reusableExisting?.transcriptTurns || [],
      memoryRefs: reusableExisting?.memoryRefs || [],
      sidePanelPinned: reusableExisting?.sidePanelPinned ?? false,
      ...(() => {
        const fields = buildSessionSummaryFields(payload, reusableExisting);
        return {
          summary: fields.summary,
          shareSummary: fields.shareSummary,
          speakerSummary: fields.speakerSummary,
        };
      })(),
      timelineProgress: reusableExisting?.timelineProgress ?? 0,
      detectedAt: createdAt,
      updatedAt: payload.detectedAt || Date.now(),
    };
    if (!snapshot.inMeeting) {
      snapshot.endedAt = snapshot.endedAt || Date.now();
    }
    this.sessions.set(payload.tabId, snapshot);
    this.activeMeetingId = snapshot.inMeeting
      ? snapshot.meetingId
      : this.activeMeetingId === snapshot.meetingId
        ? undefined
        : this.activeMeetingId;
    await this.persist();
    return snapshot;
  }

  async updateSession(
    tabId: number,
    updater: (
      session: MeetingPilotSessionSnapshot,
    ) => MeetingPilotSessionSnapshot,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    await this.hydrate();
    const current = this.sessions.get(tabId);
    if (!current) return undefined;
    const next = updater(current);
    next.updatedAt = Date.now();
    this.sessions.set(tabId, next);
    if (next.inMeeting) {
      this.activeMeetingId = next.meetingId;
    }
    await this.persist();
    return next;
  }

  async setCaptureState(
    tabId: number,
    capture: Partial<MeetingPilotCaptureState>,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    return this.updateSession(tabId, (session) => ({
      ...session,
      capture: {
        ...session.capture,
        ...capture,
      },
      status:
        capture.kind === 'recording'
          ? 'recording'
          : capture.kind === 'error'
            ? 'error'
            : session.inMeeting
              ? 'ready'
              : session.status,
    }));
  }

  async addAlert(
    tabId: number,
    alert: MeetingPilotAlert,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    return this.updateSession(tabId, (session) => ({
      ...session,
      alerts: [alert, ...session.alerts].slice(0, 20),
    }));
  }

  async updateDigest(
    tabId: number,
    digest: Partial<MeetingPilotSessionSnapshot['digest']>,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    return this.updateSession(tabId, (session) => ({
      ...session,
      digest: {
        ...session.digest,
        ...digest,
      },
    }));
  }

  async updateSummary(
    tabId: number,
    summary: string,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    return this.updateSession(tabId, (session) => ({
      ...session,
      summary,
    }));
  }

  async updateTranscript(
    tabId: number,
    transcript: MeetingPilotSessionSnapshot['transcript'],
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    return this.updateSession(tabId, (session) => ({
      ...session,
      transcript,
    }));
  }

  async updateObservation(
    tabId: number,
    data: Partial<MeetingPilotSessionSnapshot>,
  ): Promise<MeetingPilotSessionSnapshot | undefined> {
    return this.updateSession(tabId, (session) => ({
      ...session,
      ...data,
      capture: data.capture || session.capture,
      readiness: data.readiness || session.readiness,
      alerts: data.alerts || session.alerts,
      chapters: data.chapters || session.chapters,
      currentTopic: data.currentTopic || session.currentTopic,
      actionItems: data.actionItems || session.actionItems,
      decisions: data.decisions || session.decisions,
      timelineEvents: data.timelineEvents || session.timelineEvents,
      participants: data.participants || session.participants,
      transcript: data.transcript || session.transcript,
      transcriptTurns: data.transcriptTurns || session.transcriptTurns,
      memoryRefs: data.memoryRefs || session.memoryRefs,
    }));
  }
}
