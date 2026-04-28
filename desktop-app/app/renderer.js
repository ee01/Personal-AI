const bridgeApi = window.bridgeApi;
const explorerApi = window.explorerApi;
const appShell = window.appShell;

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel?authuser=0&hl=zh-CN';

const elements = {
  refreshButton: document.getElementById('refresh-button'),
  openMemoryListButton: document.getElementById('open-memory-list-button'),
  openLogButton: document.getElementById('open-log-button'),
  openSupportButton: document.getElementById('open-support-button'),
  summaryGrid: document.getElementById('summary-grid'),
  nextStepCard: document.getElementById('next-step-card'),
  nextStepTitle: document.getElementById('next-step-title'),
  nextStepCopy: document.getElementById('next-step-copy'),
  blockingReasons: document.getElementById('blocking-reasons'),
  metaVersion: document.getElementById('meta-version'),
  metaLog: document.getElementById('meta-log'),
  metaSupport: document.getElementById('meta-support'),
  metaShortcut: document.getElementById('meta-shortcut'),
  voiceLocale: document.getElementById('voice-locale'),
  openInputMonitoringButton: document.getElementById(
    'open-input-monitoring-button',
  ),
  openAccessibilityButton: document.getElementById('open-accessibility-button'),
  openMicrophoneButton: document.getElementById('open-microphone-button'),
  refreshShortcutButton: document.getElementById('refresh-shortcut-button'),
  settingsForm: document.getElementById('settings-form'),
  memoryBaseUrl: document.getElementById('memory-base-url'),
  memoryApiKey: document.getElementById('memory-api-key'),
  memoryUserId: document.getElementById('memory-user-id'),
  pollMinutes: document.getElementById('poll-minutes'),
  stableHours: document.getElementById('stable-hours'),
  briefingHours: document.getElementById('briefing-hours'),
  reminderMinutes: document.getElementById('reminder-minutes'),
  testMemoryButton: document.getElementById('test-memory-button'),
  settingsMessage: document.getElementById('settings-message'),
  loginButton: document.getElementById('login-button'),
  loginMessage: document.getElementById('login-message'),
  memoryThreadButton: document.getElementById('memory-thread-button'),
  runStableButton: document.getElementById('run-stable-button'),
  memoryThreadMessage: document.getElementById('memory-thread-message'),
  mobileThreadButton: document.getElementById('mobile-thread-button'),
  runBriefingButton: document.getElementById('run-briefing-button'),
  runReminderButton: document.getElementById('run-reminder-button'),
  mobileThreadMessage: document.getElementById('mobile-thread-message'),
  stopButton: document.getElementById('stop-button'),
  installExtensionButton: document.getElementById('install-extension-button'),
  stepMemoryStatus: document.getElementById('step-memory-status'),
  stepLoginStatus: document.getElementById('step-login-status'),
  stepMemoryThreadStatus: document.getElementById('step-memory-thread-status'),
  stepMobileThreadStatus: document.getElementById('step-mobile-thread-status'),
  stepBackgroundStatus: document.getElementById('step-background-status'),
  stepExtensionStatus: document.getElementById('step-extension-status'),
  extensionMemoryCount: document.getElementById('extension-memory-count'),
  extensionMemoryCopy: document.getElementById('extension-memory-copy'),
  askDefaultScopeValue: document.getElementById('ask-default-scope-value'),
  explorerUpdatedAt: document.getElementById('explorer-updated-at'),
  doubaoSourceAuthPill: document.getElementById('doubao-source-auth-pill'),
  doubaoSourceCacheCount: document.getElementById('doubao-source-cache-count'),
  doubaoSourceConversationCount: document.getElementById(
    'doubao-source-conversation-count',
  ),
  doubaoSourceLastRun: document.getElementById('doubao-source-last-run'),
  doubaoSourceRunState: document.getElementById('doubao-source-run-state'),
  doubaoSourceEnabled: document.getElementById('doubao-source-enabled'),
  doubaoSourceLookbackDays: document.getElementById(
    'doubao-source-lookback-days',
  ),
  doubaoSourceIntervalMinutes: document.getElementById(
    'doubao-source-interval-minutes',
  ),
  doubaoSourceScope: document.getElementById('doubao-source-scope'),
  doubaoSourceSaveButton: document.getElementById('doubao-source-save-button'),
  doubaoSourceLoginButton: document.getElementById(
    'doubao-source-login-button',
  ),
  doubaoSourceRunButton: document.getElementById('doubao-source-run-button'),
  doubaoSourceMessage: document.getElementById('doubao-source-message'),
  doubaoSourceRevokeScope: document.getElementById(
    'doubao-source-revoke-scope',
  ),
  chatgptSourceAuthPill: document.getElementById('chatgpt-source-auth-pill'),
  chatgptSourceCacheCount: document.getElementById(
    'chatgpt-source-cache-count',
  ),
  chatgptSourceConversationCount: document.getElementById(
    'chatgpt-source-conversation-count',
  ),
  chatgptSourceLastRun: document.getElementById('chatgpt-source-last-run'),
  chatgptSourceRunState: document.getElementById('chatgpt-source-run-state'),
  chatgptSourceEnabled: document.getElementById('chatgpt-source-enabled'),
  chatgptSourceLookbackDays: document.getElementById(
    'chatgpt-source-lookback-days',
  ),
  chatgptSourceIntervalMinutes: document.getElementById(
    'chatgpt-source-interval-minutes',
  ),
  chatgptSourceMaxConversations: document.getElementById(
    'chatgpt-source-max-conversations',
  ),
  chatgptSourceScope: document.getElementById('chatgpt-source-scope'),
  chatgptSourceTransportBanner: document.getElementById(
    'chatgpt-source-transport-banner',
  ),
  chatgptSourceSaveButton: document.getElementById(
    'chatgpt-source-save-button',
  ),
  chatgptSourceLoginButton: document.getElementById(
    'chatgpt-source-login-button',
  ),
  chatgptSourceRunButton: document.getElementById('chatgpt-source-run-button'),
  chatgptSourceMessage: document.getElementById('chatgpt-source-message'),
  chatgptSourceRevokeScope: document.getElementById(
    'chatgpt-source-revoke-scope',
  ),
  doubaoSourceToggleStatus: document.getElementById(
    'doubao-source-toggle-status',
  ),
  chatgptSourceToggleStatus: document.getElementById(
    'chatgpt-source-toggle-status',
  ),
  // webpage-mcp transport toggles
  chatgptUseDailyBrowser: document.getElementById('chatgpt-source-use-daily-browser'),
  chatgptMcpGuide: document.getElementById('chatgpt-webpage-mcp-guide'),
  chatgptMcpTestButton: document.getElementById('chatgpt-mcp-test-button'),
  chatgptMcpTestMessage: document.getElementById('chatgpt-mcp-test-message'),
  doubaoSourceUseDailyBrowser: document.getElementById('doubao-source-use-daily-browser'),
  doubaoSourceMcpGuide: document.getElementById('doubao-source-webpage-mcp-guide'),
  doubaoMcpTestButton: document.getElementById('doubao-mcp-test-button'),
  doubaoMcpTestMessage: document.getElementById('doubao-mcp-test-message'),
  broadcastUseDailyBrowser: document.getElementById('broadcast-use-daily-browser'),
  broadcastMcpGuide: document.getElementById('broadcast-webpage-mcp-guide'),
  broadcastMcpTestButton: document.getElementById('broadcast-mcp-test-button'),
  broadcastMcpTestMessage: document.getElementById('broadcast-mcp-test-message'),
};

