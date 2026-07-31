# 新能力：Agent Run Profile / Agent 运行画像（搁置）

> 生成日期：2026-07-15 CST
> Codex 会话标题：`新能力：Agent 运行画像（搁置）`
> Demo：[`agent-run-profile-demo.html`](./agent-run-profile-demo.html)
> 状态：搁置；保留为后续参考，不进入实现排期

## 搁置原因

用户对模型档位、推理强度、工具顺序、上下文范围和输出/验证方式的选择会随具体场景临场决策。当前“运行画像”难以完整而准确地表达这些细粒度判断；若过早固化为自动匹配配置，容易把一次场景偏好误当成长期规则，并限制用户在当下的判断。因此当前不建议实现，先保留本方案与 Demo 作为问题记录，等待出现更稳定、可验证且用户愿意复用的执行模式后再重新评估。

## 两个真实使用场景

### 场景一：给 Codex / ChatGPT 开一个高难任务，不再手动重复“怎么跑”

1. 用户在 Codex 或 Web AI 输入框里写：`帮我做 AI-Native Challenge 的方案评审和 demo`。
2. Personal AI 识别到这不是普通聊天，而是一个高复杂度、需要评审口径和可验证产物的 agent run。
3. 输入框旁出现一条低打扰 chip：`建议应用 Agent 运行画像：AI-Native Challenge · 深度评审`。
4. 用户点开预览，看到运行画像不是一坨历史记忆，而是几项可执行设置：
   - 模型/推理：优先高推理档位；不是简单问答。
   - 输出契约：先 plan，再 demo，再验证证据。
   - 上下文：只带 challenge 相关记忆，不带泛 AI 工具讨论。
   - 验证：需要保存 eval/report 或至少列出可复核检查。
   - 边界：只插入草稿，不自动发送；不会修改 Codex / ChatGPT 的真实设置，除非目标平台支持且用户确认。
5. 用户点击 `应用到草稿`，输入框里新增一段短的 run profile block。用户仍可编辑和手动发送。
6. 这次 agent 不会漏掉“高推理档位”“先 plan”“demo 和验证”这些用户反复强调的执行习惯。

**Before**：用户每次都要重新解释“这个任务要用更高 reasoning、先写 plan、最后跑验证”。
**After**：Personal AI 把这些执行偏好变成场景化运行画像，按需带出，且可跳过、可审计。

### 场景二：Task Estimate / Jira 技能任务，不再把旧约束忘掉

1. 用户在 RingCentral / Jira / Codex 中准备让 AI 改进 `task-estimate` skill。
2. Personal AI 根据当前文本、Jira key、skill 名和历史记忆，匹配到一个运行画像：`Task Estimate · 证据优先评估`。
3. 画像提醒：
   - Jira ticket 内容默认走 Jira API / MCP / REST，浏览器 UI 只是 fallback。
   - 评估依据要包含 team field、summary、description、issue type、历史 Story Points benchmark、labels、components。
   - 如果要改进准确性，优先补 MR diff 和 design image 语义读取，而不是只调 prompt。
   - 输出必须附“缺什么证据 / 哪些原因不应该改 skill”的验证说明。
4. 用户不用再在不同 AI 工具里复述这些口径。Personal AI 只把这次任务相关的运行设置插入，不会把无关 token、私密链接或旧失败日志带给外部 AI。

**Before**：同一个 skill 的工具优先级、证据口径、验证方式散在消息和反思线程里。
**After**：运行前就能看到“这类任务该怎么让 agent 跑”，减少重复解释和错误执行。

## 结论

本方案记录一个候选能力：**Agent Run Profile / Agent 运行画像**；当前已搁置，不建议进入实现。

一句话：

> Personal AI 不只记住用户对 AI 说过什么，还要在用户发起一次 AI/agent 任务前，自动带出“这类任务应该怎么运行”的模型档位、工具优先级、上下文范围、输出格式、验证要求和安全边界。

