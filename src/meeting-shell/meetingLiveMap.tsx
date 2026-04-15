import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useMemo } from 'react';
import { getDemoMeetingSessionSnapshot } from './demo';
import {
  MeetingPilotSessionSnapshot,
  createMeetingPilotSessionSnapshot,
} from './protocol';
import {
  getRequestedTabId,
  useMeetingPilotState,
} from './useMeetingPilotState';

const liveStyle = `
  :root {
    color-scheme: dark;
    --bg: #071019;
    --surface: rgba(10, 18, 28, 0.86);
    --surface-2: rgba(15, 25, 39, 0.92);
    --line: rgba(148, 163, 184, 0.16);
    --text: #eef6ff;
    --muted: rgba(221, 232, 245, 0.68);
    --accent: #4ade80;
    --accent-2: #60a5fa;
    --warning: #fbbf24;
    --danger: #fb7185;
    --violet: #a78bfa;
  }

  html, body {
    margin: 0;
    min-height: 100%;
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--text);
    background:
      radial-gradient(circle at top left, rgba(96, 165, 250, 0.18), transparent 24%),
      radial-gradient(circle at top right, rgba(167, 139, 250, 0.16), transparent 24%),
      linear-gradient(180deg, #050b12 0%, #09111c 100%);
  }

  #meeting-live-map-root { min-height: 100vh; }
  .page { padding: 24px; display: grid; gap: 16px; }
  .hero {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 22px 24px;
    border-radius: 26px;
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(10, 18, 28, 0.96));
    border: 1px solid var(--line);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
  }
  .eyebrow { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #93c5fd; margin-bottom: 10px; }
  .hero h1 { margin: 0; font-size: 30px; }
  .hero p { margin: 10px 0 0; max-width: 780px; color: var(--muted); line-height: 1.65; }
  .status-stack { min-width: 240px; display: grid; gap: 10px; }
  .pill {
    padding: 10px 12px;
    border-radius: 999px;
    background: rgba(74, 222, 128, 0.12);
    border: 1px solid rgba(74, 222, 128, 0.28);
    color: #bbf7d0;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .grid { display: grid; grid-template-columns: 280px minmax(0, 1fr) 320px; gap: 16px; }
  .panel {
    border-radius: 24px;
    background: var(--surface);
    border: 1px solid var(--line);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.26);
    padding: 18px;
    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  }
  .panel:hover { border-color: rgba(96,165,250,0.24); box-shadow: 0 22px 56px rgba(0, 0, 0, 0.3); }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #bfdbfe; margin-bottom: 14px; }
  .stepper { display: grid; gap: 12px; }
  .step { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 12px; padding: 12px; border-radius: 18px; background: rgba(148, 163, 184, 0.06); border: 1px solid transparent; transition: all 0.2s; }
  .step.active { background: rgba(96, 165, 250, 0.12); border-color: rgba(96, 165, 250, 0.28); }
  .step:hover { border-color: rgba(96, 165, 250, 0.22); transform: translateX(2px); }
  .dot { width: 12px; height: 12px; border-radius: 999px; margin-top: 6px; background: rgba(148, 163, 184, 0.5); }
  .step.active .dot { background: var(--accent); box-shadow: 0 0 16px rgba(74, 222, 128, 0.6); }
  .step strong { display: block; font-size: 14px; margin-bottom: 6px; }
  .step span { color: var(--muted); font-size: 12px; line-height: 1.55; }
  .chapter-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
  .chapter-header h2 { margin: 0; font-size: 24px; }
  .chip { border-radius: 999px; padding: 8px 12px; background: rgba(167, 139, 250, 0.12); border: 1px solid rgba(167, 139, 250, 0.28); color: #ddd6fe; font-size: 12px; font-weight: 700; }
  .chapter-summary { color: var(--muted); line-height: 1.7; margin-bottom: 18px; }
  .chapter-views { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .subcard { border-radius: 18px; padding: 16px; background: var(--surface-2); border: 1px solid var(--line); transition: all 0.2s; }
  .subcard:hover { border-color: rgba(167, 139, 250, 0.26); transform: translateY(-1px); }
  .subcard h3 { margin: 0 0 12px; font-size: 14px; }
  .subcard ul { margin: 0; padding-left: 18px; color: var(--muted); line-height: 1.7; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; color: var(--muted); }
  th, td { padding: 9px 10px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); text-align: left; }
  th { color: #dbeafe; font-weight: 600; }
  .alert-stack, .meta-list { display: grid; gap: 12px; }
  .alert { border-radius: 18px; padding: 14px 15px; border: 1px solid rgba(148, 163, 184, 0.18); background: rgba(148, 163, 184, 0.08); transition: all 0.2s; }
  .alert.p0 { background: rgba(251, 113, 133, 0.12); border-color: rgba(251, 113, 133, 0.34); }
  .alert.p1 { background: rgba(251, 191, 36, 0.12); border-color: rgba(251, 191, 36, 0.3); }
  .alert:hover { transform: translateX(2px); }
  .alert h4 { margin: 0 0 8px; font-size: 13px; }
  .alert p, .meta-item p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--muted); }
  .meta-item { border-radius: 18px; padding: 14px 15px; background: var(--surface-2); border: 1px solid var(--line); transition: all 0.2s; }
  .meta-item:hover { border-color: rgba(96,165,250,0.22); transform: translateX(2px); }
  .meta-item strong { display: block; margin-bottom: 8px; font-size: 13px; }
  .action-row { display: flex; gap: 10px; margin-top: 14px; }
  .action-row button {
    flex: 1;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid rgba(96,165,250,0.24);
    background: linear-gradient(135deg, rgba(96,165,250,0.18), rgba(12,18,31,0.94));
    color: white;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .action-row button.secondary { background: rgba(148,163,184,0.12); border-color: rgba(148,163,184,0.18); }
  .action-row button:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.18); }
  .empty { padding: 12px; border-radius: 14px; background: rgba(148,163,184,0.08); color: var(--muted); font-size: 12px; }
  @media (max-width: 1120px) {
    .grid { grid-template-columns: 1fr; }
    .chapter-views { grid-template-columns: 1fr; }
    .hero { flex-direction: column; }
    .status-stack { min-width: 0; }
  }
`;

