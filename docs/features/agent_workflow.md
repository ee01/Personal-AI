# Agent Workflow 智能工作流系统

_最后更新: 2026-07-02_

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

页面提供“关注项测试”入口，可以手动输入消息，也可以从内置样例、最近 Memory Service 消息或本地保存样例中选择一条回放；默认会填入当前内置样例，用户第一次进入页面就能直接运行测试。测试区顶部会先显示“运行前范围”回执：运行测试只重跑当前表单，运行样例/回放/保存样例会先填入对应来源，批量回归逐条重跑本地保存样例；这些运行都不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖基线，保存/接受基线会另有写回回执。运行前回执还会显示本地发布前门禁资格：缺消息、无保存基线、输入脱离所选样例、上次结果过期或基线配置变更时，只能作为一次性调试或待复核证据；只有当前输入对齐保存样例、已有基线且 Agent 配置一致时，才提示可作为本地回归证据。三个来源都会显示测试来源回执：内置样例说明预期观察和不会写入/投递真实动作，最近消息说明它只是 Memory Service time 召回样本，保存样例说明本地基线状态、当前输入是否仍等于所选样例、上一次结果是否已过期，以及批量回归比较范围。回放会兼容 Memory Service 的秒级/毫秒级时间戳并保留群组 ID，最近消息标签会带上来源和相似度等上下文，方便选择真实样本。用户可以切换样例、手动编辑消息，也可以直接一键回放测试，预览存储、通知、置信度、复核状态、`storageReview` 存储原因、匹配规则、实体/关系摘要和每个 Agent/工具的执行 trace；如果模型或旧审计没有返回置信度，结果头会显示 `-`，不会把未知误显示成 `0%`。当前输入可以保存到 `chrome.storage.local.agentWorkflowSavedScenarios`，若保存时已有测试结果，会同时记录存储、通知、复核、置信度、Trace 状态、匹配规则、结构覆盖、轻量诊断基线和 Agent 配置快照；再次运行同一保存样例时，结果区会显示基线对比和当时的基线诊断摘要，帮助发现规则或 Agent 配置变更后的行为漂移。保存样例支持一键批量回归：逐条运行当前样例集，汇总通过、变化、无基线和失败数量，并列出每个样例的漂移字段；如果基线建立时的 Agent 配置与当前配置不同，来源回执、单条对比和导出报告会标出配置已变更，避免把配置版本差异误读成消息判断质量漂移。单个保存样例跑出结果后，可以直接建立基线或接受当前结果为新基线；批量回归完成后，可以导出 JSON 报告作为发布前检查材料，也可以一次性把变化项和无基线项的本次结果写回基线，避免预期变化长期停留在“变化”状态；接受前页面会说明它只覆盖变化/无基线样例，失败项不会被覆盖，也不会写入 Memory Service、发送通知、执行规则自动化、导出报告或复制原始消息正文；写回后会显示“批量基线写回回执”，说明更新了多少保存样例、失败项是否被覆盖，以及它只改写本地保存基线，不会写入 Memory Service、发送通知或执行规则自动化。如果某个样例运行失败，页面列表和导出报告都会保留具体失败原因，方便单独修复。保存基线、批量回归列表和导出报告共用同一份轻量诊断快照：运行结论、结构覆盖、阻塞/复核门禁、下一步动作、诊断 ID、就绪项状态和建议动作 ID 都会随本次结果保存，但不额外导出测试输入正文或工具参数。每次测试会记录对应输入和 Agent 配置快照；如果用户在结果展示后改动消息、群组、时间或 Agent 配置，页面会提示当前看到的是上一次运行结果，并把主按钮切换为重新运行测试；如果手动编辑后的输入已不是选中的保存样例，保存样例回执会切到“输入边界”，提醒用户填入/运行保存样例后再使用该基线，或把新输入另存为样例。测试结果会先展示“编排回执”，把本地测试跑过的 Agent / 工具覆盖、Trace 健康、存储/通知结果和副作用边界收束到一张卡里，明确 Options 测试不会写入 Memory Service、发送通知或执行规则自动化；如果命中低置信度关注项，结果还会显示“通知复核候选”回执，说明这只是本地测试候选，不会创建真实复核队列项，也不会写入 Memory Service、发送通知或执行规则自动化；真实消息入口只会把 `notificationReview` 写入审计并暂停通知/自动化，后续仍需要真实复核入口处理。随后展示“运行结论”和“结构覆盖回执”，把当前启用 Agent/工具配置与实际 trace 对齐，说明阶段和工具是否都被执行，以及是否有缺阶段、跳过工具、占位工具或工具错误；单次运行还可以复制一份“证据包”到本机剪贴板，包含结论、编排、结构覆盖、就绪项和下一步动作，若结果已因输入或配置变更过期会标成旧快照；复制不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会覆盖基线、不会导出报告，也不会包含原始消息正文或工具参数，并会在写入剪贴板前省略完整测试消息及可识别的长原文片段。再展示面向用户的决策路径、运行就绪检查、下一步动作和运行诊断。若 `storageReview` 没有记录工具错误计数，但 trace 里已经有工具错误，运行诊断和下一步动作会直接使用 trace 的错误计数；若 trace 带有具体工具错误，还会在编排回执、决策路径、运行诊断、就绪检查和下一步动作里显示 `Agent / Tool` 标签，避免用户只看到“部分异常”却没有修复入口；若旧审计只保留了 `storageReview.toolPlaceholderCount` 而 trace 没有具体占位工具标签，运行诊断会退回显示占位数量和接入外部 adapter 的下一步，避免编排回执说需复核而诊断区误显示通过。存储审计区域会把失败 Agent、工具错误和跳过工具合并成一条异常摘要，方便用户先修旧配置再继续测试。自定义 Agent 仍可通过同一页面添加并保存到 `chrome.storage.local.customAgents`，表单会校验 ID、工具选择并预览插入顺序；旧配置里没有 `enabled` 字段的自定义 Agent 会按启用处理，和 Options 的配置检查一致。

