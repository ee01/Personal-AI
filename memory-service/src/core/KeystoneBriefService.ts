import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import type {
  ContextRecallMatch,
  ContextRecallRequest,
  KeystoneBrief,
  KeystoneBriefClaim,
  KeystoneBriefDisplayPolicy,
  KeystoneBriefFreshness,
  KeystoneBriefPresentation,
  KeystoneBriefSceneAnchors,
  KeystoneBriefSlots,
  KeystoneBriefSourceRef,
  KeystoneBriefStatus,
  KeystoneBriefSubjectType,
  KeystoneBriefScope,
} from '../types/index.js';
import { now } from '../utils/time.js';

const WRITE_RECEIPT = {
  writesProfile: false,
  sendsExternal: false,
  createsTask: false,
  updatesFacts: false,
  writesOutcomeEvent: true,
} as const;

const EMPTY_SLOTS: KeystoneBriefSlots = {
  whyItMatters: '',
  currentState: '',
  stableFacts: [],
  decisions: [],
  constraints: [],
  traps: [],
  peopleAndSources: [],
  nextUseCases: [],
  openQuestions: [],
};

const EMPTY_ANCHORS: KeystoneBriefSceneAnchors = {
  projects: [],
  jiraKeys: [],
  people: [],
  topics: [],
  surfaces: [],
};

export type KeystoneBriefEventType =
  | 'shown'
  | 'opened'
  | 'evidence_opened'
  | 'copied'
  | 'useful'
  | 'hidden'
  | 'not_accurate'
  | 'used_in_ask'
  | 'used_by_compiler';

export interface UpsertKeystoneBriefInput {
  id?: string;
  briefKey: string;
  title: string;
  subjectType: KeystoneBriefSubjectType;
  scope?: KeystoneBriefScope;
  status?: KeystoneBriefStatus;
  summary: string;
  externalSummary?: string;
  sourceAsOf?: number;
  freshness?: Partial<KeystoneBriefFreshness>;
  slots?: Partial<KeystoneBriefSlots>;
  sourceMap?: KeystoneBriefSourceRef[];
  sceneAnchors?: Partial<KeystoneBriefSceneAnchors>;
  displayPolicy?: Partial<KeystoneBriefDisplayPolicy>;
  compositionVersion?: string;
  inputSummary?: string;
  evaluationTags?: string[];
}

export interface KeystoneBriefEventInput {
  eventType: KeystoneBriefEventType;
  surface?: string;
  context?: Record<string, unknown>;
  reason?: string;
  detail?: string;
}

interface KeystoneBriefRow {
  id: string;
  brief_key: string;
  title: string;
  subject_type: KeystoneBriefSubjectType;
  scope: KeystoneBriefScope;
  status: KeystoneBriefStatus;
  summary: string;
  external_summary: string | null;
  source_as_of: number | null;
  freshness_json: string;
  slots_json: string;
  scene_anchors_json: string;
  display_policy_json: string;
  write_receipt_json: string;
  repair_state: 'clean' | 'needs_repair';
  blocked_reason: string | null;
  composition_version: string;
  created_at: number;
  updated_at: number;
}

