import { v4 as uuidv4 } from 'uuid';
import type BetterSqlite3 from 'better-sqlite3';

import type {
  ContextRecallRequest,
  MemoryChangeAuthorityRole,
  MemoryChangeEvent,
  MemoryChangeEventKind,
  MemoryChangeLedgerReceipt,
  MemoryChangeProjection,
  MemoryChangeProjectionStatus,
  MemoryChangeValue,
  MemoryChangeValueKind,
  MemoryClaimEnvelope,
} from '../types/index.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';
import { MemoryClaimAttributionService } from './MemoryClaimAttributionService.js';
import { MemoryClaimRepository } from '../repositories/MemoryClaimRepository.js';

export interface MemoryChangeSourceInput {
  sourceRefType: string;
  sourceRefId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceKind?: string;
  sourceMessageId?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  entityHints?: Array<{ kind: string; value: string }>;
  observedAt?: number;
  active?: boolean;
}

export interface ExtractedMemoryChanges {
  subjectKey?: string;
  candidates: MemoryChangeCandidate[];
  excludedNoiseCount: number;
  blockedReason?: 'missing_stable_subject';
}

interface MemoryChangeCandidate {
  subjectKey: string;
  subjectLabel: string;
  subjectKind: string;
  propertyKey: string;
  propertyLabel: string;
  previousValue?: MemoryChangeValue;
  nextValue: MemoryChangeValue;
  eventKind: MemoryChangeEventKind;
  authorityRole: MemoryChangeAuthorityRole;
  confidence: number;
  actor?: string;
  reason?: string;
  evidenceQuote?: string;
  observedAt: number;
}

interface ChangeEventRow {
  id: string;
  chain_key: string;
  subject_key: string;
  subject_label: string;
  subject_kind: string;
  property_key: string;
  property_label: string;
  old_value_json: string | null;
  new_value_json: string;
  event_kind: MemoryChangeEventKind;
  authority_role: MemoryChangeAuthorityRole;
  confidence: number;
  source_ref_type: string;
  source_ref_id: string;
  source_title: string | null;
  source_url: string | null;
  actor: string | null;
  reason: string | null;
  evidence_quote: string | null;
  observed_at: number;
  captured_at: number;
  active: number;
  is_reversal: number;
}

interface ChangeChainRow {
  chain_key: string;
  subject_key: string;
  subject_label: string;
  subject_kind: string;
  property_key: string;
  property_label: string;
  current_value_json: string | null;
  previous_value_json: string | null;
  projection_status: MemoryChangeProjectionStatus;
  current_event_id: string | null;
  event_count: number;
  reversal_count: number;
  conflict_count: number;
  first_observed_at: number | null;
  last_observed_at: number | null;
}

interface ExtractionRow {
  status: MemoryChangeLedgerReceipt['status'];
  input_hash: string;
  extracted_count: number;
  excluded_noise_count: number;
  active: number;
  receipt_json: string;
  extracted_at: number;
}

const PROPERTY_ALIASES: Array<{
  key: string;
  label: string;
  pattern: RegExp;
  valueKind?: MemoryChangeValueKind;
}> = [
  { key: 'estimate.dev', label: '开发估算', pattern: /^(?:dev(?:elopment)?\s+estimate|开发估算|开发工作量)$/i, valueKind: 'number' },
  { key: 'estimate.qa', label: 'QA 估算', pattern: /^(?:qa\s+estimate|测试估算|qa工作量)$/i, valueKind: 'number' },
  { key: 'estimate.story_points', label: '故事点', pattern: /^(?:story\s*points?|故事点)$/i, valueKind: 'number' },
  { key: 'release.date', label: '发布时间', pattern: /^(?:release\s+date|publish(?:ing)?\s+date|ship\s+date|target\s+end|发布时间|发布日期|上线时间|发版时间)$/i, valueKind: 'date' },
  { key: 'goal.target', label: 'Goal 目标', pattern: /^(?:goal(?:\s+target)?|objective|目标)$/i },
  { key: 'goal.scope', label: 'Goal 范围', pattern: /^(?:goal\s+scope|scope|目标范围|范围)$/i, valueKind: 'set' },
  { key: 'goal.success_metric', label: '成功标准', pattern: /^(?:success\s+(?:metric|criteria)|key\s+result|成功标准|成功指标)$/i },
  { key: 'deadline', label: '截止时间', pattern: /^(?:deadline|due\s+date|截止时间|截止日期)$/i, valueKind: 'date' },
  { key: 'status', label: '状态', pattern: /^(?:status|state|状态)$/i, valueKind: 'status' },
  { key: 'owner', label: '负责人', pattern: /^(?:owner|assignee|负责人|经办人)$/i, valueKind: 'entity_ref' },
  { key: 'priority', label: '优先级', pattern: /^(?:priority|优先级)$/i, valueKind: 'status' },
];

const NOISE_LINE_PATTERN =
  /^(?:collapse\s+comment|expand\s+comment|added\s+a\s+comment|press\s+enter|show\s+more|load\s+more|折叠评论|展开评论|按回车|显示更多|加载更多)[.!。\s]*$/i;
const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
export class MemoryChangeLedgerService {
  constructor(private readonly db: BetterSqlite3.Database) {}

