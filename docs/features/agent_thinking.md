# Agent Thinking 功能概览

最后更新: 2026-07-03

## 功能定位

Agent Thinking 是 Personal AI 的通用分析编排层，核心实现位于 `src/agentThinking.ts`。它把消息、项目、网页等输入先交给 LLM 做初始结构化分析，再按 `maxActions` 进入思考-行动循环，按需调用已注册工具补充上下文，最后输出可解释的分析结果。

当前主要使用场景:

- 消息批量分析: `messageDealing.ts` 会把群消息转成 message group 后调用 `IntelligentAgent.analyze(...)`。
- 项目/网页分析: background、Google Slides、网页智能等路径会复用同一个分析入口。
- Options 演示页: `src/options.tsx` + `src/agent-visualizer.tsx` 展示工具目录、思考步骤和结果摘要。

## 大白话运行逻辑

Agent Thinking 像一个“先看材料、再决定要不要查工具、最后给结论”的分析员。它不是每次都随意调用工具，而是先根据输入内容判断缺什么证据，再从已注册的只读工具里补上下文。

结果受这些因素影响，按重要性大致是：

1. 输入本身是否清楚：消息、网页或项目描述越完整，初始判断越稳。
2. 工具目录是否真实可用：当前只有 `historySearch` 和 `jiraQuery` 是实际注册工具，未注册工具会被阻断。
3. `maxActions` 预算：预算越小，越可能只做少量补证后结束；达到上限会明确记录 `max_actions_reached`。
4. 工具返回证据质量：空证据、失败、重复调用、缺参数都会进入 trace，而不是伪装成成功。
5. 安全元数据：需要人工确认或中高风险的工具不会直接执行。

## 当前实现

公开入口:

- `analyze(input, config, context?, onStepCompleted?)`
- `analyzeBatch(items, config, context?, onProgress?)`
- `getToolDescriptions()` 用于提示词
- `getToolCatalog()` 用于 UI 展示

主要结果结构定义在 `src/interfaces/analysisInterfaces.ts`，包括 `MessageAnalysisResult`、`ProjectAnalysisResult`、`WebpageAnalysisResult` 等。

当前实际注册工具:

- `historySearch`: 通过 Memory Service recall 搜索历史上下文；工具安全边界是只读、低风险、无需人工确认。
- `jiraQuery`: 通过 Jira REST API 查询单个或多个 issue，并带 30 分钟内存缓存；工具安全边界是外部只读、低风险、无需人工确认。

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

2026-05-14 状态:

- 工具注册表新增结构化安全元数据: `effect`、`riskLevel`、`requiresHumanApproval` 和 `safetyNote`，工具目录、提示词和 Options 工具表都从同一份元数据派生。
- 思考提示词现在明确工具安全规则: 只能直接调用无需人工确认的工具；写入、通知、删除或显式需要确认的工具必须先让用户确认。
- 工具执行前 guardrail 新增人审阻断: 中高风险或带外部副作用的工具在没有批准 key 时会标记为 `approvalRequired` 并阻断，不会进入真实执行，也不会写入 `usedTools`。
- `AgentVisualizer` 新增“待确认/部分待确认”状态；运行检查会优先提示需要人工确认的工具步骤，并给出批准后重试的处理路径。
- Options 工具目录新增“安全边界”列，展示只读/外部只读、风险级别和是否需要确认，降低用户理解工具能力边界的成本。

2026-05-16 状态:

- 人审批准 key 已收紧为精确匹配 `tool id + 参数`；只把工具 ID 放进批准列表不会放行同工具的任意参数调用。
- 待确认步骤的状态说明会直接提示“确认具体工具和参数后，用对应批准 key 重试”，并展示本次阻断生成的批准 key，用户不必阅读原始工具 JSON 才能继续处理。

2026-05-17 状态:

- 待确认工具的批准 key 不再在状态说明里截断；长参数 key 会完整换行展示，避免“必须精确匹配”但 UI 只给半截 key 的操作阻塞。
- `AgentVisualizer` 的诊断说明支持长文本断行，避免批准 key 或工具参数撑出时间线详情区。
- Options 演示新增一个待确认通知动作样例，用于展示“需要人工确认”和“待确认”流程图状态；该样例只验证 guardrail 呈现，不代表 `messageNotification` 已注册为真实工具。
- 运行检查下新增“待确认动作”审核队列，会把所有 `approval_required` 工具动作按工具、风险、安全效果、参数摘要和完整批准 key 聚合展示，并提供复制 key 入口，用户不需要逐个展开时间线才能继续审批。
- 待确认动作队列新增“复核重点”和复制状态反馈；复制失败时会在界面提示用户手动选择完整批准 key，避免按钮静默失败造成审批路径卡住。

2026-05-18 状态:

- 待确认动作队列新增“复制审核包”入口，审核包会把工具 ID、风险/效果、参数、复核重点、完整批准 key 和可选处理方式打成结构化 JSON，避免用户只复制 key 但丢失待审 tool-call 上下文。
- 审核包明确保留 approve / reject / edit-then-regenerate-key 三类处理路径，和当前精确批准 key 机制兼容；真正的可恢复 approve/edit/reject 流仍属于后续持久化审批能力。
- 复制反馈区会区分“批准 key”和“审核包”的复制结果，降低多按钮共用状态造成的操作歧义。
- Options 演示的流程图不再在运行中提前显示“最终决策”；只有出现 `finish`、`max_actions_reached` 或 `stopped` 这类终止步骤后才显示终止节点，避免审批用户误以为仍在运行的 trace 已完成。

2026-05-20 状态:

