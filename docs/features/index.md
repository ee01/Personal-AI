# Feature Index

*最后更新: 2026-07-31*

这份索引只负责导航和规划。各功能的真实行为仍以对应功能文档为准。

## 第一批中英术语

| English | 中文 |
|---|---|
| Today Pilot | 今天 |
| Compose Assist | 回复助手 |
| Native Join | NC 加会 |
| Project Dashboard | 项目面板 |
| Personal Roadmap | 项目 Roadmap |
| Memory Lens | 记忆提示 |
| Personal AI AR Data | AR 数据 |
| Relationship Radar | 人脉关系 |
| Jira Design Links | JIRA 设计稿 |
| Doubao Bridge | 豆包互联 |
| Skill Foundry | 技能库 |
| Change Memory Ledger | 变化脉络 |
| Evidence Cohesion Gate | 证据对齐 |
| Evidence Watch Contracts | 证据守望 |
| Meeting Outcome Binder | 会后结果装订 |
| Action Readiness Contracts | 执行就绪 |
| Rehearsal | 场景预演 |
| Keystone Memory Brief | 关键记忆简报 |

## 索引规则

- 一行只放一个用户可感知的小功能点或可独立验证的子能力。
- `所在文档` 指当前 source of truth；不再把历史兼容入口或过渡文档列入索引。
- `.mdc` 文件只作为 agent / prompt / 运行规则，不作为产品主文档。
- `docs/progressing` 里的 plan 只有在被迁入本目录后才算当前功能文档。
- 新增或大改功能时，应同步更新本索引；如果只是实现总结、排障 quick guide 或旧方案，优先挂到已有主功能文档下面，不再平铺成新的主功能。

## 小功能点索引

