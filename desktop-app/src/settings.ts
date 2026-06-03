import fs from 'node:fs/promises';
import path from 'node:path';

import type { BridgeConfig } from './config.js';

export type BridgeAskScope = 'work' | 'personal' | 'both';
export type UiLanguage = 'zh-CN' | 'en-US';

export interface ExplorerDoubaoSettings {
  enabled: boolean;
  lookbackDays: number;
  intervalMinutes: number;
  defaultScope: Exclude<BridgeAskScope, 'both'>;
  /** Browser transport to use for exploration. Defaults to 'playwright'. */
  transport?: ExplorerTransport;
  /** Browser transport to use for broadcasting. Defaults to 'playwright'. */
  broadcastTransport?: ExplorerTransport;
}

export type ExplorerTransport = 'playwright' | 'webpage_mcp';

export interface ExplorerChatgptSettings {
  enabled: boolean;
  maxConversations: number;
  lookbackDays: number;
  intervalMinutes: number;
  defaultScope: Exclude<BridgeAskScope, 'both'>;
  /** Browser transport to use. Defaults to 'playwright' (bundled Chromium). */
  transport?: ExplorerTransport;
}

export interface ExplorerLocalAgentSettings {
  enabled: boolean;
  rootPaths: string[];
  lookbackDays: number;
  intervalMinutes: number;
  maxSessions: number;
  includeSubagents: boolean;
  defaultScope: Exclude<BridgeAskScope, 'both'>;
}

export interface ExplorerDoubaoTransportSettings {
  /** Browser transport to use for Doubao exploration. Defaults to 'playwright'. */
  transport?: ExplorerTransport;
  /** Browser transport to use for Doubao broadcasting. Defaults to 'playwright'. */
  broadcastTransport?: ExplorerTransport;
}

export interface ExplorerSettings {
  doubao: ExplorerDoubaoSettings;
  chatgpt: ExplorerChatgptSettings;
  codex_cli: ExplorerLocalAgentSettings;
  claude_code_cli: ExplorerLocalAgentSettings;
  cursor_agent_cli: ExplorerLocalAgentSettings;
  autoClassify: boolean;
  askDefaultScope: BridgeAskScope;
}

export interface BridgeSettingsPayload {
  defaults: BridgeUserSettings;
  user: BridgeUserSettingsPatch;
  effective: BridgeUserSettings;
}

export interface BridgeUserSettings {
  uiLanguage?: UiLanguage;
  memoryServiceBaseUrl?: string;
  memoryServiceApiKey?: string;
  memoryServiceUserId?: string;
  autoSync: boolean;
  pollIntervalMs: number;
  stableMemoryIntervalMs: number;
  mobileBriefingIntervalMs: number;
  reminderSyncIntervalMs: number;
  reminderDailyDigestEnabled: boolean;
  reminderDailyDigestTime: string;
  reminderDedupSameDay: boolean;
  explorer: ExplorerSettings;
}

export interface BridgeUserSettingsPatch
  extends Partial<Omit<BridgeUserSettings, 'explorer'>> {
  explorer?: Partial<ExplorerSettings>;
}

type SettingsListener = (settings: BridgeUserSettings) => void;

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveOrFallback(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function nonNegativeOrFallback(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function stringArrayOrFallback(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );
  return normalized.length ? normalized : fallback;
}

function normalizeDefaultScope(
  value: unknown,
  fallback: Exclude<BridgeAskScope, 'both'>,
): Exclude<BridgeAskScope, 'both'> {
  return value === 'work' || value === 'personal' ? value : fallback;
}

function normalizeLocalAgentExplorerSettings(
  input: Partial<ExplorerLocalAgentSettings> | undefined,
  defaults: ExplorerLocalAgentSettings,
): ExplorerLocalAgentSettings {
  return {
    enabled:
      typeof input?.enabled === 'boolean' ? input.enabled : defaults.enabled,
    rootPaths: stringArrayOrFallback(input?.rootPaths, defaults.rootPaths),
    lookbackDays: nonNegativeOrFallback(
      input?.lookbackDays,
      defaults.lookbackDays,
    ),
    intervalMinutes: positiveOrFallback(
      input?.intervalMinutes,
      defaults.intervalMinutes,
    ),
    maxSessions: nonNegativeOrFallback(
      input?.maxSessions,
      defaults.maxSessions,
    ),
    includeSubagents:
      typeof input?.includeSubagents === 'boolean'
        ? input.includeSubagents
        : defaults.includeSubagents,
    defaultScope: normalizeDefaultScope(
      input?.defaultScope,
      defaults.defaultScope,
    ),
  };
}

function normalizeUiLanguage(value: unknown, fallback: UiLanguage): UiLanguage {
  if (value === 'en-US' || value === 'en') return 'en-US';
  if (value === 'zh-CN' || value === 'zh_CN' || value === 'zh') {
    return 'zh-CN';
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.startsWith('en')) return 'en-US';
    if (normalized.startsWith('zh')) return 'zh-CN';
  }
  return fallback;
}

