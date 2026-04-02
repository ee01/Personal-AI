import type { FastifyInstance } from 'fastify';

import { NotificationCenterService } from '../core/NotificationCenterService.js';
import type { DeliveryChannel, DeliveryLane, DeliveryStatus } from '../repositories/ChannelDeliveryRepository.js';

interface FeedQuery {
  channel: DeliveryChannel;
  lanes?: string;
  limit?: string;
}

interface DeliveryBody {
  events: Array<{
    sourceRef: string;
    channel: DeliveryChannel;
    lane: DeliveryLane;
    status: DeliveryStatus;
    externalRef?: string;
    error?: string;
  }>;
}

const deliveryBodySchema = {
  type: 'object' as const,
  required: ['events'],
  properties: {
    events: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['sourceRef', 'channel', 'lane', 'status'],
        properties: {
          sourceRef: { type: 'string' as const, minLength: 1 },
          channel: { type: 'string' as const, enum: ['chrome', 'doubao', 'glip'] },
          lane: { type: 'string' as const, enum: ['todo', 'notice'] },
          status: { type: 'string' as const, enum: ['delivered', 'failed', 'clicked', 'dismissed'] },
          externalRef: { type: 'string' as const },
          error: { type: 'string' as const },
        },
        additionalProperties: false,
      },
      maxItems: 100,
    },
  },
  additionalProperties: false,
};

export async function notificationCenterRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: FeedQuery }>('/notification-center/feed', async (request, reply) => {
    const service = new NotificationCenterService(request.userContext.db);
    const lanes = (request.query.lanes || 'todo,notice')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const feed = service.listFeed({
      channel: request.query.channel,
      lanes: lanes as DeliveryLane[],
      limit: request.query.limit ? Number(request.query.limit) : undefined,
    });
    return reply.status(200).send({
      items: feed,
      total: feed.length,
    });
  });

  app.post<{ Body: DeliveryBody }>(
    '/notification-center/delivery',
    { schema: { body: deliveryBodySchema } },
    async (request, reply) => {
      const service = new NotificationCenterService(request.userContext.db);
      const updated = service.recordDelivery(request.body.events);
      return reply.status(200).send({
        ok: true,
        updated: updated.length,
        items: updated,
      });
    },
  );
}