| 小功能点 | 所属能力 | 所在文档 | 说明 |
|---|---|---|---|
| 记忆摄入、去重、显著性评估 | Memory Service | [memory_system.md](./memory_system.md) | `IngestionPipeline` / `SalienceScorer`；行为亲密度按实体名和别名进入摄入打分 |
| 四通道召回 | Memory Service | [memory_system.md](./memory_system.md) | Vector / FTS / Graph / Time；搜索页显示召回通道与证据交叉边界回执 |
| Graph PPR 联想召回 | Memory Service | [memory_system.md](./memory_system.md) | Graph 默认 Personalized PageRank；同义边参与展开；无图/无种子回退 hops |
| 行为亲密度排序 | Memory Service | [memory_system.md](./memory_system.md) | 从 outcome 账本离线聚合 affinity，只调 MMR/摄入排序，不写画像、不自动订阅 |
| InteractionScene 场景快照 | Memory Service / Memory Lens / Compose Assist | [memory_system.md](./memory_system.md) | 前端确定性场景信号供给 `/context-recall` 与 `/composer/assist`；语义决策仍在 Memory Service |
| 场景记忆自动驾驶 | Memory Service / Memory Lens | [memory_system.md](./memory_system.md) / [memory_lens.md](./memory_lens.md) | `/context-recall` 展示前过滤，决定 silent / chip / card / context_pack；Lens 卡片显示展示前过滤回执 |
| 关键记忆简报 | Memory Service / Memory Lens | [memory_system.md](./memory_system.md) / [memory_lens.md](./memory_lens.md) | 独立轻量维护循环从 Reflection Thread 和多来源工作记忆自动生成；ready/partial 在同一 Lens 入口优先于变化脉络并替换首屏，stale/blocked/hidden/缺失回落变化脉络或普通记忆 |
| 证据对齐 | Memory Service | [evidence_cohesion_gate.md](./evidence_cohesion_gate.md) | Ask、Reflection、Context Recall、Compose 与 Web AI 的消费前隔离；正常静默，不改原始记忆分类，跨题/缺锚点/跨范围时失败关闭 |
| 历史问答原始证据补回 | Memory Service | [evidence_cohesion_gate.md](./evidence_cohesion_gate.md) | 旧聊天仅存 `messages_raw` 时可受限字面补回；只服务 Ask/Reflection，不改 passive / Compose |
| Ask 主动问答 | Memory Service | [ask.md](./ask.md) | 主动问答入口，覆盖话题锁定、召回优先级、Ask 本轮状态、证据来源/守望/缺口回执、活答案沉淀，以及答案前回执卡 hover/读屏只读边界 |
| Ask 短问句话题锁定 | Memory Service | [ask.md](./ask.md) | Ask 前置匹配当前话题、角色词、source anchors 和高频互动记忆；Search Result 显示话题锁定回执 |
| Ask 候选话题澄清 | Memory Service | [ask.md](./ask.md) | `contextMatch=ambiguous` 时先列候选并支持序号承接；不写活答案、不生成伪确定答案 |
| Ask 近期重点注入 | Memory Service | [memory_system.md](./memory_system.md) / [ask.md](./ask.md) | `/ask` 与 Quick Ask 注入 Recent Focus 滚动上下文；不是事实层，无高信号时不注入 |
| Ask 渐进证据装配 | Memory Service | [memory_system.md](./memory_system.md) / [ask.md](./ask.md) | L2 全文 / L1 摘要 / L0 标题按 token 预算降级，预算耗尽显式省略 |
| Ask 缝合徽章 | Memory Service / Memory Lens | [memory_system.md](./memory_system.md) / [ask.md](./ask.md) / [memory_lens.md](./memory_lens.md) | `weave` 跨来源×跨天徽章；单来源不展示，避免徽章通胀 |
| Ask Source Memory deep 证据 | Ask / Memory Capture | [ask.md](./ask.md) / [memory_capture.md](./memory_capture.md) | deepStatus ready 时用 compactMemo 降 token；factCandidates 不直接写画像或活答案 |
| Ask 活答案记忆 | Memory Service | [ask.md](./ask.md) | 重复 locked topic 问题首问 observation、二问 promote、后续 priorHit / updated；首屏和回执卡显示复核时间、旧 prior 与写入门控边界 |
| Ask 会议结果引用 | Ask / Meeting Pilot | [ask.md](./ask.md) / [meeting_pilot.md](./meeting_pilot.md) | 相关问题读取 Meeting Outcome Binder；Quick Ask 显示结果装订回执，不重新装订、不写回会议或外部系统 |
| 证据守望契约 | Memory Service | [evidence_watch_contracts.md](./evidence_watch_contracts.md) | 可变化事实进入 contract；列表、详情和 run history 显示只读快照边界，POST run 写入回执区分真实复核与去重/生命周期收据 |
| 工作/个人/全部范围语义 | Memory Service | [memory_system.md](./memory_system.md) | `/recall`、`/ask`、被动召回共用；搜索范围按钮和入口先显示范围意图、排除域、旧快照和无写入边界 |
| 记忆搜索结果页 | Memory Exploring | [memory_system.md](./memory_system.md) | `SearchResultPage.vue`；摘要显示结果批次基准，类型筛选按钮预览可见/隐藏数量，卡片可键盘打开并显示安全回执 |
| 搜索结果有用/不相关反馈 | Memory Exploring | [memory_system.md](./memory_system.md) | `/feedback`，按 target type 记录；按钮 hover/读屏说明有用、不相关和撤销的写入边界 |
| 记忆时间轴 | Memory Exploring | [memory_system.md](./memory_system.md) | `TimelinePage.vue`，基于 recall time 通道，含范围/来源/刷新快照、控制点 hover/读屏边界与反馈操作回执 |
| 时间轴/搜索安全跳转 | Memory Exploring | [memory_system.md](./memory_system.md) | 只接受安全内部路由和无凭据 http(s) 来源链接；打开、详情和安全诊断按钮在 hover/读屏先说明目标与无副作用边界 |
| 记忆覆盖地图 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | `memory-exploring.html#/coverage`，查看各平台记忆覆盖状态；最近信号标明最多 8 条可见切片边界 |
| 覆盖聚合 API | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | `/coverage/map` 与页面可见、带只读诊断回执的 P0 切片接口 |
| 智能资料录入 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 粘贴/文档/普通 zip 先显示范围回执，入口和主按钮 hover/读屏说明 dry-run/提交边界，提交中保留写入回执并锁定关闭/取消 |
| 外部 AI 历史基础录入 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 用户主动上传 ChatGPT / Claude `conversations.json` zip；提交中/完成后显示写入与事实边界回执 |
| Coverage 质量分 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | 平台状态、新鲜度和健康贡献项计算 `qualityScore`，详情与排序 / 查看 / 切片刷新控件都标明当前快照和只读边界 |
| 备份下载与恢复入口 | Memory Coverage Map | [memory_coverage_map.md](./memory_coverage_map.md) | Coverage 页面下载前/提交中/下载后都有边界回执，抽屉内识别备份 zip、archive 指纹并 merge/replace |
| 记忆捕捉 | Memory Capture | [memory_capture.md](./memory_capture.md) | 选区/网页/外部输入的低打扰入库层 |
| 选中文字保存为资料记忆 | Memory Capture | [memory_capture.md](./memory_capture.md) | 右侧半露出 `+ 记住`，复核面板显示选区快照、保存 `source_memory_capsule` 和 `web` 记忆信号 |
| 整页资料保存 | Memory Capture | [memory_capture.md](./memory_capture.md) | 复制、深度滚动或停留信号后显示右侧半露出 `+ 记住`；建议 / 复核 / 自动保存回执显示页面快照、触发依据、提交中状态，并可查看详情或撤销 |
| Source Memory 召回卡片 | Memory Capture / Memory Lens | [memory_capture.md](./memory_capture.md) | `/context-recall` 支持 `sourceTypes:['source_memory']`，返回带资料回执、来源安全、详情复核和按钮级新标签/无写入边界的资料记忆卡 |
| Source Memory 蒸馏器 | Memory Capture | [memory_capture.md](./memory_capture.md) | 保存/补备注同步生成 P0，后台 deep worker 以 evidence spans 生成 scene cards、来源候选、Skill/Storyline seeds 和强锚点来源簇；失败保留 P0，详情页显示状态与零高责任写入边界 |
| 变化脉络 | Memory Service / Memory Lens | [change_memory_ledger.md](./change_memory_ledger.md) | 为稳定对象保存带前后值、来源和时间的状态事件链；区分已确认当前、最后观测、冲突、页面新值和仅历史，并供 Source Memory、Lens、Ask、Compose 使用 |
| Memory Capture API | Memory Capture | [memory_capture.md](./memory_capture.md) | `/source-memory/candidates/*` 与 `/source-memory/capsules`；保存/详情返回写入与召回信号回执，详情控件点击前说明只读、刷新、撤销和无外部副作用边界 |
| 记忆导入/导出/备份 | Memory Service | [memory_system.md](./memory_system.md) | `/import`、`/export`、backup archive 指纹、验证脚本与备份/恢复入口按钮边界 |
| 多用户隔离 | Memory Service | [memory_system.md](./memory_system.md) | per-user SQLite DB、身份来源、`/stats.user.writeBoundary` 与身份卡刷新 / 设置按钮边界 |
| 记忆注入防护 | Memory Service / Memory Capture | [memory_system.md](./memory_system.md) / [memory_capture.md](./memory_capture.md) | trust class 打标、Ask 中性框架、flagged 证据阻断无人值守动作；不删改原文 |
| TTL 试用期与生命周期端点 | Memory Service | [memory_system.md](./memory_system.md) | 低置信/untrusted 自动捕获 72h probation；`/lifecycle/forget` 与 `/lifecycle/compress` 降级不物理删 |
| 记忆演化与 chunk 合并 | Memory Service | [memory_system.md](./memory_system.md) | ADD/UPDATE/MERGE/NOOP 与 `memory_links`；原文不改写，只动派生 summary/links |
| 级联删除 | Memory Service | [memory_system.md](./memory_system.md) | 用户显式删除时清理孤儿属性、关系证据、反思 artifact 与画像证据影子 |
| MCP Server 跨 AI 记忆接口 | Memory Service | [memory_system.md](./memory_system.md) | `memory_search` / `ask` / `save` / `context_brief` / `profile_hint`；scope 白名单与审计日志 |
| 记忆六能力体检 | Memory Service | [memory_system.md](./memory_system.md) | `npm run eval:memory-abilities`；extraction / multi_session / temporal / knowledge_update / abstention / prospective 回归门 |
| 用户画像条目 | User Profile | [user_profile_system.md](./user_profile_system.md) | Profile item 管理、展示、手动录入、搜索筛选控制点、加载全部只读回执、已排除审计和等待服务确认回执 |
| 写作风格画像条目 | User Profile / Compose Assist | [user_profile_system.md](./user_profile_system.md) / [compose_assist.md](./compose_assist.md) | `writing_style.*` 来自 redacted diff 重复证据；按 surface/audience/task/language 分 scope |
| 语言偏好画像条目 | User Profile | [user_profile_system.md](./user_profile_system.md) | Options 界面语言同步 `language_preference`，约束后台用户可读生成语言 |
| 画像洞察查询 | User Profile | [user_profile_system.md](./user_profile_system.md) | `POST /profile/insight` 合成偏好洞察，不回吐原始证据行 |
| 用户画像导出 | User Profile | [user_profile_system.md](./user_profile_system.md) | 导出前检查单、导出中单飞边界、manifest 指纹、全状态分页、下载后与失败回执；`tools/verify-user-profile-export-e2e.mjs` 覆盖 |
| 画像快速增强/降低影响 | User Profile | [user_profile_system.md](./user_profile_system.md) | 显式 importance 调整，按钮 hover/读屏说明目标权重、确认/排除/恢复边界、服务确认和撤销范围 |
| 自定义消息分析提示词 | Prompt Config | [custom_prompts.md](./custom_prompts.md) | `prompt-config.html`，风险提示词暂停注入时仍需保存前确认；版本历史显示恢复前影响和草稿边界 |
| 用户上下文注入 | Prompt Config | [custom_prompts.md](./custom_prompts.md) | 用户偏好/上下文预览、范围总览、来源/总开关待保存回执与范围按钮 hover/读屏边界 |
| 自我反思线程 | Memory Service | [memory_system.md](./memory_system.md) | `ReflectionThreadService` 与 UI 线程页；列表显示查看范围，详情页显示手动反思 / 暂停 / 恢复 / 关闭的操作范围回执 |
| 反思本地研究补查 | Memory Service | [memory_system.md](./memory_system.md) | 反思 run 内查询本地记忆和派生证据；详情页显示本轮研究范围、trace 卡、研究证据采用回执和手动推进 / 动作 / transcript / 会话导航控件边界 |
| 开放问题退出契约 | Memory Service / Today Pilot | [memory_system.md](./memory_system.md) / [today_pilot.md](./today_pilot.md) | 反思写入前按新证据和现有 owner 继续、交接、停放或恢复；仅 `active + blocking_today + lastResumedAt` 主动进入 Today Pilot，Quick Ask 无默认聚合 |
| 未来场景预演记忆 | Rehearsal | [rehearsal.md](./rehearsal.md) | 以后遇到某个可识别场景时，提醒用户该想起、说或做什么；不是事实层或弱联想 |
| 场景预演边界 | Rehearsal | [rehearsal.md](./rehearsal.md) | 场景类型开放；详情页先用场景资格总览确认 future cue、现场提示资格和不自动执行边界，并可就地补充触发线索 |
| Rehearsal 管理页 | Memory Exploring | [rehearsal.md](./rehearsal.md) | `memory-exploring.html#/rehearsals`，用于审计和修正；筛选/搜索/加载/恢复控件、列表卡片、来源证据行与详情动作按钮点击前显示只读、选择、写入、反馈和不执行边界 |
| 动作队列 | Memory Service | [memory_system.md](./memory_system.md) | `ActionQueue.vue` / `proposed_actions`；筛选空结果、普通动作、按钮 hover/读屏和操作提交都有边界回执 |
| 执行就绪契约 | Memory Service / Action Queue | [action_readiness_contracts.md](./action_readiness_contracts.md) | `delegate_openclaw` dispatch 前按鉴权、能力、输入与 proof 失败关闭；probe 不提交原任务，Reflection 不堆积阻断动作 |
| OpenClaw 外部委派 | Memory Service | [memory_system.md](./memory_system.md) | `delegate_openclaw` action；自动调度卡片和 transcript 展开按钮显示只读/触发边界 |
| 决策中心 | Memory Service | [memory_system.md](./memory_system.md) | `DecisionCenter.vue` / `confirm_requests`；通知深链未命中显示已读队列与部分失败口径，审核包复制与处理按钮显示剪贴板/证据/写入边界 |
| 主动询问 | Memory Service | [memory_system.md](./memory_system.md) | `OutreachEngine`，问外部人/群组；详情/列表操作回执、详情加载失败恢复和按钮级 hover/读屏边界区分确认、外发和回复 |
| 主动询问会话管理 | Memory Exploring | [memory_system.md](./memory_system.md) | `OutreachSessions.vue` / `OutreachSessionDetail.vue`，含筛选范围、本页优先级、本轮处理对象、会话推进、列表操作、发送前复核和只读导航/刷新/来源链接边界 |
| 通知提醒与免打扰路径 | Memory Service | [memory_system.md](./memory_system.md) | `notification_records`，snooze 保留来源、依据记忆、回提醒上下文、仍未处理状态和操作边界回执 |
| 梦境重放 | Memory Service | [memory_system.md](./memory_system.md) | `DreamInsights.vue` / `dreams/*.md`，含本页范围、复核视图筛选、只读边界和可见复核入口 |
| 周报与梦境摘要推送 | Notification Center | [notification_center.md](./notification_center.md) | provider digest / notice lane；Options 手动触发后显示生成、通知写入、Bot 投递、提交快照和当前设置变化回执 |
| Notification Center feed | Notification Center | [notification_center.md](./notification_center.md) | `GET /notification-center/feed`；meta 显示 limit 应用、快照和空结果口径，Provider / Doubao 摘要与 Desktop 同步尝试保留可见 slice 边界 |
| 通知代价不对称 Utility | Notification Center | [notification_center.md](./notification_center.md) | Utility v2：`needScore * missCost − interruptCost`；高 miss 安静时段降级 scheduled 次晨补投，不静默丢弃 |
| 渠道投递回执 | Notification Center | [notification_center.md](./notification_center.md) | chrome / doubao / glip delivery records；系统通知显示本渠道首次提醒、失败原因和有效状态边界 |
| DigestQueueService 本地摘要 | Notification Center | [notification_center.md](./notification_center.md) | extension 本地低打扰摘要队列；popup 显示当前/空队列快照、本地延迟，并在立即执行前说明发送/保留/写入/确认边界 |
| 记忆入口规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 手动规则、系统观察规则和手动立即分析范围回执 |
| 记忆入口规则表面模式 | Message Analysis | [message_analysis.md](./message_analysis.md) | `surface=hub` 走记忆探索侧栏完整列表，`surface=task` 从消息工具栏进入只渲染任务头 + 单条规则表单；任务态隐藏侧栏以避免预填草稿被导航卸载后不可恢复，出口和关窗口径由外壳统一承担 |
| 手动关注项规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 用户可编辑的关注规则；采集暂停时单条规则、保存按钮和立即启用都显示保存/确认边界 |
| 系统观察规则 | Message Analysis | [message_analysis.md](./message_analysis.md) | 自我反思、主动询问等证据采集；规则页显示只读运行时观察回执，刷新失败保留上次快照，刷新按钮 hover / 读屏说明只重新读取状态 |
| 规则范围校验 | Message Analysis | [message_analysis.md](./message_analysis.md) | 发送人、群组、时间、过期状态和系统观察上下文；规则页显示范围门禁、执行回执和折叠行最近拦截定位 |
| 消息入库与通知分发 | Message Analysis | [message_analysis.md](./message_analysis.md) | 普通 filter / Agent Thinking / Agent Workflow 共用；规则页与后台调度状态显示本轮分发回执 |
| 联动操作 / Openclaw | Message Reaction | [message_reaction.md](./message_reaction.md) | 预填记忆入口规则任务态，按钮点击前说明只开配置草稿；保存前执行预览和后续动作 |
| 稍后处理 / Remind | Message Reaction | [message_reaction.md](./message_reaction.md) | RingCentral 消息提醒 |
| Snooze 快速时间菜单 | Message Reaction | [message_reaction.md](./message_reaction.md) | 15/30 分钟、1/2/3 小时、工作日等；新建 / 改期先显示时间口径，每个菜单项也带创建、改期、自定义或管理入口边界 |
| Snooze 去重与撤销 | Message Reaction | [message_reaction.md](./message_reaction.md) | 同源 pending 保护、改期目标回执、toast actions |
| 关注后续 / Watch | Message Reaction | [message_reaction.md](./message_reaction.md) | 持续追踪后续讨论，按钮点击前、保存前/保存后显示监听范围、期限、匹配、索引和取消确认边界 |
| 跟进追问 / Followup | Message Reaction | [message_reaction.md](./message_reaction.md) | 自己发出的消息创建一次性 Outreach session；提交按钮和提交中/成功/复用状态都说明未立即发送 |
| 自动答复 / Reply | Message Reaction | [message_reaction.md](./message_reaction.md) | 回复规则、命中范围、AI 失败 fallback、保存按钮边界，以及审核行正文/排期快照 |
| Glip AI 标注 | Message Reaction | [message_reaction.md](./message_reaction.md) | follow / snooze / outreach / scheduled markers；普通与 Watch 特殊角标的 tooltip / 读屏都显示来源、缓存刷新、本地快照、状态口径、折叠范围和下一步复核路径 |
| 消息交互工具栏 | Message Reaction | [message_reaction.md](./message_reaction.md) | RingCentral 消息 hover 工具栏；齿轮设置显示本地入口开关边界和保存后入口预览 |
| 主题式未读阅读 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 首页、主题列表、主题详情；详情页显示阅读批次与已读写入边界，已读按钮 hover/读屏说明缓存写入、暂留和撤销 |
| 主题稍后处理 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 本地 defer 状态、按钮级边界、查看稍后路径和恢复未读回执 |
| 主题静音 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 本地 mute 状态、静音菜单/原因/时长按钮边界、查看静音路径与取消静音回执 |
| 主题详情深链定位 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | `?messageId=` / `?message_id=` / `?ts=` 定位并高亮，兼容来源 permalink / Slack timestamp 别名 |
| Topic 来源链接安全展示 | Topic Messages | [topic_based_messages.md](./topic_based_messages.md) | 只展示可信 http(s)，打开/隐藏都有回执，链接 hover/读屏先说明外部打开边界 |
| 定时消息一键初始化 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet、Apps Script、触发器；创建 / 授权 / 恢复按钮 hover 与读屏标明阶段边界 |
| 定时消息创建/编辑/删除 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Messages 表驱动；行内编辑 / 删除按钮说明本地草稿、确认、写入和历史发送边界；AI Report 自定义版块增删改标明只是弹窗草稿 |
| Glip 快速定时与未来消息 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 输入框闹钟创建 `ComposeScheduled` AsMe；列表底部虚线未来消息是本地 pending 快照，不是已发送消息 |
| 多执行引擎 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | AsMe / Bot / AI Report / JiraAutomation / Outreach |
| 定时消息列表筛选 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Active / Done / Snooze 等 |
| 队列健康提示 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 队列风险、诊断线索、改期写入中回执和恢复入口 |
| 执行匹配与补偿窗口 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 当前分钟、过去 30 分钟、08:00 后队列；活补偿行显示未发送回执 |
| 队列可视化与改期建议 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | 拥挤槽位、展开快照回执、建议依据、建议处理对象与操作边界 |
| Timeline 缓存与 Jira Milestone | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Jira JSON/Groovy Map 兼容、诊断范围回执和 dry-run 排障 |
| 定时消息配置同步 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet Config 与本地 storage 同步；同步按钮 hover/读屏说明读 Config、刷新缓存、必要写回和不执行队列边界 |
| App Script 自动更新 | Scheduled Messages | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | deployments.update、版本探测、项目归属预检；可升级横幅显示 getVersion 证明回执，检查/升级/恢复按钮 hover 与读屏标明只读、写入和回退边界 |
| 帮我做 AgentTask | Scheduled Messages / Memory Service | [scheduled_messages_manager.md](./scheduled_messages_manager.md) | Sheet 保存重复任务计划，Jira Rule 到期触发 memory-service，OpenClaw 执行并 Bot 通知 |
| Task Scheduler 状态 API | Task Scheduler | [task_scheduler_api.md](./task_scheduler_api.md) | 任务启停、状态、折叠需处理预览、下一步提示边界、提交中、按钮边界、刷新确认和操作范围 |
| Agent Thinking 分析编排 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | 通用工具/思考循环；终止到结果卡片之间显示整理回执、未处理问题摘要，以及带 hover / 读屏边界的步骤定位 |
| Agent Thinking 工具审批 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | 阻断、队列口径、审批前确认、结果区定位、批准 key / 审核包 / 重跑配置复制按钮边界 |
| Agent Thinking trace 可视化 | Agent Thinking | [agent_thinking.md](./agent_thinking.md) | Options 演示、Trace 复核路线、问题 span 步骤定位、步骤按钮 hover/读屏复核理由与复制反馈 |
| Agent Workflow 多 Agent 编排 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | 标准消息入口 workflow；低置信度复核和保存样例删除都有本地边界回执 |
| Agent Workflow 关注项测试 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | 内置样例、最近消息只读快照、本地保存样例；测试区先显示运行前范围、本地门禁资格、保存样例容量和无副作用边界 |
| Agent Workflow 运行诊断 | Agent Workflow | [agent_workflow.md](./agent_workflow.md) | trace / storageReview / readiness；下一步动作显示本地排障边界，实时 trace 工具错误优先显示 Agent / Tool，证据包复制中锁定当前测试输入；运行/回放/基线/导出/复制控件 hover 与读屏说明本地测试、只读召回、剪贴板、下载和本地基线写入边界 |
| 今天 Mission | Today Pilot | [today_pilot.md](./today_pilot.md) | 首页 mission card；展开态与按钮 hover / 读屏都说明操作边界 |
| 高压后补课 | Today Pilot | [today_pilot.md](./today_pilot.md) | `/today-pilot/catch-up` 只读快照；首页显示高优变化、等你回和来源复核边界 |
| 睡眠期预计算 Anticipation | Today Pilot / Ask | [today_pilot.md](./today_pilot.md) / [ask.md](./ask.md) | 夜间从日历与开放反思主题预答，存 `anticipation_briefs`；`/ask` 命中 prior 后消费一次，过期作废 |
| 今天排序与噪声控制 | Today Pilot | [today_pilot.md](./today_pilot.md) | `DayPilotService`；筛选口径和来源分布按当前可见卡片更新，标出本页已隐藏入选证据，刷新按钮说明派生快照边界 |
| 今日预演提示 | Today Pilot | [rehearsal.md](./rehearsal.md) | active/stale Rehearsal 进入今日和会前 cue |
| 会前准备 | Today Pilot | [today_pilot.md](./today_pilot.md) | calendar events / meeting prep；只挂载可见会议详情，大型会议 attendee 裁剪不阻断整批同步，跨日缓存按会议实际日期写入，派生材料统一脱敏；回执区分高置信记忆、基础背景、本机 handoff 和刷新补课结果边界 |
| 会前待闭环目标 | Today Pilot / Memory Service | [today_pilot.md](./today_pilot.md) / [memory_system.md](./memory_system.md) | meeting prep 同轮生成 planned outcome slots，Video Home 在原卡片显示 `本场要闭环` 并带入本机 handoff |
| Storyline 会前提示 | Today Pilot / Memory Storyline Builder | [today_pilot.md](./today_pilot.md) / [memory_storyline_builder.md](./memory_storyline_builder.md) | meeting prep LLM 判定后在摘要和 cue cards 之间提示 |
| Storyline Draft 页面 | Memory Storyline Builder | [memory_storyline_builder.md](./memory_storyline_builder.md) | `memory-exploring.html#/storylines/draft`，生成等待、输出目标回执、格式切换按钮边界、复核段落、证据、风险和可复制 artifact |
| Storyline Draft API | Memory Storyline Builder | [memory_storyline_builder.md](./memory_storyline_builder.md) | `POST /api/v1/storylines/draft`，基于 meeting prep 生成草稿并返回生成范围回执 |
| Meeting Pilot handoff | Today Pilot | [today_pilot.md](./today_pilot.md) | 从今日简报进入会议能力；Meeting Pilot 显示匹配方式、缓存年龄、剩余有效期，并在候选集合刷新后更新已打开侧栏 |
| Popup Top 3 | Today Pilot | [today_pilot.md](./today_pilot.md) | Chrome popup 今日摘要；溢出、反馈、复制和外部处理按钮带 hover / 读屏边界 |
| Context Pack | Today Pilot | [today_pilot.md](./today_pilot.md) | 可复制的上下文包；生成失败不显示预览/旧正文当作当前包 |
| 回复助手草稿辅助 | Compose Assist | [compose_assist.md](./compose_assist.md) | 输入框旁 AI 辅助 |
| 回复助手来源适配 | Compose Assist | [compose_assist.md](./compose_assist.md) | RingCentral / Jira / Web AI；来源路由显示适配边界和重算口径 |
| 回复助手预演提醒 | Compose Assist | [rehearsal.md](./rehearsal.md) | `sourceTypes` 包含 `rehearsal` 时作为预演 evidence；复核态显示命中线索、提示资格和插入边界 |
| 回复助手直接插入 | Compose Assist | [compose_assist.md](./compose_assist.md) | hover 只预览正文，点击 icon 直接插入，插入后显示约 10 秒可撤销边界 |
| 回复助手身份投影 | Compose Assist | [compose_assist.md](./compose_assist.md) | 已实现：生成前按 scene、audience 和画像 slot 控制可说内容；manager/external 强制预览，blocked 不展示入口，原始 USER_CORE 不进入 Compose |
| 回复助手写作风格学习 | Compose Assist / User Profile | [compose_assist.md](./compose_assist.md) / [user_profile_system.md](./user_profile_system.md) | 从插入后改写的 redacted style tag 晋升 `writing_style.*`；只改写法不复述配置值 |
| CLI agent 会话上下文 | Compose Assist | [compose_assist.md](./compose_assist.md) | Codex / Claude Code / Cursor agent 会话默认可选入库；过滤代码与 tool output，只保留任务/结果/验证信号 |
| 回复助手阈值与反馈 | Compose Assist | [compose_assist.md](./compose_assist.md) | 自适应展示、thumb-down 按钮与回执说明本地隐藏、surface 调阈、脱敏校准和无发送/删除边界 |
| 回复助手无感校准 | Memory System / Compose Assist | [memory_system.md](./memory_system.md) / [compose_assist.md](./compose_assist.md) | 插入、改写、发送、hover 未用和 thumb-down 生成 redacted trace；未插入后发送显示脱敏校准回执 |
| 场景记忆自动驾驶 eval | Memory Lens / Compose Assist | [memory_lens.md](./memory_lens.md) | compose 群聊、网页/文档、空会议、跨域噪音和重复来源合并 |
| 记忆提示右下角关联记忆 | Memory Lens | [memory_lens.md](./memory_lens.md) | 当前网页/消息/Jira/会议上下文被动召回；页面信号和只读边界在 Rest / Hover Peek 说明，展开卡直接进入关联内容 |
| 记忆提示 Hover Peek | Memory Lens | [memory_lens.md](./memory_lens.md) | hover/focus 轻预览，含来源、新鲜度、缓存和候选切片回执 |
| 记忆提示 Expanded Card | Memory Lens | [memory_lens.md](./memory_lens.md) | 完整卡片、反馈、来源；来源链接和反馈按钮点击前说明只读/写入边界 |
| 记忆提示预演提醒 | Memory Lens | [rehearsal.md](./rehearsal.md) | 当前网页/会话/issue 命中 Rehearsal 时低打扰展示 |
| 划词查找关联记忆 | Memory Lens | [memory_lens.md](./memory_lens.md) | selected_text context recall；卡片显示已命中候选与无二次召回边界，顶部选区 tooltip 不裁切 |
| 站点静默/屏蔽/白名单 | Memory Lens | [memory_lens.md](./memory_lens.md) | 本地 storage 控制；Options 状态、操作结果和按钮 hover/读屏区分白名单静默、实时重新评估、主动划词仍可用与无写入外发 |
| AR 数据网页叠加 | Personal AI AR Data | [ar_data_overlay.md](./ar_data_overlay.md) | 右键创建 AR binding，历史结果先展示；badge 隐藏仅影响本页会话，重复执行的开启/取消都有 AgentTask 写入边界 |
| 人脉关系人物雷达 | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | 首屏显示当前范围、优先人物、数据质量和控件级只读/写入边界 |
| 人脉关系人物详情与证据 | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | 互动时间线、open loops、确认/推断事实与安全证据跳转；切换人物清空旧 brief/草稿 |
| 人脉关系 Context Card | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/context-card`；复制、敏感范围、证据打开和建议/事实/关系/检索条目 hover/读屏显示剪贴板、隐私、只读和无写入边界 |
| 人脉关系 Meeting Brief | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | 会前人物摘要、覆盖检查、会前焦点、输入变更回执与 `/relationships/meeting-brief` |
| 人脉关系 Assistant Draft | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `/relationships/assistant/draft`；生成/复制按钮点击前显示隐私、锁定和剪贴板边界 |
| 人脉关系 Review Queue | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | confirm / reject / snooze；完整卡和侧栏按钮显示写入、稍后、驳回与不写画像边界 |
| 人脉关系 Graph | Relationship Radar | [relationship_radar.md](./relationship_radar.md) | `GET /relationships/graph`；标出 rising / dormant / review_needed，不是完整图谱编辑器 |
| 项目面板 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 项目概览、任务、里程碑 |
| 项目 Roadmap 站点 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 团队可协作 Gantt；拖入 Gantt = 重点项目声明 |
| Roadmap JQL 导入 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 覆盖开关只在导入栏勾一次；Jira REST 由 service worker 代发 |
| Roadmap 两档分享 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 地址栏只读链接；右上角 token 可编辑链接 |
| Roadmap 变更历史 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 团队层操作日志 drawer，不展示个人记忆 |
| Roadmap 手动 Backlog 条目 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 不经 Jira 直接建条目；`LOCAL-` 合成 key 永不变更，已回填 Jira key 的条目不可删 |
| Roadmap draft 排期 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 判据只有 `jiraKey === null`；斜纹 bar 与 DRAFT 角标；draft 进 memory 但合成 key 不进 aliases |
| Roadmap 两阶段创建 Jira | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 主任务建成即回写 `resolve_item` 再建子任务；类型/链接字段按层级映射，子任务类型查 createmeta |
| 重点项目按团队覆盖同步 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 扩展把 Gantt 主任务 sync 到 watched_projects；落选 archived |
| 重点项目消息观察（不通知） | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | focus project 注入消息分析，只入库不 Glip 提醒 |
| Roadmap 漂移角标 | Personal Roadmap | [personal_roadmap.md](./personal_roadmap.md) | 个人层意图 vs 现实偏差；可更新/忽略/收敛消除 |
| 项目本地查找 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 在当前浏览器本地快照内查找项目、任务、Jira、平台来源和里程碑；输入/清除/查看全部控制点与回执显示当前视图可见/隐藏命中和无外部读写边界 |
| 项目数据源检查 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | Jira/GitHub/Confluence 状态、缺口、检查口径、按钮/收起边界与 warning 状态 |
| Memory Service watched projects 补齐 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | 只补齐本地，不反写 Memory Service；首屏列出新增 / 已匹配项目，收起面板不清空结果 |
| 项目证据修复路径 | Project Dashboard | [brain_like_project_analysis_system.md](./brain_like_project_analysis_system.md) | ETA、Jira、平台状态缺口；证据队列、优先处理卡和修复按钮说明本地打开/聚焦边界 |
| 甘特图 / 依赖图 / 燃尽图 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 本地图表概览，卡片 / 进度 / 时间点 hover 与读屏标明本地口径 |
| 风险监控与团队指标面板 | Project Dashboard | [project_dashboard_usage_guide.md](./project_dashboard_usage_guide.md) | 风险等级/缓解跟踪与工作负载、技能匹配、可用性等本地指标视图 |
| Meeting Pilot 捕获 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | 用户主动开始 capture；popup 提交中与失败回执说明本机录制、未通知参会者和非外发边界 |
| 会议页嵌入入口 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | RingCentral meeting content script |
| 会中提醒 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | shared screen / speaker / action signals；Side Panel / Live Map 显示提醒可见口径和降噪边界 |
| 会中 side panel | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | `meeting-sidepanel.html`；Capture 起步/页脚、行动项复核、筛选、复制、编辑、手动补录和会前 cue 写入按钮都有 hover / 读屏边界 |
| 会后 Panorama | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | 会议时间线、行动项、决策和输出范围回执；输出/跟进/PDF/录制按钮 hover 与读屏说明只复制/打开/导出现有材料 |
| 会后结果装订 | Meeting Pilot / Memory Service | [meeting_pilot.md](./meeting_pilot.md) / [memory_system.md](./memory_system.md) | 用 transcript、决议、章节和行动项核验会前目标；弱证据降级，Panorama 展示结果、证据与无外部写回边界 |
| 会议历史归档 | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | `MeetingHistoryPage.vue`，读取失败/加载更多失败有回执；卡片展示 Panorama/PDF 打开范围，按钮 hover/读屏也标明只读、外链安全与禁用边界 |
| 分层 ASR | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | RC Transcript / Web Speech / desktop local / cloud；Speech 面板显示平台转写与上传边界 |
| Desktop Local ASR / Whisper fallback | Meeting Pilot | [meeting_pilot.md](./meeting_pilot.md) | desktop app local ASR chain；Whisper final fallback；Speech 面板显示本地流重试、切层和回执卡只读边界 |
| NC 加会 | Native Join | [meeting_native_join.md](./meeting_native_join.md) | Web meeting 链接转 native app |
| NC 加会浏览器回退 | Native Join | [meeting_native_join.md](./meeting_native_join.md) | Video Home Join 按钮点击前说明 app-first / Chrome 提示 / 浏览器恢复边界；默认浏览器、复制完整链接、Meeting ID/passcode 手动恢复、默认路径回执、规范化 app 重试和 fallback UI |
| Google Slides 项目分析器 | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | Slides 分析与建议，含工具栏入口、范围判定和字段选择控制点回执 |
| Slides 写回预览 | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | 字段证据、风险提示、提交中锁定与按钮级写回边界 |
| Slides partial success skipped reasons | Google Slides Analyzer | [google_slides_analyzer.md](./google_slides_analyzer.md) | 跳过/缺失原因保留，可重选已匹配跳过字段；重选后区分上一批确认回执与当前本地接管选择 |
| JIRA 设计稿检测 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | Description / Remote Links / Designs；只有非交付设计工具 URL 时显示过滤和只读扫描回执 |
| 设计工具保守分类 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | 排除 Figma/Zeplin marketing/community/profile/settings 假阳性，Miro/Loom 仅收交付资源路径；首屏显示扫描口径、来源批次、过滤原因，链接 hover/读屏说明只读打开边界 |
| 设计链接更新时间展示 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | newest updated date、visible time-basis chip 和打开后待复查回执 |
| Jira issue key 解析 | Jira Design Links | [jira_design_links.md](./jira_design_links.md) | raw text/query/ARIA 恢复、只读恢复与候选打开回执 |
| Jira 自动化规则导入 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | 导入预览与创建；首屏显示 create request scope |
| 高风险导入提示 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | 入口按钮先说明只打开本机 JSON 选择和 disabled-copy 预览；不强制勾选确认；可直接创建 disabled copy；复制复核包只是本机剪贴板 handoff；链式触发选择有回执；导入后跳转可取消 |
| secret value 脱敏 | Jira Automation Import | [jira_automation_import.md](./jira_automation_import.md) | `secret=true`、signed URL、function/API gateway query 凭据不展示 raw value，预览和 create 按钮按重录队列提示启用前处理顺序 |
| 豆包互联 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 本机 Desktop App 双向记忆流 |
| Memory Sync Thread | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 长期稳定记忆线程；按钮 hover / 读屏区分绑定、重试、测试和日志边界 |
| Mobile Context Thread | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 近期重点、提醒、Quick Ask 答案发送范围回执；发送按钮 hover / 读屏区分未发送、发送中、已发送和失败重试边界 |
| Persona / 近期重点 / 提醒推送 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 随手记导向格式；手动推送即时显示 package、条目、去重来源数、线程、验证与失败未确认回执 |
| Doubao / ChatGPT explorer 输入链路 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 抓取外部 AI 会话并回写 Memory Service；未保存来源设置与抓取失败都会保留输入范围 / 传输边界 |
| Revoke ingested memory | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | 删除按来源写入的 Memory Service 记忆；撤回请求和结果保留确认时的范围 / artifact 点击快照 |
| Quick Ask 小窗 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | menubar 默认入口 |
| Quick Ask 本机会话续接 | Doubao Bridge / Ask | [doubao_bridge.md](./doubao_bridge.md) / [ask.md](./ask.md) | 24 小时脱敏本机快照；继续才带 hint，新问题不继承，服务端重新检索并返回续聊回执 |
| Quick Ask 语音输入 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | native speech helper；停止/空转写、权限恢复和发送按钮 hover/读屏边界 |
| Quick Ask 状态卡 | Doubao Bridge | [doubao_bridge.md](./doubao_bridge.md) | sync issue / pending outreach 等状态；状态胶囊、刷新按钮和状态行显示展开、重新读取、数量、来源和只读快照口径 |
| 技能库技能建议 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | suggestion inbox；卡片和按钮显示处理边界回执 |
| 技能使用/丢弃/稍后审 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | suggestion 决策总览、状态机、点击快照回执和整卡只读查看边界 |
| 技能质量门控 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | Wilson health + candidate/active/degraded/retired/user_pinned；连败自动停用建议面，钉住豁免降级 |
| Public Skill URL | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | tokenized read-only share；复制/预览/安装按钮显示当前版本、token 尾号与无副作用边界 |
| 平台同步 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | OpenClaw / Desktop App / manual-only；入口、立即同步和平台开关 hover / 读屏说明保存、同步、禁用和无执行边界 |
| 本地 agent skill 导入建议 | Skill Foundry | [personal_skill_foundry.md](./personal_skill_foundry.md) | 外部变更先进入 suggestion；卡片回执显示本机扫描与验证线索边界 |
| 用量与 Token 分析报表 | Usage Analytics | [usage_analytics.md](./usage_analytics.md) | 使用视角四视图（功能总览/用户活跃/偏好矩阵/次要面板）+ 中文功能名 + 30d；按 user × capability × model × side 归因 |
| 前后端用量打点 | Usage Analytics | [usage_analytics.md](./usage_analytics.md) | 前端 `UsageTracker` 缓冲 + `chrome.alarms` 批量上报 `POST /usage/telemetry`；后端 `AsyncLocalStorage` + `LLMClient`（含 stream）记录真实/估算 usage，onResponse 记接口频率 |
| 用量成本估算与 rollup 缓存 | Usage Analytics | [usage_analytics.md](./usage_analytics.md) | 本地 `MODEL_PRICING`（含 deepseek-v4-pro）估算成本、报表层重算、未知模型 flagged；每小时/每日 cron rollup |
| Options 用量报表入口 | Usage Analytics | [usage_analytics.md](./usage_analytics.md) | 仅 `esone.qiu`：Options 记忆系统区 + Demo 区「打开线上用量报表」；全员可见静态 Demo「用量分析（使用视角）」 |
| memory_service 能力口径 | Usage Analytics | [usage_analytics.md](./usage_analytics.md) | 正式所属能力（核心平台），非 others；含 `/stats` 轮询与共享 `/recall`/`/context-recall`，高调用率预期内 |
| 采样参数模型兼容 | LLM 基础设施 | [llm_sampling_compatibility.md](./llm_sampling_compatibility.md) | 推理型模型（o1/o3/o4、gpt-5、Claude Opus 4.7+/Claude 5）省略 `temperature`/`top_p`、`max_tokens` 换 `max_completion_tokens`；扩展与 memory-service 各持一份等价策略 |
| 场景温度预设 | LLM 基础设施 | [llm_sampling_compatibility.md](./llm_sampling_compatibility.md) | `SCENARIO_TEMPERATURE` 六档（extraction/analysis/summary/drafting/conversation/creative）；调用方按场景选档，显式 temperature 优先 |

## 后续维护规则

1. 新功能如果有独立用户入口、独立后端 route 或独立 verify script，应在本索引新增一行。
2. 如果同一功能已经有主文档，只新增小功能行，不新增平级主文档。
3. 如果发现 `docs/features` 里出现 implementation summary、quick guide、legacy plan 或规则类 `.mdc`，先把仍有效内容并入主功能文档或 `AGENT.md`，再删除原文件。
4. 若一个 `docs/progressing/*.md` 规划已经落地到源码，迁入 `docs/features` 或在现有主文档补齐后，再从本索引引用。仅创建或修改 progressing 规划本身时不更新本索引。
5. 主功能文档不能只列功能点；应在前部保留大白话运行逻辑、主要影响因素和必要实现/门控/数据来源逻辑，详细标准见 [`AGENT.md`](../../AGENT.md)。
6. 完成功能并更新 `docs/features/` 主文档后，必须同步更新本索引（小功能行、`所在文档`、必要时术语表与最后更新日期）；`AGENT.md` Documentation 节已把这作为交付要求。
