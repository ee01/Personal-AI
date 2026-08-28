# Assist

_最后更新: 2026-08-29_

> 文档路径：`docs/features/assist.md`（旧文件名 `compose_assist.md`）。产品口语与 API 仍常称 Compose Assist / `/composer/assist`；本文覆盖其下两个子模块。

## 定位

**Assist** 是 Personal AI 的输入框辅助层（历史名 Compose Assist）。它只负责“用户正在写东西”时的低打扰记忆提示，不负责会前准备、每日 mission 生成或后台 closeout。

它拆成两个平台无关、严格互斥的子功能：

| 子功能 | `assistIntent` | 触发 | 草稿条件 | 作用 |
| --- | --- | --- | --- | --- |
| **Draft Compose（起草助手）** | `draft_compose` | focus，settle 约 700ms | 仅空草稿 | 用页面上下文从零写出第一版 |
| **Draft Refine（精修助手）** | `draft_refine` | 真实 blur，settle 0ms | 仅非空草稿 | 改进已写内容；Web AI 输入框即 prompt 增强 |

focus 时草稿非空则完全静默，等 blur 走精修。发送后回到空输入框可重新触发起草；后端 `getOwnerReplyState` complete 门控仍会兜底，避免重复提示。

### 四象限矩阵

| | Draft Compose | Draft Refine |
| --- | --- | --- |
| **Glip / Jira** | 已有：`reply_context` / `issue_context`（空草稿用会话/issue 上下文起草） | 新增：`reply_refine`（强制预览，严格增量收益门） |
| **Web AI** | 新增：`prompt_draft`（页面可见 AI turns + 召回记忆，无 8 字符前置） | 已有：`rewrite_prompt` / `prompt_patch` / `context_pack`（软增量收益门） |

实现状态：Compose Assist 身份投影 P0 已于 2026-07-15 交付到 RingCentral、Jira 和 Web AI。Draft Compose / Draft Refine 双策略于 2026-08-04 贯通前后端。当前行为、维护入口和验证命令以本文为准；后续跨模块 projection 仍按本文“身份投影合约”的边界独立评审。

与 Memory Lens 的边界：Compose Assist 负责输入框旁的写作/插入辅助；Memory Lens 负责当前页面的关联记忆提示。只要任意页面的 Compose Assist 已经生成可一键写入输入框的文本并显示 icon，Memory Lens 的右下角悬浮 icon 就会自动隐藏，避免两个 Personal AI 入口同时争夺注意力；如果只是命中关联记忆但没有可插入文本，Compose Assist 不展示 icon，由 Memory Lens 展示关联记忆。

典型场景：

- RingCentral 消息回复或 thread 回复。
- Jira comment。
- ChatGPT / 豆包 / Claude / Gemini 等 Web AI 输入框。
- 文档或笔记输入。

Phase 1 不在终端、IDE 或桌面 agent 输入框里做 OS 级浮层，因为 Chrome Extension 无法可靠探测这些输入框。但 Desktop App 可以把 Codex CLI、Claude Code、Cursor Agent 的历史会话作为高质量上下文来源，供 Web AI `compose_to_ai` 和后续 `agent_compose` 使用。

## 大白话运行逻辑

Compose Assist 只替用户判断两件事：当前输入框旁是否值得出现一段可写入文本，以及这段文本可以直接插入还是必须先完整预览。它不把“召回到记忆”直接等同于“应该提示”。

1. 用户 focus 输入框时建立会话：若草稿有效字符为 0，约 700ms 后请求 Draft Compose；若草稿非空则静默等待 blur。继续输入只让旧建议失效，不发 Draft Refine。只有一次真实 blur 且草稿非空才冻结当前草稿并请求 Draft Refine；发送按钮、格式工具栏和 Personal AI 自己的控件不会误触发请求。
2. 后端先识别 `assistIntent` 与当前 scene。RingCentral/Jira 优先看当前会话、issue、可见字段和对象；Web AI 起草用页面可见 AI turns + 召回记忆，精修以冻结的 draft 作为 Prompt Compiler 主输入，再把直接相关记忆作为可选补充。
3. Context Recall 的最终 matches 先经过 [Memory Claim Attribution（记忆主张归属）](./memory_claim_attribution.md)，移除假设/未知归属等 block claim，并把 AI 建议和他人转述标成背景；随后再经过共享 [Evidence Cohesion Gate（证据对齐）](./evidence_cohesion_gate.md)。Compose 在真正消费前再执行一次 cohesion，覆盖 change projection 和 locked-context fallback。RingCentral/Jira 起草生成可发送正文或受控 `draft_hint`；精修生成 `reply_refine`；Web AI 起草生成 `prompt_draft`，精修先匹配高频确定性 patch，再由编译器在完整重写、局部补丁、上下文追加和静默之间选择。完整重写不要求先命中记忆，context pack 则必须有直接相关且已对齐的证据。
4. 每条候选都经过短生命周期 `PersonaProjection`。已确认人物关系优先于页面 hint；结构化画像只按当前场景裁剪，原始 `USER_CORE` 不进入 Compose。未确认、敏感、过期、scope 不明或无关的条目不能进入正文。
5. Draft Refine 额外过增量收益门：必须相对原草稿有足够语义偏差，或补入原草稿缺失的具体证据事实；Glip/Jira 更严，Web AI 较软。不通过则 `available=false`，原因只写在 `debug.refineReceipt`。
6. 候选还必须通过可写入文本、语言/目标保真、风险、置信度和当前草稿版本检查。没有正文、projection blocked、低置信或旧版本响应都不显示 Compose icon；仅有只读关联记忆时交给 Memory Lens。
7. hover 只给用户看最终待写入正文。`rewrite_prompt` / `prompt_draft` / `reply_refine` 替换完整草稿，`prompt_patch/context_pack` 按选区追加；高责任场景、`reply_refine` 或本轮存在归属回执时复用既有锁定预览，并在预览详情显示 compact attribution summary，不新增永久 icon 或独立页面。只要 attribution receipt 已经让本轮从直接插入升级为锁定预览，即使所有 claim 最终都是 `used`，预览也必须解释采用结果和原文不变边界，不能出现“被要求复核但没有原因”的状态；没有 receipt 的普通建议仍保持原有静默规则。任何模式都只改草稿、不发送，并保留精确撤销和脱敏校准边界。

影响结果的粗略优先级是：当前输入与 interaction scene > 当前可见会话/issue 上下文 > 明确实体、项目和任务锚点 > 经过过滤和 rerank 的历史记忆 > 经过投影的画像控制。这里没有一套固定的全局“来源权重”；实际约束是 surface allowlist、相关性准入、去重、风险门、身份投影、置信度阈值和 fail-closed fallback。

## 关键不变量（回归防线）

改 Compose Assist 触发、契约或生成分支时，先对照本节。历史上曾把全站改成 blur-only，导致 Glip 空输入框 focus 不再请求；双策略拆分后**禁止**再退化成单一触发。

### 1. 双子功能严格互斥

| 条件 | 必须行为 | 禁止行为 |
| --- | --- | --- |
| `focusin` + 有效草稿字符 = 0 | settle `700ms` 后请求 `assistIntent=draft_compose` | 等 blur 才起草；focus 非空也起草 |
| `focusin` + 草稿非空 | 只建 session，完全静默 | focus 时发 refine / compose |
| `input` / 草稿变化 | `draftRevision++`，撤销旧建议与在途响应 | 输入过程发 `draft_refine` |
| 真实 `focusout` + 草稿非空 | settle `0ms` 请求 `assistIntent=draft_refine` | blur 时空草稿仍请求；Send/工具栏焦点移动当 blur |
| Web AI 草稿 `< 8` 非空白字符 | 只拦截 **Draft Refine** | 用 8 字符门槛挡住 **Draft Compose** |

实现锚点：

- 前端：`src/composer-guard/ComposerGuardController.ts`（`REQUEST_FOCUS_SETTLE_MS=700`、`REQUEST_BLUR_SETTLE_MS=0`、`MIN_WEB_AI_DRAFT_CHARACTERS` 仅 refine、`buildComposerAssistRequestSignature(...|intent:)`）
- 开关：`src/composer-guard/assistConfig.ts` 的 `COMPOSE_DRAFT_ENABLED` / `COMPOSE_REFINE_ENABLED`；`src/background.ts` 的 `COMPOSER_ASSIST_REQUEST` 按 intent 门控
- 召回：`composer_guard` 不在 `PASSIVE_FAST_MODE_SURFACES` 里。`CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` 只控制 Memory Lens / `web_passive` 等旁路检索（未配置时默认开启；仅显式 `false`/`0`/`off`/`no` 关闭），**禁止**再把 Compose Assist 一起杀掉。用户侧另有独立 Options 开关 `CONTEXT_LENS_ENABLED`；关掉 Lens 只停被动气泡，不关写作护航。

### 2. 契约字段不可丢

请求必须能携带 `assistIntent?: 'draft_compose' | 'draft_refine'`，并同步四处（漏一处会 400 或类型漂移）：

