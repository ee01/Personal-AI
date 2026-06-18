import { setDesktopLanguage, t } from './i18n.js';

const bridgeApi = window.bridgeApi;
const explorerApi = window.explorerApi;
const quickAsk = window.quickAsk;
const appShell = window.appShell;

const UI_STATES = new Set([
  'idle-compact',
  'pending',
  'streaming',
  'enriched',
  'voice-listening',
  'voice-ready',
]);

const elements = {
  shell: document.getElementById('quick-ask-shell'),
  frame: document.getElementById('quick-ask-frame'),
  conversationPanel: document.getElementById('conversation-panel'),
  composerPanel: document.getElementById('composer-panel'),
  composer: document.getElementById('composer'),
  utilityButton: document.getElementById('utility-button'),
  statusPill: document.getElementById('status-pill'),
  voiceButton: document.getElementById('voice-button'),
  scopeWorkButton: document.getElementById('scope-work-button'),
  scopePersonalButton: document.getElementById('scope-personal-button'),
  scopeBothButton: document.getElementById('scope-both-button'),
  pendingHint: document.getElementById('pending-hint'),
  shortcutBanner: document.getElementById('shortcut-banner'),
  voiceSheet: document.getElementById('voice-sheet'),
  voiceTranscript: document.getElementById('voice-transcript'),
  voiceRecovery: document.getElementById('voice-recovery'),
  voiceReceipt: document.getElementById('voice-receipt'),
  voiceOrb: document.getElementById('voice-orb'),
  voiceCancel: document.getElementById('voice-cancel'),
  voiceSend: document.getElementById('voice-send'),
};

const STATUS_HINTS = {
  setup_blocker: '帮我总结现在还缺哪些配置步骤。',
  runtime_issue: '帮我解释状态读取异常，并告诉我应该先重试还是检查配置。',
  sync_issue: '帮我解释豆包同步异常，并告诉我下一步该查什么。',
  confirm_request: '帮我总结这些待确认项，告诉我应该先处理哪个。',
  running_action: '帮我解释这些执行中的动作，当前卡在什么地方。',
  waiting_reply: '帮我总结这些外部询问状态，接下来应该跟进什么。',
  queued_action: '帮我总结这些排队中的动作，哪些值得先处理。',
};

const STATUS_SOURCE_LABELS = {
  setup_blocker: 'Desktop App 设置',
  runtime_issue: 'Memory Service 状态',
  sync_issue: '本机同步流水',
  confirm_request: 'Memory Service 确认请求',
  running_action: 'Action Queue',
  waiting_reply: 'Outreach 运行态',
  queued_action: 'Action Queue',
};

const STATUS_PRIORITY_RECEIPTS = {
  setup_blocker: '优先处理：缺配置会阻断同步、查询或写回。',
  runtime_issue: '先确认状态：读取失败时不能把旧状态当最新。',
  sync_issue: '需要恢复：最近同步失败，先看失败链路和重试条件。',
  confirm_request: '需要你确认：不会自动写入或发送。',
  running_action: '正在执行：用来判断动作是否卡住或仍在推进。',
  waiting_reply: '外部询问：先区分待你批准发送，还是等待对方回复。',
  queued_action: '尚未执行：先确认排队动作是否仍值得处理。',
};

const HEIGHTS = {
  /** Keep equal to `ASK_WINDOW_COMPACT_HEIGHT` in `app/main.mjs`. */
  compact: 140,
  compactWithBanner: 188,
  voice: 254,
  /** Expanded heights (~+50%) so answer area is less cramped. */
  streaming: 714,
  enriched: 816,
};

const STREAM_FLUSH_MS = 42;
const ENRICHMENT_DELAY_MS = 150;
const SESSION_EXPIRY_MS = 30 * 60 * 1000;
const HISTORY_LOAD_BATCH_SIZE = 1;
const AUTO_SCROLL_THRESHOLD_PX = 36;
const HISTORY_LOAD_THRESHOLD_PX = 18;
const STREAMING_TAIL_CHARS = 14;
const DRAFT_STORAGE_KEY = 'desktop-app.quick-ask.draft';
const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel?authuser=0&hl=zh-CN';

const REMEMBER_INTENT_PATTERNS = [
  /^(?:请帮我|帮我|麻烦你|请你|请)?\s*(?:记住|记下|记录|保存)(?!了吗|吗|没|没有|哪些|什么)(?:一下|到(?:长期)?记忆|在(?:长期)?记忆里)?[：:\s]*/i,
  /^以后(?:请|帮我|麻烦你)?\s*(?:记住|记下|记录)(?!了吗|吗|没|没有|哪些|什么)[：:\s]*/i,
  /^(?:please\s+)?(?:remember|save|note)(?:\s+(?:that|this))?(?:[\s:：]|$)/i,
];

const DEICTIC_ASK_PATTERN =
  /那个|这个|这块|那块|刚才|上面|前面|ready\s*了吗|搞定了吗|完成了吗|\bthat\b|\bthis\b|\bit\b|\bready\b/i;
const ROLE_ONLY_TERM_PATTERN =
  /^(?:BE|FE|backend|back\s*end|frontend|front\s*end|后端|服务端|前端|客户端|ready)$/i;
const RINGCENTRAL_HOST_PATTERN = /(?:^|\.)ringcentral\.com$/i;
const RINGCENTRAL_CHAT_TITLE_PATTERN =
  /\b[A-Z][A-Z0-9]+-\d+\s*[:：]\s*[^\n|]{2,96}/;
const ACTIVE_CONTEXT_VISIBLE_TEXT_LIMIT = 1200;

const state = {
  uiState: 'idle-compact',
  runtime: null,
  currentSessionMessages: [],
  currentTurns: [],
  currentSessionStartedAt: 0,
  currentSessionUpdatedAt: 0,
  historySessions: [],
  loadedHistoryCount: 0,
  draft: '',
  requestActive: false,
  shortcutStatus: null,
  notice: '',
  noticeTimer: null,
  streamMessageId: null,
  streamBuffer: '',
  streamFlushTimer: null,
  voiceDraft: '',
  voicePhase: 'idle',
  voiceLocale: 'zh-CN',
  askScope: 'work',
  autoScrollPinned: true,
  loadingHistory: false,
  savedConversationScrollTop: 0,
  savedConversationScrollHeight: 0,
};

