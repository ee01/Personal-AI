import type { FastifyInstance } from 'fastify';

interface MeetingListItem {
  meetingId: string;
  title: string;
  date: number;
  lastEventAt: number;
  participants: string[];
  pdfUrl?: string;
  digestId?: string;
  digestStatus?: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  digestErrorCode?: string;
  summary?: string;
  topicCount?: number;
  actionItemCount?: number;
  decisionCount?: number;
}

interface MeetingDetailItem extends MeetingListItem {
  latestObservationText?: string;
  chapters?: Array<Record<string, unknown>>;
  actionItems?: Array<Record<string, unknown>>;
  decisions?: Array<Record<string, unknown>>;
  timelineEvents?: Array<Record<string, unknown>>;
  participantStances?: Array<Record<string, unknown>>;
}

interface MeetingRow {
  meeting_id: string | null;
  title: string | null;
  first_timestamp: number | null;
  last_event_at: number | null;
  metadata_json: string | null;
  latest_content?: string | null;
  search_content?: string | null;
}

type MeetingArchiveStatusFilter =
  | 'all'
  | 'ready'
  | 'attention'
  | 'processing'
  | 'archived';

function safeJsonParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function normalizeDigestStatus(
  value: unknown,
): MeetingListItem['digestStatus'] {
  if (
    value === 'idle' ||
    value === 'uploading' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }
  return undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeSearchQuery(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 120);
  return normalized || undefined;
}

function normalizeArchiveStatusFilter(
  value: unknown,
): MeetingArchiveStatusFilter {
  return value === 'ready' ||
    value === 'attention' ||
    value === 'processing' ||
    value === 'archived'
    ? value
    : 'all';
}

function hasSafeOpenableUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getArchiveStatus(
  meeting: MeetingListItem,
): Exclude<MeetingArchiveStatusFilter, 'all'> {
  const hasPdf = hasSafeOpenableUrl(meeting.pdfUrl);
  if (meeting.digestStatus === 'failed') return 'attention';
  if (meeting.digestStatus === 'completed' && !hasPdf) return 'attention';
  if (hasPdf || meeting.digestStatus === 'completed') return 'ready';
  if (
    meeting.digestStatus === 'uploading' ||
    meeting.digestStatus === 'processing' ||
    meeting.digestId
  ) {
    return 'processing';
  }
  return 'archived';
}

