---
name: ""
overview: ""
todos: []
isProject: false
---

# 自我反思外部查询闭环设计

## 摘要

在现有“自我反思 -> 产出 action -> 执行 action”基础上，补齐“查询结果回流 -> 继续思考”的闭环。实现策略分两路：

- 本地消息/记忆查询：不引入 `query_memory` action，改为作为自我反思 run 内部的二次检索能力执行。
- 外部系统查询/操作：新增面向 OpenClaw `/v1/responses` 的委派执行器，用稳定 session 做多轮工具调用，再把最终结果写回线程 evidence，触发下一轮自我反思。

这样保留现有线程/队列模型，但把“会查证、会补充信息、会继续思考”补全。

## 关键决策

- 本地消息查询不做成 `query_memory` action。
  - 原因：本地 recall 是低延迟、无外部副作用、和当前线程上下文强绑定，放在同一轮反思里完成更自然，也避免把大量“查了一下本地消息”塞进 action 队列。
  - 实现方式：在 `ReflectionWorker` 前增加一个 `ReflectionResearcher` 步骤；模型先产出 `research_plan`，允许声明最多 N 个本地查询意图，由服务直接调用 `RecallEngine` 和线程现有 evidence 合并后，再生成最终 reflection 结果。
  - 与 `query_memory` action 的区别：`query_memory` 会把“查本地消息”变成异步队列任务，适合长耗时/人工审批/跨系统编排；本方案是同步、线程内、一次 run 内完成。好处是链路更短、结果更容易直接进入同轮推理、无需额外队列状态管理。代价是 run 时间会变长，但对本地 recall 可接受。
- 外部系统统一走 `delegate_openclaw` action。
  - 保留现有 `query_external_tool` 作为兼容入口，但内部语义升级为“委派给 OpenClaw Responses”。
  - 不直接依赖 `previous_response_id` 串会话；为每个 thread 固定生成 `sessionKey`，通过 OpenClaw `user` 或 `x-openclaw-session-key` 维持连续会话。
  - 原因：OpenClaw 当前接受但忽略 `previous_response_id`，而稳定 session 才是其真实会话路由方式。
- action 结果必须回流成线程 evidence，再触发下一轮反思。
  - 不把流式增量或中间 token 全量塞进 evidence。
  - 只持久化两类回流材料：外部委派的最终摘要、关键工具结果。
- 外部“写操作”默认人工确认。
  - Jira 创建/更新、部署触发、发消息等都默认 `requiresApproval=true`。
  - 只读外部查询可 `executionMode=auto`。
  - 确认方式：利用现有的 `proposed_actions` 审批机制。写操作 action 创建后 `executionMode='manual'`，展示在前端**动作队列**（`/actions`），用户手动点「执行」才真正调用 OpenClaw。需要用户判断的问题（如“是否要继续查询？”）则通过 `create_confirm_request` action 自动写入 `confirm_requests` 表，展示在前端**决策中心**（`/decisions`）。两者协作而非二选一。
- 审批 / 待用户确认的 UI 入口分工。
  - **⚖️ 决策中心**（`DecisionCenter.vue` -> `confirm_requests` 表）：展示 AI 产出的「需要用户判断」的问题，用户点是/否回答，适合决策类场景。
  - **⚙️ 动作队列**（`ActionQueue.vue` -> `proposed_actions` 表）：展示所有 action 的生命周期（queued/running/failed/succeeded），用户可手动执行 / 取消 / 重试，适合审批执行类场景。
  - 两者的交叉点：`create_confirm_request` 类型的 action 会在动作队列中显示为 succeeded（因为它是 auto 执行的），同时在决策中心产生一条新的待确认项。
  - 高优先级的 `confirm_request` 创建后，应同时通过 `notify_user` 推 bot 通知，提醒用户去决策中心处理。
- 自我反思内部本地查询和外部委派分工清晰。
  - 本地历史、记忆、画像、事实变更：本项目自己查。
  - Jira、GitLab、部署系统、文档系统等外部能力：OpenClaw 查或执行。
- 外部委派的识别机制。
  - 不使用规则匹配，而是由 LLM prompt 驱动：`ReflectionWorker` 的 prompt 明确列出可用 actionType（含 `delegate_openclaw`），LLM 基于当前 thread 的 evidence 和 openQuestions 自主判断是否需要外部查询。
  - OpenClaw 是唯一的外部委派通道，起 AI 网关作用：本项目把自然语言任务描述交给 OpenClaw `/v1/responses`，OpenClaw 侧的 agent 自带 MCP server / tool（Jira、GitLab 等）自主决定用什么工具执行。
  - 分发靠 `ActionExecutor.dispatch` 的 actionType 路由（if-else），不需要额外的编排引擎。
