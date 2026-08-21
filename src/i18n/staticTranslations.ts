import {
  DEFAULT_UI_LANGUAGE,
  normalizeUiLanguage,
  UiLanguage,
} from './index.js';

const STATIC_UI_TRANSLATIONS_EN: Record<string, string> = {
  // Shared actions and state
  '保存': 'Save',
  '取消': 'Cancel',
  '确认': 'Confirm',
  '编辑': 'Edit',
  '删除': 'Delete',
  '恢复': 'Restore',
  '启用': 'Enable',
  '停用': 'Disable',
  '刷新': 'Refresh',
  '重置': 'Reset',
  '搜索': 'Search',
  '加载中...': 'Loading...',
  '保存中...': 'Saving...',
  '刷新中...': 'Refreshing...',
  '推送中...': 'Sending...',
  '立即推送': 'Send Now',
  '立即启用': 'Enable Now',
  '生成中...': 'Generating...',
  '处理中...': 'Processing...',
  '操作已取消': 'Operation cancelled',
  '操作': 'Action',
  '成功': 'Success',
  '失败': 'Failed',
  '跳过': 'Skipped',
  '阻塞': 'Blocked',
  '注意': 'Attention',
  '提示': 'Tip',
  '通过': 'Passed',
  '修复': 'Fix',
  '完成': 'Done',
  '就绪': 'Ready',
  '无动作': 'No action',
  '全部': 'All',
  '工作': 'Work',
  '个人': 'Personal',
  '两者': 'Both',
  '是': 'Yes',
  '否': 'No',
  '有': 'Yes',
  '无': 'No',
  '异常': 'Error',
  '规则': 'Rules',
  '置信度': 'Confidence',
  '通知': 'Notification',
  '存储': 'Store',
  '复核': 'Review',
  '待复核': 'Needs review',
  '无需': 'Not needed',
  '发送': 'Send',
  '撤销': 'Undo',
  '管理': 'Manage',
  '不发送': 'Do not send',
  '需要确认': 'Needs approval',
  '无需确认': 'No approval needed',
  '立即执行': 'Run Now',
  '查看任务详情': 'View Task Details',
  '查看': 'View',
  '详情': 'details',
  '已复制': 'copied',
  '未知': 'Unknown',
  '条': 'items',
  '找到': 'Found',
  '作用': 'Effect',
  '不影响': 'Does not affect',
  '继续处理': 'Continue in',

  // Top-level product terms
  '今天': 'Today Pilot',
  '回复助手': 'Compose Assist',
  'NC 加会': 'Native Join',
  '项目面板': 'Project Dashboard',
  '记忆提示': 'Memory Lens',
  '人脉关系': 'Relationship Radar',
  'JIRA 设计稿': 'Jira Design Links',
  '豆包互联': 'Doubao Bridge',
  '技能库': 'Skill Foundry',
  '实体记忆查询': 'Memory Explorer',
  '项目进展图': 'Project Progress Chart',
  '会议弹幕': 'Meeting Pilot',
  '会前准备': 'Meeting Prep',
  '写作护航': 'Writing Assist',
  '主动询问': 'Outreach',
  '自我反思': 'Self Reflection',
  '梦境重放': 'Dream Replay',
  '决策中心': 'Decision Center',
  '动作队列': 'Action Queue',
  '定时消息管理': 'Scheduled Messages',
  '管理记忆入口': 'Manage Memory Entries',
  '稍后': 'Remind',
  '稍后处理': 'Remind',
  '关注': 'Watch',
  '关注后续': 'Watch',
  '答复': 'Reply',
  '自动答复': 'Reply',
  '跟进': 'Followup',
  '跟进追问': 'Followup',
  '前往配置': 'Open settings',
  '打开主动询问配置失败，请稍后重试':
    'Unable to open Outreach settings. Please try again later.',
  '跟进追问：需要先在 Options 启用主动询问引擎。点击会打开主动询问配置，不会创建跟进会话、发送追问或写 Google Sheet。':
    'Followup: enable the Outreach engine in Options first. This click opens Outreach settings and does not create a follow-up session, send a chase, or write Google Sheet.',
  '跟进追问：需要补齐 RingCentral Server URL、Client ID、Client Secret 和 JWT。点击会打开主动询问配置，不会创建跟进会话、发送追问或写 Google Sheet。':
    'Followup: add RingCentral Server URL, Client ID, Client Secret, and JWT first. This click opens Outreach settings and does not create a follow-up session, send a chase, or write Google Sheet.',
  '跟进追问：暂时无法读取主动询问配置。请确认 Memory Service 可访问后再到 Options 检查。点击会打开配置页，不会创建跟进会话或发送追问。':
    'Followup: Outreach settings could not be read. Confirm Memory Service is reachable, then check Options. This click opens settings and does not create a follow-up session or send a chase.',
  '跟进追问尚未可用：请先在 Options 启用主动询问引擎。未创建跟进会话，也没有发送消息。':
    'Followup is not ready: enable the Outreach engine in Options first. No follow-up session was created and no message was sent.',
  '跟进追问尚未可用：请先补齐 RingCentral Server URL、Client ID、Client Secret 和 JWT。未创建跟进会话，也没有发送消息。':
    'Followup is not ready: add RingCentral Server URL, Client ID, Client Secret, and JWT first. No follow-up session was created and no message was sent.',
  '暂时无法读取主动询问配置，请先确认 Memory Service 可访问。未创建跟进会话，也没有发送消息。':
    'Outreach settings could not be read. Confirm Memory Service is reachable first. No follow-up session was created and no message was sent.',
  '联动': 'Openclaw',
  '联动操作': 'Openclaw',
  '消息交互设置': 'Message action settings',
  '消息交互功能设置': 'Message action settings',
  '自动答复 / 跟进追问': 'Reply / Followup',
  '本地显示开关': 'Local display switches',
  '只改变此浏览器消息旁工具栏按钮显示':
    'Only changes which buttons appear beside messages in this browser',
  '不会取消已创建提醒、关注、追问、自动答复规则或联动操作':
    'Does not cancel existing reminders, watches, followups, reply rules, or Openclaw actions',
  '已排队或已保存的任务仍从各自管理页处理':
    'Queued or saved items still stay in their own management pages',
  '保存后': 'After save',
  '将显示': 'Will show',
  '将隐藏本地消息工具栏；已创建事项仍不受影响':
    'Will hide the local message toolbar; existing items are not affected',
  '关闭后，对应按钮将不再显示':
    'Turning a switch off hides that entry from this local toolbar.',
  '设置保存失败，请稍后重试':
    'Unable to save settings. Please try again later.',
  '已隐藏消息工具栏 · 仅关闭本地入口，不会取消已创建提醒、关注、追问或联动规则':
    'Message toolbar hidden. This only closes local entries; it does not cancel existing reminders, watches, followups, or Openclaw rules.',
  '设置已保存 · 仅更新本地工具栏入口，已创建事项不受影响':
    'Settings saved. Only local toolbar entries changed; existing items are not affected.',
  '稍后处理快捷选项': 'Remind quick options',
  '返回稍后处理快捷选项': 'Back to Remind quick options',
  '← 返回': '← Back',
  '自定义时间': 'Custom time',
  '自定义...': 'Custom...',
  '管理稍后处理': 'Manage Remind',
  '打开自定义时间选择器；不会写入 Scheduled Messages，只有确认未来时间后才创建或改期 Snooze；不会发送消息、标记已读或完成原消息':
    'Opens the custom reminder time picker; only confirming a future time creates or reschedules Remind in Scheduled Messages, and this does not send a message, mark read, or complete the original message',
  '只打开 Scheduled Messages 的 Snooze 视图；不会创建、改期、完成或删除提醒，不会发送消息或写记忆':
    'Only opens the Scheduled Messages Remind view; it does not create, reschedule, complete, or delete reminders, send a message, or write memory',
  '选择日期和时间': 'Choose date and time',
  '将在以下时间提醒您：': 'Reminder time:',
  '请选择未来时间': 'Choose a future time',
  '创建中...': 'Creating...',
  '打开中...': 'Opening...',
  '无法识别提醒时间': 'Unable to recognize reminder time',
  '提醒路径': 'Reminder path',
  '去向': 'Queue',
  '写入 Scheduled Messages 的 Snooze 队列':
    'Creates or updates the Scheduled Messages Remind queue',
  '回到消息': 'Writeback',
  '到点由 Bot 推送，并在原消息显示稍后标注':
    'Bot sends it when due, and the original message shows a Remind marker',
  '恢复': 'Recovery',
  '选错可撤销，或从管理稍后处理改期':
    'Undo a wrong pick, or reschedule from Manage Remind',
  '改期预览': 'Reschedule preview',
  '当前': 'Current',
  '本次点击': 'This pick',
  '已在本地标注为': 'Already marked locally as',
  '会改到': 'Will reschedule to',
  '仍是同源 Snooze，不新增第二条':
    'same-source Remind; no second reminder is added',
  '会改期这条同源 Snooze，不新增第二条':
    'Reschedules this same-source Remind item instead of adding another one',
  '选错可从成功 Toast 或管理稍后处理确认':
    'Use the success toast or Manage Remind to confirm a wrong pick',
  '提醒时间口径': 'Reminder timing basis',
  '会创建提醒到': 'Will create a reminder for',
  '会按所选时间创建 Snooze': 'Creates a Remind item for the selected time',
  '写入边界': 'Write boundary',
  '点击具体时间后才写入 Scheduled Messages；不会发送消息、标记已读或完成原消息':
    'Writes to Scheduled Messages only after you pick a time; does not send a message, mark read, or complete the original message',
  '页面标注': 'Message marker',
  '成功后原消息标注仍等后台同步；当前页面可能短暂仍显示旧快照':
    'After success, the original message marker still waits for background sync; this page may briefly show the old snapshot',
  '缓存口径': 'Cache basis',
  '来自本地 marker 快照；以 Scheduled Messages 管理页和后台同步为准':
    'Based on the local marker snapshot; Scheduled Messages and background sync remain authoritative',
  '来自本地 marker 快照，不是实时远端查询；以 Scheduled Messages 管理页和后台同步为准':
    'Based on the local marker snapshot, not a live remote status check; Scheduled Messages and background sync remain authoritative',
  '来自本地 marker 快照，可能过旧；刷新会话或等待后台同步后再确认':
    'Based on the local marker snapshot, which may be stale; refresh the conversation or wait for background sync before relying on it',
  '来自本地 marker 快照，尚未刷新远端状态；以 Scheduled Messages 管理页和后台同步为准':
    'Based on the local marker snapshot; remote status has not refreshed yet, so Scheduled Messages and background sync remain authoritative',
  '时间口径': 'Timing',
  '预计时间会在悬停、聚焦和点击前刷新':
    'Preview refreshes on hover, focus, and click',
  '已更新提醒': 'Reminder updated',
  '已设置提醒': 'Reminder set',
  '可撤销；管理会定位到这条提醒':
    'Undo is available; Manage opens this reminder',
  '管理会打开 Snooze 列表确认': 'Manage opens the Remind list',
  '同一条消息的旧提醒已改期；管理会定位到原提醒':
    'The existing reminder for this message was rescheduled; Manage opens it',
  '原消息标注会随后台同步刷新，当前页面可能短暂仍显示旧快照':
    'Original message marker refreshes with background sync; this page may briefly show the old local snapshot',
  '已撤销提醒': 'Reminder cancelled',
  '只删除这条未完成 Snooze；不会删除原消息、其他定时消息或改写记忆':
    'Only deletes this unfinished Remind item; it does not delete the original message, other scheduled messages, or rewrite memory',
  '未撤销提醒': 'Reminder not cancelled',
  '提醒可能仍在 Snooze 队列；请从管理入口定位确认或删除':
    'The reminder may still be in the Remind queue; use Manage to locate, confirm, or delete it',
  '撤销提醒失败，请稍后重试':
    'Unable to cancel the reminder. Please try again later.',
  '提醒处理中': 'Reminder in progress',
  '同一条消息已有请求': 'same-message request already exists',
  '已有同源 Snooze 请求处理中；这次点击没有创建第二条提醒、没有改期、没有写记忆或发送 Bot 消息':
    'A same-source Remind request is already in progress; this click did not create a second reminder, reschedule it, write memory, or send a bot message',
  '首个请求完成后会显示结果；若页面一直无变化，可从管理入口确认 Snooze 队列':
    'The first request will show the result; if the page stays unchanged, use Manage to confirm the Remind queue',

  // Options: section labels and detailed settings
  '消息分析推送': 'Message Analysis Delivery',
  '关注后续推送': 'Follow-up Delivery',
  '梦境重放报表推送': 'Dream Replay Report Delivery',
  '周报推送': 'Weekly Report Delivery',
  '决策中心推送': 'Decision Center Delivery',
  '主动询问结果推送': 'Outreach Result Delivery',
  '不推送': 'Do not send',
  '推送给 Me（user）': 'Send to Me (user)',
  '自定义群组': 'Custom group',
  '群组 ID': 'Group ID',
  '输入 RingCentral 群组 ID': 'Enter RingCentral group ID',
  '功能 Demo': 'Feature Demos',
  '打开项目进展图 Demo': 'Open Project Progress Chart Demo',
  '消息分析频度（分钟）': 'Message analysis frequency (minutes)',
  '每隔多久执行一次消息分析（默认: 120分钟）':
    'How often to run message analysis (default: 120 minutes).',
  '消息上下文窗口（分钟）': 'Message context window (minutes)',
  '每次分析时获取距离此刻的历史消息时间范围（默认: 125分钟）':
    'How much recent history to include for each analysis run (default: 125 minutes).',
  '分析系统类型': 'Analysis engine',
  '根据关注列表直接过滤': 'Filter directly with the watch list',
  '标准Agent工作流（按流程分析消息中的实体、关系，自动判断消息重要性）':
    'Standard agent workflow (extracts entities and relationships, then judges importance).',
  '智能Agent思考（具有独立思考能力，按需调用工具分析消息）':
    'Intelligent agent thinking (plans independently and calls tools as needed).',
  '拆开每个群组独立分析': 'Analyze each group separately',
  '开启后，不同群组的消息会分别进入独立分析流程。':
    'When enabled, messages from different groups enter separate analysis flows.',
  '启用消息审核': 'Enable message review',
  '关闭后，会直接推送所有命中关注项的消息。':
    'When disabled, every message matching watched items is delivered directly.',
  '命中关注项后的即时提醒。Bot Key 和 Base URL 从 env 读取。':
    'Instant reminders after watched items match. Bot key and base URL are read from env.',
  '过滤自己发送的消息': 'Filter messages sent by me',
  '开启后，消息分析会自动忽略自己发出的消息。':
    'When enabled, message analysis ignores messages sent by you.',
  '自动学习我的发言以优化输入建议':
    'Learn from my writing to improve input suggestions',
  '只用于学习你的表达习惯和上下文偏好；不改变外部消息监控、过滤和通知规则。':
    'Only learns your expression style and context preferences. It does not change external message monitoring, filters, or notifications.',
  '启用「稍后处理」功能': 'Enable Remind',
  '设置提醒时间，到时 Bot 会推送消息提醒您。':
    'Set a reminder time. The bot will remind you when it is due.',
  '启用「关注后续」功能': 'Enable Watch',
  '围绕当前消息快速创建关注后续规则，持续追踪后续讨论。':
    'Create a follow-up rule from the current message and keep tracking later discussion.',
  '关注后续汇总和相关提醒的推送位置。默认推送给 Me。':
    'Delivery target for follow-up summaries and related reminders. Defaults to Me.',
  '启用「自动答复」功能': 'Enable Reply',
  '配置自动答复规则，匹配消息时自动发送回复。':
    'Configure auto-reply rules that send replies when messages match.',
  '启用「联动操作」功能': 'Enable Openclaw',
  '从消息快速创建带联动操作的记忆入口规则。':
    'Quickly create memory entry rules with linked actions from messages.',
  '记忆服务 API 地址': 'Memory Service API URL',
  'API 密钥（可选）': 'API key (optional)',
  '后端配置 API_KEY 时填写': 'Fill this when the backend has API_KEY configured',
  '请求超时（毫秒）': 'Request timeout (ms)',
  '自我反思 / 场景预演生产': 'Self Reflection / Rehearsal production',
  '启用自我反思': 'Enable self reflection',
  '启用自我反思（场景预演生产总开关）':
    'Enable self reflection (Rehearsal production master switch)',
  '每个用户可以单独关闭自我反思；关闭后不会影响梦境重放的持续生成。':
    'Each user can disable self reflection independently. Disabling it does not stop Dream Replay generation.',
  '默认开启。关闭后不会自动推进 Reflection，也不会从 Reflection 生成新的场景预演候选；已存在的场景预演和梦境重放不受影响。':
    'On by default. Disabling it stops automatic Reflection progress and new Rehearsal candidates from Reflection; existing Rehearsals and Dream Replay are not affected.',
  '用于冲突/待确认类的决策中心提醒。默认推送给 Me。':
    'Used for Decision Center reminders about conflicts and pending confirmations. Defaults to Me.',
  '梦境重放会持续运行；这里仅控制报表推送到 Me、自定义群组，或完全不推送。':
    'Dream Replay keeps running. This only controls whether reports are sent to Me, a custom group, or not sent.',
  '梦境重放报表计划': 'Dream Replay report schedule',
  '每天 / 每隔 X 天': 'Daily / Every X days',
  '每周': 'Weekly',
  '每月': 'Monthly',
  '每隔': 'Every',
  '天': 'days',
  '每次会议默认开启会议弹幕': 'Enable Meeting Pilot by default for meetings',
  '关闭后不会在会议页默认注入悬浮入口；仍可从扩展 popup 点击“开启会议弹幕”，对当前会议单次启用。':
    'When disabled, the floating entry is not injected by default. You can still start Meeting Pilot once for the current meeting from the extension popup.',
  '显示会议页右下角悬浮入口': 'Show the floating meeting entry',
  '悬浮 icon hover 3 秒后会出现小 x，可隐藏当前页面入口或选择永不展示；如果选过“永不展示”，可以在这里重新打开。关闭后仅隐藏会议页悬浮入口与浮层提醒，不会停用 popup 单次会议弹幕。':
    'Hover the floating icon for 3 seconds to reveal a close control. You can hide it on the current page or never show it again. This setting restores it after “never show”. Disabling it only hides the floating entry and overlay prompts; one-time popup launch still works.',
  '优先用 RingCentral app 加会': 'Prefer RingCentral app for joining',
  '开启后会拦截 RingCentral Web 中的 Video Join 链接和部分 Join 按钮，改用本机 RingCentral app 打开会议；若 app 没有接管，页面会保留浏览器加入兜底，也可在兜底浮层里改为默认使用浏览器。':
    'When enabled, Video Join links and some Join buttons in RingCentral Web open through the local RingCentral app. If the app does not take over, the browser join fallback remains available.',
  '启用 Context Assist': 'Enable Context Assist',
  '统一启用会前准备和写作护航的场景化记忆提示。':
    'Enable scene-aware memory prompts for meeting prep and writing assist.',
  '显示场景预演提醒': 'Show rehearsal reminders',
  '在写作护航、Memory Lens、会议和会前准备中显示 Rehearsal/场景预演提示；关闭后仍保留预演数据和自我反思候选生成。':
    'Show Rehearsal prompts in Writing Assist, Memory Lens, meetings, and meeting prep. Turning this off keeps rehearsal data and self-reflection candidates.',
  '启用写作护航': 'Enable Writing Assist',
  '在支持的消息、Jira 和网页 AI 输入框旁显示可预览、可插入的 Personal AI 建议。':
    'Show previewable and insertable Personal AI suggestions beside supported message, Jira, and web AI input boxes.',
  '启用会前准备': 'Enable Meeting Prep',
  '在 RingCentral Video Home 的选中会议详情区注入会前准备卡片。':
    'Inject a meeting prep card into the selected meeting details area on RingCentral Video Home.',
  'Calendar Source': 'Calendar Source',
  'Auto：Outlook 优先，RingCentral 本地兜底':
    'Auto: prefer Outlook, fall back to local RingCentral metadata',
  '重新授权 Outlook': 'Reauthorize Outlook',
  '授权 Outlook Calendar': 'Authorize Outlook Calendar',
  '同步 Outlook Calendar': 'Sync Outlook Calendar',
  '断开 Outlook Calendar': 'Disconnect Outlook Calendar',
  '未连接 Outlook；Video Home 页面会自动使用 RingCentral 本地会议元数据。':
    'Outlook is not connected. Video Home will use local RingCentral meeting metadata automatically.',
  'Transcription Mode': 'Transcription Mode',
  '自动识别 RingCentral Transcript': 'Auto-detect RingCentral transcript',
  '开启后优先读取会议页面 Notes / Transcript 中 RingCentral 自动生成的转录；读取成功时不会再启动 Local ASR 或 Cloud ASR。':
    'When enabled, the meeting page Notes / Transcript is used first. If it is found, Local ASR or Cloud ASR will not start.',
  'ASR Provider API Key': 'ASR Provider API Key',
  '输入会议弹幕转写服务 API Key': 'Enter Meeting Pilot transcription API key',
  '启用 OpenClaw 外部委派': 'Enable OpenClaw external delegation',
  '开启后，自我反思与联动操作都可把外部系统查询/执行委派给 OpenClaw。':
    'When enabled, self reflection and linked actions can delegate external queries or execution to OpenClaw.',
  'OpenClaw 超时（秒）': 'OpenClaw timeout (seconds)',
  '已配置（如需更新请输入新 key）':
    'Configured (enter a new key to update)',
  '输入新的 OpenClaw API Key': 'Enter a new OpenClaw API key',
  '后端已配置 key': 'Backend key configured',
  '后端未配置 key': 'Backend key not configured',
  '启用主动询问引擎': 'Enable Outreach engine',
  '开启后，模板派发、等待回复、追问和升级才会真正运行。':
    'When enabled, template dispatch, waiting for replies, follow-ups, and escalation actually run.',
  '主动询问轮询间隔（毫秒）': 'Outreach polling interval (ms)',
  '反思发起的主动询问默认先审批':
    'Require approval by default for reflection-triggered outreach',
  '开启后，反思生成的外联会先进入待审批，不会直接发出。':
    'When enabled, reflection-generated outreach enters pending approval instead of sending directly.',
  '手动/定时模板发起的主动询问默认先审批':
    'Require approval by default for manual or scheduled outreach templates',
  '开启后，Scheduled Messages 里的手动模板也会进入待审批。':
    'When enabled, manual templates in Scheduled Messages also enter pending approval.',
  '当主动询问拿到最终结果、超时或未得到可用结论时，用 Bot 推送给 Me 或指定群组。回执会说明是否发生过追问，并提供继续追问入口。默认推送给 Me。':
    'When Outreach gets a final result, times out, or cannot use the reply, send a bot receipt to Me or a selected group. The receipt says whether a follow-up was sent and includes a continue-follow-up entry. Defaults to Me.',
  'RingCentral 目录缓存状态': 'RingCentral directory cache status',
  '联系人目录：': 'Contacts:',
  '群组目录：': 'Groups:',
  '立即刷新 RingCentral 目录': 'Refresh RingCentral Directory Now',
  '选择「不推送」时，保存到后端会自动按禁用处理。':
    'When “Do not send” is selected, backend save treats the delivery as disabled.',
  'Cron 表达式': 'Cron expression',
  '最少消息数阈值': 'Minimum message threshold',
  '保存周报设置到后端': 'Save Weekly Report Settings',
  '立即推送周报': 'Send Weekly Report Now',
  'LLM 类型': 'LLM type',
  '本地': 'Local',
  'Jira API Token': 'Jira API Token',
  '输入你的 Jira API Token': 'Enter your Jira API token',
  '保存配置': 'Save Configuration',
  '重置为默认值': 'Reset to Defaults',
  '从.env文件加载': 'Load from .env',
  '导出配置': 'Export Configuration',
  '导入配置': 'Import Configuration',
  '启动演示': 'Start Demo',
  '停止演示': 'Stop Demo',
  '添加允许站点': 'Add allowed site',
  '清空允许站点列表': 'Clear allowed sites',
  '恢复全部': 'Restore all',
  '当前没有被永久屏蔽的页面路径。':
    'No page paths are permanently blocked right now.',
  '添加允许站点失败': 'Failed to add allowed site',
  '恢复全部站点失败': 'Failed to restore all sites',

  // Popup
  '静默消息分析': 'Silent message analysis',
  '后台任务': 'Background Tasks',
  '需处理': 'Needs action',
  '排程异常': 'Schedule issue',
  '需处理总览': 'Needs Action Overview',
  '刷新后台任务状态': 'Refresh background task status',
  '筛选后台任务状态': 'Filter background task status',
  '后台任务需处理总览': 'Background task action overview',
  '在 RingCentral 消息页面，悬停在消息上时会显示交互工具栏。可以选择启用/禁用以下功能：':
    'On RingCentral message pages, hovering over a message shows the Message Reaction toolbar. You can enable or disable the actions below:',
  '启用或停用': 'Enable or disable',
  '重试创建此任务的 Chrome 排程':
    'Retry creating the Chrome schedule for this task',
  '暂停排程，保留手动执行入口':
    'Pause the schedule and keep manual run available',
  '任务': 'task',
  '查看帮助文档': 'View help docs',
  '分享给同事': 'Share with colleagues',
  '抓取 Jira Tickets 到 Sheet': 'Fetch Jira Tickets to Sheet',
  '展开 Epic 下面所有的 tickets': 'Expand all tickets under an Epic',
  '正在查找 Epic 子任务...': 'Finding Epic child tickets...',
  '分析 Slide 项目信息并更新':
    'Analyze slide project information and update it',
  '正在分析 Slide 项目信息...': 'Analyzing slide project information...',
  '打开会议弹幕': 'Open Meeting Pilot',
  '启用画面理解与纪要': 'Enable Vision and Minutes',
  '开启会议弹幕': 'Start Meeting Pilot',
  '打开配置': 'Open Settings',
  '任务状态不可用': 'Task status unavailable',
  '任务控制失败': 'Task control failed',
  '任务执行失败': 'Task run failed',
  '排程修复失败': 'Schedule repair failed',
  '状态不可用': 'Status unavailable',
  '当前没有需要处理的后台任务':
    'No background tasks need action right now',
  '当前没有执行中的后台任务': 'No background tasks are running right now',
  '当前没有排程异常': 'No schedule issues right now',
  '当前没有最近跳过的任务': 'No recently skipped tasks right now',
  '当前没有失败任务': 'No failed tasks right now',
  '当前没有停用任务': 'No disabled tasks right now',
  '暂无后台任务状态': 'No background task status yet',
  '正在执行': 'Running',
  '立即重试': 'Retry Now',
  '重排 Chrome alarm': 'Reschedule Chrome alarm',
  '重试或检查服务': 'Retry or check service',
  '稍后重试': 'Retry later',

  // Topic modal
  'Manual memory rules': 'Manual memory rules',
  '记忆入口规则': 'Memory Entry Rules',
  '配置你希望系统持续观察并写入记忆的消息模式。这里只展示你手动创建的规则；系统内部观察规则会继续运行，但不会出现在这里。':
    'Configure message patterns you want the system to keep observing and store as memories. This view only shows rules you created manually; internal observation rules keep running but do not appear here.',
  '配置自定义提示词和用户上下文':
    'Configure custom prompts and user context',
  '自定义提示词与上下文': 'Custom Prompts and Context',
  '后台记忆采集运行中': 'Background memory capture is running',
  '后台记忆采集未开启': 'Background memory capture is disabled',
  'Memory Service 已连接': 'Memory Service connected',
  'Memory Service 未配置': 'Memory Service not configured',
  'OpenClaw 已连接': 'OpenClaw connected',
  'OpenClaw 待配置': 'OpenClaw needs configuration',
  '只显示你定义的记忆入口规则。':
    'Only memory entry rules you define are shown.',
  '帮我问 / 自我反思等系统功能可能会临时挂内部观察规则，用于证据采集与入库；这些内部规则不会写入 concernedItems，也不会出现在这里。':
    'System features such as Quick Ask and self reflection may attach temporary internal observation rules for evidence capture and storage. Those internal rules are not written to concernedItems and do not appear here.',
  '当前没有运行中的内部观察': 'No internal observations are running',
  '待发观察': 'Pending observations',
  '等待回复': 'Waiting for replies',
  '待批准': 'Pending approval',
  '延后': 'Deferred',
  '请稍后刷新，手动规则仍可继续管理。':
    'Refresh later. Manual rules can still be managed.',
  '当前有规则配置了联动操作，但 OpenClaw 还没连接。动作描述会先和规则一起保存；连接后才具备被后端自动化规划器消费的前提。':
    'Some rules have linked actions, but OpenClaw is not connected yet. Action descriptions are saved with the rule first; the backend automation planner can consume them after connection.',
  '前往连接 OpenClaw': 'Connect OpenClaw',
  '静默消息分析未启用！记忆入口规则会先保存，但需要开启后台记忆采集后，才会自动捕获新消息并触发写入记忆、摘要、通知、自动答复、关注后续或联动操作。':
    'Silent message analysis is disabled. Memory entry rules will be saved, but new messages are only captured and used for memories, summaries, notifications, auto replies, follow-ups, or linked actions after background capture is enabled.',
  '＋ 添加规则': '+ Add Rule',
  '📤 导出规则': 'Export Rules',
  '📥 导入规则': 'Import Rules',
  '我的规则': 'My Rules',
  '系统内部观察规则不会计入这里，也不会计入 FollowThreads 统计。':
    'Internal observation rules are not counted here and are not included in FollowThreads statistics.',
  '还没有手动记忆入口规则': 'No manual memory entry rules yet',
  '从一条你想持续观察的消息模式开始。命中后消息会默认写入记忆，你也可以叠加 Glip 推送、摘要、自动答复、关注后续或联动操作。':
    'Start with a message pattern you want to keep observing. Matched messages are stored as memories by default, and you can also add Glip delivery, summaries, auto replies, follow-ups, or linked actions.',
  '天数': 'Days',
  '过期天数': 'Expiration days',
  '不自动过期请留空': 'Leave empty to never expire',
  'Glip推送': 'Glip delivery',
  'Chrome通知': 'Chrome notification',
  '@我': '@me',
  '匹配发送人:': 'Match sender:',
  '匹配群组:': 'Match group:',
  '留空表示不限发送人；多个用逗号分隔':
    'Leave empty for any sender. Separate multiple values with commas.',
  '留空表示不限群组；多个用逗号分隔':
    'Leave empty for any group. Separate multiple values with commas.',
  '回复内容：': 'Reply content:',
  '输入回复内容模板': 'Enter reply content template',
  '输入回复内容模板，或点击AI生成':
    'Enter a reply template, or click AI Generate',
  '🤖 AI 生成建议': 'AI Generate',
  '每次AI生成类似答复': 'Let AI generate a similar reply each time',
  '答复模式：': 'Reply mode:',
  '直接发送（不审核）': 'Send directly (no review)',
  '小时可拦截': 'hours to intercept',
  '手动确认后发送': 'Send after manual approval',
  '联动操作（OpenClaw）': 'Linked Actions (OpenClaw)',
  '联动操作快捷操作': 'Linked action shortcuts',
  '自然语言动作描述': 'Natural-language action description',
  '例如：从消息里提取日期和对象，生成一个 future RuntimeAction，在指定时间执行后续操作。':
    'Example: extract a date and target from the message, generate a future RuntimeAction, and run the follow-up at the specified time.',
  '例如：从消息中提取日期和对象，生成一个 future RuntimeAction，在指定时间执行后续动作。留空表示不创建联动操作。':
    'Example: extract a date and target from the message, generate a future RuntimeAction, and run the follow-up at the specified time. Leave empty to skip linked actions.',
  '操作无需批准': 'Action does not require approval',
  '推送频率：': 'Delivery frequency:',
  '每日': 'Daily',
  '发送日：': 'Send day:',
  '推送时间：': 'Delivery time:',
  '原消息：': 'Original message:',
  '🔗 查看原消息': 'View original message',
  '过期时间：': 'Expiration:',
  '通知方式：': 'Notification method:',
  '通知频率：': 'Notification frequency:',
  '立即通知（每条新消息）': 'Notify immediately (each new message)',
  '合并通知（定期汇总）': 'Merged notification (periodic summary)',
  '关键词过滤（可选）：': 'Keyword filter (optional):',
  '输入关键词，用逗号分隔（留空表示不过滤）':
    'Enter keywords separated by commas. Leave empty to disable filtering.',
  '只有包含这些关键词的回复才会触发通知':
    'Only replies containing these keywords trigger notifications.',
  '关联消息：': 'Related messages:',
  '当': 'When',
  '则': 'Then',
  '关注后续上下文': 'Follow-up Context',
  '自动答复草稿': 'Auto-reply Draft',
  '查看动作队列': 'View Action Queue',
  '连接 OpenClaw': 'Connect OpenClaw',
  '新建记忆入口规则': 'New Memory Entry Rule',
  '命中后默认写入记忆，下面勾选的是可叠加的用户动作。':
    'Matched messages are stored as memories by default. Select additional user actions below.',
  '例如：Standup 里有人提到 blocker；或 Leave Chat 里出现与我相关的请假消息':
    'Example: someone mentions a blocker in Standup, or a leave message related to me appears in Leave Chat',
  '使用定时摘要推送（替代即时通知）':
    'Use scheduled digest delivery instead of instant notifications',
  '可选，需要外部执行时再展开填写':
    'Optional. Expand and fill this when external execution is needed.',
  '已填写，命中后会生成 RuntimeAction':
    'Filled. Matching messages will generate a RuntimeAction.',
  '未启用': 'Not enabled',
  '展开': 'Expand',
  '收起': 'Collapse',
  '已激活': 'Active',
  '待激活': 'Pending activation',
  '需批准': 'Requires approval',
  '免批准': 'No approval required',
  '建议生成失败': 'Suggestion failed',
  '重试': 'Retry',
  '使用兜底样例': 'Use fallback example',
  '建议改写': 'Suggested rewrite',
  '正在预演联动操作': 'Previewing linked action',
  '预演失败': 'Preview failed',
  '联动操作预演': 'Linked Action Preview',
  '可生成动作': 'Can generate action',
  '需要改写': 'Needs rewrite',
  '这里填写的是你定义的自然语言联动操作。命中后消息仍默认写入记忆；后续动作会由 RuntimeAction / OpenClaw 能力消费。':
    'Write your natural-language linked action here. Matching messages are still stored as memories by default; follow-up actions are consumed by RuntimeAction / OpenClaw capabilities.',
  '这里保存的是手动规则的自然语言联动操作。命中后仍默认写入记忆；如果 OpenClaw 还没配置，则会以待激活状态保存。':
    'This saves the manual rule’s natural-language linked action. Matching messages are still stored as memories by default. If OpenClaw is not configured, the action is saved as pending activation.',
  '来自决策中心的改进建议': 'Improvement suggestion from Decision Center',
  '来源：': 'Source:',
  '正在优先参考你已有的联动操作历史；如果没有合适历史，会自动回退到内置样例目录。':
    'Prioritizing your linked action history. If no suitable history exists, this falls back to the built-in example catalog.',
  '直接发送': 'Send directly',
  '答复前': 'Before replying',

  // Weekdays and relative labels
  '周一': 'Monday',
  '周二': 'Tuesday',
  '周三': 'Wednesday',
  '周四': 'Thursday',
  '周五': 'Friday',
  '周六': 'Saturday',
  '周日': 'Sunday',
  '明天': 'Tomorrow',
  '昨天': 'Yesterday',

  // Google Sheets content script
  '输入 JQL 添加 JIRA 数据到表格': 'Add JIRA Data to Sheet with JQL',
  '请在': 'Configure columns on the',
  'filter 查询页面': 'filter query page',
  '配置需要展示的 columns 且设为列表模式。':
    'and set the issue navigator to list mode.',
  '保持数据一致': 'Keep data in sync',
  '启用后，表格中不在 JQL 查询结果中的数据行将被移除':
    'When enabled, rows that are no longer in the JQL result are removed from the sheet.',
  '同时使用 JQL 排序': 'Also use JQL order',
  '调整表格行顺序与 JQL 查询结果一致':
    'Reorder sheet rows to match the JQL result.',
  '配置表头JIRA映射': 'Configure Header to JIRA Mapping',
  '刷新表数据': 'Refresh Sheet Data',
  '查询': 'Query',
  '缺少必要参数': 'Missing required parameters',
  '展开 Epic 失败:': 'Failed to expand Epic:',
  '查询或处理失败:': 'Query or processing failed:',
  '请输入 JQL 查询语句': 'Enter a JQL query',
  '缺少表格 URL 或 token': 'Missing sheet URL or token',
  '正在读取表格数据...': 'Reading sheet data...',
  '表格为空或只有表头': 'The sheet is empty or only has headers',
  '未找到 Jira Key 列': 'Jira Key column was not found',
  '未找到 {columnName} 列，或到 config 表中配置':
    'Could not find the {columnName} column, or configure it in the config sheet.',
  '未找到有效的 Jira tickets': 'No valid Jira tickets were found',
  '更新失败:': 'Update failed:',
  '正在检查配置表...': 'Checking config sheet...',
  '无法提取 Sheet ID': 'Unable to extract Sheet ID',
  '正在切换到配置表...': 'Switching to config sheet...',
  '配置表不存在，正在创建...': 'Config sheet does not exist. Creating...',
  '配置表创建成功，正在切换...':
    'Config sheet created. Switching...',
  '操作失败:': 'Operation failed:',
  '查找表头映射时出错:': 'Error while finding header mapping:',
  '确认数据操作': 'Confirm Data Changes',
  '确认展开 Epic': 'Confirm Epic Expansion',
  '全选/取消全选': 'Select / Deselect All',
  '选择': 'Select',
  '将要操作的列：': 'Columns to change:',
  'JIRA key 用于匹配行，不能取消':
    'JIRA key is used to match rows and cannot be unchecked',
  'Jira filter 未返回该字段': 'Jira filter did not return this field',
  '更新现有数据：': 'Update existing rows:',
  '新增数据：': 'Append rows:',
  '移除数据：': 'Remove rows:',
  '这些行将从表格中删除': 'These rows will be deleted from the sheet',
  '以下字段在 Jira 查询结果中缺失，数据无法同步：':
    'These fields are missing from the Jira query result and cannot be synced:',
  '请前往 Jira 的': 'Go to Jira',
  '点击 Columns 按钮配置显示对应的列，然后重新查询。':
    'click Columns, configure the missing columns, then query again.',
  '更新': 'Update',
  '新增': 'Append',
  '移除': 'Remove',
  '正在查询 Jira...': 'Querying Jira...',
  '没有找到数据': 'No data found',
  'Jira 数据已复制到剪贴板': 'Jira data copied to clipboard',
  '已更新': 'Updated',
  '已追加': 'Appended',
  '已移除': 'Removed',
  '条数据。': 'rows. ',
  '条新数据。': 'new rows. ',
  '已按 JQL 顺序排列': 'Reordered',
  '行。': 'rows. ',
  '没有需要更新、追加或移除的数据。':
    'No data needs to be updated, appended, or removed.',
  'Google Sheets 操作失败:': 'Google Sheets operation failed:',
  '删除行失败:': 'Failed to delete row:',
  '正在调整行顺序...': 'Reordering rows...',
  '排序失败:': 'Sorting failed:',
  '开始查找 Epic 并获取子任务...':
    'Finding Epics and fetching child tickets...',
  '表格为空或无法读取': 'The sheet is empty or cannot be read',
  '未找到任何包含子任务的 Epic':
    'No Epics with child tickets were found',
  '个 Epic 包含子任务，准备确认操作...':
    'Epics have child tickets. Preparing confirmation...',
  '已成功展开': 'Expanded',
  '个 Epic 的子任务': "Epics' child tickets",
  '个包含子任务的 Epic': 'Epics with child tickets',
  '子任务数量': 'Child ticket count',
  '个子任务': 'child tickets',
  '子任务失败:': 'child ticket query failed:',
  '子任务查找完成，确认、插入和分组功能待实现':
    'Child ticket search completed. Confirmation, insertion, and grouping are not implemented yet.',
  '处理 Epic 展开时出错:': 'Error while expanding Epic:',
  '插入空行失败:': 'Failed to insert empty rows:',

  // Jira and Glip injected UI
  '设计': 'Design',
  '缺少设计稿链接': 'Missing design link',
  '未找到交付设计入口': 'No handoff design entry found',
  '仅过滤非交付链接': 'Only filtered non-handoff links',
  '只读扫描': 'Read-only scan',
  '过滤范围': 'Filter scope',
  '非交付设计工具链接已过滤': 'Non-handoff design-tool links filtered',
  '0 handoff entries': '0 handoff entries',
  '只发现文档、社区、营销、个人页或设置页等设计工具链接；未展示为开发交付入口。':
    'Only documentation, community, marketing, profile, or settings design-tool URLs were found; they are not shown as development handoff entries.',
  '只读扫描，不创建或编辑 Jira 设计链接、issue link 或关联关系。':
    'Read-only scan. Personal AI does not create or edit Jira design links, issue links, or relationships.',
  '过滤范围：只展示可开发交付入口；文档、社区、营销、个人页或设置页不会显示成设计入口，也不会创建或编辑 Jira。':
    'Filter scope: only development handoff entries are shown. Documentation, community, marketing, profile, or settings pages are not shown as design entries, and Personal AI does not create or edit Jira.',
  '恢复范围': 'Recovery scope',
  '这批 UX ticket key 来自非标准页面证据，只是候选关系。':
    'These UX ticket keys came from non-standard page evidence and are candidate relationships only.',
  '只读候选': 'Read-only candidates',
  '恢复范围：这些 UX ticket key 来自 URL query、data-issue-key、ARIA label 或纯文本等非标准页面证据；Personal AI 只保留匹配设计项目配置的 key，并且只展示只读候选，不创建或编辑 Jira issue links、设计字段或关联关系，也不证明这是正式 Jira 关联。':
    'Recovery scope: these UX ticket keys came from non-standard page evidence such as URL query, data-issue-key, ARIA label, or raw text. Personal AI only keeps keys that match the configured design project and shows read-only candidates; it does not create or edit Jira issue links, design fields, or relationships, and it does not prove this is a canonical Jira relationship.',
  '只读恢复': 'Read-only recovered',
  'Personal AI 只展示这个恢复出来的候选 UX ticket；不会创建或编辑 Jira issue links、设计字段或关联关系。':
    'Personal AI only shows this recovered UX ticket candidate. It does not create or edit Jira issue links, design fields, or relationships.',
  '更新时间缺失': 'Updated date missing',
  'Jira/Figma 报告设计已更新，但这个来源没有提供可用更新时间。':
    'Jira/Figma reported this design as updated, but this source did not provide a usable updated time.',
  '状态时间': 'Status time',
  '状态日期': 'Status date',
  '对象时间': 'Object time',
  '对象日期': 'Object date',
  '链接时间': 'Remote link time',
  '链接日期': 'Remote link date',
  '元数据时间': 'Metadata time',
  '元数据日期': 'Metadata date',
  '最新来源': 'Latest source',
  '修复版本': 'Fix Version',
  'Personal AI provided': 'Personal AI provided',
  '复制带链接 ID': 'Copy linked ID',
  '在 JIRA 中打开': 'Open in JIRA',
  '复制 Ticket Summary': 'Copy Ticket Summary',
  '优先级': 'Priority',
  '未设置': 'Unset',
  '经办人': 'Assignee',
  '报告人': 'Reporter',
  '更新时间': 'Updated',
  '截止日期': 'Due Date',
  '组件:': 'Components:',
  '正在获取 Ticket 信息...': 'Fetching ticket information...',
  '无法获取 Ticket 信息': 'Unable to fetch ticket information',
  '请检查网络连接或登录 JIRA': 'Check the network connection or sign in to JIRA',
  '查看原消息': 'View original message',
  '查看详情': 'View details',
  '正在关注后续': 'Watching',
  '原消息摘要': 'Original message summary',
  '关联消息': 'Related messages',
  '关注后续的关联消息': 'Related follow-up message',
  '原消息发送者:': 'Original sender:',
  '关联摘要': 'Related summary',
  '关联': 'Related',
};

