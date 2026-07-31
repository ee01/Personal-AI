# Action Readiness Contracts Experience Eval

本 suite 评估 Personal AI 在调用 OpenClaw 前，是否先确认连接、鉴权、目标能力、必填输入和结果证据都足以支持执行，并在条件不满足时阻断原动作，而不是消耗重试、重复生成恢复请求或继续堆积 Reflection 动作。

## Real Scenarios

1. Jira 查询遇到 OpenClaw 401 后，同一网关下的后续 Jira 查询应在执行前被拦截；用户只看到一次恢复路径，后续动作不增加 retry，也不再次发出原请求。
2. Google Drive 上传动作需要重测连接时，系统只发送 capability probe，不携带 `release.zip` 等原任务内容；探测成功后动作仍保持待审批，用户可以重新看到原执行入口。
3. 消息规则准备上传附件，但缺少目标目录和附件下载地址时，应在本地直接标记 `blocked_input`，不访问 OpenClaw。
4. 外部代理声称成功却没有返回可验证 artifact 时，应标记 `blocked_proof`，不能把结果写成已确认的 `action_result`。
5. Reflection 在网关鉴权失效期间提出多条外部查询时，应把 thread 链接到同一 readiness contract，而不是创建一批注定失败的队列动作。

## Steps

1. 读取 `evals/cases/action-readiness-contracts/cases.jsonl`。
2. 为每个 case 创建独立的 memory-service 内存数据库和临时 OpenClaw 配置。
3. 通过真实的 `ActionReadinessService`、`ActionExecutor`、`ActionRepository` 和 `ReflectionThreadService` 执行场景；网络响应只在进程内确定性模拟。
4. 记录 contract 状态、执行 decision、网络调用次数、attempt/retry、原任务是否进入 probe、队列状态、action result 和 Reflection 队列债务。
5. 使用确定性 heuristic 对照 `expectedBehavior` 判分，不调用 LLM，不访问远端 Memory Service。

## Pass Criteria

- 已知 `blocked_auth`、`blocked_capability`、`blocked_input` 或 `blocked_proof` 必须在原动作 dispatch 前阻断。
- 被阻断的后续动作必须保持原 queue status，`retryCount=0`，且没有新的 attempt、网络请求或重复恢复动作。
- readiness probe 必须明确 `originalActionExecuted=false`，请求体不得包含原任务正文；成功只更新 readiness，不批准也不执行原动作。
- 缺少必填输入时必须本地失败关闭；缺少可验证 artifact 时不得生成成功 action result。
- Reflection 提议必须在持久化前检查 readiness，并用 contract link 代替无效队列动作。

## Report requirements

- 使用共享 Reader Contract 渲染，不新增 suite 专属 HTML。
- 每个 case 展示真实场景、预期状态、实际 contract/queue/network/attempt 证据和逐项 proof check。
- 明确说明本 eval 使用本地确定性 OpenClaw 响应，证明的是 dispatch 门禁与状态流转，不证明线上凭据或第三方 connector 当前可用。
- 报告必须保留失败项和改进建议，完整请求、响应与 judge payload 放在 run artifacts 中。

## Command

```bash
npm run eval:validate
npm run eval:run -- --suite action-readiness-contracts --no-repair
```
