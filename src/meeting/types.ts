export type MeetingStatus =
  | 'idle'
  | 'loading'
  | 'in_meeting'
  | 'recording'
  | 'processing'
  | 'completed'
  | 'error';

export type MeetingAlertLevel = 'P0' | 'P1' | 'P2';

export type MeetingCaptureState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'uploading'
  | 'completed'
  | 'error';

export interface MeetingParticipant {
  id: string;
  name: string;
  isSelf?: boolean;
  isSpeaking?: boolean;
  isSharing?: boolean;
  isHost?: boolean;
}

export interface MeetingDomSignals {
  url: string;
  meetingId: string;
  inMeeting: boolean;
  shareActive: boolean;
  shareOwner?: string;
  selfSharing: 'yes' | 'no' | 'unknown';
  activeSpeaker?: string;
  participantCount: number;
  participants: MeetingParticipant[];
  aiNotesVisible: boolean;
  captionsVisible: boolean;
  pageTitle?: string;
  updatedAt: number;
}

export interface TranscriptChunk {
  seq: number;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  confidence?: number;
  language?: string;
}

export interface MeetingActionItem {
  id: string;
  title: string;
  owner?: string;
  due?: string;
  status: 'candidate' | 'confirmed' | 'done';
  confidence: number;
}

export interface MeetingDecision {
  id: string;
  title: string;
  detail?: string;
  confidence: number;
}

export interface MeetingMemoryReference {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  source?: string;
  timestamp?: number;
  stale?: boolean;
}

export interface MeetingVisualObservation {
  id: string;
  ts: number;
  sceneType: string;
  evidenceText: string;
  visibleEntities: string[];
  keyNumbersAndDates: string[];
  candidateTopics: string[];
  uiActionsSuggested: string[];
  confidence: number;
}

export interface MeetingChapter {
  id: string;
  title: string;
  startedAt: number;
  endedAt?: number;
  summary: string;
  outline: string[];
  table?: Array<Record<string, string>>;
  decisionFlow?: Array<{ from: string; to: string; label?: string }>;
  confidence: number;
}

export interface MeetingAlert {
  id: string;
  level: MeetingAlertLevel;
  title: string;
  body: string;
  reason?: string;
  createdAt: number;
  autoDismissMs?: number;
  handled?: boolean;
}

export interface MeetingInsightState {
  summary: string;
  currentTopic: string;
  lastSummaryAt?: number;
  chapters: MeetingChapter[];
  actions: MeetingActionItem[];
  decisions: MeetingDecision[];
  memoryReferences: MeetingMemoryReference[];
  observations: MeetingVisualObservation[];
  alerts: MeetingAlert[];
  transcript: TranscriptChunk[];
}

export interface MeetingDigestState {
  status: 'idle' | 'uploading_video' | 'processing' | 'completed' | 'failed';
  id?: string;
  taskId?: string;
  resultUrl?: string;
  message?: string;
  videoUrl?: string;
  transcriptPath?: string;
}

export interface MeetingSession {
  sessionId: string;
  meetingId: string;
  meetingUrl: string;
  pageTitle?: string;
  tabId: number;
  status: MeetingStatus;
  captureState: MeetingCaptureState;
  startedAt?: number;
  endedAt?: number;
  createdAt: number;
  updatedAt: number;
  participants: MeetingParticipant[];
  activeSpeaker?: string;
  shareOwner?: string;
  shareActive: boolean;
  selfSharing: 'yes' | 'no' | 'unknown';
  durationMs: number;
  digest: MeetingDigestState;
  insights: MeetingInsightState;
  lastError?: string;
}

export interface MeetingFeatureState {
  sessions: Record<string, MeetingSession>;
  activeSessionId?: string;
}

export interface MeetingConfig {
  enabled: boolean;
  autoDetect: boolean;
  entryMode: 'auto' | 'manual';
  digestBaseUrl: string;
  providerBaseUrl: string;
  providerApiKey?: string;
  transcribeModel: string;
  nameAliases: string[];
  hotwords: string[];
  summaryIntervalSec: number;
  screenshotIntervalSec: number;
  memoryContextEnabled: boolean;
  privacyNoticeText: string;
}
