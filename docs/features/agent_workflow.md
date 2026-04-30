# Agent Workflow 智能工作流系统

*最后更新: 2026-04-30*

## 功能概述

Agent Workflow 是消息入口的标准化多 Agent 编排模式。它在 `ANALYSIS_TYPE=agentWorkflow` 时启用，由 `messageDealing.ts` 逐条消息调用 `processNewMessage`，再由 `AgentCoordinator` 按优先级执行多个专职 Agent。

这个模式的定位不是最深度的自由推理，而是稳定、可解释、易配置的消息处理流水线：提取实体、匹配关注项、分析关系、判断是否存储、生成回复建议，并把需要保留的消息写入 Memory Service。

## 当前运行流程

| 阶段 | Agent | 优先级 | 主要工具 | 当前作用 |
| --- | --- | ---: | --- | --- |
| 1 | 实体识别 Agent | 100 | `entityExtraction` | 提取人物、项目、主题、资源、行动项等结构化信息 |
| 2 | 通知判断 Agent | 95 | `concernedItemMatcher` | 使用关注项和运行时系统规则匹配消息，产出通知/存储决策 |
| 3 | 关系分析 Agent | 90 | `relationshipAnalysis`, `historySearch` | 基于实体和历史消息补充人物关系上下文 |
| 4 | 重要性判断 Agent | 80 | `relevanceJudgment`, `historySearch` | 判断消息是否重要、是否值得存储 |
| 5 | 外部信息获取 Agent | 70 | `externalServiceQuery` | 预留 Jira/Wiki 类外部查询接口，目前仍是模拟实现 |
| 6 | 回复建议 Agent | 60 | `replyAdviser` | 生成是否需要回复及建议文案 |

`processNewMessage` 会规范化消息内容、时间和实体结果，避免不同入口传入 `message_content`、`content`、`text` 时造成后续 Agent 丢上下文。命中存储条件时，它通过 `MemoryServiceClient.ingest` 写入 Memory Service，并保留匹配规则、摘要、实体、关系和回复建议等元数据。

## 关注项与自动化

`concernedItemMatcher` 会读取手动关注项，并通过 `loadRuntimeWatchRules` 合并主动询问等系统运行时规则。匹配结果优先使用稳定的 `matchedRuleRefs`，`matchedRuleIds` 只作为旧规则兼容字段。

通知、摘要队列和规则自动化仍由 `messageDealing.ts` 在 Agent Workflow 结果返回后统一执行。只有匹配到手动关注项时才会触发用户通知和手动规则自动化；系统规则可以用于存储证据，但不会误发用户通知。

## 配置体验

Options 页面在选择“标准Agent工作流”后展示当前启用 Agent 数、启用工具数、首个执行阶段，并用按优先级排序的卡片展示每个 Agent 的阶段、状态、优先级和工具。自定义 Agent 仍可通过同一页面添加并保存到 `chrome.storage.local.customAgents`。

## 当前边界

- 当前编排是单次顺序执行，没有持久 checkpoint、暂停恢复或时间旅行调试。
- `externalServiceQuery` 仍是占位实现，还没有接真实 Jira/Wiki adapter。
- Agent 级错误会被隔离并继续后续流程，但没有面向用户的逐步审计日志。
- 批量处理仍按消息逐条调用，适合稳定性优先的消息入口，不适合作为复杂长任务执行器。

## 行业参考带来的改进方向

- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) 和 [durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution) 强调 checkpoint、可恢复、可回放；Agent Workflow 后续应补一份轻量执行 trace，至少记录每个 Agent 输入摘要、输出和失败原因。
- [Microsoft Copilot Studio AI approvals](https://learn.microsoft.com/en-us/microsoft-copilot-studio/faqs-ai-approvals) 把低风险自动决策和人工审核阶段组合起来；本功能适合给低置信度通知、自动化动作增加人工确认门槛。
- [Zapier Agents](https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents) 的体验重点是 trigger、tools、knowledge sources、test、publish；本功能可以补一个“测试关注项”入口，用历史消息预览命中、通知和存储结果。
- Generative Agents 论文强调 observation、planning、reflection 对行为质量的作用；Reflexion 论文强调把反馈写入 episodic memory 改进后续决策。Agent Workflow 更适合先加入失败/误报反馈回流，而不是增加更多固定 Agent。
- [Agentic Systems](https://arxiv.org/abs/2501.00881) 这类综述强调垂直 Agent 需要清晰的组件、运行模式和实施策略；自定义 Agent 配置后续应要求声明输入、输出和副作用等级，避免工具链不可控。

## 下一步建议

1. 为每条消息保存一份轻量 `agentWorkflowTrace`，支持从通知或记忆记录追溯每个 Agent 的判断。
2. 给低置信度通知和自动化动作增加“待确认”状态，避免 LLM 误判直接触发外部副作用。
3. 把 `externalServiceQuery` 拆成真实 Jira/Wiki adapter，并按工具能力在 UI 中标注“可执行外部副作用”。
4. 增加关注项测试面板，用最近历史消息回放规则命中结果，降低用户调规则成本。
