/**
 * MemoryServiceClient — HTTP client for the Personal AI Memory Service.
 * Replaces direct ChromaDB/LocalStorage access with API calls to the backend.
 *
 * Designed to run inside the Chrome Extension service worker context,
 * using the standard fetch API and chrome.storage.local for configuration.
 */

import {
  DEFAULT_UI_LANGUAGE,
  readExtensionUiPreferences,
} from '../i18n/index.js';
import { DEFAULT_MEMORY_SERVICE_BASE_URL } from '../memoryServiceConfig.js';
import {
  ensureDeviceApiKey,
  clearStoredDeviceKey,
  clearStoredHelpCenterKey,
} from '../deviceApiKey.js';
import { getDefaultEnvConfig } from '../utils.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30_000;
const USER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

interface StoredMemoryUserInfo {
  username?: string;
  userEmail?: string;
  email?: string;
}

function resolveStoredMemoryUserId(userinfo?: StoredMemoryUserInfo): string | null {
  const candidates = [
    userinfo?.username,
    userinfo?.userEmail?.split('@')[0],
    userinfo?.email?.split('@')[0],
  ];
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized && USER_ID_PATTERN.test(normalized)) return normalized;
  }
  return null;
}

export interface MemoryServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number; // ms, default 30000
  userId?: string; // multi-user isolation, default 'default'
}

/**
 * Single frontend usage/token event uploaded to the analytics ingest endpoint.
 * Shape mirrors the cross-repo contract consumed by
 * `POST /api/v1/usage/telemetry` (see src/analytics/UsageTracker.ts).
 */
export interface UsageTelemetryEvent {
  ts: number;
  side: 'frontend';
  capability: string;
  feature: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  status?: 'ok' | 'error';
  errorKind?: string;
  tokensEstimated?: boolean;
}

// ============================================================================
// Ingest types
// ============================================================================

export interface IngestPayload {
  content: string;
  sourceType:
    | 'glip'
    | 'jira'
    | 'web'
    | 'manual'
    | 'system'
    | 'meeting'
    | 'calendar'
    | 'ai_chat'
    | 'doubao'
    | 'chatgpt'
    | 'doubao_chat'
    | 'codex_cli'
    | 'claude_code_cli'
    | 'cursor_agent_cli'
    | 'mcp_client';
  scope?: 'work' | 'personal';
  source?: string;
  sender?: string;
  groupId?: string;
  groupName?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  skipExtraction?: boolean;
}

export interface IngestClaimAttributionDecision {
  status: 'legacy_unclassified' | 'pending' | 'resolved' | 'failed';
  claimCount: number;
  highResponsibilityAllowed: number;
  highResponsibilityBlocked: number;
  receipt?: ClaimAttributionReceipt;
}

export interface IngestDecision {
  storage: 'indexed' | 'stored_unindexed' | 'duplicate' | 'error';
  reason:
    | 'salience_indexed'
    | 'salience_below_threshold'
    | 'extraction_skipped'
    | 'extraction_unavailable'
    | 'duplicate_post_id'
    | 'duplicate_content_source_sender'
    | 'indexing_failed'
    | 'insert_failed';
  salienceScore?: number;
  salienceComponents?: {
    importance: number;
    frequency: number;
    recency: number;
    surprise: number;
    redundancy: number;
    userInterestBoost?: number;
  };
  extractionStatus?: 'extracted' | 'skipped' | 'unavailable';
  shouldIndex?: boolean;
  indexed?: boolean;
  duplicateOf?: string;
  dedupeReason?: 'post_id' | 'content_source_sender';
  trustClass?: 'trusted' | 'internal' | 'untrusted';
  sanitization?: 'clean' | 'flagged';
  injectionFlags?: string[];
  mergeOp?: {
    op: 'UPDATE' | 'MERGE' | 'NOOP';
    neighborIds: number[];
    reason: string;
  };
  claimAttribution?: IngestClaimAttributionDecision;
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
  storage: Record<IngestDecision['storage'] | 'unknown', number>;
  reasons: Record<IngestDecision['reason'] | 'unknown', number>;
  extractionStatus: Record<
    NonNullable<IngestDecision['extractionStatus']> | 'unknown',
    number
  >;
  trustClass: Record<NonNullable<IngestDecision['trustClass']> | 'unknown', number>;
  sanitization: Record<
    NonNullable<IngestDecision['sanitization']> | 'unknown',
    number
  >;
  indexing: {
    requested: number;
    completed: number;
    notRequested: number;
    failedAfterRequest: number;
    unknown: number;
  };
  missingDecision: number;
}

export interface BatchIngestResult {
  results: IngestResult[];
  totalCreated: number;
  totalDuplicate: number;
  totalError: number;
  decisionSummary?: BatchIngestDecisionSummary;
}

// ============================================================================
// Recall & Ask types
// ============================================================================

export type RecallAnalysisMode = 'search' | 'research' | 'aggregate';
export type RecallBlockType =
  | 'summary'
  | 'timeline'
  | 'evidence_list'
  | 'media';
export type RecallPresentationBlockType = Exclude<RecallBlockType, 'summary'>;
export type RecallRetrievalMode = 'fast' | 'balanced' | 'deep';
export type RecallSynthesisTrigger = 'user' | 'api';
export interface RecallSynthesisRequest {
  mode: 'none' | 'summary';
  trigger?: RecallSynthesisTrigger;
  maxTokens?: number;
  minEvidenceItems?: number;
}
export type RecallPresentationHint =
  | 'default'
  | 'compact'
  | 'meeting_pilot'
  | 'research'
  | 'dashboard';
export type RecallLifecycleMode =
  | 'active_default'
  | 'passive_surface'
  | 'composer_surface'
  | 'historical'
  | 'explicit_search'
  | 'audit';
export type RecallScope = 'work' | 'personal' | 'both' | 'all';
export type RecallChannelName = 'vector' | 'fts' | 'graph' | 'time';
export type RecallChannelStatus = 'hit' | 'empty' | 'skipped' | 'failed';

export interface RecallChannelDiagnostic {
  channel: RecallChannelName;
  status: RecallChannelStatus;
  candidateCount: number;
  reason?: string;
}

export interface RecallScopeCounts {
  work: number;
  personal: number;
  unknown: number;
  total: number;
}

export interface RecallScopeReceipt {
  requestedScope: RecallScope;
  effectiveScope: 'work' | 'personal' | 'both';
  returned: RecallScopeCounts;
  candidates: RecallScopeCounts;
  note: string;
  includesPersonal: boolean;
}

export interface RecallOptions {
  topK?: number;
  channels?: RecallChannelName[];
  timeRange?: { start?: number; end?: number };
  entityTypes?: string[];
  projectFilter?: string;
  minSalience?: number;
  includeMetadata?: boolean;
  senderFilter?: string[];
  groupFilter?: string[];
  minImportance?: number;
  sourceTypes?: string[];
  presentationHint?: RecallPresentationHint;
  lifecycleMode?: RecallLifecycleMode;
  previewMaxLength?: number;
  scope?: RecallScope;
  /** @deprecated Accepted for compatibility; it no longer controls routing. */
  analysisMode?: RecallAnalysisMode;
  retrievalMode?: RecallRetrievalMode;
  presentationBlocks?: RecallPresentationBlockType[];
  synthesis?: RecallSynthesisRequest;
  /**
   * @deprecated Use `presentationBlocks` and `synthesis`. Kept for older
   * clients during migration.
   */
  blockTypes?: RecallBlockType[];
}

export interface RecallResult {
  items: RecallItem[];
  totalFound: number;
  queryTimeMs: number;
  channels: string[];
  channelDiagnostics?: RecallChannelDiagnostic[];
  scopeReceipt?: RecallScopeReceipt;
  retrievalTimeMs?: number;
  synthesisTimeMs?: number;
  retrievalReceipt?: RecallRetrievalReceipt;
  synthesisReceipt?: RecallSynthesisReceipt;
  blocks?: RecallBlock[];
  analysis?: RecallAnalysis;
}

export interface RecallRetrievalReceipt {
  requestedMode: RecallRetrievalMode;
  effectiveChannels: string[];
  runtimePolicy: 'default' | 'safe_fts';
}

export type RecallSynthesisStatus =
  | 'not_requested'
  | 'skipped_empty'
  | 'skipped_insufficient'
  | 'skipped_by_caller'
  | 'succeeded'
  | 'failed'
  | 'invalid_output';

export interface RecallSynthesisReceipt {
  requested: boolean;
  mode: 'none' | 'summary';
  trigger?: RecallSynthesisTrigger;
  status: RecallSynthesisStatus;
  cacheHit: boolean;
  evidenceItemIds: string[];
  minimumEvidenceItems?: number;
  errorCode?: 'llm_failed' | 'invalid_output';
}

export interface RecallItem {
  id: string;
  type: 'message' | 'chunk' | 'entity';
  content: string;
  scope?: 'work' | 'personal';
  displayTitle?: string;
  displayText?: string;
  previewText?: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  /** Stable jump link into memory-exploring (Vue UI). */
  exploreLink?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  entity?: {
    id: string;
    type: string;
    name: string;
    description?: string;
  };
}

export type MemoryFeedbackTargetType =
  | 'message'
  | 'chunk'
  | 'entity'
  | 'source_memory';
export type MemoryFeedbackAction = 'positive' | 'negative' | 'clear';
export type MemoryFeedbackType =
  | 'recall_quality'
  | 'notification_useful'
  | 'entity_correction';

export interface MemoryFeedbackPayload {
  type: MemoryFeedbackType;
  targetId: string;
  targetType?: MemoryFeedbackTargetType;
  action: MemoryFeedbackAction;
  detail?: string;
}

export interface RecallPatchReplay {
  id: string;
  patchId: string;
  before: Array<Record<string, unknown>>;
  after: Array<Record<string, unknown>>;
  changed: boolean;
  warnings: string[];
  createdAt: number;
}

