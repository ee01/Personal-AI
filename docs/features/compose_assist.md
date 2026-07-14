# Compose Assist

_最后更新: 2026-07-12_

## 定位

Compose Assist 是 Personal AI 的输入框辅助层。它只负责“用户正在写东西”时的低打扰记忆提示，不负责会前准备、每日 mission 生成或后台 closeout。

产品心智：用户不需要打开 Personal AI 的独立 compose 页面；Personal AI 应该在用户已经准备输入的原生输入框旁边出现，提供可预览、可插入、可忽略的上下文辅助。

与 Memory Lens 的边界：Compose Assist 负责输入框旁的写作/插入辅助；Memory Lens 负责当前页面的关联记忆提示。只要任意页面的 Compose Assist 已经生成可一键写入输入框的文本并显示 icon，Memory Lens 的右下角悬浮 icon 就会自动隐藏，避免两个 Personal AI 入口同时争夺注意力；如果只是命中关联记忆但没有可插入文本，Compose Assist 不展示 icon，由 Memory Lens 展示关联记忆。

典型场景：

- RingCentral 消息回复或 thread 回复。
- Jira comment。
- ChatGPT / 豆包 / Claude / Gemini 等 Web AI 输入框。
- 文档或笔记输入。

Phase 1 不在终端、IDE 或桌面 agent 输入框里做 OS 级浮层，因为 Chrome Extension 无法可靠探测这些输入框。但 Desktop App 可以把 Codex CLI、Claude Code、Cursor Agent 的历史会话作为高质量上下文来源，供 Web AI `compose_to_ai` 和后续 `agent_compose` 使用。

## 边界

Compose Assist 做：

- 读取当前输入框、页面标题、会话/issue snapshot、可见上下文和用户草稿。
- 调用 `/composer/assist`。
- 复用 `ContextRecallService` 召回相关消息、会议、Jira、网页、AI 对话、用户偏好和 Rehearsal 预演提醒。
- 生成用户可预览、可插入的建议内容。RingCentral / Jira 输出必须是可直接发送的正文；Web AI 输出可以是 context pack，或在用户已经输入明确任务但缺少关键槽位时输出 prompt patch。
- 当 `/context-recall` 返回已编译 `ContextCue(actionType='draft_hint')` 时，优先把这句 cue 作为 Jira/RingCentral 的插入草稿来源。例如 Jira estimate 场景可以从历史 Glip 记忆生成“我先按人天口径处理 MTR-148115 的 original estimate...”。这条路径仍然走现有 `riskLevel`、`previewRequired` 和前端复核/插入规则，不绕过安全边界；重复插入并发送成功后，Outcome Loop 会给同类 cue 加 `boost` policy，而不是要求用户额外确认。
- 向 `/composer/assist` 传入 `interactionScene` 和 `visibleFields`。前端只描述用户此刻的确定性上下文，例如 `jira_comment_composing`、`ringcentral_reply_composing`、`web_ai_prompt_composing`、当前 focus 的输入框、可见 Jira 字段和附近消息；Memory Service 再决定这些信号是否足以生成 draft hint。
- 从用户真实插入、改写、发送和拒绝行为里学习写作风格，逐步减少“AI 味”的回复。
- 不自动发送消息，不自动提交 comment。

Compose Assist 不做：

- 会前准备。
- 按天生成 mission。
- 日历扫描和离线 LLM 准备。
- Meeting Pilot handoff。

这些能力由 Today Pilot 负责。

## 触发与展示

触发时机：

- 用户 focus 到支持的输入框。
- 页面上下文切换，例如 RingCentral 切换 group/thread，或 Jira issue 变化。
- RingCentral/Jira 不把用户每次输入的 draft 当作主召回信号；Web AI `compose_to_ai` 会把 draft 当作短 prompt 补上下文的 enrichment signal，并进入 context key，避免同一页面里不同 prompt 被同一次 dismiss 吞掉。
- Compose Assist 不等同于“页面打开就提示”。它需要输入框 focus、comment/reply/prompt 容器、issue key / conversation id / visible messages 等交互信号组成 `InteractionScene`；如果只有普通阅读、没有输入意图，应该让 Memory Lens 或静默 recall 处理。

展示条件：

- 后端返回 `available=true`。
- 有非空 `insertText`，并且清理包装话术后仍然是可一键写入的文本。
- `insertText` 通过可发送文本校验，不能包含 `Personal AI context`、`Please review`、`我理解当前...`、`我这边先补充...` 等包装话术。
- `confidence >= envConfig.COMPOSER_GUARD_CONFIDENCE_THRESHOLD`，默认 `0.78`。
- 如果只命中高相关 evidence / 关联记忆，但没有生成可一键写入的 `insertText`，前端不挂 Compose Assist icon，也不显示 `草稿回执` 或 `上下文回执`；这类只读关联记忆只走 Memory Lens 的相关记忆卡片。

UI 行为：

- 只有 `CONTEXT_ASSIST_ENABLED` 和 `COMPOSE_ASSIST_ENABLED` 都不是 `false` 时才启动；任一开关关闭时，前端清理 icon/glow，background 也会拒绝新的 assist 请求。
- 输入框右上角吸附 `static/icons/icon48.png`。
- hover icon 时，左侧展开“建议内容”预览。
- 非 Web AI 场景可以用轻量 glow 标识当前输入框；ChatGPT/Gemini/Claude/豆包等 Web AI 输入框只在右上角显示 Personal AI icon/popover，不把输入框变成红色发光状态。
- 切换输入框或焦点离开可支持输入框时，旧输入框的 glow/icon 会被清理，避免误导用户还有可插入建议。
- 点击 icon 只执行一个动作：把建议内容直接插入当前输入框；不发送、不提交。textarea/input 会按当前光标或选区插入；contenteditable 输入框也会优先尊重当前光标/选区，选中文本时替换选区，没有可用选区时才追加到末尾。
- 如果建议需要先进入复核态，Personal AI 会保留进入复核前的输入框选区；即使确认按钮短暂拿到焦点，最终插入仍按用户原本选中的草稿片段替换，不把建议误追加到末尾。
- 插入成功后会短暂显示 `已插入草稿 / 未发送，可继续编辑 / 撤销`，并补充写入目标、未提交/未发送边界和 `约 10 秒内可撤销` 的时间窗口；用于误点或发现建议不合适时恢复插入前草稿。撤销窗口结束后才记录 accepted 和脱敏校准信号，并显示 `草稿保留已确认`，说明当前草稿仍未发送/提交，同时展示 `inserted` 校准信号是正在提交、已写入、重复忽略还是失败。撤销后同一建议不会立刻再次弹出，避免把用户拉进重复插入循环。
- 如果当前输入框临时变成只读、禁用或拒绝写入，前端会显示 `未写入草稿` 回执，说明 Personal AI 没有发送或提交，并提示重新聚焦输入框后重试；这类失败不会记录 accepted 反馈或正向校准 trace。
- 悬浮预览只展示待插入正文，不展示“记忆关联”、来源路由、草稿回执、来源卡片、证据链接、复制/取消/插入按钮，也不把用户带到记忆详情页。Compose Assist 的判断负担应落在“这段内容要不要插入”，不是让用户复核召回链路。
- 锁定复核态同样以待插入正文为主体，只额外显示 `取消` / `插入草稿` 操作；不展示 `来源路由`、`草稿回执` 或 `建议依据`。插入后的短回执再说明写入目标、未发送/未提交和撤销窗口。
- 如果后端返回高置信 evidence 但没有安全可插入正文，例如 Jira 历史 comments 已显示用户回复过，前端不显示 Compose Assist icon；匹配到的关联记忆由 Memory Lens 使用 lens icon / 相关记忆卡片展示，不再占用输入框旁的插入入口。
- 如果建议使用了 Rehearsal 预演提醒，前端仍把它当成必须复核的硬边界，即使后端漏设 `previewRequired` 也不会一键直插；但插入前预览仍只展示待插入正文，不展开预演线索、证据来源或降权路径。
- Web AI 输入框的悬浮标题会按主要来源显示为 `Agent 历史上下文`、`Jira / 项目上下文`、`会议上下文`、`跨 AI 上下文` 或 `提问上下文补丁`，让用户知道点击后要插入的上下文类型。
- 后端返回 `previewRequired=true` 或 `riskLevel=high` 时，第一次点击 icon 只锁定并展开建议正文预览，显示 `插入草稿` / `取消`；`取消` 或 Escape 只退出锁定复核、回到轻量预览，不会写入草稿、不会发送、也不会把这条建议当作拒绝学习；用户再次确认后才写入当前输入框。低风险建议仍保持一键插入。
- 靠近视口底部时会自动向上展开并限制高度，避免预览框被屏幕边缘挡住。
- 用户在建议生成中或建议出现后继续编辑草稿时，前端会立刻收起旧建议并重新 debounce 请求；旧草稿版本返回的响应会被丢弃，避免插入过期回复。
- 如果宿主编辑器直接替换 contenteditable DOM、没有正常派发 `input` 事件，Compose Assist 在下一次输入框重扫时也会比较当前草稿和 active session；发现草稿已静默变化时会提升草稿版本、清掉旧建议并重新请求，不把旧建议留到用户点击插入时才拦截。
- 点击 icon 或复核态确认插入前，前端会重新读取当前输入框并校验它仍是生成建议时的草稿版本；如果草稿已变化但页面没有正常发出 input 事件，Personal AI 会显示 `草稿已变化`，不写入旧建议、不发送、不提交，也不记录 accepted 学习信号。
- 建议框右上角有小 thumb-down。按钮 hover / 读屏先说明这次只隐藏当前建议、让当前 surface 更谨慎、尝试提交脱敏 `wrong` 校准信号；不会发送/提交草稿、删除来源记忆或静默其他输入框。点击后隐藏当前建议，显示短回执说明“当前场景会更谨慎”，并降低后续同类低质建议的出现概率；换一个 prompt / 草稿仍会重新判断，不把一次拒绝扩散成全局静默。
- 如果建议包含 Rehearsal 预演提醒，thumb-down 会尝试把对应 activation 标记为 `irrelevant`。短回执会拆开显示“命中线索 / 当前 surface 调阈 / 预演降权写入状态 / 脱敏校准写入状态”：写入成功后才说相同场景后续会降权；如果 background、网络或 Memory Service 拒收，会保留“已隐藏 + 本地调阈已尝试”，但明确说明预演降权未写入。插入且撤销窗口结束后会标记为 `accepted`，完成回执会把预演使用反馈写入状态和 inserted 脱敏校准状态分开，避免同一条有效预演在相同场景里反复被当作未确认。
- 普通预览态按 `Escape` 或点击 thumb-down 会 dismiss 当前 context，一段时间内不再重复展示同一条；锁定复核态的 `取消` / Escape 只退出复核，不写入、不学习为拒绝。
- Web AI 输入框里的 dismiss 会把当前草稿也纳入 context key；拒绝“第一个 prompt”的建议后，在同一个 ChatGPT / 豆包 / Claude / Gemini 页面改写成另一个 prompt，仍可重新触发来源适配、context pack 或 prompt patch。

