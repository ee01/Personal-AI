import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  transcript: 'Speaker',
  caption: 'Caption',
  dom: 'DOM',
  roster: 'Roster',
  continuity: '沿用',
  ai: 'AI',
  user: '用户',
};

const TRANSCRIPT_SOURCE_LABEL: Record<
  NonNullable<MeetingPilotTranscriptChunk['source']>,
  string
> = {
  ringcentral_transcript: 'RC Transcript',
  web_speech: 'On-Device',
  desktop_whisper: 'Local ASR',
  cloud: 'Cloud',
  whisper: 'Whisper',
  test: 'Test',
};

const ASR_SOURCE_LABEL: Record<MeetingPilotASRTier | 'whisper', string> = {
  ringcentral_transcript: 'RingCentral Transcript',
  web_speech: 'Chrome On-Device',
  desktop_whisper: 'Local ASR',
  cloud: 'Cloud',
  whisper: 'Whisper',
};

const ASR_BADGE_LABEL: Record<
  NonNullable<MeetingPilotSessionSnapshot['tier']>['badge'],
  string
> = {
  Probing: '检测中',
  'RC Transcript': 'RingCentral Transcript',
  'On-Device': 'Chrome On-Device',
  'Local ASR': 'Local ASR',
  'Local Whisper': 'Local ASR',
  Cloud: 'Cloud',
  'No ASR': 'No ASR',
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
  const tierBadge = session.tier?.badge;
  const activeLabel = activeTier ? ASR_SOURCE_LABEL[activeTier] : undefined;
  const badgeLabel = tierBadge ? ASR_BADGE_LABEL[tierBadge] : undefined;
  const lastSourceLabel =
    lastSuccess?.source && lastSuccess.source !== 'test'
      ? ASR_SOURCE_LABEL[lastSuccess.source]
      : undefined;
  const dependencyReady =
    session.readiness?.dependencies?.transcription?.status === 'ready';
  const configured =
    successCount > 0 ||
    Boolean(activeTier) ||
    dependencyReady ||
    tierBadge === 'Cloud' ||
    tierBadge === 'RC Transcript' ||
    tierBadge === 'Local ASR' ||
    tierBadge === 'Local Whisper' ||
    tierBadge === 'On-Device' ||
    tierBadge === 'No ASR';
  const tierIsStillTrying = Boolean(activeTier) || tierBadge === 'Probing';
  const tierHasFailed = tierBadge === 'No ASR';
  const readinessError =
    successCount === 0 &&
    !tierIsStillTrying &&
    session.readiness?.dependencies?.transcription?.status !== 'ready'
      ? session.readiness?.dependencies?.transcription?.message
      : undefined;
  const lastError =
    session.capture?.lastError ||
    (tierHasFailed ? session.tier?.lastTransitionReason : undefined) ||
    readinessError;
  return {
    configured,
    label:
      (activeLabel === 'Local ASR' && session.tier?.lastTransitionReason?.startsWith('Local ASR')
        ? session.tier.lastTransitionReason
        : activeLabel) ||
      lastSourceLabel ||
      badgeLabel ||
      (configured ? 'ASR Ready' : '未配置'),
    successCount,
    lastSuccessTs: lastSuccess?.ts,
    lastError,
  };
}

function truncateUiText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function speechSuggestionSourceLabel(
  source: NonNullable<MeetingPilotSessionSnapshot['speechSuggestion']>['source'],
): string {
  switch (source) {
    case 'memory':
      return '基于记忆';
    case 'transcript_memory':
      return '基于最近讨论 + 记忆';
    case 'profile':
      return '基于身份记忆';
    case 'session_context':
      return '基于本场上下文';
    case 'transcript':
      return '基于最近讨论';
    default:
      return '建议';
  }
}

function emptySpeechSuggestionText(
  session: MeetingPilotSessionSnapshot,
): string {
  const recentText = session.transcript
    .slice(-4)
    .map((chunk) => chunk.text)
    .join(' ');
  return /[A-Za-z]{2,}/.test(recentText) && !/[\u3400-\u9fff]/.test(recentText)
    ? 'Nothing to add yet.'
    : '先听一下，暂时不用插话。';
}

