const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export const CONTEXT_SITE_MUTE_STORAGE_KEY = 'pai-context-muted-sites-v1';
export const CONTEXT_SITE_BLOCK_STORAGE_KEY = 'pai-context-blocked-sites-v1';
export const CONTEXT_PAGE_BLOCK_STORAGE_KEY = 'pai-context-blocked-page-prefixes-v1';
export const CONTEXT_SITE_ALLOW_STORAGE_KEY = 'pai-context-allowed-sites-v1';
export const CONTEXT_SITE_ALLOWLIST_MODE_STORAGE_KEY =
  'pai-context-site-allowlist-mode-v1';
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
const CONTEXT_RECALL_GENERIC_TERMS = new Set([
  'about',
  'accepted',
  'am',
  'apr',
  'aug',
  'calendar',
  'context',
  'current',
  'declined',
  'dec',
  'didn',
  'event',
  'feb',
  'fri',
  'jan',
  'jul',
  'jun',
  'mar',
  'may',
  'meeting',
  'memory',
  'mon',
  'nov',
  'oct',
  'page',
  'participants',
  'pm',
  'recall',
  'related',
  'respond',
  'ringcentral',
  'sat',
  'sep',
  'source',
  'sun',
  'thu',
  'tue',
  'video',
  'web',
  'webpage',
  'wed',
]);

const CONTEXT_RECALL_SPECIFIC_SIGNAL_PATTERN =
  /\b(action|android|api|approval|blocked|bug|commit|customer|decision|decided|dependency|design|estimate|follow[-\s]?up|handoff|incident|ios|issue|jira|launch|layout|migration|owner|plan|planning|project|release|review|risk|ship|task|thread|todo|ux)\b/i;
const CONTEXT_RECALL_CJK_SPECIFIC_SIGNAL_PATTERN =
  /承诺|依赖|进展|问题|风险|决定|结论|待办|阻塞|负责人|排期|评审|方案|上线|需求|修复|讨论|计划|跟进|设计|布局|客户|事故|审批|迁移/;
const CONTEXT_RECALL_ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;

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
export type ContextSiteBlockRecord = Record<string, number>;
export type ContextPageBlockRecord = Record<string, number>;
export type ContextSiteAllowRecord = Record<string, number>;

export interface DisplayableContextRecallCandidate {
  title?: string;
  snippet?: string;
  sourceLabel?: string;
  sourceTitle?: string;
}

export function normalizeContextSiteMuteHost(rawHostname: string): string {
  return rawHostname.trim().toLowerCase().replace(/\.$/, '');
}

export function normalizeContextPageBlockPrefix(
  rawUrl: string,
): string | null {
  const value = rawUrl.trim();
  if (!value) return null;

  try {
    const url = new URL(
      value.includes('://') ? value : `https://${value}`,
    );
    if (!SAFE_EXTERNAL_PROTOCOLS.has(url.protocol)) return null;

    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';

    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') return null;
    return `${url.origin}${pathname}`;
  } catch (_error) {
    return null;
  }
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

export function pruneContextSiteBlockRecord(
  rawValue: unknown,
): { record: ContextSiteBlockRecord; changed: boolean } {
  return prunePersistentContextSiteRecord(rawValue);
}

export function pruneContextSiteAllowRecord(
  rawValue: unknown,
): { record: ContextSiteAllowRecord; changed: boolean } {
  return prunePersistentContextSiteRecord(rawValue);
}

function prunePersistentContextSiteRecord(
  rawValue: unknown,
): { record: Record<string, number>; changed: boolean } {
  const record: Record<string, number> = {};
  let changed = false;

  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { record, changed: Boolean(rawValue) };
  }

  for (const [rawHost, rawBlockedAt] of Object.entries(rawValue)) {
    const host = normalizeContextSiteMuteHost(rawHost);
    if (!host || typeof rawBlockedAt !== 'number' || !Number.isFinite(rawBlockedAt) || rawBlockedAt <= 0) {
      changed = true;
      continue;
    }

    if (host !== rawHost) {
      changed = true;
    }
    record[host] = rawBlockedAt;
  }

  return { record, changed };
}

export function isContextHostCoveredBySiteRecord(
  rawHostname: string,
  record: Record<string, number>,
): boolean {
  const hostname = normalizeContextSiteMuteHost(rawHostname);
  if (!hostname) return false;

  return Object.keys(record).some((rawHost) => {
    const host = normalizeContextSiteMuteHost(rawHost);
    if (!host) return false;
    return hostname === host || hostname.endsWith(`.${host}`);
  });
}

export function pruneContextPageBlockRecord(
  rawValue: unknown,
): { record: ContextPageBlockRecord; changed: boolean } {
  const record: ContextPageBlockRecord = {};
  let changed = false;

  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { record, changed: Boolean(rawValue) };
  }

  for (const [rawPrefix, rawBlockedAt] of Object.entries(rawValue)) {
    const prefix = normalizeContextPageBlockPrefix(rawPrefix);
    if (
      !prefix ||
      typeof rawBlockedAt !== 'number' ||
      !Number.isFinite(rawBlockedAt) ||
      rawBlockedAt <= 0
    ) {
      changed = true;
      continue;
    }

    if (prefix !== rawPrefix) {
      changed = true;
    }
    record[prefix] = rawBlockedAt;
  }

  return { record, changed };
}

