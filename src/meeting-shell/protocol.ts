export const MEETING_PILOT_HOST_PREFIX = 'https://v.ringcentral.com/conf/on/';

export type MeetingPilotASRTier =
  | 'ringcentral_transcript'
  | 'web_speech'
  | 'desktop_whisper'
  | 'cloud';

export function normalizeTranscriptSource(
  value: string | undefined,
):
  | 'whisper'
  | 'cloud'
  | 'web_speech'
  | 'desktop_whisper'
  | 'ringcentral_transcript'
  | 'test'
  | undefined {
  if (value === 'whisper') return 'cloud';
  if (
    value === 'cloud' ||
    value === 'web_speech' ||
    value === 'desktop_whisper' ||
    value === 'ringcentral_transcript' ||
    value === 'test'
  ) {
    return value;
  }
  return undefined;
}
export const MEETING_PILOT_SIDE_PANEL_PATH = 'meeting-sidepanel.html';
export const MEETING_PILOT_LIVE_MAP_PATH = 'meeting-live-map.html';
export const MEETING_PILOT_OFFSCREEN_PATH = 'meeting-offscreen.html';
export const MEETING_PILOT_STORAGE_KEY = 'meetingPilot.sessions';

export type MeetingPilotStatus =
  | 'detected'
  | 'ready'
  | 'recording'
  | 'ended'
  | 'error';
export type MeetingPilotShareState =
  | 'none'
  | 'active'
  | 'minimized'
  | 'unknown';
export type MeetingPilotCaptureStateKind =
  | 'idle'
  | 'armed'
  | 'recording'
  | 'stopped'
  | 'uploading'
  | 'completed'
  | 'error'
  | 'mock';
export type MeetingPilotAlertLevel = 'P0' | 'P1' | 'P2';
export type MeetingPilotViewMode = 'outline' | 'table' | 'flow' | 'mixed';
export type MeetingPilotReadinessKind = 'ready' | 'degraded' | 'blocked';

export interface MeetingPilotDependencyReadiness {
  status: MeetingPilotReadinessKind;
  message: string;
  checkedAt: number;
}

export interface MeetingPilotReadinessState {
  status: MeetingPilotReadinessKind;
  summary: string;
  canStartCapture: boolean;
  checkedAt: number;
  blockers: string[];
  degradations: string[];
  dependencies: {
    minutesApi: MeetingPilotDependencyReadiness;
    transcription: MeetingPilotDependencyReadiness;
    analysisModel: MeetingPilotDependencyReadiness;
    memoryService: MeetingPilotDependencyReadiness;
  };
}

export interface MeetingPilotCaptureState {
  kind: MeetingPilotCaptureStateKind;
  startedAt?: number;
  stoppedAt?: number;
  chunkCount: number;
  lastError?: string;
  streamId?: string;
  blobSize?: number;
}

export interface MeetingPilotCaptureLogEntry {
  id: string;
  ts: number;
  level: 'info' | 'request' | 'response' | 'error';
  message: string;
}

export type MeetingPilotSpeakerSource =
  | 'transcript'
  | 'caption'
  | 'dom'
  | 'roster'
  | 'continuity'
  | 'ai'
  | 'user';

export type MeetingPilotResolutionState =
  | 'roster'
  | 'provisional'
  | 'device'
  | 'user_named'
  | 'resolved';

export interface MeetingPilotParticipantResolution {
  fromId: string;
  toId: string;
  confidence: number;
  evidence?: string;
}

export interface MeetingPilotStructuredParseResult {
  topic: string;
  summary: string;
  actionItems: MeetingPilotActionItem[];
  decisions: MeetingPilotDecisionItem[];
  alerts: MeetingPilotAlert[];
  participantStances: Array<{
    participant: string;
    participantId?: string;
    topic: string;
    stance: MeetingPilotParticipantStance['stance'];
    keyQuote: string;
    timeRange?: string;
  }>;
  participantResolutions?: MeetingPilotParticipantResolution[];
  latestObservationText?: string;
}

export interface MeetingPilotDigestState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  taskId?: string;
  lookupId?: string;
  resultUrl?: string;
  videoUrl?: string;
  message?: string;
  errorCode?: string;
  updatedAt?: number;
}

