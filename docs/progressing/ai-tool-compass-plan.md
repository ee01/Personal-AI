# 新能力：AI Tool Compass / AI 工具适配罗盘（搁置）

> Codex 会话标题建议：新能力：AI 工具适配罗盘（搁置）  
> Demo：[`ai-tool-compass-demo.html`](./ai-tool-compass-demo.html)  
> 生成时间：2026-05-24 08:04 CST  
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表没有 `Personal AI` 清单，因此没有新的 Reminder idea 可随机选择，也没有需要标记 done 的事项。

## 搁置原因

当前暂不建议把 **AI Tool Compass / AI 工具适配罗盘** 作为独立能力推进。

本次复核 `docs/progressing` 后，直接的 **AI Context Passport / 跨 AI 上下文护照** 还没有标记搁置；但几个相邻的跨 AI / 多 AI 方向已经被搁置，包括：

- [`AI Session Context Drift Radar / AI 会话上下文漂移雷达`](./ai-session-context-drift-radar-plan.md)：因为它依赖可靠判断某段 Context Passport 是否已经交给外部 AI 会话，需要 Chrome Extension / Desktop App 持续观察 ChatGPT、豆包、Codex Web、Claude、Cursor、Codex CLI 等入口，工程和隐私前置条件过重。
- [`AI Conversation Memory Loom / 多 AI 对话织机`](./ai-conversation-memory-loom-plan.md)：因为“同一话题跨多个 AI 工具频繁切换并形成多份可聚合对话”的使用频率假设不足，独立产品面容易变成低频整理台。
- [`Agent Memory Control Tower / 多 AI 协作塔台`](./agent-memory-control-tower-plan.md)：因为当前 Personal AI 不能直接自动调用大多数外部 agent 工具，独立推进会把产品重心从个人记忆系统推向 agent 调度器。

AI Tool Compass 虽然表面上是“当前任务该用哪个 AI 工具”，但它会自然滑向同一类问题：跨 AI 工具选择、上下文交接、工具状态判断、外部能力可用性、handoff brief 和结果学习。要把它做得足够准，系统仍然需要稳定观察用户在多个 AI 工具里的使用结果、访问状态、任务是否成功、是否真的采用推荐路线。这和上面几个已搁置方向的前置能力高度重叠。

因此本方案记录为搁置方向。短期更合理的处理方式是把可复用的小部分留在现有能力里：

- 工具选择提示如果只是“给目标 AI 生成什么上下文”，归入 **AI Context Passport** 或 Compose Assist 的未来扩展。
- 如果只是“当前页面 / Ask 结果是否缺 source anchor”，归入 **Ask / Context Recall 上下文补齐与指代消解**。
- 如果只是“某个工具不可用、quota 不足、connector 失败”，归入 **Memory Coverage Map / Action Queue / provider health** 的状态展示。
- 如果未来真实数据证明用户高频在多个 AI 工具间切换同一任务，再重新评估是否需要独立 Compass。

## 一句话

**AI Tool Compass / AI 工具适配罗盘** 是 Personal AI 的“当前任务该用哪个 AI 工具”的记忆辅助层。

用户不缺 AI 工具。用户缺的是：当自己正在看 Jira、准备会议、写 RingCentral 回复、整理 Google Sheet、做 Codex 任务、研究 NotebookLM/Gemini/Cursor/Claude/Codex 差异时，系统能不能基于自己的真实历史、组织约束、工具状态、资料证据和近期结果，低打扰地告诉他：

- 这件事建议用哪个 AI 工具或组合。
- 为什么是它，而不是另一个。
- 应该带哪些上下文过去。
- 哪些内容不要带、哪些能力当前不可用。
- 做完以后这次工具选择是否成功，能不能沉淀成个人偏好或团队经验。

它不是新的 AI 平台，也不自动调度一堆 agent。它更像一个贴在 Personal AI 记忆系统上的“工具选择导航”：**把用户已经拥有的多 AI 使用记忆，转成现场可执行的工具建议。**

## 为什么要做

### 真实用户问题

