import type { BridgeRuntimeSettings } from './config.js';

function normalizeBaseUrl(value?: string): string | undefined {
  const normalized = value?.trim().replace(/\/$/, '') || undefined;
  if (!normalized) return undefined;
  return normalized.replace(/\/api\/v1$/i, '');
}

function isProviderApiPath(path: string): boolean {
  return path.startsWith('/api/v1/providers/');
}

function buildProviderApiCompatibilityError(
  baseUrl: string,
  path: string,
): Error {
  return new Error(
    `Memory Service at ${baseUrl} does not support Doubao Bridge provider APIs (${path}). ` +
      'This usually means the backend is outdated or the Base URL points to the wrong service.',
  );
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class BridgeMemoryServiceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'BridgeMemoryServiceHttpError';
  }
}

export interface ProviderSyncJobRecord {
  id: string;
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'skipped';
}

export interface ProviderCapabilities {
  provider: string;
  supportedScenarios: string[];
}

export interface ProviderMemoryProduct {
  title: string;
  kind: string;
  bodyMd: string;
  itemCount?: number;
  sourceRefs: string[];
}

export interface NotificationCenterDeliveryEvent {
  sourceRef: string;
  channel: 'chrome' | 'doubao' | 'glip';
  lane: 'todo' | 'notice';
  status: 'delivered' | 'failed' | 'clicked' | 'dismissed';
  externalRef?: string;
  error?: string;
}

export interface RenderContextPackageResponse {
  provider: string;
  scenario: string;
  packages: ProviderMemoryProduct[];
  syncJob?: ProviderSyncJobRecord;
}

export type RecallBlockType =
  | 'summary'
  | 'timeline'
  | 'table'
  | 'chart'
  | 'media'
  | 'evidence_list'
  | 'entity_card';

export interface RecallBlock {
  type: RecallBlockType;
  title?: string;
  data?: unknown;
  description?: string;
  exploreLink?: string;
}

export interface RecallAnalysis {
  summary?: string;
  keyFindings?: string[];
  insights?: string[];
  hypotheses?: string[];
  followUpQuestions?: string[];
  confidence?: number;
}

export interface AskResponse {
  answer: string;
  evidence?: Array<{
    id?: string;
    type?: 'message' | 'chunk' | 'entity';
    content: string;
    score?: number;
    source?: string;
    timestamp?: number;
    metadata?: Record<string, unknown>;
    exploreLink?: string;
    sourceUrl?: string;
  }>;
  queryTimeMs: number;
  answerMemory?: {
    state: 'priorHit' | 'observed' | 'promoted' | 'updated' | 'skipped';
    threadId?: string;
    canonicalKey?: string;
    skipReason?: string;
  };
  blocks?: RecallBlock[];
  analysis?: RecallAnalysis;
  structuredAnswer?: {
    timeline?: Array<{ date: string; event: string }>;
    keyFindings?: string[];
    insights?: string[];
    relatedEntities?: Array<{ name: string; type: string; relevance: string }>;
    confidence?: number;
  };
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
}

export type AskStreamEvent =
  | { type: 'start'; requestId: string }
  | { type: 'status'; message: string }
  | { type: 'delta'; text: string }
  | { type: 'answer_done'; answer: string }
  | {
      type: 'recall_done';
      itemsCount: number;
      blocks?: RecallBlock[];
      evidence?: AskResponse['evidence'];
    }
  | {
      type: 'result';
      answer: string;
      evidence?: AskResponse['evidence'];
      queryTimeMs: number;
      blocks?: RecallBlock[];
      analysis?: RecallAnalysis;
      structuredAnswer?: AskResponse['structuredAnswer'];
      answerMemory?: AskResponse['answerMemory'];
      resolutionState?: AskResponse['resolutionState'];
      missingInfo?: AskResponse['missingInfo'];
      followUpActions?: AskResponse['followUpActions'];
      externalEvidence?: AskResponse['externalEvidence'];
    }
  | { type: 'error'; message: string };

// ---------- Context Recall (passive) types ----------

