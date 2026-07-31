import type {
  CalendarEventSyncItem,
  CalendarEventsSyncResponse,
  CalendarEventSourceSystem,
} from '../services/MemoryServiceClient';
import { MemoryServiceClient } from '../services/MemoryServiceClient';
import type { EnvConfigType } from '../utils';

const OUTLOOK_AUTH_STORAGE_KEY = 'outlookCalendarAuth';
const OUTLOOK_STATUS_STORAGE_KEY = 'outlookCalendarStatus';
const OUTLOOK_SCOPES = ['offline_access', 'User.Read', 'Calendars.Read'];
const MAX_CALENDAR_SYNC_ATTENDEES = 120;

interface OutlookTokenState {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
  account?: {
    id?: string;
    displayName?: string;
    userPrincipalName?: string;
  };
}

export interface OutlookCalendarStatus {
  connected: boolean;
  account?: OutlookTokenState['account'];
  expiresAt?: number;
  lastSyncAt?: number;
  lastSyncResult?: CalendarEventsSyncResponse;
  lastError?: string;
}

interface GraphCalendarEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  attendees?: Array<{
    status?: { response?: string };
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  location?: { displayName?: string };
  isCancelled?: boolean;
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
  seriesMasterId?: string;
  iCalUId?: string;
  lastModifiedDateTime?: string;
}

export async function getOutlookCalendarStatus(): Promise<OutlookCalendarStatus> {
  const [auth, status] = await Promise.all([
    readAuthState(),
    chrome.storage.local.get([OUTLOOK_STATUS_STORAGE_KEY]),
  ]);
  const storedStatus =
    (status[OUTLOOK_STATUS_STORAGE_KEY] as Partial<OutlookCalendarStatus>) ||
    {};

  return {
    connected: Boolean(auth?.accessToken || auth?.refreshToken),
    account: auth?.account,
    expiresAt: auth?.expiresAt,
    lastSyncAt: storedStatus.lastSyncAt,
    lastSyncResult: storedStatus.lastSyncResult,
    lastError: storedStatus.lastError,
  };
}

export async function connectOutlookCalendar(
  config: Pick<EnvConfigType, 'MS_OUTLOOK_CLIENT_ID' | 'MS_OUTLOOK_TENANT_ID'>,
): Promise<OutlookCalendarStatus> {
  const clientId = (config.MS_OUTLOOK_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new Error('missing_outlook_client_id');
  }

  const tenant = (config.MS_OUTLOOK_TENANT_ID || 'common').trim() || 'common';
  const redirectUri = chrome.identity.getRedirectURL('outlook-calendar');
  const verifier = createCodeVerifier();
  const challenge = await createPkceChallenge(verifier);
  const authUrl = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', OUTLOOK_SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  const responseUrl = await launchWebAuthFlow(authUrl.toString(), true);
  const code = new URL(responseUrl).searchParams.get('code');
  if (!code) {
    throw new Error('outlook_auth_code_missing');
  }

  const token = await exchangeCodeForToken({
    tenant,
    clientId,
    redirectUri,
    code,
    verifier,
  });
  const account = await fetchGraphMe(token.accessToken).catch(() => undefined);
  const authState: OutlookTokenState = {
    ...token,
    account,
  };
  await chrome.storage.local.set({ [OUTLOOK_AUTH_STORAGE_KEY]: authState });
  await writeStatus({ connected: true, account, expiresAt: authState.expiresAt });
  return getOutlookCalendarStatus();
}

export async function disconnectOutlookCalendar(): Promise<OutlookCalendarStatus> {
  await chrome.storage.local.remove([OUTLOOK_AUTH_STORAGE_KEY]);
  await writeStatus({ connected: false });
  return getOutlookCalendarStatus();
}

export async function syncOutlookCalendarToMemoryService(
  client: MemoryServiceClient,
  config: Pick<EnvConfigType, 'MS_OUTLOOK_CLIENT_ID' | 'MS_OUTLOOK_TENANT_ID'>,
): Promise<CalendarEventsSyncResponse> {
  const token = await getValidAccessToken(config);
  const events = await fetchOutlookCalendarEvents(token);
  const result = await client.syncCalendarEvents({
    sourceSystem: 'outlook',
    events: normalizeCalendarEventsForSync(events),
    syncedAt: Date.now(),
  });
  await writeStatus({
    connected: true,
    lastSyncAt: Date.now(),
    lastSyncResult: result,
    lastError: undefined,
  });
  return result;
}

export async function syncCalendarEventsToMemoryService(
  client: MemoryServiceClient,
  sourceSystem: CalendarEventSourceSystem,
  events: CalendarEventSyncItem[],
): Promise<CalendarEventsSyncResponse> {
  const result = await client.syncCalendarEvents({
    sourceSystem,
    events: normalizeCalendarEventsForSync(events),
    syncedAt: Date.now(),
  });
  await writeStatus({
    lastSyncAt: Date.now(),
    lastSyncResult: result,
    lastError: undefined,
  });
  return result;
}