interface KeystoneBriefSourceRow {
  brief_id: string;
  source_type: string;
  source_id: string;
  source_role: KeystoneBriefSourceRef['role'];
  title: string | null;
  url: string | null;
  source_timestamp: number | null;
  authority: KeystoneBriefSourceRef['authority'];
  projection: KeystoneBriefSourceRef['projection'];
  hidden: number;
  snippet: string | null;
  metadata_json: string;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeSlots(input?: Partial<KeystoneBriefSlots>): KeystoneBriefSlots {
  return {
    ...EMPTY_SLOTS,
    ...input,
    stableFacts: Array.isArray(input?.stableFacts) ? input.stableFacts : [],
    decisions: Array.isArray(input?.decisions) ? input.decisions : [],
    constraints: Array.isArray(input?.constraints) ? input.constraints : [],
    traps: Array.isArray(input?.traps) ? input.traps : [],
    peopleAndSources: Array.isArray(input?.peopleAndSources)
      ? input.peopleAndSources
      : [],
    nextUseCases: uniqueStrings(input?.nextUseCases),
    openQuestions: uniqueStrings(input?.openQuestions),
  };
}

function normalizeAnchors(
  input?: Partial<KeystoneBriefSceneAnchors>,
): KeystoneBriefSceneAnchors {
  return {
    projects: uniqueStrings(input?.projects),
    jiraKeys: uniqueStrings(input?.jiraKeys).map((value) => value.toUpperCase()),
    people: uniqueStrings(input?.people),
    topics: uniqueStrings(input?.topics),
    surfaces: uniqueStrings(input?.surfaces),
  };
}

function sanitizeExternalSummary(summary: string): string {
  return summary
    .replace(/https?:\/\/[^\s),，。；;]+/gi, '[链接已隐藏]')
    .replace(
      /\b(token|secret|password|api[_ -]?key)\s*[:=]\s*[^\s,，。；;]+/gi,
      '$1=[已隐藏]',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱已隐藏]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[电话已隐藏]')
    .trim();
}

function normalizeSource(source: KeystoneBriefSourceRef): KeystoneBriefSourceRef {
  const sourceType = source.sourceType.trim();
  const sourceId = source.sourceId.trim();
  return {
    ...source,
    ref: `${sourceType}:${sourceId}`,
    sourceType,
    sourceId,
    role: source.role || 'supporting',
    authority: source.authority || 'derived',
    projection: source.projection || 'local_only',
    hidden: Boolean(source.hidden),
  };
}

function claimsFromSlots(slots: KeystoneBriefSlots): KeystoneBriefClaim[] {
  return [
    ...slots.stableFacts,
    ...slots.decisions,
    ...slots.constraints,
    ...slots.traps,
  ];
}

