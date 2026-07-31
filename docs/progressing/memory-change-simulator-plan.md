# 新能力计划：记忆变更沙盒（搁置）

创建时间：2026-06-23  
英文名：Memory Change Simulator  
状态：搁置；当前先专注核心功能和记忆准确度，不推进沙盒能力
来源：本机 Reminders 未发现 `Personal AI` 列表；本计划来自线上 memory service 的真实使用信号、`docs/progressing` 排重、行业产品与论文调研。

配套 demo：[memory-change-simulator-demo.html](./memory-change-simulator-demo.html)

## 搁置原因

2026-07-15 决策：先不做沙盒能力。当前 Personal AI 的优先级应放在功能本身和记忆准确度上，包括高价值记忆提取、召回质量、证据 grounding、场景内使用效果、以及已有功能的可靠性。记忆变更沙盒仍可作为后续治理层参考，但不应在当前阶段占用实现优先级。

## 先看两个真实使用场景

### 场景 1：用户想打开一个会影响 Codex/Cursor/Milo 的新记忆能力

用户正在考虑开启 `Prompt Context Compiler P1`：Personal AI 会在进入 Codex、Cursor、Milo skill 之前，自动整理与当前任务相关的记忆补丁。过去这类能力最难判断的是：它到底会帮我省时间，还是会把很多旧信息、敏感信息、重复跟进塞进 prompt？

用户打开「记忆变更沙盒」，选择这个候选能力，范围选「最近 7 天」。沙盒读取真实记忆轨迹，但只做只读回放：

1. 顶部第一行先显示边界回执：本次是 dry-run，未写入记忆、未发送消息、未同步外部系统、未创建确认请求。
2. 系统回放最近 7 天的 639 条消息、90 次通知、28 个待确认请求、705 个活跃反思线程、2316 个候选行动。
3. 结果显示：如果打开该能力，会展示 11 个低噪声 prompt 补丁，抑制 37 个重复事实跟进，需要人工批准 3 个外部证据投影，阻止 2 个疑似 secret 片段进入 prompt。
4. 用户点开样例行，看到 `MCP/Jira 字段策略`、`Cursor AI review`、`Milo skill dry-run` 等真实工作片段如何被改写成 prompt 补丁，以及每条补丁为什么会出现。
5. 用户可以导出一个 eval 场景包，后续真正实现时用这些真实样例验证效果，而不是凭感觉上线。

体验变化：从「我不知道打开这个记忆能力会怎样」变成「我可以先看到它过去一周本来会怎样影响我的真实工作日」。

### 场景 2：用户觉得最近事实跟进和通知太多，但不确定该调哪个阈值

用户看到 memory service 里有大量 `事实跟进`、外部证据确认、自动化状态确认。直接调低通知阈值很危险：可能漏掉真正重要的 Jira、Codex、AI 工具费用、发布版本等跟进。

用户在沙盒里选择「通知降噪阈值 0.72 -> 0.84」，系统回放最近 30 天：

1. 第一屏不是「配置已保存」，而是「变更预演，尚未启用」。
2. 系统按主题展示哪些提醒会保留、哪些会沉默、哪些会合并成每日摘要。
3. 对高风险项，例如外部事实会变化、需要用户确认是否继续查证的事项，沙盒不允许直接静默，只能给出「合并候选」和「需要批准」。
4. 用户看到 before/after：原本每天约 90 次通知交互，调整后预计减少 34%，但仍保留 5 个高风险外部事实检查。

体验变化：从「调一个看不见后果的开关」变成「用自己的历史行为做一次可审计的回放」。

## 为什么要做

Personal AI 的目标不是只把记忆存下来，而是让记忆在聊天、会议、浏览、AI 对话、自动化和操作流里变成可靠提示。现在项目里已经有很多记忆能力：Capture、Memory Lens、Relationship Radar、Meeting Pilot、Skill Foundry、Agent Workflow、Evidence Watch Contracts、Prompt Context Compiler 等。能力越多，用户越需要在启用前知道三件事：

1. 它会不会真的改变我的工作流，而不是只多一个设置？
2. 它会不会写入、发送、同步、归档、确认，还是只是在本地预览？
3. 它会不会把旧事实、敏感信息、重复跟进、错误上下文带进我的下一个 AI 工具？

