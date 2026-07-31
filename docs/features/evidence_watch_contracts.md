# Evidence Watch Contracts

_最后更新: 2026-07-15_

Evidence Watch Contracts / 证据守望契约用于处理“这条事实可能会变、需要持续复核、旧答案不能冒充当前事实”的场景。它不是新的用户待办页，而是 Ask、Reflection、Action Queue 和 confirm request 之间的后台契约层。

## 大白话运行逻辑

当 `EvidenceResolutionPlanner` 判断本地证据不足，并且缺口属于 `future_monitoring`、`owner_eta_gap`、`artifact_gap` 或 `disposition=watch` 时，Memory Service 会先创建或复用一条 `evidence_watch_contracts`：

1. 用 `answerMemoryCanonicalKey`、`sourceAnchor + gapType` 或问题文本 hash 生成 `subjectKey`。
2. 记录要观察的问题、权威来源、verifier、cadence、stop conditions 和影响面。
3. 给后续 `delegate_openclaw` / `create_confirm_request` 生成 contract 级 idempotency key。
4. 如果同一个事实缺口再次触发查证，复用已有 action，并写入 `skipped_duplicate` run receipt；这只证明去重成功，不代表来源已经复核无变化。
5. 来源阻塞、发现变化、无变化或需要用户决策时，写入 `evidence_watch_runs`，Ask response 返回可选 `evidenceWatch` receipt。

用户看到的重点是：这条事实是否已复核、权威来源是否可读、旧结论是否只能按历史引用，以及系统有没有避免重复外部查证。

## 关键实现逻辑

Evidence Watch 只消费已经通过 [Evidence Cohesion Gate（证据对齐）](./evidence_cohesion_gate.md) 的证据。Cohesion 先判断“是否围绕同一个问题”，Authority / Resolution 再判断“本轮证据是否足够、谁有权改变事实”，Evidence Watch 最后决定“是否需要持续向权威来源复核”。Reflection 遇到 `split_required`、`insufficient_anchor` 或 `blocked_cross_scene` 时不会用跨题 evidence 创建 watch/delegation；`conflict_needs_authority` 则保留同一问题内的冲突双方进入后续判断。

Evidence Watch 的核心不是“排一个后台任务”，而是给会变化的事实建立一条可复用、可追溯、不会冒充当前事实的契约。

1. Contract 身份先绑定事实语义，再绑定触发场景。`subjectKey` 优先使用 `answerMemoryCanonicalKey`，其次使用显式 `sourceAnchor + gapType`，Reflection 场景可以稳定退回 `thread:<id>`；Ask 如果没有真实来源锚点，不把一次性 `ask:<requestId>` 当作事实身份，而是退回问题文本 hash，避免同一个事实缺口在每次追问时变成新 contract。
2. `dedupeKey` 由 `subjectKey`、verifier kind、action type、gap type 和 cadence 组成。它描述“同一个事实缺口需要同一种复核”，因此同一 Jira estimate、owner ETA 或 artifact 状态反复被问到时，会复用已有守望契约和已有 action。
3. `prepareActionForPlan` / `prepareActionForProposal` 会先创建或复用 contract，再把 action idempotency key 设为 `evidence_watch:<contractId>:<actionType>:verify`。Ask、Reflection 和 confirm request 都通过 `evidenceWatchContractId`、`sourceAnchor`、`gapType`、`reasonCode`、`routing=watch` 连接到同一条链路。
4. Action Queue 创建前会查找可复用 idempotency key。命中时只写 `skipped_duplicate` run receipt 和 action link，不同步执行重复外部查证；这条 receipt 的含义是“已复用队列中的查证动作”，不是“权威来源已确认无变化”。
5. Contract 状态只由真实复核类 run 推进：`checked_no_change` 进入 `quiet_no_change`，`checked_changed` 进入 `authority_changed`，`blocked` 进入 `source_blocked`，`needs_user_decision` 进入 `due`。`created`、`skipped_duplicate`、`skipped_budget` 这类生命周期/抑制收据会保留原状态，并且不更新 `lastCheckedAt`。

