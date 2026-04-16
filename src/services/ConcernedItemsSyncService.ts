import {
  getMemoryServiceClient,
  MemoryServiceError,
  type ConcernedItemsSnapshotResponse,
  type FollowThreadHitEvent,
} from './MemoryServiceClient';
import type { TopicItemWithAutoReply } from '../message-reaction';
import type { RelatedMessageMeta } from '../types/followThread';
import {
  isManualConcernedItem,
  mergeManualConcernedItemsPreservingSystem,
} from '../watchRules';

const CONCERNED_ITEMS_KEY = 'concernedItems';
const SYNC_STATE_KEY = 'concernedItemsSyncState';
const PENDING_HITS_KEY = 'concernedItemsPendingHits';
const PUSH_DEBOUNCE_MS = 1500;

interface ConcernedItemsSyncState {
  deviceId?: string;
  snapshotVersion?: number;
  lastSnapshotSyncAt?: string;
  contentUpdatedAt?: string;
  lastHitSyncAt?: string;
  lastSyncedBaseUrl?: string;
  configDirty?: boolean;
}

interface PendingFollowThreadHit extends FollowThreadHitEvent {
  createdAt: string;
  sourceDevice: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseTimestampMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getComparableContentUpdatedAt(
  value?: string | null,
  fallback?: string | null,
): number {
  return parseTimestampMs(value) ?? parseTimestampMs(fallback) ?? 0;
}

function stripRuntimeFields(
  items: TopicItemWithAutoReply[],
): TopicItemWithAutoReply[] {
  return items.map((item) => {
    const nextItem: TopicItemWithAutoReply = clone(item);
    if (nextItem.followConfig) {
      const {
        relatedMessages: _relatedMessages,
        lastCheckedAt: _lastCheckedAt,
        lastNotifiedAt: _lastNotifiedAt,
        ...restFollowConfig
      } = nextItem.followConfig;
      nextItem.followConfig = {
        ...restFollowConfig,
        relatedMessages: [],
      };
    }
    return nextItem;
  });
}

function mergeRuntimeFields(
  localItems: TopicItemWithAutoReply[],
  remoteItems: TopicItemWithAutoReply[],
): TopicItemWithAutoReply[] {
  const localById = new Map(localItems.map((item) => [item.id, item]));

  return remoteItems.map((remoteItem) => {
    const localItem = localById.get(remoteItem.id);
    const nextItem: TopicItemWithAutoReply = clone(remoteItem);

    if (nextItem.followConfig) {
      const localFollow = localItem?.followConfig;
      nextItem.followConfig = {
        ...nextItem.followConfig,
        relatedMessages: Array.isArray(localFollow?.relatedMessages)
          ? clone(localFollow.relatedMessages)
          : [],
        lastCheckedAt: localFollow?.lastCheckedAt,
        lastNotifiedAt: localFollow?.lastNotifiedAt,
      };
    }

    return nextItem;
  });
}

function makeHitKey(
  hit: Pick<FollowThreadHitEvent, 'followItemId' | 'postId'>,
): string {
  return `${hit.followItemId}::${hit.postId}`;
}

function toRelatedMessageMeta(hit: FollowThreadHitEvent): RelatedMessageMeta {
  return {
    postId: hit.postId,
    sender: hit.sender,
    datetime: hit.datetime,
    relationType: hit.relationType as RelatedMessageMeta['relationType'],
    summary: hit.summary,
    notifiedAt: hit.createdAt,
  };
}

export class ConcernedItemsSyncService {
  private static instance: ConcernedItemsSyncService | null = null;
  private initialized = false;
  private applyingRemoteSnapshot = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  static getInstance(): ConcernedItemsSyncService {
    if (!ConcernedItemsSyncService.instance) {
      ConcernedItemsSyncService.instance = new ConcernedItemsSyncService();
    }
    return ConcernedItemsSyncService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDeviceId();
    chrome.storage.onChanged.addListener(this.handleStorageChange);
    this.initialized = true;
  }

  async syncOnStartup(): Promise<void> {
    await this.initialize();
    await this.bootstrapSnapshotState();
    await this.flushConfigPush();
    await this.flushPendingHits();
    try {
      await this.pullConcernedItemsSnapshot();
      await this.pullFollowThreadHits();
    } catch (error) {
      console.warn('ConcernedItems startup sync failed:', error);
    }
  }