1. `memory-service/src/types/index.ts`（canonical `ComposerAssistRequest`）
2. `src/services/MemoryServiceClient.ts`
3. `src/composer-guard/types.ts`
4. `memory-service/src/routes/composerAssist.ts` Fastify JSON Schema（`additionalProperties: false`）

响应 `suggestionType` 必须保留：

- `prompt_draft` → Web AI 起草，`insertMode=replace_draft`
- `reply_refine` → Glip/Jira 精修，`insertMode=replace_draft`，且**强制** `previewRequired=true`

缺失 `assistIntent` 时服务端兼容推导（`resolveComposerAssistIntent`）：`web_agent_prompt` + 非空草稿 → `draft_refine`；否则 → `draft_compose`。兼容入口 `/context-assist` 依赖此推导，不能删。

### 3. 四象限生成器

共享前置管道（recall → claim attribution → cohesion → persona）不变；分叉只发生在生成器：

| intent × surface | 输出 | 备注 |
| --- | --- | --- |
| compose × Glip/Jira | `reply_context` / `issue_context` | 空草稿用会话/issue 上下文 |
| compose × Web AI | `prompt_draft` | **禁止**恢复 `draft.length >= 8` 前置；输入是可见 AI turns + 召回 |
| refine × Web AI | `rewrite_prompt` / `prompt_patch` / `context_pack` | 软增量收益门；compiler 对空草稿的 goal continuity 可跳过 |
| refine × Glip/Jira | `reply_refine` | 严格增量收益门 + 强制预览 |

实现锚点：`memory-service/src/core/ContextAssistService.ts` 的 `assistComposer` 二维路由、`assistWebAgentDraftCompose`、`assistWorkDraftRefine`。

### 4. 增量收益门（仅 refine）

`evaluateComposerRefineGain`：相对原草稿，语义 Jaccard 距离 ≥ 阈值，**或** refined 文本补入了原草稿没有、但 evidence 里有的具体事实 token（同一 evidence ≥ 2 个 novel token 计 1 条）。二选一即可放行。

- Web AI 软阈值：`MIN_WEB_REFINE_SEMANTIC_GAIN = 0.18`
- Glip/Jira 严阈值：`MIN_WORK_REFINE_SEMANTIC_GAIN = 0.34`
- 不通过：`available=false`，只写 `debug.refineReceipt`（`pass/reason/semanticDistance/addedEvidenceFactCount`），**不**进入用户可见文案

禁止把同义换词当成有效精修展示。

### 5. 阈值必须按 `surface:intent` 隔离

- 存储 key 形如 `chatgpt:draft_refine`、`ringcentral_message:draft_compose`
- 裸 `surface` 仅作 fallback；**禁止**把 ChatGPT refine 的拒绝反馈写回裸 `chatgpt` 以致污染 Glip 起草
- 象限默认：compose `0.78`；Web refine `0.72`；工作面 refine `0.86`
- `getComposerAssistThresholdForSurface` 在未传显式 fallback 时必须用象限默认，不能永远回落到全局 `0.78`
- 调阈回执文案按 surface 基名显示（`chatgpt:draft_refine` →「ChatGPT 场景」），不要把复合 key 原文露给用户

实现锚点：`src/composer-guard/assistPreviewPolicy.ts`。

### 6. 改触发时必跑的回归

```bash
# 空 focus 起草 vs 非空 blur 精修互斥
node tools/verify-compose-assist-draft-staleness-e2e.mjs
node tools/verify-compose-assist-direct-insert-e2e.mjs

# 契约 / 收益门 / 四象限
npm --prefix memory-service test -- --run \
  src/__tests__/composer-assist-intent-routing.test.ts \
  src/__tests__/api-composer-assist.test.ts

# 复合阈值与 intent 开关
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test \
  src/composer-guard/__tests__/ComposerGuardController.test.ts
```

若断言再次写成「focus alone must not request」，就是在把双策略改坏——应改为：空草稿 focus **必须**请求 `draft_compose`；有草稿 focus **不得**请求 `draft_refine`。

## 边界

Compose Assist 做：

- 读取当前输入框、页面标题、会话/issue snapshot、可见上下文和用户草稿。
- 调用 `/composer/assist`。
- 复用 `ContextRecallService` 召回相关消息、会议、Jira、网页、AI 对话和 Rehearsal 预演提醒；画像不作为普通 recall 文本进入 Compose，而是由结构化身份投影单独裁剪。
- 生成用户可预览、可写入的建议内容。RingCentral / Jira 输出必须是可直接发送的正文；Web AI 可返回完整 prompt 重写、局部 prompt patch，或只追加高质量相关记忆。
- 当 `/context-recall` 返回已编译 `ContextCue(actionType='draft_hint')` 时，只有非降级 `draft_only + write_as_user` projection 且没有使用任何身份 slot，才可把 cue 直接作为 Jira/RingCentral 插入草稿；否则 cue 只作为 evidence，必须经受 projection 控制的生成器重写。例如 Jira estimate 场景可以从历史 Glip 记忆生成“我先按人天口径处理 MTR-148115 的 original estimate...”。最终正文仍必须经过 projection 输出校验、现有 `riskLevel`、`previewRequired` 和前端复核/插入规则；重复插入并发送成功后，Outcome Loop 会给同类 cue 加 `boost` policy，而不是要求用户额外确认。
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

- `focusin` 建立输入框会话。若草稿有效字符为 0，约 700ms settle 后调度 `draft_compose`；若草稿非空则静默，等待 blur 走精修。
- `input` 只刷新 `draftRevision`、撤销旧预览、使在途响应失效，不发 `draft_refine`。
- capture-phase `focusout` 仅在草稿非空时冻结草稿快照并请求 `draft_refine`；去重签名为 `contextKey + draftRevision + assistIntent`，同一签名最多请求一次。相同草稿反复 focus/blur 不重复请求，修改后必须再次真正 blur。
- Web AI 的 `MIN_WEB_AI_DRAFT_CHARACTERS`（8 个非空白字符）只约束 Draft Refine；Draft Compose 允许空草稿，用页面可见 AI turns + 召回记忆起草。RingCentral/Jira 空草稿继续依靠 thread、conversation 或 issue 上下文走 Draft Compose。
- capture-phase `pointerdown` 会在 `focusout` 前识别 Send/Submit/Reply/Post；发送动作造成的失焦不生成建议，发送后清理原 composer 会话。
- 输入框与其内部节点、格式工具栏、Personal AI 预览/确认控件和撤销控件之间的焦点移动不算真正 blur；Jira rich iframe 通过同等 `focusout` bridge 处理。
- 真正失焦后仍保留目标输入框会话，让异步结果锚定原输入框；只有切换到另一 composer、页面 URL 变化或发送后才清理。用户重新聚焦并修改后，旧响应不得展示或插入。
- RingCentral/Jira 不把 draft 当作主召回信号；Web AI `compose_to_ai` 在 Draft Refine 时把 blur 冻结的 draft 作为 Prompt Compiler 输入和 enrichment signal。

展示条件：

- 后端返回 `available=true`。
- `personaProjection.representationMode` 不是 `blocked`；blocked 响应即使误带 `insertText` 也不能显示 icon。
- 有非空 `insertText`，并且清理包装话术后仍然是可一键写入的文本。
- `insertText` 通过可发送文本校验，不能包含 `Personal AI context`、`Please review`、`我理解当前...`、`我这边先补充...` 等包装话术。
- `confidence >=` 当前 `surface:intent` 复合阈值（见下方「阈值与开关」），默认 Draft Compose `0.78`；Web AI Draft Refine `0.72`；Glip/Jira Draft Refine `0.86`。裸 `surface` key 仍可作为 fallback。
- 如果只命中高相关 evidence / 关联记忆，但没有生成可一键写入的 `insertText`，前端不挂 Compose Assist icon，也不显示 `草稿回执` 或 `上下文回执`；这类只读关联记忆只走 Memory Lens 的相关记忆卡片。

### 阈值与开关

- 总开关：`CONTEXT_ASSIST_ENABLED` 与 `COMPOSE_ASSIST_ENABLED` 都不是 `false` 时才启动。二者默认打开（`!== false` / 环境变量不是 `'false'`）。
- Memory Lens 被动召回另有独立用户开关 `CONTEXT_LENS_ENABLED`（同样默认打开）。关闭 Lens 不会关掉 Compose Assist 或会前准备。
- 子开关：`COMPOSE_DRAFT_ENABLED` / `COMPOSE_REFINE_ENABLED` 分别门控 Draft Compose / Draft Refine；挂在 Compose Assist 总开关之下。
- 自适应阈值按 `surface:intent` 复合 key 读写（例如 `chatgpt:draft_refine`）；裸 `surface` 作为兼容 fallback。ChatGPT 拒绝一次 prompt 优化不会连累 Glip 起草。
- thumb-down / accepted 反馈同样写入复合 key。

UI 行为：