const scopeButtons = [
  ['work', elements.scopeWorkButton],
  ['personal', elements.scopePersonalButton],
  ['both', elements.scopeBothButton],
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

function markdownToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, label, url) =>
      `<a href="${escapeHtml(url)}" data-external-link="${escapeHtml(url)}">${escapeHtml(label)}</a>`,
  );
  return html
    .split(/\n\n+/)
    .filter((item) => item.trim())
    .map((item) => `<p>${item.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function normalizeRememberText(text) {
  const trimmed = text.trim();
  let normalized = trimmed;
  for (const pattern of REMEMBER_INTENT_PATTERNS) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '').trim();
      break;
    }
  }
  return (
    normalized.replace(/^[,，。.!！\s]+|[,，。.!！\s]+$/g, '').trim() ||
    trimmed
  );
}

function hasExplicitRememberIntent(text) {
  const trimmed = text.trim();
  return REMEMBER_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isStandaloneRememberRequest(text) {
  if (!hasExplicitRememberIntent(text)) return false;
  if (/[?？]/.test(text)) return false;
  const segments = text
    .split(/[。.!！\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return segments.length <= 1;
}

function buildAskContext() {
  const segments = state.currentTurns
    .slice(-4)
    .map((turn) => {
      const parts = [];
      if (turn.userText) parts.push(`User: ${turn.userText}`);
      if (turn.assistantText) parts.push(`Assistant: ${turn.assistantText}`);
      return parts.join('\n');
    })
    .filter(Boolean);

  let context = segments.join('\n\n');
  while (context.length > 4000 && segments.length > 1) {
    segments.shift();
    context = segments.join('\n\n');
  }
  return context.slice(-4000);
}

function normalizeInlineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clipText(value, limit) {
  const text = normalizeInlineText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function formatRelativeAge(value, justNowLabel = '刚刚刷新') {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return '时间未知';
  const diffMs = Math.max(0, Date.now() - time);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (diffMs < minuteMs) return justNowLabel;
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)} 分钟前`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)} 小时前`;
  return `${Math.floor(diffMs / dayMs)} 天前`;
}

function formatSnapshotRelative(fetchedAt) {
  return formatRelativeAge(fetchedAt, '刚刚刷新');
}

function formatRefreshFailureRelative(failedAt) {
  return formatRelativeAge(failedAt, '刚刚失败');
}

function formatRuntimeSnapshotMeta(runtime) {
  const itemCount = Array.isArray(runtime?.items) ? runtime.items.length : 0;
  const countLabel = itemCount > 0 ? `${itemCount} 项状态` : '暂无状态项';
  return `快照：${formatSnapshotRelative(runtime?.fetchedAt)} · ${countLabel}`;
}

function getRuntimeSnapshotAgeMs(runtime) {
  const time = Date.parse(runtime?.fetchedAt || '');
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Date.now() - time);
}

function formatStatusItemFreshness(runtime, refreshFailure = null) {
  if (refreshFailure?.error) {
    const failedLabel = formatRefreshFailureRelative(refreshFailure.failedAt);
    const snapshotLabel = formatSnapshotRelative(runtime?.fetchedAt);
    return {
      label: '刷新失败 · 上次快照',
      tone: 'refresh-failed',
      prompt: `${failedLabel}：重新读取失败，当前状态未确认；下面仍是 ${snapshotLabel} 的上次成功快照。错误：${clipText(
        refreshFailure.error,
        90,
      )}`,
    };
  }

  const ageMs = getRuntimeSnapshotAgeMs(runtime);
  if (ageMs === null) {
    return {
      label: '来源时间未知',
      tone: 'unknown',
      prompt: '这条状态的读取时间未知，先重新读取后再行动。',
    };
  }

  const minuteMs = 60 * 1000;
  if (ageMs < minuteMs) {
    return {
      label: '刚刚读取',
      tone: 'fresh',
      prompt: '这条状态来自刚刚读取的快照。',
    };
  }

  const minutes = Math.floor(ageMs / minuteMs);
  if (minutes <= 15) {
    return {
      label: `${minutes} 分钟前读取`,
      tone: 'recent',
      prompt: `这条状态来自 ${minutes} 分钟前的快照。`,
    };
  }

  return {
    label: '旧快照 · 先重新读取',
    tone: 'stale',
    prompt: `这条状态来自 ${minutes} 分钟前的旧快照，先点重新读取确认它是否仍然存在。`,
  };
}

function getStatusSourceLabel(kind) {
  return STATUS_SOURCE_LABELS[kind] || '运行态汇总';
}

function getStatusPriorityReceipt(item) {
  return (
    item?.priorityReceipt ||
    STATUS_PRIORITY_RECEIPTS[item?.kind] ||
    '运行态提示：这条状态需要你决定下一步。'
  );
}

function getStatusRefreshFailure(message) {
  const error = normalizeInlineText(message?.statusRefreshError || '');
  if (!error) return null;
  return {
    error,
    failedAt: message?.statusRefreshFailedAt || new Date().toISOString(),
  };
}

function getUrlHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function extractQueryAnchors(query) {
  const anchors = [];
  const text = String(query || '');
  for (const issueKey of text.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || []) {
    anchors.push(issueKey);
  }
  for (const phrase of text.match(/\b[A-Z][A-Z0-9]{1,9}(?:\s+[A-Z][A-Z0-9]{1,9})+\b/g) || []) {
    if (!phrase.split(/\s+/).every((term) => ROLE_ONLY_TERM_PATTERN.test(term))) {
      anchors.push(phrase);
    }
  }
  for (const token of text.match(/[A-Za-z0-9][A-Za-z0-9._-]{1,}|[\u3400-\u9fff]{2,}/g) || []) {
    if (ROLE_ONLY_TERM_PATTERN.test(token)) continue;
    if (/^(?:那个|这个|了吗|如何|什么|是否|the|this|that|ready)$/i.test(token)) continue;
    anchors.push(token);
  }
  const seen = new Set();
  return anchors.filter((anchor) => {
    const key = anchor.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return key.length >= 2;
  });
}

function textContainsAnyAnchor(text, anchors) {
  const haystack = normalizeInlineText(text).toLowerCase();
  return anchors.some((anchor) => haystack.includes(anchor.toLowerCase()));
}

function extractRingCentralChatTitle(activeContext) {
  const candidates = [
    activeContext?.title,
    activeContext?.selectionText,
    activeContext?.visibleText,
  ];
  for (const candidate of candidates) {
    const match = String(candidate || '').match(RINGCENTRAL_CHAT_TITLE_PATTERN);
    if (match?.[0]) {
      return clipText(match[0].replace(/\s+/g, ' '), 120);
    }
  }
  const title = normalizeInlineText(activeContext?.title);
  if (title && !/^RingCentral$/i.test(title)) {
    return clipText(title, 120);
  }
  return '';
}

function shouldUseActiveBrowserContext(query, activeContext) {
  if (!activeContext?.available) return false;
  const host = getUrlHost(activeContext.url);
  const combined = [
    activeContext.title,
    activeContext.url,
    activeContext.selectionText,
    activeContext.visibleText,
  ].join(' ');
  const anchors = extractQueryAnchors(query);
  const isRingCentral = RINGCENTRAL_HOST_PATTERN.test(host);
  if (isRingCentral) return true;
  if (activeContext.selectionText && textContainsAnyAnchor(activeContext.selectionText, anchors)) {
    return true;
  }
  if (DEICTIC_ASK_PATTERN.test(query)) {
    return false;
  }
  return anchors.length > 0 && textContainsAnyAnchor(combined, anchors);
}

function formatActiveBrowserContext(query, activeContext) {
  if (!shouldUseActiveBrowserContext(query, activeContext)) return '';
  const host = getUrlHost(activeContext.url);
  const isRingCentral = RINGCENTRAL_HOST_PATTERN.test(host);
  const ringCentralChatTitle = isRingCentral
    ? extractRingCentralChatTitle(activeContext)
    : '';
  const surface = isRingCentral
    ? ringCentralChatTitle
      ? 'RingCentral chat'
      : 'RingCentral page'
    : host
      ? `Browser page (${host})`
      : 'Browser page';
  const lines = [`Surface: ${surface}.`];
  if (ringCentralChatTitle) {
    lines.push(`Current chat title: ${ringCentralChatTitle}.`);
  } else if (activeContext.title) {
    lines.push(`Current page title: ${clipText(activeContext.title, 140)}.`);
  }
  if (activeContext.url) {
    lines.push(`Current URL: ${clipText(activeContext.url, 220)}`);
  }
  if (activeContext.selectionText) {
    lines.push(`Selected text: ${clipText(activeContext.selectionText, 500)}`);
  }
  if (activeContext.visibleText) {
    lines.push(
      `Visible page text: ${clipText(
        activeContext.visibleText,
        ACTIVE_CONTEXT_VISIBLE_TEXT_LIMIT,
      )}`,
    );
  }
  return lines.join('\n');
}

async function buildEnrichedAskContext(query) {
  const segments = [buildAskContext()];
  if (typeof quickAsk.getActiveBrowserContext === 'function') {
    try {
      const activeContext = await quickAsk.getActiveBrowserContext();
      const activeContextText = formatActiveBrowserContext(query, activeContext);
      if (activeContextText) {
        segments.push(activeContextText);
      }
    } catch {
      // Active browser context is opportunistic; ask should still work without it.
    }
  }
  let context = segments.filter(Boolean).join('\n\n');
  return context.slice(-4000);
}

function isVoiceState() {
  return state.uiState === 'voice-listening' || state.uiState === 'voice-ready';
}

function normalizeAskScope(value) {
  if (value === 'personal' || value === 'both') {
    return value;
  }
  return 'work';
}

function getAskScopeLabel(scope = state.askScope) {
  if (scope === 'personal') return t('common.personal');
  if (scope === 'both') return t('common.both');
  return t('common.work');
}

function isExpandedState() {
  return (
    state.uiState === 'pending' ||
    state.uiState === 'streaming' ||
    state.uiState === 'enriched'
  );
}

function autoResizeComposer() {
  elements.composer.style.height = '0px';
  elements.composer.style.height = `${Math.min(elements.composer.scrollHeight, 180)}px`;
}

function focusComposer() {
  elements.composer.focus();
  elements.composer.setSelectionRange(
    elements.composer.value.length,
    elements.composer.value.length,
  );
}

function setDraft(value) {
  state.draft = value;
  elements.composer.value = value;
  autoResizeComposer();
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, value);
  } catch {
    // Ignore localStorage failures.
  }
}

function setUiState(nextState) {
  if (!UI_STATES.has(nextState)) return;
  state.uiState = nextState;
  elements.shell.dataset.state = nextState;
  elements.pendingHint.hidden = nextState !== 'pending';
  renderScopeSelector();
  scheduleLayoutSync();
}

function resolveVoiceLocale() {
  if (state.voiceLocale === 'auto') {
    return navigator.language || 'zh-CN';
  }
  return state.voiceLocale || 'zh-CN';
}

function showNotice(message, durationMs = 3600) {
  if (state.noticeTimer) {
    window.clearTimeout(state.noticeTimer);
  }
  state.notice = message;
  renderShortcutBanner();
  state.noticeTimer = window.setTimeout(() => {
    state.notice = '';
    state.noticeTimer = null;
    renderShortcutBanner();
  }, durationMs);
}

function renderScopeSelector() {
  for (const [scope, button] of scopeButtons) {
    if (!button) continue;
    const active = state.askScope === scope;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.disabled = state.requestActive;
  }
}

async function loadAskScopePreference() {
  try {
    const settings = await bridgeApi.getSettings();
    state.askScope = normalizeAskScope(
      settings?.effective?.explorer?.askDefaultScope,
    );
    renderScopeSelector();
    return;
  } catch {
    // Fall through to explorer status as a secondary source.
  }

  try {
    const explorerStatus = await explorerApi.getStatus();
    state.askScope = normalizeAskScope(explorerStatus?.askDefaultScope);
  } catch {
    state.askScope = 'work';
  }
  renderScopeSelector();
}

async function persistAskScope(scope) {
  state.askScope = normalizeAskScope(scope);
  renderScopeSelector();
  try {
    const settings = await bridgeApi.getSettings();
    const explorerSettings = settings?.effective?.explorer;
    if (!explorerSettings) return;
    const saved = await bridgeApi.updateSettings({
      explorer: {
        ...explorerSettings,
        askDefaultScope: state.askScope,
      },
    });
    state.askScope = normalizeAskScope(
      saved?.effective?.explorer?.askDefaultScope,
    );
    renderScopeSelector();
  } catch (error) {
    showNotice(
      error instanceof Error
        ? `范围已切换，但默认值保存失败：${error.message}`
        : '范围已切换，但默认值保存失败。',
      4200,
    );
  }
}

function renderShortcutBanner() {
  const message =
    state.notice ||
    (state.shortcutStatus &&
    state.shortcutStatus.permissionGranted === false &&
    !isVoiceState()
      ? state.shortcutStatus.message
      : '');
  elements.shortcutBanner.hidden = !message;
  elements.shortcutBanner.textContent = message || '';
  scheduleLayoutSync();
}

function desiredHeight() {
  if (isVoiceState()) {
    return HEIGHTS.voice;
  }
  if (!isExpandedState()) {
    return elements.shortcutBanner.hidden
      ? HEIGHTS.compact
      : HEIGHTS.compactWithBanner;
  }

  return state.uiState === 'enriched' ? HEIGHTS.enriched : HEIGHTS.streaming;
}

let layoutFrame = null;

function scheduleLayoutSync() {
  if (layoutFrame) {
    window.cancelAnimationFrame(layoutFrame);
  }
  layoutFrame = window.requestAnimationFrame(async () => {
    try {
      await quickAsk.setLayout({
        mode: state.uiState,
        height: desiredHeight(),
      });
    } catch {
      return;
    }
  });
}

function cloneValue(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function hasCurrentSessionMessages() {
  return state.currentSessionMessages.length > 0;
}

function getCurrentSessionLastActivityAt() {
  return (
    state.currentSessionUpdatedAt ||
    state.currentSessionMessages.at(-1)?.createdAt ||
    0
  );
}

function isCurrentSessionExpired(referenceTime = Date.now()) {
  const lastActivityAt = getCurrentSessionLastActivityAt();
  return (
    Boolean(lastActivityAt) &&
    referenceTime - lastActivityAt >= SESSION_EXPIRY_MS
  );
}

function touchCurrentSession(timestamp = Date.now()) {
  if (!state.currentSessionStartedAt) {
    state.currentSessionStartedAt = timestamp;
  }
  state.currentSessionUpdatedAt = timestamp;
}

function ensureCurrentSession() {
  if (!state.currentSessionStartedAt) {
    touchCurrentSession();
  }
}

function clearCurrentSession() {
  state.currentSessionMessages = [];
  state.currentTurns = [];
  state.currentSessionStartedAt = 0;
  state.currentSessionUpdatedAt = 0;
  state.loadedHistoryCount = 0;
  state.autoScrollPinned = true;
}

function archiveCurrentSession() {
  if (!hasCurrentSessionMessages()) {
    clearCurrentSession();
    return false;
  }

  state.historySessions.push({
    id: createId('session'),
    startedAt:
      state.currentSessionStartedAt ||
      state.currentSessionMessages[0]?.createdAt ||
      Date.now(),
    updatedAt: getCurrentSessionLastActivityAt() || Date.now(),
    messages: cloneValue(state.currentSessionMessages),
    turns: cloneValue(state.currentTurns),
  });
  clearCurrentSession();
  return true;
}

function expireCurrentSessionIfNeeded() {
  if (state.requestActive || !isCurrentSessionExpired()) return false;
  return archiveCurrentSession();
}

function resolveExpandedState() {
  if (state.requestActive) {
    const streamMessage = state.currentSessionMessages.find(
      (message) => message.id === state.streamMessageId,
    );
    return streamMessage?.text ? 'streaming' : 'pending';
  }
  return 'enriched';
}

function formatSessionDividerLabel(timestamp) {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} mins ago`;
  }
  const diffHours = Math.max(1, Math.round(diffMinutes / 60));
  if (diffHours < 24) {
    return `${diffHours} hrs ago`;
  }
  const diffDays = Math.max(1, Math.round(diffHours / 24));
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderStreamingCopy(text) {
  const rawText = typeof text === 'string' ? text : '';
  if (!rawText) {
    return '<div class="streaming-copy"><span class="streaming-tail">&nbsp;</span></div>';
  }

  const lastLineBreak = rawText.lastIndexOf('\n');
  if (lastLineBreak >= 0) {
    const head = rawText.slice(0, lastLineBreak + 1);
    const tail = rawText.slice(lastLineBreak + 1);
    return `<div class="streaming-copy">${escapeHtml(head)}<span class="streaming-tail">${escapeHtml(tail || ' ')}</span></div>`;
  }

  const splitIndex = Math.max(0, rawText.length - STREAMING_TAIL_CHARS);
  const head = rawText.slice(0, splitIndex);
  const tail = rawText.slice(splitIndex);
  return `<div class="streaming-copy">${escapeHtml(head)}<span class="streaming-tail">${escapeHtml(tail || ' ')}</span></div>`;
}