- 被阻断、待确认、失败或跳过的工具调用不再触发存储/通知类最终决策更新；只有真实完成的 `messageStore`/`storeMessage` 或 `notifier`/`messageNotification` 工具结果才会把 `shouldStore` / `shouldNotify` 置为 true，避免未注册或未批准动作污染结论。
- 待确认动作队列新增“重跑配置”展示和“复制重跑配置”入口，直接给出最小 `approvedToolActionKeys` patch；审核包也会携带同一份 `retryConfigPatch`，让用户批准后更容易把精确 key 带回下一次运行。
- Options 演示页覆盖复制 key、复制审核包和复制重跑配置三种反馈状态，避免审批路径只停留在说明文本。
- 本轮外部复查确认，LangGraph、OpenAI Agents SDK 等 HITL 方案都把审批中断建模为可恢复状态，而不是单纯的按钮或 token；因此当前重跑配置只是轻量过渡，后续仍应落到持久 checkpoint / run state。
- 处理结果卡片会同步读取待确认动作：当通知工具仍在等待人工确认时，结果区会显示“待确认动作未执行”，通知决策 badge 显示“待确认通知”，避免把未执行动作误读成最终无需通知。

2026-05-21 状态:

- Options 演示页的流程图节点新增摘要行；工具节点用状态 badge 展示成功/跳过/阻断/待确认等结果，同时把 `publicSummary` 中的调用意图放到节点详情里，用户不必展开时间线也能看到“为什么进入这个工具动作”。
- 终止节点会展示 finish / stopped / max actions 的用户可见摘要，和运行检查里的状态建议互补，减少 trace 图只呈现结构、不呈现决策原因的问题。

2026-05-23 状态:

- 运行检查在 `max_actions_reached` 时会把预算用完前仍未处理的工具问题直接列出来，包括工具失败、待确认、执行前阻断和证据不足步骤。
- Options 演示页现在用“预算耗尽”的终止节点展示阶段性结论；如果同一轮里还有待确认通知、阻断工具或空证据，流程图节点详情会直接提示这些未处理问题，而不是只说已经达到 `maxActions`。
- 待确认动作队列现在直接展示“批准 / 拒绝 / 修改”三类处理方式和恢复说明：批准时复制最小重跑配置，拒绝或修改参数时不复用旧批准 key。审核包 JSON 也带同一组 `decisionOptions` 与 `resumeInstruction`，避免用户只拿到 key 却不知道下一步怎么处理。
- 这个改进仍不等于持久 checkpoint；真正跨刷新/跨 service worker 生命周期恢复同一 run 的能力仍属于后续较大工程。

2026-05-24 状态:

- 运行检查的失败、待确认、阻断、证据不足、预算耗尽、停止和重复跳过项会直接列出涉及的时间线步骤。
- 用户可以从运行检查点击步骤编号跳到并展开对应 trace 步骤，不必在长时间线里手动查找问题来源。
- 这只是当前 UI 的定位能力；跨刷新恢复、审批持久化和完整 span/export 仍属于后续工程。

2026-05-25 状态:

- 工具审批 trace 会把注册工具的 `safetyNote` 一起写入 `approval_required` 结果；待确认动作队列、审核包 JSON 和 Options 演示都会展示“工具安全说明”。
- 这让 reviewer 在复制批准 key 或重跑配置前能看到工具自己的安全边界，例如通知渠道、写入影响范围或回滚要求，而不是只靠通用风险标签判断。
- 这仍然不是持久 checkpoint；本轮只补齐审批请求上下文，避免轻量审批 UI 丢失工具策略说明。

2026-05-30 状态:

- Options 演示的流程图节点现在带时间线步骤编号；点击或键盘激活节点会展开并聚焦对应 trace 步骤。
- 这让用户可以从“待确认 / 已阻断 / 证据不足 / 预算耗尽”的图节点直接回到具体工具结果，不必在长时间线里二次查找。
- 当前仍是单页内定位能力，不等于跨刷新恢复或持久化 trace span。

2026-05-31 状态:

- `AgentVisualizer` 运行检查新增“复制诊断包”，把本轮状态、严重度、运行检查项、流程节点、待确认动作摘要和工具问题计数组成结构化 JSON。
- 诊断包用于排障或后续 eval；它不复制原始工具结果、审批 key 或工具参数。需要审批上下文时仍使用单个待确认动作的“复制审核包 / 复制重跑配置”。
- 这让预算耗尽、工具失败、阻断、证据不足等普通问题也能被带出页面复核，而不是只能逐步展开 trace 或复制完整调试详情。
- 当浏览器拒绝剪贴板写入或备用复制失败时，诊断包、审核包和重跑配置会显示只读手动复制框，避免“请手动选择”但页面上没有可选择内容。

2026-06-04 状态:

- 诊断包新增 `traceSpans`，把同一轮运行拆成 root run、step、`execute_tool` 和 terminal decision 四类结构化 span，方便后续 eval、排障或观测系统消费。
- 工具 span 会保留 `gen_ai.operation.name=execute_tool`、`gen_ai.tool.name`、工具状态、证据状态、审批状态、风险和效果等可计算字段；不会写入原始工具结果、工具参数或批准 key。
- Options 运行检查会显示本轮 trace span 数量；复制诊断包失败时仍用只读手动复制框兜底，用户不需要从完整时间线里手工整理问题。
- 这只是本地结构化诊断包，不等于 OpenTelemetry/LangSmith/Langfuse 标准导出，也不等于可跨刷新恢复的 checkpoint。

2026-06-06 状态:

- Options 运行检查新增“运行摘要”chips，直接展示状态、步骤数、trace span 数、待确认动作、阻断、缺证、跳过和工具数量。
- 运行摘要会额外展示“优先处理”一句话，从现有运行检查 action 中取第一条需要处理的问题，让用户先知道下一步该批准、修配置、补证还是调整预算。
- 运行摘要从同一份隐私保守诊断包派生，不展示原始工具结果、工具参数或批准 key；需要完整结构时仍复制诊断包。
- 本轮外部复查 LangSmith、Langfuse、OpenTelemetry GenAI spans 和 AgentTrace 后，优先改进“先看状态摘要、再跳 trace 细节”的诊断路径，而不是提前做标准 exporter 或持久 checkpoint。

2026-06-09 状态:

- 待确认动作新增“恢复边界”收据，明确当前审核包只是本轮 trace 生成的临时重跑凭据，不会持久暂停或自动恢复 Agent run。
- 审核包 JSON 和隐私保守诊断包都会携带同一份 `reviewBoundary`，说明生成时间、适用范围、失效条件和批准 key 与 `tool id + 参数` 的精确绑定关系。
- Options 待确认动作卡片会直接展示“临时重跑凭据 / 生成时间 / 适用范围 / 失效条件 / Key 绑定”，避免用户把旧审核包或修改后的参数当成可直接批准的持久 checkpoint。

2026-06-10 状态:

- Options 运行检查在“复制诊断包”旁新增“诊断包范围”回执，说明诊断包包含结构化 trace span、运行检查和待确认动作摘要。
- 这个回执会直接标出诊断包不会复制原始工具结果、工具参数或批准 key，并说明它是 Personal AI 本地诊断包，不是 OpenTelemetry / LangSmith / Langfuse 标准导出。
- 需要具体审批上下文时，用户仍应复制单个待确认动作的审核包或重跑配置；运行诊断包只用于排障或 eval。

2026-06-13 状态:

- 复制出来的诊断包新增 `schemaBoundary`，把本地 schema 名称、版本、OTel GenAI span 命名参考、LangSmith / Langfuse 分组参考、支持用途和不支持用途一起写进 payload。
- Options 的“诊断包范围”回执同步展示这个 schema/export 边界，明确它是 OTel/LangSmith/Langfuse 启发的 Personal AI 本地诊断包，不能直接导入这些平台。
- `schemaBoundary` 也说明诊断包不能用于工具批准、拒绝或恢复 run；审批仍必须使用单个待确认动作的审核包或重跑配置。

2026-06-14 状态:

- 待确认动作队列新增“重跑配置回执”，直接说明重跑配置只复制 `approvedToolActionKeys`，调用方仍需用同一工具和同一参数重新运行。
- 回执会标出未复制工具参数、原始工具结果、通知正文或外部执行凭据，避免用户把重跑配置误当成完整审批记录或已执行动作。
- 审核包 JSON 同步携带 `retryReceipt`；拒绝、修改参数、上下文变化或工具策略变化时，应重新生成批准 key，不复用旧配置。

2026-06-15 状态:

- 诊断包新增 `snapshotBoundary`，记录生成时间、运行状态、来源和“当前页面 trace 快照”的复制语义。
- Options 的“诊断包范围”会直接说明诊断包生成时间、状态，以及复制内容不会随审批、重跑或后续工具结果自动更新。
- 诊断包仍是隐私保守的本地排障/eval payload，不包含原始工具结果、工具参数或批准 key；需要动作审批上下文时仍使用单个待确认动作的审核包或重跑配置。

2026-06-16 状态:

- `复制诊断包` 成功后会直接显示复制回执，写明本次复制的 trace span 数和运行状态。
- 成功回执会再次说明这是当前页面快照，未复制原始工具结果、工具参数或批准 key；审批或恢复仍要使用单个待确认动作的审核包或重跑配置。
- 复制失败时仍保留只读手动复制框，用户能手动选择同一个隐私保守诊断包。

2026-06-17 状态:

- 诊断包新增 `traceIdentity`，用隐私保守的本地 checksum 给当前页面快照生成 `pai-agent-trace-*` 标识，方便排障或 eval 时匹配复制出来的 JSON。
- Options 运行摘要、诊断包范围和复制成功回执都会展示这个本地 trace 标识，并说明它只用于匹配当前快照。
- 本地 trace 标识不是 OpenTelemetry / LangSmith / Langfuse 的标准 trace id，也不是持久 checkpoint、审批凭据或外部执行证明；审批上下文仍使用单个待确认动作的审核包或重跑配置。
- 待确认动作的复制成功回执按对象拆分说明：复制 key 只给同工具同参数重跑使用，复制审核包不会执行通知/写入/外部动作，复制重跑配置只包含 `approvedToolActionKeys` 且仍需调用方重新运行。

2026-06-20 状态:

- Options 运行检查顶部新增 `Trace 复核路线`，先把运行状态、审批上下文、工具证据和诊断包边界分成四个紧凑条目。
- 待确认动作会在复核路线里明确仍需走单个动作的审核包或重跑配置；复制诊断包不会批准、恢复或执行工具动作。
- 工具失败、执行前阻断和空证据会合并成工具证据条目，提醒用户回到涉及步骤复核，避免只看最终摘要。
- 本轮外部复查 LangSmith / Langfuse trace、OpenTelemetry GenAI 语义和 AgentTrace / AgentOps 论文后，仍选择先加强本地运行级复核路线，而不是提前接标准 exporter 或持久 checkpoint。
- 待确认动作卡片新增 `审批前确认` 回执，先说明待处理工具/步骤、当前未执行通知/写入/删除/外部动作、复制 key/审核包/重跑配置只复制文本，以及批准/拒绝/修改后的下一步。
- 审核包 JSON 同步携带 `preflightReceipt`，让离开页面后的审批复核仍保留“复制不等于批准、恢复或执行”的边界。

2026-06-22 状态:

- 处理结果卡片里的“待确认动作未执行”现在带有 `审批定位` 回执和步骤定位按钮。点击按钮只展开本轮 trace 的对应步骤，不会批准、复制、重跑、发送通知、写入、删除或执行外部动作；真正审批仍通过待确认动作队列复制审核包或重跑配置后重新运行。

2026-06-24 状态:

- `Trace 复核路线` 的运行状态、审批上下文和工具证据条目现在会直接展示相关步骤按钮。
- 点击这些步骤按钮只展开并聚焦当前页面里的 trace 步骤，帮助用户从首屏复核路线快速跳到终止、待确认、阻断或缺证证据。
- 这仍是本地 Options 页面内的定位能力；不会批准、复制、重跑、发送通知、写入、删除、执行外部动作，也不会生成标准 OpenTelemetry / LangSmith / Langfuse trace。

2026-06-26 状态:

