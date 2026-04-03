export type BridgeAuthStatus = 'unknown' | 'needs_login' | 'connected' | 'error';
export type BindingType = 'memory_sync' | 'mobile_context';
export type SyncKind = 'stable_memory' | 'mobile_briefing' | 'query_inject' | 'reminder_sync' | 'todo_sync' | 'notice_sync' | 'memo_sync';
export type ThreadKind = 'memory_sync' | 'mobile_context' | 'manual' | 'unknown';
export type AutoSyncKind = 'stable_memory' | 'mobile_briefing' | 'reminder_sync';
export type BridgeAssistantStatusKind =
  | 'setup_blocker'
  | 'confirm_request'
  | 'running_action'
  | 'waiting_reply'
  | 'queued_action';
export type BridgeBlockingReasonCode =
  | 'auto_sync_disabled'
  | 'memory_service_not_configured'
  | 'memory_service_user_missing'
  | 'auth_required'
  | 'memory_sync_not_bound'
  | 'mobile_context_not_bound';

export interface ThreadRecord {
  id: string;
  kind: ThreadKind;
  title: string;
  url?: string;
  bindingType?: BindingType;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadBinding {
  bindingType: BindingType;
  threadId: string;
  threadUrl?: string;
  title?: string;
  updatedAt: string;
}

export interface SyncResult {
  accepted: boolean;
  kind: SyncKind;
  targetBindingType: BindingType;
  threadId?: string;
  transcript: string;
  sentAt: string;
  error?: string;
  transportUsed?: 'dom';
  verified?: boolean;
  challengeDetected?: boolean;
  messageVisible?: boolean;
  observedBodySnippet?: string;
}

export interface BridgePairResult {
  paired: boolean;
  token: string;
  createdAt: string;
}

export interface BridgeServiceStatus {
  paired: boolean;
  authStatus: BridgeAuthStatus;
  browserRunning: boolean;
  currentUrl?: string;
  pairToken?: string;
  bindings: Partial<Record<BindingType, ThreadBinding>>;
  threads: ThreadRecord[];
  lastSyncAt?: string;
  lastError?: string;
}

export interface BridgeStatus extends BridgeServiceStatus {
  appVersion: string;
  memoryServiceConfigured: boolean;
  autoSyncEnabled: boolean;
  memoryGrowth?: BridgeMemoryGrowthSummary;
  blockingReasons: BridgeBlockingReason[];
  syncReadiness: Record<'stableMemory' | 'mobileBriefing' | 'reminderSync', BridgeSyncReadiness>;
  syncState: {
    timerActive: boolean;
    running: boolean;
    autoSyncEnabled: boolean;
    memoryServiceConfigured: boolean;
    pollIntervalMs: number;
    tasks: Record<'stableMemory' | 'mobileBriefing' | 'reminderSync', {
      intervalMs: number;
      lastRunAt?: string;
      nextDueAt?: string;
      due: boolean;
    }>;
  };
  settings?: {
    memoryServiceBaseUrl?: string;
    memoryServiceUserId?: string;
    autoSync: boolean;
    pollIntervalMs: number;
    stableMemoryIntervalMs: number;
    mobileBriefingIntervalMs: number;
    reminderSyncIntervalMs: number;
  };
  setupChecklist?: {
    memoryServiceConfigured: boolean;
    autoSyncEnabled: boolean;
    doubaoConnected: boolean;
    memorySyncBound: boolean;
    mobileContextBound: boolean;
  };
}

export interface BridgeBlockingReason {
  code: BridgeBlockingReasonCode;
  message: string;
  syncKinds: Array<'stableMemory' | 'mobileBriefing' | 'reminderSync'>;
}

export interface BridgeSyncReadiness {
  ready: boolean;
  reasons: BridgeBlockingReason[];
  intervalMs: number;
  lastRunAt?: string;
}

export interface BridgeMemoryGrowthSummary {
  windowDays: number;
  recentMessageCount: number;
  lowMessageThreshold: number;
  belowThreshold: boolean;
}

export interface BridgeAssistantEvidenceItem {
  id?: string;
  type?: 'message' | 'chunk' | 'entity';
  content: string;
  score?: number;
  source?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface BridgeStructuredTimelineItem {
  date: string;
  event: string;
}

export interface BridgeStructuredRelatedEntity {
  name: string;
  type: string;
  relevance: string;
}

export interface BridgeStructuredAnswer {
  timeline?: BridgeStructuredTimelineItem[];
  keyFindings?: string[];
  insights?: string[];
  relatedEntities?: BridgeStructuredRelatedEntity[];
  confidence?: number;
}

export interface BridgeAssistantStatusPill {
  kind: BridgeAssistantStatusKind;
  label: string;
  count: number;
  priority: number;
}

export interface BridgeAssistantStatusItem {
  kind: BridgeAssistantStatusKind;
  title: string;
  summary: string;
  count?: number;
  badgeLabel?: string;
  actionHint?: string;
  priority: number;
}

export interface BridgeAssistantRuntimeSummary {
  pendingConfirmCount: number;
  queuedActionCount: number;
  runningActionCount: number;
  waitingReplyCount: number;
  pendingApprovalCount: number;
  escalatedCount: number;
  memoryGrowth?: BridgeMemoryGrowthSummary;
  topStatus?: BridgeAssistantStatusPill;
  items: BridgeAssistantStatusItem[];
  fetchedAt: string;
}

export interface BridgeAssistantAskRequest {
  query: string;
  context?: string;
  includeEvidence?: boolean;
}

export interface BridgeAssistantAskResponse {
  answer: string;
  queryTimeMs: number;
  structuredAnswer?: BridgeStructuredAnswer;
  evidence?: BridgeAssistantEvidenceItem[];
  resolutionState?: 'complete' | 'partial' | 'insufficient' | 'deferred';
  missingInfo?: string[];
  followUpActions?: Array<{
    id: string;
    actionType: string;
    title: string;
    queueStatus: string;
    executionMode: string;
    sourceKind?: string;
    sourceRefId?: string;
    result?: Record<string, unknown>;
    lastError?: string;
  }>;
  externalEvidence?: Array<{
    kind: string;
    title?: string;
    url?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }>;
  runtime: BridgeAssistantRuntimeSummary;
}

export type BridgeAssistantStreamEvent =
  | { type: 'start'; requestId: string }
  | { type: 'status'; message: string }
  | { type: 'delta'; text: string }
  | { type: 'answer_done'; answer: string }
  | {
      type: 'result';
      answer: string;
      queryTimeMs: number;
      structuredAnswer?: BridgeStructuredAnswer;
      evidence?: BridgeAssistantEvidenceItem[];
      resolutionState?: BridgeAssistantAskResponse['resolutionState'];
      missingInfo?: BridgeAssistantAskResponse['missingInfo'];
      followUpActions?: BridgeAssistantAskResponse['followUpActions'];
      externalEvidence?: BridgeAssistantAskResponse['externalEvidence'];
      runtime: BridgeAssistantRuntimeSummary;
    }
  | { type: 'error'; message: string };

export interface BridgeRememberRequest {
  text: string;
  sessionId?: string;
}

export interface BridgeRememberItem {
  id?: string;
  itemType: string;
  itemKey: string;
  itemValue: string;
  duplicate?: boolean;
}

export interface BridgeRememberResponse {
  items: BridgeRememberItem[];
}

export interface StableMemoryItem {
  title: string;
  body: string;
}

export interface StableMemorySyncRequest {
  items: StableMemoryItem[];
  threadId?: string;
  dryRun?: boolean;
}

export interface MobileBriefingRequest {
  title: string;
  bullets: string[];
  threadId?: string;
  dryRun?: boolean;
}

export interface QueryInjectRequest {
  query: string;
  answer: string;
  evidence?: Array<{ title?: string; snippet?: string; source?: string }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface ReminderSyncRequest {
  reminders: Array<{
    title: string;
    dueAt?: string;
    note?: string;
    severity?: 'low' | 'medium' | 'high';
  }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface NoticeSyncRequest {
  notices: Array<{
    title: string;
    body?: string;
    sentAt?: string;
    priority?: 'high' | 'normal';
  }>;
  threadId?: string;
  dryRun?: boolean;
}

export interface SendExperimentRequest {
  transcript: string;
  bindingType?: BindingType;
  threadId?: string;
  inputMode?: 'default' | 'paste' | 'type' | 'insert' | 'fill';
  sendMode?: 'auto' | 'button' | 'enter';
  preSendDelayMs?: number;
  dryRun?: boolean;
}

// 随手记相关类型
export type MemoType = 
  | 'todo' | 'shopping' | 'parking' | 'where' | 'important_date'
  | 'quote' | 'address' | 'card' | 'number' | 'health' | 'note';

export interface MemoItem {
  type: MemoType;
  title: string;
  content: string;
  metadata?: {
    dueDate?: string;
    location?: string;
    category?: string;
    importance?: 'low' | 'medium' | 'high';
    tags?: string[];
    source?: string;
  };
}

export interface MemoSyncRequest {
  items: MemoItem[];
  threadId?: string;
  dryRun?: boolean;
  context?: 'stable' | 'briefing' | 'reminder';
}