### Web AI / Agent Compose 关键逻辑

这部分是 Compose Assist 里的“跨 AI/agent 上下文接力”，不是独立 AI Tool Compass，也不会自动调度外部 agent。

- `compose_to_ai`：ChatGPT、Gemini、Claude、豆包等 Web AI 输入框。用户已经准备问外部 AI 时，Personal AI 在输入框旁提供可插入 context pack 或 prompt patch。
- `agent_compose`：预留给后续 Codex、Claude Code、Cursor 等 agent 入口。v1 先把这些 CLI agent 当作上下文来源，不在终端或 IDE 输入框里做浮层。
- 触发必须同时满足三点：当前输入框或会话能识别明确任务意图；其他 AI/agent/记忆中有高相关证据；生成内容不会直接外发高风险私密原文。
- context pack 默认包含 `任务判断`、`目标工具适配`、`相关上下文`、`约束`、`仍需确认`、`来源`。来源保留 evidence 索引，方便用户知道哪些内容来自本地记忆。
- prompt patch 是同一个 Web AI 插入入口的补丁模式，`suggestionType='prompt_patch'`。当用户已经写了“帮我做 Jira roadmap board / 分析 Jira estimate / 设计自动运行”等明确任务，但草稿缺少数据源、输出格式、写回边界、验证方式或失败回执时，后端不会再生成一整包泛上下文，而是输出一段可插入当前 prompt 的结构化补丁。补丁必须包含“来源处理”，明确只使用 Personal AI 记忆摘要，不要求用户外发内部链接、群消息原文、附件或 secret。
- Jira estimate 这类短 Web AI prompt 会在召回 query 前置 Task Estimate workflow hint，例如 `team field`、`Summary`、`Description`、`Issue type`、`Historical Story Points benchmark`、`missing reason / low confidence reason`、`Google Sheet dry-run` 和 `not Jira writeback`，避免只命中泛泛的 Sheet/estimate 记忆而漏掉真正的估算口径。
- 如果 `contextExpansion.contextMatch` 已经锁定到 Jira estimate workflow，但 visible recall matches 被 attention budget 静音，后端可以把 locked context 生成一条 `source_memory` fallback evidence；fallback 只在 Web AI + Jira estimate prompt patch 意图同时满足时启用，不影响普通 context pack。
- 当前 deterministic v1 先覆盖高频任务：Codex Sites/Jira roadmap 或 release-risk dashboard、Jira estimate 分析、AI Service 自动运行边界。后续新增任务类型时必须补同级 API 测试和 `compose-assist` eval case。
- 目标工具适配只是轻判断：当前 AI 是否够用，如果不完全适合，提示一个更适合的备选，例如 Codex、NotebookLM、Claude Code 或 Jira/项目面板。它不做完整工具排名，也不替用户切换工具。
- Web AI context pack / prompt patch 默认 `riskLevel=medium`、`previewRequired=true`。命中 personal/private/user_core/1:1/内部会议等内容时升为 high，高风险内容默认摘要化，不插入原文。
- 低置信、弱相关、无明确任务时保持安静；有建议时只显示 Personal AI icon，不自动发送 prompt。

## 自适应阈值与反馈

Compose Assist 的展示阈值是输入框 surface 自己的 UI gating，不影响 Today Pilot 会前准备。

配置：

- 功能开关：`chrome.storage.local.envConfig.COMPOSE_ASSIST_ENABLED`，同时受父级 `CONTEXT_ASSIST_ENABLED` 控制。
- 全局兜底存储：`chrome.storage.local.envConfig.COMPOSER_GUARD_CONFIDENCE_THRESHOLD`
- 分 surface 自适应存储：`chrome.storage.local.envConfig.COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS`
- 默认值：`0.78`
- 下界：`0.62`
- 上界：`0.92`

反馈：