- 复制诊断包后，Options 会保留一条 `当前诊断包回执`，说明剪贴板里的 JSON 仍匹配当前页面 trace、本地 trace id 和 span 数。
- 如果演示继续追加步骤、审批状态变化、重跑或页面进入另一份 trace，同一区域会转为 `旧诊断包回执`，列出旧 trace 与当前 trace，并把复制按钮切到 `重新复制`。
- 这只是复制新鲜度提示：不会扩大诊断包内容，不会复制原始工具结果、工具参数或批准 key，也不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作。

2026-06-28 状态:

- Options 运行检查在复制按钮前新增 `诊断包复制预检`，先说明将复制哪个本地 trace、span 数、运行状态、待确认摘要和允许用途。
- 预检明确复制只产生本地 JSON 文本，不会批准、恢复 run、重跑、发送通知、写入、删除、执行外部动作，也不能直接导入 OpenTelemetry / LangSmith / Langfuse。
- 诊断包 payload、trace id、审批 key 生成和工具执行逻辑不变；这只是复制前的非效果边界，补齐复制成功/旧快照回执之前的用户判断点。

2026-06-30 状态:

- 待确认动作卡片新增 `审批决策导览`，把批准、拒绝、修改三条路径的当前状态、下一步和边界放到复制按钮之前。
- 审核包 JSON 同步携带 `decisionGuide`，离开 Options 页面后仍能看到批准会走同参数重跑、拒绝不会恢复本轮 run、修改参数必须重新生成 key。
- 工具执行、批准 key 生成和 guardrail 逻辑不变；这仍是临时重跑凭据，不是持久 checkpoint，也不会因为展示导览就执行通知、写入、删除或外部动作。

2026-07-02 状态:

- Options 运行检查新增 `当前 trace 导航` 回执，直接说明当前本地 trace id、运行状态、步骤/span 数、优先跳转步骤和导航边界。
- 首屏步骤按钮只展开并聚焦当前页面里的 trace 步骤；不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作。
- 复制出来的本地诊断包同步携带 `navigationReceipt`，离开页面后的排障/eval 交接也能看到这份 trace 应如何复核以及点击定位的非效果边界。
- 这仍是 Personal AI 本地诊断 payload；不是 OpenTelemetry / LangSmith / Langfuse 标准导出，也不是持久 checkpoint 或审批凭据。

2026-07-03 状态:

