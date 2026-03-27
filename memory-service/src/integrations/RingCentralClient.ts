import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';

export interface RingCentralPost {
  id: string;
  chatId: string;
  text: string;
  creatorId?: string;
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
  private static readonly PERSON_CACHE_TTL_MS = 5 * 60_000;
  private static readonly CHAT_SEARCH_MAX_PAGES = 100;
  private static readonly TEAM_SEARCH_MAX_PAGES = 100;
  private static readonly UNNAMED_CHAT_MEMBER_LOOKUP_LIMIT = 40;
  private static readonly REQUEST_TIMEOUT_MS = 10_000;
  private static readonly tokenCache = new Map<string, TokenState>();
  private static readonly tokenPromiseCache = new Map<string, Promise<TokenState>>();
  private static readonly currentExtensionIdCache = new Map<string, string>();
  private static readonly currentUserEmailCache = new Map<string, string>();
  private static readonly currentUserEmailPromiseCache = new Map<string, Promise<string>>();
  private static readonly extensionListCache = new Map<string, TimedCacheEntry<Array<Record<string, unknown>>>>();
  private static readonly extensionListPromiseCache = new Map<string, Promise<Array<Record<string, unknown>>>>();
  private static readonly teamListCache = new Map<string, TimedCacheEntry<RingCentralChatSummary[]>>();
  private static readonly teamListPromiseCache = new Map<string, Promise<RingCentralChatSummary[]>>();
  private static readonly chatListCache = new Map<string, TimedCacheEntry<RingCentralChatSummary[]>>();
  private static readonly chatListPromiseCache = new Map<string, Promise<RingCentralChatSummary[]>>();
  private static readonly chatDetailCache = new Map<string, TimedCacheEntry<RingCentralChatSummary>>();
  private static readonly chatDetailPromiseCache = new Map<string, Promise<RingCentralChatSummary | null>>();
  private static readonly personCache = new Map<string, TimedCacheEntry<Record<string, unknown>>>();
  private static readonly personPromiseCache = new Map<string, Promise<Record<string, unknown> | null>>();
  private tokenState: TokenState | null = null;
  private currentExtensionId: string | null = null;
  private currentUserEmail: string | null = null;

  constructor(private readonly userDataManager?: UserDataManager) {}

  static clearSharedCacheForTests(): void {
    this.tokenCache.clear();
    this.tokenPromiseCache.clear();
    this.currentExtensionIdCache.clear();
    this.currentUserEmailCache.clear();
    this.currentUserEmailPromiseCache.clear();
    this.extensionListCache.clear();
    this.extensionListPromiseCache.clear();
    this.teamListCache.clear();
    this.teamListPromiseCache.clear();
    this.chatListCache.clear();
    this.chatListPromiseCache.clear();
    this.chatDetailCache.clear();
    this.chatDetailPromiseCache.clear();
    this.personCache.clear();
    this.personPromiseCache.clear();
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
    }

    const liveCandidates =
      normalizedTargetType === 'group'
        ? await this.searchGroupCandidates(query, limit)
        : await this.searchUserCandidates(query, limit);
    const candidates = this.mergeCandidates([...rememberedCandidates, ...liveCandidates], limit);

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

  async searchTargets(input: ResolveRingCentralTargetInput): Promise<RingCentralTargetCandidate[]> {
    const result = await this.resolveTarget(input);
    return result.candidates;
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
    return records
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        chatId,
        text: typeof item.text === 'string' ? item.text : '',
        creatorId:
          item.creator && typeof item.creator === 'object' && typeof (item.creator as Record<string, unknown>).id === 'string'
            ? ((item.creator as Record<string, unknown>).id as string)
            : undefined,
        createdAt: typeof item.creationTime === 'string' ? item.creationTime : undefined,
        raw: item,
      }))
      .filter((item) => item.id.length > 0);
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
      const result = await this.apiRequest(
        '/restapi/v1.0/account/~/extension?type=User&status=Enabled&recordCount=200',
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

  private async listChats(recordCount = 200): Promise<RingCentralChatSummary[]> {
    return this.listChatsAcrossPages(recordCount, RingCentralClient.CHAT_SEARCH_MAX_PAGES);
  }

  private async listChatsAcrossPages(
    recordCount = 100,
    maxPages = RingCentralClient.CHAT_SEARCH_MAX_PAGES,
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

        const nextToken = result.nextPageToken || result.prevPageToken;
        if (!nextToken || seenTokens.has(nextToken)) {
          break;
        }
        seenTokens.add(nextToken);
        pageToken = nextToken;
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

        const nextToken = result.prevPageToken || result.nextPageToken;
        if (!nextToken || seenTokens.has(nextToken)) {
          break;
        }
        seenTokens.add(nextToken);
        pageToken = nextToken;
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
    let result = await this.apiRequest(`/team-messaging/v1/teams?${params.toString()}`, {
      method: 'GET',
    });
    if (result.status === 404) {
      result = await this.apiRequest(`/glip/teams?${params.toString()}`, {
        method: 'GET',
      });
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

  private async searchUserCandidates(query: string, limit: number): Promise<RingCentralTargetCandidate[]> {
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

    const directChats = await this.searchChatCandidates(query, limit, {
      allowedTypes: new Set(['direct']),
      includeUnnamedChats: true,
      maxPages: 3,
    });

    return this.mergeCandidates([...candidates, ...directChats], limit);
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
    const teamCandidates = await this.searchTeamCandidates(query, limit);
    const chatCandidates = await this.searchChatCandidates(query, limit, {
      allowedTypes: new Set(['team', 'group']),
      includeUnnamedChats: false,
      maxPages: RingCentralClient.CHAT_SEARCH_MAX_PAGES,
    });
    return this.mergeCandidates([...teamCandidates, ...chatCandidates], limit);
  }

  private async searchTeamCandidates(query: string, limit: number): Promise<RingCentralTargetCandidate[]> {
    const teams = await this.listTeamsAcrossPages(200, RingCentralClient.TEAM_SEARCH_MAX_PAGES);
    const candidates: RingCentralTargetCandidate[] = [];
    for (const team of teams) {
      const label = toDisplayString(team.name, team.id);
      const score = buildScore(query, label, team.description, team.id);
      if (score <= 0) {
        continue;
      }
      candidates.push({
        kind: 'chat',
        entityId: team.id,
        chatId: team.id,
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
    const chats = await this.listChatsAcrossPages(200, options.maxPages);
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
