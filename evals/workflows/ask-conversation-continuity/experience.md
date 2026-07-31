# Ask Conversation Continuity Workflow

## Goal

验证 Quick Ask 在窗口关闭后使用本机 `AskResumeSnapshot` 续接时，能够自然定位上一轮真实话题，同时仍由 Memory Service 重新检索本轮证据；用户选择“新问题”时，不应继承旧 topic。

## Real Memory Basis

用例基于对 `10.32.56.212` 上 `esone.qiu` 记忆的只读抽样：`MTR-141852: AI Custom VBG`、`AI VBG`、`RCV BE`、`backend` 和 `new design` 是同一真实项目上下文；`Nova Brandy Daily` 是现有 Ask eval 中用于隔离检查的另一真实话题。

本 suite 只把经过裁剪的 `contextHints` 发给 `/api/v1/ask`。快照摘要不是 evidence，也不是权威事实；每个续接正例都要求响应返回新一轮 evidence 和结构化 `continuityReceipt`。

## Steps

1. 从 `evals/cases/ask-conversation-continuity/cases.jsonl` 读取真实续接和隔离场景。
2. 在运行时根据 `contextHintsAgeHours` 生成 `updatedAt`，避免静态时间戳失真。
3. 向真实 `/api/v1/ask` 发送 query、scope、includeEvidence 和可选 `contextHints`。
4. 保存 request、raw response、judge 结果和 Reader Contract report。
5. 启发式 judge 检查续接回执四个字段、`selectedTopic`、expected topic、evidence topic、禁入话题和无 hint 隔离。
6. 任一硬边界不满足即失败；不使用 LLM judge，因为这些字段和锚点可以确定性判定。

## Pass Criteria

- 带 hint 的响应必须返回 `source=local_ask_resume_snapshot`、`localOnly=true`、`usedAsHint=true`、`reRetrieved=true`。
- 需要重新检索的正例必须返回 evidence，且 evidence 至少命中一个真实项目锚点。
- 续接后的回答、evidence 或 context match 至少命中规定数量的 AI VBG 项目锚点。
- `contextMatch.selectedTopic.label` 必须直接命中 `AI VBG` 或 `MTR-141852`；不能因为候选列表或 evidence 里碰巧出现正确锚点，就放过实际锁定到 `Nova` 的结果。
- 无 hint 的新问题不得返回 `continuityReceipt`，也不得命中上一轮 AI VBG 禁入锚点。
- 三个场景都必须有可读回答，不能只靠 receipt 判定通过。

## Non-Persistence Proof

实时 suite 不能安全读取或修改线上数据库来验证“不写入”。该边界由 `memory-service/src/__tests__/api-ask.test.ts` 的真实路由 fixture 单独证明：带唯一 resume summary 调用 Ask 后，`messages_raw` 数量不变且检索不到该 summary。Quick Ask E2E 另外证明“新问题”请求不携带 `contextHints`、`丢弃`只删除本地快照。

## Schedule Decision

保持 `runMode: manual`。虽然 recall / generation 有漂移风险，但真实 `/ask` 仍会产生既有 answer-memory observation；在提供 no-write eval 模式或隔离用户前，不应每周自动向 `esone.qiu` 制造测试会话。发生 Ask prompt、recall、context match 或 continuity contract 变化时手动重跑。

## Report Requirements

- 展示 query、是否携带本机 hint、动态快照年龄、topic title 和真实记忆基础。
- 展示实际 answer、evidence 数量与片段、context match、`continuityReceipt` 四个字段和 HTTP 耗时。
- 展示 expected topic 命中、selected topic 命中、evidence topic 命中、禁入话题命中和每项 0-3 分判据。
- 明确区分本报告证明的线上检索行为，与 unit/E2E 才能证明的本地存储和不写入边界。
- 请求错误、超时、回执缺失或 evidence 缺失必须显式失败，不能生成成功外观。

## Run

```bash
cd /Users/Esone/git/personal-ai
npm run eval:validate
npm run eval:run -- --suite ask-conversation-continuity --no-repair
```
