import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import type {
  CandidateArtifact,
  EvidenceResolutionPlan,
  EvidenceResolutionReasonCode,
  EvidenceResolutionGapType,
} from './EvidenceResolutionPlanner.js';
import { OpenQuestionExitContractService } from './OpenQuestionExitContractService.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';
import { now } from '../utils/time.js';

export type EvidenceWatchState =
  | 'active'
  | 'quiet_no_change'
  | 'due'
  | 'authority_changed'
  | 'source_blocked'
  | 'paused'
  | 'archived';

export type EvidenceWatchCadence =
  | 'on_ask'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'on_revisit';

export type EvidenceWatchRunState =
  | 'created'
  | 'checked_no_change'
  | 'checked_changed'
  | 'blocked'
  | 'skipped_budget'
  | 'skipped_duplicate'
  | 'needs_user_decision';

export type EvidenceWatchCreatedFromKind =
  | 'ask'
  | 'reflection'
  | 'action_queue'
  | 'answer_memory'
  | 'confirm_request'
  | 'manual';

export interface EvidenceWatchCanonicalClaim {
  claimText: string;
  stance: 'current' | 'historical' | 'unknown' | 'blocked';
  value?: string;
  verifiedAt?: number;
  validFrom?: number;
  validTo?: number;
}

export interface EvidenceWatchAuthoritySource {
  sourceId: string;
  sourceKind:
    | 'jira_field'
    | 'jira_comment'
    | 'google_doc'
    | 'ringcentral_thread'
    | 'calendar_event'
    | 'web_snapshot'
    | 'source_memory_capsule'
    | 'openclaw_read'
    | 'ask_context'
    | 'reflection_thread'
    | 'manual_review';
  sourceUri?: string;
  title: string;
  evidenceRole: 'authority' | 'supporting' | 'derived' | 'prior';
  accessPolicy: 'read_only' | 'approval_required' | 'unavailable';
  freshnessTtlHours?: number;
  lastSeenHash?: string;
}

export interface EvidenceWatchVerifierSpec {
  kind: 'openclaw_read' | 'confirm_watch' | 'source_recheck' | 'manual';
  actionType?: string;
  mode?: 'read' | 'write';
  reasonCode?: string;
  gapType?: string;
  targetSystem?: string;
}

export interface EvidenceWatchStopCondition {
  kind: 'expires_after' | 'quiet_runs' | 'authority_changed' | 'manual_pause';
  value?: number | string;
}

export interface EvidenceWatchImpactTarget {
  kind: 'ask' | 'today_pilot' | 'action_queue' | 'context_pack' | 'reflection';
  refId?: string;
}

export interface EvidenceWatchCheckedSource {
  sourceId: string;
  status:
    | 'ok'
    | 'blocked'
    | 'not_configured'
    | 'rate_limited'
    | 'no_new_signal';
  observedValue?: string;
  observedAt?: number;
}

