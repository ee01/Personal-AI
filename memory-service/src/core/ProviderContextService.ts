import type Database from 'better-sqlite3';

import { contentHash } from '../utils/hashing.js';
import { daysAgo, formatDateTime, now } from '../utils/time.js';
import { ProfileManager } from './ProfileManager.js';
import { RecallEngine } from './RecallEngine.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import {
  ProviderRepository,
  type ProviderBindingRecord,
  type ProviderSyncJobRecord,
} from '../repositories/ProviderRepository.js';

export type ProviderTransport = 'native_memory' | 'session_context' | 'document_context' | 'reminder';
export type ProviderScenario =
  | 'stable_memory'
  | 'mobile_briefing'
  | 'query_answer'
  | 'reminder_sync'
  | 'general';
export type ProviderMemoryProductKind =
  | 'persona_core'
  | 'voice_mode'
  | 'active_focus_digest'
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

export interface ProviderContextPackageInput {
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

interface ProfileItemRow {
  item_key: string;
  item_value: string;
  salience_score: number;
  user_confirmed: number;
  last_seen: number;
  created_at: number;
}

interface MessageRow {
  id: string;
  summary: string | null;
  content: string;
  timestamp: number;
  sender: string | null;
  group_name: string | null;
  importance: number;
  matched_projects_json: string | null;
}

interface ConcernedItemsRow {
  items_json: string;
  version: number;
  updated_at: number;
  content_updated_at: number | null;
}

interface WatchedProjectRow {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: number;
  updated_at: number | null;
}

interface ProposedActionRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  confidence: number;
  requires_approval: number;
  state: string;
  expires_at: number | null;
  created_at: number;
}