function getVisibleSessions() {
  const visibleHistory =
    state.loadedHistoryCount > 0
      ? state.historySessions.slice(-state.loadedHistoryCount)
      : [];
  const sessions = [...visibleHistory];

  if (hasCurrentSessionMessages()) {
    sessions.push({
      id: 'current-session',
      startedAt:
        state.currentSessionStartedAt ||
        state.currentSessionMessages[0]?.createdAt ||
        Date.now(),
      updatedAt: getCurrentSessionLastActivityAt() || Date.now(),
      messages: state.currentSessionMessages,
      turns: state.currentTurns,
      current: true,
    });
  }

  return sessions;
}

function isConversationPinnedToBottom() {
  const { scrollTop, scrollHeight, clientHeight } = elements.conversationPanel;
  return scrollHeight - (scrollTop + clientHeight) <= AUTO_SCROLL_THRESHOLD_PX;
}

function scrollConversationToBottom() {
  elements.conversationPanel.scrollTop =
    elements.conversationPanel.scrollHeight;
}

function saveConversationScrollState() {
  if (!isExpandedState()) return;
  state.savedConversationScrollTop = elements.conversationPanel.scrollTop;
  state.savedConversationScrollHeight = elements.conversationPanel.scrollHeight;
  state.autoScrollPinned = isConversationPinnedToBottom();
}

function syncConversationScroll({ preserveTop, keepBottom, restoreScrollTop } = {}) {
  window.requestAnimationFrame(() => {
    if (!isExpandedState()) return;

    if (typeof restoreScrollTop === 'number' && Number.isFinite(restoreScrollTop)) {
      const maxScrollTop = Math.max(
        0,
        elements.conversationPanel.scrollHeight -
          elements.conversationPanel.clientHeight,
      );
      elements.conversationPanel.scrollTop = Math.min(
        Math.max(0, restoreScrollTop),
        maxScrollTop,
      );
      return;
    }

    if (preserveTop) {
      if (preserveTop.kind === 'prepend') {
        const nextHeight = elements.conversationPanel.scrollHeight;
        elements.conversationPanel.scrollTop =
          preserveTop.scrollTop + (nextHeight - preserveTop.scrollHeight);
        return;
      }
      elements.conversationPanel.scrollTop = preserveTop.scrollTop;
      return;
    }

    if (keepBottom) {
      scrollConversationToBottom();
      return;
    }
  });
}

function formatConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return `置信度 ${Math.round(value * 100)}%`;
}

function renderStructuredAnswer(structuredAnswer) {
  if (!structuredAnswer) return '';
  const sections = [];

  if (structuredAnswer.keyFindings?.length) {
    sections.push(`
      <section class="message-section">
        <h4>关键发现</h4>
        <ul>${structuredAnswer.keyFindings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>
    `);
  }

  if (structuredAnswer.timeline?.length) {
    sections.push(`
      <section class="message-section">
        <h4>时间线</h4>
        <div class="timeline-list">
          ${structuredAnswer.timeline
            .map(
              (item) => `
                <div class="timeline-item">
                  <span class="timeline-date">${escapeHtml(item.date)}</span>
                  <span>${escapeHtml(item.event)}</span>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    `);
  }

  if (structuredAnswer.insights?.length) {
    sections.push(`
      <section class="message-section">
        <h4>进一步洞察</h4>
        <ul>${structuredAnswer.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>
    `);
  }

  if (structuredAnswer.relatedEntities?.length) {
    sections.push(`
      <section class="message-section">
        <h4>相关实体</h4>
        <div class="related-entity-grid">
          ${structuredAnswer.relatedEntities
            .map(
              (item) => `
                <span class="related-entity">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span>${escapeHtml(item.type)}</span>
                </span>
              `,
            )
            .join('')}
        </div>
      </section>
    `);
  }

  if (typeof structuredAnswer.confidence === 'number') {
    sections.push(
      `<div class="confidence-badge">${formatConfidence(structuredAnswer.confidence)}</div>`,
    );
  }

  return sections.join('');
}

function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(text || '');
  return textarea.value;
}

function stripEvidenceHtml(text) {
  return decodeHtmlEntities(
    String(text || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|section|article|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function removeCaptureChrome(text) {
  return text
    .replace(
      /CloseLearn more|Join chat|Restore this version|Ask Gemini|FileEditViewInsertFormatToolsExtensionsHelp|Tab in My Drive|Page setup|Print preview|Create a new doc|Show non-printing characters/gi,
      ' ',
    )
    .replace(/\b(?:English|Deutsch|Italiano|Português|Română|Русский|Українська|中文|日本語|한국어){2,}\b/gi, ' ');
}

function cleanEvidenceText(text) {
  return normalizeInlineText(removeCaptureChrome(stripEvidenceHtml(text)));
}

function isNoisyWebEvidence(item, cleanedText) {
  const metadata =
    item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const source = String(item?.source || '').toLowerCase();
  const sender = String(metadata.sender || '').toLowerCase();
  return (
    source === 'web' &&
    (sender === 'memory capture' ||
      metadata.captureLayer === 'memory_capture' ||
      /Google Docs|docs\.google\.com/i.test(
        [metadata.sourceTitle, metadata.sourceUrl, cleanedText].join(' '),
      )) &&
    /CloseLearn more|Restore this version|Ask Gemini|FileEditViewInsert|Create a new doc|Page setup/i.test(
      String(item?.content || ''),
    )
  );
}

function getEvidenceSourceLabel(item) {
  const source = String(item?.source || item?.type || '').toLowerCase();
  if (source === 'glip' || source === 'ringcentral') return 'RingCentral';
  if (source === 'meeting') return '会议';
  if (source === 'web') return '网页';
  if (source === 'reflection_thread') return '反思';
  if (source === 'manual') return '手动记忆';
  if (source === 'entity') return '实体';
  return item?.source || item?.type || '记忆';
}

function getEvidenceMetadata(item) {
  return item?.metadata &&
    typeof item.metadata === 'object' &&
    !Array.isArray(item.metadata)
    ? item.metadata
    : {};
}

function getEvidenceTitle(item) {
  const metadata = getEvidenceMetadata(item);
  return (
    metadata.sourceTitle ||
    metadata.groupName ||
    metadata.group_name ||
    item?.sourceTitle ||
    item?.displayTitle ||
    item?.source ||
    item?.type ||
    '记忆片段'
  );
}

function getEvidenceHost(item) {
  const metadata = getEvidenceMetadata(item);
  const url = item?.sourceUrl || metadata.sourceUrl || metadata.groupUrl;
  return getUrlHost(url);
}

function formatEvidenceTime(timestamp) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
  const millis = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(millis).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEvidenceReason(item, weak) {
  const metadata = getEvidenceMetadata(item);
  const reasons = [];
  const channels = Array.isArray(metadata.channels) ? metadata.channels : [];
  if (channels.includes('context_anchor')) reasons.push('上下文锚点');
  if (metadata.implicitBackendContext) reasons.push('近期 BE 讨论');
  if (weak) reasons.push('网页快照已折叠');
  const host = getEvidenceHost(item);
  if (host) reasons.push(host);
  return reasons.join(' · ');
}

function getHighlightTerms(query) {
  const terms = extractQueryAnchors(query);
  for (const term of String(query || '').match(/\bBE\b|\bFE\b|ready\b/gi) || []) {
    terms.push(term);
  }
  const seen = new Set();
  return terms
    .map((term) => normalizeInlineText(term))
    .filter((term) => {
      const key = term.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return term.length >= 2;
    })
    .slice(0, 8);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedEvidenceText(text, query) {
  const terms = getHighlightTerms(query);
  if (!terms.length) return escapeHtml(text);
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return escapeHtml(text).replace(pattern, '<mark>$1</mark>');
}

function renderHighlightedLineText(text, query) {
  return renderHighlightedEvidenceText(text, query).replace(/\r?\n/g, '<br>');
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function trimRenderedBreaks(html) {
  return String(html || '').replace(/(?:\s*<br\s*\/?>)+\s*$/i, '');
}

function renderTextWithBareLinks(text, query) {
  const value = String(text || '');
  const urlPattern = /https?:\/\/[^\s<>()]+/g;
  let html = '';
  let lastIndex = 0;
  let match;

  while ((match = urlPattern.exec(value))) {
    const url = match[0];
    html += renderHighlightedLineText(value.slice(lastIndex, match.index), query);
    if (isSafeExternalUrl(url)) {
      html += `<a href="${escapeHtml(url)}" data-external-link="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
    } else {
      html += renderHighlightedLineText(url, query);
    }
    lastIndex = match.index + url.length;
  }

  html += renderHighlightedLineText(value.slice(lastIndex), query);
  return html;
}

function renderPlainEvidenceText(text, query) {
  const value = decodeHtmlEntities(String(text || '')).replace(/\r\n?/g, '\n');
  const markdownLinkPattern = /\[([^\]\n]{1,160})\]\((https?:\/\/[^)\s]+)\)/g;
  let html = '';
  let lastIndex = 0;
  let match;

  while ((match = markdownLinkPattern.exec(value))) {
    const [raw, label, url] = match;
    html += renderTextWithBareLinks(value.slice(lastIndex, match.index), query);
    if (isSafeExternalUrl(url)) {
      html += `<a href="${escapeHtml(url)}" data-external-link="${escapeHtml(url)}">${renderHighlightedLineText(label, query)}</a>`;
    } else {
      html += renderHighlightedLineText(raw, query);
    }
    lastIndex = match.index + raw.length;
  }

  html += renderTextWithBareLinks(value.slice(lastIndex), query);
  return html;
}

