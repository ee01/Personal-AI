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
    'options.sections.roadmap': '项目 Roadmap',
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
      '界面语言会立即保存到 Chrome 本地存储，并同步为用户画像里的语言偏好，不依赖下方保存配置按钮。',
    'options.promptConfig.description':
      '集中管理会进入消息分析、项目分析和会前上下文的长期偏好，并查看本轮实际注入回执。',
    'options.promptConfig.open': '打开自定义提示词',
    'options.promptConfig.receipt': '保存后会按开关、作用域和安全提示进入分析注入。',

    'popup.memoryExplorer': '实体记忆查询',
    'popup.scheduledMessages': '定时消息管理',
    'popup.manageMemoryEntries': '管理记忆入口',
    'popup.projectRoadmap': '项目 Roadmap',
    'popup.messageAnalysis.background': '静默消息分析',
    'popup.messageAnalysis.every': '每 {interval}',
    'popup.backgroundTasks': '后台任务',
    'popup.helpDocs': '查看帮助文档',
    'popup.shareWithColleagues': '分享给同事',
    'popup.meetingPilot.open': '打开会议全貌',
    'popup.meetingPilot.enableVision': '启用画面理解与纪要',
    'popup.meetingPilot.start': '开启会议全貌',
    'popup.meetingPilot.processing': '处理中...',
    'popup.meetingPilot.openOptions': '打开配置',
    'popup.today.openTitle':
      '打开 Today Pilot 首页查看完整可见 brief；只导航，不会刷新、写反馈、复制上下文、发送消息或执行动作。',
    'popup.today.refreshTitle':
      '刷新 Today Pilot Top 3 快照：只读取或重新生成当前用户今日派生 brief；不会标记消息已读、完成来源任务、写入反馈、发送消息、审批或执行外部动作。',
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
      '未解析到个人身份，正在使用 default 空间；写入会被拦截，直到身份恢复。',
    'memoryExplorer.identitySource.header':
      '身份来源: 已解析并发送 X-User-Id',
    'memoryExplorer.identitySource.defaultFallback':
      '身份来源: 未解析，本次只读请求回退到 default',
    'memoryExplorer.identitySource.localInferred':
      '身份来源: 本机推断，服务端未确认',
    'memoryExplorer.identityBoundary.explicit':
      '读写、备份与恢复只作用于这个 per-user SQLite 空间。',
    'memoryExplorer.identityBoundary.defaultFallback':
      '仅只读兼容回退；写入、导入、恢复会被拦截，直到身份恢复。',
    'memoryExplorer.identityWriteBoundary.explicit':
      '写入边界: 读写、备份与恢复只限 {userId}；不会落到 default 或其他用户空间。',
    'memoryExplorer.identityWriteBoundary.defaultFallback':
      '写入边界: {operations} 已拦截；恢复 userinfo.username 或在设置里配置 userId 后再试。',
    'memoryExplorer.identityBlockedOperation.write': '写入',
    'memoryExplorer.identityBlockedOperation.import': '导入',
    'memoryExplorer.identityBlockedOperation.restore': '恢复',
    'memoryExplorer.identityBlockedOperation.profileUpdate': '画像更新',
    'memoryExplorer.identityBlockedOperation.separator': '、',
    'memoryExplorer.identitySnapshot.pending':
      '身份快照待刷新；不会写入、导入或恢复记忆。',
    'memoryExplorer.identitySnapshot.loading':
      '正在读取只读身份快照...',
    'memoryExplorer.identitySnapshot.checkedAt':
      '身份快照 {time} 来自只读 /stats；刷新只重新检查身份边界。',
    'memoryExplorer.identityAction.refresh': '刷新身份快照',
    'memoryExplorer.identityAction.openSettings': '打开设置',
    'memoryExplorer.identityAction.refreshBoundary.explicit':
      '刷新身份快照：只重新读取 {userId} 的只读 /stats 身份快照；不会写入、导入、恢复、迁移记忆，也不会切换到 default 或其他用户空间。',
    'memoryExplorer.identityAction.refreshBoundary.defaultFallback':
      '刷新身份快照：只重新检查 {userId} 的 default fallback 是否仍被拦截；不会写入、导入、恢复、迁移记忆、确认 default 数据归属或重试失败写入。',
    'memoryExplorer.identityAction.refreshBoundary.localInferred':
      '刷新身份快照：只重新请求 /stats 校验本机推断的 {userId}；不会写入、导入、恢复、迁移记忆或把本机推断当作服务端确认。',
    'memoryExplorer.identityAction.settingsBoundary.explicit':
      '打开设置：只打开 Options 查看或调整 Memory Service 身份配置；不会迁移 {userId} 数据、切换当前结果、写入、导入、恢复或落到 default。',
    'memoryExplorer.identityAction.settingsBoundary.defaultFallback':
      '打开设置：只打开 Options 以恢复登录、userinfo.username 或 userId 配置；不会直接修复 default fallback、迁移 default 数据、导入、恢复或重试写入。',
    'memoryExplorer.identityAction.settingsBoundary.localInferred':
      '打开设置：只打开 Options 复核本机推断的 {userId}；不会把推断身份写入服务端、迁移记忆、导入、恢复或重试写入。',
    'memoryExplorer.nav.today': '今天',
    'memoryExplorer.nav.timeline': '时间轴',
    'memoryExplorer.nav.meetings': '会议记录',
    'memoryExplorer.nav.userProfile': '用户画像',
    'memoryExplorer.nav.followThreads': '关注后续',
    'memoryExplorer.nav.followThreadsSubnote': '仅统计手动规则',
    'memoryExplorer.nav.memoryEntryRules': '记忆入口规则',
    'memoryExplorer.nav.memoryEntryRulesSubnote': '手动关注话题',
    'memoryExplorer.nav.dreams': '梦境重放',
    'memoryExplorer.nav.reports': '周报报告',
    'memoryExplorer.nav.reflection': '自我反思',
    'memoryExplorer.nav.rehearsal': '场景预演',
    'memoryExplorer.nav.rehearsalSubnote': 'Rehearsal',
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
    'memoryExplorer.nav.usageAnalytics': '我的用量',
    'memoryExplorer.nav.usageAnalyticsSubnote': '仅看自己的功能与 Token',
    'memoryExplorer.nav.usageAnalyticsBoundary':
      '打开个人用量报表（HMAC 签名链接）；只读，不写入记忆。',
    'memoryExplorer.search.placeholder':
      '搜索任何内容、实体或关键词（按 Enter 搜索）...',
    'memoryExplorer.search.scopeAria': '记忆范围',
    'memoryExplorer.scope.work.title': '只检索工作记忆',
    'memoryExplorer.scope.personal.title': '只检索个人记忆',
    'memoryExplorer.scope.all.title': '同时检索工作与个人记忆',
    'memoryExplorer.scopeIntent.label': '搜索范围意图',
    'memoryExplorer.scopeIntent.summary.work':
      '下一次搜索只读取工作记忆。',
    'memoryExplorer.scopeIntent.summary.personal':
      '下一次搜索只读取个人记忆。',
    'memoryExplorer.scopeIntent.summary.all':
      '下一次搜索会同时读取工作与个人记忆。',
    'memoryExplorer.scopeIntent.detail.rerun':
      '当前有查询，切换范围会立即重新召回并同步 URL；只读取 Memory Service。',
    'memoryExplorer.scopeIntent.detail.idle':
      '输入查询或点击搜索后才会按此范围读取 Memory Service；切换按钮本身不写入。',
    'memoryExplorer.scopeIntent.caution.work':
      '个人记忆不会进入候选；适合默认工作场景检索。',
    'memoryExplorer.scopeIntent.caution.personal':
      '工作记忆不会进入候选；适合只查私人生活域。',
    'memoryExplorer.scopeIntent.caution.all':
      '个人证据可能进入结果；复制、引用或带到工作场景前先确认。',
    'memoryExplorer.scopeIntent.metric.workOnly': '仅工作',
    'memoryExplorer.scopeIntent.metric.personalOnly': '仅个人',
    'memoryExplorer.scopeIntent.metric.workAndPersonal': '工作 + 个人',
    'memoryExplorer.scopeIntent.metric.personalExcluded': '不含个人',
    'memoryExplorer.scopeIntent.metric.workExcluded': '不含工作',
    'memoryExplorer.scopeIntent.metric.personalReview': '个人证据需确认',
    'memoryExplorer.scopeIntent.metric.noWrite': '不写入/删除/同步/确认',
    'memoryExplorer.scopeButton.domain.work': '工作记忆',
    'memoryExplorer.scopeButton.domain.personal': '个人记忆',
    'memoryExplorer.scopeButton.domain.all': '全部记忆',
    'memoryExplorer.scopeButton.caution.work': '个人记忆不会进入候选。',
    'memoryExplorer.scopeButton.caution.personal': '工作记忆不会进入候选。',
    'memoryExplorer.scopeButton.caution.all':
      '工作与个人证据都可能进入结果，个人证据带到工作场景前需要确认。',
    'memoryExplorer.scopeButton.noEffects':
      '不会写入、删除、同步外部来源、写反馈、确认答案或外发。',
    'memoryExplorer.scopeButton.current':
      '{label}：当前已选择{domain}；下一次搜索按这个范围读取。{caution} {noEffects}',
    'memoryExplorer.scopeButton.rerun':
      '{label}：切到{domain}会立即用当前 query 重新请求 Memory Service 并同步 URL；上一次结果只作为旧快照，返回前不会当成本轮证据。{caution} {noEffects}',
    'memoryExplorer.scopeButton.idle':
      '{label}：选择{domain}只设置下一次搜索范围；输入查询或点击搜索后才读取 Memory Service。{caution} {noEffects}',

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
    'options.sections.roadmap': 'Project Roadmap',
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
      'The UI language is saved to Chrome local storage immediately and synced as the user profile language preference. It does not depend on the config save button below.',
    'options.promptConfig.description':
      'Manage long-term preferences used by message analysis, project analysis, and meeting context, with receipts for what is actually injected.',
    'options.promptConfig.open': 'Open Custom Prompts',
    'options.promptConfig.receipt':
      'Saved preferences are injected according to source toggles, scope, and safety hints.',

    'popup.memoryExplorer': 'Memory Explorer',
    'popup.scheduledMessages': 'Scheduled Messages',
    'popup.manageMemoryEntries': 'Manage Memory Entries',
    'popup.projectRoadmap': 'Project Roadmap',
    'popup.messageAnalysis.background': 'Analyze msg in background',
    'popup.messageAnalysis.every': 'every {interval}',
    'popup.backgroundTasks': 'Background Tasks',
    'popup.helpDocs': 'View help docs',
    'popup.shareWithColleagues': 'Share with colleagues',
    'popup.meetingPilot.open': 'Open Meeting Pilot',
    'popup.meetingPilot.enableVision': 'Enable Vision and Minutes',
    'popup.meetingPilot.start': 'Start Meeting Pilot',
    'popup.meetingPilot.processing': 'Processing...',
    'popup.meetingPilot.openOptions': 'Open Settings',
    'popup.today.openTitle':
      'Open Today Pilot home to view the full visible brief; this only navigates and does not refresh, write feedback, copy context, send messages, or execute actions.',
    'popup.today.refreshTitle':
      "Refresh the Today Pilot Top 3 snapshot: only reads or regenerates this user's derived today brief; it does not mark messages read, complete source tasks, write feedback, send messages, approve, or execute external actions.",
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
      'Personal identity was not resolved. Using the default space; writes are blocked until identity recovers.',
    'memoryExplorer.identitySource.header':
      'Identity source: resolved and sent as X-User-Id',
    'memoryExplorer.identitySource.defaultFallback':
      'Identity source: unresolved read request fell back to default',
    'memoryExplorer.identitySource.localInferred':
      'Identity source: inferred locally, not confirmed by service',
    'memoryExplorer.identityBoundary.explicit':
      'Reads, writes, backups, and restores apply only to this per-user SQLite space.',
    'memoryExplorer.identityBoundary.defaultFallback':
      'Read-only compatibility fallback; writes, imports, and restores are blocked until identity recovers.',
    'memoryExplorer.identityWriteBoundary.explicit':
      'Write boundary: reads, writes, backups, and restores stay within {userId}; they will not fall back to default or another user space.',
    'memoryExplorer.identityWriteBoundary.defaultFallback':
      'Write boundary: {operations} are blocked. Restore userinfo.username or configure userId in settings before retrying.',
    'memoryExplorer.identityBlockedOperation.write': 'writes',
    'memoryExplorer.identityBlockedOperation.import': 'imports',
    'memoryExplorer.identityBlockedOperation.restore': 'restores',
    'memoryExplorer.identityBlockedOperation.profileUpdate': 'profile updates',
    'memoryExplorer.identityBlockedOperation.separator': ', ',
    'memoryExplorer.identitySnapshot.pending':
      'Identity snapshot has not refreshed yet; no memory writes, imports, or restores happen here.',
    'memoryExplorer.identitySnapshot.loading':
      'Reading the read-only identity snapshot...',
    'memoryExplorer.identitySnapshot.checkedAt':
      'Identity snapshot at {time} came from read-only /stats; refresh only checks the identity boundary again.',
    'memoryExplorer.identityAction.refresh': 'Refresh identity',
    'memoryExplorer.identityAction.openSettings': 'Open settings',
    'memoryExplorer.identityAction.refreshBoundary.explicit':
      'Refresh identity snapshot: only rereads the read-only /stats identity snapshot for {userId}; it will not write, import, restore, migrate memories, or switch to default or another user space.',
    'memoryExplorer.identityAction.refreshBoundary.defaultFallback':
      'Refresh identity snapshot: only checks whether the {userId} default fallback is still blocked; it will not write, import, restore, migrate memories, confirm default ownership, or retry failed writes.',
    'memoryExplorer.identityAction.refreshBoundary.localInferred':
      'Refresh identity snapshot: only requests /stats again to verify the locally inferred {userId}; it will not write, import, restore, migrate memories, or treat local inference as service confirmation.',
    'memoryExplorer.identityAction.settingsBoundary.explicit':
      'Open settings: only opens Options to view or adjust Memory Service identity configuration; it will not migrate {userId} data, switch current results, write, import, restore, or fall back to default.',
    'memoryExplorer.identityAction.settingsBoundary.defaultFallback':
      'Open settings: only opens Options to recover login, userinfo.username, or userId configuration; it will not directly fix default fallback, migrate default data, import, restore, or retry writes.',
    'memoryExplorer.identityAction.settingsBoundary.localInferred':
      'Open settings: only opens Options to review the locally inferred {userId}; it will not write inferred identity to the service, migrate memories, import, restore, or retry writes.',
    'memoryExplorer.nav.today': 'Today Pilot',
    'memoryExplorer.nav.timeline': 'Timeline',
    'memoryExplorer.nav.meetings': 'Meetings',
    'memoryExplorer.nav.userProfile': 'User Profile',
    'memoryExplorer.nav.followThreads': 'Follow Threads',
    'memoryExplorer.nav.followThreadsSubnote': 'Manual rules only',
    'memoryExplorer.nav.memoryEntryRules': 'Memory Entry Rules',
    'memoryExplorer.nav.memoryEntryRulesSubnote': 'Manual topic watches',
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
    'memoryExplorer.nav.usageAnalytics': 'My Usage',
    'memoryExplorer.nav.usageAnalyticsSubnote': 'Your feature and token report',
    'memoryExplorer.nav.usageAnalyticsBoundary':
      'Opens your personal usage report (HMAC signed link); read-only.',
    'memoryExplorer.search.placeholder':
      'Search any content, entity, or keyword (press Enter)...',
    'memoryExplorer.search.scopeAria': 'Memory scope',
    'memoryExplorer.scope.work.title': 'Search work memories only',
    'memoryExplorer.scope.personal.title': 'Search personal memories only',
    'memoryExplorer.scope.all.title': 'Search work and personal memories',
    'memoryExplorer.scopeIntent.label': 'Search scope intent',
    'memoryExplorer.scopeIntent.summary.work':
      'The next search reads work memories only.',
    'memoryExplorer.scopeIntent.summary.personal':
      'The next search reads personal memories only.',
    'memoryExplorer.scopeIntent.summary.all':
      'The next search reads work and personal memories.',
    'memoryExplorer.scopeIntent.detail.rerun':
      'A query is active, so changing scope reruns recall and updates the URL; it only reads Memory Service.',
    'memoryExplorer.scopeIntent.detail.idle':
      'This scope is used after you enter a query or press Search; switching the control itself does not write.',
    'memoryExplorer.scopeIntent.caution.work':
      'Personal memories are excluded from candidates; this is the default work-context search.',
    'memoryExplorer.scopeIntent.caution.personal':
      'Work memories are excluded from candidates; use this for the private life domain.',
    'memoryExplorer.scopeIntent.caution.all':
      'Personal evidence may enter results; review before copying, quoting, or bringing it into work.',
    'memoryExplorer.scopeIntent.metric.workOnly': 'Work only',
    'memoryExplorer.scopeIntent.metric.personalOnly': 'Personal only',
    'memoryExplorer.scopeIntent.metric.workAndPersonal': 'Work + personal',
    'memoryExplorer.scopeIntent.metric.personalExcluded': 'Personal excluded',
    'memoryExplorer.scopeIntent.metric.workExcluded': 'Work excluded',
    'memoryExplorer.scopeIntent.metric.personalReview':
      'Review personal evidence',
    'memoryExplorer.scopeIntent.metric.noWrite':
      'No write/delete/sync/confirmation',
    'memoryExplorer.scopeButton.domain.work': 'work memories',
    'memoryExplorer.scopeButton.domain.personal': 'personal memories',
    'memoryExplorer.scopeButton.domain.all': 'all memories',
    'memoryExplorer.scopeButton.caution.work':
      'Personal memories will not enter candidates.',
    'memoryExplorer.scopeButton.caution.personal':
      'Work memories will not enter candidates.',
    'memoryExplorer.scopeButton.caution.all':
      'Work and personal evidence may both enter results; review personal evidence before bringing it into work.',
    'memoryExplorer.scopeButton.noEffects':
      'It will not write, delete, sync external sources, write feedback, confirm answers, or send externally.',
    'memoryExplorer.scopeButton.current':
      '{label}: {domain} are already selected; the next search reads this scope. {caution} {noEffects}',
    'memoryExplorer.scopeButton.rerun':
      '{label}: switching to {domain} immediately reruns the current query against Memory Service and updates the URL; previous results are only an old snapshot and are not current evidence before the response returns. {caution} {noEffects}',
    'memoryExplorer.scopeButton.idle':
      '{label}: selecting {domain} only stages the next search scope; Memory Service is read after you enter a query or press Search. {caution} {noEffects}',

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
