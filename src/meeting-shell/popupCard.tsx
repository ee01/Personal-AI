import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  extractMeetingIdFromUrl,
  MeetingPilotSessionSnapshot,
  MeetingPilotStateResponse,
} from './protocol';

const style = document.createElement('style');
style.textContent = `
  .mp-card {
    border-radius: 18px;
    padding: 14px;
    margin-bottom: 10px;
    background: radial-gradient(circle at top left, rgba(108,92,231,0.22), transparent 36%), #101521;
    border: 1px solid rgba(148,163,184,0.16);
    color: #eef2ff;
    box-shadow: 0 16px 40px rgba(15,23,42,0.16);
  }
  .mp-card.meeting {
    display: grid;
    gap: 12px;
  }
  .mp-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .mp-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #a5b4fc;
    font-size: 10px;
    margin-bottom: 6px;
  }
  .mp-title {
    font-size: 16px;
    font-weight: 800;
    line-height: 1.25;
  }
  .mp-subtitle {
    margin-top: 4px;
    color: rgba(226,232,240,0.68);
    font-size: 11px;
    line-height: 1.5;
  }
  .mp-pill {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(148,163,184,0.12);
    border: 1px solid rgba(148,163,184,0.16);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .mp-pill.live {
    background: rgba(34,197,94,0.12);
    border-color: rgba(34,197,94,0.24);
    color: #86efac;
  }
  .mp-summary {
    border-radius: 14px;
    background: rgba(148,163,184,0.08);
    border: 1px solid rgba(148,163,184,0.12);
    padding: 12px;
    color: rgba(226,232,240,0.84);
    font-size: 12px;
    line-height: 1.6;
  }
  .mp-launch {
    width: 100%;
    border: none;
    border-radius: 14px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #ff9f43, #ff7f50);
    color: #101521;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 14px 28px rgba(255, 127, 80, 0.22);
  }
  .mp-launch:disabled {
    opacity: 0.62;
    cursor: progress;
    box-shadow: none;
  }
  .mp-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .mp-actions button {
    border: none;
    border-radius: 12px;
    padding: 10px 12px;
    background: linear-gradient(135deg, rgba(108,92,231,0.92), rgba(139,124,247,0.98));
    color: white;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .mp-actions button:nth-child(2), .mp-actions button:nth-child(4) {
    background: rgba(148,163,184,0.12);
    border: 1px solid rgba(148,163,184,0.16);
    color: rgba(226,232,240,0.92);
  }
  .mp-actions button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .mp-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: rgba(226,232,240,0.62);
    font-size: 11px;
  }
`;

if (!document.getElementById('meeting-pilot-popup-style')) {
  style.id = 'meeting-pilot-popup-style';
  document.head.appendChild(style);
}

type PopupMeetingContext = {
  tabId: number;
  meetingId: string;
  url: string;
  title: string;
};

type PopupSessionView = PopupMeetingContext & {
  captureKind: string;
  transcriptPilotActive: boolean;
  canStartCapture: boolean;
  readinessStatus: 'ready' | 'blocked' | 'degraded';
  readinessSummary: string;
  digestStatus: string;
  chunkCount: number;
  participantCount: number;
  startedAt?: number;
  detectedAt?: number;
};

function safeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSession(
  session: MeetingPilotSessionSnapshot | null | undefined,
): MeetingPilotSessionSnapshot | undefined {
  if (!session || typeof session !== 'object') {
    return undefined;
  }
  return session;
}

function normalizeStateResponse(
  state: MeetingPilotStateResponse | null | undefined,
  tabId?: number,
): MeetingPilotStateResponse {
  const sessions = Array.isArray(state?.sessions)
    ? state.sessions
        .map((item) => normalizeSession(item))
        .filter((item): item is MeetingPilotSessionSnapshot => Boolean(item))
    : [];
  const activeSession = normalizeSession(state?.activeSession);
  const scopedActiveSession =
    (typeof tabId === 'number'
      ? sessions.find((item) => item.tabId === tabId)
      : undefined) ||
    activeSession ||
    sessions[0];

  return {
    activeMeetingId:
      safeText(scopedActiveSession?.meetingId) || safeText(state?.activeMeetingId),
    sessions,
    activeSession: scopedActiveSession,
  };
}

