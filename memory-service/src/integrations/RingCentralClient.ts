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
  private tokenState: TokenState | null = null;
  private currentExtensionId: string | null = null;

  constructor(private readonly userDataManager?: UserDataManager) {}

  private getRuntimeConfig() {
    return getUserRuntimeConfig(this.userDataManager);
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
    if (this.tokenState && Date.now() < this.tokenState.expiresAt) {
      return this.tokenState.accessToken;
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

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
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

    this.tokenState = {
      accessToken,
      expiresAt: parseExpiry(payload.expires_in),
    };
    return accessToken;
  }

  private async apiRequest(
    path: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
    const config = this.getRuntimeConfig();
    const serverUrl = trimTrailingSlash(config.ringCentralServerUrl);
    const token = await this.getAccessToken();
    const url = `${serverUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });

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

    if ((normalizedTargetType === 'group' || normalizedTargetType === 'private') && /^chat[-_]/i.test(query)) {
      return {
        status: 'resolved',
        query,
        resolved: {
          kind: 'chat',
          entityId: query,
          chatId: query,
          label: query,
          score: 100,
          source: 'chat',
        },
        candidates: [
          {
            kind: 'chat',
            entityId: query,
            chatId: query,
            label: query,
            score: 100,
            source: 'chat',
          },
        ],
      };
    }

    const candidates =
      normalizedTargetType === 'group'
        ? await this.searchGroupCandidates(query, limit)
        : await this.searchUserCandidates(query, limit);

    if (candidates.length === 0) {
      return { status: 'unresolved', query, candidates: [] };
    }

    const top = candidates[0];
    const second = candidates[1];
    const uniquelyResolved = top.score >= 90 && (!second || top.score >= second.score + 8);
    if (uniquelyResolved) {
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
    if (this.currentExtensionId) {
      return this.currentExtensionId;
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
    return extensionId;
  }

  private async listExtensions(): Promise<Array<Record<string, unknown>>> {
    const result = await this.apiRequest(
      '/restapi/v1.0/account/~/extension?type=User&status=Enabled&recordCount=200',
      { method: 'GET' },
    );
    if (!result.ok) {
      throw new Error(
        `RingCentral list extensions failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    return Array.isArray(result.body.records)
      ? result.body.records.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      : [];
  }

  private async listChats(recordCount = 200): Promise<RingCentralChatSummary[]> {
    const result = await this.apiRequest(
      `/team-messaging/v1/chats?recordCount=${Math.max(1, Math.min(recordCount, 200))}`,
      { method: 'GET' },
    );
    if (!result.ok) {
      throw new Error(
        `RingCentral list chats failed (${result.status}): ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }
    const records = Array.isArray(result.body.records) ? result.body.records : [];
    return records
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        type: typeof item.type === 'string' ? item.type : '',
        name: typeof item.name === 'string' ? item.name : undefined,
        description: typeof item.description === 'string' ? item.description : undefined,
      }))
      .filter((item) => item.id.length > 0);
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
      .filter((item) => item.entityId && item.label && item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit);
    return candidates;
  }

  private async searchGroupCandidates(query: string, limit: number): Promise<RingCentralTargetCandidate[]> {
    const chats = await this.listChats();
    return chats
      .map((chat) => {
        const label = toDisplayString(chat.name, chat.id);
        const score = buildScore(query, label, chat.description, chat.id);
        return {
          kind: 'chat' as const,
          entityId: chat.id,
          chatId: chat.id,
          label,
          subtitle: toDisplayString(chat.type, chat.description) || undefined,
          score,
          source: 'chat' as const,
        };
      })
      .filter((item) => item.label && item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit);
  }
}