export function isContextPageUrlBlockedByPrefix(
  rawUrl: string,
  record: ContextPageBlockRecord,
): boolean {
  const currentPrefix = normalizeContextPageBlockPrefix(rawUrl);
  if (!currentPrefix) return false;

  return Object.keys(record).some((rawPrefix) => {
    const prefix = normalizeContextPageBlockPrefix(rawPrefix);
    if (!prefix) return false;
    return (
      currentPrefix === prefix ||
      currentPrefix.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
    );
  });
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

export function isDisplayableContextRecallMatch(
  match: DisplayableContextRecallCandidate | null | undefined,
): boolean {
  if (!match) return false;

  const title = normalizeContextRecallInfo(match.title);
  const snippet = normalizeContextRecallInfo(match.snippet);
  const sourceTitle = normalizeContextRecallInfo(match.sourceTitle);
  const sourceLabel = normalizeContextRecallInfo(match.sourceLabel);

  if (!title && !snippet) return false;

  const combined = [title, snippet, sourceTitle].filter(Boolean).join(' ');
  const stripped = stripContextRecallShellLabels(combined);
  const hasSpecificSignal = hasSpecificContextRecallSignal(stripped);
  const meaningfulTokenCount = countContextRecallMeaningfulTokens(stripped);
  const cjkSignalChars = countContextRecallCjkSignalChars(stripped);

  const duplicatesLabel =
    snippet.length > 0 &&
    [title, sourceTitle, sourceLabel].some((label) =>
      label ? areEquivalentContextRecallTexts(snippet, label) : false,
    );
  if (
    duplicatesLabel &&
    !hasSpecificSignal &&
    meaningfulTokenCount < 4 &&
    cjkSignalChars < 8
  ) {
    return false;
  }

  if (
    looksLikeContextRecallShell(combined) &&
    !hasSpecificSignal &&
    meaningfulTokenCount < 3 &&
    cjkSignalChars < 8
  ) {
    return false;
  }

  const signalChars =
    (stripped.match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
  if (!hasSpecificSignal && signalChars < 10) return false;

  return hasSpecificSignal || meaningfulTokenCount >= 3 || cjkSignalChars >= 8;
}

export function isLowValueContextHost(rawHostname: string): boolean {
  const hostname = rawHostname.trim().toLowerCase();
  if (!hostname) return true;
  if (LOW_VALUE_CONTEXT_HOSTS.has(hostname)) return true;
  return LOW_VALUE_CONTEXT_HOST_SUFFIXES.some((suffix) =>
    hostname.endsWith(suffix),
  );
}

function normalizeContextRecallInfo(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeContextRecallComparable(value: string): string {
  return stripContextRecallShellLabels(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripContextRecallShellLabels(value: string): string {
  return value
    .replace(
      /\b(calendar event|current context|meeting|memory|related memory|source|webpage|web page|page)\b\s*[:：-]*/gi,
      ' ',
    )
    .replace(/(?:^|\s)(会议|网页|页面|来源|记忆|相关记忆)\s*[:：-]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areEquivalentContextRecallTexts(left: string, right: string): boolean {
  const normalizedLeft = normalizeContextRecallComparable(left);
  const normalizedRight = normalizeContextRecallComparable(right);
  return (
    normalizedLeft.length > 0 &&
    normalizedRight.length > 0 &&
    normalizedLeft === normalizedRight
  );
}

function looksLikeContextRecallShell(value: string): boolean {
  const comparable = normalizeContextRecallComparable(value);
  if (!comparable) return true;
  return (
    comparable === 'ringcentral video' ||
    comparable === 'video meetings' ||
    comparable === 'meeting' ||
    comparable === 'calendar event' ||
    comparable === 'webpage' ||
    comparable === 'page' ||
    /\bringcentral video\b/.test(comparable)
  );
}

function hasSpecificContextRecallSignal(value: string): boolean {
  return (
    CONTEXT_RECALL_ISSUE_KEY_PATTERN.test(value) ||
    CONTEXT_RECALL_SPECIFIC_SIGNAL_PATTERN.test(value) ||
    CONTEXT_RECALL_CJK_SPECIFIC_SIGNAL_PATTERN.test(value)
  );
}

function countContextRecallCjkSignalChars(value: string): number {
  const withoutShellTerms = stripContextRecallShellLabels(value).replace(
    /会议|网页|页面|来源|记忆|相关|当前/g,
    '',
  );
  return (withoutShellTerms.match(/[\u3400-\u9fff]/g) || []).length;
}

function countContextRecallMeaningfulTokens(value: string): number {
  const tokens = value.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) || [];
  return new Set(
    tokens.filter((token) => {
      if (token.length < 2) return false;
      if (/^\d+$/.test(token)) return false;
      return !CONTEXT_RECALL_GENERIC_TERMS.has(token);
    }),
  ).size;
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