const STATIC_UI_TRANSLATIONS_ZH: Record<string, string> = Object.fromEntries(
  Object.entries(STATIC_UI_TRANSLATIONS_EN).map(([zh, en]) => [en, zh]),
);

const TRANSLATABLE_ATTRIBUTES = ['title', 'aria-label', 'placeholder'];
const TEXT_NODE_DENYLIST = new Set([
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
  'CODE',
  'PRE',
]);

function preserveEdgeWhitespace(source: string, translated: string): string {
  const leading = source.match(/^\s*/)?.[0] || '';
  const trailing = source.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function translateStaticText(
  value: string,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string {
  const normalizedLanguage = normalizeUiLanguage(language);
  const compacted = compactText(value);
  if (!compacted) return value;
  const dictionary =
    normalizedLanguage === 'en-US'
      ? STATIC_UI_TRANSLATIONS_EN
      : STATIC_UI_TRANSLATIONS_ZH;
  const translated = dictionary[compacted];
  return translated ? preserveEdgeWhitespace(value, translated) : value;
}

export function translateStaticAttribute(
  value: string | null,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string | null {
  if (value === null) return null;
  return translateStaticText(value, language);
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (TEXT_NODE_DENYLIST.has(parent.tagName)) return true;
  if (parent.closest('[contenteditable="true"], [data-static-i18n-skip]')) {
    return true;
  }
  return false;
}

function applyElementAttributes(element: Element, language: UiLanguage): void {
  for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
    const currentValue = element.getAttribute(attributeName);
    const translatedValue = translateStaticAttribute(currentValue, language);
    if (translatedValue !== null && translatedValue !== currentValue) {
      element.setAttribute(attributeName, translatedValue);
    }
  }
}

function applyNodeTranslation(node: Node, language: UiLanguage): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    if (shouldSkipTextNode(textNode)) return;
    const currentValue = textNode.nodeValue || '';
    const translatedValue = translateStaticText(currentValue, language);
    if (translatedValue !== currentValue) {
      textNode.nodeValue = translatedValue;
    }
    return;
  }

  if (isElement(node)) {
    applyElementAttributes(node, language);
  }
}

