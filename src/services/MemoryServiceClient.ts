/**
 * MemoryServiceClient — HTTP client for the Personal AI Memory Service.
 * Replaces direct ChromaDB/LocalStorage access with API calls to the backend.
 *
 * Designed to run inside the Chrome Extension service worker context,
 * using the standard fetch API and chrome.storage.local for configuration.
 */

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BASE_URL = 'http://localhost:3210/api/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const USER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export interface MemoryServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number; // ms, default 30000
  userId?: string; // multi-user isolation, default 'default'
}

// ============================================================================
// Ingest types
// ============================================================================

export interface IngestPayload {
  content: string;
  sourceType: 'glip' | 'jira' | 'web' | 'manual' | 'system' | 'meeting';
  sender?: string;
  groupId?: string;
  groupName?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface IngestResult {
  id: string;
  status: 'created' | 'duplicate' | 'error';
  entitiesExtracted?: number;
  matchedProjects?: string[];
}

export interface BatchIngestResult {
  results: IngestResult[];
  totalCreated: number;
  totalDuplicate: number;
  totalError: number;
}

// ============================================================================
// Recall & Ask types
// ============================================================================

export interface RecallOptions {
  topK?: number;
  channels?: ('vector' | 'fts' | 'graph' | 'time')[];
  timeRange?: { start?: number; end?: number };
  entityTypes?: string[];
  projectFilter?: string;
  minSalience?: number;
  includeMetadata?: boolean;
  senderFilter?: string[];
  groupFilter?: string[];
  minImportance?: number;
  sourceTypes?: string[];
  presentationHint?: 'default' | 'compact' | 'meeting_pilot';
  previewMaxLength?: number;
}

export interface RecallResult {
  items: RecallItem[];
  totalFound: number;
  queryTimeMs: number;
  channels: string[];
}

export interface RecallItem {
  id: string;
  type: 'message' | 'chunk' | 'entity';
  content: string;
  displayTitle?: string;
  displayText?: string;
  previewText?: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface MeetingRecord {
  meetingId: string;
  title: string;
  date: number;
  lastEventAt: number;
  participants: string[];
  pdfUrl?: string;
  digestId?: string;
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

export interface MeetingRecordListResponse {
  items: MeetingRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface AskResponse {
  answer: string;
  evidence?: RecallItem[];
  queryTimeMs: number;
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
  structuredAnswer?: {
    timeline?: Array<{ date: string; event: string }>;
    keyFindings?: string[];
    insights?: string[];
    relatedEntities?: Array<{ name: string; type: string; relevance: string }>;
    confidence?: number;
  };
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
}

export interface NotificationCenterFeedResponse {
  items: NotificationCenterEnvelope[];
  total: number;
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
  userAnswer?: string;
  answeredAt?: number;
  snoozeUntil?: number;
  snoozeCount: number;
  expiresAt?: number;
  createdAt: number;
}

export interface ConfirmRequestListResponse {
  items: ConfirmRequest[];
  total: number;
  limit: number;
  state: string;
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
}

export interface RuntimeActionListResponse {
  items: RuntimeAction[];
  total: number;
  limit: number;
  offset: number;
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
    timestamp?: number;
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

export interface ReflectionThreadDetailResponse {
  thread: ReflectionThread;
  runs: ReflectionRun[];
  actions: RuntimeAction[];
  actionResults?: ActionResultRecord[];
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
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecretConfigured?: boolean;
  ringCentralJwtConfigured?: boolean;
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
  outreachEnabled?: boolean;
  outreachIntervalMs?: number;
  outreachRequireApprovalForReflection?: boolean;
  outreachRequireApprovalForManual?: boolean;
  ringCentralServerUrl?: string;
  ringCentralClientId?: string;
  ringCentralClientSecret?: string;
  ringCentralJwt?: string;
  clearRingCentralClientSecret?: boolean;
  clearRingCentralJwt?: boolean;
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
  };
}

export interface MemoryBackupDownloadResponse {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface MemoryBackupImportResponse {
  mode: 'merge' | 'replace';
  importedAt: string;
  restoredLayers: Array<'A' | 'B'>;
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
  private timeout: number;
  private userId: string;
  private configLoaded = false;
  private _configLoadPromise: Promise<void> | null = null;
  private _userIdResolvePromise: Promise<void> | null = null;

  constructor(config?: Partial<MemoryServiceConfig>) {
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = config?.apiKey;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT_MS;
    this.userId = config?.userId ?? 'default';

    // If no explicit config provided, try to load from chrome.storage.local
    if (!config?.baseUrl) {
      this._configLoadPromise = this.loadConfigFromStorage();
    } else {
      this.configLoaded = true;
    }
  }

  /**
   * Load configuration from envConfig and userinfo in chrome.storage.local.
   * - baseUrl, apiKey, timeout: from envConfig (MEMORY_SERVICE_*)
   * - userId: from userinfo.username
   */
  private loadConfigFromStorage(): Promise<void> {
    if (this.configLoaded) {
      return Promise.resolve();
    }

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get(
            ['envConfig', 'userinfo'],
            (result: {
              envConfig?: Record<string, any>;
              userinfo?: { username?: string };
            }) => {
              const env = result.envConfig;
              if (env?.MEMORY_SERVICE_BASE_URL) {
                this.baseUrl = env.MEMORY_SERVICE_BASE_URL;
              }
              if (
                env?.MEMORY_SERVICE_API_KEY != null &&
                env.MEMORY_SERVICE_API_KEY !== ''
              ) {
                this.apiKey = env.MEMORY_SERVICE_API_KEY;
              }
              if (env?.MEMORY_SERVICE_TIMEOUT != null) {
                const t = Number(env.MEMORY_SERVICE_TIMEOUT);
                if (!Number.isNaN(t)) this.timeout = t;
              }
              const username = result.userinfo?.username?.trim();
              if (username && USER_ID_PATTERN.test(username)) {
                this.userId = username;
              }
              this.configLoaded = true;
              resolve();
            },
          );
        });
      }
    } catch {
      // chrome.storage not available — use defaults
    }

    this.configLoaded = true;
    return Promise.resolve();
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
   * Resolve userId from userinfo.username when it is still 'default'.
   * Runs once per "default" period.
   */
  private async ensureUserIdResolved(): Promise<void> {
    if (this.userId !== 'default') return;
    if (this._userIdResolvePromise) return this._userIdResolvePromise;

    this._userIdResolvePromise = (async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;
        const result = (await chrome.storage.local.get('userinfo')) as {
          userinfo?: { username?: string };
        };
        const username = result.userinfo?.username?.trim();
        if (username && USER_ID_PATTERN.test(username)) {
          this.userId = username;
        }
      } finally {
        this._userIdResolvePromise = null;
      }
    })();

