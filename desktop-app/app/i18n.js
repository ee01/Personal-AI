const DEFAULT_UI_LANGUAGE = 'zh-CN';

const MESSAGES = {
  'zh-CN': {
    'language.zhCN': '中文',
    'language.enUS': 'English',
    'common.refresh': '刷新',
    'common.work': '工作',
    'common.personal': '个人',
    'common.both': '两者',
    'common.all': '全部',
    'desktop.language.label': '界面语言',
    'desktop.language.updated': '界面语言已更新。',
    'desktop.hero.title': '让 AI 记住你',
    'desktop.hero.copy':
      '左侧是「记忆广播」——把记忆系统里的长期记忆、近期记忆重点和待办，自动推到豆包等外部入口；右侧是「记忆探索」——从豆包、ChatGPT 等日常对话里，把值得沉淀的事实和偏好自动写回记忆。',
    'desktop.actions.refresh': '刷新状态',
    'desktop.actions.openLog': '查看日志',
    'desktop.actions.openDataDir': '打开数据目录',
    'desktop.status.title': '当前状态',
    'desktop.nextStep.label': '下一步建议',
    'desktop.nextStep.loading': '正在检查当前配置...',
    'desktop.nextStep.copy':
      'Personal AI 会根据当前缺失的前置条件，提示最值得先完成的动作。',
    'desktop.meta.title': '版本与路径',
    'desktop.meta.version': '版本',
    'desktop.meta.log': '日志',
    'desktop.meta.support': '数据目录',
    'desktop.voice.locale': '语音识别语言',
    'desktop.system.inputMonitoring': '打开输入监控设置',
    'desktop.system.accessibility': '打开辅助功能设置',
    'desktop.system.microphone': '打开麦克风设置',
    'desktop.system.speechRecognition': '打开语音识别设置',
    'desktop.system.shortcut': '重新检查快捷键权限',
    'desktop.quickAsk.placeholder': '问我任何你此刻需要的事...',
    'desktop.quickAsk.pending': '正在整理答案...',
    'desktop.quickAsk.scope': '范围',
    'desktop.quickAsk.scopeAria': '选择记忆范围',
    'desktop.quickAsk.toolbarAria': 'Quick Ask 范围选择',
    'desktop.quickAsk.voicePrompt': '按住 Option+A 或点击麦克风开始说话',
    'desktop.quickAsk.cancelVoice': '返回文本输入',
    'desktop.quickAsk.toggleVoice': '开始或停止语音输入',
    'desktop.quickAsk.sendVoice': '发送语音内容',
    'desktop.quickAsk.openSettings': '打开设置',
    'desktop.quickAsk.voiceInput': '语音输入',
    'desktop.quickAsk.voiceError.microphoneDenied':
      '请先在系统设置中允许麦克风权限。',
    'desktop.quickAsk.voiceError.speechDenied':
      '请先在系统设置中允许语音识别权限。',
    'desktop.quickAsk.voiceError.audioCapture': '当前无法访问麦克风。',
    'desktop.quickAsk.voiceError.startFailed': '当前无法启动系统语音识别。',
    'desktop.quickAsk.voiceError.unavailable': '语音输入暂时不可用。',
    'desktop.quickAsk.voiceError.unavailableWithCode':
      '语音输入暂时不可用：{code}',
    'desktop.quickAsk.voiceRecovery.microphone': '打开麦克风设置',
    'desktop.quickAsk.voiceRecovery.speech': '打开语音识别设置',
    'desktop.quickAsk.voiceRecovery.settings': '打开设置',
    'desktop.memoryList.titleTag': '记忆列表 · Personal AI',
    'desktop.memoryList.eyebrow': '记忆探索 · 已入库',
    'desktop.memoryList.title': '记忆列表',
    'desktop.memoryList.subtitle':
      '这里是 Personal AI 从豆包、ChatGPT 等来源探索后，已经存入记忆服务的事实、偏好、事件和计划。这是只读视图：抓错了不用一条条清理，调整开关或来源后重抓即可让旧条目随时间自然弱化。',
    'desktop.memoryList.refresh': '刷新',
    'desktop.memoryList.filterAria': '按来源过滤',
    'desktop.memoryList.all': '全部',
    'desktop.memoryList.searchPlaceholder': '搜索记忆内容或原句...',
    'desktop.memoryList.loading': '正在加载...',
    'desktop.memoryList.emptyTitle': '暂时没有可显示的记忆',
    'desktop.memoryList.emptyCopy':
      '打开主控制台，登录豆包或 ChatGPT 后点击「立即抓取一次」，几分钟后再回来看看。',
    'desktop.memoryList.loadMore': '加载更多',
    'desktop.memoryList.sourceAll': '全部来源',
    'desktop.memoryList.summary': '共 {total} 条 · 来源：{source}',
    'desktop.memoryList.summaryWithQuery':
      '共 {total} 条 · 来源：{source} · 关键字：“{query}”',
    'desktop.memoryList.noFiltered': '当前过滤条件下没有匹配的记忆。',
    'desktop.memoryList.noMemories': '暂时没有探索得到的记忆。',
    'desktop.memoryList.apiUnavailable':
      'explorerApi 不可用，请确认桌面端版本是否更新到 4.0 以上。',
    'desktop.memoryList.fetchFailed': '拉取失败：{message}',
    'desktop.memoryList.unknownError': '未知错误，请稍后再试',
    'desktop.memoryList.emptyText': '(空内容)',
    'desktop.memoryList.conversationRef': '会话引用：{ref}',
    'desktop.memoryList.ingestSource': '入库 source：{source}',
    'desktop.memoryList.kind.fact': '事实',
    'desktop.memoryList.kind.preference': '偏好',
    'desktop.memoryList.kind.event': '事件',
    'desktop.memoryList.kind.plan': '计划',
  },
  'en-US': {
    'language.zhCN': 'Chinese',
    'language.enUS': 'English',
    'common.refresh': 'Refresh',
    'common.work': 'Work',
    'common.personal': 'Personal',
    'common.both': 'Both',
    'common.all': 'All',
    'desktop.language.label': 'UI Language',
    'desktop.language.updated': 'UI language updated.',
    'desktop.hero.title': 'Make AI remember you',
    'desktop.hero.copy':
      'The left side broadcasts long-term memories, recent highlights, and to-dos into external surfaces such as Doubao. The right side explores daily conversations from Doubao, ChatGPT, and similar sources, then writes useful facts and preferences back to memory.',
    'desktop.actions.refresh': 'Refresh Status',
    'desktop.actions.openLog': 'View Logs',
    'desktop.actions.openDataDir': 'Open Data Folder',
    'desktop.status.title': 'Current Status',
    'desktop.nextStep.label': 'Next Step',
    'desktop.nextStep.loading': 'Checking current configuration...',
    'desktop.nextStep.copy':
      'Personal AI suggests the most useful next action based on missing prerequisites.',
    'desktop.meta.title': 'Version and Paths',
    'desktop.meta.version': 'Version',
    'desktop.meta.log': 'Logs',
    'desktop.meta.support': 'Data Folder',
    'desktop.voice.locale': 'Speech Recognition Language',
    'desktop.system.inputMonitoring': 'Open Input Monitoring Settings',
    'desktop.system.accessibility': 'Open Accessibility Settings',
    'desktop.system.microphone': 'Open Microphone Settings',
    'desktop.system.speechRecognition': 'Open Speech Recognition Settings',
    'desktop.system.shortcut': 'Recheck Shortcut Permission',
    'desktop.quickAsk.placeholder': 'Ask anything you need right now...',
    'desktop.quickAsk.pending': 'Composing answer...',
    'desktop.quickAsk.scope': 'Scope',
    'desktop.quickAsk.scopeAria': 'Select memory scope',
    'desktop.quickAsk.toolbarAria': 'Quick Ask scope selector',
    'desktop.quickAsk.voicePrompt':
      'Hold Option+A or click the microphone to speak',
    'desktop.quickAsk.cancelVoice': 'Return to text input',
    'desktop.quickAsk.toggleVoice': 'Start or stop voice input',
    'desktop.quickAsk.sendVoice': 'Send voice content',
    'desktop.quickAsk.openSettings': 'Open settings',
    'desktop.quickAsk.voiceInput': 'Voice input',
    'desktop.quickAsk.voiceError.microphoneDenied':
      'Allow microphone access in System Settings first.',
    'desktop.quickAsk.voiceError.speechDenied':
      'Allow Speech Recognition in System Settings first.',
    'desktop.quickAsk.voiceError.audioCapture':
      'The microphone is unavailable right now.',
    'desktop.quickAsk.voiceError.startFailed':
      'System speech recognition could not start.',
    'desktop.quickAsk.voiceError.unavailable':
      'Voice input is temporarily unavailable.',
    'desktop.quickAsk.voiceError.unavailableWithCode':
      'Voice input is temporarily unavailable: {code}',
    'desktop.quickAsk.voiceRecovery.microphone': 'Open Microphone Settings',
    'desktop.quickAsk.voiceRecovery.speech':
      'Open Speech Recognition Settings',
    'desktop.quickAsk.voiceRecovery.settings': 'Open settings',
    'desktop.memoryList.titleTag': 'Memory List · Personal AI',
    'desktop.memoryList.eyebrow': 'Memory Explore · Stored',
    'desktop.memoryList.title': 'Memory List',
    'desktop.memoryList.subtitle':
      'This read-only view shows facts, preferences, events, and plans Personal AI stored after exploring sources such as Doubao and ChatGPT. If something was captured incorrectly, adjust the source switches or recrawl; older entries will naturally fade over time.',
    'desktop.memoryList.refresh': 'Refresh',
    'desktop.memoryList.filterAria': 'Filter by source',
    'desktop.memoryList.all': 'All',
    'desktop.memoryList.searchPlaceholder':
      'Search memory text or source quote...',
    'desktop.memoryList.loading': 'Loading...',
    'desktop.memoryList.emptyTitle': 'No memories to display yet',
    'desktop.memoryList.emptyCopy':
      'Open the main console, sign in to Doubao or ChatGPT, then run a capture. Check back a few minutes later.',
    'desktop.memoryList.loadMore': 'Load More',
    'desktop.memoryList.sourceAll': 'All Sources',
    'desktop.memoryList.summary': '{total} total · Source: {source}',
    'desktop.memoryList.summaryWithQuery':
      '{total} total · Source: {source} · Keyword: "{query}"',
    'desktop.memoryList.noFiltered':
      'No memories match the current filters.',
    'desktop.memoryList.noMemories': 'No explored memories yet.',
    'desktop.memoryList.apiUnavailable':
      'explorerApi is unavailable. Check that the desktop app is updated to 4.0 or later.',
    'desktop.memoryList.fetchFailed': 'Fetch failed: {message}',
    'desktop.memoryList.unknownError': 'Unknown error. Try again later.',
    'desktop.memoryList.emptyText': '(empty)',
    'desktop.memoryList.conversationRef': 'Conversation ref: {ref}',
    'desktop.memoryList.ingestSource': 'Ingest source: {source}',
    'desktop.memoryList.kind.fact': 'Fact',
    'desktop.memoryList.kind.preference': 'Preference',
    'desktop.memoryList.kind.event': 'Event',
    'desktop.memoryList.kind.plan': 'Plan',
  },
};

