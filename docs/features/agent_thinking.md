# Agent Thinking 功能概览

最后更新: 2026-05-12

## 功能定位

Agent Thinking 是 Personal AI 的通用分析编排层，核心实现位于 `src/agentThinking.ts`。它把消息、项目、网页等输入先交给 LLM 做初始结构化分析，再按 `maxActions` 进入思考-行动循环，按需调用已注册工具补充上下文，最后输出可解释的分析结果。

当前主要使用场景:

- 消息批量分析: `messageDealing.ts` 会把群消息转成 message group 后调用 `IntelligentAgent.analyze(...)`。
- 项目/网页分析: background、Google Slides、网页智能等路径会复用同一个分析入口。
- Options 演示页: `src/options.tsx` + `src/agent-visualizer.tsx` 展示工具目录、思考步骤和结果摘要。

## 当前实现

公开入口:

- `analyze(input, config, context?, onStepCompleted?)`
- `analyzeBatch(items, config, context?, onProgress?)`
- `getToolDescriptions()` 用于提示词
- `getToolCatalog()` 用于 UI 展示

主要结果结构定义在 `src/interfaces/analysisInterfaces.ts`，包括 `MessageAnalysisResult`、`ProjectAnalysisResult`、`WebpageAnalysisResult` 等。

当前实际注册工具:

- `historySearch`: 通过 Memory Service recall 搜索历史上下文。
- `jiraQuery`: 通过 Jira REST API 查询单个或多个 issue，并带 30 分钟内存缓存。

注意: 组织架构、发布任务、Sprint 等工具仍是注释中的示例，不应在文档或 UI 中描述为已上线能力。网页初始分析可以直接产出 `shouldStore`、`shouldNotify`、实体和行动建议，不依赖这些未注册工具。

2026-05-06 状态:

- 工具目录、提示词和 Options 工具表都从实际注册表派生，不再把注释里的示例工具当成已上线工具展示。
- 思考循环新增工具调用去重: 相同 `tool id + 参数` 会生成稳定 key，已执行过的同参数调用会在本轮跳过并记录为 `skipped`。
- Options 演示只使用 `historySearch` 和 `jiraQuery` 两个真实工具，并展示重复调用被跳过的状态。
- `AgentVisualizer` 默认展示状态、摘要和证据概览；原始调试详情和工具返回收在展开区，避免把完整推理过程当作用户主路径。
- 同一步里多次调用同一个工具时，工具结果会完整保留；如果只有部分重复调用被跳过，UI 会显示“部分跳过”，避免把成功结果误判为全跳过。
- 当达到 `maxActions` 仍未收到 `finish` 时，结果会追加 `max_actions_reached` 步骤，用当前已收集信息明确结束本轮分析。
- 网页分析分支也会记录工具结果、重复跳过状态和思考循环的 LLM 统计，避免网页路径和消息/项目路径表现不一致。
- 工具执行前新增轻量 guardrail: 未注册工具、缺少必填参数的调用会被标记为 `blocked`，不会进入真实工具执行，也不会写入 `usedTools` 或工具记忆。
- 消息提示词不再推荐未注册的 `orgStructure`，并明确要求只使用当前工具目录中的 ID；Options 演示会展示无效工具被阻断的状态。
- 单条消息提示构建兼容 `messageContent`、`message_content` 和 `content`，避免标准化后消息正文在提示词里退化成“无内容”。

2026-05-08 状态:

- Agent 可视化的工具状态分类已抽到 `src/agentVisualizerPresentation.ts`，`blocked`、`skipped`、`partial`、`error`、`success` 现在有统一可测试的展示规则。
- Options 演示页的流程图会直接显示工具节点状态标签，例如“已阻断”“跳过”“失败”，不再只依赖颜色判断。
- 被阻断的工具节点改为明确的琥珀色样式，避免在流程图里看起来像成功工具调用。
- 思考时间线的步骤头支持键盘 `Enter` / `Space` 展开，并补充 `role="button"`、`aria-expanded` 和详情区关联，减少只支持鼠标点击的操作阻塞。

2026-05-09 状态:

- `ThoughtStep` 新增 `publicSummary`，作为用户界面优先展示的步骤摘要；完整 `thought` 不再作为 Options 演示页的主展示字段。
- Agent 提示词中的 `thought` 字段改为“可展示的一句话决策摘要”，不再要求模型输出完整逐步推理。
- `AgentVisualizer` 展开区从“思考过程”改为“决策摘要”，工具执行结果仍可展开查看，避免把内部推理文本当作用户路径。
- Options 演示步骤补充了 `publicSummary`，流程中会看到调用原因、重复跳过、阻断和最终判断的简短说明。