export interface MeetingPilotAlert {
  id: string;
  level: MeetingPilotAlertLevel;
  title: string;
  body: string;
  source: 'mention' | 'memory' | 'share' | 'summary' | 'action';
  createdAt: number;
  resolved?: boolean;
}

export interface MeetingPilotChapter {
  id: string;
  title: string;
  summary: string;
  viewMode: MeetingPilotViewMode;
  startLabel: string;
  actionCount: number;
  decisionCount: number;
}

export interface MeetingPilotParticipant {
  id: string;
  name: string;
  role: string;
  speakingPct: number;
  isSelf?: boolean;
  isHost?: boolean;
  stances?: MeetingPilotParticipantStance[];
  resolutionState?: MeetingPilotResolutionState;
  resolutionConfidence?: number;
  sourceLabels?: MeetingPilotSpeakerSource[];
  aliases?: string[];
}

export interface MeetingPilotParticipantStance {
  topic: string;
  stance: '主导' | '支持' | '中立' | '质疑' | '反对';
  keyQuote: string;
  timeRange?: string;
}

export interface MeetingPilotActionItem {
  id: string;
  title: string;
  owner: string;
  deadline?: string;
  status: 'pending' | 'done';
  reviewState?: 'suggested' | 'confirmed' | 'dismissed';
  reviewedAt?: number;
  editedAt?: number;
  generatedTitle?: string;
  generatedOwner?: string;
  generatedDeadline?: string;
  chapterId?: string;
  evidence?: string;
  timestamp?: string;
  source?: 'llm' | 'heuristic';
}

export interface MeetingPilotDecisionItem {
  id: string;
  text: string;
  timestamp: string;
  chapterId?: string;
}

export interface MeetingPilotTimelineEvent {
  id: string;
  type: 'topic' | 'decision' | 'action' | 'mention' | 'screen';
  title: string;
  description: string;
  timestamp: string;
  speaker?: string;
  chapterId?: string;
}

export interface MeetingPilotMemoryRef {
  id: string;
  title: string;
  snippet: string;
  fullSnippet?: string;
  score: number;
  sourceLabel: string;
  sourceUrl?: string;
  /** Stable link into memory-exploring (Vue UI). */
  exploreLink?: string;
  /** Why this memory was matched (channel hits / context). */
  whyMatched?: string;
}

export type MeetingPilotSpeechSuggestionIntent =
  | 'answer_question'
  | 'add_context'
  | 'clarify'
  | 'status_update'
  | 'follow_up'
  | 'none';

export type MeetingPilotSpeechSuggestionSource =
  | 'transcript'
  | 'memory'
  | 'transcript_memory'
  | 'profile'
  | 'session_context'
  | 'fallback';

export interface MeetingPilotSpeechSuggestionEvidenceRef {
  kind: 'transcript' | 'turn' | 'memory' | 'profile' | 'session_context';
  id?: string;
  title?: string;
  snippet?: string;
}

export interface MeetingPilotSpeechSuggestion {
  text: string;
  language: string;
  intent: MeetingPilotSpeechSuggestionIntent;
  source: MeetingPilotSpeechSuggestionSource;
  confidence: number;
  evidenceRefs?: MeetingPilotSpeechSuggestionEvidenceRef[];
  updatedAt: number;
  expiresAt?: number;
}

export type MeetingPilotSpeechGuidanceClassificationScope =
  | 'long_term_profile'
  | 'session_only'
  | 'ignore';

export interface MeetingPilotSpeechGuidanceSessionNote {
  id: string;
  text: string;
  createdAt: number;
  sourceInput?: string;
}

export interface MeetingPilotSpeechGuidanceProfileRef {
  id: string;
  itemType: 'fact' | 'preference' | 'habit' | 'interest' | 'constraint';
  itemKey: string;
  itemValue: string;
  createdAt: number;
}

export interface MeetingPilotSpeechGuidanceContext {
  sessionNotes: MeetingPilotSpeechGuidanceSessionNote[];
  profileRefs: MeetingPilotSpeechGuidanceProfileRef[];
  lastInputText?: string;
  lastClassifiedAt?: number;
  lastClassificationScope?: MeetingPilotSpeechGuidanceClassificationScope;
  lastClassificationReason?: string;
  updatedAt?: number;
}