从本轮只读查询 `10.32.56.212` 上 `esone.qiu` 的真实记忆看，用户的工作环境已经不是“用不用 AI”，而是“每天在多个 AI 之间切换”：

- 记忆库当前约有 `9493` 条消息、`13665` 个实体、`49286` 条关系、`37` 个待确认项。
- 来源高频是 `glip 8697`、`meeting 349`、`calendar 210`、`system 209`、`jira 17`。
- 最近记忆里有：
  - `CoP - 基于AI的个人发展和工具`
  - `AI Refresh: Mastering Google AI Studio, Gems, and NotebookLM`
  - `Bug - AI 先修一遍我再看`
  - 团队讨论 Codex、Claude Code、Cursor、Factory.ai、OpenAI deal、NotebookLM、Gemini、webpage-mcp、Codex Chrome 插件。
- 反思线程里已经出现工具状态事实：
  - `Claude` 更常用于码字或 review。
  - `Gemini` 更常用于平常聊天讨论方案。
  - `codex/cc` 用于动态生成页面并插入 app。
  - `OpenRouter` quota 几乎用完。
  - `Cursor` 额度需要申请提升。
  - `Claude Code extension` 仍有组织成员/角色导致的访问问题。
- Confirm requests 里也有多个 OpenClaw delegation 失败项，原因不是用户不想自动化，而是缺少工具能力、原始快照、Jira/Chrome 登录态或外部系统锚点。

这说明 Personal AI 现在最有价值的一个新能力不是“再接一个 AI”，而是帮助用户在真实任务现场少做选择题：

> 这件事是让 Codex 跑？Claude Code review？ChatGPT 深挖？Gemini/Gems 做资料整理？NotebookLM 围绕 sources 研究？OpenClaw 执行？还是先别用 AI，因为缺少可验证输入？

### 用户体验目标

用户不应该打开一个“AI 工具管理后台”逐个比较参数。理想体验是：

1. 用户在现有工作表面继续工作。
2. Personal AI 识别当前任务类型、来源、风险和已有记忆。
3. 右下角或 Ask 结果里出现一个小卡片：`建议用 Codex · 因为这是 repo 内可验证修改，已有测试入口；Claude 更适合复审。`
4. 用户点开后能看到证据、替代方案和一键生成的 handoff brief。
5. 用户做完后只需一个轻反馈：`有用 / 不准 / 成功 / 失败`，系统把这次工具选择结果写成未来可用的 personal tool memory。

亮点不是“推荐一个模型”，而是 **推荐一个带证据、带约束、带上下文包、可学习的个人工作流路由。**

## 业内产品和研究参考

### 产品趋势