2026-05-10 状态:

- 工具步骤的时间线主摘要改为优先展示执行结果状态，例如阻断、跳过、失败或成功，不再在工具执行后继续显示“准备调用工具”的旧意图。
- 展开区补充“调用意图”和“状态说明”，让用户无需读原始 JSON 也能知道被阻断、跳过或失败的原因和下一步方向。
- Options E2E 覆盖了被阻断工具的状态摘要、调用意图、状态说明和键盘展开路径。

2026-05-11 状态:

- `AgentVisualizer` 在时间线前新增“运行检查”摘要，先聚合展示工具失败、执行前阻断、预算耗尽、用户停止、重复调用跳过和正常完成状态。
- 运行检查会给出下一步建议，例如检查工具配置/权限、改用工具目录里的 ID、补齐必填参数、提高 `maxActions` 或缩小问题范围。
- Options 演示页会在流程图和时间线之外展示这个摘要，减少用户逐步展开 trace 才能判断是否需要处理的操作成本。

2026-05-12 状态:

- 工具结果状态新增“证据不足”: 工具调用成功但 `result` 为空时，时间线、流程图和运行检查都会提示缺少可用证据，不再显示为普通成功。
- 工具返回 `success: false` 或 `result.success: false` 时会归类为失败，覆盖 JIRA API 这类以失败对象返回而不是抛异常的工具。
- Options 演示页补充“空证据”步骤，用户能在运行检查里先看到需要补证或调整查询参数。

## 处理流程

1. 检测输入类型和消息格式。
2. 标准化输入字段，例如 `content` 到 `message_content`、`team_id` 到 `groupId`。
3. 构建分析提示词并调用 LLM 获取初始结构化判断。
4. 对每条消息或每个分析对象执行思考-行动循环。
5. 根据工具结果更新当前决策、元数据和 `thoughtProcess`。
6. 返回结果，并在消息组处理完成时触发进度回调。

## 已知边界

- `meeting` 和 `document` 分支仍是占位实现，只返回基础示例结果。
- 工具调用缺少持久 checkpoint，浏览器刷新或 service worker 中断后不能恢复同一次思考循环。
- 高风险副作用动作目前没有统一的人审/确认中断层。
- 思考过程已有摘要化主路径；工具返回仍在本地 UI 可展开，后续需要按权限/环境进一步分层。
- 当前工具 guardrail 只覆盖注册表和必填参数校验；工具级权限、人审、敏感数据脱敏仍需后续分层。

## 建设性改进方向

参考 ReAct、LangGraph、OpenAI Agents SDK、Claude extended thinking 等业内方案，后续优先级建议:

- 为长任务引入 checkpoint 或可恢复任务记录，减少 MV3 service worker 生命周期影响。
- 将需要通知、写入、外部 API 修改等动作纳入人审策略。
- 继续把 `thoughtProcess` 的用户摘要和调试详情分层，后续可把摘要字段前移到数据结构而不是只在 UI 层推导。
- 为工具调用增加更细的安全分类，例如只读、外部写入、通知、权限变更，并在执行前走统一 guardrail。
- 如果后续恢复长时间 agent run，需要持久化每步输入、工具结果、决策摘要和跳过原因，支持刷新后继续和事后审计。
- 参考 LangSmith / Langfuse 的 trace 体验，后续可以把“工具成功但结果质量不足”作为独立状态，避免用户只看到成功调用却不知道证据是否足够支撑最终判断。
- 继续把 trace 事件和用户可见摘要拆成不同字段；用户界面展示摘要和证据状态，调试/审计界面才展示更完整的工具与模型诊断。
- 参考 AgentTrace 对 operational/cognitive/contextual 三类 telemetry 的划分，后续可以把工具状态、决策摘要和上下文快照拆成结构化 trace 字段，而不是只依赖 UI 文案。
- 参考 AgentOps、Langfuse 和 AgentTrace 的 observability 思路，trace UI 应继续从“可查看日志”走向“可定位问题并给出处理路径”，尤其要把失败/阻断/预算耗尽这些信号前置到运行级摘要。
- 参考 OpenTelemetry GenAI agent spans，后续如果输出结构化 trace，应把工具执行 span、证据数量、失败状态和用户可见诊断作为可计算字段，而不是只依赖中文展示文案。

## 外部参考