export function normalizeCalendarEventsForSync(
  events: CalendarEventSyncItem[],
): CalendarEventSyncItem[] {
  return events
    .map(normalizeCalendarEventForSync)
    .filter((event): event is CalendarEventSyncItem => Boolean(event));
}

function normalizeCalendarEventForSync(
  event: CalendarEventSyncItem | null | undefined,
): CalendarEventSyncItem | null {
  if (!event) return null;
  const externalId = compactString(event.externalId);
  const title = compactString(event.title);
  const startTime = finiteNumber(event.startTime);
  if (!externalId || !title || startTime == null) {
    return null;
  }

  const normalized: CalendarEventSyncItem = {
    externalId,
    title,
    startTime,
  };
  const seriesKey = compactString(event.seriesKey);
  const descriptionPreview = compactString(event.descriptionPreview);
  const endTime = finiteNumber(event.endTime);
  const organizer = normalizeCalendarParticipantForSync(event.organizer);
  const location = compactString(event.location);
  const joinUrl = compactString(event.joinUrl);
  const sourceUrl = compactString(event.sourceUrl);
  const lastModifiedTime = finiteNumber(event.lastModifiedTime);
  const metadata = normalizeCalendarMetadataForSync(event.metadata);

  if (seriesKey) normalized.seriesKey = seriesKey;
  if (descriptionPreview) normalized.descriptionPreview = descriptionPreview;
  if (endTime != null) normalized.endTime = endTime;
  if (organizer) normalized.organizer = organizer;
  if (Array.isArray(event.attendees)) {
    const attendees = event.attendees
      .map(normalizeCalendarParticipantForSync)
      .filter(
        (
          attendee,
        ): attendee is NonNullable<CalendarEventSyncItem['organizer']> =>
          Boolean(attendee),
      );
    if (attendees.length > 0) {
      normalized.attendees = attendees.slice(0, MAX_CALENDAR_SYNC_ATTENDEES);
    }
    if (attendees.length > MAX_CALENDAR_SYNC_ATTENDEES) {
      normalized.metadata = {
        ...(normalized.metadata || {}),
        attendeeCount: attendees.length,
        attendeesTruncated: true,
      };
    }
  }
  if (location) normalized.location = location;
  if (joinUrl) normalized.joinUrl = joinUrl;
  if (sourceUrl) normalized.sourceUrl = sourceUrl;
  if (typeof event.cancelled === 'boolean') normalized.cancelled = event.cancelled;
  if (lastModifiedTime != null) normalized.lastModifiedTime = lastModifiedTime;
  if (metadata) {
    normalized.metadata = {
      ...metadata,
      ...(normalized.metadata || {}),
    };
  }

  return normalized;
}

function normalizeCalendarParticipantForSync(
  participant: CalendarEventSyncItem['organizer'] | null | undefined,
): CalendarEventSyncItem['organizer'] | undefined {
  if (!participant) return undefined;
  const normalized: NonNullable<CalendarEventSyncItem['organizer']> = {};
  const name = compactString(participant.name);
  const email = compactString(participant.email);
  const responseStatus = compactString(participant.responseStatus);
  if (name) normalized.name = name;
  if (email) normalized.email = email;
  if (responseStatus) normalized.responseStatus = responseStatus;
  return normalized.name || normalized.email || normalized.responseStatus
    ? normalized
    : undefined;
}

function normalizeCalendarMetadataForSync(
  metadata: CalendarEventSyncItem['metadata'] | null | undefined,
): CalendarEventSyncItem['metadata'] | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function compactString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact || undefined;
}

function finiteNumber(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
}

async function getValidAccessToken(
  config: Pick<EnvConfigType, 'MS_OUTLOOK_CLIENT_ID' | 'MS_OUTLOOK_TENANT_ID'>,
): Promise<string> {
  const auth = await readAuthState();
  if (!auth) {
    throw new Error('outlook_not_connected');
  }

  if (auth.accessToken && auth.expiresAt > Date.now() + 2 * 60 * 1000) {
    return auth.accessToken;
  }

  if (!auth.refreshToken) {
    throw new Error('outlook_refresh_token_missing');
  }

  const refreshed = await refreshAccessToken(config, auth.refreshToken);
  const nextAuth: OutlookTokenState = {
    ...auth,
    ...refreshed,
    refreshToken: refreshed.refreshToken || auth.refreshToken,
  };
  await chrome.storage.local.set({ [OUTLOOK_AUTH_STORAGE_KEY]: nextAuth });
  return nextAuth.accessToken;
}

