import type { CalendarEventSyncItem } from '../services/MemoryServiceClient';

interface RingCentralCalendarRawEvent {
  id?: string;
  uid?: string;
  eventId?: string;
  subject?: string;
  title?: string;
  description?: string;
  startTime?: number | string;
  endTime?: number | string;
  organizer?: { name?: string; email?: string };
  attendees?: Array<{
    name?: string;
    email?: string;
    responseStatus?: string;
  }>;
  location?: string | { name?: string; displayName?: string };
  webLink?: string;
  joinUrl?: string;
  meetingUrl?: string;
  meetingUri?: string;
  cancelled?: boolean;
  responseStatus?: string;
  recurrenceId?: string;
  seriesMasterId?: string;
  iCalUId?: string;
  updatedAt?: number | string;
  lastModifiedTime?: number | string;
}

export async function readRingCentralCalendarEvents(): Promise<
  CalendarEventSyncItem[]
> {
  const records = await readIndexedDbStore<RingCentralCalendarRawEvent>(
    'Calendar',
    'event2',
  );
  const now = Date.now();
  const min = now - 24 * 60 * 60 * 1000;
  const max = now + 14 * 24 * 60 * 60 * 1000;
  return records
    .map(normalizeRingCentralCalendarEvent)
    .filter((event): event is CalendarEventSyncItem => Boolean(event))
    .filter((event) => event.startTime >= min && event.startTime <= max)
    .slice(0, 300);
}

function normalizeRingCentralCalendarEvent(
  event: RingCentralCalendarRawEvent,
): CalendarEventSyncItem | null {
  const externalId = String(event.id || event.eventId || event.uid || '').trim();
  const title = String(event.subject || event.title || '').trim();
  const startTime = parseTime(event.startTime);
  if (!externalId || !title || !startTime) return null;

  const location =
    typeof event.location === 'string'
      ? event.location
      : event.location?.displayName || event.location?.name;
  const joinUrl =
    event.joinUrl || event.meetingUrl || event.meetingUri || event.webLink;
  const descriptionPreview = clipText(stripHtml(event.description), 700);
  return {
    externalId,
    seriesKey: event.seriesMasterId || event.iCalUId || event.recurrenceId || externalId,
    title,
    descriptionPreview,
    startTime,
    endTime: parseTime(event.endTime),
    organizer: normalizeParticipant(event.organizer),
    attendees: (event.attendees || [])
      .map(normalizeParticipant)
      .filter(
        (
          attendee,
        ): attendee is {
          name?: string;
          email?: string;
          responseStatus?: string;
        } => Boolean(attendee),
      ),
    location: clipText(location, 300),
    joinUrl: clipText(joinUrl, 1000),
    sourceUrl: clipText(event.webLink || joinUrl, 1000),
    cancelled: event.cancelled === true,
    lastModifiedTime: parseTime(event.lastModifiedTime || event.updatedAt),
    metadata: {
      provider: 'ringcentral_indexeddb',
      responseStatus: event.responseStatus,
    },
  };
}

function normalizeParticipant(
  value?: { name?: string; email?: string; responseStatus?: string },
):
  | { name?: string; email?: string; responseStatus?: string }
  | undefined {
  if (!value?.name && !value?.email) return undefined;
  return {
    name: clipText(value.name, 160),
    email: clipText(value.email, 240),
    responseStatus: clipText(value.responseStatus, 80),
  };
}

function readIndexedDbStore<T>(
  databaseName: string,
  storeName: string,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const getAll = store.getAll();
        getAll.onerror = () =>
          reject(getAll.error || new Error('indexeddb_get_all_failed'));
        getAll.onsuccess = () => resolve((getAll.result || []) as T[]);
      } catch (error) {
        reject(error);
      } finally {
        db.close();
      }
    };
  });
}

function parseTime(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return value > 10_000_000_000 ? value : value * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, ' ');
}

function clipText(value: string | undefined, maxLength: number): string | undefined {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  return compact.length > maxLength ? compact.slice(0, maxLength).trimEnd() : compact;
}
