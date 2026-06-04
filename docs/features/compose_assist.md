# Compose Assist

_最后更新: 2026-06-03_

## 定位

Compose Assist 是 Personal AI 的输入框辅助层。它只负责“用户正在写东西”时的低打扰记忆提示，不负责会前准备、每日 mission 生成或后台 closeout。

产品心智：用户不需要打开 Personal AI 的独立 compose 页面；Personal AI 应该在用户已经准备输入的原生输入框旁边出现，提供可预览、可插入、可忽略的上下文辅助。

与 Memory Lens 的边界：Compose Assist 负责输入框旁的写作/插入辅助；Memory Lens 负责当前页面的关联记忆提示。在 RingCentral Glip 中，如果 Compose Assist icon 已经显示，Memory Lens 的右下角悬浮 icon 会自动隐藏，避免两个 Personal AI 入口在输入框附近重复出现。

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
- 生成用户可预览、可插入的建议内容。RingCentral / Jira 输出必须是可直接发送的正文；Web AI 输出可以是 context pack。
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

展示条件：

- 后端返回 `available=true`。
- 有非空 `insertText`。
- `insertText` 通过可发送文本校验，不能包含 `Personal AI context`、`Please review`、`我理解当前...`、`我这边先补充...` 等包装话术。
- `confidence >= envConfig.COMPOSER_GUARD_CONFIDENCE_THRESHOLD`，默认 `0.78`。

UI 行为：

- 只有 `CONTEXT_ASSIST_ENABLED` 和 `COMPOSE_ASSIST_ENABLED` 都不是 `false` 时才启动；任一开关关闭时，前端清理 icon/glow，background 也会拒绝新的 assist 请求。
- 输入框右上角吸附 `static/icons/icon48.png`。
- hover icon 时，左侧展开“建议内容”预览。
- 非 Web AI 场景可以用轻量 glow 标识当前输入框；ChatGPT/Gemini/Claude/豆包等 Web AI 输入框只在右上角显示 Personal AI icon/popover，不把输入框变成红色发光状态。
- 切换输入框或焦点离开可支持输入框时，旧输入框的 glow/icon 会被清理，避免误导用户还有可插入建议。
- 点击 icon 只执行一个动作：把建议内容直接插入当前输入框；不发送、不提交。textarea/input 会按当前光标或选区插入；contenteditable 输入框也会优先尊重当前光标/选区，选中文本时替换选区，没有可用选区时才追加到末尾。
- 插入成功后会短暂显示 `撤销`，用于误点或发现建议不合适时恢复插入前草稿；撤销后同一建议不会立刻再次弹出，避免把用户拉进重复插入循环。
- 悬浮预览只展示待插入正文，不展示“记忆关联”、来源卡片、复制/取消/插入按钮，也不把用户带到记忆详情页。
- 如果建议使用了 Rehearsal 预演提醒，悬浮预览会额外显示一行“预演提醒”和命中的主要线索，例如人物、同会话或主题；这只是来源提示，不是可点击证据卡。第一次点击会先锁定预览并提示核对未来场景是否仍适合，确认后才插入草稿。
- Web AI 输入框的悬浮标题会按主要来源显示为 `Agent 历史上下文`、`Jira / 项目上下文`、`会议上下文` 或 `跨 AI 上下文`，让用户知道点击后要插入的上下文类型。
- 后端返回 `previewRequired=true` 或 `riskLevel=high` 时，第一次点击 icon 只锁定并展开建议预览，显示核对提示和 `插入` / `取消`；用户再次确认后才写入当前输入框。低风险建议仍保持一键插入。
- 锁定复核态会显示最多 3 条紧凑“建议依据”，只列来源类型、标题/来源、置信度和命中原因，帮助用户判断是否插入；普通 hover 预览仍不展示来源卡片或额外按钮。高风险建议只暴露来源类别和置信度，避免复核层额外扩散敏感内容。
- 靠近视口底部时会自动向上展开并限制高度，避免预览框被屏幕边缘挡住。
- 用户在建议生成中或建议出现后继续编辑草稿时，前端会立刻收起旧建议并重新 debounce 请求；旧草稿版本返回的响应会被丢弃，避免插入过期回复。
- 建议框右上角有小 thumb-down。点击后隐藏当前建议，并降低后续同类低质建议的出现概率。
- 如果建议包含 Rehearsal 预演提醒，thumb-down 会同时把对应 activation 标记为 `irrelevant`，插入且未撤销会标记为 `accepted`，避免同一条错误预演在相同场景里反复出现。
- `Escape` 或 thumb-down 会 dismiss 当前 context，一段时间内不再重复展示同一条。
- Web AI 输入框里的 dismiss 会把当前草稿也纳入 context key；拒绝“第一个 prompt”的建议后，在同一个 ChatGPT / 豆包 / Claude / Gemini 页面改写成另一个 prompt，仍可重新触发来源适配和 context pack。