- 任一总开关或对应 intent 子开关关闭时，前端清理 icon/glow，background 也会拒绝新的 assist 请求。
- 输入框右上角吸附 `static/icons/icon48.png`。
- hover icon 时，左侧展开“建议内容”预览。
- 非 Web AI 场景可以用轻量 glow 标识当前输入框；ChatGPT/Gemini/Claude/豆包等 Web AI 输入框只在右上角显示 Personal AI icon/popover，不把输入框变成红色发光状态。
- 焦点真正离开输入框后不会立刻丢失会话；异步建议仍锚定原输入框。切换到另一输入框、页面变化、发送，或用户修改原草稿时才使旧会话/响应失效。
- `prompt_patch` / `context_pack` 使用 `append_patch`：textarea/input/contenteditable/rich iframe 都按当前光标或选区追加，选中文本时替换选区，没有可用选区时才追加到末尾。
- `rewrite_prompt` / `prompt_draft` / `reply_refine` 必须使用 `replace_draft`：预览标题与确认文案按类型区分；确认后替换完整内容，并派发 `inputType='insertReplacementText'` 和 `change`，光标落在末尾。`reply_refine` 强制 `previewRequired`（改写用户自己打的字，风险高于追加）。缺失或错误的 replace 模式直接隐藏，绝不把完整重写追加到原文后面。
- 如果建议需要先进入复核态，Personal AI 会保留进入复核前的输入框选区；即使确认按钮短暂拿到焦点，最终插入仍按用户原本选中的草稿片段替换，不把建议误追加到末尾。
- 写入前保存完整 value/HTML/选区快照。成功后按模式显示 `已替换原 prompt`、`已追加 prompt 补丁`、`已追加上下文` 或 `已插入草稿`，并统一保留 `未发送，可继续编辑 / 撤销`、写入目标和 `约 10 秒内可撤销` 边界；撤销必须精确恢复原 value/HTML 和选区。
- 如果当前输入框临时变成只读、禁用或拒绝写入，前端会显示 `未写入草稿` 回执，说明 Personal AI 没有发送或提交，并提示重新聚焦输入框后重试；这类失败不会记录 accepted 反馈或正向校准 trace。
- 悬浮预览只展示待插入正文，不展示“记忆关联”、来源路由、草稿回执、来源卡片、证据链接、复制/取消/插入按钮，也不把用户带到记忆详情页。Compose Assist 的判断负担应落在“这段内容要不要插入”，不是让用户复核召回链路。
- 锁定复核态同样以待写入正文为主体；完整重写显示 `取消 / 替换原 prompt`，补丁或上下文显示 `取消 / 追加到 prompt`，普通回复 / 精修显示 `取消 / 插入草稿`。不展示 `来源路由`、`草稿回执` 或通用 `建议依据`。归属回执是窄例外：当它本身触发锁定复核时，正文下方显示 compact `记忆归属` 解释，至少说明采用 / 仅作背景 / 未使用结果与“只影响派生使用、不修改原始消息”的边界；它不提供纠错按钮或来源下钻。如果是身份投影要求复核，正文下方再增加一行边界说明：确实排除了条目时显示“已按当前场景省略未确认或敏感身份信息；仅插入草稿，不会发送。”；只是对象/场景责任较高时显示“当前对象或场景要求先预览；仅插入草稿，不会发送。”。普通 hover 不显示这些复核说明。
- 如果后端返回高置信 evidence 但没有安全可插入正文，例如 Jira 历史 comments 已显示用户回复过，前端不显示 Compose Assist icon；匹配到的关联记忆由 Memory Lens 使用 lens icon / 相关记忆卡片展示，不再占用输入框旁的插入入口。
- 如果建议使用了 Rehearsal 预演提醒，前端仍把它当成必须复核的硬边界，即使后端漏设 `previewRequired` 也不会一键直插；但插入前预览仍只展示待插入正文，不展开预演线索、证据来源或降权路径。
- Web AI 完整重写的悬浮标题固定为 `优化后的完整提问`；局部补丁显示 `提问补丁`；纯上下文追加仍可按主要来源显示 `Agent 历史上下文`、`Jira / 项目上下文`、`会议上下文` 或 `跨 AI 上下文`。
- 后端返回 `previewRequired=true`、`personaProjection.requiresPreview=true` 或 `riskLevel=high` 时，第一次点击 icon 只锁定并展开建议正文预览，显示 `插入草稿` / `取消`；`取消` 或 Escape 只退出锁定复核、回到轻量预览，不会写入草稿、不会发送、也不会把这条建议当作拒绝学习；用户再次确认后才写入当前输入框。低风险 peer 建议仍保持一键插入。
- 靠近视口底部时会自动向上展开并限制高度，避免预览框被屏幕边缘挡住。
- 用户在建议生成中或建议出现后继续编辑草稿时，前端立刻收起旧建议、推进 revision 并使旧响应失效；输入过程不重新请求 Draft Refine，直到下一次真正 blur。空草稿 focus 的 Draft Compose 在 settle 前被输入打断时也会失效。
- 如果宿主编辑器直接替换 contenteditable DOM、没有正常派发 `input`，下一次重新聚焦或插入前校验仍会发现静默变化、清掉旧建议；只有后续真正 blur（非空）才请求 Draft Refine，或空草稿重新 focus 才请求 Draft Compose。
- 点击 icon 或复核态确认插入前，前端会重新读取当前输入框并校验它仍是生成建议时的草稿版本；如果草稿已变化但页面没有正常发出 input 事件，Personal AI 会显示 `草稿已变化`，不写入旧建议、不发送、不提交，也不记录 accepted 学习信号。
- 建议框右上角有小 thumb-down。按钮 hover / 读屏先说明这次只隐藏当前建议、让当前 surface:intent 更谨慎、尝试提交脱敏 `wrong` 校准信号；不会发送/提交草稿、删除来源记忆或静默其他输入框。点击后隐藏当前建议，显示短回执说明“当前场景会更谨慎”，并降低后续同类低质建议的出现概率；换一个 prompt / 草稿仍会重新判断，不把一次拒绝扩散成全局静默。
- 如果建议包含 Rehearsal 预演提醒，thumb-down 会尝试把对应 activation 标记为 `irrelevant`。短回执会拆开显示“命中线索 / 当前 surface 调阈 / 预演降权写入状态 / 脱敏校准写入状态”：写入成功后才说相同场景后续会降权；如果 background、网络或 Memory Service 拒收，会保留“已隐藏 + 本地调阈已尝试”，但明确说明预演降权未写入。插入且撤销窗口结束后会标记为 `accepted`，完成回执会把预演使用反馈写入状态和 inserted 脱敏校准状态分开，避免同一条有效预演在相同场景里反复被当作未确认。
- 普通预览态按 `Escape` 或点击 thumb-down 会 dismiss 当前 context，一段时间内不再重复展示同一条；锁定复核态的 `取消` / Escape 只退出复核，不写入、不学习为拒绝。
- Web AI 输入框里的 dismiss 会把当前草稿也纳入 context key；拒绝“第一个 prompt”的建议后，在同一个 ChatGPT / 豆包 / Claude / Gemini 页面改写成另一个 prompt，仍可重新触发来源适配、context pack 或 prompt patch。

### Web AI / Agent Compose 关键逻辑

这部分是 Compose Assist 里的“跨 AI/agent 上下文接力”，不是独立 AI Tool Compass，也不会自动调度外部 agent。