  syncSource(input: MemoryChangeSourceInput): MemoryChangeLedgerReceipt {
    const extractedAt = now();
    const active = input.active !== false;
    let extraction = extractMemoryChanges(input);
    const sourceMessageId = this.resolveSourceMessageId(input);
    const authoritativeStructuredSource =
      input.metadata?.authoritative === true &&
      input.metadata?.connectorReceipt === true &&
      readExplicitChanges(input.metadata ?? {}).length > 0;
    const claimByCandidate = new Map<
      MemoryChangeCandidate,
      MemoryClaimEnvelope
    >();
    if (sourceMessageId && !authoritativeStructuredSource) {
      const claimService = new MemoryClaimAttributionService(this.db);
      const decision = claimService.ensureForMessage(sourceMessageId);
      const claims =
        decision.status === 'resolved'
          ? claimService.getClaimsForMessage(sourceMessageId, { ensure: false })
          : [];
      const gatedCandidates = extraction.candidates.filter((candidate) => {
        const claim = findEligibleChangeClaim(candidate, claims);
        if (!claim) return false;
        claimByCandidate.set(candidate, claim);
        candidate.authorityRole =
          claim.owner.kind === 'self' ? 'owner_authored' : 'inferred';
        return true;
      });
      extraction = {
        ...extraction,
        candidates: gatedCandidates,
        excludedNoiseCount:
          extraction.excludedNoiseCount +
          (extraction.candidates.length - gatedCandidates.length),
      };
    }
    const inputHash = contentHash(
      JSON.stringify({
        text: input.text ?? '',
        metadata: input.metadata ?? {},
        entityHints: input.entityHints ?? [],
        sourceTitle: input.sourceTitle ?? '',
        observedAt: input.observedAt ?? null,
      }),
    );
    const priorChainKeys = this.getSourceChainKeys(input.sourceRefType, input.sourceRefId);
    const nextChainKeys = new Set<string>();
    const receiptBase = buildExtractionReceipt({
      extraction,
      inputHash,
      generatedAt: extractedAt,
      active,
    });

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE memory_claim_links
           SET status = 'invalidated',
               invalidated_at = COALESCE(invalidated_at, ?),
               invalidation_reason = COALESCE(
                 invalidation_reason,
                 'memory_change_source_resynced'
               ),
               updated_at = ?
           WHERE target_type = 'memory_change_event'
             AND status = 'active'
             AND target_id IN (
               SELECT id
               FROM memory_change_events
               WHERE source_ref_type = ? AND source_ref_id = ?
             )`,
        )
        .run(
          extractedAt,
          extractedAt,
          input.sourceRefType,
          input.sourceRefId,
        );
      this.db
        .prepare(
          `DELETE FROM memory_change_events
           WHERE source_ref_type = ? AND source_ref_id = ?`,
        )
        .run(input.sourceRefType, input.sourceRefId);

      const insertEvent = this.db.prepare(
        `INSERT INTO memory_change_events (
           id, chain_key, subject_key, subject_label, subject_kind,
           property_key, property_label, old_value_json, new_value_json,
           event_kind, authority_role, confidence, source_ref_type,
           source_ref_id, source_title, source_url, actor, reason,
           evidence_quote, observed_at, captured_at, active, is_reversal,
           input_hash, event_fingerprint, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      );

      for (const candidate of extraction.candidates) {
        const chainKey = buildChainKey(candidate.subjectKey, candidate.propertyKey);
        nextChainKeys.add(chainKey);
        const fingerprint = contentHash(
          JSON.stringify({
            chainKey,
            previousValue: candidate.previousValue ?? null,
            nextValue: candidate.nextValue,
            observedAt: candidate.observedAt,
            evidenceQuote: candidate.evidenceQuote ?? '',
          }),
        );
        const id = uuidv4();
        insertEvent.run(
          id,
          chainKey,
          candidate.subjectKey,
          candidate.subjectLabel,
          candidate.subjectKind,
          candidate.propertyKey,
          candidate.propertyLabel,
          candidate.previousValue ? JSON.stringify(candidate.previousValue) : null,
          JSON.stringify(candidate.nextValue),
          candidate.eventKind,
          candidate.authorityRole,
          candidate.confidence,
          input.sourceRefType,
          input.sourceRefId,
          normalizeText(input.sourceTitle) || null,
          normalizeText(input.sourceUrl) || null,
          candidate.actor || null,
          candidate.reason || null,
          candidate.evidenceQuote || null,
          candidate.observedAt,
          extractedAt,
          active ? 1 : 0,
          inputHash,
          fingerprint,
          extractedAt,
          extractedAt,
        );
        const sourceClaim = claimByCandidate.get(candidate);
        if (sourceClaim) {
          new MemoryClaimRepository(this.db).linkDerived(
            sourceClaim.id,
            'memory_change_event',
            id,
            'current_truth',
          );
        }
      }

      this.db
        .prepare(
          `INSERT INTO memory_change_extractions (
             source_ref_type, source_ref_id, status, input_hash, subject_key,
             extracted_count, excluded_noise_count, active, receipt_json,
             extracted_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(source_ref_type, source_ref_id) DO UPDATE SET
             status = excluded.status,
             input_hash = excluded.input_hash,
             subject_key = excluded.subject_key,
             extracted_count = excluded.extracted_count,
             excluded_noise_count = excluded.excluded_noise_count,
             active = excluded.active,
             receipt_json = excluded.receipt_json,
             extracted_at = excluded.extracted_at,
             updated_at = excluded.updated_at`,
        )
        .run(
          input.sourceRefType,
          input.sourceRefId,
          receiptBase.status,
          inputHash,
          extraction.subjectKey ?? null,
          extraction.candidates.length,
          extraction.excludedNoiseCount,
          active ? 1 : 0,
          JSON.stringify(stripReceiptCollections(receiptBase)),
          extractedAt,
          extractedAt,
        );

      for (const chainKey of new Set([...priorChainKeys, ...nextChainKeys])) {
        this.rebuildChain(chainKey, extractedAt);
      }
    });

    transaction();
    return this.getSourceLedger(input.sourceRefType, input.sourceRefId);
  }

  private resolveSourceMessageId(
    input: MemoryChangeSourceInput,
  ): string | undefined {
    if (input.sourceMessageId?.trim()) return input.sourceMessageId.trim();
    if (input.sourceRefType !== 'message') return undefined;
    const row = this.db
      .prepare('SELECT id FROM messages_raw WHERE id = ?')
      .get(input.sourceRefId) as { id: string } | undefined;
    return row?.id;
  }

  setSourceActive(sourceRefType: string, sourceRefId: string, active: boolean): void {
    const ts = now();
    const chainKeys = this.getSourceChainKeys(sourceRefType, sourceRefId);
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE memory_change_events
           SET active = ?, updated_at = ?
           WHERE source_ref_type = ? AND source_ref_id = ?`,
        )
        .run(active ? 1 : 0, ts, sourceRefType, sourceRefId);
      this.db
        .prepare(
          `UPDATE memory_change_extractions
           SET active = ?, updated_at = ?
           WHERE source_ref_type = ? AND source_ref_id = ?`,
        )
        .run(active ? 1 : 0, ts, sourceRefType, sourceRefId);
      for (const chainKey of chainKeys) this.rebuildChain(chainKey, ts);
    });
    transaction();
  }

  getSourceLedger(sourceRefType: string, sourceRefId: string): MemoryChangeLedgerReceipt {
    const extraction = this.db
      .prepare(
        `SELECT status, input_hash, extracted_count, excluded_noise_count,
                active, receipt_json, extracted_at
         FROM memory_change_extractions
         WHERE source_ref_type = ? AND source_ref_id = ?`,
      )
      .get(sourceRefType, sourceRefId) as ExtractionRow | undefined;
    if (!extraction) return buildNotRunReceipt();

    const events = this.getSourceEvents(sourceRefType, sourceRefId);
    const projections = Array.from(new Set(events.map((event) => event.chainKey)))
      .map((chainKey) => {
        const activeProjection = this.getProjection(chainKey, true);
        if (activeProjection) return activeProjection;
        const chainEvents = events.filter((event) => event.chainKey === chainKey);
        return buildHistoricalProjection(chainEvents);
      })
      .filter((projection): projection is MemoryChangeProjection => Boolean(projection));
    const stored = parseRecord(extraction.receipt_json);
    return {
      status: extraction.status,
      label: readString(stored, 'label') || '变化提取已完成',
      detail: readString(stored, 'detail') || '已检查可形成变化脉络的稳定状态变化。',
      evidence: readStringArray(stored.evidence),
      inputHash: extraction.input_hash,
      extractedCount: extraction.extracted_count,
      excludedNoiseCount: extraction.excluded_noise_count,
      generatedAt: extraction.extracted_at,
      active: extraction.active === 1,
      events,
      projections: projections.map((projection) =>
        extraction.active === 1
          ? projection
          : {
              ...projection,
              status: 'historical_only' as const,
              boundary: '该来源已撤销；事件仅保留为历史证据，不参与当前状态投影。',
            },
      ),
    };
  }

  getContextProjections(request: ContextRecallRequest, limit = 3): MemoryChangeProjection[] {
    const subjectKeys = collectRequestSubjectKeys(request);
    if (!subjectKeys.length) return [];
    const placeholders = subjectKeys.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT chain_key, subject_key, subject_label, subject_kind,
                property_key, property_label, current_value_json,
                previous_value_json, projection_status, current_event_id,
                event_count, reversal_count, conflict_count,
                first_observed_at, last_observed_at
         FROM memory_change_chains
         WHERE subject_key IN (${placeholders})
         ORDER BY last_observed_at DESC
         LIMIT ?`,
      )
      .all(...subjectKeys, Math.max(1, Math.min(limit, 5))) as ChangeChainRow[];
    const visibleFields = collectVisibleFields(request);
    const verifiedSourceFields = collectVerifiedSourceFields(request);
    return rows.map((row) => this.mapProjection(row, true, visibleFields, verifiedSourceFields));
  }

  findForAsk(query: string, limit = 4): MemoryChangeProjection[] {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];
    const issueKeys = Array.from(
      new Set((normalizedQuery.match(new RegExp(ISSUE_KEY_PATTERN.source, 'g')) ?? []).map((key) => `jira:${key.toUpperCase()}`)),
    );
    if (issueKeys.length) {
      const placeholders = issueKeys.map(() => '?').join(', ');
      const rows = this.db
        .prepare(
          `SELECT * FROM memory_change_chains
           WHERE subject_key IN (${placeholders})
           ORDER BY last_observed_at DESC LIMIT ?`,
        )
        .all(...issueKeys, limit) as ChangeChainRow[];
      return rows.map((row) => this.mapProjection(row, true));
    }

    const recentRows = this.db
      .prepare(
        `SELECT * FROM memory_change_chains
         ORDER BY last_observed_at DESC LIMIT 50`,
      )
      .all() as ChangeChainRow[];
    const lowerQuery = normalizedQuery.toLocaleLowerCase();
    return recentRows
      .filter((row) => {
        const label = row.subject_label.trim().toLocaleLowerCase();
        return label.length >= 3 && lowerQuery.includes(label);
      })
      .slice(0, limit)
      .map((row) => this.mapProjection(row, true));
  }

  formatForPrompt(projections: MemoryChangeProjection[]): string {
    if (!projections.length) return '';
    const lines = projections.map((projection) => {
      const history = projection.history
        .slice(-4)
        .map((event) => {
          const before = event.previousValue?.display ?? '未记录';
          return `- ${formatTimestamp(event.observedAt)}: ${before} -> ${event.nextValue.display}; 来源=${event.sourceRef.title || event.sourceRef.type}; 权威=${event.authorityRole}${event.reason ? `; 原因=${event.reason}` : ''}`;
        })
        .join('\n');
      const currentProjection = projection.status === 'conflicted'
        ? '未知（候选冲突）'
        : projection.currentValue?.display ?? '未知';
      return [
        `对象=${projection.subjectLabel}; 字段=${projection.propertyLabel}`,
        `投影状态=${projection.status}; ${projection.boundary}`,
        `当前投影=${currentProjection}`,
        history,
      ].filter(Boolean).join('\n');
    });
    return [
      '【变化脉络】',
      '以下内容是带来源的状态变化证据。必须区分已确认当前、最后观测、冲突和仅历史；不得把“最后观测”写成已确认当前。只有事件中明确提供 reason 时才能解释原因。若用户前提与链冲突，应指出冲突并引用时间与来源。',
      ...lines,
    ].join('\n');
  }

  private getSourceChainKeys(sourceRefType: string, sourceRefId: string): string[] {
    return (
      this.db
        .prepare(
          `SELECT DISTINCT chain_key FROM memory_change_events
           WHERE source_ref_type = ? AND source_ref_id = ?`,
        )
        .all(sourceRefType, sourceRefId) as Array<{ chain_key: string }>
    ).map((row) => row.chain_key);
  }

  private getSourceEvents(sourceRefType: string, sourceRefId: string): MemoryChangeEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_change_events
         WHERE source_ref_type = ? AND source_ref_id = ?
         ORDER BY observed_at ASC, captured_at ASC, id ASC`,
      )
      .all(sourceRefType, sourceRefId) as ChangeEventRow[];
    return rows.map(mapEventRow);
  }

  private getProjection(chainKey: string, includeHistory: boolean): MemoryChangeProjection | null {
    const row = this.db
      .prepare(`SELECT * FROM memory_change_chains WHERE chain_key = ?`)
      .get(chainKey) as ChangeChainRow | undefined;
    return row ? this.mapProjection(row, includeHistory) : null;
  }

  private mapProjection(
    row: ChangeChainRow,
    includeHistory: boolean,
    visibleFields: Map<string, string> = new Map(),
    verifiedSourceFields: Map<string, { name: string; value: string | null; checkedAt: number }> = new Map(),
  ): MemoryChangeProjection {
    const historyRows = includeHistory
      ? (this.db
          .prepare(
            `SELECT * FROM memory_change_events
             WHERE chain_key = ?
             ORDER BY observed_at ASC, captured_at ASC, id ASC
             LIMIT 20`,
          )
          .all(row.chain_key) as ChangeEventRow[])
      : [];
    const history = historyRows.map(mapEventRow);
    const storedCurrentEvent = history.find((event) => event.id === row.current_event_id);
    const storedCurrentValue = parseChangeValue(row.current_value_json);
    const previousValue = parseChangeValue(row.previous_value_json);
    let status = row.projection_status;
    let currentEvent = status === 'conflicted' ? undefined : storedCurrentEvent;
    let currentValue = status === 'conflicted' ? undefined : storedCurrentValue;
    let visiblePageValue: MemoryChangeValue | undefined;
    let boundary = buildProjectionBoundary(status);
    const visibleRaw = visibleFields.get(row.property_key);
    if (visibleRaw) {
      visiblePageValue = normalizeChangeValue(visibleRaw, row.property_key);
      if (status === 'conflicted') {
        currentValue = visiblePageValue;
        currentEvent = undefined;
        status = 'confirmed_current';
        boundary = `变化链存在候选冲突；当前页面可见字段显示“${visiblePageValue.display}”，本次仅以页面值确认当前状态，冲突历史未被改写。`;
      } else if (storedCurrentValue && valuesEqual(visiblePageValue, storedCurrentValue)) {
        status = 'confirmed_current';
        boundary = '当前页面可见字段与变化链最后值一致；本次页面核对确认当前值。';
      } else if (storedCurrentValue) {
        status = 'superseded_on_page';
        boundary = `当前页面显示“${visiblePageValue.display}”，与变化链最后观测“${storedCurrentValue.display}”不同；以页面当前值为准，历史链未被改写。`;
      }
    } else {
      const verifiedSourceField = verifiedSourceFields.get(row.property_key);
      if (verifiedSourceField) {
        const sourceValue = normalizeChangeValue(verifiedSourceField.value, row.property_key);
        const checkedAt = formatObservedAt(verifiedSourceField.checkedAt);
        if (status === 'conflicted') {
          currentValue = sourceValue;
          currentEvent = undefined;
          status = 'confirmed_current';
          boundary = `本次通过 Jira 只读 API 核对“${verifiedSourceField.name}”${checkedAt}，确认当前${sourceValue.normalized === null ? '为空' : `为“${sourceValue.display}”`}；冲突历史未被改写。`;
        } else if (storedCurrentValue && valuesEqual(sourceValue, storedCurrentValue)) {
          status = 'confirmed_current';
          boundary = `本次通过 Jira 只读 API 核对“${verifiedSourceField.name}”${checkedAt}，与最后观测一致，确认当前值。`;
        } else if (storedCurrentValue) {
          currentValue = sourceValue;
          status = 'superseded_at_source';
          boundary = sourceValue.normalized === null
            ? `本次通过 Jira 只读 API 核对“${verifiedSourceField.name}”${checkedAt}，确认当前为空；账本最后观测“${storedCurrentValue.display}”仅保留为历史。`
            : `本次通过 Jira 只读 API 核对“${verifiedSourceField.name}”${checkedAt}，当前为“${sourceValue.display}”，与账本最后观测“${storedCurrentValue.display}”不同；以 Jira 当前值为准，历史链未被改写。`;
        }
      }
    }
    const summary = row.projection_status === 'conflicted'
      ? buildConflictProjectionSummary(
          row.subject_label,
          row.property_label,
          history,
          visiblePageValue,
          row.reversal_count,
        )
      : buildProjectionSummary(row.subject_label, row.property_label, currentValue, previousValue, row.reversal_count);
    return {
      chainKey: row.chain_key,
      subjectKey: row.subject_key,
      subjectLabel: row.subject_label,
      subjectKind: row.subject_kind,
      propertyKey: row.property_key,
      propertyLabel: row.property_label,
      currentValue,
      previousValue,
      visiblePageValue,
      status,
      summary,
      boundary,
      eventCount: row.event_count,
      reversalCount: row.reversal_count,
      conflictCount: row.conflict_count,
      firstObservedAt: row.first_observed_at ?? undefined,
      lastObservedAt: row.last_observed_at ?? undefined,
      currentEvent,
      history,
    };
  }

  private rebuildChain(chainKey: string, ts: number): void {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_change_events
         WHERE chain_key = ? AND active = 1
         ORDER BY observed_at ASC, captured_at ASC, id ASC`,
      )
      .all(chainKey) as ChangeEventRow[];
    if (!rows.length) {
      this.db.prepare(`DELETE FROM memory_change_chains WHERE chain_key = ?`).run(chainKey);
      return;
    }

    let reversalCount = 0;
    const seenValues = new Set<string>();
    if (rows[0].old_value_json) {
      seenValues.add(canonicalValueJson(rows[0].old_value_json));
    }
    for (const row of rows) {
      const valueKey = canonicalValueJson(row.new_value_json);
      const isReversal = seenValues.has(valueKey) && valueKey !== canonicalValueJson(rows[Math.max(0, rows.indexOf(row) - 1)]?.new_value_json ?? '');
      if (isReversal) reversalCount += 1;
      seenValues.add(valueKey);
      this.db
        .prepare(`UPDATE memory_change_events SET is_reversal = ?, event_kind = ? WHERE id = ?`)
        .run(isReversal ? 1 : 0, isReversal ? 'revert' : row.event_kind === 'revert' ? 'update' : row.event_kind, row.id);
      row.is_reversal = isReversal ? 1 : 0;
      row.event_kind = isReversal ? 'revert' : row.event_kind;
    }

    const latest = rows[rows.length - 1];
    const previous = rows.length > 1 ? rows[rows.length - 2] : undefined;
    const conflictCount = countConflicts(rows);
    // A trustworthy capture records who said it, not that it remains current.
    // Only an explicit page field or live-source read can promote it later.
    const status: MemoryChangeProjectionStatus = conflictCount > 0
      ? 'conflicted'
      : 'last_observed';
    const receipt = {
      status,
      boundary: buildProjectionBoundary(status),
      currentEventId: latest.id,
    };
    this.db
      .prepare(
        `INSERT INTO memory_change_chains (
           chain_key, subject_key, subject_label, subject_kind, property_key,
           property_label, current_value_json, previous_value_json,
           projection_status, current_event_id, event_count, reversal_count,
           conflict_count, projection_receipt_json, first_observed_at,
           last_observed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chain_key) DO UPDATE SET
           subject_key = excluded.subject_key,
           subject_label = excluded.subject_label,
           subject_kind = excluded.subject_kind,
           property_key = excluded.property_key,
           property_label = excluded.property_label,
           current_value_json = excluded.current_value_json,
           previous_value_json = excluded.previous_value_json,
           projection_status = excluded.projection_status,
           current_event_id = excluded.current_event_id,
           event_count = excluded.event_count,
           reversal_count = excluded.reversal_count,
           conflict_count = excluded.conflict_count,
           projection_receipt_json = excluded.projection_receipt_json,
           first_observed_at = excluded.first_observed_at,
           last_observed_at = excluded.last_observed_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        chainKey,
        latest.subject_key,
        latest.subject_label,
        latest.subject_kind,
        latest.property_key,
        latest.property_label,
        latest.new_value_json,
        latest.old_value_json ?? previous?.new_value_json ?? null,
        status,
        latest.id,
        rows.length,
        reversalCount,
        conflictCount,
        JSON.stringify(receipt),
        rows[0].observed_at,
        latest.observed_at,
        ts,
        ts,
      );
  }
}

function findEligibleChangeClaim(
  candidate: MemoryChangeCandidate,
  claims: MemoryClaimEnvelope[],
): MemoryClaimEnvelope | null {
  const evidence = normalizeText(candidate.evidenceQuote);
  if (!evidence) return null;
  const exactMatches = claims.filter(
    (claim) => normalizeText(claim.sourceText) === evidence,
  );
  if (
    exactMatches.length === 0 ||
    exactMatches.some((claim) => !claim.policy.currentTruthCandidate)
  ) {
    return null;
  }

  // A source-memory wrapper can repeat the same evidence once in Summary and
  // once in its Evidence section. Accept that duplication only when every
  // exact occurrence has the same attribution; otherwise the candidate is
  // ambiguous and must fail closed. The last occurrence is the actual
  // Evidence section in the canonical wrapper.
  const attributionKeys = new Set(
    exactMatches.map((claim) =>
      [
        claim.owner.kind,
        claim.owner.entityId ?? '',
        claim.owner.displayName ?? '',
        claim.speechMode,
        claim.polarity,
        claim.timeBasis,
        claim.verification,
        claim.commitment,
      ].join('|'),
    ),
  );
  if (attributionKeys.size !== 1) return null;
  return exactMatches.reduce((latest, claim) =>
    claim.sourceSpan.start > latest.sourceSpan.start ? claim : latest,
  );
}

export function extractMemoryChanges(input: MemoryChangeSourceInput): ExtractedMemoryChanges {
  const metadata = input.metadata ?? {};
  const baseSubject = resolveSubject(metadata, input.entityHints ?? [], input.sourceTitle, input.text);
  const explicitChanges = readExplicitChanges(metadata);
  const candidates: MemoryChangeCandidate[] = [];
  let excludedNoiseCount = 0;

  for (const rawChange of explicitChanges) {
    const subject = resolveSubject(rawChange, input.entityHints ?? [], input.sourceTitle, input.text) ?? baseSubject;
    if (!subject) continue;
    const property = normalizeProperty(readString(rawChange, 'propertyKey') || readString(rawChange, 'field') || readString(rawChange, 'propertyLabel'));
    if (!property) continue;
    const previousRaw = rawChange.oldValue ?? rawChange.previousValue;
    const nextRaw = rawChange.newValue ?? rawChange.nextValue;
    if (nextRaw === undefined) continue;
    const previousValue = previousRaw === undefined ? undefined : normalizeChangeValue(previousRaw, property.key, readValueKind(rawChange.valueKind));
    const nextValue = normalizeChangeValue(nextRaw, property.key, readValueKind(rawChange.valueKind) ?? property.valueKind);
    if (previousValue && valuesEqual(previousValue, nextValue)) {
      excludedNoiseCount += 1;
      continue;
    }
    const authorityRole = normalizeAuthorityRole(readString(rawChange, 'authorityRole')) ?? inferAuthorityRole(input, metadata);
    candidates.push({
      ...subject,
      propertyKey: property.key,
      propertyLabel: readString(rawChange, 'propertyLabel') || property.label,
      previousValue,
      nextValue,
      eventKind: inferEventKind(previousValue, nextValue),
      authorityRole,
      confidence: clampNumber(readNumber(rawChange.confidence) ?? 0.96, 0, 1),
      actor: readString(rawChange, 'actor') || readString(metadata, 'actor') || undefined,
      reason: readString(rawChange, 'reason') || undefined,
      evidenceQuote: readString(rawChange, 'evidenceQuote') || undefined,
      observedAt: readTimestamp(rawChange.observedAt) ?? input.observedAt ?? now(),
    });
  }

  const rawText = typeof input.text === 'string' ? input.text : '';
  if (normalizeText(rawText) && baseSubject) {
    for (const rawLine of rawText.split(/\r?\n/)) {
      const line = normalizeText(rawLine);
      if (!line) continue;
      if (NOISE_LINE_PATTERN.test(line)) {
        excludedNoiseCount += 1;
        continue;
      }
      const parsed = parseChangeLine(line, baseSubject.subjectLabel, baseSubject.subjectKey);
      if (!parsed) continue;
      const property = normalizeProperty(parsed.propertyLabel);
      if (!property) continue;
      const previousValue = normalizeChangeValue(parsed.previousValue, property.key, property.valueKind);
      const nextValue = normalizeChangeValue(parsed.nextValue, property.key, property.valueKind);
      if (valuesEqual(previousValue, nextValue)) {
        excludedNoiseCount += 1;
        continue;
      }
      const candidate: MemoryChangeCandidate = {
        ...baseSubject,
        propertyKey: property.key,
        propertyLabel: property.label,
        previousValue,
        nextValue,
        eventKind: inferEventKind(previousValue, nextValue),
        authorityRole: inferAuthorityRole(input, metadata),
        confidence: 0.82,
        actor: readString(metadata, 'actor') || undefined,
        reason: parsed.reason,
        evidenceQuote: line.slice(0, 500),
        observedAt: input.observedAt ?? readTimestamp(metadata.observedAt) ?? now(),
      };
      if (!candidates.some((existing) => candidateKey(existing) === candidateKey(candidate))) {
        candidates.push(candidate);
      }
    }
  }

  return {
    subjectKey: baseSubject?.subjectKey ?? candidates[0]?.subjectKey,
    candidates,
    excludedNoiseCount,
    blockedReason: !baseSubject && candidates.length === 0 ? 'missing_stable_subject' : undefined,
  };
}

function resolveSubject(
  metadata: Record<string, unknown>,
  entityHints: Array<{ kind: string; value: string }>,
  sourceTitle?: string,
  text?: string,
): { subjectKey: string; subjectLabel: string; subjectKind: string } | null {
  const explicitKey = readString(metadata, 'subjectKey');
  const explicitLabel = readString(metadata, 'subjectLabel');
  const explicitKind = readString(metadata, 'subjectKind');
  if (explicitKey) {
    return {
      subjectKey: normalizeSubjectKey(explicitKey, explicitKind),
      subjectLabel: explicitLabel || explicitKey,
      subjectKind: explicitKind || inferSubjectKind(explicitKey),
    };
  }

  const issueKey = readString(metadata, 'issueKey') || findHint(entityHints, ['jira_key', 'issue_key', 'jira_issue']);
  const issueMatch = (issueKey || sourceTitle || text || '').match(ISSUE_KEY_PATTERN)?.[0];
  if (issueMatch) return { subjectKey: `jira:${issueMatch.toUpperCase()}`, subjectLabel: issueMatch.toUpperCase(), subjectKind: 'jira_issue' };

  const goalId = readString(metadata, 'goalId') || findHint(entityHints, ['goal', 'goal_id']);
  if (goalId) return { subjectKey: `goal:${goalId}`, subjectLabel: explicitLabel || readString(metadata, 'goalTitle') || goalId, subjectKind: 'goal' };
  const releaseId = readString(metadata, 'releaseId') || findHint(entityHints, ['release', 'release_id', 'version']);
  if (releaseId) return { subjectKey: `release:${releaseId}`, subjectLabel: explicitLabel || readString(metadata, 'releaseTitle') || releaseId, subjectKind: 'release' };
  const projectId = readString(metadata, 'projectId') || findHint(entityHints, ['project_id']);
  if (projectId) return { subjectKey: `project:${projectId}`, subjectLabel: explicitLabel || readString(metadata, 'projectTitle') || projectId, subjectKind: 'project' };
  return null;
}

function readExplicitChanges(metadata: Record<string, unknown>): Record<string, unknown>[] {
  const raw = metadata.changeEvents ?? metadata.changeEvent;
  if (Array.isArray(raw)) return raw.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
  const item = asRecord(raw);
  return item ? [item] : [];
}

function parseChangeLine(
  line: string,
  subjectLabel: string,
  subjectKey: string,
): { propertyLabel: string; previousValue: string; nextValue: string; reason?: string } | null {
  const patterns = [
    /^(.{1,48}?)\s*(?:original|旧值|原值)\s*[:：]\s*(.+?)\s+(?:new|新值)\s*[:：]\s*(.+?)(?:[。;；]|$)/i,
    /^(.{1,48}?)\s+(?:changed|updated)\s+from\s+(.+?)\s+to\s+(.+?)(?:[.;]|$)/i,
    /^(.{1,48}?)从\s*(.+?)\s*(?:改成|改为|调整为|变更为|变为|延期到|提前到)\s*(.+?)(?:[。;；]|$)/i,
    /^(.{1,48}?)\s*[:：]\s*(.+?)\s*(?:->|→|=>)\s*(.+?)(?:[。;；]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const propertyLabel = stripSubjectPrefix(match[1], subjectLabel, subjectKey);
    if (!propertyLabel) continue;
    return {
      propertyLabel,
      previousValue: cleanupCapturedValue(match[2]),
      nextValue: cleanupCapturedValue(match[3]),
    };
  }
  return null;
}

function normalizeProperty(raw: string): { key: string; label: string; valueKind?: MemoryChangeValueKind } | null {
  const label = normalizeText(raw)
    .replace(/^(?:summary|摘要)\s*[:：]\s*/i, '')
    .replace(/[：:]$/, '');
  if (!label || label.length > 64) return null;
  const alias = PROPERTY_ALIASES.find((item) => item.pattern.test(label));
  if (alias) return { key: alias.key, label: alias.label, valueKind: alias.valueKind };
  const key = label
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\p{Script=Han}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return key ? { key: `field.${key}`, label } : null;
}

function normalizeChangeValue(
  rawValue: unknown,
  propertyKey: string,
  explicitKind?: MemoryChangeValueKind,
): MemoryChangeValue {
  if (rawValue === null || rawValue === undefined) {
    return {
      kind: explicitKind ?? inferValueKind('', propertyKey),
      display: '未设置',
      normalized: null,
    };
  }
  if (Array.isArray(rawValue)) {
    const normalized = rawValue.map((item) => normalizeText(item)).filter(Boolean).sort();
    return { kind: 'set', display: normalized.join('、') || '空集合', normalized, raw: JSON.stringify(rawValue) };
  }
  if (typeof rawValue === 'boolean') return { kind: 'boolean', display: rawValue ? '是' : '否', normalized: rawValue };
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return { kind: explicitKind ?? 'number', display: String(rawValue), normalized: rawValue };
  const raw = normalizeText(rawValue);
  const kind = explicitKind ?? inferValueKind(raw, propertyKey);
  if (kind === 'set') {
    const values = raw.split(/[,，、;；]/).map(normalizeText).filter(Boolean).sort();
    return { kind, display: values.join('、') || raw, normalized: values, raw };
  }
  if (kind === 'number') {
    const numeric = Number(raw.replace(/[^0-9.+-]/g, ''));
    if (Number.isFinite(numeric) && raw) return { kind, display: raw, normalized: numeric, raw };
  }
  if (kind === 'date') return { kind, display: raw, normalized: normalizeDate(raw), raw };
  if (kind === 'boolean') {
    const value = /^(?:true|yes|是|启用|开启|1)$/i.test(raw);
    return { kind, display: raw, normalized: value, raw };
  }
  const cleared = /^(?:none|null|empty|unset|未设置|无|空|-|—)$/i.test(raw);
  return { kind, display: raw || '未设置', normalized: cleared ? null : raw.toLocaleLowerCase(), raw };
}

function inferValueKind(raw: string, propertyKey: string): MemoryChangeValueKind {
  const alias = PROPERTY_ALIASES.find((item) => item.key === propertyKey);
  if (alias?.valueKind) return alias.valueKind;
  if (/^(?:true|false|yes|no|是|否|启用|关闭)$/i.test(raw)) return 'boolean';
  if (/^[-+]?\d+(?:\.\d+)?(?:\s*(?:h|d|pt|pts|hours?|days?))?$/i.test(raw)) return 'number';
  if (/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(raw)) return 'date';
  return 'text';
}

function normalizeDate(raw: string): string {
  const match = raw.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return raw.toLocaleLowerCase();
}

function inferAuthorityRole(input: MemoryChangeSourceInput, metadata: Record<string, unknown>): MemoryChangeAuthorityRole {
  const explicit = normalizeAuthorityRole(readString(metadata, 'authorityRole'));
  if (explicit) return explicit;
  if (metadata.authoritative === true || metadata.isAuthoritative === true) return 'authoritative_source';
  const interactions = asRecord(metadata.interactions);
  if (metadata.ownerAuthored === true || interactions?.ownerAuthored === true) return 'owner_authored';
  if (/ai|assistant/i.test(input.sourceKind ?? '')) return 'ai_generated';
  if (/message|comment|reply/i.test(input.sourceKind ?? '')) return 'team_message';
  return 'source_snapshot';
}

function normalizeAuthorityRole(raw: string): MemoryChangeAuthorityRole | null {
  const roles: MemoryChangeAuthorityRole[] = ['authoritative_source', 'owner_authored', 'team_message', 'ai_generated', 'source_snapshot', 'inferred'];
  return roles.includes(raw as MemoryChangeAuthorityRole) ? (raw as MemoryChangeAuthorityRole) : null;
}

function inferEventKind(previousValue: MemoryChangeValue | undefined, nextValue: MemoryChangeValue): MemoryChangeEventKind {
  if (nextValue.normalized === null) return 'clear';
  return previousValue ? 'update' : 'set';
}

function collectRequestSubjectKeys(request: ContextRecallRequest): string[] {
  const values = [
    request.sourceContext?.issueKey,
    request.currentContext?.issueKey,
    request.interactionScene?.issueKey,
    request.title,
    request.url,
    request.primaryText,
    ...(request.secondaryTexts ?? []),
    ...((request.entityHints ?? [])
      .filter((hint) => /jira|issue/i.test(hint.kind))
      .map((hint) => hint.value)),
  ];
  const keys = new Set<string>();
  for (const value of values) {
    const issueKey = normalizeText(value).match(ISSUE_KEY_PATTERN)?.[0];
    if (issueKey) keys.add(`jira:${issueKey.toUpperCase()}`);
  }
  for (const hint of request.entityHints ?? []) {
    if (/goal/i.test(hint.kind) && hint.value) keys.add(`goal:${hint.value}`);
    if (/release|version/i.test(hint.kind) && hint.value) keys.add(`release:${hint.value}`);
    if (/project_id/i.test(hint.kind) && hint.value) keys.add(`project:${hint.value}`);
  }
  return Array.from(keys);
}

function collectVisibleFields(request: ContextRecallRequest): Map<string, string> {
  const fields = [
    ...(request.currentContext?.visibleFields ?? []).map((field) => ({ name: field.name, value: field.value })),
    ...(request.interactionScene?.visibleFacts ?? [])
      .filter((fact) => Boolean(fact.name))
      .map((fact) => ({ name: fact.name ?? '', value: fact.value })),
  ];
  const result = new Map<string, string>();
  for (const field of fields) {
    const property = normalizeProperty(field.name);
    if (property && normalizeText(field.value)) result.set(property.key, field.value);
  }
  return result;
}

function collectVerifiedSourceFields(
  request: ContextRecallRequest,
): Map<string, { name: string; value: string | null; checkedAt: number }> {
  const result = new Map<string, { name: string; value: string | null; checkedAt: number }>();
  for (const field of request.currentContext?.verifiedSourceFields ?? []) {
    const propertyKey = normalizeText(field.propertyKey);
    const name = normalizeText(field.name);
    if (!propertyKey || !name || field.source !== 'jira_rest' || !Number.isFinite(field.checkedAt)) continue;
    result.set(propertyKey, {
      name,
      value: field.value === null ? null : normalizeText(field.value),
      checkedAt: field.checkedAt,
    });
  }
  return result;
}

function mapEventRow(row: ChangeEventRow): MemoryChangeEvent {
  return {
    id: row.id,
    chainKey: row.chain_key,
    subjectKey: row.subject_key,
    subjectLabel: row.subject_label,
    subjectKind: row.subject_kind,
    propertyKey: row.property_key,
    propertyLabel: row.property_label,
    previousValue: parseChangeValue(row.old_value_json),
    nextValue: parseChangeValue(row.new_value_json) ?? { kind: 'text', display: '未知', normalized: null },
    eventKind: row.event_kind,
    authorityRole: row.authority_role,
    confidence: row.confidence,
    sourceRef: {
      type: row.source_ref_type,
      id: row.source_ref_id,
      title: row.source_title ?? undefined,
      url: row.source_url ?? undefined,
    },
    actor: row.actor ?? undefined,
    reason: row.reason ?? undefined,
    evidenceQuote: row.evidence_quote ?? undefined,
    observedAt: row.observed_at,
    capturedAt: row.captured_at,
    active: row.active === 1,
    isReversal: row.is_reversal === 1,
  };
}

function buildHistoricalProjection(events: MemoryChangeEvent[]): MemoryChangeProjection | null {
  if (!events.length) return null;
  const history = [...events].sort(
    (left, right) => left.observedAt - right.observedAt || left.capturedAt - right.capturedAt,
  );
  const latest = history[history.length - 1];
  return {
    chainKey: latest.chainKey,
    subjectKey: latest.subjectKey,
    subjectLabel: latest.subjectLabel,
    subjectKind: latest.subjectKind,
    propertyKey: latest.propertyKey,
    propertyLabel: latest.propertyLabel,
    currentValue: latest.nextValue,
    previousValue: latest.previousValue,
    status: 'historical_only',
    summary: buildProjectionSummary(
      latest.subjectLabel,
      latest.propertyLabel,
      latest.nextValue,
      latest.previousValue,
      history.filter((event) => event.isReversal).length,
    ),
    boundary: '该来源已撤销；事件仅保留为历史证据，不参与当前状态投影。',
    eventCount: history.length,
    reversalCount: history.filter((event) => event.isReversal).length,
    conflictCount: 0,
    firstObservedAt: history[0].observedAt,
    lastObservedAt: latest.observedAt,
    currentEvent: latest,
    history,
  };
}

function countConflicts(rows: ChangeEventRow[]): number {
  if (rows.length < 2) return 0;
  let conflicts = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    const sameWindow = Math.abs(current.observed_at - previous.observed_at) <= 3600;
    const sameAuthority = authorityRank(current.authority_role) === authorityRank(previous.authority_role);
    const differentValue = canonicalValueJson(current.new_value_json) !== canonicalValueJson(previous.new_value_json);
    if (sameWindow && sameAuthority && differentValue) conflicts += 1;
  }
  return conflicts;
}

function authorityRank(role: MemoryChangeAuthorityRole): number {
  if (role === 'authoritative_source') return 4;
  if (role === 'owner_authored') return 3;
  if (role === 'team_message' || role === 'source_snapshot') return 2;
  return 1;
}

function buildProjectionBoundary(status: MemoryChangeProjectionStatus): string {
  if (status === 'confirmed_current') return '当前页面或实时来源已在本次读取中明确核对该值；仍应保留来源与时间。';
  if (status === 'conflicted') return '相近时间存在同等权威但值不同的证据；回答或起草前需要核对当前来源。';
  if (status === 'historical_only') return '该链只保留历史证据，不参与当前状态判断。';
  if (status === 'superseded_on_page') return '当前页面值已不同于最后观测；以页面可见值为准。';
  if (status === 'superseded_at_source') return '实时来源当前值已不同于最后观测；以来源当前值为准。';
  return '这是最后一次观测，不等于权威系统已确认的当前值。';
}

function formatObservedAt(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  return `（核对时间 ${new Date(timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC）`;
}

function buildProjectionSummary(
  subjectLabel: string,
  propertyLabel: string,
  currentValue: MemoryChangeValue | undefined,
  previousValue: MemoryChangeValue | undefined,
  reversalCount: number,
): string {
  const transition = previousValue
    ? `${previousValue.display} -> ${currentValue?.display ?? '未知'}`
    : currentValue?.display ?? '未知';
  return `${subjectLabel} · ${propertyLabel}：${transition}${reversalCount ? `（含 ${reversalCount} 次回退）` : ''}`;
}

function buildConflictProjectionSummary(
  subjectLabel: string,
  propertyLabel: string,
  history: MemoryChangeEvent[],
  visiblePageValue: MemoryChangeValue | undefined,
  reversalCount: number,
): string {
  const candidates = [...new Set(history.map((event) => event.nextValue.display))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 3);
  const candidateText = candidates.length ? candidates.join(' / ') : '值未完整记录';
  const currentText = visiblePageValue
    ? `当前页面=${visiblePageValue.display}`
    : '当前值未知';
  return `${subjectLabel} · ${propertyLabel}：候选冲突（${candidateText}），${currentText}${reversalCount ? `（含 ${reversalCount} 次回退）` : ''}`;
}

function buildExtractionReceipt(input: {
  extraction: ExtractedMemoryChanges;
  inputHash: string;
  generatedAt: number;
  active: boolean;
}): MemoryChangeLedgerReceipt {
  if (input.extraction.blockedReason === 'missing_stable_subject') {
    return {
      status: 'blocked',
      label: '未形成变化脉络',
      detail: '检测到内容，但没有稳定对象标识；为避免把相邻项目或 Goal 串在一起，本次未建立变化链。',
      evidence: ['需要 issueKey、goalId、releaseId、projectId 或显式 subjectKey。'],
      inputHash: input.inputHash,
      extractedCount: 0,
      excludedNoiseCount: input.extraction.excludedNoiseCount,
      generatedAt: input.generatedAt,
      active: input.active,
      events: [],
      projections: [],
    };
  }
  if (!input.extraction.candidates.length) {
    return {
      status: 'no_change',
      label: '未发现稳定状态变化',
      detail: '已检查结构化变更和明确的旧值/新值表达，没有形成可核对的变化事件。',
      evidence: input.extraction.excludedNoiseCount ? [`已排除 ${input.extraction.excludedNoiseCount} 条界面噪音或同值更新。`] : ['没有臆测模糊叙述。'],
      inputHash: input.inputHash,
      extractedCount: 0,
      excludedNoiseCount: input.extraction.excludedNoiseCount,
      generatedAt: input.generatedAt,
      active: input.active,
      events: [],
      projections: [],
    };
  }
  return {
    status: 'ready',
    label: '已形成变化脉络',
    detail: `提取 ${input.extraction.candidates.length} 条带前后值和来源的状态变化。`,
    evidence: ['事件与当前投影分开保存。', '非权威来源仅标记为最后观测。'],
    inputHash: input.inputHash,
    extractedCount: input.extraction.candidates.length,
    excludedNoiseCount: input.extraction.excludedNoiseCount,
    generatedAt: input.generatedAt,
    active: input.active,
    events: [],
    projections: [],
  };
}

function buildNotRunReceipt(): MemoryChangeLedgerReceipt {
  return {
    status: 'not_run',
    label: '尚未检查变化',
    detail: '这条资料还没有变化提取回执。',
    evidence: [],
    extractedCount: 0,
    excludedNoiseCount: 0,
    active: false,
    events: [],
    projections: [],
  };
}

function stripReceiptCollections(receipt: MemoryChangeLedgerReceipt): Omit<MemoryChangeLedgerReceipt, 'events' | 'projections'> {
  const { events: _events, projections: _projections, ...stored } = receipt;
  return stored;
}

function parseChangeValue(raw: string | null): MemoryChangeValue | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as MemoryChangeValue;
  } catch {
    return undefined;
  }
}

function canonicalValueJson(raw: string): string {
  const value = parseChangeValue(raw);
  return value ? JSON.stringify(value.normalized) : raw;
}

function valuesEqual(left: MemoryChangeValue, right: MemoryChangeValue): boolean {
  return JSON.stringify(left.normalized) === JSON.stringify(right.normalized);
}

function candidateKey(candidate: MemoryChangeCandidate): string {
  return JSON.stringify([candidate.subjectKey, candidate.propertyKey, candidate.previousValue?.normalized ?? null, candidate.nextValue.normalized]);
}

function buildChainKey(subjectKey: string, propertyKey: string): string {
  return `${subjectKey.toLocaleLowerCase()}::${propertyKey.toLocaleLowerCase()}`;
}

function normalizeSubjectKey(value: string, kind: string): string {
  const normalized = normalizeText(value);
  if (normalized.includes(':')) return normalized.toLocaleLowerCase();
  if (/jira|issue/i.test(kind) || ISSUE_KEY_PATTERN.test(normalized)) return `jira:${normalized.toUpperCase()}`;
  return `${normalizeText(kind || 'subject').toLocaleLowerCase()}:${normalized}`;
}

function inferSubjectKind(value: string): string {
  if (ISSUE_KEY_PATTERN.test(value)) return 'jira_issue';
  if (/^goal:/i.test(value)) return 'goal';
  if (/^release:/i.test(value)) return 'release';
  if (/^project:/i.test(value)) return 'project';
  return 'subject';
}

function stripSubjectPrefix(value: string, subjectLabel: string, subjectKey: string): string {
  let result = normalizeText(value);
  const candidates = [subjectLabel, subjectKey, subjectKey.replace(/^.*?:/, '')].filter(Boolean);
  for (const candidate of candidates) {
    result = result.replace(new RegExp(`^${escapeRegExp(candidate)}[\\s:：·-]*`, 'i'), '');
  }
  return result.replace(/^(?:the|字段|field)\s+/i, '').trim();
}

function cleanupCapturedValue(value: string): string {
  return normalizeText(value).replace(/^(?:from|由)\s+/i, '').replace(/[。;；]$/, '').trim();
}

function findHint(entityHints: Array<{ kind: string; value: string }>, kinds: string[]): string {
  return entityHints.find((hint) => kinds.includes(hint.kind.toLocaleLowerCase()))?.value ?? '';
}

function readValueKind(value: unknown): MemoryChangeValueKind | undefined {
  const kinds: MemoryChangeValueKind[] = ['text', 'number', 'date', 'boolean', 'status', 'entity_ref', 'set'];
  return kinds.includes(value as MemoryChangeValueKind) ? (value as MemoryChangeValueKind) : undefined;
}

function readString(record: Record<string, unknown>, key: string): string {
  return normalizeText(record[key]);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : [];
}

function readNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readTimestamp(value: unknown): number | undefined {
  const numeric = readNumber(value);
  if (numeric !== undefined) return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  const parsed = Date.parse(normalizeText(value));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseRecord(raw: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(raw)) ?? {};
  } catch {
    return {};
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value == null ? '' : String(value).trim();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