interface ReflectionArtifactRow {
  id: string;
  scope: string;
  scope_ref: string | null;
  summary: string;
  created_at: number;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function markdownList(items: string[], emptyFallback = 'No data available.'): string {
  if (items.length === 0) {
    return `- ${emptyFallback}`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function formatSourceRef(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function clampMarkdownByBudget(markdown: string, tokenBudget: number): string {
  const maxChars = Math.max(400, tokenBudget * 4);
  if (markdown.length <= maxChars) return markdown;

  const cutoff = Math.max(0, maxChars - 32);
  return `${markdown.slice(0, cutoff).trim()}\n\n> Truncated to fit token budget.`;
}

function bindingTypeForScenario(scenario: ProviderScenario | string, explicitBindingType?: string): string {
  if (explicitBindingType) return explicitBindingType;

  switch (scenario) {
    case 'stable_memory':
      return 'memory_sync_thread';
    case 'mobile_briefing':
    case 'query_answer':
      return 'mobile_context_thread';
    case 'reminder_sync':
      return 'reminder_channel';
    default:
      return 'mobile_context_thread';
  }
}

function transportForKind(kind: ProviderMemoryProductKind): ProviderTransport {
  switch (kind) {
    case 'persona_core':
    case 'voice_mode':
      return 'native_memory';
    case 'reminder_digest':
      return 'reminder';
    case 'active_focus_digest':
    case 'query_answer_card':
    default:
      return 'session_context';
  }
}

function stabilityForKind(kind: ProviderMemoryProductKind): 'stable' | 'rolling' | 'ephemeral' {
  switch (kind) {
    case 'persona_core':
    case 'voice_mode':
      return 'stable';
    case 'active_focus_digest':
    case 'reminder_digest':
      return 'rolling';
    case 'query_answer_card':
    default:
      return 'ephemeral';
  }
}

function ttlForKind(kind: ProviderMemoryProductKind): number | undefined {
  switch (kind) {
    case 'active_focus_digest':
      return 6 * 3600;
    case 'reminder_digest':
      return 2 * 3600;
    case 'query_answer_card':
      return 30 * 60;
    default:
      return undefined;
  }
}

function titleForKind(kind: ProviderMemoryProductKind): string {
  switch (kind) {
    case 'persona_core':
      return 'Persona Core';
    case 'voice_mode':
      return 'Voice Mode';
    case 'active_focus_digest':
      return 'Active Focus Digest';
    case 'reminder_digest':
      return 'Reminder Digest';
    case 'query_answer_card':
      return 'Query Answer Card';
  }
}

function defaultKindsForScenario(scenario: ProviderScenario | string): ProviderMemoryProductKind[] {
  switch (scenario) {
    case 'stable_memory':
      return ['persona_core', 'voice_mode'];
    case 'mobile_briefing':
      return ['active_focus_digest', 'reminder_digest'];
    case 'query_answer':
      return ['query_answer_card'];
    case 'reminder_sync':
      return ['reminder_digest'];
    default:
      return ['persona_core', 'voice_mode', 'active_focus_digest', 'reminder_digest'];
  }
}

function buildCapabilityNotes(provider: string): string[] {
  const notes = [
    'Long-term memory should be seeded explicitly through a remembered conversation.',
    'Rolling context should be injected into the active mobile-context thread.',
    'The memory service remains the system of record; the provider bridge only syncs outputs.',
  ];

  if (provider === 'doubao') {
    notes.unshift('Doubao is bound through a local bridge that keeps auth and automation on the user machine.');
  }

  return notes;
}

export class ProviderContextService {
  private readonly profileManager: ProfileManager;
  private readonly recallEngine: RecallEngine;
  private readonly notificationRepository: NotificationRepository;
  private readonly providerRepository: ProviderRepository;

  constructor(private readonly db: Database.Database) {
    this.profileManager = new ProfileManager(db);
    this.recallEngine = new RecallEngine(db);
    this.notificationRepository = new NotificationRepository(db);
    this.providerRepository = new ProviderRepository(db);
  }

  getCapabilities(provider: string): ProviderCapabilities {
    return {
      provider,
      displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
      supportedTransports: ['native_memory', 'session_context', 'document_context', 'reminder'],
      supportedBindingTypes: ['memory_sync_thread', 'mobile_context_thread', 'reminder_channel'],
      supportedScenarios: ['stable_memory', 'mobile_briefing', 'query_answer', 'reminder_sync', 'general'],
      syncModel: 'local_bridge',
      notes: buildCapabilityNotes(provider),
    };
  }

  listBindings(provider: string): ProviderBindingRecord[] {
    return this.providerRepository.listBindings(provider);
  }

  upsertBinding(
    provider: string,
    bindingType: string,
    input: {
      externalThreadId: string;
      title?: string;
      deviceId?: string;
      metadata?: Record<string, any>;
      isActive?: boolean;
      lastError?: string | null;
    },
  ): ProviderBindingRecord {
    return this.providerRepository.upsertBinding(provider, bindingType, input);
  }

  listSyncJobs(provider: string, filters: { status?: string; bindingType?: string; limit?: number; offset?: number } = {}): {
    items: ProviderSyncJobRecord[];
    total: number;
  } {
    return this.providerRepository.listSyncJobs(provider, {
      status: (filters.status as ProviderSyncJobRecord['status'] | 'all' | undefined) ?? 'all',
      bindingType: filters.bindingType,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  getSyncJob(provider: string, id: string): ProviderSyncJobRecord | null {
    return this.providerRepository.getSyncJob(provider, id);
  }

  reportSyncJob(
    provider: string,
    id: string,
    input: {
      status: ProviderSyncJobRecord['status'];
      result?: Record<string, any>;
      errorMessage?: string;
      response?: Record<string, any>;
      providerMessageId?: string;
      externalThreadId?: string;
      completedAt?: number;
      startedAt?: number;
    },
  ): ProviderSyncJobRecord {
    return this.providerRepository.reportSyncJob(provider, id, input);
  }

  async renderContextPackage(input: ProviderContextPackageInput): Promise<ProviderContextPackageResponse> {
    const provider = input.provider;
    const scenario = input.scenario;
    const tokenBudget = Math.max(256, Math.min(input.tokenBudget ?? 1800, 8000));
    const freshnessWindowDays = Math.max(1, Math.min(input.freshnessWindowDays ?? 14, 30));
    const bindingType = bindingTypeForScenario(scenario, input.bindingType);
    const generatedAt = now();
    const bindings = this.providerRepository.listBindings(provider);
    const kinds = input.includeKinds?.length ? input.includeKinds : defaultKindsForScenario(scenario);

    const packages: ProviderMemoryProduct[] = [];
    for (const kind of kinds) {
      const rendered = await this.renderProduct(kind, {
        provider,
        scenario,
        query: input.query,
        freshnessWindowDays,
        tokenBudget,
      });

      if (!rendered) continue;
      packages.push(rendered);
    }

    const packageResponse: ProviderContextPackageResponse = {
      provider,
      scenario,
      generatedAt,
      tokenBudget,
      packages,
      bindings,
    };

    if (input.createSyncJob !== false) {
      const dedupeKey = contentHash(
        JSON.stringify({
          provider,
          scenario,
          query: input.query ?? '',
          bindingType,
          freshnessWindowDays,
          tokenBudget,
          kinds,
          deviceContext: input.deviceContext ?? '',
        }),
      );

      const job = this.providerRepository.createSyncJob({
        provider,
        scenario,
        bindingType,
        bindingId: bindings.find((binding) => binding.bindingType === bindingType)?.id,
        title: `${provider} ${scenario} sync package`,
        request: {
          provider,
          scenario,
          query: input.query ?? null,
          tokenBudget,
          freshnessWindowDays,
          includeKinds: kinds,
          deviceContext: input.deviceContext ?? null,
          bindingType,
        },
        response: packageResponse,
        status: 'queued',
        dedupeKey,
        sourceRefs: packages.flatMap((pkg) => pkg.sourceRefs),
        tokenBudget,
        freshnessWindowDays,
        deviceContext: input.deviceContext,
        externalThreadId: bindings.find((binding) => binding.bindingType === bindingType)?.externalThreadId,
      });

      packageResponse.syncJob = job;
    }

    return packageResponse;
  }

  private async renderProduct(
    kind: ProviderMemoryProductKind,
    context: {
      provider: string;
      scenario: string;
      query?: string;
      freshnessWindowDays: number;
      tokenBudget: number;
    },
  ): Promise<ProviderMemoryProduct | null> {
    switch (kind) {
      case 'persona_core':
        return this.renderPersonaCore(context.provider, context.tokenBudget);
      case 'voice_mode':
        return this.renderVoiceMode(context.provider, context.tokenBudget);
      case 'active_focus_digest':
        return this.renderActiveFocusDigest(context.provider, context.freshnessWindowDays, context.tokenBudget);
      case 'reminder_digest':
        return this.renderReminderDigest(context.provider, context.tokenBudget);
      case 'query_answer_card':
        return context.query
          ? this.renderQueryAnswerCard(context.provider, context.query, context.tokenBudget)
          : null;
    }

    return null;
  }

  private renderPersonaCore(provider: string, tokenBudget: number): ProviderMemoryProduct {
    const userCore = this.profileManager.renderUserCore(10);
    const identity = this.profileManager.getActiveProfile('identity');
    const soul = this.profileManager.getActiveProfile('soul');
    const policy = this.profileManager.getActiveProfile('policy');
    const bodySections = [
      '# Persona Core',
      '> Stable memory intended for the provider-native long-term memory thread.',
      '',
      '## USER_CORE Snapshot',
      userCore.trim(),
    ];

    if (identity) {
      bodySections.push('', '## Identity', identity.trim());
    }
    if (soul) {
      bodySections.push('', '## Soul', soul.trim());
    }
    if (policy) {
      bodySections.push('', '## Policy', policy.trim());
    }

    const bodyMd = clampMarkdownByBudget(bodySections.join('\n'), tokenBudget);
    return {
      id: contentHash(`${provider}:persona_core:${bodyMd}`),
      kind: 'persona_core',
      title: titleForKind('persona_core'),
      bodyMd,
      stability: stabilityForKind('persona_core'),
      transport: transportForKind('persona_core'),
      targetBindingType: 'memory_sync_thread',
      sourceRefs: ['profile:user_core', 'profile:identity', 'profile:soul', 'profile:policy'],
      dedupeKey: contentHash(`${provider}:persona_core:${bodyMd}`),
      generatedAt: now(),
    };
  }

  private renderVoiceMode(provider: string, tokenBudget: number): ProviderMemoryProduct {
    const rows = this.db
      .prepare(
        `SELECT item_key, item_value, salience_score, user_confirmed, last_seen, created_at
         FROM user_profile_items
         WHERE status = 'active'
           AND item_type IN ('preference', 'habit', 'constraint')
         ORDER BY user_confirmed DESC, salience_score DESC, last_seen DESC
         LIMIT 12`,
      )
      .all() as ProfileItemRow[];

    const selected = rows
      .filter((row) =>
        ['response_length', 'detail_level', 'tone', 'proactive_reminders', 'follow_up_style', 'commute_mode', 'verbosity'].includes(
          row.item_key,
        ),
      )
      .slice(0, 8);

    const bodySections = [
      '# Voice Mode',
      '> Stable preference memory intended to shape how the assistant speaks back.',
      '',
      '## Communication Preferences',
      markdownList(
        (selected.length > 0 ? selected : rows.slice(0, 5)).map(
          (row) => `**${row.item_key}**: ${row.item_value}`,
        ),
        'No explicit voice preferences found.',
      ),
    ];

    const bodyMd = clampMarkdownByBudget(bodySections.join('\n'), tokenBudget);
    return {
      id: contentHash(`${provider}:voice_mode:${bodyMd}`),
      kind: 'voice_mode',
      title: titleForKind('voice_mode'),
      bodyMd,
      stability: stabilityForKind('voice_mode'),
      transport: transportForKind('voice_mode'),
      targetBindingType: 'memory_sync_thread',
      sourceRefs: rows.map((row) => formatSourceRef('profile_item', row.item_key)),
      dedupeKey: contentHash(`${provider}:voice_mode:${bodyMd}`),
      generatedAt: now(),
    };
  }

  private renderActiveFocusDigest(
    provider: string,
    freshnessWindowDays: number,
    tokenBudget: number,
  ): ProviderMemoryProduct {
    const cutoff = daysAgo(freshnessWindowDays);

    const concernedRow = this.db
      .prepare('SELECT * FROM concerned_items_state WHERE singleton_id = 1')
      .get() as ConcernedItemsRow | undefined;
    const concernedItems = concernedRow ? safeJsonParse<unknown[]>(concernedRow.items_json, []) : [];

    const watchedProjects = this.db
      .prepare(
        `SELECT id, name, description, priority, is_active, updated_at
         FROM watched_projects
         WHERE is_active = 1
         ORDER BY priority DESC, updated_at DESC
         LIMIT 8`,
      )
      .all() as WatchedProjectRow[];

    const recentMessages = this.db
      .prepare(
        `SELECT id, summary, content, timestamp, sender, group_name, importance, matched_projects_json
         FROM messages_raw
         WHERE timestamp >= ? AND importance >= 0.35
         ORDER BY importance DESC, timestamp DESC
         LIMIT 8`,
      )
      .all(cutoff) as MessageRow[];

    const recentReflections = this.db
      .prepare(
        `SELECT id, scope, scope_ref, summary, created_at
         FROM reflection_artifacts
         ORDER BY created_at DESC
         LIMIT 4`,
      )
      .all() as ReflectionArtifactRow[];

    const focusItems = concernedItems
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, any>;
          const label = record.title || record.name || record.itemKey || record.item_key || record.id;
          const detail = record.summary || record.value || record.description || '';
          return detail ? `${label}: ${compactText(String(detail), 140)}` : compactText(String(label), 140);
        }
        return compactText(String(item), 140);
      })
      .slice(0, 8);

    const bodySections = [
      '# Active Focus Digest',
      `> Freshness window: ${freshnessWindowDays} day(s). Use this as rolling context, not durable memory.`,
      '',
      '## Concerned Items',
      markdownList(focusItems, 'No concerned items are currently pinned.'),
      '',
      '## Watched Projects',
      markdownList(
        watchedProjects.map((row) => {
          const description = row.description ? ` - ${compactText(row.description, 120)}` : '';
          return `**${row.name}** (priority ${row.priority})${description}`;
        }),
        'No watched projects are active.',
      ),
      '',
      '## Recent Signals',
      markdownList(
        recentMessages.map((row) => {
          const text = row.summary ?? compactText(row.content, 160);
          const prefix = `${formatDateTime(row.timestamp)}${row.sender ? ` ${row.sender}` : ''}${row.group_name ? ` @ ${row.group_name}` : ''}`;
          return `${prefix}: ${compactText(text, 180)}`;
        }),
        'No recent signals found in the freshness window.',
      ),
      '',
      '## Recent Reflections',
      markdownList(
        recentReflections.map((row) => {
          const scope = row.scope_ref ? `${row.scope}/${row.scope_ref}` : row.scope;
          return `${scope}: ${compactText(row.summary, 160)}`;
        }),
        'No recent reflections found.',
      ),
    ];

    const sourceRefs = [
      concernedRow ? formatSourceRef('concerned_items', String(concernedRow.version)) : null,
      ...watchedProjects.map((row) => formatSourceRef('watched_project', row.id)),
      ...recentMessages.map((row) => formatSourceRef('message', row.id)),
      ...recentReflections.map((row) => formatSourceRef('reflection', row.id)),
    ].filter((item): item is string => !!item);

    const bodyMd = clampMarkdownByBudget(bodySections.join('\n'), tokenBudget);
    return {
      id: contentHash(`${provider}:active_focus_digest:${bodyMd}`),
      kind: 'active_focus_digest',
      title: titleForKind('active_focus_digest'),
      bodyMd,
      stability: stabilityForKind('active_focus_digest'),
      transport: transportForKind('active_focus_digest'),
      targetBindingType: 'mobile_context_thread',
      ttlSeconds: ttlForKind('active_focus_digest'),
      sourceRefs,
      dedupeKey: contentHash(`${provider}:active_focus_digest:${bodyMd}`),
      generatedAt: now(),
    };
  }

  private renderReminderDigest(provider: string, tokenBudget: number): ProviderMemoryProduct {
    const pendingNotifications = this.notificationRepository.list({ state: 'pending', limit: 8, includeFuture: false });
    const pendingActions = this.db
      .prepare(
        `SELECT id, type, title, description, confidence, requires_approval, state, expires_at, created_at
         FROM proposed_actions
         WHERE state = 'pending'
         ORDER BY created_at DESC
         LIMIT 8`,
      )
      .all() as ProposedActionRow[];

    const notificationLines = pendingNotifications.map((notification) => {
      const body = notification.body ? ` - ${compactText(notification.body, 120)}` : '';
      const when = notification.sentAt ? ` @ ${formatDateTime(notification.sentAt)}` : '';
      return `${notification.title}${when}${body}`;
    });

    const actionLines = pendingActions.map((action) => {
      const expiry = action.expires_at ? ` (expires ${formatDateTime(action.expires_at)})` : '';
      const desc = action.description ? ` - ${compactText(action.description, 120)}` : '';
      return `${action.type}: ${action.title}${expiry}${desc}`;
    });

    const bodySections = [
      '# Reminder Digest',
      '> Rolling reminder context; keep it short and actionable.',
      '',
      '## Pending Notifications',
      markdownList(notificationLines, 'No pending notifications.'),
      '',
      '## Pending Actions',
      markdownList(actionLines, 'No pending actions.'),
    ];

    const sourceRefs = [
      ...pendingNotifications.map((notification) => formatSourceRef('notification', notification.id)),
      ...pendingActions.map((action) => formatSourceRef('proposed_action', action.id)),
    ];

    const bodyMd = clampMarkdownByBudget(bodySections.join('\n'), tokenBudget);
    return {
      id: contentHash(`${provider}:reminder_digest:${bodyMd}`),
      kind: 'reminder_digest',
      title: titleForKind('reminder_digest'),
      bodyMd,
      stability: stabilityForKind('reminder_digest'),
      transport: transportForKind('reminder_digest'),
      targetBindingType: 'reminder_channel',
      ttlSeconds: ttlForKind('reminder_digest'),
      sourceRefs,
      dedupeKey: contentHash(`${provider}:reminder_digest:${bodyMd}`),
      generatedAt: now(),
    };
  }

  private async renderQueryAnswerCard(provider: string, query: string, tokenBudget: number): Promise<ProviderMemoryProduct> {
    const recall = await this.recallEngine.recall({
      query,
      topK: 6,
      channels: ['vector', 'fts', 'graph', 'time'],
      includeMetadata: true,
      minImportance: 0.2,
    });

    const bodySections = [
      '# Query Answer Card',
      `> Question: ${query}`,
      '',
      '## Evidence',
      markdownList(
        recall.items.map((item, index) => {
          const date = item.timestamp ? ` @ ${formatDateTime(item.timestamp)}` : '';
          const source = item.source ? ` (${item.source})` : '';
          return `[${index + 1}]${source}${date} ${compactText(item.content, 220)}`;
        }),
        'No recall evidence found.',
      ),
      '',
      '## Recall Summary',
      `- totalFound: ${recall.totalFound}`,
      `- channels: ${recall.channels.join(', ') || 'none'}`,
      `- queryTimeMs: ${recall.queryTimeMs}`,
    ];

    const bodyMd = clampMarkdownByBudget(bodySections.join('\n'), tokenBudget);
    return {
      id: contentHash(`${provider}:query_answer_card:${query}:${bodyMd}`),
      kind: 'query_answer_card',
      title: titleForKind('query_answer_card'),
      bodyMd,
      stability: stabilityForKind('query_answer_card'),
      transport: transportForKind('query_answer_card'),
      targetBindingType: 'mobile_context_thread',
      ttlSeconds: ttlForKind('query_answer_card'),
      sourceRefs: recall.items.map((item) => formatSourceRef(item.type, item.id)),
      dedupeKey: contentHash(`${provider}:query_answer_card:${query}:${bodyMd}`),
      generatedAt: now(),
    };
  }
}
