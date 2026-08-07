import crypto from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type {
  CalendarEventsSyncRequest,
  CalendarEventsSyncResponse,
  CalendarEventSyncItem,
  CalendarEventSyncParticipant,
} from '../types/index.js';
import { MemoryClaimAttributionService } from '../core/MemoryClaimAttributionService.js';

const nullableStringSchema = { type: ['string', 'null'] as const };
const nullableNumberSchema = { type: ['number', 'null'] as const };
const nullableBooleanSchema = { type: ['boolean', 'null'] as const };

const participantSchema = {
  type: ['object', 'null'] as const,
  properties: {
    name: nullableStringSchema,
    email: nullableStringSchema,
    responseStatus: nullableStringSchema,
  },
  additionalProperties: false,
};

const calendarEventSchema = {
  type: 'object' as const,
  required: ['externalId', 'title', 'startTime'],
  properties: {
    externalId: { type: 'string' as const, minLength: 1 },
    seriesKey: nullableStringSchema,
    title: { type: 'string' as const, minLength: 1 },
    descriptionPreview: nullableStringSchema,
    startTime: { type: 'number' as const },
    endTime: nullableNumberSchema,
    organizer: participantSchema,
    attendees: {
      type: ['array', 'null'] as const,
      items: participantSchema,
      maxItems: 120,
    },
    location: nullableStringSchema,
    joinUrl: nullableStringSchema,
    sourceUrl: nullableStringSchema,
    cancelled: nullableBooleanSchema,
    lastModifiedTime: nullableNumberSchema,
    metadata: {
      type: ['object', 'null'] as const,
      additionalProperties: true,
    },
  },
  additionalProperties: false,
};

const calendarEventsSyncBodySchema = {
  type: 'object' as const,
  required: ['sourceSystem', 'events'],
  properties: {
    sourceSystem: {
      type: 'string' as const,
      enum: ['outlook', 'ringcentral_indexeddb'],
    },
    events: {
      type: 'array' as const,
      items: calendarEventSchema,
      maxItems: 500,
    },
    deletedExternalIds: {
      type: 'array' as const,
      items: { type: 'string' as const },
      maxItems: 500,
    },
    syncedAt: { type: 'number' as const },
    debug: { type: 'boolean' as const },
  },
  additionalProperties: false,
};

interface ExistingCalendarEventRow {
  id: string;
  content_hash: string;
  cancelled: number;
}

export async function calendarEventRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CalendarEventsSyncRequest }>(
    '/calendar-events/sync',
    {
      schema: {
        body: calendarEventsSyncBodySchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const payload = request.body;
      const now = normalizeTimestamp(payload.syncedAt ?? Date.now());
      const response: CalendarEventsSyncResponse = {
        created: 0,
        updated: 0,
        unchanged: 0,
        cancelled: 0,
        deleted: 0,
        total: payload.events.length,
      };

      const sync = db.transaction(() => {
        for (const event of payload.events) {
          const normalized = normalizeEvent(event, payload.sourceSystem, now);
          const existing = db
            .prepare(
              `SELECT id, content_hash, cancelled
               FROM calendar_events
               WHERE source_system = ? AND external_id = ?`,
            )
            .get(payload.sourceSystem, event.externalId) as
            | ExistingCalendarEventRow
            | undefined;

          if (!existing) {
            insertCalendarEvent(db, normalized);
            response.created += 1;
          } else if (
            existing.content_hash === normalized.contentHash &&
            existing.cancelled === normalized.cancelled
          ) {
            response.unchanged += 1;
          } else {
            updateCalendarEvent(db, normalized);
            response.updated += 1;
          }

          if (normalized.cancelled) {
            response.cancelled += 1;
            removeCalendarMemoryChunk(db, normalized);
          } else {
            upsertCalendarMemory(db, normalized);
          }
        }

        for (const externalId of payload.deletedExternalIds ?? []) {
          const id = buildCalendarEventId(payload.sourceSystem, externalId);
          const result = db
            .prepare(
              `UPDATE calendar_events
               SET cancelled = 1, updated_at = ?, synced_at = ?
               WHERE source_system = ? AND external_id = ? AND cancelled = 0`,
            )
            .run(now, now, payload.sourceSystem, externalId);
          if (result.changes > 0) {
            response.deleted += result.changes;
          }
          db.prepare(`DELETE FROM chunks WHERE file_path = ?`).run(
            buildCalendarFilePath(id),
          );
        }
      });

      sync();
      return reply.send(response);
    },
  );
}

