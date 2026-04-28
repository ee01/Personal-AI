import type { BridgeAuthStatus } from '../types.js';
import type { ExplorerSettings } from '../settings.js';

export type SourceId = 'doubao' | 'chatgpt';

export type ExplorerIngestSourceId = 'doubao_chat' | 'chatgpt';

export interface ExplorationCursor {
  source: SourceId;
  conversationId: string;
  lastMessageId?: string;
  lastProcessedUpdateTime?: string;
  contentHash?: string;
  processedMessageIds?: string[];
}

export interface Artifact {
  kind: 'fact' | 'preference' | 'event' | 'plan';
  text: string;
  sourceQuote: string;
  conversationRef: string;
}

export interface ConversationArtifactRecord extends Artifact {
  source: SourceId;
  conversationId: string;
  extractedAt: string;
}

export interface RawMessageRecord {
  source: SourceId;
  conversationId: string;
  messageId: string;
  ts?: string;
  role: string;
  contentHash: string;
  content: string;
  extractedAt?: string;
}

export interface RawMessageStoreStats {
  messageCount: number;
  pendingExtractCount: number;
  conversationCount: number;
}

/** Identifies which underlying browser transport a source last used. */
export type ExplorerTransportMode = 'playwright' | 'webpage_mcp' | 'unknown';

export interface ExplorerTransportStatus {
  mode: ExplorerTransportMode;
  /** Human-readable reason if a fallback occurred, e.g. webpage-mcp → playwright. */
  fallbackReason?: string;
}

export interface ExplorerSourceStatus {
  source: SourceId;
  enabled: boolean;
  settings: ExplorerSettings[SourceId];
  authStatus: BridgeAuthStatus | 'unsupported';
  running: boolean;
  lastRunAt?: string;
  lastRunOutcome: 'idle' | 'success' | 'error' | 'stub';
  lastError?: string;
  cache: RawMessageStoreStats;
  transport?: ExplorerTransportStatus;
}

export interface ExplorerStatusSnapshot {
  updatedAt: string;
  askDefaultScope: ExplorerSettings['askDefaultScope'];
  sources: Record<SourceId, ExplorerSourceStatus>;
}

export interface ExplorerConversationSummary {
  source: SourceId;
  conversationId: string;
  latestTs?: string;
  messageCount: number;
  pendingMessageCount: number;
  extractedMessageCount: number;
  artifactCount: number;
  latestMessagePreview?: string;
}

export interface ExplorerPreviewResult {
  source: SourceId;
  conversationId?: string;
  limit: number;
  cache: RawMessageStoreStats;
  conversations: ExplorerConversationSummary[];
  messages: RawMessageRecord[];
  cleanedMessages: Array<{
    source: SourceId;
    conversationId: string;
    messageId: string;
    role: string;
    ts?: string;
    content: string;
    extracted: boolean;
  }>;
  artifacts: ConversationArtifactRecord[];
  cursor?: ExplorationCursor;
}
