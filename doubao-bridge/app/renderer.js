const bridgeApi = window.bridgeApi;
const appShell = window.appShell;

const elements = {
  refreshButton: document.getElementById('refresh-button'),
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
  openInputMonitoringButton: document.getElementById('open-input-monitoring-button'),
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
  stepMemoryStatus: document.getElementById('step-memory-status'),
  stepLoginStatus: document.getElementById('step-login-status'),
  stepMemoryThreadStatus: document.getElementById('step-memory-thread-status'),
  stepMobileThreadStatus: document.getElementById('step-mobile-thread-status'),
  stepBackgroundStatus: document.getElementById('step-background-status'),
};

let refreshTimer;
let settingsDirty = false;

function formatTime(value) {
  if (!value) return '未发生';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
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

function collectRuntimeSettings() {
  return {
    memoryServiceBaseUrl: elements.memoryBaseUrl.value.trim() || undefined,
    memoryServiceApiKey: elements.memoryApiKey.value.trim() || undefined,
    memoryServiceUserId: elements.memoryUserId.value.trim() || undefined,
    autoSync: true,
    pollIntervalMs: Number(elements.pollMinutes.value || 5) * 60_000,
    stableMemoryIntervalMs: Number(elements.stableHours.value || 12) * 3_600_000,
    mobileBriefingIntervalMs: Number(elements.briefingHours.value || 4) * 3_600_000,
    reminderSyncIntervalMs: Number(elements.reminderMinutes.value || 15) * 60_000,
  };
}

function validateRuntimeSettings(settings) {
  if (settings.memoryServiceBaseUrl && !settings.memoryServiceUserId) {
    throw new Error('配置 Memory Service 后，Memory Service User ID 也必须填写。');
  }
}

function markSettingsDirty() {
  settingsDirty = true;
}

function clearSettingsDirty() {
  settingsDirty = false;
}

function applyRuntimeSettings(settings, { force = false } = {}) {
  if (!settings) return;
  if (settingsDirty && !force) return;
  elements.memoryBaseUrl.value = settings.memoryServiceBaseUrl || '';
  elements.memoryApiKey.value = settings.memoryServiceApiKey || '';
  elements.memoryUserId.value = settings.memoryServiceUserId || '';
  elements.pollMinutes.value = String(minutesFromMs(settings.pollIntervalMs || 300_000));
  elements.stableHours.value = String(hoursFromMs(settings.stableMemoryIntervalMs || 43_200_000));
  elements.briefingHours.value = String(hoursFromMs(settings.mobileBriefingIntervalMs || 14_400_000));
  elements.reminderMinutes.value = String(minutesFromMs(settings.reminderSyncIntervalMs || 900_000));
  clearSettingsDirty();
}

function renderSummary(status) {
  const summaryItems = [
    ['后台服务', status?.syncState?.timerActive ? '运行中' : '未启动'],
    ['Memory Service', formatBool(status?.setupChecklist?.memoryServiceConfigured)],
    ['豆包登录', status?.authStatus === 'connected' ? '已登录' : '未登录'],
    ['长期记忆线程', formatBool(status?.setupChecklist?.memorySyncBound)],
    ['手机对话', formatBool(status?.setupChecklist?.mobileContextBound)],
    ['最近同步', formatTime(status?.lastSyncAt)],
  ];

  elements.summaryGrid.innerHTML = summaryItems
    .map(
      ([label, value]) => `
        <div class="summary-item">
          <label>${label}</label>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join('');
}

function renderBlockingReasons(status) {
  const reasons = status?.blockingReasons || [];
  if (reasons.length === 0) {
    elements.blockingReasons.innerHTML = '<div class="reason-pill status-ready">所有前置条件已满足，自动同步可以正常运行。</div>';
    return;
  }

  elements.blockingReasons.innerHTML = reasons
    .map((reason) => `<div class="reason-pill status-blocked">${reason.message}</div>`)
    .join('');
}

function renderNextStep(status) {
  const checklist = status?.setupChecklist || {};
  const steps = [
    [
      !checklist.memoryServiceConfigured,
      '先连接 Memory Service',
      '填写 Memory Service Base URL 和 User ID，保存后先点一次“测试连接”，确认自动拉取 persona、近期重点和提醒的来源可用。',
    ],
    [
      !checklist.doubaoConnected,
      '先完成豆包登录',
      '点击“打开登录窗口”，在桥接器自己的浏览器里手动登录一次豆包。登录态会保存在桥接器 profile 中。',
    ],
    [
      !checklist.memorySyncBound,
      '创建长期记忆线程',
      '点击“创建/修复长期记忆线程”，后续 persona_core 和 voice_mode 会沉淀到这条专用线程，不会污染真实聊天。',
    ],
    [
      !checklist.mobileContextBound,
      '绑定手机版对话',
      '点击“自动绑定手机对话”，让近期重点和提醒注入到你实际会在手机和耳机里继续使用的那条线程。',
    ],
  ];

  const nextStep = steps.find(([pending]) => pending);
  if (!nextStep) {
    elements.nextStepCard?.classList.add('next-step-card-ready');
    if (elements.nextStepTitle) {
      elements.nextStepTitle.textContent = '现在已经可以自动推送记忆';
    }
    if (elements.nextStepCopy) {
      elements.nextStepCopy.textContent =
        '如果想先验证链路，可以点“现在推一次 persona / 近期重点 / 提醒”。平时关闭窗口即可，后台会继续运行。';
    }
    return;
  }

  elements.nextStepCard?.classList.remove('next-step-card-ready');
  if (elements.nextStepTitle) {
    elements.nextStepTitle.textContent = nextStep[1];
  }
  if (elements.nextStepCopy) {
    elements.nextStepCopy.textContent = nextStep[2];
  }
}

function renderStepStatuses(status) {
  const checklist = status?.setupChecklist || {};
  const stepStates = [
    [elements.stepMemoryStatus, Boolean(checklist.memoryServiceConfigured), '已连接', '待配置'],
    [elements.stepLoginStatus, Boolean(checklist.doubaoConnected), '已登录', '待登录'],
    [elements.stepMemoryThreadStatus, Boolean(checklist.memorySyncBound), '已绑定', '待绑定'],
    [elements.stepMobileThreadStatus, Boolean(checklist.mobileContextBound), '已绑定', '待绑定'],
    [elements.stepBackgroundStatus, Boolean(status?.syncState?.timerActive), '运行中', '待就绪'],
  ];

  for (const [element, ok, readyText, pendingText] of stepStates) {
    if (!element) continue;
    element.textContent = ok ? readyText : pendingText;
    element.className = `step-status ${ok ? 'step-status-ready' : 'step-status-pending'}`;
  }
}

function renderShortcutStatus(shortcutStatus) {
  if (!elements.metaShortcut) return;
  if (!shortcutStatus?.message) {
    setMessage(elements.metaShortcut, '');
    return;
  }

  const tone =
    shortcutStatus.usingNativeHelper
      ? 'success'
      : shortcutStatus.fallbackEnabled
        ? 'warn'
        : 'muted';
  setMessage(elements.metaShortcut, shortcutStatus.message, tone);
}

function applyButtonAvailability(status) {
  const checklist = status?.setupChecklist || {};
  const memoryConnected = Boolean(checklist.memoryServiceConfigured);
  const loggedIn = Boolean(checklist.doubaoConnected);
  const memoryBound = Boolean(checklist.memorySyncBound);
  const mobileBound = Boolean(checklist.mobileContextBound);

  elements.loginButton.disabled = false;
  elements.memoryThreadButton.disabled = !loggedIn;
  elements.mobileThreadButton.disabled = !loggedIn;
  elements.runStableButton.disabled = !(memoryConnected && loggedIn && memoryBound);
  elements.runBriefingButton.disabled = !(memoryConnected && loggedIn && mobileBound);
  elements.runReminderButton.disabled = !(memoryConnected && loggedIn && mobileBound);
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
    typeof preferences?.voiceLocale === 'string' && preferences.voiceLocale.trim()
      ? preferences.voiceLocale.trim()
      : 'zh-CN';
}

async function refreshStatus() {
  const [status, settings] = await Promise.all([
    bridgeApi.getStatus(),
    bridgeApi.getSettings(),
  ]);

  renderSummary(status);
  renderNextStep(status);
  renderBlockingReasons(status);
  renderStepStatuses(status);
  applyRuntimeSettings(settings.effective);
  applyButtonAvailability(status);
  return { status, settings };
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
  applyRuntimeSettings(saved.effective, { force: true });
  if (!silent) {
    setMessage(elements.settingsMessage, '配置已保存，后台轮询会立即按新节奏生效。', 'success');
  }
  return saved;
}

async function handleRefresh() {
  try {
    await Promise.all([loadMeta(), refreshStatus()]);
  } catch (error) {
    renderSummary(null);
    renderNextStep(null);
    renderBlockingReasons({ blockingReasons: [{ message: error instanceof Error ? error.message : '无法连接 Personal AI', code: 'auth_required' }] });
    renderStepStatuses(null);
  }
}

elements.refreshButton.addEventListener('click', () => {
  void withAction(elements.refreshButton, '刷新中...', handleRefresh);
});

elements.openLogButton.addEventListener('click', () => {
  void appShell.openLogFile();
});

elements.openSupportButton.addEventListener('click', () => {
  void appShell.openSupportDir();
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
      setMessage(elements.metaShortcut, error instanceof Error ? error.message : '更新语音识别语言失败', 'error');
    })
    .finally(() => {
      select.disabled = false;
    });
});

elements.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void withAction(elements.settingsForm.querySelector('button[type="submit"]'), '保存中...', async () => {
    try {
      await saveRuntimeSettings();
      await refreshStatus();
    } catch (error) {
      setMessage(elements.settingsMessage, error instanceof Error ? error.message : '保存失败', 'error');
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
      setMessage(elements.settingsMessage, error instanceof Error ? error.message : '连接测试失败', 'error');
    }
  });
});

elements.loginButton.addEventListener('click', () => {
  void withAction(elements.loginButton, '打开中...', async () => {
    try {
      const result = await bridgeApi.openLogin();
      setMessage(elements.loginMessage, `已打开登录窗口：${result.url}`, 'success');
      await refreshStatus();
    } catch (error) {
      setMessage(elements.loginMessage, error instanceof Error ? error.message : '打开登录窗口失败', 'error');
    }
  });
});

elements.memoryThreadButton.addEventListener('click', () => {
  void withAction(elements.memoryThreadButton, '创建中...', async () => {
    try {
      const thread = await bridgeApi.createMemorySyncThread();
      setMessage(elements.memoryThreadMessage, `已绑定：${thread.title || thread.id}`, 'success');
      await refreshStatus();
    } catch (error) {
      setMessage(elements.memoryThreadMessage, error instanceof Error ? error.message : '创建长期记忆线程失败', 'error');
    }
  });
});

elements.mobileThreadButton.addEventListener('click', () => {
  void withAction(elements.mobileThreadButton, '绑定中...', async () => {
    try {
      const binding = await bridgeApi.autoBindMobileThread();
      setMessage(elements.mobileThreadMessage, `已绑定：${binding.title || binding.threadId || '手机版对话'}`, 'success');
      await refreshStatus();
    } catch (error) {
      setMessage(elements.mobileThreadMessage, error instanceof Error ? error.message : '自动绑定手机对话失败', 'error');
    }
  });
});

elements.runStableButton.addEventListener('click', () => {
  void withAction(elements.runStableButton, '推送中...', async () => {
    try {
      await bridgeApi.runNow('stable_memory');
      setMessage(elements.memoryThreadMessage, '已手动推送一次 persona 到长期记忆线程。', 'success');
      await refreshStatus();
    } catch (error) {
      setMessage(elements.memoryThreadMessage, error instanceof Error ? error.message : '手动推送失败', 'error');
    }
  });
});

elements.runBriefingButton.addEventListener('click', () => {
  void withAction(elements.runBriefingButton, '推送中...', async () => {
    try {
      await bridgeApi.runNow('mobile_briefing');
      setMessage(elements.mobileThreadMessage, '已手动推送一次近期重点到手机对话。', 'success');
      await refreshStatus();
    } catch (error) {
      setMessage(elements.mobileThreadMessage, error instanceof Error ? error.message : '手动推送失败', 'error');
    }
  });
});

elements.runReminderButton.addEventListener('click', () => {
  void withAction(elements.runReminderButton, '推送中...', async () => {
    try {
      await bridgeApi.runNow('reminder_sync');
      setMessage(elements.mobileThreadMessage, '已手动推送一次提醒到手机对话。', 'success');
      await refreshStatus();
    } catch (error) {
      setMessage(elements.mobileThreadMessage, error instanceof Error ? error.message : '手动推送失败', 'error');
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