export interface MeetingPilotTranscriptChunk {
  id: string;
  /**
   * Resolved speaker display name. May be empty when upstream sources cannot
   * provide a name; the speaker resolver in background fills this in.
   */
  speaker: string;
  participantId?: string;
  resolutionSource?: MeetingPilotSpeakerSource;
  resolutionConfidence?: number;
  text: string;
  ts: number;
  source?:
    | 'whisper'
    | 'cloud'
    | 'web_speech'
    | 'desktop_whisper'
    | 'ringcentral_transcript'
    | 'test';
  lowConfidence?: boolean;
}

export interface MeetingPilotTranscriptTurn {
  id: string;
  participantId: string;
  speakerNameSnapshot: string;
  startTs: number;
  endTs: number;
  text: string;
  chunkIds: string[];
  resolutionSources: MeetingPilotSpeakerSource[];
  lowConfidence?: boolean;
}

export interface MeetingPilotSessionSnapshot {
  meetingId: string;
  tabId: number;
  url: string;
  title: string;
  status: MeetingPilotStatus;
  inMeeting: boolean;
  shareState: MeetingPilotShareState;
  selfSharing: boolean;
  micMuted?: boolean;
  sharerName?: string;
  speakerLabel?: string;
  participantCount: number;
  selfName?: string;
  capture: MeetingPilotCaptureState;
  digest: MeetingPilotDigestState;
  readiness: MeetingPilotReadinessState;
  alerts: MeetingPilotAlert[];
  chapters: MeetingPilotChapter[];
  currentTopic: string;
  actionItems: MeetingPilotActionItem[];
  decisions: MeetingPilotDecisionItem[];
  timelineEvents: MeetingPilotTimelineEvent[];
  participants: MeetingPilotParticipant[];
  transcript: MeetingPilotTranscriptChunk[];
  transcriptTurns: MeetingPilotTranscriptTurn[];
  memoryRefs: MeetingPilotMemoryRef[];
  webTranscript?: MeetingPilotWebTranscriptState;
  speechSuggestion?: MeetingPilotSpeechSuggestion;
  speechGuidanceContext?: MeetingPilotSpeechGuidanceContext;
  summary: string;
  shareSummary?: string;
  speakerSummary?: string;
  latestObservationText?: string;
  latestStructuredParse?: MeetingPilotStructuredParseResult;
  timelineProgress: number;
  sidePanelPinned?: boolean;
  detectedAt: number;
  updatedAt: number;
  endedAt?: number;
  tier?: MeetingPilotTierStatus;
}

export interface MeetingPilotWebTranscriptState {
  enabled: boolean;
  available: boolean;
  active: boolean;
  lastSeenAt?: number;
  latestChunkId?: string;
  lastError?: string;
}

export interface MeetingPilotDetectionPayload {
  meetingId: string;
  tabId: number;
  url: string;
  title: string;
  inMeeting: boolean;
  shareState: MeetingPilotShareState;
  selfSharing: boolean;
  micMuted?: boolean;
  participantCount?: number;
  participants?: MeetingPilotParticipant[];
  selfName?: string;
  sharerName?: string;
  speakerLabel?: string;
  notes?: string[];
  detectedAt?: number;
}

export interface MeetingPilotStateResponse {
  activeMeetingId?: string;
  sessions: MeetingPilotSessionSnapshot[];
  activeSession?: MeetingPilotSessionSnapshot;
}

export interface MeetingPilotStartCaptureRequest {
  meetingId: string;
  tabId: number;
  url: string;
  title?: string;
}

export interface MeetingPilotStopCaptureRequest {
  meetingId: string;
  tabId: number;
}

export interface MeetingPilotUpdateContextRequest {
  meetingId: string;
  tabId: number;
  url: string;
  title: string;
  inMeeting: boolean;
  shareState: MeetingPilotShareState;
  selfSharing: boolean;
  micMuted?: boolean;
  selfName?: string;
  sharerName?: string;
  speakerLabel?: string;
  summary?: string;
  notes?: string[];
}

export interface MeetingPilotOpenRequest {
  tabId: number;
}

