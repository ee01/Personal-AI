import crypto from 'node:crypto';

import type {
  BrowserConversationMessageSnapshot,
  BrowserConversationSnapshot,
} from '../../browserSession.js';
import { BridgeMemoryServiceClient } from '../../memoryServiceClient.js';
import type { BridgeSettingsStore } from '../../settings.js';
import type { BridgeAuthStatus } from '../../types.js';
import { RawMessageStore } from '../cache/RawMessageStore.js';
import { CursorStore } from '../CursorStore.js';
import { ExplorerExtractor } from '../extractor.js';
import type { ExplorationCursor, RawMessageRecord } from '../types.js';
import { filterDoubaoSyncMessages } from './doubaoSyncFilter.js';

const DOUBAO_BATCH_SIZE = 3;
const DOUBAO_BATCH_THROTTLE_MS = 250;

export interface DoubaoConversationCollectorClient {
  openLogin(): Promise<string>;
  probeAuthStatus(): Promise<'connected' | 'needs_login'>;
  collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]>;
}

export interface DoubaoSourceOptions {
  /**
   * Returns the set of Doubao conversation ids that are bound as Personal AI
   * sync threads (memory_sync / mobile_context). Messages from these
   * conversations are skipped entirely so we never re-ingest our own pushes.
   */
  getBoundConversationIds?: () => ReadonlySet<string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeRole(roleHint?: string): string {
  const normalized = roleHint?.trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }
  if (/assistant|doubao|bot|ai|模型/.test(normalized)) {
    return 'assistant';
  }
  if (/user|human|me|我|我的/.test(normalized)) {
    return 'user';
  }
  return normalized;
}

function hashMessageContent(role: string, content: string): string {
  return crypto
    .createHash('sha256')
    .update(`${role}\n${content}`)
    .digest('hex');
}

function hashSyntheticMessageId(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function parseDoubaoTimeLabel(
  value: string | undefined,
  now = new Date(),
): string | undefined {
  const label = value?.trim();
  if (!label) {
    return undefined;
  }

  const numeric = Number(label);
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric > 1e12 ? numeric : numeric * 1000;
    return new Date(millis).toISOString();
  }

  const direct = Date.parse(label);
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  if (label === '刚刚') {
    return now.toISOString();
  }

  const relativePatterns: Array<[RegExp, number]> = [
    [/^(\d+)\s*分钟前$/, 60_000],
    [/^(\d+)\s*小时前$/, 60 * 60_000],
    [/^(\d+)\s*天前$/, 24 * 60 * 60_000],
  ];
  for (const [pattern, unitMs] of relativePatterns) {
    const match = label.match(pattern);
    if (match?.[1]) {
      return new Date(now.getTime() - Number(match[1]) * unitMs).toISOString();
    }
  }

  const timeOnlyMatch = label.match(/^(今天|昨天|前天)?\s*(\d{1,2}):(\d{2})$/);
  if (timeOnlyMatch) {
    const dayLabel = timeOnlyMatch[1];
    const hours = Number(timeOnlyMatch[2]);
    const minutes = Number(timeOnlyMatch[3]);
    const date = new Date(now);
    if (dayLabel === '昨天') {
      date.setDate(date.getDate() - 1);
    } else if (dayLabel === '前天') {
      date.setDate(date.getDate() - 2);
    }
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  }

  const chineseDateMatch = label.match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (chineseDateMatch) {
    const [, year, month, day, hours = '0', minutes = '0'] = chineseDateMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      0,
      0,
    ).toISOString();
  }

  const monthDayMatch = label.match(
    /^(\d{1,2})[\/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  if (monthDayMatch) {
    const [, month, day, hours = '0', minutes = '0'] = monthDayMatch;
    return new Date(
      now.getFullYear(),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      0,
      0,
    ).toISOString();
  }

  return undefined;
}

function isConversationWithinLookback(
  snapshot: BrowserConversationSnapshot,
  lookbackDays: number,
  now = new Date(),
): boolean {
  if (lookbackDays <= 0) {
    return true;
  }
  const updatedAt = parseDoubaoTimeLabel(snapshot.updatedLabel, now);
  if (!updatedAt) {
    return true;
  }
  const cutoff = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  return Date.parse(updatedAt) >= cutoff;
}

function isSnapshotComplete(
  snapshot: BrowserConversationSnapshot,
  messages: RawMessageRecord[],
  now: Date,
): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return false;
  }

  if (snapshot.updatedLabel?.trim() === '刚刚') {
    return false;
  }

  if (lastMessage.role === 'assistant') {
    return true;
  }

  const updatedAt =
    parseDoubaoTimeLabel(snapshot.updatedLabel, now) ?? lastMessage.ts;
  if (!updatedAt) {
    return true;
  }

  return Date.parse(updatedAt) <= now.getTime() - 5 * 60 * 1000;
}