它不是新聊天机器人，也不是通用 AI 工具推荐器。它是一层**运行前配置记忆**：把用户过去在 Codex、ChatGPT、豆包、OpenClaw、Jira skill、Prompt Config、Skill Foundry 中沉淀的执行偏好，编译成可预览、可跳过、可审计的 run profile。

## 为什么值得做

Personal AI 的长期目标是保存用户和 AI 的所有记忆，包括消息、浏览、操作、用户偏好、skill、其他 AI 对话，并在真实场景里给出关联提示。现在项目已经有很多“记住内容”的能力，但用户实际用 AI/agent 时还有一个明显断点：

- 记忆系统知道用户以前怎么要求 AI 工作，但下一次开一个新 agent run 时，这些“怎么跑”的设置不会自动跟上。
- AI 工具正在把模型、reasoning effort、工具、MCP、项目规则、custom instructions、memory、evals 都变成可调参数；用户很难每次手动选对。
- 同一个任务类型往往有稳定的运行口径，例如“Jira 先 API，再浏览器 fallback”“高复杂度 challenge 用高推理”“外部写入前必须验证授权”“输出 demo 后要跑检查”。
- 如果这些口径只藏在普通记忆里，agent 很容易重复踩坑；如果做成全局自定义提示词，又会污染所有任务。

Agent Run Profile 补的是中间层：**按当前任务动态选择少量运行设置，而不是把长期偏好全塞进 prompt，也不是让用户维护一堆全局配置。**

## 本轮输入信号

### Reminders 检查

本机 Reminders 通过 EventKit 可读，且存在 `Personal AI` 清单；本轮 `PERSONAL_AI_INCOMPLETE_COUNT = 0`。因此本方案不是来自 Reminder，没有需要标记 done 或写备注的 Reminder item。

### 线上记忆信号

本轮只读查询 `10.32.56.212:3210`，使用 `X-User-Id: esone.qiu`：

- `/health` 当前为 degraded，`database.connected=false`；但用户隔离 stats / actions / confirm / recall 可读。
- `/api/v1/stats` 返回 `messages.total=11387`、`chunks.total=10185`、`relationships.total=54683`、`confirmRequests.pending=30`。
- action / confirm 样本仍显示 OpenClaw 授权、外部核实、artifact gap 和 message rule improvement 的运行边界压力。
- recall 样本显示多个“运行设置型”记忆：
  - `AI-Native Challenge` 被记录为需要 `Extra High` reasoning / effort。
  - `B-DAILY.prompt_structure` 有固定五段顺序。
  - `task-estimate skill` 的 Jira 读取优先级是 Jira API / MCP / REST，浏览器只是 fallback。
  - Task Estimate 的评估依据包括 Jira team field、summary、description、issue type、历史 Story Points benchmark、labels、components，并且后续希望补 design image / MR diff 证据。
  - OpenClaw 失败样本要求能力缺失或鉴权失败时停止外部写入，进入决策/配置修复，而不是继续重试。

这些信号不是普通事实，它们更像“下一次让 AI 做事时要怎么配置、怎么限制、怎么验收”的运行记忆。

> 隐私提醒：本轮 recall 中也能看到历史消息可能包含 credential-like 文本。Agent Run Profile 的设计必须默认脱敏，不把任何 token/key/password 作为运行画像正文带给外部 AI。

## 产品亮点

1. **把“执行偏好”从普通记忆里拎出来**
   不是记住“用户说过 Extra High”，而是在相似任务出现时知道“这次 run 应该启用高推理/深度验证”。

2. **比全局 Custom Instructions 更精确**
   自定义提示词适合长期偏好；Run Profile 只在匹配任务时出现，避免所有请求都背着高成本、高上下文、高风险设置。

3. **比 Skill Foundry 更轻**
   Skill 是完整流程资产；Run Profile 是一次 agent run 的配置层。它可以服务 skill，但不要求用户先创建或维护 skill。

4. **比 Context Passport 更靠前**
   Passport 打包任务上下文给另一个 AI；Run Profile 决定“这次 AI 应该用什么运行方式处理这个任务”。

5. **可见、可跳过、可审计**
   用户看到来源、适用范围、过期状态、成本/延迟提示和副作用边界；默认只改草稿，不自动发送或外部写入。

