import * as React from 'react';

import {
  MeetingPilotCaptureLogEntry,
  MeetingPilotSessionSnapshot,
} from './protocol';

const captureLogStyle = `
  .debug-panel { display: flex; flex-direction: column; gap: 10px; }
  .debug-section {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }
  .debug-section .ds-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent-light);
    margin-bottom: 6px;
  }
  .debug-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 11px;
    padding: 4px 0;
    color: var(--text-dim);
    border-bottom: 1px solid rgba(46,51,64,0.5);
  }
  .debug-row:last-child { border-bottom: none; }
  .debug-row .dv {
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--text);
    text-align: right;
  }
  .debug-log {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .debug-log-entry {
    font-size: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(15,23,42,0.4);
    font-family: 'SF Mono', monospace;
    color: var(--text-muted);
    border-left: 2px solid var(--border);
    line-height: 1.45;
    white-space: pre-wrap;
  }
  .debug-log-entry.info { border-left-color: var(--accent-light); }
  .debug-log-entry.request { border-left-color: var(--accent); }
  .debug-log-entry.response { border-left-color: var(--p2-color); }
  .debug-log-entry.error { border-left-color: var(--p0-color); color: #ffb4b4; }
  .debug-log-entry .dl-ts { color: var(--text-muted); margin-right: 6px; }
`;

type Props = {
  session: MeetingPilotSessionSnapshot;
  captureLogEntries: MeetingPilotCaptureLogEntry[];
  readinessStatusLabel: string;
  currentTopicLabel: string;
};

export default function CaptureLogTab({
  session,
  captureLogEntries,
  readinessStatusLabel,
  currentTopicLabel,
}: Props) {
  return (
    <div className="debug-panel">
      <style>{captureLogStyle}</style>
      <div className="debug-section">
        <div className="ds-title">Capture State</div>
        <div className="debug-row">
          <span>Status</span>
          <span className="dv">{session.capture.kind}</span>
        </div>
        <div className="debug-row">
          <span>Last Error</span>
          <span className="dv">{session.capture.lastError || '—'}</span>
        </div>
        <div className="debug-row">
          <span>Stream ID</span>
          <span className="dv">{session.capture.streamId || '—'}</span>
        </div>
        <div className="debug-row">
          <span>Chunks</span>
          <span className="dv">{session.capture.chunkCount}</span>
        </div>
        <div className="debug-row">
          <span>Blob Size</span>
          <span className="dv">
            {Math.round((session.capture.blobSize || 0) / 1024)} KB
          </span>
        </div>
        <div className="debug-row">
          <span>Duration</span>
          <span className="dv">
            {Math.max(
              0,
              Math.round(
                ((session.capture.stoppedAt || Date.now()) -
                  (session.capture.startedAt || session.detectedAt)) /
                  1000,
              ),
            )}
            s
          </span>
        </div>
      </div>

      <div className="debug-section">
        <div className="ds-title">Latest Screenshot OCR Result</div>
        <div className="empty-state">
          {session.latestObservationText ||
            '当前还没有可展示的共享画面观察 / OCR 结果。'}
        </div>
      </div>

      <div className="debug-section">
        <div className="ds-title">Latest Summary Context</div>
        <div className="debug-row">
          <span>Topic</span>
          <span className="dv">{currentTopicLabel}</span>
        </div>
        <div className="debug-row">
          <span>Digest</span>
          <span className="dv">{session.digest.status}</span>
        </div>
        <div className="debug-row">
          <span>Readiness</span>
          <span className="dv">{readinessStatusLabel}</span>
        </div>
        <div className="debug-row">
          <span>Memory refs</span>
          <span className="dv">{session.memoryRefs.length}</span>
        </div>
      </div>

      <div className="debug-section">
        <div className="ds-title">Structured Parse Result</div>
        <div className="debug-log">
          <div className="debug-log-entry info">
            {session.latestStructuredParse
              ? JSON.stringify(session.latestStructuredParse, null, 2)
              : '当前还没有结构化解析结果。'}
          </div>
        </div>
      </div>

      <div className="debug-section">
        <div className="ds-title">Capture Log</div>
        <div className="debug-log">
          {captureLogEntries.length ? (
            captureLogEntries
              .slice()
              .reverse()
              .map((entry) => (
                <div
                  className={`debug-log-entry ${entry.level}`}
                  key={entry.id}
                >
                  <span className="dl-ts">
                    {new Date(entry.ts).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  {entry.message}
                </div>
              ))
          ) : (
            <div className="empty-state">
              当前还没有 Capture Log。开启录制后，这里会显示转写、上传和 digest
              请求轨迹。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