let currentLanguage = DEFAULT_UI_LANGUAGE;

export function normalizeUiLanguage(value) {
  if (value === 'en-US' || value === 'en') return 'en-US';
  if (value === 'zh-CN' || value === 'zh_CN' || value === 'zh') {
    return 'zh-CN';
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.startsWith('en')) return 'en-US';
    if (normalized.startsWith('zh')) return 'zh-CN';
  }
  return DEFAULT_UI_LANGUAGE;
}

export function t(key, params, language = currentLanguage) {
  const normalized = normalizeUiLanguage(language);
  const template =
    MESSAGES[normalized]?.[key] || MESSAGES[DEFAULT_UI_LANGUAGE][key] || key;
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function getDesktopLanguage() {
  return currentLanguage;
}

export function setDesktopLanguage(language) {
  currentLanguage = normalizeUiLanguage(language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage;
  }
  applyStaticI18n();
  return currentLanguage;
}

export function applyStaticI18n(root = document) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((node) => {
    node.setAttribute('title', t(node.dataset.i18nTitle));
  });
}

export async function loadDesktopLanguage(bridgeApi) {
  try {
    const settings = await bridgeApi?.getSettings?.();
    return setDesktopLanguage(settings?.effective?.uiLanguage);
  } catch {
    return setDesktopLanguage(DEFAULT_UI_LANGUAGE);
  }
}

export function formatDateTime(value, language = currentLanguage) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(normalizeUiLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
