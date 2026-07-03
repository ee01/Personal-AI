# Feature Index

*最后更新: 2026-06-25*

这份索引只负责导航和规划。各功能的真实行为仍以对应功能文档为准。

## 第一批中英术语

| English | 中文 |
|---|---|
| Today Pilot | 今天 |
| Compose Assist | 回复助手 |
| Native Join | NC 加会 |
| Project Dashboard | 项目面板 |
| Memory Lens | 记忆提示 |
| Relationship Radar | 人脉关系 |
| Jira Design Links | JIRA 设计稿 |
| Doubao Bridge | 豆包互联 |
| Skill Foundry | 技能库 |

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
| 四通道召回 | Memory Service | [memory_system.md](./memory_system.md) | Vector / FTS / Graph / Time；搜索页显示召回通道回执 |
| 场景记忆自动驾驶 | Memory Service / Memory Lens | [memory_system.md](./memory_system.md) / [memory_lens.md](./memory_lens.md) | `/context-recall` 展示前过滤，决定 silent / chip / card / context_pack；Lens 卡片显示展示前过滤回执 |
| Ask 主动问答 | Memory Service | [ask.md](./ask.md) | 主动问答入口，覆盖话题锁定、召回优先级、Ask 本轮状态、证据缺口和活答案沉淀 |
| Ask 短问句话题锁定 | Memory Service | [ask.md](./ask.md) | Ask 前置匹配当前话题、角色词、source anchors 和高频互动记忆 |
| Ask 活答案记忆 | Memory Service | [ask.md](./ask.md) | 重复 locked topic 问题首问 observation、二问 promote、后续 priorHit / updated |
| 证据守望契约 | Memory Service | [evidence_watch_contracts.md](./evidence_watch_contracts.md) | 可变化事实进入 contract；Ask/Reflection/Action Queue 复用同一守望对象并抑制重复查证 |
| 工作/个人/全部范围语义 | Memory Service | [memory_system.md](./memory_system.md) | `/recall`、`/ask`、被动召回共用；搜索入口先显示范围意图回执 |
| 记忆搜索结果页 | Memory Exploring | [memory_system.md](./memory_system.md) | `SearchResultPage.vue`；类型筛选按钮预览可见/隐藏数量，回执说明本地无写入边界 |
| 搜索结果有用/不相关反馈 | Memory Exploring | [memory_system.md](./memory_system.md) | `/feedback`，按 target type 记录 |
| 记忆时间轴 | Memory Exploring | [memory_system.md](./memory_system.md) | `TimelinePage.vue`，基于 recall time 通道，含范围/来源/刷新快照回执 |
| 时间轴/搜索安全跳转 | Memory Exploring | [memory_system.md](./memory_system.md) | 只接受安全内部路由和无凭据 http(s) 来源链接，并显示打开/拦截回执 |
| 记忆覆盖地图 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | `memory-exploring.html#/coverage`，查看各平台记忆覆盖状态 |
| 覆盖聚合 API | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | `/coverage/map` 与带只读诊断回执的 P0 切片接口 |
| 智能资料录入 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 粘贴/文档/普通 zip 先显示范围回执，dry-run 后才可写入 shadow memory |
| 外部 AI 历史基础录入 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 用户主动上传 ChatGPT / Claude `conversations.json` zip |
| Coverage 质量分 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 平台状态、新鲜度和健康贡献项计算 `qualityScore` |
| 备份下载与恢复入口 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | Coverage 页面下载前/下载后都有边界回执，抽屉内识别备份 zip 并 merge/replace |
| 记忆捕捉 | Memory Capture | [memory_capture.md](./memory_capture.md) | 选区/网页/外部输入的低打扰入库层 |
| 选中文字保存为资料记忆 | Memory Capture | [memory_capture.md](./memory_capture.md) | 右侧半露出 `+ 入库`，保存 `source_memory_capsule` 和 `web` 记忆信号 |
| 整页资料保存 | Memory Capture | [memory_capture.md](./memory_capture.md) | 复制、深度滚动或停留信号后显示右侧半露出 `+ 入库`；高置信时自动保存，并可查看详情或撤销 |
| Source Memory 召回卡片 | Memory Capture / Memory Lens | [memory_capture.md](./memory_capture.md) | `/context-recall` 支持 `sourceTypes:['source_memory']`，返回资料记忆卡 |
| Source Memory 蒸馏器 | Memory Capture | [memory_capture.md](./memory_capture.md) | 保存/补备注后蒸馏 ready cue、compact memo、trigger matcher、低副作用 links，并在详情页展示 policy receipt |
| Memory Capture API | Memory Capture | [memory_capture.md](./memory_capture.md) | `/source-memory/candidates/*` 与 `/source-memory/capsules`；保存/详情返回写入与召回信号回执 |
| 记忆导入/导出/备份 | Memory Service | [memory_system.md](./memory_system.md) | `/import`、`/export`、backup 验证脚本 |
| 多用户隔离 | Memory Service | [memory_system.md](./memory_system.md) | per-user SQLite DB、身份来源和 default fallback 写入边界 |
| 用户画像条目 | User Profile | [user_profile_system.md](./user_profile_system.md) | Profile item 管理、展示、手动录入与等待服务确认回执 |
| 用户画像导出 | User Profile | [user_profile_system.md](./user_profile_system.md) | 导出前检查单、manifest 指纹、全状态分页与下载后回执；`tools/verify-user-profile-export-e2e.mjs` 覆盖 |
| 画像快速增强/降低影响 | User Profile | [user_profile_system.md](./user_profile_system.md) | 显式 importance 调整，含进行中/失败/部分确认回执 |
| 自定义消息分析提示词 | Prompt Config | [custom_prompts.md](./custom_prompts.md) | `prompt-config.html`，风险提示词暂停注入时仍需保存前确认，拦截后显示恢复回执 |
| 用户上下文注入 | Prompt Config | [custom_prompts.md](./custom_prompts.md) | 用户偏好/上下文预览、范围总览与开关 |
| 自我反思线程 | Memory Service | [memory_system.md](./memory_system.md) | `ReflectionThreadService` 与 UI 线程页；列表显示查看范围，详情页显示手动反思 / 暂停 / 恢复 / 关闭的操作范围回执 |
| 反思本地研究补查 | Memory Service | [memory_system.md](./memory_system.md) | 反思 run 内查询本地记忆和派生证据；详情页显示本轮研究范围和 trace |
| 未来场景预演记忆 | Rehearsal | [rehearsal.md](./rehearsal.md) | 以后遇到某个可识别场景时，提醒用户该想起、说或做什么；不是事实层或弱联想 |
| 场景预演边界 | Rehearsal | [rehearsal.md](./rehearsal.md) | 场景类型开放；详情页先用场景资格总览确认 future cue、现场提示资格和不自动执行边界 |
| Rehearsal 管理页 | Memory Exploring | [rehearsal.md](./rehearsal.md) | `memory-exploring.html#/rehearsals`，用于审计和修正 |
| 动作队列 | Memory Service | [memory_system.md](./memory_system.md) | `ActionQueue.vue` / `proposed_actions`；普通动作显示执行范围回执 |
| OpenClaw 外部委派 | Memory Service | [memory_system.md](./memory_system.md) | `delegate_openclaw` action |
| 决策中心 | Memory Service | [memory_system.md](./memory_system.md) | `DecisionCenter.vue` / `confirm_requests`；通知深链未命中显示已读队列与部分失败口径 |
| 主动询问 | Memory Service | [memory_system.md](./memory_system.md) | `OutreachEngine`，问外部人/群组；详情操作回执区分确认、外发和回复边界 |
| 主动询问会话管理 | Memory Exploring | [memory_system.md](./memory_system.md) | `OutreachSessions.vue` / `OutreachSessionDetail.vue`，含本页优先级、本轮处理对象、会话推进和发送前复核回执 |
| 通知提醒与免打扰路径 | Memory Service | [memory_system.md](./memory_system.md) | `notification_records`，snooze 保留来源、回提醒上下文和操作边界回执 |
| 梦境重放 | Memory Service | [memory_system.md](./memory_system.md) | `DreamInsights.vue` / `dreams/*.md`，含本页范围与只读边界回执 |
| 周报与梦境摘要推送 | Notification Center | [notification_center.md](./notification_center.md) | provider digest / notice lane；Options 手动触发后显示生成、通知写入、Bot 投递和目标边界回执 |
| Notification Center feed | Notification Center | [notification_center.md](./notification_center.md) | `GET /notification-center/feed` |
| 渠道投递回执 | Notification Center | [notification_center.md](./notification_center.md) | chrome / doubao / glip delivery records；系统通知显示失败原因和有效状态边界 |
| DigestQueueService 本地摘要 | Notification Center | [notification_center.md](./notification_center.md) | extension 本地低打扰摘要队列；popup 显示本地延迟、不立即发送/写入/确认边界 |
| 记忆入口规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 手动规则、系统观察规则和手动立即分析范围回执 |
| 手动关注项规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 用户可编辑的关注规则 |
| 系统观察规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 自我反思、主动询问等证据采集 |
| 规则范围校验 | Message Analysis | [message_analysis.md](./message_analysis.md) | 发送人、群组、时间、过期状态和系统观察上下文；规则页显示范围执行回执 |
| 消息入库与通知分发 | Message Analysis | [message_analysis.md](./message_analysis.md) | 普通 filter / Agent Thinking / Agent Workflow 共用；规则页与后台调度状态显示本轮分发回执 |
| 联动操作 / Openclaw | Message Reaction | [message_reaction.md](./message_reaction.md) | 预填记忆入口规则、保存前执行预览和后续动作 |
| 稍后处理 / Remind | Message Reaction | [message_reaction.md](./message_reaction.md) | RingCentral 消息提醒 |
| Snooze 快速时间菜单 | Message Reaction | [message_reaction.md](./message_reaction.md) | 15/30 分钟、1/2/3 小时、工作日等；已有 Snooze 时先显示改期预告 |
| Snooze 去重与撤销 | Message Reaction | [message_reaction.md](./message_reaction.md) | 同源 pending 保护、toast actions |
| 关注后续 / Watch | Message Reaction | [message_reaction.md](./message_reaction.md) | 持续追踪后续讨论，保存前/保存后显示监听范围、期限、匹配和索引边界 |
| 跟进追问 / Followup | Message Reaction | [message_reaction.md](./message_reaction.md) | 自己发出的消息创建一次性 Outreach session；提交中/成功/复用状态都说明未立即发送 |
| 自动答复 / Reply | Message Reaction | [message_reaction.md](./message_reaction.md) | 回复规则、命中范围、AI 失败 fallback 和审核/队列边界 |
| Glip AI 标注 | Message Reaction | [message_reaction.md](./message_reaction.md) | follow / snooze / outreach / scheduled markers；tooltip 显示来源、缓存刷新、本地快照、状态口径和下一步复核路径 |
| 消息交互工具栏 | Message Reaction | [message_reaction.md](./message_reaction.md) | RingCentral 消息 hover 工具栏；齿轮设置显示本地入口开关边界 |
| 主题式未读阅读 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 首页、主题列表、主题详情；详情页显示阅读批次与已读写入边界 |
| 主题稍后处理 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 本地 defer 状态 |
| 主题静音 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 本地 mute 状态与静音边界回执 |
| 主题详情深链定位 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | `?messageId=` 定位并高亮，兼容来源 permalink / Slack timestamp 别名 |
| Topic 来源链接安全展示 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 只展示可信 http(s)，打开/隐藏都有回执 |
| 定时消息一键初始化 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet、Apps Script、触发器 |
| 定时消息创建/编辑/删除 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Messages 表驱动 |
| 多执行引擎 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | AsMe / Bot / AI Report / JiraAutomation |
| 定时消息列表筛选 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Active / Done / Snooze 等 |
| 队列健康提示 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 队列风险、诊断线索和恢复入口 |
| 执行匹配与补偿窗口 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 当前分钟、过去 30 分钟、8:00 后队列 |
| 队列可视化与改期建议 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 拥挤槽位、建议依据、建议处理对象 |
| Timeline 缓存与 Jira Milestone | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Jira JSON/Groovy Map 兼容、诊断范围回执和 dry-run 排障 |
| 定时消息配置同步 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet Config 与本地 storage 同步 |
| App Script 自动更新 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | deployments.update、版本探测、项目归属预检 |
| Task Scheduler 状态 API | Task Scheduler | [task_scheduler_api.md](./task_scheduler_api.md) | 任务启停、状态、刷新确认和操作范围 |
| Agent Thinking 分析编排 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | 通用工具/思考循环 |
| Agent Thinking 工具审批 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | 阻断、审批前确认、结果区定位、批准 key、重跑配置 |
| Agent Thinking trace 可视化 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | Options 演示、Trace 复核路线与复制反馈 |
| Agent Workflow 多 Agent 编排 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | 标准消息入口 workflow；低置信度复核显示本地候选边界 |
| Agent Workflow 关注项测试 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | 内置样例、最近消息、本地保存样例；测试区先显示运行前范围、本地门禁资格和无副作用边界 |
| Agent Workflow 运行诊断 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | trace / storageReview / readiness；工具错误显示 Agent / Tool 定位 |
| 今天 Mission | Today Pilot | [today_pilot.md](./today_pilot.md) | 首页 mission card |
| 高压后补课 | Today Pilot | [today_pilot.md](./today_pilot.md) | `/today-pilot/catch-up` 只读快照；首页显示高优变化和等你回 |
| 今天排序与噪声控制 | Today Pilot | [today_pilot.md](./today_pilot.md) | `DayPilotService`；筛选口径按当前可见卡片更新 |
| 今日预演提示 | Today Pilot | [rehearsal.md](./rehearsal.md) | active/stale Rehearsal 进入今日和会前 cue |
| 会前准备 | Today Pilot | [today_pilot.md](./today_pilot.md) | calendar events / meeting prep；回执区分高置信记忆、基础背景、本机 handoff 和刷新补课结果边界 |
| Storyline 会前提示 | Today Pilot / Memory Storyline Builder | [today_pilot.md](./today_pilot.md) / [memory_storyline_builder.md](./memory_storyline_builder.md) | meeting prep LLM 判定后在摘要和 cue cards 之间提示 |
| Storyline Draft 页面 | Memory Storyline Builder | [memory_storyline_builder.md](./memory_storyline_builder.md) | `memory-exploring.html#/storylines/draft`，复核段落、证据、风险和可复制 artifact |
| Storyline Draft API | Memory Storyline Builder | [memory_storyline_builder.md](./memory_storyline_builder.md) | `POST /api/v1/storylines/draft`，基于 meeting prep 生成草稿并返回生成范围回执 |
| Meeting Pilot handoff | Today Pilot | [today_pilot.md](./today_pilot.md) | 从今日简报进入会议能力；Meeting Pilot 显示匹配方式、缓存年龄和剩余有效期回执 |
| Popup Top 3 | Today Pilot | [today_pilot.md](./today_pilot.md) | Chrome popup 今日摘要 |
| Context Pack | Today Pilot | [today_pilot.md](./today_pilot.md) | 可复制的上下文包 |
| 回复助手草稿辅助 | Compose Assist | [compose_assist.md](./compose_assist.md) | 输入框旁 AI 辅助 |
| 回复助手来源适配 | Compose Assist | [compose_assist.md](./compose_assist.md) | RingCentral / Jira / Web AI；来源路由显示适配边界和重算口径 |
| 回复助手预演提醒 | Compose Assist | [rehearsal.md](./rehearsal.md) | `sourceTypes` 包含 `rehearsal` 时作为预演 evidence；复核态显示命中线索、提示资格和插入边界 |
| 回复助手直接插入 | Compose Assist | [compose_assist.md](./compose_assist.md) | hover 只预览正文，点击 icon 直接插入 |
| 回复助手阈值与反馈 | Compose Assist | [compose_assist.md](./compose_assist.md) | 自适应展示、thumb-down 调阈保存回执 |
| 回复助手无感校准 | Memory System / Compose Assist | [memory_system.md](./memory_system.md) / [compose_assist.md](./compose_assist.md) | 插入、改写、发送、hover 未用和 thumb-down 生成 redacted trace |
| 场景记忆自动驾驶 eval | Memory Lens / Compose Assist | [memory_lens.md](./memory_lens.md) | compose 群聊、网页/文档、空会议、跨域噪音和重复来源合并 |
| 记忆提示右下角关联记忆 | Memory Lens | [memory_lens.md](./memory_lens.md) | 当前网页/消息/Jira/会议上下文被动召回 |
| 记忆提示 Hover Peek | Memory Lens | [memory_lens.md](./memory_lens.md) | hover/focus 轻预览 |
| 记忆提示 Expanded Card | Memory Lens | [memory_lens.md](./memory_lens.md) | 完整卡片、反馈、来源 |
| 记忆提示预演提醒 | Memory Lens | [rehearsal.md](./rehearsal.md) | 当前网页/会话/issue 命中 Rehearsal 时低打扰展示 |
| 划词查找关联记忆 | Memory Lens | [memory_lens.md](./memory_lens.md) | selected_text context recall |
| 站点静默/屏蔽/白名单 | Memory Lens | [memory_lens.md](./memory_lens.md) | 本地 storage 控制 |
| 人脉关系人物雷达 | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | 首屏显示当前范围、优先人物、数据质量和写入边界回执 |
| 人脉关系 Context Card | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/context-card` |
| 人脉关系 Meeting Brief | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | 会前人物摘要、覆盖检查、会前焦点与 `/relationships/meeting-brief` |
| 人脉关系 Assistant Draft | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/assistant/draft` |
| 人脉关系 Review Queue | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | confirm / reject / snooze |
| 项目面板 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 项目概览、任务、里程碑 |
| 项目本地查找 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 在当前浏览器本地快照内查找项目、任务、Jira、平台来源和里程碑 |
| 项目数据源检查 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | Jira/GitHub/Confluence 状态、缺口、检查口径与 warning 状态 |
| Memory Service watched projects 补齐 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | 只补齐本地，不反写 Memory Service |
| 项目证据修复路径 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | ETA、Jira、平台状态缺口 |
| 甘特图 / 依赖图 / 燃尽图 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 本地图表概览，燃尽/完成标明任务数口径 |
| Meeting Pilot 捕获 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | 用户主动开始 capture |
| 会议页嵌入入口 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | RingCentral meeting content script |
| 会中提醒 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | shared screen / speaker / action signals |
| 会中 side panel | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | `meeting-sidepanel.html` |
| 会后 Panorama | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | 会议时间线、行动项、决策和输出范围回执 |
| 会议历史归档 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | `MeetingHistoryPage.vue`，卡片展示 Panorama/PDF 打开范围与只读边界 |
| 分层 ASR | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | Web Speech / cloud / desktop local |
| Desktop Local ASR / Whisper fallback | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | desktop app local ASR chain；Whisper 可作为 final fallback |
| NC 加会 | Native Join | [meeting_native_join.md](./meeting_native_join.md) | Web meeting 链接转 native app |
| NC 加会浏览器回退 | Native Join | [meeting_native_join.md](./meeting_native_join.md) | 默认浏览器、复制完整链接、Meeting ID 手动输入边界、规范化 app 重试和 fallback UI |
| Google Slides 项目分析器 | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | Slides 分析与建议，含范围判定回执 |
| Slides 写回预览 | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | 字段证据、风险提示和提交中锁定回执 |
| Slides partial success skipped reasons | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | 跳过/缺失原因保留，可重选已匹配跳过字段 |
| JIRA 设计稿检测 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | Description / Remote Links / Designs；只有非交付设计工具 URL 时显示过滤和只读扫描回执 |
| Figma/Zeplin 保守分类 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | 排除 marketing/community/profile/settings 假阳性，混合结果首屏显示过滤范围回执 |
| 设计链接更新时间展示 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | newest updated date and visible time-basis chip |
| Jira issue key 解析 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | raw text fallback 与只读恢复回执 |
| Jira 自动化规则导入 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | 导入预览与创建；首屏显示 create request scope |
| 高风险导入提示 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | 不强制勾选确认；可直接创建 disabled copy；复制复核包只是本机剪贴板 handoff |
| secret value 脱敏 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | `secret=true`、signed URL、function/API gateway query 凭据不展示 raw value |
| 豆包互联 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 本机 Desktop App 双向记忆流 |
| Memory Sync Thread | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 长期稳定记忆线程 |
| Mobile Context Thread | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 近期重点、提醒、Quick Ask 答案发送范围回执 |
| Persona / 近期重点 / 提醒推送 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 随手记导向格式；手动推送即时显示 package、条目、来源、线程与验证回执 |
| Doubao / ChatGPT explorer 输入链路 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 抓取外部 AI 会话并回写 Memory Service；未保存来源设置会先显示输入范围回执 |
| Revoke ingested memory | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 删除按来源写入的 Memory Service 记忆 |
| Quick Ask 小窗 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | menubar 默认入口 |
| Quick Ask 语音输入 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | native speech helper；停止/空转写回执 |
| Quick Ask 状态卡 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | sync issue / pending outreach 等状态 |
| 技能库技能建议 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | suggestion inbox |
| 技能使用/丢弃/稍后审 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | suggestion 决策总览与使用/丢弃/稍后审状态机 |
| Public Skill URL | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | tokenized read-only share；复制后显示剪贴板/无副作用回执 |
| 平台同步 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | OpenClaw / Desktop App / manual-only；平台开关保存回执 |
| 本地 agent skill 导入建议 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | 外部变更先进入 suggestion |

## 后续维护规则

1. 新功能如果有独立用户入口、独立后端 route 或独立 verify script，应在本索引新增一行。
2. 如果同一功能已经有主文档，只新增小功能行，不新增平级主文档。
3. 如果发现 `docs/features` 里出现 implementation summary、quick guide、legacy plan 或规则类 `.mdc`，先把仍有效内容并入主功能文档或 `AGENT.md`，再删除原文件。
4. 若一个 `docs/progressing/*.md` 规划已经落地到源码，迁入 `docs/features` 或在现有主文档补齐后，再从本索引引用。
5. 主功能文档不能只列功能点；应在前部保留大白话运行逻辑、主要影响因素和必要实现/门控/数据来源逻辑，详细标准见 [`AGENT.md`](../../AGENT.md)。
