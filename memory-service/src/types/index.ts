import type { WeaveStats } from '../core/weaveStats.js';

// ============ Core Domain Types ============

export type EntityType =
  | 'Person'
  | 'Project'
  | 'Task'
  | 'Organization'
  | 'Document'
  | 'Technology'
  | 'Topic';
export const SOURCE_TYPES = [
  'glip',
  'jira',
  'web',
  'manual',
  'system',
  'meeting',
  'calendar',
  'ai_chat',
  'doubao',
  'chatgpt',
  'doubao_chat',
  'codex_cli',
  'claude_code_cli',
  'cursor_agent_cli',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type MemoryScope = 'work' | 'personal';
export type RecallScope = MemoryScope | 'both' | 'all';
export type RecallSourceType =
  | SourceType
  | 'daily_log'
  | 'project_summary'
  | 'reflection'
  | 'dream'
  | 'rehearsal'
  | 'reflection_thread'
  | 'source_memory'
  | 'entity_profile'
  | 'markdown'
  | 'user_core';
export type ConsolidationLevel =
  | 'temporary'
  | 'working'
  | 'consolidated'
  | 'core';
export type ActionState =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'dismissed'
  | 'expired';
export type ConfirmState =
  | 'pending'
  | 'answered'
  | 'snoozed'
  | 'expired'
  | 'deduplicated';
export type ConfirmRouting = 'decision' | 'watch';
export type ConfirmReasonCode =
  | 'authority_required'
  | 'approval_required'
  | 'future_monitoring'
  | 'owner_eta_gap'
  | 'artifact_gap'
  | 'time_sensitive_blocker';
export type ConfirmGapType =
  | 'future_monitoring'
  | 'owner_eta'
  | 'artifact_check'
  | 'decision_blocker';
export type AuthorityLevel =
  | 'official'
  | 'team_lead'
  | 'peer'
  | 'self'
  | 'inferred';
export type PropertyAction = 'set' | 'update' | 'retract' | 'confirm';
export type EntityStatus = 'active' | 'archived' | 'merged';
export type ProfileItemType =
  | 'fact'
  | 'preference'
  | 'habit'
  | 'interest'
  | 'constraint';
export type ProfileSourceKind = 'explicit' | 'inferred' | 'system';
export type ProfileItemStatus =
  | 'active'
  | 'pending_confirm'
  | 'superseded'
  | 'retracted'
  | 'archived';
export type SocialRelationType =
  | 'colleague'
  | 'manager'
  | 'report'
  | 'friend'
  | 'client'
  | 'vendor';
export type OpinionDimension =
  | 'trust'
  | 'like'
  | 'collaboration'
  | 'competence'
  | 'risk';
export type OpinionStatus = 'pending_confirm' | 'active' | 'retracted';
export type AgentProfileKind = 'identity' | 'soul' | 'policy';

export type RehearsalStatus =
  | 'candidate'
  | 'active'
  | 'paused'
  | 'used'
  | 'stale'
  | 'archived'
  | 'dismissed';

export type RehearsalActivationOutcome =
  | 'matched'
  | 'shown'
  | 'accepted'
  | 'used'
  | 'ignored'
  | 'dismissed'
  | 'irrelevant';

export interface RehearsalActivationCues {
  people?: string[];
  projects?: string[];
  topics?: string[];
  keywords?: string[];
  groupIds?: string[];
  conversationIds?: string[];
  meetingIds?: string[];
  calendarEventIds?: string[];
  issueKeys?: string[];
  urls?: string[];
  surfaces?: string[];
}

export interface Rehearsal {
  id: string;
  title: string;
  scenarioType: string;
  status: RehearsalStatus;
  summary?: string;
  content: string;
  activationCues: RehearsalActivationCues;
  evidenceRefs: string[];
  sourceKind: string;
  sourceRefId?: string;
  confidence: number;
  priority: number;
  validFrom?: number;
  validUntil?: number;
  lastActivatedAt?: number;
  lastUsedAt?: number;
  activationCount: number;
  usedCount: number;
  dismissedCount: number;
  staleReason?: string;
  markdownPath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RehearsalActivation {
  id: string;
  rehearsalId: string;
  surface: string;
  contextType?: string;
  sceneKey?: string;
  score: number;
  displayPriority: ContextRecallDisplayPriority;
  matchedCues: RehearsalActivationCues;
  outcome: RehearsalActivationOutcome;
  feedbackNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RehearsalListResponse {
  items: Rehearsal[];
  total: number;
  limit: number;
  offset: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  description?: string;
  importance: number;
  accessCount: number;
  lastAccessed?: number;
  firstSeen?: number;
  lastSeen?: number;
  mentionCount: number;
  tags?: string[];
  markdownPath?: string;
  status: EntityStatus;
  mergedInto?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface EntityProperty {
  id: number;
  entityId: string;
  propertyKey: string;
  propertyValue: string;
  valueType: string;
  sourceMessageId?: string;
  sourceAuthor?: string;
  sourceAuthority?: AuthorityLevel;
  sourceContext?: string;
  validFrom?: number;
  validTo?: number;
  txStart: number;
  txEnd?: number;
  confidence: number;
  supersededBy?: number;
  supersedeReason?: string;
  isFinal: boolean;
  status: string;
  actionType?: PropertyAction;
}

export interface Relationship {
  id: number;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  strength: number;
  coOccurrenceCount: number;
  evidenceMessageIds?: string[];
  context?: string;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface MessageRaw {
  id: string;
  content: string;
  summary?: string;
  scope: MemoryScope;
  source?: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceTitle?: string;
  sender?: string;
  groupId?: string;
  groupName?: string;
  timestamp: number;
  entities?: Array<{ type: EntityType; name: string; id?: string }>;
  matchedProjects?: string[];
  importance: number;
  sentiment: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface MeetingRecord {
  meetingId: string;
  title: string;
  date: number;
  lastEventAt: number;
  participants: string[];
  pdfUrl?: string;
  digestId?: string;
  digestStatus?: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  digestErrorCode?: string;
  summary?: string;
  topicCount?: number;
  actionItemCount?: number;
  decisionCount?: number;
}

export interface MeetingRecordDetail extends MeetingRecord {
  summary?: string;
  latestObservationText?: string;
  actionItems?: Array<{
    id: string;
    title: string;
    owner: string;
    deadline?: string;
    status: 'pending' | 'done';
  }>;
  decisions?: Array<{
    id: string;
    text: string;
    timestamp?: string;
  }>;
  chapters?: Array<{
    id: string;
    title: string;
    summary: string;
    startLabel?: string;
    actionCount?: number;
    decisionCount?: number;
  }>;
  timelineEvents?: Array<{
    id: string;
    type: 'topic' | 'decision' | 'action' | 'mention' | 'screen';
    title: string;
    description: string;
    timestamp?: string;
    speaker?: string;
    chapterId?: string;
  }>;
  participantStances?: Array<{
    participant: string;
    topic: string;
    stance: '主导' | '支持' | '中立' | '质疑' | '反对';
    keyQuote: string;
    timeRange?: string;
  }>;
}

export interface Chunk {
  chunkId: number;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  contentHash: string;
  scope?: MemoryScope;
  source?: string;
  sourceType?: string;
  relatedProject?: string;
  relatedEntityId?: string;
  tokenCount?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface MemoryMetadata {
  id: number;
  targetType: string;
  targetId: string;
  salienceScore: number;
  importance: number;
  frequency: number;
  recencyBoost: number;
  surpriseScore: number;
  redundancy: number;
  accessCount: number;
  lastAccessed?: number;
  decayRate: number;
  halfLifeDays: number;
  consolidationLevel: ConsolidationLevel;
  nextReviewAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface WatchedProject {
  id: string;
  entityId?: string;
  name: string;
  description?: string;
  aliases?: string[];
  autoCaptureRules?: Array<{ field: string; pattern: string; action: string }>;
  trackedProperties?: string[];
  isActive: boolean;
  priority: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ReflectionArtifact {
  id: string;
  scope: string;
  scopeRef?: string;
  summary: string;
  lessons?: string[];
  openQuestions?: string[];
  discoveries?: string[];
  suggestedActionIds?: string[];
  sourceMessageIds?: string[];
  markdownPath?: string;
  createdAt: number;
}

export interface ProposedAction {
  id: string;
  type: string;
  title: string;
  description?: string;
  params?: Record<string, any>;
  riskLevel: string;
  confidence: number;
  evidenceRefs?: string[];
  requiresApproval: boolean;
  state: ActionState;
  approvedAt?: number;
  executedAt?: number;
  source?: string;
  expiresAt?: number;
  createdAt: number;
}

export interface ConfirmRequest {
  id: string;
  question: string;
  context?: string;
  options?: Array<{ label: string; value: string }>;
  evidenceRefs?: string[];
  category?: string;
  relatedEntityId?: string;
  relatedPropertyId?: number;
  priority: string;
  state: ConfirmState;
  routing?: ConfirmRouting;
  reasonCode?: ConfirmReasonCode;
  sourceAnchor?: string;
  gapType?: ConfirmGapType;
  userAnswer?: string;
  answeredAt?: number;
  snoozeUntil?: number;
  snoozeCount: number;
  expiresAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface NotificationRecord {
  id: string;
  channel: string;
  type?: string;
  title: string;
  body?: string;
  payload?: Record<string, any>;
  topicId?: string;
  relatedEntityId?: string;
  utilityScore?: number;
  sentAt?: number;
  clickedAt?: number;
  dismissedAt?: number;
  actionTaken?: string;
  createdAt: number;
}

export interface NotificationCenterEnvelope {
  sourceRef: string;
  sourceType: 'notification' | 'proposed_action';
  sourceId: string;
  lane: 'todo' | 'notice';
  priority: 'high' | 'normal';
  title: string;
  body?: string;
  dueAt?: number;
  createdAt: number;
  sentAt?: number;
  type?: string;
  payload?: Record<string, unknown>;
}

// ============ Dual Persona Types ============

export interface ProfileItem {
  id: string;
  itemType: ProfileItemType;
  itemKey: string;
  itemValue: string;
  evidenceRefs?: Array<{ messageId: string; snippet?: string; ts: number }>;
  sourceKind: ProfileSourceKind;
  confidence: number;
  userConfirmed: boolean;
  status: ProfileItemStatus;
  salienceScore: number;
  mentionCount: number;
  lastSeen: number;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
  fingerprint: string;
}

export interface ProfileSyncState {
  profileDirty: boolean;
  lastSnapshotAt: number;
  lastFullRebuildAt: number;
}

export interface SocialEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: SocialRelationType;
  strength: number;
  evidenceRefs?: Array<{ messageId: string; snippet?: string; ts: number }>;
  confidence: number;
  userConfirmed: boolean;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OpinionItem {
  id: string;
  targetEntityId: string;
  dimension: OpinionDimension;
  valence: number;
  intensity: number;
  rationale?: string;
  evidenceRefs?: Array<{ messageId: string; snippet?: string; ts: number }>;
  confidence: number;
  userConfirmed: boolean;
  status: OpinionStatus;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentProfileVersion {
  id: string;
  kind: AgentProfileKind;
  contentMd: string;
  author: string;
  rationale?: string;
  isActive: boolean;
  createdAt: number;
}

// Profile candidate extracted by LLM during ingestion
export interface ProfileCandidate {
  itemType: ProfileItemType;
  itemKey: string;
  itemValue: string;
  confidence?: number;
  sourceKind?: ProfileSourceKind;
}

// ============ API Types ============

export interface IngestPayload {
  content: string;
  sourceType: SourceType;
  scope?: MemoryScope;
  source?: string;
  sender?: string;
  groupId?: string;
  groupName?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  /** When true, skip LLM extraction / salience scoring. Used for migration. */
  skipExtraction?: boolean;
}

export type IngestStorageDecision =
  | 'indexed'
  | 'stored_unindexed'
  | 'duplicate'
  | 'error';

export type IngestDecisionReason =
  | 'salience_indexed'
  | 'salience_below_threshold'
  | 'extraction_skipped'
  | 'extraction_unavailable'
  | 'duplicate_post_id'
  | 'duplicate_content_source_sender'
  | 'indexing_failed'
  | 'insert_failed';

export type IngestDedupeReason = 'post_id' | 'content_source_sender';
export type IngestExtractionStatus = 'extracted' | 'skipped' | 'unavailable';
export type IngestTrustClass = 'trusted' | 'internal' | 'untrusted';
export type IngestSanitization = 'clean' | 'flagged';

export interface IngestSalienceComponents {
  importance: number;
  frequency: number;
  recency: number;
  surprise: number;
  redundancy: number;
  userInterestBoost?: number;
}

export interface IngestDecision {
  storage: IngestStorageDecision;
  reason: IngestDecisionReason;
  salienceScore?: number;
  salienceComponents?: IngestSalienceComponents;
  extractionStatus?: IngestExtractionStatus;
  shouldIndex?: boolean;
  indexed?: boolean;
  duplicateOf?: string;
  dedupeReason?: IngestDedupeReason;
  /** Injection-defense (P0-2): trust class of the source and any flagged patterns. */
  trustClass?: IngestTrustClass;
  sanitization?: IngestSanitization;
  injectionFlags?: string[];
}

export interface IngestResult {
  id: string;
  status: 'created' | 'duplicate' | 'error';
  entitiesExtracted?: number;
  matchedProjects?: string[];
  decision?: IngestDecision;
}

export interface BatchIngestDecisionSummary {
  totalItems: number;
  storage: Record<IngestStorageDecision | 'unknown', number>;
  reasons: Record<IngestDecisionReason | 'unknown', number>;
  extractionStatus: Record<IngestExtractionStatus | 'unknown', number>;
  trustClass: Record<IngestTrustClass | 'unknown', number>;
  sanitization: Record<IngestSanitization | 'unknown', number>;
  indexing: {
    requested: number;
    completed: number;
    notRequested: number;
    failedAfterRequest: number;
    unknown: number;
  };
  missingDecision: number;
}

// ---------------------------------------------------------------------------
// Recall — Active research interface (POST /recall)
// ---------------------------------------------------------------------------

export type RecallAnalysisMode = 'search' | 'research' | 'aggregate';
export type RecallBlockType =
  | 'summary'
  | 'timeline'
  | 'table'
  | 'chart'
  | 'evidence_list'
  | 'media';
export type RecallPresentationHint =
  | 'default'
  | 'compact'
  | 'meeting_pilot'
  | 'research'
  | 'dashboard';
export type MemoryRetrievalTier =
  | 'core'
  | 'active'
  | 'weak'
  | 'historical'
  | 'archive_only'
  | 'forgotten';
export type RecallLifecycleMode =
  | 'active_default'
  | 'passive_surface'
  | 'composer_surface'
  | 'historical'
  | 'explicit_search'
  | 'audit';

export interface RecallQuery {
  query: string;
  scope?: RecallScope;
  topK?: number; // default 10
  channels?: ('vector' | 'fts' | 'graph' | 'time')[]; // default all
  timeRange?: { start?: number; end?: number };
  entityTypes?: EntityType[];
  projectFilter?: string;
  minSalience?: number;
  includeMetadata?: boolean;
  senderFilter?: string[];
  groupFilter?: string[];
  minImportance?: number;
  sourceTypes?: RecallSourceType[];
  presentationHint?: RecallPresentationHint;
  lifecycleMode?: RecallLifecycleMode;
  previewMaxLength?: number;
  /** Hint to ActiveRecallService about the desired second-stage processing. */
  analysisMode?: RecallAnalysisMode;
  /**
   * Which UI blocks to build alongside the items list.
   *
   * - Omitted / empty → evidence-only mode: response contains `items` only,
   *   no `blocks`, no `analysis`, no LLM calls.
   * - Provided → response contains `items` + the requested `blocks`. If the
   *   list includes `'summary'`, an LLM second-stage runs to produce
   *   `analysis` (and prepends a `summary` block).
   *
   * This single field replaces the old `responseMode` switch. The model is
   * "you ask for what you want; LLM is opt-in by including 'summary'".
   */
  blockTypes?: RecallBlockType[];
}

export type RecallChannelName = 'vector' | 'fts' | 'graph' | 'time';
export type RecallChannelStatus = 'hit' | 'empty' | 'skipped' | 'failed';

export interface RecallChannelDiagnostic {
  channel: RecallChannelName;
  status: RecallChannelStatus;
  candidateCount: number;
  reason?: string;
}

export interface RecallOptions {
  /** Whether returned items should reinforce access_count/salience. Default true. */
  reinforceAccess?: boolean;
}

export interface RecallScopeCounts {
  work: number;
  personal: number;
  unknown: number;
  total: number;
}

export interface RecallScopeReceipt {
  requestedScope: RecallScope;
  effectiveScope: MemoryScope | 'both';
  returned: RecallScopeCounts;
  candidates: RecallScopeCounts;
  note: string;
  includesPersonal: boolean;
}

export interface RecallResult {
  items: RecallItem[];
  totalFound: number;
  queryTimeMs: number;
  channels: string[];
  channelDiagnostics?: RecallChannelDiagnostic[];
  scopeReceipt?: RecallScopeReceipt;
  /** Block-style render schema (only present when `blockTypes` was provided). */
  blocks?: RecallBlock[];
  /** Higher-level analysis (only present when `blockTypes` includes `summary`). */
  analysis?: RecallAnalysis;
  /** Multi-modal references (URLs, file refs, structured spec). */
  artifacts?: RecallArtifact[];
}

export interface RecallItem {
  id: string;
  type: 'message' | 'chunk' | 'entity';
  content: string;
  scope?: MemoryScope;
  displayTitle?: string;
  displayText?: string;
  previewText?: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  /**
   * Stable jump link into memory-exploring (Vue UI), e.g.
   * `#/project/project-123` or `#/timeline?focus=msg-id`.
   * Always present when the item maps to a known explorer route.
   */
  exploreLink?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  entity?: Entity;
}

// ---------- Block schema (active recall stage 2 output) ----------

export interface RecallBlockBase<K extends RecallBlockType, P> {
  type: K;
  title?: string;
  payload: P;
}

export interface RecallSummaryBlockPayload {
  text: string;
  bullets?: string[];
  confidence?: number;
}

export interface RecallTimelineEvent {
  id?: string;
  date: string; // ISO date or relative description
  timestamp?: number;
  title: string;
  description?: string;
  sourceItemId?: string;
  exploreLink?: string;
}
export interface RecallTimelineBlockPayload {
  events: RecallTimelineEvent[];
}

export interface RecallTableBlockPayload {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null>>;
}

export interface RecallChartBlockPayload {
  chartType: 'line' | 'bar' | 'pie' | 'scatter';
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface RecallEvidenceCard {
  itemId: string;
  title: string;
  snippet: string;
  source?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  whyMatched?: string;
  score?: number;
  timestamp?: number;
}
export interface RecallEvidenceListBlockPayload {
  cards: RecallEvidenceCard[];
}

export interface RecallMediaItem {
  kind: 'link' | 'image' | 'pdf' | 'attachment' | 'page';
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  description?: string;
  itemId?: string;
}
export interface RecallMediaBlockPayload {
  items: RecallMediaItem[];
}

export type RecallBlock =
  | RecallBlockBase<'summary', RecallSummaryBlockPayload>
  | RecallBlockBase<'timeline', RecallTimelineBlockPayload>
  | RecallBlockBase<'table', RecallTableBlockPayload>
  | RecallBlockBase<'chart', RecallChartBlockPayload>
  | RecallBlockBase<'evidence_list', RecallEvidenceListBlockPayload>
  | RecallBlockBase<'media', RecallMediaBlockPayload>;

export interface RecallAnalysis {
  /** Short synthesized summary describing what was retrieved. */
  summary: string;
  /** Key conclusions, ordered by importance. */
  keyFindings?: string[];
  /** Higher-level insights derived from the evidence. */
  insights?: string[];
  /** Why specific evidence items were ranked above others. */
  rankingRationale?: string;
  /** Open questions the search could not answer locally. */
  openQuestions?: string[];
  /** Confidence in the synthesis, 0..1. */
  confidence?: number;
}

export interface RecallArtifact {
  kind: 'link' | 'file' | 'spec' | 'image' | 'pdf';
  title?: string;
  url?: string;
  filePath?: string;
  spec?: Record<string, unknown>;
  description?: string;
}

// ---------------------------------------------------------------------------
// Context Recall — Passive associative interface (POST /context-recall)
// ---------------------------------------------------------------------------

export type ContextRecallSurface =
  | 'web_passive'
  | 'meeting_passive'
  | 'popup_passive'
  | 'follow_thread'
  | 'meeting_prep'
  | 'composer_guard';

export type ContextRecallContextType =
  | 'webpage'
  | 'meeting'
  | 'message_thread'
  | 'jira_issue'
  | 'document'
  | 'selected_text';

export type ContextRecallScope = RecallScope;

export interface ContextRecallEntityHint {
  /** Coarse hint type, e.g. `jira_key`, `person`, `project`, `group`. */
  kind: string;
  value: string;
  /** Optional id when already resolved on the client. */
  entityId?: string;
}

export interface ContextRecallSourceContext {
  contextType?: string;
  sourceType?: string;
  host?: string;
  url?: string;
  title?: string;
  participants?: string[];
  topic?: string;
  meetingId?: string;
  groupId?: string;
  conversationId?: string;
  messageId?: string;
  issueKey?: string;
  calendarEventId?: string;
}

export interface ContextRecallVisibleMessage {
  id?: string;
  sender?: string;
  text: string;
  timestamp?: number;
  timestampLabel?: string;
}

export interface ContextRecallVisibleField {
  name: string;
  value: string;
  rawText?: string;
}

export type ContextRecallInteractionUserMode =
  | 'read'
  | 'inspect_field'
  | 'focus_composer'
  | 'compose'
  | 'reply'
  | 'comment'
  | 'select_text'
  | 'submit_candidate'
  | 'unknown';

export type ContextRecallInteractionSceneType =
  | 'jira_issue_reading'
  | 'jira_field_inspection'
  | 'jira_comment_composing'
  | 'ringcentral_thread_reading'
  | 'ringcentral_estimate_discussion'
  | 'ringcentral_reply_composing'
  | 'web_reading'
  | 'web_ai_prompt_composing'
  | 'selection_memory_search'
  | 'meeting_live'
  | 'unknown';

export type ContextRecallInteractionSurface =
  | 'memory_lens'
  | 'compose_assist'
  | 'meeting_pilot'
  | 'today_pilot'
  | 'ask';

export interface ContextRecallActiveElementSnapshot {
  kind:
    | 'none'
    | 'button'
    | 'input'
    | 'textarea'
    | 'contenteditable'
    | 'editor'
    | 'link'
    | 'other';
  role?: string;
  mode?: ContextRecallInteractionUserMode;
  label?: string;
  placeholder?: string;
  nearbyText?: string;
  containerRole?: string;
  containerLabel?: string;
  selectorFingerprint?: string;
  hasFocus: boolean;
}

export interface ContextRecallVisibleFact {
  kind:
    | 'jira_field'
    | 'message'
    | 'page_heading'
    | 'status_badge'
    | 'table_cell'
    | 'other';
  name?: string;
  value: string;
  rawText?: string;
  source: 'current_page';
  issueKey?: string;
  confidence: number;
}

export interface ContextRecallInteractionSceneAdmission {
  state: 'blocked' | 'passive_ready' | 'composer_ready' | 'unknown';
  reasons?: string[];
  confidence?: number;
}

export interface ContextRecallInteractionScene {
  sceneType: ContextRecallInteractionSceneType;
  surface: ContextRecallInteractionSurface;
  userMode: ContextRecallInteractionUserMode;
  url?: string;
  title?: string;
  issueKey?: string;
  conversationId?: string;
  groupId?: string;
  meetingId?: string;
  participants?: string[];
  activeElement?: ContextRecallActiveElementSnapshot;
  visibleFacts?: ContextRecallVisibleFact[];
  draftText?: string;
  selectedText?: string;
  nearbyMessages?: ContextRecallVisibleMessage[];
  sourceAnchorHints?: string[];
  admission?: ContextRecallInteractionSceneAdmission;
}

export interface ContextRecallCurrentContext {
  title?: string;
  url?: string;
  conversationId?: string;
  groupId?: string;
  meetingId?: string;
  issueKey?: string;
  participants?: string[];
  visibleMessages?: ContextRecallVisibleMessage[];
  visibleFields?: ContextRecallVisibleField[];
  sourceAnchorHints?: string[];
}

export interface ContextRecallExclude {
  ids?: string[];
  urls?: string[];
  meetingIds?: string[];
  groupIds?: string[];
  conversationIds?: string[];
}

export type ContextRecallReasonType =
  | 'same_project'
  | 'same_people'
  | 'open_action'
  | 'prior_decision'
  | 'linked_artifact'
  | 'meeting_series'
  | 'weak_related'
  | 'semantic'
  | 'keyword'
  | 'source'
  | 'recent'
  | 'entity'
  | 'prospective_cue';

export type ContextRecallEvidenceRole =
  | 'decision'
  | 'action_item'
  | 'action'
  | 'risk'
  | 'context'
  | 'artifact'
  | 'issue'
  | 'rehearsal_cue';

export type ContextRecallDisplayPriority = 'p1' | 'p2' | 'hidden';

export type ContextRecallAutopilotMode =
  | 'silent'
  | 'chip'
  | 'card'
  | 'context_pack';

export interface ContextRecallSceneSummary {
  people?: string[];
  topics?: string[];
  projects?: string[];
  source?: string[];
}

export interface ContextRecallAutopilotQuietReason {
  reason: string;
  label: string;
  count: number;
}

export interface ContextRecallAutopilotDecision {
  /**
   * Scene-aware display decision after recall/rerank. Lens treats `silent` as
   * no prompt, `chip` as low-interruption, `card` as strong contextual prompt,
   * and `context_pack` as evidence for generated assist surfaces.
   */
  mode: ContextRecallAutopilotMode;
  summary: string;
  candidateCount: number;
  shownCount: number;
  strongCount: number;
  possibleCount: number;
  quietedCount: number;
  hiddenCount: number;
  lowInformationCount: number;
  sourceExcludedCount: number;
  duplicateMergedCount: number;
  quietReasons: ContextRecallAutopilotQuietReason[];
  sceneAnchors?: ContextRecallSceneSummary;
  gates: string[];
}

export interface ContextRecallRequest {
  surface: ContextRecallSurface;
  contextType: ContextRecallContextType;
  title?: string;
  url?: string;
  sourceContext?: ContextRecallSourceContext;
  /**
   * Structured current-surface hints used for anaphora/deictic resolution
   * (e.g. RingCentral "那个 BE ready 了吗"). Unlike `exclude`, these fields
   * are anchors for recall expansion and must not suppress same-group memory.
   */
  currentContext?: ContextRecallCurrentContext;
  /**
   * Frontend-collected interaction facts: active element, visible page facts,
   * selected/draft text, and a light admission decision. Memory Service owns
   * the semantic scene/policy decision; this object should stay deterministic.
   */
  interactionScene?: ContextRecallInteractionScene;
  exclude?: ContextRecallExclude;
  /**
   * The single most representative chunk of context. The server rejects
   * payloads that look like raw DOM dumps (very long / very low-signal).
   */
  primaryText?: string;
  /** Surrounding weak-signal texts: recent messages, summaries, topics, etc. */
  secondaryTexts?: string[];
  entityHints?: ContextRecallEntityHint[];
  scope?: ContextRecallScope;
  sourceTypes?: RecallSourceType[];
  /** Default per-surface; usually 1-3. Hard cap of 5. */
  limit?: number;
  /** Set true to receive `debug` info in the response. */
  debug?: boolean;
}

export type SceneFrameSurface =
  | 'memory_lens'
  | 'compose_assist'
  | 'ask'
  | 'meeting_pilot';

export type SceneFrameType =
  | 'jira_estimate'
  | 'jira_issue_update'
  | 'ringcentral_reply'
  | 'meeting_live'
  | 'external_ai_prompt'
  | 'web_reading'
  | 'unknown';

export type SceneFrameIntent =
  | 'read'
  | 'reply'
  | 'fill_field'
  | 'summarize'
  | 'decide'
  | 'delegate'
  | 'unknown';

export interface SceneFrameFieldHint {
  field:
    | 'estimate'
    | 'original_estimate'
    | 'due_date'
    | 'status'
    | 'assignee'
    | 'close_policy'
    | string;
  rawText: string;
  confidence: number;
}

export interface SceneFrame {
  sceneType: SceneFrameType;
  surface: SceneFrameSurface;
  anchors: {
    people?: string[];
    projects?: string[];
    topics?: string[];
    source?: string[];
    issueKey?: string;
    conversationId?: string;
    groupId?: string;
  };
  fieldHints?: SceneFrameFieldHint[];
  userIntent?: SceneFrameIntent;
  interactionSceneType?: ContextRecallInteractionSceneType;
  userMode?: ContextRecallInteractionUserMode;
  visibleFacts?: ContextRecallVisibleFact[];
  admission?: ContextRecallInteractionSceneAdmission;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ContextCueSourceRef {
  type:
    | 'message'
    | 'chunk'
    | 'entity'
    | 'rehearsal'
    | 'source_memory'
    | 'jira'
    | 'meeting'
    | 'reflection_thread';
  id: string;
  title?: string;
  url?: string;
  timestamp?: number;
}

export interface MemoryCueFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers?: Record<string, string>;
  sceneTags: string[];
  sourceRefs: ContextCueSourceRef[];
  confidence: number;
  validFrom?: number;
  validUntil?: number;
}

export interface ContextCue {
  id: string;
  cueKey?: string;
  cueText: string;
  actionType: 'remember' | 'ask' | 'draft_hint' | 'warning' | 'open_source';
  surfaceEligibility: SceneFrameSurface[];
  sourceRefs: ContextCueSourceRef[];
  evidenceMatchIds: string[];
  whyNow: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  compileStatus: 'compiled' | 'suppressed' | 'needs_more_evidence';
  suppressReason?:
    | 'weak_scene_anchor'
    | 'weak_fact'
    | 'stale_source'
    | 'sensitive'
    | 'too_noisy'
    | 'outcome_policy';
  outcomePolicy?: {
    action: 'boost' | 'suppress' | 'send_to_skill_foundry';
    patchId: string;
    strength: number;
    reasonCodes: string[];
    positiveCount: number;
    negativeCount: number;
    signalCount: number;
    expiresAt?: number;
  };
}

export interface ContextRecallMatch {
  id: string;
  type: 'message' | 'chunk' | 'entity' | 'rehearsal' | 'source_memory';
  score: number;
  scope?: MemoryScope;
  title?: string;
  snippet: string;
  /** Source label, e.g. `meeting`, `glip`, `manual`, `jira`. */
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  /** Stable jump link into the memory-exploring Vue UI. */
  exploreLink?: string;
  /** Direct deep links to open the source (max 2). */
  links: Array<{ label: string; url: string }>;
  /** Short human-readable explanation: which channel hit / why this matches. */
  whyMatched?: string;
  /**
   * User-facing reasons explaining the concrete anchors that made this memory
   * relevant to the current scene. Intended for Memory Lens / Meeting Pilot UI.
   */
  whyRelevant?: string[];
  matchedAnchors?: {
    people?: string[];
    topics?: string[];
    projects?: string[];
    source?: string[];
  };
  suppressionReason?: string;
  uiSummary?: string;
  reasonType?: ContextRecallReasonType;
  evidenceRole?: ContextRecallEvidenceRole;
  displayPriority?: ContextRecallDisplayPriority;
  metadata?: Record<string, any>;
  mergedCount?: number;
  mergedIds?: string[];
  sourceClusterKey?: string;
  timestamp?: number;
  cue?: ContextCue;
}

export interface ContextRecallScopeCounts {
  work: number;
  personal: number;
  unknown: number;
  total: number;
}

export interface ContextRecallScopeReceipt {
  requestedScope: ContextRecallScope;
  effectiveScope: MemoryScope | 'both';
  shown: ContextRecallScopeCounts;
  candidates: ContextRecallScopeCounts;
  note: string;
  includesPersonal: boolean;
}

export interface ContextRecallDebug {
  normalizedQuery: string;
  channelsHit: string[];
  rejectedReason?: string;
  suppressionReasons?: string[];
  sceneFrame?: SceneFrame;
  interactionScene?: ContextRecallInteractionScene;
  cueCompiler?: {
    sceneType: SceneFrameType;
    compiledCount: number;
    suppressedCount: number;
    policySuppressedCount?: number;
    boostedCount?: number;
    needsMoreEvidenceCount: number;
    factCount: number;
  };
  autopilot?: ContextRecallAutopilotDecision;
  contextExpansion?: {
    expandedQuery?: string;
    addedTerms?: string[];
    resolvedProject?: string;
    resolvedRole?: string;
    ambiguity?: {
      state: 'none' | 'ambiguous';
      candidates: Array<{ label: string; score: number; reason?: string }>;
    };
    sourceAnchors?: string[];
    contextMatch?: {
      state: 'locked' | 'ambiguous' | 'none';
      selectedTopic?: Record<string, any>;
      candidates: Array<Record<string, any>>;
      expandedQuery?: string;
      userFacingSummary: string;
    };
  };
}

export interface ContextRecallResponse {
  matches: ContextRecallMatch[];
  topMatch: ContextRecallMatch | null;
  queryTimeMs: number;
  scopeReceipt?: ContextRecallScopeReceipt;
  autopilot?: ContextRecallAutopilotDecision;
  /** Weave provenance (P0-5): present only when matches stitch ≥2 sources or ≥7 days. */
  weave?: WeaveStats;
  debug?: ContextRecallDebug;
}

export type ComposerSurface =
  | 'ringcentral_message'
  | 'ringcentral_thread'
  | 'jira_issue'
  | 'chatgpt'
  | 'doubao'
  | 'claude'
  | 'gemini'
  | 'codex_cli'
  | 'claude_code_cli'
  | 'cursor_agent_cli'
  | 'generic_agent';

export type ComposerContextType =
  | 'message_thread'
  | 'jira_issue'
  | 'web_agent_prompt';

export type ComposerScenario =
  | 'instant_message_reply'
  | 'thread_reply'
  | 'jira_comment'
  | 'web_agent_prompt'
  | 'compose_to_ai'
  | 'agent_compose'
  | 'document_note';

export type ComposerContextItemType =
  | 'message'
  | 'thread_root'
  | 'thread_reply'
  | 'jira_summary'
  | 'jira_description'
  | 'jira_comment'
  | 'attachment'
  | 'image';

export interface ComposerVisibleMessage {
  id?: string;
  sender?: string;
  text: string;
  timestampLabel?: string;
}

export interface ComposerVisibleField {
  name: string;
  value: string;
  rawText?: string;
}

export interface ComposerAudience {
  conversationTitle?: string;
  conversationId?: string;
  groupId?: string;
  issueKey?: string;
  issueSummary?: string;
  people?: string[];
  provider?: string;
  relationshipHint?: string;
}

export interface ComposerContextItem {
  type: ComposerContextItemType;
  id?: string;
  sender?: string;
  title?: string;
  text?: string;
  timestampLabel?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ComposerAssistRequest {
  surface: ComposerSurface;
  contextType: ComposerContextType;
  scenario?: ComposerScenario;
  title?: string;
  url?: string;
  draftText?: string;
  primaryText?: string;
  secondaryTexts?: string[];
  keywords?: string[];
  identifiers?: {
    conversationId?: string;
    groupId?: string;
    threadRootPostId?: string;
    issueKey?: string;
    provider?: string;
  };
  visibleMessages?: ComposerVisibleMessage[];
  visibleFields?: ComposerVisibleField[];
  threadRoot?: ComposerVisibleMessage;
  audience?: ComposerAudience;
  contextItems?: ComposerContextItem[];
  sourceTypes?: RecallSourceType[];
  interactionScene?: ContextRecallInteractionScene;
  automationLevel?: 'L1' | 'L2';
  debug?: boolean;
}

export interface ComposerAssistEvidence {
  id: string;
  type: 'message' | 'chunk' | 'entity' | 'rehearsal' | 'source_memory';
  title?: string;
  snippet: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  links?: Array<{ label: string; url: string }>;
  whyMatched?: string;
  whyRelevant?: string[];
  matchedAnchors?: ContextRecallMatch['matchedAnchors'];
  reasonType?: ContextRecallReasonType;
  evidenceRole?: ContextRecallEvidenceRole;
  displayPriority?: ContextRecallDisplayPriority;
  metadata?: Record<string, any>;
  timestamp?: number;
  score?: number;
  cue?: ContextCue;
}

export interface ComposerAssistResponse {
  available: boolean;
  suggestionType: 'none' | 'context_pack' | 'reply_context' | 'issue_context';
  title?: string;
  summary?: string;
  insertText?: string;
  evidence: ComposerAssistEvidence[];
  riskLevel: 'low' | 'medium' | 'high';
  previewRequired: boolean;
  confidence: number;
  queryTimeMs: number;
  debug?: Record<string, unknown>;
}

export type StorylineType =
  | 'sharing'
  | 'status_report'
  | 'retro'
  | 'training'
  | 'proposal'
  | 'weekly_update';

export type StorylineSuggestedArtifact =
  | 'speaker_notes'
  | 'slides_outline'
  | 'ringcentral_post'
  | 'docs_brief';

export interface StorylineOpportunity {
  available: boolean;
  confidence: number;
  storyType?: StorylineType;
  buttonLabel?: string;
  oneLineReason?: string;
  audienceHint?: string;
  estimatedLengthMinutes?: number;
  evidenceClusters?: Array<{
    label: string;
    sourceKinds: string[];
    evidenceCount: number;
  }>;
  blockedReasons?: string[];
  suggestedArtifact?: StorylineSuggestedArtifact;
}

export type StorylineSourceKind = 'today_meeting_prep';

export interface StorylineDraftRequest {
  sourceKind: StorylineSourceKind;
  prepId: string;
  targetArtifact?: StorylineSuggestedArtifact;
  audienceHint?: string;
}

export interface StorylineDraftSegment {
  title: string;
  intent: string;
  narrative: string;
  evidenceIds: string[];
}

export interface StorylineDraftResponse {
  id: string;
  sourceKind: StorylineSourceKind;
  sourceId: string;
  title: string;
  audience: string;
  targetArtifact: StorylineSuggestedArtifact;
  segments: StorylineDraftSegment[];
  evidence?: ComposerAssistEvidence[];
  gaps: string[];
  riskNotes: string[];
  artifactText: string;
}

export type ContextAssistSurface = 'meeting_prep' | 'composer_guard';

export type ContextAssistContextType =
  | 'meeting'
  | 'message_thread'
  | 'jira_issue'
  | 'web_agent_prompt';

export interface ContextAssistMeetingParticipant {
  name?: string;
  email?: string;
  responseStatus?: string;
}

export interface ContextAssistMeetingEvent {
  externalId?: string;
  seriesKey?: string;
  title?: string;
  descriptionPreview?: string;
  startTime?: number;
  endTime?: number;
  organizer?: ContextAssistMeetingParticipant;
  attendees?: ContextAssistMeetingParticipant[];
  location?: string;
  joinUrl?: string;
  sourceUrl?: string;
  cancelled?: boolean;
  lastModifiedTime?: number;
  metadata?: Record<string, unknown>;
}

export interface ContextAssistRequest {
  surface: ContextAssistSurface;
  contextType: ContextAssistContextType;
  title?: string;
  url?: string;
  userGoal?: string;
  primaryText?: string;
  secondaryTexts?: string[];
  keywords?: string[];
  entityHints?: ContextRecallEntityHint[];
  event?: ContextAssistMeetingEvent;
  composer?: ComposerAssistRequest;
  sourceTypes?: RecallSourceType[];
  limit?: number;
  debug?: boolean;
}

export interface ContextAssistCueCard {
  id: string;
  kind: 'brief' | 'memory' | 'question' | 'action';
  title: string;
  body: string;
  evidenceIds?: string[];
}

export interface ContextAssistResponse {
  available: boolean;
  surface: ContextAssistSurface;
  suggestionType:
    | 'none'
    | 'meeting_brief'
    | ComposerAssistResponse['suggestionType'];
  title?: string;
  summary?: string;
  insertText?: string;
  cueCards: ContextAssistCueCard[];
  evidence: ComposerAssistEvidence[];
  riskLevel: 'low' | 'medium' | 'high';
  previewRequired: boolean;
  confidence: number;
  queryTimeMs: number;
  storylineOpportunity?: StorylineOpportunity;
  debug?: Record<string, unknown>;
}

export type CalendarEventSourceSystem = 'outlook' | 'ringcentral_indexeddb';

export interface CalendarEventSyncParticipant {
  name?: string;
  email?: string;
  responseStatus?: string;
}

export interface CalendarEventSyncItem {
  externalId: string;
  seriesKey?: string;
  title: string;
  descriptionPreview?: string;
  startTime: number;
  endTime?: number;
  organizer?: CalendarEventSyncParticipant;
  attendees?: CalendarEventSyncParticipant[];
  location?: string;
  joinUrl?: string;
  sourceUrl?: string;
  cancelled?: boolean;
  lastModifiedTime?: number;
  metadata?: Record<string, unknown>;
}

export interface CalendarEventsSyncRequest {
  sourceSystem: CalendarEventSourceSystem;
  events: CalendarEventSyncItem[];
  deletedExternalIds?: string[];
  syncedAt?: number;
  debug?: boolean;
}

export interface CalendarEventsSyncResponse {
  created: number;
  updated: number;
  unchanged: number;
  cancelled: number;
  deleted: number;
  total: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    messageCount: number;
    entityCount: number;
    chunkCount: number;
  };
  embedding: {
    loaded: boolean;
    model: string;
  };
}

// ============ Multi-User / Fastify Extensions ============

import 'fastify';
import type {
  UserContext,
  UserContextManager,
} from '../core/UserContextManager.js';

declare module 'fastify' {
  interface FastifyInstance {
    userContextManager: UserContextManager;
  }

  interface FastifyRequest {
    userId: string;
    userContext: UserContext;
  }
}