export interface RecallRelevancePatch {
  id: string;
  userId: string;
  status: 'active' | 'pending_confirm' | 'paused' | 'deleted';
  source: string;
  sceneSignature: string;
  scene: Record<string, unknown>;
  targetType: MemoryFeedbackTargetType | 'rehearsal';
  targetId: string;
  reason: string;
  action: 'hide_for_scene' | 'demote_for_scene';
  scope: 'scene_only' | 'same_group' | 'same_project';
  autoApplied: boolean;
  userNote?: string;
  evidence: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface RecallRelevanceRecordResult {
  status: 'patched' | 'cleared' | 'ignored';
  patch?: RecallRelevancePatch;
  replay?: RecallPatchReplay;
  trainingCaseId?: string;
  clearedPatchIds?: string[];
}

export interface RecallRelevanceFeedbackPayload {
  targetType: MemoryFeedbackTargetType | 'rehearsal';
  targetId: string;
  action?: MemoryFeedbackAction;
  reason?: string;
  surface?: string;
  scope?: string;
  detail?: string | Record<string, unknown>;
  scene?: Record<string, unknown>;
  autoApplied?: boolean;
  userNote?: string;
}

export interface MemoryFeedbackResult {
  status: 'ok';
  targetType?: MemoryFeedbackTargetType;
  previousAction?: MemoryFeedbackAction;
  appliedDelta?: number;
  relevancePatch?: RecallRelevanceRecordResult;
}

// ---------- Active recall blocks ----------
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
export interface RecallTimelineEvent {
  id?: string;
  date: string;
  timestamp?: number;
  title: string;
  description?: string;
  sourceItemId?: string;
  exploreLink?: string;
}
export interface RecallMediaItem {
  kind: 'link' | 'image' | 'pdf' | 'attachment' | 'page';
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  description?: string;
  itemId?: string;
}
export interface RecallSummaryBlockPayload {
  text: string;
  bullets?: string[];
  confidence?: number;
}

export type RecallBlock =
  | { type: 'summary'; title?: string; payload: RecallSummaryBlockPayload }
  | {
      type: 'timeline';
      title?: string;
      payload: { events: RecallTimelineEvent[] };
    }
  | {
      type: 'evidence_list';
      title?: string;
      payload: { cards: RecallEvidenceCard[] };
    }
  | {
      type: 'media';
      title?: string;
      payload: { items: RecallMediaItem[] };
    };

export type DecisionEvidenceChainType =
  | 'why_decided'
  | 'what_changed'
  | 'decision_status'
  | 'who_committed'
  | 'tradeoff_history'
  | 'not_a_decision';

export interface DecisionEvidenceRef {
  sourceType: string;
  sourceId: string;
  timestamp?: number;
  speakerOrActor?: string;
  stance: 'supports' | 'contradicts' | 'background' | 'open_question';
  snippet: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  score?: number;
}

export interface DecisionEvidenceChainPayload {
  question: string;
  decisionDetected: boolean;
  chainType: DecisionEvidenceChainType;
  answerSummary: string;
  decisionStatement?: string;
  then?: {
    knownAt?: number;
    conclusion: string;
    rationale: string[];
    assumptions: string[];
    evidenceRefs: DecisionEvidenceRef[];
  };
  now?: {
    checkedAt: number;
    stillValid: string[];
    changed: string[];
    contradictedBy: DecisionEvidenceRef[];
    missingEvidence: string[];
  };
  confidence: number;
  saveCandidate?: {
    suggestedTitle: string;
    reasonToSave: string;
    defaultStatus: 'candidate' | 'active' | 'revisit_needed';
  };
}

export type AskBlock =
  | RecallBlock
  | {
      type: 'decision_evidence_chain';
      title?: string;
      payload: DecisionEvidenceChainPayload;
    };

export interface RecallAnalysis {
  summary: string;
  evidenceItemIds?: string[];
  keyFindings?: string[];
  groundedFindings?: Array<{
    text: string;
    evidenceItemIds: string[];
  }>;
  insights?: string[];
  rankingRationale?: string;
  openQuestions?: string[];
  confidence?: number;
}

// ---------- Context recall (passive) ----------

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

export interface ContextRecallEntityHint {
  kind: string;
  value: string;
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
  verifiedSourceFields?: Array<{
    propertyKey: string;
    name: string;
    value: string | null;
    source: 'jira_rest';
    checkedAt: number;
  }>;
  sourceAnchorHints?: string[];
}

export interface ContextRecallExclude {
  ids?: string[];
  urls?: string[];
  meetingIds?: string[];
  groupIds?: string[];
  conversationIds?: string[];
}

export interface ContextRecallRequest {
  surface: ContextRecallSurface;
  contextType: ContextRecallContextType;
  title?: string;
  url?: string;
  sourceContext?: ContextRecallSourceContext;
  currentContext?: ContextRecallCurrentContext;
  interactionScene?: ContextRecallInteractionScene;
  exclude?: ContextRecallExclude;
  primaryText?: string;
  secondaryTexts?: string[];
  entityHints?: ContextRecallEntityHint[];
  scope?: RecallScope;
  sourceTypes?: string[];
  limit?: number;
  debug?: boolean;
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

export interface ContextCue {
  id: string;
  cueKey?: string;
  cueText: string;
  actionType: 'remember' | 'ask' | 'draft_hint' | 'warning' | 'open_source';
  surfaceEligibility: Array<
    'memory_lens' | 'compose_assist' | 'ask' | 'meeting_pilot'
  >;
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

export interface LensPresentation {
  status: 'ready' | 'partial' | 'blocked';
  informationValue: 'high' | 'medium' | 'low';
  title: string;
  extractedInfo?: string;
  suggestedAction?: string;
  novelty:
    | 'new_to_current_surface'
    | 'already_visible'
    | 'anchor_only'
    | 'unknown';
  sourceBoundary: 'reviewable_memory' | 'derived_summary' | 'raw_source';
  suppressReason?: string;
  presentationId?: string;
}

export interface KeystoneBriefClaim {
  text: string;
  sourceRefs: string[];
  confidence?: 'high' | 'medium' | 'low';
  authority?:
    | 'user_owned'
    | 'direct_message'
    | 'source_memory'
    | 'jira'
    | 'meeting'
    | 'reflection'
    | 'derived';
  validAsOf?: number;
  staleRisk?: 'low' | 'medium' | 'high';
  projection?: 'local_only' | 'summary_ok' | 'blocked_external';
  actor?: string;
  decidedAt?: number;
}

export interface KeystoneBrief {
  id: string;
  briefKey: string;
  title: string;
  subjectType: string;
  scope: 'work' | 'personal' | 'mixed_summary_only';
  status: 'candidate' | 'ready' | 'partial' | 'blocked' | 'stale' | 'hidden';
  summary: string;
  externalSummary?: string;
  sourceAsOf: number;
  freshness: {
    state: 'fresh' | 'watching' | 'stale_risk' | 'blocked_source';
    reason: string;
    expiresAt?: number;
    watchContractId?: string;
  };
  slots: {
    whyItMatters: string;
    currentState: string;
    stableFacts: KeystoneBriefClaim[];
    decisions: KeystoneBriefClaim[];
    constraints: KeystoneBriefClaim[];
    traps: KeystoneBriefClaim[];
    peopleAndSources: Array<{ name: string; role: string; sourceRefs: string[] }>;
    nextUseCases: string[];
    openQuestions: string[];
  };
  sourceMap: Array<{
    ref: string;
    sourceType: string;
    sourceId: string;
    role: 'authority' | 'supporting' | 'derived' | 'prior';
    title?: string;
    url?: string;
    timestamp?: number;
    authority: KeystoneBriefClaim['authority'];
    projection: 'local_only' | 'summary_ok' | 'blocked_external';
    hidden?: boolean;
    snippet?: string;
    metadata?: Record<string, unknown>;
  }>;
  sceneAnchors: {
    projects: string[];
    jiraKeys: string[];
    people: string[];
    topics: string[];
    surfaces: string[];
  };
  displayPolicy: {
    defaultMode: 'silent' | 'chip' | 'card';
    maxLines: number;
    canCopyToDraft: boolean;
    externalSummaryOnly: boolean;
    hiddenSourceCount: number;
  };
  writeReceipt: {
    writesProfile: false;
    sendsExternal: false;
    createsTask: false;
    updatesFacts: false;
    writesOutcomeEvent: true;
  };
  repairState: 'clean' | 'needs_repair';
  blockedReason?: string;
  compositionVersion: string;
  createdAt: number;
  updatedAt: number;
}

export interface KeystoneBriefPresentation {
  brief: KeystoneBrief;
  presentationMode: 'primary' | 'conflict' | 'stale_notice';
  whyNow: string;
  evidenceMatchIds: string[];
  relatedMemoryCount: number;
}

export interface EvidenceCohesionReceipt {
  policyVersion: 'evidence-cohesion-v1';
  state:
    | 'cohesive'
    | 'cohesive_with_background'
    | 'split_required'
    | 'insufficient_anchor'
    | 'conflict_needs_authority'
    | 'blocked_cross_scene';
  usedCount: number;
  excludedCount: number;
  clusterCount: number;
  primarySubject?: string;
  silent: boolean;
  summary: string;
}

export interface ClaimAttributionReceiptItem {
  claimId: string;
  sourceMessageId: string;
  revision: number;
  excerpt: string;
  ownerKind:
    | 'self'
    | 'named_person'
    | 'organization_or_source'
    | 'ai_agent'
    | 'system_observation'
    | 'unknown';
  ownerLabel: string;
  speechMode: string;
  verification: string;
  commitment: string;
  effect: 'used' | 'background_only' | 'blocked';
  displayLabel: string;
  consequence: string;
  correctionAllowed: boolean;
  corrected: boolean;
}

export interface ClaimAttributionReceipt {
  status: 'mixed' | 'downgraded' | 'corrected';
  visibility: 'compact' | 'review';
  summary: string;
  boundary: string;
  used: Array<{ kind: string; label: string; count: number }>;
  backgroundOnly: Array<{ kind: string; label: string; count: number }>;
  blocked: Array<{ kind: string; label: string; count: number }>;
  claims: ClaimAttributionReceiptItem[];
  affectedHighResponsibility: boolean;
  correctedCount: number;
}

export interface MemoryClaimCorrectionRequest {
  correction:
    | 'not_my_view'
    | 'my_decision'
    | 'reported_speech'
    | 'hypothesis'
    | 'undo_last';
  expectedRevision: number;
  source:
    | 'ask_receipt'
    | 'memory_lens'
    | 'user_profile'
    | 'meeting_pilot'
    | 'api';
  idempotencyKey?: string;
}

export interface MemoryClaimCorrectionResponse {
  claimId: string;
  revision: number;
  invalidatedDerived: Record<string, number>;
  recomputeStatus: 'not_needed' | 'queued' | 'required';
  rawSourceChanged: false;
  previous: Record<string, unknown>;
  current: Record<string, unknown>;
}

export interface ContextRecallMatch {
  id: string;
  type:
    | 'message'
    | 'chunk'
    | 'entity'
    | 'rehearsal'
    | 'source_memory'
    | 'reflection_thread';
  score: number;
  scope?: 'work' | 'personal';
  title?: string;
  uiSummary?: string;
  snippet: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  links: Array<{ label: string; url: string }>;
  whyMatched?: string;
  whyRelevant?: string[];
  matchedAnchors?: {
    people?: string[];
    topics?: string[];
    projects?: string[];
    source?: string[];
  };
  suppressionReason?: string;
  reasonType?: string;
  evidenceRole?: string;
  displayPriority?: 'p1' | 'p2' | 'hidden';
  metadata?: Record<string, unknown>;
  mergedCount?: number;
  mergedIds?: string[];
  sourceClusterKey?: string;
  sourceContext?: string;
  timestamp?: number;
  cue?: ContextCue;
  lensPresentation?: LensPresentation;
  claimAttribution?: ClaimAttributionReceiptItem[];
}

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
  mode: 'silent' | 'chip' | 'card' | 'context_pack';
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

export type MemoryChangeProjectionStatus =
  | 'confirmed_current'
  | 'last_observed'
  | 'conflicted'
  | 'historical_only'
  | 'superseded_on_page'
  | 'superseded_at_source';

export interface MemoryChangeValue {
  kind: 'text' | 'number' | 'date' | 'boolean' | 'status' | 'entity_ref' | 'set';
  display: string;
  normalized: string | number | boolean | string[] | null;
  raw?: string;
}

export interface MemoryChangeEvent {
  id: string;
  chainKey: string;
  subjectKey: string;
  subjectLabel: string;
  subjectKind: string;
  propertyKey: string;
  propertyLabel: string;
  previousValue?: MemoryChangeValue;
  nextValue: MemoryChangeValue;
  eventKind: 'set' | 'update' | 'clear' | 'revert';
  authorityRole:
    | 'authoritative_source'
    | 'owner_authored'
    | 'team_message'
    | 'ai_generated'
    | 'source_snapshot'
    | 'inferred';
  confidence: number;
  sourceRef: { type: string; id: string; title?: string; url?: string };
  actor?: string;
  reason?: string;
  evidenceQuote?: string;
  observedAt: number;
  capturedAt: number;
  active: boolean;
  isReversal: boolean;
}

export interface MemoryChangeProjection {
  chainKey: string;
  subjectKey: string;
  subjectLabel: string;
  subjectKind: string;
  propertyKey: string;
  propertyLabel: string;
  currentValue?: MemoryChangeValue;
  previousValue?: MemoryChangeValue;
  visiblePageValue?: MemoryChangeValue;
  status: MemoryChangeProjectionStatus;
  summary: string;
  boundary: string;
  eventCount: number;
  reversalCount: number;
  conflictCount: number;
  firstObservedAt?: number;
  lastObservedAt?: number;
  currentEvent?: MemoryChangeEvent;
  history: MemoryChangeEvent[];
}

export interface MemoryChangeLedgerReceipt {
  status: 'ready' | 'no_change' | 'blocked' | 'not_run';
  label: string;
  detail: string;
  evidence: string[];
  inputHash?: string;
  extractedCount: number;
  excludedNoiseCount: number;
  generatedAt?: number;
  active: boolean;
  events: MemoryChangeEvent[];
  projections: MemoryChangeProjection[];
}

export interface ContextRecallScopeCounts {
  work: number;
  personal: number;
  unknown: number;
  total: number;
}

export interface ContextRecallScopeReceipt {
  requestedScope: RecallScope;
  effectiveScope: 'work' | 'personal' | 'both';
  shown: ContextRecallScopeCounts;
  candidates: ContextRecallScopeCounts;
  note: string;
  includesPersonal: boolean;
}

export interface WeaveStats {
  sourceCount: number;
  sourceKinds: string[];
  daySpanDays: number;
  entityCount: number;
  crossSource: boolean;
}

export interface ContextRecallResponse {
  matches: ContextRecallMatch[];
  topMatch: ContextRecallMatch | null;
  queryTimeMs: number;
  scopeReceipt?: ContextRecallScopeReceipt;
  cohesionReceipt?: EvidenceCohesionReceipt;
  autopilot?: ContextRecallAutopilotDecision;
  changeProjections?: MemoryChangeProjection[];
  /** Weave provenance (P0-5): present only when matches stitch ≥2 sources or ≥7 days. */
  weave?: WeaveStats;
  keystoneBrief?: KeystoneBriefPresentation;
  attributionReceipt?: ClaimAttributionReceipt;
  debug?: {
    normalizedQuery: string;
    channelsHit: string[];
    rejectedReason?: string;
    suppressionReasons?: string[];
    sceneFrame?: Record<string, unknown>;
    interactionScene?: ContextRecallInteractionScene;
    autopilot?: ContextRecallAutopilotDecision;
  };
}

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
  displayPriority: 'p1' | 'p2' | 'hidden';
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

export interface RehearsalDetailResponse {
  rehearsal: Rehearsal;
  activations: RehearsalActivation[];
}

export interface RehearsalMutationPayload {
  title?: string;
  scenarioType?: string;
  status?: RehearsalStatus;
  summary?: string | null;
  content?: string;
  activationCues?: RehearsalActivationCues;
  evidenceRefs?: string[];
  sourceKind?: string;
  sourceRefId?: string | null;
  confidence?: number;
  priority?: number;
  validFrom?: number | null;
  validUntil?: number | null;
  staleReason?: string | null;
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

/** Draft Compose (focus + empty) vs Draft Refine (blur + non-empty). */
export type ComposerAssistIntent = 'draft_compose' | 'draft_refine';

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

export type ComposerAudienceType =
  | 'peer'
  | 'manager'
  | 'direct_report'
  | 'external'
  | 'mixed'
  | 'unknown';

export type ComposerAudienceSource =
  | 'confirmed_social_edge'
  | 'relationship_hint'
  | 'scene_default'
  | 'unresolved';

export type PersonaProjectionScene =
  | 'ringcentral_message'
  | 'ringcentral_thread'
  | 'jira_comment'
  | 'web_ai_context_pack'
  | 'web_ai_prompt_patch'
  | 'web_ai_rewrite_prompt';

export type PersonaRepresentationMode =
  | 'draft_only'
  | 'draft_preview_required'
  | 'context_pack_copyable'
  | 'blocked';

export type PersonaVoiceMode =
  | 'write_as_user'
  | 'speak_about_user'
  | 'never_speak_as_user';

export type PersonaProjectionSlotKind =
  | 'work_identity'
  | 'personal_context'
  | 'preference'
  | 'constraint'
  | 'writing_style';

export interface PersonaProjectionSummary {
  version: 1;
  scene: PersonaProjectionScene;
  audienceType: ComposerAudienceType;
  audienceSource: ComposerAudienceSource;
  audienceConfidence: number;
  representationMode: PersonaRepresentationMode;
  voiceMode: PersonaVoiceMode;
  usedSlotKinds: PersonaProjectionSlotKind[];
  usedCount: number;
  blockedCount: number;
  reasonCodes: string[];
  requiresPreview: boolean;
  degraded?: boolean;
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
  /** Draft Compose vs Draft Refine; omitted clients get a compatibility default. */
  assistIntent?: ComposerAssistIntent;
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
  sourceTypes?: string[];
  interactionScene?: ContextRecallInteractionScene;
  automationLevel?: 'L1' | 'L2';
  debug?: boolean;
}

export interface ComposerAssistEvidence {
  id: string;
  type:
    | 'message'
    | 'chunk'
    | 'entity'
    | 'rehearsal'
    | 'source_memory'
    | 'reflection_thread';
  title?: string;
  snippet: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  links?: Array<{ label: string; url: string }>;
  whyMatched?: string;
  timestamp?: number;
  score?: number;
  cue?: ContextCue;
  claimAttribution?: ClaimAttributionReceiptItem[];
}

export interface ComposerAssistResponse {
  available: boolean;
  suggestionType:
    | 'none'
    | 'context_pack'
    | 'prompt_patch'
    | 'rewrite_prompt'
    | 'prompt_draft'
    | 'reply_context'
    | 'issue_context'
    | 'reply_refine';
  insertMode?: 'append_patch' | 'replace_draft';
  title?: string;
  summary?: string;
  insertText?: string;
  evidence: ComposerAssistEvidence[];
  riskLevel: 'low' | 'medium' | 'high';
  previewRequired: boolean;
  confidence: number;
  queryTimeMs: number;
  cohesionReceipt?: EvidenceCohesionReceipt;
  attributionReceipt?: ClaimAttributionReceipt;
  personaProjection?: PersonaProjectionSummary;
  debug?: Record<string, unknown>;
}

export type AmbientCalibrationSurface =
  | 'compose_assist'
  | 'memory_lens'
  | 'today_pilot'
  | 'meeting_pilot'
  | 'ask'
  | 'search'
  | 'relationship_radar'
  | 'user_profile'
  | 'memory_capture';

export type AmbientCalibrationAction =
  | 'shown'
  | 'hovered'
  | 'expanded'
  | 'inserted'
  | 'sent_after_insert'
  | 'sent_without_insert'
  | 'edited_before_send'
  | 'deleted_before_send'
  | 'opened_source'
  | 'copied_context'
  | 'done'
  | 'later'
  | 'mute'
  | 'wrong'
  | 'confirmed'
  | 'edited'
  | 'ignored'
  | 'manual_added'
  | 'downstream_reaction';

export type AmbientCalibrationStrength = 'weak' | 'medium' | 'strong';
export type AmbientCalibrationPolarity =
  | 'positive'
  | 'negative'
  | 'correction'
  | 'neutral';
export type AmbientCalibrationPrivacyClass =
  | 'normal'
  | 'sensitive_redacted'
  | 'local_only';

export interface AmbientCalibrationEvidenceRef {
  id: string;
  type?: string;
  title?: string;
  sourceLabel?: string;
  role?: string;
  score?: number;
  cueId?: string;
  cueKey?: string;
  cue?: {
    id?: string;
    cueKey?: string;
    actionType?: string;
    compileStatus?: string;
    confidence?: number;
    whyNow?: string;
  };
}

export interface AmbientCalibrationTrace {
  id?: string;
  surface: AmbientCalibrationSurface;
  sceneKey: string;
  sourceRequestId?: string;
  action: AmbientCalibrationAction;
  strength: AmbientCalibrationStrength;
  polarity: AmbientCalibrationPolarity;
  evidenceRefs?: AmbientCalibrationEvidenceRef[];
  redactedDiff?: Record<string, unknown>;
  privacyClass?: AmbientCalibrationPrivacyClass;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface AmbientCalibrationTraceResponse {
  status: 'ok';
  traceId: string;
  stored: boolean;
  calibrationReceipt?: {
    stored: boolean;
    duplicate: boolean;
    privacyClass: AmbientCalibrationPrivacyClass;
    rawTextStored: false;
    evidenceRefCount: number;
    cueRefCount: number;
    styleSignalCount: number;
    redactedDiffKeys: string[];
    writingStyleProcessed: boolean;
    outcomeCueEventCount: number;
    boundary: 'hashes_lengths_tags_and_evidence_refs_only';
  };
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

export type StorylineSourceKind = 'today_meeting_prep' | 'source_memory_seed';

export interface MeetingPrepStorylineDraftRequest {
  sourceKind: 'today_meeting_prep';
  prepId: string;
  targetArtifact?: StorylineSuggestedArtifact;
  audienceHint?: string;
}

export interface SourceMemoryStorylineDraftRequest {
  sourceKind: 'source_memory_seed';
  capsuleId: string;
  seedId: string;
  targetArtifact?: StorylineSuggestedArtifact;
  audienceHint?: string;
}

export type StorylineDraftRequest =
  | MeetingPrepStorylineDraftRequest
  | SourceMemoryStorylineDraftRequest;

export interface StorylineDraftSegment {
  title: string;
  intent: string;
  narrative: string;
  evidenceIds: string[];
}

export type StorylineDraftGenerationMode =
  | 'llm_grounded'
  | 'fallback_cue_cards';

export type StorylineDraftFallbackReason =
  | 'model_output_underused_or_invalid_evidence'
  | 'llm_generation_failed';

export interface StorylineDraftGenerationReceipt {
  generationMode: StorylineDraftGenerationMode;
  sourceKind: StorylineSourceKind;
  sourceId: string;
  targetArtifact: StorylineSuggestedArtifact;
  audience: string;
  sourceEvidenceRefCount: number;
  citedEvidenceRefCount: number;
  returnedEvidenceDetailCount: number;
  missingEvidenceDetailCount: number;
  fallbackReason?: StorylineDraftFallbackReason;
  boundary: 'draft_only_manual_copy_no_external_write';
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
  generationReceipt: StorylineDraftGenerationReceipt;
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
  sourceTypes?: string[];
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
  insertMode?: ComposerAssistResponse['insertMode'];
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

export type MeetingOutcomeBinderStatus =
  | 'planned'
  | 'in_meeting'
  | 'post_meeting_pending'
  | 'bound'
  | 'partial'
  | 'blocked';

export type MeetingOutcomeSlotStatus =
  | 'planned'
  | 'resolved'
  | 'partially_resolved'
  | 'unresolved'
  | 'carried_over'
  | 'blocked_by_missing_evidence'
  | 'discarded_agenda';

export type MeetingOutcomeSlotType =
  | 'decision'
  | 'action'
  | 'open_question'
  | 'fact_update'
  | 'context_to_carry'
  | 'discarded_agenda';

export type MeetingOutcomeEvidenceKind =
  | 'calendar'
  | 'memory'
  | 'transcript'
  | 'action'
  | 'decision'
  | 'chapter';

export interface MeetingOutcomeEvidence {
  id: string;
  kind: MeetingOutcomeEvidenceKind;
  refId: string;
  label?: string;
  snippet: string;
  timestamp?: number;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface MeetingOutcomeSlot {
  id: string;
  title: string;
  type: MeetingOutcomeSlotType;
  status: MeetingOutcomeSlotStatus;
  mentionState: 'not_seen' | 'mentioned' | 'supported';
  sourceEvidenceIds: string[];
  evidence: MeetingOutcomeEvidence[];
  resultSummary?: string;
  confidence: number;
}

export interface MeetingOutcomeBinder {
  id: string;
  userId: string;
  prepId: string;
  eventExternalId: string;
  eventSeriesKey?: string;
  eventTitle: string;
  eventStartAt: number;
  meetingId?: string;
  status: MeetingOutcomeBinderStatus;
  slots: MeetingOutcomeSlot[];
  sourceEvidence: MeetingOutcomeEvidence[];
  sourceHash: string;
  bindingMode?: 'llm' | 'deterministic_fallback';
  bindingError?: string;
  generatedAt: number;
  boundAt?: number;
  createdAt: number;
  updatedAt: number;
  receipt: {
    source: string;
    coverage: string;
    freshness: string;
    boundary: string;
  };
}

export interface MeetingOutcomeBindInput {
  binderId?: string;
  meetingId: string;
  title?: string;
  eventExternalId?: string;
  transcript?: Array<{
    id: string;
    text: string;
    speaker?: string;
    ts?: number;
  }>;
  actionItems?: Array<{
    id: string;
    title: string;
    owner?: string;
    deadline?: string;
    status?: 'pending' | 'done';
    evidence?: string;
    timestamp?: string;
  }>;
  decisions?: Array<{
    id: string;
    text: string;
    timestamp?: string;
  }>;
  chapters?: Array<{
    id: string;
    title: string;
    summary?: string;
    startLabel?: string;
  }>;
}

export type MeetingArchiveStatusFilter =
  | 'all'
  | 'ready'
  | 'attention'
  | 'processing'
  | 'archived';

export interface MeetingArchiveFilters {
  query?: string;
  status?: MeetingArchiveStatusFilter;
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
  outcomeBinder?: MeetingOutcomeBinder;
}

export interface MeetingRecordListResponse {
  items: MeetingRecord[];
  total: number;
  limit: number;
  offset: number;
  q?: string;
  status?: MeetingArchiveStatusFilter;
}

export interface AskResponse {
  answer: string;
  evidence?: RecallItem[];
  /** Read-only Meeting Pilot outcome binders used for this answer. */
  meetingOutcomeSources?: MeetingOutcomeBinder[];
  queryTimeMs: number;
  contextMatch?: {
    state: 'locked' | 'ambiguous' | 'none';
    selectedTopic?: {
      id?: string;
      label: string;
      score?: number;
      reasons?: string[];
      sourceIds?: string[];
    };
    candidates?: Array<{
      id?: string;
      label: string;
      score?: number;
      reasons?: string[];
      sourceIds?: string[];
    }>;
    userFacingSummary?: string;
  };
  channelDiagnostics?: RecallChannelDiagnostic[];
  /** Weave provenance (P0-5): present only when the answer stitches ≥2 sources or ≥7 days. */
  weave?: WeaveStats;
  scopeReceipt?: RecallScopeReceipt;
  cohesionReceipt?: EvidenceCohesionReceipt;
  attributionReceipt?: ClaimAttributionReceipt;
  answerMemory?: {
    state: 'priorHit' | 'observed' | 'promoted' | 'updated' | 'skipped';
    threadId?: string;
    canonicalKey?: string;
    skipReason?: string;
    receipt?: {
      label: string;
      detail: string;
      tone: 'info' | 'success' | 'warning' | 'muted';
      currentEvidenceCount?: number;
      priorEvidenceCount?: number;
      followUpActionCount?: number;
      missingInfoCount?: number;
      stale?: boolean;
    };
    authority?: {
      decision:
        | 'authorized_change'
        | 'same_meaning_no_change'
        | 'supporting_only'
        | 'wait_for_authority_source';
      summary: string;
      evidenceRoles?: Array<{
        role: 'authority' | 'supporting' | 'derived' | 'query' | 'prior';
        count: number;
        reason: string;
      }>;
      subjectKey?: string;
      currentStance?: string;
      priorStance?: string;
      sameEvidence?: boolean;
      suppressedUpdate?: boolean;
    };
  };
  resolutionState?: 'complete' | 'partial' | 'insufficient' | 'deferred';
  missingInfo?: string[];
  followUpActions?: RuntimeAction[];
  externalEvidence?: Array<{
    kind: string;
    title?: string;
    url?: string;
    content?: string;
    metadata?: Record<string, any>;
  }>;
  evidenceWatch?: {
    contractId: string;
    state:
      | 'active'
      | 'quiet_no_change'
      | 'due'
      | 'authority_changed'
      | 'source_blocked'
      | 'paused'
      | 'archived';
    label: string;
    detail: string;
    subjectKey: string;
    lastCheckedAt?: number;
    nextCheckAt?: number;
    confirmRequestId?: string;
    duplicateSuppressedCount: number;
    runId?: string;
    lastRunState?:
      | 'created'
      | 'checked_no_change'
      | 'checked_changed'
      | 'blocked'
      | 'skipped_budget'
      | 'skipped_duplicate'
      | 'needs_user_decision';
    lastRunSummary?: string;
    created?: boolean;
  };
  structuredAnswer?: {
    timeline?: Array<{ date: string; event: string }>;
    keyFindings?: string[];
    insights?: string[];
    relatedEntities?: Array<{ name: string; type: string; relevance: string }>;
    confidence?: number;
  };
  /** Structured UI blocks built from the recalled evidence. */
  blocks?: AskBlock[];
  /** Higher-level synthesis derived from the recalled evidence. */
  analysis?: RecallAnalysis;
}

// ============================================================================
// Entity types
// ============================================================================

export interface Entity {
  id: string;
  type: string;
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
  status: string;
  mergedInto?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface EntityListResponse {
  items: Entity[];
  total: number;
  limit: number;
  offset: number;
}

export interface EntityDetailResponse extends Entity {
  properties: EntityProperty[];
}

export interface EntityProperty {
  id: number;
  entityId: string;
  propertyKey: string;
  propertyValue: string;
  valueType: string;
  sourceMessageId?: string;
  sourceAuthor?: string;
  sourceAuthority?: string;
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
  actionType?: string;
}

export interface EntityTimelineEntry {
  propertyKey: string;
  propertyValue: string;
  actionType: string;
  sourceAuthor?: string;
  txStart: number;
  txEnd?: number;
  status: string;
}

export interface EntityRelationship {
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
  entityName?: string;
  entityType?: string;
}

// ============================================================================
// Relationship radar types
// ============================================================================

export type RelationshipRadarState =
  | 'core'
  | 'active'
  | 'rising'
  | 'dormant'
  | 'watch';

export type RelationshipReviewStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'snoozed';

export type RelationshipReviewAction = 'confirm' | 'reject' | 'snooze';
export type RelationshipDataQuality =
  | 'indexed'
  | 'generated'
  | 'confirmed'
  | 'stale';
export type RelationshipProjectionSource =
  | 'lazy'
  | 'background'
  | 'user_confirmed';

export interface RelationshipEvidenceRef {
  sourceKind: 'message' | 'entity_property' | 'relationship';
  sourceId: string;
  title?: string;
  snippet: string;
  timestamp?: number;
  sourceUrl?: string;
  exploreLink?: string;
}

export interface RelationshipPersonSummary {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  tags: string[];
  score: number;
  radarState: RelationshipRadarState;
  interactionCount: number;
  activeDays: number;
  firstSeen?: number;
  lastSeen?: number;
  lastInteractionAt?: number;
  mentionCount: number;
  confidence: number;
  dataQuality: RelationshipDataQuality;
  projectionSource: RelationshipProjectionSource;
  generatedAt: number;
  dirtySince?: number;
  lastConsolidatedAt?: number;
  reason: string;
  signals: {
    recent: number;
    frequency: number;
    breadth: number;
    confirmedFacts: number;
  };
  contextBullets: string[];
  evidenceCount: number;
  reviewPendingCount: number;
}

export interface RelationshipPeopleResponse {
  items: RelationshipPersonSummary[];
  totalCandidates: number;
  threshold: {
    minimumInteractionCount: number;
    minimumActiveDays: number;
    minimumScore: number;
    minimumKeepCount: number;
    strategy: 'hybrid_threshold_top_n';
  };
  generatedAt: number;
  coverageNote: string;
}

export interface RelationshipReviewItem {
  id: string;
  personId: string;
  personName: string;
  itemType: string;
  proposedKey: string;
  title: string;
  proposedValue: string;
  reason?: string;
  confidence: number;
  priority: string;
  evidenceRefs: RelationshipEvidenceRef[];
  status: RelationshipReviewStatus;
  userNote?: string;
  snoozeUntil?: number;
  confirmedAt?: number;
  rejectedAt?: number;
  createdAt: number;
  updatedAt: number;
  actionReceipt?: RelationshipReviewActionReceipt;
}

export interface RelationshipReviewActionReceipt {
  action: RelationshipReviewAction;
  outcome: 'profile_updated' | 'queued_for_later' | 'dismissed';
  title: string;
  summary: string;
  personId: string;
  personName: string;
  proposedKey: string;
  evidenceCount: number;
  noteCaptured: boolean;
  statusAfter: RelationshipReviewStatus;
  availableAt?: number;
  nextActions: string[];
  generatedAt: number;
}

export interface RelationshipReviewItemListResponse {
  items: RelationshipReviewItem[];
  total: number;
  generatedAt: number;
}

export interface RelationshipContextCard {
  person: RelationshipPersonSummary;
  surface: string;
  tokenBudget: number;
  dataQuality: RelationshipDataQuality;
  projectionSource: RelationshipProjectionSource;
  contextMd: string;
  bullets: string[];
  knownFacts: Array<{
    key: string;
    value: string;
    confidence: number;
    confirmed: boolean;
  }>;
  relationshipHints: Array<{
    relationType: string;
    targetId: string;
    targetName: string;
    targetType: string;
    strength: number;
    context?: string;
  }>;
  openLoops: Array<{
    id: string;
    title: string;
    snippet: string;
    timestamp: number;
    evidenceRef: RelationshipEvidenceRef;
  }>;
  actionSuggestions?: Array<{
    title: string;
    body: string;
    tone: 'hot' | 'warn' | 'ok' | 'muted';
    reason: string;
    evidenceRef?: RelationshipEvidenceRef;
  }>;
  doNotAssume: string[];
  evidenceRefs: RelationshipEvidenceRef[];
  retrievalHints: {
    entityIds: string[];
    names: string[];
    boostTerms: string[];
    sourceTypes: string[];
  };
  privacySummary: {
    sensitiveIncluded: boolean;
    redactedAliases: number;
    redactedFacts: number;
    redactedRelationshipHints: number;
    redactedEvidenceRefs: number;
    redactedOpenLoops: number;
    redactedRetrievalHints: number;
    redactionNote?: string;
  };
  contextReceipt?: {
    title: string;
    rows: Array<{
      label: string;
      value: string;
      tone: 'ok' | 'warn' | 'muted';
    }>;
    boundary: string;
    generatedAt: number;
  };
  generatedAt: number;
}

export interface RelationshipTimelineResponse {
  personId: string;
  items: Array<{
    id: string;
    kind: 'message' | 'property' | 'relationship';
    title: string;
    body: string;
    timestamp: number;
    evidenceRef?: RelationshipEvidenceRef;
  }>;
  total: number;
}

export interface RelationshipOpenLoopsResponse {
  personId: string;
  items: RelationshipContextCard['openLoops'];
}

export interface RelationshipContextPackage {
  generatedAt: number;
  packageType: 'relationship_context';
  cards: RelationshipContextCard[];
  retrievalBoosts: Array<{
    entityId: string;
    name: string;
    score: number;
    terms: string[];
  }>;
}

export interface RelationshipConsolidationResult {
  generatedAt: number;
  scanned: number;
  consolidated: number;
  skipped: number;
  personIds: string[];
}

export interface RelationshipMeetingBrief {
  generatedAt: number;
  title: string;
  startAt?: number;
  coverage: {
    totalAttendees: number;
    processedAttendees: number;
    matchedAttendees: number;
    unmatchedAttendees: number;
    omittedAttendees: number;
    identityCheckAttendees: number;
    attendeesWithEvidence: number;
    attendeesWithOpenLoops: number;
    evidenceRefs: number;
    coverageNote: string;
  };
  readiness: {
    status: 'ready' | 'partial' | 'attention' | 'empty';
    summary: string;
    nextActions: string[];
    successCriteria: string[];
  };
  focus: {
    title: string;
    summary: string;
    items: Array<{
      label: string;
      body: string;
      tone: 'action' | 'verify' | 'risk' | 'info';
      attendee?: string;
      boundary?: string;
    }>;
  };
  sourceReceipt: {
    title: string;
    rows: Array<{
      label: string;
      value: string;
      tone: 'ok' | 'warn' | 'muted';
    }>;
    boundary: string;
    generatedAt: number;
  };
  attendees: Array<{
    displayName: string;
    email?: string;
    personId?: string;
    personName?: string;
    radarState?: RelationshipRadarState;
    dataQuality?: RelationshipDataQuality;
    matchedBy: 'name' | 'alias' | 'email' | 'email_local_part' | 'none';
    matchConfidence: number;
    matchReason: string;
    identityCheckRequired: boolean;
    identityCheckReason?: string;
    contextSuppressedReason?: string;
    coverageState: 'ready' | 'thin' | 'missing';
    summary: string;
    openLoops: RelationshipContextCard['openLoops'];
    suggestedQuestions: string[];
    evidenceRefs: RelationshipEvidenceRef[];
  }>;
  matrix: Array<{
    person: string;
    recentContext: string;
    openLoop: string;
    suggestedAsk: string;
    evidenceCount: number;
    matchStatus: string;
    coverageState: 'ready' | 'thin' | 'missing';
  }>;
  omittedAttendees?: Array<{
    displayName: string;
    email?: string;
    reason: string;
  }>;
}

export interface RelationshipAssistantDraft {
  generatedAt: number;
  personId?: string;
  personName: string;
  scenario: string;
  draftText: string;
  draftReceipt?: {
    title: string;
    rows: Array<{
      label: string;
      value: string;
      tone: 'ok' | 'warn' | 'muted';
    }>;
    boundary: string;
    generatedAt: number;
  };
  contextPackage: RelationshipContextPackage;
  safetyReview: {
    status: 'ready' | 'review_first' | 'thin_context';
    summary: string;
    reasons: string[];
    evidenceCount: number;
    openLoopCount: number;
    actionSuggestionCount: number;
    pendingReviewCount: number;
    hiddenSensitiveCount: number;
    dataQuality: RelationshipDataQuality;
    sensitiveIncluded: boolean;
  };
  contextBasis: {
    primarySuggestion?: NonNullable<RelationshipContextCard['actionSuggestions']>[number];
    openLoops: RelationshipContextCard['openLoops'];
    knownFacts: RelationshipContextCard['knownFacts'];
    evidenceRefs: RelationshipEvidenceRef[];
    privacySummary: RelationshipContextCard['privacySummary'];
  };
  suggestedChecks: string[];
  warnings: string[];
}

export interface RelationshipGraph {
  generatedAt: number;
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    dataQuality?: RelationshipDataQuality;
    radarState?: RelationshipRadarState;
    score?: number;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    weight: number;
  }>;
  dynamics: Array<{
    kind: 'rising' | 'dormant' | 'review_needed' | 'high_context';
    title: string;
    body: string;
    personId?: string;
  }>;
}

// ============================================================================
// Project types
// ============================================================================

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

export interface CreateWatchedProjectPayload {
  name: string;
  description?: string;
  aliases?: string[];
  autoCaptureRules?: object;
  trackedProperties?: string[];
  priority?: number;
}

// ============================================================================
// Notification types
// ============================================================================

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
  deliveryContext?: NotificationCenterDeliveryContext;
  channelReceipts?: NotificationCenterChannelReceipt[];
  evidenceReceipt?: NotificationCenterEvidenceReceipt;
  snoozeReceipt?: NotificationCenterSnoozeReceipt;
}

export interface NotificationCenterEvidenceReceipt {
  evidenceCount: number;
  label: string;
  detail: string;
  boundary: string;
  sampleRefs: string[];
}

export interface NotificationCenterSnoozeReceipt {
  label: string;
  detail: string;
  boundary: string;
  sourceNotificationId?: string;
  rootNotificationId?: string;
  snoozedAt?: number;
  scheduledAt?: number;
  delaySeconds?: number;
  count: number;
}

export interface NotificationCenterChannelReceipt {
  channel: 'chrome' | 'doubao' | 'glip';
  state: 'not_attempted' | 'delivered' | 'failed' | 'clicked' | 'dismissed';
  label: string;
  detail: string;
  status?: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  effectiveStatus?: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  hasSuccessfulDelivery: boolean;
  firstDeliveredAt?: number;
  lastDeliveredAt?: number;
  seenAt?: number;
  dismissedAt?: number;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface NotificationCenterDeliveryContext {
  channel: 'chrome' | 'doubao' | 'glip';
  reason:
    | 'new'
    | 'retry_after_cooldown'
    | 'previous_delivery_failed'
    | 'already_delivered_unfinished';
  lastStatus?: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  effectiveStatus?: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  hasSuccessfulDelivery: boolean;
  lastAttemptAt?: number;
  lastDeliveredAt?: number;
  lastError?: string;
  cooldownSeconds?: number;
}

export interface NotificationCenterFeedResponse {
  items: NotificationCenterEnvelope[];
  total: number;
  meta?: {
    channel: 'chrome' | 'doubao' | 'glip';
    lanes: Array<'todo' | 'notice'>;
    deliveryMode: NotificationCenterFeedDeliveryMode;
    limit: number;
    returned: number;
    hasMore: boolean;
    limitReceipt?: {
      label: string;
      requestedLimit?: number;
      appliedLimit: number;
      detail: string;
      boundary: string;
    };
    snapshotReceipt?: {
      label: string;
      generatedAt: number;
      detail: string;
      boundary: string;
    };
    emptyReceipt?: {
      label: string;
      detail: string;
      boundary: string;
    };
  };
}

export type NotificationCenterFeedDeliveryMode =
  | 'retry_after_cooldown'
  | 'incremental'
  | 'daily_digest';

export interface NotificationCenterDeliveryRecord {
  sourceRef: string;
  channel: 'chrome' | 'doubao' | 'glip';
  lane: 'todo' | 'notice';
  status: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  effectiveStatus: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  externalRef?: string;
  lastError?: string;
  hasSuccessfulDelivery: boolean;
  firstDeliveredAt?: number;
  lastDeliveredAt?: number;
  seenAt?: number;
  dismissedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Confirm Request types
// ============================================================================

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
  state: string;
  routing?: 'decision' | 'watch';
  reasonCode?:
    | 'authority_required'
    | 'approval_required'
    | 'action_result_improvement'
    | 'future_monitoring'
    | 'owner_eta_gap'
    | 'artifact_gap'
    | 'time_sensitive_blocker';
  sourceAnchor?: string;
  gapType?:
    | 'future_monitoring'
    | 'owner_eta'
    | 'artifact_check'
    | 'decision_blocker'
    | 'linked_action_prompt_improvement';
  userAnswer?: string;
  answeredAt?: number;
  snoozeUntil?: number;
  snoozeCount: number;
  expiresAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ConfirmRequestListResponse {
  items: ConfirmRequest[];
  total: number;
  limit: number;
  state: string;
  queue?: 'decision' | 'watch' | 'all';
}

export interface ConfirmRequestStateTransitionResponse {
  status: string;
  confirmRequest: ConfirmRequest;
  queuedActionId?: string;
}

export interface ConfirmRequestAnswerResponse {
  status: string;
  confirmRequest: ConfirmRequest;
  retriedActionId?: string;
  skippedActionId?: string;
  stoppedActionId?: string;
}

// ============================================================================
// Reflection Thread & Action Runtime types
// ============================================================================

export interface ReflectionThread {
  id: string;
  topicKey: string;
  title: string;
  status: 'active' | 'paused' | 'closed';
  priority: number;
  salience: number;
  sourceType?: string;
  sourceRefId?: string;
  currentHypothesis?: string;
  openQuestions: string[];
  latestSummary?: string;
  latestMarkdownPath?: string;
  nextReflectionAt?: number;
  lastReflectedAt?: number;
  reflectionCount: number;
  continueReason?: string;
  closureReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReflectionRun {
  id: string;
  threadId: string;
  runType: string;
  triggerType?: string;
  inputRefs: string[];
  previousRunId?: string;
  summary: string;
  hypothesisBefore?: string;
  hypothesisAfter?: string;
  discoveries: string[];
  openQuestions: string[];
  actions: Array<Record<string, any>>;
  markdownSnapshotPath?: string;
  createdAt: number;
}

export interface ReflectionLink {
  id: string;
  threadId: string;
  sourceKind: string;
  sourceId: string;
  weight: number;
  role: string;
  createdAt: number;
  preview?: string;
  previewTitle?: string;
  previewTimestamp?: number;
}

export interface ReflectionResearchAttempt {
  id: string;
  threadId: string;
  runId?: string;
  query: string;
  purpose: string;
  status: 'hit' | 'empty' | 'failed' | 'skipped';
  resultCount: number;
  sourceTypes: string[];
  requestedSourceTypes: string[];
  rejectedSourceTypes: string[];
  projectFilter?: string;
  senderFilter: string[];
  groupFilter: string[];
  scopeNotice?: string;
  errorMessage?: string;
  evidenceRefs: string[];
  createdAt: number;
}

export interface DreamRun {
  id: string;
  sourceType: string;
  sourceRefId?: string;
  threadIds: string[];
  summary?: string;
  insights: string[];
  risks: string[];
  relationships: Array<Record<string, any>>;
  markdownPath?: string;
  createdAt: number;
}

export interface ReflectionThreadListResponse {
  items: ReflectionThread[];
  total: number;
  limit: number;
  offset: number;
}

export interface RuntimeAction {
  id: string;
  type: string;
  actionType: string;
  title: string;
  description?: string;
  params: Record<string, any>;
  riskLevel: string;
  confidence: number;
  evidenceRefs: string[];
  requiresApproval: boolean;
  state: string;
  approvedAt?: number;
  executedAt?: number;
  source?: string;
  expiresAt?: number;
  createdAt: number;
  threadId?: string;
  runId?: string;
  executionMode: 'manual' | 'auto';
  priority: number;
  idempotencyKey?: string;
  dependsOn: string[];
  scheduledAt?: number;
  startedAt?: number;
  finishedAt?: number;
  retryCount: number;
  lastError?: string;
  result?: Record<string, any>;
  sourceKind?: string;
  sourceRefId?: string;
  queueStatus:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'dead_letter';
  utilityScore?: number;
  urgencyScore?: number;
  outreachSessionId?: string;
  readinessReceipt?: ActionReadinessReceipt;
}

export type ActionReadinessStatus =
  | 'ready'
  | 'unknown'
  | 'blocked_auth'
  | 'blocked_capability'
  | 'blocked_input'
  | 'blocked_proof'
  | 'degraded'
  | 'expired';

export type ActionReadinessDecision =
  | 'allow'
  | 'allow_manual_only'
  | 'probe_first'
  | 'block';

export interface ActionReadinessReceipt {
  contractId: string;
  scopeKey: string;
  status: ActionReadinessStatus;
  checkedAt: number;
  expiresAt?: number;
  reason?: string;
  affectedActionCount: number;
  requiredInputs: string[];
  requiredApprovals: string[];
  proofRequirements: string[];
  dispatchState: 'not_dispatched' | 'dispatched';
  doesNotProve: string[];
}

export interface ActionReadinessSummary {
  status: 'ready' | 'attention' | 'blocked';
  title: string;
  detail: string;
  trackedActionCount: number;
  affectedActionCount: number;
  blockedContractCount: number;
  degradedContractCount: number;
  unknownActionCount: number;
  contracts: ActionReadinessReceipt[];
  boundary: string;
  readAt: number;
  readOnly: boolean;
}

export interface RuntimeActionListResponse {
  items: RuntimeAction[];
  total: number;
  limit: number;
  offset: number;
  readinessSummary?: ActionReadinessSummary;
}

export interface MessageRuleAutomationAttachment {
  id?: string | number;
  name?: string;
  type?: string;
  mimeType?: string;
  category?: string;
  size?: number;
  sourceUrl?: string;
  messageUrl?: string;
  downloadUrl?: string;
  previewUrl?: string;
}

export interface MessageRuleAutomationPlanRequest {
  ruleRef: string;
  ruleText?: string;
  automationPrompt: string;
  requiresApproval?: boolean;
  message: {
    postId?: string;
    sender?: string;
    groupId?: string;
    groupName?: string;
    content: string;
    sourceUrl?: string;
    messageUrl?: string;
    attachments?: MessageRuleAutomationAttachment[];
    timestamp?: number;
    timezone?: string;
    event?: {
      title?: string;
      start?: string;
      end?: string;
      startAtMs?: number;
      endAtMs?: number;
      timeRange?: string;
      location?: string;
      allDay?: boolean;
    };
  };
  match?: {
    matchedRule?: string;
    summary?: string;
    confidence?: number;
  };
}

export interface MessageRuleAutomationPlanResponse {
  deduped: boolean;
  skippedReason?: string;
  actions: RuntimeAction[];
  detectedWindow?: {
    startAt: number;
    endAt: number;
    startActionAt: number;
    restoreActionAt: number;
    label: string;
  };
}

export interface MessageRuleAutomationWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface MessageRuleAutomationPreviewAction {
  actionType: 'notify_user' | 'delegate_openclaw';
  title: string;
  description?: string;
  targetSystem?: string;
  scheduledAt?: number;
  executionMode?: 'manual' | 'auto';
  requiresApproval?: boolean;
}

export interface MessageRuleAutomationPreviewResponse {
  canPlan: boolean;
  skippedReason?: string;
  actionFamily: string;
  actions: MessageRuleAutomationPreviewAction[];
  warnings: MessageRuleAutomationWarning[];
  suggestedPrompt?: string;
  suggestionReason?: string;
  detectedWindow?: {
    startAt: number;
    endAt: number;
    startActionAt: number;
    restoreActionAt: number;
    label: string;
  };
}

export type OutreachSessionStatus =
  | 'pending_approval'
  | 'scheduled'
  | 'waiting_reply'
  | 'deferred'
  | 'resolved'
  | 'no_reply'
  | 'escalated'
  | 'cancelled'
  | 'failed';

export interface OutreachSummary {
  upcomingCount: number;
  waitingReplyCount: number;
  escalatedCount: number;
  pendingApprovalCount: number;
}

export interface OutreachEvent {
  id: string;
  sessionId: string;
  eventType: string;
  payload?: Record<string, any>;
  createdAt: number;
}

export type GlipMessageMarkerType =
  | 'follow_thread_original'
  | 'follow_thread_related'
  | 'snooze_pending'
  | 'outreach_initial_ask'
  | 'outreach_followup'
  | 'scheduled_asme'
  | 'scheduled_bot'
  | 'scheduled_ai_report';

export interface GlipMessageMarker {
  id: string;
  type: GlipMessageMarkerType;
  label: string;
  chatId: string;
  postId: string;
  source: 'local' | 'memory_service' | 'sheet';
  sourceId: string;
  sessionId?: string;
  status?: string;
  tooltip?: string;
  updatedAt: number;
  nextCheckAt?: number;
  metadata?: Record<string, any>;
}

export interface GlipMessageMarkersSnapshot {
  items: GlipMessageMarker[];
  generatedAt: number;
}

export interface CreateOutreachSessionFromMessageRequest {
  chatId: string;
  postId: string;
  messageText: string;
  messageUrl?: string;
  messageCreatedAt?: number;
  messageTimestampText?: string;
  senderName?: string;
  groupName?: string;
  targetType?: string;
  targetRef?: string;
  targetResolvedChatId?: string;
  targetResolvedLabel?: string;
  followupIntervalSeconds?: number;
  maxFollowup?: number;
  context?: string;
  informationGoal?: string;
}

export interface CreateOutreachSessionFromMessageResponse {
  session: OutreachSession;
  created?: boolean;
  reason?: 'existing_message_reaction_session';
}

export interface OutreachTargetCandidate {
  kind: 'user' | 'chat';
  entityId: string;
  chatId?: string;
  label: string;
  subtitle?: string;
  score: number;
  source: 'extension' | 'chat';
}

export interface OutreachEvidenceItem {
  sourceKind: string;
  sourceId?: string;
  title?: string;
  content: string;
  createdAt?: number;
  metadata?: Record<string, any>;
}

export interface OutreachDirectoryStatus {
  scope: 'users' | 'teams';
  status: 'idle' | 'syncing' | 'ready' | 'error';
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastSuccessAt?: number;
  recordCount: number;
  lastError?: string;
  stale: boolean;
}

export interface OutreachSession {
  id: string;
  templateId?: string;
  originKind?: string;
  threadId?: string;
  runId?: string;
  actionId?: string;
  channel?: string;
  targetType: string;
  targetRef: string;
  targetResolutionStatus?: 'unresolved' | 'ambiguous' | 'resolved';
  targetResolvedType?: string;
  targetResolvedId?: string;
  targetResolvedLabel?: string;
  targetResolvedChatId?: string;
  targetCandidates?: OutreachTargetCandidate[];
  renderedQuestion: string;
  renderedContext?: string;
  status: OutreachSessionStatus;
  requiresApproval: boolean;
  followupCount: number;
  maxFollowup: number;
  followupIntervalSeconds?: number;
  waitUntil?: number;
  nextCheckAt?: number;
  sentChatId?: string;
  sentPostId?: string;
  replyPostId?: string;
  replySender?: string;
  replyRawText?: string;
  replyClassification?: string;
  replyConfidence?: number;
  outcome?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  scheduledFor?: number;
  occurrenceKey?: string;
  occurrenceStartAt?: number;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  events?: OutreachEvent[];
  actions?: RuntimeAction[];
  evidence?: OutreachEvidenceItem[];
}

export interface OutreachSessionListResponse {
  items: OutreachSession[];
  total: number;
  limit: number;
  offset: number;
}

export interface OutreachTemplateRuntimeStatusItem {
  template: {
    id: string;
    sheetMessageId?: string;
    sourceKind?: string;
    title: string;
    questionTemplate?: string;
    contextTemplate?: string;
    targetType?: string;
    targetRef?: string;
    scheduleSpec?: Record<string, any>;
    enabled?: boolean;
    approvalPolicy?: string;
    maxFollowup?: number;
    followupIntervalSeconds?: number;
    syncState?: string;
    lastSyncError?: string;
    lastSessionId?: string;
    createdAt?: number;
    updatedAt?: number;
  };
  latestSession?: OutreachSession | null;
}

export interface OutreachTemplateRuntimeStatusResponse {
  items: OutreachTemplateRuntimeStatusItem[];
  total: number;
}

export interface AgentTaskEvidencePreview {
  kind?: string;
  title?: string;
  content?: string;
}

export interface AgentTaskRuntimeStatusItem {
  sourceRefId: string;
  sheetMessageId?: string;
  taskId?: string;
  latestAction?: {
    id: string;
    title: string;
    queueStatus: string;
    resultStatus?: string;
    startedAt?: number;
    finishedAt?: number;
    createdAt?: number;
    lastError?: string;
  } | null;
  summary?: string;
  evidence?: AgentTaskEvidencePreview;
}

export interface AgentTaskRuntimeStatusResponse {
  items: AgentTaskRuntimeStatusItem[];
  total: number;
}

export type PersonalSkillStatus = 'suggestion' | 'active' | 'dismissed';
export type PersonalSkillRisk = 'low' | 'medium' | 'high';
export type PersonalSkillScope = 'work' | 'personal' | 'ai';
export type SkillBindingState =
  | 'installed'
  | 'outdated'
  | 'not_installed'
  | 'blocked'
  | 'unknown';
export type SkillPlatformCapability =
  | 'internal'
  | 'api'
  | 'fs_via_desktop_app'
  | 'manual_only';

export interface SkillWorkflowStep {
  title: string;
  desc?: string;
  tools?: string[];
}

export interface SkillEvidenceRef {
  title: string;
  desc?: string;
  kind?: string;
  evidenceState?: 'complete' | 'partial' | 'manual' | 'unverified';
  episodeId?: string | null;
}

export interface SkillSourceEpisode {
  id: string;
  title: string;
  date?: string;
}

export interface SkillVersionRecord {
  id: string;
  skillId: string;
  version: string;
  isActive: boolean;
  skillMd: string;
  packageJson?: Record<string, unknown>;
  workflow: SkillWorkflowStep[];
  evidence: SkillEvidenceRef[];
  sourceEpisodes: SkillSourceEpisode[];
  files?: Array<{ relativePath: string; content: string; sha256?: string }>;
  sha256: string;
  changelog?: string;
  createdFrom?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SkillPlatformBinding {
  id: string;
  skillId: string;
  platform: string;
  state: SkillBindingState;
  installedVersion?: string;
  installedSha256?: string;
  remoteMtime?: number;
  lastSyncedAt?: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SkillShareInfo {
  displayUrl: string;
  urlPath: string;
  token: string;
  etag: string;
}

export interface PersonalSkillListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: PersonalSkillScope;
  risk: PersonalSkillRisk;
  trigger?: string;
  notUse?: string;
  status: PersonalSkillStatus;
  owner?: string;
  sources: string[];
  repetition?: string;
  riskBrief?: string;
  suggestedFrom?: string;
  suggestedAt?: number;
  notifiedAt?: number;
  snoozedUntil?: number;
  dismissedAt?: number;
  dismissReason?: string;
  suggestionClusterKey?: string;
  currentVersion?: string;
  currentSha256?: string;
  reviewRequired?: boolean;
  reviewReasons?: string[];
  bindings: SkillPlatformBinding[];
  createdAt: number;
  updatedAt: number;
}

export interface PersonalSkillDetail extends PersonalSkillListItem {
  versions: SkillVersionRecord[];
  activeVersion?: SkillVersionRecord;
  workflow: SkillWorkflowStep[];
  evidence: SkillEvidenceRef[];
  sourceEpisodes: SkillSourceEpisode[];
  share?: SkillShareInfo;
  shareError?: string;
}

export interface PersonalSkillListResponse {
  items: PersonalSkillListItem[];
  total: number;
}

export type SkillSuggestionView = 'ready' | 'snoozed' | 'all';

export interface PersonalSkillDetailResponse {
  skill: PersonalSkillDetail;
}

export interface SkillSyncSetting {
  platform: string;
  enabled: boolean;
  capability: SkillPlatformCapability;
  mode: string;
  config?: Record<string, unknown>;
  lastProbeAt?: number;
  lastError?: string;
  updatedAt: number;
}

export interface SkillSyncSettingsResponse {
  items: SkillSyncSetting[];
}

export interface SkillProbeResponse {
  platform: string;
  ok: boolean;
  capability?: SkillPlatformCapability;
  status?: number;
  error?: string;
  response?: unknown;
}

export interface SkillSyncPlatformRunResult {
  platform: string;
  status: 'succeeded' | 'skipped' | 'failed';
  totalRemote?: number | null;
  candidates?: number;
  processed: number;
  imported: number;
  updated: number;
  pulled: number;
  pushed: number;
  externalChanges: number;
  skipped: number;
  hasMore?: boolean;
  errors: Array<{ slug?: string; error: string }>;
  note?: string;
}

export interface SkillSyncRunResponse {
  status: 'succeeded' | 'partial_failed';
  processed: number;
  activeSkillCount: number;
  enabledPlatforms: string[];
  limit: number;
  platforms: SkillSyncPlatformRunResult[];
}

export interface PersonalSkillSuggestionUseResponse
  extends PersonalSkillDetailResponse {
  sync?: SkillSyncPlatformRunResult;
}

export type SkillGateState =
  | 'candidate'
  | 'active'
  | 'degraded'
  | 'retired'
  | 'user_pinned';

export interface SkillHealth {
  skillId: string;
  gateState: SkillGateState;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  health: number;
  pinned: boolean;
}

export interface SkillHealthResponse {
  health: SkillHealth | null;
}

export interface ReflectionThreadDetailResponse {
  thread: ReflectionThread;
  runs: ReflectionRun[];
  actions: RuntimeAction[];
  actionResults?: ActionResultRecord[];
  researchAttempts?: ReflectionResearchAttempt[];
  links: ReflectionLink[];
  dreamRuns: DreamRun[];
}

export interface ActionResultRecord {
  id: string;
  actionId: string;
  threadId: string;
  runId?: string;
  resultType: string;
  summary: string;
  payload?: Record<string, unknown>;
  transcriptPath?: string;
  createdAt: number;
}

export interface RuntimeConfigResponse {
  dreamDigestEnabled?: boolean;
  dreamDigestScheduleType?: 'weekly' | 'every_x_days' | 'monthly';
  dreamDigestIntervalDays?: number;
  dreamDigestIntervalWeeks?: number;
  dreamDigestPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  dreamDigestPushGroupId?: string;
  reflectionEnabled?: boolean;
  reflectionHeartbeatMinutes?: number;
  decisionCenterPushTarget?: 'me' | 'group' | 'user' | 'team';
  decisionCenterPushGroupId?: string;
  weeklyReportEnabled?: boolean;
  weeklyReportCron?: string;
  weeklyReportMinMessages?: number;
  weeklyReportPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  weeklyReportPushGroupId?: string;
  openClawEnabled?: boolean;
  openClawBaseUrl?: string;
  openClawTimeoutMs?: number;
  openClawApiKeyConfigured?: boolean;
  agentExecutors?: Array<{
    id: string;
    label: string;
    type?:
      | 'openclaw-responses'
      | 'openclaw-gateway'
      | 'acp-codex'
      | 'acp-claude-code'
      | string;
    baseUrl?: string;
    cwd?: string;
    runtime?: 'local' | 'remote';
    workerId?: string;
    enabled?: boolean;
    apiKeyConfigured?: boolean;
  }>;
  executorDefaults?: {
    agent_task?: string;
    reflection_research?: string;
  };
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  outreachResultPushTarget?: 'me' | 'group' | 'user' | 'team';
  outreachResultPushGroupId?: string;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecretConfigured?: boolean;
  ringCentralJwtConfigured?: boolean;
  botApiBaseUrl?: string;
  botId?: string;
  botType?: 'user' | 'team';
  botTeamId?: string;
  botTargetEmail?: string;
  botTokenConfigured?: boolean;
}

export interface UpdateRuntimeConfigPayload {
  dreamDigestEnabled?: boolean;
  dreamDigestScheduleType?: 'weekly' | 'every_x_days' | 'monthly';
  dreamDigestIntervalDays?: number;
  dreamDigestPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  dreamDigestPushGroupId?: string;
  reflectionEnabled?: boolean;
  reflectionHeartbeatMinutes?: number;
  decisionCenterPushTarget?: 'me' | 'group' | 'user' | 'team';
  decisionCenterPushGroupId?: string;
  weeklyReportEnabled?: boolean;
  weeklyReportCron?: string;
  weeklyReportMinMessages?: number;
  weeklyReportPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  weeklyReportPushGroupId?: string;
  openClawEnabled?: boolean;
  openClawBaseUrl?: string;
  openClawTimeoutMs?: number;
  openClawApiKey?: string;
  clearOpenClawApiKey?: boolean;
  agentExecutors?: Array<{
    id: string;
    label?: string;
    type?: string;
    baseUrl?: string;
    apiKey?: string;
    cwd?: string;
    runtime?: 'local' | 'remote';
    workerId?: string;
    enabled?: boolean;
    clearApiKey?: boolean;
  }>;
  executorDefaults?: {
    agent_task?: string;
    reflection_research?: string;
  };
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  outreachResultPushTarget?: 'me' | 'group' | 'user' | 'team';
  outreachResultPushGroupId?: string;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecret?: string;
  ringCentralJwt?: string;
  clearRingCentralClientSecret?: boolean;
  clearRingCentralJwt?: boolean;
  botApiBaseUrl?: string;
  botToken?: string;
  botId?: string;
  botType?: 'user' | 'team';
  botTeamId?: string;
  botTargetEmail?: string;
  clearBotToken?: boolean;
}

// ============================================================================
// Health & Stats types
// ============================================================================

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

export interface StatsResponse {
  user?: {
    id: string;
    isolation: 'per_user_sqlite';
    identitySource?: 'header' | 'default_fallback';
    storageKey: string;
    fallbackToDefault: boolean;
    writeBoundary?: {
      mode?: 'explicit_read_write' | 'default_read_only_fallback';
      canRead: boolean;
      canWrite: boolean;
      blockedOperations: string[];
      reason?: 'explicit_x_user_id' | 'missing_or_blank_x_user_id';
      recoveryAction?: 'none' | 'restore_userinfo_username_or_set_user_id';
    };
  };
  messages: {
    total: number;
    today: number;
    thisWeek: number;
    last90Days?: number;
  };
  entities: { total: number; byType: Record<string, number> };
  chunks: { total: number };
  relationships: { total: number };
  watchedProjects: { active: number };
  notifications: { pending: number; sentToday: number };
  confirmRequests: { pending: number };
  memory: {
    temporary: number;
    working: number;
    consolidated: number;
    core: number;
    forgotten: number;
    archived: number;
    retrievalTiers?: Record<string, number>;
  };
}

export type MemoryCoverageDirection = 'ingest' | 'push' | 'sync' | 'derive';
export type MemoryCoverageState =
  | 'healthy'
  | 'partial'
  | 'stale'
  | 'sparse'
  | 'failing'
  | 'blocked'
  | 'pressure'
  | 'not_configured'
  | 'unknown';
export type MemoryCoveragePlatformGroup =
  | 'active'
  | 'derived'
  | 'inactive'
  | 'system';

export interface MemoryCoverageContribution {
  id: string;
  label: string;
  direction: MemoryCoverageDirection;
  state: MemoryCoverageState;
  count: number;
  recentCount?: number;
  latestAt?: number | null;
  detail: string;
  evidence: string;
}

export interface MemoryCoverageRepairAction {
  id: string;
  platformId: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  source: string;
}

export interface MemoryCoverageScoreBreakdown {
  base: number;
  healthyContributionBonus: number;
  freshnessBonus: number;
  failingPenalty: number;
  recentRatio: number;
  finalScore: number;
  reasons: string[];
}

export interface MemoryCoveragePlatform {
  id: string;
  name: string;
  nameEn?: string;
  icon: string;
  group: MemoryCoveragePlatformGroup;
  state: MemoryCoverageState;
  directions: MemoryCoverageDirection[];
  headline: string;
  description: string;
  lastSeenAt?: number | null;
  totalCount: number;
  recentCount: number;
  qualityScore?: number;
  qualityScoreBreakdown?: MemoryCoverageScoreBreakdown;
  contributions: MemoryCoverageContribution[];
  repairActions: MemoryCoverageRepairAction[];
}

export interface MemoryCoverageSummary {
  activePlatforms: number;
  healthyPlatforms: number;
  warningPlatforms: number;
  pressureItems: number;
  inactivePlatforms: number;
  coverageGaps: number;
  totalMessages: number;
  totalChunks: number;
  totalEntities: number;
}

export interface MemoryCoveragePriorityFocus {
  platformId: string;
  platformName: string;
  state: MemoryCoverageState;
  qualityScore: number;
  contributionId: string;
  contributionLabel: string;
  contributionState: MemoryCoverageState;
  actionId?: string;
  actionTitle?: string;
  actionSeverity?: MemoryCoverageRepairAction['severity'];
  reason: string;
  source: string;
  selectionBasis?: string;
  comparedPlatformCount?: number;
  ignoredInfoActionCount?: number;
  boundary?: string;
}

export interface MemoryCoverageTimelineEvent {
  id: string;
  platformId: string;
  at: number;
  title: string;
  state: MemoryCoverageState;
  source: string;
}

export interface MemoryCoverageMapReceipt {
  generatedAt: number;
  staleAfterDays: number;
  source: string;
  summary: MemoryCoverageMapReceiptSummary;
  boundary: string;
  note: string;
}

export interface MemoryCoverageMapReceiptSummary {
  platformCount: number;
  activeDerivedPlatformCount: number;
  healthyPlatformCount: number;
  warningPlatformCount: number;
  repairActionCount: number;
  coverageGapCount: number;
  infoPlanningActionCount: number;
  pressureItemCount: number;
  totalMessages: number;
  totalChunks: number;
  totalEntities: number;
  timelineEventCount: number;
  latestAt?: number | null;
  windowLabel: string;
  emptyState: string;
}

export interface MemoryCoverageMapResponse {
  generatedAt: number;
  staleAfterDays: number;
  receipt?: MemoryCoverageMapReceipt;
  summary: MemoryCoverageSummary;
  platforms: MemoryCoveragePlatform[];
  repairActions: MemoryCoverageRepairAction[];
  priorityFocus?: MemoryCoveragePriorityFocus | null;
  timeline: MemoryCoverageTimelineEvent[];
}

export type MemoryCoverageSliceName =
  | 'messages-by-source'
  | 'provider-jobs-recent'
  | 'pressure'
  | 'skills-sync';

export interface MemoryCoverageSliceReceiptSummary {
  itemCount: number;
  totalCount?: number;
  recentCount?: number;
  failureCount?: number;
  enabledCount?: number;
  latestAt?: number | null;
  windowLabel: string;
  emptyState: string;
}

export interface MemoryCoverageSliceReceipt {
  slice: MemoryCoverageSliceName;
  generatedAt: number;
  staleAfterDays: number;
  source: string;
  summary: MemoryCoverageSliceReceiptSummary;
  boundary: string;
  note: string;
}

export interface MemoryCoverageSliceResponseBase {
  generatedAt: number;
  staleAfterDays: number;
  receipt: MemoryCoverageSliceReceipt;
}

export interface MemoryCoverageMessageSourceRow {
  sourceType: string;
  count: number;
  latestAt: number | null;
  recentCount: number;
}

export interface MemoryCoverageProviderJobRow {
  provider: string;
  scenario: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  latestAt: number | null;
  latestStatus: string | null;
  latestError: string | null;
}

export interface MemoryCoveragePressureResponse
  extends MemoryCoverageSliceResponseBase {
  notificationsPending: number;
  actionsQueued: number;
  actionsRunning: number;
  confirmRequestsPending: number;
  reflectionThreadsActive: number;
  totalPressureItems: number;
}

export interface MemoryCoverageSkillSyncRow {
  platform: string;
  enabled: boolean;
  capability: string;
  mode: string;
  lastProbeAt: number | null;
  lastProbeAgeDays: number | null;
  lastError: string | null;
  bindingsByState: Record<string, number>;
}

export interface MemoryCoverageMessagesBySourceResponse
  extends MemoryCoverageSliceResponseBase {
  items: MemoryCoverageMessageSourceRow[];
}

export interface MemoryCoverageProviderJobsRecentResponse
  extends MemoryCoverageSliceResponseBase {
  items: MemoryCoverageProviderJobRow[];
}

export interface MemoryCoverageSkillsSyncResponse
  extends MemoryCoverageSliceResponseBase {
  items: MemoryCoverageSkillSyncRow[];
}

export type MemoryCoverageDiagnosticSliceResponse =
  | MemoryCoverageMessagesBySourceResponse
  | MemoryCoverageProviderJobsRecentResponse
  | MemoryCoveragePressureResponse
  | MemoryCoverageSkillsSyncResponse;

export type SourceMemorySourceKind =
  | 'webpage'
  | 'visual_memory'
  | 'selection'
  | 'jira_comment'
  | 'message_reply'
  | 'web_ai_prompt'
  | 'ai_conversation'
  | 'document'
  | 'meeting_material'
  | 'manual';
export type SourceMemoryCaptureMode = 'auto' | 'suggested' | 'manual';
export type SourceMemoryPrivacyLevel =
  | 'private'
  | 'work'
  | 'shareable_summary'
  | 'needs_review';

export interface SourceMemoryInteractionSignals {
  dwellMs?: number;
  activeMs?: number;
  scrollDepth?: number;
  selectedText?: boolean;
  copiedText?: boolean;
  repeatVisit?: boolean;
  ownerAuthored?: boolean;
  manualClick?: boolean;
  openedFromMemory?: boolean;
}

export interface SourceMemoryCandidateRequest {
  sourceKind?: SourceMemorySourceKind;
  sourceUrl?: string;
  sourceTitle?: string;
  text?: string;
  selectedText?: string;
  nearbyText?: string;
  entityHints?: Array<{ kind: string; value: string }>;
  interactions?: SourceMemoryInteractionSignals;
  scope?: 'work' | 'personal';
  metadata?: Record<string, unknown>;
}

export interface SourceMemoryCandidateResponse {
  eligible: boolean;
  score: number;
  suggestedAction: 'auto_save' | 'suggest' | 'ignore' | 'blocked';
  reasons: string[];
  blockedReason?: string;
  captureMode: SourceMemoryCaptureMode;
  policyReceipt?: SourceMemoryCapturePolicyReceipt;
}

export interface SourceMemoryWebpageAnalysisRequest {
  title: string;
  url: string;
  mainContent: string;
  domain?: string;
  wordCount?: number;
}

export interface SourceMemoryWebpageAnalysisResponse {
  result: unknown;
  promptVersion: string;
}

export interface SourceMemoryCapturePolicyReceipt {
  state: 'blocked' | 'ignored_low_signal' | 'suggested_review' | 'auto_save_candidate';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
}

export interface SourceMemoryCaptureWriteReceipt {
  state: 'saved_with_recall_signal' | 'saved_without_recall_signal' | 'dismissed_no_recall';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
}

export interface SourceMemoryCaptureActionReceipt {
  state:
    | 'saved'
    | 'resaved'
    | 'duplicate_no_change'
    | 'duplicate_note_updated'
    | 'note_updated'
    | 'dismissed';
  label: string;
  detail: string;
  evidence: string[];
  nextStep: string;
  occurredAt: number;
}

export interface SourceMemoryCreateRequest
  extends SourceMemoryCandidateRequest {
  captureMode?: SourceMemoryCaptureMode;
  captureReason?: string;
  note?: string;
  privacyLevel?: SourceMemoryPrivacyLevel;
  metadata?: Record<string, unknown>;
}

export interface SourceMemoryAnchor {
  id: string;
  anchorKind: string;
  locator?: string;
  quoteOrPreview: string;
  sensitivity: string;
  confidence: number;
}

export interface SourceMemoryTakeaway {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceAnchorIds: string[];
  confidence: number;
  status: string;
}

export interface SourceMemoryTrigger {
  id: string;
  triggerKind: string;
  description: string;
  matcher: Record<string, unknown>;
  defaultBehavior: string;
}

export interface SourceMemoryCapsule {
  id: string;
  sourceKind: string;
  sourceUrl?: string;
  sourceTitle: string;
  sourceHost?: string;
  captureMode: SourceMemoryCaptureMode;
  captureReason: string;
  status: string;
  scope: 'work' | 'personal';
  privacyLevel: SourceMemoryPrivacyLevel;
  summary: string;
  contentPreview: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
  changeLedger?: MemoryChangeLedgerReceipt;
  writeReceipt?: SourceMemoryCaptureWriteReceipt;
  actionReceipt?: SourceMemoryCaptureActionReceipt;
  createdAt: number;
  updatedAt: number;
  savedAt?: number;
  duplicate?: boolean;
  anchors: SourceMemoryAnchor[];
  takeaways: SourceMemoryTakeaway[];
  triggers: SourceMemoryTrigger[];
}

export interface SourceMemoryCapsuleResponse {
  capsule: SourceMemoryCapsule;
}

export type DayPilotPriority = 'critical' | 'high' | 'medium' | 'low';
export type DayPilotState = 'prepare' | 'now' | 'waiting' | 'done' | 'muted';
export type DayPilotProviderTarget =
  | 'codex'
  | 'chatgpt'
  | 'claude'
  | 'doubao'
  | 'generic';
export type DayPilotCardType =
  | 'meeting_prepare'
  | 'thread_followup'
  | 'decision_check'
  | 'ai_tool_shift'
  | 'project_risk'
  | 'relationship_ping'
  | 'rehearsal_prompt'
  | 'skill_opportunity'
  | 'memory_quality';

export interface DayPilotEvidenceRef {
  sourceKind: string;
  sourceId: string;
  title?: string;
  snippet: string;
  timestamp?: number;
  sourceUrl?: string;
  exploreLink?: string;
}

export interface DayPilotRehearsalCueReceipt {
  label: string;
  cueLabel: string;
  cueDetail: string;
  statusLabel: string;
  script: string;
  boundary: string;
  tone: 'info' | 'warning';
}

export interface DayPilotCard {
  id: string;
  briefId: string;
  missionId?: string;
  cardType: DayPilotCardType;
  title: string;
  priority: DayPilotPriority;
  state: DayPilotState;
  whyNow: string;
  nextBestAction: string;
  dueAt?: number;
  people: Array<{ id?: string; name: string; type?: string }>;
  projects: Array<{ id?: string; name: string; type?: string }>;
  evidenceRefs: DayPilotEvidenceRef[];
  openQuestions: string[];
  trust: {
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    staleEvidenceCount: number;
    sensitiveEvidenceCount: number;
  };
  contextPack: Record<string, any> & {
    rehearsalCueReceipt?: DayPilotRehearsalCueReceipt;
  };
  sourceHash: string;
  score: number;
  createdAt: number;
  updatedAt: number;
}

export interface DayPilotMission {
  id: string;
  briefId: string;
  missionKey: string;
  title: string;
  status: 'active' | 'waiting' | 'done' | 'muted';
  sourceKinds: string[];
  timeWindow: { from?: number; to?: number };
  relatedRefs: Record<string, any>;
  currentState?: string;
  desiredOutcome?: string;
  nextActions: Array<{ title: string; desc: string }>;
  score: number;
  createdAt: number;
  updatedAt: number;
}

export interface DayPilotBrief {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  generatedAt: number;
  horizon: { from: number; to: number };
  status: 'draft' | 'ready' | 'stale' | 'archived';
  summary: string;
  attentionBudget: {
    maxInterruptions: number;
    usedInterruptions: number;
    quietWindows: Array<{ from: number; to: number; reason?: string }>;
    plannedInterruptions?: Array<{ cardId: string; reason: string }>;
    boardOnlyCardIds?: string[];
  };
  sourceStats: {
    messages: { scanned: number; totalRecent: number; selected?: number };
    calendar: { scanned: number; upcoming: number; selected?: number };
    notifications: { scanned: number; pending: number; selected?: number };
    actions: { scanned: number; queued: number; selected?: number };
    reflections: { scanned: number; active: number; selected?: number };
    rehearsals: { scanned: number; active: number; selected?: number };
    skills: { scanned: number; suggestions: number; selected?: number };
    relationships: {
      scanned: number;
      highFrequencyPeople: number;
      selected?: number;
    };
  };
  cards: DayPilotCard[];
  missions: DayPilotMission[];
  createdAt: number;
  updatedAt: number;
}

export interface DayPilotTodayResponse {
  brief: DayPilotBrief;
  generated: boolean;
  stale: boolean;
}

export interface DayPilotCatchUpItem {
  messageId: string;
  source: string;
  title: string;
  preview: string;
  timestamp: number;
  importance: number;
  salience: number;
  waiting: boolean;
}

export interface DayPilotCatchUpBrief {
  sinceTs: number;
  nowTs: number;
  total: number;
  highPriority: DayPilotCatchUpItem[];
  waiting: DayPilotCatchUpItem[];
}

export interface DayPilotContextPackResponse {
  missionId: string;
  generatedAt: number;
  tokenBudget: number;
  maxChars: number;
  targetProvider: DayPilotProviderTarget;
  providerProfile: {
    id: DayPilotProviderTarget;
    label: string;
    defaultTokenBudget: number;
    style: 'implementation' | 'conversation' | 'analysis' | 'chinese' | 'plain';
  };
  usageIntent: {
    kind: 'external_ai_context';
    boundary: 'context_only_not_execution';
    defaultSensitiveHandling: 'redacted_by_default' | 'included_sensitive';
  };
  sourceSummary: {
    evidenceCount: number;
    renderedEvidenceCount: number;
    omittedEvidenceCount: number;
    sourceKinds: Record<string, number>;
    redactionApplied: boolean;
    truncated: boolean;
  };
  bodyMd: string;
  evidenceRefs: DayPilotEvidenceRef[];
  warnings: string[];
  redactionPreview: string[];
  redactionApplied: boolean;
  truncated: boolean;
}

export type DayPilotFeedbackAction =
  | 'done'
  | 'later'
  | 'mute'
  | 'wrong'
  | 'useful';

export interface DayPilotFeedbackPayload {
  action: DayPilotFeedbackAction;
  note?: string;
  reason?: string;
  snoozeUntil?: number;
  muteKey?: string;
}

export type TodayPilotMeetingPrepStatus =
  | 'ready'
  | 'fallback'
  | 'failed'
  | 'stale';

export type TodayPilotMeetingPrepGeneratedMode =
  | 'nightly_llm'
  | 'on_demand_llm'
  | 'deterministic_fallback';

export interface TodayPilotMeetingPrepRecord {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  briefId?: string;
  missionId?: string;
  eventExternalId: string;
  eventSeriesKey?: string;
  eventTitle: string;
  startAt: number;
  goalHash: string;
  status: TodayPilotMeetingPrepStatus;
  generatedMode: TodayPilotMeetingPrepGeneratedMode;
  summaryMd: string;
  cueCards: ContextAssistCueCard[];
  questions: string[];
  evidenceRefs: ComposerAssistEvidence[];
  contextPackMd: string;
  redaction: Record<string, unknown>;
  llmUsage: Record<string, unknown>;
  storylineOpportunity?: StorylineOpportunity;
  outcomeBinder?: MeetingOutcomeBinder;
  sourceHash: string;
  generatedAt: number;
  expiresAt: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TodayPilotMeetingPrepPrepareResponse {
  prepared: number;
  skipped: number;
  failed: number;
  items: TodayPilotMeetingPrepRecord[];
  warnings: string[];
}

export interface TodayPilotMeetingPrepResolveResponse {
  prep: TodayPilotMeetingPrepRecord | null;
  assist: ContextAssistResponse | null;
  generated: boolean;
  source: 'cached' | 'generated' | 'fallback' | 'none';
  warnings: string[];
}

export interface MemoryBackupDownloadResponse {
  blob: Blob;
  fileName: string;
  contentType: string;
  manifest?: MemoryBackupDownloadManifestSummary;
}

export interface MemoryBackupDownloadManifestSummary {
  userId: string;
  exportedAt: string;
  archiveSha256?: string;
  formatVersion: number;
  includeCount: number;
  layers: {
    A: number;
    B: number;
    C: {
      generated: number;
      failed: number;
      skipped: number;
    };
  };
}

export interface MemoryBackupImportResponse {
  mode: 'merge' | 'replace';
  importedAt: string;
  restoredLayers: Array<'A' | 'B'>;
  backup?: {
    userId: string;
    targetUserId: string;
    exportedAt: string;
    formatVersion: number;
    includeCount: number;
    archiveSha256?: string;
  };
  database: {
    action: 'merged' | 'replaced';
    changedRows?: number;
    tableChanges?: Record<string, number>;
    skippedTables?: string[];
  };
  files: {
    written: number;
    overwritten: number;
    preserved: number;
    deleted: number;
    writtenPaths: string[];
    overwrittenPaths: string[];
    preservedPaths: string[];
    deletedPaths: string[];
  };
  warnings: string[];
}

export interface MemoryBackupImportPreviewResponse {
  mode: 'merge' | 'replace';
  dryRun: true;
  inspectedAt: string;
  restoredLayers: Array<'A' | 'B'>;
  backup: {
    userId: string;
    targetUserId: string;
    exportedAt: string;
    formatVersion: number;
    includeCount: number;
    archiveSha256?: string;
    layers: {
      A: number;
      B: number;
      C: {
        generated: number;
        failed: number;
        skipped: number;
      };
    };
  };
  database: {
    action: 'would_merge' | 'would_replace';
    importedRows: number;
    tableRows: Record<string, number>;
    skippedTables: string[];
  };
  files: {
    written: number;
    overwritten: number;
    preserved: number;
    deleted: number;
    writtenPaths: string[];
    overwrittenPaths: string[];
    preservedPaths: string[];
    deletedPaths: string[];
  };
  warnings: string[];
}

export type SmartMemoryImportDetectedKind =
  | 'text'
  | 'document'
  | 'document_zip'
  | 'external_ai_history'
  | 'backup_zip'
  | 'unsupported';

export interface SmartMemoryImportEntry {
  id: string;
  path: string;
  title: string;
  kind: 'text' | 'markdown' | 'json' | 'pdf' | 'unsupported';
  status: 'ready' | 'blocked';
  sizeBytes: number;
  hash?: string;
  chunkCount: number;
  preview: string;
  blockedReason?: string;
}

export interface SmartMemoryImportInspectResponse {
  detectedKind: SmartMemoryImportDetectedKind;
  inputKind: 'paste' | 'file';
  fileName?: string;
  sourceHash: string;
  status: 'ready' | 'backup' | 'blocked' | 'duplicate';
  summary: {
    files: number;
    readyFiles: number;
    chunks: number;
    profileCandidates: number;
    skillSignals: number;
    highRisk: number;
    unsupported: number;
    zipTotalFiles?: number;
    zipInspectedFiles?: number;
    zipSkippedFiles?: number;
    backup: boolean;
    externalAiConversations?: number;
    externalAiImportedMessages?: number;
    externalAiTotalMessages?: number;
    externalAiTruncatedConversations?: number;
    externalAiTruncatedMessages?: number;
    externalAiSkippedParts?: number;
    externalAiSourcePath?: string;
    externalAiIgnoredFiles?: number;
    promotionCandidates?: number;
  };
  entries: SmartMemoryImportEntry[];
  backup?: {
    reason: string;
    suggestedMode: 'merge';
    replaceRequiresConfirm: true;
  };
  existingBatchId?: string;
  warnings: string[];
}

export interface SmartMemoryImportCommitResponse {
  status: 'committed' | 'duplicate';
  batchId: string;
  detectedKind: SmartMemoryImportDetectedKind;
  importedMessages: number;
  importedChunks: number;
  skippedEntries: number;
  warnings: string[];
}

// ============================================================================
// Provider integration types
// ============================================================================

export type ProviderTransport =
  | 'native_memory'
  | 'session_context'
  | 'document_context'
  | 'reminder';

export type ProviderScenario =
  | 'stable_memory'
  | 'mobile_briefing'
  | 'query_answer'
  | 'todo_sync'
  | 'notice_sync'
  | 'reminder_sync'
  | 'general';

export type ProviderMemoryProductKind =
  | 'persona_core'
  | 'voice_mode'
  | 'active_focus_digest'
  | 'todo_digest'
  | 'notice_digest'
  | 'reminder_digest'
  | 'query_answer_card';

export interface ProviderCapabilities {
  provider: string;
  displayName: string;
  supportedTransports: ProviderTransport[];
  supportedBindingTypes: string[];
  supportedScenarios: ProviderScenario[];
  syncModel: 'local_bridge';
  notes: string[];
}

export interface ProviderBindingRecord {
  id: string;
  provider: string;
  bindingType: string;
  externalThreadId: string;
  title?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  lastSyncedAt?: number;
  lastSyncJobId?: string;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertProviderBindingPayload {
  externalThreadId: string;
  title?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  lastError?: string | null;
}

export interface ProviderMemoryProduct {
  id: string;
  kind: ProviderMemoryProductKind;
  title: string;
  bodyMd: string;
  itemCount?: number;
  feedHasMore?: boolean;
  feedLimit?: number;
  feedSnapshotReceipt?: string;
  stability: 'stable' | 'rolling' | 'ephemeral';
  transport: ProviderTransport;
  targetBindingType: string;
  ttlSeconds?: number;
  sourceRefs: string[];
  dedupeKey: string;
  generatedAt: number;
}

export interface ProviderContextPackageResponse {
  provider: string;
  scenario: string;
  generatedAt: number;
  tokenBudget: number;
  packages: ProviderMemoryProduct[];
  bindings: ProviderBindingRecord[];
  syncJob?: ProviderSyncJobRecord;
}

export interface RenderProviderContextPackagePayload {
  provider: string;
  scenario: ProviderScenario | string;
  query?: string;
  tokenBudget?: number;
  freshnessWindowDays?: number;
  includeKinds?: ProviderMemoryProductKind[];
  deviceContext?: string;
  bindingType?: string;
  createSyncJob?: boolean;
}

export interface ProviderSyncJobRecord {
  id: string;
  provider: string;
  scenario: string;
  bindingType: string;
  bindingId?: string;
  title?: string;
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'skipped';
  request: Record<string, any>;
  response?: Record<string, any>;
  result?: Record<string, any>;
  errorMessage?: string;
  dedupeKey?: string;
  sourceRefs: string[];
  tokenBudget?: number;
  freshnessWindowDays?: number;
  deviceContext?: string;
  externalThreadId?: string;
  providerMessageId?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderSyncJobListResponse {
  items: ProviderSyncJobRecord[];
  total: number;
}

export interface ProviderSyncJobFilters {
  status?: ProviderSyncJobRecord['status'] | 'all';
  bindingType?: string;
  limit?: number;
  offset?: number;
}

export interface ReportProviderSyncJobPayload {
  status: ProviderSyncJobRecord['status'];
  result?: Record<string, any>;
  errorMessage?: string;
  response?: Record<string, any>;
  providerMessageId?: string;
  externalThreadId?: string;
  completedAt?: number;
  startedAt?: number;
}

function parseContentDispositionFilename(
  contentDisposition: string | null,
): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

function parseNumericHeader(headers: Headers, name: string): number | null {
  const rawValue = headers.get(name);
  if (!rawValue) return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function parseBackupManifestHeaders(
  headers: Headers,
): MemoryBackupDownloadManifestSummary | undefined {
  const userId = headers.get('x-personal-ai-backup-user-id');
  const exportedAt = headers.get('x-personal-ai-backup-exported-at');
  const archiveSha256 = headers.get('x-personal-ai-backup-archive-sha256');
  const formatVersion = parseNumericHeader(
    headers,
    'x-personal-ai-backup-format-version',
  );
  const includeCount = parseNumericHeader(
    headers,
    'x-personal-ai-backup-include-count',
  );
  const layerA = parseNumericHeader(
    headers,
    'x-personal-ai-backup-layer-a-count',
  );
  const layerB = parseNumericHeader(
    headers,
    'x-personal-ai-backup-layer-b-count',
  );
  const layerCGenerated = parseNumericHeader(
    headers,
    'x-personal-ai-backup-layer-c-generated-count',
  );
  const layerCFailed = parseNumericHeader(
    headers,
    'x-personal-ai-backup-layer-c-failed-count',
  );
  const layerCSkipped = parseNumericHeader(
    headers,
    'x-personal-ai-backup-layer-c-skipped-count',
  );

  if (
    !userId ||
    !exportedAt ||
    formatVersion === null ||
    includeCount === null ||
    layerA === null ||
    layerB === null ||
    layerCGenerated === null ||
    layerCFailed === null ||
    layerCSkipped === null
  ) {
    return undefined;
  }

  return {
    userId,
    exportedAt,
    archiveSha256: archiveSha256 ?? undefined,
    formatVersion,
    includeCount,
    layers: {
      A: layerA,
      B: layerB,
      C: {
        generated: layerCGenerated,
        failed: layerCFailed,
        skipped: layerCSkipped,
      },
    },
  };
}

function getUploadFileName(file: Blob | File, fallback: string): string {
  return typeof File !== 'undefined' && file instanceof File
    ? file.name
    : fallback;
}

// ============================================================================
// concernedItems sync types
// ============================================================================

export interface ConcernedItemsSnapshotResponse {
  items: any[];
  version: number;
  updatedAt: string | null;
  contentUpdatedAt: string | null;
  updatedByDevice?: string;
}

export interface PutConcernedItemsSnapshotPayload {
  items: any[];
  baseVersion?: number;
  contentUpdatedAt?: string;
  updatedByDevice?: string;
}

export interface FollowThreadHitEvent {
  id?: string;
  followItemId: string;
  postId: string;
  sender: string;
  datetime: string;
  relationType: string;
  summary?: string;
  teamId?: string;
  createdAt?: string;
  sourceDevice?: string;
}

export interface FollowThreadHitListResponse {
  items: FollowThreadHitEvent[];
  total: number;
  nextSince: string | null;
}

// ============================================================================
// Error class
// ============================================================================

export class MemoryServiceError extends Error {
  public status: number;
  public body: any;

  constructor(status: number, message: string, body?: any) {
    super(`MemoryService ${status}: ${message}`);
    this.name = 'MemoryServiceError';
    this.status = status;
    this.body = body;
  }
}

// ============================================================================
// Client class
// ============================================================================

export class MemoryServiceClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private bootstrapKey: string | undefined;
  private timeout: number;
  private userId: string;
  private userIdentityExplicit = false;
  private configLoaded = false;
  private _configLoadPromise: Promise<void> | null = null;
  private _userIdResolvePromise: Promise<void> | null = null;
  private _deviceKeyPromise: Promise<string | null> | null = null;
  private readonly configOverrides: Partial<MemoryServiceConfig>;

  constructor(config?: Partial<MemoryServiceConfig>) {
    this.configOverrides = { ...config };
    this.baseUrl = config?.baseUrl ?? DEFAULT_MEMORY_SERVICE_BASE_URL;
    this.apiKey = config?.apiKey;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT_MS;
    this.userId = 'default';

    if (config?.userId != null) {
      this.setUserId(config.userId);
    }

    // Always load storage (bootstrap + existing pak). Explicit constructor
    // fields overlay afterwards so callers that pass baseUrl still authenticate.
    this._configLoadPromise = this.loadConfigFromStorage();
  }

  /**
   * Load configuration from envConfig and userinfo in chrome.storage.local.
   * - baseUrl, apiKey, timeout: from envConfig (MEMORY_SERVICE_*)
   * - userId: from userinfo.username, or the local part of a stored work email
   * Constructor overrides win for baseUrl / apiKey / timeout / userId.
   * Bootstrap is always taken from storage or the baked build env.
   */
  private loadConfigFromStorage(): Promise<void> {
    if (this.configLoaded) {
      return Promise.resolve();
    }

    const applyBootstrapFallback = () => {
      this.bootstrapKey = this.resolveBootstrapKey(this.bootstrapKey);
    };

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get(
            ['envConfig', 'userinfo'],
            (result: {
              envConfig?: Record<string, any>;
              userinfo?: StoredMemoryUserInfo;
            }) => {
              const env = result.envConfig;
              if (
                env?.MEMORY_SERVICE_BASE_URL &&
                !this.configOverrides.baseUrl
              ) {
                this.baseUrl = env.MEMORY_SERVICE_BASE_URL;
              }
              if (
                env?.MEMORY_SERVICE_API_KEY &&
                !this.configOverrides.apiKey
              ) {
                this.apiKey = env.MEMORY_SERVICE_API_KEY;
              }
              if (
                env?.MEMORY_SERVICE_BOOTSTRAP_KEY != null &&
                env.MEMORY_SERVICE_BOOTSTRAP_KEY !== ''
              ) {
                this.bootstrapKey = env.MEMORY_SERVICE_BOOTSTRAP_KEY;
              }
              if (
                env?.MEMORY_SERVICE_TIMEOUT != null &&
                this.configOverrides.timeout == null
              ) {
                const t = Number(env.MEMORY_SERVICE_TIMEOUT);
                if (!Number.isNaN(t)) this.timeout = t;
              }
              if (this.configOverrides.userId == null) {
                const userId = resolveStoredMemoryUserId(result.userinfo);
                if (userId) {
                  this.userId = userId;
                  this.userIdentityExplicit = true;
                }
              }
              applyBootstrapFallback();
              this.configLoaded = true;
              resolve();
            },
          );
        });
      }
    } catch {
      // chrome.storage not available — use defaults
    }

    applyBootstrapFallback();
    this.configLoaded = true;
    return Promise.resolve();
  }

  private resolveBootstrapKey(fromStorage?: string): string {
    const stored = String(fromStorage || '').trim();
    if (stored) return stored;
    const baked = String(
      (typeof process !== 'undefined'
        ? process.env.MEMORY_SERVICE_BOOTSTRAP_KEY
        : '') ||
        getDefaultEnvConfig().MEMORY_SERVICE_BOOTSTRAP_KEY ||
        '',
    ).trim();
    return baked;
  }

  private async ensureDeviceBearer(): Promise<string | undefined> {
    await this.ensureConfigLoaded();
    await this.ensureUserIdResolved();
    if (!this.shouldSendUserIdentity()) return this.apiKey;
    this.bootstrapKey = this.resolveBootstrapKey(this.bootstrapKey);

    if (!this._deviceKeyPromise) {
      this._deviceKeyPromise = this.issueDeviceKeyPromise(false);
    }
    const deviceToken = await this._deviceKeyPromise;
    // Prefer per-device tier-2; fall back to service key only if needed.
    return deviceToken || this.apiKey;
  }

  private issueDeviceKeyPromise(forceReissue: boolean): Promise<string | null> {
    return ensureDeviceApiKey({
      baseUrl: this.baseUrl,
      bootstrapKey: this.resolveBootstrapKey(this.bootstrapKey),
      serviceKey: this.apiKey,
      userId: this.userId,
      forceReissue,
    })
      .then((token) => {
        if (!token) this._deviceKeyPromise = null;
        return token;
      })
      .catch(() => {
        this._deviceKeyPromise = null;
        return null;
      });
  }

  private isRecoverableAuthError(
    status: number,
    errorBody: { error?: string } | string | null | undefined,
  ): 'scope' | 'invalid' | null {
    const code =
      errorBody && typeof errorBody === 'object' ? errorBody.error : undefined;
    if (status === 403 && code === 'user_key_scope_insufficient') return 'scope';
    if (status === 401 && code === 'invalid_user_api_key') return 'invalid';
    return null;
  }

  private async rotateDeviceKeyAfterAuthFailure(
    kind: 'scope' | 'invalid',
  ): Promise<void> {
    await clearStoredDeviceKey().catch(() => undefined);
    if (kind === 'invalid') {
      // Server no longer recognizes this pak (revoked / DB reset). Help-center
      // copies are equally stale; drop them so bootstrap can mint a new one.
      await clearStoredHelpCenterKey().catch(() => undefined);
    }
    this._deviceKeyPromise = this.issueDeviceKeyPromise(true);
    await this._deviceKeyPromise;
  }

  async buildAuthHeaders(): Promise<Record<string, string>> {
    await this.ensureConfigLoaded();
    await this.ensureUserIdResolved();
    const headers: Record<string, string> = {};
    this.applyUserIdentityHeader(headers);
    await this.applyUiLanguageHeaders(headers);
    const deviceBearer = await this.ensureDeviceBearer();
    if (deviceBearer) {
      headers.Authorization = `Bearer ${deviceBearer}`;
    }
    return headers;
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (this.configLoaded) {
      return;
    }

    if (!this._configLoadPromise) {
      this._configLoadPromise = this.loadConfigFromStorage();
    }

    await this._configLoadPromise;
  }

  /**
   * Resolve userId from stored user info when it is still 'default'.
   * Runs once per "default" period.
   */
  private async ensureUserIdResolved(): Promise<void> {
    if (this.userId !== 'default') return;
    if (this._userIdResolvePromise) return this._userIdResolvePromise;

    this._userIdResolvePromise = (async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;
        const result = (await chrome.storage.local.get('userinfo')) as {
          userinfo?: StoredMemoryUserInfo;
        };
        const userId = resolveStoredMemoryUserId(result.userinfo);
        if (userId) {
          this.userId = userId;
          this.userIdentityExplicit = true;
        }
      } finally {
        this._userIdResolvePromise = null;
      }
    })();

    return this._userIdResolvePromise;
  }

  private async applyUiLanguageHeaders(
    headers: Record<string, string>,
  ): Promise<void> {
    try {
      const preferences = await readExtensionUiPreferences();
      headers['X-Personal-AI-Language'] =
        preferences.language || DEFAULT_UI_LANGUAGE;
      headers['Accept-Language'] = preferences.language || DEFAULT_UI_LANGUAGE;
    } catch {
      headers['X-Personal-AI-Language'] = DEFAULT_UI_LANGUAGE;
      headers['Accept-Language'] = DEFAULT_UI_LANGUAGE;
    }
  }

  private shouldSendUserIdentity(): boolean {
    return this.userIdentityExplicit && USER_ID_PATTERN.test(this.userId);
  }

  private applyUserIdentityHeader(headers: Record<string, string>): void {
    if (this.shouldSendUserIdentity()) {
      headers['X-User-Id'] = this.userId;
    }
  }

  // --------------------------------------------------------------------------
  // Core HTTP wrapper
  // --------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    retried = false,
  ): Promise<T> {
    await this.ensureConfigLoaded();
    await this.ensureUserIdResolved();

    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    this.applyUserIdentityHeader(headers);
    await this.applyUiLanguageHeaders(headers);

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const deviceBearer = await this.ensureDeviceBearer();
    if (deviceBearer) {
      headers['Authorization'] = `Bearer ${deviceBearer}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await this.parseErrorResponse(response);
        const recoverable = this.isRecoverableAuthError(
          response.status,
          errorBody,
        );
        if (!retried && recoverable) {
          await this.rotateDeviceKeyAfterAuthFailure(recoverable);
          return this.request(method, path, body, true);
        }
        const message =
          errorBody?.error || errorBody?.message || response.statusText;
        throw new MemoryServiceError(response.status, message, errorBody);
      }

      // Handle empty responses (204 No Content, etc.)
      const contentType = response.headers.get('content-type');
      if (
        response.status === 204 ||
        !contentType?.includes('application/json')
      ) {
        return undefined as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof MemoryServiceError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new MemoryServiceError(
          0,
          `Request to ${path} timed out after ${this.timeout}ms`,
        );
      }

      throw new MemoryServiceError(
        0,
        `Network error: ${
          err.message || 'Failed to connect to Memory Service'
        }`,
      );
    }
  }

  private async parseErrorResponse(response: Response): Promise<any> {
    const rawText = await response.text();

    try {
      return JSON.parse(rawText);
    } catch {
      return rawText;
    }
  }

  private async requestBlob(
    method: string,
    path: string,
    body?: any,
  ): Promise<MemoryBackupDownloadResponse> {
    await this.ensureConfigLoaded();
    await this.ensureUserIdResolved();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/zip',
    };
    this.applyUserIdentityHeader(headers);
    await this.applyUiLanguageHeaders(headers);

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const deviceBearer = await this.ensureDeviceBearer();
    if (deviceBearer) {
      headers['Authorization'] = `Bearer ${deviceBearer}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await this.parseErrorResponse(response);
        const message =
          errorBody?.error || errorBody?.message || response.statusText;
        throw new MemoryServiceError(response.status, message, errorBody);
      }

      const blob = await response.blob();
      const fileName =
        parseContentDispositionFilename(
          response.headers.get('content-disposition'),
        ) || `personal-ai-memory-${this.userId}.zip`;

      return {
        blob,
        fileName,
        contentType: response.headers.get('content-type') || 'application/zip',
        manifest: parseBackupManifestHeaders(response.headers),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof MemoryServiceError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new MemoryServiceError(
          0,
          `Request to ${path} timed out after ${this.timeout}ms`,
        );
      }

      throw new MemoryServiceError(
        0,
        `Network error: ${
          err.message || 'Failed to connect to Memory Service'
        }`,
      );
    }
  }

  private async requestForm<T>(
    method: string,
    path: string,
    formData: FormData,
    accept = 'application/json',
  ): Promise<T> {
    await this.ensureConfigLoaded();
    await this.ensureUserIdResolved();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: accept,
    };
    this.applyUserIdentityHeader(headers);
    await this.applyUiLanguageHeaders(headers);

    const deviceBearer = await this.ensureDeviceBearer();
    if (deviceBearer) {
      headers.Authorization = `Bearer ${deviceBearer}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await this.parseErrorResponse(response);
        const message =
          errorBody?.error || errorBody?.message || response.statusText;
        throw new MemoryServiceError(response.status, message, errorBody);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof MemoryServiceError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new MemoryServiceError(
          0,
          `Request to ${path} timed out after ${this.timeout}ms`,
        );
      }

      throw new MemoryServiceError(
        0,
        `Network error: ${
          err.message || 'Failed to connect to Memory Service'
        }`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Ingest
  // --------------------------------------------------------------------------

  /**
   * Ingest a single message/document into the Memory Service.
   */
  async ingest(payload: IngestPayload): Promise<IngestResult> {
    return this.request<IngestResult>('POST', '/ingest', payload);
  }

  /**
   * Ingest a batch of messages/documents.
   */
  async ingestBatch(items: IngestPayload[]): Promise<BatchIngestResult> {
    return this.request<BatchIngestResult>('POST', '/ingest/batch', { items });
  }

  // --------------------------------------------------------------------------
  // Recall & Ask
  // --------------------------------------------------------------------------

  /**
   * Active recall — research-grade multi-channel recall.
   *
   * Returns evidence items always. Retrieval cost, deterministic presentation
   * blocks, and token-consuming synthesis are independent options. Synthesis
   * only runs when `synthesis.mode` is explicitly `'summary'` (or a legacy
   * caller includes `'summary'` in `blockTypes`).
   *
   * For passive associative recall (web/meeting bubbles), use
   * {@link MemoryServiceClient.contextRecall} instead.
   */
  async recall(query: string, options?: RecallOptions): Promise<RecallResult> {
    return this.request<RecallResult>('POST', '/recall', {
      query,
      ...options,
    });
  }

  /**
   * Fetch one stored message/chunk by stable explorer id.
   * Used to make `#/timeline?focus=...` links work even when the item is
   * outside the currently selected timeline range.
   */
  async getMemoryItem(
    type: 'message' | 'chunk',
    id: string,
  ): Promise<RecallItem> {
    const encodedType = encodeURIComponent(type);
    const encodedId = encodeURIComponent(id);
    return this.request<RecallItem>(
      'GET',
      `/memories/${encodedType}/${encodedId}`,
    );
  }

  async submitFeedback(
    payload: MemoryFeedbackPayload,
  ): Promise<MemoryFeedbackResult> {
    return this.request<MemoryFeedbackResult>('POST', '/feedback', payload);
  }

  async correctMemoryClaim(
    claimId: string,
    payload: MemoryClaimCorrectionRequest,
  ): Promise<MemoryClaimCorrectionResponse> {
    return this.request<MemoryClaimCorrectionResponse>(
      'POST',
      `/memory-claims/${encodeURIComponent(claimId)}/corrections`,
      payload,
    );
  }

  async submitRecallRelevanceFeedback(
    payload: RecallRelevanceFeedbackPayload,
  ): Promise<{ ok: true; result: RecallRelevanceRecordResult }> {
    return this.request<{ ok: true; result: RecallRelevanceRecordResult }>(
      'POST',
      '/recall/relevance-feedback',
      payload,
    );
  }

  async listRecallRelevancePatches(
    status?: RecallRelevancePatch['status'],
  ): Promise<{ items: RecallRelevancePatch[] }> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<{ items: RecallRelevancePatch[] }>(
      'GET',
      `/recall/relevance-patches${query}`,
    );
  }

  async updateRecallRelevancePatchStatus(
    id: string,
    status: 'active' | 'paused' | 'deleted',
  ): Promise<{ status: 'ok'; patch: RecallRelevancePatch }> {
    return this.request<{ status: 'ok'; patch: RecallRelevancePatch }>(
      'PATCH',
      `/recall/relevance-patches/${encodeURIComponent(id)}`,
      { status },
    );
  }

  /**
   * Passive associative recall — fast, structured, with stable jump links into
   * memory-exploring (Vue UI). Designed for surface-attached "you've seen this
   * before" bubbles in web/meeting/popup surfaces.
   */
  async contextRecall(
    request: ContextRecallRequest,
  ): Promise<ContextRecallResponse> {
    return this.request<ContextRecallResponse>(
      'POST',
      '/context-recall',
      request,
    );
  }

  async recordKeystoneBriefEvent(
    id: string,
    input: {
      eventType:
        | 'shown'
        | 'opened'
        | 'evidence_opened'
        | 'copied'
        | 'useful'
        | 'hidden'
        | 'not_accurate'
        | 'used_in_ask'
        | 'used_by_compiler';
      surface?: string;
      context?: Record<string, unknown>;
      reason?: string;
      detail?: string;
    },
  ): Promise<{ item: KeystoneBrief }> {
    return this.request<{ item: KeystoneBrief }>(
      'POST',
      `/keystone-briefs/${encodeURIComponent(id)}/events`,
      input,
    );
  }

  async refreshKeystoneBriefLanguage(): Promise<{
    scheduled: boolean;
    reason?: string;
  }> {
    return this.request('POST', '/keystone-briefs/refresh-language', {});
  }

  /**
   * Context Assist — shared orchestration for meeting prep and Composer Guard.
   * The backend still reuses context-recall/recall for retrieval.
   */
  async contextAssist(
    request: ContextAssistRequest,
  ): Promise<ContextAssistResponse> {
    return this.request<ContextAssistResponse>(
      'POST',
      '/context-assist',
      request,
    );
  }

  /**
   * Composer Guard assist — returns user-approved insertion text for the
   * currently focused message/comment/prompt composer. The backend stays on the
   * evidence-only fast path for v1 and never sends on the user's behalf.
   */
  async composerAssist(
    request: ComposerAssistRequest,
  ): Promise<ComposerAssistResponse> {
    return this.request<ComposerAssistResponse>(
      'POST',
      '/composer/assist',
      request,
    );
  }

  async submitAmbientCalibrationTrace(
    trace: AmbientCalibrationTrace,
  ): Promise<AmbientCalibrationTraceResponse> {
    return this.request<AmbientCalibrationTraceResponse>(
      'POST',
      '/ambient-calibration/traces',
      trace,
    );
  }

  async listRehearsals(filters?: {
    status?: RehearsalStatus | 'all';
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<RehearsalListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    return this.request<RehearsalListResponse>(
      'GET',
      `/rehearsals${qs ? `?${qs}` : ''}`,
    );
  }

  async createRehearsal(
    payload: RehearsalMutationPayload & { title: string; content: string },
  ): Promise<{ rehearsal: Rehearsal }> {
    return this.request<{ rehearsal: Rehearsal }>(
      'POST',
      '/rehearsals',
      payload,
    );
  }

  async getRehearsal(id: string): Promise<RehearsalDetailResponse> {
    return this.request<RehearsalDetailResponse>(
      'GET',
      `/rehearsals/${encodeURIComponent(id)}`,
    );
  }

  async updateRehearsal(
    id: string,
    payload: RehearsalMutationPayload,
  ): Promise<{ rehearsal: Rehearsal }> {
    return this.request<{ rehearsal: Rehearsal }>(
      'PATCH',
      `/rehearsals/${encodeURIComponent(id)}`,
      payload,
    );
  }

  async deleteRehearsal(id: string): Promise<{ rehearsal: Rehearsal }> {
    return this.request<{ rehearsal: Rehearsal }>(
      'DELETE',
      `/rehearsals/${encodeURIComponent(id)}`,
    );
  }

  async submitRehearsalFeedback(
    id: string,
    payload: {
      outcome: RehearsalActivationOutcome;
      activationId?: string;
      note?: string;
    },
  ): Promise<{ rehearsal: Rehearsal; activation?: RehearsalActivation }> {
    return this.request(
      'POST',
      `/rehearsals/${encodeURIComponent(id)}/feedback`,
      payload,
    );
  }

  async syncCalendarEvents(
    request: CalendarEventsSyncRequest,
  ): Promise<CalendarEventsSyncResponse> {
    return this.request<CalendarEventsSyncResponse>(
      'POST',
      '/calendar-events/sync',
      request,
    );
  }

  /**
   * Natural language Q&A — combines active recall with LLM generation.
   * Response includes deterministic `blocks` from recalled evidence in addition
   * to the prose answer and structured findings.
   */
  async ask(
    query: string,
    context?: string,
    includeEvidence?: boolean,
    options?: { scope?: RecallScope },
  ): Promise<AskResponse> {
    return this.request<AskResponse>('POST', '/ask', {
      query,
      context,
      includeEvidence,
      scope: options?.scope,
    });
  }

  async getMeetings(
    limit?: number,
    offset?: number,
    filters: MeetingArchiveFilters = {},
  ): Promise<MeetingRecordListResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const query = filters.query?.trim();
    if (query) params.set('q', query);
    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }

    const searchParams = params.toString();
    return this.request<MeetingRecordListResponse>(
      'GET',
      `/meetings${searchParams ? `?${searchParams}` : ''}`,
    );
  }

  async getMeetingDetail(meetingId: string): Promise<MeetingRecordDetail> {
    return this.request<MeetingRecordDetail>(
      'GET',
      `/meetings/${encodeURIComponent(meetingId)}`,
    );
  }

  async getMeetingOutcome(id: string): Promise<MeetingOutcomeBinder | null> {
    const response = await this.request<{ binder: MeetingOutcomeBinder }>(
      'GET',
      `/meeting-outcomes/${encodeURIComponent(id)}`,
    );
    return response.binder ?? null;
  }

  async getMeetingOutcomeByMeetingId(
    meetingId: string,
  ): Promise<MeetingOutcomeBinder | null> {
    const response = await this.request<{ binder: MeetingOutcomeBinder | null }>(
      'GET',
      `/meeting-outcomes?meetingId=${encodeURIComponent(meetingId)}`,
    );
    return response.binder;
  }

  async bindMeetingOutcome(
    payload: MeetingOutcomeBindInput,
  ): Promise<MeetingOutcomeBinder> {
    const response = await this.request<{ binder: MeetingOutcomeBinder }>(
      'POST',
      '/meeting-outcomes/bind',
      payload,
    );
    return response.binder;
  }

  // --------------------------------------------------------------------------
  // Entities
  // --------------------------------------------------------------------------

  /**
   * List entities with optional filters.
   */
  async getEntities(
    type?: string,
    search?: string,
    limit?: number,
    offset?: number,
  ): Promise<EntityListResponse> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (search) params.set('search', search);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));