- `compose_to_ai`：ChatGPT、Gemini、Claude、豆包等 Web AI 输入框。空草稿 focus 走 Draft Compose（`prompt_draft`）；用户写完并真正 blur 后走 Draft Refine（完整 prompt rewrite、局部 patch 或直接相关 context pack）。
- `agent_compose`：预留给后续 Codex、Claude Code、Cursor 等 agent 入口。v1 先把这些 CLI agent 当作上下文来源，不在终端或 IDE 输入框里做浮层。
- Web AI Draft Refine 不再要求“必须命中记忆”。只要草稿足以表达完整任务，零记忆也可进入通用 Prompt Compiler，并返回 `rewrite_prompt + replace_draft`。
- 四种输出由后端强制映射：`prompt_draft / rewrite_prompt -> replace_draft`；`prompt_patch -> append_patch`；`context_pack -> append_patch`。现有三个确定性高频 patch 先于通用编译器执行并继续 append，其余任务由一次结构化编译调用判断 rewrite、patch、context pack 或 none。
- `prompt_draft` 用于空草稿起草：用页面可见 AI turns 与召回记忆生成第一版提问，不要求用户先写满 8 个字符。
- `rewrite_prompt` 用于完整任务重构。它只优化下游 prompt，不回答原问题；保留用户目标和已给事实，不编造个人情况、诊断、文献或引用。研究/决策任务应补齐研究范围、证据层级、相关与因果区分、多维分析、反方证据、个体化条件、决策标准、不确定性、必要追问和输出结构。
- `prompt_patch` 用于小范围缺口。当用户已经写了明确任务但缺少数据源、输出格式、写回边界、验证方式或失败回执时，只追加结构化补丁，不重复原 prompt。
- `context_pack` 只允许追加完整、直接相关的事实性记忆和必要的不确定性边界；不重复原 prompt，不输出 `任务判断`、`目标工具适配`、NotebookLM/Gemini 推荐、通用 Jira owner 核对或重复来源列表。没有有效上下文就保持安静。
- Jira estimate 这类短 Web AI prompt 会在召回 query 前置 Task Estimate workflow hint，例如 `team field`、`Summary`、`Description`、`Issue type`、`Historical Story Points benchmark`、`missing reason / low confidence reason`、`Google Sheet dry-run` 和 `not Jira writeback`，避免只命中泛泛的 Sheet/estimate 记忆而漏掉真正的估算口径。
- 如果 visible recall matches 被 attention budget 静音，但 `contextExpansion.contextMatch` 已经处于 `locked` 且 selected topic 带有 evidence ids，后端会从当前用户的 `messages_raw` 解析最多 6 条候选，再走与普通 Web AI evidence 完全相同的低信息过滤、相关性准入、去重和最多 3 条限制。这个 bridge 只消费本次 recall 已产出的 locked context；召回未运行或没有 locked match 时不能自行扩大检索。
- Jira estimate workflow 另保留一条窄 fallback：locked context 可以生成 `source_memory` prompt-patch evidence，但只在 Web AI + Jira estimate patch 意图同时满足时启用，不影响普通 context pack。
- Prompt Compiler 的 system prompt 可以是英文，但 `insertText` 必须跟随 `currentDraft` 主语言；混合输入保留产品名、代码和专业术语。语言不匹配、JSON 非法、超时、目标事实丢失或置信度不足时 fail closed，不回退到旧通用 context pack。
- 编译调用上限 1600 tokens、30 秒，`rewrite_prompt` 硬上限 6000 字符。当前 system prompt 进一步要求在 520 个 Unicode 字符内给出紧凑但有明确分段的结果；GPT-5 兼容模型使用 `reasoning_effort=none`，把交互延迟留给结构化生成而不是长推理。独立 kill switch `COMPOSER_PROMPT_COMPILER_ENABLED` 默认启用；关闭后仍保留确定性 prompt patch，且只有经过过滤的相关记忆才能降级成 context pack。
- Web AI 至少为 `medium` risk；草稿、页面或记忆内容涉及未成年人、健康、家庭、个人发育、诊断、薪资或财务时升级为 `high`，并强制预览。普通 `manual` 项目记忆本身不自动升 high，风险由内容和明确的敏感来源标签决定。
- 当编译器返回 `rewrite_prompt`，但草稿已经明确要求写作/整理/总结某个交付物、任务又不是研究型，并且编译器实际使用了直接相关 evidence 时，服务端把结果收敛为 `context_pack + append_patch`，只追加 evidence 上下文，避免完整重写覆盖一个已经清楚的任务。debug 保留 `rawMode` 和 `modeNormalized` 供验收。
- 低置信、弱相关、语言/目标校验失败时保持安静；有建议时只显示 Personal AI icon，不自动发送 prompt。

## 身份投影合约

每条可用 Compose 建议都必须在 suggestion 分支确定后生成一次短生命周期 `PersonaProjection`。它是生成控制对象，不是新的画像展示面板。

处理顺序：

1. 召回并过滤 evidence。
2. 确定 reply、cue、`prompt_draft`、`rewrite_prompt`、`prompt_patch`、`context_pack` 或 `reply_refine` 分支。
3. 解析当前 scene 和 audience。
4. 从 `user_profile_items` 加载结构化画像候选。
5. 将候选分成 `generation_control`、`speakable_context`、`soft_control` 和 `blocked`。
6. 只把允许 slot 传入生成器，并校验最终文本。
7. 合并现有 risk 和 projection preview 边界。

Audience 类型为 `peer | manager | direct_report | external | mixed | unknown`。解析优先级固定为：有效且已确认的 `social_edges` 姓名/alias 精确匹配；其次才使用 `relationshipHint` 软提示；无法确认时使用 `unknown`。确认关系与 hint 冲突时以确认关系为准；多人关系不一致或混有未知参与者时使用 `mixed`。Web AI 默认是 `external`。生成器只接收 resolved audience type/source 及对应表达策略，不再接收原始 `relationshipHint`，避免确认关系被低可信 hint 反向覆盖。

Slot 规则：

- 已确认且场景匹配的写作风格、语言和格式偏好进入 `generation_control`，只能改变写法，不能在正文中复述配置值。
- 角色、团队等工作事实只有在当前文本直接涉及对应主题时才能进入 `speakable_context`。
- pending writing style 只允许影响低责任的 RingCentral peer/direct-report/unknown 草稿，作为 `soft_control`；不能进入 manager/external/mixed、Jira 或 Web AI 输出。
- 未确认、过期、敏感、secret、scope 不明和无直接 relevance 的画像进入 `blocked`。
- Web AI 只有在当前 prompt 明确要求结合个人经历/偏好，并与条目有直接 token/topic overlap 时，才允许带入 confirmed 个人偏好或约束；以第三人称描述。
- Web AI `prompt_patch` 完全不投影画像，`voiceMode='never_speak_as_user'`。
- 预编译 `draft_hint` cue 只有在 `draft_only + write_as_user`、没有任何已使用身份 slot 且 projection 未降级时才能直接插入；否则 cue 只作为 evidence，必须经过受 projection 控制的生成器重写。

Representation 模式：

- 普通低风险 RingCentral peer/direct report 为 `draft_only`。
- RingCentral manager/external/mixed 为 `draft_preview_required`。
- Jira 使用身份事实时为 `draft_preview_required`。
- Web AI rewrite / context pack / prompt patch / `prompt_draft` 为 `context_pack_copyable`，始终预览。
- Glip/Jira `reply_refine` 为 `draft_preview_required`（改写用户已打文字，强制锁定预览）。
- 最终文本命中 credential pattern 或被阻断画像值时为 `blocked`，返回 `available=false`。

`ComposerAssistResponse.personaProjection` 只暴露版本、scene、audience 类型和来源、representation/voice mode、使用/排除数量、slot kind、reason code、是否要求预览和降级状态。响应及 debug 不返回画像值或敏感原文。

原始 `USER_CORE` 已从 RingCentral、Jira 和 Web AI Compose recall allowlist 移除，也不再进入生成 prompt。投影服务或关系存储异常时，系统 fail closed 为 `unknown + neutral`，省略全部画像和关系个性化；绝不回退到完整 `USER_CORE`。

当前已完成范围只覆盖 Compose Assist 的 RingCentral、Jira 和 Web AI P0。后续扩展仍遵守以下边界，但不属于当前 Compose 运行链路：

- AI Context Passport、Doubao stable memory 和 Provider Context Package 可以复用 `external + speak_about_user` 投影，但必须先定义 provider capability、外发裁剪、撤销和同步回执。
- Message Reaction、Scheduled Messages 和 Agent Work Order 可能代表用户写入或发送，必须增加独立 action authorization，不能复用“只插入草稿”的低风险假设。
- Meeting Pilot、Today Pilot、Quick Ask 和 Relationship Radar 是对用户本人提示，后续应使用 `speak_to_user` 语义，不能仅因读取身份上下文就增加确认步骤。

## 自适应阈值与反馈

Compose Assist 的展示阈值是输入框 `surface:intent` 自己的 UI gating，不影响 Today Pilot 会前准备。ChatGPT 的 Draft Refine 拒绝不得抬高 RingCentral Draft Compose 阈值。

配置：

- 功能开关：`chrome.storage.local.envConfig.COMPOSE_ASSIST_ENABLED`，同时受父级 `CONTEXT_ASSIST_ENABLED` 控制。
- 子开关：`COMPOSE_DRAFT_ENABLED` / `COMPOSE_REFINE_ENABLED`（缺省视为开启；总开关关闭时两者都不生效）。
- 全局兜底存储：`chrome.storage.local.envConfig.COMPOSER_GUARD_CONFIDENCE_THRESHOLD`
- 分象限自适应存储：`chrome.storage.local.envConfig.COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS`，key 优先为 `surface:intent`（例如 `chatgpt:draft_refine`），裸 `surface` 仅 fallback
- 象限默认：Draft Compose `0.78`；Web AI Draft Refine `0.72`；Glip/Jira Draft Refine `0.86`
- 全局兜底默认：`0.78`
- 下界：`0.62`
- 上界：`0.92`

反馈：