- 用户点击 icon 插入建议，记录 `accepted`，当前 surface 的阈值按“距离下界的剩余空间”非线性下降。前几次下降更明显，越接近下界下降越少。
- 用户点击 thumb-down，记录 `rejected`，当前 surface 的阈值按“距离上界的剩余空间”非线性上升。前几次上升更明显，越接近上界上升越少。
- thumb-down 按钮自身和点击后的短回执都保留同一个边界：当前建议只是在本地隐藏、当前 surface 后续更谨慎，会尝试提交脱敏 `wrong` 校准信号；不会发送/提交草稿、删除来源记忆或关闭其他输入框建议，也不展开反馈表单或阻断用户继续输入。
- thumb-down 回执会单独显示调阈保存状态：先显示“调阈保存中”，保存后显示具体 surface 阈值从多少调到多少，并说明只影响这个输入框 surface；如果 storage 写入失败，回执会说建议已隐藏但谨慎度可能不会保留。
- thumb-down 回执会跟随后端校准写入状态更新：先说明脱敏校准信号正在提交；成功后显示“校准已写入，只保存脱敏校准信号”；如果后台隐私门、网络或 Memory Service 拒收，则显示“建议已隐藏，但校准未写入”，避免把本地隐藏误读成已经完成学习。
- surface 指 `ringcentral_message`、`ringcentral_thread`、`jira_issue`、`chatgpt`、`doubao`、`claude`、`gemini` 等输入框场景。某个 Web AI prompt 被拒绝，只会让同类 Web AI surface 更谨慎，不会让 RingCentral / Jira 回复助手全局变安静。
- 反馈事件存储在 `chrome.storage.local.composerGuardFeedbackEvents`，最多保留最近 100 条，并记录 `thresholdScope` / `thresholdSurface` 方便排查是哪类输入框在调阈值。
- 当 evidence 类型是 Rehearsal 时，Compose Assist 会复用 background 的 `CONTEXT_RECALL_FEEDBACK` 通道，把正向反馈写成 `/rehearsals/:id/feedback outcome=accepted`，负向反馈写成 `outcome=irrelevant`，并携带 `activationId`。thumb-down 回执会先显示“预演降权写入中”，再根据该通道返回结果更新为“已写入”或“未写入”，避免把本地隐藏误读成后台已经降权。
- 插入后如果用户继续改写并发送，Compose Assist 会在原网页 Send / Submit / Reply 动作上生成无感校准 trace。trace 只包含 redacted diff summary、evidence id、场景 key 和行为类型，不保存完整发送文本。
- 如果用户插入后没有撤销也没有立刻发送，撤销窗口结束时会提交 `action=inserted` trace，并把提交状态显示在同一个低打扰回执里；失败时只说明校准未写入，不把本地草稿保留冒充成后台已经学习。
- 用户实际停留查看 hover 预览或键盘聚焦预览、但没有插入，随后自己发送回复时，才会记录 `sent_without_insert` trace，并短暂显示未插入校准回执；回执说明这只校准建议时机/措辞，不会全局静默当前 surface、不会发送/提交额外内容、不会删除来源记忆，也不会保存完整草稿。只是鼠标快速扫过 icon，或键盘 Tab 快速经过 icon 后立刻回到输入框，不算看过建议。
- thumb-down 除了调整前端阈值，也会写入 `wrong` trace，作为强负向校准信号。
- 如果建议来自 Cue Compiler，`accepted/rejected` 本地反馈事件、结构化 evidence feedback 和 ambient calibration trace 都会携带 `cueIds`、`cueKeys`、`cue_id` 或 `cue_key`。Outcome Loop 因此能区分“某条记忆被用过”和“某一句 draft_hint cue 被插入、发送、改写或标记不相关”。
- 同一句 `draft_hint` cue 重复出现 `sent_after_insert` 时，后端会生成可撤销的 `boost` policy patch；达到稳定成功阈值后，还会向 Personal Skill Foundry 写入 `Estimate wording helper` suggestion，供用户决定是否提升为正式 skill。
- 发送前改写会额外抽取 `styleFeatureTags`，例如“用户加了哈哈”“句尾用了 ~”“删掉了夸张热情话术”“把同意图压短”。这些 tag 只描述改写方向，不保存原文。
- 如果后续其他入口能捕捉到对方反馈“AI 味”，可以写入 `downstream_reaction` + `ai_tone_called_out`，作为强风格修正证据。
- 如果用户已经点 thumb-down，或在普通预览态按 Escape 显式关闭当前建议，前端会清掉这次预览候选；后续发送自己的回复不会再追加 `sent_without_insert`，避免同一次拒绝被重复算成显式负向和隐式负向。锁定复核态的 `取消` / Escape 只是回到轻量预览，不清掉候选。

设计原则：

- 不默认弹出反馈表单，避免反馈输入膨胀。
- 当前只收集低负担二元信号：插入代表“这条有用”，thumb-down 代表“这条不该出现”。
- 更细的校准优先藏在用户自然动作里：插入、改写、发送、hover 后不用、撤销和 thumb-down。
- 如后续需要诊断质量问题，可以在事件 schema 上扩展可选 reason，例如 `irrelevant_memory`、`wrong_tone`、`too_sensitive`、`already_answered`，但 UI 上应按需二级展开，而不是每次打断用户。

