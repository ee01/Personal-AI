import {
  normalizeUiLanguage,
  setDesktopLanguage,
  t,
} from './i18n.js';

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
  uiLanguage: document.getElementById('ui-language'),
  voiceLocale: document.getElementById('voice-locale'),
  openInputMonitoringButton: document.getElementById(
    'open-input-monitoring-button',
  ),
  openAccessibilityButton: document.getElementById('open-accessibility-button'),
  openMicrophoneButton: document.getElementById('open-microphone-button'),
  openSpeechRecognitionButton: document.getElementById(
    'open-speech-recognition-button',
  ),
  refreshShortcutButton: document.getElementById('refresh-shortcut-button'),
  settingsForm: document.getElementById('settings-form'),
  memoryBaseUrl: document.getElementById('memory-base-url'),
  memoryApiKey: document.getElementById('memory-api-key'),
  memoryUserId: document.getElementById('memory-user-id'),
  pollMinutes: document.getElementById('poll-minutes'),
  stableHours: document.getElementById('stable-hours'),
  briefingHours: document.getElementById('briefing-hours'),
  reminderMinutes: document.getElementById('reminder-minutes'),
  reminderDailyEnabled: document.getElementById('reminder-daily-enabled'),
  reminderDailyTime: document.getElementById('reminder-daily-time'),
  reminderDedupSameDay: document.getElementById('reminder-dedup-same-day'),
  testMemoryButton: document.getElementById('test-memory-button'),
  settingsMessage: document.getElementById('settings-message'),
  loginButton: document.getElementById('login-button'),
  loginMessage: document.getElementById('login-message'),
  memoryThreadButton: document.getElementById('memory-thread-button'),
  runStableButton: document.getElementById('run-stable-button'),
  memoryThreadDetail: document.getElementById('memory-thread-detail'),
  memoryThreadMessage: document.getElementById('memory-thread-message'),
  mobileThreadButton: document.getElementById('mobile-thread-button'),
  runBriefingButton: document.getElementById('run-briefing-button'),
  runReminderButton: document.getElementById('run-reminder-button'),
  mobileThreadMessage: document.getElementById('mobile-thread-message'),
  syncAuditStatus: document.getElementById('sync-audit-status'),
  syncAuditList: document.getElementById('sync-audit-list'),
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
  doubaoSourcePendingCount: document.getElementById(
    'doubao-source-pending-count',
  ),
  doubaoSourceArtifactCount: document.getElementById(
    'doubao-source-artifact-count',
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
  doubaoSourceTransportBanner: document.getElementById(
    'doubao-source-transport-banner',
  ),
  doubaoSourceStatusMessage: document.getElementById(
    'doubao-source-status-message',
  ),
  doubaoSourceSaveButton: document.getElementById('doubao-source-save-button'),
  doubaoSourceLoginButton: document.getElementById(
    'doubao-source-login-button',
  ),
  doubaoSourceRunButton: document.getElementById('doubao-source-run-button'),
  doubaoSourcePreviewButton: document.getElementById(
    'doubao-source-preview-button',
  ),
  doubaoSourceResetButton: document.getElementById(
    'doubao-source-reset-button',
  ),
  doubaoSourcePreviewPanel: document.getElementById(
    'doubao-source-preview-panel',
  ),
  doubaoSourceMessage: document.getElementById('doubao-source-message'),
  doubaoSourceRevokeScope: document.getElementById(
    'doubao-source-revoke-scope',
  ),
  doubaoSourceRevokeButton: document.getElementById(
    'doubao-source-revoke-button',
  ),
  chatgptSourceAuthPill: document.getElementById('chatgpt-source-auth-pill'),
  chatgptSourceCacheCount: document.getElementById(
    'chatgpt-source-cache-count',
  ),
  chatgptSourceConversationCount: document.getElementById(
    'chatgpt-source-conversation-count',
  ),
  chatgptSourcePendingCount: document.getElementById(
    'chatgpt-source-pending-count',
  ),
  chatgptSourceArtifactCount: document.getElementById(
    'chatgpt-source-artifact-count',
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
  chatgptSourceStatusMessage: document.getElementById(
    'chatgpt-source-status-message',
  ),
  chatgptSourceSaveButton: document.getElementById(
    'chatgpt-source-save-button',
  ),
  chatgptSourceLoginButton: document.getElementById(
    'chatgpt-source-login-button',
  ),
  chatgptSourceRunButton: document.getElementById('chatgpt-source-run-button'),
  chatgptSourcePreviewButton: document.getElementById(
    'chatgpt-source-preview-button',
  ),
  chatgptSourceResetButton: document.getElementById(
    'chatgpt-source-reset-button',
  ),
  chatgptSourcePreviewPanel: document.getElementById(
    'chatgpt-source-preview-panel',
  ),
  chatgptSourceMessage: document.getElementById('chatgpt-source-message'),
  chatgptSourceRevokeScope: document.getElementById(
    'chatgpt-source-revoke-scope',
  ),
  chatgptSourceRevokeButton: document.getElementById(
    'chatgpt-source-revoke-button',
  ),
  doubaoSourceToggleStatus: document.getElementById(
    'doubao-source-toggle-status',
  ),
  chatgptSourceToggleStatus: document.getElementById(
    'chatgpt-source-toggle-status',
  ),
  // webpage-mcp transport toggles
  chatgptUseDailyBrowser: document.getElementById(
    'chatgpt-source-use-daily-browser',
  ),
  chatgptMcpGuide: document.getElementById('chatgpt-webpage-mcp-guide'),
  chatgptMcpTestButton: document.getElementById('chatgpt-mcp-test-button'),
  chatgptMcpTestMessage: document.getElementById('chatgpt-mcp-test-message'),
  doubaoSourceUseDailyBrowser: document.getElementById(
    'doubao-source-use-daily-browser',
  ),
  doubaoSourceMcpGuide: document.getElementById(
    'doubao-source-webpage-mcp-guide',
  ),
  doubaoMcpTestButton: document.getElementById('doubao-mcp-test-button'),
  doubaoMcpTestMessage: document.getElementById('doubao-mcp-test-message'),
  broadcastUseDailyBrowser: document.getElementById(
    'broadcast-use-daily-browser',
  ),
  broadcastMcpGuide: document.getElementById('broadcast-webpage-mcp-guide'),
  broadcastMcpTestButton: document.getElementById('broadcast-mcp-test-button'),
  broadcastMcpTestMessage: document.getElementById(
    'broadcast-mcp-test-message',
  ),
  broadcastTransportSaveButton: document.getElementById(
    'broadcast-transport-save-button',
  ),
  broadcastTransportMessage: document.getElementById(
    'broadcast-transport-message',
  ),
  broadcastTransportStatus: document.getElementById(
    'broadcast-transport-status',
  ),
};

let refreshTimer;
let settingsDirty = false;
let broadcastTransportDirty = false;
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

function formatCooldownRetry(cooldownUntil) {
  if (!cooldownUntil) return '';
  const untilMs = new Date(cooldownUntil).getTime();
  if (!Number.isFinite(untilMs)) return '';
  const remainingMs = untilMs - Date.now();
  if (remainingMs <= 0) {
    return '下次操作会重新尝试日常浏览器';
  }
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `约 ${minutes} 分钟后自动重试日常浏览器`;
}

function formatTransportFallbackCopy({
  prefix,
  reason,
  cooldownUntil,
  immediateRetryHint,
}) {
  const retry = formatCooldownRetry(cooldownUntil);
  return [
    `${prefix}：已临时回退到内置 Chromium`,
    retry,
    immediateRetryHint,
    reason ? `原因：${reason}` : '',
  ]
    .filter(Boolean)
    .join('；');
}

async function runMcpConnectionTest(msgEl) {
  if (!msgEl) return;
  msgEl.textContent = '测试中...';
  msgEl.className = 'field-hint';
  try {
    const result = await window.explorerApi?.testWebpageMcpConnection?.();
    if (result?.ok) {
      setMcpTestMessage(
        msgEl,
        `扩展已连接 ✓（检测到 ${result.tabCount} 个标签页）`,
        true,
      );
    } else {
      setMcpTestMessage(
        msgEl,
        result?.error ??
          '连接失败，请确认 Chrome 扩展已安装并显示为绿色连接状态。',
        false,
      );
    }
  } catch (err) {
    setMcpTestMessage(
      msgEl,
      `连接测试失败：${err instanceof Error ? err.message : err}`,
      false,
    );
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

function sourceUsesDailyBrowser(source, sourceStatus) {
  if (source === 'doubao') {
    return Boolean(
      elements.doubaoSourceUseDailyBrowser?.checked ||
        sourceStatus?.settings?.transport === 'webpage_mcp',
    );
  }
  return Boolean(
    elements.chatgptUseDailyBrowser?.checked ||
      sourceStatus?.settings?.transport === 'webpage_mcp',
  );
}

function broadcastUsesDailyBrowser() {
  return (
    latestSettingsPayload?.effective?.explorer?.doubao?.broadcastTransport ===
      'webpage_mcp' || elements.broadcastUseDailyBrowser?.checked
  );
}

function formatRunOutcome(sourceStatus) {
  if (!sourceStatus) return '待检查';
  if (sourceStatus.running) return '抓取中';
  if (!sourceStatus.enabled) return '已关闭自动抓取';
  if (sourceStatus.lastRunOutcome === 'success') {
    const summary = formatExplorerRunSummary(sourceStatus.lastRunSummary, {
      compact: true,
    });
    return summary ? `最近成功 · ${summary}` : '最近成功';
  }
  if (sourceStatus.lastRunOutcome === 'error') return '最近失败';
  if (sourceStatus.lastRunOutcome === 'stub') return '待实现';
  return '未执行';
}

function formatSyncKind(kind) {
  if (kind === 'stable_memory') return '长期记忆';
  if (kind === 'mobile_briefing') return '近期记忆重点';
  if (kind === 'reminder_sync') return '待办 / 通知';
  return kind || '同步';
}

function formatPackageKind(kind) {
  if (kind === 'persona_core') return 'Persona';
  if (kind === 'voice_mode') return 'Voice';
  if (kind === 'active_focus_digest') return '近期重点包';
  if (kind === 'todo_digest') return '待办包';
  if (kind === 'notice_digest') return '通知包';
  if (kind === 'reminder_digest') return '提醒包';
  if (kind === 'query_answer_card') return '查询卡片';
  return kind;
}

function formatSyncTrigger(trigger) {
  return trigger === 'manual' ? '手动' : '自动';
}

function formatAttemptStatus(status) {
  if (status === 'succeeded') return '已送达';
  if (status === 'skipped') return '已跳过';
  if (status === 'failed') return '失败';
  return '待确认';
}

function formatTransportMode(mode) {
  if (mode === 'webpage_mcp') return '日常 Chrome';
  if (mode === 'playwright') return '内置 Chromium';
  return '';
}

function formatAttemptTransport(attempt) {
  const modeLabel = formatTransportMode(attempt?.transportMode);
  if (modeLabel) return modeLabel;
  if (attempt?.transportUsed === 'dom') return 'DOM';
  return attempt?.transportUsed || '';
}

function formatReminderDeliveryMode(mode) {
  if (mode === 'new_items') return '新待办短轮询';
  if (mode === 'daily_digest') return '每日完整摘要';
  if (mode === 'manual') return '手动完整推送';
  return '';
}

function attemptTone(status) {
  if (status === 'succeeded') return 'ready';
  if (status === 'failed') return 'error';
  return 'pending';
}

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
}

function shortThreadId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
}

function formatInterval(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000} 小时`;
  if (ms % 60_000 === 0) return `${ms / 60_000} 分钟`;
  return `${Math.round(ms / 1000)} 秒`;
}

function formatAttemptDetails(attempt) {
  const details = [];
  const packageKinds = Array.isArray(attempt?.packageKinds)
    ? attempt.packageKinds.filter(Boolean)
    : [];
  if (packageKinds.length > 0) {
    details.push(`包：${packageKinds.map(formatPackageKind).join(' / ')}`);
  }
  if (typeof attempt?.packageItemCount === 'number') {
    details.push(`内容条目：${attempt.packageItemCount}`);
  }
  if (typeof attempt?.sourceRefCount === 'number') {
    details.push(`来源引用：${attempt.sourceRefCount}`);
  }
  const reminderDeliveryMode = formatReminderDeliveryMode(
    attempt?.reminderDeliveryMode,
  );
  if (reminderDeliveryMode) {
    details.push(`待办模式：${reminderDeliveryMode}`);
  }
  if (attempt?.externalThreadId) {
    details.push(`线程：${shortThreadId(attempt.externalThreadId)}`);
  }
  const verification = [];
  if (attempt?.verified === true) verification.push('已验证');
  if (attempt?.verified === false) verification.push('未验证');
  if (attempt?.messageVisible === true) verification.push('消息可见');
  if (attempt?.messageVisible === false) verification.push('未看到正文');
  if (attempt?.challengeDetected === true) verification.push('命中验证');
  const transportLabel = formatAttemptTransport(attempt);
  if (transportLabel) verification.push(`传输：${transportLabel}`);
  if (verification.length > 0) {
    details.push(verification.join(' · '));
  }
  if (attempt?.transportFallbackReason) {
    details.push(`回退原因：${attempt.transportFallbackReason}`);
  }
  if (attempt?.telemetryError) {
    details.push(`状态回写异常：${attempt.telemetryError}`);
  }
  return details;
}

function formatAttemptMessage(attempt) {
  const text = String(attempt?.errorMessage || '').trim();
  if (!text) return '';
  if (attempt.status === 'skipped') {
    return formatManualRunSkippedMessage(text, text);
  }
  if (attempt.status === 'failed') {
    return formatBridgeIssueMessage(text);
  }
  return text;
}

function setMessage(element, text, tone = 'muted') {
  if (!element) return;
  element.textContent = text || '';
  element.className = `inline-message ${
    tone === 'error'
      ? 'status-error'
      : tone === 'success'
      ? 'status-ready'
      : tone === 'warn'
      ? 'status-blocked'
      : ''
  }`;
}

function setVisibleMessage(element, text, tone = 'muted') {
  if (!element) return;
  const hasText = Boolean(String(text || '').trim());
  element.hidden = !hasText;
  setMessage(element, hasText ? text : '', tone);
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

function setManualRunResultMessage(element, result, { succeeded, skipped }) {
  if (result?.status === 'skipped') {
    setMessage(
      element,
      formatManualRunSkippedMessage(result.errorMessage, skipped),
      'warn',
    );
    return;
  }
  setMessage(element, succeeded, 'success');
}

function formatManualRunSkippedMessage(message, fallback) {
  const text = String(message || '').trim();
  if (!text) return fallback;

  if (text.includes(' / ')) {
    const parts = text
      .split(/\s+\/\s+/)
      .map((part) => formatManualRunSkippedMessage(part, part))
      .filter(Boolean);
    const uniqueParts = Array.from(new Set(parts));
    if (uniqueParts.length > 0) return uniqueParts.join('；');
  }

  if (/No stable memory items/i.test(text)) {
    return '本次没有可推送的 persona / 长期记忆。';
  }
  if (/No recent memory highlights/i.test(text)) {
    return '本次没有可推送的近期记忆重点；不会把 concerned items 或空摘要写入豆包。';
  }
  if (/No mobile briefing bullets extracted/i.test(text)) {
    return '近期重点渲染结果只有元信息或空占位，未推送到豆包。';
  }
  if (/No pending todos/i.test(text)) {
    return '本次没有可推送的待办。';
  }
  if (/No notices/i.test(text)) {
    return '本次没有可推送的通知。';
  }
  if (/No todo titles extracted/i.test(text)) {
    return '本次待办内容为空，未推送到豆包。';
  }
  if (/No notice titles extracted/i.test(text)) {
    return '本次通知内容为空，未推送到豆包。';
  }
  if (/Notice sync is not supported/i.test(text)) {
    return '当前 Memory Service 暂不支持通知同步；本次只检查待办。';
  }
  return text;
}

function formatBridgeIssueMessage(message) {
  const text = String(message || '').trim();
  if (!text) return '';

  if (/challenge|安全验证|真人验证|风险验证/i.test(text)) {
    return `${text}。请在豆包页面完成安全验证，再回到 Personal AI 重新推送；系统不会在验证页继续尝试写入。`;
  }

  if (/No editable element|没有找到可输入区域|no composer/i.test(text)) {
    return `${text}。请确认豆包标签页已经打开到可输入的对话页，或点击“打开登录窗口 / 打开 Chrome 豆包”重新建立会话。`;
  }

  if (/did not show the message|消息不可见|not show/i.test(text)) {
    return `${text}。系统没有确认消息出现在对话正文中，因此不会把本次同步当成已送达；请刷新豆包页后重试。`;
  }

  if (/different thread|不同线程/i.test(text)) {
    return `${text}。请重新绑定手机版对话，避免近期重点或待办进入错误线程。`;
  }

  return text;
}

function sourceDisplayName(source) {
  return source === 'doubao' ? '豆包' : 'ChatGPT';
}

function sourceHostName(source) {
  return source === 'doubao' ? 'doubao.com' : 'chatgpt.com';
}

function normalizeExplorerRunSummary(summary) {
  if (!summary) return null;
  return {
    insertedCount: Number(summary.insertedCount ?? 0),
    extractedConversationCount: Number(
      summary.extractedConversationCount ?? 0,
    ),
    extractedMessageCount: Number(summary.extractedMessageCount ?? 0),
    artifactCount: Number(summary.artifactCount ?? 0),
    skippedConversationCount: Number(summary.skippedConversationCount ?? 0),
  };
}

function formatExplorerRunSummary(summary, { compact = false } = {}) {
  const normalized = normalizeExplorerRunSummary(summary);
  if (!normalized) return '';
  const {
    insertedCount,
    extractedConversationCount,
    extractedMessageCount,
    artifactCount,
    skippedConversationCount,
  } = normalized;

  if (compact) {
    const parts = [`新增 ${insertedCount}`];
    if (extractedMessageCount > 0 || artifactCount > 0) {
      parts.push(`提炼 ${extractedMessageCount}`);
      parts.push(`记忆 ${artifactCount}`);
    }
    if (skippedConversationCount > 0) {
      parts.push(`跳过 ${skippedConversationCount}`);
    }
    return parts.join(' / ');
  }

  const parts = [`新增 ${insertedCount} 条缓存消息`];
  if (extractedMessageCount > 0 || artifactCount > 0) {
    parts.push(
      `提炼 ${extractedMessageCount} 条消息 / ${extractedConversationCount} 个对话`,
    );
    parts.push(`写入 ${artifactCount} 条记忆`);
  }
  if (skippedConversationCount > 0) {
    parts.push(`跳过 ${skippedConversationCount} 个无可沉淀对话`);
  }
  if (
    insertedCount === 0 &&
    extractedMessageCount === 0 &&
    artifactCount === 0 &&
    skippedConversationCount === 0
  ) {
    parts.push('没有待提炼内容');
  }
  return parts.join('，');
}

function formatExplorerRunCompletionMessage(source, result) {
  const summary = formatExplorerRunSummary(result);
  const subject = source === 'doubao' ? '豆包对话' : 'ChatGPT 输入';
  return `${subject}抓取完成：${summary}。`;
}

function getSourceUi(source) {
  return source === 'doubao'
    ? {
        label: '豆包',
        messageElement: elements.doubaoSourceMessage,
        previewButton: elements.doubaoSourcePreviewButton,
        resetButton: elements.doubaoSourceResetButton,
        previewPanel: elements.doubaoSourcePreviewPanel,
      }
    : {
        label: 'ChatGPT',
        messageElement: elements.chatgptSourceMessage,
        previewButton: elements.chatgptSourcePreviewButton,
        resetButton: elements.chatgptSourceResetButton,
        previewPanel: elements.chatgptSourcePreviewPanel,
      };
}

function previewText(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function formatPreviewRole(role) {
  if (role === 'user') return '用户';
  if (role === 'assistant') return '助手';
  return role || '未知角色';
}

function appendPreviewCounts(container, cache) {
  const counts = document.createElement('div');
  counts.className = 'source-preview-counts';
  const countLabels = [
    `缓存 ${formatMessageCount(cache?.messageCount)}`,
    `对话 ${formatMessageCount(cache?.conversationCount)}`,
    `待提炼 ${formatMessageCount(cache?.pendingExtractCount)}`,
    `活跃记忆 ${formatMessageCount(cache?.artifactCount)}`,
    `已撤回 ${formatMessageCount(cache?.revokedArtifactCount)}`,
  ];
  for (const label of countLabels) {
    const pill = document.createElement('span');
    pill.textContent = label;
    counts.appendChild(pill);
  }
  container.appendChild(counts);
}

function formatArtifactCount(cache) {
  const active = Number(cache?.artifactCount ?? 0);
  const revoked = Number(cache?.revokedArtifactCount ?? 0);
  return revoked > 0
    ? `${formatMessageCount(active)}（已撤回 ${formatMessageCount(revoked)}）`
    : formatMessageCount(active);
}

function formatRevokePreview(preview, fallbackScope) {
  const scope = normalizeInputScope(preview?.scope, fallbackScope);
  const active = Number(preview?.activeArtifactCount ?? 0);
  const legacy = Number(preview?.legacyUnscopedArtifactCount ?? 0);
  const revoked = Number(preview?.revokedArtifactCount ?? 0);
  const parts = [
    formatAskScope(scope),
    `可撤回 ${formatMessageCount(active)} 条本地 artifact`,
  ];
  if (legacy > 0) parts.push(`含旧审计 ${formatMessageCount(legacy)}`);
  if (revoked > 0) parts.push(`已撤回 ${formatMessageCount(revoked)}`);
  return parts.join(' · ');
}

function createPreviewListItem(title, body, meta) {
  const item = document.createElement('li');
  const titleElement = document.createElement('strong');
  titleElement.textContent = title;
  item.appendChild(titleElement);
  if (body) {
    const bodyElement = document.createElement('div');
    bodyElement.textContent = body;
    item.appendChild(bodyElement);
  }
  if (meta) {
    const metaElement = document.createElement('small');
    metaElement.textContent = meta;
    item.appendChild(metaElement);
  }
  return item;
}

function appendPreviewSection(panel, title, emptyText, rows, buildRow) {
  const section = document.createElement('section');
  section.className = 'source-preview-section';
  const heading = document.createElement('h5');
  heading.textContent = title;
  section.appendChild(heading);

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = emptyText;
    section.appendChild(empty);
    panel.appendChild(section);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'source-preview-list';
  for (const row of rows) {
    list.appendChild(buildRow(row));
  }
  section.appendChild(list);
  panel.appendChild(section);
}

function clearSourcePreviewPanel(source) {
  const panel = getSourceUi(source).previewPanel;
  if (!panel) return;
  panel.replaceChildren();
  panel.hidden = true;
}

function renderSourcePreview(source, preview) {
  const { label, previewPanel } = getSourceUi(source);
  if (!previewPanel) return;
  const conversations = Array.isArray(preview?.conversations)
    ? preview.conversations
    : [];
  const messages = Array.isArray(preview?.cleanedMessages)
    ? preview.cleanedMessages
    : [];
  const artifacts = Array.isArray(preview?.artifacts) ? preview.artifacts : [];
  const cursor = preview?.cursor;

  previewPanel.replaceChildren();
  previewPanel.hidden = false;

  const head = document.createElement('div');
  head.className = 'source-preview-head';
  const headMain = document.createElement('div');
  const title = document.createElement('h4');
  title.textContent = `${label} 本地缓存预览`;
  headMain.appendChild(title);
  const subtitle = document.createElement('p');
  subtitle.textContent = preview?.conversationId
    ? `当前会话：${preview.conversationId}`
    : '当前来源还没有可预览的会话。';
  headMain.appendChild(subtitle);
  head.appendChild(headMain);
  appendPreviewCounts(head, preview?.cache);
  previewPanel.appendChild(head);

  appendPreviewSection(
    previewPanel,
    '最近会话',
    '暂无本地缓存会话。',
    conversations.slice(0, 3),
    (conversation) =>
      createPreviewListItem(
        conversation.conversationId || '未知会话',
        previewText(conversation.latestMessagePreview || ''),
        [
          `消息 ${formatMessageCount(conversation.messageCount)}`,
          `待提炼 ${formatMessageCount(conversation.pendingMessageCount)}`,
          `已提炼 ${formatMessageCount(conversation.extractedMessageCount)}`,
          `活跃记忆 ${formatMessageCount(conversation.artifactCount)}`,
          Number(conversation.revokedArtifactCount ?? 0) > 0
            ? `已撤回 ${formatMessageCount(conversation.revokedArtifactCount)}`
            : '',
          `最新 ${formatTime(conversation.latestTs)}`,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
  );

  appendPreviewSection(
    previewPanel,
    '清洗后消息',
    '暂无可预览的缓存消息。',
    messages.slice(0, 6),
    (message) =>
      createPreviewListItem(
        `${formatPreviewRole(message.role)} · ${message.extracted ? '已提炼' : '待提炼'}`,
        previewText(message.content),
        [
          message.messageId ? `消息 ${message.messageId}` : '',
          message.ts ? `时间 ${formatTime(message.ts)}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
  );

  appendPreviewSection(
    previewPanel,
    '提炼结果',
    '这个会话还没有本地 artifact。',
    artifacts.slice(0, 6),
    (artifact) =>
      createPreviewListItem(
        [
          artifact.kind || 'fact',
          artifact.conversationRef || artifact.conversationId || '未知会话',
          artifact.scope ? formatAskScope(artifact.scope) : '',
          artifact.revokedAt ? '本地审计已撤回' : '',
        ]
          .filter(Boolean)
          .join(' · '),
        previewText(artifact.text),
        [
          artifact.sourceQuote
            ? `原句：${previewText(artifact.sourceQuote, 140)}`
            : '',
          artifact.revokedAt ? `撤回时间 ${formatTime(artifact.revokedAt)}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
  );

  const cursorText = cursor
    ? [
        cursor.lastMessageId ? `lastMessageId=${cursor.lastMessageId}` : '',
        cursor.lastProcessedUpdateTime
          ? `lastProcessed=${formatTime(cursor.lastProcessedUpdateTime)}`
          : '',
        cursor.processedMessageIds?.length
          ? `processed=${cursor.processedMessageIds.length}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '当前会话没有 cursor 记录。';
  appendPreviewSection(previewPanel, 'Cursor', cursorText, [], () => null);
}

function formatExplorerIssueMessage(source, sourceStatus) {
  const sourceLabel = sourceDisplayName(source);
  if (!sourceStatus) {
    return 'Explorer 状态暂不可用。请先刷新状态；如果仍然没有响应，请查看日志。';
  }

  const lastError = String(sourceStatus.lastError || '').trim();
  if (lastError) {
    const normalized = formatBridgeIssueMessage(lastError);
    const usesDailyBrowser = sourceUsesDailyBrowser(source, sourceStatus);
    let recovery = '可点击“登录来源”或“立即抓取”重新验证。';

    if (/login required|needs_login|not logged|unauthorized/i.test(lastError)) {
      recovery = usesDailyBrowser
        ? `请确认 Chrome 里已打开 ${sourceHostName(
            source,
          )} 并登录，或点击“登录来源”立即重试日常浏览器。`
        : '请点击“登录来源”重新登录，然后再立即抓取。';
    } else if (
      /No existing .*tab|tab.*not found|webpage-mcp|connector|extension/i.test(
        lastError,
      )
    ) {
      recovery = `请在 Chrome 打开 ${sourceHostName(
        source,
      )} 标签页并点“测试连接”，或关闭日常浏览器模式回到内置 Chromium。`;
    } else if (
      /Memory Service|X-User-Id|ECONN|fetch|timeout|connection|endpoint/i.test(
        lastError,
      )
    ) {
      recovery = '请先在上方测试 Memory Service，再重新抓取。';
    }

    return `最近一次自动读取失败：${normalized} ${recovery}`;
  }

  if (sourceStatus.lastRunOutcome === 'error') {
    return '最近一次自动读取失败，但没有返回具体错误。请查看日志，或点击“立即抓取”重新验证。';
  }

  if (!sourceStatus.enabled) {
    return '';
  }

  if (sourceStatus.authStatus === 'unsupported') {
    return `${sourceLabel} 来源暂不支持自动读取。`;
  }

  if (sourceStatus.authStatus === 'error') {
    return `${sourceLabel} 登录态检查异常。请点击“登录来源”重新建立会话，或切换日常浏览器模式后再试。`;
  }

  if (
    sourceStatus.authStatus !== 'connected' &&
    !sourceUsesDailyBrowser(source, sourceStatus)
  ) {
    return `${sourceLabel} 自动读取已开启，但还没有可用登录态。请先点击“登录来源”。`;
  }

  if (
    sourceStatus.authStatus !== 'connected' &&
    sourceUsesDailyBrowser(source, sourceStatus)
  ) {
    return `${sourceLabel} 自动读取已开启，但还没有确认日常浏览器登录态。请确保 Chrome 里已打开 ${sourceHostName(
      source,
    )} 并登录。`;
  }

  if (sourceStatus.lastRunOutcome === 'success') {
    const summary =
      formatExplorerRunSummary(sourceStatus.lastRunSummary) ||
      '没有新增缓存或待提炼内容';
    return `最近一次自动读取完成：${summary}。`;
  }

  return '';
}

function explorerIssueTone(sourceStatus) {
  if (!sourceStatus) return 'error';
  if (sourceStatus.lastError || sourceStatus.authStatus === 'error') {
    return 'error';
  }
  if (sourceStatus.lastRunOutcome === 'success') {
    return 'success';
  }
  return 'warn';
}

function pushUniqueRecoveryAction(actions, action) {
  if (
    !actions.some(
      (item) => item.action === action.action && item.kind === action.kind,
    )
  ) {
    actions.push(action);
  }
}

function getAttemptRecoveryActions(attempt) {
  if (!attempt || attempt.status !== 'failed') return [];

  const actions = [];
  const issueText = [attempt.errorMessage, attempt.telemetryError]
    .filter(Boolean)
    .join(' ');
  const kind = attempt.kind;
  const isStableKind = kind === 'stable_memory';
  const isMobileKind = kind === 'mobile_briefing' || kind === 'reminder_sync';

  if (
    /challenge|安全验证|真人验证|风险验证|No editable element|没有找到可输入区域|no composer|did not show the message|消息不可见|Browser page not available|browser has been closed|No existing doubao\.com tab|豆包浏览器/i.test(
      issueText,
    )
  ) {
    pushUniqueRecoveryAction(actions, {
      action: 'open_doubao',
      label: '打开豆包检查',
    });
  }

  if (
    /different thread|不同线程|mobile conversation|mobile_context|手机版对话|手机对话尚未绑定/i.test(
      issueText,
    ) ||
    isMobileKind
  ) {
    pushUniqueRecoveryAction(actions, {
      action: 'bind_mobile',
      label: '重新绑定手机对话',
    });
  }

  if (
    /memory_sync|目标线程尚未绑定|长期记忆线程|memory-sync/i.test(
      issueText,
    ) ||
    isStableKind
  ) {
    pushUniqueRecoveryAction(actions, {
      action: 'bind_memory',
      label: '修复长期记忆线程',
    });
  }

  if (
    /Memory Service|ECONN|fetch|timeout|connection|report failed|endpoint/i.test(
      issueText,
    )
  ) {
    pushUniqueRecoveryAction(actions, {
      action: 'test_memory',
      label: '测试 Memory Service',
    });
  }

  if (kind) {
    pushUniqueRecoveryAction(actions, {
      action: 'retry',
      kind,
      label: `重试${formatSyncKind(kind)}`,
    });
  }

  if (attempt.telemetryError) {
    pushUniqueRecoveryAction(actions, {
      action: 'open_log',
      label: '查看日志',
    });
  }

  return actions.slice(0, 4);
}

function triggerButtonOrExplain(button, messageElement, blockedMessage) {
  if (button && !button.disabled) {
    button.click();
    return;
  }
  setMessage(
    messageElement,
    blockedMessage ||
      '当前前置条件还不完整，请先按“下一步建议”修复后再重试。',
    'warn',
  );
}

function handleSyncAuditAction(action, kind) {
  if (action === 'open_doubao') {
    triggerButtonOrExplain(
      elements.loginButton,
      elements.loginMessage,
      '登录入口暂不可用，请先刷新状态。',
    );
    return;
  }

  if (action === 'bind_mobile') {
    triggerButtonOrExplain(
      elements.mobileThreadButton,
      elements.mobileThreadMessage,
      '请先完成豆包登录，然后再重新绑定手机对话。',
    );
    return;
  }

  if (action === 'bind_memory') {
    triggerButtonOrExplain(
      elements.memoryThreadButton,
      elements.memoryThreadMessage,
      '请先完成豆包登录，然后再修复长期记忆线程。',
    );
    return;
  }

  if (action === 'test_memory') {
    triggerButtonOrExplain(
      elements.testMemoryButton,
      elements.settingsMessage,
      '请先填写 Memory Service 配置，然后再测试连接。',
    );
    return;
  }

  if (action === 'retry') {
    if (kind === 'stable_memory') {
      triggerButtonOrExplain(
        elements.runStableButton,
        elements.memoryThreadMessage,
        '请先连接 Memory Service、完成豆包登录并绑定长期记忆线程，再重试 persona 同步。',
      );
      return;
    }
    if (kind === 'mobile_briefing') {
      triggerButtonOrExplain(
        elements.runBriefingButton,
        elements.mobileThreadMessage,
        '请先连接 Memory Service、完成豆包登录并绑定手机对话，再重试近期记忆重点同步。',
      );
      return;
    }
    if (kind === 'reminder_sync') {
      triggerButtonOrExplain(
        elements.runReminderButton,
        elements.mobileThreadMessage,
        '请先连接 Memory Service、完成豆包登录并绑定手机对话，再重试待办 / 通知同步。',
      );
    }
    return;
  }

  if (action === 'open_log') {
    void appShell.openLogFile();
  }
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
    reminderDailyDigestEnabled: !!elements.reminderDailyEnabled.checked,
    reminderDailyDigestTime: elements.reminderDailyTime.value || '09:00',
    reminderDedupSameDay: !!elements.reminderDedupSameDay.checked,
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

function selectedBroadcastTransport() {
  return elements.broadcastUseDailyBrowser?.checked
    ? 'webpage_mcp'
    : 'playwright';
}

function describeBroadcastTransport(transport = selectedBroadcastTransport()) {
  return transport === 'webpage_mcp'
    ? '日常 Chrome 登录态'
    : '桌面端 Chromium profile';
}

function formatLoginOpenedMessage(result) {
  const selectedDailyBrowser = selectedBroadcastTransport() === 'webpage_mcp';
  const transport = result?.browserTransport;
  const actualMode = transport?.mode;
  const fallbackReason = transport?.fallbackReason;

  if (selectedDailyBrowser && actualMode === 'playwright') {
    return [
      `日常 Chrome 暂不可用，已打开内置 Chromium 登录窗口：${result.url}`,
      fallbackReason ? `原因：${fallbackReason}` : '',
    ]
      .filter(Boolean)
      .join('；');
  }

  if (selectedDailyBrowser) {
    return `已打开 Chrome 豆包标签页：${result.url}`;
  }

  return `已打开登录窗口：${result.url}`;
}

function loginOpenedTone(result) {
  return selectedBroadcastTransport() === 'webpage_mcp' &&
    result?.browserTransport?.mode === 'playwright'
    ? 'warn'
    : 'success';
}

function syncBroadcastTransportPresentation() {
  if (!elements.loginButton) return;
  elements.loginButton.textContent =
    selectedBroadcastTransport() === 'webpage_mcp'
      ? '打开 Chrome 豆包'
      : '打开登录窗口';
}

function clearBroadcastTransportDirty() {
  broadcastTransportDirty = false;
}

function syncBroadcastTransportDirtyFromControl() {
  const savedTransport =
    latestSettingsPayload?.effective?.explorer?.doubao?.broadcastTransport ??
    'playwright';
  const selectedTransport = selectedBroadcastTransport();
  broadcastTransportDirty = selectedTransport !== savedTransport;
  if (broadcastTransportDirty) {
    setMessage(
      elements.broadcastTransportMessage,
      `广播方式尚未保存：将切换为${describeBroadcastTransport(
        selectedTransport,
      )}。保存后生效；登录、绑定和手动推送会先自动保存。`,
      'warn',
    );
  } else {
    setMessage(elements.broadcastTransportMessage, '');
  }
  syncBroadcastTransportPresentation();
}

function applyRuntimeSettings(settings, { force = false } = {}) {
  if (!settings) return;
  const uiLanguage = setDesktopLanguage(settings.uiLanguage);
  if (elements.uiLanguage) {
    elements.uiLanguage.value = uiLanguage;
  }
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
  elements.reminderDailyEnabled.checked =
    settings.reminderDailyDigestEnabled !== false;
  elements.reminderDailyTime.value = settings.reminderDailyDigestTime || '09:00';
  elements.reminderDedupSameDay.checked = settings.reminderDedupSameDay !== false;
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
  if (elements.broadcastUseDailyBrowser && !broadcastTransportDirty) {
    elements.broadcastUseDailyBrowser.checked =
      explorerSettings.doubao?.broadcastTransport === 'webpage_mcp';
    syncWebpageMcpGuide(
      elements.broadcastUseDailyBrowser,
      elements.broadcastMcpGuide,
    );
    syncBroadcastTransportPresentation();
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
      label: '同步 · 近期记忆重点 / 待办 → 豆包',
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
  const syncError =
    status?.syncState?.lastErrorMessage || status?.lastError || '';
  const visibleReasons = [...reasons];
  if (syncError) {
    visibleReasons.push({
      message: `最近一次自动同步失败：${formatBridgeIssueMessage(syncError)}`,
    });
  }

  elements.blockingReasons.replaceChildren();

  if (visibleReasons.length === 0) {
    const pill = document.createElement('div');
    pill.className = 'reason-pill status-ready';
    pill.textContent = '所有前置条件已满足，自动同步可以正常运行。';
    elements.blockingReasons.appendChild(pill);
    return;
  }

  for (const reason of visibleReasons) {
    const pill = document.createElement('div');
    pill.className = 'reason-pill status-blocked';
    pill.textContent = reason.message;
    elements.blockingReasons.appendChild(pill);
  }
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
      broadcastUsesDailyBrowser()
        ? '请在日常 Chrome 里打开 doubao.com 并登录；Personal AI 只会操作明确的豆包标签页，成功后再继续绑定输出线程。'
        : '桥接器需要独立浏览器 profile 才能继续绑定输出线程，也才能读取豆包输入来源。',
    ],
    [
      !checklist.memorySyncBound,
      '创建 / 修复长期记忆线程',
      '先把 persona_core 和 voice_mode 绑定到可打开的专用豆包线程，保证输出侧仍然稳定工作。',
    ],
    [
      !checklist.mobileContextBound,
      '绑定手机版对话',
      '让近期记忆重点、待办和通知推送回你真正会继续使用的那条手机对话。',
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
    element.className = `step-status ${
      ok ? 'step-status-ready' : 'step-status-pending'
    }`;
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

function resolveBoundThread(status, bindingType) {
  const binding = status?.bindings?.[bindingType];
  const record = (status?.threads || []).find(
    (thread) => thread.id === binding?.threadId,
  );
  return {
    binding,
    record,
    threadId: binding?.threadId || record?.id,
    title: binding?.title || record?.title,
    url: binding?.threadUrl || record?.url,
  };
}

function appendThreadDetailLine(container, text) {
  if (!text) return;
  const line = document.createElement('span');
  line.textContent = text;
  container.appendChild(line);
}

function renderMemoryThreadDetail(status) {
  const panel = elements.memoryThreadDetail;
  if (!panel) return;

  panel.replaceChildren();
  const checklist = status?.setupChecklist || {};
  const ready = Boolean(checklist.memorySyncBound);
  const stableAttempt = (status?.syncState?.recentAttempts || []).find(
    (attempt) => attempt.kind === 'stable_memory',
  );
  const thread = resolveBoundThread(status, 'memory_sync');
  const hasFailure = stableAttempt?.status === 'failed';
  const tone = hasFailure ? 'error' : ready ? 'ready' : 'pending';
  panel.className = `thread-detail thread-detail-${tone}`;

  const head = document.createElement('div');
  head.className = 'thread-detail-head';
  const title = document.createElement('strong');
  title.textContent = ready
    ? hasFailure
      ? '长期记忆线程需要检查'
      : '长期记忆线程已绑定'
    : '长期记忆线程未就绪';
  head.appendChild(title);
  const badge = document.createElement('span');
  badge.textContent = ready ? '可审计' : '待修复';
  head.appendChild(badge);
  panel.appendChild(head);

  const meta = document.createElement('div');
  meta.className = 'thread-detail-meta';
  if (ready) {
    appendThreadDetailLine(
      meta,
      `目标：${thread.title || '长期记忆同步线程'}${
        thread.threadId ? ` · ${shortThreadId(thread.threadId)}` : ''
      }`,
    );
    appendThreadDetailLine(meta, thread.url ? `链接：${thread.url}` : '');
  } else {
    const blocker = (status?.blockingReasons || []).find(
      (reason) => reason.code === 'memory_sync_not_bound',
    );
    appendThreadDetailLine(
      meta,
      blocker?.message ||
        '还没有绑定可打开的 doubao.com /chat 或 /thread 长期记忆线程。',
    );
  }

  if (stableAttempt) {
    appendThreadDetailLine(
      meta,
      `最近长期记忆同步：${formatAttemptStatus(
        stableAttempt.status,
      )} · ${formatSyncTrigger(stableAttempt.trigger)} · ${formatTime(
        stableAttempt.completedAt || stableAttempt.startedAt,
      )}`,
    );
    const attemptMessage = formatAttemptMessage(stableAttempt);
    appendThreadDetailLine(meta, attemptMessage);
  } else {
    appendThreadDetailLine(
      meta,
      '最近长期记忆同步：还没有记录，手动推送 persona 后会写入审计。',
    );
  }

  const stableTask = status?.syncState?.tasks?.stableMemory;
  const interval = formatInterval(stableTask?.intervalMs);
  appendThreadDetailLine(
    meta,
    [
      interval ? `节奏：每 ${interval}` : '',
      stableTask?.nextDueAt ? `下次：${formatTime(stableTask.nextDueAt)}` : '',
      stableTask?.lastRunAt ? `上次：${formatTime(stableTask.lastRunAt)}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  );
  panel.appendChild(meta);

  const recoveryActions = getAttemptRecoveryActions(stableAttempt);
  if (recoveryActions.length > 0) {
    const actionRow = document.createElement('div');
    actionRow.className = 'thread-detail-actions';
    for (const recoveryAction of recoveryActions.slice(0, 3)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary compact-button thread-detail-action';
      button.dataset.threadAction = recoveryAction.action;
      if (recoveryAction.kind) {
        button.dataset.threadKind = recoveryAction.kind;
      }
      button.textContent = recoveryAction.label;
      actionRow.appendChild(button);
    }
    panel.appendChild(actionRow);
  }
}

function renderSyncAudit(status) {
  const attempts = status?.syncState?.recentAttempts || [];
  const latest = attempts[0];
  setStatusPill(
    elements.syncAuditStatus,
    latest ? formatAttemptStatus(latest.status) : '待记录',
    latest ? attemptTone(latest.status) : 'pending',
  );

  elements.syncAuditList?.replaceChildren();
  if (!elements.syncAuditList) return;

  if (attempts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sync-audit-empty';
    empty.textContent =
      '还没有同步记录。手动推送或后台自动同步后会显示最近结果，并在本机重启后保留。';
    elements.syncAuditList.appendChild(empty);
    return;
  }

  for (const attempt of attempts.slice(0, 6)) {
    const item = document.createElement('div');
    item.className = 'sync-audit-item';

    const head = document.createElement('div');
    head.className = 'sync-audit-item-head';

    const title = document.createElement('strong');
    title.textContent = formatSyncKind(attempt.kind);
    head.appendChild(title);

    const badge = document.createElement('span');
    badge.className = `sync-audit-badge sync-audit-badge-${attemptTone(
      attempt.status,
    )}`;
    badge.textContent = formatAttemptStatus(attempt.status);
    head.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'sync-audit-meta';

    const left = document.createElement('span');
    left.textContent = `${formatSyncTrigger(attempt.trigger)} · ${formatTime(
      attempt.completedAt || attempt.startedAt,
    )}`;
    meta.appendChild(left);

    const duration = formatDuration(attempt.durationMs);
    if (duration) {
      const right = document.createElement('span');
      right.textContent = duration;
      meta.appendChild(right);
    }

    item.appendChild(head);
    item.appendChild(meta);

    const details = formatAttemptDetails(attempt);
    if (details.length > 0) {
      const detailRow = document.createElement('div');
      detailRow.className = 'sync-audit-details';
      detailRow.textContent = details.join(' · ');
      item.appendChild(detailRow);
    }

    const message = formatAttemptMessage(attempt);
    if (message) {
      const reason = document.createElement('p');
      reason.className = 'sync-audit-reason';
      reason.textContent = message;
      item.appendChild(reason);
    }

    const recoveryActions = getAttemptRecoveryActions(attempt);
    if (recoveryActions.length > 0) {
      const actionRow = document.createElement('div');
      actionRow.className = 'sync-audit-actions';
      for (const recoveryAction of recoveryActions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary compact-button sync-audit-action';
        button.dataset.syncAuditAction = recoveryAction.action;
        if (recoveryAction.kind) {
          button.dataset.syncAuditKind = recoveryAction.kind;
        }
        button.textContent = recoveryAction.label;
        actionRow.appendChild(button);
      }
      item.appendChild(actionRow);
    }

    elements.syncAuditList.appendChild(item);
  }
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

function renderBroadcastTransportStatus(status) {
  const banner = elements.broadcastTransportStatus;
  if (!banner) return;

  if (!status) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  const transport = status?.browserTransport;
  const preferredDailyBrowser =
    transport?.preferredMode === 'webpage_mcp' ||
    latestSettingsPayload?.effective?.explorer?.doubao?.broadcastTransport ===
      'webpage_mcp';

  if (!preferredDailyBrowser) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  banner.hidden = false;

  if (transport?.fallbackReason) {
    banner.className = 'inline-message status-blocked';
    banner.textContent = formatTransportFallbackCopy({
      prefix: '当前广播传输',
      reason: transport.fallbackReason,
      cooldownUntil: transport.fallbackCooldownUntil,
      immediateRetryHint: '点击“打开 Chrome 豆包”或重新绑定线程会立即重新尝试',
    });
    return;
  }

  if (transport?.mode === 'webpage_mcp') {
    banner.className =
      status?.authStatus === 'connected'
        ? 'inline-message success'
        : 'inline-message';
    banner.textContent =
      status?.authStatus === 'connected'
        ? '当前广播传输：日常 Chrome（webpage-mcp），已借用豆包登录态。'
        : '当前广播传输：日常 Chrome（webpage-mcp）。请先在 Chrome 打开 doubao.com 并登录。';
    return;
  }

  banner.className = 'inline-message';
  banner.textContent =
    '当前广播传输：日常 Chrome（webpage-mcp）。保存后会优先借用日常 Chrome 中的豆包登录态。';
}

function clearSourceTransportBanner(source) {
  const banner =
    source === 'doubao'
      ? elements.doubaoSourceTransportBanner
      : elements.chatgptSourceTransportBanner;
  if (!banner) return;
  banner.hidden = true;
  banner.textContent = '';
  banner.className = 'inline-message';
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
  const pendingCount = isDoubao
    ? elements.doubaoSourcePendingCount
    : elements.chatgptSourcePendingCount;
  const artifactCount = isDoubao
    ? elements.doubaoSourceArtifactCount
    : elements.chatgptSourceArtifactCount;
  const lastRun = isDoubao
    ? elements.doubaoSourceLastRun
    : elements.chatgptSourceLastRun;
  const runState = isDoubao
    ? elements.doubaoSourceRunState
    : elements.chatgptSourceRunState;
  const revokeScope = isDoubao
    ? elements.doubaoSourceRevokeScope
    : elements.chatgptSourceRevokeScope;
  const statusMessage = isDoubao
    ? elements.doubaoSourceStatusMessage
    : elements.chatgptSourceStatusMessage;

  if (!sourceStatus) {
    clearSourceTransportBanner(source);
    setStatusPill(authPill, '暂不可用', 'error');
    cacheCount.textContent = '-';
    conversationCount.textContent = '-';
    if (pendingCount) pendingCount.textContent = '-';
    if (artifactCount) artifactCount.textContent = '-';
    lastRun.textContent = '-';
    runState.textContent = 'Explorer 未响应';
    if (revokeScope) {
      revokeScope.textContent = '-';
    }
    setVisibleMessage(
      statusMessage,
      formatExplorerIssueMessage(source, sourceStatus),
      'error',
    );
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
  if (pendingCount) {
    pendingCount.textContent = formatMessageCount(
      sourceStatus.cache?.pendingExtractCount,
    );
  }
  if (artifactCount) {
    artifactCount.textContent = formatArtifactCount(sourceStatus.cache);
  }
  lastRun.textContent = formatTime(sourceStatus.lastRunAt);
  runState.textContent = formatRunOutcome(sourceStatus);
  if (revokeScope) {
    const defaultScope = normalizeInputScope(
      sourceStatus.settings?.defaultScope,
      source === 'doubao' ? 'personal' : 'work',
    );
    revokeScope.textContent = formatRevokePreview(
      sourceStatus.revokePreview,
      defaultScope,
    );
  }
  setVisibleMessage(
    statusMessage,
    formatExplorerIssueMessage(source, sourceStatus),
    explorerIssueTone(sourceStatus),
  );
  renderSourceTransportBanner(source, sourceStatus);
}

function renderSourceTransportBanner(source, sourceStatus) {
  const isDoubao = source === 'doubao';
  const banner = isDoubao
    ? elements.doubaoSourceTransportBanner
    : elements.chatgptSourceTransportBanner;
  if (!banner) return;
  const transport = sourceStatus.transport;
  const preferredDailyBrowser =
    sourceStatus.settings?.transport === 'webpage_mcp';
  const sourceLabel = isDoubao ? '豆包' : 'ChatGPT';

  if ((!transport || transport.mode === 'unknown') && !preferredDailyBrowser) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  if (
    transport?.mode === 'playwright' &&
    !transport.fallbackReason &&
    !preferredDailyBrowser
  ) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  banner.hidden = false;

  if (transport?.fallbackReason) {
    banner.className = 'inline-message status-blocked';
    banner.textContent = formatTransportFallbackCopy({
      prefix: '当前传输',
      reason: transport.fallbackReason,
      cooldownUntil: transport.fallbackCooldownUntil,
      immediateRetryHint: '点击“登录来源”会立即重新尝试',
    });
    return;
  }

  if (transport?.mode === 'webpage_mcp') {
    banner.hidden = false;
    if (sourceStatus.authStatus === 'connected') {
      banner.className = 'inline-message success';
      banner.textContent = `当前传输：日常浏览器（webpage-mcp）。已借用 ${sourceLabel} 登录态。`;
    } else {
      banner.className = 'inline-message';
      banner.textContent = `当前传输：日常浏览器（webpage-mcp）。保存并开启后会使用日常浏览器 ${sourceLabel} 登录态。`;
    }
    return;
  }

  if (preferredDailyBrowser) {
    banner.className = 'inline-message';
    banner.textContent = `当前传输：日常浏览器（webpage-mcp）。保存并开启后会使用日常浏览器 ${sourceLabel} 登录态。`;
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
  if (elements.broadcastTransportSaveButton) {
    elements.broadcastTransportSaveButton.disabled =
      !latestSettingsPayload || !broadcastTransportDirty;
  }

  elements.doubaoSourceLoginButton.disabled =
    !doubaoSource || doubaoSource.running;
  elements.doubaoSourceRunButton.disabled =
    !doubaoSource ||
    doubaoSource.running ||
    doubaoSource.authStatus !== 'connected';
  if (elements.doubaoSourcePreviewButton) {
    elements.doubaoSourcePreviewButton.disabled =
      !doubaoSource || doubaoSource.running;
  }
  if (elements.doubaoSourceResetButton) {
    elements.doubaoSourceResetButton.disabled =
      !doubaoSource || doubaoSource.running;
  }

  elements.chatgptSourceLoginButton.disabled =
    !chatgptSource ||
    chatgptSource.running ||
    chatgptSource.authStatus === 'unsupported';
  elements.chatgptSourceRunButton.disabled =
    !chatgptSource ||
    chatgptSource.running ||
    chatgptSource.authStatus === 'unsupported';
  if (elements.chatgptSourcePreviewButton) {
    elements.chatgptSourcePreviewButton.disabled =
      !chatgptSource || chatgptSource.running;
  }
  if (elements.chatgptSourceResetButton) {
    elements.chatgptSourceResetButton.disabled =
      !chatgptSource || chatgptSource.running;
  }
  if (elements.doubaoSourceRevokeButton) {
    elements.doubaoSourceRevokeButton.disabled =
      !memoryConnected || !doubaoSource || doubaoSource.running;
  }
  if (elements.chatgptSourceRevokeButton) {
    elements.chatgptSourceRevokeButton.disabled =
      !memoryConnected || !chatgptSource || chatgptSource.running;
  }

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
  const usesDailyBrowser = sourceUsesDailyBrowser(source, sourceStatus);

  let blockedReason = null;
  if (!memoryReady) {
    blockedReason = '请先配置 Memory Service';
  } else if (!sourceStatus) {
    blockedReason = '正在检查...';
  } else if (sourceStatus.authStatus === 'unsupported') {
    blockedReason = '该平台暂不支持';
  } else if (sourceStatus.authStatus !== 'connected' && !usesDailyBrowser) {
    blockedReason =
      sourceStatus.authStatus === 'error'
        ? '登录态异常，请重新登录'
        : '请先点击"登录来源"';
  }

  if (blockedReason) {
    input.disabled = true;
    wrapper?.classList.add('is-disabled');
    wrapper?.classList.toggle('is-on', Boolean(input.checked));
    if (statusLabel) {
      statusLabel.textContent = input.checked
        ? `已开启，${blockedReason}`
        : blockedReason;
    }
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
  renderMemoryThreadDetail(status);
  renderBroadcastTransportStatus(status);
  renderSyncAudit(status);
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

async function saveBroadcastTransportSettings({
  silent = false,
  refresh = true,
} = {}) {
  const currentExplorer = latestSettingsPayload?.effective?.explorer;
  if (!currentExplorer) {
    throw new Error('广播方式设置尚未加载完成，请稍后重试。');
  }
  const nextExplorer = {
    ...currentExplorer,
    doubao: {
      ...currentExplorer.doubao,
      broadcastTransport: selectedBroadcastTransport(),
    },
  };
  const saved = await bridgeApi.updateSettings({ explorer: nextExplorer });
  latestSettingsPayload = saved;
  clearBroadcastTransportDirty();
  applyExplorerSettings(saved.effective.explorer);
  applyButtonAvailability(latestStatus, latestExplorerStatus);
  if (!silent) {
    setMessage(
      elements.broadcastTransportMessage,
      elements.broadcastUseDailyBrowser?.checked
        ? '广播方式已保存：会优先借用日常 Chrome 中的豆包登录态。'
        : '广播方式已保存：会使用桌面端自带 Chromium profile。',
      'success',
    );
  }
  if (refresh) {
    await refreshStatus();
  }
  return saved;
}

async function savePendingBroadcastTransport() {
  if (broadcastTransportDirty) {
    await saveBroadcastTransportSettings({ silent: true, refresh: false });
    setMessage(
      elements.broadcastTransportMessage,
      `已先保存广播方式：${describeBroadcastTransport()}。正在继续当前操作。`,
      'success',
    );
  }
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
      broadcastTransport: currentExplorer.doubao.broadcastTransport,
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

async function saveExplorerSourceSettings(
  source,
  { silent = false, refresh = true } = {},
) {
  const nextExplorer = collectExplorerSettings();
  const saved = await bridgeApi.updateSettings({ explorer: nextExplorer });
  latestSettingsPayload = saved;
  clearExplorerSourceDirty(source);
  applyExplorerSettings(saved.effective.explorer, { force: true });
  if (!silent) {
    setMessage(
      source === 'doubao'
        ? elements.doubaoSourceMessage
        : elements.chatgptSourceMessage,
      `${
        source === 'doubao' ? '豆包' : 'ChatGPT'
      } 来源设置已保存。启用状态、抓取范围、抓取节奏与默认范围会立即按新配置生效。`,
      'success',
    );
  }
  if (refresh) {
    await refreshStatus();
  }
}

async function savePendingExplorerSourceSettings(source) {
  if (!explorerSourceDirty.has(source)) return;

  await saveExplorerSourceSettings(source, {
    silent: true,
    refresh: false,
  });
  setMessage(
    source === 'doubao'
      ? elements.doubaoSourceMessage
      : elements.chatgptSourceMessage,
    `${
      source === 'doubao' ? '豆包' : 'ChatGPT'
    } 来源设置已先保存，正在按最新设置继续执行。`,
    'success',
  );
}

async function previewExplorerCacheForSource(source) {
  const { label, messageElement, previewButton } = getSourceUi(source);
  await withAction(previewButton, '加载中...', async () => {
    try {
      const preview = await explorerApi.preview({ source, limit: 6 });
      renderSourcePreview(source, preview);
      setMessage(
        messageElement,
        `已加载 ${label} 本地缓存预览。这里展示的是本机 raw cache / artifact / cursor，不会读取远端聊天。`,
        'success',
      );
    } catch (error) {
      setMessage(
        messageElement,
        error instanceof Error ? `预览失败：${error.message}` : '预览缓存失败',
        'error',
      );
    }
  });
}

async function resetExplorerCacheForSource(source) {
  const sourceStatus = latestExplorerStatus?.sources?.[source];
  const { label, messageElement, resetButton } = getSourceUi(source);
  const cachedMessages = Number(sourceStatus?.cache?.messageCount ?? 0);
  const artifacts = Number(sourceStatus?.cache?.artifactCount ?? 0);
  const revokedArtifacts = Number(
    sourceStatus?.cache?.revokedArtifactCount ?? 0,
  );
  const ok = window.confirm(
    `确定重置 ${label} 的本地 Explorer 缓存吗？\n\n将清理约 ${cachedMessages} 条缓存消息、${artifacts} 条活跃 artifact 和 ${revokedArtifacts} 条已撤回审计 artifact，并重置抓取 cursor。已写入 Memory Service 的记忆不会被删除；需要删除已入库记忆时请使用“撤回已入库记忆”。`,
  );
  if (!ok) return;

  await withAction(resetButton, '重置中...', async () => {
    try {
      const result = await explorerApi.resetCache(source);
      const deletedMessages = Number(result?.deletedMessages ?? 0);
      const deletedCursors = Number(result?.deletedCursors ?? 0);
      clearSourcePreviewPanel(source);
      setMessage(
        messageElement,
        `已重置 ${label} 本地缓存：清理 ${deletedMessages} 条缓存消息，重置 ${deletedCursors} 个 cursor。已入库记忆未变。`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        messageElement,
        error instanceof Error
          ? `重置缓存失败：${error.message}`
          : '重置本地缓存失败',
        'error',
      );
    }
  });
}

async function revokeIngestedMemoryForSource(source) {
  const sourceStatus = latestExplorerStatus?.sources?.[source];
  const scope = normalizeInputScope(
    sourceStatus?.settings?.defaultScope,
    source === 'doubao' ? 'personal' : 'work',
  );
  const sourceLabel = source === 'doubao' ? '豆包' : 'ChatGPT';
  const messageElement =
    source === 'doubao'
      ? elements.doubaoSourceMessage
      : elements.chatgptSourceMessage;
  const button =
    source === 'doubao'
      ? elements.doubaoSourceRevokeButton
      : elements.chatgptSourceRevokeButton;
  const preview = sourceStatus?.revokePreview;
  const localArtifacts = Number(preview?.activeArtifactCount ?? 0);
  const legacyArtifacts = Number(preview?.legacyUnscopedArtifactCount ?? 0);
  const legacyNote =
    legacyArtifacts > 0
      ? `\n其中 ${legacyArtifacts} 条来自旧版本地审计记录，缺少历史 scope；本次会按当前范围一起标记为已撤回。`
      : '';

  const ok = window.confirm(
    `确定撤回 ${sourceLabel} 来源写入「${formatAskScope(
      scope,
    )}」范围的已入库记忆吗？\n\n本地可审计 artifact 约 ${localArtifacts} 条。${legacyNote}\n这只会删除 Memory Service 中对应来源/范围的记忆，不会删除原始聊天，也不会清理本地审计缓存；成功后本地 artifact 会标记为已撤回，避免继续显示成活跃记忆。`,
  );
  if (!ok) return;

  await withAction(button, '撤回中...', async () => {
    try {
      const result = await explorerApi.revokeIngestedMemory(source, scope);
      const deletedMessages = Number(result?.deletedMessages ?? 0);
      const deletedChunks = Number(result?.deletedChunks ?? 0);
      const localArtifactsRevoked = Number(
        result?.localArtifactsRevoked ?? 0,
      );
      const localLegacyArtifactsRevoked = Number(
        result?.localLegacyArtifactsRevoked ?? 0,
      );
      const legacyResult =
        localLegacyArtifactsRevoked > 0
          ? `，其中旧审计 ${localLegacyArtifactsRevoked} 条`
          : '';
      setMessage(
        messageElement,
        `已撤回 ${sourceLabel} / ${formatAskScope(
          scope,
        )}：删除 ${deletedMessages} 条消息、${deletedChunks} 个记忆块；本地 ${localArtifactsRevoked} 条 artifact 已标记为审计撤回${legacyResult}。`,
        'success',
      );
      await refreshStatus();
    } catch (error) {
      setMessage(
        messageElement,
        error instanceof Error
          ? `撤回失败：${error.message}`
          : '撤回已入库记忆失败',
        'error',
      );
    }
  });
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
    renderMemoryThreadDetail(null);
    renderBroadcastTransportStatus(null);
    renderSyncAudit(null);
    renderExplorerOverview(null, latestSettingsPayload?.effective?.explorer);
  }
}

elements.refreshButton.addEventListener('click', () => {
  void withAction(elements.refreshButton, '刷新中...', handleRefresh);
});

elements.syncAuditList?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-sync-audit-action]');
  if (!button) return;
  handleSyncAuditAction(
    button.dataset.syncAuditAction,
    button.dataset.syncAuditKind,
  );
});

elements.memoryThreadDetail?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-thread-action]');
  if (!button) return;
  handleSyncAuditAction(button.dataset.threadAction, button.dataset.threadKind);
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

elements.openSpeechRecognitionButton?.addEventListener('click', () => {
  void appShell.openSpeechRecognitionSettings();
});

elements.refreshShortcutButton?.addEventListener('click', () => {
  void withAction(elements.refreshShortcutButton, '检查中...', async () => {
    const payload = await appShell.refreshShortcutHelper();
    renderShortcutStatus(payload?.shortcutStatus);
  });
});

elements.uiLanguage?.addEventListener('change', () => {
  const select = elements.uiLanguage;
  const uiLanguage = normalizeUiLanguage(select.value);
  setDesktopLanguage(uiLanguage);
  select.value = uiLanguage;
  select.disabled = true;
  void bridgeApi
    .updateSettings({ uiLanguage })
    .then((payload) => {
      latestSettingsPayload = payload;
      const savedLanguage = setDesktopLanguage(payload?.effective?.uiLanguage);
      select.value = savedLanguage;
      setMessage(
        elements.metaShortcut,
        t('desktop.language.updated'),
        'success',
      );
    })
    .catch((error) => {
      setMessage(
        elements.metaShortcut,
        error instanceof Error ? error.message : '更新界面语言失败',
        'error',
      );
    })
    .finally(() => {
      select.disabled = false;
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
  elements.reminderDailyEnabled,
  elements.reminderDailyTime,
  elements.reminderDedupSameDay,
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
    syncWebpageMcpGuide(
      elements.chatgptUseDailyBrowser,
      elements.chatgptMcpGuide,
    );
    markExplorerSourceDirty('chatgpt');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
}

if (elements.doubaoSourceUseDailyBrowser) {
  elements.doubaoSourceUseDailyBrowser.addEventListener('change', () => {
    syncWebpageMcpGuide(
      elements.doubaoSourceUseDailyBrowser,
      elements.doubaoSourceMcpGuide,
    );
    markExplorerSourceDirty('doubao');
    applyButtonAvailability(latestStatus, latestExplorerStatus);
  });
}

if (elements.broadcastUseDailyBrowser) {
  elements.broadcastUseDailyBrowser.addEventListener('change', () => {
    syncWebpageMcpGuide(
      elements.broadcastUseDailyBrowser,
      elements.broadcastMcpGuide,
    );
    syncBroadcastTransportDirtyFromControl();
    syncBroadcastTransportPresentation();
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

if (elements.broadcastTransportSaveButton) {
  elements.broadcastTransportSaveButton.addEventListener('click', () => {
    void withAction(
      elements.broadcastTransportSaveButton,
      '保存中...',
      async () => {
        try {
          await saveBroadcastTransportSettings();
        } catch (error) {
          setMessage(
            elements.broadcastTransportMessage,
            error instanceof Error ? error.message : '保存广播方式失败',
            'error',
          );
        }
      },
    );
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
      await savePendingBroadcastTransport();
      const result = await bridgeApi.openLogin();
      setMessage(
        elements.loginMessage,
        formatLoginOpenedMessage(result),
        loginOpenedTone(result),
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
      await savePendingBroadcastTransport();
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
      await savePendingBroadcastTransport();
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
      await savePendingBroadcastTransport();
      const result = await bridgeApi.runNow('stable_memory');
      setManualRunResultMessage(elements.memoryThreadMessage, result, {
        succeeded: '已手动推送一次 persona 到长期记忆线程。',
        skipped:
          '本次没有可推送的长期记忆；Memory Service 当前未渲染出稳定画像更新。',
      });
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.memoryThreadMessage,
        error instanceof Error
          ? formatBridgeIssueMessage(error.message)
          : '手动推送失败',
        'error',
      );
      await refreshStatus().catch(() => undefined);
    }
  });
});

elements.runBriefingButton.addEventListener('click', () => {
  void withAction(elements.runBriefingButton, '推送中...', async () => {
    try {
      await savePendingBroadcastTransport();
      const result = await bridgeApi.runNow('mobile_briefing');
      setManualRunResultMessage(elements.mobileThreadMessage, result, {
        succeeded: '已手动推送一次近期记忆重点到手机对话。',
        skipped:
          '本次没有可推送的近期记忆重点；没有真实高信号内容时不会向豆包发送占位文本。',
      });
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.mobileThreadMessage,
        error instanceof Error
          ? formatBridgeIssueMessage(error.message)
          : '手动推送失败',
        'error',
      );
      await refreshStatus().catch(() => undefined);
    }
  });
});

elements.runReminderButton.addEventListener('click', () => {
  void withAction(elements.runReminderButton, '推送中...', async () => {
    try {
      await savePendingBroadcastTransport();
      const result = await bridgeApi.runNow('reminder_sync');
      setManualRunResultMessage(elements.mobileThreadMessage, result, {
        succeeded: '已手动推送一次待办 / 通知到手机对话。',
        skipped: '本次没有可推送的待办或通知。',
      });
      await refreshStatus();
    } catch (error) {
      setMessage(
        elements.mobileThreadMessage,
        error instanceof Error
          ? formatBridgeIssueMessage(error.message)
          : '手动推送失败',
        'error',
      );
      await refreshStatus().catch(() => undefined);
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
      await savePendingExplorerSourceSettings('doubao');
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
      await savePendingExplorerSourceSettings('chatgpt');
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
      await savePendingExplorerSourceSettings('doubao');
      const result = await explorerApi.runNow('doubao');
      setMessage(
        elements.doubaoSourceMessage,
        formatExplorerRunCompletionMessage('doubao', result),
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
      await savePendingExplorerSourceSettings('chatgpt');
      const result = await explorerApi.runNow('chatgpt');
      if (!result.implemented) {
        throw new Error('ChatGPT explorer 抓取流程暂未实现。');
      }
      setMessage(
        elements.chatgptSourceMessage,
        formatExplorerRunCompletionMessage('chatgpt', result),
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

elements.doubaoSourcePreviewButton?.addEventListener('click', () => {
  void previewExplorerCacheForSource('doubao');
});

elements.chatgptSourcePreviewButton?.addEventListener('click', () => {
  void previewExplorerCacheForSource('chatgpt');
});

elements.doubaoSourceResetButton?.addEventListener('click', () => {
  void resetExplorerCacheForSource('doubao');
});

elements.chatgptSourceResetButton?.addEventListener('click', () => {
  void resetExplorerCacheForSource('chatgpt');
});

elements.doubaoSourceRevokeButton?.addEventListener('click', () => {
  void revokeIngestedMemoryForSource('doubao');
});

elements.chatgptSourceRevokeButton?.addEventListener('click', () => {
  void revokeIngestedMemoryForSource('chatgpt');
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