let refreshTimer;
let settingsDirty = false;
let latestStatus = null;
let latestSettingsPayload = null;
let latestExplorerStatus = null;
const explorerSourceDirty = new Set();

function formatTime(value) {
  if (!value) return '未发生';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function syncWebpageMcpGuide(toggleEl, guideEl) {
  if (!toggleEl || !guideEl) return;
  guideEl.hidden = !toggleEl.checked;
}

function setMcpTestMessage(msgEl, text, success) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = success
    ? 'field-hint webpage-mcp-status-connected'
    : 'field-hint webpage-mcp-status-error';
}

async function runMcpConnectionTest(msgEl) {
  if (!msgEl) return;
  msgEl.textContent = '测试中...';
  msgEl.className = 'field-hint';
  try {
    const result = await window.explorerApi?.testWebpageMcpConnection?.();
    if (result?.ok) {
      setMcpTestMessage(msgEl, `扩展已连接 ✓（检测到 ${result.tabCount} 个标签页）`, true);
    } else {
      setMcpTestMessage(
        msgEl,
        result?.error ?? '连接失败，请确认 Chrome 扩展已安装并显示为绿色连接状态。',
        false,
      );
    }
  } catch (err) {
    setMcpTestMessage(msgEl, `连接测试失败：${err instanceof Error ? err.message : err}`, false);
  }
}

function formatBool(value, labels = ['未完成', '已完成']) {
  return value ? labels[1] : labels[0];
}

function hoursFromMs(value) {
  return Math.max(1, Math.round(value / 3_600_000));
}

function minutesFromMs(value) {
  return Math.max(1, Math.round(value / 60_000));
}