单条保存样例的“建立当前结果基线”或“接受当前结果为基线”也会显示写回回执，说明只更新本地 `chrome.storage.local.agentWorkflowSavedScenarios` 的这一个样例基线；它不会写入 Memory Service、发送通知、执行规则自动化、导出报告、覆盖测试输入或导出原始消息正文。

批量回归区会单独显示“批量回归范围”回执。没有保存样例时，它说明批量回归还不能运行；有保存样例时，它说明即将逐条重跑本地保存样例和当前 Agent 配置；运行完成后，它把通过、变化、无基线和失败数量前置，并继续强调导出报告和接受基线都是单独动作。批量回归本身不会覆盖基线、写入 Memory Service、发送通知、执行规则自动化、标记原消息已读或复制原始消息正文；失败项也不会被“接受为基线”覆盖。

批量回归入口还会显示“回归样本构成”回执，把本地保存样例拆成有基线、通知路径、低置信复核、存储-only、规则归因、Trace 需复核和 Agent 配置版本。它只说明 `chrome.storage.local.agentWorkflowSavedScenarios` 这批本地样例的结构覆盖，不代表所有线上关注项、群组、时间窗口或 Memory Service 最近消息都已覆盖；缺少复核/存储-only/规则归因样例时，会提示先补样例再把批量回归当作发布前门禁证据。

