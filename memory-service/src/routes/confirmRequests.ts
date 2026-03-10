/**
 * Confirm request routes.
 *
 * GET  /confirm-requests          - List pending confirm requests
 * POST /confirm-requests/:id/answer - Answer a confirm request
 */

import type { FastifyInstance } from 'fastify';

import { TruthMaintainer } from '../core/TruthMaintainer.js';

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
  user_answer: string | null;
  answered_at: number | null;
  snooze_until: number | null;
  snooze_count: number;
  expires_at: number | null;
  created_at: number;
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
    options: safeJsonParse<Array<{ label: string; value: string }>>(row.options_json, []),
    evidenceRefs: safeJsonParse<string[]>(row.evidence_refs_json, []),
    category: row.category,
    relatedEntityId: row.related_entity_id,
    relatedPropertyId: row.related_property_id,
    priority: row.priority,
    state: row.state,
    userAnswer: row.user_answer,
    answeredAt: row.answered_at,
    snoozeUntil: row.snooze_until,
    snoozeCount: row.snooze_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
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
    Querystring: { state?: string; limit?: string };
  }>('/confirm-requests', async (request, reply) => {
    const { db } = request.userContext;
    const state = request.query.state ?? 'pending';
    const limit = Math.min(Math.max(parseInt(request.query.limit ?? '20', 10) || 20, 1), 100);

    const rows = db
      .prepare(
        `SELECT * FROM confirm_requests
         WHERE state = ?
         ORDER BY
           CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END ASC,
           created_at DESC
         LIMIT ?`,
      )
      .all(state, limit) as ConfirmRequestRow[];

    const total = (
      db.prepare(`SELECT COUNT(*) AS count FROM confirm_requests WHERE state = ?`).get(state) as {
        count: number;
      }
    ).count;

    return reply.status(200).send({
      items: rows.map(formatConfirmRequest),
      total,
      limit,
      state,
    });
  });

  // -----------------------------------------------------------------------
  // POST /confirm-requests/:id/answer — Answer a confirm request
  // -----------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: { answer: string; detail?: string };
  }>('/confirm-requests/:id/answer', async (request, reply) => {
    const { db } = request.userContext;
    const truthMaintainer = new TruthMaintainer(db);
    const { id } = request.params;
    const { answer, detail } = request.body;

    if (!answer) {
      return reply.status(400).send({ error: 'Missing required field: answer' });
    }

    try {
      truthMaintainer.resolveConfirmRequest(id, answer, detail);

      // Fetch the updated confirm request to return
      const updated = db
        .prepare(`SELECT * FROM confirm_requests WHERE id = ?`)
        .get(id) as ConfirmRequestRow | undefined;

      if (!updated) {
        return reply.status(404).send({ error: 'Confirm request not found' });
      }

      return reply.status(200).send({
        status: 'resolved',
        confirmRequest: formatConfirmRequest(updated),
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
}