- [ReAct](https://arxiv.org/abs/2210.03629): 把推理 trace 和行动交错，用外部工具降低幻觉和错误传播。
- [Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903): 中间推理步骤能提升复杂推理，但产品侧需要控制展示粒度。
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence): checkpoint 支持 human-in-the-loop、time travel、fault tolerance。
- [LangSmith Observability](https://docs.langchain.com/oss/python/langchain/observability): trace 应覆盖工具调用、模型交互和决策点，方便调试和生产监控。
- [Langfuse Observability](https://langfuse.com/docs/observability/overview): trace 会把模型调用、工具执行和最终总结放到同一条链路里，适合作为 UI 状态分层参考。
- [OpenAI Agents SDK Guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/): 工具 guardrail 可在执行前后验证或阻断工具调用。
- [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/): agent run 的 traces 可覆盖 LLM、工具、handoff、guardrail 和自定义事件。
- [Claude Extended Thinking](https://docs.claude.com/en/docs/build-with-claude/extended-thinking): 支持 summarized/omitted thinking，说明生产 UI 不应默认依赖完整思考文本。
- [OpenTelemetry GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/): 将 agent、workflow 和 tool execution 作为 span 建模，可作为后续结构化 trace 字段参考。
- [AgentTrace](https://arxiv.org/abs/2602.10133): 讨论 agent observability 应覆盖运行、认知和上下文三类结构化 telemetry。
- [AgentOps](https://arxiv.org/abs/2411.05285): 从 AgentOps 生命周期角度整理 observability 应追踪的工件和数据。
- [AgentTrace Causal Graph](https://arxiv.org/abs/2603.14688): 用执行日志重建因果图来定位多 Agent 失败根因，提示 trace 应保留可计算的故障信号。
- [Cloudflare Agents Human-in-the-Loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/): 把高风险工具调用显式建模为审批或等待状态，适合作为后续人审层参考。

## Reminders 反馈

本轮通过 Reminders EventKit 读取到 `Personal AI` 列表，共 3 条项目且均已完成；内容主要涉及豆包记忆同步和本地 app 日志，不属于 Agent Thinking 本轮改进范围。因此本轮没有新的开放提醒需要纳入，也没有项目需要标记完成。

## 验证

相关回归脚本:

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts
node tools/verify-agent-thinking-options-e2e.mjs
```

这些脚本覆盖:

- message group 中多条消息都会被处理，不会在第一条后提前返回。
- group 完成回调能收到完整结果。
- 无 `context` 的单条消息分析不会崩溃。
- 同一步多个同 ID 工具调用会保留全部结果，重复参数调用会被跳过且不会覆盖成功结果。
- `maxActions` 耗尽会写入明确的 `max_actions_reached` 结束步骤。
- 未注册工具和缺少必填参数的工具调用会被阻断，且不会触发真实工具请求。
- 单条消息的 `content`/`message_content` 会进入提示词，不会显示为“无内容”。
- 可视化状态分类会正确区分“已阻断”“部分跳过”“失败”等状态。
- Options 演示页能在扩展环境中显示工具目录、流程图状态标签，并支持键盘展开被阻断步骤。

本轮额外验证:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过。
- `npm start` 首次 webpack dev 编译成功后已停止 watch；清理本轮引入的 ESLint warning 后重新编译成功。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过；加载 `dist/options.html` 后确认 `orgStructure` 显示“已阻断”、重复调用显示“跳过”、时间线可用键盘展开，展开区显示“决策摘要”且不再出现旧的“思考过程”标题。

2026-05-09 验证覆盖:

- `ThoughtStep.publicSummary` 会优先用于 UI 展示，避免展开区直接展示完整 `thought`。
- Agent Thinking prompt 不再要求“详细思考过程”。
- Options E2E 会确认展开区显示“决策摘要”，且不再出现旧的“思考过程”标题。

2026-05-10 验证覆盖:

- 工具步骤即使带有 `publicSummary`，主摘要也会优先显示执行后的阻断、跳过或失败状态。
- 展开区显示“调用意图”和“状态说明”，避免用户必须阅读原始工具 JSON 才能判断下一步。

2026-05-11 验证覆盖:

- `buildAgentRunReviewItems` 会把失败、阻断、预算耗尽、停止、重复跳过和正常完成归纳成运行检查项。
- Options E2E 会确认演示页出现“运行检查”，且被阻断和重复跳过状态都有用户可见的处理建议。

2026-05-12 验证覆盖:

- 工具返回 `success: false` 会归类为失败，不再被流程图显示为成功。
- 工具返回空 `result` 会显示为“证据不足”，并在运行检查里提示补证或调整查询参数。
- Options E2E 会确认演示页出现“工具证据不足”、流程图空证据节点和时间线空证据摘要。
