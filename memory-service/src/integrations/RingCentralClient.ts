import type Database from 'better-sqlite3';

import {
  RingCentralDirectoryRepository,
  type RingCentralDirectoryScope,
  type RingCentralDirectoryScopeState,
  type RingCentralDirectorySyncStatus,
} from '../repositories/RingCentralDirectoryRepository.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { now } from '../utils/time.js';

export interface RingCentralPost {
  id: string;
  chatId: string;
  text: string;
  creatorId?: string;
  creatorName?: string;
  createdAt?: string;
  raw?: Record<string, unknown>;
}

export interface RingCentralChatSummary {
  id: string;
  type: string;
  name?: string;
  description?: string;
  members?: string[];
}

export interface RingCentralTargetCandidate {
  kind: 'user' | 'chat';
  entityId: string;
  chatId?: string;
  label: string;
  subtitle?: string;
  score: number;
  source: 'extension' | 'chat';
}

export interface ResolveRingCentralTargetInput {
  targetType: string;
  targetRef: string;
  limit?: number;
}

export interface ResolveRingCentralTargetResult {
  status: 'unresolved' | 'ambiguous' | 'resolved';
  query: string;
  resolved?: RingCentralTargetCandidate;
  candidates: RingCentralTargetCandidate[];
}

export interface RingCentralDirectoryStatus {
  scope: RingCentralDirectoryScope;
  status: RingCentralDirectorySyncStatus;
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastSuccessAt?: number;
  recordCount: number;
  lastError?: string;
  stale: boolean;
}

export interface RingCentralTargetSearchResponse {
  items: RingCentralTargetCandidate[];
  total: number;
  directoryStatus: RingCentralDirectoryStatus[];
}

interface StoredRingCentralTargetAlias {
  targetType: string;
  kind: RingCentralTargetCandidate['kind'];
  entityId: string;
  chatId?: string;
  label: string;
  subtitle?: string;
  source: RingCentralTargetCandidate['source'];
  updatedAt: number;
}