2026-07-03 复查 [Gmail Smart Compose 个性化控制](https://support.google.com/mail/answer/9116836)、[Outlook suggested replies 关闭入口](https://support.microsoft.com/en-us/outlook/how-do-i-turn-off-suggested-replies)、[Smart Compose 论文](https://arxiv.org/abs/1906.00080) 和 [Interaction-Required Suggestions](https://arxiv.org/abs/2504.08726) 后，本轮把键盘可访问路径的被动校准收紧：keyboard focus 需要像 hover 一样停留超过观察门槛才算“看过建议”，快速 Tab 经过不会生成 `sent_without_insert`，避免把无意焦点移动当成写作偏好学习。

2026-07-03 复查 [RingCentral AI Writer](https://support.ringcentral.com/article-v2/Using-AI-to-write-and-improve-messages-in-the-RingCentral-app.html?brand=RingCentral&language=en_US&product=RingEX)、[Atlassian Intelligence / Rovo Jira 内容生成](https://support.atlassian.com/organization-administration/docs/atlassian-intelligence-features-in-jira-software/)、[Jira Service Management Draft Reply](https://support.atlassian.com/jira-service-management-cloud/docs/draft-replies-for-your-customers-using-atlassian-intelligence/)、[Copilot in Outlook 草稿复核](https://support.microsoft.com/en-us/outlook/copilot-pages/draft-an-email-message-with-copilot-in-outlook) 和 Interaction-Required Suggestions 后，本轮继续不增加大面板或发送自动化；直接插入最该补的是编辑意图保真：用户在原输入框选中了要替换的片段，即使复核按钮拿到焦点，确认插入也应回到原选区，不把建议追加成第二段。

2026-07-07 复查 Gmail Smart Compose、Copilot in Outlook、Smart Compose 论文和 Interaction-Required Suggestions 后，本轮不扩大为自动发送或常驻大面板；直接插入后的关键是把用户控制权说完整。插入成功态现在明确 `约 10 秒内可撤销`，避免 `撤销` 按钮看起来像长期恢复承诺；窗口结束后才进入 accepted / inserted 校准回执。

2026-06-04 复查行业产品和研究后的建设性取舍：[Gmail Smart Compose](https://support.google.com/mail/answer/9116836) 把建议做成输入中的轻量补全，支持开关、个性化和反馈；[Outlook suggested replies](https://support.microsoft.com/en-us/office/use-suggested-replies-in-outlook-19316194-0434-43ba-a742-6b5890157379) 保留关闭入口、反馈入口，并让用户发送前可编辑；[Grammarly tone suggestions](https://support.grammarly.com/hc/en-us/articles/10674801783309-How-do-Grammarly-s-tone-suggestions-work) 是句子级接受，不直接替用户发送；[Google Smart Compose 论文](https://research.google/pubs/gmail-smart-compose-real-time-assisted-writing/) 强调 real-time、低打扰和高质量 serving；[GhostWriter](https://arxiv.org/abs/2402.08855) 与 [Interaction-Required Suggestions](https://arxiv.org/abs/2504.08726) 都强调 personalization、agency 和 fine-grained control。因此 Compose Assist 当前不增加常驻反馈表单，而是把反馈学习压进插入/拒绝/改写/发送路径，并把阈值按 surface 分开学习，避免一个场景的拒绝污染另一个场景。2026-06-08 复查 [Outlook suggested replies](https://support.microsoft.com/en-us/office/use-suggested-replies-in-outlook-19316194-0434-43ba-a742-6b5890157379)、[Google Smart Compose 介绍](https://research.google/blog/smart-compose-using-neural-networks-to-help-write-emails/) 和 [Smart Compose 论文](https://research.google/pubs/gmail-smart-compose-real-time-assisted-writing/) 后，保留“反馈低摩擦但可见”的取舍：thumb-down 不弹表单，但要给用户一个阈值学习回执，避免用户不知道系统是否真的变谨慎。2026-06-06 复查 prospective memory / implementation intention 研究后，对 Rehearsal-backed 建议额外要求复核态展示 cue 对应的行动脚本：用户确认的是“这个未来场景动作是否仍适合当前回复”，不是只确认一条来源是否相关。2026-06-10 复查 Gmail / Outlook 的写作建议控制、GhostWriter 的隐式风格学习和 AI 写作 agency 研究后，本轮继续不新增校准表单；更重要的是把隐私门做硬：即使客户端把完整句子误塞进 `redactedDiff.previewText` 这类泛用字段，后端也会拒收，并在成功响应里返回 `calibrationReceipt` 说明只存 hash、长度、tag 和证据引用。2026-06-18 复查 [Microsoft Copilot in Outlook](https://support.microsoft.com/en-us/office/draft-an-email-message-with-copilot-in-outlook-3eb1d053-89b8-491c-8a6e-746015238d9b)、[Grammarly suggestion review](https://support.grammarly.com/hc/en-us/articles/360003474732-Grammarly-Editor-user-guide) 和 AI writing assistant 影响态度的研究后，插入后的成功态继续强调“写入的是哪个草稿、没有提交/发送、撤销后才学习”，让用户接受建议时保留清晰 ownership。2026-06-21 复查 [Gmail Smart Compose personalization](https://workspaceupdates.googleblog.com/2019/04/gmail-smart-compose-personalization.html)、[Outlook Suggested Replies controls](https://support.microsoft.com/en-us/office/use-suggested-replies-in-outlook-19316194-0434-43ba-a742-6b5890157379)、Smart Compose 论文和 Interaction-Required Suggestions 后，本轮继续保持低打扰反馈，但把 thumb-down 后的调阈保存结果做成可见回执：用户不需要进设置或日志，也能知道这次拒绝只提高当前 surface 阈值、没有让其他输入框全局静默。2026-06-22 复查 [ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt)、[context-aware reminder authoring](https://arxiv.org/abs/2605.23085) 和 implementation intentions / prospective memory 研究后，Rehearsal-backed Compose Assist 不新增大面板；锁定复核里补充 `提示资格`，让用户在插入前知道这是强 active 提示，还是 stale / 弱提示 / 过期提示。2026-06-25 复查 Gmail Smart Compose、Copilot in Outlook 和写作助手 agency 研究后，本轮补的是确认插入前的旧草稿防线：自动补全/草稿建议必须让用户保留最后编辑权，建议一旦不再对应当前输入，就宁可不写入并显示未发送边界。2026-06-26 复查 Gmail Smart Compose 个性化、Copilot in Outlook 草稿复核和 Interaction-Required Suggestions 后，插入后的学习也必须保留 agency：撤销窗口结束只代表用户保留了草稿，不代表已经发送；因此回执要同时说明未发送/未提交和后台校准是否真正写入。2026-06-27 复查 [Gmail Smart Compose 控制](https://support.google.com/mail/answer/9116836)、[Copilot in Outlook 草稿复核](https://support.microsoft.com/en-us/outlook/copilot-pages/draft-an-email-message-with-copilot-in-outlook)、[Grammarly suggestion review](https://support.grammarly.com/hc/en-us/articles/360003474732-Grammarly-Editor-user-guide)、[Smart Compose](https://arxiv.org/abs/1906.00080) / [Smart Reply](https://arxiv.org/abs/1606.04870) 和 [Interaction-Required Suggestions](https://arxiv.org/abs/2504.08726) 后，本轮不增加二级原因表单；更重要的是把“用户反馈造成了什么持久后果”拆清楚：本地隐藏、surface 调阈、Rehearsal activation 降权和 ambient calibration 是四条不同写入路径，回执必须分别显示成功或失败。

### 无感校准 trace

Compose Assist 是 Ambient Calibration 的首个采样点。它不新增可见 UI，也不要求用户打开校准平台。

采样规则：

| 用户行为 | trace action | 解释 |
| -------- | ------------ | ---- |
| 插入建议且撤销窗口结束 | `inserted` | 建议至少值得进入草稿，作为中等强度正向信号 |
| 插入建议后直接发送或仅轻微追加 | `sent_after_insert` | 记忆匹配和措辞大概率都正确 |
| 插入建议后发送前改写 | `edited_before_send` | 记忆匹配可能正确，但措辞、范围或细节需要学习 |
| 插入建议后删除/完全改写再发送 | `deleted_before_send` | 召回或建议可能不适合当前场景 |
| 停留查看 hover 预览或键盘聚焦预览超过观察门槛，但不插入，随后发送自己的回复 | `sent_without_insert` | 预览被看过但没被采用，结合最终文本相似度判断是措辞问题还是召回问题 |
| thumb-down | `wrong` | 用户明确认为这类建议不应出现 |
| 对方后续反馈“AI 味” | `downstream_reaction` | 不是用户主动改写，但说明这类措辞在当前关系/场景里需要降级 |

`sent_without_insert` 只代表停留看过预览或键盘聚焦预览超过观察门槛后继续自行发送；如果用户只是快速扫过 icon、短暂 Tab 聚焦后离开，或已经用 thumb-down、取消或 Escape 明确处理了建议，本次预览不会再产生这条被动 trace，避免把一次拒绝或误触重复计数。提交被动 trace 后会复用短回执显示 pending / 已写入 / 重复 / 失败状态，防止用户把“自己发送了回复”误读成 Personal AI 上传了原文或已经全局关闭建议。

thumb-down 的可见反馈还会暴露校准投递状态：本地隐藏与阈值调整会立即生效，但后端 `wrong` trace 必须拿到 background / Memory Service 回执后才显示为已写入。失败时回执保留“已隐藏，但校准未写入”的边界，用户不会误以为后台已经学到了这次拒绝。

前端只上传这些 redacted 字段：

- `suggestionHash`、`finalHash`
- 建议/最终文本长度
- similarity score 与 edit distance band
- `same_intent`、`partially_rewritten`、`different_intent` 等语义关系摘要
- `styleFeatureTags`，例如 `casual_opening_haha`、`tilde_suffix`、`same_intent_shorter_form`、`removed_over_enthusiastic_claim`
- evidence id、type、title、role、score
- cue id、actionType、compileStatus、confidence、whyNow（只记录 cue 摘要，不记录 cue 正文到 trace evidenceRefs 之外的原始发送文本）
- scene key、surface、scenario、context type、confidence

正式入口：

```http
POST /api/v1/ambient-calibration/traces
```

后端会递归拒绝 `redactedDiff` 和 `metadata` 中出现的 `rawText`、`finalText`、`suggestionText`、`composerText` 等原文字段；`rawTextStored:false` 这类布尔证明字段允许保留。`redactedDiff` 还会拒绝疑似原文的长句、URL 和邮箱，即使字段名不是 raw/final/suggestion。重复 `id` 的 trace 不会新增写入，回执里的 `stored=false` 用于排查重试/重复上报，而不是把忽略写入误报为成功新增。成功响应会带 `calibrationReceipt`，列出隐私等级、证据数量、cue 数量、style signal 数量、redacted diff key 和 `hashes_lengths_tags_and_evidence_refs_only` 边界。

这条 trace 当前用于后续召回调权、诊断、eval 数据沉淀和写作风格学习；不会把最终发送文本直接入库。

### 写作风格记忆学习

这个能力解决的是：Compose Assist 可能记忆找对了，但写出来不像用户本人，甚至显得“AI 味”。系统不要求用户额外填写“我喜欢什么风格”，而是从用户真实改写里学习。

大白话逻辑：

1. 用户插入建议后改写并发送，前端只上报 redacted diff 和风格 tag。
2. 后端把这些 tag 聚合到 `user_writing_style_memories`，按 surface、受众、任务、语言和可选人物关系分 scope。
3. 单次改写只作为候选信号；同类证据重复出现，或多次出现 `ai_tone_called_out`，才晋升为稳定写作风格。
4. 晋升后写入 `user_profile_items` 的 `writing_style.*` 条目，并渲染进 `USER_CORE.md` 的 `## Writing Style` 区域。
5. 下一次同类 compose 会把匹配的 `writing_style.*` 作为 `owner writing style hints` 注入 prompt，影响语气、长度、结构和禁用话术。

关键 scope：

| Scope | 例子 | 用途 |
| --- | --- | --- |
| surface | `ringcentral`、`jira`、`ai_chat` | 同一个用户在聊天、Jira、AI prompt 里的表达不同。 |
| audience | `peer`、`manager`、`external` | peer 同事聊天可以更松，客户/上级场景不能照搬。 |
| task | `casual_reply`、`status_update`、`jira_comment` | 闲聊回复、状态同步和 issue comment 的结构不同。 |
| language | `zh`、`en`、`mixed` | 中文里的“哈哈”“~”不能直接迁移成英文规则。 |
| relationship | `person_<stable_slug>` | 某个熟人/群的固定表达习惯可以比通用 peer 规则更强。 |

当前可学习的风格规则示例：

- 正向：中文轻松聊天里可以自然用“哈哈”开场；关系轻松时可以偶尔用句尾 `~`；同意图优先压短。
- 负向：避免“我最喜欢聊了”这类夸张自我表态；避免“到时候看你具体想了解哪块”这类泛泛未来承诺；避免“咱们一起捣鼓下”这类表演式协作套话。
- 对方反馈“AI 味”时，降低过度热情、泛泛承诺和排比式客套。

隐私边界：

- 写入画像的是“风格规则”，不是用户最终发送的原句。
- `USER_CORE` 中允许出现概括规则和被避免的话术类别，但不复制完整发送文本。
- 这种写作风格条目来自用户真实发送行为的重复证据，不是纯 LLM 猜测；它仍有 scope、confidence、evidence，可被后续校准或撤销。

## 上下文提取

Compose Assist 使用 `SiteContextAdapter` 把不同网站归一成 `SiteContextSnapshot`。新 adapter 应优先产出结构化 `contextItems`，旧字段 `primaryText`、`visibleMessages` 只作为兼容。

### RingCentral

主会话回复框：

- 只读取当前会话底部可见近期消息，默认最多 8 条。
- 不读取隐藏缓存卡片。
- 不混入打开的 thread reply tree。
- 传入 `conversationId`、`groupId`、conversation title、visible senders。
- 可见附件/图片只传页面已有 metadata，例如文件名、alt/title/url，不上传二进制。

Thread 回复框：

- 只读取 thread root + 当前 thread 可见回复，默认最多 12 条。
- 不混入主群底部消息。
- `thread_root` 必须进入 `contextItems`。
- 前端用当前命中的输入框判断 main/thread snapshot，避免焦点状态变化时把 thread 回复误当主会话回复。

自我发言识别：

- adapter 会尽量从 RingCentral 本地账号信息、profile DOM、sender/avatar id 判断 `metadata.isSelf`。
- 后端会检查最近上下文末尾是否已经有 owner 回复。
- 如果 owner 已完整回复，返回 `available=false`，避免重复提示。
- 如果 owner 已回复但可能不完整，生成内容必须是补充说明，不能重复前面已发内容。

### Jira

- 读取 issue key、summary、status、description。
- 读取可见 comments、assignee/reporter/commenters。
- 读取可见附件/图片 metadata：文件名、alt/title/url。
- Jira comment composer 通过当前 focus 元素及其附近的 Atlassian comment / add-comment 容器识别；如果 focus 落在嵌套 ProseMirror、role textbox 或 comment 容器内，也应能挂载 Compose Assist icon。icon 只有在后端返回可插入建议且 confidence 达到当前 surface 阈值时显示。
- Jira 场景会同时传 `visibleFields` 和 `interactionScene.visibleFacts`，让后端区分“用户只是在 issue 页面看已经显示的 DEV Estimate New=0.4”和“用户正在 comment 输入框里讨论这张票的估算口径”。前者不应复述字段，后者可以生成可插入的估算口径草稿。
- Phase 1 不做截图、OCR 或上传图片 binary。
- 输出语气应更正式，包含判断、依据或 next step，不能像即时通讯闲聊。

### Web AI

- 覆盖 ChatGPT、豆包、Claude、Gemini 的网页输入框。
- 读取当前页面可见的最近 conversation turns，默认不 live 抓取完整外部平台历史。
- 召回来源可以包含已沉淀的 `ai_chat`、`chatgpt`、`doubao`、`doubao_chat`、`codex_cli`、`claude_code_cli`、`cursor_agent_cli`、`glip`、`jira`、`meeting`、`calendar`、`web`、`manual`、`source_memory`、`system`、`user_core`、`markdown`、`reflection`、`reflection_thread`、`rehearsal`。
- 当前目标 provider 自己的 source 会先在前端 allowlist 移除，后端再做兜底过滤。例如 ChatGPT 页面默认不把 `chatgpt` 历史作为“跨 AI”证据，豆包页面默认不把 `doubao` / `doubao_chat` 作为跨 AI 证据。
- 输出是可插入到 prompt 输入框的 context pack 或 prompt patch，不自动提交。

### CLI agent 会话作为上下文来源

Desktop App Explorer 不把 Codex/Claude Code/Cursor 入口当作网页输入框，而是把它们的会话记录抽成可召回记忆。

本地 adapter 默认路径：

- `codex_cli`: `${CODEX_HOME:-~/.codex}/sessions/**/*.jsonl`
- `claude_code_cli`: `~/.claude/projects/**/*.jsonl`、`~/.claude/transcripts/**/*.jsonl`
- `cursor_agent_cli`: `~/.cursor/projects/*/agent-transcripts/**/*.jsonl`

这些 source 默认 disabled，需要用户在 Desktop App 设置里启用；配置项包括 `rootPaths`、`lookbackDays`、`intervalMinutes`、`maxSessions`、`includeSubagents`、`defaultScope`。

agent 会话不能按普通聊天全文入库。`agent_session` 抽取模式会先过滤大段代码、diff 和 tool output，只保留：

- 用户想让 agent 做什么。
- agent 做出的结果。
- 修改过的关键文件或生成的 artifact。
- 测试、构建、验证信号。
- 失败、阻塞和下一步。
- `tool_fit_signal` / `tool_usage_outcome`，例如这个工具是否适合该任务、是否失败、是否切换到别的工具。

入库时 `source_type` 使用规范来源：`codex_cli`、`claude_code_cli`、`cursor_agent_cli`。metadata 里记录 `toolKey`、`sessionId`、`projectPath`、`taskKind`、`producedArtifacts`、`verificationSignals`。

## 上下文来源与权重

当前代码没有按 memory source type 配置固定百分比权重，例如不存在“Glip 40%、Jira 20%、Meeting 20%”这种静态配比。Compose Assist 的实际逻辑分成三层：当前场景上下文决定 query，历史记忆 evidence 通过 recall/rerank 得分进入候选，生成 prompt 再按固定数量截断。

大白话说，Compose Assist 最先看“你现在到底在给谁、围绕什么上下文写东西”，然后才去记忆库里找能帮你补充的历史信息。影响建议内容的强弱大致是：

1. 当前输入框所在场景影响最大：RingCentral 最近可见消息、thread root、Jira issue 描述/comment、Web AI 当前 prompt 是主语境。
2. 同会话/同 issue/同 thread 的锚点很强：conversationId、groupId、threadRootPostId、issueKey 命中时，相关记忆更容易通过过滤。
3. 具体主题词比泛词更重要：Codex、MCP、某个 Jira key、预算/额度/上线风险这类具体词，会比“AI”“会议”“消息”更能影响召回。
4. 最近、常用、被正向反馈过的记忆会加分：recency、salience、用户点击插入等信号会让相关记忆更容易排前。
5. 用户草稿按场景区分：RingCentral/Jira 里影响较弱，主要用于避免重复或承接语气；Web AI `compose_to_ai` 里影响更强，会作为短 prompt enrichment signal 帮系统判断用户要把什么问题带给外部 AI。
6. 用户画像主要影响表达方式：已确认偏好、约束、写作风格会影响语气和格式，但不应把未经确认的画像当事实写进回复。

### 当前场景上下文

这部分来自页面 adapter，是生成回复的主语境，也是召回 query 的主要来源。

| 来源 | 用途 | 当前限制/权重 |
| --- | --- | --- |
| `contextItems` | 优先的结构化上下文。RingCentral 是可见消息/thread root/replies/附件 metadata；Jira 是 summary/description/comments/attachments metadata；Web AI 是最近可见 turns。 | 召回主 query 最多取 12 条；生成 prompt 最多取 14 条。超过上限时取尾部最近项；如果有 `thread_root`，固定保留 root，再取最近尾部。 |
| `primaryText` | 兼容旧调用；当没有 `contextItems` 时作为 fallback。 | 召回主 query 最多 1600 chars。前端 RingCentral/Jira/Web AI 构造时最多 1800 chars。 |
| `secondaryTexts` | 召回辅助文本，主要补 thread root、status、最近 turns 或旧字段。 | 后端从 context items 取最多 8 条文本，再叠加请求里的 `secondaryTexts`，总数最多 10；进入 `ContextRecallService` 时最多保留 8 条，每条最多 160 chars。 |
| `audience` | 生成 prompt 里的“对象”，用于语气/对象判断；conversation/group/issue/provider 也会转成 entity hints。 | 不直接拼进 recall `primaryText`，但会通过 `entityHints` 影响 recall anchor；生成 prompt 中以一行“对象”出现。 |
| `identifiers` | conversationId、groupId、threadRootPostId、issueKey、provider。 | 转成 recall `entityHints`，并在 evidence 过滤时作为 source anchor；不是百分比权重，而是强相关锚点。 |
| `draftText` | 用户当前草稿。 | RingCentral/Jira 不作为主召回 query，主要用于避免重复或承接语气；Web AI `compose_to_ai` 会作为短 prompt enrichment signal 进入 recall query、目标摘要和 context key。 |

### 允许召回的历史记忆来源

`sourceTypes` 是 allowlist，不是权重表。前端 adapter 会按场景传入允许来源；后端只在这些来源中跑 fast recall。

| 场景 | 前端传入的 `sourceTypes` | 说明 |
| --- | --- | --- |
| RingCentral 主会话/thread | `glip`, `manual`, `source_memory`, `markdown`, `web`, `jira`, `system`, `user_core`, `reflection`, `reflection_thread`, `rehearsal` | 以当前聊天上下文为主，允许补充手动沉淀、资料胶囊、文档、网页、Jira、系统/画像、反思线程和预演提醒；仍不把 `meeting/calendar` 放进 RingCentral allowlist，避免会话回复被日程/会议泛背景稀释。 |
| Jira comment | `jira`, `glip`, `meeting`, `web`, `manual`, `source_memory`, `system`, `user_core`, `reflection`, `reflection_thread`, `rehearsal` | 以 issue 本身为主，允许关联 Jira 历史、聊天、会议、网页、手动沉淀、资料胶囊、系统/画像、反思线程和预演提醒。 |
| Web AI prompt | 基于 `ai_chat`, `chatgpt`, `doubao`, `doubao_chat`, `codex_cli`, `claude_code_cli`, `cursor_agent_cli`, `glip`, `jira`, `meeting`, `calendar`, `web`, `manual`, `source_memory`, `system`, `user_core`, `markdown`, `reflection`, `reflection_thread`, `rehearsal` 动态裁剪 | 允许更广的 Personal AI 记忆进入 context pack 或 prompt patch，但仍只插入到输入框，不自动提交；前端会先剔除当前目标 AI 自己的来源，例如 ChatGPT 页面不传 `chatgpt`，豆包页面不传 `doubao` / `doubao_chat`，后端仍保留二次过滤。 |
| 旧调用或未传 `sourceTypes` | 非 Web AI 默认 `WORK_SOURCES`；Web AI 默认 `WEB_AGENT_SOURCES`。 | 这是后端 fallback。若前端已传 allowlist，后端会在对应默认集合中再过滤。 |

### Recall 与 rerank 权重

Compose Assist 复用 `ContextRecallService` 的 fast path，不跑 LLM recall。当前权重来自 recall 通道和二次 rerank，而不是来源类型本身。

| 阶段 | 规则/权重 |
| --- | --- |
| Recall 通道 | 只启用 `vector + fts`；不启用 graph/time。Compose Assist 默认最终返回 3 条；`ContextRecallService` 会先 over-fetch `3 * 6 = 18` 条交给 `RecallEngine`，`RecallEngine` 每个通道再 over-fetch `18 * 3 = 54` 条。 |
| Vector 初始分 | `1 / (1 + distance)`。 |
| FTS 初始分 | `abs(rank) / maxAbsRank`。 |
| 多通道命中 bonus | 同一候选同时命中多个通道时保留最高分，并加 `0.05 * (channels - 1)`，最高不超过 `1.0`。 |
| MMR relevance | `baseScore + 0.15 * recencyScore + 0.10 * salienceScore`。 |
| MMR 选择分 | `0.7 * relevance - 0.3 * similarityToSelected`，用于在相关性和多样性之间平衡。 |
| Context rerank 加分 | specific signal overlap 每个 `+0.08`，最多 `+0.32`；anchor overlap 每个 `+0.07`，最多 `+0.28`；topic/project overlap `+0.08`；source overlap `+0.05`；部分成本/额度/工具类信号还有额外 `+0.06` 到 `+0.12`。 |
| Context rerank 扣分 | 有具体 query signal 但候选无 overlap `-0.28`；工具类 query 没有工具 overlap `-0.18`；off-domain signal mismatch `-0.20`；工具 query 且 off-domain mismatch `-0.22`；具体 signal 存在但无 anchor overlap `-0.14`。 |
| 隐藏规则 | 广播/公告类内容无场景 anchor、低信息标题无 anchor、具体 query 无 overlap 且低分、工具上下文 off-domain mismatch 等会被标成 `hidden`，不会进入最终 evidence。 |

### Compose 专属 evidence gate

Recall 返回后，RingCentral/Jira 还会再做一层场景相关性过滤：

- Rehearsal 命中是“预演提醒” evidence，不是普通背景记忆。它必须靠人物、群组、issue、URL、meeting、topic 等 scene cue 命中；即使命中也只影响建议内容，不允许自动发送。
- 已经由召回层判定为 `rehearsal_cue` 的 Rehearsal 不再被普通文本 overlap 二次过滤误杀，因为这类提醒的相关性来自场景线索，不一定来自当前消息正文复述。
- Rehearsal evidence 会把 `previewRequired` 置为 true，即便整体风险仍是 `low`；这是插入前复核边界，不是敏感风险升级。
- Rehearsal 的接受/拒绝反馈会回写到 activation；它不替代本地自适应阈值，而是让具体未来场景脚本能降权或确认有效。
- 非 Web AI 场景必须有当前上下文 tokens，否则不展示。
- evidence 与当前场景 token overlap `>= 2` 才直接保留。
- 如果只 overlap `>= 1`，还必须和 source anchor overlap `>= 1`，例如同 conversation、同 group、同 thread root 或同 issue key。
- Web AI context pack / prompt patch 当前不做 RingCentral/Jira 这层 strict evidence filter，但必须经过任务意图 gate、高相关 evidence gate、目标 provider 自回声剔除和 privacy/egress gate；弱相关或无明确任务时保持安静。
- 通过过滤后，后端 confidence 取 top evidence score，clamp 到 `0.20-0.92`；如果 top score 低于 `0.58` 但有 keyword/FTS 命中，会提升到 `0.62`。后端 `available` 门槛是 `0.58`，前端最终展示门槛默认是自适应 `0.78`。如果后端已经确定返回 `prompt_patch`，会把 response confidence 提升到展示级下限 `0.82`，避免“补丁已识别但前端阈值压掉 icon”。

### 生成 prompt 的内容优先级

真正让 LLM 生成可发送文本时，prompt 中的内容按以下顺序组织：

1. `scenario`：即时通讯回复、thread 回复、Jira comment、Web AI prompt 等，决定语气和结构。
2. `audience`：会话标题、issue key/summary、可见对象、relationship hint。
3. 当前上下文：最多 14 条 `contextItems`，生成 prompt 会带 sender；thread 场景保留 root。
4. 如果检测到 owner 已部分回复，追加“用户已经发送但可能未完成的内容”，要求只生成补充说明。
5. 可用记忆：只放最终 evidence 的前 3 条，格式为 `[M1] snippet`；如果包含 Rehearsal，标为“预演提醒”，优先告诉模型这是未来场景提示而不是已发生事实。
6. 主人表达约束：`USER_CORE` 最多 900 chars；已确认 facts/preferences/constraints 各最多 8 条；场景相关 confirmed writing style hints 最多 8 条；pending style hints 也最多 8 条，但只能当 soft style hint，不能当事实。

写作风格的使用顺序是：关系/人物 scope 更贴近当前输入框时优先；否则退回同 surface + audience + task + language 的通用规则。风格规则只能影响表达方式，不能替代 evidence 事实，也不能把未确认内容写进回复。

## 请求模型

正式入口：

```http
POST /api/v1/composer/assist
```

关键字段：

- `surface`: `ringcentral_message | ringcentral_thread | jira_issue | chatgpt | doubao | claude | gemini | codex_cli | claude_code_cli | cursor_agent_cli | generic_agent`
- `contextType`: `message_thread | jira_issue | web_agent_prompt`
- `scenario`: `instant_message_reply | thread_reply | jira_comment | web_agent_prompt | compose_to_ai | agent_compose | document_note`
- `title`, `url`
- `draftText`: 用户当前输入草稿。RingCentral/Jira 不是主召回 query；Web AI `compose_to_ai` 是短 prompt enrichment signal。
- `audience`: 会话标题、conversation/group id、issue key、visible people、provider 等对象线索。
- `identifiers`: conversation id、group id、thread root post id、issue key、provider。
- `contextItems`: 结构化上下文数组，优先使用。
- `sourceTypes`: 允许召回的记忆来源。
- `automationLevel`: 当前默认 `L1`，只推荐并等待用户确认插入。

响应字段：

- `available`: 是否应该展示建议。
- `suggestionType`: `none | context_pack | prompt_patch | reply_context | issue_context`
- `insertText`: 可插入文本。
- `evidence`: 召回证据，保留 `exploreLink` 和安全来源链接。
- `riskLevel`: `low | medium | high`
- `previewRequired`: 后端风险提示字段。前端会把它作为 review gate：先展开预览，用户确认后才插入。
- `confidence`: 后端建议置信度。前端还会套用自适应展示阈值。
- `queryTimeMs`
- `debug`: 调试信息。Web AI / agent compose 重点看 `taskFrame`、`targetToolFit`、`sourceMix`、`egressRisk`、`relatedAgentSessions`、`promptPatch`、`recall.contextExpansion`。

## API

正式输入框入口：

```http
POST /api/v1/composer/assist
```

无感校准入口：

```http
POST /api/v1/ambient-calibration/traces
```

兼容入口：

```http
POST /api/v1/context-assist
```

当 `surface='composer_guard'` 时，兼容入口仍会委托到 composer 逻辑。

`surface='meeting_prep'` 不再属于 Compose Assist；兼容期内由 Context Assist 兼容层委托到 Today Pilot meeting prep。

Desktop App 会话抽取入口：

```http
POST /api/v1/extractor/from-chat
```

关键新增字段：

- `sourceType`: `chatgpt | doubao_chat | codex_cli | claude_code_cli | cursor_agent_cli | ...`
- `extractMode`: `chat | agent_session`
- `conversationMeta`: provider、session id、project path、tool key、scope 等结构化信息。

`agent_session` 模式用于 CLI agent 会话。它的目标不是保存完整 transcript，而是把“任务意图、执行结果、验证信号、失败阻塞、下一步”抽成后续可被 `compose_to_ai` / `agent_compose` 召回的 compact memory。

## 后端流程

`/composer/assist` 当前由 `ComposeAssistService` 处理，旧类名 `ComposerAssistService` 只作为兼容 wrapper 保留。

处理步骤：

1. 判断 owner 是否已在当前上下文末尾回复。完整回复则直接不展示。
2. 构造 `ContextRecallRequest`。RingCentral/Jira 的主 query 来自当前场景上下文和 audience，不以用户 draft 为主；Web AI prompt 场景会把当前 `draftText` 放在召回 query 最前面，用于短 prompt 补上下文。
3. `ContextRecallService` 走 fast path：`vector + fts`，不跑 LLM，limit 默认 3。
4. 对 RingCentral/Jira evidence 做严格相关性过滤，要求和当前场景有主题、实体或对象 overlap。弱相关的 flight、泛 meeting title、假期公告等应被过滤。
5. 后端可用阈值仍保留低门槛 `0.58`，用于避免完全无关召回进入生成；最终是否展示由前端自适应阈值控制。
6. 用低温短输出生成可发送文本；LLM 超时或不可用时返回 `available=false`，不退化成生硬 bullet 摘录。
7. Web AI 会先判断是否需要 prompt patch：如果当前 draft 已经是明确外部 AI 任务，但缺数据契约、输出列、写回/部署边界或验证方式，返回 `suggestionType='prompt_patch'`，插入一段结构化补丁；否则返回 context pack，附带轻量任务判断和目标工具适配，例如 repo bugfix 更适合 Codex、Jira 状态需回到 Jira/项目面板核对、会前准备优先走 Today Pilot。
8. Jira estimate prompt patch 支持命中 `Story points estimation skills` 或 `task estimate` 这类 source title/snippet，即便当前 evidence preview 只截到线程头，也可用任务意图和来源标题进入补丁模式。
9. Web AI / agent compose metadata 会记录 `taskFrame`、`targetToolFit`、`sourceMix`、`egressRisk` 和 `relatedAgentSessions`，用于 eval 和调试。
10. 对生成文本做 sendable 校验和清理。

## Web AI draft-driven context enrichment

这部分专门覆盖“外发到豆包 / ChatGPT / Claude / Gemini 前帮用户补上下文”，主要对应 `compose_to_ai`。它不放进 Ask / Context Recall 的核心召回流程，也不升级成独立 AI Tool Compass。

目标场景：

- 用户在 Web AI 输入框里只写了一个很短的 prompt，例如“AI VBG 的 BE 部分完成情况如何”。
- 用户知道上下文窗口需要完整信息，但不想手动贴 Jira、Sheet、Slide、RingCentral thread 或历史会议摘要。
- Compose Assist 根据当前输入框草稿、页面可见 AI 对话、provider、当前 URL 和 Personal AI 记忆生成一个可插入 context pack；如果用户已经写了明确任务但缺关键槽位，则生成可插入的 prompt patch。

当前行为：

- `draftText` 在 Web AI 场景提升为 enrichment signal，和页面可见 AI 对话、provider、当前 URL 一起进入 `/composer/assist` 的 recall query；RingCentral/Jira 仍不让 draft 污染主召回。
- 输出仍然是 preview / insert only，不自动提交给外部 AI。
- Web AI 输入框只显示 Personal AI icon/popover，不使用红色发光输入框标识，避免让 ChatGPT/Gemini/Claude/豆包的原生输入体验显得异常。
- context pack 会说明任务类型、当前目标工具是否合适，以及是否有更合适的核对入口；prompt patch 会补齐目标、数据源/依据字段、输出格式、边界、验证或失败回执。这只是插入前提示，不会替用户切换工具或自动打开外部系统。
- context pack 必须保留证据边界：列出引用的本地记忆、source anchor、仍缺的信息，以及不应让外部 AI 当事实的推断。prompt patch 则不再列出来源清单，只保留“来源处理”，避免把内部链接、群消息原文、附件下载链接、source title 或 secret 当作外发材料。
- 复用 `ContextRecallService` 内部的 `RecallContextExpansionService` 做短 prompt 扩写；`debug=true` 时可在 `debug.recall.contextExpansion` 看到 `expandedQuery`、`ambiguity`、`sourceAnchors`。
- Web AI 的 `sourceTypes` 会在前端先排除当前目标 AI 自己的来源，例如在 ChatGPT 页面不会把 `chatgpt` 历史当成“跨 AI”证据；除非是显式 agent compose 场景，否则优先补其他工具、Jira、会议、日历、网页、Source Memory 资料胶囊、手动资料和画像上下文。2026-06-06 复查时已补齐前端 adapter 的 `calendar` allowlist，避免会前/日程线索只存在于后端默认值、但浏览器实际请求漏召回。2026-06-13 复查后，前端 Web AI adapter 也会按当前 provider 裁剪 allowlist；后端过滤仍作为兼容旧调用的兜底。路由和来源裁剪可以留在 debug / report 中，不在 Compose hover 里展示成用户需要复核的内容。
- 如果 prompt 存在歧义，例如“那个 BE ready 了吗”但当前页面没有足够上下文，Context Recall 会返回 ambiguous，不替用户静默选择项目。

## 与 Today Pilot 的关系

Today Pilot 负责“今天要注意什么”和“会议前已经准备了什么”。Compose Assist 负责“此刻这个输入框怎么写得更准确”。

两者可以复用同一套 evidence 与 redaction 原则，但不共享 UI 状态：

- Today Pilot 可以把会议 prep 交给 Video Home / Meeting Pilot。
- Compose Assist 可以把当前输入框上下文和 Today Pilot mission context pack 一起带入生成，但只在用户主动点击时插入。

## 隐私与安全默认值

- 永不自动发送消息、comment 或 prompt。
- 沿用网页记忆检测的敏感页面、密码框、支付/账号/隐私输入 guard。
- 前端不展示来源卡片或记忆详情入口，避免输入框旁的 Compose Assist 变成 Memory Lens。是否展示建议应在后端 evidence 过滤和前端阈值阶段完成；高风险/需预览建议只增加插入前确认，不额外展开 evidence 链接。
- 默认排除明显私人或敏感的一对一记忆，除非用户明确选择来源或后端判断场景安全。
- 即使 response 包含 evidence link，Compose Assist hover popover 也不渲染这些链接。

## 交互参考

本轮调研后保留的产品原则：

- Gmail Smart Compose 适合短补全：低打扰、用户显式接受、可关闭个性化。
- RingCentral AI Writer、Atlassian Intelligence draft reply 和 Outlook Copilot 都把写作辅助放在原生 composer 里，用户仍要最终 review/insert/send；Personal AI 保持相同边界。
- 2026-06-06 复查 RingCentral AI Assistant、Atlassian Intelligence draft reply、Gmail Smart Compose 与 Microsoft Research 写作助手心智模型研究后，建设性方向不是增加一个新的全屏 review 控制台，而是让每个输入框 surface 的来源适配更准：RingCentral/Jira 继续偏当前会话/issue，Web AI context pack 要能带入 Jira、会议、日历和 agent/session 证据，同时保留用户最终编辑和发送权。
- AnchoredAI 和 ContextCite 相关研究都指向同一个 UX 要求：生成内容要能让用户理解上下文来源，尤其是跨工具 context pack，不能只给一段看似完整的答案。
- Grammarly rewrite / Outlook Copilot 的整段候选预览更适合独立写作面板，不适合当前“输入框旁一键插入”的 Compose Assist。
- Compose Assist 的当前原则是低摩擦：低风险 icon 点击直接插入，来源解释交给 Memory Lens / Memory Explore，而不是在输入框旁展开记忆关联；但当后端已经标记需预览或高风险时，交互应增加一次明确确认，避免用户误点后直接污染草稿。
- 本轮补查后保留“插入后继续编辑”的边界：像 Smart Compose / Grammarly / Outlook Copilot 一样，Personal AI 只把建议放进草稿，不越过用户的发送动作；但插入位置必须服从用户当前编辑意图，避免把已有草稿粗暴挪到末尾或覆盖掉未选中的内容。
- 直接插入也要有恢复路径：如果建议进入草稿后用户马上发现不合适，应能在原输入框旁撤销到插入前状态，而不是只能依赖各网站不一定可靠的浏览器 undo 栈。
- 2026-06-06 复查后保留的安全取舍：Gmail / Outlook / Grammarly / Atlassian 这类写作辅助都把建议留在用户可审阅、可编辑、可插入的草稿层；AnchoredAI、ContextCite 和 Interaction-Required Suggestions 的研究也强调 agency、来源可理解和细粒度控制。因此 Compose Assist 对 Rehearsal、high risk 这类跨场景/敏感建议采用前端硬复核；其中 high risk 只在输入框旁给来源类别和置信度，不把具体私密来源名展开成新的泄露面。
- 2026-06-09 到 2026-06-24 的几轮复查曾把 `草稿回执`、`来源路由` 和高风险来源隐藏提示放进输入框旁预览，用来解释写入目标、来源适配和刷新口径。2026-07-08 根据真实 ChatGPT 使用反馈收敛：Compose Assist 的插入入口不承担 Memory Lens 式证据解释，hover / 锁定复核只展示待插入正文；写入目标、未发送/未提交和撤销窗口放在插入后的短回执，来源路由和 evidence 细节保留在 debug / eval report / Memory Lens 中。

## 验证

后端固定验证：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-composer-assist.test.ts src/__tests__/composer-assist-eval.test.ts
```

前端/extension 相关改动：

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/composer-guard/__tests__/ComposerGuardController.test.ts
npm start
node tools/verify-compose-assist-draft-staleness-e2e.mjs
node tools/verify-compose-assist-direct-insert-e2e.mjs
node tools/verify-compose-assist-ambient-calibration-e2e.mjs
```

等待首次 webpack dev compile 成功后停止 watch。

Context pack / prompt patch eval：

```bash
npm run eval:run -- --case compose-assist-web-ai-context-pack-project-orbit --live --no-llm --no-repair
npm run eval:run -- --case compose-assist-web-ai-prompt-patch-jira-estimate --no-llm --no-repair
npm run eval:report
```

这组 eval 用于验证“打开的 Web AI/Codex 会话 + Personal AI 记忆 -> 生成 compose context pack / prompt patch -> 判断是否合理”。`--live` 会优先通过 webpage-mcp/mcporter 查找已打开的相关 Web AI 或 Codex 页面；如果没有匹配 tab，可以回退到 snapshot，但 report 必须显式写出 `collectionMode=snapshot_after_live_failed` 和 live 失败原因。prompt patch case 重点检查用户已经输入信息后仍能通过 Compose icon 插入补丁，且补丁包含依据字段、输出列、写回边界、验证和来源处理。

report 必须能看见：

- 实际使用的 chat/tab 或 snapshot 内容。
- 当前 draft/prompt。
- 请求里的 `surface`、`scenario`、`sourceTypes`。
- 召回到的 evidence、来源 mix 和 debug 信息。
- 最终 `insertText` context pack 或 prompt patch。
- judge 分数、通过/警告/失败原因，以及缺失的关键上下文。

建议保留的回归场景：

- RingCentral 开发小群讨论 Codex/computer use/skills 时，不返回 flight、泛 meeting、假期公告。
- RingCentral thread 只使用 thread root/thread replies，不混入主会话底部消息。
- owner 已完整回复时不展示 icon。
- owner 已部分回复时，只生成补充回答。
- Jira comment 输出正式 comment，不输出即时通讯口吻。
- 同一事实面向老板、开发小群、Jira comment 时语气不同。
- RingCentral/Jira 用户 draft 里的无关关键词不污染主召回。
- Web AI 短 prompt（例如 “AI VBG 的 BE 部分完成情况如何”）能通过 draft 召回并扩写到本地项目上下文。
- Web AI 用户已经输入 Jira estimate、Codex Sites dashboard 或自动运行设计 prompt 后，仍能显示 Compose icon；点击后只插入 prompt patch，补齐依据/数据源、输出格式、写回/部署边界、验证和来源处理，不提交给外部 AI。
- ChatGPT/Gemini/Claude/豆包输入框 focus 后只显示 Personal AI icon，不给输入框加红色 glow。
- Web AI Jira/status prompt 应显示 Jira/项目来源标签，并在 context pack 里提示实时状态要回到 Jira 或 Personal AI 项目面板核对。
- 保存过的 Source Memory 资料胶囊能进入 Web AI context pack；当前目标 AI 自己的历史来源应在前端请求里先被剔除，并由后端继续兜底。
- Codex CLI / Claude Code / Cursor Agent fixture JSONL 能被 Desktop App adapter 解析，且 `agent_session` 抽取结果不包含大段代码/diff/tool output。
- `agent_session` 入库 metadata 应保留 `toolKey`、`sessionId`、`projectPath`、`taskKind`、`producedArtifacts`、`verificationSignals`。
- 用户在旧建议请求未返回前继续输入时，不渲染也不能插入旧草稿版本的建议；输入停下后只展示基于最新 draft 的建议。
- `previewRequired=true` 或 `riskLevel=high` 时，第一次点击 icon 只展开锁定正文预览；未点击 `插入草稿` 前不能改写草稿，点击 `取消` 只关闭当前建议；锁定预览不展示来源名、标题、命中原因或“建议依据”列表。
- 含 Rehearsal 预演提醒的建议即使风险为 low，也必须走一次锁定预览；预览内容仍只展示待插入正文，避免未来场景脚本被误点直接插入。
- hover popover 不展示“记忆关联”、来源路由、草稿回执、来源卡片、建议依据或 evidence links。
- 默认阈值 `0.78` 下，低置信建议不展示；插入会降低阈值，thumb-down 会提高阈值。
- contenteditable 中用户选中一段草稿后点击 icon，建议应替换该选区并保留选区前后的原文；插入成功后才记录 accepted 反馈。
- 插入后点击 `撤销` 应恢复原草稿，并且不记录 accepted 反馈、不立即重弹同一建议。
- 输入框拒绝写入时应显示 `未写入草稿`，保留原草稿，并且不记录 accepted 反馈。
- Web AI 场景 thumb-down 只 dismiss 当前草稿对应的建议；用户在同一页面输入不同 prompt 时，应该重新请求 `/composer/assist`。
- 插入建议、改写后发送时，应产生 `edited_before_send` trace，且 trace 中不能包含完整最终发送文本。
- 停留查看 hover 建议或键盘聚焦预览但不插入，随后自行发送时，应产生 `sent_without_insert` trace；快速扫过 icon 不应产生这条被动 trace。
- thumb-down、取消复核或 Escape 后再发送自己的回复，不应额外产生 `sent_without_insert`；显式拒绝只保留 `wrong` 或关闭动作语义。