- 等待外部结果期间的心跳行为。
  - 问题：定时心跳（`ReflectionPlanner.runHeartbeat`）可能在外部委派结果返回之前触发新一轮反思，LLM 看不到新 evidence 会产出重复判断，浪费 tokens。
  - 解决方案：在 `runReflection` 入口增加前置条件判断——如果 thread 有 pending/running 状态的 `delegate_openclaw` action 且 `triggerType === 'heartbeat'`，则跳过本轮 LLM 调用，只将 `nextReflectionAt` 往后推一个周期，并记录 `skipped: waiting_for_delegation`。
  - 不影响 `triggerType='action_result'` 触发的反思（外部结果回来后的正常触发）。
  - 如果外部委派超时进入 `dead_letter`，下次心跳时条件不再满足，照常执行反思。
  - Thread 保持 `active` 状态，不引入新的 thread status 值。

## 主要实现变更

### 1. 自我反思运行模型

- 在 `ReflectionThreadService.runReflection` 之前增加研究阶段。
- 新增 `ReflectionResearcher`，输入为：
  - 当前 thread
  - 当前 links/evidence
  - 最近 runs 摘要
  - 用户核心上下文
- `ReflectionResearcher` 输出两类结果：
  - `local_queries`: 本地 recall 请求列表，包含 query/filter/topK/purpose
  - `external_tasks`: 外部查询或操作意图，转换为 action proposal 候选
- 本地查询执行后，把召回结果标准化为新的临时 evidence item，参与同一轮 `ReflectionWorker.generate`。
- `ReflectionWorker` 最终只负责生成：
  - summary / discoveries / openQuestions
  - action proposals
  - markdownBody

### 2. 外部委派执行器

- 将 `OpenClawClient` 从通用 `fetch(path, body)` 改为专门的 Responses client，支持：
  - `input` items
  - `tools`
  - `tool_choice`
  - `stream`
  - `user` / `x-openclaw-session-key`
- 新增 `OpenClawDelegationService`，封装一次完整委派流程：
  - 创建 thread 级稳定 `sessionKey`
  - 构造 developer prompt，明确任务边界、只读/写入权限、输出格式
  - 发送 `/v1/responses`
  - 若返回 `function_call`，由本项目继续把 `function_call_output` 回送 OpenClaw，直到拿到最终 assistant message
  - 产出结构化结果：`summary`、`artifacts`、`rawTranscript`
- 不做无限循环；设置最大 turn 数、超时、最大工具调用数。
- 对外部写操作增加 allowlist 和审批门槛；未审批的写操作直接拒绝执行。
- 对委派结果进行分类处理（`DelegationOutcome`）：
  - `success`：正常回流 evidence，触发下一轮反思。
  - `capability_missing`（缺少 MCP server / tool）：
    - 自动产出 `notify_user` action（高优先级，推 bot 通知），告知用户"反思线程 X 尝试查询 Y，但 OpenClaw 报告缺少对应能力"。
    - 自动产出 `create_confirm_request` action，在决策中心创建待确认项，options 为「配置好了，请重试 / 暂时跳过 / 不再查询」。
    - 用户在决策中心选择「配置好了，请重试」后，触发 retry 重新执行该 `delegate_openclaw` action。
  - `auth_error`（token 过期 / 权限不足）：同 `capability_missing` 处理，通知信息改为提示重新授权。
  - `timeout`：标记 action 为 failed，允许用户在动作队列手动重试。
  - `error`：通用错误处理，写入 `lastError`，重试次数用尽后进入 `dead_letter`。

### 3. action 结果回流

- 新增 `action_result` 作为线程 evidence 来源类型。
- action 成功后，除了更新 `proposed_actions.result_json`，还要：
  - 写入新的 `action_result` 持久化记录，包含 action id、thread id、run id、summary、payload、transcript path
  - 在 `topic_memory_links` 增加 `source_kind='action_result'` link
  - 更新 thread `continueReason` 为“new action result available”
- 对 `delegate_openclaw`：
  - transcript 单独落 markdown/json 文件
  - 回流到 thread 的 evidence 只保留压缩后的 summary 和关键结果
- 新增轻量调度规则：
  - 只要有新的 `action_result` link 且 thread 为 active，立即或尽快触发一次 `runReflection(triggerType='action_result')`
  - 心跳触发时，先检查 thread 是否有 pending/running 的 `delegate_openclaw` action：
    - 有 -> 跳过本轮反思，推迟 `nextReflectionAt`，日志记录 `skipped: waiting_for_delegation`
    - 无 -> 正常执行反思

### 4. 数据与接口