    const qs = params.toString();
    const path = `/entities${qs ? '?' + qs : ''}`;
    return this.request<EntityListResponse>('GET', path);
  }

  /**
   * Get a single entity with its current active properties.
   */
  async getEntityDetail(id: string): Promise<EntityDetailResponse> {
    return this.request<EntityDetailResponse>(
      'GET',
      `/entities/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Get the property history for an entity.
   */
  async getEntityProperties(
    id: string,
    key?: string,
    includeSuperseded?: boolean,
  ): Promise<{
    entityId: string;
    properties: EntityProperty[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (key) params.set('key', key);
    if (includeSuperseded) params.set('includeSuperseded', 'true');

    const qs = params.toString();
    const path = `/entities/${encodeURIComponent(id)}/properties${
      qs ? '?' + qs : ''
    }`;
    return this.request('GET', path);
  }

  /**
   * Get the property change timeline for an entity.
   */
  async getEntityTimeline(id: string): Promise<{
    entityId: string;
    timeline: EntityTimelineEntry[];
    total: number;
  }> {
    return this.request('GET', `/entities/${encodeURIComponent(id)}/timeline`);
  }

  /**
   * Get relationships for an entity, with optional breadth-first depth traversal.
   */
  async getEntityRelationships(
    id: string,
    depth?: number,
  ): Promise<{
    entityId: string;
    relationships: EntityRelationship[];
    depth: number;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (depth !== undefined) params.set('depth', String(depth));

    const qs = params.toString();
    const path = `/entities/${encodeURIComponent(id)}/relationships${
      qs ? '?' + qs : ''
    }`;
    return this.request('GET', path);
  }

  // --------------------------------------------------------------------------
  // Relationship radar
  // --------------------------------------------------------------------------

  async getRelationshipPeople(options?: {
    limit?: number;
    state?: RelationshipRadarState | 'all';
    search?: string;
    includeBelowThreshold?: boolean;
  }): Promise<RelationshipPeopleResponse> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined)
      params.set('limit', String(options.limit));
    if (options?.state) params.set('state', options.state);
    if (options?.search) params.set('search', options.search);
    if (options?.includeBelowThreshold)
      params.set('includeBelowThreshold', 'true');
    const query = params.toString();
    return this.request<RelationshipPeopleResponse>(
      'GET',
      `/relationships/people${query ? `?${query}` : ''}`,
    );
  }

  async getRelationshipPerson(id: string): Promise<RelationshipPersonSummary> {
    return this.request<RelationshipPersonSummary>(
      'GET',
      `/relationships/people/${encodeURIComponent(id)}`,
    );
  }

  async getRelationshipTimeline(
    personId: string,
    limit?: number,
  ): Promise<RelationshipTimelineResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    const query = params.toString();
    return this.request<RelationshipTimelineResponse>(
      'GET',
      `/relationships/people/${encodeURIComponent(personId)}/timeline${
        query ? `?${query}` : ''
      }`,
    );
  }

  async getRelationshipOpenLoops(
    personId: string,
    limit?: number,
  ): Promise<RelationshipOpenLoopsResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    const query = params.toString();
    return this.request<RelationshipOpenLoopsResponse>(
      'GET',
      `/relationships/people/${encodeURIComponent(personId)}/open-loops${
        query ? `?${query}` : ''
      }`,
    );
  }

  async getRelationshipContextCard(body: {
    personId?: string;
    personName?: string;
    surface?: string;
    tokenBudget?: number;
    includeSensitive?: boolean;
  }): Promise<RelationshipContextCard> {
    return this.request<RelationshipContextCard>(
      'POST',
      '/relationships/context-card',
      body,
    );
  }

  async getRelationshipContextPackage(body: {
    personIds?: string[];
    personName?: string;
    surface?: string;
    tokenBudget?: number;
  }): Promise<RelationshipContextPackage> {
    return this.request<RelationshipContextPackage>(
      'POST',
      '/relationships/context-package',
      body,
    );
  }

  async consolidateRelationships(body?: {
    limit?: number;
    personIds?: string[];
    force?: boolean;
  }): Promise<RelationshipConsolidationResult> {
    return this.request<RelationshipConsolidationResult>(
      'POST',
      '/relationships/consolidate',
      body ?? {},
    );
  }

  async getRelationshipMeetingBrief(body: {
    eventId?: string;
    title?: string;
    startAt?: number;
    attendees?: Array<{ name?: string; email?: string } | string>;
  }): Promise<RelationshipMeetingBrief> {
    return this.request<RelationshipMeetingBrief>(
      'POST',
      '/relationships/meeting-brief',
      body,
    );
  }

  async getRelationshipAssistantDraft(body: {
    personId?: string;
    personName?: string;
    scenario?: string;
    userGoal?: string;
  }): Promise<RelationshipAssistantDraft> {
    return this.request<RelationshipAssistantDraft>(
      'POST',
      '/relationships/assistant/draft',
      body,
    );
  }

  async getRelationshipGraph(options?: {
    limit?: number;
  }): Promise<RelationshipGraph> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined)
      params.set('limit', String(options.limit));
    const query = params.toString();
    return this.request<RelationshipGraph>(
      'GET',
      `/relationships/graph${query ? `?${query}` : ''}`,
    );
  }

  async getRelationshipReviewItems(options?: {
    status?: RelationshipReviewStatus | 'all';
    limit?: number;
    personId?: string;
  }): Promise<RelationshipReviewItemListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit !== undefined)
      params.set('limit', String(options.limit));
    if (options?.personId) params.set('personId', options.personId);
    const query = params.toString();
    return this.request<RelationshipReviewItemListResponse>(
      'GET',
      `/relationships/review-items${query ? `?${query}` : ''}`,
    );
  }

  async updateRelationshipReviewItem(
    id: string,
    action: RelationshipReviewAction,
    body?: {
      editedValue?: string;
      userNote?: string;
      snoozeUntil?: number;
    },
  ): Promise<RelationshipReviewItem> {
    return this.request<RelationshipReviewItem>(
      'POST',
      `/relationships/review-items/${encodeURIComponent(id)}/${action}`,
      body ?? {},
    );
  }

  // --------------------------------------------------------------------------
  // Watched Projects
  // --------------------------------------------------------------------------

  /**
   * List all watched projects.
   */
  async getWatchedProjects(activeOnly?: boolean): Promise<WatchedProject[]> {
    const params = new URLSearchParams();
    if (activeOnly === false) params.set('active_only', 'false');

    const qs = params.toString();
    const path = `/projects/watched${qs ? '?' + qs : ''}`;
    return this.request<WatchedProject[]>('GET', path);
  }

  async getFocusProjects(): Promise<{
    projects: any[];
    contexts?: { row?: string; paragraph?: string; seeds?: any[] };
  }> {
    return this.request('GET', '/projects/focus');
  }

  async syncFocusProjects(snapshot: {
    teamId: string;
    teamName?: string;
    items: Array<Record<string, unknown>>;
    syncedAt: number;
  }): Promise<{
    upserted: number;
    archived: number;
    skipped: boolean;
    projects: any[];
  }> {
    return this.request('POST', '/projects/watched/sync', snapshot);
  }

  async archiveFocusTeam(teamId: string): Promise<{ archived: number }> {
    return this.request('POST', '/projects/watched/archive-team', { teamId });
  }

  async getMemoryProjectCandidates(): Promise<{ candidates: any[] }> {
    return this.request('GET', '/projects/memory-candidates');
  }

  async getProjectDriftReceipts(projectId?: string): Promise<{ items: any[] }> {
    const qs = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : '';
    return this.request('GET', `/projects/drift-receipts${qs}`);
  }

  async resolveProjectDriftReceipt(body: {
    id?: string;
    status?: 'accepted' | 'ignored' | 'converged';
    barTargetEnd?: string;
    projectId?: string;
  }): Promise<any> {
    return this.request('POST', '/projects/drift-receipts/resolve', body);
  }

  /**
   * Create a new watched project.
   */
  async addWatchedProject(
    project: CreateWatchedProjectPayload,
  ): Promise<WatchedProject> {
    return this.request<WatchedProject>('POST', '/projects/watched', project);
  }

  /**
   * Get a single watched project by ID.
   */
  async getWatchedProject(id: string): Promise<WatchedProject> {
    return this.request<WatchedProject>(
      'GET',
      `/projects/watched/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Update a watched project (partial update).
   */
  async updateWatchedProject(
    id: string,
    updates: Partial<
      Pick<WatchedProject, 'name' | 'description' | 'aliases' | 'priority'>
    > & {
      autoCaptureRules?: object;
      trackedProperties?: string[];
    },
  ): Promise<WatchedProject> {
    return this.request<WatchedProject>(
      'PUT',
      `/projects/watched/${encodeURIComponent(id)}`,
      updates,
    );
  }

  /**
   * Soft-delete a watched project (sets is_active = false).
   */
  async deleteWatchedProject(
    id: string,
  ): Promise<{ id: string; deleted: boolean }> {
    return this.request(
      'DELETE',
      `/projects/watched/${encodeURIComponent(id)}`,
    );
  }

  // --------------------------------------------------------------------------
  // Notifications
  // --------------------------------------------------------------------------

  /**
   * List notifications with optional filters.
   */
  async getNotifications(
    state?: 'pending' | 'scheduled' | 'clicked' | 'dismissed',
    type?: string,
    limit?: number,
    offset?: number,
  ): Promise<NotificationRecord[]> {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (type) params.set('type', type);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));

    const qs = params.toString();
    const path = `/notifications${qs ? '?' + qs : ''}`;
    return this.request<NotificationRecord[]>('GET', path);
  }