## 与已有功能和 progressing 方案的边界

| 已有能力 / 方案 | 已覆盖什么 | Agent Run Profile 新增什么 |
|---|---|---|
| Custom Prompts / 用户上下文 | 长期偏好、消息/项目分析注入、作用域开关 | Run Profile 不改全局偏好；按当前任务临时选择模型、工具、输出、验证设置 |
| AI Context Passport | 把任务上下文、证据、边界交给另一个 AI | Passport 是“带什么上下文”；Run Profile 是“这次怎么跑” |
| Compose Assist / Prompt Context Compiler 思路 | 输入框前补上下文和 prompt slot | Run Profile 补运行参数和验证/工具策略，不替代正文 prompt |
| Personal Skill Foundry | 管理可复用 skill、平台同步、skill suggestion | Run Profile 可引用 skill，但不管理 skill 生命周期；同一 skill 可有不同 run profile |
| Action Readiness Contracts | 外部动作创建/执行前检查 capability/auth/target/approval/proof | Run Profile 在用户发起 AI 任务前生效；它可要求后续动作走 Readiness Contract |
| Evidence Watch / Open Question Exit | 管事实是否继续核实、问题是否退场 | Run Profile 消费这些状态，避免把 blocked watcher 当成可立即执行依据 |
| AI Session Context Drift Radar（搁置） | 已 handoff 给外部 AI 的上下文是否过期 | Run Profile 不监听外部会话；只在用户当前准备发起或继续 run 时给建议 |
| AI Tool Compass（搁置） | 推荐当前任务用哪个 AI 工具 | Run Profile 不做“你该用哪个工具”的一级推荐；只在当前 surface 上给运行配置建议 |
| Operation Flight Recorder | 记录跨工具操作 episode | Flight Recorder 是历史轨迹；Run Profile 是从历史轨迹中提炼出的下一次运行设置 |

一句边界：

> Context Passport 是任务行李箱，Skill Foundry 是可复用作业手册，Agent Run Profile 是发车前的运行仪表盘。

## 业内产品和研究参考

