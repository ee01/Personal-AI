# Compose Assist

_最后更新: 2026-05-19_

## 定位

Compose Assist 是 Personal AI 的输入框辅助层。它只负责“用户正在写东西”时的低打扰记忆提示，不负责会前准备、每日 mission 生成或后台 closeout。

产品心智：用户不需要打开 Personal AI 的独立 compose 页面；Personal AI 应该在用户已经准备输入的原生输入框旁边出现，提供可预览、可插入、可忽略的上下文辅助。

典型场景：

- RingCentral 消息回复或 thread 回复。
- Jira comment。
- ChatGPT / 豆包 / Claude / Gemini 等 Web AI 输入框。
- 文档或笔记输入。

Codex Desktop、Claude Code、Cursor 等桌面 agent 暂不属于 Phase 1，因为 Chrome Extension 无法可靠探测桌面输入框。

## 边界

Compose Assist 做：

- 读取当前输入框、页面标题、会话/issue snapshot、可见上下文和用户草稿。
- 调用 `/composer/assist`。
- 复用 `ContextRecallService` 召回相关消息、会议、Jira、网页、AI 对话、用户偏好。
- 生成用户可预览、可插入的建议内容。RingCentral / Jira 输出必须是可直接发送的正文；Web AI 输出可以是 context pack。
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
- 当前实现不会把用户每次输入的 draft 当作主召回信号；draft 只作为生成时的辅助上下文。

展示条件：

- 后端返回 `available=true`。
- 有非空 `insertText`。
- `insertText` 通过可发送文本校验，不能包含 `Personal AI context`、`Please review`、`我理解当前...`、`我这边先补充...` 等包装话术。
- `confidence >= envConfig.COMPOSER_GUARD_CONFIDENCE_THRESHOLD`，默认 `0.78`。

UI 行为：

- 只有 `CONTEXT_ASSIST_ENABLED` 和 `COMPOSE_ASSIST_ENABLED` 都不是 `false` 时才启动；任一开关关闭时，前端清理 icon/glow，background 也会拒绝新的 assist 请求。
- 输入框右上角吸附 `static/icons/icon48.png`。
- hover icon 时，左侧展开“建议内容”预览。
- 有建议时，当前输入框显示同色红色 glow。
- 切换输入框或焦点离开可支持输入框时，旧输入框的 glow 会被清理，避免误导用户还有可插入建议。
- 低风险建议点击 icon 只插入建议内容，不发送、不提交。
- `previewRequired=true` 或高风险建议必须先打开固定预览，再点击预览内“插入”按钮；固定预览展示完整待插入内容，hover 预览可以裁短。Web AI context pack 默认走这条路径，避免把隐私上下文误插入 prompt。
- 预览框会显示命中的记忆数量、风险级别和简短来源，帮助用户判断是否应该插入；靠近视口底部时会自动向上展开并限制高度，避免“插入”按钮被屏幕边缘挡住。
- 需要预览的建议支持先“复制”而不修改输入框；用户可以把 context pack 放到别处检查，再决定是否插入。
- 用户在建议生成中或建议出现后继续编辑草稿时，前端会立刻收起旧建议并重新 debounce 请求；旧草稿版本返回的响应会被丢弃，避免插入过期回复。
- 建议框右上角有小 thumb-down。点击后隐藏当前建议，并降低后续同类低质建议的出现概率。
- `Escape` 或 thumb-down 会 dismiss 当前 context，一段时间内不再重复展示同一条。

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

设计原则：

- 不默认弹出反馈表单，避免反馈输入膨胀。
- 当前只收集低负担二元信号：插入代表“这条有用”，thumb-down 代表“这条不该出现”。
- 如后续需要诊断质量问题，可以在事件 schema 上扩展可选 reason，例如 `irrelevant_memory`、`wrong_tone`、`too_sensitive`、`already_answered`，但 UI 上应按需二级展开，而不是每次打断用户。

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
- 召回来源可以包含已沉淀的 `ai_chat`、`doubao`、网页记忆、用户画像、Markdown 沉淀和 reflection/skill 记忆。
- 输出是可插入到 prompt 输入框的 context pack，不自动提交。

## 请求模型

正式入口：

```http
POST /api/v1/composer/assist
```

关键字段：

- `surface`: `ringcentral_message | ringcentral_thread | jira_issue | chatgpt | doubao | claude | gemini | generic_agent`
- `contextType`: `message_thread | jira_issue | web_agent_prompt`
- `scenario`: `instant_message_reply | thread_reply | jira_comment | web_agent_prompt | document_note`
- `title`, `url`
- `draftText`: 用户当前输入草稿。它不是主召回 query，只用于生成时避免重复或承接语气。
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
- `previewRequired`: 高风险或 Web AI context pack 需要预览。
- `confidence`: 后端建议置信度。前端还会套用自适应展示阈值。
- `queryTimeMs`