export interface SendRingCentralMessageInput {
  targetType: string;
  targetRef: string;
  text: string;
  replyToPostId?: string;
  targetResolvedType?: string;
  targetResolvedId?: string;
  targetResolvedChatId?: string;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

interface TimedCacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface PagedRingCentralRecords<T> {
  records: T[];
  nextPageToken?: string;
  prevPageToken?: string;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function parseExpiry(expiresIn: unknown): number {
  const sec = Number(expiresIn);
  if (!Number.isFinite(sec) || sec <= 0) return Date.now() + 5 * 60 * 1000;
  // Keep 15s guard to avoid hitting near-expired tokens.
  return Date.now() + sec * 1000 - 15_000;
}

function ensureObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function extractChatIdFromTargetRef(targetRef: string): string | null {
  const trimmed = targetRef.trim();
  if (!trimmed) return null;

  if (/^chat[-_][\w-]+$/i.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{6,}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(
    /^https?:\/\/app\.ringcentral\.com\/(?:l\/messages|chat|group|message)\/([^/?#]+)(?:[/?#].*)?$/i,
  );
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

function allowedChatTypesForTargetType(targetType: string): Set<string> {
  const normalized = normalizeSearch(targetType);
  if (normalized === 'group') {
    return new Set(['team', 'group']);
  }
  return new Set(['direct']);
}

const TARGET_ALIAS_PATH = 'agent/ringcentral-target-aliases.json';

function toDisplayString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function buildScore(query: string, ...values: Array<string | undefined>): number {
  const normalizedQuery = normalizeSearch(query);
  let best = 0;
  for (const rawValue of values) {
    const value = normalizeSearch(rawValue ?? '');
    if (!value) continue;
    if (value === normalizedQuery) return 100;
    if (value.startsWith(normalizedQuery)) {
      best = Math.max(best, 92);
      continue;
    }
    if (value.includes(normalizedQuery)) {
      best = Math.max(best, 75);
    }
  }
  return best;
}

export class RingCentralClient {
  private static readonly DIRECTORY_CACHE_TTL_MS = 10 * 60_000;
  private static readonly DIRECTORY_SYNC_INTERVAL_SECONDS = 12 * 60 * 60;
  private static readonly DIRECTORY_SYNC_STALE_GRACE_SECONDS = 30 * 60;
  private static readonly PERSON_CACHE_TTL_MS = 5 * 60_000;
  private static readonly DIRECTORY_CHAT_PAGE_SIZE = 50;
  private static readonly DIRECTORY_CHAT_INTER_PAGE_DELAY_MS = 250;
  private static readonly CHAT_SEARCH_MAX_PAGES = 100;
  private static readonly TEAM_SEARCH_MAX_PAGES = 100;
  private static readonly UNNAMED_CHAT_MEMBER_LOOKUP_LIMIT = 40;
  private static readonly REQUEST_TIMEOUT_MS = 10_000;
  private static readonly tokenCache = new Map<string, TokenState>();
  private static readonly tokenPromiseCache = new Map<string, Promise<TokenState>>();
  private static readonly currentExtensionIdCache = new Map<string, string>();
  private static readonly currentUserEmailCache = new Map<string, string>();
  private static readonly currentUserEmailPromiseCache = new Map<string, Promise<string>>();
  private static readonly directoryEntryListCache = new Map<string, TimedCacheEntry<Array<Record<string, unknown>>>>();
  private static readonly directoryEntryListPromiseCache = new Map<string, Promise<Array<Record<string, unknown>>>>();
  private static readonly extensionListCache = new Map<string, TimedCacheEntry<Array<Record<string, unknown>>>>();
  private static readonly extensionListPromiseCache = new Map<string, Promise<Array<Record<string, unknown>>>>();
  private static readonly teamListCache = new Map<string, TimedCacheEntry<RingCentralChatSummary[]>>();
  private static readonly teamListPromiseCache = new Map<string, Promise<RingCentralChatSummary[]>>();
  private static readonly teamEndpointPreferenceCache = new Map<string, 'team-messaging' | 'glip'>();
  private static readonly chatListCache = new Map<string, TimedCacheEntry<RingCentralChatSummary[]>>();
  private static readonly chatListPromiseCache = new Map<string, Promise<RingCentralChatSummary[]>>();
  private static readonly chatDetailCache = new Map<string, TimedCacheEntry<RingCentralChatSummary>>();
  private static readonly chatDetailPromiseCache = new Map<string, Promise<RingCentralChatSummary | null>>();
  private static readonly personCache = new Map<string, TimedCacheEntry<Record<string, unknown>>>();
  private static readonly personPromiseCache = new Map<string, Promise<Record<string, unknown> | null>>();
  private static readonly directorySyncPromiseCache = new Map<string, Promise<RingCentralDirectoryStatus[]>>();
  private tokenState: TokenState | null = null;
  private currentExtensionId: string | null = null;
  private currentUserEmail: string | null = null;
  private readonly directoryRepo: RingCentralDirectoryRepository | null;

  constructor(
    private readonly userDataManager?: UserDataManager,
    private readonly db?: Database.Database,
    private readonly userId = 'default',
  ) {
    this.directoryRepo = db ? new RingCentralDirectoryRepository(db) : null;
  }

  static clearSharedCacheForTests(): void {
    this.tokenCache.clear();
    this.tokenPromiseCache.clear();
    this.currentExtensionIdCache.clear();
    this.currentUserEmailCache.clear();
    this.currentUserEmailPromiseCache.clear();
    this.directoryEntryListCache.clear();
    this.directoryEntryListPromiseCache.clear();
    this.extensionListCache.clear();
    this.extensionListPromiseCache.clear();
    this.teamListCache.clear();
    this.teamListPromiseCache.clear();
    this.teamEndpointPreferenceCache.clear();
    this.chatListCache.clear();
    this.chatListPromiseCache.clear();
    this.chatDetailCache.clear();
    this.chatDetailPromiseCache.clear();
    this.personCache.clear();
    this.personPromiseCache.clear();
    this.directorySyncPromiseCache.clear();
  }

  private getRuntimeConfig() {
    return getUserRuntimeConfig(this.userDataManager);
  }

  private getCacheKey(): string {
    const config = this.getRuntimeConfig();
    return [
      trimTrailingSlash(config.ringCentralServerUrl || ''),
      config.ringCentralClientId || '',
      config.ringCentralJwt || '',
    ].join('|');
  }

  private clearAuthCache(cacheKey = this.getCacheKey()): void {
    this.tokenState = null;
    this.currentExtensionId = null;
    this.currentUserEmail = null;
    RingCentralClient.tokenCache.delete(cacheKey);
    RingCentralClient.tokenPromiseCache.delete(cacheKey);
    RingCentralClient.currentExtensionIdCache.delete(cacheKey);
    RingCentralClient.currentUserEmailCache.delete(cacheKey);
    RingCentralClient.currentUserEmailPromiseCache.delete(cacheKey);
  }

  private getDirectorySyncKey(scopes: RingCentralDirectoryScope[]): string {
    return `${this.userId}|${this.getCacheKey()}|${scopes.slice().sort().join(',')}`;
  }

  private buildDirectoryStatus(
    scope: RingCentralDirectoryScope,
    state?: RingCentralDirectoryScopeState | null,
  ): RingCentralDirectoryStatus {
    const lastSuccessAt = state?.lastSuccessAt;
    const lastStartedAt = state?.lastStartedAt;
    const currentTime = now();
    const syncingTooLong =
      state?.status === 'syncing' &&
      lastStartedAt !== undefined &&
      currentTime - lastStartedAt > RingCentralClient.DIRECTORY_SYNC_STALE_GRACE_SECONDS;
    const stale =
      lastSuccessAt === undefined ||
      currentTime - lastSuccessAt > RingCentralClient.DIRECTORY_SYNC_INTERVAL_SECONDS;
    return {
      scope,
      status: syncingTooLong ? 'error' : state?.status ?? 'idle',
      lastStartedAt,
      lastFinishedAt: state?.lastFinishedAt,
      lastSuccessAt,
      recordCount: state?.recordCount ?? 0,
      lastError:
        syncingTooLong && !state?.lastError
          ? 'Previous directory sync appears stalled.'
          : state?.lastError,
      stale,
    };
  }

  private scopesForTargetType(targetType: string): RingCentralDirectoryScope[] {
    return normalizeSearch(targetType) === 'group' ? ['teams'] : ['users'];
  }

  private async ensureDirectoryReadyForTargetType(targetType: string): Promise<RingCentralDirectoryStatus[]> {
    const scopes = this.scopesForTargetType(targetType);
    const statuses = this.getDirectoryStatus(scopes);
    const needsBlockingSync = statuses.some((item) => !item.lastSuccessAt);
    if (needsBlockingSync) {
      return this.syncDirectory({ scopes, force: true });
    }
    if (statuses.some((item) => item.stale)) {
      void this.syncDirectory({ scopes, force: false });
    }
    return this.getDirectoryStatus(scopes);
  }

  getDirectoryStatus(scopes?: RingCentralDirectoryScope[]): RingCentralDirectoryStatus[] {
    const repo = this.directoryRepo;
    const targetScopes: RingCentralDirectoryScope[] =
      scopes && scopes.length > 0 ? scopes : ['users', 'teams'];
    if (!repo) {
      return targetScopes.map((scope) => this.buildDirectoryStatus(scope, null));
    }
    return targetScopes.map((scope) => this.buildDirectoryStatus(scope, repo.getScopeState(scope)));
  }

  async maintainDirectoryCache(): Promise<RingCentralDirectoryStatus[]> {
    if (!this.directoryRepo || !this.isConfigured()) {
      return this.getDirectoryStatus();
    }
    const statuses = this.getDirectoryStatus();
    if (statuses.some((item) => item.stale || !item.lastSuccessAt)) {
      return this.syncDirectory({ scopes: ['users', 'teams'], force: false });
    }
    return statuses;
  }

  async syncDirectory(options?: {
    scopes?: RingCentralDirectoryScope[];
    force?: boolean;
  }): Promise<RingCentralDirectoryStatus[]> {
    if (!this.directoryRepo || !this.isConfigured()) {
      return this.getDirectoryStatus(options?.scopes);
    }

    const requestedScopes = options?.scopes?.length ? options.scopes : (['users', 'teams'] as RingCentralDirectoryScope[]);
    const scopes: RingCentralDirectoryScope[] = requestedScopes
      .filter((scope, index, list) => list.indexOf(scope) === index);
    const force = options?.force === true;
    const current = this.getDirectoryStatus(scopes);
    if (!force && current.every((item) => !item.stale && item.status === 'ready')) {
      return current;
    }

    const syncKey = this.getDirectorySyncKey(scopes);
    const inFlight = RingCentralClient.directorySyncPromiseCache.get(syncKey);
    if (inFlight) {
      return inFlight;
    }

    const syncPromise = (async () => {
      for (const scope of scopes) {
        this.directoryRepo!.markScopeSyncStarted(scope);
        try {
          if (scope === 'users') {
            const count = await this.syncUsersDirectory();
            this.directoryRepo!.markScopeSyncSuccess(scope, count);
          } else {
            const count = await this.syncTeamsDirectory();
            this.directoryRepo!.markScopeSyncSuccess(scope, count);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.directoryRepo!.markScopeSyncError(scope, message);
        }
      }
      return this.getDirectoryStatus(scopes);
    })();

    RingCentralClient.directorySyncPromiseCache.set(syncKey, syncPromise);
    try {
      return await syncPromise;
    } finally {
      RingCentralClient.directorySyncPromiseCache.delete(syncKey);
    }
  }

  isConfigured(): boolean {
    const config = this.getRuntimeConfig();
    return Boolean(
      config.ringCentralServerUrl &&
        config.ringCentralClientId &&
        config.ringCentralClientSecret &&
        config.ringCentralJwt,
    );
  }

  private async getAccessToken(): Promise<string> {
    const cacheKey = this.getCacheKey();
    if (this.tokenState && Date.now() < this.tokenState.expiresAt) {
      return this.tokenState.accessToken;
    }
    const sharedToken = RingCentralClient.tokenCache.get(cacheKey);
    if (sharedToken && Date.now() < sharedToken.expiresAt) {
      this.tokenState = sharedToken;
      return sharedToken.accessToken;
    }
    const inFlight = RingCentralClient.tokenPromiseCache.get(cacheKey);
    if (inFlight) {
      const tokenState = await inFlight;
      this.tokenState = tokenState;
      return tokenState.accessToken;
    }

    const config = this.getRuntimeConfig();
    if (!this.isConfigured()) {
      throw new Error('RingCentral not configured');
    }

    const serverUrl = trimTrailingSlash(config.ringCentralServerUrl);
    const tokenUrl = `${serverUrl}/restapi/oauth/token`;
    const auth = Buffer.from(
      `${config.ringCentralClientId}:${config.ringCentralClientSecret}`,
      'utf8',
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: config.ringCentralJwt,
    });

    const tokenPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RingCentralClient.REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`RingCentral auth timeout after ${RingCentralClient.REQUEST_TIMEOUT_MS}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`RingCentral auth failed (${response.status}): ${text.slice(0, 240)}`);
      }
      const payload = ensureObject(JSON.parse(text));
      const accessToken =
        typeof payload.access_token === 'string' ? payload.access_token : '';
      if (!accessToken) {
        throw new Error('RingCentral auth response missing access_token');
      }
      const tokenState = {
        accessToken,
        expiresAt: parseExpiry(payload.expires_in),
      };
      RingCentralClient.tokenCache.set(cacheKey, tokenState);
      this.tokenState = tokenState;
      return tokenState;
    })();

    RingCentralClient.tokenPromiseCache.set(cacheKey, tokenPromise);
    try {
      const tokenState = await tokenPromise;
      return tokenState.accessToken;
    } finally {
      RingCentralClient.tokenPromiseCache.delete(cacheKey);
    }
  }

  private async apiRequest(
    path: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
    const config = this.getRuntimeConfig();
    const serverUrl = trimTrailingSlash(config.ringCentralServerUrl);
    const token = await this.getAccessToken();
    const url = `${serverUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const execute = async (accessToken: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RingCentralClient.REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`RingCentral request timeout after ${RingCentralClient.REQUEST_TIMEOUT_MS}ms: ${path}`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      const text = await response.text();
      let body: Record<string, unknown> = {};
      if (text.trim().length > 0) {
        try {
          body = ensureObject(JSON.parse(text));
        } catch {
          body = { rawText: text };
        }
      }
      return { ok: response.ok, status: response.status, body };
    };

    let result = await execute(token);
    if (result.status === 401) {
      this.clearAuthCache();
      const freshToken = await this.getAccessToken();
      result = await execute(freshToken);
    }
    return result;
  }

  async sendMessage(input: SendRingCentralMessageInput): Promise<{ chatId: string; postId: string }> {
    if (!this.isConfigured()) {
      throw new Error('RingCentral not configured');
    }
    const chatId = await this.resolveChatIdForSend(input);
    if (!chatId) throw new Error('Missing target chat id');

    const payload: Record<string, unknown> = {
      text: input.text,
    };
    if (input.replyToPostId?.trim()) {
      payload.replyTo = { id: input.replyToPostId.trim() };
    }

    const result = await this.apiRequest(
      `/team-messaging/v1/chats/${encodeURIComponent(chatId)}/posts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!result.ok) {
      throw new Error(
        `RingCentral send failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }

    const postId = typeof result.body.id === 'string' ? result.body.id : '';
    if (!postId) {
      throw new Error('RingCentral send response missing post id');
    }
    return { chatId, postId };
  }

  async resolveTarget(input: ResolveRingCentralTargetInput): Promise<ResolveRingCentralTargetResult> {
    if (!this.isConfigured()) {
      return {
        status: 'unresolved',
        query: input.targetRef.trim(),
        candidates: [],
      };
    }

    const limit = Math.max(1, Math.min(input.limit ?? 8, 20));
    const normalizedTargetType = input.targetType.trim().toLowerCase();
    const query = input.targetRef.trim();
    if (!query) {
      return {
        status: 'unresolved',
        query,
        candidates: [],
      };
    }

    const rememberedCandidates = this.searchAliasCandidates(normalizedTargetType, query, limit);
    const rememberedTop = rememberedCandidates[0];
    const rememberedSecond = rememberedCandidates[1];
    if (
      rememberedTop &&
      rememberedTop.score >= 90 &&
      (!rememberedSecond || rememberedTop.score >= rememberedSecond.score + 8)
    ) {
      return {
        status: 'resolved',
        query,
        resolved: rememberedTop,
        candidates: rememberedCandidates,
      };
    }

    const explicitChatId = extractChatIdFromTargetRef(query);
    if (explicitChatId && ['group', 'private', 'person'].includes(normalizedTargetType)) {
      try {
        const directCandidate = await this.getChatCandidateById(
          explicitChatId,
          allowedChatTypesForTargetType(normalizedTargetType),
        );
        if (directCandidate) {
          this.rememberCandidate(normalizedTargetType, directCandidate);
          return {
            status: 'resolved',
            query,
            resolved: directCandidate,
            candidates: [directCandidate],
          };
        }
      } catch {
        // Fall through to explicit chat-id passthrough below.
      }

      const passthroughCandidate: RingCentralTargetCandidate = {
        kind: 'chat',
        entityId: explicitChatId,
        chatId: explicitChatId,
        label: explicitChatId,
        subtitle: 'Explicit chat id',
        score: 95,
        source: 'chat',
      };
      this.rememberCandidate(normalizedTargetType, passthroughCandidate);
      return {
        status: 'resolved',
        query,
        resolved: passthroughCandidate,
        candidates: [passthroughCandidate],
      };
    }

    const hasDirectoryCache = Boolean(this.directoryRepo);
    if (hasDirectoryCache) {
      await this.ensureDirectoryReadyForTargetType(normalizedTargetType);
    }
    const localDirectoryCandidates = this.searchDirectoryCandidates(normalizedTargetType, query, limit);
    const directoryStatus = this.getDirectoryStatus(this.scopesForTargetType(normalizedTargetType));
    const directoryReady = directoryStatus.every(
      (item) => item.status === 'ready' && !item.stale && item.recordCount > 0,
    );

    let liveCandidates: RingCentralTargetCandidate[] = [];
    if (normalizedTargetType === 'group') {
      if (!hasDirectoryCache && localDirectoryCandidates.length === 0) {
        liveCandidates = await this.searchGroupCandidates(query, limit);
      }
    } else if (!hasDirectoryCache || !directoryReady) {
      liveCandidates = await this.searchUserCandidates(query, limit, {
        includeDirectChats: !hasDirectoryCache,
      });
    }

    const candidates = this.mergeCandidates(
      [...rememberedCandidates, ...localDirectoryCandidates, ...liveCandidates],
      limit,
    );

    if (candidates.length === 0) {
      return { status: 'unresolved', query, candidates: [] };
    }

    const top = candidates[0];
    const second = candidates[1];
    const uniquelyResolved = top.score >= 90 && (!second || top.score >= second.score + 8);
    if (uniquelyResolved) {
      this.rememberCandidate(normalizedTargetType, top);
      return {
        status: 'resolved',
        query,
        resolved: top,
        candidates,
      };
    }

    return {
      status: 'ambiguous',
      query,
      candidates,
    };
  }

  async searchTargetsDetailed(input: ResolveRingCentralTargetInput): Promise<RingCentralTargetSearchResponse> {
    const result = await this.resolveTarget(input);
    const directoryStatus = this.getDirectoryStatus(this.scopesForTargetType(input.targetType));
    return {
      items: result.candidates,
      total: result.candidates.length,
      directoryStatus,
    };
  }

  async searchTargets(input: ResolveRingCentralTargetInput): Promise<RingCentralTargetCandidate[]> {
    const result = await this.searchTargetsDetailed(input);
    return result.items;
  }

  async listPosts(chatId: string, sinceAt?: number): Promise<RingCentralPost[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const query = new URLSearchParams();
    query.set('recordCount', '50');
    if (sinceAt && Number.isFinite(sinceAt)) {
      query.set('dateFrom', new Date(sinceAt * 1000).toISOString());
    }
    const path = `/team-messaging/v1/chats/${encodeURIComponent(chatId)}/posts?${query.toString()}`;
    const result = await this.apiRequest(path, { method: 'GET' });
    if (!result.ok) {
      throw new Error(
        `RingCentral list posts failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    const records = Array.isArray(result.body.records) ? result.body.records : [];
    const posts = await Promise.all(
      records
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(async (item) => {
          const creator = ensureObject(item.creator);
          const creatorId = toDisplayString(creator.id, item.creatorId) || undefined;
          return {
            id: typeof item.id === 'string' ? item.id : '',
            chatId,
            text: typeof item.text === 'string' ? item.text : '',
            creatorId,
            creatorName: await this.resolvePostCreatorLabel(creator, creatorId),
            createdAt: typeof item.creationTime === 'string' ? item.creationTime : undefined,
            raw: item,
          };
        }),
    );
    return posts.filter((item) => item.id.length > 0);
  }

  private getDirectoryUserDisplayName(entityId?: string): string {
    if (!entityId || !this.directoryRepo) {
      return '';
    }
    const matched = this.directoryRepo
      .searchUsers(entityId, 10)
      .find((item) => item.entityId === entityId);
    return matched?.displayName ?? '';
  }

  private async resolvePostCreatorLabel(
    creator: Record<string, unknown>,
    creatorId?: string,
  ): Promise<string | undefined> {
    const inlineLabel = toDisplayString(
      `${toDisplayString(creator.firstName)} ${toDisplayString(creator.lastName)}`.trim(),
      toDisplayString(creator.name),
      toDisplayString(creator.email),
    );
    if (inlineLabel) {
      return inlineLabel;
    }

    const directoryLabel = this.getDirectoryUserDisplayName(creatorId);
    if (directoryLabel) {
      return directoryLabel;
    }

    if (!creatorId) {
      return undefined;
    }

    const person = await this.getPersonById(creatorId).catch(() => null);
    const resolvedLabel = person
      ? toDisplayString(
          `${toDisplayString(person.firstName)} ${toDisplayString(person.lastName)}`.trim(),
          toDisplayString(person.name),
          toDisplayString(person.email),
        )
      : '';
    return resolvedLabel || creatorId;
  }

  private async resolveChatIdForSend(input: SendRingCentralMessageInput): Promise<string> {
    if (input.targetResolvedChatId?.trim()) {
      return input.targetResolvedChatId.trim();
    }

    const normalizedResolvedType = input.targetResolvedType?.trim().toLowerCase();
    if (normalizedResolvedType === 'user' && input.targetResolvedId?.trim()) {
      return this.ensureConversationChatId([input.targetResolvedId.trim()]);
    }
    if (input.targetResolvedId?.trim()) {
      return input.targetResolvedId.trim();
    }

    // Backward compatibility for legacy sessions that already store chat id in targetRef.
    return input.targetRef.trim();
  }

  private async getCurrentExtensionId(): Promise<string> {
    const cacheKey = this.getCacheKey();
    if (this.currentExtensionId) {
      return this.currentExtensionId;
    }
    const sharedExtensionId = RingCentralClient.currentExtensionIdCache.get(cacheKey);
    if (sharedExtensionId) {
      this.currentExtensionId = sharedExtensionId;
      return sharedExtensionId;
    }
    const result = await this.apiRequest('/restapi/v1.0/account/~/extension/~', { method: 'GET' });
    if (!result.ok) {
      throw new Error(
        `RingCentral current extension lookup failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    const extensionId = typeof result.body.id === 'string' ? result.body.id : '';
    if (!extensionId) {
      throw new Error('RingCentral current extension lookup missing id');
    }
    this.currentExtensionId = extensionId;
    RingCentralClient.currentExtensionIdCache.set(cacheKey, extensionId);
    return extensionId;
  }

  private async getCurrentUserEmail(): Promise<string> {
    const cacheKey = this.getCacheKey();
    if (this.currentUserEmail) {
      return this.currentUserEmail;
    }
    const sharedEmail = RingCentralClient.currentUserEmailCache.get(cacheKey);
    if (sharedEmail) {
      this.currentUserEmail = sharedEmail;
      return sharedEmail;
    }
    const inFlight = RingCentralClient.currentUserEmailPromiseCache.get(cacheKey);
    if (inFlight) {
      const email = await inFlight;
      this.currentUserEmail = email;
      return email;
    }
    const requestPromise = (async () => {
      const result = await this.apiRequest('/restapi/v1.0/account/~/extension/~', { method: 'GET' });
      if (!result.ok) {
        throw new Error(
          `RingCentral current extension lookup failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
        );
      }
      const body = ensureObject(result.body);
      const contact = ensureObject(body.contact);
      const email = toDisplayString(contact.email, body.email);
      this.currentUserEmail = email;
      if (email) {
        RingCentralClient.currentUserEmailCache.set(cacheKey, email);
      }
      return email;
    })();
    RingCentralClient.currentUserEmailPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.currentUserEmailPromiseCache.delete(cacheKey);
    }
  }

  async listDirectoryUsers(): Promise<Array<{
    entityId: string;
    displayName: string;
    email?: string;
    extensionNumber?: string;
    raw: Record<string, unknown>;
  }>> {
    try {
      const directoryRows = await this.listAccountDirectoryEntries();
      const directoryUsers = directoryRows
        .map((row) => {
          const status = toDisplayString(row.status);
          if (status && status.toLowerCase() !== 'enabled') {
            return null;
          }
          const firstName = toDisplayString(row.firstName);
          const lastName = toDisplayString(row.lastName);
          const displayName = toDisplayString(
            `${firstName} ${lastName}`.trim(),
            toDisplayString(row.name),
            toDisplayString(row.email),
            toDisplayString(row.id),
          );
          const entityId = toDisplayString(row.id);
          if (!entityId || !displayName) {
            return null;
          }
          return {
            entityId,
            displayName,
            email: toDisplayString(row.email) || undefined,
            extensionNumber: toDisplayString(row.extensionNumber) || undefined,
            raw: row,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (directoryUsers.length > 0) {
        return directoryUsers;
      }
    } catch {
      // Fall back to the older extension directory when the company directory is unavailable.
    }

    const rows = await this.listExtensions();
    return rows
      .map((row) => {
        const contact = ensureObject(row.contact);
        const firstName = toDisplayString(contact.firstName, row.firstName);
        const lastName = toDisplayString(contact.lastName, row.lastName);
        const displayName = toDisplayString(
          `${firstName} ${lastName}`.trim(),
          toDisplayString(row.name),
          toDisplayString(contact.email, row.email),
          toDisplayString(row.id),
        );
        const entityId = toDisplayString(row.id);
        if (!entityId || !displayName) {
          return null;
        }
        return {
          entityId,
          displayName,
          email: toDisplayString(contact.email, row.email) || undefined,
          extensionNumber: toDisplayString(row.extensionNumber) || undefined,
          raw: row,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  private async listAccountDirectoryEntries(): Promise<Array<Record<string, unknown>>> {
    const cacheKey = this.getCacheKey();
    const cached = RingCentralClient.directoryEntryListCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    const inFlight = RingCentralClient.directoryEntryListPromiseCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
    const requestPromise = (async () => {
      const records: Array<Record<string, unknown>> = [];
      const seenIds = new Set<string>();
      const perPage = 1000;
      for (let page = 1; page <= 100; page += 1) {
        const pageRecords = await this.fetchDirectoryEntryPage(perPage, page);
        for (const row of pageRecords) {
          const entityId = toDisplayString(row.id);
          if (!entityId || seenIds.has(entityId)) {
            continue;
          }
          seenIds.add(entityId);
          records.push(row);
        }
        if (pageRecords.length < perPage) {
          break;
        }
      }
      RingCentralClient.directoryEntryListCache.set(cacheKey, {
        value: records,
        expiresAt: Date.now() + RingCentralClient.DIRECTORY_CACHE_TTL_MS,
      });
      return records;
    })();
    RingCentralClient.directoryEntryListPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.directoryEntryListPromiseCache.delete(cacheKey);
    }
  }

  async listDirectoryTeams(options?: { interPageDelayMs?: number }): Promise<Array<{
    chatId: string;
    name: string;
    description?: string;
    raw: Record<string, unknown>;
  }>> {
    const results = new Map<string, {
      chatId: string;
      name: string;
      description?: string;
      raw: Record<string, unknown>;
    }>();
    const interPageDelayMs =
      options?.interPageDelayMs ?? RingCentralClient.DIRECTORY_CHAT_INTER_PAGE_DELAY_MS;

    try {
      const discoverableTeams = await this.listTeamsAcrossPages(
        RingCentralClient.DIRECTORY_CHAT_PAGE_SIZE,
        RingCentralClient.TEAM_SEARCH_MAX_PAGES,
        interPageDelayMs,
      );
      for (const team of discoverableTeams) {
        const chatId = toDisplayString(team.id);
        const name = toDisplayString(team.name, team.id);
        if (!chatId || !name) {
          continue;
        }
        results.set(chatId, {
          chatId,
          name,
          description: team.description,
          raw: {
            id: team.id,
            type: team.type,
            name: team.name,
            description: team.description,
            members: team.members,
          },
        });
      }
    } catch {
      // Some tenants do not expose the team directory endpoint. Chats remain a fallback source.
    }

    const chats = await this.listChatsAcrossPages(
      RingCentralClient.DIRECTORY_CHAT_PAGE_SIZE,
      RingCentralClient.CHAT_SEARCH_MAX_PAGES,
      interPageDelayMs,
    );
    for (const chat of chats) {
      const chatType = normalizeSearch(chat.type);
      if ((chatType !== 'team' && chatType !== 'group') || !chat.name?.trim()) {
        continue;
      }
      results.set(chat.id, {
        chatId: chat.id,
        name: toDisplayString(chat.name, chat.id),
        description: chat.description,
        raw: {
          id: chat.id,
          type: chat.type,
          name: chat.name,
          description: chat.description,
          members: chat.members,
        },
      });
    }

    return Array.from(results.values());
  }

  private async listExtensions(): Promise<Array<Record<string, unknown>>> {
    const cacheKey = this.getCacheKey();
    const cached = RingCentralClient.extensionListCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    const inFlight = RingCentralClient.extensionListPromiseCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
    const requestPromise = (async () => {
      const records: Array<Record<string, unknown>> = [];
      const seenIds = new Set<string>();
      const seenTokens = new Set<string>();
      let pageToken: string | undefined;

      for (let page = 0; page < 100; page += 1) {
        const result = await this.fetchExtensionPage(200, pageToken);
        for (const row of result.records) {
          const entityId = toDisplayString(row.id);
          if (!entityId || seenIds.has(entityId)) {
            continue;
          }
          seenIds.add(entityId);
          records.push(row);
        }
        const nextToken = result.nextPageToken;
        if (!nextToken || seenTokens.has(nextToken)) {
          break;
        }
        seenTokens.add(nextToken);
        pageToken = nextToken;
      }

      RingCentralClient.extensionListCache.set(cacheKey, {
        value: records,
        expiresAt: Date.now() + RingCentralClient.DIRECTORY_CACHE_TTL_MS,
      });
      return records;
    })();
    RingCentralClient.extensionListPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.extensionListPromiseCache.delete(cacheKey);
    }
  }

  private async syncUsersDirectory(): Promise<number> {
    if (!this.directoryRepo) return 0;
    const currentTime = now();
    const records = new Map<string, {
      entityId: string;
      displayName: string;
      email?: string;
      extensionNumber?: string;
      searchText: string;
      raw?: Record<string, unknown>;
      updatedAt: number;
    }>();

    for (const item of await this.listDirectoryUsers()) {
      records.set(item.entityId, {
        ...item,
        searchText: [item.displayName, item.email ?? '', item.extensionNumber ?? '', item.entityId].join(' '),
        updatedAt: currentTime,
      });
    }

    const directChats = await this.listChatsAcrossPages(
      RingCentralClient.DIRECTORY_CHAT_PAGE_SIZE,
      RingCentralClient.CHAT_SEARCH_MAX_PAGES,
      RingCentralClient.DIRECTORY_CHAT_INTER_PAGE_DELAY_MS,
    );
    for (const chat of directChats) {
      if (normalizeSearch(chat.type) !== 'direct') {
        continue;
      }
      const label = await this.getChatLabel(chat, true).catch(() => '');
      if (!label) {
        continue;
      }
      const entityId = `chat:${chat.id}`;
      records.set(entityId, {
        entityId,
        displayName: label,
        searchText: [label, chat.description ?? '', chat.id].join(' '),
        raw: {
          candidateKind: 'chat',
          chatId: chat.id,
          chatType: chat.type,
          subtitle: 'Direct chat',
          source: 'chat',
        },
        updatedAt: currentTime,
      });
    }

    this.directoryRepo.replaceUsers(Array.from(records.values()));
    return records.size;
  }

  private async listChats(recordCount = 200): Promise<RingCentralChatSummary[]> {
    return this.listChatsAcrossPages(recordCount, RingCentralClient.CHAT_SEARCH_MAX_PAGES);
  }

  private async listChatsAcrossPages(
    recordCount = 100,
    maxPages = RingCentralClient.CHAT_SEARCH_MAX_PAGES,
    interPageDelayMs = 0,
  ): Promise<RingCentralChatSummary[]> {
    const normalizedRecordCount = Math.max(1, Math.min(recordCount, 200));
    const normalizedMaxPages = Math.max(1, Math.min(maxPages, 100));
    const cacheKey = `${this.getCacheKey()}|${normalizedRecordCount}|${normalizedMaxPages}`;
    const cached = RingCentralClient.chatListCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    const inFlight = RingCentralClient.chatListPromiseCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
    const requestPromise = (async () => {
      const chats: RingCentralChatSummary[] = [];
      const seenChatIds = new Set<string>();
      const seenTokens = new Set<string>();
      let pageToken: string | undefined;

      for (let page = 0; page < normalizedMaxPages; page += 1) {
        const result = await this.fetchChatPage(normalizedRecordCount, pageToken);
        for (const chat of result.records) {
          if (!seenChatIds.has(chat.id)) {
            seenChatIds.add(chat.id);
            chats.push(chat);
          }
        }

        const nextToken = result.nextPageToken;
        if (!nextToken || seenTokens.has(nextToken)) {
          break;
        }
        seenTokens.add(nextToken);
        pageToken = nextToken;
        if (interPageDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, interPageDelayMs));
        }
      }

      RingCentralClient.chatListCache.set(cacheKey, {
        value: chats,
        expiresAt: Date.now() + RingCentralClient.DIRECTORY_CACHE_TTL_MS,
      });
      return chats;
    })();
    RingCentralClient.chatListPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.chatListPromiseCache.delete(cacheKey);
    }
  }

  private async listTeamsAcrossPages(
    recordCount = 100,
    maxPages = RingCentralClient.TEAM_SEARCH_MAX_PAGES,
    interPageDelayMs = 0,
  ): Promise<RingCentralChatSummary[]> {
    const normalizedRecordCount = Math.max(1, Math.min(recordCount, 200));
    const normalizedMaxPages = Math.max(1, Math.min(maxPages, 100));
    const cacheKey = `${this.getCacheKey()}|${normalizedRecordCount}|${normalizedMaxPages}`;
    const cached = RingCentralClient.teamListCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    const inFlight = RingCentralClient.teamListPromiseCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
    const requestPromise = (async () => {
      const teams: RingCentralChatSummary[] = [];
      const seenTeamIds = new Set<string>();
      const seenTokens = new Set<string>();
      let pageToken: string | undefined;

      for (let page = 0; page < normalizedMaxPages; page += 1) {
        const result = await this.fetchTeamPage(normalizedRecordCount, pageToken);
        for (const team of result.records) {
          if (!seenTeamIds.has(team.id)) {
            seenTeamIds.add(team.id);
            teams.push(team);
          }
        }

        const nextToken = result.nextPageToken;
        if (!nextToken || seenTokens.has(nextToken)) {
          break;
        }
        seenTokens.add(nextToken);
        pageToken = nextToken;
        if (interPageDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, interPageDelayMs));
        }
      }

      RingCentralClient.teamListCache.set(cacheKey, {
        value: teams,
        expiresAt: Date.now() + RingCentralClient.DIRECTORY_CACHE_TTL_MS,
      });
      return teams;
    })();
    RingCentralClient.teamListPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.teamListPromiseCache.delete(cacheKey);
    }
  }

  private async syncTeamsDirectory(): Promise<number> {
    if (!this.directoryRepo) return 0;
    const currentTime = now();
    const records = (await this.listDirectoryTeams({
      interPageDelayMs: RingCentralClient.DIRECTORY_CHAT_INTER_PAGE_DELAY_MS,
    })).map((item) => ({
      ...item,
      searchText: [
        item.name,
        item.description ?? '',
        item.chatId,
      ].join(' '),
      updatedAt: currentTime,
    }));
    this.directoryRepo.replaceTeams(records);
    return records.length;
  }

  private async fetchExtensionPage(
    recordCount: number,
    pageToken?: string,
  ): Promise<PagedRingCentralRecords<Record<string, unknown>>> {
    const params = new URLSearchParams();
    params.set('type', 'User');
    params.set('status', 'Enabled');
    params.set('recordCount', String(Math.max(1, Math.min(recordCount, 200))));
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const result = await this.apiRequest(
      `/restapi/v1.0/account/~/extension?${params.toString()}`,
      { method: 'GET' },
    );
    if (!result.ok) {
      throw new Error(
        `RingCentral list extensions failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    const records = Array.isArray(result.body.records)
      ? result.body.records.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      : [];
    const navigation = ensureObject(result.body.navigation);
    return {
      records,
      nextPageToken:
        typeof navigation.nextPageToken === 'string' ? navigation.nextPageToken : undefined,
      prevPageToken:
        typeof navigation.prevPageToken === 'string' ? navigation.prevPageToken : undefined,
    };
  }

  private async fetchDirectoryEntryPage(
    perPage: number,
    page: number,
  ): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams();
    params.set('type', 'User');
    params.set('perPage', String(Math.max(1, Math.min(perPage, 1000))));
    params.set('page', String(Math.max(1, page)));
    const result = await this.apiRequest(
      `/restapi/v1.0/account/~/directory/entries?${params.toString()}`,
      { method: 'GET' },
    );
    if (!result.ok) {
      throw new Error(
        `RingCentral list directory entries failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    return Array.isArray(result.body.records)
      ? result.body.records.filter(
          (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
        )
      : [];
  }

  private async fetchChatPage(
    recordCount: number,
    pageToken?: string,
  ): Promise<PagedRingCentralRecords<RingCentralChatSummary>> {
    const params = new URLSearchParams();
    params.set('recordCount', String(Math.max(1, Math.min(recordCount, 200))));
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const result = await this.apiRequest(`/team-messaging/v1/chats?${params.toString()}`, {
      method: 'GET',
    });
    if (!result.ok) {
      throw new Error(
        `RingCentral list chats failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    const records = Array.isArray(result.body.records) ? result.body.records : [];
    const navigation = ensureObject(result.body.navigation);
    return {
      records: records
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : '',
          type: typeof item.type === 'string' ? item.type : '',
          name: typeof item.name === 'string' ? item.name : undefined,
          description: typeof item.description === 'string' ? item.description : undefined,
          members: Array.isArray(item.members)
            ? item.members
                .map((member) => ensureObject(member))
                .map((member) => (typeof member.id === 'string' ? member.id : ''))
                .filter(Boolean)
            : undefined,
        }))
        .filter((item) => item.id.length > 0),
      nextPageToken:
        typeof navigation.nextPageToken === 'string' ? navigation.nextPageToken : undefined,
      prevPageToken:
        typeof navigation.prevPageToken === 'string' ? navigation.prevPageToken : undefined,
    };
  }

  private async fetchTeamPage(
    recordCount: number,
    pageToken?: string,
  ): Promise<PagedRingCentralRecords<RingCentralChatSummary>> {
    const params = new URLSearchParams();
    params.set('recordCount', String(Math.max(1, Math.min(recordCount, 200))));
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const cacheKey = this.getCacheKey();
    const preferred = RingCentralClient.teamEndpointPreferenceCache.get(cacheKey) ?? 'team-messaging';
    const candidates =
      preferred === 'glip'
        ? ['/glip/teams', '/team-messaging/v1/teams']
        : ['/team-messaging/v1/teams', '/glip/teams'];
    let result: Awaited<ReturnType<RingCentralClient['apiRequest']>> | null = null;
    let lastError: Error | null = null;
    for (const endpoint of candidates) {
      try {
        const next = await this.apiRequest(`${endpoint}?${params.toString()}`, {
          method: 'GET',
        });
        if (next.ok) {
          RingCentralClient.teamEndpointPreferenceCache.set(
            cacheKey,
            endpoint === '/glip/teams' ? 'glip' : 'team-messaging',
          );
          result = next;
          break;
        }
        if (next.status === 404 && endpoint === '/team-messaging/v1/teams') {
          continue;
        }
        result = next;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (endpoint === '/team-messaging/v1/teams') {
          continue;
        }
        throw lastError;
      }
    }
    if (!result) {
      throw lastError ?? new Error('RingCentral list teams failed before receiving a response');
    }
    if (!result.ok) {
      throw new Error(
        `RingCentral list teams failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    const records = Array.isArray(result.body.records) ? result.body.records : [];
    const navigation = ensureObject(result.body.navigation);
    return {
      records: records
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : '',
          type: 'Team',
          name: typeof item.name === 'string' ? item.name : '',
          description: typeof item.description === 'string' ? item.description : '',
        }))
        .filter((item) => item.id.length > 0),
      nextPageToken:
        typeof navigation.nextPageToken === 'string' ? navigation.nextPageToken : undefined,
      prevPageToken:
        typeof navigation.prevPageToken === 'string' ? navigation.prevPageToken : undefined,
    };
  }

  private async getChatById(chatId: string): Promise<RingCentralChatSummary | null> {
    const cacheKey = `${this.getCacheKey()}|${chatId}`;
    const cached = RingCentralClient.chatDetailCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const inFlight = RingCentralClient.chatDetailPromiseCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const requestPromise = (async () => {
      const result = await this.apiRequest(`/team-messaging/v1/chats/${encodeURIComponent(chatId)}`, {
        method: 'GET',
      });
      if (result.status === 404) {
        return null;
      }
      if (!result.ok) {
        throw new Error(
          `RingCentral get chat failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
        );
      }
      const body = ensureObject(result.body);
      const chat: RingCentralChatSummary = {
        id: typeof body.id === 'string' ? body.id : chatId,
        type: typeof body.type === 'string' ? body.type : '',
        name: typeof body.name === 'string' ? body.name : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        members: Array.isArray(body.members)
          ? body.members
              .map((member) => ensureObject(member))
              .map((member) => (typeof member.id === 'string' ? member.id : ''))
              .filter(Boolean)
          : undefined,
      };
      RingCentralClient.chatDetailCache.set(cacheKey, {
        value: chat,
        expiresAt: Date.now() + RingCentralClient.DIRECTORY_CACHE_TTL_MS,
      });
      return chat;
    })();

    RingCentralClient.chatDetailPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.chatDetailPromiseCache.delete(cacheKey);
    }
  }

  private async getPersonById(personId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = `${this.getCacheKey()}|${personId}`;
    const cached = RingCentralClient.personCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const inFlight = RingCentralClient.personPromiseCache.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const requestPromise = (async () => {
      const result = await this.apiRequest(`/team-messaging/v1/persons/${encodeURIComponent(personId)}`, {
        method: 'GET',
      });
      if (result.status === 404) {
        return null;
      }
      if (!result.ok) {
        throw new Error(
          `RingCentral get person failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
        );
      }
      const person = ensureObject(result.body);
      RingCentralClient.personCache.set(cacheKey, {
        value: person,
        expiresAt: Date.now() + RingCentralClient.PERSON_CACHE_TTL_MS,
      });
      return person;
    })();

    RingCentralClient.personPromiseCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      RingCentralClient.personPromiseCache.delete(cacheKey);
    }
  }

  private async ensureConversationChatId(memberIds: string[]): Promise<string> {
    const uniqueMembers = Array.from(new Set(memberIds.map((item) => item.trim()).filter(Boolean)));
    if (uniqueMembers.length === 0) {
      throw new Error('Cannot create RingCentral conversation without member ids');
    }

    const tryCreate = async (ids: string[]) => {
      const result = await this.apiRequest('/team-messaging/v1/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          members: ids.map((id) => ({ id })),
        }),
      });
      if (!result.ok) {
        return null;
      }
      return typeof result.body.id === 'string' ? result.body.id : null;
    };

    const directChatId = await tryCreate(uniqueMembers);
    if (directChatId) {
      return directChatId;
    }

    const selfExtensionId = await this.getCurrentExtensionId();
    const fallbackMembers = Array.from(new Set([selfExtensionId, ...uniqueMembers]));
    const fallbackChatId = await tryCreate(fallbackMembers);
    if (fallbackChatId) {
      return fallbackChatId;
    }

    throw new Error('RingCentral could not create or locate a direct conversation for the selected user.');
  }

  private searchDirectoryCandidates(
    targetType: string,
    query: string,
    limit: number,
  ): RingCentralTargetCandidate[] {
    if (!this.directoryRepo) {
      return [];
    }
    if (normalizeSearch(targetType) === 'group') {
      return this.directoryRepo.searchTeams(query, limit).map((team) => ({
        kind: 'chat' as const,
        entityId: team.chatId,
        chatId: team.chatId,
        label: team.name,
        subtitle: 'Directory team',
        score: buildScore(query, team.name, team.description, team.chatId),
        source: 'chat' as const,
      }));
    }
    return this.directoryRepo.searchUsers(query, limit).map((user) => ({
      ...(ensureObject(user.raw).candidateKind === 'chat' &&
      typeof ensureObject(user.raw).chatId === 'string'
        ? {
            kind: 'chat' as const,
            entityId: String(ensureObject(user.raw).chatId),
            chatId: String(ensureObject(user.raw).chatId),
            label: user.displayName,
            subtitle:
              toDisplayString(ensureObject(user.raw).subtitle) ||
              [user.email, user.extensionNumber ? `ext ${user.extensionNumber}` : '']
                .filter(Boolean)
                .join(' · ') ||
              'Direct chat',
            score: buildScore(
              query,
              user.displayName,
              user.email,
              user.extensionNumber,
              String(ensureObject(user.raw).chatId),
            ),
            source: 'chat' as const,
          }
        : {
            kind: 'user' as const,
            entityId: user.entityId,
            label: user.displayName,
            subtitle: [user.email, user.extensionNumber ? `ext ${user.extensionNumber}` : '']
              .filter(Boolean)
              .join(' · ') || 'Directory user',
            score: buildScore(query, user.displayName, user.email, user.extensionNumber, user.entityId),
            source: 'extension' as const,
          }),
    }));
  }

  private async searchUserCandidates(
    query: string,
    limit: number,
    options?: { includeDirectChats?: boolean },
  ): Promise<RingCentralTargetCandidate[]> {
    const explicitChatId = extractChatIdFromTargetRef(query);
    if (explicitChatId) {
      const directCandidate = await this.getChatCandidateById(
        explicitChatId,
        allowedChatTypesForTargetType('person'),
      );
      if (directCandidate) {
        return [directCandidate];
      }
    }

    const rows = await this.listExtensions();
    const candidates = rows
      .map((row) => {
        const contact = ensureObject(row.contact);
        const firstName = toDisplayString(contact.firstName, row.firstName);
        const lastName = toDisplayString(contact.lastName, row.lastName);
        const fullName = `${firstName} ${lastName}`.trim();
        const email = toDisplayString(contact.email, row.email);
        const extensionNumber = toDisplayString(row.extensionNumber);
        const entityId = toDisplayString(row.id);
        const label = toDisplayString(fullName, toDisplayString(row.name), email, entityId);
        const score = buildScore(query, label, email, extensionNumber, entityId);
        return {
          kind: 'user' as const,
          entityId,
          label,
          subtitle: [email, extensionNumber ? `ext ${extensionNumber}` : ''].filter(Boolean).join(' · ') || undefined,
          score,
          source: 'extension' as const,
        };
      })
      .filter((item) => item.entityId && item.label && item.score > 0);

    if (options?.includeDirectChats) {
      const directChats = await this.searchChatCandidates(query, limit, {
        allowedTypes: new Set(['direct']),
        includeUnnamedChats: true,
        maxPages: 3,
      });
      return this.mergeCandidates([...candidates, ...directChats], limit);
    }

    return this.mergeCandidates(candidates, limit);
  }

  private async searchGroupCandidates(query: string, limit: number): Promise<RingCentralTargetCandidate[]> {
    const explicitChatId = extractChatIdFromTargetRef(query);
    if (explicitChatId) {
      const directCandidate = await this.getChatCandidateById(
        explicitChatId,
        allowedChatTypesForTargetType('group'),
      );
      return directCandidate ? [directCandidate] : [];
    }
    return this.searchTeamCandidates(query, limit);
  }

  private async searchTeamCandidates(query: string, limit: number): Promise<RingCentralTargetCandidate[]> {
    const teams = await this.listDirectoryTeams({
      interPageDelayMs: RingCentralClient.DIRECTORY_CHAT_INTER_PAGE_DELAY_MS,
    });
    const candidates: RingCentralTargetCandidate[] = [];
    for (const team of teams) {
      const label = toDisplayString(team.name, team.chatId);
      const score = buildScore(query, label, team.description, team.chatId);
      if (score <= 0) {
        continue;
      }
      candidates.push({
        kind: 'chat',
        entityId: team.chatId,
        chatId: team.chatId,
        label,
        subtitle: 'Team',
        score,
        source: 'chat',
      });
    }
    return candidates
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit);
  }

  private mergeCandidates(
    items: RingCentralTargetCandidate[],
    limit: number,
  ): RingCentralTargetCandidate[] {
    const deduped = new Map<string, RingCentralTargetCandidate>();
    for (const item of items) {
      if (!item.entityId || !item.label || item.score <= 0) continue;
      const key = `${item.kind}:${item.entityId}`;
      const existing = deduped.get(key);
      if (!existing || item.score > existing.score) {
        deduped.set(key, item);
      }
    }
    return Array.from(deduped.values())
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit);
  }

  private readTargetAliases(): StoredRingCentralTargetAlias[] {
    if (!this.userDataManager) {
      return [];
    }
    try {
      const raw = this.userDataManager.readFile(TARGET_ALIAS_PATH);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is StoredRingCentralTargetAlias =>
            Boolean(
              item &&
                typeof item === 'object' &&
                typeof (item as StoredRingCentralTargetAlias).targetType === 'string' &&
                typeof (item as StoredRingCentralTargetAlias).entityId === 'string' &&
                typeof (item as StoredRingCentralTargetAlias).label === 'string',
            ),
          )
        : [];
    } catch {
      return [];
    }
  }

  private writeTargetAliases(aliases: StoredRingCentralTargetAlias[]): void {
    if (!this.userDataManager) {
      return;
    }
    this.userDataManager.writeFile(TARGET_ALIAS_PATH, JSON.stringify(aliases, null, 2));
  }

  private rememberCandidate(targetType: string, candidate: RingCentralTargetCandidate): void {
    if (!candidate.entityId || !candidate.label) {
      return;
    }
    const normalizedTargetType = normalizeSearch(targetType);
    const aliases = this.readTargetAliases();
    const alias: StoredRingCentralTargetAlias = {
      targetType: normalizedTargetType,
      kind: candidate.kind,
      entityId: candidate.entityId,
      chatId: candidate.chatId,
      label: candidate.label,
      subtitle: candidate.subtitle,
      source: candidate.source,
      updatedAt: Date.now(),
    };
    const next = aliases.filter(
      (item) =>
        !(
          item.targetType === alias.targetType &&
          item.kind === alias.kind &&
          item.entityId === alias.entityId
        ),
    );
    next.unshift(alias);
    this.writeTargetAliases(next.slice(0, 5000));
  }

  private searchAliasCandidates(
    targetType: string,
    query: string,
    limit: number,
  ): RingCentralTargetCandidate[] {
    const normalizedTargetType = normalizeSearch(targetType);
    return this.readTargetAliases()
      .filter((item) => item.targetType === normalizedTargetType)
      .map((item) => ({
        kind: item.kind,
        entityId: item.entityId,
        chatId: item.chatId,
        label: item.label,
        subtitle: item.subtitle,
        source: item.source,
        score: buildScore(query, item.label, item.subtitle, item.chatId, item.entityId),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit);
  }

  private async searchChatCandidates(
    query: string,
    limit: number,
    options: {
      allowedTypes: Set<string>;
      includeUnnamedChats: boolean;
      maxPages: number;
    },
  ): Promise<RingCentralTargetCandidate[]> {
    const chats = await this.listChatsAcrossPages(
      RingCentralClient.DIRECTORY_CHAT_PAGE_SIZE,
      options.maxPages,
      RingCentralClient.DIRECTORY_CHAT_INTER_PAGE_DELAY_MS,
    );
    const quickCandidates: RingCentralTargetCandidate[] = [];
    const deferredChats: RingCentralChatSummary[] = [];
    for (const chat of chats) {
      const chatType = normalizeSearch(chat.type);
      if (!options.allowedTypes.has(chatType)) {
        continue;
      }
      const label = toDisplayString(chat.name, chat.id);
      const score = buildScore(query, label, chat.description, chat.id);
      if (score > 0) {
        quickCandidates.push({
          kind: 'chat',
          entityId: chat.id,
          chatId: chat.id,
          label,
          subtitle: toDisplayString(chat.type, chat.description) || undefined,
          score,
          source: 'chat',
        });
        continue;
      }
      if (options.includeUnnamedChats && !chat.name) {
        deferredChats.push(chat);
      }
    }
    if (quickCandidates.length > 0 || deferredChats.length === 0) {
      return quickCandidates
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, limit);
    }

    const candidates = [...quickCandidates];
    for (const chat of deferredChats.slice(0, RingCentralClient.UNNAMED_CHAT_MEMBER_LOOKUP_LIMIT)) {
      const participantLabel = await this.buildParticipantLabel(chat);
      if (!participantLabel) continue;
      const score = buildScore(query, participantLabel, chat.description, chat.id);
      if (score <= 0) continue;
      candidates.push({
        kind: 'chat',
        entityId: chat.id,
        chatId: chat.id,
        label: participantLabel,
        subtitle: toDisplayString(chat.type, chat.description) || undefined,
        score,
        source: 'chat',
      });
    }
    return candidates
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit);
  }

  private async buildChatCandidate(
    chat: RingCentralChatSummary,
    query?: string,
    includeUnnamedChats = true,
  ): Promise<RingCentralTargetCandidate | null> {
    const label = await this.getChatLabel(chat, includeUnnamedChats);
    if (!label) {
      return null;
    }
    const score = buildScore(query ?? chat.id, label, chat.description, chat.id);
    return {
      kind: 'chat',
      entityId: chat.id,
      chatId: chat.id,
      label,
      subtitle: toDisplayString(chat.type, chat.description) || undefined,
      score,
      source: 'chat',
    };
  }

  private async getChatCandidateById(
    chatId: string,
    allowedTypes?: Set<string>,
  ): Promise<RingCentralTargetCandidate | null> {
    const chat = await this.getChatById(chatId);
    if (!chat) return null;
    if (allowedTypes && !allowedTypes.has(normalizeSearch(chat.type))) {
      return null;
    }
    return this.buildChatCandidate(chat, chatId, true);
  }

  private async getChatLabel(chat: RingCentralChatSummary, includeUnnamedChats: boolean): Promise<string> {
    const directLabel = toDisplayString(chat.name, chat.id);
    if (chat.name && chat.name.trim()) {
      return directLabel;
    }
    if (!includeUnnamedChats) {
      return directLabel;
    }
    const participantLabel = await this.buildParticipantLabel(chat);
    return toDisplayString(participantLabel, directLabel);
  }

  private async buildParticipantLabel(chat: RingCentralChatSummary): Promise<string> {
    const memberIds = Array.isArray(chat.members) ? chat.members.filter(Boolean) : [];
    if (memberIds.length === 0) {
      return '';
    }
    const selfExtensionId = await this.getCurrentExtensionId().catch(() => '');
    const selfEmail = normalizeSearch(await this.getCurrentUserEmail().catch(() => ''));
    const visibleMemberIds = memberIds.filter((memberId) => memberId !== selfExtensionId);
    const memberIdsToResolve = visibleMemberIds.length > 0 ? visibleMemberIds : memberIds;
    const displayNames: string[] = [];
    for (const memberId of memberIdsToResolve.slice(0, 5)) {
      const person = await this.getPersonById(memberId).catch(() => null);
      if (!person) continue;
      const normalizedPersonEmail = normalizeSearch(toDisplayString(person.email));
      if (selfEmail && normalizedPersonEmail && normalizedPersonEmail === selfEmail) {
        continue;
      }
      const label = toDisplayString(
        `${toDisplayString(person.firstName)} ${toDisplayString(person.lastName)}`.trim(),
        person.email,
        memberId,
      );
      if (label) {
        displayNames.push(label);
      }
    }
    return displayNames.join(', ');
  }
}