- 用户点击 icon 插入建议，记录 `accepted`，当前 `surface:intent` 的阈值按“距离下界的剩余空间”非线性下降。前几次下降更明显，越接近下界下降越少。
- 用户点击 thumb-down，记录 `rejected`，当前 `surface:intent` 的阈值按“距离上界的剩余空间”非线性上升。前几次上升更明显，越接近上界上升越少。
- thumb-down 按钮自身和点击后的短回执都保留同一个边界：当前建议只是在本地隐藏、当前 surface:intent 后续更谨慎，会尝试提交脱敏 `wrong` 校准信号；不会发送/提交草稿、删除来源记忆或关闭其他输入框建议，也不展开反馈表单或阻断用户继续输入。
- thumb-down 回执会单独显示调阈保存状态：先显示“调阈保存中”，保存后显示具体场景阈值从多少调到多少（文案用 surface 基名，如 ChatGPT），并说明只影响这个输入框 surface；如果 storage 写入失败，回执会说建议已隐藏但谨慎度可能不会保留。
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
4. 晋升后写入 `user_profile_items` 的 `writing_style.*` 条目；它可以继续渲染进 `USER_CORE.md` 供其他画像用途，但 Compose 不读取该原始快照。
5. 下一次同类 compose 由 `PersonaProjectionService` 按 surface、audience、task 和 language 选择匹配的 `writing_style.*`，作为 `generation_control` 或有限的 `soft_control` 注入 prompt，影响语气、长度、结构和禁用话术。

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
- `USER_CORE` 中可以保留概括规则供其他画像入口使用，但 Compose 只读取结构化 `user_profile_items`，不会把完整快照注入生成。
- 这种写作风格条目来自用户真实发送行为的重复证据，不是纯 LLM 猜测；它仍有 scope、confidence、evidence，可被后续校准或撤销。

## 上下文提取

Compose Assist 使用 `SiteContextAdapter` 把不同网站归一成 `SiteContextSnapshot`。新 adapter 应优先产出结构化 `contextItems`，旧字段 `primaryText`、`visibleMessages` 只作为兼容。

### RingCentral

主会话回复框：

- 只读取当前会话底部可见近期消息，默认最多 8 条。
- 每条消息文本硬顶 4000 字（约一篇带链接/版本号的长 Glip 帖）。旧值 280 大约只够一段，会丢掉帖子后半的 Jira key、生产版本、WAC/下载链等检索锚点。仍保留硬顶，避免 8 条全量无上限把粘贴日志打进 Assist JSON。
- `primaryText` 拼接硬顶 8000 字。
- 不读取隐藏缓存卡片。
- 不混入打开的 thread reply tree。
- 传入 `conversationId`、`groupId`、conversation title、visible senders。
- 可见附件/图片只传页面已有 metadata，例如文件名、alt/title/url，不上传二进制。忽略 Personal AI 自己注入的 `chrome-extension://` 图标（消息工具栏 / Compose Assist icon），以及输入框卡片上的 `Improve` / `Draft for me` 等宿主按钮字。
- 不把当前回复输入框本身当成一条 `visibleMessages` / `contextItems`。

Thread 回复框：

- 只读取 thread root + 当前 thread 可见回复，默认最多 12 条。
- 不混入主群底部消息。
- `thread_root` 必须进入 `contextItems`。
- 前端用当前命中的输入框判断 main/thread snapshot，避免焦点状态变化时把 thread 回复误当主会话回复。

自我发言识别：

- adapter 会尽量从 RingCentral 本地账号信息、`ownExtension` / `displayName`、profile DOM、sender/avatar id 判断 `metadata.isSelf`。显示名 `Esone Qiu` 与邮箱/用户名 `esone.qiu`、以及 `GLIP_PERSON.<id>` 与纯数字 id 视为同一人。
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
- 召回来源可以包含已沉淀的 `ai_chat`、`chatgpt`、`doubao`、`doubao_chat`、`codex_cli`、`claude_code_cli`、`cursor_agent_cli`、`glip`、`jira`、`meeting`、`calendar`、`web`、`manual`、`source_memory`、`system`、`markdown`、`reflection`、`reflection_thread`、`rehearsal`。画像不走这条 recall allowlist，而是由结构化 projection 单独裁剪。
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
| `primaryText` | 兼容旧调用；当没有 `contextItems` 时作为 fallback。 | 召回主 query 最多 1600 chars。前端 RingCentral/Jira/Web AI 构造时最多 8000 chars。 |
| `secondaryTexts` | 召回辅助文本，主要补 thread root、status、最近 turns 或旧字段。 | 后端从 context items 取最多 8 条文本，再叠加请求里的 `secondaryTexts`，总数最多 10；进入 `ContextRecallService` 时最多保留 8 条，每条最多 160 chars。 |
| `audience` | 生成 prompt 里的“对象”，用于语气/对象判断；conversation/group/issue/provider 也会转成 entity hints。 | 不直接拼进 recall `primaryText`，但会通过 `entityHints` 影响 recall anchor；生成 prompt 中以一行“对象”出现。 |
| `identifiers` | conversationId、groupId、threadRootPostId、issueKey、provider。 | 转成 recall `entityHints`，并在 evidence 过滤时作为 source anchor；不是百分比权重，而是强相关锚点。 |
| `draftText` | 用户当前草稿。 | RingCentral/Jira 不作为主召回 query，主要用于避免重复或承接语气；Web AI `compose_to_ai` 会作为短 prompt enrichment signal 进入 recall query、目标摘要和 context key。 |

### 允许召回的历史记忆来源

`sourceTypes` 是 allowlist，不是权重表。前端 adapter 会按场景传入允许来源；后端只在这些来源中跑 fast recall。

| 场景 | 前端传入的 `sourceTypes` | 说明 |
| --- | --- | --- |
| RingCentral 主会话/thread | `glip`, `manual`, `source_memory`, `markdown`, `web`, `jira`, `system`, `reflection`, `reflection_thread`, `rehearsal` | 以当前聊天上下文为主，允许补充手动沉淀、资料胶囊、文档、网页、Jira、系统、反思线程和预演提醒；画像只走 projection。仍不把 `meeting/calendar` 放进 RingCentral allowlist，避免会话回复被日程/会议泛背景稀释。 |
| Jira comment | `jira`, `glip`, `meeting`, `web`, `manual`, `source_memory`, `system`, `reflection`, `reflection_thread`, `rehearsal` | 以 issue 本身为主，允许关联 Jira 历史、聊天、会议、网页、手动沉淀、资料胶囊、系统、反思线程和预演提醒；画像只走 projection。 |
| Web AI prompt | 基于 `ai_chat`, `chatgpt`, `doubao`, `doubao_chat`, `codex_cli`, `claude_code_cli`, `cursor_agent_cli`, `glip`, `jira`, `meeting`, `calendar`, `web`, `manual`, `source_memory`, `system`, `markdown`, `reflection`, `reflection_thread`, `rehearsal` 动态裁剪 | 允许更广的 Personal AI 记忆进入 rewrite、context pack 或 prompt patch，但仍只写入输入框，不自动提交；前端会先剔除当前目标 AI 自己的来源，后端保留二次过滤。个人偏好和约束只从 projection 进入。 |
| 旧调用或未传 `sourceTypes` | 非 Web AI 默认 `WORK_SOURCES`；Web AI 默认 `WEB_AGENT_SOURCES`。 | 这是后端 fallback。若前端已传 allowlist，后端会在对应默认集合中再过滤。 |

### Recall 与 rerank 权重

Compose Assist 复用 `ContextRecallService` 的 fast path，不跑 LLM recall。当前权重来自 recall 通道和二次 rerank，而不是来源类型本身。

| 阶段 | 规则/权重 |
| --- | --- |
| Recall 通道 | 只启用 `vector + fts`；不启用 graph/time。不受 Memory Lens 的 `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` 杀开关影响。`composer_guard` 不在 `PASSIVE_FAST_MODE_SURFACES` 里，因此 **不会** 再被压成 12 token / 240 字的 passive compact query。实际搜索串仍经 `normalizeContextQuery`：`primaryText` 取有意义前 360 字、每条 `secondaryTexts` 160 字、总计最多 600 字；FTS 和 vector 都吃这串压缩 query，不是客户端原文。前端把单条消息放到 4000 字，是为了让帖尾的 Jira key / 版本号 / 下载锚点还能进入 `keywords`、`entityHints` 和 expansion，而不是把整帖拿去 embedding。Compose Assist 默认最终返回 3 条；`ContextRecallService` 会先 over-fetch `3 * 6 = 18` 条交给 `RecallEngine`，`RecallEngine` 每个通道再 over-fetch `18 * 3 = 54` 条。嵌入未加载时跳过 vector，只保留 FTS。 |
| Vector 初始分 | `1 / (1 + distance)`。 |
| FTS 初始分 | `abs(rank) / maxAbsRank`。 |
| 多通道命中 bonus | 同一候选同时命中多个通道时保留最高分，并加 `0.05 * (channels - 1)`，最高不超过 `1.0`。 |
| MMR relevance | `baseScore + 0.15 * recencyScore + 0.10 * salienceScore`。 |
| MMR 选择分 | `0.7 * relevance - 0.3 * similarityToSelected`，用于在相关性和多样性之间平衡。 |
| Context rerank 加分 | specific signal overlap 每个 `+0.08`，最多 `+0.32`；anchor overlap 每个 `+0.07`，最多 `+0.28`；topic/project overlap `+0.08`；source overlap `+0.05`；部分成本/额度/工具类信号还有额外 `+0.06` 到 `+0.12`。 |
| Context rerank 扣分 | 有具体 query signal 但候选无 overlap `-0.28`；工具类 query 没有工具 overlap `-0.18`；off-domain signal mismatch `-0.20`；工具 query 且 off-domain mismatch `-0.22`；具体 signal 存在但无 anchor overlap `-0.14`。 |
| 隐藏规则 | 广播/公告类内容无场景 anchor、低信息标题无 anchor、具体 query 无 overlap 且低分、工具上下文 off-domain mismatch 等会被标成 `hidden`，不会进入最终 evidence。 |