function normalizeTimeOfDay(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeExplorerSettings(
  input: Partial<ExplorerSettings> | undefined,
  defaults: ExplorerSettings,
): ExplorerSettings {
  return {
    doubao: {
      enabled:
        typeof input?.doubao?.enabled === 'boolean'
          ? input.doubao.enabled
          : defaults.doubao.enabled,
      lookbackDays: nonNegativeOrFallback(
        input?.doubao?.lookbackDays,
        defaults.doubao.lookbackDays,
      ),
      intervalMinutes: positiveOrFallback(
        input?.doubao?.intervalMinutes,
        defaults.doubao.intervalMinutes,
      ),
      defaultScope:
        input?.doubao?.defaultScope === 'work' ||
        input?.doubao?.defaultScope === 'personal'
          ? input.doubao.defaultScope
          : defaults.doubao.defaultScope,
      transport:
        input?.doubao?.transport === 'playwright' ||
        input?.doubao?.transport === 'webpage_mcp'
          ? input.doubao.transport
          : defaults.doubao.transport,
      broadcastTransport:
        input?.doubao?.broadcastTransport === 'playwright' ||
        input?.doubao?.broadcastTransport === 'webpage_mcp'
          ? input.doubao.broadcastTransport
          : defaults.doubao.broadcastTransport,
    },
    chatgpt: {
      enabled:
        typeof input?.chatgpt?.enabled === 'boolean'
          ? input.chatgpt.enabled
          : defaults.chatgpt.enabled,
      maxConversations: nonNegativeOrFallback(
        input?.chatgpt?.maxConversations,
        defaults.chatgpt.maxConversations,
      ),
      lookbackDays: nonNegativeOrFallback(
        input?.chatgpt?.lookbackDays,
        defaults.chatgpt.lookbackDays,
      ),
      intervalMinutes: positiveOrFallback(
        input?.chatgpt?.intervalMinutes,
        defaults.chatgpt.intervalMinutes,
      ),
      defaultScope:
        input?.chatgpt?.defaultScope === 'work' ||
        input?.chatgpt?.defaultScope === 'personal'
          ? input.chatgpt.defaultScope
          : defaults.chatgpt.defaultScope,
      transport:
        input?.chatgpt?.transport === 'playwright' ||
        input?.chatgpt?.transport === 'webpage_mcp'
          ? input.chatgpt.transport
          : defaults.chatgpt.transport,
    },
    codex_cli: normalizeLocalAgentExplorerSettings(
      input?.codex_cli,
      defaults.codex_cli,
    ),
    claude_code_cli: normalizeLocalAgentExplorerSettings(
      input?.claude_code_cli,
      defaults.claude_code_cli,
    ),
    cursor_agent_cli: normalizeLocalAgentExplorerSettings(
      input?.cursor_agent_cli,
      defaults.cursor_agent_cli,
    ),
    autoClassify:
      typeof input?.autoClassify === 'boolean'
        ? input.autoClassify
        : defaults.autoClassify,
    askDefaultScope:
      input?.askDefaultScope === 'work' ||
      input?.askDefaultScope === 'personal' ||
      input?.askDefaultScope === 'both'
        ? input.askDefaultScope
        : defaults.askDefaultScope,
  };
}

function normalizeSettings(
  input: BridgeUserSettingsPatch,
  defaults: BridgeUserSettings,
): BridgeUserSettings {
  return {
    uiLanguage: normalizeUiLanguage(
      input.uiLanguage,
      defaults.uiLanguage || 'zh-CN',
    ),
    memoryServiceBaseUrl: Object.hasOwn(input, 'memoryServiceBaseUrl')
      ? (cleanOptional(input.memoryServiceBaseUrl) ??
        defaults.memoryServiceBaseUrl)
      : defaults.memoryServiceBaseUrl,
    memoryServiceApiKey: Object.hasOwn(input, 'memoryServiceApiKey')
      ? cleanOptional(input.memoryServiceApiKey)
      : defaults.memoryServiceApiKey,
    memoryServiceUserId: Object.hasOwn(input, 'memoryServiceUserId')
      ? cleanOptional(input.memoryServiceUserId)
      : defaults.memoryServiceUserId,
    autoSync:
      typeof input.autoSync === 'boolean' ? input.autoSync : defaults.autoSync,
    pollIntervalMs: positiveOrFallback(
      input.pollIntervalMs,
      defaults.pollIntervalMs,
    ),
    stableMemoryIntervalMs: positiveOrFallback(
      input.stableMemoryIntervalMs,
      defaults.stableMemoryIntervalMs,
    ),
    mobileBriefingIntervalMs: positiveOrFallback(
      input.mobileBriefingIntervalMs,
      defaults.mobileBriefingIntervalMs,
    ),
    reminderSyncIntervalMs: positiveOrFallback(
      input.reminderSyncIntervalMs,
      defaults.reminderSyncIntervalMs,
    ),
    reminderDailyDigestEnabled:
      typeof input.reminderDailyDigestEnabled === 'boolean'
        ? input.reminderDailyDigestEnabled
        : defaults.reminderDailyDigestEnabled,
    reminderDailyDigestTime: normalizeTimeOfDay(
      input.reminderDailyDigestTime,
      defaults.reminderDailyDigestTime,
    ),
    reminderDedupSameDay:
      typeof input.reminderDedupSameDay === 'boolean'
        ? input.reminderDedupSameDay
        : defaults.reminderDedupSameDay,
    explorer: normalizeExplorerSettings(input.explorer, defaults.explorer),
  };
}

export function createDefaultBridgeUserSettings(
  config: BridgeConfig,
): BridgeUserSettings {
  return {
    uiLanguage: 'zh-CN',
    memoryServiceBaseUrl: config.memoryServiceBaseUrl,
    memoryServiceApiKey: config.memoryServiceApiKey,
    memoryServiceUserId: config.memoryServiceUserId,
    autoSync: config.autoSync,
    pollIntervalMs: config.pollIntervalMs,
    stableMemoryIntervalMs: config.stableMemoryIntervalMs,
    mobileBriefingIntervalMs: config.mobileBriefingIntervalMs,
    reminderSyncIntervalMs: config.reminderSyncIntervalMs,
    reminderDailyDigestEnabled: config.reminderDailyDigestEnabled,
    reminderDailyDigestTime: normalizeTimeOfDay(
      config.reminderDailyDigestTime,
      '09:00',
    ),
    reminderDedupSameDay: config.reminderDedupSameDay,
    explorer: {
      doubao: {
        enabled: false,
        lookbackDays: 7,
        intervalMinutes: 60,
        defaultScope: 'personal',
      },
      chatgpt: {
        enabled: false,
        maxConversations: 0,
        lookbackDays: 0,
        intervalMinutes: 60,
        defaultScope: 'work',
      },
      codex_cli: {
        enabled: false,
        rootPaths: ['${CODEX_HOME:-~/.codex}/sessions'],
        lookbackDays: 30,
        intervalMinutes: 60,
        maxSessions: 50,
        includeSubagents: false,
        defaultScope: 'work',
      },
      claude_code_cli: {
        enabled: false,
        rootPaths: ['~/.claude/projects', '~/.claude/transcripts'],
        lookbackDays: 30,
        intervalMinutes: 60,
        maxSessions: 50,
        includeSubagents: true,
        defaultScope: 'work',
      },
      cursor_agent_cli: {
        enabled: false,
        rootPaths: ['~/.cursor/projects'],
        lookbackDays: 30,
        intervalMinutes: 60,
        maxSessions: 50,
        includeSubagents: true,
        defaultScope: 'work',
      },
      autoClassify: false,
      askDefaultScope: 'work',
    },
  };
}

export function applyBridgeSettingsToConfig(
  config: BridgeConfig,
  settings: BridgeUserSettings,
): void {
  config.memoryServiceBaseUrl = settings.memoryServiceBaseUrl;
  config.memoryServiceApiKey = settings.memoryServiceApiKey;
  config.memoryServiceUserId = settings.memoryServiceUserId;
  config.autoSync = settings.autoSync;
  config.pollIntervalMs = settings.pollIntervalMs;
  config.stableMemoryIntervalMs = settings.stableMemoryIntervalMs;
  config.mobileBriefingIntervalMs = settings.mobileBriefingIntervalMs;
  config.reminderSyncIntervalMs = settings.reminderSyncIntervalMs;
  config.reminderDailyDigestEnabled = settings.reminderDailyDigestEnabled;
  config.reminderDailyDigestTime = settings.reminderDailyDigestTime;
  config.reminderDedupSameDay = settings.reminderDedupSameDay;
}

export class BridgeSettingsStore {
  private current: BridgeUserSettings;
  private userOverrides: BridgeUserSettingsPatch = {};
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

  async load(): Promise<{
    effective: BridgeUserSettings;
    user: BridgeUserSettingsPatch;
  }> {
    try {
      const raw = await fs.readFile(this.settingsFile, 'utf8');
      const parsed = JSON.parse(raw) as BridgeUserSettingsPatch;
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

  async save(next: BridgeUserSettingsPatch): Promise<void> {
    this.userOverrides = structuredClone(next);
    this.current = normalizeSettings(this.userOverrides, this.defaults);
    await this.ensureDir();
    await fs.writeFile(
      this.settingsFile,
      JSON.stringify(this.userOverrides, null, 2),
      'utf8',
    );
    this.emit();
  }

  async update(
    patch: BridgeUserSettingsPatch,
  ): Promise<BridgeSettingsPayload> {
    const next: BridgeUserSettingsPatch = {
      ...this.userOverrides,
      ...patch,
      explorer: patch.explorer
        ? {
            ...(this.userOverrides.explorer ?? {}),
            ...patch.explorer,
          }
        : this.userOverrides.explorer,
    };
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