- Options 运行检查新增 `Trace span 构成` 回执，把本地诊断包里的 root run、Agent steps、Tool calls、Terminal 和问题 span 拆开展示。
- 复制出来的本地诊断包同步携带 `traceSpanComposition`，用于排障或 eval 交接时快速判断这次 trace 是工具调用重、缺终止状态，还是有待确认/阻断/缺证问题。
- 这个构成仍只是 Personal AI 本地 span 摘要；不是标准 OpenTelemetry / LangSmith / Langfuse 拓扑，也不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作。

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
- 高风险副作用动作已有执行前阻断、批准 key 和运行级审核队列；还没有真正可恢复的 approve/edit/reject 审批流。
- 当前已能复制批准后的最小重跑配置，并在 UI 中说明 approve/reject/edit 三类处理和临时恢复边界；但尚未持久化被暂停的 run state，刷新页面或 service worker 中断后仍需要调用方重新发起分析并带上批准 key。
- 重跑配置现在有独立回执，说明它只是同参数重跑用的批准 key 补丁，不包含工具参数/结果/通知正文，也不是可审计的完整暂停状态。
- 思考过程已有摘要化主路径；待确认批准 key 会完整展示，工具返回仍在本地 UI 可展开，后续需要按权限/环境进一步分层。
- 当前工具 guardrail 已覆盖注册表、必填参数和基础人审阻断；完整的可恢复审批队列、权限分组和敏感数据脱敏仍需后续分层。
- Options 流程图和 `Trace 复核路线` 现在能定位到同页时间线步骤，并能复制隐私保守的结构化 trace 诊断包；运行摘要会先把状态、问题计数、优先处理动作和诊断包范围露出，但尚未接入 OpenTelemetry / LangSmith / Langfuse 的标准 exporter。
- 诊断包已自带 `schemaBoundary`，可在页面外保留本地 schema、启发来源和不可直接导入标准平台的边界；这仍不是标准 exporter，也不是可恢复审批状态。
- 诊断包已自带 `snapshotBoundary`，说明复制的是当前页面上这一次 trace 的快照；后续审批、重跑、新工具结果或页面刷新不会自动更新旧诊断包。
- 诊断包复制成功会给出同样的快照、隐私和审批边界回执，避免用户只看到“已复制”却不知道复制物能不能外发、能不能审批或能不能恢复 run。
- 诊断包已自带 `traceIdentity`，用于把当前页面显示的诊断快照和复制出的 JSON 对上；它不是标准追踪系统 id，也不能用来恢复 run 或批准工具。
- 复制诊断包的回执会继续跟随当前页面 trace 身份变化：旧剪贴板内容不会被静默当成当前 trace，用于排障或 eval 前需要重新复制当前诊断包。
- 复制诊断包前会先显示 `诊断包复制预检`，让用户在点击按钮前确认这是本地快照、允许用途、不可导入标准平台和不会产生审批/恢复/外部副作用。
- 诊断包已自带 `traceSpanComposition`，用于说明 root run、Agent steps、Tool calls、Terminal 和问题 span 的数量；它只是本地排障摘要，不是标准追踪拓扑或 exporter。
- 待确认动作卡片已有审批前确认回执，但它仍只是本轮页面和审核包里的说明，不会真正持久暂停 run 或替用户做 approve/edit/reject。
- 待确认动作卡片已有审批决策导览，但批准/拒绝/修改仍需要调用方在下一轮运行中处理；当前 UI 不会持久化暂停状态，也不会替用户执行决策。

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
- 参考 AgentOps、Langfuse 和 AgentTrace 的 observability 思路，trace UI 应继续从“可查看日志”走向“可定位问题并给出处理路径”，尤其要把失败/阻断/预算耗尽这些信号和第一条处理动作前置到运行级摘要。
- 参考 OpenTelemetry GenAI agent spans，后续如果输出结构化 trace，应把工具执行 span、证据数量、失败状态和用户可见诊断作为可计算字段，而不是只依赖中文展示文案。
- 参考 LangSmith、OpenTelemetry 和 AgentTrace，当前已先补本地 `traceSpans` 诊断结构；下一步才是把这些字段接入标准 exporter，尤其是 workflow status、tool status、evidence quality、pending approval 和 step transition reason。
- 参考 LangGraph/OpenAI human-in-the-loop 的风险分级策略，后续可以把 `requiresHumanApproval` 升级为可恢复审批流，例如高风险工具允许 approve/edit/reject，中风险工具只允许 approve/reject，只读工具不打断。
- 参考 OpenAI Agents SDK 和 LangChain HITL middleware 的 interrupt payload 设计，审批 UI 应持续展示完整 action request 与允许的 decision types，而不是只暴露一个批准 token。
- 当前轻量实现已把 decision types 前置到待确认动作队列；下一步才是把这些选择接到真正可恢复的 run state，而不是继续堆叠复制按钮。
- 参考 OpenAI Agents SDK 的长审批状态序列化和 LangGraph 的 `thread_id`/checkpoint 恢复模型，后续应把当前审核包升级为真正的暂停运行对象，包含 run id、版本、待审工具参数、恢复入口和拒绝/编辑后的分支处理。
- 参考 OpenTelemetry GenAI agent spans 和 Langfuse 的 OTel trace 结构，后续 trace 字段应保留 agent/version/conversation、工具执行状态、证据质量和审批状态，方便从 UI 诊断继续走向自动评估。
- 参考 AutoGen Studio、LangSmith / AgentOps 这类调试体验，流程图应持续保留状态转移原因，而不只是展示“调用了哪个工具”；本轮已先把用户可见摘要放入节点详情，后续可升级为结构化 transition reason。
- 参考 AEGIS 这类执行前 firewall / audit layer 论文，审批请求除了 tool id 和参数，还应保留策略上下文、风险说明和审计字段；当前已先把注册工具的 `safetyNote` 纳入待确认动作和审核包。
- 参考 LangSmith / Langfuse 的单次 trace/container 模型和 AgentTrace 的 runtime accountability 思路，复制诊断包时应继续保留快照时间、状态和非实时边界，避免把本地 JSON 误当成持续更新的 live trace。
- 参考 2026 年 AgentTrace 和 AgentOps 论文，运行级 UI 应优先展示可处理的 accountability 路线：终止状态、审批悬而未决、工具证据缺口和本地诊断范围。
- 参考 LangGraph / OpenAI Agents SDK / LangChain HITL 的可恢复审批模型，轻量审批 UI 在实现持久 checkpoint 之前，应把每个待确认动作的 pending 状态、未执行边界和复制非效果放在按钮前。
- 参考 LangSmith / Langfuse 的 trace 调试体验和 AgentTrace 的 accountability 思路，首屏复核路线应该直接给到问题步骤定位，减少用户从摘要到长时间线之间的二次查找成本。
- 参考 LangSmith trace/run/span、Langfuse request lifecycle tracing、OpenTelemetry GenAI tool/agent 语义和 AGDebugger 的长流程历史点调试思路，诊断包复制后应持续暴露 trace 身份和快照新鲜度，而不是只显示瞬时“已复制”。
- 参考 LangSmith / Langfuse 的 trace 容器模型、OpenTelemetry 的 agent/tool 语义和 AgentTrace 的 accountability 目标，复制前也应说明本地诊断包的用途和不支持用途，避免用户先复制后才发现它不是标准 exporter、审批凭据或可恢复 checkpoint。
- 参考 OpenAI Agents SDK tracing、LangSmith / Langfuse 的层级 trace 和 AgentOps 对 agent artifacts 的分类，用户在复制前应先看到 trace span 构成，而不是靠手动数 JSON 判断 root/step/tool/decision 和问题 span 比例。

## 外部参考

