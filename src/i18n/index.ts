export type UiLanguage = 'zh-CN' | 'en-US';

export interface UiPreferences {
  language: UiLanguage;
  updatedAt: number;
}

export type UiMessageParams = Record<string, string | number | boolean | null>;

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'zh-CN';
export const EXTENSION_UI_PREFERENCES_STORAGE_KEY = 'personalAiUiPreferences';

export const UI_LANGUAGES: UiLanguage[] = ['zh-CN', 'en-US'];

export const UI_MESSAGES: Record<UiLanguage, Record<string, string>> = {
  'zh-CN': {
    'language.label': '语言 / Language',
    'language.zhCN': '中文',
    'language.enUS': 'English',

    'terms.todayPilot': '今天',
    'terms.composeAssist': '回复助手',
    'terms.nativeJoin': 'NC 加会',
    'terms.projectDashboard': '项目面板',
    'terms.memoryLens': '记忆提示',
    'terms.relationshipRadar': '人脉关系',
    'terms.jiraDesignLinks': 'JIRA 设计稿',
    'terms.doubaoBridge': '豆包互联',
    'terms.skillFoundry': '技能库',

    'common.search': '搜索',
    'common.reset': '重置',
    'common.refresh': '刷新',
    'common.loading': '正在加载...',
    'common.work': '工作',
    'common.personal': '个人',
    'common.all': '全部',
    'common.both': '两者',
    'common.save': '保存',

    'options.sections.language': '语言 / Language',
    'options.sections.promptConfig': '自定义提示词与上下文',
    'options.sections.demo': '功能 Demo',
    'options.sections.messageAnalysis': '消息分析推送',
    'options.sections.messageInteraction': '消息交互功能',
    'options.sections.memoryService': '记忆系统 (Memory Service)',
    'options.sections.meetingPilot': '会议全貌',
    'options.sections.contextAssist': 'Context Assist / 会前准备',
    'options.sections.memoryLens': '记忆提示控制',
    'options.sections.openClaw': 'OpenClaw 对接',
    'options.sections.outreach': '主动询问',
    'options.sections.weeklyReport': '自动周报 (Weekly Report)',
    'options.sections.llm': 'LLM 设置',
    'options.sections.ollama': 'Ollama 设置',
    'options.sections.dify': 'Dify 设置',
    'options.sections.openai': 'OpenAI 设置',
    'options.sections.groq': 'Groq 设置',
    'options.sections.jira': 'Jira 设置',
    'options.sections.intelligentAgent': '智能Agent系统设置',
    'options.sections.standardAgent': '标准Agent系统设置',
    'options.sections.importExport': '配置导入/导出',
    'options.language.description':
      '界面语言会立即保存到 Chrome 本地存储，不依赖下方保存配置按钮。',
    'options.promptConfig.description':
      '集中管理会进入消息分析、项目分析和会前上下文的长期偏好，并查看本轮实际注入回执。',
    'options.promptConfig.open': '打开自定义提示词',
    'options.promptConfig.receipt': '保存后会按开关、作用域和安全提示进入分析注入。',

    'popup.memoryExplorer': '实体记忆查询',
    'popup.scheduledMessages': '定时消息管理',
    'popup.manageMemoryEntries': '管理记忆入口',
    'popup.meetingPilot.open': '打开会议全貌',
    'popup.meetingPilot.enableVision': '启用画面理解与纪要',
    'popup.meetingPilot.start': '开启会议全貌',
    'popup.meetingPilot.processing': '处理中...',
    'popup.meetingPilot.openOptions': '打开配置',
    'popup.today.openTitle': '打开今天首页',
    'popup.today.refreshTitle': '刷新今天',
    'popup.today.loading': '正在读取今日 mission',
    'popup.today.unavailable': '今天暂不可用',
    'popup.today.empty': '暂时没有需要处理的事项',
    'popup.today.action': '做',
    'popup.today.reason': '因',
    'popup.today.done': '完成',
    'popup.today.later': '稍后',
    'popup.today.copy': '复制',
    'popup.today.copying': '复制中',
    'popup.today.reviewExternal': '去处理',
    'popup.today.handling': '处理中',
    'popup.today.doneTitle': '今天不再显示这张 mission',
    'popup.today.laterTitle': '6 小时内不再显示',
    'popup.today.externalExecutionTitle':
      'OpenClaw 外部执行需要在处理页确认',

    'memoryExplorer.title': '记忆查询系统',
    'memoryExplorer.sidebarNote':
      '记忆入口规则只展示你手动创建的规则；帮我问 / 自我反思等系统内部观察会在主动询问里展示证据，不计入这里的 FollowThreads。',
    'memoryExplorer.currentUser': '当前记忆用户',
    'memoryExplorer.unconfirmed': '未确认',
    'memoryExplorer.defaultSpaceHint':
      '未解析到个人身份，正在使用 default 空间。',
    'memoryExplorer.nav.today': '今天',
    'memoryExplorer.nav.timeline': '时间轴',
    'memoryExplorer.nav.meetings': '会议记录',
    'memoryExplorer.nav.userProfile': '用户画像',
    'memoryExplorer.nav.followThreads': '关注后续',
    'memoryExplorer.nav.followThreadsSubnote': '仅统计手动规则',
    'memoryExplorer.nav.dreams': '梦境重放',
    'memoryExplorer.nav.reports': '周报报告',
    'memoryExplorer.nav.reflection': '自我反思',
    'memoryExplorer.nav.rehearsal': 'Rehearsal',
    'memoryExplorer.nav.rehearsalSubnote': '未来场景预演',
    'memoryExplorer.nav.decisions': '决策中心',
    'memoryExplorer.nav.storylines': '故事线',
    'memoryExplorer.nav.storylinesSubnote': '分享 / 汇报草稿',
    'memoryExplorer.nav.actions': '动作队列',
    'memoryExplorer.nav.outreach': '主动询问',
    'memoryExplorer.nav.outreachSubnote': '系统证据在这里看',
    'memoryExplorer.nav.skills': '技能库',
    'memoryExplorer.nav.skillsSubnote': '在用技能与萃取建议',
    'memoryExplorer.nav.coverage': '记忆覆盖',
    'memoryExplorer.nav.coverageSubnote': '平台覆盖与智能导入',
    'memoryExplorer.search.placeholder':
      '搜索任何内容、实体或关键词（按 Enter 搜索）...',
    'memoryExplorer.search.scopeAria': '记忆范围',
    'memoryExplorer.scope.work.title': '只检索工作记忆',
    'memoryExplorer.scope.personal.title': '只检索个人记忆',
    'memoryExplorer.scope.all.title': '同时检索工作与个人记忆',

    'desktop.language.label': '界面语言',
    'desktop.language.updated': '界面语言已更新。',
    'desktop.hero.title': '让 AI 记住你',
    'desktop.actions.refresh': '刷新状态',
    'desktop.actions.openLog': '查看日志',
    'desktop.actions.openDataDir': '打开数据目录',
    'desktop.meta.title': '版本与路径',
    'desktop.meta.version': '版本',
    'desktop.meta.log': '日志',
    'desktop.meta.support': '数据目录',
    'desktop.voice.locale': '语音识别语言',
    'desktop.quickAsk.placeholder': '问我任何你此刻需要的事...',
    'desktop.quickAsk.pending': '正在整理答案...',
    'desktop.quickAsk.scope': '范围',
    'desktop.quickAsk.voicePrompt': '按住 Option+A 或点击麦克风开始说话',
    'desktop.memoryList.eyebrow': '记忆探索 · 已入库',
    'desktop.memoryList.title': '记忆列表',
    'desktop.memoryList.subtitle':
      '这里是 Personal AI 从豆包、ChatGPT 等来源探索后，已经存入记忆服务的事实、偏好、事件和计划。这是只读视图：抓错了不用一条条清理，调整开关或来源后重抓即可让旧条目随时间自然弱化。',
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
    'language.label': 'Language',
    'language.zhCN': 'Chinese',
    'language.enUS': 'English',

    'terms.todayPilot': 'Today Pilot',
    'terms.composeAssist': 'Compose Assist',
    'terms.nativeJoin': 'Native Join',
    'terms.projectDashboard': 'Project Dashboard',
    'terms.memoryLens': 'Memory Lens',
    'terms.relationshipRadar': 'Relationship Radar',
    'terms.jiraDesignLinks': 'Jira Design Links',
    'terms.doubaoBridge': 'Doubao Bridge',
    'terms.skillFoundry': 'Skill Foundry',

    'common.search': 'Search',
    'common.reset': 'Reset',
    'common.refresh': 'Refresh',
    'common.loading': 'Loading...',
    'common.work': 'Work',
    'common.personal': 'Personal',
    'common.all': 'All',
    'common.both': 'Both',
    'common.save': 'Save',

    'options.sections.language': 'Language',
    'options.sections.promptConfig': 'Custom Prompts and Context',
    'options.sections.demo': 'Feature Demos',
    'options.sections.messageAnalysis': 'Message Analysis Delivery',
    'options.sections.messageInteraction': 'Message Reaction',
    'options.sections.memoryService': 'Memory Service',
    'options.sections.meetingPilot': 'Meeting Pilot',
    'options.sections.contextAssist': 'Context Assist / Meeting Prep',
    'options.sections.memoryLens': 'Memory Lens',
    'options.sections.openClaw': 'OpenClaw Integration',
    'options.sections.outreach': 'Outreach',
    'options.sections.weeklyReport': 'Weekly Report',
    'options.sections.llm': 'LLM Settings',
    'options.sections.ollama': 'Ollama Settings',
    'options.sections.dify': 'Dify Settings',
    'options.sections.openai': 'OpenAI Settings',
    'options.sections.groq': 'Groq Settings',
    'options.sections.jira': 'Jira Settings',
    'options.sections.intelligentAgent': 'Intelligent Agent Settings',
    'options.sections.standardAgent': 'Standard Agent Settings',
    'options.sections.importExport': 'Import / Export Config',
    'options.language.description':
      'The UI language is saved to Chrome local storage immediately and does not depend on the config save button below.',
    'options.promptConfig.description':
      'Manage long-term preferences used by message analysis, project analysis, and meeting context, with receipts for what is actually injected.',
    'options.promptConfig.open': 'Open Custom Prompts',
    'options.promptConfig.receipt':
      'Saved preferences are injected according to source toggles, scope, and safety hints.',

    'popup.memoryExplorer': 'Memory Explorer',
    'popup.scheduledMessages': 'Scheduled Messages',
    'popup.manageMemoryEntries': 'Manage Memory Entries',
    'popup.meetingPilot.open': 'Open Meeting Pilot',
    'popup.meetingPilot.enableVision': 'Enable Vision and Minutes',
    'popup.meetingPilot.start': 'Start Meeting Pilot',
    'popup.meetingPilot.processing': 'Processing...',
    'popup.meetingPilot.openOptions': 'Open Settings',
    'popup.today.openTitle': 'Open Today Pilot',
    'popup.today.refreshTitle': 'Refresh Today Pilot',
    'popup.today.loading': 'Reading today missions',
    'popup.today.unavailable': 'Today Pilot is unavailable',
    'popup.today.empty': 'Nothing needs attention right now',
    'popup.today.action': 'Do',
    'popup.today.reason': 'Why',
    'popup.today.done': 'Done',
    'popup.today.later': 'Later',
    'popup.today.copy': 'Copy',
    'popup.today.copying': 'Copying',
    'popup.today.reviewExternal': 'Review',
    'popup.today.handling': 'Working',
    'popup.today.doneTitle': 'Hide this mission for today',
    'popup.today.laterTitle': 'Hide for 6 hours',
    'popup.today.externalExecutionTitle':
      'OpenClaw execution needs confirmation in the handling page',

    'memoryExplorer.title': 'Memory Explorer',
    'memoryExplorer.sidebarNote':
      'Memory entry rules only show rules you created manually. Internal observations from Quick Ask and reflection appear with evidence in Outreach and are not counted as FollowThreads here.',
    'memoryExplorer.currentUser': 'Current memory user',
    'memoryExplorer.unconfirmed': 'Unconfirmed',
    'memoryExplorer.defaultSpaceHint':
      'Personal identity was not resolved. Using the default space.',
    'memoryExplorer.nav.today': 'Today Pilot',
    'memoryExplorer.nav.timeline': 'Timeline',
    'memoryExplorer.nav.meetings': 'Meetings',
    'memoryExplorer.nav.userProfile': 'User Profile',
    'memoryExplorer.nav.followThreads': 'Follow Threads',
    'memoryExplorer.nav.followThreadsSubnote': 'Manual rules only',
    'memoryExplorer.nav.dreams': 'Dream Replay',
    'memoryExplorer.nav.reports': 'Reports',
    'memoryExplorer.nav.reflection': 'Self Reflection',
    'memoryExplorer.nav.rehearsal': 'Rehearsal',
    'memoryExplorer.nav.rehearsalSubnote': 'Future scene rehearsal',
    'memoryExplorer.nav.decisions': 'Decision Center',
    'memoryExplorer.nav.storylines': 'Storylines',
    'memoryExplorer.nav.storylinesSubnote': 'Sharing and report drafts',
    'memoryExplorer.nav.actions': 'Action Queue',
    'memoryExplorer.nav.outreach': 'Outreach',
    'memoryExplorer.nav.outreachSubnote': 'System evidence lives here',
    'memoryExplorer.nav.skills': 'Skill Foundry',
    'memoryExplorer.nav.skillsSubnote': 'Active skills and extraction ideas',
    'memoryExplorer.nav.coverage': 'Memory Coverage',
    'memoryExplorer.nav.coverageSubnote': 'Platform coverage and smart import',
    'memoryExplorer.search.placeholder':
      'Search any content, entity, or keyword (press Enter)...',
    'memoryExplorer.search.scopeAria': 'Memory scope',
    'memoryExplorer.scope.work.title': 'Search work memories only',
    'memoryExplorer.scope.personal.title': 'Search personal memories only',
    'memoryExplorer.scope.all.title': 'Search work and personal memories',

    'desktop.language.label': 'UI Language',
    'desktop.language.updated': 'UI language updated.',
    'desktop.hero.title': 'Make AI remember you',
    'desktop.actions.refresh': 'Refresh Status',
    'desktop.actions.openLog': 'View Logs',
    'desktop.actions.openDataDir': 'Open Data Folder',
    'desktop.meta.title': 'Version and Paths',
    'desktop.meta.version': 'Version',
    'desktop.meta.log': 'Logs',
    'desktop.meta.support': 'Data Folder',
    'desktop.voice.locale': 'Speech Recognition Language',
    'desktop.quickAsk.placeholder': 'Ask anything you need right now...',
    'desktop.quickAsk.pending': 'Composing answer...',
    'desktop.quickAsk.scope': 'Scope',
    'desktop.quickAsk.voicePrompt':
      'Hold Option+A or click the microphone to speak',
    'desktop.memoryList.eyebrow': 'Memory Explore · Stored',
    'desktop.memoryList.title': 'Memory List',
    'desktop.memoryList.subtitle':
      'This read-only view shows facts, preferences, events, and plans Personal AI stored after exploring sources such as Doubao and ChatGPT. If something was captured incorrectly, adjust the source switches or recrawl; older entries will naturally fade over time.',
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

export function normalizeUiLanguage(value: unknown): UiLanguage {
  if (value === 'en' || value === 'en-US') return 'en-US';
  if (value === 'zh' || value === 'zh-CN' || value === 'zh_CN') {
    return 'zh-CN';
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.startsWith('en')) return 'en-US';
    if (normalized.startsWith('zh')) return 'zh-CN';
  }
  return DEFAULT_UI_LANGUAGE;
}

export function formatUiMessage(
  template: string,
  params?: UiMessageParams,
): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function t(
  key: string,
  params?: UiMessageParams,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string {
  const normalizedLanguage = normalizeUiLanguage(language);
  const template =
    UI_MESSAGES[normalizedLanguage]?.[key] ||
    UI_MESSAGES[DEFAULT_UI_LANGUAGE][key] ||
    key;
  return formatUiMessage(template, params);
}

export function applyDocumentLanguage(language: UiLanguage): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = normalizeUiLanguage(language);
}

export function formatUiDateTime(
  value: string | number | Date | null | undefined,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(normalizeUiLanguage(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getChromeStorage():
  | {
      local?: {
        get?: (
          keys: string[] | string,
          callback: (result: Record<string, unknown>) => void,
        ) => void;
        set?: (
          items: Record<string, unknown>,
          callback?: () => void,
        ) => void;
      };
      onChanged?: {
        addListener?: (listener: (...args: any[]) => void) => void;
        removeListener?: (listener: (...args: any[]) => void) => void;
      };
    }
  | undefined {
  return (globalThis as any).chrome?.storage;
}

export function normalizeUiPreferences(value: unknown): UiPreferences {
  const maybe = value as Partial<UiPreferences> | null | undefined;
  return {
    language: normalizeUiLanguage(maybe?.language),
    updatedAt:
      typeof maybe?.updatedAt === 'number' && Number.isFinite(maybe.updatedAt)
        ? maybe.updatedAt
        : 0,
  };
}

export async function readExtensionUiPreferences(): Promise<UiPreferences> {
  const storage = getChromeStorage();
  if (!storage?.local?.get) {
    return { language: DEFAULT_UI_LANGUAGE, updatedAt: 0 };
  }
  return new Promise((resolve) => {
    storage.local?.get?.([EXTENSION_UI_PREFERENCES_STORAGE_KEY], (result) => {
      resolve(
        normalizeUiPreferences(result?.[EXTENSION_UI_PREFERENCES_STORAGE_KEY]),
      );
    });
  });
}

export async function writeExtensionUiLanguage(
  language: UiLanguage,
): Promise<UiPreferences> {
  const preferences: UiPreferences = {
    language: normalizeUiLanguage(language),
    updatedAt: Date.now(),
  };
  const storage = getChromeStorage();
  if (!storage?.local?.set) return preferences;
  return new Promise((resolve) => {
    storage.local?.set?.(
      { [EXTENSION_UI_PREFERENCES_STORAGE_KEY]: preferences },
      () => resolve(preferences),
    );
  });
}

export function watchExtensionUiLanguage(
  callback: (preferences: UiPreferences) => void,
): () => void {
  const storage = getChromeStorage();
  if (!storage?.onChanged?.addListener) return () => undefined;
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => {
    if (
      areaName !== 'local' ||
      !changes[EXTENSION_UI_PREFERENCES_STORAGE_KEY]
    ) {
      return;
    }
    callback(
      normalizeUiPreferences(
        changes[EXTENSION_UI_PREFERENCES_STORAGE_KEY]?.newValue,
      ),
    );
  };
  storage.onChanged.addListener(listener);
  return () => storage.onChanged?.removeListener?.(listener);
}
