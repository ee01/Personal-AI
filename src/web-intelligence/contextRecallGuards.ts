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
const LOW_INFORMATION_CONTEXT_RECALL_SHELL_PATTERN =
  /(发送位置|当前位置|当前这个|当前.*(?:群|群聊|会话)|ringcentral\s*(?:群|group)|send(?:ing)?\s+location|current\s+(?:ringcentral\s+)?(?:group|chat|thread)|content\s*[:：]?)/i;
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
const CONTEXT_SELECTION_MIN_SIGNAL_CHARS = 12;
const CONTEXT_SELECTION_MIN_CJK_CHARS = 6;
const MEMORY_CAPTURE_SELECTION_MIN_SIGNAL_CHARS = 28;
const MEMORY_CAPTURE_SELECTION_MIN_CJK_CHARS = 10;

const CONTEXT_RECALL_SPECIFIC_SIGNAL_PATTERN =
  /\b(action|android|api|approval|billing|blocked|budget|bug|claude|codex|commit|composer|cost|credit|cursor|customer|decision|decided|dependency|design|dollar|estimate|fast|follow[-\s]?up|freshservice|goal|gpt[-\s]?5(?:\.5)?|handoff|hard\s+limit|incident|ios|issue|jira|launch|layout|limit|migration|model|openai|owner|plan|planning|premium\s+request|price|project|quota|rate\s+limit|release|review|risk|ship|soft\s+limit|task|thread|token|todo|usage|ux)\b/i;
const CONTEXT_RECALL_CJK_SPECIFIC_SIGNAL_PATTERN =
  /承诺|依赖|进展|问题|风险|决定|结论|待办|阻塞|负责人|排期|评审|方案|上线|需求|修复|讨论|计划|跟进|设计|布局|客户|事故|审批|迁移|预算|额度|限额|超限|用量|费用|成本|价格|模型|令牌|申请|工具|每月|一个月/;
const CONTEXT_RECALL_ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const CONTEXT_SELECTION_SECRET_PATTERN =
  /(?:-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|\b(?:sk|rk|pk|org|proj)-[A-Za-z0-9_-]{20,}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bxox[abprs]-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|(?:api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|client[_\s-]?secret|id[_\s-]?token|password|passcode|credential|credentials)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{8,})/i;
const CONTEXT_SELECTION_CARD_NUMBER_PATTERN =
  /(?:\b\d[ -]*?){13,19}\b/;

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
  uiSummary?: string;
  snippet?: string;
  sourceLabel?: string;
  sourceTitle?: string;
  displayPriority?: string | null;
  whyRelevant?: string[] | null;
  lensPresentation?: {
    status?: string | null;
    informationValue?: string | null;
    title?: string | null;
    extractedInfo?: string | null;
    novelty?: string | null;
  } | null;
  cue?: {
    cueText?: string | null;
    compileStatus?: string | null;
  } | null;
}

export interface ContextRecallMetaCandidate {
  type?: string | null;
  scope?: string | null;
  uiSummary?: string | null;
  sourceLabel?: string | null;
  sourceTitle?: string | null;
  timestamp?: number | null;
  whyMatched?: string | null;
  whyRelevant?: string[] | null;
  reasonType?: string | null;
  evidenceRole?: string | null;
  sourceContext?: string | null;
  metadata?: Record<string, unknown> | null;
}

const CONTEXT_RECALL_SOURCE_LABELS: Record<string, string> = {
  ai_chat: 'AI 对话',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  doubao: '豆包',
  entity: '实体',
  gemini: 'Gemini',
  glip: 'RingCentral 消息',
  jira: 'Jira',
  manual: '手动记忆',
  markdown: 'Markdown',
  meeting: '会议',
  message: '消息',
  rehearsal: '预演提醒',
  reflection: '反思记录',
  reflection_thread: '反思线程',
  source_memory: '资料记忆',
  system: '系统记忆',
  user_core: '用户画像',
  web: '网页',
  webpage: '网页',
};

const CONTEXT_RECALL_SCOPE_LABELS: Record<string, string> = {
  work: '工作记忆',
  personal: '个人记忆',
};