export interface MeetingPilotPanelCommand {
  type:
    | 'MEETING_PILOT_OPEN_SIDE_PANEL'
    | 'MEETING_PILOT_CLOSE_SIDE_PANEL'
    | 'MEETING_PILOT_SET_SIDE_PANEL_PIN'
    | 'MEETING_PILOT_OPEN_EMBEDDED_PANEL'
    | 'MEETING_PILOT_CLOSE_EMBEDDED_PANEL'
    | 'MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL'
    | 'MEETING_PILOT_SHOW_CAPTURE_AUTH_GUIDE'
    | 'MEETING_PILOT_OPEN_LIVE_MAP'
    | 'MEETING_PILOT_START_CAPTURE'
    | 'MEETING_PILOT_STOP_CAPTURE'
    | 'MEETING_PILOT_GET_STATE'
    | 'MEETING_PILOT_REGISTER_TAB'
    | 'MEETING_PILOT_UPDATE_CONTEXT'
    | 'MEETING_PILOT_UPDATE_ALERTS'
    | 'MEETING_PILOT_RINGCENTRAL_TRANSCRIPT_STATUS'
    | 'MEETING_PILOT_OBSERVATION_UPDATE'
    | 'MEETING_PILOT_CAPTURE_STATUS'
    | 'MEETING_PILOT_DIGEST_STATUS'
    | 'MEETING_PILOT_GET_CAPTURE_LOG'
    | 'MEETING_PILOT_RENAME_PARTICIPANT'
    | 'MEETING_PILOT_MERGE_PARTICIPANTS'
    | 'MEETING_PILOT_FOCUS_PARTICIPANT'
    | 'MEETING_PILOT_UPSERT_SPEECH_CONTEXT'
    | 'MEETING_PILOT_CLEAR_SPEECH_CONTEXT_NOTE'
    | 'MEETING_PILOT_REFRESH_SPEECH_SUGGESTION'
    | 'MEETING_PILOT_TIER_STATUS_UPDATE'
    | 'MEETING_PILOT_TIER_FALLBACK_NOTICE';
  [key: string]: any;
}

export interface MeetingPilotTierStatus {
  activeTier: MeetingPilotASRTier | null;
  badge:
    | 'Probing'
    | 'RC Transcript'
    | 'On-Device'
    | 'Local ASR'
    | 'Local Whisper'
    | 'Cloud'
    | 'No ASR';
  mode: 'auto' | 'local-only' | 'cloud-only';
  lastTransitionAt?: number;
  lastTransitionReason?: string;
}

export function isValidTierTransition(
  from: MeetingPilotTierStatus['badge'],
  to: MeetingPilotTierStatus['badge'],
): boolean {
  const transitions: Record<
    MeetingPilotTierStatus['badge'],
    MeetingPilotTierStatus['badge'][]
  > = {
    Probing: ['RC Transcript', 'On-Device', 'Local ASR', 'Cloud', 'No ASR'],
    'RC Transcript': ['On-Device', 'Local ASR', 'Cloud', 'No ASR'],
    'On-Device': ['Local ASR', 'Cloud', 'No ASR'],
    'Local ASR': ['Cloud', 'No ASR'],
    'Local Whisper': ['Local ASR', 'Cloud', 'No ASR'],
    Cloud: ['No ASR'],
    'No ASR': [],
  };
  return transitions[from]?.includes(to) ?? false;
}

export interface MeetingPilotRenameParticipantRequest {
  tabId: number;
  meetingId?: string;
  participantId: string;
  newName: string;
}

export interface MeetingPilotMergeParticipantsRequest {
  tabId: number;
  meetingId?: string;
  fromId: string;
  toId: string;
}

export interface MeetingPilotFocusParticipantRequest {
  tabId: number;
  meetingId?: string;
  participantId: string;
}

const chapterSeed: MeetingPilotChapter[] = [
  {
    id: 'chapter-1',
    title: 'Kickoff and context',
    summary: 'Participants align on goal, scope, and current blockers.',
    viewMode: 'outline',
    startLabel: '00:00',
    actionCount: 1,
    decisionCount: 0,
  },
  {
    id: 'chapter-2',
    title: 'Shared screen review',
    summary:
      'The group walks through a screen share, likely a doc or dashboard.',
    viewMode: 'mixed',
    startLabel: '08:12',
    actionCount: 2,
    decisionCount: 1,
  },
  {
    id: 'chapter-3',
    title: 'Decision and actions',
    summary: 'Decisions are collected and owners are assigned.',
    viewMode: 'flow',
    startLabel: '18:40',
    actionCount: 3,
    decisionCount: 2,
  },
];