  async getNotificationCenterFeed(
    channel: 'chrome' | 'doubao' | 'glip',
    lanes: Array<'todo' | 'notice'> = ['todo', 'notice'],
    limit?: number,
    deliveryMode?: NotificationCenterFeedDeliveryMode,
  ): Promise<NotificationCenterFeedResponse> {
    const params = new URLSearchParams();
    params.set('channel', channel);
    if (lanes.length > 0) {
      params.set('lanes', lanes.join(','));
    }
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    if (deliveryMode) {
      params.set('deliveryMode', deliveryMode);
    }
    return this.request<NotificationCenterFeedResponse>(
      'GET',
      `/notification-center/feed?${params.toString()}`,
    );
  }

  async reportNotificationCenterDelivery(
    events: Array<{
      sourceRef: string;
      channel: 'chrome' | 'doubao' | 'glip';
      lane: 'todo' | 'notice';
      status: 'delivered' | 'failed' | 'clicked' | 'dismissed';
      externalRef?: string;
      error?: string;
    }>,
  ): Promise<{
    ok: boolean;
    updated: number;
    items: NotificationCenterDeliveryRecord[];
  }> {
    return this.request<{
      ok: boolean;
      updated: number;
      items: NotificationCenterDeliveryRecord[];
    }>('POST', '/notification-center/delivery', { events });
  }