- 扩展 action type 语义：
  - `notify_user`
  - `create_confirm_request`
  - `update_truth_property`
  - `delegate_openclaw`
- 保留 `query_external_tool` 兼容读取，但在新代码路径里统一写成 `delegate_openclaw`。
- 新增持久化表：
  - `action_results`
    - `id`, `action_id`, `thread_id`, `run_id`, `result_type`, `summary`, `payload_json`, `transcript_path`, `created_at`
- 扩展 thread evidence hydrate 逻辑，支持 `source_kind='action_result'`。
- 扩展 thread detail API，让前端能展示：
  - action result 摘要
  - 外部委派 transcript 链接
- 配置层新增 OpenClaw 专区：
  - `openClawEnabled`
  - `openClawBaseUrl`
  - `openClawApiKey`
  - `openClawTimeoutMs`
- 配置生效规则改为按用户 runtime config 读取，不再只读全局 `.env`。
- `src/options.tsx` 增加 OpenClaw 配置项；敏感字段只写后端，不在前端回显明文。

### 5. 前端和观察性

- 在线程详情中新增：
  - “研究补充证据”区块，展示本地二次查询命中的消息摘要
  - “外部委派结果”区块，展示 action_result 摘要与 transcript
- 在 action 卡片中区分：
  - 本地自动动作
  - 外部只读委派
  - 外部写入委派（需确认）
- 日志与指标至少记录：
  - 本地研究查询次数/命中数
  - OpenClaw delegation 耗时、轮数、成功率
  - action_result 回流次数
  - `action_result -> rerun reflection` 成功率

## 测试计划

- 单元测试
  - `ReflectionResearcher` 能把“需要查本地消息”的线程生成本地查询计划，并把召回结果合并进同轮 reflection 输入。
  - `OpenClawDelegationService` 能处理：
    - 单次直接回答
    - `function_call` + `function_call_output` 多轮闭环
    - 超时 / 最大轮数 / 非 JSON 输出
    - 返回 `capability_missing` 时，自动产出 `notify_user` + `create_confirm_request` 两个 action
    - 返回 `auth_error` 时，同上但通知信息包含重新授权提示
  - `ActionExecutor` 执行 `delegate_openclaw` 后会生成 `action_result` 并回链到 thread。
  - `ReflectionThreadService.collectEvidence` 能读取 `action_result` 作为下一轮 evidence。
  - 心跳跳过测试：当 thread 有 pending 的 `delegate_openclaw` 且心跳触发时，`runReflection` 应跳过 LLM 调用并推迟 `nextReflectionAt`。
  - 心跳不跳过测试：当 thread 的 `delegate_openclaw` 已 succeeded/failed/dead_letter 时，心跳触发应正常执行反思。
- 集成测试
  - 构造一个“查询项目 BE 进展”的 thread：
    - 首轮反思产生 `delegate_openclaw`
    - action 执行成功
    - 生成 `action_result`
    - 自动触发第二轮 reflection
    - 第二轮 summary 中引用新的外部 evidence
  - 构造一个“先查本地消息再判断是否需要外部查询”的 thread：
    - 同一轮 run 内完成本地 recall
    - 若证据仍不足，再产出 `delegate_openclaw`
  - 构造一个“OpenClaw 缺少 Jira MCP”的 thread：
    - 首轮反思产出 `delegate_openclaw`
    - OpenClaw 返回 capability_missing
    - 自动在决策中心创建待确认项 + bot 通知
    - 用户点击「配置好了，请重试」后重新执行该 action
    - 重试成功后 action_result 回流，触发下一轮反思
  - 构造一个“等待期间心跳触发”的 thread：
    - 首轮反思产出 `delegate_openclaw`（pending 状态）
    - 心跳到期触发 -> 验证反思被跳过
    - 外部结果回来后 triggerType='action_result' -> 验证反思正常执行
- 回归测试
  - 现有 `notify_user` / `create_confirm_request` / `update_truth_property` 不受影响
  - 关闭自我反思的用户不会触发 researcher、不会自动 rerun
  - 梦境重放链路不受影响

## 假设与默认值

- 默认不引入 `query_memory` action；若未来出现长耗时、可复用、跨线程的本地研究任务，再单独引入。
- OpenClaw 使用其 OpenResponses HTTP API，真实会话靠 `user` 或 `x-openclaw-session-key` 维持，不依赖 `previous_response_id`。
- OpenClaw 流式事件只用于组装最终结果，不把中间 delta 作为 thread evidence。
- 外部只读查询可自动执行；外部写操作默认需要人工确认。
- 每个外部委派 action 都必须生成可审计结果文件或结构化 payload，确保后续反思可引用、可追溯。