function toMeetingContext(
  tabId?: number,
  url?: string,
  title?: string,
): PopupMeetingContext | null {
  if (!Number.isFinite(tabId) || !tabId) {
    return null;
  }
  const safeUrl = safeText(url);
  const meetingId = extractMeetingIdFromUrl(safeUrl);
  if (!meetingId) {
    return null;
  }
  return {
    tabId,
    meetingId,
    url: safeUrl,
    title: safeText(title, 'RingCentral meeting'),
  };
}

function toSessionView(
  session: MeetingPilotSessionSnapshot | null | undefined,
  fallbackContext?: PopupMeetingContext | null,
): PopupSessionView | null {
  const rawSession = normalizeSession(session);
  const tabId =
    safeNumber(rawSession?.tabId, fallbackContext?.tabId || 0) || fallbackContext?.tabId;
  const url = safeText(rawSession?.url, fallbackContext?.url || '');
  const meetingId =
    safeText(rawSession?.meetingId, extractMeetingIdFromUrl(url || fallbackContext?.url) || '') ||
    fallbackContext?.meetingId ||
    '';

  if (!tabId || !meetingId) {
    return fallbackContext
      ? {
          ...fallbackContext,
          captureKind: 'idle',
          canStartCapture: true,
          readinessStatus: 'ready',
          readinessSummary:
            '从这个 popup 发起浏览器录制授权，再自动打开 Meeting Pilot 面板。',
          digestStatus: 'idle',
          chunkCount: 0,
          participantCount: 0,
        }
      : null;
  }

  const readiness =
    rawSession?.readiness && typeof rawSession.readiness === 'object'
      ? rawSession.readiness
      : undefined;
  const capture =
    rawSession?.capture && typeof rawSession.capture === 'object'
      ? rawSession.capture
      : undefined;
  const digest =
    rawSession?.digest && typeof rawSession.digest === 'object'
      ? rawSession.digest
      : undefined;
  const participants = Array.isArray(rawSession?.participants)
    ? rawSession.participants
    : [];
  const readinessStatus =
    safeText(readiness?.status) === 'blocked'
      ? 'blocked'
      : safeText(readiness?.status) === 'degraded'
        ? 'degraded'
        : 'ready';

  return {
    tabId,
    meetingId,
    url: safeText(url, fallbackContext?.url || ''),
    title: safeText(rawSession?.title, fallbackContext?.title || 'RingCentral meeting'),
    captureKind: safeText(capture?.kind, 'idle'),
    transcriptPilotActive: Boolean(
      rawSession?.webTranscript?.active &&
        rawSession.transcript.some(
          (chunk) => chunk.source === 'ringcentral_transcript',
        ),
    ),
    canStartCapture:
      readinessStatus !== 'blocked' &&
      (typeof readiness?.canStartCapture === 'boolean'
        ? readiness.canStartCapture
        : true),
    readinessStatus,
    readinessSummary: safeText(
      readiness?.summary,
      fallbackContext
        ? '从这个 popup 发起浏览器录制授权，再自动打开 Meeting Pilot 面板。'
        : 'Meeting Pilot 正在准备会议状态。',
    ),
    digestStatus: safeText(digest?.status, 'idle'),
    chunkCount: safeNumber(capture?.chunkCount, 0),
    participantCount:
      safeNumber(rawSession?.participantCount, 0) || participants.length,
    startedAt: safeNumber(capture?.startedAt, 0) || undefined,
    detectedAt: safeNumber(rawSession?.detectedAt, 0) || undefined,
  };
}