function getCurrentChapter(session: MeetingPilotSessionSnapshot) {
  if (!session.chapters.length) return undefined;
  const index = Math.min(
    session.chapters.length - 1,
    Math.max(
      0,
      Math.floor((session.timelineProgress || 0) * session.chapters.length),
    ),
  );
  return session.chapters[index];
}

function formatElapsed(startedAt?: number, fallback?: number) {
  const base = startedAt || fallback;
  if (!base) return '--:--';
  const totalSeconds = Math.max(0, Math.floor((Date.now() - base) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function buildPanoramaUrl(session: MeetingPilotSessionSnapshot) {
  const params = new URLSearchParams({
    tabId: String(session.tabId),
    meetingId: session.meetingId,
  });
  return chrome.runtime.getURL(`meeting-panorama.html?${params.toString()}`);
}

function formatTranscriptTime(ts?: number) {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLatestTranscriptLabel(session: MeetingPilotSessionSnapshot) {
  const latest = session.transcript.slice(-1)[0];
  if (!latest) return '暂无 transcript';
  return `${latest.speaker} · ${formatTranscriptTime(latest.ts)}`;
}

function shouldUseMeetingPilotDemo() {
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

function MeetingLiveMap() {
  const [state, refresh] = useMeetingPilotState();
  const requestedTabId = getRequestedTabId();
  const session =
    (requestedTabId
      ? (state?.activeSession?.tabId === requestedTabId
          ? state.activeSession
          : undefined) ||
        state?.sessions.find((item) => item.tabId === requestedTabId) ||
        state?.activeSession
      : state?.activeSession) ||
    (shouldUseMeetingPilotDemo()
      ? getDemoMeetingSessionSnapshot(0)
      : createMeetingPilotSessionSnapshot({
          meetingId: 'unbound',
          tabId: requestedTabId || 0,
          url: '',
          title: 'Meeting Pilot',
        }));
  const chapter = useMemo(() => getCurrentChapter(session), [session]);
  const activeAlerts = session.alerts.filter((alert) => !alert.resolved);
  const chapterEvents = session.timelineEvents.filter(
    (event) => !chapter || event.chapterId === chapter.id,
  );

  return (
    <div className="page">
      <style>{liveStyle}</style>
      <section className="hero">
        <div>
          <div className="eyebrow">Meeting Pilot / Live Meeting Map</div>
          <h1>{session.title}</h1>
          <p>{session.summary}</p>
          <div className="action-row">
            <button onClick={refresh}>Refresh</button>
            <button
              className="secondary"
              onClick={() =>
                chrome.runtime.sendMessage({
                  type: 'MEETING_PILOT_OPEN_SIDE_PANEL',
                  tabId: session.tabId,
                })
              }
            >
              打开面板
            </button>
            <button
              className="secondary"
              onClick={() =>
                chrome.tabs.create({
                  url: buildPanoramaUrl(session),
                  active: true,
                })
              }
            >
              Panorama
            </button>
          </div>
        </div>
        <div className="status-stack">
          <div className="pill">
            Recording ·{' '}
            {formatElapsed(session.capture.startedAt, session.detectedAt)}
          </div>
          <div
            className="pill"
            style={{
              background: 'rgba(96,165,250,0.12)',
              borderColor: 'rgba(96,165,250,0.28)',
              color: '#bfdbfe',
            }}
          >
            Speaker · {session.speakerLabel || 'unknown'}
          </div>
          <div
            className="pill"
            style={{
              background: 'rgba(167,139,250,0.12)',
              borderColor: 'rgba(167,139,250,0.28)',
              color: '#ddd6fe',
            }}
          >
            Sharer ·{' '}
            {session.sharerName || (session.selfSharing ? 'You' : 'unknown')}
          </div>
        </div>
      </section>

      <section className="grid">
        <aside className="panel">
          <div className="section-title">Chapter Stepper</div>
          <div className="stepper">
            {session.chapters.length ? (
              session.chapters.map((item, index) => (
                <div
                  className={`step ${item.id === chapter?.id ? 'active' : ''}`}
                  key={item.id}
                >
                  <div className="dot" />
                  <div>
                    <strong>
                      {index + 1}. {item.title}
                    </strong>
                    <span>{item.summary}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                当前 transcript 还不足以形成稳定章节，继续录制后会自动细化。
              </div>
            )}
          </div>
        </aside>

        <main className="panel">
          <div className="section-title">Current Chapter</div>
          <div className="chapter-header">
            <div>
              <h2>{chapter?.title || session.currentTopic}</h2>
              <div className="chapter-summary">
                {chapter?.summary || session.summary}
              </div>
            </div>
            <div className="chip">
              View mode · {chapter?.viewMode || 'outline + table'}
            </div>
          </div>

          <div className="chapter-views">
            <section className="subcard">
              <h3>Outline</h3>
              {chapterEvents.length ? (
                <ul>
                  {chapterEvents.slice(0, 4).map((event) => (
                    <li key={event.id}>
                      {event.title} — {event.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">当前章节的 outline 还在生成中。</div>
              )}
            </section>

            <section className="subcard">
              <h3>Structured Table</h3>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {session.actionItems.length ? (
                    session.actionItems.slice(0, 3).map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td>{item.owner}</td>
                        <td>{item.status}</td>
                        <td>{item.deadline || 'TBD'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>当前还没有结构化条目。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </main>

        <aside className="panel">
          <div className="section-title">Alerts and Context</div>
          <div className="alert-stack">
            {activeAlerts.length ? (
              activeAlerts.slice(0, 3).map((alert) => (
                <div
                  className={`alert ${alert.level === 'P0' ? 'p0' : 'p1'}`}
                  key={alert.id}
                >
                  <h4>
                    {alert.level} · {alert.title}
                  </h4>
                  <p>{alert.body}</p>
                </div>
              ))
            ) : (
              <div className="empty">当前没有新的高优先级提醒。</div>
            )}
          </div>

          <div className="section-title" style={{ marginTop: 18 }}>
            Right Rail
          </div>
          <div className="meta-list">
            <div className="meta-item">
              <strong>Actions</strong>
              <p>
                {session.actionItems.length
                  ? session.actionItems
                      .slice(0, 2)
                      .map((item) => `${item.owner}：${item.title}`)
                      .join('；')
                  : '当前章节暂无新的待处理行动项。'}
              </p>
            </div>
            <div className="meta-item">
              <strong>Digest</strong>
              <p>
                Status: {session.digest.status}。
                {session.digest.message ||
                  '录制停止后会自动上传视频并轮询 digest 结果。'}
              </p>
            </div>
            <div className="meta-item">
              <strong>Memory refresh</strong>
              <p>
                {session.memoryRefs.length
                  ? `已命中 ${session.memoryRefs.length} 条相关记忆，Top1: ${session.memoryRefs[0].title || session.memoryRefs[0].snippet}`
                  : `当前尚未命中相关记忆。最新会中片段：${getLatestTranscriptLabel(session)}`}
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

const container = document.getElementById('meeting-live-map-root');
if (container) {
  ReactDOM.render(<MeetingLiveMap />, container);
}