export function applyStaticUiTranslations(
  root: ParentNode | null | undefined,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): void {
  if (typeof document === 'undefined') return;
  const target = root || document.body || document.documentElement;
  if (!target) return;
  const doc = target instanceof Document ? target : target.ownerDocument;
  const rootNode = target as unknown as Node;

  if (isElement(rootNode)) {
    applyElementAttributes(rootNode, language);
  }

  const elementRoot =
    target instanceof Document ? target.documentElement : (target as Element);
  elementRoot
    .querySelectorAll?.('*')
    .forEach((element) => applyElementAttributes(element, language));

  const walker = doc.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    applyNodeTranslation(node, language);
    node = walker.nextNode();
  }
}

export function observeStaticUiTranslations(
  root: ParentNode | null | undefined,
  getLanguage: () => UiLanguage,
): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => undefined;
  }
  const target = root || document.body || document.documentElement;
  if (!target) return () => undefined;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        applyNodeTranslation(record.target, getLanguage());
        continue;
      }
      if (record.type === 'attributes') {
        applyNodeTranslation(record.target, getLanguage());
        continue;
      }
      record.addedNodes.forEach((node) => {
        applyStaticUiTranslations(node as unknown as ParentNode, getLanguage());
      });
    }
  });
  observer.observe(target, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRIBUTES,
  });
  applyStaticUiTranslations(target, getLanguage());
  return () => observer.disconnect();
}
