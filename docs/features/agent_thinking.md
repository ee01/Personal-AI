# Agent Thinking 功能概览

最后更新: 2026-05-06

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
- 思考过程已有摘要化主路径，但完整调试详情仍在本地 UI 可展开，后续需要按权限/环境进一步分层。
- 当前工具 guardrail 只覆盖注册表和必填参数校验；工具级权限、人审、敏感数据脱敏仍需后续分层。

## 建设性改进方向

参考 ReAct、LangGraph、OpenAI Agents SDK、Claude extended thinking 等业内方案，后续优先级建议:

- 为长任务引入 checkpoint 或可恢复任务记录，减少 MV3 service worker 生命周期影响。
- 将需要通知、写入、外部 API 修改等动作纳入人审策略。
- 继续把 `thoughtProcess` 的用户摘要和调试详情分层，后续可把摘要字段前移到数据结构而不是只在 UI 层推导。
- 为工具调用增加更细的安全分类，例如只读、外部写入、通知、权限变更，并在执行前走统一 guardrail。
- 如果后续恢复长时间 agent run，需要持久化每步输入、工具结果、决策摘要和跳过原因，支持刷新后继续和事后审计。

## 外部参考

- [ReAct](https://arxiv.org/abs/2210.03629): 把推理 trace 和行动交错，用外部工具降低幻觉和错误传播。
- [Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903): 中间推理步骤能提升复杂推理，但产品侧需要控制展示粒度。
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence): checkpoint 支持 human-in-the-loop、time travel、fault tolerance。
- [LangSmith Observability](https://docs.langchain.com/oss/python/langchain/observability): trace 应覆盖工具调用、模型交互和决策点，方便调试和生产监控。
- [OpenAI Agents SDK Guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/): 工具 guardrail 可在执行前后验证或阻断工具调用。
- [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/): agent run 的 traces 可覆盖 LLM、工具、handoff、guardrail 和自定义事件。
- [Claude Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking): 支持 summarized/omitted thinking，说明生产 UI 不应默认依赖完整思考文本。

## Reminders 反馈

本轮通过 Reminders 读取本机列表，未找到名为 `Personal AI` 的列表；已枚举现有列表名称但没有可归属到该列表的开放反馈。因此本轮没有可纳入或标记完成的提醒。

## 验证

相关回归脚本:

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts
```

该脚本覆盖:

- message group 中多条消息都会被处理，不会在第一条后提前返回。
- group 完成回调能收到完整结果。
- 无 `context` 的单条消息分析不会崩溃。
- 同一步多个同 ID 工具调用会保留全部结果，重复参数调用会被跳过且不会覆盖成功结果。
- `maxActions` 耗尽会写入明确的 `max_actions_reached` 结束步骤。
- 未注册工具和缺少必填参数的工具调用会被阻断，且不会触发真实工具请求。
- 单条消息的 `content`/`message_content` 会进入提示词，不会显示为“无内容”。

本轮额外验证:

- `npm start` 首次 webpack dev 编译成功后已停止 watch。
- 用 mock `chrome` 环境加载 `dist/options.html`，点击“启动演示”后确认 `orgStructure` 显示“已阻断”，工具目录仍只展示 `historySearch` 和 `jiraQuery`。
