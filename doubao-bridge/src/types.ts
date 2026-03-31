export type BridgeAuthStatus = 'unknown' | 'needs_login' | 'connected' | 'error';
export type BindingType = 'memory_sync' | 'mobile_context';
export type SyncKind = 'stable_memory' | 'mobile_briefing' | 'query_inject' | 'reminder_sync' | 'memo_sync';
export type ThreadKind = 'memory_sync' | 'mobile_context' | 'manual' | 'unknown';
export type AutoSyncKind = 'stable_memory' | 'mobile_briefing' | 'reminder_sync';
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