function formatMessageCount(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value}`
    : '待统计';
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizeInputScope(value, fallback = 'work') {
  return value === 'personal' ? 'personal' : fallback;
}

function formatAskScope(value) {
  if (value === 'personal') return '个人';
  if (value === 'both') return '工作 + 个人';
  return '工作';
}

function formatAuthStatus(value) {
  if (value === 'connected') return '已连接';
  if (value === 'needs_login') return '待登录';
  if (value === 'unsupported') return '暂不支持';
  if (value === 'error') return '异常';
  return '检查中';
}

function authStatusTone(value) {
  if (value === 'connected') return 'ready';
  if (value === 'error') return 'error';
  return 'pending';
}

function formatRunOutcome(sourceStatus) {
  if (!sourceStatus) return '待检查';
  if (sourceStatus.running) return '抓取中';
  if (!sourceStatus.enabled) return '已关闭自动抓取';
  if (sourceStatus.lastRunOutcome === 'success') return '最近成功';
  if (sourceStatus.lastRunOutcome === 'error') return '最近失败';
  if (sourceStatus.lastRunOutcome === 'stub') return '待实现';
  return '未执行';
}

function setMessage(element, text, tone = 'muted') {
  if (!element) return;
  element.textContent = text || '';
  element.className = `inline-message ${tone === 'error' ? 'status-error' : tone === 'success' ? 'status-ready' : tone === 'warn' ? 'status-blocked' : ''}`;
}

function setButtonBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent || '';
    button.textContent = label;
  } else if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
  }
  button.disabled = busy;
}

function setStatusPill(element, text, tone = 'pending') {
  if (!element) return;
  element.textContent = text;
  element.className = `step-status step-status-${tone}`;
}

function collectRuntimeSettings() {
  return {
    memoryServiceBaseUrl: elements.memoryBaseUrl.value.trim() || undefined,
    memoryServiceApiKey: elements.memoryApiKey.value.trim() || undefined,
    memoryServiceUserId: elements.memoryUserId.value.trim() || undefined,
    autoSync: true,
    pollIntervalMs: Number(elements.pollMinutes.value || 5) * 60_000,
    stableMemoryIntervalMs:
      Number(elements.stableHours.value || 12) * 3_600_000,
    mobileBriefingIntervalMs:
      Number(elements.briefingHours.value || 4) * 3_600_000,
    reminderSyncIntervalMs:
      Number(elements.reminderMinutes.value || 15) * 60_000,
  };
}

function validateRuntimeSettings(settings) {
  if (settings.memoryServiceBaseUrl && !settings.memoryServiceUserId) {
    throw new Error(
      '配置 Memory Service 后，Memory Service User ID 也必须填写。',
    );
  }
}

function markSettingsDirty() {
  settingsDirty = true;
}

function clearSettingsDirty() {
  settingsDirty = false;
}

function markExplorerSourceDirty(source) {
  explorerSourceDirty.add(source);
}

function clearExplorerSourceDirty(source) {
  explorerSourceDirty.delete(source);
}

function applyRuntimeSettings(settings, { force = false } = {}) {
  if (!settings) return;
  if (settingsDirty && !force) return;
  elements.memoryBaseUrl.value = settings.memoryServiceBaseUrl || '';
  elements.memoryApiKey.value = settings.memoryServiceApiKey || '';
  elements.memoryUserId.value = settings.memoryServiceUserId || '';
  elements.pollMinutes.value = String(
    minutesFromMs(settings.pollIntervalMs || 300_000),
  );
  elements.stableHours.value = String(
    hoursFromMs(settings.stableMemoryIntervalMs || 43_200_000),
  );
  elements.briefingHours.value = String(
    hoursFromMs(settings.mobileBriefingIntervalMs || 14_400_000),
  );
  elements.reminderMinutes.value = String(
    minutesFromMs(settings.reminderSyncIntervalMs || 900_000),
  );
  clearSettingsDirty();
}

function syncSourceTogglePresentation(source) {
  const input =
    source === 'doubao'
      ? elements.doubaoSourceEnabled
      : elements.chatgptSourceEnabled;
  const statusLabel =
    source === 'doubao'
      ? elements.doubaoSourceToggleStatus
      : elements.chatgptSourceToggleStatus;
  if (!input) return;
  const wrapper = input.closest('.source-toggle');
  const on = !!input.checked;
  wrapper?.classList.toggle('is-on', on);
  if (statusLabel) {
    statusLabel.textContent = on ? '已开启' : '关闭';
  }
}

function applyExplorerSettings(explorerSettings, { force = false } = {}) {
  if (!explorerSettings) return;
  if (force || !explorerSourceDirty.has('doubao')) {
    elements.doubaoSourceEnabled.checked = Boolean(
      explorerSettings.doubao?.enabled,
    );
    elements.doubaoSourceLookbackDays.value = String(
      nonNegativeInteger(explorerSettings.doubao?.lookbackDays, 7),
    );
    elements.doubaoSourceIntervalMinutes.value = String(
      positiveInteger(explorerSettings.doubao?.intervalMinutes, 60),
    );
    elements.doubaoSourceScope.value = normalizeInputScope(
      explorerSettings.doubao?.defaultScope,
      'personal',
    );
    if (elements.doubaoSourceUseDailyBrowser) {
      elements.doubaoSourceUseDailyBrowser.checked =
        explorerSettings.doubao?.transport === 'webpage_mcp';
    }
    syncWebpageMcpGuide(
      elements.doubaoSourceUseDailyBrowser,
      elements.doubaoSourceMcpGuide,
    );
  }
  if (force || !explorerSourceDirty.has('chatgpt')) {
    elements.chatgptSourceEnabled.checked = Boolean(
      explorerSettings.chatgpt?.enabled,
    );
    elements.chatgptSourceLookbackDays.value = String(
      nonNegativeInteger(explorerSettings.chatgpt?.lookbackDays, 0),
    );
    elements.chatgptSourceIntervalMinutes.value = String(
      positiveInteger(explorerSettings.chatgpt?.intervalMinutes, 60),
    );
    elements.chatgptSourceMaxConversations.value = String(
      nonNegativeInteger(explorerSettings.chatgpt?.maxConversations, 0),
    );
    elements.chatgptSourceScope.value = normalizeInputScope(
      explorerSettings.chatgpt?.defaultScope,
      'work',
    );
    if (elements.chatgptUseDailyBrowser) {
      elements.chatgptUseDailyBrowser.checked =
        explorerSettings.chatgpt?.transport === 'webpage_mcp';
    }
    syncWebpageMcpGuide(
      elements.chatgptUseDailyBrowser,
      elements.chatgptMcpGuide,
    );
  }
  // Broadcast transport (not part of explorerSourceDirty, always sync from server)
  if (elements.broadcastUseDailyBrowser && (force || !explorerSourceDirty.has('doubao'))) {
    elements.broadcastUseDailyBrowser.checked =
      explorerSettings.doubao?.broadcastTransport === 'webpage_mcp';
    syncWebpageMcpGuide(
      elements.broadcastUseDailyBrowser,
      elements.broadcastMcpGuide,
    );
  }
  if (elements.askDefaultScopeValue) {
    elements.askDefaultScopeValue.textContent = formatAskScope(
      explorerSettings.askDefaultScope,
    );
  }
  syncSourceTogglePresentation('doubao');
  syncSourceTogglePresentation('chatgpt');
  if (force) {
    explorerSourceDirty.clear();
  }
}

function renderSummary(status) {
  // 大功能维度：每一项展示该功能"是否启用 / 在跑"，登录/绑定细节交给下方卡片。
  const checklist = status?.setupChecklist || {};
  const memoryReady = !!checklist.memoryServiceConfigured;

  const backgroundOn = !!status?.syncState?.timerActive;
  const autoSyncOn = !!status?.syncState?.autoSyncEnabled;

  const stableOn = autoSyncOn && memoryReady && !!checklist.memorySyncBound;
  const briefingOn =
    autoSyncOn && memoryReady && !!checklist.mobileContextBound;

  const explorer = latestExplorerStatus?.sources || {};
  const doubaoOn = !!explorer.doubao?.enabled;
  const chatgptOn = !!explorer.chatgpt?.enabled;

  const summaryItems = [
    {
      label: '后台服务',
      value: backgroundOn ? '运行中' : '未启动',
      tone: backgroundOn ? 'on' : 'off',
    },
    {
      label: 'Memory Service',
      value: memoryReady ? '已连接' : '未配置',
      tone: memoryReady ? 'on' : 'warn',
    },
    {
      label: '同步 · 长期记忆 → 豆包',
      value: stableOn ? '已开启' : '未开启',
      tone: stableOn ? 'on' : 'off',
    },
    {
      label: '同步 · 近期重点 / 待办 → 豆包',
      value: briefingOn ? '已开启' : '未开启',
      tone: briefingOn ? 'on' : 'off',
    },
    {
      label: '获取 · 豆包对话',
      value: doubaoOn ? '已开启' : '未开启',
      tone: doubaoOn ? 'on' : 'off',
    },
    {
      label: '获取 · ChatGPT 对话',
      value: chatgptOn ? '已开启' : '未开启',
      tone: chatgptOn ? 'on' : 'off',
    },
  ];

  elements.summaryGrid.innerHTML = summaryItems
    .map(
      (item) => `
        <div class="summary-item summary-item-${item.tone}">
          <label>${item.label}</label>
          <strong>${item.value}</strong>
        </div>
      `,
    )
    .join('');
}

function renderBlockingReasons(status) {
  const reasons = status?.blockingReasons || [];
  if (reasons.length === 0) {
    elements.blockingReasons.innerHTML =
      '<div class="reason-pill status-ready">所有前置条件已满足，自动同步可以正常运行。</div>';
    return;
  }

  elements.blockingReasons.innerHTML = reasons
    .map(
      (reason) =>
        `<div class="reason-pill status-blocked">${reason.message}</div>`,
    )
    .join('');
}

function renderNextStep(status) {
  const checklist = status?.setupChecklist || {};
  const steps = [
    [
      !checklist.memoryServiceConfigured,
      '先连接 Memory Service',
      '填写 Base URL 和 User ID，保存后先点一次“测试连接”，确认输出与输入都连接到同一份记忆源。',
    ],
    [
      !checklist.doubaoConnected,
      '先完成豆包登录',
      '桥接器需要独立浏览器 profile 才能继续绑定输出线程，也才能读取豆包输入来源。',
    ],
    [
      !checklist.memorySyncBound,
      '创建长期记忆线程',
      '先把 persona_core 和 voice_mode 绑定到专用线程，保证输出侧仍然稳定工作。',
    ],
    [
      !checklist.mobileContextBound,
      '绑定手机版对话',
      '让近期重点、待办和通知推送回你真正会继续使用的那条手机对话。',
    ],
  ];

  const nextStep = steps.find(([pending]) => pending);
  if (!nextStep) {
    elements.nextStepCard?.classList.add('next-step-card-ready');
    elements.nextStepTitle.textContent = '现在已经可以自动推送记忆';
    elements.nextStepCopy.textContent =
      '输出链路已经就绪。右侧的「记忆自动获取」会继续把豆包 / ChatGPT 对话整理回记忆系统。';
    return;
  }

  elements.nextStepCard?.classList.remove('next-step-card-ready');
  elements.nextStepTitle.textContent = nextStep[1];
  elements.nextStepCopy.textContent = nextStep[2];
}

function renderStepStatuses(status) {
  const checklist = status?.setupChecklist || {};
  const stepStates = [
    [
      elements.stepMemoryStatus,
      Boolean(checklist.memoryServiceConfigured),
      '已连接',
      '待配置',
    ],
    [
      elements.stepLoginStatus,
      Boolean(checklist.doubaoConnected),
      '已登录',
      '待登录',
    ],
    [
      elements.stepMemoryThreadStatus,
      Boolean(checklist.memorySyncBound),
      '已绑定',
      '待绑定',
    ],
    [
      elements.stepMobileThreadStatus,
      Boolean(checklist.mobileContextBound),
      '已绑定',
      '待绑定',
    ],
    [
      elements.stepBackgroundStatus,
      Boolean(status?.syncState?.timerActive),
      '运行中',
      '待就绪',
    ],
  ];

  for (const [element, ok, readyText, pendingText] of stepStates) {
    if (!element) continue;
    element.textContent = ok ? readyText : pendingText;
    element.className = `step-status ${ok ? 'step-status-ready' : 'step-status-pending'}`;
  }

  const memoryGrowth = status?.memoryGrowth;
  if (!checklist.memoryServiceConfigured) {
    elements.stepExtensionStatus.textContent = '推荐';
    elements.stepExtensionStatus.className = 'step-status step-status-pending';
    elements.extensionMemoryCount.textContent = '待统计';
    elements.extensionMemoryCopy.textContent =
      '先连接 Memory Service，随后这里会展示最近 90 天进入记忆系统的消息数。';
    return;
  }

  if (!memoryGrowth || typeof memoryGrowth.recentMessageCount !== 'number') {
    elements.stepExtensionStatus.textContent = '推荐';
    elements.stepExtensionStatus.className = 'step-status step-status-pending';
    elements.extensionMemoryCount.textContent = '统计中';
    elements.extensionMemoryCopy.textContent =
      '已连接 Memory Service，但最近 90 天消息数暂时不可用。你仍然可以先安装 extension 并在弹窗里开启静默消息分析。';
    return;
  }

  elements.extensionMemoryCount.textContent = formatMessageCount(
    memoryGrowth.recentMessageCount,
  );
  if (memoryGrowth.belowThreshold) {
    elements.stepExtensionStatus.textContent = '建议开启';
    elements.stepExtensionStatus.className = 'step-status step-status-pending';
    elements.extensionMemoryCopy.textContent = `最近 ${memoryGrowth.windowDays} 天只有 ${memoryGrowth.recentMessageCount} 条消息进入记忆系统。安装 extension 后在弹窗里开启“静默消息分析”，可以持续补充 ask 所依赖的日常上下文。`;
    return;
  }

  elements.stepExtensionStatus.textContent = '可选优化';
  elements.stepExtensionStatus.className = 'step-status step-status-ready';
  elements.extensionMemoryCopy.textContent = `最近 ${memoryGrowth.windowDays} 天已经累计 ${memoryGrowth.recentMessageCount} 条消息。若还想继续补充日常上下文，仍可安装 extension 并开启“静默消息分析”。`;
}

function renderShortcutStatus(shortcutStatus) {
  if (!shortcutStatus?.message) {
    setMessage(elements.metaShortcut, '');
    return;
  }

  const tone = shortcutStatus.usingNativeHelper
    ? 'success'
    : shortcutStatus.fallbackEnabled
      ? 'warn'
      : 'muted';
  setMessage(elements.metaShortcut, shortcutStatus.message, tone);
}

function renderSourceCard(source, sourceStatus) {
  const isDoubao = source === 'doubao';
  const authPill = isDoubao
    ? elements.doubaoSourceAuthPill
    : elements.chatgptSourceAuthPill;
  const cacheCount = isDoubao
    ? elements.doubaoSourceCacheCount
    : elements.chatgptSourceCacheCount;
  const conversationCount = isDoubao
    ? elements.doubaoSourceConversationCount
    : elements.chatgptSourceConversationCount;
  const lastRun = isDoubao
    ? elements.doubaoSourceLastRun
    : elements.chatgptSourceLastRun;
  const runState = isDoubao
    ? elements.doubaoSourceRunState
    : elements.chatgptSourceRunState;
  const revokeScope = isDoubao
    ? elements.doubaoSourceRevokeScope
    : elements.chatgptSourceRevokeScope;

  if (!sourceStatus) {
    setStatusPill(authPill, '暂不可用', 'error');
    cacheCount.textContent = '-';
    conversationCount.textContent = '-';
    lastRun.textContent = '-';
    runState.textContent = 'Explorer 未响应';
    if (revokeScope) {
      revokeScope.textContent = '-';
    }
    return;
  }

  setStatusPill(
    authPill,
    formatAuthStatus(sourceStatus.authStatus),
    authStatusTone(sourceStatus.authStatus),
  );
  cacheCount.textContent = formatMessageCount(sourceStatus.cache?.messageCount);
  conversationCount.textContent = formatMessageCount(
    sourceStatus.cache?.conversationCount,
  );
  lastRun.textContent = formatTime(sourceStatus.lastRunAt);
  runState.textContent = formatRunOutcome(sourceStatus);
  if (revokeScope) {
    revokeScope.textContent = formatAskScope(
      sourceStatus.settings?.defaultScope,
    );
  }
  if (source === 'chatgpt') {
    renderChatgptTransportBanner(sourceStatus);
  }
}

function renderChatgptTransportBanner(sourceStatus) {
  const banner = elements.chatgptSourceTransportBanner;
  if (!banner) return;
  const transport = sourceStatus.transport;

  if (!transport || transport.mode === 'unknown') {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  if (transport.mode === 'playwright') {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  if (transport.mode === 'webpage_mcp') {
    banner.hidden = false;
    banner.className = 'inline-message success';
    banner.textContent = '当前传输：日常浏览器（webpage-mcp）。已借用登录态。';
    return;
  }

  banner.hidden = true;
  banner.textContent = '';
}

function renderExplorerOverview(explorerStatus, explorerSettings) {
  const effectiveExplorerSettings =
    explorerSettings || latestSettingsPayload?.effective?.explorer;
  applyExplorerSettings(effectiveExplorerSettings);
  elements.explorerUpdatedAt.textContent = formatTime(
    explorerStatus?.updatedAt,
  );
  renderSourceCard('doubao', explorerStatus?.sources?.doubao);
  renderSourceCard('chatgpt', explorerStatus?.sources?.chatgpt);
}

function applyButtonAvailability(status, explorerStatus) {
  const checklist = status?.setupChecklist || {};
  const memoryConnected = Boolean(checklist.memoryServiceConfigured);
  const loggedIn = Boolean(checklist.doubaoConnected);
  const memoryBound = Boolean(checklist.memorySyncBound);
  const mobileBound = Boolean(checklist.mobileContextBound);
  const doubaoSource = explorerStatus?.sources?.doubao;
  const chatgptSource = explorerStatus?.sources?.chatgpt;

  elements.loginButton.disabled = false;
  elements.memoryThreadButton.disabled = !loggedIn;
  elements.mobileThreadButton.disabled = !loggedIn;
  elements.runStableButton.disabled = !(
    memoryConnected &&
    loggedIn &&
    memoryBound
  );
  elements.runBriefingButton.disabled = !(
    memoryConnected &&
    loggedIn &&
    mobileBound
  );
  elements.runReminderButton.disabled = !(
    memoryConnected &&
    loggedIn &&
    mobileBound
  );

  elements.doubaoSourceSaveButton.disabled =
    !latestSettingsPayload || !explorerSourceDirty.has('doubao');
  elements.chatgptSourceSaveButton.disabled =
    !latestSettingsPayload || !explorerSourceDirty.has('chatgpt');

  elements.doubaoSourceLoginButton.disabled =
    !doubaoSource || doubaoSource.running;
  elements.doubaoSourceRunButton.disabled =
    !doubaoSource ||
    doubaoSource.running ||
    doubaoSource.authStatus !== 'connected';

  elements.chatgptSourceLoginButton.disabled =
    !chatgptSource ||
    chatgptSource.running ||
    chatgptSource.authStatus === 'unsupported';
  elements.chatgptSourceRunButton.disabled =
    !chatgptSource ||
    chatgptSource.running ||
    chatgptSource.authStatus === 'unsupported';

  applyExplorerToggleGating('doubao', {
    memoryReady: memoryConnected,
    sourceStatus: doubaoSource,
  });
  applyExplorerToggleGating('chatgpt', {
    memoryReady: memoryConnected,
    sourceStatus: chatgptSource,
  });
}

/**
 * 在 Memory Service 还没配好 / 来源还没登录时，把卡片右上角的"自动读取"开关
 * 变成灰色不可点，并把原因写到 toggle 副标题里。这样用户不会以为开关坏了。
 */
function applyExplorerToggleGating(source, { memoryReady, sourceStatus }) {
  const input =
    source === 'doubao'
      ? elements.doubaoSourceEnabled
      : elements.chatgptSourceEnabled;
  const statusLabel =
    source === 'doubao'
      ? elements.doubaoSourceToggleStatus
      : elements.chatgptSourceToggleStatus;
  if (!input) return;
  const wrapper = input.closest('.source-toggle');

  let blockedReason = null;
  if (!memoryReady) {
    blockedReason = '请先配置 Memory Service';
  } else if (!sourceStatus) {
    blockedReason = '正在检查...';
  } else if (sourceStatus.authStatus === 'unsupported') {
    blockedReason = '该平台暂不支持';
  } else if (sourceStatus.authStatus !== 'connected') {
    blockedReason =
      sourceStatus.authStatus === 'error'
        ? '登录态异常，请重新登录'
        : '请先点击"登录来源"';
  }

  if (blockedReason) {
    if (input.checked) {
      input.checked = false;
    }
    input.disabled = true;
    wrapper?.classList.add('is-disabled');
    wrapper?.classList.remove('is-on');
    if (statusLabel) statusLabel.textContent = blockedReason;
  } else {
    input.disabled = false;
    wrapper?.classList.remove('is-disabled');
    syncSourceTogglePresentation(source);
  }
}

async function loadMeta() {
  const meta = await appShell.getMeta();
  elements.metaVersion.textContent = meta.version || '-';
  elements.metaLog.textContent = meta.bridgeLogFile || '-';
  elements.metaSupport.textContent = meta.supportDir || '-';
  renderShortcutStatus(meta.shortcutStatus);
}

async function loadVoicePreferences() {
  const preferences = await appShell.getVoicePreferences();
  elements.voiceLocale.value =
    typeof preferences?.voiceLocale === 'string' &&
    preferences.voiceLocale.trim()
      ? preferences.voiceLocale.trim()
      : 'zh-CN';
}

async function refreshStatus() {
  const [status, settings, explorerStatus] = await Promise.all([
    bridgeApi.getStatus(),
    bridgeApi.getSettings(),
    explorerApi.getStatus().catch(() => null),
  ]);

  latestStatus = status;
  latestSettingsPayload = settings;
  latestExplorerStatus = explorerStatus;

  renderSummary(status);
  renderNextStep(status);
  renderBlockingReasons(status);
  renderStepStatuses(status);
  applyRuntimeSettings(settings.effective);
  renderExplorerOverview(explorerStatus, settings.effective.explorer);
  applyButtonAvailability(status, explorerStatus);
  return { status, settings, explorerStatus };
}

async function withAction(button, label, fn) {
  setButtonBusy(button, true, label);
  try {
    return await fn();
  } finally {
    setButtonBusy(button, false);
  }
}

async function saveRuntimeSettings({ silent = false } = {}) {
  const payload = collectRuntimeSettings();
  validateRuntimeSettings(payload);
  const saved = await bridgeApi.updateSettings(payload);
  latestSettingsPayload = saved;
  applyRuntimeSettings(saved.effective, { force: true });
  applyExplorerSettings(saved.effective.explorer);
  if (!silent) {
    setMessage(
      elements.settingsMessage,
      '配置已保存，后台轮询会立即按新节奏生效。',
      'success',
    );
  }
  return saved;
}

function collectExplorerSettings() {
  const currentExplorer = latestSettingsPayload?.effective?.explorer;
  if (!currentExplorer) {
    throw new Error('Explorer 设置尚未加载完成，请稍后重试。');
  }
  return {
    ...currentExplorer,
    doubao: {
      ...currentExplorer.doubao,
      enabled: Boolean(elements.doubaoSourceEnabled.checked),
      lookbackDays: nonNegativeInteger(
        elements.doubaoSourceLookbackDays.value,
        currentExplorer.doubao.lookbackDays,
      ),
      intervalMinutes: positiveInteger(
        elements.doubaoSourceIntervalMinutes.value,
        currentExplorer.doubao.intervalMinutes,
      ),
      defaultScope: normalizeInputScope(
        elements.doubaoSourceScope.value,
        'personal',
      ),
      transport: elements.doubaoSourceUseDailyBrowser?.checked
        ? 'webpage_mcp'
        : 'playwright',
      broadcastTransport: elements.broadcastUseDailyBrowser?.checked
        ? 'webpage_mcp'
        : 'playwright',
    },
    chatgpt: {
      ...currentExplorer.chatgpt,
      enabled: Boolean(elements.chatgptSourceEnabled.checked),
      lookbackDays: nonNegativeInteger(
        elements.chatgptSourceLookbackDays.value,
        currentExplorer.chatgpt.lookbackDays,
      ),
      intervalMinutes: positiveInteger(
        elements.chatgptSourceIntervalMinutes.value,
        currentExplorer.chatgpt.intervalMinutes,
      ),
      maxConversations: nonNegativeInteger(
        elements.chatgptSourceMaxConversations.value,
        currentExplorer.chatgpt.maxConversations,
      ),
      defaultScope: normalizeInputScope(
        elements.chatgptSourceScope.value,
        'work',
      ),
      transport: elements.chatgptUseDailyBrowser?.checked
        ? 'webpage_mcp'
        : 'playwright',
    },
  };
}

async function saveExplorerSourceSettings(source) {
  const nextExplorer = collectExplorerSettings();
  const saved = await bridgeApi.updateSettings({ explorer: nextExplorer });
  latestSettingsPayload = saved;
  clearExplorerSourceDirty(source);
  applyExplorerSettings(saved.effective.explorer, { force: true });
  setMessage(
    source === 'doubao'
      ? elements.doubaoSourceMessage
      : elements.chatgptSourceMessage,
    `${source === 'doubao' ? '豆包' : 'ChatGPT'} 来源设置已保存。启用状态、抓取范围、抓取节奏与默认范围会立即按新配置生效。`,
    'success',
  );
  await refreshStatus();
}

async function handleRefresh() {
  try {
    await Promise.all([loadMeta(), refreshStatus()]);
  } catch (error) {
    renderSummary(null);
    renderNextStep(null);
    renderBlockingReasons({
      blockingReasons: [
        {
          message:
            error instanceof Error ? error.message : '无法连接 Personal AI',
          code: 'auth_required',
        },
      ],
    });
    renderStepStatuses(null);
    renderExplorerOverview(null, latestSettingsPayload?.effective?.explorer);
  }
}

elements.refreshButton.addEventListener('click', () => {
  void withAction(elements.refreshButton, '刷新中...', handleRefresh);
});

elements.openMemoryListButton?.addEventListener('click', () => {
  void appShell.openMemoryListWindow?.();
});

elements.openLogButton.addEventListener('click', () => {
  void appShell.openLogFile();
});

elements.openSupportButton.addEventListener('click', () => {
  void appShell.openSupportDir();
});

elements.installExtensionButton?.addEventListener('click', () => {
  void appShell.openExternal(CHROME_EXTENSION_URL);
});

elements.openInputMonitoringButton?.addEventListener('click', () => {
  void appShell.openInputMonitoringSettings();
});

elements.openAccessibilityButton?.addEventListener('click', () => {
  void appShell.openAccessibilitySettings();
});

elements.openMicrophoneButton?.addEventListener('click', () => {
  void appShell.openMicrophoneSettings();
});

elements.refreshShortcutButton?.addEventListener('click', () => {
  void withAction(elements.refreshShortcutButton, '检查中...', async () => {
    const payload = await appShell.refreshShortcutHelper();
    renderShortcutStatus(payload?.shortcutStatus);
  });
});

elements.voiceLocale?.addEventListener('change', () => {
  const select = elements.voiceLocale;
  select.disabled = true;
  void appShell
    .setVoicePreferences({
      voiceLocale: select.value,
    })
    .then((payload) => {
      select.value =
        typeof payload?.voiceLocale === 'string' && payload.voiceLocale.trim()
          ? payload.voiceLocale.trim()
          : 'zh-CN';
      setMessage(elements.metaShortcut, '语音识别语言已更新。', 'success');
    })
    .catch((error) => {
      setMessage(
        elements.metaShortcut,
        error instanceof Error ? error.message : '更新语音识别语言失败',
        'error',
      );
    })
    .finally(() => {
      select.disabled = false;
    });
});

elements.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const submitButton = elements.settingsForm.querySelector(
    'button[type="submit"]',
  );
  void withAction(submitButton, '保存中...', async () => {
    try {
      await saveRuntimeSettings();
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.settingsMessage,
        error instanceof Error ? error.message : '保存失败',
        'error',
      );
    }
  });
});

[
  elements.memoryBaseUrl,
  elements.memoryApiKey,
  elements.memoryUserId,
  elements.pollMinutes,
  elements.stableHours,
  elements.briefingHours,
  elements.reminderMinutes,
].forEach((field) => {
  field?.addEventListener('input', markSettingsDirty);
  field?.addEventListener('change', markSettingsDirty);
});

[
  elements.doubaoSourceEnabled,
  elements.doubaoSourceLookbackDays,
  elements.doubaoSourceIntervalMinutes,
  elements.doubaoSourceScope,
].forEach((field) => {
  field?.addEventListener('change', () => {
    markExplorerSourceDirty('doubao');
    syncSourceTogglePresentation('doubao');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
  field?.addEventListener('input', () => {
    markExplorerSourceDirty('doubao');
    syncSourceTogglePresentation('doubao');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
});

[
  elements.chatgptSourceEnabled,
  elements.chatgptSourceLookbackDays,
  elements.chatgptSourceIntervalMinutes,
  elements.chatgptSourceMaxConversations,
  elements.chatgptSourceScope,
].forEach((field) => {
  field?.addEventListener('change', () => {
    markExplorerSourceDirty('chatgpt');
    syncSourceTogglePresentation('chatgpt');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
  field?.addEventListener('input', () => {
    markExplorerSourceDirty('chatgpt');
    syncSourceTogglePresentation('chatgpt');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
});

// webpage-mcp transport toggles — wire guide card visibility and test buttons

if (elements.chatgptUseDailyBrowser) {
  elements.chatgptUseDailyBrowser.addEventListener('change', () => {
    syncWebpageMcpGuide(elements.chatgptUseDailyBrowser, elements.chatgptMcpGuide);
    markExplorerSourceDirty('chatgpt');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
}

if (elements.doubaoSourceUseDailyBrowser) {
  elements.doubaoSourceUseDailyBrowser.addEventListener('change', () => {
    syncWebpageMcpGuide(elements.doubaoSourceUseDailyBrowser, elements.doubaoSourceMcpGuide);
    markExplorerSourceDirty('doubao');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
}

if (elements.broadcastUseDailyBrowser) {
  elements.broadcastUseDailyBrowser.addEventListener('change', () => {
    syncWebpageMcpGuide(elements.broadcastUseDailyBrowser, elements.broadcastMcpGuide);
    markExplorerSourceDirty('doubao');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
}

if (elements.chatgptMcpTestButton) {
  elements.chatgptMcpTestButton.addEventListener('click', () => {
    void runMcpConnectionTest(elements.chatgptMcpTestMessage);
  });
}

if (elements.doubaoMcpTestButton) {
  elements.doubaoMcpTestButton.addEventListener('click', () => {
    void runMcpConnectionTest(elements.doubaoMcpTestMessage);
  });
}

if (elements.broadcastMcpTestButton) {
  elements.broadcastMcpTestButton.addEventListener('click', () => {
    void runMcpConnectionTest(elements.broadcastMcpTestMessage);
  });
}

elements.testMemoryButton.addEventListener('click', () => {
  void withAction(elements.testMemoryButton, '测试中...', async () => {
    try {
      await saveRuntimeSettings({ silent: true });
      const result = await bridgeApi.testMemoryService();
      setMessage(
        elements.settingsMessage,
        result.ok
          ? `Memory Service 连接成功：${result.baseUrl || 'configured'}`
          : result.error || '测试失败',
        result.ok ? 'success' : 'error',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.settingsMessage,
        error instanceof Error ? error.message : '连接测试失败',
        'error',
      );
    }
  });
});

elements.loginButton.addEventListener('click', () => {
  void withAction(elements.loginButton, '打开中...', async () => {
    try {
      const result = await bridgeApi.openLogin();
      setMessage(
        elements.loginMessage,
        `已打开登录窗口：${result.url}`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.loginMessage,
        error instanceof Error ? error.message : '打开登录窗口失败',
        'error',
      );
    }
  });
});

elements.memoryThreadButton.addEventListener('click', () => {
  void withAction(elements.memoryThreadButton, '创建中...', async () => {
    try {
      const thread = await bridgeApi.createMemorySyncThread();
      setMessage(
        elements.memoryThreadMessage,
        `已绑定：${thread.title || thread.id}`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.memoryThreadMessage,
        error instanceof Error ? error.message : '创建长期记忆线程失败',
        'error',
      );
    }
  });
});

elements.mobileThreadButton.addEventListener('click', () => {
  void withAction(elements.mobileThreadButton, '绑定中...', async () => {
    try {
      const binding = await bridgeApi.autoBindMobileThread();
      setMessage(
        elements.mobileThreadMessage,
        `已绑定：${binding.title || binding.threadId || '手机版对话'}`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.mobileThreadMessage,
        error instanceof Error ? error.message : '自动绑定手机对话失败',
        'error',
      );
    }
  });
});

elements.runStableButton.addEventListener('click', () => {
  void withAction(elements.runStableButton, '推送中...', async () => {
    try {
      await bridgeApi.runNow('stable_memory');
      setMessage(
        elements.memoryThreadMessage,
        '已手动推送一次 persona 到长期记忆线程。',
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.memoryThreadMessage,
        error instanceof Error ? error.message : '手动推送失败',
        'error',
      );
    }
  });
});

elements.runBriefingButton.addEventListener('click', () => {
  void withAction(elements.runBriefingButton, '推送中...', async () => {
    try {
      await bridgeApi.runNow('mobile_briefing');
      setMessage(
        elements.mobileThreadMessage,
        '已手动推送一次近期重点到手机对话。',
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.mobileThreadMessage,
        error instanceof Error ? error.message : '手动推送失败',
        'error',
      );
    }
  });
});

elements.runReminderButton.addEventListener('click', () => {
  void withAction(elements.runReminderButton, '推送中...', async () => {
    try {
      await bridgeApi.runNow('reminder_sync');
      setMessage(
        elements.mobileThreadMessage,
        '已手动推送一次待办 / 通知到手机对话。',
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.mobileThreadMessage,
        error instanceof Error ? error.message : '手动推送失败',
        'error',
      );
    }
  });
});

elements.doubaoSourceSaveButton.addEventListener('click', () => {
  void withAction(elements.doubaoSourceSaveButton, '保存中...', async () => {
    try {
      await saveExplorerSourceSettings('doubao');
    } catch (error) {
      setMessage(
        elements.doubaoSourceMessage,
        error instanceof Error ? error.message : '保存豆包来源设置失败',
        'error',
      );
    }
  });
});

elements.chatgptSourceSaveButton.addEventListener('click', () => {
  void withAction(elements.chatgptSourceSaveButton, '保存中...', async () => {
    try {
      await saveExplorerSourceSettings('chatgpt');
    } catch (error) {
      setMessage(
        elements.chatgptSourceMessage,
        error instanceof Error ? error.message : '保存 ChatGPT 来源设置失败',
        'error',
      );
    }
  });
});

elements.doubaoSourceLoginButton.addEventListener('click', () => {
  void withAction(elements.doubaoSourceLoginButton, '打开中...', async () => {
    try {
      const result = await explorerApi.openLogin('doubao');
      if (!result.implemented) {
        throw new Error('豆包 explorer 登录入口暂未实现。');
      }
      setMessage(
        elements.doubaoSourceMessage,
        result.url
          ? `已打开豆包来源登录：${result.url}`
          : '已打开豆包来源登录。',
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.doubaoSourceMessage,
        error instanceof Error ? error.message : '打开豆包来源登录失败',
        'error',
      );
    }
  });
});

elements.chatgptSourceLoginButton.addEventListener('click', () => {
  void withAction(elements.chatgptSourceLoginButton, '打开中...', async () => {
    try {
      const result = await explorerApi.openLogin('chatgpt');
      if (!result.implemented) {
        throw new Error('ChatGPT explorer 登录暂未接通。');
      }
      setMessage(
        elements.chatgptSourceMessage,
        result.url
          ? `已打开 ChatGPT 来源登录：${result.url}`
          : '已打开 ChatGPT 来源登录。',
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.chatgptSourceMessage,
        error instanceof Error ? error.message : '打开 ChatGPT 来源登录失败',
        'error',
      );
    }
  });
});

elements.doubaoSourceRunButton.addEventListener('click', () => {
  void withAction(elements.doubaoSourceRunButton, '抓取中...', async () => {
    try {
      const result = await explorerApi.runNow('doubao');
      setMessage(
        elements.doubaoSourceMessage,
        `豆包对话抓取完成，新增 ${result.insertedCount ?? 0} 条缓存消息。`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.doubaoSourceMessage,
        error instanceof Error ? error.message : '豆包对话抓取失败',
        'error',
      );
    }
  });
});

elements.chatgptSourceRunButton.addEventListener('click', () => {
  void withAction(elements.chatgptSourceRunButton, '抓取中...', async () => {
    try {
      const result = await explorerApi.runNow('chatgpt');
      if (!result.implemented) {
        throw new Error('ChatGPT explorer 抓取流程暂未实现。');
      }
      setMessage(
        elements.chatgptSourceMessage,
        `ChatGPT 输入抓取完成，新增 ${result.insertedCount ?? 0} 条缓存消息。`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.chatgptSourceMessage,
        error instanceof Error ? error.message : 'ChatGPT 输入抓取失败',
        'error',
      );
    }
  });
});

elements.stopButton.addEventListener('click', () => {
  void withAction(elements.stopButton, '停止中...', async () => {
    await appShell.stopBackgroundAndQuit();
  });
});

void Promise.all([loadMeta(), refreshStatus(), loadVoicePreferences()]);
refreshTimer = window.setInterval(() => {
  void refreshStatus();
}, 12_000);

window.addEventListener('beforeunload', () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});

appShell.onShortcutStatus((payload) => {
  renderShortcutStatus(payload);
});