export interface EvidenceWatchContract {
  id: string;
  subjectKey: string;
  title: string;
  question: string;
  canonicalClaim?: EvidenceWatchCanonicalClaim;
  authoritySources: EvidenceWatchAuthoritySource[];
  verifier: EvidenceWatchVerifierSpec;
  cadence: EvidenceWatchCadence;
  state: EvidenceWatchState;
  stopConditions: EvidenceWatchStopCondition[];
  impactTargets: EvidenceWatchImpactTarget[];
  privacyBoundary:
    | 'local_only'
    | 'work_shareable_summary'
    | 'needs_redaction'
    | 'no_export';
  lastCheckedAt?: number;
  nextCheckAt?: number;
  lastReceiptId?: string;
  createdFrom: {
    kind: EvidenceWatchCreatedFromKind;
    refId: string;
  };
  confirmRequestId?: string;
  dedupeKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface EvidenceWatchRunReceipt {
  id: string;
  contractId: string;
  runState: EvidenceWatchRunState;
  summary: string;
  checkedSources: EvidenceWatchCheckedSource[];
  suppressedActionIds: string[];
  createdPatchIds: string[];
  userVisible: boolean;
  createdAt: number;
}

export interface EvidenceWatchUiReceipt {
  contractId: string;
  state: EvidenceWatchState;
  label: string;
  detail: string;
  subjectKey: string;
  lastCheckedAt?: number;
  nextCheckAt?: number;
  confirmRequestId?: string;
  duplicateSuppressedCount: number;
  runId?: string;
  lastRunState?: EvidenceWatchRunState;
  lastRunSummary?: string;
  created?: boolean;
}

export interface EvidenceWatchListReceipt {
  label: string;
  detail: string;
  state: EvidenceWatchState | 'all';
  subjectKey?: string;
  limit: number;
  offset: number;
  returnedCount: number;
  total: number;
  readAt: number;
  readOnly: true;
}

export interface EvidenceWatchReadReceipt {
  label: string;
  detail: string;
  contractId: string;
  state: EvidenceWatchState;
  subjectKey: string;
  lastRunState?: EvidenceWatchRunState;
  lastCheckedAt?: number;
  nextCheckAt?: number;
  nextCheckDue: boolean;
  returnedCount?: number;
  limit?: number;
  readAt: number;
  readOnly: true;
}

export interface EvidenceWatchRunWriteReceipt {
  label: string;
  detail: string;
  contractId: string;
  runId: string;
  runState: EvidenceWatchRunState;
  previousState: EvidenceWatchState;
  state: EvidenceWatchState;
  previousLastCheckedAt?: number;
  lastCheckedAt?: number;
  nextCheckAt?: number;
  countsAsEvidenceCheck: boolean;
  checkedSourceCount: number;
  suppressedActionCount: number;
  createdPatchCount: number;
  wroteRun: true;
  readOnly: false;
  writtenAt: number;
}

interface EvidenceWatchContractRow {
  id: string;
  subject_key: string;
  title: string;
  question: string;
  canonical_claim_json: string | null;
  authority_sources_json: string;
  verifier_json: string;
  cadence: string;
  state: string;
  stop_conditions_json: string;
  impact_targets_json: string;
  privacy_boundary: string;
  last_checked_at: number | null;
  next_check_at: number | null;
  last_receipt_id: string | null;
  created_from_kind: string;
  created_from_ref_id: string;
  confirm_request_id: string | null;
  dedupe_key: string;
  created_at: number;
  updated_at: number;
}

interface EvidenceWatchRunRow {
  id: string;
  contract_id: string;
  run_state: string;
  summary: string;
  checked_sources_json: string;
  suppressed_action_ids_json: string;
  created_patch_ids_json: string;
  user_visible: number;
  created_at: number;
}

export interface CreateEvidenceWatchContractInput {
  subjectKey: string;
  title: string;
  question: string;
  canonicalClaim?: EvidenceWatchCanonicalClaim;
  authoritySources?: EvidenceWatchAuthoritySource[];
  verifier?: EvidenceWatchVerifierSpec;
  cadence?: EvidenceWatchCadence;
  state?: EvidenceWatchState;
  stopConditions?: EvidenceWatchStopCondition[];
  impactTargets?: EvidenceWatchImpactTarget[];
  privacyBoundary?: EvidenceWatchContract['privacyBoundary'];
  nextCheckAt?: number;
  createdFrom: {
    kind: EvidenceWatchCreatedFromKind;
    refId: string;
  };
  confirmRequestId?: string;
  dedupeKey?: string;
  createdAt?: number;
}

export interface CreateEvidenceWatchFromPlanInput {
  plan: EvidenceResolutionPlan;
  question: string;
  title?: string;
  summary?: string;
  createdFrom: {
    kind: EvidenceWatchCreatedFromKind;
    refId: string;
  };
  answerMemoryCanonicalKey?: string;
  confirmRequestId?: string;
  actionId?: string;
  cadence?: EvidenceWatchCadence;
}

export interface EvidenceWatchCreateOrReuseResult {
  contract: EvidenceWatchContract;
  created: boolean;
  receipt?: EvidenceWatchRunReceipt;
  uiReceipt: EvidenceWatchUiReceipt;
}

export interface EvidenceWatchActionPreparation {
  contract: EvidenceWatchContract;
  created: boolean;
  uiReceipt: EvidenceWatchUiReceipt;
  idempotencyKey: string;
  paramsPatch: Record<string, unknown>;
}

export interface PrepareEvidenceWatchActionProposalInput {
  actionType: string;
  question: string;
  title?: string;
  summary?: string;
  params?: Record<string, unknown>;
  createdFrom: {
    kind: EvidenceWatchCreatedFromKind;
    refId: string;
  };
  cadence?: EvidenceWatchCadence;
}

interface CountRow {
  count: number;
}

const DEFAULT_WATCH_SECONDS = 72 * 3600;
const WEAK_TEXT_LIMIT = 128;

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKeyPart(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:._/-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function stableHash(value: unknown): string {
  return createHash('sha1')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
}

function normalizeWatchState(value: string): EvidenceWatchState {
  if (
    value === 'active' ||
    value === 'quiet_no_change' ||
    value === 'due' ||
    value === 'authority_changed' ||
    value === 'source_blocked' ||
    value === 'paused' ||
    value === 'archived'
  ) {
    return value;
  }
  return 'active';
}

function normalizeCadence(value: string): EvidenceWatchCadence {
  if (
    value === 'on_ask' ||
    value === 'hourly' ||
    value === 'daily' ||
    value === 'weekly' ||
    value === 'on_revisit'
  ) {
    return value;
  }
  return 'on_revisit';
}

function normalizePrivacyBoundary(
  value: string,
): EvidenceWatchContract['privacyBoundary'] {
  if (
    value === 'local_only' ||
    value === 'work_shareable_summary' ||
    value === 'needs_redaction' ||
    value === 'no_export'
  ) {
    return value;
  }
  return 'local_only';
}

function normalizeRunState(value: string): EvidenceWatchRunState {
  if (
    value === 'created' ||
    value === 'checked_no_change' ||
    value === 'checked_changed' ||
    value === 'blocked' ||
    value === 'skipped_budget' ||
    value === 'skipped_duplicate' ||
    value === 'needs_user_decision'
  ) {
    return value;
  }
  return 'checked_no_change';
}

function inferSourceKind(
  sourceAnchor: string | undefined,
): EvidenceWatchAuthoritySource['sourceKind'] {
  if (!sourceAnchor) return 'manual_review';
  if (sourceAnchor.startsWith('ask:')) return 'ask_context';
  if (sourceAnchor.startsWith('thread:')) return 'reflection_thread';
  if (sourceAnchor.startsWith('outreach:')) return 'ringcentral_thread';
  if (/jira|mtr-|rcv-|issue/i.test(sourceAnchor)) return 'jira_field';
  return 'source_memory_capsule';
}

function authoritySourcesFromArtifacts(
  artifacts: CandidateArtifact[] | undefined,
): EvidenceWatchAuthoritySource[] {
  if (!artifacts?.length) return [];
  return artifacts.slice(0, 4).map((artifact, index) => ({
    sourceId: artifact.url ?? artifact.title ?? `artifact:${index + 1}`,
    sourceKind: artifact.url ? 'web_snapshot' : 'source_memory_capsule',
    sourceUri: artifact.url,
    title: artifact.title ?? artifact.url ?? `候选线索 ${index + 1}`,
    evidenceRole: 'supporting',
    accessPolicy: 'read_only',
  }));
}

function readStringFromRecord(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function evidenceWatchLabel(state: EvidenceWatchState): string {
  if (state === 'authority_changed') return '证据守望发现变化';
  if (state === 'source_blocked') return '证据守望来源阻塞';
  if (state === 'due') return '证据守望待复核';
  if (state === 'quiet_no_change') return '证据守望静默无变化';
  if (state === 'paused') return '证据守望已暂停';
  if (state === 'archived') return '证据守望已归档';
  return '证据守望已建立';
}

function cadenceLabel(cadence: EvidenceWatchCadence): string {
  if (cadence === 'hourly') return '每小时复核';
  if (cadence === 'daily') return '每日复核';
  if (cadence === 'weekly') return '每周复核';
  if (cadence === 'on_ask') return '再次询问时复核';
  return '再次回到相关场景时复核';
}

export function isEvidenceWatchResolutionPlan(
  plan: Pick<
    EvidenceResolutionPlan,
    'disposition' | 'reasonCode' | 'gapType' | 'recommendedAction'
  >,
): boolean {
  return (
    plan.disposition === 'watch' ||
    plan.reasonCode === 'future_monitoring' ||
    plan.reasonCode === 'owner_eta_gap' ||
    plan.reasonCode === 'artifact_gap' ||
    plan.gapType === 'future_monitoring' ||
    plan.gapType === 'owner_eta' ||
    plan.gapType === 'artifact_check'
  );
}

export function buildEvidenceWatchSubjectKey(input: {
  question?: string;
  sourceAnchor?: string;
  gapType?: string;
  answerMemoryCanonicalKey?: string;
}): string | undefined {
  const answerKey = normalizeKeyPart(input.answerMemoryCanonicalKey ?? '');
  if (answerKey) return `answer:${answerKey}`;

  const sourceAnchor = normalizeKeyPart(input.sourceAnchor ?? '');
  const gapType = normalizeKeyPart(input.gapType ?? '');
  if (sourceAnchor) {
    return gapType ? `source:${sourceAnchor}|gap:${gapType}` : `source:${sourceAnchor}`;
  }

  const question = normalizeKeyPart(input.question ?? '');
  if (!question) return undefined;
  const compact = question.slice(0, WEAK_TEXT_LIMIT);
  return `question:${stableHash(`${compact}|gap:${gapType || 'unknown'}`)}`;
}

function buildDedupeKey(input: {
  subjectKey: string;
  verifier?: EvidenceWatchVerifierSpec;
  cadence?: EvidenceWatchCadence;
}): string {
  return stableHash({
    subjectKey: input.subjectKey,
    verifierKind: input.verifier?.kind ?? 'source_recheck',
    actionType: input.verifier?.actionType ?? 'none',
    gapType: input.verifier?.gapType ?? '',
    cadence: input.cadence ?? 'on_revisit',
  });
}

export class EvidenceWatchContractService {
  constructor(private readonly db: Database.Database) {}

  getById(id: string): EvidenceWatchContract | null {
    const row = this.db
      .prepare('SELECT * FROM evidence_watch_contracts WHERE id = ?')
      .get(id) as EvidenceWatchContractRow | undefined;
    return row ? this.rowToContract(row) : null;
  }

  findByConfirmRequestId(confirmRequestId: string): EvidenceWatchContract | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM evidence_watch_contracts
         WHERE confirm_request_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(confirmRequestId) as EvidenceWatchContractRow | undefined;
    return row ? this.rowToContract(row) : null;
  }

  list(filters: {
    state?: EvidenceWatchState | 'all';
    subjectKey?: string;
    limit?: number;
    offset?: number;
  } = {}): {
    items: EvidenceWatchContract[];
    total: number;
    limit: number;
    offset: number;
    receipt: EvidenceWatchListReceipt;
  } {
    const state = filters.state ?? 'all';
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (state !== 'all') {
      conditions.push('state = ?');
      params.push(state);
    }
    if (filters.subjectKey) {
      conditions.push('subject_key = ?');
      params.push(filters.subjectKey);
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const rows = this.db
      .prepare(
        `SELECT *
         FROM evidence_watch_contracts
         ${whereClause}
         ORDER BY
           CASE state
             WHEN 'authority_changed' THEN 0
             WHEN 'source_blocked' THEN 1
             WHEN 'due' THEN 2
             WHEN 'active' THEN 3
             ELSE 4
           END ASC,
           updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as EvidenceWatchContractRow[];
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM evidence_watch_contracts ${whereClause}`,
        )
        .get(...params) as CountRow
    ).count;
    return {
      items: rows.map((row) => this.rowToContract(row)),
      total,
      limit,
      offset,
      receipt: this.buildListReceipt({
        state,
        subjectKey: filters.subjectKey,
        limit,
        offset,
        returnedCount: rows.length,
        total,
      }),
    };
  }

  listRuns(contractId: string, limit = 20): EvidenceWatchRunReceipt[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM evidence_watch_runs
         WHERE contract_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(contractId, Math.max(1, Math.min(limit, 100))) as EvidenceWatchRunRow[];
    return rows.map((row) => this.rowToRun(row));
  }

  buildDetailReadReceipt(contract: EvidenceWatchContract): EvidenceWatchReadReceipt {
    const lastRun = contract.lastReceiptId
      ? this.getRunReceiptById(contract.id, contract.lastReceiptId)
      : null;
    const readAt = now();
    const timeBasis = this.buildReadTimeBasis(contract, readAt);
    const lastRunPart = lastRun ? `，lastRun=${lastRun.runState}` : '';
    return {
      label: '证据守望详情快照',
      detail:
        `已读取 ${contract.title} 的证据守望详情；当前 state=${contract.state}${lastRunPart}；${timeBasis.detail}。` +
        '本次只读详情不会复核权威来源、追加 run、创建或复用外部查证动作、确认事实变化、发送通知，也不会修改 contract 状态。',
      contractId: contract.id,
      state: contract.state,
      subjectKey: contract.subjectKey,
      lastRunState: lastRun?.runState,
      lastCheckedAt: contract.lastCheckedAt,
      nextCheckAt: contract.nextCheckAt,
      nextCheckDue: timeBasis.nextCheckDue,
      readAt,
      readOnly: true,
    };
  }

  buildRunHistoryReadReceipt(input: {
    contract: EvidenceWatchContract;
    returnedCount: number;
    limit: number;
  }): EvidenceWatchReadReceipt {
    const lastRun = input.contract.lastReceiptId
      ? this.getRunReceiptById(input.contract.id, input.contract.lastReceiptId)
      : null;
    const readAt = now();
    const timeBasis = this.buildReadTimeBasis(input.contract, readAt);
    return {
      label: '证据守望运行快照',
      detail:
        `已读取 ${input.contract.title} 的 run 历史；返回 ${input.returnedCount} 条，limit=${input.limit}。` +
        `${timeBasis.detail}。这些 run 是历史收据，不代表本轮重新触达过权威来源。` +
        '本次只读历史不会复核权威来源、追加 run、创建或复用外部查证动作、确认事实变化、发送通知，也不会修改 contract 状态。',
      contractId: input.contract.id,
      state: input.contract.state,
      subjectKey: input.contract.subjectKey,
      lastRunState: lastRun?.runState,
      lastCheckedAt: input.contract.lastCheckedAt,
      nextCheckAt: input.contract.nextCheckAt,
      nextCheckDue: timeBasis.nextCheckDue,
      returnedCount: input.returnedCount,
      limit: input.limit,
      readAt,
      readOnly: true,
    };
  }

  buildRunWriteReceipt(input: {
    previous: EvidenceWatchContract;
    current: EvidenceWatchContract;
    run: EvidenceWatchRunReceipt;
  }): EvidenceWatchRunWriteReceipt {
    const countsAsCheck = this.countsAsEvidenceCheck(input.run.runState);
    const checkedPart = countsAsCheck
      ? '本次 run 计入真实复核，会按 run state 推进 state / lastCheckedAt / nextCheckAt。'
      : '本次 run 只是生命周期、预算或去重收据，不计入真实复核，不会推进 lastCheckedAt，也不会把旧结论标成已复核。';
    const sourcePart =
      input.run.checkedSources.length > 0
        ? `记录了 ${input.run.checkedSources.length} 条来源状态。`
        : '没有记录新的来源触达。';
    const duplicatePart =
      input.run.suppressedActionIds.length > 0
        ? `复用了 ${input.run.suppressedActionIds.length} 个既有动作。`
        : '没有复用既有动作。';
    const patchPart =
      input.run.createdPatchIds.length > 0
        ? `生成了 ${input.run.createdPatchIds.length} 个补丁线索。`
        : '没有生成补丁线索。';
    return {
      label: '证据守望运行写入回执',
      detail:
        `已写入 run=${input.run.runState} 到 ${input.current.title}；` +
        `state ${input.previous.state} -> ${input.current.state}。` +
        `${checkedPart}${sourcePart}${duplicatePart}${patchPart}` +
        '本次写入不会直接执行外部查证、发送通知、确认事实变化、写回权威来源或创建额外 action。',
      contractId: input.current.id,
      runId: input.run.id,
      runState: input.run.runState,
      previousState: input.previous.state,
      state: input.current.state,
      previousLastCheckedAt: input.previous.lastCheckedAt,
      lastCheckedAt: input.current.lastCheckedAt,
      nextCheckAt: input.current.nextCheckAt,
      countsAsEvidenceCheck: countsAsCheck,
      checkedSourceCount: input.run.checkedSources.length,
      suppressedActionCount: input.run.suppressedActionIds.length,
      createdPatchCount: input.run.createdPatchIds.length,
      wroteRun: true,
      readOnly: false,
      writtenAt: input.run.createdAt,
    };
  }

  createOrReuse(
    input: CreateEvidenceWatchContractInput,
  ): EvidenceWatchCreateOrReuseResult {
    const createdAt = input.createdAt ?? now();
    const subjectKey = collapseWhitespace(input.subjectKey);
    if (!subjectKey) {
      throw new Error('Evidence watch subjectKey is required');
    }
    const verifier = input.verifier ?? { kind: 'source_recheck' };
    const cadence = input.cadence ?? 'on_revisit';
    const dedupeKey =
      input.dedupeKey ?? buildDedupeKey({ subjectKey, verifier, cadence });
    const existing = this.findByDedupeKey(dedupeKey);
    if (existing) {
      const merged = this.mergeContract(existing.id, input, dedupeKey);
      const uiReceipt = this.toUiReceipt(merged, {
        created: false,
        detail: '已复用现有证据守望契约；本轮不会新建重复观察对象。',
      });
      return { contract: merged, created: false, uiReceipt };
    }

    const id = randomUUID();
    const authoritySources = input.authoritySources ?? [];
    const state = input.state ?? 'active';
    const nextCheckAt =
      typeof input.nextCheckAt === 'number'
        ? input.nextCheckAt
        : cadence === 'on_ask'
          ? undefined
          : createdAt + DEFAULT_WATCH_SECONDS;

    this.db
      .prepare(
        `INSERT INTO evidence_watch_contracts
          (id, subject_key, title, question, canonical_claim_json,
           authority_sources_json, verifier_json, cadence, state,
           stop_conditions_json, impact_targets_json, privacy_boundary,
           last_checked_at, next_check_at, last_receipt_id, created_from_kind,
           created_from_ref_id, confirm_request_id, dedupe_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        subjectKey,
        input.title,
        input.question,
        input.canonicalClaim ? JSON.stringify(input.canonicalClaim) : null,
        JSON.stringify(authoritySources),
        JSON.stringify(verifier),
        cadence,
        state,
        JSON.stringify(input.stopConditions ?? []),
        JSON.stringify(input.impactTargets ?? []),
        input.privacyBoundary ?? 'local_only',
        null,
        nextCheckAt ?? null,
        null,
        input.createdFrom.kind,
        input.createdFrom.refId,
        input.confirmRequestId ?? null,
        dedupeKey,
        createdAt,
        createdAt,
      );

    let contract = this.getById(id)!;
    const receipt = this.appendRunReceipt({
      contractId: id,
      runState: 'created',
      summary: '已建立证据守望契约；后续相同事实缺口会合并到这里。',
      userVisible: false,
      createdAt,
    });
    contract = this.getById(id)!;
    const uiReceipt = this.toUiReceipt(contract, {
      created: true,
      runId: receipt.id,
      detail: '已建立证据守望契约；重复外部查证会被合并，并保留收据。',
    });
    return { contract, created: true, receipt, uiReceipt };
  }

  createOrReuseFromPlan(
    input: CreateEvidenceWatchFromPlanInput,
  ): EvidenceWatchCreateOrReuseResult | null {
    if (!isEvidenceWatchResolutionPlan(input.plan)) {
      return null;
    }
    const actionParams =
      input.plan.actionParams &&
      typeof input.plan.actionParams === 'object' &&
      !Array.isArray(input.plan.actionParams)
        ? input.plan.actionParams
        : undefined;
    const explicitSourceAnchor =
      input.plan.sourceAnchor ?? readStringFromRecord(actionParams, 'sourceAnchor');
    const fallbackSourceAnchor =
      input.createdFrom.kind === 'ask'
        ? `ask:${input.createdFrom.refId}`
        : input.createdFrom.kind === 'reflection'
          ? `thread:${input.createdFrom.refId}`
          : undefined;
    const sourceAnchor = explicitSourceAnchor ?? fallbackSourceAnchor;
    const subjectSourceAnchor =
      explicitSourceAnchor ??
      (input.createdFrom.kind === 'reflection' ? fallbackSourceAnchor : undefined);
    const gapType = input.plan.gapType;
    const subjectKey = buildEvidenceWatchSubjectKey({
      question: input.question,
      sourceAnchor: subjectSourceAnchor,
      gapType,
      answerMemoryCanonicalKey: input.answerMemoryCanonicalKey,
    });
    if (!subjectKey) return null;

    const authoritySources = this.buildAuthoritySources({
      sourceAnchor,
      artifacts: input.plan.candidateArtifacts,
      answerMemoryCanonicalKey: input.answerMemoryCanonicalKey,
    });
    const verifier: EvidenceWatchVerifierSpec = {
      kind:
        input.plan.recommendedAction === 'delegate_openclaw'
          ? 'openclaw_read'
          : input.plan.recommendedAction === 'create_confirm_request'
            ? 'confirm_watch'
            : 'source_recheck',
      actionType: input.plan.recommendedAction,
      mode: actionParams?.mode === 'write' ? 'write' : 'read',
      reasonCode: input.plan.reasonCode,
      gapType,
      targetSystem: readStringFromRecord(actionParams, 'targetSystem'),
    };
    const result = this.createOrReuse({
      subjectKey,
      title:
        input.title ??
        this.buildTitle(input.question, input.plan.reasonCode, gapType),
      question: input.question,
      canonicalClaim: input.plan.resolvedConclusion
        ? {
            claimText: input.plan.resolvedConclusion,
            stance:
              input.plan.resolutionState === 'complete'
                ? 'current'
                : 'unknown',
          }
        : undefined,
      authoritySources,
      verifier,
      cadence:
        input.cadence ??
        (input.createdFrom.kind === 'ask' ? 'on_ask' : 'on_revisit'),
      stopConditions: [
        { kind: 'expires_after', value: 14 * 24 * 3600 },
        { kind: 'quiet_runs', value: 5 },
      ],
      impactTargets: [
        { kind: input.createdFrom.kind === 'ask' ? 'ask' : 'reflection', refId: input.createdFrom.refId },
        { kind: 'action_queue' },
      ],
      privacyBoundary: 'local_only',
      createdFrom: input.createdFrom,
      confirmRequestId: input.confirmRequestId,
    });
    if (input.actionId) {
      this.linkTarget(result.contract.id, 'action', input.actionId, 'origin');
    }
    if (input.confirmRequestId) {
      this.linkConfirmRequest(result.contract.id, input.confirmRequestId);
    }
    return result;
  }

  prepareActionForPlan(input: CreateEvidenceWatchFromPlanInput & {
    actionType: string;
  }): EvidenceWatchActionPreparation | null {
    const result = this.createOrReuseFromPlan(input);
    if (!result) return null;
    const idempotencyKey = this.buildActionIdempotencyKey(
      result.contract.id,
      input.actionType,
    );
    return {
      contract: result.contract,
      created: result.created,
      uiReceipt: result.uiReceipt,
      idempotencyKey,
      paramsPatch: {
        evidenceWatchContractId: result.contract.id,
        sourceAnchor: this.sourceAnchorFromContract(result.contract),
        gapType: input.plan.gapType,
        reasonCode: input.plan.reasonCode,
        routing:
          input.actionType === 'create_confirm_request'
            ? 'watch'
            : undefined,
        evidenceWatch: {
          contractId: result.contract.id,
          subjectKey: result.contract.subjectKey,
          state: result.contract.state,
        },
      },
    };
  }

  prepareActionForProposal(
    input: PrepareEvidenceWatchActionProposalInput,
  ): EvidenceWatchActionPreparation | null {
    const evidenceResolution =
      input.params?.evidenceResolution &&
      typeof input.params.evidenceResolution === 'object' &&
      !Array.isArray(input.params.evidenceResolution)
        ? (input.params.evidenceResolution as Record<string, unknown>)
        : undefined;
    const routing = readStringFromRecord(input.params, 'routing');
    const reasonCode =
      readStringFromRecord(input.params, 'reasonCode') ??
      readStringFromRecord(evidenceResolution, 'reasonCode');
    const gapType =
      readStringFromRecord(input.params, 'gapType') ??
      readStringFromRecord(evidenceResolution, 'gapType');
    const disposition = readStringFromRecord(evidenceResolution, 'disposition');
    const sourceAnchor =
      readStringFromRecord(input.params, 'sourceAnchor') ??
      readStringFromRecord(evidenceResolution, 'sourceAnchor') ??
      (input.createdFrom.kind === 'reflection'
        ? `thread:${input.createdFrom.refId}`
        : undefined);
    const shouldWatch =
      routing === 'watch' ||
      disposition === 'watch' ||
      reasonCode === 'future_monitoring' ||
      reasonCode === 'owner_eta_gap' ||
      reasonCode === 'artifact_gap' ||
      gapType === 'future_monitoring' ||
      gapType === 'owner_eta' ||
      gapType === 'artifact_check';
    if (!shouldWatch) return null;

    const subjectKey = buildEvidenceWatchSubjectKey({
      question: input.question,
      sourceAnchor,
      gapType,
      answerMemoryCanonicalKey: readStringFromRecord(
        input.params,
        'answerMemoryCanonicalKey',
      ),
    });
    if (!subjectKey) return null;

    const result = this.createOrReuse({
      subjectKey,
      title:
        input.title ??
        this.buildTitle(input.question, reasonCode as EvidenceResolutionReasonCode, gapType as EvidenceResolutionGapType),
      question: input.question,
      authoritySources: this.buildAuthoritySources({ sourceAnchor }),
      verifier: {
        kind:
          input.actionType === 'delegate_openclaw'
            ? 'openclaw_read'
            : input.actionType === 'create_confirm_request'
              ? 'confirm_watch'
              : 'source_recheck',
        actionType: input.actionType,
        mode: input.params?.mode === 'write' ? 'write' : 'read',
        reasonCode,
        gapType,
        targetSystem: readStringFromRecord(input.params, 'targetSystem'),
      },
      cadence: input.cadence ?? 'on_revisit',
      stopConditions: [
        { kind: 'expires_after', value: 14 * 24 * 3600 },
        { kind: 'quiet_runs', value: 5 },
      ],
      impactTargets: [
        { kind: input.createdFrom.kind === 'ask' ? 'ask' : 'reflection', refId: input.createdFrom.refId },
        { kind: 'action_queue' },
      ],
      privacyBoundary: 'local_only',
      createdFrom: input.createdFrom,
    });
    const idempotencyKey = this.buildActionIdempotencyKey(
      result.contract.id,
      input.actionType,
    );
    return {
      contract: result.contract,
      created: result.created,
      uiReceipt: result.uiReceipt,
      idempotencyKey,
      paramsPatch: {
        evidenceWatchContractId: result.contract.id,
        sourceAnchor: this.sourceAnchorFromContract(result.contract),
        gapType,
        reasonCode,
        routing:
          input.actionType === 'create_confirm_request' ? 'watch' : routing,
        evidenceWatch: {
          contractId: result.contract.id,
          subjectKey: result.contract.subjectKey,
          state: result.contract.state,
        },
      },
    };
  }

  appendRunReceipt(input: {
    contractId: string;
    runState: EvidenceWatchRunState;
    summary: string;
    checkedSources?: EvidenceWatchCheckedSource[];
    suppressedActionIds?: string[];
    createdPatchIds?: string[];
    userVisible?: boolean;
    createdAt?: number;
  }): EvidenceWatchRunReceipt {
    const id = randomUUID();
    const createdAt = input.createdAt ?? now();
    const current = this.getById(input.contractId);
    if (!current) {
      throw new Error(`Evidence watch contract ${input.contractId} not found`);
    }
    const checkedSources = input.checkedSources ?? [];
    const suppressedActionIds = uniqStrings(input.suppressedActionIds ?? []);
    const createdPatchIds = uniqStrings(input.createdPatchIds ?? []);
    this.db
      .prepare(
        `INSERT INTO evidence_watch_runs
          (id, contract_id, run_state, summary, checked_sources_json,
           suppressed_action_ids_json, created_patch_ids_json, user_visible, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.contractId,
        input.runState,
        input.summary,
        JSON.stringify(checkedSources),
        JSON.stringify(suppressedActionIds),
        JSON.stringify(createdPatchIds),
        input.userVisible ? 1 : 0,
        createdAt,
      );

    const state = this.stateFromRun(input.runState, current.state);
    const countsAsCheck = this.countsAsEvidenceCheck(input.runState);
    this.db
      .prepare(
        `UPDATE evidence_watch_contracts
         SET state = ?,
             last_checked_at = ?,
             next_check_at = ?,
             last_receipt_id = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        state,
        countsAsCheck ? createdAt : (current.lastCheckedAt ?? null),
        this.nextCheckFromRun(input.runState, createdAt, current.nextCheckAt),
        id,
        createdAt,
        input.contractId,
      );

    if (input.runState === 'checked_changed') {
      new OpenQuestionExitContractService(this.db).resumeForEvidenceWatch(
        input.contractId,
        createdAt,
      );
    }

    return {
      id,
      contractId: input.contractId,
      runState: input.runState,
      summary: input.summary,
      checkedSources,
      suppressedActionIds,
      createdPatchIds,
      userVisible: input.userVisible ?? false,
      createdAt,
    };
  }

  recordActionResult(input: {
    contractId: string;
    action: QueuedActionRecord;
    wasDuplicate: boolean;
    summary?: string;
  }): EvidenceWatchRunReceipt | undefined {
    this.linkTarget(input.contractId, 'action', input.action.id, 'verification_action');
    if (!input.wasDuplicate) return undefined;
    return this.appendRunReceipt({
      contractId: input.contractId,
      runState: 'skipped_duplicate',
      summary:
        input.summary ??
        `已复用队列中的 ${input.action.actionType} 动作，未创建重复外部查证。`,
      suppressedActionIds: [input.action.id],
      userVisible: false,
    });
  }

  linkConfirmRequest(
    contractId: string,
    confirmRequestId: string,
  ): EvidenceWatchContract | null {
    this.linkTarget(contractId, 'confirm_request', confirmRequestId, 'watch_item');
    this.db
      .prepare(
        `UPDATE evidence_watch_contracts
         SET confirm_request_id = COALESCE(confirm_request_id, ?),
             updated_at = ?
         WHERE id = ?`,
      )
      .run(confirmRequestId, now(), contractId);
    return this.getById(contractId);
  }

  linkTarget(
    contractId: string,
    targetKind: string,
    targetId: string,
    relation: string,
  ): void {
    if (!targetId.trim()) return;
    this.db
      .prepare(
        `INSERT OR IGNORE INTO evidence_watch_links
          (id, contract_id, target_kind, target_id, relation, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), contractId, targetKind, targetId, relation, now());
  }

  buildActionIdempotencyKey(contractId: string, actionType: string): string {
    return `evidence_watch:${contractId}:${actionType}:verify`;
  }

  toUiReceipt(
    contract: EvidenceWatchContract,
    overrides: {
      created?: boolean;
      runId?: string;
      detail?: string;
      lastRunState?: EvidenceWatchRunState;
      lastRunSummary?: string;
    } = {},
  ): EvidenceWatchUiReceipt {
    const runId = overrides.runId ?? contract.lastReceiptId;
    const runReceipt = runId ? this.getRunReceiptById(contract.id, runId) : null;
    return {
      contractId: contract.id,
      state: contract.state,
      label: evidenceWatchLabel(contract.state),
      detail:
        overrides.detail ??
        this.buildUiReceiptDetail(contract),
      subjectKey: contract.subjectKey,
      lastCheckedAt: contract.lastCheckedAt,
      nextCheckAt: contract.nextCheckAt,
      confirmRequestId: contract.confirmRequestId,
      duplicateSuppressedCount: this.countDuplicateSuppressions(contract.id),
      runId,
      lastRunState: overrides.lastRunState ?? runReceipt?.runState,
      lastRunSummary: overrides.lastRunSummary ?? runReceipt?.summary,
      created: overrides.created,
    };
  }

  private findByDedupeKey(dedupeKey: string): EvidenceWatchContract | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM evidence_watch_contracts
         WHERE dedupe_key = ?
         LIMIT 1`,
      )
      .get(dedupeKey) as EvidenceWatchContractRow | undefined;
    return row ? this.rowToContract(row) : null;
  }

  private mergeContract(
    id: string,
    input: CreateEvidenceWatchContractInput,
    dedupeKey: string,
  ): EvidenceWatchContract {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Evidence watch contract ${id} not found`);
    const mergedSources = mergeAuthoritySources(
      existing.authoritySources,
      input.authoritySources ?? [],
    );
    const mergedTargets = mergeImpactTargets(
      existing.impactTargets,
      input.impactTargets ?? [],
    );
    const updatedAt = input.createdAt ?? now();
    this.db
      .prepare(
        `UPDATE evidence_watch_contracts
         SET title = ?,
             question = ?,
             canonical_claim_json = COALESCE(canonical_claim_json, ?),
             authority_sources_json = ?,
             verifier_json = ?,
             stop_conditions_json = ?,
             impact_targets_json = ?,
             confirm_request_id = COALESCE(confirm_request_id, ?),
             dedupe_key = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        chooseRicherText(existing.title, input.title) ?? existing.title,
        chooseRicherText(existing.question, input.question) ?? existing.question,
        input.canonicalClaim ? JSON.stringify(input.canonicalClaim) : null,
        JSON.stringify(mergedSources),
        JSON.stringify(input.verifier ?? existing.verifier),
        JSON.stringify(
          mergeStopConditions(
            existing.stopConditions,
            input.stopConditions ?? [],
          ),
        ),
        JSON.stringify(mergedTargets),
        input.confirmRequestId ?? null,
        dedupeKey,
        updatedAt,
        id,
      );
    if (input.confirmRequestId) {
      this.linkTarget(id, 'confirm_request', input.confirmRequestId, 'watch_item');
    }
    return this.getById(id)!;
  }

  private rowToContract(row: EvidenceWatchContractRow): EvidenceWatchContract {
    return {
      id: row.id,
      subjectKey: row.subject_key,
      title: row.title,
      question: row.question,
      canonicalClaim: safeJsonParse<EvidenceWatchCanonicalClaim | undefined>(
        row.canonical_claim_json,
        undefined,
      ),
      authoritySources: safeJsonParse<EvidenceWatchAuthoritySource[]>(
        row.authority_sources_json,
        [],
      ),
      verifier: safeJsonParse<EvidenceWatchVerifierSpec>(
        row.verifier_json,
        { kind: 'source_recheck' },
      ),
      cadence: normalizeCadence(row.cadence),
      state: normalizeWatchState(row.state),
      stopConditions: safeJsonParse<EvidenceWatchStopCondition[]>(
        row.stop_conditions_json,
        [],
      ),
      impactTargets: safeJsonParse<EvidenceWatchImpactTarget[]>(
        row.impact_targets_json,
        [],
      ),
      privacyBoundary: normalizePrivacyBoundary(row.privacy_boundary),
      lastCheckedAt: row.last_checked_at ?? undefined,
      nextCheckAt: row.next_check_at ?? undefined,
      lastReceiptId: row.last_receipt_id ?? undefined,
      createdFrom: {
        kind: normalizeCreatedFromKind(row.created_from_kind),
        refId: row.created_from_ref_id,
      },
      confirmRequestId: row.confirm_request_id ?? undefined,
      dedupeKey: row.dedupe_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToRun(row: EvidenceWatchRunRow): EvidenceWatchRunReceipt {
    return {
      id: row.id,
      contractId: row.contract_id,
      runState: normalizeRunState(row.run_state),
      summary: row.summary,
      checkedSources: safeJsonParse<EvidenceWatchCheckedSource[]>(
        row.checked_sources_json,
        [],
      ),
      suppressedActionIds: safeJsonParse<string[]>(
        row.suppressed_action_ids_json,
        [],
      ),
      createdPatchIds: safeJsonParse<string[]>(
        row.created_patch_ids_json,
        [],
      ),
      userVisible: row.user_visible === 1,
      createdAt: row.created_at,
    };
  }

  private buildAuthoritySources(input: {
    sourceAnchor?: string;
    artifacts?: CandidateArtifact[];
    answerMemoryCanonicalKey?: string;
  }): EvidenceWatchAuthoritySource[] {
    const sources: EvidenceWatchAuthoritySource[] = [];
    if (input.sourceAnchor) {
      sources.push({
        sourceId: input.sourceAnchor,
        sourceKind: inferSourceKind(input.sourceAnchor),
        title: input.sourceAnchor,
        evidenceRole: 'authority',
        accessPolicy: 'read_only',
      });
    }
    if (input.answerMemoryCanonicalKey) {
      sources.push({
        sourceId: input.answerMemoryCanonicalKey,
        sourceKind: 'source_memory_capsule',
        title: 'Answer Memory canonical key',
        evidenceRole: 'prior',
        accessPolicy: 'read_only',
      });
    }
    return mergeAuthoritySources(
      sources,
      authoritySourcesFromArtifacts(input.artifacts),
    );
  }

  private buildTitle(
    question: string,
    reasonCode?: EvidenceResolutionReasonCode,
    gapType?: EvidenceResolutionGapType,
  ): string {
    const suffix = reasonCode ?? gapType ?? 'watch';
    const compact = collapseWhitespace(question).slice(0, 80);
    return compact ? `${compact} (${suffix})` : `Evidence watch (${suffix})`;
  }

  private sourceAnchorFromContract(
    contract: EvidenceWatchContract,
  ): string | undefined {
    const source = contract.authoritySources.find(
      (item) => item.evidenceRole === 'authority',
    );
    return source?.sourceId;
  }

  private stateFromRun(
    runState: EvidenceWatchRunState,
    currentState: EvidenceWatchState,
  ): EvidenceWatchState {
    if (runState === 'checked_changed') return 'authority_changed';
    if (runState === 'blocked') return 'source_blocked';
    if (runState === 'checked_no_change') return 'quiet_no_change';
    if (runState === 'needs_user_decision') return 'due';
    return currentState;
  }

  private nextCheckFromRun(
    runState: EvidenceWatchRunState,
    createdAt: number,
    currentNextCheckAt?: number,
  ): number | null {
    if (
      runState === 'checked_changed' ||
      runState === 'blocked' ||
      runState === 'needs_user_decision'
    ) {
      return null;
    }
    if (!this.countsAsEvidenceCheck(runState)) {
      return currentNextCheckAt ?? null;
    }
    return createdAt + DEFAULT_WATCH_SECONDS;
  }

  private countsAsEvidenceCheck(runState: EvidenceWatchRunState): boolean {
    return (
      runState === 'checked_no_change' ||
      runState === 'checked_changed' ||
      runState === 'blocked' ||
      runState === 'needs_user_decision'
    );
  }

  private countDuplicateSuppressions(contractId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM evidence_watch_runs
         WHERE contract_id = ?
           AND run_state = 'skipped_duplicate'`,
      )
      .get(contractId) as CountRow;
    return row.count;
  }

  private getRunReceiptById(
    contractId: string,
    runId: string,
  ): EvidenceWatchRunReceipt | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM evidence_watch_runs
         WHERE contract_id = ?
           AND id = ?
         LIMIT 1`,
      )
      .get(contractId, runId) as EvidenceWatchRunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  private buildUiReceiptDetail(contract: EvidenceWatchContract): string {
    const duplicateCount = this.countDuplicateSuppressions(contract.id);
    const duplicateSuffix =
      duplicateCount > 0
        ? `已合并 ${duplicateCount} 次重复查证动作；`
        : '';
    const cadence = cadenceLabel(contract.cadence);
    if (contract.state === 'authority_changed') {
      return `${contract.title} 的权威来源已出现变化，需要复核影响面；不会自动外发或写回外部系统。${duplicateSuffix}`;
    }
    if (contract.state === 'source_blocked') {
      return `${contract.title} 的权威来源暂不可读；旧结论只能按历史引用，等待来源恢复或用户确认。${duplicateSuffix}`;
    }
    if (contract.state === 'due') {
      return `${contract.title} 需要复核或用户决策；旧结论不会冒充当前事实，也不会自动外发。${duplicateSuffix}`;
    }
    if (contract.state === 'quiet_no_change') {
      return `${contract.title} 最近一次权威来源复核未发现变化；后续将${cadence}。${duplicateSuffix}`;
    }
    if (contract.state === 'paused') {
      return `${contract.title} 的证据守望已暂停；暂停期间不会启动新的外部查证。${duplicateSuffix}`;
    }
    if (contract.state === 'archived') {
      return `${contract.title} 的证据守望已归档；旧结论仅作为历史记录引用。${duplicateSuffix}`;
    }
    return `${contract.title} 已进入证据守望，将在${cadence}；当前回执只代表契约已建立，不代表权威来源已完成复核。${duplicateSuffix}`;
  }

  private buildListReceipt(input: {
    state: EvidenceWatchState | 'all';
    subjectKey?: string;
    limit: number;
    offset: number;
    returnedCount: number;
    total: number;
  }): EvidenceWatchListReceipt {
    const statePart =
      input.state === 'all' ? '全部状态' : `state=${input.state}`;
    const subjectPart = input.subjectKey
      ? `，subjectKey=${input.subjectKey}`
      : '';
    return {
      label: '证据守望列表快照',
      detail:
        `已读取 ${statePart}${subjectPart} 的证据守望列表快照；` +
        `返回 ${input.returnedCount}/${input.total} 条，分页 offset=${input.offset} limit=${input.limit}。` +
        '本次只读列表不会复核权威来源、创建或复用外部查证动作、确认事实变化、发送通知，也不会修改 contract 状态。',
      state: input.state,
      subjectKey: input.subjectKey,
      limit: input.limit,
      offset: input.offset,
      returnedCount: input.returnedCount,
      total: input.total,
      readAt: now(),
      readOnly: true,
    };
  }

  private buildReadTimeBasis(
    contract: EvidenceWatchContract,
    readAt: number,
  ): { detail: string; nextCheckDue: boolean } {
    const lastChecked =
      typeof contract.lastCheckedAt === 'number'
        ? `lastCheckedAt=${contract.lastCheckedAt}`
        : 'lastCheckedAt=none';
    const nextCheckDue =
      typeof contract.nextCheckAt === 'number' && contract.nextCheckAt <= readAt;
    const nextCheck =
      typeof contract.nextCheckAt === 'number'
        ? `nextCheckAt=${contract.nextCheckAt}${nextCheckDue ? '，已到期' : '，未到期'}`
        : 'nextCheckAt=none';
    return {
      detail: `复核时间基准：${lastChecked}，${nextCheck}`,
      nextCheckDue,
    };
  }
}

function chooseRicherText(
  left?: string | null,
  right?: string | null,
): string | undefined {
  const normalizedLeft = typeof left === 'string' ? left.trim() : '';
  const normalizedRight = typeof right === 'string' ? right.trim() : '';
  if (!normalizedLeft && !normalizedRight) return undefined;
  if (!normalizedLeft) return normalizedRight;
  if (!normalizedRight) return normalizedLeft;
  return normalizedLeft.length >= normalizedRight.length
    ? normalizedLeft
    : normalizedRight;
}

function normalizeCreatedFromKind(value: string): EvidenceWatchCreatedFromKind {
  if (
    value === 'ask' ||
    value === 'reflection' ||
    value === 'action_queue' ||
    value === 'answer_memory' ||
    value === 'confirm_request' ||
    value === 'manual'
  ) {
    return value;
  }
  return 'manual';
}

function mergeAuthoritySources(
  left: EvidenceWatchAuthoritySource[],
  right: EvidenceWatchAuthoritySource[],
): EvidenceWatchAuthoritySource[] {
  const seen = new Set<string>();
  const merged: EvidenceWatchAuthoritySource[] = [];
  for (const source of [...left, ...right]) {
    const key = `${source.sourceKind}:${source.sourceId}`;
    if (!source.sourceId || seen.has(key)) continue;
    seen.add(key);
    merged.push(source);
  }
  return merged.slice(0, 12);
}

function mergeImpactTargets(
  left: EvidenceWatchImpactTarget[],
  right: EvidenceWatchImpactTarget[],
): EvidenceWatchImpactTarget[] {
  const seen = new Set<string>();
  const merged: EvidenceWatchImpactTarget[] = [];
  for (const target of [...left, ...right]) {
    const key = `${target.kind}:${target.refId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(target);
  }
  return merged.slice(0, 12);
}

function mergeStopConditions(
  left: EvidenceWatchStopCondition[],
  right: EvidenceWatchStopCondition[],
): EvidenceWatchStopCondition[] {
  const seen = new Set<string>();
  const merged: EvidenceWatchStopCondition[] = [];
  for (const condition of [...left, ...right]) {
    const key = `${condition.kind}:${condition.value ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(condition);
  }
  return merged.slice(0, 8);
}
