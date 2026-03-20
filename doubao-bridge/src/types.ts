export type BridgeAuthStatus = 'unknown' | 'needs_login' | 'connected' | 'error';
export type BindingType = 'memory_sync' | 'mobile_context';
export type SyncKind = 'stable_memory' | 'mobile_briefing' | 'query_inject' | 'reminder_sync';
export type ThreadKind = 'memory_sync' | 'mobile_context' | 'manual' | 'unknown';

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
}

export interface BridgePairResult {
  paired: boolean;
  token: string;
  createdAt: string;
}

export interface BridgeStatus {
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
