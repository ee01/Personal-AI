# Feature Index

*最后更新: 2026-05-22*

这份索引只负责导航和规划。各功能的真实行为仍以对应功能文档为准。

## 索引规则

- 一行只放一个用户可感知的小功能点或可独立验证的子能力。
- `所在文档` 指当前 source of truth；不再把历史兼容入口或过渡文档列入索引。
- `.mdc` 文件只作为 agent / prompt / 运行规则，不作为产品主文档。
- `docs/progressing` 里的 plan 只有在被迁入本目录后才算当前功能文档。
- 新增或大改功能时，应同步更新本索引；如果只是实现总结、排障 quick guide 或旧方案，优先挂到已有主功能文档下面，不再平铺成新的主功能。

## 小功能点索引

| 小功能点 | 所属能力 | 所在文档 | 说明 |
|---|---|---|---|
| 记忆摄入、去重、显著性评估 | Memory Service | [memory_system.md](./memory_system.md) | `IngestionPipeline` / `SalienceScorer` |
| 四通道召回 | Memory Service | [memory_system.md](./memory_system.md) | Vector / FTS / Graph / Time |
| 工作/个人/全部范围语义 | Memory Service | [memory_system.md](./memory_system.md) | `/recall`、`/ask`、被动召回共用 |
| 记忆搜索结果页 | Memory Exploring | [memory_system.md](./memory_system.md) | `SearchResultPage.vue` |
| 搜索结果有用/不相关反馈 | Memory Exploring | [memory_system.md](./memory_system.md) | `/feedback`，按 target type 记录 |
| 记忆时间轴 | Memory Exploring | [memory_system.md](./memory_system.md) | `TimelinePage.vue`，基于 recall time 通道 |
| 时间轴/搜索安全跳转 | Memory Exploring | [memory_system.md](./memory_system.md) | 只接受安全内部路由和 http(s) 来源链接 |
| 记忆覆盖地图 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | `memory-exploring.html#/coverage`，查看各平台记忆覆盖状态 |
| 覆盖聚合 API | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | `/coverage/map` 与 P0 切片接口 |
| 智能资料录入 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 粘贴/文档/普通 zip dry-run 后写入 shadow memory |
| 外部 AI 历史基础录入 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 用户主动上传 ChatGPT / Claude `conversations.json` zip |
| Coverage 质量分 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 平台状态、新鲜度和健康贡献项计算 `qualityScore` |
| 备份下载与恢复入口 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | Coverage 页面直接下载 zip，抽屉内识别备份 zip 并 merge/replace |
| 记忆导入/导出/备份 | Memory Service | [memory_system.md](./memory_system.md) | `/import`、`/export`、backup 验证脚本 |
| 多用户隔离 | Memory Service | [memory_system.md](./memory_system.md) | per-user SQLite DB |
| 用户画像条目 | User Profile | [user_profile_system.md](./user_profile_system.md) | Profile item 管理与展示 |
| 用户画像导出 | User Profile | [user_profile_system.md](./user_profile_system.md) | `tools/verify-user-profile-export-e2e.mjs` 覆盖 |
| 画像快速增强/降低影响 | User Profile | [user_profile_system.md](./user_profile_system.md) | 显式 importance 调整 |
| 自定义消息分析提示词 | Prompt Config | [custom_prompts.md](./custom_prompts.md) | `prompt-config.html` |
| 用户上下文注入 | Prompt Config | [custom_prompts.md](./custom_prompts.md) | 用户偏好/上下文预览与开关 |
| 自我反思线程 | Memory Service | [memory_system.md](./memory_system.md) | `ReflectionThreadService` 与 UI 线程页 |
| 反思本地研究补查 | Memory Service | [memory_system.md](./memory_system.md) | 反思 run 内查询本地记忆 |
| 未来场景预演记忆 | Rehearsal | [rehearsal.md](./rehearsal.md) | `rehearsals` / `rehearsal_activations`，通过 `/context-recall` 场景触发 |
| Rehearsal 管理页 | Memory Exploring | [rehearsal.md](./rehearsal.md) | `memory-exploring.html#/rehearsals`，用于审计和修正 |
| 动作队列 | Memory Service | [memory_system.md](./memory_system.md) | `ActionQueue.vue` / `proposed_actions` |
| OpenClaw 外部委派 | Memory Service | [memory_system.md](./memory_system.md) | `delegate_openclaw` action |
| 决策中心 | Memory Service | [memory_system.md](./memory_system.md) | `DecisionCenter.vue` / `confirm_requests` |
| 主动询问 | Memory Service | [memory_system.md](./memory_system.md) | `OutreachEngine`，问外部人/群组 |
| 主动询问会话管理 | Memory Exploring | [memory_system.md](./memory_system.md) | `OutreachSessions.vue` |
| 通知提醒与免打扰路径 | Memory Service | [memory_system.md](./memory_system.md) | `notification_records`，可 snooze |
| 梦境重放 | Memory Service | [memory_system.md](./memory_system.md) | `DreamInsights.vue` / `dreams/*.md` |
| 周报与梦境摘要推送 | Notification Center | [notification_center.md](./notification_center.md) | provider digest / notice lane |
| Notification Center feed | Notification Center | [notification_center.md](./notification_center.md) | `GET /notification-center/feed` |
| 渠道投递回执 | Notification Center | [notification_center.md](./notification_center.md) | chrome / doubao / glip delivery records |
| DigestQueueService 本地摘要 | Notification Center | [notification_center.md](./notification_center.md) | extension 本地低打扰摘要队列 |
| 记忆入口规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 手动规则与系统观察规则的统一运行时视图 |
| 手动关注项规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 用户可编辑的关注规则 |
| 系统观察规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 自我反思、主动询问等证据采集 |
| 规则范围校验 | Message Analysis | [message_analysis.md](./message_analysis.md) | 发送人、群组、上下文范围 |
| 消息入库与通知分发 | Message Analysis | [message_analysis.md](./message_analysis.md) | 普通 filter / Agent Thinking / Agent Workflow 共用 |
| 联动操作 | Message Reaction | [message_reaction.md](./message_reaction.md) | 预填记忆入口规则和后续动作 |
| 稍后处理 | Message Reaction | [message_reaction.md](./message_reaction.md) | RingCentral 消息 Snooze |
| Snooze 快速时间菜单 | Message Reaction | [message_reaction.md](./message_reaction.md) | 15/30 分钟、1/2/3 小时、工作日等 |
| Snooze 去重与撤销 | Message Reaction | [message_reaction.md](./message_reaction.md) | 同源 pending 保护、toast actions |
| 关注后续 | Message Reaction | [message_reaction.md](./message_reaction.md) | Follow Thread |
| 跟进追问 | Message Reaction | [message_reaction.md](./message_reaction.md) | 自己发出的消息创建一次性 Outreach session |
| 自动答复 | Message Reaction | [message_reaction.md](./message_reaction.md) | Auto Reply 规则和审核模式 |
| Glip AI 标注 | Message Reaction | [message_reaction.md](./message_reaction.md) | follow / snooze / outreach / scheduled markers |
| 消息交互工具栏 | Message Reaction | [message_reaction.md](./message_reaction.md) | RingCentral 消息 hover 工具栏 |
| 主题式未读阅读 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 首页、主题列表、主题详情 |
| 主题稍后处理 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 本地 defer 状态 |
| 主题静音 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 本地 mute 状态 |
| 主题详情深链定位 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | `?messageId=` 定位并高亮 |
| Topic 来源链接安全展示 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 只展示可信 http(s) |
| 定时消息一键初始化 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet、Apps Script、触发器 |
| 定时消息创建/编辑/删除 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Messages 表驱动 |
| 多执行引擎 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | AsMe / Bot / AI Report / JiraAutomation |
| 定时消息列表筛选 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Active / Done / Snooze 等 |
| 队列健康提示 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 队列风险、恢复入口 |
| 执行匹配与补偿窗口 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 当前分钟、过去 30 分钟、8:00 后队列 |
| 队列可视化与改期建议 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 拥挤槽位、建议处理对象 |
| Timeline 缓存与 Jira Milestone | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Jira JSON/Groovy Map 兼容、dry-run 排障 |
| 定时消息配置同步 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet Config 与本地 storage 同步 |
| App Script 自动更新 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | deployments.update、版本探测、项目归属预检 |
| Task Scheduler 状态 API | Task Scheduler | [task_scheduler_api.md](./task_scheduler_api.md) | 任务启停、状态、过滤 |
| Agent Thinking 分析编排 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | 通用工具/思考循环 |
| Agent Thinking 工具审批 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | 阻断、批准 key、重跑配置 |
| Agent Thinking trace 可视化 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | Options 演示与复制反馈 |
| Agent Workflow 多 Agent 编排 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | 标准消息入口 workflow |
| Agent Workflow 关注项测试 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | 内置样例、最近消息、本地保存样例 |
| Agent Workflow 运行诊断 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | trace / storageReview / readiness |
| Today Pilot 今日 Mission | Today Pilot | [today_pilot.md](./today_pilot.md) | 首页 mission card |
| Day Pilot 排序与噪声控制 | Today Pilot | [today_pilot.md](./today_pilot.md) | `DayPilotService` |
| 今日预演提示 | Today Pilot | [rehearsal.md](./rehearsal.md) | active/stale Rehearsal 进入今日和会前 cue |
| 会前准备 | Today Pilot | [today_pilot.md](./today_pilot.md) | calendar events / meeting prep |
| Meeting Pilot handoff | Today Pilot | [today_pilot.md](./today_pilot.md) | 从今日简报进入会议能力 |
| Popup Top 3 | Today Pilot | [today_pilot.md](./today_pilot.md) | Chrome popup 今日摘要 |
| Context Pack | Today Pilot | [today_pilot.md](./today_pilot.md) | 可复制的上下文包 |
| Compose Assist 草稿辅助 | Compose Assist | [compose_assist.md](./compose_assist.md) | 输入框旁 AI 辅助 |
| Compose Assist 来源适配 | Compose Assist | [compose_assist.md](./compose_assist.md) | RingCentral / Jira / Web AI |
| Compose Assist 预演提醒 | Compose Assist | [rehearsal.md](./rehearsal.md) | `sourceTypes` 包含 `rehearsal` 时作为高优先级预演 evidence |
| Compose Assist 直接插入 | Compose Assist | [compose_assist.md](./compose_assist.md) | hover 只预览正文，点击 icon 直接插入 |
| Compose Assist 阈值与反馈 | Compose Assist | [compose_assist.md](./compose_assist.md) | 自适应展示 |
| Memory Lens 右下角关联记忆 | Memory Lens | [memory_lens.md](./memory_lens.md) | 当前网页/消息/Jira/会议上下文被动召回 |
| Memory Lens Hover Peek | Memory Lens | [memory_lens.md](./memory_lens.md) | hover/focus 轻预览 |
| Memory Lens Expanded Card | Memory Lens | [memory_lens.md](./memory_lens.md) | 完整卡片、反馈、来源 |
| Memory Lens 预演提醒 | Memory Lens | [rehearsal.md](./rehearsal.md) | 当前网页/会话/issue 命中 Rehearsal 时低打扰展示 |
| 划词查找关联记忆 | Memory Lens | [memory_lens.md](./memory_lens.md) | selected_text context recall |
| 站点静默/屏蔽/白名单 | Memory Lens | [memory_lens.md](./memory_lens.md) | 本地 storage 控制 |
| Relationship Radar 人物雷达 | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | 本次补齐的主功能文档 |
| Relationship Context Card | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/context-card` |
| Relationship Meeting Brief | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/meeting-brief` |
| Relationship Assistant Draft | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/assistant/draft` |
| Relationship Review Queue | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | confirm / reject / snooze |
| Project Dashboard 工作台 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 项目概览、任务、里程碑 |
| 项目数据源检查 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | Jira/GitHub/Confluence 状态与缺口 |
| Memory Service watched projects 补齐 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | 只补齐本地，不反写 Memory Service |
| 项目证据修复路径 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | ETA、Jira、平台状态缺口 |
| 甘特图 / 依赖图 / 燃尽图 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 仪表盘图表 |
| Meeting Pilot 捕获 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | 用户主动开始 capture |
| 会议页嵌入入口 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | RingCentral meeting content script |
| 会中提醒 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | shared screen / speaker / action signals |
| 会中 side panel | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | `meeting-sidepanel.html` |
| 会后 Panorama | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | 会议时间线、行动项、决策 |
| 会议历史归档 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | `MeetingHistoryPage.vue` |
| 分层 ASR | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | Web Speech / cloud / desktop local |
| Desktop Local Whisper | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | desktop app / whisper server |
| RingCentral Native Join | Native Join | [meeting_native_join.md](./meeting_native_join.md) | Web meeting 链接转 native app |
| Native Join 浏览器回退 | Native Join | [meeting_native_join.md](./meeting_native_join.md) | 默认浏览器、复制链接、fallback UI |
| Google Slides 项目分析器 | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | Slides 分析与建议 |
| Slides 写回预览 | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | 字段证据和风险提示 |
| Slides partial success skipped reasons | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | 跳过原因保留 |
| Jira 设计链接检测 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | Description / Remote Links / Designs |
| Figma/Zeplin 保守分类 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | 排除 marketing/community 假阳性 |
| 设计链接更新时间展示 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | newest updated date |
| Jira issue key 解析 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | raw text fallback |
| Jira 自动化规则导入 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | 导入预览与创建 |
| 高风险导入确认 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | 未确认前禁用导入 |
| secret value 脱敏 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | `secret=true` 不展示 raw value |
| Doubao Desktop Bridge | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 本机 Desktop App 双向记忆流 |
| Memory Sync Thread | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 长期稳定记忆线程 |
| Mobile Context Thread | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 近期重点、提醒、查询答案线程 |
| Persona / 近期重点 / 提醒推送 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 随手记导向格式 |
| Doubao / ChatGPT explorer 输入链路 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 抓取外部 AI 会话并回写 Memory Service |
| Revoke ingested memory | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 删除按来源写入的 Memory Service 记忆 |
| Quick Ask 小窗 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | menubar 默认入口 |
| Quick Ask 语音输入 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | native speech helper |
| Quick Ask 状态卡 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | sync issue / pending outreach 等状态 |
| Personal Skill Foundry 技能建议 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | suggestion inbox |
| 技能使用/丢弃/稍后审 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | suggestion 状态机 |
| Public Skill URL | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | tokenized read-only share |
| 平台同步 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | OpenClaw / Desktop App / manual-only |
| 本地 agent skill 导入建议 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | 外部变更先进入 suggestion |

## 后续维护规则

1. 新功能如果有独立用户入口、独立后端 route 或独立 verify script，应在本索引新增一行。
2. 如果同一功能已经有主文档，只新增小功能行，不新增平级主文档。
3. 如果发现 `docs/features` 里出现 implementation summary、quick guide、legacy plan 或规则类 `.mdc`，先把仍有效内容并入主功能文档或 `AGENT.md`，再删除原文件。
4. 若一个 `docs/progressing/*.md` 规划已经落地到源码，迁入 `docs/features` 或在现有主文档补齐后，再从本索引引用。
5. 主功能文档不能只列功能点；应在前部保留大白话运行逻辑、主要影响因素和必要实现/门控/数据来源逻辑，详细标准见 [`AGENT.md`](../../AGENT.md)。
