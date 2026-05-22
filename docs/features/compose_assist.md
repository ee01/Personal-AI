# Compose Assist

_最后更新: 2026-05-22_

## 定位

Compose Assist 是 Personal AI 的输入框辅助层。它只负责“用户正在写东西”时的低打扰记忆提示，不负责会前准备、每日 mission 生成或后台 closeout。

产品心智：用户不需要打开 Personal AI 的独立 compose 页面；Personal AI 应该在用户已经准备输入的原生输入框旁边出现，提供可预览、可插入、可忽略的上下文辅助。

与 Memory Lens 的边界：Compose Assist 负责输入框旁的写作/插入辅助；Memory Lens 负责当前页面的关联记忆提示。在 RingCentral Glip 中，如果 Compose Assist icon 已经显示，Memory Lens 的右下角悬浮 icon 会自动隐藏，避免两个 Personal AI 入口在输入框附近重复出现。

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
- 点击 icon 只执行一个动作：把建议内容直接插入当前输入框；不发送、不提交。
- 悬浮预览只展示待插入正文，不展示“记忆关联”、来源卡片、复制/取消/插入按钮，也不把用户带到记忆详情页。
- 后端仍可能返回 `previewRequired` 或高风险标记，但当前输入框体验不做二次确认弹层；是否展示 icon 由前端阈值和 sendable 校验控制。
- 靠近视口底部时会自动向上展开并限制高度，避免预览框被屏幕边缘挡住。
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

## 上下文来源与权重

当前代码没有按 memory source type 配置固定百分比权重，例如不存在“Glip 40%、Jira 20%、Meeting 20%”这种静态配比。Compose Assist 的实际逻辑分成三层：当前场景上下文决定 query，历史记忆 evidence 通过 recall/rerank 得分进入候选，生成 prompt 再按固定数量截断。

大白话说，Compose Assist 最先看“你现在到底在给谁、围绕什么上下文写东西”，然后才去记忆库里找能帮你补充的历史信息。影响建议内容的强弱大致是：

1. 当前输入框所在场景影响最大：RingCentral 最近可见消息、thread root、Jira issue 描述/comment、Web AI 当前 prompt 是主语境。
2. 同会话/同 issue/同 thread 的锚点很强：conversationId、groupId、threadRootPostId、issueKey 命中时，相关记忆更容易通过过滤。
3. 具体主题词比泛词更重要：Codex、MCP、某个 Jira key、预算/额度/上线风险这类具体词，会比“AI”“会议”“消息”更能影响召回。
4. 最近、常用、被正向反馈过的记忆会加分：recency、salience、用户点击插入等信号会让相关记忆更容易排前。
5. 用户草稿影响较弱：draft 不作为主召回 query，主要用于避免重复或 Web AI context pack 的目标描述。
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
| `draftText` | 用户当前草稿。 | 不作为主召回 query。当前实现里 Web AI context pack 会优先把 draft 作为“目标”摘要；RingCentral/Jira 的 sendable reply 生成不直接把 draft 放进 prompt，避免草稿里的无关关键词污染召回。 |

### 允许召回的历史记忆来源

`sourceTypes` 是 allowlist，不是权重表。前端 adapter 会按场景传入允许来源；后端只在这些来源中跑 fast recall。

| 场景 | 前端传入的 `sourceTypes` | 说明 |
| --- | --- | --- |
| RingCentral 主会话/thread | `glip`, `manual`, `markdown`, `web`, `jira`, `system` | 以当前聊天上下文为主，允许补充手动沉淀、文档、网页、Jira 和系统类记忆；当前前端没有把 `meeting/calendar/user_core/reflection` 放进 RingCentral allowlist。 |
| Jira comment | `jira`, `glip`, `meeting`, `web`, `manual`, `system` | 以 issue 本身为主，允许关联 Jira 历史、聊天、会议、网页和手动沉淀。 |
| Web AI prompt | `ai_chat`, `doubao`, `glip`, `jira`, `meeting`, `web`, `manual`, `system`, `user_core`, `markdown`, `reflection` | 允许更广的 Personal AI 记忆进入 context pack，但仍只插入到输入框，不自动提交。 |
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

- 非 Web AI 场景必须有当前上下文 tokens，否则不展示。
- evidence 与当前场景 token overlap `>= 2` 才直接保留。
- 如果只 overlap `>= 1`，还必须和 source anchor overlap `>= 1`，例如同 conversation、同 group、同 thread root 或同 issue key。
- Web AI context pack 当前不做这层 strict evidence filter，依赖 Web AI allowlist、recall/rerank 和生成约束控制。
- 通过过滤后，后端 confidence 取 top evidence score，clamp 到 `0.20-0.92`；如果 top score 低于 `0.58` 但有 keyword/FTS 命中，会提升到 `0.62`。后端 `available` 门槛是 `0.58`，前端最终展示门槛默认是自适应 `0.78`。

### 生成 prompt 的内容优先级

真正让 LLM 生成可发送文本时，prompt 中的内容按以下顺序组织：

1. `scenario`：即时通讯回复、thread 回复、Jira comment、Web AI prompt 等，决定语气和结构。
2. `audience`：会话标题、issue key/summary、可见对象、relationship hint。
3. 当前上下文：最多 14 条 `contextItems`，生成 prompt 会带 sender；thread 场景保留 root。
4. 如果检测到 owner 已部分回复，追加“用户已经发送但可能未完成的内容”，要求只生成补充说明。
5. 可用记忆：只放最终 evidence 的前 3 条，格式为 `[M1] snippet`。
6. 主人表达约束：`USER_CORE` 最多 900 chars；已确认 facts/preferences/constraints 各最多 8 条；场景相关 confirmed writing style hints 最多 8 条；pending style hints 也最多 8 条，但只能当 soft style hint，不能当事实。

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
- `previewRequired`: 后端风险提示字段。当前 Compose Assist 输入框 UI 不因此改变点击行为，icon 点击仍直接插入。
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
- 前端不展示来源卡片或记忆详情入口，避免输入框旁的 Compose Assist 变成 Memory Lens。是否展示建议应在后端 evidence 过滤和前端阈值阶段完成。
- 默认排除明显私人或敏感的一对一记忆，除非用户明确选择来源或后端判断场景安全。
- 即使 response 包含 evidence link，Compose Assist hover popover 也不渲染这些链接。

## 交互参考

本轮调研后保留的产品原则：

- Gmail Smart Compose 适合短补全：低打扰、用户显式接受、可关闭个性化。
- Grammarly rewrite / Outlook Copilot 的整段候选预览更适合独立写作面板，不适合当前“输入框旁一键插入”的 Compose Assist。
- Compose Assist 的当前原则是低摩擦：icon 点击直接插入，来源解释交给 Memory Lens / Memory Explore，而不是在输入框旁展开记忆关联。

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
- `previewRequired=true` 或 `riskLevel=high` 时，点击 icon 仍直接插入，不展示复制/取消/插入按钮。
- hover popover 不展示“记忆关联”、来源卡片或 evidence links。
- 默认阈值 `0.78` 下，低置信建议不展示；插入会降低阈值，thumb-down 会提高阈值。