### Web AI / Agent Compose 关键逻辑

这部分是 Compose Assist 里的“跨 AI/agent 上下文接力”，不是独立 AI Tool Compass，也不会自动调度外部 agent。

- `compose_to_ai`：ChatGPT、Gemini、Claude、豆包等 Web AI 输入框。用户已经准备问外部 AI 时，Personal AI 在输入框旁提供可插入 context pack。
- `agent_compose`：预留给后续 Codex、Claude Code、Cursor 等 agent 入口。v1 先把这些 CLI agent 当作上下文来源，不在终端或 IDE 输入框里做浮层。
- 触发必须同时满足三点：当前输入框或会话能识别明确任务意图；其他 AI/agent/记忆中有高相关证据；生成内容不会直接外发高风险私密原文。
- context pack 默认包含 `任务判断`、`目标工具适配`、`相关上下文`、`约束`、`仍需确认`、`来源`。来源保留 evidence 索引，方便用户知道哪些内容来自本地记忆。
- 目标工具适配只是轻判断：当前 AI 是否够用，如果不完全适合，提示一个更适合的备选，例如 Codex、NotebookLM、Claude Code 或 Jira/项目面板。它不做完整工具排名，也不替用户切换工具。
- Web AI context pack 默认 `riskLevel=medium`、`previewRequired=true`。命中 personal/private/user_core/1:1/内部会议等内容时升为 high，高风险内容默认摘要化，不插入原文。
- 低置信、弱相关、无明确任务时保持安静；有建议时只显示 Personal AI icon，不自动发送 prompt。

## 自适应阈值与反馈

Compose Assist 的展示阈值是输入框 surface 自己的 UI gating，不影响 Today Pilot 会前准备。

配置：

- 功能开关：`chrome.storage.local.envConfig.COMPOSE_ASSIST_ENABLED`，同时受父级 `CONTEXT_ASSIST_ENABLED` 控制。
- 存储位置：`chrome.storage.local.envConfig.COMPOSER_GUARD_CONFIDENCE_THRESHOLD`
- 默认值：`0.78`
- 下界：`0.62`
- 上界：`0.92`

反馈：

- 用户点击 icon 插入建议，记录 `accepted`，阈值按“距离下界的剩余空间”非线性下降。前几次下降更明显，越接近下界下降越少。
- 用户点击 thumb-down，记录 `rejected`，阈值按“距离上界的剩余空间”非线性上升。前几次上升更明显，越接近上界上升越少。
- 反馈事件存储在 `chrome.storage.local.composerGuardFeedbackEvents`，最多保留最近 100 条。
- 当 evidence 类型是 Rehearsal 时，Compose Assist 会复用 background 的 `CONTEXT_RECALL_FEEDBACK` 通道，把正向反馈写成 `/rehearsals/:id/feedback outcome=accepted`，负向反馈写成 `outcome=irrelevant`，并携带 `activationId`。
- 插入后如果用户继续改写并发送，Compose Assist 会在原网页 Send / Submit / Reply 动作上生成无感校准 trace。trace 只包含 redacted diff summary、evidence id、场景 key 和行为类型，不保存完整发送文本。
- hover 预览但没有插入、随后用户自己发送回复时，也会记录 `sent_without_insert` trace，用于校准“记忆可能相关但建议措辞/时机不对”与“召回不该出现”的差异。
- thumb-down 除了调整前端阈值，也会写入 `wrong` trace，作为强负向校准信号。
- 发送前改写会额外抽取 `styleFeatureTags`，例如“用户加了哈哈”“句尾用了 ~”“删掉了夸张热情话术”“把同意图压短”。这些 tag 只描述改写方向，不保存原文。
- 如果后续其他入口能捕捉到对方反馈“AI 味”，可以写入 `downstream_reaction` + `ai_tone_called_out`，作为强风格修正证据。
- 如果用户已经点 thumb-down、取消复核或按 Escape 显式关闭当前建议，前端会清掉这次预览候选；后续发送自己的回复不会再追加 `sent_without_insert`，避免同一次拒绝被重复算成显式负向和隐式负向。