const CONTEXT_RECALL_REASON_TYPE_LABELS: Record<string, string> = {
  context_overlap: '上下文相关',
  direct_reference: '直接关联',
  entity_match: '实体关联',
  entity: '实体关联',
  keyword: '关键词匹配',
  keyword_match: '关键词匹配',
  keyword_overlap: '关键词匹配',
  linked_artifact: '相关资料',
  meeting_series: '同系列会议',
  open_action: '未关闭行动项',
  prior_decision: '历史决策',
  prospective_cue: '预演线索',
  recent_context: '近期上下文',
  recent: '近期上下文',
  same_people: '相关人员',
  same_project: '同一项目',
  semantic: '语义相关',
  semantic_match: '语义相关',
  source: '来源相关',
  source_match: '来源相关',
  time_relevant: '时间相关',
  weak_related: '相关背景',
};

const CONTEXT_RECALL_EVIDENCE_ROLE_LABELS: Record<string, string> = {
  action: '行动项',
  action_item: '行动项',
  artifact: '资料',
  background: '背景信息',
  contradiction: '相反证据',
  context: '背景信息',
  decision: '决策依据',
  direct_evidence: '直接证据',
  evidence: '证据',
  follow_up: '后续事项',
  issue: '问题线索',
  open_question: '开放问题',
  related_context: '相关上下文',
  rehearsal_cue: '预演提醒',
  risk: '风险',
  supporting: '支持证据',
};

const SOURCE_MEMORY_KIND_LABELS: Record<string, string> = {
  jira_comment: 'Jira 评论',
  manual: '手动资料',
  message_reply: '外发回复',
  selection: '选区资料',
  visual_memory: '视觉证据',
  web_ai_prompt: 'AI 提问',
  webpage: '整页资料',
};

const SOURCE_MEMORY_CAPTURE_MODE_LABELS: Record<string, string> = {
  auto: '自动保存',
  manual: '主动保存',
  suggested: '建议保存',
};

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

