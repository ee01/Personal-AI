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
  voiceOrb: document.getElementById('voice-orb'),
  voiceCancel: document.getElementById('voice-cancel'),
  voiceSend: document.getElementById('voice-send'),
};

const STATUS_HINTS = {
  setup_blocker: '帮我总结现在还缺哪些配置步骤。',
  confirm_request: '帮我总结这些待确认项，告诉我应该先处理哪个。',
  running_action: '帮我解释这些执行中的动作，当前卡在什么地方。',
  waiting_reply: '帮我总结这些外部询问状态，接下来应该跟进什么。',
  queued_action: '帮我总结这些排队中的动作，哪些值得先处理。',
};

const HEIGHTS = {
  /** Keep equal to `ASK_WINDOW_COMPACT_HEIGHT` in `app/main.mjs`. */
  compact: 258,
  compactWithBanner: 302,
  voice: 214,
  /** Expanded heights (~+50%) so answer area is less cramped. */
  streaming: 714,
  enriched: 816,
};

const STREAM_FLUSH_MS = 42;
const ENRICHMENT_DELAY_MS = 150;
const SESSION_EXPIRY_MS = 5 * 60 * 60 * 1000;
const HISTORY_LOAD_BATCH_SIZE = 1;
const AUTO_SCROLL_THRESHOLD_PX = 36;
const HISTORY_LOAD_THRESHOLD_PX = 18;
const STREAMING_TAIL_CHARS = 14;
const DRAFT_STORAGE_KEY = 'desktop-app.quick-ask.draft';
const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel?authuser=0&hl=zh-CN';

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
  return text
    .trim()
    .replace(/^(?:请帮我|帮我|麻烦你|请你|请)\s*记住(?:一下)?[：:\s]*/i, '')
    .replace(/^记住(?:一下)?[：:\s]*/i, '')
    .replace(/^(?:please\s+)?remember(?:\s+that)?[：:\s]*/i, '')
    .trim()
    .replace(/^[,，。.!！\s]+|[,，。.!！\s]+$/g, '');
}

function isRememberRequest(text) {
  return /(记住|remember)/i.test(text);
}