1. [OpenAI Codex web](https://developers.openai.com/codex/cloud) 已经把 Codex 定位成可以在云端后台读代码、改代码、跑代码的 coding agent。它适合 repo 内任务、bug fix、PR、测试验证，但依赖清晰环境、权限和任务边界。

2. [OpenAI 关于 Codex 安全运行的文章](https://openai.com/index/running-codex-safely/) 强调边界、低风险动作快走、高风险动作显式 review、保留 agent-native telemetry。这对 Compass 的启发是：工具推荐不能只看“能力强”，还要看当前任务能否被约束、能否审计、是否需要人工审批。

3. [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) 把 specialized subagents 用于任务拆分、上下文隔离、成本控制和权限限制。Compass 不复刻 subagent 系统，但可借鉴“每种任务有适配的 worker / context / permission”这套产品语言。

4. [Google Gemini Notebooks + NotebookLM](https://blog.google/innovation-and-ai/products/gemini-app/notebooks-gemini-notebooklm/) 说明 Google 正在把聊天、文件、NotebookLM source workspace 合并成项目级知识空间。Compass 应把 NotebookLM / Gemini 的优势识别为“source-grounded research / 多资料项目空间”，而不是把它和 Codex 放在同一个纯聊天维度比较。

5. Cursor Background Agents 和 GitHub/Codex/Claude agent 集成说明 coding agent 正在变成多入口、多会话、多后台任务的生态。用户以后会更需要一个个人层面的“什么时候用谁”的私有路由记忆，而不是凭当天感觉切工具。

### 论文和专家讨论

1. [Comparing AI Coding Agents: A Task-Stratified Analysis of Pull Request Acceptance](https://arxiv.org/abs/2602.08915) 对 OpenAI Codex、GitHub Copilot、Devin、Cursor、Claude Code 等 agent 做任务类型分层比较。核心启发是：**没有单一 agent 在所有任务类型上都最好**，工具选择应该按任务类型和历史成功率来做。

2. [RouteLLM](https://arxiv.org/abs/2406.18665) 研究如何用偏好数据在强弱模型之间做动态路由，平衡成本和质量。Compass 的个人化版本不是自动替用户调用模型，而是把“个人偏好反馈 + 成本/权限 + 任务类型”变成可解释推荐。

3. [FrugalGPT](https://arxiv.org/abs/2305.05176) 讨论 prompt adaptation、LLM approximation、LLM cascade 等成本优化策略。对个人用户来说，成本不只是 API 价格，也包括上下文重建时间、工具登录/权限失败、输出不可验证带来的返工。

4. Context engineering 相关实践已经反复说明：现代 AI 工作流的关键不只是模型能力，而是每次调用前选对最小且高信号的上下文。Compass 可以和 AI Context Passport 协同：Compass 负责“选谁和怎么用”，Passport 负责“把上下文打包给它”。

## 和已有 progressing / features 的边界

| 已有方向 | 它解决什么 | Compass 不重复的边界 |
| --- | --- | --- |
| AI Context Passport | 把当前任务上下文打包给外部 AI | Compass 先判断该给哪个工具、为什么、用哪种 handoff；选定后再调用 Passport |
| Agent Memory Control Tower（搁置） | 多 agent 分派、执行监控、合并 | Compass 不自动调度 agent，不做任务塔台，只给用户可审计建议 |
| AI Conversation Memory Loom（搁置） | 聚合同一 workstream 的跨 AI 对话 | Compass 不聚合历史对话本身，只学习“某类任务用某工具是否成功” |
| Decision Time Machine | 回放历史决策证据链 | Compass 面向当前任务工具选择；历史决策只是证据来源之一 |
| Source Memory Distiller | 把长资料蒸馏成 source memory capsule | Compass 消费工具产品资料和用户高亮，不负责资料蒸馏流程 |
| Memory Freshness Radar | 监测来源变化导致旧记忆过期 | Compass 只关心工具能力/权限/成本是否影响本次推荐 |
| Memory Coverage Map | 看哪些来源已接入、健康度如何 | Compass 会使用 Coverage 的 source health，但不是覆盖地图 |
| Ambient Recall Calibration | 用真实使用信号校准召回准确率 | Compass 学习工具选择结果，不替代全局 recall calibration |
| Personal Skill Foundry | 从用户操作中沉淀可复用个人 skill | Compass 可把成功工具路线推荐给 Skill Foundry，但主对象是外部 AI tool fit |
| Memory Lens | 当前页面相关记忆提示 | Compass 可作为 Lens 的一种卡片类型：`这页适合用哪个 AI 继续` |

最重要的边界：**Compass 是“工具选择 + 使用路线”的现场建议，不是“工具执行器”。**

## 产品形态

### 1. 现场小卡片

出现在当前页面、Jira、RingCentral、Google Sheet、AI 工具页面、Meeting Pilot / Today Pilot / Ask 结果中。

卡片默认只有一行：

> 建议用 Codex：repo 内可验证修改，已有测试命令；Claude Code 可作为 review 备选。

展开后显示：

- 推荐工具：Codex / Claude Code / Cursor / ChatGPT / Gemini / NotebookLM / OpenClaw / 手工处理。
- 适配理由：任务类型、上下文形态、证据来源、历史成功率、成本/权限状态。
- 替代方案：什么时候换另一个工具。
- Handoff brief：一键复制或交给 AI Context Passport。
- 风险：缺少登录态、工具 quota、没有 repo、没有可验证 artifact、内部数据不要外发。
- 结果反馈：`用了并成功`、`用了但失败`、`换了另一个`、`这次不需要 AI`。

### 2. Ask 中的工具路线

当用户问：

- “这个 Jira 数据怎么整理？”
- “AI VBG 的 BE 部分完成情况如何？”
- “这个 bug 先让 AI 修一遍我再看，应该怎么跑？”
- “CoP 分享材料用哪个 AI 工具准备？”

Ask 不只回答事实，还可以给一段：

> 工具路线建议：先用 Personal AI/Ask 确认范围 -> NotebookLM 处理 source-grounded 资料 -> Codex 生成 demo 或脚本 -> Claude Code 做 review。  
> 不建议直接丢给单个聊天 AI，因为 Jira / 内部表格 / 会议链接需要 source anchors。

### 3. Today Pilot / Meeting Pilot 前置建议

例如日历出现 `CoP - 基于AI的个人发展和工具`：

- Today Pilot mission 卡显示 `工具路线：NotebookLM/Gemini 资料整理 + Codex demo + Personal AI source memory capsule`。
- Meeting Pilot 会前 brief 里提示：`这次分享可能会被问到 Codex Chrome 插件 vs webpage-mcp，建议准备对比表。`

### 4. 轻量工具画像页

不是主入口，只做审计和调整：

- 工具列表：Codex、Claude Code、Cursor、ChatGPT、Gemini/Gems、NotebookLM、OpenClaw、RingClaw。
- 每个工具的个人适配画像：
  - 最近成功任务。
  - 失败原因。
  - 可用状态 / 访问状态 / quota 状态。
  - 适合任务类型。
  - 不建议使用的场景。
  - 关联 skill / passport template。
- 用户可以修正：
  - `Gemini 更适合方案讨论，不要推荐它写 repo patch。`
  - `Claude Code extension 当前不可用。`
  - `OpenClaw 只能做本机可调用能力，不要承诺 Glip 状态写入。`

## 核心用户流程

### Flow A：当前任务推荐

1. 用户打开 Jira issue / RingCentral thread / Google Sheet / repo 页面。
2. Memory Lens 或 Ask 解析当前场景：
   - task kind：bug fix、review、资料研究、会议准备、消息回复、表格分析、政策判断。
   - source anchors：Jira key、repo、meeting、sheet、people、deadline、internal/external。
   - available context：已有 memory、source capsule、relationship card、rehearsal、decision chain。
3. `ToolCompassService` 读取工具画像和最近结果：
   - tool capability memory
   - access/quota/status memory
   - user's successful/failed outcomes
   - current source health
4. 返回 1 个主推荐 + 2 个替代方案。
5. 用户选择：
   - `复制给 Codex`
   - `生成 Passport`
   - `先 Ask 补齐上下文`
   - `暂不使用 AI`
6. 结果反馈回流为 `tool_usage_outcome`。

### Flow B：用户没有问，系统也不打扰

Compass 不应该在每个输入框都弹。

触发条件建议：

- 当前页面/消息/会议明确出现 AI 工具、代码、Jira、资料研究、导出、表格、会议准备等任务语义。
- 当前任务存在多工具选择空间。
- Personal AI 至少有一条可解释证据：历史成功/失败、用户偏好、工具状态、source health、产品能力资料。
- 没有高风险私密上下文需要默认隐藏。

否则保持安静，只在 Ask 或用户点击 Lens 时展示。

### Flow C：做完后的无感学习

用户不需要写复盘。

可学习信号：

- 用户点了哪个工具。
- 用户复制了哪份 Passport / handoff brief。
- 用户是否在 30 分钟内回到 Personal AI 标记成功。
- Codex/Claude/Cursor 任务是否产生 PR / diff / artifact。
- 用户是否改用另一个工具。
- 用户是否 dismiss 推荐。
- 用户是否把结果沉淀成 skill 或 source memory。

学习产物：

- `tool_fit_signal`
- `tool_usage_outcome`
- `tool_status_fact`
- `tool_handoff_template`
- 可选 confirm request：仅在系统要把一次行为提升成稳定偏好时问用户。

## 体验设计原则

1. **先解释任务，不先排名工具。** 用户看到的第一句话应是“我判断你现在要做的是 X”，再说“所以建议用 Y”。

2. **只给一个主推荐。** 多工具比较容易变成负担；默认主推荐 + 两个备选足够。

3. **不要承诺自动执行。** 如果工具当前没有可验证执行入口，按钮只能是 `复制 brief`、`生成 Passport`、`打开工具`、`记录偏好`。

4. **推荐必须带证据。** 至少展示 2 类证据：历史记忆、当前页面/任务、工具状态、行业资料、用户反馈。

5. **失败原因比成功更有价值。** 例如 `OpenClaw 无 Glip 状态写入能力`、`Claude Code extension access issue`、`OpenRouter quota almost used up` 应显式降低推荐。

6. **不把组织工具决策当成个人事实。** Compass 可以说“团队正在讨论 Codex vs Claude Code”，但不能把临时投票当成最终政策。

7. **所有外发上下文交给 Passport / Egress 规则处理。** Compass 自己不拼接敏感私有记忆给外部 AI。

## P0 范围

### P0.1：数据结构和只读建议

新增运行态表：

```sql
CREATE TABLE ai_tool_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  access_state TEXT NOT NULL DEFAULT 'unknown',
  quota_state TEXT NOT NULL DEFAULT 'unknown',
  best_for_json TEXT NOT NULL DEFAULT '[]',
  avoid_for_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

CREATE TABLE ai_tool_fit_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_key TEXT NOT NULL,
  task_kind TEXT NOT NULL,
  surface TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  score_delta REAL NOT NULL DEFAULT 0,
  evidence_ref TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE ai_tool_recommendation_receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_fingerprint TEXT NOT NULL,
  surface TEXT NOT NULL,
  recommended_tool TEXT NOT NULL,
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  rationale_json TEXT NOT NULL DEFAULT '[]',
  selected_tool TEXT,
  outcome TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
```

P0 先不需要 LLM 大模型路由器。可以用 deterministic scoring：

```ts
score =
  taskKindFit
  + sourceFit
  + recentSuccess
  + userPreference
  + accessAvailability
  + verificationFit
  - quotaPenalty
  - missingAnchorPenalty
  - privacyRiskPenalty
```

### P0.2：API

```txt
POST /api/v1/tool-compass/recommend
GET  /api/v1/tool-compass/profiles
POST /api/v1/tool-compass/receipt/:id/feedback
POST /api/v1/tool-compass/status-fact
```

`recommend` request：

```json
{
  "surface": "jira|ringcentral|ask|meeting|web|ai_chat|memory_exploring",
  "taskText": "Bug - AI 先修一遍我再看",
  "currentContext": {
    "url": "...",
    "title": "...",
    "sourceAnchors": ["repo", "jira", "meeting"],
    "entities": ["Codex", "Claude Code", "Cursor"],
    "privacy": "work_internal"
  },
  "allowedActions": ["copy_brief", "render_passport", "open_tool"]
}
```

response：

```json
{
  "taskFrame": {
    "kind": "repo_bugfix",
    "summary": "让 AI 先修一遍，再人工 review",
    "confidence": 0.82
  },
  "recommended": {
    "toolKey": "codex",
    "displayName": "Codex",
    "fit": 0.86,
    "why": [
      "repo 内可验证修改",
      "用户近期多次用 Codex 做代码/页面任务",
      "可以要求运行测试并产出 diff"
    ],
    "limits": [
      "必须给 repo/branch/test 命令",
      "内部链接不要原样外发到非授权环境"
    ]
  },
  "alternatives": [
    {
      "toolKey": "claude_code",
      "fit": 0.71,
      "why": ["适合作为 review / 文档整理"],
      "limits": ["当前 extension access issue 可能未解决"]
    }
  ],
  "actions": [
    {"kind": "render_passport", "label": "生成 Codex brief"},
    {"kind": "copy_brief", "label": "复制最小上下文"}
  ]
}
```

### P0.3：前端入口

优先放在已有 surface，不开独立大页面：

- Memory Lens card：`工具建议`
- Ask result block：`建议工具路线`
- Today Pilot mission detail：`推荐 AI 工具`
- Memory Exploring 新增轻量 tab：`AI 工具`，用于查看/修正工具画像

### P0.4：Demo

[`ai-tool-compass-demo.html`](./ai-tool-compass-demo.html) 模拟：

- 左侧是用户正在看的 RingCentral / Jira / Calendar 混合工作面。
- 中间是当前任务：准备 AI 工具 CoP 分享和 “Bug - AI 先修一遍我再看”。
- 右侧是 Personal AI Tool Compass 卡片：
  - 推荐 NotebookLM/Gemini 做 source-grounded research。
  - 推荐 Codex 做 demo / repo patch。
  - Claude Code 作为 review 备选但显示 access warning。
  - OpenClaw 因缺少 Glip/Jira 执行能力不推荐自动执行。

## P1 范围

### P1.1：工具状态自动更新

来源：

- Memory Coverage Map 的 source health。
- provider sync jobs。
- 最近 confirm requests / failed actions。
- Source Memory Distiller 保存的 AI 工具资料。
- 用户手动状态修正。

例如：

- `OpenRouter quota almost used up` -> 降低需要 API 消耗的路线。
- `Claude Code extension access issue` -> 推荐时标记 `需要先确认权限`。
- `OpenClaw 当前缺少 Glip status 写入能力` -> 不推荐它做 presence 自动化。

### P1.2：Task kind 分类

任务类型先保持有限：

- `repo_bugfix`
- `code_review`
- `ui_demo`
- `source_research`
- `meeting_prep`
- `jira_data_analysis`
- `spreadsheet_work`
- `message_reply`
- `policy_or_tool_decision`
- `automation_execution`
- `unknown`

每类维护：

- ideal input shape
- recommended tools
- minimum anchors
- verification expectation
- privacy boundary

### P1.3：Outcome learning

把用户反馈和实际行为转成工具适配分：

- `selected_recommended_tool`
- `selected_alternative`
- `dismissed`
- `copied_passport`
- `task_succeeded`
- `task_failed`
- `produced_artifact`
- `needed_manual_fix`
- `tool_unavailable`

只在多次稳定后才生成偏好候选：

> 你最近 5 次 repo 内 UI/demo 任务都选择 Codex 并产出可用结果。是否把 `UI/demo + repo patch` 默认推荐 Codex？

## P2 范围

### P2.1：AI tool capability graph

建立 `Tool -> capability -> task kind -> evidence -> status` 图谱：

- Codex -> repo patch / tests / PR / cloud task
- Claude Code -> review / docs / long context code reasoning / subagents
- Cursor -> IDE-local fix / inline edit / current codebase navigation
- Gemini/Gems -> brainstorming / Google ecosystem / notebook project context
- NotebookLM -> source-grounded research / study guide / multi-source synthesis
- ChatGPT -> broad reasoning / analysis / data/code hybrid / conversational planning
- OpenClaw -> local tool execution where connector exists

这个图谱不从 marketing copy 直接生成结论，必须区分：

- 官方能力
- 用户实际可用状态
- 用户真实成功/失败
- 组织政策/成本状态

### P2.2：Tool route recipe

对复杂任务生成多步路线，但仍不自动执行：

```txt
1. Personal AI Ask: resolve source anchors.
2. NotebookLM: source-grounded synthesis for the selected docs.
3. Codex: turn synthesis into repo/demo patch.
4. Claude Code or ChatGPT: review output / find blind spots.
5. Personal AI: save outcome as source memory / skill candidate.
```

这和 Control Tower 的差异是：Compass 只生成路线和上下文包，不追踪多 agent execution。

## P3 范围

### P3.1：团队分享模式

用户经常参与 AI 工具 CoP / AI Weekly / internal sharing。Compass 可以生成：

- 最近自己和团队真实用 AI 工具的案例。
- 每个工具适合/不适合的任务类型。
- 失败案例和前提条件。
- 可脱敏的分享版本。

这可以服务 `CoP - 基于AI的个人发展和工具`，但仍由用户确认后分享。

### P3.2：Personal AI as private router

长期看，Compass 可以成为个人 AI router：

- 当用户打开任意 AI 输入框，Personal AI 先判断“这个目标工具是否适合当前任务”。
- 如果不适合，只显示一个轻提示：`这类 source-grounded 资料更适合 NotebookLM；要继续给 ChatGPT 也可以，但建议附 3 个 source anchors。`
- 用户始终可以忽略。

## 数据来源和隐私

### 读取

- messages_raw / chunks / relationships / entities
- calendar_events
- reflection_threads
- confirm_requests
- proposed_actions / action_results
- personal_skills
- memory_import_batches
- provider_sync_jobs
- day_pilot / rehearsal / relationship radar / source memory artifacts

### 写入

- tool profiles
- recommendation receipts
- fit signals
- user feedback
- optional confirm request

### 不做

- 不自动把内部数据发送给外部 AI。
- 不自动执行外部工具。
- 不自动读取用户未授权的 AI 工具聊天。
- 不把一次偶然成功上升为长期偏好。
- 不在没有 source anchor 时强推某个工具。

## 排名逻辑

### 主要正向因子

1. `taskKindFit`：工具是否适合当前任务类型。
2. `verificationFit`：能否产生可验证 artifact，例如 diff、测试、source citations、表格结果。
3. `contextFit`：当前上下文是否能被该工具有效消费。
4. `personalSuccess`：用户过去在同类任务上是否成功。
5. `accessReady`：当前是否可用、是否有权限、是否有 quota。
6. `handoffFit`：能否生成合适的 Passport / prompt / source pack。

### 主要负向因子

1. `missingAnchorPenalty`：缺 repo、缺 Jira、缺表格 URL、缺原始消息。
2. `privacyRiskPenalty`：包含不应外发的内部/1:1/敏感记忆。
3. `toolUnavailablePenalty`：确认过工具或 connector 不可用。
4. `staleCapabilityPenalty`：工具能力资料过期或被 Freshness Radar 标记 stale。
5. `quotaPenalty`：费用/额度接近耗尽。
6. `overkillPenalty`：任务很简单，使用重工具会增加成本和上下文负担。

## 实现切片建议

### Slice 1：计划和 demo

- 新增本 plan。
- 新增 demo HTML。

### Slice 2：后端只读推荐

- 新增 `ToolCompassService`。
- 新增 migration。
- 支持从真实记忆中 bootstrap 初始 tool profile：
  - Codex
  - Claude Code
  - Cursor
  - Gemini
  - NotebookLM
  - ChatGPT
  - OpenClaw
  - RingClaw
- API 只返回建议，不写外部系统。

### Slice 3：Ask / Lens 接入

- Ask 对工具选择类 query 增加 `toolCompass` block。
- Memory Lens 对 AI 工具/代码/Jira/资料页面显示 tool suggestion card。
- UI 显示证据来源和不推荐原因。

### Slice 4：反馈写入

- 用户可以标记：
  - 推荐准确
  - 推荐不准
  - 工具不可用
  - 用了另一个工具
  - 已成功
- 写入 `ai_tool_fit_signals` 和 receipt。

### Slice 5：Today Pilot / CoP 场景

- 对带有 AI 工具分享、培训、资料整理、repo bugfix 的 mission 生成工具路线。
- 先服务用户当前真实场景：AI 工具 CoP 分享、NotebookLM/Gemini 培训、Codex/Claude/Cursor 选型讨论。

## 验证计划

### 文档/demo 阶段

- HTML 能直接打开。
- JS 语法检查通过。
- `git diff --check` 通过。

### 后端阶段

- Unit tests:
  - task kind classifier
  - score function
  - unavailable tool penalty
  - quota/access status penalty
  - missing anchor suppression
- API tests:
  - `/tool-compass/recommend`
  - feedback receipt update
  - profile list

### 前端阶段

- Ask mock E2E：工具路线 block 展示、证据展开、复制 brief。
- Memory Lens mock E2E：当前 Jira/repo/source page 出现低打扰推荐。
- Today Pilot mock E2E：AI 工具 CoP mission 展示 route recipe。

### 真实数据验证

用 `X-User-Id: esone.qiu` 只读验证：

- `Bug - AI 先修一遍我再看` 推荐 Codex 主线，Claude review 备选。
- `CoP - 基于AI的个人发展和工具` 推荐 NotebookLM/Gemini 做资料整理，Codex 做 demo。
- `OpenClaw 当前缺少 Glip 状态写入能力` 不推荐 OpenClaw 自动执行 Glip presence。
- `AI VBG 的 BE 部分完成情况如何` 先要求 source anchor / Ask 补齐，不直接推荐某个外部 AI。

## 两个真实使用场景

### 场景 1：准备 AI 工具 CoP 分享

用户打开日历里的 `CoP - 基于AI的个人发展和工具`，旁边有 AI Weekly Pulse、Google AI Studio/Gems/NotebookLM 培训、Codex/Cursor/Claude Code 团队讨论。

Compass 显示：

> 推荐路线：NotebookLM/Gemini 整理 source-grounded 资料 -> Personal AI 提取个人真实案例 -> Codex 生成 demo 页面或对比表 -> Claude/ChatGPT 做讲稿 review。  
> 理由：这不是单次聊天问答，而是资料 + 真实案例 + demo 的组合任务。

用户点 `生成路线 brief`，拿到一个可复制到 Codex / NotebookLM 的最小上下文。做完后标记“成功”，Compass 学会：`AI 工具分享准备` 这类任务适合“资料工具 + 代码 agent + review agent”的组合路线。

### 场景 2：Bug 先让 AI 修一遍再人工看

用户看到日历/任务 `Bug - AI 先修一遍我再看`，包含 repo、branch、Mobile/SDK MR 链接。

Compass 显示：

> 推荐用 Codex：repo 内任务、可运行测试、能产出 diff；Claude Code 可用于 review；不要用 NotebookLM，因为这不是 source-grounded 阅读任务。  
> 需要补齐：目标 repo、branch、失败描述、验证命令。  
> 不推荐 OpenClaw 自动执行：当前记忆显示它缺少某些外部系统能力，除非本地 connector 已确认可用。

用户点 `生成 Codex brief`，Personal AI 调用 Context Passport 生成一个边界清楚的任务包。用户仍然自己决定是否发给 Codex。

## 关键亮点

1. **把工具选择个人化。** 不是泛泛比较 Codex/Claude/Cursor，而是用用户自己的成功、失败、quota、权限、工作场景来推荐。

2. **现场低打扰。** 默认出现在当前任务旁，不要求用户打开工具管理平台。

3. **和现有能力协同。** 选择工具后可调用 AI Context Passport；资料证据来自 Source Memory Distiller；状态来自 Coverage Map / Freshness；反馈进入 Ambient Calibration。

4. **不越界执行。** 避开已搁置的 Control Tower 风险，不承诺直接调度外部 agent。

5. **适合用户真实工作。** 用户已经在 AI 工具 CoP、Codex/Cursor/Claude 选型、NotebookLM/Gemini 培训、Jira/会议/消息工作流里高频切换，这个能力能减少每天的选择和上下文重建成本。

## 推荐结论

建议把 **AI Tool Compass / AI 工具适配罗盘** 作为一个可评估的新能力进入 `docs/progressing`，但第一版不要做自动执行，也不要做独立大平台。

最小可做版本应该是：

1. 从真实记忆 bootstrap 工具画像。
2. Ask / Memory Lens 返回只读工具建议。
3. 一键生成 Context Passport brief。
4. 用户轻反馈回流工具适配分。

如果 demo 体验成立，再考虑接入 Today Pilot 和更完整的工具画像页。
