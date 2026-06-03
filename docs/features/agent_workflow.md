# Agent Workflow 智能工作流系统

_最后更新: 2026-06-01_

## 功能概述

Agent Workflow 是消息入口的标准化多 Agent 编排模式。它在 `ANALYSIS_TYPE=agentWorkflow` 时启用，由 `messageDealing.ts` 逐条消息调用 `processNewMessage`，再由 `AgentCoordinator` 按优先级执行多个专职 Agent。

这个模式的定位不是最深度的自由推理，而是稳定、可解释、易配置的消息处理流水线：提取实体、匹配关注项、分析关系、判断是否存储、生成回复建议，并把需要保留的消息写入 Memory Service。

## 大白话运行逻辑

Agent Workflow 像一条消息处理流水线：一条消息进来后，先识别人名/项目/任务，再看是否命中用户关心的规则，然后判断要不要通知、要不要存记忆、要不要生成回复建议。

结果主要受这些因素影响：

1. 手动关注项和系统规则：这是通知和自动化的最大来源；没有命中规则时通常只做轻量存储判断。
2. 匹配置信度：低于 70% 的手动关注项命中会进入复核，不直接通知或触发自动化。
3. 消息标准化质量：`content/message_content/text` 等字段会被归一化；如果原始消息缺正文，后续 Agent 会缺上下文。
4. Agent 和工具配置：未注册工具、跳过工具、失败工具都会降低 trace 完整性，并进入 `storageReview`。
5. 历史记忆命中：关系分析和重要性判断会用 `historySearch` 补证，但它是辅助证据，不会替代当前消息和规则命中。

## 当前运行流程

| 阶段 | Agent              | 优先级 | 主要工具                                | 当前作用                                              |
| ---- | ------------------ | -----: | --------------------------------------- | ----------------------------------------------------- |
| 1    | 实体识别 Agent     |    100 | `entityExtraction`                      | 提取人物、项目、主题、资源、行动项等结构化信息        |
| 2    | 通知判断 Agent     |     95 | `concernedItemMatcher`                  | 使用关注项和运行时系统规则匹配消息，产出通知/存储决策 |
| 3    | 关系分析 Agent     |     90 | `relationshipAnalysis`, `historySearch` | 基于实体和历史消息补充人物关系上下文                  |
| 4    | 重要性判断 Agent   |     80 | `relevanceJudgment`, `historySearch`    | 判断消息是否重要、是否值得存储                        |
| 5    | 外部信息获取 Agent |     70 | `externalServiceQuery`                  | 预留 Jira/Wiki 类外部查询接口，目前仍是模拟实现       |
| 6    | 回复建议 Agent     |     60 | `replyAdviser`                          | 生成是否需要回复及建议文案                            |

`processNewMessage` 会规范化消息内容、时间和实体结果，避免不同入口传入 `message_content`、`content`、`text` 时造成后续 Agent 丢上下文。命中存储条件时，它通过 `MemoryServiceClient.ingest` 写入 Memory Service，并保留匹配规则、稳定摘要、实体、关系、回复建议、轻量执行 trace 和 `storageReview` 存储审计等元数据。关注项引用只有在能解析到当前手动关注项或运行时系统规则时才会进入 `matchedRuleRefs`；LLM 返回的过期/未知引用不会污染存储归因。

写入 Memory Service metadata 的 `agentWorkflowTrace` 会做降敏处理：保留 Agent / 工具状态、耗时、跳过或失败信息，但省略输入摘要里的消息原文和 `historySearch` 查询文本。Options 页面里的“关注项测试”仍使用本次运行返回的实时 trace，方便调试当前配置；长期存储侧只保留足够审计的结构化摘要。若有旧自定义 Agent 引用已移除工具，跳过工具会计入 `storageReview.toolSkippedCount`，并把 `traceStatus` 标为 `partial`，避免长期审计误显示为完整链路。

`externalServiceQuery` 在接入真实 Jira/Wiki adapter 前会把“不支持的服务或缺少参数”记录成 `placeholder` 工具状态，而不是成功。该状态会进入 `storageReview.toolPlaceholderCount`，并把 `traceStatus` 标为 `partial`；Options 的决策路径、运行就绪检查和存储审计会显示“占位工具”，提醒用户这次没有读取真实外部系统证据。即使某次测试结果没有 `storageReview`，保存样例和页面 Trace 状态也会把 `placeholder` 当作 `partial`，避免批量回归把外部查询占位误判成完整链路。

