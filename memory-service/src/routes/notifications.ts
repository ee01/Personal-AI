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
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const notificationActionBodySchema = {
  type: 'object' as const,
  required: ['action'],
  properties: {
    action: {
      type: 'string' as const,
      enum: ['acknowledge', 'dismiss', 'snooze'],
    },
    detail: { type: 'string' as const },
  },
  additionalProperties: false,
};

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
    const notifications = repo.list({
      state: (request.query.state as 'pending' | 'clicked' | 'dismissed' | undefined) ?? 'pending',
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
          const result = repo.snooze(id);
          return reply.status(200).send({
            id,
            action: 'snooze',
            newNotificationId: result.newNotificationId,
            scheduledAt: result.scheduledAt,
          });
        }
      }
    },
  );
}