const timelineSeed: MeetingPilotTimelineEvent[] = [
  {
    id: 'timeline-1',
    type: 'topic',
    title: '会议开场 & 议程确认',
    description: 'Alex 对齐预算确认、排期评审、技术方案评审与跟进事项。',
    timestamp: '10:00',
    speaker: 'Alex Chen',
    chapterId: 'chapter-1',
  },
  {
    id: 'timeline-2',
    type: 'topic',
    title: 'Q2 预算讨论',
    description: 'Mike 展示预算方案，总额 200 万。',
    timestamp: '10:05',
    speaker: 'Mike Liu',
    chapterId: 'chapter-1',
  },
  {
    id: 'timeline-3',
    type: 'decision',
    title: 'Q2 预算确认为 200 万',
    description: '云服务 40%，人力成本 45%，弹性预算 15%。',
    timestamp: '10:15',
    chapterId: 'chapter-1',
  },
  {
    id: 'timeline-4',
    type: 'screen',
    title: '排期甘特图展示',
    description: 'Sarah 分享 Sprint 7-12 排期甘特图。',
    timestamp: '10:18',
    speaker: 'Sarah Wang',
    chapterId: 'chapter-2',
  },
  {
    id: 'timeline-5',
    type: 'topic',
    title: '排期评审 & Sprint 规划',
    description: '讨论 Phase 1 排期、QA 资源与 owner 变化。',
    timestamp: '10:20',
    speaker: 'Sarah Wang',
    chapterId: 'chapter-2',
  },
  {
    id: 'timeline-6',
    type: 'mention',
    title: 'Alex 提及你负责技术评审',
    description: '让 Esone 主导 Meeting Pilot 技术评审并输出评审文档。',
    timestamp: '10:28',
    speaker: 'Alex Chen',
    chapterId: 'chapter-2',
  },
  {
    id: 'timeline-7',
    type: 'action',
    title: '准备 Meeting Pilot 技术评审文档',
    description: 'DDL: 04-08，包含架构设计、技术选型与风险评估。',
    timestamp: '10:30',
    speaker: 'Alex Chen',
    chapterId: 'chapter-2',
  },
  {
    id: 'timeline-8',
    type: 'topic',
    title: '技术方案评审',
    description: '讨论 content script → offscreen → side panel 数据流。',
    timestamp: '10:35',
    speaker: 'Esone Qiu',
    chapterId: 'chapter-3',
  },
  {
    id: 'timeline-9',
    type: 'screen',
    title: '技术架构图分享',
    description: '展示 Meeting Pilot 架构设计与数据链路。',
    timestamp: '10:38',
    speaker: 'Esone Qiu',
    chapterId: 'chapter-3',
  },
  {
    id: 'timeline-10',
    type: 'decision',
    title: 'Meeting Pilot Phase 1 方案通过',
    description: 'Sprint 8 启动开发，Sprint 10 内部灰度。',
    timestamp: '10:45',
    chapterId: 'chapter-3',
  },
];

const actionSeed: MeetingPilotActionItem[] = [
  {
    id: 'action-1',
    title: '准备 Meeting Pilot 技术评审文档',
    owner: 'Esone',
    deadline: '04-08',
    status: 'pending',
    chapterId: 'chapter-2',
    evidence: 'Alex: 让 Esone 主导 Meeting Pilot 技术评审并输出评审文档。',
    timestamp: '10:30',
  },
  {
    id: 'action-2',
    title: '确认 QA 资源排期',
    owner: 'Sarah',
    deadline: '04-07',
    status: 'pending',
    chapterId: 'chapter-3',
    evidence: 'Sarah: 我会确认 QA 资源排期，避免 Sprint 8 开始后卡住。',
    timestamp: '10:42',
  },
  {
    id: 'action-3',
    title: '输出 Meeting Pilot 设计规范',
    owner: 'Esone',
    deadline: '04-10',
    status: 'pending',
    chapterId: 'chapter-3',
    evidence: 'Alex: 设计规范也需要 Esone 在 04-10 前输出，方便前端对齐。',
    timestamp: '10:48',
  },
  {
    id: 'action-4',
    title: '提交 Q2 预算明细到财务系统',
    owner: 'Mike',
    deadline: '04-05',
    status: 'done',
    chapterId: 'chapter-1',
    evidence: 'Mike: 我今天把 Q2 预算明细提交到财务系统。',
    timestamp: '10:15',
  },
];