  /**
   * Acknowledge a notification (mark as clicked).
   */
  async acknowledgeNotification(
    id: string,
    detail?: string,
  ): Promise<NotificationRecord> {
    return this.request<NotificationRecord>(
      'POST',
      `/notifications/${encodeURIComponent(id)}/action`,
      { action: 'acknowledge', detail },
    );
  }

  /**
   * Dismiss a notification.
   */
  async dismissNotification(
    id: string,
    detail?: string,
  ): Promise<NotificationRecord> {
    return this.request<NotificationRecord>(
      'POST',
      `/notifications/${encodeURIComponent(id)}/action`,
      { action: 'dismiss', detail },
    );
  }

  /**
   * Snooze a notification with an optional caller-selected delay.
   */
  async snoozeNotification(
    id: string,
    delaySeconds?: number,
  ): Promise<{
    id: string;
    action: string;
    newNotificationId: string;
    scheduledAt: number;
    delaySeconds: number;
    actionReceipt?: {
      title: string;
      detail: string;
      boundary: string;
    };
  }> {
    return this.request(
      'POST',
      `/notifications/${encodeURIComponent(id)}/action`,
      {
        action: 'snooze',
        ...(typeof delaySeconds === 'number' ? { delaySeconds } : {}),
      },
    );
  }

