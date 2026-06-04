import { randomUUID } from 'node:crypto';

import { contentHash } from '../utils/hashing.js';
import { now, formatDateTime } from '../utils/time.js';
import { toSlug } from '../utils/slug.js';
import type Database from 'better-sqlite3';

import type { ReflectionInput, ReflectionOutput } from './OnlineReflection.js';
import {
  ReflectionWorker,
  type DraftRehearsalCandidate,
  type ReflectionEvidenceItem,
  type ReflectionOutputLanguagePreference,
} from './ReflectionWorker.js';
import {
  ReflectionResearcher,
  type LocalResearchQuery,
} from './ReflectionResearcher.js';
import {
  ActionRepository,
  type QueuedActionRecord,
} from '../repositories/ActionRepository.js';
import {
  ActionResultRepository,
  type ActionResultRecord,
} from '../repositories/ActionResultRepository.js';
import {
  ReflectionThreadRepository,
  type ReflectionThreadRecord,
  type ReflectionRunRecord,
  type ReflectionResearchAttemptRecord,
  type TopicMemoryLinkRecord,
  type DreamRunRecord,
} from '../repositories/ReflectionThreadRepository.js';
import { MarkdownManager } from './MarkdownManager.js';
import {
  RehearsalService,
  hasStableCue,
  normalizeCues,
  type CreateRehearsalInput,
} from './RehearsalService.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { RecallEngine } from './RecallEngine.js';
import { resolveDelegateOpenClawPolicy } from './actions/delegateOpenClawPolicy.js';
import type {
  RecallChannelDiagnostic,
  Rehearsal,
  RehearsalActivationCues,
} from '../types/index.js';

interface MessageSignalRow {
  id: string;
  content: string;
  importance: number;
  entities_json: string | null;
  matched_projects_json: string | null;
  created_at: number;
}

interface ConfirmRequestSignalRow {
  id: string;
  question: string;
  context: string | null;
  priority: string;
  related_entity_id: string | null;
  created_at: number;
}

interface EntityPropertySignalRow {
  id: number;
  entity_id: string;
  property_key: string;
  property_value: string;
  confidence: number;
  source_context: string | null;
  tx_start: number;
}

interface EntityRow {
  id: string;
  name: string;
  type: string | null;
}

interface ProfileItemRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  salience_score: number;
  updated_at: number;
}

interface EntityPropertyPreviewRow {
  property_key: string;
  property_value: string;
  confidence: number | null;
}

type ReflectionWaitingReason =
  | 'waiting_for_delegation'
  | 'waiting_for_confirm_request'
  | 'waiting_for_outreach'
  | 'waiting_for_manual_action';

interface PendingActionRow {
  action_type: string | null;
  execution_mode: 'manual' | 'auto' | null;
  requires_approval: number;
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  );
}

function toPriorityFromLabel(label: string | undefined): number {
  if (label === 'high') return 9;
  if (label === 'low') return 4;
  return 6;
}

function clampSalience(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(value!, 1));
}

function summarizeFailedRecallChannels(
  diagnostics: RecallChannelDiagnostic[] | undefined,
): string | undefined {
  const failed = (diagnostics ?? []).filter(
    (diagnostic) => diagnostic.status === 'failed',
  );
  if (failed.length === 0) return undefined;
  return failed
    .map((diagnostic) =>
      diagnostic.reason
        ? `${diagnostic.channel}(${diagnostic.reason})`
        : diagnostic.channel,
    )
    .join(', ');
}

function parseOutputLanguagePreference(
  text: string | undefined | null,
  source: string,
): ReflectionOutputLanguagePreference | undefined {
  if (!text?.trim()) return undefined;
  const value = text.trim();
  const lower = value.toLowerCase();
  if (
    /match user'?s language|follow user'?s language|same language as/i.test(
      value,
    ) ||
    /跟随用户|匹配用户|使用用户当前语言/.test(value)
  ) {
    return undefined;
  }

  const chinesePattern =
    /(preferred[_ -]?language|response[_ -]?language|output[_ -]?language|language[_ -]?preference|语言|回复|输出|回答).{0,80}(中文|简体中文|chinese|zh-cn|zh_cn|zh\b)|^(中文|简体中文|chinese|zh-cn|zh_cn)$/i;
  const englishPattern =
    /(preferred[_ -]?language|response[_ -]?language|output[_ -]?language|language[_ -]?preference|语言|回复|输出|回答).{0,80}(english|英文|en-us|en_us|en\b)|^(english|英文|en-us|en_us)$/i;

  if (chinesePattern.test(value)) {
    return { code: 'zh-CN', label: 'Simplified Chinese', source };
  }
  if (englishPattern.test(value)) {
    return { code: 'en-US', label: 'English', source };
  }
  if (/^zh[-_]/i.test(lower) || /简体中文|中文/.test(value)) {
    return { code: 'zh-CN', label: 'Simplified Chinese', source };
  }
  if (/^en[-_]/i.test(lower) || /\benglish\b/i.test(value)) {
    return { code: 'en-US', label: 'English', source };
  }
  return undefined;
}