线上 memory service 当前真实信号显示，这个问题已经值得优先设计：

- `esone.qiu` 账号累计消息约 10695 条，近 90 天约 3401 条。
- 实体约 13796 个，关系约 50383 条，chunks 约 9129 个。
- 当日通知 90 次，待确认请求 28 个，活跃 reflection threads 705 个。
- action candidates 约 2316 个，其中大量是外部事实跟进、AI 工具、Jira、Codex、MCP、Cursor、Milo skill 等真实工作流。

这说明 Personal AI 已经不是「有没有记忆」的问题，而是「每个新记忆策略上线前，用户能否理解它将如何改变自己的日常」的问题。

## 核心想法

记忆变更沙盒是一层面向用户的「只读回放 + 影响预测」界面。它在任何新记忆能力、策略阈值、prompt 编译规则、通知规则、同步规则启用前，先用用户最近 7/30/90 天的真实记忆轨迹跑一遍 dry-run，输出可读、可审计、可导出 eval 的影响报告。

一句话：把「上线后才发现」改成「上线前先看它过去会怎么影响我」。

## Demo 预览

本次生成了一个集成式页面 demo，模拟它嵌在 Personal AI 的「记忆探索 / 设置实验」里：

- 文件：[memory-change-simulator-demo.html](./memory-change-simulator-demo.html)
- 语言：中文为主，样例记忆保留部分原始英文技术词。
- 交互：可切换候选变更、回放窗口、结果 tab，并查看样例、隐私门禁和 eval checklist。
- 边界：第一屏明确展示 dry-run 未产生任何写入、发送、同步或确认请求。

## 业内产品和研究参考

### ChatGPT Memory Sources

