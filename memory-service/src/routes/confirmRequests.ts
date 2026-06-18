/**
 * Confirm request routes.
 *
 * GET  /confirm-requests          - List pending confirm requests
 * POST /confirm-requests/:id/answer - Answer a confirm request
 */

import type { FastifyInstance } from 'fastify';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { TruthMaintainer } from '../core/TruthMaintainer.js';
import { reclassifyLegacyEvidenceResolutionConfirmRequests } from '../core/ConfirmRequestRoutingBackfill.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';

const DECISION_SNOOZE_SECONDS = 24 * 3600;
const WATCH_SNOOZE_SECONDS = 72 * 3600;

// ---------------------------------------------------------------------------
// Row interfaces
// ---------------------------------------------------------------------------

interface ConfirmRequestRow {
  id: string;
  question: string;
  context: string | null;
  options_json: string | null;
  evidence_refs_json: string | null;
  category: string | null;
  related_entity_id: string | null;
  related_property_id: number | null;
  priority: string;
  state: string;
  routing: string | null;
  reason_code: string | null;
  source_anchor: string | null;
  gap_type: string | null;
  user_answer: string | null;
  answered_at: number | null;
  snooze_until: number | null;
  snooze_count: number;
  expires_at: number | null;
  created_at: number;
  updated_at: number | null;
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatConfirmRequest(row: ConfirmRequestRow) {
  return {
    id: row.id,
    question: row.question,
    context: row.context,
    options: safeJsonParse<Array<{ label: string; value: string }>>(
      row.options_json,
      [],
    ),
    evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
    category: row.category,
    relatedEntityId: row.related_entity_id,
    relatedPropertyId: row.related_property_id,
    priority: row.priority,
    state: row.state,
    routing: row.routing,
    reasonCode: row.reason_code,
    sourceAnchor: row.source_anchor,
    gapType: row.gap_type,
    userAnswer: row.user_answer,
    answeredAt: row.answered_at,
    snoozeUntil: row.snooze_until,
    snoozeCount: row.snooze_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function confirmRequestRoutes(
  app: FastifyInstance,
): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /confirm-requests — List confirm requests
  // -----------------------------------------------------------------------
  app.get<{
    Querystring: {
      state?: string;
      limit?: string;
      queue?: 'decision' | 'watch' | 'all';
    };
  }>('/confirm-requests', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ConfirmRequestRepository(db);
    const queue = request.query.queue ?? 'decision';
    const state =
      request.query.state ?? (queue === 'watch' ? 'snoozed' : 'pending');
    const limit = Math.min(
      Math.max(parseInt(request.query.limit ?? '20', 10) || 20, 1),
      100,
    );

    const rows = db
      .prepare(
        queue === 'all'
          ? `SELECT * FROM confirm_requests
             WHERE state = ?
             ORDER BY
               CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END ASC,
               created_at DESC
             LIMIT ?`
          : `SELECT * FROM confirm_requests
             WHERE ${
               queue === 'decision'
                 ? "COALESCE(routing, 'decision') = 'decision'"
                 : 'routing = ?'
             }
               AND state = ?
             ORDER BY
               CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END ASC,
               created_at DESC
             LIMIT ?`,
      )
      .all(
        ...(queue === 'all'
          ? [state, limit]
          : queue === 'decision'
          ? [state, limit]
          : [queue, state, limit]),
      ) as ConfirmRequestRow[];

    const total =
      queue === 'all'
        ? (
            db
              .prepare(
                `SELECT COUNT(*) AS count FROM confirm_requests WHERE state = ?`,
              )
              .get(state) as {
              count: number;
            }
          ).count
        : repo.countByRoutingAndState(queue, state);

    return reply.status(200).send({
      items: rows.map(formatConfirmRequest),
      total,
      limit,
      state,
      queue,
    });
  });

  // -----------------------------------------------------------------------
  // POST /confirm-requests/:id/answer — Answer a confirm request
  // -----------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: { answer: string; detail?: string };
  }>('/confirm-requests/:id/answer', async (request, reply) => {
    const { db, userDataManager } = request.userContext;
    const truthMaintainer = new TruthMaintainer(db);
    const { id } = request.params;
    const { answer, detail } = request.body;

    if (!answer) {
      return reply
        .status(400)
        .send({ error: 'Missing required field: answer' });
    }

    const current = db
      .prepare(`SELECT * FROM confirm_requests WHERE id = ?`)
      .get(id) as ConfirmRequestRow | undefined;

    if (!current) {
      return reply.status(404).send({ error: 'Confirm request not found' });
    }

    if (current.routing === 'watch') {
      return reply.status(400).send({
        error:
          'Watch items cannot be answered. Use the state endpoint instead.',
      });
    }

    try {
      truthMaintainer.resolveConfirmRequest(id, answer, detail);
      const threadService = new ReflectionThreadService(
        db,
        userDataManager,
        request.userId,
      );
      threadService.resumeThreadsForConfirmRequest(id);

      // Fetch the updated confirm request to return
      const updated = db
        .prepare(`SELECT * FROM confirm_requests WHERE id = ?`)
        .get(id) as ConfirmRequestRow | undefined;

      if (!updated) {
        return reply.status(404).send({ error: 'Confirm request not found' });
      }

      let retriedActionId: string | undefined;
      let skippedActionId: string | undefined;
      let stoppedActionId: string | undefined;
      if (updated.category === 'openclaw_delegation') {
        const evidenceRefs = safeJsonParse<string[]>(
          updated.evidence_refs_json,
          [],
        );
        const actionRef = evidenceRefs.find((ref) => ref.startsWith('action:'));
        const actionId = actionRef?.slice('action:'.length);
        if (actionId && answer === 'retry') {
          const repo = new ActionRepository(db);
          const retried = repo.retry(actionId);
          if (retried) {
            const executor = new ActionExecutor(
              db,
              userDataManager,
              request.userId,
            );
            await executor.executeAction(actionId);
            retriedActionId = actionId;
          }
        } else if (actionId && answer === 'skip_once') {
          skippedActionId = actionId;
        } else if (actionId && answer === 'stop') {
          const repo = new ActionRepository(db);
          const stopped = repo.cancel(
            actionId,
            'Stopped by user from confirm request',
          );
          if (stopped) {
            stoppedActionId = actionId;
            if (stopped.threadId) {
              threadService.refreshThreadDocument(stopped.threadId);
            }
          }
        }
      }

      return reply.status(200).send({
        status: 'resolved',
        confirmRequest: formatConfirmRequest(updated),
        retriedActionId,
        skippedActionId,
        stoppedActionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }

      if (message.includes('already')) {
        return reply.status(409).send({ error: message });
      }

      request.log.error(err, 'Failed to resolve confirm request');
      return reply.status(500).send({ error: message });
    }
  });

  app.post<{
    Params: { id: string };
    Body: { state: 'pending' | 'snoozed' | 'expired' };
  }>('/confirm-requests/:id/state', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new ConfirmRequestRepository(db);
    const current = repo.getById(request.params.id);

    if (!current) {
      return reply.status(404).send({ error: 'Confirm request not found' });
    }
    if (
      current.state === 'answered' ||
      current.state === 'deduplicated' ||
      current.state === 'expired'
    ) {
      return reply.status(409).send({
        error: `Cannot transition confirm request from ${current.state}`,
      });
    }

    const targetState = request.body.state;
    const routing = current.routing ?? 'decision';
    const isWatchItem = routing === 'watch';
    const validTransition = isWatchItem
      ? (current.state === 'pending' &&
          (targetState === 'pending' || targetState === 'snoozed')) ||
        (current.state === 'snoozed' &&
          (targetState === 'pending' ||
            targetState === 'expired' ||
            targetState === 'snoozed'))
      : (current.state === 'pending' && targetState === 'snoozed') ||
        (current.state === 'snoozed' &&
          (targetState === 'pending' || targetState === 'expired'));

    if (!validTransition) {
      return reply.status(400).send({
        error: `Invalid transition from ${current.state} to ${targetState}`,
      });
    }

    const updated = repo.transitionState(
      request.params.id,
      current.state,
      targetState,
      {
        snoozeUntil:
          targetState === 'snoozed'
            ? Math.floor(Date.now() / 1000) +
              (isWatchItem ? WATCH_SNOOZE_SECONDS : DECISION_SNOOZE_SECONDS)
            : null,
        snoozeCount:
          targetState === 'snoozed'
            ? current.snoozeCount + 1
            : current.snoozeCount,
        expiresAt:
          targetState === 'expired'
            ? current.expiresAt ?? Math.floor(Date.now() / 1000)
            : current.expiresAt ?? null,
      },
    );

    if (!updated) {
      return reply.status(409).send({ error: 'State transition failed' });
    }

    let queuedActionId: string | undefined;
    if (isWatchItem && targetState === 'pending') {
      const actionRepo = new ActionRepository(db);
      const action = actionRepo.create({
        actionType: 'delegate_openclaw',
        title: `立即查证: ${current.question.slice(0, 60)}`,
        description: current.context ?? current.question,
        params: {
          task: [
            '请用只读方式重新核实以下观察项，并返回可验证证据。',
            `问题: ${current.question}`,
            current.context ? `上下文: ${current.context}` : undefined,
            current.reasonCode ? `缺口类型: ${current.reasonCode}` : undefined,
          ]
            .filter(Boolean)
            .join('\n'),
          mode: 'read',
          sourceAnchor: current.sourceAnchor,
          gapType: current.gapType,
          reasonCode: current.reasonCode,
        },
        executionMode: 'auto',
        requiresApproval: false,
        queueStatus: 'queued',
        priority: current.priority === 'high' ? 9 : 7,
        idempotencyKey: `confirm_request_watch:${current.id}:verify`,
        sourceKind: 'confirm_request_watch',
        sourceRefId: current.id,
        evidenceRefs: current.evidenceRefs,
      });
      queuedActionId = action.id;
    }

    return reply
      .status(200)
      .send({ status: 'updated', confirmRequest: updated, queuedActionId });
  });

  app.post<{
    Body: { dryRun?: boolean; force?: boolean; limit?: number };
  }>('/confirm-requests/reclassify-legacy', async (request, reply) => {
    const { db } = request.userContext;
    const summary = reclassifyLegacyEvidenceResolutionConfirmRequests(db, {
      dryRun: request.body?.dryRun ?? false,
      force: request.body?.force ?? false,
      limit:
        typeof request.body?.limit === 'number' &&
        Number.isFinite(request.body.limit)
          ? Math.max(1, Math.min(request.body.limit, 1000))
          : undefined,
    });

    return reply.status(200).send({
      status: summary.dryRun ? 'dry_run_complete' : 'reclassified',
      summary,
    });
  });
}