设计原则：

- 不默认弹出反馈表单，避免反馈输入膨胀。
- 当前只收集低负担二元信号：插入代表“这条有用”，thumb-down 代表“这条不该出现”。
- 更细的校准优先藏在用户自然动作里：插入、改写、发送、hover 后不用、撤销和 thumb-down。
- 如后续需要诊断质量问题，可以在事件 schema 上扩展可选 reason，例如 `irrelevant_memory`、`wrong_tone`、`too_sensitive`、`already_answered`，但 UI 上应按需二级展开，而不是每次打断用户。

### 无感校准 trace

Compose Assist 是 Ambient Calibration 的首个采样点。它不新增可见 UI，也不要求用户打开校准平台。

采样规则：

| 用户行为 | trace action | 解释 |
| -------- | ------------ | ---- |
| 插入建议且撤销窗口结束 | `inserted` | 建议至少值得进入草稿，作为中等强度正向信号 |
| 插入建议后直接发送或仅轻微追加 | `sent_after_insert` | 记忆匹配和措辞大概率都正确 |
| 插入建议后发送前改写 | `edited_before_send` | 记忆匹配可能正确，但措辞、范围或细节需要学习 |
| 插入建议后删除/完全改写再发送 | `deleted_before_send` | 召回或建议可能不适合当前场景 |
| hover 预览但不插入，随后发送自己的回复 | `sent_without_insert` | 预览被看过但没被采用，结合最终文本相似度判断是措辞问题还是召回问题 |
| thumb-down | `wrong` | 用户明确认为这类建议不应出现 |
| 对方后续反馈“AI 味” | `downstream_reaction` | 不是用户主动改写，但说明这类措辞在当前关系/场景里需要降级 |

`sent_without_insert` 只代表被动看过预览后继续自行发送；如果用户已经用 thumb-down、取消或 Escape 明确处理了建议，本次预览不会再产生这条被动 trace，避免把一次拒绝重复计数。

前端只上传这些 redacted 字段：

- `suggestionHash`、`finalHash`
- 建议/最终文本长度
- similarity score 与 edit distance band
- `same_intent`、`partially_rewritten`、`different_intent` 等语义关系摘要
- `styleFeatureTags`，例如 `casual_opening_haha`、`tilde_suffix`、`same_intent_shorter_form`、`removed_over_enthusiastic_claim`
- evidence id、type、title、role、score
- scene key、surface、scenario、context type、confidence

正式入口：

```http
POST /api/v1/ambient-calibration/traces
```

后端会递归拒绝 `redactedDiff` 和 `metadata` 中出现的 `rawText`、`finalText`、`suggestionText`、`composerText` 等原文字段；`rawTextStored:false` 这类布尔证明字段允许保留。重复 `id` 的 trace 不会新增写入，回执里的 `stored=false` 用于排查重试/重复上报，而不是把忽略写入误报为成功新增。

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
- Phase 1 不做截图、OCR 或上传图片 binary。
- 输出语气应更正式，包含判断、依据或 next step，不能像即时通讯闲聊。

### Web AI