  async syncOnSilentAnalysisStart(): Promise<void> {
    await this.syncOnStartup();
  }

  async runPeriodicSync(): Promise<void> {
    await this.initialize();
    await this.bootstrapSnapshotState();
    await this.flushConfigPush();
    await this.flushPendingHits();
    try {
      await this.pullConcernedItemsSnapshot();
      await this.pullFollowThreadHits();
    } catch (error) {
      console.warn('ConcernedItems periodic sync failed:', error);
    }
  }

  async enqueueFollowThreadHit(hit: FollowThreadHitEvent): Promise<void> {
    await this.initialize();

    const deviceId = await this.ensureDeviceId();
    const payload: PendingFollowThreadHit = {
      ...hit,
      createdAt: hit.createdAt || new Date().toISOString(),
      sourceDevice: hit.sourceDevice || deviceId,
    };

    const result = await chrome.storage.local.get(PENDING_HITS_KEY);
    const pendingHits: PendingFollowThreadHit[] =
      result[PENDING_HITS_KEY] || [];
    const existingIndex = pendingHits.findIndex(
      (item) => makeHitKey(item) === makeHitKey(payload),
    );

    if (existingIndex >= 0) {
      pendingHits[existingIndex] = payload;
    } else {
      pendingHits.push(payload);
    }

    await chrome.storage.local.set({ [PENDING_HITS_KEY]: pendingHits });
    void this.flushPendingHits();
  }

  private handleStorageChange = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[CONCERNED_ITEMS_KEY]) {
      return;
    }

    if (this.applyingRemoteSnapshot) {
      return;
    }

    const oldSnapshot = stripRuntimeFields(
      changes[CONCERNED_ITEMS_KEY].oldValue || [],
    );
    const newSnapshot = stripRuntimeFields(
      changes[CONCERNED_ITEMS_KEY].newValue || [],
    );

    if (stableSerialize(oldSnapshot) === stableSerialize(newSnapshot)) {
      return;
    }