低置信度手动关注项命中不会直接触发通知和规则自动化。当前阈值是 70%：低于阈值时，系统会把原始命中、置信度、阈值和复核原因写入 `notificationReview`，并保留到 Memory Service 审计元数据；`shouldNotify` 会降级为 false，消息入口也会暂停该命中规则的 `automationPrompt` 规划，避免误触发外部副作用。为了兼容不同模型输出，Agent Workflow 会把 `0.42`、`42`、`"42%"` 这类置信度统一归一化到 0-1 区间后再做通知门控、诊断和 UI 展示。

## 关注项与自动化

`concernedItemMatcher` 会读取手动关注项，并通过 `loadRuntimeWatchRules` 合并主动询问等系统运行时规则。即使用户没有手动关注项，系统运行时规则仍可用于存储证据，但不会误发用户通知。匹配结果优先使用稳定的 `matchedRuleRefs`，`matchedRuleIds` 只作为旧规则兼容字段。

通知、摘要队列和规则自动化仍由 `messageDealing.ts` 在 Agent Workflow 结果返回后统一执行。只有匹配到手动关注项时才会触发用户通知和手动规则自动化；系统规则可以用于存储证据，但不会误发用户通知。

## 配置体验

Options 页面在选择“标准 Agent 工作流”后展示当前启用 Agent 数、启用工具数、首个执行阶段和记忆审计字段，并用按优先级排序的卡片展示每个 Agent 的阶段、状态、优先级和工具。页面会先做轻量配置检查，提示重复 Agent ID、启用但无工具、未注册工具、关系分析缺少前置实体，以及外部查询仍是占位实现等问题。运行时也会保护重复 Agent ID：同一个 ID 只保留配置列表中第一个启用 Agent，后续重复项会进入 skipped trace，并把 `storageReview.traceStatus` 标为 `partial`，避免旧自定义 Agent 覆盖默认阶段的存储、通知或重要性判断结果。

页面提供“关注项测试”入口，可以手动输入消息，也可以从内置样例、最近 Memory Service 消息或本地保存样例中选择一条回放；默认会填入当前内置样例，用户第一次进入页面就能直接运行测试。回放会兼容 Memory Service 的秒级/毫秒级时间戳并保留群组 ID，最近消息标签会带上来源和相似度等上下文，方便选择真实样本。用户可以切换样例、手动编辑消息，也可以直接一键回放测试，预览存储、通知、置信度、复核状态、`storageReview` 存储原因、匹配规则、实体/关系摘要和每个 Agent/工具的执行 trace；如果模型或旧审计没有返回置信度，结果头会显示 `-`，不会把未知误显示成 `0%`。当前输入可以保存到 `chrome.storage.local.agentWorkflowSavedScenarios`，若保存时已有测试结果，会同时记录存储、通知、复核、置信度、Trace 状态和匹配规则基线；再次运行同一保存样例时，结果区会显示基线对比，帮助发现规则或 Agent 配置变更后的行为漂移。保存样例支持一键批量回归：逐条运行当前样例集，汇总通过、变化、无基线和失败数量，并列出每个样例的漂移字段；单个保存样例跑出结果后，可以直接建立基线或接受当前结果为新基线；批量回归完成后，可以导出 JSON 报告作为发布前检查材料，也可以一次性把变化项和无基线项的本次结果写回基线，避免预期变化长期停留在“变化”状态。每次测试会记录对应输入和 Agent 配置快照；如果用户在结果展示后改动消息、群组、时间或 Agent 配置，页面会提示当前看到的是上一次运行结果，并把主按钮切换为重新运行测试。测试结果会先展示“运行结论”，把本次运行压成就绪、复核、阻塞或无动作，并给出最应该处理的下一步；随后展示面向用户的决策路径，把关注项匹配、存储归因、通知复核和 trace 健康状态压缩成可读步骤；再给出“运行就绪检查”，把执行 trace、记忆写入、通知/自动化、规则动作、外部查询占位和慢 Agent/工具压成就绪/复核/阻塞/跳过的门禁结论；然后给出“下一步”动作，把低置信度复核、无动作规则命中、失败 Agent、工具错误、缺失通知归因、跳过工具、外部查询占位、慢 Agent/工具、存储审计和通知/自动化确认转换为可执行提示；旁边仍保留运行诊断，集中提示低置信度复核、通知缺少规则归因、命中规则但没有后续动作、缺失 trace、失败 Agent、工具错误、跳过工具、外部查询占位和慢 Agent/工具。若 `storageReview` 没有记录工具错误计数，但 trace 里已经有工具错误，运行诊断和下一步动作会直接使用 trace 的错误计数，避免用户只看到“部分异常”却没有修复入口。存储审计区域会把失败 Agent、工具错误和跳过工具合并成一条异常摘要，方便用户先修旧配置再继续测试。自定义 Agent 仍可通过同一页面添加并保存到 `chrome.storage.local.customAgents`，表单会校验 ID、工具选择并预览插入顺序；旧配置里没有 `enabled` 字段的自定义 Agent 会按启用处理，和 Options 的配置检查一致。