export type ContextRecallSurface =
  | 'web_passive'
  | 'meeting_passive'
  | 'popup_passive'
  | 'follow_thread';

export type ContextRecallContextType =
  | 'webpage'
  | 'meeting'
  | 'message_thread'
  | 'jira_issue'
  | 'document';

export interface ContextRecallEntityHint {
  kind: string;
  value: string;
  entityId?: string;
}

export interface ContextRecallRequest {
  surface: ContextRecallSurface;
  contextType: ContextRecallContextType;
  title?: string;
  url?: string;
  primaryText?: string;
  secondaryTexts?: string[];
  entityHints?: ContextRecallEntityHint[];
  scope?: 'work' | 'personal' | 'both';
  sourceTypes?: string[];
  limit?: number;
}

export interface ContextRecallMatch {
  id: string;
  type: 'message' | 'chunk' | 'entity';
  title: string;
  snippet: string;
  score: number;
  sourceLabel: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  whyMatched?: string;
  whyRelevant?: string[];
  matchedAnchors?: {
    people?: string[];
    topics?: string[];
    projects?: string[];
    source?: string[];
  };
  suppressionReason?: string;
  links?: Array<{ url: string; label?: string }>;
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

export interface ContextRecallResponse {
  matches: ContextRecallMatch[];
  topMatch?: ContextRecallMatch | null;
  queryTimeMs: number;
  autopilot?: ContextRecallAutopilotDecision;
  debug?: {
    normalizedQuery: string;
    channelsHit: string[];
    rejectedReason?: string;
    suppressionReasons?: string[];
    autopilot?: ContextRecallAutopilotDecision;
  };
}

export interface ConfirmRequestListResponse {
  items: Array<{
    id: string;
    question: string;
    context?: string;
    options?: Array<{ label: string; value: string }>;
    category?: string;
    priority: string;
    state: string;
    routing?: 'decision' | 'watch';
    reasonCode?:
      | 'authority_required'
      | 'approval_required'
      | 'future_monitoring'
      | 'owner_eta_gap'
      | 'artifact_gap'
      | 'time_sensitive_blocker';
    sourceAnchor?: string;
    gapType?:
      | 'future_monitoring'
      | 'owner_eta'
      | 'artifact_check'
      | 'decision_blocker';
    createdAt: number;
    updatedAt?: number;
  }>;
  total: number;
  limit: number;
  state: string;
  queue?: 'decision' | 'watch' | 'all';
}

export interface RuntimeActionListResponse {
  items: Array<{
    id: string;
    title: string;
    actionType: string;
    queueStatus:
      | 'queued'
      | 'running'
      | 'succeeded'
      | 'failed'
      | 'cancelled'
      | 'dead_letter';
  }>;
  total: number;
  limit: number;
  offset: number;
}

export interface OutreachSummaryResponse {
  upcomingCount: number;
  waitingReplyCount: number;
  escalatedCount: number;
  pendingApprovalCount: number;
}

export interface OutreachSessionListResponse {
  items: Array<{
    id: string;
    status:
      | 'pending_approval'
      | 'scheduled'
      | 'waiting_reply'
      | 'deferred'
      | 'resolved'
      | 'no_reply'
      | 'escalated'
      | 'cancelled'
      | 'failed';
    renderedQuestion: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export interface MemoryServiceStatsResponse {
  user?: {
    id: string;
    isolation: 'per_user_sqlite';
    storageKey: string;
    fallbackToDefault: boolean;
  };
  messages: {
    total: number;
    today: number;
    thisWeek: number;
    last90Days?: number;
  };
  entities: {
    total: number;
    byType: Record<string, number>;
  };
  chunks: {
    total: number;
  };
  relationships: {
    total: number;
  };
  watchedProjects: {
    active: number;
  };
  notifications: {
    pending: number;
    sentToday: number;
  };
  confirmRequests: {
    pending: number;
  };
  memory: {
    temporary: number;
    working: number;
    consolidated: number;
    core: number;
    forgotten: number;
    archived: number;
  };
}

export interface ExtractFromChatSegment {
  id?: string;
  speaker?: string;
  timestamp?: number;
  text: string;
}

export interface ExtractFromChatResponse {
  artifacts: Array<{
    kind: string;
    text: string;
    source_quote: string;
    conversation_ref: string;
  }>;
  ingestResults: Array<{
    id: string;
    status: 'created' | 'duplicate' | 'error';
    entitiesExtracted?: number;
    matchedProjects?: string[];
  }>;
  scopeUsed: 'work' | 'personal';
  outcomeSignals?: Array<Record<string, unknown>>;
}

export interface DeleteMemoriesBySourceScopeResponse {
  source: string;
  scope: 'work' | 'personal';
  deletedMessages: number;
  deletedChunks: number;
}

export interface SkillSyncSetting {
  platform: string;
  enabled: boolean;
  capability: 'internal' | 'api' | 'fs_via_desktop_app' | 'manual_only';
  mode: string;
  config?: Record<string, unknown>;
}

export interface LocalSkillSyncPackage {
  slug: string;
  title?: string;
  description?: string;
  version?: string;
  sha256?: string;
  mtime?: number;
  root?: string;
  directory?: string;
  skillMdPath?: string;
  skillMd: string;
  files?: Array<{
    path: string;
    content: string;
    sha256?: string;
    byteSize?: number;
  }>;
}

export interface LocalSkillSyncResponse {
  status: 'succeeded' | 'partial_failed';
  platform: string;
  processed: number;
  imported: number;
  updated: number;
  pulled: number;
  pushed: number;
  externalChanges: number;
  skipped: number;
  errors: Array<{ slug?: string; error: string }>;
  packagesToInstall: LocalSkillSyncPackage[];
}

export class BridgeMemoryServiceClient {
  constructor(private readonly readSettings: () => BridgeRuntimeSettings) {}

  private getSettings(): BridgeRuntimeSettings {
    return this.readSettings();
  }

  isEnabled(): boolean {
    const settings = this.getSettings();
    return Boolean(
      normalizeBaseUrl(settings.memoryServiceBaseUrl) &&
      settings.memoryServiceUserId,
    );
  }

  private buildHeaders(): Record<string, string> {
    const settings = this.getSettings();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (settings.memoryServiceUserId) {
      headers['X-User-Id'] = settings.memoryServiceUserId;
    }
    if (settings.memoryServiceApiKey) {
      headers.Authorization = `Bearer ${settings.memoryServiceApiKey}`;
    }

    return headers;
  }

  private ensureWriteIdentity(): void {
    if (!this.getSettings().memoryServiceUserId) {
      throw new Error(
        'Memory Service User ID is required for sync operations.',
      );
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const baseUrl = normalizeBaseUrl(this.getSettings().memoryServiceBaseUrl);
    if (!baseUrl) {
      throw new Error(
        'MEMORY_SERVICE_BASE_URL is not configured for Doubao Bridge',
      );
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: this.buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await readResponsePayload(response);
      if (response.status === 404 && isProviderApiPath(path)) {
        throw buildProviderApiCompatibilityError(baseUrl, path);
      }
      const errorMessage =
        (payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : typeof payload === 'string'
            ? payload
            : '') ||
        `Memory service request failed: ${method} ${path} (${response.status})`;
      throw new BridgeMemoryServiceHttpError(
        errorMessage,
        response.status,
        payload,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private parseSseBlock(block: string): AskStreamEvent | null {
    const lines = block.split(/\r?\n/);
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        event = line.slice(6).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    const rawData = dataLines.join('\n');
    if (!rawData) return null;

    let payload: unknown = null;
    try {
      payload = JSON.parse(rawData);
    } catch {
      payload = null;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const typedPayload = payload as Record<string, unknown>;

    if (!typedPayload.type) {
      return {
        ...typedPayload,
        type: event as AskStreamEvent['type'],
      } as AskStreamEvent;
    }

    return typedPayload as AskStreamEvent;
  }

  private async streamRequest(
    path: string,
    body: unknown,
    onEvent: (event: AskStreamEvent) => void | Promise<void>,
  ): Promise<void> {
    const baseUrl = normalizeBaseUrl(this.getSettings().memoryServiceBaseUrl);
    if (!baseUrl) {
      throw new Error(
        'MEMORY_SERVICE_BASE_URL is not configured for Doubao Bridge',
      );
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await readResponsePayload(response);
      const errorMessage =
        (payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : typeof payload === 'string'
            ? payload
            : '') ||
        `Memory service stream request failed: POST ${path} (${response.status})`;
      throw new BridgeMemoryServiceHttpError(
        errorMessage,
        response.status,
        payload,
      );
    }

    if (!response.body) {
      throw new Error(
        `Memory service stream ${path} returned no response body.`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      let delimiterIndex = buffer.search(/\r?\n\r?\n/);
      while (delimiterIndex >= 0) {
        const rawBlock = buffer.slice(0, delimiterIndex).trim();
        const separatorLength = buffer[delimiterIndex] === '\r' ? 4 : 2;
        buffer = buffer.slice(delimiterIndex + separatorLength);
        if (rawBlock) {
          const payload = this.parseSseBlock(rawBlock);
          if (payload) {
            await onEvent(payload);
          }
        }
        delimiterIndex = buffer.search(/\r?\n\r?\n/);
      }

      if (done) {
        const trailing = buffer.trim();
        if (trailing) {
          const payload = this.parseSseBlock(trailing);
          if (payload) {
            await onEvent(payload);
          }
        }
        break;
      }
    }
  }

  async testConnection(): Promise<Record<string, unknown>> {
    const health = await this.request<Record<string, unknown>>(
      'GET',
      '/api/v1/health',
    );
    const providerCapabilities = await this.getProviderCapabilities('doubao');
    return {
      ok: true,
      baseUrl: normalizeBaseUrl(this.getSettings().memoryServiceBaseUrl),
      health,
      providerCapabilities,
    };
  }

  async getProviderCapabilities(
    provider: string,
  ): Promise<ProviderCapabilities> {
    return this.request<ProviderCapabilities>(
      'GET',
      `/api/v1/providers/${encodeURIComponent(provider)}/capabilities`,
    );
  }

  async renderContextPackage(input: {
    provider: string;
    scenario:
      | 'stable_memory'
      | 'mobile_briefing'
      | 'todo_sync'
      | 'notice_sync'
      | 'reminder_sync';
    deviceContext?: string;
    deliveryMode?: 'incremental' | 'daily_digest';
  }): Promise<RenderContextPackageResponse> {
    this.ensureWriteIdentity();
    return this.request<RenderContextPackageResponse>(
      'POST',
      '/api/v1/providers/context-packages/render',
      {
        provider: input.provider,
        scenario: input.scenario,
        deviceContext: input.deviceContext ?? 'doubao_bridge_daemon',
        deliveryMode: input.deliveryMode,
        createSyncJob: true,
      },
    );
  }

  async reportSyncJob(
    provider: string,
    id: string,
    payload: {
      status: ProviderSyncJobRecord['status'];
      result?: Record<string, unknown>;
      errorMessage?: string;
      externalThreadId?: string;
      startedAt?: number;
      completedAt?: number;
    },
  ): Promise<void> {
    this.ensureWriteIdentity();
    await this.request(
      'POST',
      `/api/v1/providers/${encodeURIComponent(provider)}/sync-jobs/${encodeURIComponent(id)}/report`,
      payload,
    );
  }

  async reportNotificationDelivery(
    events: NotificationCenterDeliveryEvent[],
  ): Promise<void> {
    if (events.length === 0) return;
    this.ensureWriteIdentity();
    await this.request('POST', '/api/v1/notification-center/delivery', {
      events,
    });
  }

  async contextRecall(
    request: ContextRecallRequest,
  ): Promise<ContextRecallResponse> {
    return this.request<ContextRecallResponse>(
      'POST',
      '/api/v1/context-recall',
      request,
    );
  }

  async ask(
    query: string,
    context?: string,
    includeEvidence?: boolean,
    scope?: 'work' | 'personal' | 'both',
  ): Promise<AskResponse> {
    return this.request<AskResponse>('POST', '/api/v1/ask', {
      query,
      context,
      includeEvidence,
      scope,
    });
  }

  async streamAsk(
    query: string,
    context: string | undefined,
    includeEvidence: boolean | undefined,
    scope: 'work' | 'personal' | 'both' | undefined,
    onEvent: (event: AskStreamEvent) => void | Promise<void>,
  ): Promise<void> {
    await this.streamRequest(
      '/api/v1/ask/stream',
      {
        query,
        context,
        includeEvidence,
        scope,
      },
      onEvent,
    );
  }

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
    return this.request<ConfirmRequestListResponse>(
      'GET',
      `/api/v1/confirm-requests${qs ? `?${qs}` : ''}`,
    );
  }

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
    limit?: number;
    offset?: number;
  }): Promise<RuntimeActionListResponse> {
    const params = new URLSearchParams();
    if (filters?.queueStatus) params.set('queueStatus', filters.queueStatus);
    if (filters?.executionMode)
      params.set('executionMode', filters.executionMode);
    if (filters?.threadId) params.set('threadId', filters.threadId);
    if (filters?.actionType) params.set('actionType', filters.actionType);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request<RuntimeActionListResponse>(
      'GET',
      `/api/v1/actions${qs ? `?${qs}` : ''}`,
    );
  }

  async getOutreachSummary(): Promise<OutreachSummaryResponse> {
    return this.request<OutreachSummaryResponse>(
      'GET',
      '/api/v1/outreach/summary',
    );
  }

  async getOutreachSessions(filters?: {
    status?:
      | 'pending_approval'
      | 'scheduled'
      | 'waiting_reply'
      | 'deferred'
      | 'resolved'
      | 'no_reply'
      | 'escalated'
      | 'cancelled'
      | 'failed'
      | 'all';
    limit?: number;
    offset?: number;
  }): Promise<OutreachSessionListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit !== undefined)
      params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined)
      params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request<OutreachSessionListResponse>(
      'GET',
      `/api/v1/outreach/sessions${qs ? `?${qs}` : ''}`,
    );
  }

  async getStats(): Promise<MemoryServiceStatsResponse> {
    return this.request<MemoryServiceStatsResponse>('GET', '/api/v1/stats');
  }

  async extractFromChat(input: {
    source: string;
    sourceType?: string;
    scope: 'work' | 'personal';
    autoClassify?: boolean;
    extractMode?: 'chat' | 'agent_session';
    conversationMeta?: Record<string, unknown>;
    segments: ExtractFromChatSegment[];
  }): Promise<ExtractFromChatResponse> {
    this.ensureWriteIdentity();
    return this.request<ExtractFromChatResponse>(
      'POST',
      '/api/v1/extractor/from-chat',
      input,
    );
  }

  async deleteMemoriesBySourceScope(
    source: string,
    scope: 'work' | 'personal',
  ): Promise<DeleteMemoriesBySourceScopeResponse> {
    this.ensureWriteIdentity();
    const params = new URLSearchParams({ source, scope });
    return this.request<DeleteMemoriesBySourceScopeResponse>(
      'DELETE',
      `/api/v1/memories?${params.toString()}`,
    );
  }

  async getSkillSyncSettings(): Promise<{ items: SkillSyncSetting[] }> {
    return this.request<{ items: SkillSyncSetting[] }>(
      'GET',
      '/api/v1/skills/sync-settings',
    );
  }

  async syncLocalSkillPlatform(input: {
    platform: string;
    skills: LocalSkillSyncPackage[];
  }): Promise<LocalSkillSyncResponse> {
    this.ensureWriteIdentity();
    return this.request<LocalSkillSyncResponse>(
      'POST',
      '/api/v1/skills/sync/local-platform',
      input,
    );
  }

  async createProfileItem(body: {
    itemType: string;
    itemKey: string;
    itemValue: string;
    evidenceRefs?: unknown[];
    confidence?: number;
  }): Promise<{
    id?: string;
    itemType?: string;
    itemKey?: string;
    itemValue?: string;
  }> {
    this.ensureWriteIdentity();
    return this.request('POST', '/api/v1/profile/items', body);
  }
}