- 覆盖 ChatGPT、豆包、Claude、Gemini 的网页输入框。
- 读取当前页面可见的最近 conversation turns，默认不 live 抓取完整外部平台历史。
- 召回来源可以包含已沉淀的 `ai_chat`、`chatgpt`、`doubao`、`doubao_chat`、`codex_cli`、`claude_code_cli`、`cursor_agent_cli`、`glip`、`jira`、`meeting`、`calendar`、`web`、`manual`、`source_memory`、`system`、`user_core`、`markdown`、`reflection`、`reflection_thread`、`rehearsal`。
- 当前目标 provider 自己的 source 会在后端移除，例如 ChatGPT 页面默认不把 `chatgpt` 历史作为“跨 AI”证据。
- 输出是可插入到 prompt 输入框的 context pack，不自动提交。

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
| RingCentral 主会话/thread | `glip`, `manual`, `source_memory`, `markdown`, `web`, `jira`, `system`, `rehearsal` | 以当前聊天上下文为主，允许补充手动沉淀、资料胶囊、文档、网页、Jira、系统类记忆和预演提醒；当前前端没有把 `meeting/calendar/user_core/reflection` 放进 RingCentral allowlist。 |
| Jira comment | `jira`, `glip`, `meeting`, `web`, `manual`, `source_memory`, `system`, `rehearsal` | 以 issue 本身为主，允许关联 Jira 历史、聊天、会议、网页、手动沉淀、资料胶囊和预演提醒。 |
| Web AI prompt | `ai_chat`, `chatgpt`, `doubao`, `doubao_chat`, `codex_cli`, `claude_code_cli`, `cursor_agent_cli`, `glip`, `jira`, `meeting`, `calendar`, `web`, `manual`, `source_memory`, `system`, `user_core`, `markdown`, `reflection`, `reflection_thread`, `rehearsal` | 允许更广的 Personal AI 记忆进入 context pack，但仍只插入到输入框，不自动提交；当前目标 AI 自己的来源会被后端剔除。 |
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
- Web AI context pack 当前不做 RingCentral/Jira 这层 strict evidence filter，但必须经过任务意图 gate、高相关 evidence gate、目标 provider 自回声剔除和 privacy/egress gate；弱相关或无明确任务时保持安静。
- 通过过滤后，后端 confidence 取 top evidence score，clamp 到 `0.20-0.92`；如果 top score 低于 `0.58` 但有 keyword/FTS 命中，会提升到 `0.62`。后端 `available` 门槛是 `0.58`，前端最终展示门槛默认是自适应 `0.78`。

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
- `suggestionType`: `none | context_pack | reply_context | issue_context`
- `insertText`: 可插入文本。
- `evidence`: 召回证据，保留 `exploreLink` 和安全来源链接。
- `riskLevel`: `low | medium | high`
- `previewRequired`: 后端风险提示字段。前端会把它作为 review gate：先展开预览，用户确认后才插入。
- `confidence`: 后端建议置信度。前端还会套用自适应展示阈值。
- `queryTimeMs`
- `debug`: 调试信息。Web AI / agent compose 重点看 `taskFrame`、`targetToolFit`、`sourceMix`、`egressRisk`、`relatedAgentSessions`、`recall.contextExpansion`。

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
7. Web AI context pack 会附带轻量任务判断和目标工具适配，例如 repo bugfix 更适合 Codex、Jira 状态需回到 Jira/项目面板核对、会前准备优先走 Today Pilot。
8. Web AI / agent compose metadata 会记录 `taskFrame`、`targetToolFit`、`sourceMix`、`egressRisk` 和 `relatedAgentSessions`，用于 eval 和调试。
9. 对生成文本做 sendable 校验和清理。

## Web AI draft-driven context enrichment

这部分专门覆盖“外发到豆包 / ChatGPT / Claude / Gemini 前帮用户补上下文”，主要对应 `compose_to_ai`。它不放进 Ask / Context Recall 的核心召回流程，也不升级成独立 AI Tool Compass。

目标场景：

- 用户在 Web AI 输入框里只写了一个很短的 prompt，例如“AI VBG 的 BE 部分完成情况如何”。
- 用户知道上下文窗口需要完整信息，但不想手动贴 Jira、Sheet、Slide、RingCentral thread 或历史会议摘要。
- Compose Assist 根据当前输入框草稿、页面可见 AI 对话、provider、当前 URL 和 Personal AI 记忆生成一个可插入 context pack。

当前行为：

- `draftText` 在 Web AI 场景提升为 enrichment signal，和页面可见 AI 对话、provider、当前 URL 一起进入 `/composer/assist` 的 recall query；RingCentral/Jira 仍不让 draft 污染主召回。
- 输出仍然是 preview / insert only，不自动提交给外部 AI。
- Web AI 输入框只显示 Personal AI icon/popover，不使用红色发光输入框标识，避免让 ChatGPT/Gemini/Claude/豆包的原生输入体验显得异常。
- context pack 会说明任务类型、当前目标工具是否合适，以及是否有更合适的核对入口；这只是插入前提示，不会替用户切换工具或自动打开外部系统。
- context pack 必须保留证据边界：列出引用的本地记忆、source anchor、仍缺的信息，以及不应让外部 AI 当事实的推断。
- 复用 `ContextRecallService` 内部的 `RecallContextExpansionService` 做短 prompt 扩写；`debug=true` 时可在 `debug.recall.contextExpansion` 看到 `expandedQuery`、`ambiguity`、`sourceAnchors`。
- Web AI 的 `sourceTypes` 会排除当前目标 AI 自己的来源，例如在 ChatGPT 页面不会把 `chatgpt` 历史当成“跨 AI”证据；除非是显式 agent compose 场景，否则优先补其他工具、Jira、会议、网页、Source Memory 资料胶囊、手动资料和画像上下文。
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
- AnchoredAI 和 ContextCite 相关研究都指向同一个 UX 要求：生成内容要能让用户理解上下文来源，尤其是跨工具 context pack，不能只给一段看似完整的答案。
- Grammarly rewrite / Outlook Copilot 的整段候选预览更适合独立写作面板，不适合当前“输入框旁一键插入”的 Compose Assist。
- Compose Assist 的当前原则是低摩擦：低风险 icon 点击直接插入，来源解释交给 Memory Lens / Memory Explore，而不是在输入框旁展开记忆关联；但当后端已经标记需预览或高风险时，交互应增加一次明确确认，避免用户误点后直接污染草稿。
- 本轮补查后保留“插入后继续编辑”的边界：像 Smart Compose / Grammarly / Outlook Copilot 一样，Personal AI 只把建议放进草稿，不越过用户的发送动作；但插入位置必须服从用户当前编辑意图，避免把已有草稿粗暴挪到末尾或覆盖掉未选中的内容。
- 直接插入也要有恢复路径：如果建议进入草稿后用户马上发现不合适，应能在原输入框旁撤销到插入前状态，而不是只能依赖各网站不一定可靠的浏览器 undo 栈。

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