export function buildDoubaoRawMessages(
  snapshot: BrowserConversationSnapshot,
  now = new Date(),
): RawMessageRecord[] {
  const conversationTimestamp = parseDoubaoTimeLabel(
    snapshot.updatedLabel,
    now,
  );

  return snapshot.messages.flatMap((message, index) => {
    const content = compactText(message.content);
    if (!content) {
      return [];
    }

    const role = normalizeRole(message.roleHint);
    const ts =
      parseDoubaoTimeLabel(message.timestampLabel, now) ||
      conversationTimestamp;
    const messageId =
      message.messageId?.trim() ||
      hashSyntheticMessageId(
        [snapshot.conversationId, role, ts || '', String(index), content].join(
          '\n',
        ),
      );

    return [
      {
        source: 'doubao' as const,
        conversationId: snapshot.conversationId,
        messageId,
        ts,
        role,
        contentHash: hashMessageContent(role, content),
        content,
      },
    ];
  });
}

export class DoubaoChatSource {
  private readonly extractor: ExplorerExtractor;

  constructor(
    private readonly settingsStore: Pick<BridgeSettingsStore, 'getSettings'>,
    private readonly rawStore: RawMessageStore,
    private readonly cursorStore: CursorStore,
    memoryClient: BridgeMemoryServiceClient,
    private readonly client: DoubaoConversationCollectorClient,
    private readonly options: DoubaoSourceOptions = {},
  ) {
    this.extractor = new ExplorerExtractor(memoryClient, rawStore);
  }

  async getAuthStatus(): Promise<BridgeAuthStatus> {
    try {
      return await this.client.probeAuthStatus();
    } catch {
      return 'error';
    }
  }

  async openLogin(): Promise<{
    url?: string;
    opened?: boolean;
    implemented?: boolean;
  }> {
    const url = await this.client.openLogin();
    return { url, opened: true, implemented: true };
  }

  async runNow(): Promise<{ insertedCount?: number; implemented?: boolean }> {
    const settings = this.settingsStore.getSettings().explorer;
    const authStatus = await this.client.probeAuthStatus();
    if (authStatus !== 'connected') {
      throw new Error(
        'Doubao login required before running explorer collection.',
      );
    }

    const snapshots = await this.client.collectConversationSnapshots();
    const now = new Date();
    let insertedCount = 0;
    const processedCursors: ExplorationCursor[] = [];

    for (const [index, snapshot] of snapshots.entries()) {
      if (
        !isConversationWithinLookback(
          snapshot,
          settings.doubao.lookbackDays,
          now,
        )
      ) {
        continue;
      }

      const rawMessages = buildDoubaoRawMessages(snapshot, now);
      const { kept: messages, conversationDropped } = filterDoubaoSyncMessages(
        rawMessages,
        {
          boundConversationIds: this.options.getBoundConversationIds?.(),
        },
      );
      if (conversationDropped) {
        continue;
      }
      if (
        messages.length === 0 ||
        !isSnapshotComplete(snapshot, messages, now)
      ) {
        continue;
      }

      const cursor = await this.cursorStore.get(
        'doubao',
        snapshot.conversationId,
      );
      if (!this.shouldCollectSnapshot(snapshot, messages, cursor, now)) {
        continue;
      }

      insertedCount += this.rawStore.insertMany(messages);
      processedCursors.push(
        this.buildCursor(
          snapshot.conversationId,
          snapshot.updatedLabel,
          messages,
          now,
        ),
      );

      if (
        (index + 1) % DOUBAO_BATCH_SIZE === 0 &&
        index + 1 < snapshots.length
      ) {
        await sleep(DOUBAO_BATCH_THROTTLE_MS);
      }
    }

    await this.extractor.extractPendingMessages({
      source: 'doubao',
      defaultScope: settings.doubao.defaultScope,
      autoClassify: settings.autoClassify,
    });

    for (const cursor of processedCursors) {
      await this.cursorStore.upsert(cursor);
    }

    return { insertedCount, implemented: true };
  }

  private shouldCollectSnapshot(
    snapshot: BrowserConversationSnapshot,
    messages: RawMessageRecord[],
    cursor: ExplorationCursor | undefined,
    now: Date,
  ): boolean {
    if (!cursor) {
      return true;
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) {
      return false;
    }

    const snapshotUpdatedAt =
      parseDoubaoTimeLabel(snapshot.updatedLabel, now) ?? latestMessage.ts;
    const cursorUpdatedAt = cursor.lastProcessedUpdateTime
      ? Date.parse(cursor.lastProcessedUpdateTime)
      : Number.NaN;
    const snapshotUpdatedAtMs = snapshotUpdatedAt
      ? Date.parse(snapshotUpdatedAt)
      : Number.NaN;

    const sameTail =
      cursor.lastMessageId === latestMessage.messageId &&
      cursor.contentHash === latestMessage.contentHash;
    if (!sameTail) {
      return true;
    }

    if (
      !Number.isFinite(snapshotUpdatedAtMs) ||
      !Number.isFinite(cursorUpdatedAt)
    ) {
      return false;
    }

    return snapshotUpdatedAtMs > cursorUpdatedAt;
  }

  private buildCursor(
    conversationId: string,
    updatedLabel: string | undefined,
    messages: RawMessageRecord[],
    now: Date,
  ): ExplorationCursor {
    const lastMessage = messages[messages.length - 1]!;
    return {
      source: 'doubao',
      conversationId,
      lastMessageId: lastMessage.messageId,
      lastProcessedUpdateTime:
        parseDoubaoTimeLabel(updatedLabel, now) ??
        lastMessage.ts ??
        now.toISOString(),
      contentHash: lastMessage.contentHash,
    };
  }
}