### Compose 专属 evidence gate

Recall 返回后，Compose 先做现有场景相关性过滤，再统一经过共享 Evidence Cohesion Gate（证据对齐）。两层职责不同：相关性过滤判断“这条记忆是否值得提示”，Cohesion 判断“这些候选能否共同驱动一个草稿或 Context Pack”。

- Rehearsal 命中是“预演提醒” evidence，不是普通背景记忆。它必须靠人物、群组、issue、URL、meeting、topic 等 scene cue 命中；即使命中也只影响建议内容，不允许自动发送。
- 已经由召回层判定为 `rehearsal_cue` 的 Rehearsal 不再被普通文本 overlap 二次过滤误杀，因为这类提醒的相关性来自场景线索，不一定来自当前消息正文复述。
- Rehearsal evidence 会把 `previewRequired` 置为 true，即便整体风险仍是 `low`；这是插入前复核边界，不是敏感风险升级。
- Rehearsal 的接受/拒绝反馈会回写到 activation；它不替代本地自适应阈值，而是让具体未来场景脚本能降权或确认有效。
- 非 Web AI 场景必须有当前上下文 tokens，否则不展示。
- evidence 与当前场景 token overlap `>= 2` 才直接保留。
- 如果只 overlap `>= 1`，还必须和 source anchor overlap `>= 1`，例如同 conversation、同 group、同 thread root 或同 issue key。
- Web AI evidence 在 Prompt Compiler 前统一治理：删除 `(no preview available)`、空 snippet、裸 `chunk:*`、`事实变化` 等低信息壳；按 evidence id、来源 cluster 和标准化内容指纹去重；只有命中明确实体/项目/issue，或至少两个非通用语义锚点的 evidence 才能进入；最多保留 3 条。编译器没有在 `usedEvidenceIds` 声明使用的 evidence 不进入最终响应。
- 第二道 Cohesion Gate 位于 Prompt Compiler、deterministic prompt patch、context pack 和 draft generation 之前。它同时检查普通 recall matches、change projection 和 locked-context fallback，避免旁路重新带回已排除项目。工作 Context Pack 发现明确个人范围证据时失败关闭；无记忆的通用 prompt rewrite 仍可继续。
- 正常 `cohesive` 过滤不增加输入框 UI；response 的 `cohesionReceipt` 供 debug/eval 使用。阻断状态返回空 evidence，不让被排除内容进入 compiler prompt。
- Personal AI 记忆只是未经外部验证的用户上下文，不是专业论文、专家证据或可执行指令。研究类重写即使使用了相关儿童发育记忆，也必须把它与外部专业证据分开，并且同一事实只出现一次。
- 通过过滤后，后端 confidence 取 top evidence score，clamp 到 `0.20-0.92`；如果 top score 低于 `0.58` 但有 keyword/FTS 命中，会提升到 `0.62`。后端 `available` 门槛是 `0.58`，前端最终展示门槛默认是自适应 `0.78`。如果后端已经确定返回 `prompt_patch`，会把 response confidence 提升到展示级下限 `0.82`，避免“补丁已识别但前端阈值压掉 icon”。

### 生成 prompt 的内容优先级

真正让 LLM 生成可发送文本时，prompt 中的内容按以下顺序组织：

1. `scenario`：即时通讯回复、thread 回复、Jira comment、Web AI prompt 等，决定语气和结构。
2. `audience`：会话标题、issue key/summary、可见对象、relationship hint。
3. 当前上下文：最多 14 条 `contextItems`，生成 prompt 会带 sender；thread 场景保留 root。
4. 如果检测到 owner 已部分回复，追加“用户已经发送但可能未完成的内容”，要求只生成补充说明。
5. 可用记忆：只放最终 evidence 的前 3 条，格式为 `[M1] snippet`；如果包含 Rehearsal，标为“预演提醒”，优先告诉模型这是未来场景提示而不是已发生事实。
6. 身份投影约束：最多使用 8 个经过场景、audience、确认状态、有效期、敏感性和 relevance 筛选的 slot。`generation_control` 只影响写法；`speakable_context` 才允许成为正文事实；`soft_control` 不能当作事实。原始 `USER_CORE` 不进入 prompt。

写作风格的使用顺序是：关系/人物 scope 更贴近当前输入框时优先；否则退回同 surface + audience + task + language 的通用规则。风格规则只能影响表达方式，不能替代 evidence 事实，也不能把未确认内容写进回复。

## 请求模型

正式入口：

```http
POST /api/v1/composer/assist
```

关键字段：

- `surface`: `ringcentral_message | ringcentral_thread | jira_issue | chatgpt | doubao | claude | gemini | codex_cli | claude_code_cli | cursor_agent_cli | generic_agent`
- `contextType`: `message_thread | jira_issue | web_agent_prompt`
- `assistIntent`（optional）: `draft_compose | draft_refine`。缺失时服务端向后兼容推导：`web_agent_prompt` + 非空草稿 → `draft_refine`，否则 → `draft_compose`，保证 `/context-assist` 兼容入口不炸。
- `scenario`: `instant_message_reply | thread_reply | jira_comment | web_agent_prompt | compose_to_ai | agent_compose | document_note`
- `title`, `url`
- `draftText`: 用户草稿。Draft Compose 可为空；Draft Refine 在 blur 时冻结。RingCentral/Jira 不是主召回 query；Web AI Draft Refine 同时把它用于任务编译和召回 enrichment。
- `audience`: 会话标题、conversation/group id、issue key、visible people、provider 等对象线索。
- `identifiers`: conversation id、group id、thread root post id、issue key、provider。
- `contextItems`: 结构化上下文数组，优先使用。
- `sourceTypes`: 允许召回的记忆来源。
- `automationLevel`: 当前默认 `L1`，只推荐并等待用户确认插入。

响应字段：

- `available`: 是否应该展示建议。
- `suggestionType`: `none | context_pack | prompt_patch | rewrite_prompt | prompt_draft | reply_context | issue_context | reply_refine`
- `insertMode`: `append_patch | replace_draft`。`available=true` 时必填；服务端按 suggestionType 推导，不接受模型自行决定。`prompt_draft` / `rewrite_prompt` / `reply_refine` → `replace_draft`；`prompt_patch` / `context_pack` → `append_patch`。旧响应缺失该字段时，非 rewrite 按 append；rewrite 缺失或错误时前端隐藏。
- `insertText`: 可插入文本。
- `evidence`: 召回证据，保留 `exploreLink` 和安全来源链接。
- `cohesionReceipt`: 可选的消费前证据对齐回执；正常通过默认静默，记录使用/排除/cluster 数和策略版本。
- `riskLevel`: `low | medium | high`
- `previewRequired`: 后端风险提示字段。前端会把它作为 review gate：先展开预览，用户确认后才插入。`reply_refine` 强制为 true。
- `confidence`: 后端建议置信度。前端还会套用按 `surface:intent` 的自适应展示阈值。
- `queryTimeMs`
- `debug`: 调试信息。Web AI / agent compose 重点看 `compiler.mode/gaps/usedEvidenceIds/outputLanguage`、过滤前后 evidence 数、`taskFrame`、`egressRisk` 与 `recall.contextExpansion`；Draft Refine 重点看 `refineReceipt`（`pass` / `reason` / `semanticDistance` / `addedEvidenceFactCount`）；这些诊断不进入用户可见正文。

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

1. 解析 `assistIntent`（显式或向后兼容推导）。判断 owner 是否已在当前上下文末尾回复；完整回复则直接不展示。
2. 构造 `ContextRecallRequest`。RingCentral/Jira 的主 query 来自当前场景和 audience；Web AI Draft Refine 把冻结的 draft 放在召回 query 前部，但召回为空也不阻止完整 prompt rewrite；Web AI Draft Compose 以页面可见 turns / 场景为主。
3. `ContextRecallService` 走 fast path：`vector + fts`，limit 默认 3，并在最终展示前执行第一道 Cohesion Gate；随后执行 Web AI 低信息过滤、相关性准入、来源/id/内容去重和最多 3 条限制。如果显示预算把 matches 静音，但 context match 已锁定并携带 evidence ids，会先解析最多 6 条原始候选，再复用同一过滤链，最终仍最多 3 条。Compose Assist 的 `composer_guard` surface **不受** `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` 控制；该开关只关掉 Memory Lens / `web_passive` 等页面旁路检索。Lens 的向量通道另由 `CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED` 控制（未配置时默认开启；仅显式 `false`/`0`/`off`/`no` 关闭）。嵌入未加载时 vector 通道会跳过，FTS 仍会跑。
4. Compose 对最终 evidence 执行第二道 Cohesion Gate，覆盖 change projection 和 locked-context fallback；后续分支只能读取 gated evidence。共享前置管道（recall / cohesion / persona projection）对所有象限相同。
5. 二维策略路由：`assistIntent × contextType` 选择生成器。
   - `draft_compose` + Glip/Jira → 既有回复/issue 起草（`reply_context` / `issue_context`）。
   - `draft_compose` + Web AI → `prompt_draft` 生成器（复用 Prompt Compiler 骨架，无 8 字符前置）。
   - `draft_refine` + Web AI → 既有确定性 patch + Prompt Compiler（`rewrite_prompt` / `prompt_patch` / `context_pack`），再过软增量收益门。
   - `draft_refine` + Glip/Jira → `reply_refine` 生成器（传入原草稿，保留意图与已给事实，只补缺失信息或修正明显偏差），强制 `previewRequired`，再过严格增量收益门。