    return this._userIdResolvePromise;
  }

  // --------------------------------------------------------------------------
  // Core HTTP wrapper
  // --------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    await this.ensureConfigLoaded();
    await this.ensureUserIdResolved();

    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-User-Id': this.userId,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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
        `Network error: ${err.message || 'Failed to connect to Memory Service'}`,
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
    await this.ensureUserIdResolved();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/zip',
      'X-User-Id': this.userId,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
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
        `Network error: ${err.message || 'Failed to connect to Memory Service'}`,
      );
    }
  }

  private async requestForm<T>(
    method: string,
    path: string,
    formData: FormData,
    accept = 'application/json',
  ): Promise<T> {
    await this.ensureUserIdResolved();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: accept,
      'X-User-Id': this.userId,
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
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
        `Network error: ${err.message || 'Failed to connect to Memory Service'}`,
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
   * Multi-channel recall — search across vector, full-text, graph, and time channels.
   */
  async recall(query: string, options?: RecallOptions): Promise<RecallResult> {
    return this.request<RecallResult>('POST', '/recall', {
      query,
      ...options,
    });
  }

  /**
   * Natural language Q&A — combines recall with LLM generation.
   */
  async ask(
    query: string,
    context?: string,
    includeEvidence?: boolean,
  ): Promise<AskResponse> {
    return this.request<AskResponse>('POST', '/ask', {
      query,
      context,
      includeEvidence,
    });
  }

  async getMeetings(
    limit?: number,
    offset?: number,
  ): Promise<MeetingRecordListResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));

    const query = params.toString();
    return this.request<MeetingRecordListResponse>(
      'GET',
      `/meetings${query ? `?${query}` : ''}`,
    );
  }

  async getMeetingDetail(meetingId: string): Promise<MeetingRecordDetail> {
    return this.request<MeetingRecordDetail>(
      'GET',
      `/meetings/${encodeURIComponent(meetingId)}`,
    );
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
    const path = `/entities/${encodeURIComponent(id)}/properties${qs ? '?' + qs : ''}`;
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
    const path = `/entities/${encodeURIComponent(id)}/relationships${qs ? '?' + qs : ''}`;
    return this.request('GET', path);
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
    state?: string,
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
  ): Promise<NotificationCenterFeedResponse> {
    const params = new URLSearchParams();
    params.set('channel', channel);
    if (lanes.length > 0) {
      params.set('lanes', lanes.join(','));
    }
    if (limit !== undefined) {
      params.set('limit', String(limit));
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
  ): Promise<{ ok: boolean; updated: number }> {
    return this.request<{ ok: boolean; updated: number }>(
      'POST',
      '/notification-center/delivery',
      { events },
    );
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
   * Snooze a notification (creates a new notification 24 hours later).
   */
  async snoozeNotification(id: string): Promise<{
    id: string;
    action: string;
    newNotificationId: string;
    scheduledAt: number;
  }> {
    return this.request(
      'POST',
      `/notifications/${encodeURIComponent(id)}/action`,
      { action: 'snooze' },
    );
  }

  /**
   * Get notification statistics.
   */
  async getNotificationStats(): Promise<{
    pending: number;
    clicked: number;
    dismissed: number;
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
  ): Promise<ConfirmRequestListResponse> {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (limit !== undefined) params.set('limit', String(limit));

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
  ): Promise<{ status: string; confirmRequest: ConfirmRequest }> {
    return this.request(
      'POST',
      `/confirm-requests/${encodeURIComponent(id)}/answer`,
      { answer, detail },
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
      `/providers/${encodeURIComponent(provider)}/bindings${qs ? `?${qs}` : ''}`,
    );
  }

  async upsertProviderBinding(
    provider: string,
    bindingType: string,
    payload: UpsertProviderBindingPayload,
  ): Promise<{ binding: ProviderBindingRecord }> {
    return this.request<{ binding: ProviderBindingRecord }>(
      'PUT',
      `/providers/${encodeURIComponent(provider)}/bindings/${encodeURIComponent(bindingType)}`,
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
      `/providers/${encodeURIComponent(provider)}/sync-jobs${qs ? `?${qs}` : ''}`,
    );
  }

  async getProviderSyncJob(
    provider: string,
    id: string,
  ): Promise<{ job: ProviderSyncJobRecord }> {
    return this.request<{ job: ProviderSyncJobRecord }>(
      'GET',
      `/providers/${encodeURIComponent(provider)}/sync-jobs/${encodeURIComponent(id)}`,
    );
  }

  async reportProviderSyncJob(
    provider: string,
    id: string,
    payload: ReportProviderSyncJobPayload,
  ): Promise<{ job: ProviderSyncJobRecord }> {
    return this.request<{ job: ProviderSyncJobRecord }>(
      'POST',
      `/providers/${encodeURIComponent(provider)}/sync-jobs/${encodeURIComponent(id)}/report`,
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

  async executeAction(id: string): Promise<{
    actionId: string;
    actionType: string;
    queueStatus: string;
    result?: Record<string, any>;
    error?: string;
  }> {
    return this.request('POST', `/actions/${encodeURIComponent(id)}/execute`);
  }

  async planMessageRuleAutomation(
    body: MessageRuleAutomationPlanRequest,
  ): Promise<MessageRuleAutomationPlanResponse> {
    return this.request('POST', '/message-rules/plan', body);
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

  async upsertOutreachTemplate(body: {
    id?: string;
    sourceKind: string;
    sourceRefId?: string;
    sheetMessageId?: string;
    title: string;
    questionTemplate: string;
    contextTemplate?: string;
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
      `/outreach/directory/sync${params.toString() ? `?${params.toString()}` : ''}`,
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
      params.set('confirmedOnly', String(filters.confirmedOnly));
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
   * Update an existing profile item.
   */
  async updateProfileItem(
    id: string,
    body: {
      itemValue?: string;
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
    const path = `/agent/${encodeURIComponent(kind)}/history${qs ? '?' + qs : ''}`;
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
  ): Promise<MemoryBackupImportResponse> {
    const formData = new FormData();
    const fileName =
      typeof File !== 'undefined' && file instanceof File
        ? file.name
        : 'personal-ai-memory-backup.zip';

    formData.append('file', file, fileName);
    formData.append('mode', mode);

    return this.requestForm<MemoryBackupImportResponse>(
      'POST',
      '/import',
      formData,
    );
  }

  /**
   * Get aggregate statistics for the memory service.
   */
  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('GET', '/stats');
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
    const url = `${this.baseUrl}/events?userId=${encodeURIComponent(this.userId)}`;
    const eventSource = new EventSource(url);

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

    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(eventType, data);
        } catch {
          onEvent(eventType, event.data);
        }
      });
    }

    eventSource.onerror = (event: Event) => {
      if (onError) {
        onError(event);
      }
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
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
        `/user-files/${encodeURIComponent(subdir)}/${encodeURIComponent(filename)}`,
      );
      return result.content;
    } catch {
      return null;
    }
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
    this.userId = userId;
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
 * If called with a config object, the existing singleton is replaced.
 * If called without arguments, returns the existing instance or creates
 * one with default configuration.
 */
export function getMemoryServiceClient(
  config?: Partial<MemoryServiceConfig>,
): MemoryServiceClient {
  if (config || !_client) {
    _client = new MemoryServiceClient(config);
  }
  return _client;
}