- [OpenAI Agents SDK Models](https://openai.github.io/openai-agents-python/models/) 支持在 agent 上设置模型和 `ModelSettings`，包括 reasoning effort、verbosity 等；这说明“运行配置”正在成为 agent 的一等输入。
- [OpenAI Building agents](https://developers.openai.com/tracks/building-agents) 明确区分 reasoning models 与非 reasoning models，并建议按复杂任务、规划、数学、代码、多工具工作流选择更高推理能力。
- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model) 提醒不要默认最高 effort，而应在代表性任务上比较配置；Run Profile 的 eval 设计正应该围绕这个原则。
- [OpenAI GPT-5.6 prompting guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6) 建议迁移时保留 reasoning effort、先跑代表性 eval，再做最小 prompt 修改；这支持把 `model + effort + eval` 作为一个可审计组合。
- [OpenAI Codex docs llms-full.txt](https://developers.openai.com/codex/llms-full.txt) 提到不同 agent 可能需要不同模型和 reasoning 设置，也可以通过 prompt 或 agent file 直接指定；Personal AI 可以帮用户从记忆中选择这些设置。
- [Anthropic Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 context 是有限资源，需要策展；Run Profile 把“运行设置”和“任务上下文”分离，避免用更多上下文弥补配置缺失。
- [Claude Code memory docs](https://code.claude.com/docs/en/memory) 让用户查看和管理 `CLAUDE.md` / auto memory；说明 coding agent 正在把项目规则和记忆可视化。
- [Claude effort parameter docs](https://platform.claude.com/docs/en/build-with-claude/effort) 把 effort 作为 response thoroughness 与 token efficiency 的权衡；Run Profile 应在 UI 里解释成本/延迟，而不是静默开高档。
- [Cursor Rules](https://cursor.com/docs/rules) 支持 Project / Team / User Rules 与 `AGENTS.md`，说明项目级、团队级和用户级 persistent instructions 已成 coding agent 常规配置。
- [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) 把 chats、files、custom instructions 和 memory 放进项目空间；Run Profile 可以作为 Personal AI 跨项目/跨工具的动态运行层。
- [An Empirical Study of Developer-Provided Context for AI Coding Assistants](https://arxiv.org/abs/2512.18925) 研究开源项目中开发者提供给 AI coding assistants 的规则，说明 persistent directives 已经包含 conventions、guidelines、project info、LLM directives、examples 等多类内容。
- [Semantic Commit](https://arxiv.org/abs/2504.09283) 研究用户如何更新 AI memory / intent specifications 并处理语义冲突；Run Profile 也需要类似的冲突检测，例如两个历史记忆对同一任务给出不同 effort 或工具优先级。

行业方向很明确：AI 工具不再只有 prompt，还有模型、reasoning、工具、MCP、项目规则、memory、evals、guardrails。Personal AI 的机会是把用户自己的历史执行经验转成**按场景选择的运行画像**。

## 产品定义

### 核心对象：AgentRunProfile

```ts
type AgentRunProfile = {
  id: string;
  title: string;
  status: 'candidate' | 'active' | 'snoozed' | 'dismissed' | 'expired';
  taskClass:
    | 'coding_agent'
    | 'research'
    | 'jira_estimation'
    | 'meeting_brief'
    | 'external_action'
    | 'prompt_template'
    | 'content_generation'
    | 'generic_ai_chat';
  targetSurface:
    | 'codex'
    | 'chatgpt'
    | 'doubao'
    | 'claude'
    | 'cursor'
    | 'openclaw'
    | 'web_ai'
    | 'personal_ai_internal';
  trigger: {
    matchedText?: string;
    sceneAnchors: string[];
    entities: string[];
    sourceRefs: string[];
    confidence: number;
  };
  runtimeHints: {
    preferredModel?: string;
    modelFamily?: 'fast' | 'reasoning' | 'vision' | 'voice' | 'coding';
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'extra_high' | 'max';
    verbosity?: 'low' | 'medium' | 'high';
    toolPriority?: Array<'jira_api' | 'mcp' | 'browser' | 'filesystem' | 'openclaw' | 'web_search'>;
    contextBudget?: 'tiny' | 'normal' | 'evidence_heavy';
    sourcePolicy?: 'personal_only' | 'work_only' | 'allow_external_sources' | 'redacted_external';
    outputContract?: string;
    validationContract?: string;
    approvalBoundaries?: string[];
  };
  evidence: Array<{
    ref: string;
    label: string;
    role: 'user_instruction' | 'successful_run' | 'failed_run' | 'skill_rule' | 'project_rule' | 'research_evidence';
    observedAt: number;
    freshness: 'fresh' | 'stale' | 'unknown';
  }>;
  conflict?: {
    state: 'none' | 'soft_conflict' | 'hard_conflict';
    summary?: string;
    requiresUserChoice?: boolean;
  };
  receipt: {
    label: string;
    scope: string;
    freshness: string;
    writeBoundary: string;
    privacyBoundary: string;
    costBoundary: string;
  };
};
```

### 什么会进入画像

会进入：

- 模型/推理档位建议，例如 `high` / `extra_high`，以及原因。
- 工具优先级，例如 Jira API / MCP > browser fallback。
- 输出格式，例如先 plan、再 demo、再验证，或固定报告栏目顺序。
- 验证要求，例如跑 eval、生成 report、用真实场景验证。
- 安全边界，例如外部写入前检查 OpenClaw 授权、缺 capability 时停止。
- 作用域，例如只使用 work memory，不带 personal memory；只带本任务 source refs。

不会进入：

- 原始 token、API key、password、signed URL。
- 大段聊天原文或网页正文。
- 未确认的用户画像事实。
- 和当前任务无关的全局偏好。
- 会直接发送、写文件、改远端配置的动作。

## 用户体验设计

### 1. 输入框旁的 Run Profile Chip

出现位置：

- Codex task composer / Web AI 输入框。
- Jira comment / RingCentral message compose。
- Memory Exploring 的 Skill / Ask / Context Passport 入口。
- OpenClaw / AgentTask 触发前预览。

显示内容：

```text
Agent 运行画像 · Task Estimate 证据优先评估
匹配 4 条执行记忆 · 建议：Jira API/MCP 优先，高证据输出，跑验证
[查看] [应用到草稿] [本次不用]
```

首屏必须说明：

- `只改当前草稿，不发送`
- `不写入外部平台`
- `高推理档位可能增加成本/延迟`
- `来源 X 条，旧来源 Y 条`

### 2. Profile Preview Drawer

抽屉分四块：

1. **运行设置**
   - 模型 / effort / verbosity / context budget。
   - 工具优先级。
   - 输出和验证契约。

2. **为什么匹配**
   - 命中的实体、skill、项目、任务类型。
   - 来源记忆的时间和角色。

3. **冲突与边界**
   - 旧 profile 是否过期。
   - 当前平台是否支持这些设置。
   - 是否需要用户确认高成本或外部写入。

4. **应用结果预览**
   - 将插入到输入框的短 block。
   - 如果目标平台支持 API settings，显示“会提交哪些 settings”；否则只插入文本。

### 3. 应用方式

按平台分层：

- **文本注入**：默认安全路径。把运行画像渲染成可编辑 prompt block，插入当前草稿，不发送。
- **平台设置映射**：如果目标是 Personal AI 内部 agent / OpenClaw / Codex API 且支持结构化设置，用户确认后传 `model`、`reasoningEffort`、`toolPriority`。
- **只读提醒**：如果平台不支持设置或无法确认登录态，只显示 profile，不注入。
- **反向学习**：用户应用、跳过、改写、发送后的结果写入 Outcome Loop 风格的 profile usage event，用于下次排序。

### 4. 不增加用户日常负担

P0 不做一个新的“运行画像管理台”。用户主要在发起任务时看到 chip；只有进入 Memory Exploring / Skills / Settings 时才有 profile 列表。

Profile 自动出现的条件要保守：

- 任务文本命中特定 skill / project / recurring task。
- 画像置信度高于阈值。
- 预计收益高于插入成本。
- 没有 hard conflict。

低置信画像只在 drawer 里作为“可选建议”，不弹主 chip。

## 运行画像生成与匹配逻辑

### 输入信号

- 当前草稿文本、页面 URL、Jira key、RingCentral thread、Codex task title。
- Recall / Ask / Source Memory / Skill Foundry 中的执行偏好。
- 已完成或失败的 agent action / OpenClaw action / confirm request。
- 自定义提示词和用户上下文中的显式偏好。
- Feature docs / AGENT.md / skill docs 中的项目规则。
- Outcome Loop 的采纳/跳过/失败信号。

### 生成候选

候选来源优先级：

1. 用户显式指令或已确认 skill rule。
2. 近期成功 run 的可复用设置。
3. 失败后修正过的运行设置。
4. 项目/平台文档里的规则。
5. LLM 从多条记忆中推断出的候选，必须标 `inferred`，P0 默认只读。

### 排序

```text
score =
  task_match * 0.35 +
  evidence_strength * 0.25 +
  recent_success_or_failure_fix * 0.15 +
  user_adoption_rate * 0.10 +
  platform_support * 0.10 -
  conflict_penalty * 0.20 -
  privacy_or_cost_penalty * 0.15
```

显示给用户的不是分数，而是：

- `匹配强` / `可能相关`。
- `来源足够` / `仅推断`。
- `平台可应用` / `只能插入文本`。
- `有成本提醒` / `有隐私阻断`。

### 冲突处理

常见冲突：

- 旧记忆说用 ChatGPT，但当前内部信息显示 ChatGPT 不可用。
- 一个 profile 建议高推理，另一个历史设置建议快扫。
- task-estimate 规则说 Jira API 优先，但当前 API 授权不可用。
- 用户草稿里显式写了“不要用浏览器”，而画像想用 browser fallback。

处理：

- hard conflict：不自动应用，只显示选择项。
- soft conflict：应用前显示差异并默认选择最新/更权威来源。
- cost conflict：高 effort / 高 token 输出必须有可见成本提示。
- privacy conflict：命中 secret/source policy 时 fail closed，不插入相关内容。

## 实施方案

### P0：只读画像 + 草稿注入

目标：证明用户是否愿意在发起 AI/agent 任务前使用运行画像。

范围：

- 新增 `AgentRunProfileService`，从 recall/profile/skill/action samples 生成候选。
- 新增 `/api/v1/agent-run-profiles/match`：
  - 输入：surface、draftText、scene anchors、target provider。
  - 输出：top profile + receipt + rendered prompt block。
- Web AI / Codex-like composer 上显示 chip 和 drawer。
- 只支持“应用到草稿”，不设置真实模型、不发送、不写外部平台。
- 写 usage event：viewed / applied_to_draft / skipped / edited_after_apply / sent_after_apply。

### P1：结构化设置映射 + 反馈学习

范围：

- 对 Personal AI 内部 agent / OpenClaw / AgentTask 增加结构化 settings mapping。
- 对 Codex / OpenAI Agents SDK 兼容设置：`model`、`reasoningEffort`、`verbosity`、tool policy、eval requirement。
- 加入 profile conflict resolver。
- 使用 usage event 更新排序：反复跳过的 profile 降权，应用后成功的 profile 升权。
- UI 增加“不要再对这类任务提示”。

### P2：Profile Library 与平台同步

范围：

- Memory Exploring 增加 `运行画像` 二级入口，不作为日常主页面。
- 与 Skill Foundry 互通：skill detail 可声明 default run profile。
- 与 AI Context Passport 互通：Passport 导出时可附 run profile，但用户可分开复制。
- 与 Custom Prompts 互通：用户可把局部 profile 升级为长期偏好，或反向从长期偏好拆出局部 profile。
- 支持 profile version、diff、stale receipts、manual merge。

## Demo 说明

Demo 文件：[`agent-run-profile-demo.html`](./agent-run-profile-demo.html)

它模拟一个集成在 Codex / Web AI 输入框旁的体验：

- 左侧是当前任务草稿和 AI 输入框。
- 顶部可以切换三个场景：`AI-Native Challenge`、`Task Estimate Skill`、`OpenClaw 外部写入`。
- 右侧是匹配到的 Agent Run Profile：模型/推理、工具优先级、输出契约、验证契约、隐私/成本/写入边界。
- 点击 `应用到草稿` 后，只更新本页草稿和回执，不会发送、不写外部平台、不保存长期画像。

## 成功指标

### 早期定性

- 用户能在 10 秒内理解画像建议的是“怎么跑”，不是“记忆摘要”。
- 用户能明确知道 `应用到草稿` 不等于发送、不等于改平台设置。
- 用户能判断为什么匹配，以及哪些来源过期或有冲突。

### MVP 量化

- 匹配到 profile 的任务中，用户 `applied_to_draft` 比例 >= 30%。
- 应用后又立即删除整段 profile block 的比例 < 20%。
- 高置信 profile 的 skip reason 中，`不相关` < 25%。
- 对已有真实场景 eval，关键运行设置召回准确率 >= 0.8。
- 没有 secret/token/password 被渲染进 profile prompt block。

## Evals 决策

这个功能依赖 recall、分类、LLM 判断、排序和生成的运行配置是否真正有用，因此实现时必须新增 evals。

建议新增 suite：`agent-run-profile`

文件：

- `evals/cases/agent-run-profile/`
- `evals/workflows/agent-run-profile/experience.md`
- `evals/registry.yaml`

第一批真实/半真实场景：

1. **AI-Native Challenge**
   - 输入：`帮我做 AI-Native Challenge 的方案评审`。
   - 期望：识别高复杂度，建议高 reasoning / deep review / eval 或验证报告。

2. **B-DAILY prompt structure**
   - 输入：`帮我改 B-DAILY 的日报 prompt`。
   - 期望：带出固定五段顺序，不把它当成普通自由写作。

3. **Task Estimate Skill**
   - 输入：`完善 task-estimate skill，让它读 Jira、图片和 MR diff`。
   - 期望：工具优先级为 Jira API/MCP/REST > browser fallback；输出要求列 evidence gap 和验证方式。

4. **OpenClaw auth failure**
   - 输入：`继续让 OpenClaw 把视频上传到 Drive`，且当前历史有 auth/fetch failure。
   - 期望：不直接建议外部写入；必须先显示 capability/auth 修复或人类确认。

5. **负例：普通短问答**
   - 输入：`这个缩写是什么意思？`
   - 期望：不推荐高推理 run profile，不注入长运行 block。

6. **secret redaction**
   - 输入/历史中包含 credential-like 片段。
   - 期望：profile 中只出现 `credential redacted` 或安全边界，不出现原值。

实现完成后必须：

```bash
npm run eval:validate
npm run eval:run -- --suite agent-run-profile --no-repair
```

若 report 未通过，应继续调整 profile matching / redaction / rendering，直到所有关键用例通过。若要用真实 `esone.qiu` 数据扩展场景，必须只读抽样并脱敏。

## 文档维护要求

功能实现完成后，要把关键点和关键逻辑维护进正式 docs：

- 若 P0 只做输入框 chip 和草稿注入：更新 `docs/features/compose_assist.md`，说明 `compose_to_ai` / Web AI 输入框里的 run profile 边界。
- 更新 `docs/features/custom_prompts.md`，说明 Run Profile 与长期自定义提示词的区别：局部任务设置 vs 长期偏好配置。
- 更新 `docs/features/personal_skill_foundry.md`，说明 skill 可以声明 default run profile，但 profile 不等于 skill。
- 更新 `docs/features/memory_system.md`，说明 `AgentRunProfile` 是运行前配置记忆，来源、匹配和 redaction 规则。
- 如果 P1/P2 做成独立 API 和列表页，再新增 `docs/features/agent_run_profile.md`，避免把大段运行画像逻辑塞进 Compose Assist 文档。
- 若 Desktop App / Codex / OpenClaw 适配落地，还要同步更新 `desktop-app/docs/features/doubao_bridge.md` 或相关 provider docs。

正式文档必须包含：

- 大白话运行逻辑。
- 数据来源和优先级。
- 任务匹配 / 冲突 / 过期 / redaction 的决策逻辑。
- 应用到草稿、平台设置映射、外部写入的边界。
- 最小验证命令和 eval report 说明。

## 风险与取舍

| 风险 | 表现 | 对策 |
|---|---|---|
| 误匹配导致 prompt 变啰嗦 | 普通问题也被塞运行画像 | P0 高阈值；负例 eval；用户 skip 后降权 |
| 高推理成本被静默放大 | 每次都建议 Extra High | 成本回执；默认只文本建议；高 effort 需显式展示原因 |
| 和 Custom Prompts 重叠 | 用户不知道哪个更权威 | UI 写清：Profile 只对本次任务；长期偏好仍由 Custom Prompts 管 |
| 旧记忆过期 | 继续建议不可用工具或旧模型 | freshness receipt；硬冲突不自动应用；Evidence Watch / Freshness 信号可降权 |
| 泄露凭据 | 历史消息中的 token 被带给外部 AI | 渲染前 redaction gate；secret eval；敏感来源只给占位 |
| 画像变成又一个管理后台 | 用户被迫维护配置 | P0 不建一级页面；profile 主要在任务现场出现 |
| 平台无法设置模型/effort | 用户以为点击后真实设置已改 | 默认只插入草稿；只有结构化 API 成功才显示平台设置已应用 |

## 推荐决策

当前不建议进入设计或实现排期。

本方案识别到的需求真实存在，但执行偏好依赖用户在当下任务中的细粒度判断，现有画像机制不足以稳定地覆盖这种差异。后续只有在发现多个可复用场景具有明确、低误匹配、可通过真实 eval 验证的共同运行模式时，才重新评估最小切片；在此之前，Demo 只作为搁置的交互参考，不是实现目标。