单次运行证据包会额外标注“证据资格”：当前结果匹配保存样例、已有基线且 Agent 配置一致时，显示为可作本地回归证据；当前结果没有绑定保存样例基线时，显示为单次调试证据；输入或 Agent 配置在结果生成后被修改时，显示为证据需重跑。复制证据包仍只写本机剪贴板，不写 Memory Service、不发送通知、不执行规则自动化，也不包含原始消息正文或工具参数。

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
- 2026-06-04 复查 OpenAI Agents SDK tracing / HITL、LangGraph checkpoint、Zapier Agents trigger、Microsoft Copilot Studio AI approvals、CrewAI human feedback、TRAIL 和 AgentTrace 后，建设性方向仍是先把测试、运行历史、失败原因和复核边界做成可靠闭环；因此本次让批量回归失败项直接保留具体错误，而不是只显示“运行失败”。
- 2026-06-05 复查 OpenTelemetry GenAI agent spans、OpenAI Agents SDK tracing、LangGraph persistence、XAgen、AgentTrace 和 failure-aware observability 论文后，建设性方向仍是把 trace 信号转成可导出的排障证据；因此本次让批量回归报告带上轻量诊断快照，方便发布前定位阻塞/复核项，而不额外导出测试输入正文或工具参数。
- 2026-06-07 复查 OpenAI Agents SDK tracing、OpenTelemetry GenAI agent/workflow spans、LangGraph persistence / durable execution 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把固定编排先做成可验证结构；因此本次加入结构覆盖回执，把启用阶段、工具执行和缺口一起带入单次测试、保存基线和批量回归报告。
- 2026-06-08 复查 OpenAI Agents SDK tracing、OpenTelemetry GenAI workflow span、Zapier Agents trigger、Testing Agentic Workflows with Structural Coverage Criteria 和 agent provenance 论文后，建设性方向仍是先把测试输入、触发范围和副作用边界说明清楚；因此本次在关注项测试三类输入来源旁补来源回执，避免把本地回放误读成真实消息投递或线上自动化触发。
- 2026-06-09 复查 OpenAI Agents SDK tracing、LangGraph time-travel、OpenTelemetry GenAI workflow span、TRAIL 和 agent provenance 论文后，建设性方向仍是让每次 replay/test 都带清晰的 trace、输入身份和可恢复边界；因此本次把保存样例回执改成会区分“当前结果可比 / 结果已过期 / 当前输入已脱离保存样例”，避免把手动编辑后的消息误当成已有基线覆盖范围。
- 2026-06-11 复查 OpenAI Agents SDK tracing、LangGraph checkpoint / time-travel、OpenTelemetry GenAI agent spans 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把多 Agent 编排从“跑完了”拆成可检查的覆盖、门禁和副作用边界；因此本次在单次测试结果顶部补“编排回执”，先告诉用户这次本地测试覆盖了哪些 Agent/工具、是否还有跳过/占位/失败，以及它不会真的写入、通知或执行自动化。
- 2026-06-15 复查 OpenAI Agents SDK tracing、LangSmith Evaluations、OpenTelemetry GenAI 语义约定和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把 trace 变成可复跑、可比较的发布前门禁；因此本次让保存样例基线记录 Agent 配置快照，并在基线对比、批量回归和导出报告里标出配置版本变化。
- 2026-06-17 复查 OpenAI Agents SDK tracing、LangSmith Evaluations、LangGraph persistence/time-travel 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把本地回归门禁和真实副作用分开；因此本次在“接受批量回归结果为基线”点击前补预回执，说明只更新本地保存样例基线，失败项不覆盖，且不会写 Memory Service、通知、执行自动化、导出报告或复制原始消息正文。
- 2026-06-18 复查 OpenAI Agents SDK tracing/evals、LangGraph persistence、Testing Agentic Workflows with Structural Coverage Criteria 和 AgentTrace 后，建设性方向仍是把可比较基线、真实副作用和长期记忆写入分开；因此本次给单条保存样例基线写回补持久回执，避免用户把本地回归基线更新误读成 Memory Service 写入、通知发送或规则自动化执行。
- 2026-06-19 复查 OpenAI Agents SDK、LangGraph/LangChain HITL、Microsoft Copilot Studio generative orchestration、Zapier Agents、LangSmith Evaluation、结构覆盖测试和执行 provenance 论文后，建设性方向仍是把测试、复核、真实副作用和审计写入分清；因此本次把低置信度通知复核显示为“本地复核候选”，明确 Options 测试不会创建真实复核队列项、写入 Memory Service、发送通知或执行规则自动化。
- 2026-06-20 复查 OpenAI Agents SDK HITL / tracing、LangGraph persistence / HITL、结构覆盖测试和 AgentTrace 后，建设性方向仍是把本地测试、真实消息入口、基线写回和外部副作用分开；因此本次把“运行前范围”前置到关注项测试顶部，让用户点击前就知道运行不会写入 Memory Service、不会发送通知、不会执行规则自动化、不会标记原消息已读，也不会覆盖基线。
- 2026-06-22 复查 OpenAI Agents SDK HITL、LangSmith evaluation、Zapier Agents publish/test 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把“测试可运行”和“能作为发布前回归证据”分开；因此本次在运行前范围里加入本地门禁资格，要求输入对齐保存样例、结果不过期、已有基线且配置一致后才提示可作为本地回归证据。
- 2026-06-24 复查 OpenAI Agents SDK tracing、LangGraph durable execution、OpenTelemetry GenAI agent/tool spans 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把 trace 问题变成可执行定位；因此本次让工具级错误优先显示具体 `Agent / Tool`，只在旧审计没有 trace 标签时回退到数量。
- 2026-06-26 复查 Zapier Agents 测试/发布边界、LangSmith Evaluation、OpenAI Agents SDK tracing/HITL 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把单次测试结果变成可携带但无副作用的发布前证据；因此本次加入单次运行证据包复制，保留旧快照提示并脱敏原始消息正文。
- 2026-06-27 复查 LangGraph persistence、OpenTelemetry GenAI agent spans 和 Testing Agentic Workflows with Structural Coverage Criteria 后，建设性方向仍是把本地证据包做成可安全转交的轻量 trace，而不是复制原始上下文；因此本次让证据包复制前同时省略完整测试消息和长原文片段。
- 2026-06-29 复查 OpenAI Agents SDK tracing/HITL、LangGraph durable execution / time travel、OpenTelemetry GenAI agent spans 和结构覆盖测试后，建设性方向仍是把“本地回归门禁”与“真实持久执行/审批/外部副作用”分开；因此本次给批量回归增加独立范围回执，让运行前、完成态和接受基线动作保持可区分。
- 2026-06-30 复查 OpenAI Agents SDK tracing/HITL、LangGraph persistence、OpenTelemetry GenAI agent spans 和 agentic workflow 结构覆盖测试后，建设性方向仍是把可携带 trace 证据与发布前回归门禁区分清楚；因此本次给单次运行证据包增加证据资格，明确它是可作本地回归证据、单次调试证据，还是需要先重跑的旧快照。
- 2026-07-02 复查 OpenAI Agents SDK tracing、LangGraph persistence、OpenTelemetry GenAI 语义约定和 `Testing Agentic Workflows with Structural Coverage Criteria` 后，建设性方向仍是让结构化 trace 和审计 fallback 保持一致；因此本次让 `storageReview.toolPlaceholderCount` 在缺少具体 trace 标签时也进入运行诊断和下一步动作。

## 下一步建议

1. 把低置信度 `notificationReview` 接入一个真实复核队列，让用户可以确认、忽略并把反馈回流给关注项规则。
2. 把 `externalServiceQuery` 拆成真实 Jira/Wiki adapter，并按工具能力在 UI 中标注“可执行外部副作用”。
3. 把已导出的批量回归报告接入更长期的发布前检查或 `evals/` 套件。
4. 把 Options 里的 trace / storageReview / 运行诊断明细扩展到通知或记忆记录详情，让用户能从真实结果追溯每个 Agent 的判断。
