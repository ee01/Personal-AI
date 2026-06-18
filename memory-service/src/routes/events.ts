/**
 * Server-Sent Events (SSE) route for real-time push notifications.
 *
 * GET /events - opens an SSE stream that pushes events to the client
 * in real-time via an EventBus singleton.
 *
 * Supported event types:
 *   - notification           — new notification to show
 *   - confirm_request        — new confirm request
 *   - ingestion_complete     — message ingested
 *   - heartbeat_complete     — heartbeat cycle done
 *   - consolidation_complete — daily consolidation done
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  USER_ID_FORMAT_DESCRIPTION,
  normalizeUserId,
} from '../utils/userIdentity.js';

// ---------------------------------------------------------------------------
// EventBus singleton
// ---------------------------------------------------------------------------

export type EventType =
  | 'notification'
  | 'confirm_request'
  | 'ingestion_complete'
  | 'heartbeat_complete'
  | 'consolidation_complete';

type EventListener = (event: string, data: unknown) => void;

/**
 * Simple in-process pub/sub bus.
 *
 * Any component can import `getEventBus()` and call `.emit()` to
 * broadcast an event to all connected SSE clients.
 */
export class EventBus {
  private listeners: Set<EventListener> = new Set();

  /**
   * Broadcast an event to every connected listener.
   */
  emit(event: EventType | string, data: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch {
        // Swallow write errors from closed connections; the 'close'
        // handler will clean up the listener.
      }
    }
  }

  /**
   * Register a listener.  Returns an unsubscribe function.
   */
  subscribe(callback: EventListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Number of currently connected listeners (useful for stats/debug).
   */
  get listenerCount(): number {
    return this.listeners.size;
  }
}

let _bus: EventBus | null = null;

/**
 * Get (or lazily create) the global EventBus singleton.
 */
export function getEventBus(): EventBus {
  if (!_bus) {
    _bus = new EventBus();
  }
  return _bus;
}

// ---------------------------------------------------------------------------
// Fastify route plugin
// ---------------------------------------------------------------------------

/** Keep-alive interval in milliseconds (30 seconds). */
const KEEPALIVE_INTERVAL_MS = 30_000;

export interface EventStreamUserResolution {
  userId?: string;
  identitySource?: 'query' | 'header' | 'default_fallback';
  fallbackToDefault?: boolean;
  storageKey?: string;
  eventFilter?: 'matching_user_or_global';
  error?: string;
}

function buildEventStreamUserResolution(
  userId: string,
  identitySource: NonNullable<EventStreamUserResolution['identitySource']>,
  fallbackToDefault: boolean,
): EventStreamUserResolution {
  return {
    userId,
    identitySource,
    fallbackToDefault,
    storageKey: `data/users/${userId}/memory.db`,
    eventFilter: 'matching_user_or_global',
  };
}

export function resolveEventStreamUserId(options: {
  requestUserId?: string;
  requestFallbackToDefault?: boolean;
  queryUserId?: string | string[];
}): EventStreamUserResolution {
  const queryUserId = options.queryUserId;

  if (queryUserId != null) {
    if (Array.isArray(queryUserId)) {
      return {
        error:
          'Invalid userId query parameter format. Provide exactly one userId.',
      };
    }

    const normalized = normalizeUserId(queryUserId);
    if (!normalized) {
      return {
        error:
          `Invalid userId query parameter format. ${USER_ID_FORMAT_DESCRIPTION}`,
      };
    }

    return buildEventStreamUserResolution(normalized, 'query', false);
  }

  const normalizedRequestUserId = normalizeUserId(
    options.requestUserId ?? 'default',
  );
  if (!normalizedRequestUserId) {
    return {
      error:
        `Invalid request userId format. ${USER_ID_FORMAT_DESCRIPTION}`,
    };
  }

  const fallbackToDefault = Boolean(options.requestFallbackToDefault);
  return buildEventStreamUserResolution(
    normalizedRequestUserId,
    fallbackToDefault ? 'default_fallback' : 'header',
    fallbackToDefault,
  );
}

export function buildEventStreamConnectionReceipt(
  resolution: EventStreamUserResolution,
  timestamp = Date.now(),
): {
  message: string;
  timestamp: number;
  userId: string;
  user: {
    id: string;
    isolation: 'per_user_event_stream';
    identitySource: 'query' | 'header' | 'default_fallback';
    fallbackToDefault: boolean;
    storageKey: string;
    eventFilter: 'matching_user_or_global';
  };
} {
  const userId = resolution.userId ?? 'default';
  return {
    message: 'SSE stream connected',
    timestamp,
    userId,
    user: {
      id: userId,
      isolation: 'per_user_event_stream',
      identitySource: resolution.identitySource ?? 'default_fallback',
      fallbackToDefault: Boolean(resolution.fallbackToDefault),
      storageKey: resolution.storageKey ?? `data/users/${userId}/memory.db`,
      eventFilter: resolution.eventFilter ?? 'matching_user_or_global',
    },
  };
}

export async function eventsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/events',
    {
      schema: {
        description: 'Server-Sent Events stream for real-time push notifications',
        response: {
          200: {
            type: 'string',
            description: 'SSE text/event-stream',
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { userId?: string } }>, reply: FastifyReply) => {
      // For SSE/EventSource compatibility: browsers cannot send custom headers,
      // so userId can alternatively be passed as a query parameter.
      const rawHeaderUserId = request.headers['x-user-id'];
      const headerMissingOrBlank =
        rawHeaderUserId == null ||
        (typeof rawHeaderUserId === 'string' &&
          rawHeaderUserId.trim() === '');
      const resolvedUserId = resolveEventStreamUserId({
        requestUserId: request.userId,
        requestFallbackToDefault:
          request.userId === 'default' && headerMissingOrBlank,
        queryUserId: request.query.userId,
      });

      if (resolvedUserId.error) {
        return reply.code(400).send({ error: resolvedUserId.error });
      }

      const sseUserId = resolvedUserId.userId ?? 'default';

      // --- SSE headers ---
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx buffering if proxied
      });

      // Flush the headers immediately
      reply.raw.flushHeaders();

      // --- Subscribe to the EventBus ---
      const bus = getEventBus();

      const unsubscribe = bus.subscribe((event: string, data: unknown) => {
        // Filter events by userId: only forward events that belong to this
        // user or global events (those without a userId field).
        if (sseUserId && data != null && typeof data === 'object' && 'userId' in data) {
          const eventUserId = (data as Record<string, unknown>).userId;
          if (eventUserId && eventUserId !== sseUserId) {
            return; // Skip events belonging to other users
          }
        }
        const payload = JSON.stringify(data);
        reply.raw.write(`event: ${event}\ndata: ${payload}\n\n`);
      });

      // --- Keep-alive comment every 30 seconds ---
      const keepalive = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
      }, KEEPALIVE_INTERVAL_MS);

      // --- Send an initial "connected" event ---
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify(buildEventStreamConnectionReceipt(resolvedUserId))}\n\n`,
      );

      // --- Clean up on disconnect ---
      request.raw.on('close', () => {
        unsubscribe();
        clearInterval(keepalive);
      });

      // Tell Fastify we already handled the reply manually.
      // Returning without calling reply.send() keeps the connection open.
      await reply.hijack();
    },
  );
}