function SpeechSuggestionPanel(props: {
  session: MeetingPilotSessionSnapshot;
  refresh: () => Promise<void>;
  now: number;
}) {
  const { session, refresh, now } = props;
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const suggestion = session.speechSuggestion;
  const isStale = Boolean(suggestion?.expiresAt && suggestion.expiresAt < now);
  const displayText = suggestion?.text || emptySpeechSuggestionText(session);
  const context = session.speechGuidanceContext;
  const sessionNotes = context?.sessionNotes || [];
  const evidenceCount = suggestion?.evidenceRefs?.length || 0;
  const metaParts = [
    suggestion ? speechSuggestionSourceLabel(suggestion.source) : '等待上下文',
    suggestion?.confidence !== undefined
      ? `置信度 ${Math.round(suggestion.confidence * 100)}%`
      : undefined,
    evidenceCount ? `${evidenceCount} 条依据` : undefined,
    isStale ? '可能已过时' : undefined,
  ].filter(Boolean);

  const clearStatus = () => {
    setMessage('');
    setError('');
  };

  const copySuggestion = async () => {
    clearStatus();
    try {
      await navigator.clipboard.writeText(displayText);
      setMessage('已复制');
    } catch {
      setError('复制失败');
    }
  };

  const forceRefresh = async () => {
    clearStatus();
    setRefreshing(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_REFRESH_SPEECH_SUGGESTION',
        tabId: session.tabId,
        meetingId: session.meetingId,
      })) as { success?: boolean; error?: string };
      if (!response?.success) {
        throw new Error(response?.error || '刷新失败');
      }
      setMessage('已刷新');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const saveContext = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    clearStatus();
    setSaving(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_UPSERT_SPEECH_CONTEXT',
        tabId: session.tabId,
        meetingId: session.meetingId,
        text,
      })) as { success?: boolean; message?: string; error?: string };
      if (!response?.success) {
        throw new Error(response?.message || response?.error || '保存失败');
      }
      setDraft('');
      setMessage(response.message || '已用于本次会议');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const clearNote = async (noteId: string) => {
    clearStatus();
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_CLEAR_SPEECH_CONTEXT_NOTE',
        tabId: session.tabId,
        meetingId: session.meetingId,
        noteId,
      })) as { success?: boolean; error?: string };
      if (!response?.success) {
        throw new Error(response?.error || '移除失败');
      }
      setMessage('已移除');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除失败');
    }
  };

  return (
    <div className={`speech-suggestion-card${isStale ? ' stale' : ''}`}>
      <div className="speech-suggestion-kicker">我现在可以说</div>
      <div className="speech-suggestion-main">
        <div className="speech-suggestion-text">{displayText}</div>
        <div className="speech-suggestion-actions">
          <button
            type="button"
            className="speech-suggestion-icon-btn"
            onClick={() => void copySuggestion()}
            title="复制话术"
          >
            复制
          </button>
          <button
            type="button"
            className="speech-suggestion-icon-btn"
            onClick={() => void forceRefresh()}
            disabled={refreshing}
            title="重新生成"
          >
            {refreshing ? '刷新中' : '刷新'}
          </button>
        </div>
      </div>
      <div className="speech-suggestion-meta">
        {metaParts.join(' · ')}
      </div>
      <div className="speech-context-row">
        <button
          type="button"
          className="speech-context-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起身份/上下文' : '补充身份/上下文'}
        </button>
        {sessionNotes.length ? (
          <span className="speech-meta">本场已补充 {sessionNotes.length} 条</span>
        ) : null}
        {message ? <span className="speech-context-message">{message}</span> : null}
        {error ? <span className="speech-context-error">{error}</span> : null}
      </div>
      {expanded ? (
        <div className="speech-context-editor">
          <textarea
            className="speech-context-input"
            rows={3}
            value={draft}
            placeholder="例如：我是 mobile 项目的 tech lead；或：本次会议需要提醒 mobile 项目的风险。"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="speech-context-editor-actions">
            <button
              type="button"
              className="speech-context-save"
              disabled={!draft.trim() || saving}
              onClick={() => void saveContext()}
            >
              {saving ? '判断中...' : '保存并刷新建议'}
            </button>
          </div>
          {sessionNotes.length ? (
            <div className="speech-context-note-list">
              {sessionNotes.map((note) => (
                <span key={note.id} className="speech-context-note">
                  <span>{truncateUiText(note.text, 58)}</span>
                  <button
                    type="button"
                    onClick={() => void clearNote(note.id)}
                    title="移除本场上下文"
                  >
                    移除
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AnimatedTranscriptText(props: { text: string; stableId?: string }) {
  const previousTextByIdRef = useRef(new Map<string, string>());
  const stableId = props.stableId || '__default__';
  const previousText = previousTextByIdRef.current.get(stableId) || '';
  const animatedFromIndex = props.text.startsWith(previousText)
    ? previousText.length
    : 0;

  useEffect(() => {
    previousTextByIdRef.current.set(stableId, props.text);
  }, [props.text, stableId]);

  const chars = useMemo(() => Array.from(props.text), [props.text]);
  return (
    <span className="speech-fade-text" aria-label={props.text}>
      {chars.map((char, index) => {
        const shouldAnimate = index >= animatedFromIndex;
        const delayMs = shouldAnimate
          ? Math.min((index - animatedFromIndex) * 18, 1200)
          : 0;
        return (
          <span
            aria-hidden="true"
            className={`speech-fade-char${shouldAnimate ? '' : ' visible'}`}
            key={`${stableId}-${index}-${char}`}
            style={
              shouldAnimate ? { animationDelay: `${delayMs}ms` } : undefined
            }
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
    return (
      <AnimatedTranscriptText
        stableId={props.turn.id}
        text={props.turn.text}
      />
    );
  }

  return (
    <>
      {chunks.map((chunk, index) => (
        <React.Fragment key={chunk.id}>
          {index > 0 ? <span className="speech-chunk-gap"> </span> : null}
          <span className="speech-chunk" data-source={chunk.source || 'unknown'}>
            <AnimatedTranscriptText stableId={chunk.id} text={chunk.text} />
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

function getTurnTranscriptSources(
  turn: MeetingPilotTranscriptTurn,
  chunkById: Map<string, MeetingPilotTranscriptChunk>,
): NonNullable<MeetingPilotTranscriptChunk['source']>[] {
  const sources = new Set<NonNullable<MeetingPilotTranscriptChunk['source']>>();
  turn.chunkIds.forEach((id) => {
    const source = chunkById.get(id)?.source;
    if (source) sources.add(source);
  });
  return Array.from(sources);
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
      <SpeechSuggestionPanel session={session} refresh={refresh} now={now} />

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
            const transcriptSources = getTurnTranscriptSources(
              turn,
              chunkById,
            );
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
                  <SourceBadges
                    sources={turn.resolutionSources}
                    transcriptSources={transcriptSources}
                  />
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

function SourceBadges(props: {
  sources: MeetingPilotSpeakerSource[];
  transcriptSources: NonNullable<MeetingPilotTranscriptChunk['source']>[];
}) {
  const speakerSources = props.sources.filter((src) => src !== 'transcript');
  if (!props.transcriptSources?.length && !speakerSources.length) return null;
  return (
    <span className="speech-source-badges">
      {props.transcriptSources.map((src) => (
        <span key={src} className={`speech-source-badge src-${src}`}>
          {TRANSCRIPT_SOURCE_LABEL[src] || src}
        </span>
      ))}
      {speakerSources.map((src) => (
        <span key={src} className={`speech-source-badge src-${src}`}>
          {SOURCE_LABEL[src] || src}
        </span>
      ))}
    </span>
  );
}

export default SpeechTab;