  /**
   * Get notification statistics.
   */
  async getNotificationStats(): Promise<{
    pending: number;
    clicked: number;
    dismissed: number;
    scheduled: number;
    dailyCounts: Array<{ date: string; count: number }>;
  }> {
    return this.request('GET', '/notifications/stats');
  }

  // --------------------------------------------------------------------------
  // Confirm Requests
  // --------------------------------------------------------------------------

  /**
   * List confirm requests, filtered by state.
   */
  async getConfirmRequests(
    state?: string,
    limit?: number,
    queue?: 'decision' | 'watch' | 'all',
  ): Promise<ConfirmRequestListResponse> {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (limit !== undefined) params.set('limit', String(limit));
    if (queue) params.set('queue', queue);

    const qs = params.toString();
    const path = `/confirm-requests${qs ? '?' + qs : ''}`;
    return this.request<ConfirmRequestListResponse>('GET', path);
  }

  /**
   * Answer a pending confirm request.
   */
  async answerConfirmRequest(
    id: string,
    answer: string,
    detail?: string,
  ): Promise<ConfirmRequestAnswerResponse> {
    return this.request(
      'POST',
      `/confirm-requests/${encodeURIComponent(id)}/answer`,
      { answer, detail },
    );
  }

  async transitionConfirmRequestState(
    id: string,
    state: 'pending' | 'snoozed' | 'expired',
  ): Promise<ConfirmRequestStateTransitionResponse> {
    return this.request(
      'POST',
      `/confirm-requests/${encodeURIComponent(id)}/state`,
      { state },
    );
  }

