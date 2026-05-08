const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export const CONTEXT_SITE_MUTE_STORAGE_KEY = 'pai-context-muted-sites-v1';
export const CONTEXT_SITE_MUTE_TTL_MS = 24 * 60 * 60 * 1000;

const LOW_VALUE_CONTEXT_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'accounts.google.com',
  'facebook.com',
  'www.facebook.com',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'amazon.com',
  'www.amazon.com',
  'smile.amazon.com',
  'netflix.com',
  'www.netflix.com',
  'spotify.com',
  'open.spotify.com',
]);

const LOW_VALUE_CONTEXT_HOST_SUFFIXES = [
  '.facebook.com',
  '.twitter.com',
  '.x.com',
  '.youtube.com',
  '.netflix.com',
  '.spotify.com',
];

const SENSITIVE_URL_PATTERN =
  /(?:^|[/?#._-])(login|sign[-_]?in|auth|oauth|password|reset[-_]?password|checkout|payment|billing|mfa|2fa|verification|verify|otp)(?:$|[/?#._-])/i;

const SENSITIVE_CONTROL_PATTERN =
  /\b(current-password|new-password|one-time-code|password|passcode|credit\s*card|card\s*number|cc-number|cc-csc|cc-exp|cvc|cvv|security\s*code|ssn|social\s*security|mfa|2fa|totp|otp|api\s*key|access\s*token|secret)\b/i;

const SENSITIVE_QUERY_PARAM_NAMES = new Set([
  'access_token',
  'apikey',
  'api_key',
  'assertion',
  'auth_token',
  'client_secret',
  'code',
  'credential',
  'credentials',
  'id_token',
  'key',
  'mfa',
  'otp',
  'passcode',
  'password',
  'refresh_token',
  'secret',
  'session',
  'session_id',
  'sessionid',
  'sid',
  'token',
  'totp',
]);

const TRACKING_QUERY_PARAM_PATTERN =
  /^(?:utm_.+|fbclid|gclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|vero_id|mkt_tok|ref|ref_src|spm)$/i;
const UNSAFE_EXPLORE_ROUTE_VISIBLE_CHARS_PATTERN = /[\s<>"'`]/;

export interface SensitiveControlDescriptor {
  type?: string | null;
  autocomplete?: string | null;
  name?: string | null;
  id?: string | null;
  ariaLabel?: string | null;
  placeholder?: string | null;
  inputMode?: string | null;
}

export type ContextSiteMuteRecord = Record<string, number>;

export function normalizeContextSiteMuteHost(rawHostname: string): string {
  return rawHostname.trim().toLowerCase().replace(/\.$/, '');
}

export function isContextSiteMuteActive(
  mutedAt: number,
  now = Date.now(),
): boolean {
  return (
    Number.isFinite(mutedAt) &&
    mutedAt > 0 &&
    now - mutedAt >= 0 &&
    now - mutedAt < CONTEXT_SITE_MUTE_TTL_MS
  );
}

export function getContextSiteMuteExpiresAt(mutedAt: number): number | null {
  if (!Number.isFinite(mutedAt) || mutedAt <= 0) return null;
  return mutedAt + CONTEXT_SITE_MUTE_TTL_MS;
}

export function formatContextSiteMuteRemaining(
  mutedAt: number,
  now = Date.now(),
): string {
  const expiresAt = getContextSiteMuteExpiresAt(mutedAt);
  if (!expiresAt || expiresAt <= now) return '已过期';

  const remainingMs = expiresAt - now;
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 60) {
    return `${remainingMinutes} 分钟后恢复`;
  }

  const remainingHours = Math.ceil(remainingMinutes / 60);
  return `${remainingHours} 小时后恢复`;
}

export function pruneContextSiteMuteRecord(
  rawValue: unknown,
  now = Date.now(),
): { record: ContextSiteMuteRecord; changed: boolean } {
  const record: ContextSiteMuteRecord = {};
  let changed = false;

  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { record, changed: Boolean(rawValue) };
  }

  for (const [rawHost, rawMutedAt] of Object.entries(rawValue)) {
    const host = normalizeContextSiteMuteHost(rawHost);
    if (!host || typeof rawMutedAt !== 'number') {
      changed = true;
      continue;
    }

    if (!isContextSiteMuteActive(rawMutedAt, now)) {
      changed = true;
      continue;
    }

    if (host !== rawHost) {
      changed = true;
    }
    record[host] = rawMutedAt;
  }

  return { record, changed };
}

export function sanitizeContextExternalUrl(
  rawUrl?: string | null,
  baseUrl = 'https://example.invalid/',
): string | null {
  const value = rawUrl?.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value, baseUrl);
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
  } catch (_error) {
    return null;
  }
}

export function sanitizeExploreRoute(rawRoute?: string | null): string | null {
  const value = rawRoute?.trim();
  if (!value || !value.startsWith('#/')) return null;
  if (UNSAFE_EXPLORE_ROUTE_VISIBLE_CHARS_PATTERN.test(value)) return null;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return null;
  }
  return value;
}

export function isLowValueContextHost(rawHostname: string): boolean {
  const hostname = rawHostname.trim().toLowerCase();
  if (!hostname) return true;
  if (LOW_VALUE_CONTEXT_HOSTS.has(hostname)) return true;
  return LOW_VALUE_CONTEXT_HOST_SUFFIXES.some((suffix) =>
    hostname.endsWith(suffix),
  );
}

export function formatRecallTimestamp(timestamp?: number): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  const ms = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (_error) {
    return date.toISOString().slice(0, 10);
  }
}

function normalizeQueryParamName(name: string): string {
  return name.trim().toLowerCase();
}

function hasSensitiveQueryParam(url: URL): boolean {
  for (const key of Array.from(url.searchParams.keys())) {
    if (SENSITIVE_QUERY_PARAM_NAMES.has(normalizeQueryParamName(key))) {
      return true;
    }
  }
  return false;
}

function shouldDropContextQueryParam(name: string): boolean {
  return TRACKING_QUERY_PARAM_PATTERN.test(normalizeQueryParamName(name));
}

export function normalizeContextPageUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!SAFE_EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
    if (hasSensitiveQueryParam(url)) return null;

    url.username = '';
    url.password = '';
    url.hash = '';

    for (const key of Array.from(url.searchParams.keys())) {
      if (shouldDropContextQueryParam(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();

    return url.href;
  } catch (_error) {
    return null;
  }
}

export function hasSensitiveUrlSignal(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (hasSensitiveQueryParam(url)) return true;
    return SENSITIVE_URL_PATTERN.test(
      `${url.hostname}${url.pathname}${url.hash}`,
    );
  } catch (_error) {
    return SENSITIVE_URL_PATTERN.test(rawUrl);
  }
}

export function isSensitiveControlDescriptor(
  descriptor: SensitiveControlDescriptor,
): boolean {
  const type = descriptor.type?.toLowerCase().trim();
  if (type === 'password') return true;

  const signature = [
    descriptor.autocomplete,
    descriptor.name,
    descriptor.id,
    descriptor.ariaLabel,
    descriptor.placeholder,
    descriptor.inputMode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return SENSITIVE_CONTROL_PATTERN.test(signature);
}