6. 增量收益门（仅 refine）：计算 `refineGain`；语义偏差超过阈值，或引入原草稿缺失的具体证据事实，二选一即可放行。不通过则 `available=false`，`debug.refineReceipt` 记录原因，不进入用户可见文案。
7. Web AI Draft Refine 先执行三个确定性 prompt patch。命中时直接返回 `prompt_patch + append_patch`，不调用通用编译器。
8. 其余 Web AI 任务在 kill switch 开启时进行一次结构化 Prompt Compiler 调用，只接收 `mode、insertText、usedEvidenceIds、gaps、confidence`。system prompt 明确要求只优化 prompt、保持草稿语言、保留目标/事实、不编造个人信息/引用，并把记忆视作未验证上下文；GPT-5 请求使用 `reasoning_effort=none`，结果保持紧凑；编译超时预算为 30 秒（`WEB_PROMPT_COMPILER_TIMEOUT_MS`）。
9. 服务端校验 mode、文本长度、置信度、主语言、用户目标/事实保留和 evidence id；失败、非法 JSON、超时或语言不匹配一律 `available=false`。
10. 服务端把 mode 强制映射成 insertMode，只返回编译器实际使用的 evidence，并重新计算风险。未成年人、健康、家庭、发育等内容为 high risk；普通项目记忆仍是 medium。对于“任务已明确、只缺 evidence 上下文”的非研究请求，服务端还会把模型的完整 rewrite 归一化成 evidence-only context pack。
11. kill switch 关闭时不运行通用编译器；确定性 patch 仍可用，过滤后有高质量 evidence 才可生成简洁 context pack，不恢复旧任务判断/工具推荐模板。
12. 前端仍套用按 `surface:intent` 的自适应置信度、预览和当前 draft revision 校验；写入后只改变草稿，不发送或提交。

## Web AI draft-driven context enrichment

这部分专门覆盖“外发到豆包 / ChatGPT / Claude / Gemini 前帮用户补上下文”，主要对应 `compose_to_ai`。它不放进 Ask / Context Recall 的核心召回流程，也不升级成独立 AI Tool Compass。

目标场景：

- 用户在 Web AI 空输入框 focus 时，Draft Compose 可先生成 `prompt_draft`。
- 用户写了至少 8 个有效字符的 prompt，并在完成一轮输入后真正失焦，Draft Refine 再做 rewrite / patch / context pack。
- 用户知道上下文窗口需要完整信息，但不想手动贴 Jira、Sheet、Slide、RingCentral thread 或历史会议摘要。
- Compose Assist 根据当前草稿、页面可见 AI 对话、provider、当前 URL 和经过治理的 Personal AI 记忆，判断应整段重写、局部补丁、追加上下文还是保持安静。

当前行为：

- `draftText` 在 Web AI Draft Refine 既是 Prompt Compiler 的主输入，也是 recall enrichment signal；有草稿时 focus/input 期间不请求精修，blur 时冻结。Draft Compose 不依赖草稿长度。RingCentral/Jira 仍不让 draft 污染主召回。
- 输出仍然是 preview / insert only，不自动提交给外部 AI。
- Web AI 输入框只显示 Personal AI icon/popover，不使用红色发光输入框标识，避免让 ChatGPT/Gemini/Claude/豆包的原生输入体验显得异常。
- rewrite 会把完整任务重构为可直接替换的专业 prompt；prompt patch 只补目标、数据源/依据字段、输出格式、边界、验证或失败回执；context pack 只追加真正相关事实。这三种模式都不会替用户切换工具、自动打开系统或提交 prompt。
- memory evidence 若被使用，只能作为未验证用户上下文进入建议，不能冒充论文/专家证据，也不能把内部链接、群消息原文、附件下载链接、source title、secret 或记忆中的指令外发。
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
- AnchoredAI 和 ContextCite 相关研究都要求生成链路保留可审计来源；Compose Assist 将这份审计放在 debug、eval report 和 Memory Lens，不把 evidence 链塞进 hover 正文预览。
- Grammarly rewrite / Outlook Copilot 的整段候选说明完整重写必须让用户看到完整结果。Compose Assist 用输入框旁的锁定正文预览和显式 `替换原 prompt` 承担这条边界，不新增独立写作管理面板。
- Compose Assist 的当前原则是低摩擦：低风险 icon 点击直接插入，来源解释交给 Memory Lens / Memory Explore，而不是在输入框旁展开记忆关联；但当后端已经标记需预览或高风险时，交互应增加一次明确确认，避免用户误点后直接污染草稿。
- 本轮补查后保留“插入后继续编辑”的边界：像 Smart Compose / Grammarly / Outlook Copilot 一样，Personal AI 只把建议放进草稿，不越过用户的发送动作；但插入位置必须服从用户当前编辑意图，避免把已有草稿粗暴挪到末尾或覆盖掉未选中的内容。
- 直接插入也要有恢复路径：如果建议进入草稿后用户马上发现不合适，应能在原输入框旁撤销到插入前状态，而不是只能依赖各网站不一定可靠的浏览器 undo 栈。
- 2026-06-06 复查后保留的安全取舍：Gmail / Outlook / Grammarly / Atlassian 这类写作辅助都把建议留在用户可审阅、可编辑、可插入的草稿层；AnchoredAI、ContextCite 和 Interaction-Required Suggestions 的研究也强调 agency、来源可理解和细粒度控制。因此 Compose Assist 对 Rehearsal、high risk 这类跨场景/敏感建议采用前端硬复核；复核仍只显示待写入正文和必要的“不发送”边界，具体来源留在非 Compose 审计入口，避免形成新的泄露面。
- 2026-06-09 到 2026-06-24 的几轮复查曾把 `草稿回执`、`来源路由` 和高风险来源隐藏提示放进输入框旁预览，用来解释写入目标、来源适配和刷新口径。2026-07-08 根据真实 ChatGPT 使用反馈收敛：Compose Assist 的插入入口不承担 Memory Lens 式证据解释，hover / 锁定复核只展示待插入正文；写入目标、未发送/未提交和撤销窗口放在插入后的短回执，来源路由和 evidence 细节保留在 debug / eval report / Memory Lens 中。

## 变化脉络证据

Compose Assist 可把 [变化脉络](./change_memory_ledger.md) 投影转成既有 `source_memory` evidence。它只提供当前/历史边界和最近变化，不新增 UI 来源面板，也不改变 Compose 的 Draft Compose / Draft Refine 触发、risk、preview、insert、undo 和 send 边界。

- Evidence metadata 使用 `changeLedger=true` 和 `currentStateBoundary`，便于生成器和 eval 识别。
- `last_observed` snippet 必须声明它不等于权威系统确认的当前值。
- `conflicted` snippet 必须显示当前值未知，不能偏向任一候选。
- 页面可见字段只影响本次 context projection，不写回事件链或外部系统。
- 只有变化 evidence、没有安全可写入正文时，Compose icon 仍保持安静，由 Memory Lens 提供只读查看。

## 源码与维护入口

- API 与服务编排：`memory-service/src/routes/composerAssist.ts`、`memory-service/src/core/ContextAssistService.ts`（含 `resolveComposerAssistIntent`、`evaluateComposerRefineGain`、四象限生成器）。
- 身份投影：`memory-service/src/core/ComposerAudienceResolver.ts`、`memory-service/src/core/PersonaProjectionService.ts`（含 `prompt_draft` / `reply_refine` scene）。
- 输入框探测、双策略触发和写入：`src/composer-guard/siteContextAdapters.ts`、`src/composer-guard/ComposerGuardController.ts`、`src/composer-guard/assistConfig.ts`。
- 展示门、`surface:intent` 阈值和回执文案：`src/composer-guard/assistPreviewPolicy.ts`、`src/composer-guard/types.ts`、`src/services/MemoryServiceClient.ts`。
- background intent 门控：`src/background.ts`（`COMPOSER_ASSIST_REQUEST`）。
- 质量回归：`memory-service/src/__tests__/api-composer-assist.test.ts`、`memory-service/src/__tests__/composer-assist-intent-routing.test.ts`、`memory-service/src/__tests__/composer-assist-eval.test.ts`、`memory-service/src/__tests__/personaProjection.test.ts`、`src/composer-guard/__tests__/ComposerGuardController.test.ts`、`tools/verify-compose-assist-*.mjs` 和 `evals/cases/compose-assist/`。
- 身份投影交互参考：[`docs/demo/persona-projection-contract.html`](../demo/persona-projection-contract.html)。
- **改触发/契约前必读**：本文「关键不变量（回归防线）」节。