function resolveLaunchLabel(view: PopupSessionView): string {
  if (view.captureKind === 'recording') {
    return '打开 Meeting Pilot';
  }
  if (!view.canStartCapture) {
    return '去配置 Meeting Pilot';
  }
  if (view.transcriptPilotActive) {
    return '启用画面理解与纪要';
  }
  if (view.captureKind === 'error') {
    return '重试开启会议全貌';
  }
  if (view.captureKind === 'stopped') {
    return '重新开启会议全貌';
  }
  return '开启会议全貌';
}

function resolveStatusLabel(view: PopupSessionView): string {
  if (view.captureKind === 'recording') {
    return 'Recording';
  }
  if (view.transcriptPilotActive) {
    return 'Transcript';
  }
  if (view.readinessStatus === 'blocked') {
    return 'Blocked';
  }
  if (view.readinessStatus === 'degraded') {
    return 'Degraded';
  }
  return 'Ready';
}

export function MeetingPilotPopupCard({
  tabId,
  initialUrl,
  initialTitle,
}: {
  tabId?: number;
  initialUrl?: string;
  initialTitle?: string;
}) {
  const initialContext = useMemo(
    () => toMeetingContext(tabId, initialUrl, initialTitle),
    [initialTitle, initialUrl, tabId],
  );
  const [state, setState] = useState<MeetingPilotStateResponse | null>(null);
  const [launching, setLaunching] = useState(false);
  const [tabContext, setTabContext] = useState<PopupMeetingContext | null>(
    initialContext,
  );

  useEffect(() => {
    setTabContext(initialContext);
  }, [initialContext]);

  useEffect(() => {
    const refresh = async () => {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_GET_STATE',
        tabId,
      })) as MeetingPilotStateResponse;
      setState(normalizeStateResponse(response, tabId));
      if (!tabId) {
        return;
      }
      try {
        const tab = await chrome.tabs.get(tabId);
        const nextContext = toMeetingContext(tabId, tab.url, tab.title);
        if (nextContext) {
          setTabContext(nextContext);
        }
      } catch (error) {
        console.warn('Meeting Pilot popup could not resolve active tab:', error);
      }
    };

    void refresh();

    const listener = (message: any) => {
      if (message.type !== 'MEETING_PILOT_SESSION_SNAPSHOT') {
        return;
      }
      const incoming = normalizeSession(
        message.snapshot as MeetingPilotSessionSnapshot,
      );
      if (!incoming) {
        return;
      }
      if (typeof tabId === 'number' && incoming.tabId !== tabId) {
        return;
      }
      setState((current) => {
        const priorSessions = Array.isArray(current?.sessions) ? current.sessions : [];
        const existingIndex = priorSessions.findIndex(
          (item) => item.tabId === incoming.tabId,
        );
        const nextSessions = [...priorSessions];
        if (existingIndex >= 0) {
          nextSessions[existingIndex] = incoming;
        } else {
          nextSessions.push(incoming);
        }
        nextSessions.sort(
          (left, right) => safeNumber(right.updatedAt) - safeNumber(left.updatedAt),
        );
        return normalizeStateResponse(
          {
            activeMeetingId: safeText(incoming.meetingId),
            sessions: nextSessions,
            activeSession:
              typeof tabId === 'number'
                ? nextSessions.find((item) => item.tabId === tabId) || incoming
                : incoming,
          },
          tabId,
        );
      });
      const nextContext = toMeetingContext(
        incoming.tabId,
        safeText(incoming.url),
        safeText(incoming.title, 'RingCentral meeting'),
      );
      if (nextContext) {
        setTabContext(nextContext);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId]);

  const currentSession = useMemo(() => {
    if (!state) {
      return undefined;
    }
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    if (typeof tabId === 'number') {
      return (
        sessions.find((item) => item.tabId === tabId) ||
        normalizeSession(state.activeSession)
      );
    }
    return normalizeSession(state.activeSession) || sessions[0];
  }, [state, tabId]);

  const view = useMemo(
    () => toSessionView(currentSession, tabContext),
    [currentSession, tabContext],
  );

  if (!view) {
    return null;
  }

  const launchLabel = resolveLaunchLabel(view);
  const statusLabel = resolveStatusLabel(view);
  const isRecording = view.captureKind === 'recording';
  const canOpenLowPowerPanel = isRecording || view.transcriptPilotActive;

  const startCapture = async () => {
    if (launching) {
      return;
    }
    setLaunching(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL',
        tabId: view.tabId,
        meetingId: view.meetingId,
        url: view.url,
        title: view.title,
        source: 'popup-start',
      })) as
        | {
            success?: boolean;
            session?: MeetingPilotSessionSnapshot;
          }
        | undefined;

      if (response?.session) {
        setState((prev) => {
          const priorSessions = Array.isArray(prev?.sessions) ? prev.sessions : [];
          const nextSessions = [...priorSessions];
          const existingIndex = nextSessions.findIndex(
            (item) => item.tabId === response.session?.tabId,
          );
          if (existingIndex >= 0) {
            nextSessions[existingIndex] = response.session;
          } else {
            nextSessions.unshift(response.session);
          }
          return normalizeStateResponse(
            {
              activeMeetingId: safeText(response.session.meetingId),
              sessions: nextSessions,
              activeSession: response.session,
            },
            tabId,
          );
        });
      }

      if (response?.success) {
        window.close();
      }
    } finally {
      setLaunching(false);
    }
  };

  const openSidePanel = async () => {
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_OPEN_SIDE_PANEL',
      tabId: view.tabId,
    });
    window.close();
  };

  const stopCapture = async () => {
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_STOP_CAPTURE',
      tabId: view.tabId,
      meetingId: view.meetingId,
    });
  };

  const openMeetingOptions = async () => {
    if (chrome?.runtime?.openOptionsPage) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    await chrome.tabs.create({
      url: chrome.runtime.getURL('options.html#meeting-pilot-config'),
      active: true,
    });
  };

  const openPanorama = async () => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(
        `meeting-panorama.html?meetingId=${encodeURIComponent(view.meetingId)}&tabId=${view.tabId}`,
      ),
      active: true,
    });
  };

  const handleLaunchClick = async () => {
    if (isRecording) {
      await openSidePanel();
      return;
    }
    if (!view.canStartCapture) {
      await openMeetingOptions();
      return;
    }
    await startCapture();
  };

  return (
    <div className="mp-card meeting">
      <div className="mp-head">
        <div>
          <div className="mp-eyebrow">Meeting Pilot</div>
          <div className="mp-title">会议全貌</div>
          <div className="mp-subtitle">
            {safeText(view.title, 'RingCentral meeting')}
            <br />
            {view.meetingId}
          </div>
        </div>
        <div className={`mp-pill ${canOpenLowPowerPanel ? 'live' : ''}`}>{statusLabel}</div>
      </div>
      <div className="mp-summary">{view.readinessSummary}</div>
      {/* English: Start Meeting Pilot */}
      <button
        className="mp-launch"
        onClick={handleLaunchClick}
        disabled={launching}
      >
        {launching ? '正在开启…' : launchLabel}
      </button>
      <div className="mp-actions">
        <button onClick={openSidePanel} disabled={!canOpenLowPowerPanel}>
          打开面板
        </button>
        <button onClick={openPanorama} disabled={!currentSession}>
          Panorama
        </button>
        <button onClick={stopCapture} disabled={!isRecording}>
          停止录制
        </button>
        <button onClick={openMeetingOptions}>设置</button>
      </div>
      <div className="mp-footer">
        <span>
          {isRecording
            ? `${view.chunkCount} chunks`
            : `${view.participantCount} people · ${view.digestStatus}`}
        </span>
        <span>
          {Math.max(
            0,
            Math.round(
              (Date.now() - (view.startedAt || view.detectedAt || Date.now())) / 1000,
            ),
          )}
          s
        </span>
      </div>
    </div>
  );
}