  // --------------------------------------------------------------------------
  // Runtime Config
  // --------------------------------------------------------------------------

  async getRuntimeConfig(): Promise<RuntimeConfigResponse> {
    return this.request<RuntimeConfigResponse>('GET', '/config');
  }

  async updateRuntimeConfig(
    payload: UpdateRuntimeConfigPayload,
  ): Promise<RuntimeConfigResponse> {
    return this.request<RuntimeConfigResponse>('PUT', '/config', payload);
  }

  async probeAgentExecutor(
    executorId: string,
    options: { deep?: boolean; force?: boolean } = {},
  ): Promise<{
    ok: boolean;
    latencyMs: number;
    stage: 'dns' | 'connect' | 'auth' | 'ready';
    detail: string;
    nextAction?: string;
    cached?: boolean;
    checkedAt: number;
  }> {
    return this.request('POST', `/agent-executors/${encodeURIComponent(executorId)}/probe`, options);
  }

  async listAgentWorkers(): Promise<{
    workers: Array<{
      id: string;
      label: string;
      hostname?: string;
      hostKind: 'desktop' | 'headless';
      status: string;
      lastHeartbeatAt?: number;
      currentTaskCount: number;
    }>;
  }> {
    return this.request('GET', '/agent-workers');
  }

  async createAgentWorkerPairingToken(): Promise<{
    token: string;
    expiresAt: number;
    serverUrl: string;
    installCommand: string;
  }> {
    return this.request('POST', '/agent-workers/pairing-tokens', {});
  }

  async revokeAgentWorker(workerId: string): Promise<{ ok: boolean }> {
    return this.request('DELETE', `/agent-workers/${encodeURIComponent(workerId)}`);
  }

  // --------------------------------------------------------------------------
  // Provider Integrations
  // --------------------------------------------------------------------------

  async getProviderCapabilities(
    provider: string,
  ): Promise<ProviderCapabilities> {
    return this.request<ProviderCapabilities>(
      'GET',
      `/providers/${encodeURIComponent(provider)}/capabilities`,
    );
  }

  async getProviderBindings(
    provider: string,
    bindingType?: string,
  ): Promise<{ items: ProviderBindingRecord[]; total: number }> {
    const params = new URLSearchParams();
    if (bindingType) params.set('bindingType', bindingType);

    const qs = params.toString();
    return this.request<{ items: ProviderBindingRecord[]; total: number }>(
      'GET',
      `/providers/${encodeURIComponent(provider)}/bindings${
        qs ? `?${qs}` : ''
      }`,
    );
  }

  async upsertProviderBinding(
    provider: string,
    bindingType: string,
    payload: UpsertProviderBindingPayload,
  ): Promise<{ binding: ProviderBindingRecord }> {
    return this.request<{ binding: ProviderBindingRecord }>(
      'PUT',
      `/providers/${encodeURIComponent(provider)}/bindings/${encodeURIComponent(
        bindingType,
      )}`,
      payload,
    );
  }

  async renderProviderContextPackage(
    payload: RenderProviderContextPackagePayload,
  ): Promise<ProviderContextPackageResponse> {
    return this.request<ProviderContextPackageResponse>(
      'POST',
      '/providers/context-packages/render',
      payload,
    );
  }