const decisionSeed: MeetingPilotDecisionItem[] = [
  {
    id: 'decision-1',
    text: 'Q2 预算确认为 200 万（云服务 40%、人力 45%、弹性 15%）',
    timestamp: '10:15',
    chapterId: 'chapter-1',
  },
  {
    id: 'decision-2',
    text: 'Meeting Pilot Phase 1 技术方案通过，Sprint 8 启动开发',
    timestamp: '10:45',
    chapterId: 'chapter-3',
  },
  {
    id: 'decision-3',
    text: '技术评审定于下周三，由 Esone 主导',
    timestamp: '10:55',
    chapterId: 'chapter-3',
  },
];

const participantSeed: MeetingPilotParticipant[] = [
  {
    id: 'alex',
    name: 'Alex Chen',
    role: '主持人',
    speakingPct: 35,
    isHost: true,
    stances: [
      {
        topic: 'Q2 预算',
        stance: '主导',
        keyQuote: '“200万的预算分配需要今天敲定，云服务和人力的比例大家看下。”',
        timeRange: '📍 10:05 - 10:15',
      },
      {
        topic: '排期安排',
        stance: '支持',
        keyQuote: '“同意 Sarah 的排期方案，Sprint 8 正式启动开发。”',
        timeRange: '📍 10:20 - 10:30',
      },
      {
        topic: '技术评审分工',
        stance: '主导',
        keyQuote:
          '“让 Esone 负责 Meeting Pilot 的技术评审，下周三之前出评审文档。”',
        timeRange: '📍 10:28',
      },
    ],
  },
  {
    id: 'esone',
    name: 'Esone Qiu',
    role: '技术 Lead',
    speakingPct: 28,
    isSelf: true,
    stances: [
      {
        topic: '排期安排',
        stance: '质疑',
        keyQuote: '“QA 资源可能是瓶颈，建议提前 2 周锁定测试资源。”',
        timeRange: '📍 10:22',
      },
      {
        topic: '技术方案评审',
        stance: '主导',
        keyQuote:
          '“MV3 架构下 offscreen 方案可行，content script → offscreen → side panel 数据流已验证。”',
        timeRange: '📍 10:35 - 10:45',
      },
      {
        topic: 'Q2 预算',
        stance: '中立',
        keyQuote: '未在预算讨论中发表明确意见。',
        timeRange: '📍 10:05 - 10:15',
      },
    ],
  },
  {
    id: 'sarah',
    name: 'Sarah Wang',
    role: 'PM',
    speakingPct: 22,
    stances: [
      {
        topic: 'Q2 预算',
        stance: '支持',
        keyQuote: '“预算分配合理，建议弹性预算多留一些应对不确定性。”',
        timeRange: '📍 10:12',
      },
      {
        topic: '排期安排',
        stance: '主导',
        keyQuote:
          '“Sprint 7-12 排期已拉通，关键路径在技术评审和 QA 两个节点。”',
        timeRange: '📍 10:18 - 10:27',
      },
      {
        topic: '技术方案',
        stance: '支持',
        keyQuote: '“技术方案 OK，QA 资源我来协调。”',
        timeRange: '📍 10:45',
      },
    ],
  },
  {
    id: 'mike',
    name: 'Mike Liu',
    role: '财务',
    speakingPct: 15,
    stances: [
      {
        topic: 'Q2 预算',
        stance: '主导',
        keyQuote:
          '“云服务 40%、人力成本 45%、弹性预算 15%，这个比例参考了 Q1 实际支出。”',
        timeRange: '📍 10:05 - 10:15',
      },
    ],
  },
];