这条规则保证用户在 Ask、Reflection、Action Queue 或 Confirm Requests 里看到的不是“系统好像做过什么”，而是清楚区分：已建立守望、已去重、已实际复核、来源阻塞、发现变化、需要用户决策。

### 与执行就绪契约的边界

[Action Readiness Contracts](./action_readiness_contracts.md) 与 Evidence Watch 是前后两层：Evidence Watch 决定“哪条事实需要何时、向哪个权威来源复核”，Action Readiness 决定“承载这次复核的 OpenClaw 动作现在能不能安全 dispatch”。readiness blocker 会阻止原 action 消耗 attempt/retry；probe 只检查连接、鉴权和 capability，不算 `checked_no_change` / `checked_changed`，也不能推进 Evidence Watch 的 `lastCheckedAt`。

### 与开放问题退出契约的边界

`OpenQuestionExitContractService` 位于 Reflection 动作生成之前，管理“问题是否还应继续”；Evidence Watch 管理“可变化事实如何向权威来源复核”。两者的组合规则是：

- Reflection 发现同一线程已有 active/quiet/due/source-blocked Evidence Watch 时，开放问题进入 `handoff_to_evidence_watch`，不再创建第二份查证动作。
- 建立 Evidence Watch 和写入 `skipped_duplicate` 只证明 owner/去重成立，开放问题收据必须明确“不代表权威来源已确认无变化”。
- Evidence Watch 写入 `checked_changed` 并进入 `authority_changed` 后，会立即恢复关联的开放问题 contract，并把 active reflection thread 调度到当前时间；下一轮评估把 watch id + updated time 当作新的 authority signal，只消费这一轮恢复资格。
- `checked_no_change` / `quiet_no_change` 继续由 Evidence Watch 承接，不会仅因为时间经过就把问题重新送回 Today Pilot。
- Action Readiness 仍在允许生成动作之后检查 dispatch 条件；Exit Contract 不替代 auth/capability/input/proof gate。

## 业内与研究参考