OpenAI 的 Memory FAQ 显示，ChatGPT 正在把 memory sources、编辑、删除、反馈等能力暴露给用户，让个性化不再完全隐藏。参考：[Memory FAQ - OpenAI Help Center](https://help.openai.com/articles/8590148-memory-faq)

可借鉴点：让用户看到「这次回答用了哪些记忆来源」。  
差异点：记忆变更沙盒更进一步，不是解释一次回答，而是在启用能力前预测一段历史轨迹会如何被新策略改写。

### Claude chat search and memory

Claude 支持搜索历史对话、按 project 边界引用上下文。参考：[Use Claude's chat search and memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context)

可借鉴点：明确搜索边界，避免用户以为所有上下文都在同一个记忆池。  
差异点：Claude 更像按需检索；本功能要展示「如果某个 Personal AI 规则持续运行，它会在哪些时刻介入」。

### Microsoft Recall

Microsoft Recall 强调本地控制、app/site 过滤、敏感信息过滤、远程桌面过滤和删除控制。参考：[Privacy and control over your Recall experience](https://support.microsoft.com/en-us/windows/privacy-and-control-over-your-recall-experience-d404f672-7647-41e5-886c-a3c59680af15)

可借鉴点：敏感信息过滤和可见控制必须是一等能力。  
差异点：Recall 偏「历史捕获和搜索」；Personal AI 更需要「记忆策略改变前的影响预演」。

### Agent trace -> eval flywheel

OpenAI Cookbook 的 agent improvement loop 从真实 traces 开始，把反馈转成 eval，再让 Codex 修改 harness。参考：[Build an Agent Improvement Loop with Traces, Evals, and Codex](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop)

LangSmith 也强调上线前 offline evaluation、上线后 online evaluation。参考：[LangSmith evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)

可借鉴点：真实 traces 比拍脑袋测试更可靠。  
差异点：这些工具主要面向开发者；记忆变更沙盒把同样的 trace/eval 思路变成用户可理解的 Personal AI 产品体验。

### Foundation Agent Memory 研究

2026 年的 foundation agent memory survey 把 memory 视为长期、动态、用户依赖场景里的核心机制，并讨论外部/内部、episodic/semantic/sensory/working/procedural、user-centric/agent-centric 等分类。参考：[Rethinking Memory Mechanisms of Foundation Agents in the Second Half](https://arxiv.org/abs/2602.06052)

设计启发：Personal AI 的记忆不只是「事实表」，而是跨 episodic、semantic、procedural、working memory 的行为系统。任何策略变更都应该被评估其对这些层次的影响。

### Agent simulation and continuous eval

Future AGI、Langfuse 等平台都在强调 multi-turn simulation、production trace、continuous eval。参考：[Future AGI agent evaluation](https://futureagi.com/blog/getting-started-with-agent-evaluation/) 和 [Langfuse simulated multi-turn conversations](https://langfuse.com/guides/cookbook/example_simulated_multi_turn_conversations)

可借鉴点：用真实或仿真的场景验证 agent，而不是只看单轮 prompt。  
差异点：本功能优先 replay 用户已有记忆轨迹；当真实数据不足时，再生成合成场景补足边界 case。

## 与现有 progressing 能力的排重

本次核对了 `docs/progressing` 中已经搁置或计划过的能力，尤其注意避免以下重复：

- 不是 `Memory Active Recall Coach`：后者训练用户主动回忆和复盘，本功能是在启用记忆策略前做影响预测。
- 不是 `Evidence Watch Contracts`：后者关注外部事实持续查证，本功能可把它作为候选规则之一进行 dry-run。
- 不是 `Operation Memory Flight Recorder`：后者记录操作全过程，本功能回放历史 trace 来预测新策略影响。
- 不是 `Memory Continuity Guardian`：后者修复记忆连续性断点，本功能评估新能力、阈值、同步规则是否值得启用。
- 不是 `AI Tool Compass` 或通用工具推荐器：本功能不会替用户选择 Codex/Cursor/Claude/Milo；它只回答某个记忆变化会如何影响这些工具的上下文注入、通知和行动候选。
- 不是纯开发者 eval 平台：它必须是用户先能读懂的影响预演，eval 导出只是实现后的验证闭环。

## 产品形态

### 入口

建议放在这些入口之一：

1. `Memory Exploring` 或 `Memory Lens` 的高级区域：适合从记忆证据和策略角度进入。
2. `Settings / Experiments` 的每个记忆能力开关旁边：点击「先预演」。
3. `Agent Workflow` 或 `Prompt Context Compiler` 的候选规则页面：启用前必须跑一次最近 7 天 dry-run。

首版推荐入口：每个高影响记忆能力开关旁边提供「预演影响」按钮，点开集成式沙盒面板。

### 第一屏信息架构

第一屏必须把边界讲清楚：

- `Dry-run only`
- 未写入记忆
- 未发送消息
- 未同步外部系统
- 未创建确认请求
- 未改变当前设置

这条边界回执要在第一可见行，不能藏在 footer 或 tooltip。

### 主界面

主界面分四块：

1. 候选变更：选择要预演的功能、策略、阈值或 prompt 编译规则。
2. 回放范围：7 天、30 天、90 天，显示将读取的消息、通知、确认请求、反思线程数量。
3. 影响总览：would show、would suppress、would ask approval、would block、would write candidate 等可解释指标。
4. 样例审计：列出最能代表变化的真实场景，每条包含 evidence、baseline、after、risk、用户可采取动作。

### 样例行的设计

每条样例至少显示：

- 主题：例如 `MCP / Jira 字段策略`
- 来源：message/chunk/reflection/action/confirm request
- 原本行为：baseline 下会发生什么
- 预演行为：新策略下会发生什么
- 信任边界：是否可能写入、外发、同步、通知、创建确认请求
- 原因：触发规则、置信度、去重理由、时间新鲜度
- 操作：加入 eval、排除规则、标记误判、复制审计摘要

### 结果解释方式

结果不要只给模型分数，而要用用户语言表达：

- `会更安静`：预计减少多少通知或重复跟进。
- `会更主动`：预计新增多少 prompt 补丁、会议提示、候选行动。
- `需要你批准`：哪些外部查证、跨平台同步、敏感片段必须人工确认。
- `不建议启用`：如果风险收益比低，明确告诉用户不要打开。

## 功能范围

### P0 范围

- 选择一个候选记忆变更。
- 读取最近 7/30 天真实 memory trace。
- 只读 sandbox runner，不调用真实写入、发送、同步、确认接口。
- 输出 impact report：
  - attention delta
  - candidate write delta
  - notification delta
  - confirmation delta
  - sensitive/secret risk
  - stale/duplicate risk
  - examples with evidence refs
- 导出 eval scenario pack。
- 保存一次用户批准前的 dry-run receipt。

### P1 范围

- 支持多个候选变更并排比较。
- 支持「我的工作日」按会议、AI 工具、浏览、聊天、Jira、Doubao 等场景分组。
- 支持 replay 一个具体日期或具体项目。
- 支持把用户的「这条不该出现」反馈转成 eval case。
- 支持在能力启用后 7 天自动对比真实结果与预演结果。

### 暂不做

- 不做自动启用新能力。
- 不做通用 A/B 实验平台。
- 不做跨用户聚合分析。
- 不直接修改第三方平台状态。
- 不把 dry-run 样例发送到外部模型，除非用户明确批准。

## 技术设计草案

### 数据输入

首版使用已有 memory service 与本地 app 数据：

- messages/chunks：用于回放用户真实语境。
- entities/relationships：用于判断主题、项目、人物、技术栈关联。
- actions：用于判断原本会创建哪些候选行动。
- reflection threads：用于判断事实跟进和长期线程状态。
- confirm requests：用于判断需要人工批准的边界。
- notifications：用于估算注意力成本。
- feature rule spec：候选能力的策略定义，必须是可执行或可解释的规则包。

### 核心对象

```ts
type SimulationRun = {
  id: string;
  featureId: string;
  userId: string;
  range: "7d" | "30d" | "90d";
  mode: "dry_run";
  startedAt: string;
  completedAt?: string;
  baselineDigest: BaselineDigest;
  proposedDigest: ProposedDigest;
  guardrails: GuardrailResult[];
  cases: SimulationCase[];
};

type SimulationCase = {
  id: string;
  sourceRefs: SourceRef[];
  topic: string;
  baselineBehavior: string;
  proposedBehavior: string;
  visibleReceipt: string;
  riskLevel: "low" | "medium" | "high";
  recommendedAction: "enable" | "tune" | "hold" | "exclude";
  evalCandidate: boolean;
};
```

### Runner 流程

1. 生成 read-only trace slice。
2. 用 baseline adapter 跑当前策略摘要。
3. 用 proposed adapter 跑候选策略摘要。
4. side-effect adapter 拦截所有 write/send/sync/archive/confirm 调用，只记录 `would_*` receipt。
5. guardrail classifier 标注敏感信息、外部事实、新旧冲突、重复线程、secret-like 内容。
6. impact summarizer 生成用户可读报告。
7. eval exporter 把关键样例保存为可跑的 scenario pack。

### Side-effect 拦截原则

任何 dry-run 期间出现的副作用都必须转成 receipt，而不是执行：

- `write_memory` -> `would_write_memory_candidate`
- `send_message` -> `would_prepare_message`
- `sync_external` -> `would_request_sync_approval`
- `archive_thread` -> `would_archive_candidate`
- `create_confirm_request` -> `would_ask_approval`

UI 上不能出现「已完成」「已保存」「已同步」这类会误导的文案。

## 隐私与信任边界

1. 默认只读取本地或用户自己的 memory service 数据。
2. 预演报告中敏感片段默认脱敏，只显示命中原因和来源类型。
3. 导出 eval scenario pack 时，用户可选择：
   - 保留真实文本，仅本地运行。
   - 脱敏替换真实人名、密钥、URL、公司内部字段。
   - 只保留结构和期望，不保留原文。
4. 不允许在 dry-run 阶段创建真实 confirm request。
5. 不允许在 dry-run 阶段更新正式 feature flag。
6. 不允许在 dry-run 阶段向外部 AI 工具发送完整记忆上下文。

## Evals 设计要求

如果后续决定实现，必须创建 evals 并跑出 report。建议路径：

- `evals/memory-change-simulator/`
- report 输出：`evals/reports/memory-change-simulator-<date>.md`

### 必测场景

1. `dry_run_no_side_effects`
   - 输入：包含 write/send/sync/confirm 的候选规则。
   - 期望：所有副作用都被转成 `would_*` receipt；真实数据无变更。

2. `prompt_patch_precision_real_ai_tools`
   - 输入：来自 `10.32.56.212` 的 Codex、Cursor、MCP、Milo skill、Jira 相关真实记忆样例。
   - 期望：输出的 prompt 补丁有 evidence refs，不包含过期事实，不混淆工具边界。

3. `notification_noise_delta`
   - 输入：包含 90 次日通知、事实跟进、反思线程的真实窗口。
   - 期望：能区分可静默、可合并、必须保留、必须批准四类。

4. `sensitive_snippet_blocking`
   - 输入：包含 key、token、内部 URL、账号相关片段的样例。
   - 期望：默认不展示原文，不导出到外部模型，不进入 prompt patch。

5. `duplicate_reflection_thread_merge`
   - 输入：多个事实跟进线程指向同一外部事实。
   - 期望：模拟结果显示合并候选，且保留最新证据和待确认边界。

6. `user_readable_report`
   - 输入：一次完整 simulation run。
   - 期望：报告第一屏包含明确 dry-run 边界，用户能看到 before/after 和样例原因。

### 通过标准

- 100% 通过 no-side-effect 测试。
- 敏感片段阻断不能有已知漏报。
- 每个 high-risk 样例必须有来源引用和用户动作。
- report 中不能出现「已写入」「已同步」「已发送」等误导性成功词。
- 如果真实数据不足，允许补充合成场景，但 report 必须标注哪些来自真实 memory service，哪些是 synthetic。

## 实施计划

### Phase 0：产品定义和规则清单

- 梳理哪些功能必须先通过沙盒：
  - Prompt Context Compiler
  - Evidence Watch Contracts
  - Scene Memory Autopilot
  - Notification threshold changes
  - External sync/import/copy flows
  - Skill Foundry import/sync
- 为每个候选能力定义 rule spec、输入范围、可能副作用和风险分类。
- 确定 P0 只支持单候选 dry-run。

### Phase 1：Trace slice 与 side-effect adapter

- 增加 read-only trace slice loader。
- 为 memory service 的 write/send/sync/archive/confirm 相关路径建立 dry-run adapter。
- 输出 `SimulationRun` JSON。
- 确保 dry-run 不触发真实确认请求、通知或外部同步。

### Phase 2：Impact summarizer

- 对比 baseline 与 proposed 结果。
- 生成 attention delta、write candidate delta、privacy risk、stale risk、duplicate risk。
- 选取最能解释结果的 5-12 条样例。
- 为每条样例生成 evidence refs 和用户可读原因。

### Phase 3：前端集成

- 在候选 feature flag 旁加入「预演影响」入口。
- 构建沙盒面板：
  - 边界回执
  - 候选变更选择
  - 回放范围
  - impact cards
  - 样例表格
  - 隐私门禁
  - eval 导出
- 所有按钮文案必须区分「预演」「导出」「申请启用」，不能暗示已经生效。

### Phase 4：Evals、报告和正式文档

- 创建 `evals/memory-change-simulator/`。
- 使用真实 memory service 样例跑 report。
- 不通过就继续调整规则和 UI 文案，直到所有必测场景通过。
- 最后将功能关键点和关键逻辑维护进正式功能文档：
  - 首选新增：`desktop-app/docs/features/memory-change-simulator.md`
  - 如果它最终归入 Memory Exploring 或 Settings，也需要在对应文档中补充入口和边界。
  - 同时检查 `docs/features/index.md` 是否需要加入索引。

## 验收标准

1. 用户能在启用前看到一份可读的 dry-run 报告。
2. 第一屏明确说明未写入、未发送、未同步、未创建确认请求。
3. 每个 forecast 指标都能点到样例或证据来源。
4. 高风险样例不能只有分数，必须说明为什么高风险。
5. 用户能把真实样例导出为 eval scenario pack。
6. 实现后，eval report 能证明 dry-run 没有真实副作用。
7. feature 文档记录核心逻辑、边界、验证方法和用户可见文案。

## 决策建议

建议作为下一批 Personal AI 记忆能力的前置治理能力来做，而不是作为独立玩具页面。它的价值不在于多一个 dashboard，而在于每个高影响记忆功能启用前都能先回答：

- 它会改变我哪些真实场景？
- 它会制造还是减少噪声？
- 它有没有把敏感信息带出边界？
- 它会不会让 Personal AI 看起来做了某件事，但其实只是预览？

如果 Personal AI 要成为「保留并使用所有个人 AI 记忆」的核心系统，这个能力可以让后续功能更大胆，同时让用户更放心。