function inferOutputLanguageFromEvidence(
  evidence: ReflectionEvidenceItem[],
): ReflectionOutputLanguagePreference | undefined {
  const text = evidence
    .slice(0, 20)
    .map((item) => `${item.title}\n${item.snippet}`)
    .join('\n');
  if (!text.trim()) return undefined;
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const englishWords = text.match(/\b[a-z][a-z'-]{2,}\b/gi)?.length ?? 0;
  if (chineseChars >= 8 && chineseChars * 2 >= englishWords) {
    return {
      code: 'zh-CN',
      label: 'Simplified Chinese',
      source: 'dominant evidence language',
    };
  }
  if (englishWords >= 25 && chineseChars < 8) {
    return {
      code: 'en-US',
      label: 'English',
      source: 'dominant evidence language',
    };
  }
  return undefined;
}

export class ReflectionThreadService {
  private readonly repo: ReflectionThreadRepository;
  private readonly actionRepo: ActionRepository;
  private readonly actionResultRepo: ActionResultRepository;
  private readonly worker: ReflectionWorker;
  private readonly researcher: ReflectionResearcher;
  private readonly rehearsalService: RehearsalService;
  private readonly markdownManager?: MarkdownManager;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {
    this.repo = new ReflectionThreadRepository(db);
    this.actionRepo = new ActionRepository(db);
    this.actionResultRepo = new ActionResultRepository(db);
    this.worker = new ReflectionWorker();
    this.researcher = new ReflectionResearcher(userDataManager);
    this.rehearsalService = new RehearsalService(db, userDataManager);
    this.markdownManager = userDataManager?.isInitialized
      ? new MarkdownManager(db, userDataManager.rootDir)
      : undefined;
  }

  listThreads(
    filters: Parameters<ReflectionThreadRepository['listThreads']>[0],
  ) {
    return this.repo.listThreads(filters);
  }

  listDueThreads(limit: number): ReflectionThreadRecord[] {
    return this.repo.listDueThreads(limit);
  }

  listThreadActions(threadId: string, limit = 20): QueuedActionRecord[] {
    return this.actionRepo.list({ threadId, limit }).items;
  }

  getHeartbeatBlockingReason(threadId: string): ReflectionWaitingReason | null {
    const thread = this.repo.getThreadById(threadId);
    if (!thread || thread.status !== 'active') return null;

    if (this.hasPendingConfirmRequestForThread(thread)) {
      return 'waiting_for_confirm_request';
    }
    if (this.hasActiveOutreachSession(thread.id)) {
      return 'waiting_for_outreach';
    }

    return this.getPendingActionBlockingReason(thread.id);
  }

  listRuns(threadId: string, limit = 20): ReflectionRunRecord[] {
    return this.repo.listRuns(threadId, limit);
  }

  getThreadDetail(threadId: string): {
    thread: ReflectionThreadRecord;
    runs: ReflectionRunRecord[];
    actions: QueuedActionRecord[];
    actionResults: ActionResultRecord[];
    researchAttempts: ReflectionResearchAttemptRecord[];
    links: Array<
      TopicMemoryLinkRecord & {
        preview?: string;
        previewTitle?: string;
        previewTimestamp?: number;
      }
    >;
    dreamRuns: DreamRunRecord[];
  } | null {
    const thread = this.repo.getThreadById(threadId);
    if (!thread) return null;

    const runs = this.repo.listRuns(threadId, 20);
    const actions = this.actionRepo.list({ threadId, limit: 20 }).items;
    const actionResults = this.actionResultRepo.listByThread(threadId, 20);
    const researchAttempts = this.repo.listResearchAttempts(threadId, 30);
    const rawLinks = this.repo.listLinks(threadId, 50);
    const links = rawLinks.map((link) => ({
      ...link,
      ...this.hydrateLink(link),
    }));
    const dreamRuns = this.repo.listDreamRuns({ threadId, limit: 10 });

    return {
      thread,
      runs,
      actions,
      actionResults,
      researchAttempts,
      links,
      dreamRuns,
    };
  }

  private getReflectionHeartbeatSeconds(): number {
    return (
      getUserRuntimeConfig(this.userDataManager).reflectionHeartbeatMinutes * 60
    );
  }

  private resolveReflectionOutputLanguage(
    evidence: ReflectionEvidenceItem[],
  ): ReflectionOutputLanguagePreference | undefined {
    const fromProfile = this.resolveLanguageFromProfileItems();
    if (fromProfile) return fromProfile;

    const fromMarkdown = this.resolveLanguageFromUserMarkdown();
    if (fromMarkdown) return fromMarkdown;

    return inferOutputLanguageFromEvidence(evidence);
  }

  private resolveLanguageFromProfileItems():
    | ReflectionOutputLanguagePreference
    | undefined {
    try {
      const rows = this.db
        .prepare(
          `SELECT item_key, item_value
           FROM user_profile_items
           WHERE status = 'active'
             AND (
               lower(item_key) LIKE '%language%'
               OR item_key LIKE '%语言%'
               OR lower(item_key) LIKE '%locale%'
               OR lower(item_key) LIKE '%response_style%'
               OR lower(item_key) LIKE '%communication_style%'
               OR lower(item_key) LIKE '%writing_style%'
             )
           ORDER BY user_confirmed DESC, salience_score DESC, updated_at DESC
           LIMIT 20`,
        )
        .all() as Array<{ item_key: string; item_value: string }>;
      for (const row of rows) {
        const parsed = parseOutputLanguagePreference(
          `${row.item_key}: ${row.item_value}`,
          `user_profile_items.${row.item_key}`,
        );
        if (parsed) return parsed;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private resolveLanguageFromUserMarkdown():
    | ReflectionOutputLanguagePreference
    | undefined {
    if (!this.userDataManager?.isInitialized) return undefined;
    const candidatePaths = [
      'user.md',
      'USER.md',
      'USER_CORE.md',
      'CORE_MEMORY.md',
      'agent/IDENTITY.md',
    ];
    for (const candidatePath of candidatePaths) {
      try {
        const content = this.userDataManager.readFile(candidatePath);
        const parsed = parseOutputLanguagePreference(
          content,
          candidatePath,
        );
        if (parsed) return parsed;
      } catch {
        // Optional profile files should never block a reflection heartbeat.
      }
    }
    return undefined;
  }

  listActionResults(threadId: string, limit = 20): ActionResultRecord[] {
    return this.actionResultRepo.listByThread(threadId, limit);
  }

  recordOnlineReflectionSignal(
    input: ReflectionInput,
    output: ReflectionOutput,
  ): { thread: ReflectionThreadRecord; run: ReflectionRunRecord } | null {
    const hasSignal =
      output.shouldStore ||
      output.newFacts.length > 0 ||
      output.userPreferences.length > 0 ||
      output.improvements.length > 0;
    if (!hasSignal) return null;

    const entityHint = output.newFacts[0]?.entity?.trim();
    const topicKey = entityHint
      ? `entity:${toSlug(entityHint)}`
      : `ask:${contentHash(input.query.toLowerCase()).slice(0, 16)}`;
    const title = entityHint
      ? `自我反思: ${entityHint}`
      : `自我反思: ${input.query.slice(0, 48)}`;

    const salience = clampSalience(
      0.45 +
        output.newFacts.length * 0.1 +
        output.userPreferences.length * 0.07 +
        output.improvements.length * 0.06,
    );
    const openQuestions = output.improvements.slice(0, 6);
    const summary = this.buildOnlineSummary(input, output);

    let thread = this.repo.upsertThread({
      topicKey,
      title,
      status: 'active',
      priority: output.newFacts.length > 0 ? 7 : 6,
      salience,
      sourceType: 'ask',
      currentHypothesis: output.userPreferences[0] ?? output.newFacts[0]?.value,
      openQuestions,
      latestSummary: summary,
      nextReflectionAt: now() + this.getReflectionHeartbeatSeconds(),
      continueReason:
        'Online reflection detected reusable insight from a user interaction.',
    });

    const defaultPath =
      thread.latestMarkdownPath ?? this.defaultThreadPath(thread);
    if (!thread.latestMarkdownPath) {
      thread = this.repo.upsertThread({
        topicKey: thread.topicKey,
        title: thread.title,
        latestMarkdownPath: defaultPath,
      });
    }

    for (const itemId of input.usedItemIds) {
      const sourceKind = /^\d+$/.test(itemId) ? 'chunk' : 'message';
      this.repo.addLink(thread.id, sourceKind, itemId, 1, 'evidence');
    }

    const run = this.repo.createRun({
      threadId: thread.id,
      runType: 'online_reflection',
      triggerType: 'ask',
      inputRefs: uniqStrings([`query:${input.query.slice(0, 120)}`]),
      summary,
      hypothesisBefore: thread.currentHypothesis,
      hypothesisAfter: output.userPreferences[0] ?? thread.currentHypothesis,
      discoveries: [
        ...output.newFacts.map(
          (fact) =>
            `${fact.entity}.${fact.key} = ${fact.value} (${fact.confidence.toFixed(2)})`,
        ),
        ...output.userPreferences.map((pref) => `Preference: ${pref}`),
      ],
      openQuestions,
      actions: [],
      markdownSnapshotPath: defaultPath,
    });

    this.repo.updateThreadAfterRun(thread.id, {
      latestSummary: summary,
      latestMarkdownPath: defaultPath,
      currentHypothesis: output.userPreferences[0] ?? thread.currentHypothesis,
      openQuestions,
      nextReflectionAt: now() + this.getReflectionHeartbeatSeconds(),
      lastReflectedAt: now(),
      continueReason:
        'Online reflection produced facts, preferences, or improvements worth revisiting.',
    });

    this.syncThreadDocument(thread.id);

    return {
      thread: this.repo.getThreadById(thread.id)!,
      run,
    };
  }

  ingestConfirmRequest(
    confirmRequestId: string,
  ): ReflectionThreadRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, question, context, priority, related_entity_id, created_at
         FROM confirm_requests
         WHERE id = ?`,
      )
      .get(confirmRequestId) as ConfirmRequestSignalRow | undefined;
    if (!row) return null;

    const entityTitle = row.related_entity_id
      ? (
          this.db
            .prepare('SELECT id, name, type FROM entities WHERE id = ?')
            .get(row.related_entity_id) as EntityRow | undefined
        )?.name
      : undefined;
    const title = entityTitle
      ? `决策跟进: ${entityTitle}`
      : `决策跟进: ${row.question.slice(0, 48)}`;

    const thread = this.repo.upsertThread({
      topicKey: `confirm_request:${row.id}`,
      title,
      status: 'active',
      priority: toPriorityFromLabel(row.priority),
      salience: 0.82,
      sourceType: 'confirm_request',
      sourceRefId: row.id,
      currentHypothesis: row.context ?? undefined,
      openQuestions: [row.question],
      latestSummary: row.question,
      nextReflectionAt: now(),
      continueReason:
        'A confirm request needs human decision or further evidence.',
    });

    this.repo.addLink(thread.id, 'confirm_request', row.id, 1, 'trigger');
    return thread;
  }

  ingestMessageSignal(messageId: string): ReflectionThreadRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, content, importance, entities_json, matched_projects_json, created_at
         FROM messages_raw
         WHERE id = ?`,
      )
      .get(messageId) as MessageSignalRow | undefined;
    if (!row) return null;

    const projectIds = this.parseJsonArray<string>(row.matched_projects_json);
    const entityHints = this.parseJsonArray<{ id?: string; name?: string }>(
      row.entities_json,
    );

    let topicKey = `message:${row.id}`;
    let title = `消息追踪: ${row.content.slice(0, 42)}`;

    if (projectIds.length > 0) {
      const project = this.db
        .prepare('SELECT id, name FROM watched_projects WHERE id = ?')
        .get(projectIds[0]) as { id: string; name: string } | undefined;
      if (project) {
        topicKey = `project:${project.id}`;
        title = `项目反思: ${project.name}`;
      }
    } else if (entityHints.length > 0) {
      const firstEntity = entityHints[0];
      const name = firstEntity?.name ?? 'Unknown';
      topicKey = firstEntity?.id
        ? `entity:${firstEntity.id}`
        : `entity-name:${toSlug(name)}`;
      title = `实体反思: ${name}`;
    }

    const thread = this.repo.upsertThread({
      topicKey,
      title,
      status: 'active',
      priority: Math.max(5, Math.min(10, Math.round(row.importance * 10))),
      salience: clampSalience(row.importance),
      sourceType: 'message',
      sourceRefId: row.id,
      latestSummary: row.content.slice(0, 180),
      nextReflectionAt: now(),
      continueReason:
        'A high-importance message was captured and queued for reflection.',
    });

    this.repo.addLink(
      thread.id,
      'message',
      row.id,
      Math.max(0.5, row.importance),
      'trigger',
    );
    return thread;
  }

  ingestEntityPropertySignal(
    propertyId: number,
  ): ReflectionThreadRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, entity_id, property_key, property_value, confidence, source_context, tx_start
         FROM entity_properties
         WHERE id = ?`,
      )
      .get(propertyId) as EntityPropertySignalRow | undefined;
    if (!row) return null;

    const entity = this.db
      .prepare('SELECT id, name, type FROM entities WHERE id = ?')
      .get(row.entity_id) as EntityRow | undefined;
    const entityName = entity?.name ?? row.entity_id;

    const thread = this.repo.upsertThread({
      topicKey: `entity_property:${row.entity_id}:${row.property_key}`,
      title: `事实跟进: ${entityName} · ${row.property_key}`,
      status: 'active',
      priority: Math.max(
        5,
        Math.min(10, Math.round((row.confidence || 0.6) * 10)),
      ),
      salience: clampSalience(row.confidence),
      sourceType: 'entity_property',
      sourceRefId: String(row.id),
      currentHypothesis: `${entityName}.${row.property_key} -> ${row.property_value}`,
      openQuestions: [
        `${entityName} 的 ${row.property_key} 是否还会继续变化？`,
      ],
      latestSummary: `${entityName} 的 ${row.property_key} 更新为 ${row.property_value}`,
      nextReflectionAt: now(),
      continueReason:
        'A truth/property change was observed and needs follow-up.',
    });

    this.repo.addLink(
      thread.id,
      'entity_property',
      String(row.id),
      Math.max(0.5, row.confidence),
      'trigger',
    );
    return thread;
  }

  ingestProfileSignal(profileItemId: string): ReflectionThreadRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, item_type, item_key, item_value, salience_score, updated_at
         FROM user_profile_items
         WHERE id = ?`,
      )
      .get(profileItemId) as ProfileItemRow | undefined;
    if (!row) return null;

    const thread = this.repo.upsertThread({
      topicKey: `profile:${row.item_type}:${toSlug(row.item_key)}`,
      title: `画像反思: ${row.item_key}`,
      status: 'active',
      priority: 6,
      salience: clampSalience(row.salience_score),
      sourceType: 'profile_item',
      sourceRefId: row.id,
      currentHypothesis: row.item_value,
      openQuestions: [`${row.item_key} 是否已经成为稳定偏好？`],
      latestSummary: `${row.item_key}: ${row.item_value}`,
      nextReflectionAt: now(),
      continueReason:
        'A high-salience user profile update should be revisited.',
    });

    this.repo.addLink(
      thread.id,
      'profile_item',
      row.id,
      Math.max(0.5, row.salience_score),
      'trigger',
    );
    return thread;
  }

  recordDreamRun(input: {
    sourceType: string;
    sourceRefId?: string;
    title: string;
    summary?: string;
    insights?: string[];
    risks?: string[];
    relationships?: Array<Record<string, unknown>>;
    markdownPath?: string;
  }): DreamRunRecord {
    const topicKey = input.sourceRefId
      ? `${input.sourceType}:${input.sourceRefId}`
      : `dream:${contentHash(input.title.toLowerCase()).slice(0, 16)}`;
    const thread = this.repo.upsertThread({
      topicKey,
      title: `梦境重放: ${input.title}`,
      status: 'active',
      priority: 7,
      salience: 0.78,
      sourceType: 'dream',
      sourceRefId: input.sourceRefId,
      latestSummary: input.summary,
      nextReflectionAt: now() + 6 * 3600,
      continueReason:
        'Weekly dream replay surfaced insights or risks to revisit.',
    });

    const dreamRun = this.repo.createDreamRun({
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId,
      threadIds: [thread.id],
      summary: input.summary,
      insights: input.insights,
      risks: input.risks,
      relationships: input.relationships,
      markdownPath: input.markdownPath,
    });

    this.repo.addLink(thread.id, 'dream_run', dreamRun.id, 1, 'dream');
    this.syncThreadDocument(thread.id);
    return dreamRun;
  }

  async runReflection(
    threadId: string,
    options: {
      runType?: string;
      triggerType?: string;
      force?: boolean;
    } = {},
  ): Promise<{
    thread: ReflectionThreadRecord;
    run: ReflectionRunRecord;
    actions: QueuedActionRecord[];
    rehearsals: Rehearsal[];
  }> {
    const thread = this.repo.getThreadById(threadId);
    if (!thread) {
      throw new Error(`Reflection thread "${threadId}" not found`);
    }

    if (!options.force && thread.status !== 'active') {
      throw new Error(`Reflection thread "${threadId}" is not active`);
    }

    const triggerType = options.triggerType ?? 'manual';
    const runId = randomUUID();
    const evidence = this.collectEvidence(thread, 40);
    const recentRuns = this.repo.listRuns(thread.id, 5);
    const researchQueries = await this.researcher.plan(
      thread,
      evidence,
      recentRuns,
    );
    const researchEvidence = await this.executeResearchQueries(
      thread,
      researchQueries,
      runId,
    );
    const combinedEvidence = this.mergeEvidence(evidence, researchEvidence);
    const outputLanguage =
      this.resolveReflectionOutputLanguage(combinedEvidence);
    const generated = await this.worker.generate(
      thread,
      combinedEvidence,
      triggerType,
      outputLanguage,
    );

    const threadPath =
      thread.latestMarkdownPath ?? this.defaultThreadPath(thread);
    const latestRun = this.repo.getLatestRun(thread.id);
    const run = this.repo.createRun({
      id: runId,
      threadId: thread.id,
      runType: options.runType ?? 'continuous_reflection',
      triggerType,
      inputRefs: combinedEvidence.map(
        (item) => `${item.sourceKind}:${item.sourceId}`,
      ),
      previousRunId: latestRun?.id,
      summary: generated.summary,
      hypothesisBefore: thread.currentHypothesis,
      hypothesisAfter: generated.hypothesisAfter,
      discoveries: generated.discoveries,
      openQuestions: generated.openQuestions,
      actions: generated.actionProposals.map((action) => ({
        ...action,
      })),
      markdownSnapshotPath: threadPath,
    });

    const createdActions = generated.actionProposals.map((proposal, index) => {
      const delegatePolicy =
        proposal.actionType === 'delegate_openclaw'
          ? resolveDelegateOpenClawPolicy({
              params:
                proposal.params &&
                typeof proposal.params === 'object' &&
                !Array.isArray(proposal.params)
                  ? (proposal.params as Record<string, unknown>)
                  : {},
              requestedExecutionMode: proposal.executionMode,
              requestedRequiresApproval: proposal.requiresApproval,
              defaultExecutionMode: proposal.executionMode,
              defaultRequiresApproval: proposal.requiresApproval,
            })
          : null;
      return this.actionRepo.create({
        actionType: proposal.actionType,
        title: proposal.title,
        description: proposal.description,
        params:
          proposal.actionType === 'notify_user'
            ? {
                ...(proposal.params ?? {}),
                payload: {
                  ...(proposal.params?.payload as
                    | Record<string, unknown>
                    | undefined),
                  threadId: thread.id,
                  runId: run.id,
                  userId: this.userId,
                },
              }
            : proposal.params,
        riskLevel: proposal.riskLevel,
        confidence: proposal.confidence,
        evidenceRefs: uniqStrings([
          ...(proposal.evidenceRefs ?? []),
          ...combinedEvidence
            .slice(0, 5)
            .map((item) => `${item.sourceKind}:${item.sourceId}`),
        ]),
        requiresApproval:
          delegatePolicy?.requiresApproval ?? proposal.requiresApproval,
        state: 'pending',
        source: 'reflection_worker',
        threadId: thread.id,
        runId: run.id,
        executionMode: delegatePolicy?.executionMode ?? proposal.executionMode,
        priority: proposal.priority,
        idempotencyKey: `${thread.topicKey}:${run.id}:${proposal.actionType}:${index}`,
        scheduledAt: proposal.scheduledAt,
        sourceKind: 'reflection_run',
        sourceRefId: run.id,
        queueStatus: 'queued',
        utilityScore: proposal.utilityScore,
        urgencyScore: proposal.urgencyScore,
      });
    });

    if (createdActions.length > 0) {
      this.repo.updateRunActions(
        run.id,
        createdActions.map((action) => ({
          id: action.id,
          actionType: action.actionType,
          title: action.title,
          queueStatus: action.queueStatus,
          executionMode: action.executionMode,
          priority: action.priority,
        })),
      );
    }

    const createdRehearsals = this.persistRehearsalCandidates(
      thread,
      run,
      generated.rehearsalCandidates ?? [],
      combinedEvidence,
    );

    const updatedThread = this.repo.updateThreadAfterRun(thread.id, {
      latestSummary: generated.summary,
      latestMarkdownPath: threadPath,
      currentHypothesis: generated.hypothesisAfter,
      openQuestions: generated.openQuestions,
      nextReflectionAt: now() + this.getReflectionHeartbeatSeconds(),
      lastReflectedAt: now(),
      continueReason: generated.openQuestions[0] ?? thread.continueReason,
      status: thread.status,
    });

    this.syncThreadDocument(thread.id);

    return {
      thread: updatedThread ?? this.repo.getThreadById(thread.id)!,
      run,
      actions: createdActions,
      rehearsals: createdRehearsals,
    };
  }

  private persistRehearsalCandidates(
    thread: ReflectionThreadRecord,
    run: ReflectionRunRecord,
    candidates: DraftRehearsalCandidate[],
    evidence: ReflectionEvidenceItem[],
  ): Rehearsal[] {
    const persisted: Rehearsal[] = [];
    for (const candidate of candidates.slice(0, 5)) {
      const input = this.buildRehearsalInput(thread, run, candidate, evidence);
      if (!input.sourceRefId) continue;

      const existing = this.rehearsalService.findBySource(
        input.sourceKind ?? 'reflection',
        input.sourceRefId,
      );
      if (existing?.status === 'archived' || existing?.status === 'dismissed') {
        continue;
      }

      const rehearsal = existing
        ? this.rehearsalService.update(existing.id, {
            title: input.title,
            scenarioType: input.scenarioType,
            summary: input.summary,
            content: input.content,
            activationCues: input.activationCues,
            evidenceRefs: input.evidenceRefs,
            confidence: input.confidence,
            priority: input.priority,
            validUntil: input.validUntil,
            status:
              existing.status === 'stale' &&
              (input.confidence ?? 0) >= 0.82 &&
              hasStableCue(input.activationCues ?? {})
                ? 'active'
                : undefined,
            staleReason:
              existing.status === 'stale' &&
              (input.confidence ?? 0) >= 0.82 &&
              hasStableCue(input.activationCues ?? {})
                ? null
                : undefined,
          })
        : this.rehearsalService.create(input);

      if (!rehearsal) continue;
      persisted.push(rehearsal);
      this.repo.addLink(
        thread.id,
        'rehearsal',
        rehearsal.id,
        Math.max(0.55, rehearsal.confidence),
        'rehearsal_candidate',
      );
    }
    return persisted;
  }

  private buildRehearsalInput(
    thread: ReflectionThreadRecord,
    run: ReflectionRunRecord,
    candidate: DraftRehearsalCandidate,
    evidence: ReflectionEvidenceItem[],
  ): CreateRehearsalInput {
    const activationCues = normalizeCues(candidate.activationCues);
    const sourceRefId = this.buildRehearsalSourceRef(
      thread,
      candidate,
      activationCues,
    );
    return {
      title: candidate.title,
      scenarioType: candidate.scenarioType ?? 'general',
      summary: candidate.summary,
      content: candidate.content,
      activationCues,
      evidenceRefs: uniqStrings([
        ...(candidate.evidenceRefs ?? []),
        `reflection_thread:${thread.id}`,
        `reflection_run:${run.id}`,
        ...evidence
          .slice(0, 8)
          .map((item) => `${item.sourceKind}:${item.sourceId}`),
      ]),
      sourceKind: 'reflection',
      sourceRefId,
      confidence: candidate.confidence,
      priority: candidate.priority,
      validUntil: candidate.validUntil,
    };
  }

  private buildRehearsalSourceRef(
    thread: ReflectionThreadRecord,
    candidate: DraftRehearsalCandidate,
    cues: RehearsalActivationCues,
  ): string {
    const cueKey = this.rehearsalCueFingerprint(cues);
    const scenario = candidate.scenarioType ?? 'general';
    const sceneKey = candidate.dedupeKey?.trim()
      ? toSlug(candidate.dedupeKey)
      : [cueKey, toSlug(candidate.title)].filter(Boolean).join('|');
    const stableBase = [
      thread.topicKey,
      scenario,
      sceneKey || toSlug(candidate.title),
    ].join('|');
    return `thread:${thread.id}:${contentHash(stableBase).slice(0, 16)}`;
  }

  private rehearsalCueFingerprint(cues: RehearsalActivationCues): string {
    return [
      'people',
      'projects',
      'groupIds',
      'conversationIds',
      'meetingIds',
      'calendarEventIds',
      'issueKeys',
      'urls',
      'topics',
      'keywords',
      'surfaces',
    ]
      .map((key) => {
        const values = cues[key as keyof RehearsalActivationCues] ?? [];
        return values.length
          ? `${key}:${values.map((value) => value.toLowerCase()).sort().join(',')}`
          : '';
      })
      .filter(Boolean)
      .join('|');
  }

  hasPendingDelegation(threadId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT id
         FROM proposed_actions
         WHERE thread_id = ?
           AND action_type = 'delegate_openclaw'
           AND queue_status IN ('queued', 'running')
         LIMIT 1`,
      )
      .get(threadId) as { id: string } | undefined;
    return Boolean(row);
  }

  deferHeartbeatReflection(
    threadId: string,
    reason: ReflectionWaitingReason = 'waiting_for_delegation',
  ): ReflectionThreadRecord | null {
    const thread = this.repo.getThreadById(threadId);
    if (!thread) return null;
    const updated = this.repo.updateThreadAfterRun(threadId, {
      nextReflectionAt: now() + this.getReflectionHeartbeatSeconds(),
      continueReason: reason,
    });
    if (updated) this.syncThreadDocument(threadId);
    return updated;
  }

  markThreadWaitingForConfirmRequest(
    threadId: string,
  ): ReflectionThreadRecord | null {
    return this.deferHeartbeatReflection(
      threadId,
      'waiting_for_confirm_request',
    );
  }

  markThreadWaitingForOutreach(
    threadId: string,
  ): ReflectionThreadRecord | null {
    return this.deferHeartbeatReflection(threadId, 'waiting_for_outreach');
  }

  resumeThreadsForConfirmRequest(confirmRequestId: string): string[] {
    const threadIds = new Set<string>();

    const sourceThreads = this.db
      .prepare(
        `SELECT id
         FROM reflection_threads
         WHERE source_type = 'confirm_request'
           AND source_ref_id = ?`,
      )
      .all(confirmRequestId) as Array<{ id: string }>;
    for (const row of sourceThreads) {
      threadIds.add(row.id);
    }

    const linkedActionThreads = this.db
      .prepare(
        `SELECT DISTINCT thread_id
         FROM proposed_actions
         WHERE thread_id IS NOT NULL
           AND action_type = 'create_confirm_request'
           AND json_extract(result_json, '$.confirmRequestId') = ?`,
      )
      .all(confirmRequestId) as Array<{ thread_id: string }>;
    for (const row of linkedActionThreads) {
      if (row.thread_id) threadIds.add(row.thread_id);
    }

    const resumed: string[] = [];
    for (const threadId of threadIds) {
      const thread = this.repo.getThreadById(threadId);
      if (!thread || thread.status !== 'active') continue;
      const updated = this.repo.updateThreadAfterRun(threadId, {
        nextReflectionAt: now(),
        continueReason: 'confirm request answered',
      });
      if (updated) {
        resumed.push(threadId);
        this.syncThreadDocument(threadId);
      }
    }

    return resumed;
  }

  recordActionResult(result: ActionResultRecord): void {
    this.repo.addLink(
      result.threadId,
      'action_result',
      result.id,
      1,
      'evidence',
    );
    this.repo.updateThreadAfterRun(result.threadId, {
      nextReflectionAt: now(),
      continueReason: 'new action result available',
    });
    this.syncThreadDocument(result.threadId);
  }

  pauseThread(
    threadId: string,
    reason?: string,
  ): ReflectionThreadRecord | null {
    const thread = this.repo.setThreadStatus(threadId, 'paused', reason, null);
    if (thread) this.syncThreadDocument(threadId);
    return thread;
  }

  closeThread(
    threadId: string,
    reason?: string,
  ): ReflectionThreadRecord | null {
    const thread = this.repo.setThreadStatus(threadId, 'closed', reason, null);
    if (thread) this.syncThreadDocument(threadId);
    return thread;
  }

  resumeThread(threadId: string): ReflectionThreadRecord | null {
    const thread = this.repo.setThreadStatus(
      threadId,
      'active',
      undefined,
      now(),
    );
    if (thread) this.syncThreadDocument(threadId);
    return thread;
  }

  refreshThreadDocument(threadId: string): void {
    this.syncThreadDocument(threadId);
  }

  private buildOnlineSummary(
    input: ReflectionInput,
    output: ReflectionOutput,
  ): string {
    const parts: string[] = [];
    if (output.newFacts.length > 0) {
      parts.push(
        `Extracted ${output.newFacts.length} new fact(s) from the ask interaction.`,
      );
    }
    if (output.userPreferences.length > 0) {
      parts.push(
        `Detected ${output.userPreferences.length} implicit preference(s).`,
      );
    }
    if (output.improvements.length > 0) {
      parts.push(
        `Identified ${output.improvements.length} follow-up improvement(s).`,
      );
    }
    if (parts.length === 0) {
      parts.push(
        `The ask interaction "${input.query.slice(0, 80)}" was marked for future revisit.`,
      );
    }
    return parts.join(' ');
  }

  private defaultThreadPath(thread: ReflectionThreadRecord): string {
    return `reflection-threads/${toSlug(thread.title).slice(0, 48) || 'reflection-thread'}-${thread.id.slice(0, 8)}.md`;
  }

  private collectEvidence(
    thread: ReflectionThreadRecord,
    limit = 20,
  ): ReflectionEvidenceItem[] {
    return this.repo.listLinks(thread.id, limit).map((link) => {
      const hydrated = this.hydrateLink(link);
      return {
        sourceKind: link.sourceKind,
        sourceId: link.sourceId,
        title: hydrated.previewTitle ?? `${link.sourceKind}:${link.sourceId}`,
        snippet: hydrated.preview ?? '(no preview available)',
        createdAt: hydrated.previewTimestamp,
        role: link.role,
      };
    });
  }

  private async executeResearchQueries(
    thread: ReflectionThreadRecord,
    queries: LocalResearchQuery[],
    runId: string,
  ): Promise<ReflectionEvidenceItem[]> {
    if (queries.length === 0) return [];
    const recallEngine = new RecallEngine(this.db);
    const evidenceItems: ReflectionEvidenceItem[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const result = await recallEngine.recall({
          query: query.query,
          topK: query.topK,
          includeMetadata: true,
          timeRange: query.timeRange,
          projectFilter: query.projectFilter,
          senderFilter: query.senderFilter,
          groupFilter: query.groupFilter,
          sourceTypes: query.sourceTypes,
        });
        const evidenceRefs: string[] = [];
        const failedChannelSummary = summarizeFailedRecallChannels(
          result.channelDiagnostics,
        );

        for (const item of result.items) {
          const sourceKind =
            item.type === 'chunk'
              ? 'chunk'
              : item.type === 'entity'
                ? 'entity'
                : 'message';
          const key = `${sourceKind}:${item.id}`;
          evidenceRefs.push(key);
          if (seen.has(key)) continue;
          seen.add(key);

          if (
            sourceKind === 'message' ||
            sourceKind === 'chunk' ||
            sourceKind === 'entity'
          ) {
            this.repo.addLink(
              thread.id,
              sourceKind,
              item.id,
              Math.max(0.55, item.score),
              'research',
            );
          }

          evidenceItems.push({
            sourceKind,
            sourceId: item.id,
            title: query.purpose,
            snippet: item.content.slice(0, 240),
            createdAt: item.timestamp,
            role: 'research',
          });
        }

        const hasHits = result.items.length > 0;
        this.repo.recordResearchAttempt({
          threadId: thread.id,
          runId,
          query: query.query,
          purpose: query.purpose,
          status: hasHits ? 'hit' : failedChannelSummary ? 'failed' : 'empty',
          resultCount: result.items.length,
          sourceTypes: query.sourceTypes,
          projectFilter: query.projectFilter,
          senderFilter: query.senderFilter,
          groupFilter: query.groupFilter,
          errorMessage: failedChannelSummary
            ? hasHits
              ? `部分召回通道失败，命中可能不完整：${failedChannelSummary}`
              : `本地研究查询未完成：${failedChannelSummary}`
            : undefined,
          evidenceRefs,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          '[ReflectionThreadService] Local research query failed:',
          message,
        );
        this.repo.recordResearchAttempt({
          threadId: thread.id,
          runId,
          query: query.query,
          purpose: query.purpose,
          status: 'failed',
          resultCount: 0,
          sourceTypes: query.sourceTypes,
          projectFilter: query.projectFilter,
          senderFilter: query.senderFilter,
          groupFilter: query.groupFilter,
          errorMessage: message.slice(0, 500),
          evidenceRefs: [],
        });
      }
    }

    return evidenceItems;
  }

  private hasPendingConfirmRequestForThread(
    thread: ReflectionThreadRecord,
  ): boolean {
    if (thread.sourceType === 'confirm_request' && thread.sourceRefId) {
      const sourcePending = this.db
        .prepare(
          `SELECT id
           FROM confirm_requests
           WHERE id = ?
             AND state = 'pending'
             AND COALESCE(routing, 'decision') = 'decision'
           LIMIT 1`,
        )
        .get(thread.sourceRefId) as { id: string } | undefined;
      if (sourcePending) return true;
    }

    const linkedPending = this.db
      .prepare(
        `SELECT cr.id
         FROM proposed_actions a
         JOIN confirm_requests cr
           ON cr.id = json_extract(a.result_json, '$.confirmRequestId')
         WHERE a.thread_id = ?
           AND a.action_type = 'create_confirm_request'
           AND a.queue_status = 'succeeded'
           AND cr.state = 'pending'
           AND COALESCE(cr.routing, 'decision') = 'decision'
          LIMIT 1`,
      )
      .get(thread.id) as { id: string } | undefined;
    return Boolean(linkedPending);
  }

  private hasActiveOutreachSession(threadId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT id
         FROM outreach_sessions
         WHERE thread_id = ?
           AND status IN ('pending_approval', 'scheduled', 'waiting_reply', 'deferred')
         LIMIT 1`,
      )
      .get(threadId) as { id: string } | undefined;
    return Boolean(row);
  }

  private getPendingActionBlockingReason(
    threadId: string,
  ): ReflectionWaitingReason | null {
    const rows = this.db
      .prepare(
        `SELECT action_type, execution_mode, requires_approval
         FROM proposed_actions
         WHERE thread_id = ?
           AND queue_status IN ('queued', 'running')
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all(threadId) as PendingActionRow[];

    if (rows.some((row) => row.action_type === 'create_confirm_request')) {
      return 'waiting_for_confirm_request';
    }
    if (rows.some((row) => row.action_type === 'ask_external_user')) {
      return 'waiting_for_outreach';
    }
    if (rows.some((row) => row.action_type === 'delegate_openclaw')) {
      return 'waiting_for_delegation';
    }
    if (rows.length > 0) {
      return 'waiting_for_manual_action';
    }
    return null;
  }

  private mergeEvidence(
    primary: ReflectionEvidenceItem[],
    secondary: ReflectionEvidenceItem[],
  ): ReflectionEvidenceItem[] {
    const result: ReflectionEvidenceItem[] = [];
    const seen = new Set<string>();

    for (const item of [...primary, ...secondary]) {
      const key = `${item.sourceKind}:${item.sourceId}:${item.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }

    return result;
  }

  private hydrateLink(link: TopicMemoryLinkRecord): {
    preview?: string;
    previewTitle?: string;
    previewTimestamp?: number;
  } {
    if (link.sourceKind === 'message') {
      const row = this.db
        .prepare('SELECT content, created_at FROM messages_raw WHERE id = ?')
        .get(link.sourceId) as
        | { content: string; created_at: number }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '消息线索',
        preview: row.content.slice(0, 240),
        previewTimestamp: row.created_at,
      };
    }

    if (link.sourceKind === 'confirm_request') {
      const row = this.db
        .prepare(
          'SELECT question, context, created_at FROM confirm_requests WHERE id = ?',
        )
        .get(link.sourceId) as
        | { question: string; context: string | null; created_at: number }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '待确认问题',
        preview: row.context
          ? `${row.question} | ${row.context}`
          : row.question,
        previewTimestamp: row.created_at,
      };
    }

    if (link.sourceKind === 'entity_property') {
      const row = this.db
        .prepare(
          `SELECT ep.property_key, ep.property_value, ep.tx_start, e.name AS entity_name
           FROM entity_properties ep
           LEFT JOIN entities e ON e.id = ep.entity_id
           WHERE ep.id = ?`,
        )
        .get(link.sourceId) as
        | {
            property_key: string;
            property_value: string;
            tx_start: number;
            entity_name: string | null;
          }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '事实变化',
        preview: `${row.entity_name ?? 'Unknown'} · ${row.property_key} = ${row.property_value}`,
        previewTimestamp: row.tx_start,
      };
    }

    if (link.sourceKind === 'profile_item') {
      const row = this.db
        .prepare(
          `SELECT item_key, item_value, updated_at
           FROM user_profile_items
           WHERE id = ?`,
        )
        .get(link.sourceId) as
        | { item_key: string; item_value: string; updated_at: number }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '用户画像',
        preview: `${row.item_key}: ${row.item_value}`,
        previewTimestamp: row.updated_at,
      };
    }

    if (link.sourceKind === 'dream_run') {
      const row = this.db
        .prepare('SELECT summary, created_at FROM dream_runs WHERE id = ?')
        .get(link.sourceId) as
        | { summary: string | null; created_at: number }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '梦境重放',
        preview: row.summary ?? 'Dream replay without summary.',
        previewTimestamp: row.created_at,
      };
    }

    if (link.sourceKind === 'rehearsal') {
      const row = this.db
        .prepare(
          `SELECT title, summary, content, updated_at
           FROM rehearsals
           WHERE id = ?`,
        )
        .get(link.sourceId) as
        | {
            title: string;
            summary: string | null;
            content: string;
            updated_at: number;
          }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: `场景预演: ${row.title}`,
        preview: (row.summary ?? row.content).slice(0, 240),
        previewTimestamp: row.updated_at,
      };
    }

    if (link.sourceKind === 'chunk') {
      const row = this.db
        .prepare('SELECT content, created_at FROM chunks WHERE chunk_id = ?')
        .get(Number(link.sourceId)) as
        | { content: string; created_at: number }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '记忆片段',
        preview: row.content.slice(0, 240),
        previewTimestamp: row.created_at,
      };
    }

    if (link.sourceKind === 'entity') {
      const row = this.db
        .prepare(
          `SELECT id, name, type, description, last_seen, updated_at, created_at
           FROM entities
           WHERE id = ?`,
        )
        .get(link.sourceId) as
        | {
            id: string;
            name: string;
            type: string;
            description: string | null;
            last_seen: number | null;
            updated_at: number | null;
            created_at: number;
          }
        | undefined;
      if (!row) return {};

      const properties = this.db
        .prepare(
          `SELECT property_key, property_value, confidence
           FROM entity_properties
           WHERE entity_id = ?
             AND status = 'active'
             AND tx_end IS NULL
           ORDER BY confidence DESC, tx_start DESC
           LIMIT 3`,
        )
        .all(link.sourceId) as EntityPropertyPreviewRow[];
      const propertyPreview =
        properties.length > 0
          ? ` | 已知事实: ${properties
              .map(
                (property) =>
                  `${property.property_key}=${property.property_value}`,
              )
              .join('; ')}`
          : '';

      return {
        previewTitle: `实体线索: ${row.name}`,
        preview: `${row.type}${
          row.description ? ` · ${row.description}` : ''
        }${propertyPreview}`,
        previewTimestamp: row.last_seen ?? row.updated_at ?? row.created_at,
      };
    }

    if (link.sourceKind === 'action_result') {
      const row = this.db
        .prepare(
          `SELECT summary, created_at
           FROM action_results
           WHERE id = ?`,
        )
        .get(link.sourceId) as
        | { summary: string; created_at: number }
        | undefined;
      if (!row) return {};
      return {
        previewTitle: '外部委派结果',
        preview: row.summary,
        previewTimestamp: row.created_at,
      };
    }

    return {};
  }

  private syncThreadDocument(threadId: string): void {
    const thread = this.repo.getThreadById(threadId);
    if (!thread || !this.userDataManager) return;

    const path = thread.latestMarkdownPath ?? this.defaultThreadPath(thread);
    const runs = this.repo.listRuns(thread.id, 20);
    const dreams = this.repo.listDreamRuns({ threadId: thread.id, limit: 10 });
    const actions = this.actionRepo.list({
      threadId: thread.id,
      limit: 20,
    }).items;
    const actionResults = this.actionResultRepo.listByThread(thread.id, 20);
    const researchAttempts = this.repo.listResearchAttempts(thread.id, 20);
    const links = this.repo.listLinks(thread.id, 20).map((link) => ({
      ...link,
      ...this.hydrateLink(link),
    }));

    const lines: string[] = [];
    lines.push(`# Reflection Thread: ${thread.title}`);
    lines.push('');
    lines.push(`- Topic Key: \`${thread.topicKey}\``);
    lines.push(`- Status: ${thread.status}`);
    lines.push(`- Priority: ${thread.priority}`);
    lines.push(`- Salience: ${thread.salience.toFixed(2)}`);
    lines.push(`- Reflection Count: ${thread.reflectionCount}`);
    if (thread.lastReflectedAt)
      lines.push(`- Last Reflected: ${formatDateTime(thread.lastReflectedAt)}`);
    if (thread.nextReflectionAt)
      lines.push(
        `- Next Reflection: ${formatDateTime(thread.nextReflectionAt)}`,
      );
    lines.push('');

    lines.push('## Current Hypothesis');
    lines.push(thread.currentHypothesis ?? 'None');
    lines.push('');

    lines.push('## Latest Summary');
    lines.push(thread.latestSummary ?? 'No summary yet.');
    lines.push('');

    lines.push('## Open Questions');
    if (thread.openQuestions.length > 0) {
      for (const question of thread.openQuestions) lines.push(`- ${question}`);
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('## Evidence Links');
    if (links.length > 0) {
      for (const link of links) {
        lines.push(
          `- [${link.sourceKind}/${link.role}] ${link.previewTitle ?? link.sourceId}: ${link.preview ?? '(no preview)'}`,
        );
      }
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('## Local Research Attempts');
    if (researchAttempts.length > 0) {
      for (const attempt of researchAttempts) {
        const scopeParts = [
          attempt.sourceTypes.length > 0
            ? `sources=${attempt.sourceTypes.join(',')}`
            : '',
          attempt.projectFilter ? `project=${attempt.projectFilter}` : '',
          attempt.senderFilter.length > 0
            ? `senders=${attempt.senderFilter.join(',')}`
            : '',
          attempt.groupFilter.length > 0
            ? `groups=${attempt.groupFilter.join(',')}`
            : '',
        ].filter(Boolean);
        lines.push(
          `- [${attempt.status}] ${attempt.purpose}: "${attempt.query}" (${attempt.resultCount} result${attempt.resultCount === 1 ? '' : 's'}${scopeParts.length > 0 ? `; ${scopeParts.join('; ')}` : ''})`,
        );
        if (attempt.errorMessage) {
          lines.push(`  - Error: ${attempt.errorMessage}`);
        }
      }
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('## Dream Replays');
    if (dreams.length > 0) {
      for (const dream of dreams) {
        lines.push(
          `- ${formatDateTime(dream.createdAt)}: ${dream.summary ?? 'Dream replay generated.'}`,
        );
      }
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('## Action Results');
    if (actionResults.length > 0) {
      for (const result of actionResults) {
        lines.push(
          `- ${formatDateTime(result.createdAt)} [${result.resultType}] ${result.summary}`,
        );
      }
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('## Action Queue');
    if (actions.length > 0) {
      for (const action of actions) {
        lines.push(
          `- [${action.queueStatus}] ${action.actionType}: ${action.title}`,
        );
      }
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('## Runs');
    if (runs.length > 0) {
      for (const run of runs) {
        lines.push('');
        lines.push(
          `### ${formatDateTime(run.createdAt)} · ${run.runType}/${run.triggerType ?? 'unknown'}`,
        );
        lines.push(run.summary);
        lines.push('');
        lines.push('#### Discoveries');
        if (run.discoveries.length > 0) {
          for (const discovery of run.discoveries) lines.push(`- ${discovery}`);
        } else {
          lines.push('- None');
        }
        lines.push('');
        lines.push('#### Open Questions');
        if (run.openQuestions.length > 0) {
          for (const question of run.openQuestions) lines.push(`- ${question}`);
        } else {
          lines.push('- None');
        }
        lines.push('');
        lines.push('#### Actions');
        if (run.actions.length > 0) {
          for (const action of run.actions) {
            lines.push(
              `- ${(action.title as string | undefined) ?? JSON.stringify(action)}`,
            );
          }
        } else {
          lines.push('- None');
        }
      }
    } else {
      lines.push('- No runs yet.');
    }
    lines.push('');

    this.userDataManager.writeFile(path, lines.join('\n'));
    void this.markdownManager?.reindexFile(path);

    if (path !== thread.latestMarkdownPath) {
      this.repo.upsertThread({
        topicKey: thread.topicKey,
        title: thread.title,
        latestMarkdownPath: path,
      });
    }
  }

  private parseJsonArray<T>(raw: string | null): T[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