Context pack eval：

```bash
npm run eval:run -- --case compose-assist-web-ai-context-pack-project-orbit --live --no-llm --no-repair
npm run eval:report
```

这条 eval 用于验证“打开的 Web AI/Codex 会话 + Personal AI 记忆 -> 生成 compose context pack -> 判断是否合理”。`--live` 会优先通过 webpage-mcp/mcporter 查找已打开的相关 Web AI 或 Codex 页面；如果没有匹配 tab，可以回退到 snapshot，但 report 必须显式写出 `collectionMode=snapshot_after_live_failed` 和 live 失败原因。

report 必须能看见：

- 实际使用的 chat/tab 或 snapshot 内容。
- 当前 draft/prompt。
- 请求里的 `surface`、`scenario`、`sourceTypes`。
- 召回到的 evidence、来源 mix 和 debug 信息。
- 最终 `insertText` context pack。
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
- ChatGPT/Gemini/Claude/豆包输入框 focus 后只显示 Personal AI icon，不给输入框加红色 glow。
- Web AI Jira/status prompt 应显示 Jira/项目来源标签，并在 context pack 里提示实时状态要回到 Jira 或 Personal AI 项目面板核对。
- 保存过的 Source Memory 资料胶囊能进入 Web AI context pack；当前目标 AI 自己的历史来源仍应被剔除。
- Codex CLI / Claude Code / Cursor Agent fixture JSONL 能被 Desktop App adapter 解析，且 `agent_session` 抽取结果不包含大段代码/diff/tool output。
- `agent_session` 入库 metadata 应保留 `toolKey`、`sessionId`、`projectPath`、`taskKind`、`producedArtifacts`、`verificationSignals`。
- 用户在旧建议请求未返回前继续输入时，不渲染也不能插入旧草稿版本的建议；输入停下后只展示基于最新 draft 的建议。
- `previewRequired=true` 或 `riskLevel=high` 时，第一次点击 icon 只展开锁定预览；未点击 `插入` 前不能改写草稿，点击 `取消` 只关闭当前建议。
- 含 Rehearsal 预演提醒的建议即使风险为 low，也必须走一次锁定预览，避免未来场景脚本被误点直接插入。
- hover popover 不展示“记忆关联”、来源卡片或 evidence links。
- 默认阈值 `0.78` 下，低置信建议不展示；插入会降低阈值，thumb-down 会提高阈值。
- contenteditable 中用户选中一段草稿后点击 icon，建议应替换该选区并保留选区前后的原文；插入成功后才记录 accepted 反馈。
- 插入后点击 `撤销` 应恢复原草稿，并且不记录 accepted 反馈、不立即重弹同一建议。
- Web AI 场景 thumb-down 只 dismiss 当前草稿对应的建议；用户在同一页面输入不同 prompt 时，应该重新请求 `/composer/assist`。
- 插入建议、改写后发送时，应产生 `edited_before_send` trace，且 trace 中不能包含完整最终发送文本。
- hover 建议但不插入，随后自行发送时，应产生 `sent_without_insert` trace。
- thumb-down、取消复核或 Escape 后再发送自己的回复，不应额外产生 `sent_without_insert`；显式拒绝只保留 `wrong` 或关闭动作语义。