## API

正式输入框入口：

```http
POST /api/v1/composer/assist
```

兼容入口：

```http
POST /api/v1/context-assist
```

当 `surface='composer_guard'` 时，兼容入口仍会委托到 composer 逻辑。

`surface='meeting_prep'` 不再属于 Compose Assist；兼容期内由 Context Assist 兼容层委托到 Today Pilot meeting prep。

## 后端流程

`/composer/assist` 当前由 `ComposeAssistService` 处理，旧类名 `ComposerAssistService` 只作为兼容 wrapper 保留。

处理步骤：

1. 判断 owner 是否已在当前上下文末尾回复。完整回复则直接不展示。
2. 构造 `ContextRecallRequest`，主 query 来自当前场景上下文和 audience，不以用户 draft 为主。
3. `ContextRecallService` 走 fast path：`vector + fts`，不跑 LLM，limit 默认 3。
4. 对 RingCentral/Jira evidence 做严格相关性过滤，要求和当前场景有主题、实体或对象 overlap。弱相关的 flight、泛 meeting title、假期公告等应被过滤。
5. 后端可用阈值仍保留低门槛 `0.58`，用于避免完全无关召回进入生成；最终是否展示由前端自适应阈值控制。
6. 用低温短输出生成可发送文本；LLM 超时或不可用时返回 `available=false`，不退化成生硬 bullet 摘录。
7. 对生成文本做 sendable 校验和清理。

## 与 Today Pilot 的关系

Today Pilot 负责“今天要注意什么”和“会议前已经准备了什么”。Compose Assist 负责“此刻这个输入框怎么写得更准确”。

两者可以复用同一套 evidence 与 redaction 原则，但不共享 UI 状态：

- Today Pilot 可以把会议 prep 交给 Video Home / Meeting Pilot。
- Compose Assist 可以把当前输入框上下文和 Today Pilot mission context pack 一起带入生成，但只在用户主动点击时插入。

## 隐私与安全默认值

- 永不自动发送消息、comment 或 prompt。
- 沿用网页记忆检测的敏感页面、密码框、支付/账号/隐私输入 guard。
- 高风险来源和 Web AI context pack 需要 preview 后才可插入；前端不会让 `previewRequired` 建议一键写入输入框。
- 默认排除明显私人或敏感的一对一记忆，除非用户明确选择来源或后端判断场景安全。
- evidence link 只能展示安全过滤后的 memory explore link 或 `http/https` 来源链接。

## 交互参考

本轮调研后保留的产品原则：

- Gmail Smart Compose 适合短补全：低打扰、用户显式接受、可关闭个性化。
- Grammarly rewrite / Outlook Copilot 适合整段生成：先展示候选内容，再由用户选择 accept/insert/keep，并保留改写、丢弃或继续编辑路径。
- 论文讨论里对 AI 写作助手的共同建议是保留用户 agency、显式控制个性化和隐私边界，并让用户能看懂建议来源和风险。Compose Assist 因为会带入 Personal AI 记忆，所以整段建议和 Web AI context pack 不能只依赖 hover 预览。

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
node tools/verify-compose-assist-preview-actions-e2e.mjs
```

等待首次 webpack dev compile 成功后停止 watch。

建议保留的回归场景：

- RingCentral 开发小群讨论 Codex/computer use/skills 时，不返回 flight、泛 meeting、假期公告。
- RingCentral thread 只使用 thread root/thread replies，不混入主会话底部消息。
- owner 已完整回复时不展示 icon。
- owner 已部分回复时，只生成补充回答。
- Jira comment 输出正式 comment，不输出即时通讯口吻。
- 同一事实面向老板、开发小群、Jira comment 时语气不同。
- 用户 draft 里的无关关键词不污染主召回。
- 用户在旧建议请求未返回前继续输入时，不渲染也不能插入旧草稿版本的建议；输入停下后只展示基于最新 draft 的建议。
- `previewRequired=true` 的 Web AI context pack 可以先复制且不会写入输入框，只有点击“插入”才修改输入框。
- 默认阈值 `0.78` 下，低置信建议不展示；插入会降低阈值，thumb-down 会提高阈值。
- `previewRequired=true` 或 `riskLevel=high` 时，点击 icon 只打开固定预览，必须点预览里的“插入”才会写入输入框。