const EVIDENCE_BLOCK_TAGS = new Set([
  'address',
  'article',
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'p',
  'section',
]);

const EVIDENCE_INLINE_TAGS = new Set(['b', 'code', 'em', 'i', 'strong']);

function renderEvidenceHtmlChildren(node, query) {
  return Array.from(node.childNodes || [])
    .map((child) => renderEvidenceHtmlNode(child, query))
    .join('');
}

function renderEvidenceHtmlNode(node, query) {
  if (!node) return '';
  if (node.nodeType === 3) {
    return renderPlainEvidenceText(node.nodeValue || '', query);
  }
  if (node.nodeType !== 1) return '';

  const tagName = String(node.tagName || '').toLowerCase();
  if (tagName === 'br') return '<br>';

  const childHtml = renderEvidenceHtmlChildren(node, query);
  if (tagName === 'a') {
    const href = node.getAttribute('href') || '';
    if (isSafeExternalUrl(href)) {
      return `<a href="${escapeHtml(href)}" data-external-link="${escapeHtml(href)}">${childHtml || escapeHtml(href)}</a>`;
    }
    return `<span class="evidence-mention">${childHtml || renderHighlightedLineText(node.textContent || '', query)}</span>`;
  }

  if (EVIDENCE_INLINE_TAGS.has(tagName)) {
    const safeTag = tagName === 'b' ? 'strong' : tagName === 'i' ? 'em' : tagName;
    return `<${safeTag}>${childHtml}</${safeTag}>`;
  }

  if (EVIDENCE_BLOCK_TAGS.has(tagName)) {
    return childHtml ? `${trimRenderedBreaks(childHtml)}<br>` : '';
  }

  return childHtml;
}

function looksLikeHtml(text) {
  return /<\s*\/?[a-z][^>]*>/i.test(String(text || ''));
}

function renderRichEvidenceText(text, query) {
  const value = String(text || '');
  if (!value.trim()) return '';

  if (looksLikeHtml(value) && typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(value, 'text/html');
    const html = trimRenderedBreaks(renderEvidenceHtmlChildren(parsed.body, query));
    if (html.trim()) return html;
  }

  return renderPlainEvidenceText(value, query);
}

function shouldRenderRawEvidence(item, snippet) {
  const content = String(item?.content || '');
  return (
    cleanEvidenceText(content) !== snippet ||
    looksLikeHtml(content) ||
    /\r?\n|\[[^\]\n]{1,160}\]\(https?:\/\/[^)\s]+\)/.test(content)
  );
}