function evaluateStatus(
  requestedStatus: KeystoneBriefStatus | undefined,
  title: string,
  summary: string,
  freshness: KeystoneBriefFreshness,
  slots: KeystoneBriefSlots,
  sources: KeystoneBriefSourceRef[],
): { status: KeystoneBriefStatus; blockedReason?: string } {
  if (requestedStatus === 'hidden') return { status: 'hidden' };
  if (!title.trim() || !summary.trim()) {
    return { status: 'blocked', blockedReason: 'missing_title_or_summary' };
  }
  if (
    requestedStatus === 'blocked' ||
    freshness.state === 'blocked_source'
  ) {
    return { status: 'blocked', blockedReason: 'source_blocked' };
  }

  const currentTime = now();
  if (
    requestedStatus === 'stale' ||
    freshness.state === 'stale_risk' ||
    (freshness.expiresAt !== undefined && freshness.expiresAt <= currentTime)
  ) {
    return { status: 'stale', blockedReason: 'freshness_expired' };
  }

  const sourceRefs = new Set(sources.map((source) => source.ref));
  const claims = claimsFromSlots(slots);
  const unresolvedClaim = claims.some(
    (claim) =>
      !Array.isArray(claim.sourceRefs) ||
      claim.sourceRefs.length === 0 ||
      claim.sourceRefs.some((ref) => !sourceRefs.has(ref)),
  );
  const independentSourceCount = new Set(
    sources.map((source) => `${source.sourceType}:${source.sourceId}`),
  ).size;
  const hasGroundedAuthority = sources.some(
    (source) =>
      source.authority !== 'derived' && source.authority !== 'reflection',
  );

  if (
    independentSourceCount < 2 ||
    !hasGroundedAuthority ||
    claims.length === 0 ||
    unresolvedClaim
  ) {
    return {
      status: 'candidate',
      blockedReason: unresolvedClaim
        ? 'unresolved_source_refs'
        : 'insufficient_source_coverage',
    };
  }

  if (requestedStatus === 'partial') return { status: 'partial' };
  return { status: 'ready' };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function includesAnchor(haystack: string, anchor: string): boolean {
  const normalized = normalizeText(anchor);
  return normalized.length >= 3 && haystack.includes(normalized);
}

function collectSceneText(request: ContextRecallRequest): string {
  const values: unknown[] = [
    request.title,
    request.url,
    request.primaryText,
    ...(request.secondaryTexts ?? []),
    ...(request.entityHints ?? []).map((hint) => hint.value),
    request.sourceContext?.title,
    request.sourceContext?.url,
    request.sourceContext?.topic,
    request.sourceContext?.issueKey,
    ...(request.sourceContext?.participants ?? []),
    request.currentContext?.title,
    request.currentContext?.url,
    request.currentContext?.issueKey,
    ...(request.currentContext?.participants ?? []),
    ...(request.currentContext?.sourceAnchorHints ?? []),
    request.interactionScene?.title,
    request.interactionScene?.url,
    request.interactionScene?.issueKey,
    ...(request.interactionScene?.participants ?? []),
    ...(request.interactionScene?.sourceAnchorHints ?? []),
    ...(request.interactionScene?.visibleFacts ?? []).flatMap((fact) => [
      fact.name,
      fact.value,
    ]),
  ];
  return values.map(normalizeText).filter(Boolean).join('\n');
}

function sourceMatchesRecall(
  source: KeystoneBriefSourceRef,
  match: ContextRecallMatch,
): boolean {
  if (source.sourceId === match.id || match.mergedIds?.includes(source.sourceId)) {
    return true;
  }
  if (!source.url) return false;
  return [match.sourceUrl, ...match.links.map((link) => link.url)].some(
    (url) => url === source.url,
  );
}

export class KeystoneBriefService {
  constructor(private readonly db: Database.Database) {}

  upsertComposedCandidate(input: UpsertKeystoneBriefInput): KeystoneBrief {
    const createdAt = now();
    const existing = this.db
      .prepare('SELECT id, created_at FROM keystone_briefs WHERE brief_key = ?')
      .get(input.briefKey.trim()) as
      | { id: string; created_at: number }
      | undefined;
    const id = existing?.id ?? input.id?.trim() ?? `kb_${randomUUID()}`;
    const slots = normalizeSlots(input.slots);
    const sceneAnchors = normalizeAnchors(input.sceneAnchors);
    const sources = (input.sourceMap ?? [])
      .map(normalizeSource)
      .filter((source) => source.sourceType && source.sourceId);
    const sourceAsOf =
      input.sourceAsOf ??
      (sources.length > 0
        ? Math.max(0, ...sources.map((source) => source.timestamp ?? 0))
        : createdAt);
    const freshness: KeystoneBriefFreshness = {
      state: input.freshness?.state ?? 'fresh',
      reason: input.freshness?.reason ?? '来源覆盖检查通过',
      ...(input.freshness?.expiresAt
        ? { expiresAt: input.freshness.expiresAt }
        : {}),
      ...(input.freshness?.watchContractId
        ? { watchContractId: input.freshness.watchContractId }
        : {}),
    };
    const readiness = evaluateStatus(
      input.status,
      input.title,
      input.summary,
      freshness,
      slots,
      sources,
    );
    const externalSummary = sanitizeExternalSummary(
      input.externalSummary || input.summary,
    );
    const hiddenSourceCount = sources.filter(
      (source) => source.hidden || source.projection !== 'summary_ok',
    ).length;
    const displayPolicy: KeystoneBriefDisplayPolicy = {
      defaultMode: input.displayPolicy?.defaultMode ?? 'chip',
      maxLines: Math.max(2, Math.min(input.displayPolicy?.maxLines ?? 6, 12)),
      canCopyToDraft:
        Boolean(input.displayPolicy?.canCopyToDraft ?? true) &&
        readiness.status === 'ready',
      externalSummaryOnly: true,
      hiddenSourceCount,
    };
    const repairState =
      readiness.status === 'blocked'
        ? ('needs_repair' as const)
        : ('clean' as const);
    const blockedReason = readiness.blockedReason ?? null;
    const compositionVersion = input.compositionVersion?.trim() || 'v1';

    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO keystone_briefs (
             id, brief_key, title, subject_type, scope, status, summary,
             external_summary, source_as_of, freshness_json, slots_json,
             scene_anchors_json, display_policy_json, write_receipt_json,
             repair_state, blocked_reason, composition_version, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(brief_key) DO UPDATE SET
             title = excluded.title,
             subject_type = excluded.subject_type,
             scope = excluded.scope,
             status = excluded.status,
             summary = excluded.summary,
             external_summary = excluded.external_summary,
             source_as_of = excluded.source_as_of,
             freshness_json = excluded.freshness_json,
             slots_json = excluded.slots_json,
             scene_anchors_json = excluded.scene_anchors_json,
             display_policy_json = excluded.display_policy_json,
             write_receipt_json = excluded.write_receipt_json,
             repair_state = excluded.repair_state,
             blocked_reason = excluded.blocked_reason,
             composition_version = excluded.composition_version,
             updated_at = excluded.updated_at`,
        )
        .run(
          id,
          input.briefKey.trim(),
          input.title.trim(),
          input.subjectType,
          input.scope ?? 'work',
          readiness.status,
          input.summary.trim(),
          externalSummary,
          sourceAsOf || createdAt,
          JSON.stringify(freshness),
          JSON.stringify(slots),
          JSON.stringify(sceneAnchors),
          JSON.stringify(displayPolicy),
          JSON.stringify(WRITE_RECEIPT),
          repairState,
          blockedReason,
          compositionVersion,
          existing?.created_at ?? createdAt,
          createdAt,
        );

      this.db
        .prepare('DELETE FROM keystone_brief_sources WHERE brief_id = ?')
        .run(id);
      const insertSource = this.db.prepare(
        `INSERT INTO keystone_brief_sources (
           brief_id, source_type, source_id, source_role, title, url,
           source_timestamp, authority, projection, hidden, snippet, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const source of sources) {
        insertSource.run(
          id,
          source.sourceType,
          source.sourceId,
          source.role,
          source.title ?? null,
          source.url ?? null,
          source.timestamp ?? null,
          source.authority,
          source.projection,
          source.hidden ? 1 : 0,
          source.snippet ?? null,
          JSON.stringify(source.metadata ?? {}),
        );
      }

      this.db
        .prepare(
          `INSERT INTO keystone_brief_candidate_runs (
             id, brief_id, brief_key, input_summary, input_schema_version,
             result_status, blocked_reason, evaluation_tags_json, created_at
           ) VALUES (?, ?, ?, ?, 'v1', ?, ?, ?, ?)`,
        )
        .run(
          `kbr_${randomUUID()}`,
          id,
          input.briefKey.trim(),
          input.inputSummary ?? null,
          readiness.status,
          blockedReason,
          JSON.stringify(uniqueStrings(input.evaluationTags)),
          createdAt,
        );
    });
    write();

    const brief = this.getById(id);
    if (!brief) throw new Error('keystone_brief_write_failed');
    return brief;
  }

  getById(id: string): KeystoneBrief | null {
    const row = this.db
      .prepare('SELECT * FROM keystone_briefs WHERE id = ?')
      .get(id) as KeystoneBriefRow | undefined;
    if (!row) return null;
    return this.hydrate(row);
  }

  getByBriefKey(briefKey: string): KeystoneBrief | null {
    const row = this.db
      .prepare('SELECT * FROM keystone_briefs WHERE brief_key = ?')
      .get(briefKey.trim()) as KeystoneBriefRow | undefined;
    if (!row) return null;
    return this.hydrate(row);
  }

  list(options?: {
    includeHidden?: boolean;
    limit?: number;
  }): KeystoneBrief[] {
    const limit = Math.max(1, Math.min(options?.limit ?? 50, 100));
    const rows = this.db
      .prepare(
        `SELECT * FROM keystone_briefs
         ${options?.includeHidden ? '' : "WHERE status != 'hidden'"}
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(limit) as KeystoneBriefRow[];
    return rows.map((row) => this.hydrate(row));
  }

  matchContext(
    request: ContextRecallRequest,
    matches: ContextRecallMatch[],
    options?: { requireRecallEvidence?: boolean },
  ): KeystoneBriefPresentation | undefined {
    if (
      (options?.requireRecallEvidence !== false && matches.length === 0) ||
      request.contextType === 'selected_text' ||
      request.interactionScene?.sceneType === 'selection_memory_search' ||
      matches[0]?.type === 'rehearsal'
    ) {
      return undefined;
    }

    const sceneText = collectSceneText(request);
    const sceneType = request.interactionScene?.sceneType;
    let best:
      | {
          brief: KeystoneBrief;
          score: number;
          reason: string;
          evidenceMatchIds: string[];
        }
      | undefined;

    for (const brief of this.list({ limit: 100 })) {
      if (!['ready', 'partial', 'stale'].includes(brief.status)) continue;
      const english = brief.compositionVersion.endsWith('-en-US');
      const evidenceMatchIds = matches
        .filter((match) =>
          brief.sourceMap.some((source) => sourceMatchesRecall(source, match)),
        )
        .map((match) => match.id);
      let score = evidenceMatchIds.length > 0 ? 10 + evidenceMatchIds.length * 2 : 0;
      let reason =
        evidenceMatchIds.length > 0
          ? english
            ? `Covers ${evidenceMatchIds.length} original memories recalled this time`
            : `覆盖本次召回的 ${evidenceMatchIds.length} 条原始记忆`
          : '';

      if (brief.sceneAnchors.jiraKeys.some((key) => includesAnchor(sceneText, key))) {
        score += 9;
        reason ||= english ? 'Matches the current Jira issue' : '命中当前 Jira 事项';
      }
      if (
        brief.sceneAnchors.projects.some((project) =>
          includesAnchor(sceneText, project),
        )
      ) {
        score += 7;
        reason ||= english ? 'Matches the current project' : '命中当前项目';
      }
      if (
        brief.sceneAnchors.topics.some((topic) => includesAnchor(sceneText, topic))
      ) {
        score += 5;
        reason ||= english ? 'Matches the current topic' : '命中当前话题';
      }
      if (
        brief.sceneAnchors.people.some((person) => includesAnchor(sceneText, person))
      ) {
        score += 4;
        reason ||= english ? 'Matches a current participant' : '命中当前参与人';
      }
      if (sceneType && brief.sceneAnchors.surfaces.includes(sceneType)) score += 2;

      if (score >= 5 && (!best || score > best.score)) {
        best = { brief, score, reason, evidenceMatchIds };
      }
    }

    if (!best) return undefined;
    let brief = best.brief;
    const expired =
      brief.freshness.expiresAt !== undefined &&
      brief.freshness.expiresAt <= now();
    if (expired && brief.status !== 'stale') {
      const english = brief.compositionVersion.endsWith('-en-US');
      brief = {
        ...brief,
        status: 'stale',
        freshness: {
          ...brief.freshness,
          state: 'stale_risk',
          reason: english
            ? 'The source freshness window has expired; refresh before using this as a current fact.'
            : '来源有效期已过，需要刷新后再作为当前事实使用',
        },
      };
    }
    const presentationMode =
      brief.status === 'ready'
        ? 'primary'
        : brief.status === 'partial'
          ? 'conflict'
          : 'stale_notice';
    return {
      brief,
      presentationMode,
      whyNow: best.reason,
      evidenceMatchIds:
        best.evidenceMatchIds.length > 0
          ? best.evidenceMatchIds
          : matches.map((match) => match.id),
      relatedMemoryCount: matches.length,
    };
  }

  recordEvent(id: string, input: KeystoneBriefEventInput): KeystoneBrief | null {
    const brief = this.getById(id);
    if (!brief) return null;
    const createdAt = now();
    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO keystone_brief_events (
             id, brief_id, event_type, surface, context_json, reason, detail, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          `kbe_${randomUUID()}`,
          id,
          input.eventType,
          input.surface ?? null,
          JSON.stringify(input.context ?? {}),
          input.reason ?? null,
          input.detail ?? null,
          createdAt,
        );

      if (input.eventType === 'hidden') {
        this.db
          .prepare(
            `UPDATE keystone_briefs
             SET status = 'hidden', updated_at = ?
             WHERE id = ?`,
          )
          .run(createdAt, id);
      } else if (input.eventType === 'not_accurate') {
        this.db
          .prepare(
            `UPDATE keystone_briefs
             SET status = 'blocked', repair_state = 'needs_repair',
                 blocked_reason = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(input.reason || 'user_reported_inaccurate', createdAt, id);
      }
    });
    write();
    return this.getById(id);
  }

  getRepairPreview(id: string):
    | {
        brief: KeystoneBrief;
        unresolvedSourceRefs: string[];
        blockedSources: KeystoneBriefSourceRef[];
        readOnly: true;
      }
    | null {
    const brief = this.getById(id);
    if (!brief) return null;
    const sourceRefs = new Set(brief.sourceMap.map((source) => source.ref));
    const unresolvedSourceRefs = Array.from(
      new Set(
        claimsFromSlots(brief.slots)
          .flatMap((claim) => claim.sourceRefs ?? [])
          .filter((ref) => !sourceRefs.has(ref)),
      ),
    );
    return {
      brief,
      unresolvedSourceRefs,
      blockedSources: brief.sourceMap.filter(
        (source) => source.hidden || source.projection === 'blocked_external',
      ),
      readOnly: true,
    };
  }

  private hydrate(row: KeystoneBriefRow): KeystoneBrief {
    const sourceRows = this.db
      .prepare(
        `SELECT * FROM keystone_brief_sources
         WHERE brief_id = ?
         ORDER BY source_timestamp DESC, source_type, source_id`,
      )
      .all(row.id) as KeystoneBriefSourceRow[];
    const sourceMap: KeystoneBriefSourceRef[] = sourceRows.map((source) => ({
      ref: `${source.source_type}:${source.source_id}`,
      sourceType: source.source_type,
      sourceId: source.source_id,
      role: source.source_role,
      title: source.title ?? undefined,
      url: source.url ?? undefined,
      timestamp: source.source_timestamp ?? undefined,
      authority: source.authority,
      projection: source.projection,
      hidden: source.hidden === 1,
      snippet: source.snippet ?? undefined,
      metadata: parseJson<Record<string, unknown>>(source.metadata_json, {}),
    }));
    return {
      id: row.id,
      briefKey: row.brief_key,
      title: row.title,
      subjectType: row.subject_type,
      scope: row.scope,
      status: row.status,
      summary: row.summary,
      externalSummary: row.external_summary ?? undefined,
      sourceAsOf: row.source_as_of ?? row.updated_at,
      freshness: parseJson<KeystoneBriefFreshness>(row.freshness_json, {
        state: 'stale_risk',
        reason: '缺少 freshness 元数据',
      }),
      slots: normalizeSlots(
        parseJson<Partial<KeystoneBriefSlots>>(row.slots_json, {}),
      ),
      sourceMap,
      sceneAnchors: normalizeAnchors(
        parseJson<Partial<KeystoneBriefSceneAnchors>>(
          row.scene_anchors_json,
          {},
        ),
      ),
      displayPolicy: parseJson<KeystoneBriefDisplayPolicy>(
        row.display_policy_json,
        {
          defaultMode: 'chip',
          maxLines: 6,
          canCopyToDraft: false,
          externalSummaryOnly: true,
          hiddenSourceCount: sourceMap.length,
        },
      ),
      writeReceipt: WRITE_RECEIPT,
      repairState: row.repair_state,
      blockedReason: row.blocked_reason ?? undefined,
      compositionVersion: row.composition_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
