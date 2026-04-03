import fs from 'node:fs/promises';
import path from 'node:path';

import type { BridgeConfig } from './config.js';

export interface BridgeSettingsPayload {
  defaults: BridgeUserSettings;
  user: Partial<BridgeUserSettings>;
  effective: BridgeUserSettings;
}

export interface BridgeUserSettings {
  memoryServiceBaseUrl?: string;
  memoryServiceApiKey?: string;
  memoryServiceUserId?: string;
  autoSync: boolean;
  pollIntervalMs: number;
  stableMemoryIntervalMs: number;
  mobileBriefingIntervalMs: number;
  reminderSyncIntervalMs: number;
}

type SettingsListener = (settings: BridgeUserSettings) => void;

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveOrFallback(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeSettings(input: Partial<BridgeUserSettings>, defaults: BridgeUserSettings): BridgeUserSettings {
  return {
    memoryServiceBaseUrl:
      Object.hasOwn(input, 'memoryServiceBaseUrl')
        ? cleanOptional(input.memoryServiceBaseUrl) ?? defaults.memoryServiceBaseUrl
        : defaults.memoryServiceBaseUrl,
    memoryServiceApiKey:
      Object.hasOwn(input, 'memoryServiceApiKey') ? cleanOptional(input.memoryServiceApiKey) : defaults.memoryServiceApiKey,
    memoryServiceUserId:
      Object.hasOwn(input, 'memoryServiceUserId') ? cleanOptional(input.memoryServiceUserId) : defaults.memoryServiceUserId,
    autoSync: true,
    pollIntervalMs: positiveOrFallback(input.pollIntervalMs, defaults.pollIntervalMs),
    stableMemoryIntervalMs: positiveOrFallback(input.stableMemoryIntervalMs, defaults.stableMemoryIntervalMs),
    mobileBriefingIntervalMs: positiveOrFallback(input.mobileBriefingIntervalMs, defaults.mobileBriefingIntervalMs),
    reminderSyncIntervalMs: positiveOrFallback(input.reminderSyncIntervalMs, defaults.reminderSyncIntervalMs),
  };
}

export function createDefaultBridgeUserSettings(config: BridgeConfig): BridgeUserSettings {
  return {
    memoryServiceBaseUrl: config.memoryServiceBaseUrl,
    memoryServiceApiKey: config.memoryServiceApiKey,
    memoryServiceUserId: config.memoryServiceUserId,
    autoSync: config.autoSync,
    pollIntervalMs: config.pollIntervalMs,
    stableMemoryIntervalMs: config.stableMemoryIntervalMs,
    mobileBriefingIntervalMs: config.mobileBriefingIntervalMs,
    reminderSyncIntervalMs: config.reminderSyncIntervalMs,
  };
}

export function applyBridgeSettingsToConfig(config: BridgeConfig, settings: BridgeUserSettings): void {
  config.memoryServiceBaseUrl = settings.memoryServiceBaseUrl;
  config.memoryServiceApiKey = settings.memoryServiceApiKey;
  config.memoryServiceUserId = settings.memoryServiceUserId;
  config.autoSync = settings.autoSync;
  config.pollIntervalMs = settings.pollIntervalMs;
  config.stableMemoryIntervalMs = settings.stableMemoryIntervalMs;
  config.mobileBriefingIntervalMs = settings.mobileBriefingIntervalMs;
  config.reminderSyncIntervalMs = settings.reminderSyncIntervalMs;
}

export class BridgeSettingsStore {
  private current: BridgeUserSettings;
  private userOverrides: Partial<BridgeUserSettings> = {};
  private readonly listeners = new Set<SettingsListener>();
  private readonly defaults: BridgeUserSettings;

  constructor(
    config: BridgeConfig,
    private readonly settingsFile: string,
  ) {
    this.defaults = createDefaultBridgeUserSettings(config);
    this.current = structuredClone(this.defaults);
  }

  async init(): Promise<void> {
    const { effective, user } = await this.load();
    this.current = effective;
    this.userOverrides = user;
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.settingsFile), { recursive: true });
  }

  async load(): Promise<{ effective: BridgeUserSettings; user: Partial<BridgeUserSettings> }> {
    try {
      const raw = await fs.readFile(this.settingsFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<BridgeUserSettings>;
      return {
        effective: normalizeSettings(parsed, this.defaults),
        user: parsed,
      };
    } catch {
      return {
        effective: structuredClone(this.defaults),
        user: {},
      };
    }
  }

  get(): BridgeUserSettings {
    return structuredClone(this.current);
  }

  getSettings(): BridgeUserSettings {
    return this.get();
  }

  getDefaults(): BridgeUserSettings {
    return structuredClone(this.defaults);
  }

  getPayload(): BridgeSettingsPayload {
    return {
      defaults: this.getDefaults(),
      user: structuredClone(this.userOverrides),
      effective: this.get(),
    };
  }

  async save(next: Partial<BridgeUserSettings>): Promise<void> {
    this.userOverrides = structuredClone(next);
    this.current = normalizeSettings(this.userOverrides, this.defaults);
    await this.ensureDir();
    await fs.writeFile(this.settingsFile, JSON.stringify(this.userOverrides, null, 2), 'utf8');
    this.emit();
  }

  async update(patch: Partial<BridgeUserSettings>): Promise<BridgeSettingsPayload> {
    const next = { ...this.userOverrides, ...patch };
    await this.save(next);
    return this.getPayload();
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