## 当前边界

- 当前编排是单次顺序执行，没有持久 checkpoint、暂停恢复或时间旅行调试。
- `externalServiceQuery` 仍是占位实现，还没有接真实 Jira/Wiki adapter。
- Agent 级错误会被隔离并继续后续流程，轻量 trace 和 `storageReview` 会保存到记忆元数据；Options 已支持最近消息回放、trace 明细查看、运行就绪检查和运行诊断，但还没有可暂停/恢复的完整逐步回放页面。
- 批量处理仍按消息逐条调用，适合稳定性优先的消息入口，不适合作为复杂长任务执行器。

## 行业参考带来的改进方向

- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) 和 [durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution) 强调 checkpoint、可恢复、可回放；Agent Workflow 已先补轻量执行 trace 和决策路径，后续可再升级成可恢复 checkpoint。
- [Microsoft Copilot Studio AI approvals](https://learn.microsoft.com/en-us/microsoft-copilot-studio/faqs-ai-approvals) 把低风险自动决策和人工审核阶段组合起来；Agent Workflow 已先对低置信度通知和自动化动作增加人工复核门槛。
- [Zapier Agents triggers](https://help.zapier.com/hc/en-us/articles/45394909914381-Set-up-your-agent-s-trigger) 的体验重点是 trigger、tools、knowledge sources、test、publish；Agent Workflow 已补“关注项测试”和最近消息回放，后续可把测试结果发布前检查做成固定步骤。
- [CrewAI Flows](https://docs.crewai.com/en/concepts/flows) 和 [Human Feedback in Flows](https://docs.crewai.com/en/learn/human-feedback-in-flows) 强调可控流程、人工反馈和反馈历史；Agent Workflow 的 Options 测试路径应继续优先服务“配置后立即验证”，并让复核原因能被审计。
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/) 把 workflow、agent、tool、guardrail 等运行片段组织成 trace，并单独提醒敏感数据处理；[Human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/) 则把需要审批的工具调用暂停并允许恢复。Agent Workflow 当前适合继续保留轻量 trace 摘要，把敏感原文留在消息本体而不是审计字段，同时在测试面板把 trace 转成“复核/修复/优化/确认”的下一步动作。
- [LangSmith observability](https://docs.langchain.com/oss/python/langchain/observability) 强调按工具调用、提示和决策点追踪执行；Agent Workflow 的测试面板应继续把用户最关心的决策摘要前置，而不是只暴露原始 trace。
- [OpenTelemetry GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) 已把 agent、workflow、tool execution 作为可观测 span 建模，并提醒输入/输出内容可能包含敏感信息；Agent Workflow 的“运行结论”继续沿用轻量摘要，不默认把完整消息原文写进审计字段。
- [LangSmith Evaluations](https://www.langchain.com/langsmith/evaluation) 把 curated datasets、版本对比和人工标注串在一起；Agent Workflow 当前先做本地保存样例、结果基线和显式基线更新，后续再升级为可导出的批量回归。
- [Laminar agent observability](https://laminar.sh/article/agent-observability) 强调从 trace 中抽取失败信号、沉淀为 eval dataset、再对比修复前后结果；Agent Workflow 的保存样例和基线更新优先覆盖这个轻量闭环。
- [Regres.ai](https://regres.ai/) 强调对结构化 JSON 输出做字段级 diff 和审计记录；Agent Workflow 的保存样例因此只比较存储、通知、复核、Trace、规则和置信度这些会影响下游行为的字段。
- Generative Agents 论文强调 observation、planning、reflection 对行为质量的作用；Reflexion 论文强调把反馈写入 episodic memory 改进后续决策。Agent Workflow 更适合先加入失败/误报反馈回流，而不是增加更多固定 Agent。
- [AgentGraph](https://ojs.aaai.org/index.php/AAAI/article/view/42393) 和 [XAgen](https://arxiv.org/abs/2512.17896) 都把多 Agent trace 的可视化、失败定位和人工反馈作为核心体验；Agent Workflow 的 UI 继续优先展示决策路径、运行门禁和可复跑样例，而不是直接暴露完整日志。
- [AgentTrace](https://arxiv.org/abs/2602.10133) 等 Agent observability 论文强调结构化 trace 对排障、风险分析和信任校准的价值；当前已把每条存储消息的存储原因和 trace 健康状态压缩进 `storageReview`，后续应保持轻量，避免把完整隐私上下文写入审计字段。
- [Agentproof](https://arxiv.org/abs/2603.20356) 和 [Agent Workflow Optimization](https://arxiv.org/abs/2601.22037) 分别强调工作流拓扑校验和基于 trace 的冗余工具优化；当前系统是固定顺序编排，已经先做配置静态检查、决策路径、运行就绪检查、下一步动作以及慢 Agent/工具提示，后续再考虑自动重排 Agent。
- [TRAIL](https://arxiv.org/abs/2505.08638) 指出复杂 Agent trace 的问题定位很难完全交给 LLM 自动完成；Agent Workflow 因此把诊断做成面向用户的结构化提示，而不是只生成一段自然语言解释。
- 2026-05-28 复查 OpenAI Agents SDK tracing、LangSmith Observability、OpenTelemetry GenAI agent spans 和 TraceSIR / AgentTrace 论文后，本功能继续收敛在“结构化 trace -> 可操作排障动作”上：`externalServiceQuery` 这种占位工具不只出现在 readiness，也会进入运行诊断和下一步动作，提醒用户接入真实 Jira/Wiki adapter 后再复跑。
- 2026-05-29 复查 LangGraph durable execution / persistence、OpenAI Agents SDK tracing、OpenTelemetry GenAI agent spans、TRAIL 和 AgentTrace 后，建设性方向仍是先把每个阶段的状态分类清楚，再考虑持久 checkpoint 或自动重排；因此本次把外部查询占位结果单独标为 `placeholder`，让发布前回归和真实消息审计都能看见“没查到外部证据”。
- 2026-05-30 复查 OpenAI Agents SDK tracing、LangSmith Observability、OpenTelemetry GenAI workflow/agent spans 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把工具调用、错误状态和结构覆盖直接变成可执行诊断；因此本次让工具错误从 trace 本身补足诊断/下一步动作，并把缺失置信度显示成未知而不是低置信。
- 2026-06-01 复查 OpenAI Agents SDK tracing、LangGraph checkpoint/persistence、OpenTelemetry GenAI agent spans 和 AgentTrace / XAgen 论文后，建设性方向仍是把 trace 状态保持为机器可比对、人工可复核的字段；因此保存样例、批量回归和 Options 运行结果继续共用同一套 `complete/partial/missing` 口径，避免占位工具在某个入口被误记为通过。

## 下一步建议

1. 把低置信度 `notificationReview` 接入一个真实复核队列，让用户可以确认、忽略并把反馈回流给关注项规则。
2. 把 `externalServiceQuery` 拆成真实 Jira/Wiki adapter，并按工具能力在 UI 中标注“可执行外部副作用”。
3. 把已导出的批量回归报告接入更长期的发布前检查或 `evals/` 套件。
4. 把 Options 里的 trace / storageReview / 运行诊断明细扩展到通知或记忆记录详情，让用户能从真实结果追溯每个 Agent 的判断。