async function fetchOutlookCalendarEvents(
  accessToken: string,
): Promise<CalendarEventSyncItem[]> {
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
  url.searchParams.set('startDateTime', start);
  url.searchParams.set('endDateTime', end);
  url.searchParams.set('$top', '100');
  url.searchParams.set(
    '$select',
    [
      'id',
      'subject',
      'bodyPreview',
      'start',
      'end',
      'organizer',
      'attendees',
      'location',
      'isCancelled',
      'webLink',
      'onlineMeeting',
      'seriesMasterId',
      'iCalUId',
      'lastModifiedDateTime',
    ].join(','),
  );
  url.searchParams.set('$orderby', 'start/dateTime');

  const events: GraphCalendarEvent[] = [];
  let nextUrl: string | undefined = url.toString();
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!response.ok) {
      throw new Error(`outlook_calendar_fetch_failed_${response.status}`);
    }
    const body = (await response.json()) as {
      value?: GraphCalendarEvent[];
      '@odata.nextLink'?: string;
    };
    events.push(...(body.value ?? []));
    nextUrl = body['@odata.nextLink'];
  }

  return events
    .filter((event) => event.id && event.subject)
    .map(normalizeGraphEvent);
}

function normalizeGraphEvent(event: GraphCalendarEvent): CalendarEventSyncItem {
  return {
    externalId: event.id,
    seriesKey: event.seriesMasterId || event.iCalUId || event.id,
    title: event.subject || 'Untitled meeting',
    descriptionPreview: clipText(event.bodyPreview, 700),
    startTime: parseGraphDateTime(event.start?.dateTime),
    endTime: parseGraphDateTime(event.end?.dateTime),
    organizer: normalizeEmailAddress(event.organizer?.emailAddress),
    attendees: (event.attendees ?? []).map((attendee) => ({
      ...normalizeEmailAddress(attendee.emailAddress),
      responseStatus: attendee.status?.response,
    })),
    location: clipText(event.location?.displayName, 300),
    joinUrl: event.onlineMeeting?.joinUrl,
    sourceUrl: event.webLink,
    cancelled: event.isCancelled,
    lastModifiedTime: event.lastModifiedDateTime
      ? Date.parse(event.lastModifiedDateTime)
      : undefined,
    metadata: {
      provider: 'microsoft_graph',
    },
  };
}

function normalizeEmailAddress(
  value?: { name?: string; address?: string },
): { name?: string; email?: string } | undefined {
  if (!value?.name && !value?.address) return undefined;
  return {
    name: clipText(value.name, 160),
    email: clipText(value.address, 240),
  };
}

async function exchangeCodeForToken(args: {
  tenant: string;
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<OutlookTokenState> {
  const body = new URLSearchParams();
  body.set('client_id', args.clientId);
  body.set('scope', OUTLOOK_SCOPES.join(' '));
  body.set('code', args.code);
  body.set('redirect_uri', args.redirectUri);
  body.set('grant_type', 'authorization_code');
  body.set('code_verifier', args.verifier);
  return tokenRequest(args.tenant, body);
}

async function refreshAccessToken(
  config: Pick<EnvConfigType, 'MS_OUTLOOK_CLIENT_ID' | 'MS_OUTLOOK_TENANT_ID'>,
  refreshToken: string,
): Promise<OutlookTokenState> {
  const clientId = (config.MS_OUTLOOK_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new Error('missing_outlook_client_id');
  }
  const tenant = (config.MS_OUTLOOK_TENANT_ID || 'common').trim() || 'common';
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('scope', OUTLOOK_SCOPES.join(' '));
  body.set('refresh_token', refreshToken);
  body.set('grant_type', 'refresh_token');
  return tokenRequest(tenant, body);
}

async function tokenRequest(
  tenant: string,
  body: URLSearchParams,
): Promise<OutlookTokenState> {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (!response.ok) {
    throw new Error(`outlook_token_request_failed_${response.status}`);
  }
  const token = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(60, token.expires_in || 3600) * 1000,
    tokenType: token.token_type || 'Bearer',
    scope: token.scope,
  };
}

async function fetchGraphMe(
  accessToken: string,
): Promise<OutlookTokenState['account']> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;
  const me = (await response.json()) as {
    id?: string;
    displayName?: string;
    userPrincipalName?: string;
    mail?: string;
  };
  return {
    id: me.id,
    displayName: me.displayName,
    userPrincipalName: me.userPrincipalName || me.mail,
  };
}

function launchWebAuthFlow(url: string, interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!responseUrl) {
        reject(new Error('outlook_auth_cancelled'));
        return;
      }
      resolve(responseUrl);
    });
  });
}

async function readAuthState(): Promise<OutlookTokenState | null> {
  const result = await chrome.storage.local.get([OUTLOOK_AUTH_STORAGE_KEY]);
  return (result[OUTLOOK_AUTH_STORAGE_KEY] as OutlookTokenState | undefined) || null;
}

async function writeStatus(status: Partial<OutlookCalendarStatus>): Promise<void> {
  const current = await chrome.storage.local.get([OUTLOOK_STATUS_STORAGE_KEY]);
  await chrome.storage.local.set({
    [OUTLOOK_STATUS_STORAGE_KEY]: {
      ...(current[OUTLOOK_STATUS_STORAGE_KEY] || {}),
      ...status,
    },
  });
}

function createCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createPkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseGraphDateTime(value?: string): number | undefined {
  if (!value) return undefined;
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clipText(value: string | undefined, maxLength: number): string | undefined {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  return compact.length > maxLength ? compact.slice(0, maxLength).trimEnd() : compact;
}