export function removeContextSiteRecordConflicts(
  rawHostname: string,
  record: Record<string, number>,
): {
  record: Record<string, number>;
  removedHosts: string[];
  changed: boolean;
} {
  const hostname = normalizeContextSiteMuteHost(rawHostname);
  const nextRecord: Record<string, number> = {};
  const removedHosts: string[] = [];
  let changed = false;

  if (!hostname) {
    return { record: { ...record }, removedHosts, changed };
  }

  for (const [rawHost, recordedAt] of Object.entries(record)) {
    const host = normalizeContextSiteMuteHost(rawHost);
    const hostCoversTarget = hostname === host || hostname.endsWith(`.${host}`);
    const targetCoversHost = host === hostname || host.endsWith(`.${hostname}`);

    if (host && (hostCoversTarget || targetCoversHost)) {
      removedHosts.push(host);
      changed = true;
      continue;
    }

    nextRecord[host || rawHost] = recordedAt;
    if (host && host !== rawHost) {
      changed = true;
    }
  }

  return { record: nextRecord, removedHosts, changed };
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
    if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    if (hasSensitiveQueryParam(parsed)) return null;

    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (shouldDropContextQueryParam(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();

    return parsed.href;
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
  if (normalizeContextRecallInfo(match.displayPriority).toLowerCase() === 'hidden') {
    return false;
  }
  const presentationStatus = normalizeContextRecallInfo(
    match.lensPresentation?.status,
  ).toLowerCase();
  const presentationValue = normalizeContextRecallInfo(
    match.lensPresentation?.informationValue,
  ).toLowerCase();
  if (presentationStatus === 'blocked') return false;
  if (
    presentationStatus === 'ready' &&
    presentationValue !== 'low' &&
    normalizeContextRecallInfo(
      match.lensPresentation?.extractedInfo || match.lensPresentation?.title,
    )
  ) {
    return true;
  }

  const title = normalizeContextRecallInfo(match.title);
  const uiSummary = normalizeContextRecallInfo(match.uiSummary);
  const snippet = normalizeContextRecallInfo(match.snippet);
  const sourceTitle = normalizeContextRecallInfo(match.sourceTitle);
  const sourceLabel = normalizeContextRecallInfo(match.sourceLabel);
  const presentationInfo = normalizeContextRecallInfo(
    match.lensPresentation?.extractedInfo,
  );
  const presentationTitle = normalizeContextRecallInfo(
    match.lensPresentation?.title,
  );
  const cueText =
    normalizeContextRecallInfo(match.cue?.compileStatus).toLowerCase() ===
    'compiled'
      ? normalizeContextRecallInfo(match.cue?.cueText)
      : '';

  if (!title && !uiSummary && !snippet && !cueText && !presentationInfo && !presentationTitle) return false;

  const combined = [presentationInfo, presentationTitle, title, uiSummary, snippet, sourceTitle, cueText]
    .filter(Boolean)
    .join(' ');
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

export function formatContextRecallMemoryType(
  type?: string | null,
): string {
  const normalized = normalizeContextRecallInfo(type).toLowerCase();
  switch (normalized) {
    case 'message':
      return '消息记忆';
    case 'chunk':
      return '片段记忆';
    case 'entity':
      return '实体记忆';
    case 'rehearsal':
      return '预演提醒';
    case 'source_memory':
      return '资料记忆';
    default: {
      const cleaned = normalizeContextRecallInfo(type);
      return cleaned ? `${cleaned}记忆` : '记忆';
    }
  }
}

export function formatContextRecallSourceLabel(
  sourceLabel?: string | null,
): string | null {
  const cleaned = normalizeContextRecallInfo(sourceLabel);
  if (!cleaned) return null;
  return CONTEXT_RECALL_SOURCE_LABELS[cleaned.toLowerCase()] || cleaned;
}

export function formatContextRecallScopeLabel(
  scope?: string | null,
): string | null {
  const cleaned = normalizeContextRecallInfo(scope);
  if (!cleaned) return null;
  return CONTEXT_RECALL_SCOPE_LABELS[cleaned.toLowerCase()] || null;
}

export function formatContextRecallReasonType(
  reasonType?: string | null,
): string | null {
  return formatContextRecallEnumLabel(
    reasonType,
    CONTEXT_RECALL_REASON_TYPE_LABELS,
  );
}

export function formatContextRecallEvidenceRole(
  evidenceRole?: string | null,
): string | null {
  return formatContextRecallEnumLabel(
    evidenceRole,
    CONTEXT_RECALL_EVIDENCE_ROLE_LABELS,
  );
}

function formatSourceMemoryMetadataValue(
  value?: string | null,
  labels?: Record<string, string>,
): string | null {
  const cleaned = normalizeContextRecallInfo(value);
  if (!cleaned) return null;
  const normalized = cleaned.toLowerCase();
  return labels?.[normalized] || cleaned;
}

function getContextRecallMetadataText(
  match: ContextRecallMetaCandidate,
  key: string,
): string {
  const metadata = match.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }
  const value = metadata[key];
  if (typeof value === 'string') return normalizeContextRecallInfo(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function isSourceMemoryMetaCandidate(match: ContextRecallMetaCandidate): boolean {
  const type = normalizeContextRecallInfo(match.type).toLowerCase();
  const sourceLabel = normalizeContextRecallInfo(match.sourceLabel).toLowerCase();
  return type === 'source_memory' || sourceLabel === 'source_memory';
}

function getSourceMemoryKindLabel(
  match: ContextRecallMetaCandidate,
): string | null {
  return (
    formatSourceMemoryMetadataValue(
      getContextRecallMetadataText(match, 'sourceKindLabel'),
    ) ||
    formatSourceMemoryMetadataValue(
      getContextRecallMetadataText(match, 'sourceKind'),
      SOURCE_MEMORY_KIND_LABELS,
    )
  );
}

function getSourceMemoryCaptureModeLabel(
  match: ContextRecallMetaCandidate,
): string | null {
  return (
    formatSourceMemoryMetadataValue(
      getContextRecallMetadataText(match, 'captureModeLabel'),
    ) ||
    formatSourceMemoryMetadataValue(
      getContextRecallMetadataText(match, 'captureMode'),
      SOURCE_MEMORY_CAPTURE_MODE_LABELS,
    )
  );
}

export function formatContextRecallDisplayPriorityLabel(
  displayPriority?: string | null,
): string | null {
  const normalized = normalizeContextRecallInfo(displayPriority).toLowerCase();
  if (normalized === 'p1') return '强相关';
  if (normalized === 'p2') return '可能相关';
  return null;
}

export function buildContextRecallPeekFooterItems(
  match: ContextRecallMetaCandidate,
): string[] {
  const sourceLabel = formatContextRecallSourceLabel(match.sourceLabel);
  const sourceTitle = clipContextRecallMetaValue(match.sourceTitle);
  const scopeLabel = formatContextRecallScopeLabel(match.scope);
  const timestamp = formatRecallTimestamp(match.timestamp ?? undefined);
  const staleAgeLabel = formatRecallStaleAgeLabel(match.timestamp ?? undefined);
  const reasonType = formatContextRecallReasonType(match.reasonType);
  const evidenceRole = formatContextRecallEvidenceRole(match.evidenceRole);
  const isSourceMemory = isSourceMemoryMetaCandidate(match);
  const sourceMemoryKind = isSourceMemory
    ? getSourceMemoryKindLabel(match)
    : null;
  const sourceMemoryCaptureMode = isSourceMemory
    ? getSourceMemoryCaptureModeLabel(match)
    : null;
  const items: string[] = [];
  const addUnique = (value?: string | null): void => {
    const cleaned = normalizeContextRecallInfo(value);
    if (!cleaned) return;
    if (items.some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
    items.push(cleaned);
  };

  addUnique(sourceLabel || sourceTitle);
  addUnique(scopeLabel);
  addUnique(timestamp);
  addUnique(staleAgeLabel);
  if (sourceLabel && sourceTitle) addUnique(sourceTitle);
  addUnique(sourceMemoryCaptureMode);
  addUnique(sourceMemoryKind);
  addUnique(reasonType);
  if (evidenceRole !== reasonType) addUnique(evidenceRole);

  return items.slice(0, 5);
}

export function normalizeContextSelectionText(value?: string | null): string {
  return normalizeContextRecallInfo(value)
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .trim();
}

export function isContextSelectionTextEligible(value?: string | null): boolean {
  const text = normalizeContextSelectionText(value);
  if (!text) return false;
  if (hasSensitiveContextSelectionSignal(text)) return false;
  const signalChars = (text.match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
  const cjkChars = (text.match(/[\u3400-\u9fff]/g) || []).length;
  if (
    signalChars < CONTEXT_SELECTION_MIN_SIGNAL_CHARS &&
    cjkChars < CONTEXT_SELECTION_MIN_CJK_CHARS
  ) {
    return false;
  }

  return (
    hasSpecificContextRecallSignal(text) ||
    countContextRecallMeaningfulTokens(text) >= 3 ||
    cjkChars >= CONTEXT_SELECTION_MIN_CJK_CHARS
  );
}

export function isMemoryCaptureSelectionTextEligible(value?: string | null): boolean {
  const text = normalizeContextSelectionText(value);
  if (!text) return false;
  if (hasSensitiveContextSelectionSignal(text)) return false;

  const stripped = stripContextRecallShellLabels(text);
  if (looksLikeContextRecallShell(stripped)) return false;

  const signalChars = (stripped.match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
  const cjkChars = (stripped.match(/[\u3400-\u9fff]/g) || []).length;
  if (
    signalChars < MEMORY_CAPTURE_SELECTION_MIN_SIGNAL_CHARS &&
    cjkChars < MEMORY_CAPTURE_SELECTION_MIN_CJK_CHARS
  ) {
    return false;
  }

  return (
    hasSpecificContextRecallSignal(stripped) ||
    countContextRecallMeaningfulTokens(stripped) >= 5 ||
    cjkChars >= MEMORY_CAPTURE_SELECTION_MIN_CJK_CHARS
  );
}

function hasSensitiveContextSelectionSignal(text: string): boolean {
  if (CONTEXT_SELECTION_SECRET_PATTERN.test(text)) {
    return true;
  }

  const cardLike = text.match(CONTEXT_SELECTION_CARD_NUMBER_PATTERN)?.[0];
  if (!cardLike) {
    return false;
  }

  const digits = cardLike.replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 && passesLuhnCheck(digits);
}

function passesLuhnCheck(digits: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let value = Number(digits[index]);
    if (!Number.isInteger(value)) return false;
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum > 0 && sum % 10 === 0;
}

export function buildContextRecallMetaItems(
  match: ContextRecallMetaCandidate,
): string[] {
  const items = [`记忆类型：${formatContextRecallMemoryType(match.type)}`];
  const scopeLabel = formatContextRecallScopeLabel(match.scope);
  const sourceLabel = formatContextRecallSourceLabel(match.sourceLabel);
  const sourceTitle = clipContextRecallMetaValue(match.sourceTitle);
  const timestamp = formatRecallTimestamp(match.timestamp ?? undefined);
  const whyMatched = clipContextRecallMetaValue(match.whyMatched);
  const whyRelevant = (match.whyRelevant || [])
    .map((item) => clipContextRecallMetaValue(item))
    .filter(Boolean)
    .slice(0, 3);
  const reasonType = formatContextRecallReasonType(match.reasonType);
  const evidenceRole = formatContextRecallEvidenceRole(match.evidenceRole);
  const sourceContext = clipContextRecallMetaValue(match.sourceContext);
  const isSourceMemory = isSourceMemoryMetaCandidate(match);
  const sourceMemoryKind = isSourceMemory
    ? getSourceMemoryKindLabel(match)
    : null;
  const sourceMemoryCaptureMode = isSourceMemory
    ? getSourceMemoryCaptureModeLabel(match)
    : null;

  if (sourceLabel) {
    items.push(`来源：${sourceLabel}`);
  }
  if (scopeLabel) {
    items.push(`范围：${scopeLabel}`);
  }
  if (
    sourceTitle &&
    (!sourceLabel || sourceTitle.toLowerCase() !== sourceLabel.toLowerCase())
  ) {
    items.push(`来源标题：${sourceTitle}`);
  }
  if (sourceMemoryKind) {
    items.push(`资料类型：${sourceMemoryKind}`);
  }
  if (sourceMemoryCaptureMode) {
    items.push(`保存方式：${sourceMemoryCaptureMode}`);
  }
  if (timestamp) {
    items.push(`记录时间：${timestamp}`);
  }
  if (reasonType) {
    items.push(`匹配类型：${reasonType}`);
  }
  if (evidenceRole) {
    items.push(`证据角色：${evidenceRole}`);
  }
  if (whyMatched) {
    items.push(`匹配原因：${whyMatched}`);
  }
  if (whyRelevant.length) {
    items.push(`关联锚点：${whyRelevant.join(' / ')}`);
  }
  if (sourceContext) {
    items.push(`来源上下文：${sourceContext}`);
  }

  return items;
}

export function buildContextRecallCompactMetaItems(
  match: ContextRecallMetaCandidate,
): string[] {
  const scopeLabel = formatContextRecallScopeLabel(match.scope);
  const sourceLabel = formatContextRecallSourceLabel(match.sourceLabel);
  const sourceTitle = clipContextRecallMetaValue(match.sourceTitle);
  const timestamp = formatRecallTimestamp(match.timestamp ?? undefined);
  const reasonType = formatContextRecallReasonType(match.reasonType);
  const isSourceMemory = isSourceMemoryMetaCandidate(match);
  const sourceMemoryKind = isSourceMemory
    ? getSourceMemoryKindLabel(match)
    : null;
  const sourceMemoryCaptureMode = isSourceMemory
    ? getSourceMemoryCaptureModeLabel(match)
    : null;
  const items: string[] = [];

  if (
    sourceTitle &&
    (!sourceLabel || sourceTitle.toLowerCase() !== sourceLabel.toLowerCase())
  ) {
    items.push(sourceTitle);
  } else if (sourceLabel) {
    items.push(sourceLabel);
  }
  if (scopeLabel) {
    items.push(scopeLabel);
  }
  if (sourceMemoryCaptureMode) {
    items.push(sourceMemoryCaptureMode);
  }
  if (sourceMemoryKind) {
    items.push(sourceMemoryKind);
  }
  if (timestamp) {
    items.push(timestamp);
  }
  if (reasonType) {
    items.push(reasonType);
  }

  return items;
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

function clipContextRecallMetaValue(value?: string | null): string {
  const cleaned = normalizeContextRecallInfo(value);
  if (cleaned.length <= 90) return cleaned;
  return `${cleaned.slice(0, 90).trimEnd()}...`;
}

function formatContextRecallEnumLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
): string | null {
  const cleaned = normalizeContextRecallInfo(value);
  if (!cleaned) return null;

  const normalized = cleaned.toLowerCase();
  const label = labels[normalized];
  if (label) return label;

  return cleaned
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
      /\b(calendar event|content|current context|current group|current chat|current thread|group|meeting|memory|related memory|send(?:ing)? location|source|webpage|web page|page)\b\s*[:：-]*/gi,
      ' ',
    )
    .replace(/(?:^|\s)(会议|网页|页面|来源|记忆|相关记忆|内容|发送位置|当前位置|当前这个|当前|这个|群聊|群|会话|消息)\s*[:：-]*/g, ' ')
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
  if (
    LOW_INFORMATION_CONTEXT_RECALL_SHELL_PATTERN.test(value) &&
    countContextRecallMeaningfulTokens(comparable) < 2 &&
    countContextRecallCjkSignalChars(comparable) < 8
  ) {
    return true;
  }
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

function formatRecallStaleAgeLabel(timestamp?: number): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  const ms = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const ageMs = Date.now() - ms;
  if (!Number.isFinite(ageMs) || ageMs < 0) return null;

  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (ageDays >= 365) {
    const ageYears = Math.max(1, Math.floor(ageDays / 365));
    return `${ageYears}年前记录，行动前复核`;
  }
  if (ageDays >= 90) {
    return `${ageDays}天前记录，行动前复核`;
  }
  return null;
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