## 验证

后端固定验证：

```bash
npm --prefix memory-service test -- --run \
  src/__tests__/personaProjection.test.ts \
  src/__tests__/api-composer-assist.test.ts \
  src/__tests__/composer-assist-intent-routing.test.ts \
  src/__tests__/composer-assist-eval.test.ts
npm run eval:run -- --suite evidence-cohesion-gate --no-repair
```

前端/extension 相关改动（含 Draft Compose / Draft Refine 互斥）：

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/composer-guard/__tests__/ComposerGuardController.test.ts
npm start
node tools/verify-compose-assist-draft-staleness-e2e.mjs
node tools/verify-compose-assist-direct-insert-e2e.mjs
node tools/verify-compose-assist-ambient-calibration-e2e.mjs
node tools/verify-compose-assist-persona-projection-e2e.mjs
```

等待首次 webpack dev compile 成功后停止 watch。

身份投影固定 eval：

```bash
npm run eval:run -- --suite compose-assist --case compose-assist-persona-peer-vs-manager --no-llm
npm run eval:run -- --suite compose-assist --case compose-assist-persona-jira-unconfirmed-duty --no-llm
npm run eval:run -- --suite compose-assist --case compose-assist-persona-web-ai-explicit-constraints --no-llm
```

Prompt rewrite / patch / context-pack eval：

```bash
npm run eval:run -- --case compose-assist-web-ai-context-pack-project-orbit --live --no-llm --no-repair
npm run eval:run -- --case compose-assist-web-ai-prompt-patch-jira-estimate --no-llm --no-repair
npm run eval:run -- --case compose-assist-prompt-rewrite-childcare-zh --no-repair
npm run eval:run -- --case compose-assist-prompt-rewrite-workweek-en --no-repair
npm run eval:run -- --suite compose-assist --no-repair
npm run eval:report
```

这组 eval 验证“当前 Web AI 草稿 + 可选 Personal AI 记忆 -> rewrite / patch / context pack / none”。中文幼儿入园 case 和英文 workweek case 都要求零记忆可重写、语言一致、`replace_draft` 正确，并禁止 `Gemma 4`、`chunk:*`、`no preview`、`事实变化`、NotebookLM/Gemini 推荐与通用 Jira 文案。旧 Project Orbit case 不再要求已移除的任务判断、工具适配和来源模板。

report 必须能看见：

- 实际使用的 chat/tab 或 snapshot 内容。
- 当前 draft/prompt。
- 请求里的 `surface`、`scenario`、`sourceTypes`。
- 召回到的 evidence、来源 mix 和 debug 信息。
- 最终 `suggestionType`、`insertMode` 与 `insertText`。
- judge 分数、通过/警告/失败原因，以及缺失的关键上下文。

建议保留的回归场景：

- RingCentral **空输入框 focus** 约 700ms 后发出 `assistIntent=draft_compose`；非空 focus 静默；真实 blur 才发 `draft_refine`。
- 去重签名含 intent：同一 `contextKey+revision` 的 compose 与 refine 可各请求一次，但同签名不重发。
- RingCentral 开发小群讨论 Codex/computer use/skills 时，不返回 flight、泛 meeting、假期公告。
- RingCentral thread 只使用 thread root/thread replies，不混入主会话底部消息。
- owner 已完整回复时不展示 icon。
- owner 已部分回复时，只生成补充回答。
- Jira comment 输出正式 comment，不输出即时通讯口吻。
- 同一事实面向老板、开发小群、Jira comment 时语气不同。
- RingCentral/Jira 用户 draft 里的无关关键词不污染主召回。
- Web AI **Draft Compose** 允许空草稿（无 8 字符前置）生成 `prompt_draft`；**Draft Refine** 仍要求 ≥ 8 有效字符，focus/input 期间不发 refine，真正 blur 才请求一次。
- Glip/Jira Draft Refine 输出 `reply_refine` + 强制预览；同义换词无增量收益时 `available=false`，原因只在 `debug.refineReceipt`。
- thumb-down 调阈写入 `surface:intent`（如 `chatgpt:draft_refine`），不得污染裸 `chatgpt` 或其它象限。
- 本次幼儿入园中文案例在零记忆时返回 `rewrite_prompt + replace_draft`；内容包含专业证据层级、多维影响、相关/因果边界、一般结论与个体决策分离、信息不足追问和明确输出格式。
- 英文完整任务返回英文 rewrite；错误语言、非法 JSON、超时、目标事实丢失都保持安静。
- 重复 `chunk:38982`、`(no preview available)`、Gemma license 和 `事实变化` 必须在编译前过滤；相关儿童发育上下文最多出现一次、不能冒充专业证据，并触发 high risk。
- Web AI 用户已经输入 Jira estimate、Codex Sites dashboard 或自动运行设计 prompt 后，仍能显示 Compose icon；点击后只插入 prompt patch，补齐依据/数据源、输出格式、写回/部署边界、验证和来源处理，不提交给外部 AI。
- ChatGPT/Gemini/Claude/豆包：**空草稿 focus 可请求 Draft Compose**；有草稿时 focus/input 期间不请求 Draft Refine；blur 后有建议时只显示 Personal AI icon，不给输入框加红色 glow。
- Web AI Jira/status prompt 只有在 evidence 直接相关时才可显示 Jira/项目来源标签；不得机械追加通用“核对 Jira owner/status”文案。
- 保存过的 Source Memory 资料胶囊能进入 Web AI context pack；当前目标 AI 自己的历史来源应在前端请求里先被剔除，并由后端继续兜底。
- Codex CLI / Claude Code / Cursor Agent fixture JSONL 能被 Desktop App adapter 解析，且 `agent_session` 抽取结果不包含大段代码/diff/tool output。
- `agent_session` 入库 metadata 应保留 `toolKey`、`sessionId`、`projectPath`、`taskKind`、`producedArtifacts`、`verificationSignals`。
- 用户在旧建议请求未返回前继续输入时，不渲染也不能插入旧草稿版本的建议；输入过程不发 refine，空草稿 compose settle 被打断则失效；下一次真正 blur（非空）或重新空 focus 后才展示基于最新 revision 的建议。
- Send/Submit、格式工具栏、Personal AI 控件和 undo 控件的焦点转换不误触发；rich iframe 使用同一 blur 契约。
- textarea、input、contenteditable、rich iframe 都验证完整替换、`insertReplacementText`/change、光标末尾和完整快照撤销；append 模式继续保持选区语义。
- `previewRequired=true`、`reply_refine` 或 `riskLevel=high` 时，第一次点击 icon 只展开锁定正文预览；未点击对应的 `替换原 prompt / 追加到 prompt / 插入草稿` 前不能改写草稿，点击 `取消` 只关闭当前建议；锁定预览不展示来源名、标题、命中原因或“建议依据”列表。
- 含 Rehearsal 预演提醒的建议即使风险为 low，也必须走一次锁定预览；预览内容仍只展示待插入正文，避免未来场景脚本被误点直接插入。
- hover popover 不展示“记忆关联”、来源路由、草稿回执、来源卡片、建议依据或 evidence links。
- 默认 Draft Compose 阈值 `0.78`、Web refine `0.72`、工作面 refine `0.86` 下，低置信建议不展示；插入会降低对应象限阈值，thumb-down 会提高对应象限阈值。
- append 模式下，contenteditable 中用户选中一段草稿后点击 icon，建议应替换该选区并保留前后原文；replace 模式忽略局部选区并替换完整草稿。写入成功且撤销窗口结束后才记录 accepted。
- 插入后点击 `撤销` 应恢复原草稿，并且不记录 accepted 反馈、不立即重弹同一建议。
- 输入框拒绝写入时应显示 `未写入草稿`，保留原草稿，并且不记录 accepted 反馈。
- Web AI 场景 thumb-down 只 dismiss 当前草稿对应的建议；用户在同一页面输入不同 prompt 时，下一次真正 blur 应重新请求 `/composer/assist`。
- 插入建议、改写后发送时，应产生 `edited_before_send` trace，且 trace 中不能包含完整最终发送文本。
- 停留查看 hover 建议或键盘聚焦预览但不插入，随后自行发送时，应产生 `sent_without_insert` trace；快速扫过 icon 不应产生这条被动 trace。
- thumb-down、取消复核或 Escape 后再发送自己的回复，不应额外产生 `sent_without_insert`；显式拒绝只保留 `wrong` 或关闭动作语义。