interface NormalizedCalendarEvent {
  id: string;
  sourceSystem: CalendarEventsSyncRequest['sourceSystem'];
  externalId: string;
  seriesKey?: string;
  title: string;
  descriptionPreview?: string;
  startAt: number;
  endAt?: number;
  organizerJson: string;
  attendeesJson: string;
  location?: string;
  joinUrl?: string;
  sourceUrl?: string;
  cancelled: number;
  contentHash: string;
  metadataJson: string;
  lastModifiedAt?: number;
  syncedAt: number;
  content: string;
}

function normalizeEvent(
  event: CalendarEventSyncItem,
  sourceSystem: CalendarEventsSyncRequest['sourceSystem'],
  syncedAt: number,
): NormalizedCalendarEvent {
  const id = buildCalendarEventId(sourceSystem, event.externalId);
  const startAt = normalizeTimestamp(event.startTime);
  const endAt =
    event.endTime == null ? undefined : normalizeTimestamp(event.endTime);
  const organizer = sanitizeParticipant(event.organizer);
  const attendees = (event.attendees ?? [])
    .map(sanitizeParticipant)
    .filter(
      (attendee): attendee is CalendarEventSyncParticipant =>
        Boolean(attendee),
    )
    .slice(0, 120);
  const metadata = {
    ...(event.metadata ?? {}),
    sourceSystem,
    externalId: event.externalId,
  };
  const content = renderCalendarMemoryContent({
    ...event,
    organizer,
    attendees,
  });
  const hashInput = {
    seriesKey: event.seriesKey,
    title: event.title,
    descriptionPreview: clipText(event.descriptionPreview, 700),
    startAt,
    endAt,
    organizer,
    attendees,
    location: event.location,
    joinUrl: event.joinUrl,
    sourceUrl: event.sourceUrl,
    cancelled: Boolean(event.cancelled),
    metadata,
  };

  return {
    id,
    sourceSystem,
    externalId: event.externalId,
    seriesKey: clipText(event.seriesKey, 240),
    title: clipText(event.title, 300) || 'Untitled meeting',
    descriptionPreview: clipText(event.descriptionPreview, 700),
    startAt,
    endAt,
    organizerJson: JSON.stringify(organizer ?? null),
    attendeesJson: JSON.stringify(attendees),
    location: clipText(event.location, 300),
    joinUrl: clipText(event.joinUrl, 1000),
    sourceUrl: clipText(event.sourceUrl, 1000),
    cancelled: event.cancelled ? 1 : 0,
    contentHash: hashJson(hashInput),
    metadataJson: JSON.stringify(metadata),
    lastModifiedAt:
      event.lastModifiedTime == null
        ? undefined
        : normalizeTimestamp(event.lastModifiedTime),
    syncedAt,
    content,
  };
}