function isStandaloneRememberRequest(text) {
  if (!isRememberRequest(text)) return false;
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

function isVoiceState() {
  return state.uiState === 'voice-listening' || state.uiState === 'voice-ready';
}

function normalizeAskScope(value) {
  if (value === 'personal' || value === 'both') {
    return value;
  }
  return 'work';
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

function syncConversationScroll({ preserveTop, keepBottom } = {}) {
  window.requestAnimationFrame(() => {
    if (!isExpandedState()) return;

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

function renderEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return '';
  const displayItems = evidence.slice(0, 3);
  return `
    <section class="message-section">
      <h4>证据</h4>
      <div class="evidence-list">
        ${displayItems
          .map((item) => {
            const metadata =
              item.metadata &&
              typeof item.metadata === 'object' &&
              !Array.isArray(item.metadata)
                ? item.metadata
                : null;
            const source = item.source || item.type || '记忆片段';
            const sender =
              typeof metadata?.sender === 'string' && metadata.sender.trim()
                ? metadata.sender.trim()
                : '';
            const groupName =
              typeof metadata?.groupName === 'string' &&
              metadata.groupName.trim()
                ? metadata.groupName.trim()
                : typeof metadata?.group_name === 'string' &&
                    metadata.group_name.trim()
                  ? metadata.group_name.trim()
                  : '';
            const title = sender ? `${source} · ${sender}` : source;
            return `
              <div class="evidence-item">
                <strong>${escapeHtml(title)}</strong>
                ${groupName ? `<div class="evidence-meta">${escapeHtml(groupName)}</div>` : ''}
                <div class="evidence-copy">${escapeHtml(item.content || '')}</div>
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
      ${message.htmlReady ? renderStructuredAnswer(message.structuredAnswer) : ''}
      ${message.htmlReady ? renderEvidence(message.evidence) : ''}
      ${message.htmlReady ? renderLowMemoryTail(message.runtime?.memoryGrowth) : ''}
    </div>
  `;
}

function renderUserMessage(message) {
  return `<div class="message-card user-card"><p>${escapeHtml(message.text)}</p></div>`;
}

function renderStatusMessage(message) {
  const runtime = message.runtime || { items: [] };
  return `
    <div class="message-card status-card-wrap">
      <div class="status-card">
        <div>
          <h4>当前状态</h4>
          <p class="status-card-copy">这些状态不会跳出 chat。你可以点其中一项，把建议追问带回输入框。</p>
        </div>
        <div class="status-item-list">
          ${runtime.items
            .map(
              (item) => `
                <button class="status-item" type="button" data-status-kind="${escapeHtml(item.kind)}">
                  <span class="status-item-main">
                    <span class="status-item-title">${escapeHtml(item.title)}</span>
                    <span class="status-item-summary">${escapeHtml(item.summary)}</span>
                  </span>
                  <span class="status-item-meta">
                    ${item.badgeLabel ? `<span class="status-item-badge">${escapeHtml(item.badgeLabel)}</span>` : ''}
                    <span class="status-item-hint">${escapeHtml(item.actionHint || '继续追问')}</span>
                  </span>
                </button>
              `,
            )
            .join('')}
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

async function refreshRuntimeSummary() {
  try {
    setRuntime(await quickAsk.getRuntimeSummary());
  } catch {
    setRuntime(null);
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

function updateMessage(messageId, patch) {
  const message = state.currentSessionMessages.find(
    (item) => item.id === messageId,
  );
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

function insertStatusCard(runtime = state.runtime, manual = false) {
  if (!runtime?.items?.length) return;
  if (!manual) {
    const trailingStatus =
      state.currentSessionMessages[state.currentSessionMessages.length - 1];
    if (trailingStatus?.role === 'status' && trailingStatus.autoRuntime) {
      trailingStatus.runtime = runtime;
      touchCurrentSession();
      renderMessages();
      return;
    }
  }

  pushMessage({
    id: createId('status'),
    role: 'status',
    runtime,
    autoRuntime: !manual,
  });
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
  }

  describeError(code, payload = null) {
    if (code === 'microphone_denied') {
      return '请先在系统设置中允许麦克风权限。';
    }
    if (code === 'speech_denied') {
      return '请先在系统设置中允许语音识别权限。';
    }
    if (code === 'audio-capture') {
      return '当前无法访问麦克风。';
    }
    if (code === 'speech_start_failed') {
      return payload?.message || '当前无法启动系统语音识别。';
    }
    if (code && String(code).startsWith('speech_error_')) {
      return payload?.message || '系统语音识别暂时不可用。';
    }
    return (
      payload?.message ||
      (code ? `语音输入暂时不可用：${code}` : '语音输入暂时不可用。')
    );
  }

  composeDraft(recognizedText = this.recognizedTranscript) {
    return [this.seedDraft, recognizedText].filter(Boolean).join(' ').trim();
  }

  async enter(seedDraft = state.draft) {
    this.seedDraft = seedDraft.trim();
    this.recognizedTranscript = '';
    this.lastErrorMessage = '';
    state.voiceDraft = this.seedDraft;
    state.voicePhase = 'listening';
    setUiState('voice-listening');
    renderVoiceSheet();

    try {
      await quickAsk.startNativeVoice({
        locale: resolveVoiceLocale(),
      });
    } catch (error) {
      this.listening = false;
      this.lastErrorMessage =
        error instanceof Error ? error.message : String(error);
      elements.voiceSheet.style.setProperty('--voice-amp', '0.14');
      showNotice(this.lastErrorMessage);
      state.voicePhase = 'ready';
      setUiState('voice-ready');
      renderVoiceSheet();
    }
  }

  async restart() {
    await this.cancelNativeVoice(false);
    this.seedDraft = state.voiceDraft.trim();
    this.recognizedTranscript = '';
    this.lastErrorMessage = '';
    state.voiceDraft = this.seedDraft;
    state.voicePhase = 'listening';
    setUiState('voice-listening');
    renderVoiceSheet();
    await quickAsk.startNativeVoice({
      locale: resolveVoiceLocale(),
    });
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
    state.voicePhase = 'idle';
    renderVoiceSheet();
    await submitQuery(transcript, { fromVoice: true });
  }

  handleNativeEvent(payload) {
    if (!payload || typeof payload !== 'object') return;

    if (payload.type === 'started') {
      this.listening = true;
      this.lastErrorMessage = '';
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
      this.lastErrorMessage = this.describeError(payload.code, payload);
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
    elements.voiceSheet.style.setProperty('--voice-amp', '0.14');
    this.stopResolvers = [];
    void quickAsk.cancelNativeVoice().catch(() => undefined);
  }
}

const voiceController = new VoiceController();

function renderVoiceSheet() {
  const transcriptText =
    state.voiceDraft || voiceController.lastErrorMessage || '';
  elements.voiceTranscript.textContent = transcriptText;
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
  state.loadedHistoryCount = 0;
  state.autoScrollPinned = true;

  if (hasCurrentSessionMessages()) {
    setUiState(resolveExpandedState());
  } else {
    setUiState('idle-compact');
  }

  renderMessages();
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

  expireCurrentSessionIfNeeded();
  const askContext = buildAskContext();

  const rememberRequested = isRememberRequest(input);
  const standaloneRemember =
    rememberRequested && isStandaloneRememberRequest(input);
  let memorySaveResult = null;

  try {
    if (rememberRequested) {
      memorySaveResult = await rememberAck(
        normalizeRememberText(input) || input,
      );
    }
  } catch (error) {
    memorySaveResult = {
      duplicate: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (standaloneRemember) {
    setDraft('');
    state.autoScrollPinned = true;
    setUiState('enriched');
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
    text: input,
  });

  const assistantId = createId('assistant');
  state.streamMessageId = assistantId;
  pushMessage({
    id: assistantId,
    role: 'assistant',
    text: '',
    pending: true,
    htmlReady: false,
    memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
  });

  let finalResult = null;
  let streamErrored = false;

  try {
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
            runtime: event.runtime,
            memorySaveResult: memorySaveResult?.error ? null : memorySaveResult,
            statusText: '',
          });
          state.currentTurns.push({
            userText: input,
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
  if (state.runtime?.topStatus?.kind === 'setup_blocker') {
    await quickAsk.openSettings();
    return;
  }
  expireCurrentSessionIfNeeded();
  state.autoScrollPinned = true;
  setUiState('enriched');
  insertStatusCard(state.runtime, true);
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

elements.conversationPanel.addEventListener('click', async (event) => {
  const statusItem = event.target.closest('[data-status-kind]');
  if (statusItem) {
    const kind = statusItem.dataset.statusKind;
    if (kind === 'setup_blocker') {
      await quickAsk.openSettings();
      return;
    }
    setDraft(STATUS_HINTS[kind] || '');
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
  if (isVoiceState()) {
    void voiceController.cancelToText().then(() => {
      setUiState('idle-compact');
      renderMessages();
    });
    return;
  }
  if (state.draft) {
    setDraft(state.draft);
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
    const payload = await quickAsk.getPreferences();
    state.voiceLocale =
      typeof payload?.voiceLocale === 'string' && payload.voiceLocale.trim()
        ? payload.voiceLocale.trim()
        : 'zh-CN';
  } catch {
    state.voiceLocale = 'zh-CN';
  }
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