- [ReAct](https://arxiv.org/abs/2210.03629): 把推理 trace 和行动交错，用外部工具降低幻觉和错误传播。
- [Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903): 中间推理步骤能提升复杂推理，但产品侧需要控制展示粒度。
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence): checkpoint 支持 human-in-the-loop、time travel、fault tolerance。
- [LangSmith Observability](https://docs.langchain.com/oss/python/langchain/observability): trace 应覆盖工具调用、模型交互和决策点，方便调试和生产监控。
- [Langfuse Observability](https://langfuse.com/docs/observability/overview): trace 会把模型调用、工具执行和最终总结放到同一条链路里，适合作为 UI 状态分层参考。
- [OpenAI Agents SDK Guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/): 工具 guardrail 可在执行前后验证或阻断工具调用。
- [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/): agent run 的 traces 可覆盖 LLM、工具、handoff、guardrail 和自定义事件。
- [OpenAI Agents Guardrails and Human Review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals): code-first agent 应由应用侧掌握工具执行、批准和状态，适合作为人审恢复流参考。
- [Claude Extended Thinking](https://docs.claude.com/en/docs/build-with-claude/extended-thinking): 支持 summarized/omitted thinking，说明生产 UI 不应默认依赖完整思考文本。
- [OpenTelemetry GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/): 将 agent、workflow 和 tool execution 作为 span 建模，可作为后续结构化 trace 字段参考。
- [OpenTelemetry GenAI Attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/): `execute_tool`、`invoke_agent` 等 operation 名称提醒本地字段要保留可计算的运行/工具语义，但敏感内容仍需过滤或截断。
- [LangChain Human-in-the-loop middleware](https://docs.langchain.com/oss/python/langchain/human-in-the-loop): 支持按工具风险配置 interrupt/review 策略，并将待审 action request、review config 和 approve/edit/reject/respond 决策一起建模，适合作为审核包与后续恢复流参考。
- [AgentTrace](https://arxiv.org/abs/2602.10133): 讨论 agent observability 应覆盖运行、认知和上下文三类结构化 telemetry。
- [AgentOps](https://arxiv.org/abs/2411.05285): 从 AgentOps 生命周期角度整理 observability 应追踪的工件和数据。
- [AgentTrace Causal Graph](https://arxiv.org/abs/2603.14688): 用执行日志重建因果图来定位多 Agent 失败根因，提示 trace 应保留可计算的故障信号。
- [AutoGen Studio](https://arxiv.org/abs/2408.15247): 多 Agent 工作流 UI 强调交互式评估和调试，说明 trace 视图需要能快速定位状态转移与失败原因。
- [Interactive Debugging and Steering of Multi-Agent AI Systems / AGDebugger](https://arxiv.org/abs/2503.02068): 长流程 agent 调试需要历史定位、重置/恢复语义和可见的操作边界，适合作为诊断包复制前预检的参考。
- [Cloudflare Agents Human-in-the-Loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/): 把高风险工具调用显式建模为审批或等待状态，适合作为后续人审层参考。
- [AEGIS: No Tool Call Left Unchecked](https://arxiv.org/abs/2603.12621): 强调工具执行前拦截、策略校验、人审和审计记录应在副作用发生前完成，适合作为工具审批上下文完整性的参考。

## Reminders 反馈

2026-05-17 本轮通过 Reminders AppleScript 查询本机可见列表时未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 审批体验的开放提醒，也没有项目需要标记完成。

2026-05-18 本轮再次通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入本轮 Agent Thinking 改进的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-20 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-21 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 流程图体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-23 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 预算耗尽体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-23 本轮再次通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 工具审批体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-24 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 定位体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-25 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 工具审批体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-30 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 定位体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-05-31 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 诊断包体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-04 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 导出体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-06 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 摘要体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-09 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 工具审批恢复边界体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-13 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 诊断包导出边界体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-14 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 工具审批重跑配置体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-15 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 诊断包快照边界体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-16 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 诊断包复制回执体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-17 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 身份回执体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-20 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 复核路线体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-20 本轮二次通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 工具审批前确认回执的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-24 本轮通过 Reminders AppleScript 查询本机可见列表，仍未找到名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking trace 复核路线定位体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-26 本轮通过 Reminders AppleScript 查询本机可见列表，列表可读但没有名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 诊断包复制新鲜度体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-28 本轮通过 Reminders AppleScript 查询本机可见列表，列表可读但没有名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 诊断包复制预检体验的开放提醒，也没有 Reminder 项目需要标记完成。

2026-06-30 本轮通过 Reminders AppleScript 查询本机可见列表，列表可读但没有名为 `Personal AI` 的列表；因此没有可纳入 Agent Thinking 工具审批决策导览的开放提醒，也没有 Reminder 项目需要标记完成。

2026-07-03 本轮 AppleScript 仍未列出 `Personal AI`，EventKit fallback 找到 `Personal AI` 列表和 4 个已完成历史条目；这些条目都与 Doubao / digest / test 反馈相关，和 Agent Thinking trace span 构成无关，因此没有开放 Reminder 项目需要纳入或标记完成。

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
- 诊断包会输出隐私保守的 `traceSpans`，覆盖 root run、step、`execute_tool` 和 terminal decision，不包含原始工具结果、工具参数或批准 key。
- 诊断包会携带 `schemaBoundary`，说明本地 schema、版本、标准启发来源、不可直接导入的 exporter 边界和审批上下文边界。
- 诊断包会携带 `snapshotBoundary`，说明生成时间、运行状态、当前页面快照来源和非实时复制边界。
- 诊断包会携带 `traceIdentity`，说明本地 trace id、checksum、匹配用途和不能用于标准追踪/恢复/审批的边界。
- 诊断包会携带 `traceSpanComposition`，说明 root run、Agent steps、Tool calls、Terminal 和问题 span 的构成，避免用户复制后才手动数 span。
- 运行摘要会从诊断包派生状态、步骤、trace span、问题计数和第一条优先处理动作，避免用户先复制 JSON 才知道本轮发生了什么和该先处理什么。
- 待确认动作会展示“重跑配置回执”，并在审核包 JSON 内保留 `retryReceipt`，避免把批准 key 补丁误读为完整 run checkpoint。
- 诊断包复制成功回执会复述当前页面快照、隐私省略和审批上下文边界；复制失败仍给出同一个诊断包的手动复制框。
- 待确认动作复制 key、审核包和重跑配置时，成功回执会分别说明复制内容、未执行边界和下一步；审核包复制失败仍给出同一份审核包的手动复制框。
- Trace 复核路线会把运行状态、审批上下文、工具证据和诊断包范围拆开显示，避免把本地诊断包误读为批准、恢复或执行证明。
- Trace 复核路线会直接展示相关步骤按钮，点击后只展开并聚焦同页 trace 步骤，不执行审批、复制、重跑或外部副作用。
- 复制诊断包后会显示当前/旧快照回执；当 trace 继续追加步骤或重新运行时，旧剪贴板内容会被标成 `旧诊断包回执`，复制按钮会提示重新复制当前诊断包。
- 待确认动作会在复制按钮前显示 `审批前确认`，审核包 JSON 会携带同一份 `preflightReceipt`，避免用户先复制再发现动作其实未执行、未恢复或未批准。
- 待确认动作会在复制按钮前显示 `审批决策导览`，审核包 JSON 会携带同一份 `decisionGuide`，让批准、拒绝、修改三条路径的状态和边界在离开页面后仍可复核。
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

2026-05-14 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖工具安全元数据、提示词安全规则、未批准高风险工具阻断、批准 key 放行和“待确认”展示状态。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Options、Agent Thinking 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 工具表展示“安全边界”、只读/无需确认标签仍可见，演示流程中的阻断、跳过、证据不足和键盘展开路径没有回归。

2026-05-16 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖工具 ID 不能作为通配批准、精确批准 key 可放行、待确认状态说明展示批准 key。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 工具目录、运行检查、流程图状态和键盘展开路径没有回归。

2026-05-17 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖长批准 key 完整展示、不出现截断省略、待确认状态分类和精确批准 key 放行。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 演示能展示“待确认”流程节点、运行检查中的“需要人工确认”，并能在展开详情里看到完整批准 key 的尾部。
- 2026-05-17 本轮追加覆盖: `buildPendingApprovalActions` 会从工具结果里抽取待确认动作、完整批准 key、风险/效果和参数摘要；Options E2E 会确认“待确认动作”队列、`messageNotification`、完整 key 尾部和复制入口可见。
- 2026-05-17 本轮追加覆盖: 待确认动作队列会显示按工具效果和风险生成的复核重点；Options E2E 会点击复制 key 并确认出现复制成功或手动复制兜底提示。

2026-05-18 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖待确认动作审核包的结构化 payload、完整批准 key、原始参数和 approve/reject/edit 决策提示。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking 可视化、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 演示页显示“复制审核包”，并能点击复制审核包后看到成功或手动复制兜底反馈。
- 2026-05-18 本轮追加覆盖: 流程图在待确认动作出现但最终结果尚未生成时不会显示“最终决策”，等待 `处理结果` 出现后才显示 1 个最终决策节点，且运行检查不再显示“正在运行”。

2026-05-20 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖未注册 `messageNotification` 被阻断后不会把 `shouldNotify` 误置为 true，且不会写入 `usedTools`。
- 同一脚本覆盖待确认动作生成 `retryConfigPatch`，审核包携带最小 `approvedToolActionKeys` 重跑配置。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 演示页显示“复制重跑配置”和 `approvedToolActionKeys`，并能点击后看到成功或手动复制兜底反馈。
- 2026-05-20 本轮追加覆盖: 结果摘要会把未执行的待确认通知显示为“待确认通知”，并明确提示“待确认动作未执行”，避免审批用户只看到“未通知”。

2026-05-21 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖流程图节点 `detail` 会优先展示工具调用意图，并保留终止节点摘要。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 演示页流程图工具节点展示调用意图摘要，且既有审批、阻断、证据不足和结果摘要路径没有回归。

2026-05-23 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖 `max_actions_reached` 运行检查会汇总工具失败、待确认、阻断和证据不足步骤。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 演示页显示“行动次数用完”、预算终止节点和预算用完前仍待处理的问题摘要。
- 本轮追加覆盖: `buildPendingApprovalActions` 会为每个待确认工具动作生成 approve/reject/edit 处理方式、恢复说明，并把同样信息写进审核包。
- 本轮追加覆盖: Options E2E 会确认待确认动作队列直接显示“处理方式”、批准带 `approvalKey` 重跑、拒绝反馈给 Agent、修改参数不复用旧 key。

2026-05-24 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 覆盖运行检查项会记录相关步骤编号。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 覆盖运行检查中的步骤编号按钮会展开对应 trace 步骤。

2026-05-25 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖 `approval_required` 工具结果会保留 `safetyNote`，待确认动作和审核包 JSON 会携带工具安全说明。
- `npm start` 首次 webpack dev 编译成功后已停止本轮 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认 Options 演示页的待确认动作会展示“工具安全说明”，审批复制路径和运行检查定位路径没有回归。

2026-05-30 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖流程图步骤保留原始 `stepIndex`。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，确认流程图节点显示步骤编号，点击待确认节点会展开并聚焦对应时间线步骤。

2026-05-31 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖 `buildAgentRunDiagnosticPacket` 会输出状态、严重度、步骤编号、工具问题计数、待确认摘要和流程节点，并确认不会把审批 key 写入诊断包。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 演示页“复制诊断包”入口、强制剪贴板失败时的手动复制框，以及审核包手动复制兜底。

2026-06-04 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖 `traceSpans` 的 root run、step、`execute_tool`、terminal decision 结构和隐私字段排除。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 演示页诊断包手动复制框里包含 `traceSpans` / `execute_tool` / `gen_ai.tool.name`，且不会泄露审批 key 尾部。
- `git diff --check` 通过。

2026-06-06 验证覆盖:

- `tools/verify-memory-entry-agent-thinking.ts` 覆盖 `buildAgentRunSnapshot` 会把诊断包格式化成运行摘要 chips。
- `tools/verify-agent-thinking-options-e2e.mjs` 覆盖 Options 演示页能直接显示预算耗尽、第一条优先处理动作、步骤数、待确认动作、阻断、缺证、跳过和 trace span 数。

2026-06-09 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖待确认动作、审核包 JSON 和隐私保守诊断包都会携带 `reviewBoundary`，同时诊断包仍不泄露批准 key 或参数。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 待确认动作卡片显示恢复边界，复制审核包的手动兜底文本包含 `reviewBoundary.mode = single_run_retry`。
- `git diff --check` 通过。

2026-06-13 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 覆盖诊断包 `schemaBoundary`、`local_only_not_standard_export`、OTel/LangSmith/Langfuse 启发来源、不支持直接导入和审批上下文边界。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 覆盖 Options 复制诊断包的手动兜底 JSON 包含 `schemaBoundary`，页面“诊断包范围”显示本地 schema v1 和不能直接导入标准平台。
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md` 通过；新增 plan 文件用 `grep -n '[[:blank:]]$'` 检查无尾随空白。

2026-06-14 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖 `retryReceipt`、审核包 JSON 内的 `retryReceipt`、重跑配置不复制参数/结果/通知正文的边界。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 待确认动作卡片展示“重跑配置回执”，复制审核包手动兜底 JSON 包含 `retryReceipt`。
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx static/agent-visualizer.css tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md .planning/2026-06-14-automation-agent-thinking-approval-retry-receipt/plan.md .planning/2026-06-14-automation-agent-thinking-approval-retry-receipt/findings.md .planning/2026-06-14-automation-agent-thinking-approval-retry-receipt/progress.md` 通过；新增 planning 文件也用 `grep -n '[[:blank:]]$'` 检查无尾随空白。

2026-06-15 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖诊断包 `snapshotBoundary`、当前页面快照来源、生成时间/状态和 Options 诊断包范围文案。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 复制诊断包的手动兜底 JSON 包含 `snapshotBoundary` / `current_page_trace_snapshot`，页面“诊断包范围”显示当前页面快照且不会随审批、重跑或后续工具结果自动更新。
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md` 通过；新增 planning 文件用 `awk '/[ \t]$/ ...'` 检查无尾随空白。

2026-06-16 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 覆盖诊断包复制成功回执，确认回执来自诊断包状态和 trace span 数。
- `node tools/verify-agent-thinking-options-e2e.mjs` 覆盖 Options 复制诊断包成功状态、隐私边界和审批上下文边界，并保留强制复制失败时的手动复制兜底。

2026-06-17 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖诊断包 `traceIdentity`、本地 checksum、隐私说明、运行摘要本地 trace chip、诊断包范围和复制成功回执。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 复制成功、剪贴板失败手动复制框、诊断包范围和运行摘要里都能看到本地 trace 身份边界。
- `node tools/verify-agent-thinking-options-e2e.mjs` 同时覆盖待确认动作的复制 key、复制审核包和复制重跑配置三种成功回执，并保留审核包剪贴板失败时的手动复制兜底。
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md .planning/2026-06-17-automation-agent-thinking-trace-identity-receipt/plan.md` 通过；新增 planning 文件也用 `awk '/[ \t]$/ ...'` 检查无尾随空白。

2026-06-17 审批复制回执追加验证:

- `TS_NODE_TRANSPILE_ONLY=1 /Users/Esone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过。
- 本机 shell 缺少普通 `node` / `npm` 命令；本轮用 bundled Node 直接运行等价 dev watch：`node_modules/webpack/bin/webpack.js --watch --config webpack.dev.cjs`，首次 webpack dev 编译成功后停止 watch。
- `/Users/Esone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖待确认动作三种复制成功回执和审核包失败手动复制兜底。
- `git diff --check -- src/agent-visualizer.tsx tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md .planning/2026-06-17-automation-agent-thinking-approval-copy-receipts/plan.md` 通过。

2026-06-20 验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖 `buildAgentTraceReviewLane` 会从诊断包派生运行状态、审批上下文、工具证据和诊断包四个复核条目。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 演示页在预算耗尽 trace 中显示 `Trace 复核路线`、待确认动作、阻断/缺证工具证据和本地诊断包边界。
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx static/agent-visualizer.css tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md docs/features/index.md .planning/2026-06-20-automation-agent-thinking-trace-review-lane/plan.md` 通过；进程检查确认没有遗留 webpack watch。

2026-06-20 审批前确认回执验证覆盖:

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts` 通过，覆盖待确认动作和审核包 JSON 都携带 `preflightReceipt`。
- `npm start` 首次 webpack dev 编译成功后已停止 watch，确认 Agent Thinking、Options 和静态样式能进入 `dist/`。
- `node tools/verify-agent-thinking-options-e2e.mjs` 通过，覆盖 Options 待确认动作卡片在复制按钮前展示 `审批前确认`、未执行边界、复制非效果和下一步。
- `git diff --check -- src/agentVisualizerPresentation.ts src/agent-visualizer.tsx static/agent-visualizer.css tools/verify-memory-entry-agent-thinking.ts tools/verify-agent-thinking-options-e2e.mjs docs/features/agent_thinking.md docs/features/index.md .planning/2026-06-20-automation-agent-thinking-approval-preflight-receipt/plan.md` 通过；新增 plan 文件无尾随空白；进程检查确认没有遗留 webpack watch。

2026-06-24 验证覆盖:

- `tools/verify-memory-entry-agent-thinking.ts` 覆盖 `buildAgentTraceReviewLane` 会把终止步骤、待确认步骤、阻断/缺证工具步骤映射为同页 `stepIndexes`。
- `tools/verify-agent-thinking-options-e2e.mjs` 覆盖 `Trace 复核路线` 的运行状态、审批上下文和工具证据条目显示相关步骤按钮。
- 同一 E2E 覆盖点击审批上下文 `步骤 #6` 会展开并聚焦待确认通知步骤，点击工具证据 `步骤 #3` 会展开并聚焦缺证步骤。

2026-06-26 验证覆盖:

- `tools/verify-memory-entry-agent-thinking.ts` 覆盖 `buildAgentDiagnosticCopiedSnapshot` 与 `buildAgentDiagnosticCopyFreshnessReceipt` 的当前、旧快照和无当前 trace 三种文案。
- `tools/verify-agent-thinking-options-e2e.mjs` 覆盖运行中复制诊断包后先显示 `当前诊断包回执`，演示继续追加步骤后转为 `旧诊断包回执`，并提示重新复制当前诊断包。

2026-06-28 验证覆盖:

- `tools/verify-memory-entry-agent-thinking.ts` 覆盖 `buildAgentDiagnosticCopyPreflight`，确认复制前预检展示 trace span、状态、待确认摘要、允许用途、非效果边界和标准 exporter 边界。
- `node tools/verify-agent-thinking-options-e2e.mjs` 覆盖 Options 点击复制前已显示 `诊断包复制预检`，并能看到不批准、不恢复、不执行工具、不复制原始工具结果/参数/批准 key、不能直接导入标准平台等边界。

2026-07-03 验证覆盖:

- `tools/verify-memory-entry-agent-thinking.ts` 覆盖诊断包 `traceSpanComposition`，确认 root run / Agent steps / Tool calls / Terminal / 问题 span 计数和本地-only边界。
- `node tools/verify-agent-thinking-options-e2e.mjs` 覆盖 Options 显示 `Trace span 构成`，并确认复制/手动复制的诊断 JSON 都包含 `traceSpanComposition`。