    void this.markConfigDirty(new Date().toISOString());
    this.scheduleConfigPush();
  };

  private scheduleConfigPush(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }

    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.flushConfigPush();
    }, PUSH_DEBOUNCE_MS);
  }

  private async ensureDeviceId(): Promise<string> {
    const result = await chrome.storage.local.get(SYNC_STATE_KEY);
    const state: ConcernedItemsSyncState = result[SYNC_STATE_KEY] || {};

    if (state.deviceId) {
      return state.deviceId;
    }

    const deviceId = crypto.randomUUID();
    await chrome.storage.local.set({
      [SYNC_STATE_KEY]: {
        ...state,
        deviceId,
      },
    });
    return deviceId;
  }

  private async getSyncState(): Promise<ConcernedItemsSyncState> {
    const result = await chrome.storage.local.get(SYNC_STATE_KEY);
    return result[SYNC_STATE_KEY] || {};
  }

  private async setSyncState(
    patch: Partial<ConcernedItemsSyncState>,
  ): Promise<ConcernedItemsSyncState> {
    const current = await this.getSyncState();
    const next = {
      ...current,
      ...patch,
    };
    await chrome.storage.local.set({ [SYNC_STATE_KEY]: next });
    return next;
  }

  private async markConfigDirty(contentUpdatedAt: string): Promise<void> {
    await this.setSyncState({
      configDirty: true,
      contentUpdatedAt,
    });
  }

  private async bootstrapSnapshotState(): Promise<void> {
    const state = await this.getSyncState();
    const client = getMemoryServiceClient();
    const currentBaseUrl = client.getBaseUrl();
    const result = await chrome.storage.local.get(CONCERNED_ITEMS_KEY);
    const concernedItems: TopicItemWithAutoReply[] = (
      result[CONCERNED_ITEMS_KEY] || []
    ).filter(isManualConcernedItem);
    const snapshotItems = stripRuntimeFields(concernedItems);

    if (
      (state.snapshotVersion ?? 0) > 0 &&
      state.contentUpdatedAt &&
      state.lastSyncedBaseUrl === currentBaseUrl
    ) {
      return;
    }

    try {
      const remote = await client.getConcernedItemsSnapshot();
      const localContentUpdatedAt = getComparableContentUpdatedAt(
        state.contentUpdatedAt,
        state.lastSnapshotSyncAt,
      );
      const remoteContentUpdatedAt = getComparableContentUpdatedAt(
        remote.contentUpdatedAt,
        remote.updatedAt,
      );
      const hasLegacySyncedState =
        !state.lastSyncedBaseUrl &&
        (state.snapshotVersion ?? 0) > 0 &&
        Boolean(state.contentUpdatedAt);
      const syncTargetChanged =
        state.lastSyncedBaseUrl && state.lastSyncedBaseUrl !== currentBaseUrl;

      if (
        (syncTargetChanged || hasLegacySyncedState) &&
        snapshotItems.length > 0 &&
        localContentUpdatedAt > remoteContentUpdatedAt
      ) {
        await this.markConfigDirty(
          state.contentUpdatedAt || new Date().toISOString(),
        );
        return;
      }

      if ((remote.version ?? 0) > 0) {
        await this.applyRemoteSnapshot(remote);
        await this.setSyncState({
          configDirty: false,
          snapshotVersion: remote.version,
          lastSnapshotSyncAt: remote.updatedAt || new Date().toISOString(),
          lastSyncedBaseUrl: currentBaseUrl,
          contentUpdatedAt:
            remote.contentUpdatedAt ||
            remote.updatedAt ||
            new Date().toISOString(),
        });
        return;
      }

      if (snapshotItems.length > 0) {
        await this.markConfigDirty(
          state.contentUpdatedAt || new Date().toISOString(),
        );
      } else if (!state.contentUpdatedAt) {
        await this.setSyncState({
          contentUpdatedAt:
            remote.contentUpdatedAt ||
            remote.updatedAt ||
            new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('ConcernedItems bootstrap snapshot check failed:', error);
    }
  }

  private async flushConfigPush(): Promise<void> {
    const state = await this.getSyncState();
    if (!state.configDirty) {
      return;
    }

    const result = await chrome.storage.local.get(CONCERNED_ITEMS_KEY);
    const concernedItems: TopicItemWithAutoReply[] = (
      result[CONCERNED_ITEMS_KEY] || []
    ).filter(isManualConcernedItem);
    const snapshotItems = stripRuntimeFields(concernedItems);
    const client = getMemoryServiceClient();
    const contentUpdatedAt = state.contentUpdatedAt || new Date().toISOString();

    try {
      const response = await client.putConcernedItemsSnapshot({
        items: snapshotItems,
        baseVersion: state.snapshotVersion ?? 0,
        contentUpdatedAt,
        updatedByDevice: state.deviceId,
      });

      await this.setSyncState({
        configDirty: false,
        snapshotVersion: response.version,
        lastSnapshotSyncAt: response.updatedAt || new Date().toISOString(),
        lastSyncedBaseUrl: client.getBaseUrl(),
        contentUpdatedAt: response.contentUpdatedAt || contentUpdatedAt,
      });
    } catch (error) {
      if (error instanceof MemoryServiceError && error.status === 409) {
        const current = error.body?.current as
          | ConcernedItemsSnapshotResponse
          | undefined;
        if (current) {
          await this.applyRemoteSnapshot(current);
        }
        await this.setSyncState({
          configDirty: false,
          snapshotVersion: current?.version ?? state.snapshotVersion,
          lastSnapshotSyncAt: current?.updatedAt || state.lastSnapshotSyncAt,
          lastSyncedBaseUrl: client.getBaseUrl(),
          contentUpdatedAt: current?.contentUpdatedAt || state.contentUpdatedAt,
        });
        return;
      }

      console.warn(
        'ConcernedItems config push failed, will retry later:',
        error,
      );
    }
  }

  private async pullConcernedItemsSnapshot(): Promise<void> {
    const state = await this.getSyncState();
    const client = getMemoryServiceClient();
    const remote = await client.getConcernedItemsSnapshot();
    const localContentUpdatedAt = getComparableContentUpdatedAt(
      state.contentUpdatedAt,
      state.lastSnapshotSyncAt,
    );
    const remoteContentUpdatedAt = getComparableContentUpdatedAt(
      remote.contentUpdatedAt,
      remote.updatedAt,
    );

    if ((remote.version ?? 0) < (state.snapshotVersion ?? 0)) {
      return;
    }

    if (state.configDirty && localContentUpdatedAt > remoteContentUpdatedAt) {
      return;
    }

    if (
      (remote.version ?? 0) === (state.snapshotVersion ?? 0) &&
      !state.configDirty
    ) {
      return;
    }

    await this.applyRemoteSnapshot(remote);
    await this.setSyncState({
      configDirty: false,
      snapshotVersion: remote.version,
      lastSnapshotSyncAt: remote.updatedAt || new Date().toISOString(),
      lastSyncedBaseUrl: client.getBaseUrl(),
      contentUpdatedAt:
        remote.contentUpdatedAt || remote.updatedAt || new Date().toISOString(),
    });
  }

  private async applyRemoteSnapshot(
    remote: ConcernedItemsSnapshotResponse,
  ): Promise<void> {
    const result = await chrome.storage.local.get(CONCERNED_ITEMS_KEY);
    const localItems: TopicItemWithAutoReply[] =
      result[CONCERNED_ITEMS_KEY] || [];
    const remoteItems = (remote.items || []) as TopicItemWithAutoReply[];
    const mergedItems = mergeManualConcernedItemsPreservingSystem(
      localItems,
      mergeRuntimeFields(localItems.filter(isManualConcernedItem), remoteItems),
    );

    if (stableSerialize(localItems) === stableSerialize(mergedItems)) {
      return;
    }

    this.applyingRemoteSnapshot = true;
    try {
      await chrome.storage.local.set({ [CONCERNED_ITEMS_KEY]: mergedItems });
    } finally {
      setTimeout(() => {
        this.applyingRemoteSnapshot = false;
      }, 0);
    }
  }

  private async flushPendingHits(): Promise<void> {
    const result = await chrome.storage.local.get(PENDING_HITS_KEY);
    const pendingHits: PendingFollowThreadHit[] =
      result[PENDING_HITS_KEY] || [];

    if (pendingHits.length === 0) {
      return;
    }

    const client = getMemoryServiceClient();
    const remainingHits: PendingFollowThreadHit[] = [];

    for (const hit of pendingHits) {
      try {
        await client.postFollowThreadHit(hit);
      } catch (error) {
        console.warn(
          'Follow-thread hit flush failed, keeping in queue:',
          error,
        );
        remainingHits.push(
          hit,
          ...pendingHits.slice(pendingHits.indexOf(hit) + 1),
        );
        break;
      }
    }

    await chrome.storage.local.set({ [PENDING_HITS_KEY]: remainingHits });
  }

  private async pullFollowThreadHits(): Promise<void> {
    const syncState = await this.getSyncState();
    const result = await chrome.storage.local.get(CONCERNED_ITEMS_KEY);
    const concernedItems: TopicItemWithAutoReply[] = (
      result[CONCERNED_ITEMS_KEY] || []
    ).filter(isManualConcernedItem);
    const followItemIds = concernedItems
      .filter((item) => item.followThread && item.followConfig)
      .map((item) => item.id);

    if (followItemIds.length === 0) {
      return;
    }

    const client = getMemoryServiceClient();
    const response = await client.getFollowThreadHits({
      since: syncState.lastHitSyncAt,
      followItemIds,
      limit: 500,
    });

    if (!response.items || response.items.length === 0) {
      return;
    }

    const itemsById = new Map(
      concernedItems.map((item) => [item.id, clone(item)]),
    );
    let changed = false;

    for (const hit of response.items) {
      const item = itemsById.get(hit.followItemId);
      if (!item?.followConfig) {
        continue;
      }

      if (!Array.isArray(item.followConfig.relatedMessages)) {
        item.followConfig.relatedMessages = [];
      }

      const exists = item.followConfig.relatedMessages.some(
        (message) => message.postId === hit.postId,
      );
      if (exists) {
        continue;
      }

      item.followConfig.relatedMessages.push(toRelatedMessageMeta(hit));
      item.followConfig.lastCheckedAt =
        hit.createdAt || new Date().toISOString();
      changed = true;
    }

    if (changed) {
      this.applyingRemoteSnapshot = true;
      try {
        await chrome.storage.local.set({
          [CONCERNED_ITEMS_KEY]: concernedItems.map(
            (item) => itemsById.get(item.id) || item,
          ),
        });
      } finally {
        setTimeout(() => {
          this.applyingRemoteSnapshot = false;
        }, 0);
      }
    }

    if (response.nextSince) {
      await this.setSyncState({ lastHitSyncAt: response.nextSince });
    }
  }
}

export const concernedItemsSyncService =
  ConcernedItemsSyncService.getInstance();