  async getProviderSyncJobs(
    provider: string,
    filters?: ProviderSyncJobFilters,
  ): Promise<ProviderSyncJobListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.bindingType) params.set('bindingType', filters.bindingType);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));

    const qs = params.toString();
    return this.request<ProviderSyncJobListResponse>(
      'GET',
      `/providers/${encodeURIComponent(provider)}/sync-jobs${
        qs ? `?${qs}` : ''
      }`,
    );
  }

  async getProviderSyncJob(
    provider: string,
    id: string,
  ): Promise<{ job: ProviderSyncJobRecord }> {
    return this.request<{ job: ProviderSyncJobRecord }>(
      'GET',
      `/providers/${encodeURIComponent(
        provider,
      )}/sync-jobs/${encodeURIComponent(id)}`,
    );
  }

  async reportProviderSyncJob(
    provider: string,
    id: string,
    payload: ReportProviderSyncJobPayload,
  ): Promise<{ job: ProviderSyncJobRecord }> {
    return this.request<{ job: ProviderSyncJobRecord }>(
      'POST',
      `/providers/${encodeURIComponent(
        provider,
      )}/sync-jobs/${encodeURIComponent(id)}/report`,
      payload,
    );
  }

  // --------------------------------------------------------------------------
  // Reflection Threads
  // --------------------------------------------------------------------------

  async getReflectionThreads(filters?: {
    status?: 'active' | 'paused' | 'closed' | 'all';
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<ReflectionThreadListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));
    if (filters?.search) params.set('search', filters.search);

    const qs = params.toString();
    return this.request<ReflectionThreadListResponse>(
      'GET',
      `/reflection-threads${qs ? '?' + qs : ''}`,
    );
  }

  async getReflectionThread(
    id: string,
  ): Promise<ReflectionThreadDetailResponse> {
    return this.request<ReflectionThreadDetailResponse>(
      'GET',
      `/reflection-threads/${encodeURIComponent(id)}`,
    );
  }

  async revisitReflectionThread(
    id: string,
    force = true,
  ): Promise<{
    thread: ReflectionThread;
    run: ReflectionRun;
    actions: RuntimeAction[];
  }> {
    return this.request(
      'POST',
      `/reflection-threads/${encodeURIComponent(id)}/revisit`,
      { force },
    );
  }

  async pauseReflectionThread(
    id: string,
    reason?: string,
  ): Promise<{ thread: ReflectionThread }> {
    return this.request(
      'POST',
      `/reflection-threads/${encodeURIComponent(id)}/pause`,
      { reason },
    );
  }

  async closeReflectionThread(
    id: string,
    reason?: string,
  ): Promise<{ thread: ReflectionThread }> {
    return this.request(
      'POST',
      `/reflection-threads/${encodeURIComponent(id)}/close`,
      { reason },
    );
  }

  async resumeReflectionThread(
    id: string,
  ): Promise<{ thread: ReflectionThread }> {
    return this.request(
      'POST',
      `/reflection-threads/${encodeURIComponent(id)}/resume`,
    );
  }

  // --------------------------------------------------------------------------
  // Action Runtime
  // --------------------------------------------------------------------------

  async getActions(filters?: {
    actionId?: string;
    queueStatus?:
      | 'queued'
      | 'running'
      | 'succeeded'
      | 'failed'
      | 'cancelled'
      | 'dead_letter'
      | 'all';
    executionMode?: 'manual' | 'auto';
    threadId?: string;
    actionType?: string;
    sourceKind?: string;
    sourceRefId?: string;
    limit?: number;
    offset?: number;
  }): Promise<RuntimeActionListResponse> {
    const params = new URLSearchParams();
    if (filters?.actionId) params.set('actionId', filters.actionId);
    if (filters?.queueStatus) params.set('queueStatus', filters.queueStatus);
    if (filters?.executionMode)
      params.set('executionMode', filters.executionMode);
    if (filters?.threadId) params.set('threadId', filters.threadId);
    if (filters?.actionType) params.set('actionType', filters.actionType);
    if (filters?.sourceKind) params.set('sourceKind', filters.sourceKind);
    if (filters?.sourceRefId) params.set('sourceRefId', filters.sourceRefId);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));

    const qs = params.toString();
    return this.request<RuntimeActionListResponse>(
      'GET',
      `/actions${qs ? '?' + qs : ''}`,
    );
  }

  async retryAction(id: string): Promise<{ action: RuntimeAction }> {
    return this.request('POST', `/actions/${encodeURIComponent(id)}/retry`);
  }

  async cancelAction(
    id: string,
    reason?: string,
  ): Promise<{ action: RuntimeAction }> {
    return this.request('POST', `/actions/${encodeURIComponent(id)}/cancel`, {
      reason,
    });
  }

  async executeAction(
    id: string,
    options?: { approve?: boolean },
  ): Promise<{
    actionId: string;
    actionType: string;
    queueStatus: string;
    result?: Record<string, any>;
    error?: string;
    readinessReceipt?: ActionReadinessReceipt;
  }> {
    return this.request(
      'POST',
      `/actions/${encodeURIComponent(id)}/execute`,
      options,
    );
  }

  async probeActionReadiness(id: string): Promise<{
    decision: ActionReadinessDecision;
    receipt: ActionReadinessReceipt;
    probeReceipt: {
      probeOnly: true;
      originalActionExecuted: false;
      checkedAt: number;
      status: ActionReadinessStatus;
      summary: string;
      boundary: string;
    };
  }> {
    return this.request(
      'POST',
      `/actions/${encodeURIComponent(id)}/readiness/probe`,
    );
  }

  async planMessageRuleAutomation(
    body: MessageRuleAutomationPlanRequest,
  ): Promise<MessageRuleAutomationPlanResponse> {
    return this.request('POST', '/message-rules/plan', body);
  }

  async previewMessageRuleAutomation(
    body: MessageRuleAutomationPlanRequest,
  ): Promise<MessageRuleAutomationPreviewResponse> {
    return this.request('POST', '/message-rules/preview', body);
  }

  // --------------------------------------------------------------------------
  // Outreach Sessions
  // --------------------------------------------------------------------------

  async getOutreachSummary(): Promise<OutreachSummary> {
    return this.request<OutreachSummary>('GET', '/outreach/summary');
  }

  async getOutreachTemplateRuntimeStatus(
    ids?: string[],
    limit = 100,
  ): Promise<OutreachTemplateRuntimeStatusResponse> {
    const params = new URLSearchParams();
    if (ids && ids.length > 0) params.set('ids', ids.join(','));
    params.set('limit', String(limit));
    const qs = params.toString();
    return this.request<OutreachTemplateRuntimeStatusResponse>(
      'GET',
      `/outreach/templates/runtime-status${qs ? '?' + qs : ''}`,
    );
  }

  async getAgentTaskRuntimeStatus(
    ids?: string[],
    limit = 100,
  ): Promise<AgentTaskRuntimeStatusResponse> {
    const params = new URLSearchParams();
    if (ids && ids.length > 0) params.set('ids', ids.join(','));
    params.set('limit', String(limit));
    const qs = params.toString();
    return this.request<AgentTaskRuntimeStatusResponse>(
      'GET',
      `/agent-tasks/runtime-status${qs ? '?' + qs : ''}`,
    );
  }

  async executeAgentTask(body: {
    taskId: string;
    title?: string;
    task: string;
    mode?: 'read' | 'write';
    executor?: string;
    notify?: boolean;
    idempotencyKey?: string;
    triggerSource?: string;
    timeoutMs?: number;
  }): Promise<{
    accepted?: boolean;
    reused?: boolean;
    taskId?: string;
    runId?: string;
    actionId?: string;
    queueStatus?: string;
    statusUrl?: string;
    result?: {
      status?: string;
      summary?: string;
      artifacts?: Array<{ kind?: string; title?: string; content?: string }>;
    };
    error?: string;
  }> {
    return this.request('POST', '/agent-tasks/execute', body);
  }

  async upsertOutreachTemplate(body: {
    id?: string;
    sourceKind: string;
    sourceRefId?: string;
    sheetMessageId?: string;
    title: string;
    questionTemplate: string;
    contextTemplate?: string;
    informationGoalTemplate?: string;
    targetType: string;
    targetRef: string;
    scheduleSpec?: Record<string, any>;
    enabled?: boolean;
    approvalPolicy?: string;
    maxFollowup?: number;
    followupIntervalSeconds?: number;
    syncState?: string;
    lastSyncError?: string;
  }): Promise<{ template: Record<string, any> }> {
    return this.request('POST', '/outreach/templates/upsert', body);
  }

  async cancelOutreachTemplate(
    id: string,
  ): Promise<{ template: Record<string, any> }> {
    return this.request(
      'POST',
      `/outreach/templates/${encodeURIComponent(id)}/cancel`,
    );
  }

  async pauseOutreachTemplate(
    id: string,
  ): Promise<{ template: Record<string, any> }> {
    return this.request(
      'POST',
      `/outreach/templates/${encodeURIComponent(id)}/pause`,
    );
  }

  async getOutreachSessions(filters?: {
    status?: OutreachSessionStatus | 'all';
    statuses?: OutreachSessionStatus[];
    originKind?: string;
    templateId?: string;
    threadId?: string;
    limit?: number;
    offset?: number;
  }): Promise<OutreachSessionListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.statuses && filters.statuses.length > 0) {
      params.set('statuses', filters.statuses.join(','));
    }
    if (filters?.originKind) params.set('originKind', filters.originKind);
    if (filters?.templateId) params.set('templateId', filters.templateId);
    if (filters?.threadId) params.set('threadId', filters.threadId);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));

    const qs = params.toString();
    return this.request<OutreachSessionListResponse>(
      'GET',
      `/outreach/sessions${qs ? '?' + qs : ''}`,
    );
  }

  async createOutreachSessionFromMessage(
    body: CreateOutreachSessionFromMessageRequest,
  ): Promise<CreateOutreachSessionFromMessageResponse> {
    return this.request('POST', '/outreach/sessions/from-message', body);
  }

  async getGlipMessageMarkers(
    limit = 500,
  ): Promise<GlipMessageMarkersSnapshot> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    return this.request<GlipMessageMarkersSnapshot>(
      'GET',
      `/glip-message-markers?${params.toString()}`,
    );
  }

  async getOutreachSession(id: string): Promise<OutreachSession> {
    const response = await this.request<any>(
      'GET',
      `/outreach/sessions/${encodeURIComponent(id)}`,
    );
    if (response && typeof response === 'object' && response.session) {
      return {
        ...(response.session as OutreachSession),
        events: Array.isArray(response.events) ? response.events : [],
        actions: Array.isArray(response.actions) ? response.actions : [],
        evidence: Array.isArray(response.evidence) ? response.evidence : [],
      };
    }
    return response as OutreachSession;
  }

  async searchOutreachTargets(
    targetType: string,
    query: string,
    limit = 8,
  ): Promise<{
    items: OutreachTargetCandidate[];
    total: number;
    directoryStatus?: OutreachDirectoryStatus[];
  }> {
    const params = new URLSearchParams();
    params.set('targetType', targetType);
    params.set('query', query);
    params.set('limit', String(limit));
    return this.request('GET', `/outreach/targets/search?${params.toString()}`);
  }

  async getOutreachDirectoryStatus(): Promise<{
    items: OutreachDirectoryStatus[];
  }> {
    return this.request('GET', '/outreach/directory/status');
  }

  async syncOutreachDirectory(
    force = false,
  ): Promise<{ items: OutreachDirectoryStatus[] }> {
    const params = new URLSearchParams();
    if (force) {
      params.set('force', 'true');
    }
    return this.request(
      'POST',
      `/outreach/directory/sync${
        params.toString() ? `?${params.toString()}` : ''
      }`,
    );
  }

  async approveOutreachSession(
    id: string,
  ): Promise<{ session: OutreachSession }> {
    return this.request(
      'POST',
      `/outreach/sessions/${encodeURIComponent(id)}/approve`,
    );
  }

  async cancelOutreachSession(
    id: string,
    reason?: string,
  ): Promise<{ session: OutreachSession }> {
    return this.request(
      'POST',
      `/outreach/sessions/${encodeURIComponent(id)}/cancel`,
      { reason },
    );
  }

  async updateOutreachSessionDraft(
    id: string,
    body: {
      targetType?: string;
      targetRef?: string;
      targetResolutionStatus?: 'unresolved' | 'ambiguous' | 'resolved';
      targetResolvedType?: string;
      targetResolvedId?: string;
      targetResolvedLabel?: string;
      targetResolvedChatId?: string;
      targetCandidates?: OutreachTargetCandidate[];
      renderedQuestion?: string;
      renderedContext?: string;
      nextCheckAt?: number | null;
    },
  ): Promise<{ session: OutreachSession }> {
    return this.request(
      'POST',
      `/outreach/sessions/${encodeURIComponent(id)}/update-draft`,
      body,
    );
  }

  async retryOutreachSession(
    id: string,
  ): Promise<{ session: OutreachSession }> {
    return this.request(
      'POST',
      `/outreach/sessions/${encodeURIComponent(id)}/retry`,
    );
  }

  async continueOutreachFollowup(
    id: string,
    body: {
      maxFollowup?: number;
      followupIntervalSeconds?: number;
    } = {},
  ): Promise<{ session: OutreachSession }> {
    return this.request(
      'POST',
      `/outreach/sessions/${encodeURIComponent(id)}/continue-followup`,
      body,
    );
  }

  // --------------------------------------------------------------------------
  // Profile Items (Human Model)
  // --------------------------------------------------------------------------

  /**
   * List profile items with optional filters.
   */
  async getProfileItems(filters?: {
    type?: string;
    status?: string;
    key?: string;
    confirmedOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.key) params.set('key', filters.key);
    if (filters?.confirmedOnly !== undefined)
      params.set('confirmed_only', String(filters.confirmedOnly));
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));

    const qs = params.toString();
    const path = `/profile/items${qs ? '?' + qs : ''}`;
    return this.request<{ items: any[]; total: number }>('GET', path);
  }

  /**
   * Create a new profile item.
   */
  async createProfileItem(body: {
    itemType: string;
    itemKey: string;
    itemValue: string;
    evidenceRefs?: unknown[];
    confidence?: number;
  }): Promise<any> {
    return this.request('POST', '/profile/items', body);
  }

  /**
   * Create or reinforce an automatically inferred profile candidate.
   * Inferred items stay pending until the user confirms them.
   */
  async createInferredProfileItem(body: {
    itemType: string;
    itemKey: string;
    itemValue: string;
    evidenceRefs?: unknown[];
    confidence?: number;
  }): Promise<any> {
    return this.request('POST', '/profile/items/inferred', body);
  }

  /**
   * Update an existing profile item.
   */
  async updateProfileItem(
    id: string,
    body: {
      itemValue?: string;
      evidenceRefs?: unknown[];
      confidence?: number;
      salienceScore?: number;
      status?: string;
    },
  ): Promise<any> {
    return this.request(
      'PUT',
      `/profile/items/${encodeURIComponent(id)}`,
      body,
    );
  }

  /**
   * Delete a profile item.
   */
  async deleteProfileItem(
    id: string,
  ): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/profile/items/${encodeURIComponent(id)}`);
  }

  /**
   * Restore a soft-deleted profile item.
   */
  async restoreProfileItem(id: string): Promise<any> {
    return this.request(
      'POST',
      `/profile/items/${encodeURIComponent(id)}/restore`,
    );
  }

  /**
   * Confirm a profile item (mark as user-verified).
   */
  async confirmProfileItem(id: string): Promise<any> {
    return this.request(
      'POST',
      `/profile/items/${encodeURIComponent(id)}/confirm`,
    );
  }

  /**
   * Get the user's core profile summary.
   */
  async getUserCore(): Promise<{ content: string }> {
    return this.request<{ content: string }>('GET', '/profile/core');
  }

  // --------------------------------------------------------------------------
  // Social Edges
  // --------------------------------------------------------------------------

  /**
   * List social edges with optional pagination.
   */
  async getSocialEdges(
    limit?: number,
    offset?: number,
  ): Promise<{ items: any[]; total: number }> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));

    const qs = params.toString();
    const path = `/profile/social${qs ? '?' + qs : ''}`;
    return this.request<{ items: any[]; total: number }>('GET', path);
  }

  /**
   * Create a new social edge between two entities.
   */
  async createSocialEdge(body: {
    fromEntityId: string;
    toEntityId: string;
    relationType: string;
    strength?: number;
  }): Promise<any> {
    return this.request('POST', '/profile/social', body);
  }

  // --------------------------------------------------------------------------
  // Opinions
  // --------------------------------------------------------------------------

  /**
   * List opinions with optional filters.
   */
  async getOpinions(filters?: {
    status?: string;
    dimension?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.dimension) params.set('dimension', filters.dimension);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));

    const qs = params.toString();
    const path = `/profile/opinions${qs ? '?' + qs : ''}`;
    return this.request<{ items: any[]; total: number }>('GET', path);
  }

  /**
   * Confirm or reject an opinion.
   */
  async confirmOpinion(id: string, action: 'accept' | 'reject'): Promise<any> {
    return this.request(
      'POST',
      `/profile/opinions/${encodeURIComponent(id)}/confirm`,
      { action },
    );
  }

  // --------------------------------------------------------------------------
  // Agent Profile (Agent Model)
  // --------------------------------------------------------------------------

  /**
   * Get an agent profile document by kind (identity, soul, or policy).
   */
  async getAgentProfile(
    kind: 'identity' | 'soul' | 'policy',
  ): Promise<{ kind: string; content: string; updatedAt: number }> {
    return this.request<{ kind: string; content: string; updatedAt: number }>(
      'GET',
      `/agent/${encodeURIComponent(kind)}`,
    );
  }

  /**
   * Update an agent profile document.
   */
  async updateAgentProfile(
    kind: string,
    content: string,
    rationale?: string,
  ): Promise<{ id: string; kind: string }> {
    return this.request<{ id: string; kind: string }>(
      'PUT',
      `/agent/${encodeURIComponent(kind)}`,
      { content, rationale },
    );
  }

  /**
   * Get the version history for an agent profile document.
   */
  async getAgentHistory(
    kind: string,
    limit?: number,
  ): Promise<{ kind: string; versions: any[] }> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));

    const qs = params.toString();
    const path = `/agent/${encodeURIComponent(kind)}/history${
      qs ? '?' + qs : ''
    }`;
    return this.request<{ kind: string; versions: any[] }>('GET', path);
  }

  // --------------------------------------------------------------------------
  // Export & Stats
  // --------------------------------------------------------------------------

  /**
   * Export memory data as a manifest of markdown files.
   */
  async exportMemory(): Promise<MemoryBackupDownloadResponse> {
    return this.requestBlob('POST', '/export', {
      format: 'backup_zip',
    });
  }

  async importMemory(
    file: Blob | File,
    mode: 'merge' | 'replace' = 'merge',
    options: { confirmUserMismatch?: boolean } = {},
  ): Promise<MemoryBackupImportResponse> {
    const formData = new FormData();
    const fileName =
      typeof File !== 'undefined' && file instanceof File
        ? file.name
        : 'personal-ai-memory-backup.zip';

    formData.append('file', file, fileName);
    formData.append('mode', mode);
    if (options.confirmUserMismatch) {
      formData.append('confirmUserMismatch', 'true');
    }

    return this.requestForm<MemoryBackupImportResponse>(
      'POST',
      '/import',
      formData,
    );
  }

  async previewImportMemory(
    file: Blob | File,
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<MemoryBackupImportPreviewResponse> {
    const formData = new FormData();
    const fileName =
      typeof File !== 'undefined' && file instanceof File
        ? file.name
        : 'personal-ai-memory-backup.zip';

    formData.append('file', file, fileName);
    formData.append('mode', mode);
    formData.append('dryRun', 'true');

    return this.requestForm<MemoryBackupImportPreviewResponse>(
      'POST',
      '/import',
      formData,
    );
  }

  async inspectSmartMemoryImportText(
    text: string,
    options?: { scope?: 'work' | 'personal' },
  ): Promise<SmartMemoryImportInspectResponse> {
    return this.request<SmartMemoryImportInspectResponse>(
      'POST',
      '/import/inspect',
      {
        text,
        scope: options?.scope,
      },
    );
  }

  async inspectSmartMemoryImportFile(
    file: Blob | File,
    options?: { scope?: 'work' | 'personal' },
  ): Promise<SmartMemoryImportInspectResponse> {
    const formData = new FormData();
    formData.append(
      'file',
      file,
      getUploadFileName(file, 'memory-import-source'),
    );
    if (options?.scope) {
      formData.append('scope', options.scope);
    }

    return this.requestForm<SmartMemoryImportInspectResponse>(
      'POST',
      '/import/inspect',
      formData,
    );
  }

  async commitSmartMemoryImportText(
    text: string,
    options?: { scope?: 'work' | 'personal'; confirmHighRisk?: boolean },
  ): Promise<SmartMemoryImportCommitResponse> {
    return this.request<SmartMemoryImportCommitResponse>(
      'POST',
      '/import/commit',
      {
        text,
        scope: options?.scope,
        confirmHighRisk: options?.confirmHighRisk,
      },
    );
  }

  async commitSmartMemoryImportFile(
    file: Blob | File,
    options?: { scope?: 'work' | 'personal'; confirmHighRisk?: boolean },
  ): Promise<SmartMemoryImportCommitResponse> {
    const formData = new FormData();
    formData.append(
      'file',
      file,
      getUploadFileName(file, 'memory-import-source'),
    );
    if (options?.scope) {
      formData.append('scope', options.scope);
    }
    if (options?.confirmHighRisk !== undefined) {
      formData.append('confirmHighRisk', String(options.confirmHighRisk));
    }

    return this.requestForm<SmartMemoryImportCommitResponse>(
      'POST',
      '/import/commit',
      formData,
    );
  }

  /**
   * Get aggregate statistics for the memory service.
   */
  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('GET', '/stats');
  }

  async getMemoryCoverageMap(): Promise<MemoryCoverageMapResponse> {
    return this.request<MemoryCoverageMapResponse>('GET', '/coverage/map');
  }

  async getMemoryCoverageMessagesBySource(): Promise<MemoryCoverageMessagesBySourceResponse> {
    return this.request<MemoryCoverageMessagesBySourceResponse>(
      'GET',
      '/coverage/messages-by-source',
    );
  }

  async getMemoryCoveragePressure(): Promise<MemoryCoveragePressureResponse> {
    return this.request<MemoryCoveragePressureResponse>('GET', '/coverage/pressure');
  }

  async getMemoryCoverageProviderJobsRecent(): Promise<MemoryCoverageProviderJobsRecentResponse> {
    return this.request<MemoryCoverageProviderJobsRecentResponse>(
      'GET',
      '/coverage/provider-jobs/recent',
    );
  }

  async getMemoryCoverageSkillsSync(): Promise<MemoryCoverageSkillsSyncResponse> {
    return this.request<MemoryCoverageSkillsSyncResponse>(
      'GET',
      '/coverage/skills-sync',
    );
  }

  async getMemoryCoverageDiagnosticSlices(): Promise<MemoryCoverageDiagnosticSliceResponse[]> {
    return Promise.all([
      this.getMemoryCoverageMessagesBySource(),
      this.getMemoryCoveragePressure(),
      this.getMemoryCoverageProviderJobsRecent(),
      this.getMemoryCoverageSkillsSync(),
    ]);
  }

  async scoreSourceMemoryCandidate(
    payload: SourceMemoryCandidateRequest,
  ): Promise<SourceMemoryCandidateResponse> {
    return this.request<SourceMemoryCandidateResponse>(
      'POST',
      '/source-memory/candidates/score',
      payload,
    );
  }

  async analyzeSourceMemoryWebpage(
    payload: SourceMemoryWebpageAnalysisRequest,
  ): Promise<SourceMemoryWebpageAnalysisResponse> {
    return this.request<SourceMemoryWebpageAnalysisResponse>(
      'POST',
      '/source-memory/webpage-analysis',
      payload,
    );
  }

  async scoreSourceMemorySelection(
    payload: SourceMemoryCandidateRequest,
  ): Promise<SourceMemoryCandidateResponse> {
    return this.request<SourceMemoryCandidateResponse>(
      'POST',
      '/source-memory/candidates/selection',
      payload,
    );
  }

  async createSourceMemoryCapsule(
    payload: SourceMemoryCreateRequest,
  ): Promise<SourceMemoryCapsuleResponse> {
    return this.request<SourceMemoryCapsuleResponse>(
      'POST',
      '/source-memory/capsules',
      payload,
    );
  }

  async getSourceMemoryCapsule(
    id: string,
  ): Promise<SourceMemoryCapsuleResponse> {
    return this.request<SourceMemoryCapsuleResponse>(
      'GET',
      `/source-memory/capsules/${encodeURIComponent(id)}`,
    );
  }

  async updateSourceMemoryCapsuleNote(
    id: string,
    note: string,
  ): Promise<SourceMemoryCapsuleResponse> {
    return this.request<SourceMemoryCapsuleResponse>(
      'POST',
      `/source-memory/capsules/${encodeURIComponent(id)}/note`,
      { note },
    );
  }

  async dismissSourceMemoryCapsule(
    id: string,
    reason?: string,
  ): Promise<SourceMemoryCapsuleResponse> {
    return this.request<SourceMemoryCapsuleResponse>(
      'POST',
      `/source-memory/capsules/${encodeURIComponent(id)}/dismiss`,
      { reason },
    );
  }

  // --------------------------------------------------------------------------
  // Memory Day Pilot
  // --------------------------------------------------------------------------

  async getDayPilotToday(params?: {
    date?: string;
    timezone?: string;
    autoGenerate?: boolean;
  }): Promise<DayPilotTodayResponse> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.timezone) query.set('timezone', params.timezone);
    if (params?.autoGenerate !== undefined) {
      query.set('autoGenerate', String(params.autoGenerate));
    }
    const qs = query.toString();
    return this.request<DayPilotTodayResponse>(
      'GET',
      `/day-pilot/today${qs ? `?${qs}` : ''}`,
    );
  }

  async getTodayPilotToday(params?: {
    date?: string;
    timezone?: string;
    autoGenerate?: boolean;
  }): Promise<DayPilotTodayResponse> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.timezone) query.set('timezone', params.timezone);
    if (params?.autoGenerate !== undefined) {
      query.set('autoGenerate', String(params.autoGenerate));
    }
    const qs = query.toString();
    return this.request<DayPilotTodayResponse>(
      'GET',
      `/today-pilot/today${qs ? `?${qs}` : ''}`,
    );
  }

  async getTodayPilotCatchUp(params?: {
    sinceTs?: number;
    awayMinutes?: number;
  }): Promise<DayPilotCatchUpBrief> {
    const query = new URLSearchParams();
    if (typeof params?.sinceTs === 'number') {
      query.set('sinceTs', String(params.sinceTs));
    } else if (typeof params?.awayMinutes === 'number') {
      query.set('awayMinutes', String(params.awayMinutes));
    }
    const qs = query.toString();
    return this.request<DayPilotCatchUpBrief>(
      'GET',
      `/today-pilot/catch-up${qs ? `?${qs}` : ''}`,
    );
  }

  async refreshDayPilot(payload?: {
    date?: string;
    timezone?: string;
    mode?: 'light' | 'full';
  }): Promise<DayPilotTodayResponse> {
    return this.request<DayPilotTodayResponse>(
      'POST',
      '/day-pilot/refresh',
      payload ?? {},
    );
  }

  async refreshTodayPilot(payload?: {
    date?: string;
    timezone?: string;
    mode?: 'light' | 'full';
  }): Promise<DayPilotTodayResponse> {
    return this.request<DayPilotTodayResponse>(
      'POST',
      '/today-pilot/refresh',
      payload ?? {},
    );
  }

  async sendDayPilotCardFeedback(
    cardId: string,
    payload: DayPilotFeedbackPayload,
  ): Promise<DayPilotTodayResponse> {
    return this.sendTodayPilotCardFeedback(cardId, payload);
  }

  async sendTodayPilotCardFeedback(
    cardId: string,
    payload: DayPilotFeedbackPayload,
  ): Promise<DayPilotTodayResponse> {
    return this.request<DayPilotTodayResponse>(
      'POST',
      `/today-pilot/cards/${encodeURIComponent(cardId)}/feedback`,
      payload,
    );
  }

  async renderDayPilotContextPack(
    missionId: string,
    payload?: {
      tokenBudget?: number;
      targetProvider?: DayPilotProviderTarget;
      includeSensitive?: boolean;
    },
  ): Promise<DayPilotContextPackResponse> {
    return this.renderTodayPilotContextPack(missionId, payload);
  }

  async renderTodayPilotContextPack(
    missionId: string,
    payload?: {
      tokenBudget?: number;
      targetProvider?: DayPilotProviderTarget;
      includeSensitive?: boolean;
    },
  ): Promise<DayPilotContextPackResponse> {
    return this.request<DayPilotContextPackResponse>(
      'POST',
      `/today-pilot/missions/${encodeURIComponent(missionId)}/context-pack`,
      payload ?? {},
    );
  }

  async prepareTodayPilotMeetingPreps(payload?: {
    date?: string;
    timezone?: string;
    horizonHours?: number;
    maxMeetings?: number;
    mode?: 'nightly_llm' | 'on_demand_llm';
  }): Promise<TodayPilotMeetingPrepPrepareResponse> {
    return this.request<TodayPilotMeetingPrepPrepareResponse>(
      'POST',
      '/today-pilot/meeting-prep/prepare',
      payload ?? {},
    );
  }

  async resolveTodayPilotMeetingPrep(payload: {
    event?: CalendarEventSyncItem;
    timezone?: string;
    userGoal?: string;
    autoGenerate?: boolean;
    forceGenerate?: boolean;
    sourceTypes?: string[];
  }): Promise<TodayPilotMeetingPrepResolveResponse> {
    return this.request<TodayPilotMeetingPrepResolveResponse>(
      'POST',
      '/today-pilot/meeting-prep/resolve',
      payload,
    );
  }

  async createStorylineDraft(
    payload: StorylineDraftRequest,
  ): Promise<StorylineDraftResponse> {
    return this.request<StorylineDraftResponse>(
      'POST',
      '/storylines/draft',
      payload,
    );
  }

  // --------------------------------------------------------------------------
  // Personal Skill Library
  // --------------------------------------------------------------------------

  async getPersonalSkills(filters?: {
    filter?: 'active' | 'all' | 'dismissed';
    q?: string;
  }): Promise<PersonalSkillListResponse> {
    const params = new URLSearchParams();
    if (filters?.filter) params.set('filter', filters.filter);
    if (filters?.q) params.set('q', filters.q);
    const qs = params.toString();
    return this.request<PersonalSkillListResponse>(
      'GET',
      `/skills${qs ? `?${qs}` : ''}`,
    );
  }

  async getSkillSuggestions(filters?: {
    view?: SkillSuggestionView;
  }): Promise<PersonalSkillListResponse> {
    const params = new URLSearchParams();
    if (filters?.view) params.set('view', filters.view);
    const qs = params.toString();
    return this.request<PersonalSkillListResponse>(
      'GET',
      `/skills/suggestions${qs ? `?${qs}` : ''}`,
    );
  }

  async getPersonalSkill(id: string): Promise<PersonalSkillDetailResponse> {
    return this.request<PersonalSkillDetailResponse>(
      'GET',
      `/skills/${encodeURIComponent(id)}`,
    );
  }

  async useSkillSuggestion(
    id: string,
    options?: { reviewConfirmed?: boolean },
  ): Promise<PersonalSkillSuggestionUseResponse> {
    return this.request<PersonalSkillSuggestionUseResponse>(
      'POST',
      `/skills/suggestions/${encodeURIComponent(id)}/use`,
      options || {},
    );
  }

  async dismissSkillSuggestion(
    id: string,
    reason?: string,
  ): Promise<PersonalSkillDetailResponse> {
    return this.request<PersonalSkillDetailResponse>(
      'POST',
      `/skills/suggestions/${encodeURIComponent(id)}/dismiss`,
      { reason },
    );
  }

  async snoozeSkillSuggestion(
    id: string,
    days = 7,
  ): Promise<PersonalSkillDetailResponse> {
    return this.request<PersonalSkillDetailResponse>(
      'POST',
      `/skills/suggestions/${encodeURIComponent(id)}/snooze`,
      { days },
    );
  }

  async unsnoozeSkillSuggestion(
    id: string,
  ): Promise<PersonalSkillDetailResponse> {
    return this.request<PersonalSkillDetailResponse>(
      'POST',
      `/skills/suggestions/${encodeURIComponent(id)}/unsnooze`,
      {},
    );
  }

  async getSkillHealth(id: string): Promise<SkillHealthResponse> {
    return this.request<SkillHealthResponse>(
      'GET',
      `/skills/${encodeURIComponent(id)}/health`,
    );
  }

  async getSkillSyncSettings(): Promise<SkillSyncSettingsResponse> {
    return this.request<SkillSyncSettingsResponse>(
      'GET',
      '/skills/sync-settings',
    );
  }

  async updateSkillSyncSetting(
    platform: string,
    enabled: boolean,
  ): Promise<{ setting: SkillSyncSetting }> {
    return this.request<{ setting: SkillSyncSetting }>(
      'PUT',
      `/skills/sync-settings/${encodeURIComponent(platform)}`,
      { enabled },
    );
  }

  async probeSkillPlatform(platform: string): Promise<SkillProbeResponse> {
    return this.request<SkillProbeResponse>(
      'POST',
      `/skills/bindings/${encodeURIComponent(platform)}/probe`,
      {},
    );
  }

  async runSkillSync(options?: {
    platform?: string;
    limit?: number;
  }): Promise<SkillSyncRunResponse> {
    return this.request<SkillSyncRunResponse>(
      'POST',
      '/skills/sync/run',
      options || {},
    );
  }

  buildPublicSkillUrl(pathOrUrl?: string): string {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const publicBase = this.baseUrl.replace(/\/api\/v1\/?$/i, '');
    return `${publicBase}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }

  /**
   * Health check — returns service status, version, database stats, and embedding status.
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  // --------------------------------------------------------------------------
  // concernedItems sync
  // --------------------------------------------------------------------------

  async getConcernedItemsSnapshot(): Promise<ConcernedItemsSnapshotResponse> {
    return this.request<ConcernedItemsSnapshotResponse>(
      'GET',
      '/concerned-items',
    );
  }

  async putConcernedItemsSnapshot(
    payload: PutConcernedItemsSnapshotPayload,
  ): Promise<ConcernedItemsSnapshotResponse> {
    return this.request<ConcernedItemsSnapshotResponse>(
      'PUT',
      '/concerned-items',
      payload,
    );
  }

  async postFollowThreadHit(
    payload: FollowThreadHitEvent,
  ): Promise<{ status: 'created' | 'duplicate'; hit: FollowThreadHitEvent }> {
    return this.request('POST', '/follow-thread-hits', payload);
  }

  async getFollowThreadHits(filters?: {
    since?: string;
    followItemIds?: string[];
    limit?: number;
  }): Promise<FollowThreadHitListResponse> {
    const params = new URLSearchParams();
    if (filters?.since) params.set('since', filters.since);
    if (filters?.followItemIds && filters.followItemIds.length > 0) {
      params.set('followItemIds', filters.followItemIds.join(','));
    }
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));

    const qs = params.toString();
    return this.request<FollowThreadHitListResponse>(
      'GET',
      `/follow-thread-hits${qs ? '?' + qs : ''}`,
    );
  }

  // --------------------------------------------------------------------------
  // SSE Events
  // --------------------------------------------------------------------------

  /**
   * Subscribe to real-time server-sent events from the Memory Service.
   *
   * Listens for event types:
   *   - connected
   *   - notification
   *   - confirm_request
   *   - ingestion_complete
   *   - heartbeat_complete
   *   - consolidation_complete
   *   - provider_binding_updated
   *   - provider_context_package_rendered
   *   - provider_sync_job_updated
   *
   * Returns an unsubscribe function that closes the EventSource connection.
   */
  subscribeEvents(
    onEvent: (event: string, data: any) => void,
    onError?: (error: Event) => void,
  ): () => void {
    const eventTypes = [
      'connected',
      'notification',
      'confirm_request',
      'ingestion_complete',
      'heartbeat_complete',
      'consolidation_complete',
      'provider_binding_updated',
      'provider_context_package_rendered',
      'provider_sync_job_updated',
    ];

    let closed = false;
    let eventSource: EventSource | null = null;

    const openEventStream = async (): Promise<void> => {
      await this.ensureConfigLoaded();
      await this.ensureUserIdResolved();

      if (closed) {
        return;
      }

      const url = this.shouldSendUserIdentity()
        ? `${this.baseUrl}/events?userId=${encodeURIComponent(this.userId)}`
        : `${this.baseUrl}/events`;
      const source = new EventSource(url);

      if (closed) {
        source.close();
        return;
      }

      eventSource = source;

      for (const eventType of eventTypes) {
        source.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            onEvent(eventType, data);
          } catch {
            onEvent(eventType, event.data);
          }
        });
      }

      source.onerror = (event: Event) => {
        if (onError) {
          onError(event);
        }
      };
    };

    openEventStream().catch((error) => {
      if (!closed && onError) {
        onError(error as Event);
      }
    });

    // Return unsubscribe function
    return () => {
      closed = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }

  // --------------------------------------------------------------------------
  // User Files (dreams, reflections, reports)
  // --------------------------------------------------------------------------

  /**
   * List files in a user data subdirectory (dreams, reflections, reports).
   */
  async listUserFiles(subdir: string): Promise<string[]> {
    const result = await this.request<{ files: string[] }>(
      'GET',
      `/user-files/${encodeURIComponent(subdir)}`,
    );
    return result.files;
  }

  /**
   * Read a specific file from a user data subdirectory.
   */
  async readUserFile(subdir: string, filename: string): Promise<string | null> {
    try {
      const result = await this.request<{ filename: string; content: string }>(
        'GET',
        `/user-files/${encodeURIComponent(subdir)}/${encodeURIComponent(
          filename,
        )}`,
      );
      return result.content;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Usage Analytics (frontend telemetry)
  // --------------------------------------------------------------------------

  /**
   * Upload a batch of frontend usage/token events to the analytics ingest
   * endpoint. Reuses the shared `request()` wrapper, so the current user is
   * automatically attached via the `X-User-Id` header.
   *
   * @param batch Frontend usage events (see UsageTelemetryEvent shape).
   */
  async postUsageTelemetry(batch: UsageTelemetryEvent[]): Promise<void> {
    const FLUSH_BATCH_SIZE = 100;
    for (let i = 0; i < batch.length; i += FLUSH_BATCH_SIZE) {
      const chunk = batch.slice(i, i + FLUSH_BATCH_SIZE);
      await this.request('POST', '/usage/telemetry', { events: chunk });
    }
  }

  /**
   * Issue a signed personal usage dashboard link (scope=self).
   * Uses the client's X-User-Id. Returns a path relative to the API base
   * (e.g. `/usage/dashboard?token=...`).
   */
  async createUsageMyLink(opts?: { ttlDays?: number }): Promise<{
    token: string;
    path: string;
    scope: 'self' | 'all';
    userId: string;
    expiresAt: number;
  }> {
    return this.request('POST', '/usage/my-link', {
      scope: 'self',
      ttlDays: opts?.ttlDays,
    });
  }

  // --------------------------------------------------------------------------
  // Configuration helpers
  // --------------------------------------------------------------------------

  /**
   * Update the base URL at runtime (e.g. from a settings page).
   * Also persists the new value to chrome.storage.local if available.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Update the API key at runtime.
   * Config is persisted via envConfig when user saves options.
   */
  setApiKey(key: string | undefined): void {
    this.apiKey = key;
  }

  /**
   * Update request timeout at runtime.
   */
  setTimeout(timeoutMs: number): void {
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      this.timeout = timeoutMs;
    }
  }

  /**
   * Update the user ID at runtime for multi-user isolation.
   * Also persists the new value to chrome.storage.local if available.
   */
  setUserId(userId: string): void {
    const previous = this.userId;
    const normalized = userId.trim();
    if (normalized && USER_ID_PATTERN.test(normalized)) {
      this.userId = normalized;
      this.userIdentityExplicit = true;
    } else {
      this.userId = 'default';
      this.userIdentityExplicit = false;
    }
    if (this.userId !== previous) {
      this._deviceKeyPromise = null;
    }
  }

  /**
   * Get the current user ID (useful for diagnostics / settings UI).
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get the current base URL (useful for diagnostics / settings UI).
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ============================================================================
// Singleton accessor
// ============================================================================

let _client: MemoryServiceClient | null = null;

/**
 * Get (or lazily create) the global MemoryServiceClient singleton.
 *
 * Passing config overlays the existing singleton; it never replaces it, so a
 * page that passes `{ baseUrl }` cannot drop bootstrap / device-key loading.
 */
export function getMemoryServiceClient(
  config?: Partial<MemoryServiceConfig>,
): MemoryServiceClient {
  if (!_client) {
    _client = new MemoryServiceClient(config);
    return _client;
  }
  if (config) {
    if (config.baseUrl) _client.setBaseUrl(config.baseUrl);
    if (config.apiKey) _client.setApiKey(config.apiKey);
    if (config.timeout != null) _client.setTimeout(config.timeout);
    if (config.userId) _client.setUserId(config.userId);
  }
  return _client;
}