function renderEvidence(evidence, queryText = '') {
  if (!Array.isArray(evidence) || evidence.length === 0) return '';
  const displayItems = evidence.slice(0, 3);
  return `
    <section class="message-section">
      <h4>证据</h4>
      <div class="evidence-list">
        ${displayItems
          .map((item, index) => {
            const cleaned = cleanEvidenceText(item.content || '');
            const weak = isNoisyWebEvidence(item, cleaned);
            const title = getEvidenceTitle(item);
            const sourceLabel = getEvidenceSourceLabel(item);
            const timeLabel = formatEvidenceTime(item.timestamp);
            const scoreLabel =
              typeof item.score === 'number' && Number.isFinite(item.score)
                ? `${Math.round(item.score * 100)}%`
                : '';
            const reason = getEvidenceReason(item, weak);
            const snippet = weak
              ? clipText(`${title}。${cleaned}`, 220)
              : clipText(cleaned, 260);
            const raw = renderRichEvidenceText(
              String(item.content || '').slice(0, 1800),
              queryText,
            );
            return `
              <div class="evidence-item ${weak ? 'weak' : ''}">
                <div class="evidence-head">
                  <span class="evidence-rank">${index + 1}</span>
                  <span class="evidence-source">${escapeHtml(sourceLabel)}</span>
                  <strong title="${escapeHtml(title)}">${escapeHtml(title)}</strong>
                </div>
                <div class="evidence-meta-row">
                  ${timeLabel ? `<span>${escapeHtml(timeLabel)}</span>` : ''}
                  ${scoreLabel ? `<span>${escapeHtml(scoreLabel)}</span>` : ''}
                  ${weak ? '<span>弱相关网页快照</span>' : ''}
                </div>
                <p class="evidence-copy">${renderHighlightedEvidenceText(snippet, queryText)}</p>
                ${reason ? `<div class="evidence-reason">${escapeHtml(reason)}</div>` : ''}
                ${
                  raw && shouldRenderRawEvidence(item, snippet)
                    ? `<details class="evidence-raw"><summary>查看原文片段</summary><div class="evidence-raw-body">${raw}</div></details>`
                    : ''
                }
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderMemoryBadge(memorySaveResult) {
  if (!memorySaveResult) return '';
  const label = memorySaveResult.duplicate
    ? '这条我已经记住了。'
    : '好，这条我记下了。';
  const extraClass = memorySaveResult.duplicate ? ' duplicate' : '';
  return `<div class="memory-badge${extraClass}">${escapeHtml(label)}</div>`;
}

function canInjectToMobileContext(message) {
  return (
    message?.htmlReady &&
    Boolean(String(message.text || '').trim()) &&
    Array.isArray(message.evidence) &&
    message.evidence.length > 0
  );
}

function renderMobileContextAction(message) {
  if (!canInjectToMobileContext(message)) return '';

  const sync = message.mobileContextSync;
  const status = sync?.status;
  const label =
    status === 'pending'
      ? '正在发送到豆包...'
      : status === 'succeeded'
        ? '已发送到豆包手机对话'
        : status === 'failed'
          ? sync.message || '发送到豆包失败'
          : '';
  const tone =
    status === 'succeeded' ? 'success' : status === 'failed' ? 'error' : '';

  return `
    <div class="message-action-row">
      <button
        class="message-action-button quick-ask-sync-mobile"
        type="button"
        data-message-id="${escapeHtml(message.id)}"
        ${status === 'pending' || status === 'succeeded' ? 'disabled' : ''}
      >
        发到豆包手机对话
      </button>
      ${
        label
          ? `<span class="message-action-status ${escapeHtml(tone)}">${escapeHtml(label)}</span>`
          : '<span class="message-action-status">带证据发送，不写长期记忆</span>'
      }
    </div>
  `;
}

function renderLowMemoryTail(memoryGrowth) {
  if (!memoryGrowth?.belowThreshold) return '';

  const windowDays =
    typeof memoryGrowth.windowDays === 'number' &&
    Number.isFinite(memoryGrowth.windowDays)
      ? memoryGrowth.windowDays
      : 90;
  const recentMessageCount =
    typeof memoryGrowth.recentMessageCount === 'number' &&
    Number.isFinite(memoryGrowth.recentMessageCount)
      ? memoryGrowth.recentMessageCount
      : null;

  const lead =
    recentMessageCount === null
      ? `最近 ${windowDays} 天进入记忆系统的消息还比较少。`
      : `最近 ${windowDays} 天只有 ${recentMessageCount} 条消息进入记忆系统。`;

  return `
    <section class="message-tail-hint">
      <p>
        ${escapeHtml(lead)}
        想让它更懂你的日常上下文，可以
        <a href="${escapeHtml(CHROME_EXTENSION_URL)}" data-external-link="${escapeHtml(CHROME_EXTENSION_URL)}">安装 Chrome extension</a>
        ，然后在扩展弹窗里开启“静默消息分析”。
      </p>
    </section>
  `;
}

function getAmbiguousContextCandidates(message) {
  if (message?.contextMatch?.state !== 'ambiguous') return [];
  if (!Array.isArray(message.contextMatch.candidates)) return [];
  return message.contextMatch.candidates
    .slice(0, 5)
    .map((candidate, index) => ({
      index: index + 1,
      label: normalizeInlineText(candidate?.label || `候选 ${index + 1}`),
      reasons: Array.isArray(candidate?.reasons)
        ? candidate.reasons.slice(0, 2).map(normalizeInlineText).filter(Boolean)
        : [],
    }))
    .filter((candidate) => candidate.label);
}

function renderAmbiguousContextChoices(message) {
  const candidates = getAmbiguousContextCandidates(message);
  if (!candidates.length) return '';
  return `
    <section class="message-section ask-candidate-section">
      <h4>选择话题继续</h4>
      <div class="ask-candidate-list">
        ${candidates
          .map(
            (candidate) => `
              <button
                class="ask-candidate-choice"
                type="button"
                data-ask-candidate-index="${candidate.index}"
                data-ask-candidate-label="${escapeHtml(candidate.label)}"
                aria-label="选择话题 ${escapeHtml(candidate.label)}"
              >
                <span class="ask-candidate-number">${candidate.index}</span>
                <span class="ask-candidate-body">
                  <strong>${escapeHtml(candidate.label)}</strong>
                  ${
                    candidate.reasons.length
                      ? `<em>${escapeHtml(candidate.reasons.join(' / '))}</em>`
                      : ''
                  }
                </span>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderAssistantMessage(message) {
  if (message.pending && !message.text && !message.statusText) {
    return `
      <div class="message-card assistant-card pending-card">
        <div class="loading-dot" aria-label="加载中">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
  }

  if (message.pending && message.statusText && !message.text) {
    return `
      <div class="message-card assistant-card pending-card">
        <div class="pending-status-row">
          <div class="loading-dot" aria-label="加载中">
            <span></span><span></span><span></span>
          </div>
          <p class="pending-status-copy">${escapeHtml(message.statusText)}</p>
        </div>
      </div>
    `;
  }

  const bodyHtml = message.htmlReady
    ? markdownToHtml(message.text || '')
    : renderStreamingCopy(message.text || '');

  return `
    <div class="message-card assistant-card ${message.htmlReady ? '' : 'streaming-card'}">
      ${renderMemoryBadge(message.memorySaveResult)}
      ${bodyHtml}
      ${message.htmlReady ? renderAmbiguousContextChoices(message) : ''}
      ${message.htmlReady ? renderStructuredAnswer(message.structuredAnswer) : ''}
      ${message.htmlReady ? renderEvidence(message.evidence, message.queryText) : ''}
      ${message.htmlReady ? renderMobileContextAction(message) : ''}
      ${message.htmlReady ? renderLowMemoryTail(message.runtime?.memoryGrowth) : ''}
    </div>
  `;
}

function renderUserMessage(message) {
  return `<div class="message-card user-card"><p>${escapeHtml(message.text)}</p></div>`;
}

function renderStatusItem(item, runtime, refreshFailure = null) {
  const detailLines = Array.isArray(item.detailLines)
    ? item.detailLines.filter(Boolean).slice(0, 4)
    : [];
  const freshness = formatStatusItemFreshness(runtime, refreshFailure);
  const priorityReceipt = getStatusPriorityReceipt(item);
  return `
    <button
      class="status-item"
      type="button"
      data-status-kind="${escapeHtml(item.kind)}"
      data-status-title="${escapeHtml(item.title)}"
      data-status-summary="${escapeHtml(item.summary)}"
      data-status-details="${escapeHtml(detailLines.join('；'))}"
      data-status-action="${escapeHtml(item.actionHint || '')}"
      data-status-freshness="${escapeHtml(freshness.prompt)}"
      data-status-priority="${escapeHtml(priorityReceipt)}"
    >
      <span class="status-item-main">
        <span class="status-item-title">${escapeHtml(item.title)}</span>
        <span class="status-item-summary">${escapeHtml(item.summary)}</span>
        <span class="status-item-priority">${escapeHtml(priorityReceipt)}</span>
        ${
          detailLines.length
            ? `<span class="status-item-details">${detailLines
                .map((line) => `<span>${escapeHtml(String(line))}</span>`)
                .join('')}</span>`
            : ''
        }
      </span>
      <span class="status-item-meta">
        <span class="status-item-source">${escapeHtml(getStatusSourceLabel(item.kind))}</span>
        <span class="status-item-freshness ${escapeHtml(freshness.tone)}">${escapeHtml(freshness.label)}</span>
        ${
          item.badgeLabel
            ? `<span class="status-item-badge">${escapeHtml(item.badgeLabel)}</span>`
            : ''
        }
        <span class="status-item-hint">${escapeHtml(item.actionHint || '继续追问')}</span>
      </span>
    </button>
  `;
}

function renderStatusMessage(message) {
  const runtime = message.runtime || { items: [] };
  const items = Array.isArray(runtime.items) ? runtime.items : [];
  const refreshLabel = message.statusRefreshing ? '读取中...' : '重新读取';
  const refreshFailure = getStatusRefreshFailure(message);
  const noticeClass = refreshFailure
    ? 'status-refresh-note status-refresh-warning'
    : 'status-refresh-note';
  return `
    <div class="message-card status-card-wrap">
      <div class="status-card">
        <div class="status-card-head">
          <div>
            <h4>当前状态</h4>
            <p class="status-card-copy">需要关注的运行态会集中显示在这里。你可以点其中一项继续追问，或打开对应位置处理。</p>
          </div>
          <button
            class="status-card-refresh"
            type="button"
            data-status-refresh="true"
            data-message-id="${escapeHtml(message.id)}"
            ${message.statusRefreshing ? 'disabled' : ''}
          >
            ${escapeHtml(refreshLabel)}
          </button>
        </div>
        <div class="status-card-meta">${escapeHtml(formatRuntimeSnapshotMeta(runtime))}</div>
        ${
          message.statusRefreshNotice
            ? `<div class="${noticeClass}">${escapeHtml(message.statusRefreshNotice)}</div>`
            : ''
        }
        <div class="status-item-list">
          ${
            items.length
              ? items.map((item) => renderStatusItem(item, runtime, refreshFailure)).join('')
              : '<div class="status-empty">刚刚重新读取过，目前没有需要关注的运行态。</div>'
          }
        </div>
      </div>
    </div>
  `;
}

function renderMessages(renderOptions = {}) {
  if (!isExpandedState()) {
    elements.conversationPanel.innerHTML = '';
    scheduleLayoutSync();
    return;
  }

  const preserveTop =
    renderOptions.preserveTop ||
    (state.autoScrollPinned
      ? null
      : {
          kind: 'steady',
          scrollTop: elements.conversationPanel.scrollTop,
          scrollHeight: elements.conversationPanel.scrollHeight,
        });

  const visibleSessions = getVisibleSessions();
  const sessionsHtml = visibleSessions
    .map((session) => {
      const divider =
        session.current && visibleSessions.length === 1
          ? ''
          : `
        <div class="session-divider" data-session-id="${escapeHtml(session.id)}">
          <span>----- ${escapeHtml(formatSessionDividerLabel(session.startedAt))} -----</span>
        </div>
      `;
      const messageRows = session.messages
        .map((message) => {
          if (message.role === 'user') {
            return `<div class="message-row role-user">${renderUserMessage(message)}</div>`;
          }
          if (message.role === 'status') {
            return `<div class="message-row role-status">${renderStatusMessage(message)}</div>`;
          }
          return `<div class="message-row role-assistant">${renderAssistantMessage(message)}</div>`;
        })
        .join('');

      return `<section class="session-block">${divider}${messageRows}</section>`;
    })
    .join('');

  elements.conversationPanel.innerHTML = sessionsHtml;
  scheduleLayoutSync();
  syncConversationScroll({
    keepBottom: state.autoScrollPinned,
    preserveTop,
    restoreScrollTop: renderOptions.restoreScrollTop,
  });
}

function setRuntime(runtime) {
  state.runtime = runtime;
  if (
    !runtime?.topStatus ||
    !Array.isArray(runtime.items) ||
    runtime.items.length === 0
  ) {
    elements.statusPill.hidden = true;
    elements.statusPill.textContent = '';
    return;
  }

  const extraCount = Math.max(runtime.items.length - 1, 0);
  elements.statusPill.hidden = false;
  elements.statusPill.textContent =
    extraCount > 0
      ? `${runtime.topStatus.label} +${extraCount}`
      : runtime.topStatus.label;
}

function buildStatusFollowUpPrompt(
  kind,
  title,
  summary,
  details,
  actionHint,
  freshness,
  priorityReceipt,
) {
  const fallback = STATUS_HINTS[kind] || '帮我解释这条状态，并给出下一步。';
  const cleanTitle = String(title || '').trim();
  const cleanSummary = String(summary || '').trim();
  const cleanDetails = String(details || '').trim();
  const cleanActionHint = String(actionHint || '').trim();
  const cleanFreshness = String(freshness || '').trim();
  const cleanPriorityReceipt = String(priorityReceipt || '').trim();
  if (!cleanTitle && !cleanSummary) return fallback;

  const subject = cleanTitle || '这条状态';
  const detail = cleanSummary ? `：${cleanSummary}` : '';
  const detailContext = cleanDetails ? ` 细节：${cleanDetails}。` : '';
  const actionContext = cleanActionHint ? ` 建议动作：${cleanActionHint}。` : '';
  const freshnessContext = cleanFreshness ? ` 快照状态：${cleanFreshness}。` : '';
  const priorityContext = cleanPriorityReceipt
    ? ` 显示原因：${cleanPriorityReceipt}。`
    : '';
  return `关于「${subject}」${detail}。${detailContext}${actionContext}${freshnessContext}${priorityContext}${fallback}`;
}

function buildMobileContextEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.slice(0, 5).map((item, index) => {
    const metadata =
      item.metadata &&
      typeof item.metadata === 'object' &&
      !Array.isArray(item.metadata)
        ? item.metadata
        : null;
    const sender =
      typeof metadata?.sender === 'string' && metadata.sender.trim()
        ? metadata.sender.trim()
        : '';
    const groupName =
      typeof metadata?.groupName === 'string' && metadata.groupName.trim()
        ? metadata.groupName.trim()
        : typeof metadata?.group_name === 'string' && metadata.group_name.trim()
          ? metadata.group_name.trim()
          : '';
    const source = item.source || item.type || 'memory';
    const titleParts = [source, sender, groupName].filter(Boolean);
    return {
      title: titleParts.join(' · ') || `evidence ${index + 1}`,
      source,
      snippet: String(item.content || '').slice(0, 500),
    };
  });
}

function formatMobileContextSyncError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (
    /手机对话尚未绑定|mobile_context_not_bound|mobile-context thread not found/i.test(
      message,
    )
  ) {
    return '手机对话未绑定，请先打开设置重新绑定。';
  }
  if (/different thread|不同线程|错误线程/i.test(message)) {
    return '豆包落到了错误线程，请重新绑定手机版对话。';
  }
  if (/challenge|verify you are human|安全验证|验证码/i.test(message)) {
    return '豆包需要安全验证，处理后再重试。';
  }
  return message || '发送到豆包失败。';
}

async function sendAssistantMessageToMobileContext(messageId) {
  const message = findMessageById(messageId);
  if (!message || !canInjectToMobileContext(message)) return;

  updateMessage(messageId, {
    mobileContextSync: {
      status: 'pending',
      message: '正在发送到豆包...',
    },
  });

  try {
    const result = await quickAsk.injectQuery({
      query: message.queryText || 'Quick Ask',
      answer: message.text || '',
      evidence: buildMobileContextEvidence(message.evidence),
    });

    if (result?.error || result?.accepted === false) {
      updateMessage(messageId, {
        mobileContextSync: {
          status: 'failed',
          message: formatMobileContextSyncError(result.error),
        },
      });
      return;
    }

    updateMessage(messageId, {
      mobileContextSync: {
        status: 'succeeded',
        message: '已发送到豆包手机对话',
      },
    });
  } catch (error) {
    updateMessage(messageId, {
      mobileContextSync: {
        status: 'failed',
        message: formatMobileContextSyncError(error),
      },
    });
  }
}

async function refreshRuntimeSummary() {
  try {
    setRuntime(await quickAsk.getRuntimeSummary());
  } catch {
    setRuntime(null);
  }
}

async function refreshStatusCard(messageId) {
  const message = findMessageById(messageId);
  if (!message || message.role !== 'status' || message.statusRefreshing) return;

  updateMessage(messageId, {
    statusRefreshing: true,
    statusRefreshNotice: '正在重新读取运行态...',
  });

  try {
    const runtime = await quickAsk.getRuntimeSummary();
    setRuntime(runtime || null);
    const itemCount = Array.isArray(runtime?.items) ? runtime.items.length : 0;
    updateMessage(messageId, {
      runtime: runtime || { items: [], fetchedAt: new Date().toISOString() },
      statusRefreshing: false,
      statusRefreshError: '',
      statusRefreshFailedAt: '',
      statusRefreshNotice:
        itemCount > 0
          ? '已重新读取状态快照。'
          : '已重新读取：暂无需要关注的状态。',
    });
  } catch (error) {
    const errorText = clipText(
      error instanceof Error ? error.message : String(error),
      120,
    );
    const snapshotLabel = formatSnapshotRelative(message.runtime?.fetchedAt);
    updateMessage(messageId, {
      statusRefreshing: false,
      statusRefreshError: errorText,
      statusRefreshFailedAt: new Date().toISOString(),
      statusRefreshNotice: `重新读取失败，当前状态未确认。下面仍显示 ${snapshotLabel} 的上次成功快照：${errorText}`,
    });
  }
}

function pushMessage(message) {
  const timestamp =
    typeof message?.createdAt === 'number' && Number.isFinite(message.createdAt)
      ? message.createdAt
      : Date.now();
  ensureCurrentSession();
  state.currentSessionMessages.push({
    ...message,
    createdAt: timestamp,
  });
  touchCurrentSession(timestamp);
  renderMessages();
}

function findMessageById(messageId) {
  const current = state.currentSessionMessages.find(
    (item) => item.id === messageId,
  );
  if (current) return current;

  for (const session of state.historySessions) {
    const archived = session.messages?.find((item) => item.id === messageId);
    if (archived) return archived;
  }

  return null;
}

function updateMessage(messageId, patch) {
  const message = findMessageById(messageId);
  if (!message) return;
  Object.assign(message, patch);
  touchCurrentSession();
  renderMessages();
}

function flushStreamBuffer() {
  if (!state.streamMessageId || !state.streamBuffer) return;
  const message = state.currentSessionMessages.find(
    (item) => item.id === state.streamMessageId,
  );
  if (message) {
    message.text = `${message.text || ''}${state.streamBuffer}`;
    message.pending = false;
  }
  touchCurrentSession();
  state.streamBuffer = '';
  if (state.streamFlushTimer) {
    window.clearTimeout(state.streamFlushTimer);
    state.streamFlushTimer = null;
  }
  renderMessages();
}

function queueStreamDelta(delta) {
  if (!state.streamMessageId) return;
  state.streamBuffer += delta;
  if (state.streamFlushTimer) return;
  state.streamFlushTimer = window.setTimeout(() => {
    flushStreamBuffer();
  }, STREAM_FLUSH_MS);
}

function findCurrentSessionStatusIndex() {
  return state.currentSessionMessages.findIndex(
    (message) => message.role === 'status' && message.sessionRuntimeStatus,
  );
}

function insertStatusCard(runtime = state.runtime, manual = false) {
  const hasRuntimeItems = Array.isArray(runtime?.items) && runtime.items.length > 0;
  const existingIndex = findCurrentSessionStatusIndex();

  if (!hasRuntimeItems) {
    if (!manual && existingIndex >= 0) {
      state.currentSessionMessages.splice(existingIndex, 1);
      touchCurrentSession();
      renderMessages();
    }
    return;
  }

  if (existingIndex >= 0) {
    const existingStatus = state.currentSessionMessages[existingIndex];
    existingStatus.runtime = runtime;
    existingStatus.autoRuntime = existingStatus.autoRuntime && !manual;
    touchCurrentSession();
    renderMessages();
    return;
  }

  const timestamp = Date.now();
  ensureCurrentSession();
  const firstNonStatusIndex = state.currentSessionMessages.findIndex(
    (message) => message.role !== 'status',
  );
  const insertIndex =
    firstNonStatusIndex >= 0
      ? firstNonStatusIndex
      : state.currentSessionMessages.length;
  state.currentSessionMessages.splice(insertIndex, 0, {
    id: createId('status'),
    role: 'status',
    runtime,
    autoRuntime: !manual,
    sessionRuntimeStatus: true,
    createdAt: timestamp,
  });
  touchCurrentSession(timestamp);
  renderMessages();
}

async function rememberAck(text) {
  const payload = await quickAsk.remember({ text });
  return payload?.items?.[0] || null;
}

class VoiceController {
  constructor() {
    this.recognizedTranscript = '';
    this.listening = false;
    this.seedDraft = '';
    this.stopResolvers = [];
    this.lastErrorMessage = '';
    this.lastErrorAction = null;
  }

  describeError(code, payload = null) {
    if (code === 'microphone_denied') {
      return t('desktop.quickAsk.voiceError.microphoneDenied');
    }
    if (code === 'speech_denied') {
      return t('desktop.quickAsk.voiceError.speechDenied');
    }
    if (code === 'audio-capture') {
      return t('desktop.quickAsk.voiceError.audioCapture');
    }
    if (code === 'speech_start_failed') {
      return payload?.message || t('desktop.quickAsk.voiceError.startFailed');
    }
    if (code && String(code).startsWith('speech_error_')) {
      return payload?.message || t('desktop.quickAsk.voiceError.unavailable');
    }
    return (
      payload?.message ||
      (code
        ? t('desktop.quickAsk.voiceError.unavailableWithCode', { code })
        : t('desktop.quickAsk.voiceError.unavailable'))
    );
  }

  resolveErrorAction(code) {
    if (code === 'microphone_denied' || code === 'audio-capture') {
      return {
        type: 'microphone',
        label: t('desktop.quickAsk.voiceRecovery.microphone'),
      };
    }
    if (code === 'speech_denied') {
      return {
        type: 'speech',
        label: t('desktop.quickAsk.voiceRecovery.speech'),
      };
    }
    return null;
  }

  setError(code, payload = null) {
    this.lastErrorMessage = this.describeError(code, payload);
    this.lastErrorAction = this.resolveErrorAction(code);
  }

  handleStartFailure(error) {
    this.listening = false;
    this.lastErrorMessage =
      error instanceof Error ? error.message : String(error);
    this.lastErrorAction = null;
    elements.voiceSheet.style.setProperty('--voice-amp', '0.14');
    showNotice(this.lastErrorMessage);
    state.voicePhase = 'ready';
    setUiState('voice-ready');
    renderVoiceSheet();
  }

  composeDraft(recognizedText = this.recognizedTranscript) {
    return [this.seedDraft, recognizedText].filter(Boolean).join(' ').trim();
  }

  async enter(seedDraft = state.draft) {
    this.seedDraft = seedDraft.trim();
    this.recognizedTranscript = '';
    this.lastErrorMessage = '';
    this.lastErrorAction = null;
    state.voiceDraft = this.seedDraft;
    state.voicePhase = 'listening';
    setUiState('voice-listening');
    renderVoiceSheet();

    try {
      await quickAsk.startNativeVoice({
        locale: resolveVoiceLocale(),
      });
    } catch (error) {
      this.handleStartFailure(error);
    }
  }

  async restart() {
    await this.cancelNativeVoice(false);
    this.seedDraft = state.voiceDraft.trim();
    this.recognizedTranscript = '';
    this.lastErrorMessage = '';
    this.lastErrorAction = null;
    state.voiceDraft = this.seedDraft;
    state.voicePhase = 'listening';
    setUiState('voice-listening');
    renderVoiceSheet();
    try {
      await quickAsk.startNativeVoice({
        locale: resolveVoiceLocale(),
      });
    } catch (error) {
      this.handleStartFailure(error);
    }
  }

  waitForStop(timeoutMs = 1500) {
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        resolve();
      }, timeoutMs);
      this.stopResolvers.push(() => {
        window.clearTimeout(timeout);
        resolve();
      });
    });
  }

  async stopListening() {
    if (!this.listening) {
      return;
    }
    const stopPromise = this.waitForStop();
    await quickAsk.stopNativeVoice();
    await stopPromise;
  }

  async cancelNativeVoice(expectStopped = true) {
    if (!this.listening) return;
    const stopPromise = expectStopped ? this.waitForStop() : Promise.resolve();
    await quickAsk.cancelNativeVoice();
    await stopPromise;
  }

  async cancelToText() {
    await this.cancelNativeVoice(true);
    this.seedDraft = '';
    this.lastErrorMessage = '';
    this.lastErrorAction = null;
    const draft = state.voiceDraft.trim();
    setDraft(draft);
    state.voiceDraft = draft;
    state.voicePhase = 'idle';
    expireCurrentSessionIfNeeded();
    setUiState(
      hasCurrentSessionMessages() ? resolveExpandedState() : 'idle-compact',
    );
    renderVoiceSheet();
    focusComposer();
  }

  async sendVoiceDraft() {
    const transcript = state.voiceDraft.trim();
    if (!transcript) return;
    await this.stopListening();
    this.seedDraft = '';
    this.recognizedTranscript = '';
    this.lastErrorMessage = '';
    this.lastErrorAction = null;
    state.voicePhase = 'idle';
    renderVoiceSheet();
    await submitQuery(transcript, { fromVoice: true });
  }

  handleNativeEvent(payload) {
    if (!payload || typeof payload !== 'object') return;

    if (payload.type === 'started') {
      this.listening = true;
      this.lastErrorMessage = '';
      this.lastErrorAction = null;
      state.voicePhase = 'listening';
      setUiState('voice-listening');
      renderVoiceSheet();
      return;
    }

    if (payload.type === 'amplitude') {
      const level = Number(payload.level);
      if (Number.isFinite(level) && level > 0) {
        elements.voiceSheet.style.setProperty('--voice-amp', level.toFixed(3));
      }
      return;
    }

    if (payload.type === 'transcript') {
      this.recognizedTranscript =
        typeof payload.text === 'string' ? payload.text.trim() : '';
      this.lastErrorMessage = '';
      this.lastErrorAction = null;
      state.voiceDraft = this.composeDraft();
      state.voicePhase = payload.isFinal ? 'ready' : 'listening';
      if (isVoiceState()) {
        setUiState(payload.isFinal ? 'voice-ready' : 'voice-listening');
      }
      renderVoiceSheet();
      return;
    }

    if (payload.type === 'stopped') {
      this.listening = false;
      this.recognizedTranscript =
        typeof payload.text === 'string'
          ? payload.text.trim()
          : this.recognizedTranscript;
      this.lastErrorMessage = '';
      this.lastErrorAction = null;
      state.voiceDraft = this.composeDraft(this.recognizedTranscript);
      state.voicePhase = 'ready';
      if (isVoiceState()) {
        setUiState('voice-ready');
      }
      elements.voiceSheet.style.setProperty('--voice-amp', '0.14');
      this.resolveStopPromises();
      renderVoiceSheet();
      return;
    }

    if (payload.type === 'error') {
      this.listening = false;
      this.setError(payload.code, payload);
      elements.voiceSheet.style.setProperty('--voice-amp', '0.14');
      showNotice(this.lastErrorMessage);
      state.voicePhase = 'ready';
      if (isVoiceState()) {
        setUiState('voice-ready');
      }
      this.resolveStopPromises();
      renderVoiceSheet();
    }
  }

  resolveStopPromises() {
    while (this.stopResolvers.length > 0) {
      const resolve = this.stopResolvers.shift();
      resolve?.();
    }
  }

  reset() {
    this.seedDraft = '';
    this.recognizedTranscript = '';
    this.listening = false;
    state.voiceDraft = '';
    state.voicePhase = 'idle';
    this.lastErrorMessage = '';
    this.lastErrorAction = null;
    elements.voiceSheet.style.setProperty('--voice-amp', '0.14');
    this.stopResolvers = [];
    void quickAsk.cancelNativeVoice().catch(() => undefined);
  }
}

const voiceController = new VoiceController();

function getVoiceReceiptText() {
  if (voiceController.lastErrorMessage) {
    return t('desktop.quickAsk.voiceReceipt.error');
  }

  const locale = resolveVoiceLocale();
  if (state.voicePhase === 'listening') {
    return state.voiceDraft.trim()
      ? t('desktop.quickAsk.voiceReceipt.listeningWithDraft', { locale })
      : t('desktop.quickAsk.voiceReceipt.listening', { locale });
  }

  if (state.voicePhase === 'ready') {
    return state.voiceDraft.trim()
      ? t('desktop.quickAsk.voiceReceipt.ready', {
          scope: getAskScopeLabel(),
        })
      : t('desktop.quickAsk.voiceReceipt.readyEmpty');
  }

  return t('desktop.quickAsk.voiceReceipt.idle');
}

function renderVoiceSheet() {
  const transcriptText =
    state.voiceDraft ||
    voiceController.lastErrorMessage ||
    t('desktop.quickAsk.voicePrompt');
  elements.voiceTranscript.textContent = transcriptText;
  elements.voiceReceipt.textContent = getVoiceReceiptText();
  if (voiceController.lastErrorAction) {
    elements.voiceRecovery.hidden = false;
    elements.voiceRecovery.textContent = voiceController.lastErrorAction.label;
  } else {
    elements.voiceRecovery.hidden = true;
    elements.voiceRecovery.textContent = '';
  }
  elements.voiceOrb.classList.toggle(
    'listening',
    state.voicePhase === 'listening',
  );
  elements.voiceOrb.classList.toggle('ready', state.voicePhase === 'ready');
  elements.voiceSend.disabled = !state.voiceDraft.trim();
}

async function enterVoiceMode() {
  await loadPreferences();
  await voiceController.enter(state.draft);
}

function resetSession() {
  if (state.requestActive) {
    showNotice('当前回答还在生成，先等这条回答结束再开新对话。');
    return;
  }
  if (state.streamFlushTimer) {
    window.clearTimeout(state.streamFlushTimer);
  }
  state.streamMessageId = null;
  state.streamBuffer = '';
  state.streamFlushTimer = null;
  archiveCurrentSession();
  state.notice = '';
  voiceController.reset();
  state.voiceDraft = '';
  state.voicePhase = 'idle';
  state.autoScrollPinned = true;
  setDraft('');
  setUiState('idle-compact');
  renderShortcutBanner();
  renderVoiceSheet();
  renderMessages();
  void refreshRuntimeSummary();
}

function handleWindowShown(payload = {}) {
  expireCurrentSessionIfNeeded();

  if (hasCurrentSessionMessages()) {
    const restoreScrollTop = state.autoScrollPinned
      ? null
      : state.savedConversationScrollTop;
    setUiState(resolveExpandedState());
    renderMessages({
      restoreScrollTop,
    });
  } else {
    state.loadedHistoryCount = 0;
    state.autoScrollPinned = true;
    setUiState('idle-compact');
    renderMessages();
  }

  if (payload.focusInput !== false && !isVoiceState()) {
    focusComposer();
  }
}

function loadOlderSession() {
  if (state.loadingHistory) return;
  if (!isExpandedState()) return;
  if (state.loadedHistoryCount >= state.historySessions.length) return;

  const scrollState = {
    kind: 'prepend',
    scrollTop: elements.conversationPanel.scrollTop,
    scrollHeight: elements.conversationPanel.scrollHeight,
  };
  state.loadingHistory = true;
  state.loadedHistoryCount = Math.min(
    state.historySessions.length,
    state.loadedHistoryCount + HISTORY_LOAD_BATCH_SIZE,
  );
  renderMessages({ preserveTop: scrollState });
  window.requestAnimationFrame(() => {
    state.loadingHistory = false;
  });
}

async function submitQuery(rawInput, options = {}) {
  const input = rawInput.trim();
  if (!input || state.requestActive) return;
  const displayText =
    normalizeInlineText(options.displayText || '') || input;

  expireCurrentSessionIfNeeded();
  const rememberRequested = hasExplicitRememberIntent(input);
  const standaloneRemember =
    rememberRequested && isStandaloneRememberRequest(input);
  let memorySaveResult = null;

  if (standaloneRemember) {
    try {
      memorySaveResult = await rememberAck(
        normalizeRememberText(input) || input,
      );
    } catch (error) {
      memorySaveResult = {
        duplicate: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    setDraft('');
    state.autoScrollPinned = true;
    setUiState('enriched');
    pushMessage({
      id: createId('user'),
      role: 'user',
      text: input,
    });
    pushMessage({
      id: createId('assistant'),
      role: 'assistant',
      text: memorySaveResult?.error
        ? `记忆保存失败：${memorySaveResult.error}`
        : '好，这条我记住了。',
      htmlReady: true,
      memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
    });
    await refreshRuntimeSummary();
    focusComposer();
    return;
  }

  setDraft('');
  state.requestActive = true;
  renderScopeSelector();
  state.autoScrollPinned = true;
  setUiState('pending');
  pushMessage({
    id: createId('user'),
    role: 'user',
    text: displayText,
  });

  const assistantId = createId('assistant');
  state.streamMessageId = assistantId;
  pushMessage({
    id: assistantId,
    role: 'assistant',
    text: '',
    statusText: t('desktop.quickAsk.pending'),
    pending: true,
    htmlReady: false,
  });

  let finalResult = null;
  let streamErrored = false;

  try {
    const askContext = await buildEnrichedAskContext(input);
    if (rememberRequested) {
      try {
        memorySaveResult = await rememberAck(
          normalizeRememberText(input) || input,
        );
      } catch (error) {
        memorySaveResult = {
          duplicate: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      updateMessage(assistantId, {
        memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
      });
    }

    await quickAsk.askStream(
      {
        query: input,
        context: askContext,
        includeEvidence: true,
        scope: state.askScope,
      },
      async (event) => {
        if (!event || typeof event !== 'object') return;

        if (event.type === 'delta') {
          if (state.uiState === 'pending') {
            setUiState('streaming');
          }
          queueStreamDelta(event.text || '');
          return;
        }

        if (event.type === 'status') {
          updateMessage(assistantId, {
            statusText: event.message || '',
            pending: true,
            htmlReady: false,
          });
          return;
        }

        if (event.type === 'answer_done') {
          flushStreamBuffer();
          updateMessage(assistantId, {
            text: event.answer || '',
            pending: false,
            htmlReady: true,
            queryText: displayText,
            statusText: '',
          });
          if (state.uiState === 'pending') {
            setUiState('streaming');
          }
          return;
        }

        if (event.type === 'result') {
          flushStreamBuffer();
          finalResult = event;
          await new Promise((resolve) =>
            window.setTimeout(resolve, ENRICHMENT_DELAY_MS),
          );
          updateMessage(assistantId, {
            text: event.answer || '',
            pending: false,
            htmlReady: true,
            structuredAnswer: event.structuredAnswer,
            evidence: event.evidence,
            contextMatch: event.contextMatch,
            runtime: event.runtime,
            queryText: displayText,
            memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
            statusText: '',
          });
          state.currentTurns.push({
            userText: displayText,
            assistantText: event.answer || '',
          });
          touchCurrentSession();
          setRuntime(event.runtime || null);
          if (event.runtime?.items?.length) {
            insertStatusCard(event.runtime);
          }
          setUiState('enriched');
          return;
        }

        if (event.type === 'error') {
          streamErrored = true;
          flushStreamBuffer();
          updateMessage(assistantId, {
            text: `这次没有成功问到结果：${event.message || '未知错误'}`,
            pending: false,
            htmlReady: true,
            memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
            statusText: '',
          });
          setUiState('enriched');
        }
      },
    );
  } catch (error) {
    streamErrored = true;
    flushStreamBuffer();
    updateMessage(assistantId, {
      text: `这次没有成功问到结果：${error instanceof Error ? error.message : String(error)}`,
      pending: false,
      htmlReady: true,
      memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
      statusText: '',
    });
    setUiState('enriched');
    await refreshRuntimeSummary();
  } finally {
    state.requestActive = false;
    renderScopeSelector();
    state.streamMessageId = null;
    state.streamBuffer = '';
    if (!finalResult && !streamErrored) {
      await refreshRuntimeSummary();
      setUiState('enriched');
    }
    renderMessages();
    focusComposer();
  }
}

elements.composer.addEventListener('input', (event) => {
  setDraft(event.target.value);
});

elements.composer.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    await submitQuery(elements.composer.value);
  }
});

document.addEventListener('keydown', async (event) => {
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

  if ((event.metaKey || event.ctrlKey) && key === 'n' && !event.shiftKey) {
    event.preventDefault();
    await quickAsk.newSession();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && key === ',') {
    event.preventDefault();
    await quickAsk.openSettings();
    return;
  }

  if (event.key !== 'Escape') return;
  event.preventDefault();

  if (isVoiceState()) {
    await voiceController.cancelToText();
    return;
  }

  if (isExpandedState()) {
    setUiState('idle-compact');
    renderMessages();
    focusComposer();
    return;
  }

  await quickAsk.hide();
});

document.addEventListener('keyup', async (event) => {
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  if (key === 'a' || key === 'alt') {
    await quickAsk.resolveShortcutGesture().catch(() => undefined);
  }
});

elements.utilityButton.addEventListener('click', (event) => {
  event.stopPropagation();
  void quickAsk.openSettings();
});

for (const [scope, button] of scopeButtons) {
  button?.addEventListener('click', () => {
    if (state.requestActive) return;
    void persistAskScope(scope);
  });
}

elements.statusPill.addEventListener('click', async () => {
  expireCurrentSessionIfNeeded();
  state.autoScrollPinned = false;
  setUiState('enriched');
  insertStatusCard(state.runtime, true);
  window.requestAnimationFrame(() => {
    elements.conversationPanel.scrollTop = 0;
    state.savedConversationScrollTop = 0;
  });
});

elements.voiceButton.addEventListener('click', async () => {
  await enterVoiceMode();
});

elements.voiceOrb.addEventListener('click', async () => {
  if (state.voicePhase === 'listening') {
    await voiceController.stopListening();
    return;
  }
  await voiceController.restart();
});

elements.voiceCancel.addEventListener('click', async () => {
  await voiceController.cancelToText();
});

elements.voiceSend.addEventListener('click', async () => {
  await voiceController.sendVoiceDraft();
});

elements.voiceRecovery.addEventListener('click', async () => {
  const action = voiceController.lastErrorAction;
  if (!action) return;
  try {
    if (action.type === 'microphone') {
      if (typeof appShell.openMicrophoneSettings === 'function') {
        await appShell.openMicrophoneSettings();
        return;
      }
    }
    if (action.type === 'speech') {
      if (typeof appShell.openSpeechRecognitionSettings === 'function') {
        await appShell.openSpeechRecognitionSettings();
        return;
      }
    }
    await quickAsk.openSettings();
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : t('desktop.quickAsk.voiceError.unavailable'),
    );
  }
});

elements.conversationPanel.addEventListener('click', async (event) => {
  const askCandidateButton = event.target.closest('[data-ask-candidate-index]');
  if (askCandidateButton) {
    event.preventDefault();
    if (state.requestActive) return;
    const candidateLabel = normalizeInlineText(
      askCandidateButton.dataset.askCandidateLabel ||
        askCandidateButton.querySelector('strong')?.textContent ||
        '',
    );
    await submitQuery(askCandidateButton.dataset.askCandidateIndex || '', {
      displayText: candidateLabel ? `选择话题：${candidateLabel}` : '',
    });
    return;
  }

  const statusRefreshButton = event.target.closest('[data-status-refresh]');
  if (statusRefreshButton) {
    event.preventDefault();
    await refreshStatusCard(statusRefreshButton.dataset.messageId);
    return;
  }

  const mobileSyncButton = event.target.closest('.quick-ask-sync-mobile');
  if (mobileSyncButton) {
    event.preventDefault();
    await sendAssistantMessageToMobileContext(
      mobileSyncButton.dataset.messageId,
    );
    return;
  }

  const statusItem = event.target.closest('[data-status-kind]');
  if (statusItem) {
    const kind = statusItem.dataset.statusKind;
    if (kind === 'setup_blocker') {
      await quickAsk.openSettings();
      return;
    }
    setDraft(
      buildStatusFollowUpPrompt(
        kind,
        statusItem.dataset.statusTitle,
        statusItem.dataset.statusSummary,
        statusItem.dataset.statusDetails,
        statusItem.dataset.statusAction,
        statusItem.dataset.statusFreshness,
        statusItem.dataset.statusPriority,
      ),
    );
    focusComposer();
    return;
  }

  const link = event.target.closest('[data-external-link]');
  if (link) {
    event.preventDefault();
    await appShell.openExternal(link.dataset.externalLink);
  }
});

elements.conversationPanel.addEventListener('scroll', () => {
  if (!isExpandedState()) return;

  state.autoScrollPinned = isConversationPinnedToBottom();
  state.savedConversationScrollTop = elements.conversationPanel.scrollTop;
  state.savedConversationScrollHeight = elements.conversationPanel.scrollHeight;
  if (elements.conversationPanel.scrollTop <= HISTORY_LOAD_THRESHOLD_PX) {
    loadOlderSession();
  }
});

window.addEventListener('resize', () => {
  autoResizeComposer();
  scheduleLayoutSync();
  syncConversationScroll({ keepBottom: state.autoScrollPinned });
});

quickAsk.onNativeShortcutEvent(async (payload) => {
  if (payload?.type === 'enter-voice') {
    await enterVoiceMode();
  }
});

quickAsk.onVoiceEvent((payload) => {
  voiceController.handleNativeEvent(payload);
});

quickAsk.onShortcutStatus((payload) => {
  state.shortcutStatus = payload || null;
  renderShortcutBanner();
});

quickAsk.onResetSession(() => {
  resetSession();
});

quickAsk.onWindowShown((payload) => {
  handleWindowShown(payload);
});

quickAsk.onPrepareHide(() => {
  saveConversationScrollState();
  if (isVoiceState()) {
    void voiceController.cancelToText().then(() => {
      setUiState(
        hasCurrentSessionMessages() ? resolveExpandedState() : 'idle-compact',
      );
      renderMessages();
    });
    return;
  }
  if (state.draft) {
    setDraft(state.draft);
  }
  if (hasCurrentSessionMessages()) {
    renderMessages({
      restoreScrollTop: state.autoScrollPinned
        ? null
        : state.savedConversationScrollTop,
    });
    return;
  }
  setUiState('idle-compact');
  renderMessages();
});

quickAsk.onFocusInput(() => {
  if (!isVoiceState()) {
    focusComposer();
  }
});

async function loadPreferences() {
  try {
    const [payload, settings] = await Promise.all([
      quickAsk.getPreferences(),
      bridgeApi.getSettings().catch(() => null),
    ]);
    setDesktopLanguage(settings?.effective?.uiLanguage);
    state.voiceLocale =
      typeof payload?.voiceLocale === 'string' && payload.voiceLocale.trim()
        ? payload.voiceLocale.trim()
        : 'zh-CN';
  } catch {
    setDesktopLanguage('zh-CN');
    state.voiceLocale = 'zh-CN';
  }
  renderVoiceSheet();
}

const initialDraft = (() => {
  try {
    return window.localStorage.getItem(DRAFT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
})();

renderVoiceSheet();
renderShortcutBanner();
renderScopeSelector();
setDraft(initialDraft);
renderMessages();
void loadPreferences();
void loadAskScopePreference();
void refreshRuntimeSummary();
setInterval(() => {
  if (!state.requestActive) {
    void refreshRuntimeSummary();
  }
}, 20000);
