import type { FastifyInstance } from 'fastify';

import { NotificationCenterService } from '../core/NotificationCenterService.js';
import type {
  DeliveryChannel,
  DeliveryLane,
  DeliveryStatus,
} from '../repositories/ChannelDeliveryRepository.js';

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
          channel: {
            type: 'string' as const,
            enum: ['chrome', 'doubao', 'glip'],
          },
          lane: { type: 'string' as const, enum: ['todo', 'notice'] },
          status: {
            type: 'string' as const,
            enum: ['delivered', 'failed', 'clicked', 'dismissed'],
          },
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

const feedQuerySchema = {
  type: 'object' as const,
  required: ['channel'],
  properties: {
    channel: { type: 'string' as const, enum: ['chrome', 'doubao', 'glip'] },
    lanes: { type: 'string' as const },
    limit: { type: 'string' as const, pattern: '^\\d+$' },
  },
  additionalProperties: false,
};

const VALID_LANES = new Set<DeliveryLane>(['todo', 'notice']);

function parseFeedLanes(raw: string | undefined): {
  lanes?: DeliveryLane[];
  error?: string;
} {
  const values = (raw || 'todo,notice')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return { lanes: ['todo', 'notice'] };
  }

  const invalid = values.filter(
    (value) => !VALID_LANES.has(value as DeliveryLane),
  );
  if (invalid.length > 0) {
    return { error: `Unsupported notification lanes: ${invalid.join(', ')}` };
  }

  return { lanes: Array.from(new Set(values)) as DeliveryLane[] };
}

export async function notificationCenterRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: FeedQuery }>(
    '/notification-center/feed',
    { schema: { querystring: feedQuerySchema } },
    async (request, reply) => {
      const service = new NotificationCenterService(request.userContext.db);
      const parsedLanes = parseFeedLanes(request.query.lanes);
      if (parsedLanes.error || !parsedLanes.lanes) {
        return reply.status(400).send({
          error: 'invalid_lanes',
          message: parsedLanes.error,
        });
      }
      const feed = service.listFeed({
        channel: request.query.channel,
        lanes: parsedLanes.lanes,
        limit: request.query.limit ? Number(request.query.limit) : undefined,
      });
      return reply.status(200).send({
        items: feed,
        total: feed.length,
      });
    },
  );

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