function insertCalendarEvent(
  db: import('better-sqlite3').Database,
  event: NormalizedCalendarEvent,
): void {
  db.prepare(
    `INSERT INTO calendar_events
      (id, source_system, external_id, series_key, title, description_preview,
       start_at, end_at, organizer_json, attendees_json, location, join_url,
       source_url, cancelled, content_hash, metadata_json, last_modified_at,
       synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    event.sourceSystem,
    event.externalId,
    event.seriesKey ?? null,
    event.title,
    event.descriptionPreview ?? null,
    event.startAt,
    event.endAt ?? null,
    event.organizerJson,
    event.attendeesJson,
    event.location ?? null,
    event.joinUrl ?? null,
    event.sourceUrl ?? null,
    event.cancelled,
    event.contentHash,
    event.metadataJson,
    event.lastModifiedAt ?? null,
    event.syncedAt,
    event.syncedAt,
    event.syncedAt,
  );
}

function updateCalendarEvent(
  db: import('better-sqlite3').Database,
  event: NormalizedCalendarEvent,
): void {
  db.prepare(
    `UPDATE calendar_events
     SET series_key = ?, title = ?, description_preview = ?, start_at = ?,
         end_at = ?, organizer_json = ?, attendees_json = ?, location = ?,
         join_url = ?, source_url = ?, cancelled = ?, content_hash = ?,
         metadata_json = ?, last_modified_at = ?, synced_at = ?, updated_at = ?
     WHERE source_system = ? AND external_id = ?`,
  ).run(
    event.seriesKey ?? null,
    event.title,
    event.descriptionPreview ?? null,
    event.startAt,
    event.endAt ?? null,
    event.organizerJson,
    event.attendeesJson,
    event.location ?? null,
    event.joinUrl ?? null,
    event.sourceUrl ?? null,
    event.cancelled,
    event.contentHash,
    event.metadataJson,
    event.lastModifiedAt ?? null,
    event.syncedAt,
    event.syncedAt,
    event.sourceSystem,
    event.externalId,
  );
}

function upsertCalendarMemory(
  db: import('better-sqlite3').Database,
  event: NormalizedCalendarEvent,
): void {
  const messageId = event.id;
  const filePath = buildCalendarFilePath(event.id);
  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, source, scope, source_url, source_title, sender,
       group_id, group_name, timestamp, importance, sentiment, metadata_json,
       claim_attribution_status, claim_attribution_version, created_at, updated_at)
     VALUES (?, ?, 'calendar', ?, 'work', ?, ?, ?, ?, ?, ?, 0.6, 'neutral', ?, 'pending', 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       source = excluded.source,
       source_url = excluded.source_url,
       source_title = excluded.source_title,
       sender = excluded.sender,
       group_id = excluded.group_id,
       group_name = excluded.group_name,
       timestamp = excluded.timestamp,
       metadata_json = excluded.metadata_json,
       claim_attribution_status = 'pending',
       claim_attribution_version = messages_raw.claim_attribution_version + 1,
       claim_attribution_error = NULL,
       updated_at = excluded.updated_at`,
  ).run(
    messageId,
    event.content,
    event.sourceSystem,
    event.sourceUrl || event.joinUrl || null,
    event.title,
    readParticipantName(event.organizerJson),
    event.seriesKey || event.externalId,
    'Calendar',
    event.startAt,
    event.metadataJson,
    event.syncedAt,
    event.syncedAt,
  );
  new MemoryClaimAttributionService(db).ensureForMessage(messageId, {
    force: true,
  });

  const existingChunk = db
    .prepare(`SELECT content_hash FROM chunks WHERE file_path = ?`)
    .get(filePath) as { content_hash: string } | undefined;
  if (existingChunk?.content_hash === event.contentHash) {
    return;
  }

  db.prepare(`DELETE FROM chunks WHERE file_path = ?`).run(filePath);
  db.prepare(
    `INSERT INTO chunks
      (file_path, line_start, line_end, content, content_hash, scope, source,
       source_type, related_project, related_entity_id, token_count, created_at,
       updated_at)
     VALUES (?, 1, 1, ?, ?, 'work', ?, 'calendar', ?, ?, ?, ?, ?)`,
  ).run(
    filePath,
    event.content,
    event.contentHash,
    event.sourceSystem,
    event.title,
    messageId,
    estimateTokens(event.content),
    event.syncedAt,
    event.syncedAt,
  );
}

function removeCalendarMemoryChunk(
  db: import('better-sqlite3').Database,
  event: NormalizedCalendarEvent,
): void {
  db.prepare(`DELETE FROM chunks WHERE file_path = ?`).run(
    buildCalendarFilePath(event.id),
  );
}

function renderCalendarMemoryContent(
  event: CalendarEventSyncItem,
): string {
  const attendees = (event.attendees ?? [])
    .map((attendee) => attendee.name || attendee.email)
    .filter((value): value is string => Boolean(value))
    .slice(0, 24);
  return [
    `Calendar event: ${event.title}`,
    event.descriptionPreview ? `Description: ${clipText(event.descriptionPreview, 700)}` : '',
    `Start: ${new Date(event.startTime).toISOString()}`,
    event.endTime ? `End: ${new Date(event.endTime).toISOString()}` : '',
    event.organizer?.name || event.organizer?.email
      ? `Organizer: ${event.organizer.name || event.organizer.email}`
      : '',
    attendees.length ? `Attendees: ${attendees.join(', ')}` : '',
    event.location ? `Location: ${event.location}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function sanitizeParticipant<T extends { name?: string; email?: string; responseStatus?: string }>(
  participant: T | undefined,
): T | undefined {
  if (!participant) return undefined;
  return {
    ...participant,
    name: clipText(participant.name, 160),
    email: clipText(participant.email, 240),
    responseStatus: clipText(participant.responseStatus, 80),
  };
}

function normalizeTimestamp(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.floor(Date.now() / 1000);
  return numeric > 10_000_000_000
    ? Math.floor(numeric / 1000)
    : Math.floor(numeric);
}

function buildCalendarEventId(sourceSystem: string, externalId: string): string {
  return `calendar:${sourceSystem}:${externalId}`;
}

function buildCalendarFilePath(id: string): string {
  return `calendar/${id}.md`;
}

function hashJson(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function clipText(value: string | undefined, maxLength: number): string | undefined {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  return compact.length > maxLength ? compact.slice(0, maxLength).trimEnd() : compact;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function readParticipantName(organizerJson: string): string | null {
  try {
    const organizer = JSON.parse(organizerJson) as { name?: string; email?: string } | null;
    return organizer?.name || organizer?.email || null;
  } catch {
    return null;
  }
}