- [ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt) 的 monitoring task 会周期性检查变化、记住前次运行，并在满足停止条件时停止；这说明“监控任务已建立”和“本次发现变化/无变化”必须分开呈现。
- [Google Alerts](https://support.google.com/websearch/answer/4815696) 的产品心智是“新证据出现才提醒”，适合作为低打扰守望的参考，但它不证明旧页面内容已经被重新核验。
- [FreshLLMs / FreshQA](https://aclanthology.org/2024.findings-acl.813/) 讨论了快速变化知识和 false premise 对 LLM factuality 的影响，因此 Evidence Watch 要把旧结论明确标成历史引用。
- [Doyle 的 Truth Maintenance System](https://dspace.mit.edu/handle/1721.1/5733) 强调记录 belief 的理由链；本功能对应地保留 contract、authority source、run receipt 和 action link，而不是只留下一个最新答案。

设计结论：`created`、`skipped_duplicate`、`skipped_budget` 是生命周期/去重收据，不会把 contract 标成“静默无变化”；只有真实 `checked_no_change` 复核才会进入 `quiet_no_change`。

## 数据与 API

核心表：

- `evidence_watch_contracts`: contract 本体、subject key、verifier、state、来源、创建来源。
- `evidence_watch_runs`: 每次复核或抑制重复动作的收据。
- `evidence_watch_links`: contract 与 action、confirm request 等对象的关联。

API：

- `GET /api/v1/evidence-watch-contracts?state=all`
- `GET /api/v1/evidence-watch-contracts/:id`
- `GET /api/v1/evidence-watch-contracts/:id/runs`
- `POST /api/v1/evidence-watch-contracts/:id/runs`

列表读取会额外返回 `receipt`，说明本次只是按 `state` / `subjectKey` / 分页读取的只读快照；它不会复核权威来源、创建或复用外部查证动作、确认事实变化、发送通知，也不会修改 contract 状态。详情读取保留原有 Evidence Watch 状态 `receipt`，并额外返回 `readReceipt` 说明详情页只是当前 contract 快照；`readReceipt` 带 `lastCheckedAt`、`nextCheckAt` 和 `nextCheckDue`，把“最近复核 / 下次复核 / 是否到期”作为快照时间基准呈现。run history 读取也返回 `证据守望运行快照`，明确历史 run 不代表本轮重新触达过权威来源，并保留同一组复核时间基准。

`POST /runs` 返回 `writeReceipt`，说明本次只是写入 run 收据，还是一次真实复核；`checked_no_change` / `checked_changed` / `blocked` / `needs_user_decision` 会标成计入复核并推进 `lastCheckedAt`，`created` / `skipped_duplicate` / `skipped_budget` 会标成不计入复核、不会把旧结论标成已确认。这个回执还列出 state 前后变化、来源状态数量、复用动作数量和补丁线索数量，并说明写入 run 不会直接执行外部查证、发送通知、确认事实变化、写回权威来源或创建额外 action。

`state` 参数如果不是 `all` / `active` / `quiet_no_change` / `due` / `authority_changed` / `source_blocked` / `paused` / `archived`，API 会直接返回 `400` 的 `证据守望筛选已阻断`，避免拼错筛选时静默退回全量列表。

Ask response 可选字段：

```ts
evidenceWatch?: {
  contractId: string;
  state: 'active' | 'quiet_no_change' | 'due' | 'authority_changed' | 'source_blocked' | 'paused' | 'archived';
  label: string;
  detail: string;
  subjectKey: string;
  lastCheckedAt?: number;
  nextCheckAt?: number;
  confirmRequestId?: string;
  duplicateSuppressedCount: number;
  runId?: string;
  lastRunState?: 'created' | 'checked_no_change' | 'checked_changed' | 'blocked' | 'skipped_budget' | 'skipped_duplicate' | 'needs_user_decision';
  lastRunSummary?: string;
  created?: boolean;
}
```

## 接入点

- Ask: `executeAskResolutionAction` 会在 watch plan 进入 action queue 前准备 contract 和 idempotency；命中已有 action 时不再同步执行重复查证。
- Reflection: `ReflectionWorker` 把 watch resolution metadata 写进 proposal params；`ReflectionThreadService` 进队列前复用 contract 级 idempotency。
- Confirm Requests: `routing=watch` 的手动 pending 查证会挂到同一 contract。
- ActionExecutor: 创建 watch confirm request 后，如果 action params 有 `evidenceWatchContractId`，会反向链接 contract。

## 收据边界

- `证据守望列表快照`: 只说明列表读取的筛选、分页、返回数量和读取时间；不代表本轮触达过权威来源，也不代表没有新的变化。
- `证据守望详情快照` / `证据守望运行快照`: 只说明 contract 详情或历史 run 被读取；会带上 `lastCheckedAt`、`nextCheckAt`、`nextCheckDue` 作为时间基准，但不会追加 run、复核来源、创建 action、确认变化、发送通知或修改状态。
- `证据守望运行写入回执`: 只说明 run 收据已经写入，并区分本次是否计入真实复核；它不会自动触发外部查证、发送通知、确认事实变化、写回权威来源或创建额外 action。
- `created`: 只说明守望契约已建立，后续相同事实缺口会复用；不代表权威来源已复核。
- `skipped_duplicate`: 只说明已有外部查证动作被复用；Ask 回执会把本轮 run 标成“复用队列 / 本轮未复核来源”；不更新 `lastCheckedAt`，也不把状态改成 `quiet_no_change`。
- `checked_no_change` / `checked_changed` / `blocked`: 才代表本轮实际触达或尝试触达权威来源，并更新最近复核状态。

## 验证

功能依赖长期行为、去重和收据清晰度，因此有独立 deterministic eval：

```bash
npm --prefix memory-service test -- --run src/__tests__/evidenceWatchContractService.test.ts src/__tests__/api-evidence-watch-contracts.test.ts
npm run eval:validate
npm run eval:run -- --suite evidence-watch-contracts --no-repair
```

eval 样本覆盖 Jira estimate 可变化事实、AI tool 状态来源阻塞和重复外部查证合并。
