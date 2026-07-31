import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type OpenQuestionExitState =
  | 'active'
  | 'waiting_on_existing_action'
  | 'waiting_on_confirm_request'
  | 'handoff_to_evidence_watch'
  | 'parked_until_new_evidence'
  | 'merged'
  | 'answered'
  | 'expired_low_value'
  | 'closed_user_dismissed';

export type OpenQuestionExitReasonCode =
  | 'first_seen'
  | 'new_authority_signal'
  | 'duplicate_action_pending'
  | 'confirm_pending'
  | 'evidence_watch_owns_verification'
  | 'no_new_evidence'
  | 'answered_by_current_evidence'
  | 'action_result_available'
  | 'confirm_answered';

export type OpenQuestionUserImpact =
  | 'blocking_today'
  | 'useful_later'
  | 'background_only';

export interface OpenQuestionExitReceipt {
  contractId: string;
  state: OpenQuestionExitState;
  reasonCode: OpenQuestionExitReasonCode;
  label: string;
  summary: string;
  boundary: string;
  nextStep: string;
  userImpact: OpenQuestionUserImpact;
  newEvidenceRefs: string[];
  duplicateSuppressedCount: number;
  resumedAt?: number;
}

export interface OpenQuestionExitContract {
  id: string;
  questionKey: string;
  questionText: string;
  sourceKind: string;
  sourceRefId: string;
  subjectKey: string;
  state: OpenQuestionExitState;
  reasonCode: OpenQuestionExitReasonCode;
  userImpact: OpenQuestionUserImpact;
  evaluationCount: number;
  duplicateSuppressedCount: number;
  lastEvidenceRefs: string[];
  resumeTriggers: string[];
  receipt: OpenQuestionExitReceipt;
  linkedActionId?: string;
  linkedConfirmRequestId?: string;
  linkedEvidenceWatchContractId?: string;
  lastEvaluatedAt?: number;
  lastNewEvidenceAt?: number;
  lastResumedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OpenQuestionExitRun {
  id: string;
  contractId: string;
  runKind: string;
  fromState?: OpenQuestionExitState;
  toState: OpenQuestionExitState;
  reasonCode: OpenQuestionExitReasonCode;
  evidenceRefs: string[];
  linkedActionId?: string;
  linkedConfirmRequestId?: string;
  linkedEvidenceWatchContractId?: string;
  receipt: OpenQuestionExitReceipt;
  createdAt: number;
}

export interface EvaluateOpenQuestionsInput {
  sourceKind: string;
  sourceRefId: string;
  subjectKey: string;
  questions: string[];
  evidenceRefs?: string[];
  priority?: number;
  salience?: number;
  currentTime?: number;
}

export interface OpenQuestionExitDecision {
  contract: OpenQuestionExitContract;
  receipt: OpenQuestionExitReceipt;
  active: boolean;
  actionEpoch: number;
}

export interface OpenQuestionExitEvaluation {
  decisions: OpenQuestionExitDecision[];
  activeQuestions: string[];
  primaryDecision?: OpenQuestionExitDecision;
  suppressDerivedActions: boolean;
}

interface OpenQuestionExitContractRow {
  id: string;
  question_key: string;
  question_text: string;
  source_kind: string;
  source_ref_id: string;
  subject_key: string;
  state: string;
  reason_code: string;
  user_impact: string;
  evaluation_count: number;
  duplicate_suppressed_count: number;
  last_evidence_refs_json: string;
  resume_triggers_json: string;
  receipt_json: string;
  linked_action_id: string | null;
  linked_confirm_request_id: string | null;
  linked_evidence_watch_contract_id: string | null;
  last_evaluated_at: number | null;
  last_new_evidence_at: number | null;
  last_resumed_at: number | null;
  created_at: number;
  updated_at: number;
}

interface OpenQuestionExitRunRow {
  id: string;
  contract_id: string;
  run_kind: string;
  from_state: string | null;
  to_state: string;
  reason_code: string;
  evidence_refs_json: string;
  linked_action_id: string | null;
  linked_confirm_request_id: string | null;
  linked_evidence_watch_contract_id: string | null;
  receipt_json: string;
  created_at: number;
}

interface PendingActionOwner {
  kind: 'action';
  id: string;
}

interface PendingConfirmOwner {
  kind: 'confirm_request';
  id: string;
}

interface EvidenceWatchOwner {
  kind: 'evidence_watch';
  id: string;
}

type QuestionOwner =
  | PendingActionOwner
  | PendingConfirmOwner
  | EvidenceWatchOwner;

interface EvidenceWatchSignalRow {
  id: string;
  state: string;
  updated_at: number;
}

interface OpenQuestionSourceRow {
  source_kind: string;
  source_ref_id: string;
}

const RESUME_TRIGGERS = [
  'action_result',
  'confirm_resolved',
  'evidence_watch_changed',
  'new_evidence',
];

const NON_TERMINAL_OWNER_STATES: OpenQuestionExitState[] = [
  'waiting_on_existing_action',
  'waiting_on_confirm_request',
  'handoff_to_evidence_watch',
  'parked_until_new_evidence',
];

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uniqStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  );
}

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function questionTokens(value: string): Set<string> {
  const normalized = normalizeQuestion(value);
  const tokens = new Set<string>();
  if (normalized.length <= 2) {
    if (normalized) tokens.add(normalized);
    return tokens;
  }
  for (let index = 0; index < normalized.length - 1; index += 1) {
    tokens.add(normalized.slice(index, index + 2));
  }
  return tokens;
}

function questionSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeQuestion(left);
  const normalizedRight = normalizeQuestion(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 1;
  }
  const leftTokens = questionTokens(normalizedLeft);
  const rightTokens = questionTokens(normalizedRight);
  const intersection = Array.from(leftTokens).filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function questionKey(
  sourceKind: string,
  sourceRefId: string,
  question: string,
): string {
  return createHash('sha256')
    .update(`${sourceKind}:${sourceRefId}:${normalizeQuestion(question)}`)
    .digest('hex');
}

export class OpenQuestionExitContractService {
  constructor(private readonly db: Database.Database) {}

  evaluate(input: EvaluateOpenQuestionsInput): OpenQuestionExitEvaluation {
    const currentTime = input.currentTime ?? now();
    const questions = uniqStrings(input.questions).slice(0, 12);
    const existing = this.listBySource(input.sourceKind, input.sourceRefId);
    const usedContractIds = new Set<string>();
    const watchSignal = this.findEvidenceWatchSignal(input.sourceRefId);
    const evidenceRefs = uniqStrings([
      ...(input.evidenceRefs ?? []),
      ...(watchSignal?.state === 'authority_changed'
        ? [`evidence_watch:${watchSignal.id}:${watchSignal.updated_at}`]
        : []),
    ]);
    const owner = this.findOwner(input.sourceRefId, watchSignal);

    const decisions = this.db.transaction(() => {
      const evaluated = questions.map((question) => {
        const matched = this.matchExistingContract(
          existing,
          usedContractIds,
          question,
          input,
        );
        if (matched) usedContractIds.add(matched.id);
        const decision = this.evaluateQuestion({
          input,
          question,
          existing: matched,
          owner,
          evidenceRefs,
          currentTime,
        });
        usedContractIds.add(decision.contract.id);
        return decision;
      });

      for (const contract of existing) {
        if (usedContractIds.has(contract.id) || contract.state !== 'active') {
          continue;
        }
        this.parkMissingQuestion(contract, currentTime);
      }
      return evaluated;
    })();

    const primaryDecision =
      decisions.find((decision) => decision.active) ?? decisions[0];
    return {
      decisions,
      activeQuestions: decisions
        .filter((decision) => decision.active)
        .map((decision) => decision.contract.questionText),
      primaryDecision,
      suppressDerivedActions:
        decisions.length > 0 && decisions.every((decision) => !decision.active),
    };
  }

  getById(id: string): OpenQuestionExitContract | null {
    const row = this.db
      .prepare('SELECT * FROM open_question_exit_contracts WHERE id = ?')
      .get(id) as OpenQuestionExitContractRow | undefined;
    return row ? this.rowToContract(row) : null;
  }

