/**
 * Notification management routes.
 *
 * GET  /notifications          - List notifications (filterable)
 * POST /notifications/:id/action - Process notification action
 * GET  /notifications/stats    - Return notification statistics
 */

import type { FastifyInstance } from 'fastify';

import { NotificationRepository } from '../repositories/NotificationRepository.js';

interface NotificationActionBody {
  action: 'acknowledge' | 'dismiss' | 'snooze';
  detail?: string;
  delaySeconds?: number;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DEFAULT_NOTIFICATION_SNOOZE_SECONDS = 24 * 3600;
const MIN_NOTIFICATION_SNOOZE_SECONDS = 5 * 60;
const MAX_NOTIFICATION_SNOOZE_SECONDS = 7 * 24 * 3600;
const VALID_NOTIFICATION_STATES = new Set([
  'pending',
  'scheduled',
  'clicked',
  'dismissed',
]);

const notificationActionBodySchema = {
  type: 'object' as const,
  required: ['action'],
  properties: {
    action: {
      type: 'string' as const,
      enum: ['acknowledge', 'dismiss', 'snooze'],
    },
    detail: { type: 'string' as const },
    delaySeconds: {
      type: 'integer' as const,
      minimum: MIN_NOTIFICATION_SNOOZE_SECONDS,
      maximum: MAX_NOTIFICATION_SNOOZE_SECONDS,
    },
  },
  additionalProperties: false,
};

function normalizeNotificationSnoozeDelaySeconds(raw?: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_NOTIFICATION_SNOOZE_SECONDS;
  }

  return Math.max(
    MIN_NOTIFICATION_SNOOZE_SECONDS,
    Math.min(Math.floor(raw), MAX_NOTIFICATION_SNOOZE_SECONDS),
  );
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function notificationRoutes(
  app: FastifyInstance,
): Promise<void> {
  // GET /notifications — List notifications with optional filters
  app.get<{
    Querystring: {
      state?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };
  }>('/notifications', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new NotificationRepository(db);
    if (
      request.query.state &&
      !VALID_NOTIFICATION_STATES.has(request.query.state)
    ) {
      return reply.status(400).send({
        error: 'invalid_notification_state',
        message: `Unsupported notification state: ${request.query.state}`,
      });
    }
    const notifications = repo.list({
      state:
        (request.query.state as
          | 'pending'
          | 'scheduled'
          | 'clicked'
          | 'dismissed'
          | undefined) ?? 'pending',
      type: request.query.type,
      limit: parseInt(request.query.limit || '20', 10),
      offset: parseInt(request.query.offset || '0', 10),
    });
    return reply.status(200).send(notifications);
  });

  // GET /notifications/stats — Return notification statistics
  // NOTE: This route MUST be registered before /notifications/:id/action
  // so that "stats" is not captured as a :id param.
  app.get('/notifications/stats', async (request, reply) => {
    const { db } = request.userContext;
    const repo = new NotificationRepository(db);
    return reply.status(200).send(repo.stats());
  });

  // POST /notifications/:id/action — Process notification action
  app.post<{ Params: { id: string }; Body: NotificationActionBody }>(
    '/notifications/:id/action',
    { schema: { body: notificationActionBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const repo = new NotificationRepository(db);
      const { id } = request.params;
      const { action, detail } = request.body;

      const existing = repo.getById(id);
      if (!existing) {
        return reply.status(404).send({ error: `Notification "${id}" not found` });
      }

      switch (action) {
        case 'acknowledge': {
          return reply.status(200).send(repo.acknowledge(id, detail));
        }
        case 'dismiss': {
          return reply.status(200).send(repo.dismiss(id, detail));
        }
        case 'snooze': {
          if (existing.clickedAt || existing.dismissedAt) {
            return reply.status(409).send({
              error: 'notification_already_handled',
              message:
                'This notification was already acknowledged, dismissed, or snoozed.',
            });
          }
          const delaySeconds = normalizeNotificationSnoozeDelaySeconds(
            request.body.delaySeconds,
          );
          const result = repo.snooze(id, delaySeconds);
          return reply.status(200).send({
            id,
            action: 'snooze',
            newNotificationId: result.newNotificationId,
            scheduledAt: result.scheduledAt,
            delaySeconds,
          });
        }
      }
    },
  );
}