export function extractMeetingIdFromUrl(url?: string): string | null {
  if (!url || !url.startsWith(MEETING_PILOT_HOST_PREFIX)) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/conf\/on\/([^/]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function isMeetingPilotUrl(url?: string): boolean {
  return Boolean(extractMeetingIdFromUrl(url));
}

export function createDefaultCaptureState(): MeetingPilotCaptureState {
  return {
    kind: 'idle',
    chunkCount: 0,
  };
}

export function createDefaultReadinessState(): MeetingPilotReadinessState {
  const checkedAt = Date.now();
  return {
    status: 'blocked',
    summary: 'Checking Meeting Pilot readiness…',
    canStartCapture: false,
    checkedAt,
    blockers: ['Readiness has not finished loading yet.'],
    degradations: [],
    dependencies: {
      minutesApi: {
        status: 'blocked',
        message: 'Waiting for preflight.',
        checkedAt,
      },
      transcription: {
        status: 'degraded',
        message: 'Waiting for preflight.',
        checkedAt,
      },
      analysisModel: {
        status: 'degraded',
        message: 'Waiting for preflight.',
        checkedAt,
      },
      memoryService: {
        status: 'degraded',
        message: 'Waiting for preflight.',
        checkedAt,
      },
    },
  };
}

export function createMeetingPilotSessionSnapshot(
  input: Partial<MeetingPilotSessionSnapshot> & {
    meetingId: string;
    tabId: number;
    url: string;
    title?: string;
    detectedAt?: number;
  },
): MeetingPilotSessionSnapshot {
  const detectedAt = input.detectedAt || Date.now();
  return {
    meetingId: input.meetingId,
    tabId: input.tabId,
    url: input.url,
    title: input.title || 'RingCentral meeting',
    status: input.status || 'detected',
    inMeeting: input.inMeeting ?? true,
    shareState: input.shareState || 'unknown',
    selfSharing: input.selfSharing ?? false,
    micMuted: input.micMuted,
    sharerName: input.sharerName,
    speakerLabel: input.speakerLabel,
    participantCount: input.participantCount ?? 0,
    capture: input.capture || createDefaultCaptureState(),
    digest: input.digest || {
      status: 'idle',
    },
    readiness: input.readiness || createDefaultReadinessState(),
    alerts: input.alerts || [],
    chapters: input.chapters || [],
    currentTopic: input.currentTopic || 'Waiting for context',
    actionItems: input.actionItems || [],
    decisions: input.decisions || [],
    timelineEvents: input.timelineEvents || [],
    participants: input.participants || [],
    transcript: input.transcript || [],
    transcriptTurns: input.transcriptTurns || [],
    memoryRefs: input.memoryRefs || [],
    webTranscript: input.webTranscript,
    speechSuggestion: input.speechSuggestion,
    speechGuidanceContext: input.speechGuidanceContext,
    summary:
      input.summary || 'Meeting Pilot is waiting for the first useful signal.',
    shareSummary: input.shareSummary,
    speakerSummary: input.speakerSummary,
    latestObservationText: input.latestObservationText,
    latestStructuredParse: input.latestStructuredParse,
    timelineProgress: input.timelineProgress ?? 0,
    sidePanelPinned: input.sidePanelPinned ?? false,
    detectedAt,
    updatedAt: input.updatedAt || detectedAt,
    endedAt: input.endedAt,
    tier: input.tier ?? { activeTier: null, badge: 'Probing', mode: 'auto' },
  };
}

export function createDemoMeetingSnapshot(
  overrides: Partial<MeetingPilotSessionSnapshot> & {
    meetingId: string;
    tabId: number;
    url: string;
    title?: string;
  },
): MeetingPilotSessionSnapshot {
  const base = createMeetingPilotSessionSnapshot(overrides);
  return {
    ...base,
    ...overrides,
    status: overrides.status || 'ready',
    shareState: overrides.shareState || 'unknown',
    selfSharing: overrides.selfSharing ?? false,
    participantCount: overrides.participantCount ?? participantSeed.length,
    capture: overrides.capture || {
      kind: 'armed',
      startedAt: Date.now() - 8 * 60 * 1000,
      chunkCount: 3,
    },
    digest: overrides.digest || {
      status: 'processing',
      taskId: 'demo-task',
      lookupId: 'demo-meeting-lookup',
      resultUrl: 'https://example.com/meeting-pilot/demo',
      videoUrl: 'https://example.com/meeting-pilot/demo.webm',
      message: 'Demo digest is still processing.',
      updatedAt: Date.now(),
    },
    readiness: overrides.readiness || {
      status: 'ready',
      summary: 'Ready — demo session has all services available.',
      canStartCapture: true,
      checkedAt: Date.now(),
      blockers: [],
      degradations: [],
      dependencies: {
        minutesApi: {
          status: 'ready',
          message: 'Minutes API is reachable.',
          checkedAt: Date.now(),
        },
        transcription: {
          status: 'ready',
          message: 'Audio transcription is available.',
          checkedAt: Date.now(),
        },
        analysisModel: {
          status: 'ready',
          message: 'Analysis model is available.',
          checkedAt: Date.now(),
        },
        memoryService: {
          status: 'ready',
          message: 'Memory service is reachable.',
          checkedAt: Date.now(),
        },
      },
    },
    alerts: overrides.alerts || [
      {
        id: 'alert-demo-1',
        level: 'P1',
        title: 'Action item detected',
        body: 'Need to follow up on the backend release timing.',
        source: 'action',
        createdAt: Date.now() - 120000,
      },
      {
        id: 'alert-demo-2',
        level: 'P2',
        title: 'Memory match',
        body: 'This topic matches a previously stored project note.',
        source: 'memory',
        createdAt: Date.now() - 60000,
      },
    ],
    chapters:
      overrides.chapters || chapterSeed.map((chapter) => ({ ...chapter })),
    currentTopic: overrides.currentTopic || 'Q2 技术评审排期',
    actionItems:
      overrides.actionItems || actionSeed.map((item) => ({ ...item })),
    decisions: overrides.decisions || decisionSeed.map((item) => ({ ...item })),
    timelineEvents:
      overrides.timelineEvents || timelineSeed.map((item) => ({ ...item })),
    participants:
      overrides.participants || participantSeed.map((item) => ({ ...item })),
    transcript: overrides.transcript || [
      {
        id: 'chunk-1',
        speaker: 'Alex',
        text: 'Let us align on the backend release plan and open questions.',
        ts: Date.now() - 180000,
      },
      {
        id: 'chunk-2',
        speaker: 'You',
        text: 'We should verify whether the ETA changed after the latest dependency update.',
        ts: Date.now() - 90000,
      },
    ],
    memoryRefs: overrides.memoryRefs || [
      {
        id: 'memory-1',
        title: 'Release note from last week',
        snippet:
          'BE was expected to land before the feature freeze but no final ETA was confirmed.',
        score: 0.91,
        sourceLabel: 'memory-service',
        sourceUrl: 'https://example.com/release-note',
      },
      {
        id: 'memory-2',
        title: 'Project risk log',
        snippet:
          'Potential impact if the shared document changes again during the meeting.',
        score: 0.84,
        sourceLabel: 'memory-service',
        sourceUrl: 'https://example.com/project-risk-log',
      },
    ],
    summary:
      overrides.summary ||
      'The meeting is discussing release timing, ownership, and the current state of the shared screen.',
    timelineProgress: overrides.timelineProgress ?? 0.56,
    updatedAt: overrides.updatedAt || Date.now(),
  };
}

export function buildMeetingPilotBadgeText(
  snapshot: MeetingPilotSessionSnapshot,
): string {
  if (snapshot.capture.kind === 'recording') return 'REC';
  if (snapshot.webTranscript?.active) return 'TXT';
  if (snapshot.alerts.some((alert) => alert.level === 'P0' && !alert.resolved))
    return '!';
  return snapshot.inMeeting ? 'MP' : '';
}

export function buildMeetingPilotTooltip(
  snapshot: MeetingPilotSessionSnapshot,
): string {
  const state =
    snapshot.capture.kind === 'recording'
      ? 'recording'
      : snapshot.capture.kind === 'armed'
      ? 'armed'
      : snapshot.capture.kind;
  return `Meeting Pilot: ${snapshot.title} (${snapshot.meetingId}) - ${state}`;
}