  listBySource(sourceKind: string, sourceRefId: string): OpenQuestionExitContract[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM open_question_exit_contracts
         WHERE source_kind = ? AND source_ref_id = ?
         ORDER BY updated_at DESC, created_at DESC`,
      )
      .all(sourceKind, sourceRefId) as OpenQuestionExitContractRow[];
    return rows.map((row) => this.rowToContract(row));
  }

  listRuns(contractId: string, limit = 50): OpenQuestionExitRun[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM open_question_exit_runs
         WHERE contract_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(contractId, Math.max(1, Math.min(limit, 200))) as OpenQuestionExitRunRow[];
    return rows.map((row) => this.rowToRun(row));
  }

  getActiveQuestionsForSource(sourceKind: string, sourceRefId: string): string[] {
    return this.listBySource(sourceKind, sourceRefId)
      .filter((contract) => contract.state === 'active')
      .map((contract) => contract.questionText);
  }

  linkActionOwner(contractId: string, actionId: string): OpenQuestionExitContract | null {
    const contract = this.getById(contractId);
    if (!contract) return null;
    const currentTime = now();
    const state = contract.linkedEvidenceWatchContractId
      ? 'handoff_to_evidence_watch'
      : 'waiting_on_existing_action';
    const reasonCode = contract.linkedEvidenceWatchContractId
      ? 'evidence_watch_owns_verification'
      : 'duplicate_action_pending';
    return this.transitionOwner({
      contract,
      state,
      reasonCode,
      actionId,
      evidenceWatchContractId: contract.linkedEvidenceWatchContractId,
      currentTime,
    });
  }

  linkEvidenceWatchOwner(
    contractId: string,
    evidenceWatchContractId: string,
    actionId?: string,
  ): OpenQuestionExitContract | null {
    const contract = this.getById(contractId);
    if (!contract) return null;
    return this.transitionOwner({
      contract,
      state: 'handoff_to_evidence_watch',
      reasonCode: 'evidence_watch_owns_verification',
      actionId: actionId ?? contract.linkedActionId,
      evidenceWatchContractId,
      currentTime: now(),
    });
  }

  resumeForSource(input: {
    sourceKind: string;
    sourceRefId: string;
    reasonCode: 'action_result_available' | 'confirm_answered' | 'new_authority_signal';
    evidenceRefs?: string[];
    confirmRequestId?: string;
    currentTime?: number;
  }): OpenQuestionExitContract[] {
    const currentTime = input.currentTime ?? now();
    const evidenceRefs = uniqStrings(input.evidenceRefs ?? []);
    const contracts = this.listBySource(input.sourceKind, input.sourceRefId).filter(
      (contract) => NON_TERMINAL_OWNER_STATES.includes(contract.state),
    );

    return this.db.transaction(() =>
      contracts.map((contract) => {
        const reasonCode: OpenQuestionExitReasonCode = 'new_authority_signal';
        const receipt = this.buildReceipt({
          contractId: contract.id,
          state: 'active',
          reasonCode,
          userImpact: contract.userImpact,
          newEvidenceRefs: evidenceRefs,
          duplicateSuppressedCount: contract.duplicateSuppressedCount,
          resumedAt: currentTime,
          resumeSource: input.reasonCode,
        });
        this.db
          .prepare(
            `UPDATE open_question_exit_contracts
             SET state = 'active', reason_code = ?, receipt_json = ?,
                 linked_confirm_request_id = COALESCE(?, linked_confirm_request_id),
                 last_evaluated_at = NULL, last_new_evidence_at = ?,
                 last_resumed_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            reasonCode,
            JSON.stringify(receipt),
            input.confirmRequestId ?? null,
            currentTime,
            currentTime,
            currentTime,
            contract.id,
          );
        this.insertRun({
          contractId: contract.id,
          runKind: 'resumed',
          fromState: contract.state,
          toState: 'active',
          reasonCode,
          evidenceRefs,
          linkedActionId: contract.linkedActionId,
          linkedConfirmRequestId:
            input.confirmRequestId ?? contract.linkedConfirmRequestId,
          linkedEvidenceWatchContractId:
            contract.linkedEvidenceWatchContractId,
          receipt,
          createdAt: currentTime,
        });
        return this.getById(contract.id)!;
      }),
    )();
  }

  resumeForEvidenceWatch(
    evidenceWatchContractId: string,
    currentTime = now(),
  ): OpenQuestionExitContract[] {
    const sources = this.db
      .prepare(
        `SELECT DISTINCT source_kind, source_ref_id
         FROM open_question_exit_contracts
         WHERE linked_evidence_watch_contract_id = ?
           AND state IN (
             'waiting_on_existing_action',
             'waiting_on_confirm_request',
             'handoff_to_evidence_watch',
             'parked_until_new_evidence'
           )`,
      )
      .all(evidenceWatchContractId) as OpenQuestionSourceRow[];
    const evidenceRef = `evidence_watch:${evidenceWatchContractId}:${currentTime}`;
    const resumed = sources.flatMap((source) =>
      this.resumeForSource({
        sourceKind: source.source_kind,
        sourceRefId: source.source_ref_id,
        reasonCode: 'new_authority_signal',
        evidenceRefs: [evidenceRef],
        currentTime,
      }),
    );

    for (const source of sources) {
      if (source.source_kind !== 'reflection_thread') continue;
      this.db
        .prepare(
          `UPDATE reflection_threads
           SET next_reflection_at = ?,
               continue_reason = 'evidence watch authority changed',
               updated_at = ?
           WHERE id = ? AND status = 'active'`,
        )
        .run(currentTime, currentTime, source.source_ref_id);
    }

    return resumed;
  }

  private evaluateQuestion(input: {
    input: EvaluateOpenQuestionsInput;
    question: string;
    existing?: OpenQuestionExitContract;
    owner?: QuestionOwner;
    evidenceRefs: string[];
    currentTime: number;
  }): OpenQuestionExitDecision {
    const existing = input.existing;
    const priorEvidence = new Set(existing?.lastEvidenceRefs ?? []);
    const newEvidenceRefs = existing
      ? input.evidenceRefs.filter((ref) => !priorEvidence.has(ref))
      : [];
    const externallyResumed = Boolean(
      existing?.lastResumedAt &&
        existing.lastResumedAt > (existing.lastEvaluatedAt ?? 0),
    );
    const evaluationCount = (existing?.evaluationCount ?? 0) + 1;
    let state: OpenQuestionExitState;
    let reasonCode: OpenQuestionExitReasonCode;

    if (input.owner?.kind === 'evidence_watch') {
      state = 'handoff_to_evidence_watch';
      reasonCode = 'evidence_watch_owns_verification';
    } else if (input.owner?.kind === 'confirm_request') {
      state = 'waiting_on_confirm_request';
      reasonCode = 'confirm_pending';
    } else if (input.owner?.kind === 'action') {
      state = 'waiting_on_existing_action';
      reasonCode = 'duplicate_action_pending';
    } else if (!existing) {
      state = 'active';
      reasonCode = 'first_seen';
    } else if (newEvidenceRefs.length > 0 || externallyResumed) {
      state = 'active';
      reasonCode = 'new_authority_signal';
    } else {
      state = 'parked_until_new_evidence';
      reasonCode = 'no_new_evidence';
    }

    const active = state === 'active';
    const duplicateSuppressedCount =
      (existing?.duplicateSuppressedCount ?? 0) + (active ? 0 : 1);
    const userImpact = this.resolveUserImpact(
      input.input.priority,
      input.input.salience,
      input.question,
      existing?.userImpact,
    );
    const contractId = existing?.id ?? randomUUID();
    const resumedAt =
      reasonCode === 'new_authority_signal'
        ? input.currentTime
        : existing?.lastResumedAt;
    const receipt = this.buildReceipt({
      contractId,
      state,
      reasonCode,
      userImpact,
      newEvidenceRefs,
      duplicateSuppressedCount,
      resumedAt,
    });
    const lastEvidenceRefs = uniqStrings([
      ...(existing?.lastEvidenceRefs ?? []),
      ...input.evidenceRefs,
    ]).slice(-120);
    const key = existing?.questionKey ??
      questionKey(input.input.sourceKind, input.input.sourceRefId, input.question);

    if (existing) {
      this.db
        .prepare(
          `UPDATE open_question_exit_contracts
           SET question_text = ?, subject_key = ?, state = ?, reason_code = ?,
               user_impact = ?, evaluation_count = ?,
               duplicate_suppressed_count = ?, last_evidence_refs_json = ?,
               receipt_json = ?, linked_action_id = ?,
               linked_confirm_request_id = ?,
               linked_evidence_watch_contract_id = ?, last_evaluated_at = ?,
               last_new_evidence_at = ?, last_resumed_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          input.question,
          input.input.subjectKey,
          state,
          reasonCode,
          userImpact,
          evaluationCount,
          duplicateSuppressedCount,
          JSON.stringify(lastEvidenceRefs),
          JSON.stringify(receipt),
          input.owner?.kind === 'action'
            ? input.owner.id
            : existing.linkedActionId ?? null,
          input.owner?.kind === 'confirm_request'
            ? input.owner.id
            : existing.linkedConfirmRequestId ?? null,
          input.owner?.kind === 'evidence_watch'
            ? input.owner.id
            : existing.linkedEvidenceWatchContractId ?? null,
          input.currentTime,
          newEvidenceRefs.length > 0
            ? input.currentTime
            : existing.lastNewEvidenceAt ?? null,
          resumedAt ?? null,
          input.currentTime,
          existing.id,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO open_question_exit_contracts
            (id, question_key, question_text, source_kind, source_ref_id,
             subject_key, state, reason_code, user_impact, evaluation_count,
             duplicate_suppressed_count, last_evidence_refs_json,
             resume_triggers_json, receipt_json, linked_action_id,
             linked_confirm_request_id, linked_evidence_watch_contract_id,
             last_evaluated_at, last_new_evidence_at, last_resumed_at,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          contractId,
          key,
          input.question,
          input.input.sourceKind,
          input.input.sourceRefId,
          input.input.subjectKey,
          state,
          reasonCode,
          userImpact,
          evaluationCount,
          duplicateSuppressedCount,
          JSON.stringify(lastEvidenceRefs),
          JSON.stringify(RESUME_TRIGGERS),
          JSON.stringify(receipt),
          input.owner?.kind === 'action' ? input.owner.id : null,
          input.owner?.kind === 'confirm_request' ? input.owner.id : null,
          input.owner?.kind === 'evidence_watch' ? input.owner.id : null,
          input.currentTime,
          input.evidenceRefs.length > 0 ? input.currentTime : null,
          resumedAt ?? null,
          input.currentTime,
          input.currentTime,
        );
    }

    this.insertRun({
      contractId,
      runKind: active
        ? reasonCode === 'new_authority_signal'
          ? 'resumed'
          : 'evaluated'
        : 'suppressed',
      fromState: existing?.state,
      toState: state,
      reasonCode,
      evidenceRefs: newEvidenceRefs,
      linkedActionId:
        input.owner?.kind === 'action'
          ? input.owner.id
          : existing?.linkedActionId,
      linkedConfirmRequestId:
        input.owner?.kind === 'confirm_request'
          ? input.owner.id
          : existing?.linkedConfirmRequestId,
      linkedEvidenceWatchContractId:
        input.owner?.kind === 'evidence_watch'
          ? input.owner.id
          : existing?.linkedEvidenceWatchContractId,
      receipt,
      createdAt: input.currentTime,
    });

    const contract = this.getById(contractId)!;
    return {
      contract,
      receipt: contract.receipt,
      active,
      actionEpoch: evaluationCount,
    };
  }

  private transitionOwner(input: {
    contract: OpenQuestionExitContract;
    state: OpenQuestionExitState;
    reasonCode: OpenQuestionExitReasonCode;
    actionId?: string;
    evidenceWatchContractId?: string;
    currentTime: number;
  }): OpenQuestionExitContract {
    const receipt = this.buildReceipt({
      contractId: input.contract.id,
      state: input.state,
      reasonCode: input.reasonCode,
      userImpact: input.contract.userImpact,
      newEvidenceRefs: [],
      duplicateSuppressedCount: input.contract.duplicateSuppressedCount,
      resumedAt: input.contract.lastResumedAt,
    });
    this.db
      .prepare(
        `UPDATE open_question_exit_contracts
         SET state = ?, reason_code = ?, receipt_json = ?,
             linked_action_id = COALESCE(?, linked_action_id),
             linked_evidence_watch_contract_id = COALESCE(?, linked_evidence_watch_contract_id),
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.state,
        input.reasonCode,
        JSON.stringify(receipt),
        input.actionId ?? null,
        input.evidenceWatchContractId ?? null,
        input.currentTime,
        input.contract.id,
      );
    this.insertRun({
      contractId: input.contract.id,
      runKind: 'owner_linked',
      fromState: input.contract.state,
      toState: input.state,
      reasonCode: input.reasonCode,
      evidenceRefs: [],
      linkedActionId: input.actionId ?? input.contract.linkedActionId,
      linkedConfirmRequestId: input.contract.linkedConfirmRequestId,
      linkedEvidenceWatchContractId:
        input.evidenceWatchContractId ??
        input.contract.linkedEvidenceWatchContractId,
      receipt,
      createdAt: input.currentTime,
    });
    return this.getById(input.contract.id)!;
  }

  private parkMissingQuestion(
    contract: OpenQuestionExitContract,
    currentTime: number,
  ): void {
    const reasonCode: OpenQuestionExitReasonCode = 'no_new_evidence';
    const duplicateSuppressedCount = contract.duplicateSuppressedCount + 1;
    const receipt = this.buildReceipt({
      contractId: contract.id,
      state: 'parked_until_new_evidence',
      reasonCode,
      userImpact: contract.userImpact,
      newEvidenceRefs: [],
      duplicateSuppressedCount,
      resumedAt: contract.lastResumedAt,
    });
    this.db
      .prepare(
        `UPDATE open_question_exit_contracts
         SET state = 'parked_until_new_evidence', reason_code = ?,
             duplicate_suppressed_count = ?, receipt_json = ?,
             last_evaluated_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        reasonCode,
        duplicateSuppressedCount,
        JSON.stringify(receipt),
        currentTime,
        currentTime,
        contract.id,
      );
    this.insertRun({
      contractId: contract.id,
      runKind: 'parked',
      fromState: contract.state,
      toState: 'parked_until_new_evidence',
      reasonCode,
      evidenceRefs: [],
      linkedActionId: contract.linkedActionId,
      linkedConfirmRequestId: contract.linkedConfirmRequestId,
      linkedEvidenceWatchContractId:
        contract.linkedEvidenceWatchContractId,
      receipt,
      createdAt: currentTime,
    });
  }

  private matchExistingContract(
    contracts: OpenQuestionExitContract[],
    usedContractIds: Set<string>,
    question: string,
    input: EvaluateOpenQuestionsInput,
  ): OpenQuestionExitContract | undefined {
    const exactKey = questionKey(input.sourceKind, input.sourceRefId, question);
    const exact = contracts.find(
      (contract) =>
        !usedContractIds.has(contract.id) && contract.questionKey === exactKey,
    );
    if (exact) return exact;

    return contracts
      .filter((contract) => !usedContractIds.has(contract.id))
      .map((contract) => ({
        contract,
        similarity: questionSimilarity(contract.questionText, question),
      }))
      .filter((candidate) => candidate.similarity >= 0.62)
      .sort((left, right) => right.similarity - left.similarity)[0]?.contract;
  }

  private findOwner(
    threadId: string,
    watchSignal?: EvidenceWatchSignalRow,
  ): QuestionOwner | undefined {
    if (
      watchSignal &&
      ['active', 'quiet_no_change', 'due', 'source_blocked'].includes(
        watchSignal.state,
      )
    ) {
      return { kind: 'evidence_watch', id: watchSignal.id };
    }

    const directConfirm = this.db
      .prepare(
        `SELECT cr.id
         FROM reflection_threads t
         JOIN confirm_requests cr ON cr.id = t.source_ref_id
         WHERE t.id = ?
           AND t.source_type = 'confirm_request'
           AND cr.state = 'pending'
           AND COALESCE(cr.routing, 'decision') = 'decision'
         LIMIT 1`,
      )
      .get(threadId) as { id: string } | undefined;
    if (directConfirm) return { kind: 'confirm_request', id: directConfirm.id };

    const linkedConfirm = this.db
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
         ORDER BY cr.created_at DESC
         LIMIT 1`,
      )
      .get(threadId) as { id: string } | undefined;
    if (linkedConfirm) return { kind: 'confirm_request', id: linkedConfirm.id };

    const pendingAction = this.db
      .prepare(
        `SELECT id
         FROM proposed_actions
         WHERE thread_id = ?
           AND queue_status IN ('queued', 'running')
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(threadId) as { id: string } | undefined;
    return pendingAction ? { kind: 'action', id: pendingAction.id } : undefined;
  }

  private findEvidenceWatchSignal(
    threadId: string,
  ): EvidenceWatchSignalRow | undefined {
    return this.db
      .prepare(
        `SELECT id, state, updated_at
         FROM evidence_watch_contracts
         WHERE created_from_kind = 'reflection'
           AND created_from_ref_id = ?
           AND state NOT IN ('archived', 'paused')
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(threadId) as EvidenceWatchSignalRow | undefined;
  }

  private resolveUserImpact(
    priority: number | undefined,
    salience: number | undefined,
    question: string,
    existing?: OpenQuestionUserImpact,
  ): OpenQuestionUserImpact {
    const urgentText =
      /今天|今日|马上|阻塞|截止|发布|上线|会议|回复|owner|deadline|today|urgent|release|meeting/i.test(
        question,
      );
    if ((priority ?? 5) >= 8 && ((salience ?? 0.5) >= 0.68 || urgentText)) {
      return 'blocking_today';
    }
    if ((priority ?? 5) >= 6 || (salience ?? 0.5) >= 0.55) {
      return 'useful_later';
    }
    return existing ?? 'background_only';
  }

  private buildReceipt(input: {
    contractId: string;
    state: OpenQuestionExitState;
    reasonCode: OpenQuestionExitReasonCode;
    userImpact: OpenQuestionUserImpact;
    newEvidenceRefs: string[];
    duplicateSuppressedCount: number;
    resumedAt?: number;
    resumeSource?: OpenQuestionExitReasonCode;
  }): OpenQuestionExitReceipt {
    const base = {
      contractId: input.contractId,
      state: input.state,
      reasonCode: input.reasonCode,
      userImpact: input.userImpact,
      newEvidenceRefs: input.newEvidenceRefs,
      duplicateSuppressedCount: input.duplicateSuppressedCount,
      ...(input.resumedAt ? { resumedAt: input.resumedAt } : {}),
    };
    if (input.state === 'active' && input.reasonCode === 'first_seen') {
      return {
        ...base,
        label: '问题已登记',
        summary: '问题首次出现，本轮允许继续处理。',
        boundary: '首次登记不会主动进入 Today Pilot。',
        nextStep: '继续当前反思；若创建动作，后续由该动作接管。',
      };
    }
    if (input.state === 'active') {
      const sourceLabel =
        input.resumeSource === 'action_result_available'
          ? '动作结果'
          : input.resumeSource === 'confirm_answered'
            ? '确认回复'
            : '新证据';
      return {
        ...base,
        label: '新证据已恢复',
        summary: `${sourceLabel}让这个问题重新具备处理价值。`,
        boundary: '只恢复一轮；若没有继续变化或已有 owner，会再次退出。',
        nextStep: '复核新增证据，并决定是否需要今天采取下一步。',
      };
    }
    if (input.state === 'waiting_on_existing_action') {
      return {
        ...base,
        label: '已有动作处理中',
        summary: '现有动作已经负责这个问题，本轮不再创建重复动作。',
        boundary: '等待动作结果，不把排队状态冒充为答案。',
        nextStep: '动作返回新结果后自动恢复。',
      };
    }
    if (input.state === 'waiting_on_confirm_request') {
      return {
        ...base,
        label: '等待已有确认',
        summary: '已有确认请求正在等待答复，本轮不重复追问。',
        boundary: '未得到答复前不推导新的确定结论。',
        nextStep: '收到确认答复后自动恢复。',
      };
    }
    if (input.state === 'handoff_to_evidence_watch') {
      return {
        ...base,
        label: '已交给证据守望',
        summary: '证据守望已负责后续复核，本轮不重复创建查证动作。',
        boundary: '守望存在不代表权威来源已确认无变化。',
        nextStep: '权威来源变化后自动恢复。',
      };
    }
    if (input.state === 'answered') {
      return {
        ...base,
        label: '当前证据已回答',
        summary: '本轮不再提出这个问题，已从活跃问题中退出。',
        boundary: '历史问题和证据保留，可供审计。',
        nextStep: '无需操作；后续反思出现新证据时再恢复。',
      };
    }
    return {
      ...base,
      label: '等待新证据',
      summary: '没有发现未见证据，本轮已停放并抑制重复动作。',
      boundary: '停放不是删除，历史证据和退出原因仍然保留。',
      nextStep: '出现动作结果、确认回复或权威来源变化时自动恢复。',
    };
  }

  private insertRun(input: {
    contractId: string;
    runKind: string;
    fromState?: OpenQuestionExitState;
    toState: OpenQuestionExitState;
    reasonCode: OpenQuestionExitReasonCode;
    evidenceRefs: string[];
    linkedActionId?: string;
    linkedConfirmRequestId?: string;
    linkedEvidenceWatchContractId?: string;
    receipt: OpenQuestionExitReceipt;
    createdAt: number;
  }): void {
    this.db
      .prepare(
        `INSERT INTO open_question_exit_runs
          (id, contract_id, run_kind, from_state, to_state, reason_code,
           evidence_refs_json, linked_action_id, linked_confirm_request_id,
           linked_evidence_watch_contract_id, receipt_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.contractId,
        input.runKind,
        input.fromState ?? null,
        input.toState,
        input.reasonCode,
        JSON.stringify(input.evidenceRefs),
        input.linkedActionId ?? null,
        input.linkedConfirmRequestId ?? null,
        input.linkedEvidenceWatchContractId ?? null,
        JSON.stringify(input.receipt),
        input.createdAt,
      );
  }

  private rowToContract(
    row: OpenQuestionExitContractRow,
  ): OpenQuestionExitContract {
    return {
      id: row.id,
      questionKey: row.question_key,
      questionText: row.question_text,
      sourceKind: row.source_kind,
      sourceRefId: row.source_ref_id,
      subjectKey: row.subject_key,
      state: row.state as OpenQuestionExitState,
      reasonCode: row.reason_code as OpenQuestionExitReasonCode,
      userImpact: row.user_impact as OpenQuestionUserImpact,
      evaluationCount: row.evaluation_count,
      duplicateSuppressedCount: row.duplicate_suppressed_count,
      lastEvidenceRefs: safeJsonParse<string[]>(
        row.last_evidence_refs_json,
        [],
      ),
      resumeTriggers: safeJsonParse<string[]>(row.resume_triggers_json, []),
      receipt: safeJsonParse<OpenQuestionExitReceipt>(row.receipt_json, {
        contractId: row.id,
        state: row.state as OpenQuestionExitState,
        reasonCode: row.reason_code as OpenQuestionExitReasonCode,
        label: '退出合约',
        summary: '当前问题已有生命周期记录。',
        boundary: '历史证据仍然保留。',
        nextStep: '等待新的可处理信号。',
        userImpact: row.user_impact as OpenQuestionUserImpact,
        newEvidenceRefs: [],
        duplicateSuppressedCount: row.duplicate_suppressed_count,
      }),
      linkedActionId: row.linked_action_id ?? undefined,
      linkedConfirmRequestId: row.linked_confirm_request_id ?? undefined,
      linkedEvidenceWatchContractId:
        row.linked_evidence_watch_contract_id ?? undefined,
      lastEvaluatedAt: row.last_evaluated_at ?? undefined,
      lastNewEvidenceAt: row.last_new_evidence_at ?? undefined,
      lastResumedAt: row.last_resumed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToRun(row: OpenQuestionExitRunRow): OpenQuestionExitRun {
    return {
      id: row.id,
      contractId: row.contract_id,
      runKind: row.run_kind,
      fromState: (row.from_state as OpenQuestionExitState | null) ?? undefined,
      toState: row.to_state as OpenQuestionExitState,
      reasonCode: row.reason_code as OpenQuestionExitReasonCode,
      evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
      linkedActionId: row.linked_action_id ?? undefined,
      linkedConfirmRequestId: row.linked_confirm_request_id ?? undefined,
      linkedEvidenceWatchContractId:
        row.linked_evidence_watch_contract_id ?? undefined,
      receipt: safeJsonParse<OpenQuestionExitReceipt>(row.receipt_json, {
        contractId: row.contract_id,
        state: row.to_state as OpenQuestionExitState,
        reasonCode: row.reason_code as OpenQuestionExitReasonCode,
        label: '退出合约记录',
        summary: '问题生命周期发生变化。',
        boundary: '历史记录只读保留。',
        nextStep: '查看当前合约状态。',
        userImpact: 'background_only',
        newEvidenceRefs: [],
        duplicateSuppressedCount: 0,
      }),
      createdAt: row.created_at,
    };
  }
}