function meetingMatchesSearch(
  meeting: MeetingListItem,
  row: MeetingRow,
  query?: string,
): boolean {
  if (!query) return true;
  const haystack = [
    meeting.meetingId,
    meeting.title,
    meeting.summary,
    meeting.digestErrorCode,
    row.latest_content,
    row.search_content,
    ...(meeting.participants || []),
  ]
    .filter((item): item is string => typeof item === 'string' && item !== '')
    .join('\n')
    .toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function meetingMatchesStatus(
  meeting: MeetingListItem,
  status: MeetingArchiveStatusFilter,
): boolean {
  return status === 'all' || getArchiveStatus(meeting) === status;
}

function rowToMeeting(row: MeetingRow): MeetingListItem | null {
  const meetingId = row.meeting_id?.trim();
  if (!meetingId) return null;

  const metadata =
    safeJsonParse<Record<string, unknown>>(row.metadata_json) ?? {};
  const participants = Array.isArray(metadata.participants)
    ? metadata.participants.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  const pdfUrl = normalizeOptionalString(metadata.pdfUrl);
  const digestId = normalizeOptionalString(metadata.digestId);
  const digestStatus = normalizeDigestStatus(metadata.digestStatus);
  const digestErrorCode = normalizeOptionalString(metadata.digestErrorCode);
  const summary = normalizeOptionalString(metadata.summary);
  const topicCount =
    typeof metadata.topicCount === 'number' ? metadata.topicCount : undefined;
  const actionItemCount =
    typeof metadata.actionItemCount === 'number'
      ? metadata.actionItemCount
      : undefined;
  const decisionCount = Array.isArray(metadata.decisions)
    ? metadata.decisions.length
    : undefined;

  return {
    meetingId,
    title: row.title?.trim() || meetingId,
    date: row.first_timestamp ?? row.last_event_at ?? 0,
    lastEventAt: row.last_event_at ?? row.first_timestamp ?? 0,
    participants,
    pdfUrl,
    digestId,
    digestStatus,
    digestErrorCode,
    summary,
    topicCount,
    actionItemCount,
    decisionCount,
  };
}

function rowToMeetingDetail(
  row: MeetingRow & { content?: string | null },
): MeetingDetailItem | null {
  const base = rowToMeeting(row);
  if (!base) return null;
  const metadata =
    safeJsonParse<Record<string, unknown>>(row.metadata_json) ?? {};
  return {
    ...base,
    summary:
      typeof metadata.summary === 'string'
        ? metadata.summary
        : base.summary || row.content || undefined,
    latestObservationText:
      typeof metadata.latestObservationText === 'string'
        ? metadata.latestObservationText
        : undefined,
    chapters: Array.isArray(metadata.chapters)
      ? (metadata.chapters as Array<Record<string, unknown>>)
      : undefined,
    actionItems: Array.isArray(metadata.actionItems)
      ? (metadata.actionItems as Array<Record<string, unknown>>)
      : undefined,
    decisions: Array.isArray(metadata.decisions)
      ? (metadata.decisions as Array<Record<string, unknown>>)
      : undefined,
    timelineEvents: Array.isArray(metadata.timelineEvents)
      ? (metadata.timelineEvents as Array<Record<string, unknown>>)
      : undefined,
    participantStances: Array.isArray(metadata.participantStances)
      ? (metadata.participantStances as Array<Record<string, unknown>>)
      : undefined,
  };
}

export async function meetingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      limit?: number;
      offset?: number;
      q?: string;
      status?: MeetingArchiveStatusFilter;
    };
  }>(
    '/meetings',
    {
      schema: {
        description: 'List persisted meeting records grouped by meeting id',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 200 },
            offset: { type: 'number', minimum: 0 },
            q: { type: 'string', maxLength: 120 },
            status: {
              type: 'string',
              enum: ['all', 'ready', 'attention', 'processing', 'archived'],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    meetingId: { type: 'string' },
                    title: { type: 'string' },
                    date: { type: 'number' },
                    lastEventAt: { type: 'number' },
                    participants: { type: 'array', items: { type: 'string' } },
                    pdfUrl: { type: 'string' },
                    digestId: { type: 'string' },
                    digestStatus: { type: 'string' },
                    digestErrorCode: { type: 'string' },
                    summary: { type: 'string' },
                    topicCount: { type: 'number' },
                    actionItemCount: { type: 'number' },
                    decisionCount: { type: 'number' },
                  },
                },
              },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
              q: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const limit = Math.min(
        Math.max(Number(request.query.limit ?? 50), 1),
        200,
      );
      const offset = Math.max(Number(request.query.offset ?? 0), 0);
      const searchQuery = normalizeSearchQuery(request.query.q);
      const status = normalizeArchiveStatusFilter(request.query.status);
      const searchContentProjection = searchQuery
        ? `,
                GROUP_CONCAT(COALESCE(m.content, ''), '\n') AS search_content`
        : `,
                NULL AS search_content`;

      const rows = db
        .prepare(
          `SELECT m.group_id AS meeting_id,
                COALESCE(latest.group_name, latest.source_title, m.group_id) AS title,
                MIN(COALESCE(m.timestamp, m.created_at)) AS first_timestamp,
                MAX(COALESCE(m.timestamp, m.created_at)) AS last_event_at,
                latest.metadata_json AS metadata_json,
                latest.content AS latest_content${searchContentProjection}
         FROM messages_raw m
         LEFT JOIN messages_raw latest
           ON latest.id = (
             SELECT inner_msg.id
             FROM messages_raw inner_msg
             WHERE inner_msg.source_type = 'meeting'
               AND inner_msg.group_id = m.group_id
             ORDER BY COALESCE(inner_msg.timestamp, inner_msg.created_at) DESC, inner_msg.created_at DESC
             LIMIT 1
           )
         WHERE m.source_type = 'meeting' AND m.group_id IS NOT NULL AND m.group_id != ''
         GROUP BY m.group_id, latest.group_name, latest.source_title, latest.metadata_json, latest.content
         ORDER BY last_event_at DESC`,
        )
        .all() as MeetingRow[];

      const filteredItems = rows.flatMap((row) => {
        const meeting = rowToMeeting(row);
        if (!meeting) return [];
        if (!meetingMatchesSearch(meeting, row, searchQuery)) return [];
        if (!meetingMatchesStatus(meeting, status)) return [];
        return [meeting];
      });

      return reply.status(200).send({
        items: filteredItems.slice(offset, offset + limit),
        total: filteredItems.length,
        limit,
        offset,
        q: searchQuery,
        status,
      });
    },
  );

  app.get<{ Params: { meetingId: string } }>(
    '/meetings/:meetingId',
    {
      schema: {
        description:
          'Get a single persisted meeting record with archived detail',
        params: {
          type: 'object',
          required: ['meetingId'],
          properties: {
            meetingId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const meetingId = String(request.params.meetingId || '').trim();
      if (!meetingId) {
        return reply.status(400).send({ error: 'meetingId is required' });
      }

      const row = db
        .prepare(
          `SELECT group_id AS meeting_id,
                  COALESCE(group_name, source_title) AS title,
                  COALESCE(timestamp, created_at) AS first_timestamp,
                  COALESCE(timestamp, created_at) AS last_event_at,
                  metadata_json,
                  content
           FROM messages_raw
           WHERE source_type = 'meeting' AND group_id = ?
           ORDER BY COALESCE(timestamp, created_at) DESC, created_at DESC
           LIMIT 1`,
        )
        .get(meetingId) as
        | (MeetingRow & { content?: string | null })
        | undefined;

      const item = row ? rowToMeetingDetail(row) : null;
      if (!item) {
        return reply.status(404).send({ error: 'meeting not found' });
      }

      return reply.status(200).send(item);
    },
  );
}
