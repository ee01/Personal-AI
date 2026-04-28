import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  MeetingPilotParticipant,
  MeetingPilotASRTier,
  MeetingPilotSessionSnapshot,
  MeetingPilotSpeakerSource,
  MeetingPilotTranscriptChunk,
  MeetingPilotTranscriptTurn,
} from './protocol';

interface SpeechTabProps {
  session: MeetingPilotSessionSnapshot;
  refresh: () => Promise<void>;
}

const SOURCE_LABEL: Record<MeetingPilotSpeakerSource, string> = {
  transcript: 'Transcript',
  caption: 'Caption',
  dom: 'DOM',
  roster: 'Roster',
  continuity: '沿用',
  ai: 'AI',
  user: '用户',
};

const ASR_SOURCE_LABEL: Record<MeetingPilotASRTier | 'whisper', string> = {
  web_speech: 'On-Device',
  desktop_whisper: 'Local Whisper',
  cloud: 'Cloud',
  whisper: 'Whisper',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

function formatRange(start: number, end: number): string {
  const left = formatTime(start);
  if (end - start < 60_000) return left;
  return `${left}-${formatTime(end)}`;
}

function timeSinceLabel(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s 前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m 前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h 前`;
}

function asrStatus(session: MeetingPilotSessionSnapshot): {
  configured: boolean;
  label: string;
  successCount: number;
  lastSuccessTs?: number;
  lastError?: string;
} {
  const asrChunks = session.transcript.filter((c) =>
    Boolean(c.source && c.source !== 'test'),
  );
  const successCount = asrChunks.length;
  const lastSuccess = [...session.transcript]
    .reverse()
    .find((c) => c.source && c.source !== 'test');
  const activeTier = session.tier?.activeTier || null;
  const activeLabel = activeTier ? ASR_SOURCE_LABEL[activeTier] : undefined;
  const lastSourceLabel =
    lastSuccess?.source && lastSuccess.source !== 'test'
      ? ASR_SOURCE_LABEL[lastSuccess.source]
      : undefined;
  const dependencyReady =
    session.readiness?.dependencies?.whisper?.status === 'ready';
  const configured =
    successCount > 0 ||
    Boolean(activeTier) ||
    dependencyReady ||
    session.tier?.badge === 'Cloud' ||
    session.tier?.badge === 'Local Whisper' ||
    session.tier?.badge === 'On-Device';
  const lastError =
    session.capture?.lastError ||
    (successCount === 0 && session.readiness?.dependencies?.whisper?.status !== 'ready'
      ? session.readiness?.dependencies?.whisper?.message
      : undefined);
  return {
    configured,
    label:
      activeLabel ||
      lastSourceLabel ||
      (configured ? '已连接' : '未配置'),
    successCount,
    lastSuccessTs: lastSuccess?.ts,
    lastError,
  };
}

function AnimatedTranscriptText(props: { text: string }) {
  const chars = useMemo(() => Array.from(props.text), [props.text]);
  return (
    <span className="speech-fade-text" aria-label={props.text}>
      {chars.map((char, index) => {
        const delayMs = Math.min(index * 18, 1200);
        return (
          <span
            aria-hidden="true"
            className="speech-fade-char"
            key={`${index}-${char}`}
            style={{ animationDelay: `${delayMs}ms` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        );
      })}
    </span>
  );
}

function TurnTranscriptText(props: {
  turn: MeetingPilotTranscriptTurn;
  chunkById: Map<string, MeetingPilotTranscriptChunk>;
}) {
  const chunks = props.turn.chunkIds
    .map((id) => props.chunkById.get(id))
    .filter((chunk): chunk is MeetingPilotTranscriptChunk => Boolean(chunk));

  if (!chunks.length) {
    return <AnimatedTranscriptText text={props.turn.text} />;
  }

  return (
    <>
      {chunks.map((chunk, index) => (
        <React.Fragment key={chunk.id}>
          {index > 0 ? <span className="speech-chunk-gap"> </span> : null}
          <span className="speech-chunk" data-source={chunk.source || 'unknown'}>
            <AnimatedTranscriptText text={chunk.text} />
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

interface RenameInputProps {
  initial: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

function RenameInput(props: RenameInputProps) {
  const [value, setValue] = useState(props.initial);
  return (
    <span className="speech-rename-row">
      <input
        autoFocus
        className="speech-rename-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            props.onSubmit(value.trim());
          } else if (e.key === 'Escape') {
            props.onCancel();
          }
        }}
      />
      <button
        className="speech-rename-confirm"
        onClick={() => props.onSubmit(value.trim())}
      >
        确认
      </button>
      <button className="speech-rename-cancel" onClick={props.onCancel}>
        取消
      </button>
    </span>
  );
}

function ParticipantStancePanel(props: {
  participant: MeetingPilotParticipant;
}) {
  const { participant } = props;
  const stances = participant.stances || [];
  return (
    <div className="speech-stance-panel">
      <div className="speech-stance-header">
        <strong>{participant.name}</strong>
        <span className="speech-meta">
          发言占比 {Math.max(0, Math.min(100, participant.speakingPct || 0))}%
        </span>
        {participant.resolutionState ? (
          <span className="speech-meta">{participant.resolutionState}</span>
        ) : null}
      </div>
      {stances.length ? (
        <ul className="speech-stance-list">
          {stances.map((stance, idx) => (
            <li key={`${stance.topic}-${idx}`} className="speech-stance-item">
              <span className={`speech-stance-tag stance-${stance.stance}`}>
                {stance.stance}
              </span>
              <span className="speech-stance-topic">{stance.topic}</span>
              <span className="speech-stance-quote">「{stance.keyQuote}」</span>
              {stance.timeRange ? (
                <span className="speech-meta">{stance.timeRange}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">尚未识别到该参会人的明确立场。</div>
      )}
    </div>
  );
}

export function SpeechTab(props: SpeechTabProps) {
  const { session, refresh } = props;
  const [now, setNow] = useState(() => Date.now());
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const turns = useMemo(
    () => [...session.transcriptTurns].sort((a, b) => b.startTs - a.startTs),
    [session.transcriptTurns],
  );

  const participantById = useMemo(() => {
    const map = new Map<string, MeetingPilotParticipant>();
    session.participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [session.participants]);

  const chunkById = useMemo(() => {
    const map = new Map<string, MeetingPilotTranscriptChunk>();
    session.transcript.forEach((chunk) => map.set(chunk.id, chunk));
    return map;
  }, [session.transcript]);

  const status = asrStatus(session);

  const sendRename = async (participantId: string, newName: string) => {
    if (!newName) {
      setRenamingId(null);
      return;
    }
    await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_RENAME_PARTICIPANT',
      tabId: session.tabId,
      meetingId: session.meetingId,
      participantId,
      newName,
    });
    setRenamingId(null);
    await refresh();
  };

  const onSpeakerClick = async (participantId: string) => {
    setActiveParticipantId(
      activeParticipantId === participantId ? null : participantId,
    );
    try {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_FOCUS_PARTICIPANT',
        tabId: session.tabId,
        meetingId: session.meetingId,
        participantId,
      });
    } catch {
      // best effort
    }
  };

  const activeParticipant = activeParticipantId
    ? participantById.get(activeParticipantId)
    : undefined;

  return (
    <div className="speech-tab">
      <div className="speech-status-card">
        <div>
          <strong>ASR:</strong>{' '}
          {status.configured ? status.label : '未配置'}
        </div>
        <div>
          {status.successCount > 0
            ? `已转写 ${status.successCount} 条` +
              (status.lastSuccessTs
                ? ` · 最近 ${timeSinceLabel(status.lastSuccessTs, now)}`
                : '')
            : '等待首条转写'}
        </div>
        {status.lastError ? (
          <div className="speech-error">最近错误: {status.lastError}</div>
        ) : null}
      </div>

      {turns.length ? (
        <div className="speech-turn-list">
          {turns.map((turn) => {
            const participant = participantById.get(turn.participantId);
            const displayName =
              participant?.name || turn.speakerNameSnapshot || '说话人';
            const isRenaming = renamingId === turn.participantId;
            const isActive = activeParticipantId === turn.participantId;
            return (
              <div
                key={turn.id}
                className={`speech-turn-card${isActive ? ' active' : ''}`}
              >
                <div className="speech-turn-header">
                  {isRenaming ? (
                    <RenameInput
                      initial={displayName}
                      onCancel={() => setRenamingId(null)}
                      onSubmit={(value) =>
                        sendRename(turn.participantId, value)
                      }
                    />
                  ) : (
                    <button
                      className="speech-speaker-btn"
                      onClick={() => onSpeakerClick(turn.participantId)}
                      title="点击查看立场详情"
                    >
                      {displayName}
                    </button>
                  )}
                  <SourceBadges sources={turn.resolutionSources} />
                  <span className="speech-meta">
                    {formatRange(turn.startTs, turn.endTs)}
                  </span>
                  {turn.lowConfidence ? (
                    <span className="speech-meta speech-lowconf" title="低置信度">
                      ●
                    </span>
                  ) : null}
                  {!isRenaming ? (
                    <button
                      className="speech-rename-btn"
                      onClick={() => setRenamingId(turn.participantId)}
                      title="重命名发言人"
                    >
                      重命名
                    </button>
                  ) : null}
                </div>
                <div className="speech-turn-body">
                  <TurnTranscriptText turn={turn} chunkById={chunkById} />
                </div>
                {isActive && participant ? (
                  <ParticipantStancePanel participant={participant} />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          当前还没有发言记录。开启录制后，按发言人聚合的 turn 会出现在这里。
        </div>
      )}

      {activeParticipant && !turns.some((t) => activeParticipantId === t.participantId) ? (
        <ParticipantStancePanel participant={activeParticipant} />
      ) : null}
    </div>
  );
}

function SourceBadges(props: { sources: MeetingPilotSpeakerSource[] }) {
  if (!props.sources?.length) return null;
  return (
    <span className="speech-source-badges">
      {props.sources.map((src) => (
        <span key={src} className={`speech-source-badge src-${src}`}>
          {SOURCE_LABEL[src] || src}
        </span>
      ))}
    </span>
  );
}

export default SpeechTab;
