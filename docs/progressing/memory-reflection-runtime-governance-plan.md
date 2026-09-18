# 反思升级：运行时治理 / Reflection Runtime Governance

> 生成日期：2026-09-11 CST
> 优先级：P0（止血）+ P1（架构归属）
> 预估规模：P0 2-3 天 / P1 4-6 天 / P2 2-3 天
> 无新页面、无 demo：ROI 指标接进现有 `docs/features/usage_analytics.md`「成本治理与 2026-08 事故复盘」章节
> 前身：[`memory-reflection-governor-plan.md`](./memory-reflection-governor-plan.md)（搁置）——本 plan 是它明确推迟的**运行时那一半**，复用它的 Utility / Stop-Loss / Resume 规则设计，不复活它的巡航页
> 诊断来源：`rcadmin@10.32.56.212` 上 `esone.qiu` 生产库只读取证（2026-09-11），901 条 `reflection_threads` / 5521 条 `reflection_runs` 全量统计 + 代码路径走查

## 结论

反思系统的 thread/run 数据模型是对的，但**调度层把它退化成了"用 LLM 定期轮询外部世界"**：

> 线程的下一次反思时间是一个**常量再武装**（`now() + 15min`），与"这次有没有新证据""出口合约判了什么"完全无关。于是同一句话被反思了 419 次，而 665 条线程一次都没轮到。

三个动作即可止血，且都是小 diff：

1. **把出口判断从 LLM 之后挪到 LLM 之前**——现在 `evaluate()` 在 `worker.generate()` 花完钱之后才跑（[ReflectionThreadService.ts:855→864](../../memory-service/src/core/ReflectionThreadService.ts:855)），只能抑制下游动作，不能省掉这次 LLM。
2. **`nextReflectionAt` 改成出口决策与连续无新证据次数的函数**，而不是常量（[ReflectionThreadService.ts:1124](../../memory-service/src/core/ReflectionThreadService.ts:1124)）。
3. **给队列加老化（aging）**，解除 priority-10 对 6 个槽位的永久占用（[ReflectionThreadRepository.ts:471](../../memory-service/src/repositories/ReflectionThreadRepository.ts:471)）。

它不是：

- 不是新的反思巡航页（governor plan 的搁置结论继续有效：治理只做内部诊断，用户决策走既有交互面）
- 不是关掉反思（`REFLECTION_DEFAULT_ENABLED` 默认 false 的现状不动）
- 不是新调度器（继续挂在 HeartbeatLoop 上）
- 不是重建出口机制（`OpenQuestionExitContractService` 已实现 park/handoff/去重，本 plan 只把它接到调度上）

---

## 现状：代码事实与数据证据

### 根因 1：调度是常量再武装

[ReflectionThreadService.ts:1124](../../memory-service/src/core/ReflectionThreadService.ts:1124)，每次 run 结束：

```ts
nextReflectionAt: now() + this.getReflectionHeartbeatSeconds(),  // 默认 15min，无条件
```

`deferHeartbeatReflection()` 同样是平坦再武装。全库**没有任何退避、衰减或 TTL 逻辑**：`grep -rn "backoff\|decay" core/Reflection*.ts` 为空。

### 根因 2：出口机制存在，但作用域错位（决定性证据）

`OpenQuestionExitContractService` 已经实现了本该解决问题的全部状态机——`parked_until_new_evidence`、`expired_low_value`、`handoff_to_evidence_watch`、`merged`，reason code 含 `no_new_evidence`、`evidence_watch_owns_verification`，还带问题相似度去重（`questionTokens` + Jaccard）和 resume 触发器。

**但它只管"问题"，不管"线程调度"。** 生产数据三连证：

| 线程 | 出口合约状态 | 实际 run 次数 |
|---|---|---|
| `Remi Hattinguais · role` | `parked_until_new_evidence` ✅ 已 park | **380** |
| `NeuBird · 融资金额` | `handoff_to_evidence_watch` ✅ 已移交证据守望 | **367** |
| `AGT · purpose` | 无合约（覆盖率漏洞） | **419** |

合约判了"停"，线程照跑。原因是 `evaluate()` 的返回值只用于 `suppressDerivedActions`（抑制下游 action），从未参与 `nextReflectionAt` 计算。

覆盖率也不足：901 条线程只有 237 条出口合约（`handoff 118 / active 90 / waiting_on_action 23 / parked 6`），最烧钱的 AGT 根本没被覆盖。

### 根因 3：优先级通胀 + 队列饥饿

`listDueThreads` 的排序（[ReflectionThreadRepository.ts:477](../../memory-service/src/repositories/ReflectionThreadRepository.ts:477)）：

```sql
ORDER BY priority DESC, COALESCE(next_reflection_at, 0) ASC, salience DESC, updated_at DESC
LIMIT ?   -- reflectionActiveTopicLimit，默认 6
```

`priority DESC` 是第一排序键，每拍只取 6 个。清理前的分布：

- priority：`10:157`、`9:343`、`8:210`、`7:51`、`6:138`——90% 的 salience 挤在 0.8-0.9，打分无区分度
- **157 条 priority-10 全部跑过；从没跑过的 665 条里最高只有 priority 9**

即：priority-10 那一档永久拥有队列。6 槽/拍 @15min = 24 槽/小时，157 条 priority-10 自己就要 6.5 小时轮一圈，**priority ≤9 的线程在数学上永远排不上**。取证当时队列头部实况：AGT(419 次)、GLM-5 Turbo(354 次)、MTR-145975(122/110 次)。

这也修正了成本口径：2026-08 复盘里"成本与线程数量近似无关"（`reflectionActiveTopicLimit` 封顶）是对的——**积压的真实伤害不是线性烧钱，而是把有限的 6 个槽位永久喂给了空转线程**。

### 根因 4：入口无退出条件、无语义去重

建线程门槛过低：每个 entity property 变化、每个推测性问题都开线程，且 priority 在各入口被硬编码或按 importance 放大到 ≥6——`:517` 在线反思给 `6|7`、`:751` profile_item 固定 `6`、`:790` dream 固定 `7`，而 `:664` message 与 `:707` entity_property 走 `Math.max(5, Math.min(10, Math.round(importance*10)))`，importance ≥0.95 即得 priority 10，这是根因 3 里 157 条永久占队线程的来源。后果：

- **不可证伪的问题**："是否有尚未披露的计划？""未来是否会有 status 变化？"——永远不会有答案，天然不终止
- **近重复**：`Remi 是否继续任职` 3 条不同措辞；`Google Sheets · usage` 与 `Google 表格 · 用途`（中英未归一）；`Q1 epics · scope_deadline` 2 条
- 出口合约的 `questionTokens` 相似度只在 run 内部用于问题去重，**没有用在建线程时的 topic 去重上**

### 根因 5：产出几乎完全没有被消费（决定性证据）

5521 次 LLM run 换到：

| 下游 | 数量 | 说明 |
|---|---|---|
| `reflection_artifacts` | **23** | 面向用户的最终沉淀 |
| `confirm_requests` | 166 → 已答 **36**(22%) / 过期 **96** / pending 32 | 用户用脚投票 |
| `proposed_actions`（源自线程） | executed 1485 = `notify_user` 1340 + `create_confirm_request` 145 | 「executed」的真实含义是**发了条通知**，见下 |
| **通知触达** | **4258 条全部已发送 → 点击 7 次（0.16%）／dismiss 0 次** | 反思主输出 `notify_user` **2176 条 → 点击 2 次（0.09%）** |
| 带 discoveries 的 run | 5263 / 5521 (95%) | 抽样内容多为"未发现变化"的复述 |

**0.09% 是这套系统最关键的一个数字。** 而且它不能用"用户不看通知"解释：同期走真实系统通知的 `chrome_notification` 有 2081 条，点击率也只有 0.24%。看通知标题就明白了——抽样三条全是这个形状：

```
自我反思: 事实跟进: Gemma 4 · license
自我反思: 事实跟进: Remi Hattinguais · role
自我反思: 事实跟进: AI Image Generation for RCV VBG · daily_limit
```

标题里没有任何决策信息（变成了什么？影响我什么？要我做什么？），用户无从判断值不值得点。这说明问题不只在调度浪费，**产出形态本身就不构成对用户有用的信息**——这也是方案 D（把事实跟进整体移出反思）的根本依据：这类内容根本不该以"反思产出"的形式推给用户。

另外 AGT 线程最近 3 次 run 的 summary 几乎逐字相同。**"95% 的 run 都有 discoveries"这个指标本身是坏的**——它把"确认了没有变化"也算成发现。

### 根因 5 附带查明：`approved_at` 恒为 0 不是 bug（原待定项 1 已结论）

`approved_at` 只在 `requires_approval && executionMode !== 'auto'` 且人工显式批准时才写入（[ActionExecutor.ts:564-574](../../memory-service/src/core/actions/ActionExecutor.ts:564)）。而反思产生的 action 实际构成是：

| action_type | requires_approval | execution_mode | 数量 |
|---|---|---|---|
| `notify_user` | 0 | auto | 1340 |
| `create_confirm_request` | 0 | auto | 145 |
| `delegate_openclaw` | 1 | manual | 40 |
| （字段为空的畸形行） | — | — | 19 |

前两类按设计绕过审批闸，`approved_at` 为空是正确的。**结论：不是 bug，但 ROI 不能用"批准率"度量**——必须改用通知互动率 + confirm 回答率（已落入方案 F）。

两个附带发现：

- **68 条 `delegate_openclaw` 永久卡死**：按 state/queue_status 统计为 `pending/queued 39` + `pending/failed 29`，仅 2 条成功。这类需人工批准，但从未有过批准动作——等于反思不断往一个没人看的队列里堆委派。应纳入方案 B 的 TTL（失败 2 次即阻断同类，沿用 governor 的 Stop-Loss 口径）。
- **19 条畸形 action 行**：`requires_approval`/`execution_mode`/`state` 全空，疑与 Bug A 的 `created_at=0` 同一批脏数据，migration 074 一并清理。

### Bug A：`created_at = 0` 脏数据（240 + 106 行）

```
reflection_runs   : 239 行 created_at=0，1 行 =914108725(1998-12)，全部 continuous_reflection/heartbeat
proposed_actions  : 106 行 created_at=0
```

根因是 `??` 不拦 `0`：

```ts
const createdAt = input.createdAt ?? now();   // ReflectionThreadRepository.ts:690
```

调用方传进 `createdAt: 0`（上游某处被默认成 0）时，`??` 放行，直接写库。同一反模式在 `repositories/` 下约 **20 处**（`ReflectionThreadRepository:690/762/831`、`ActionRepository:290`、`ConfirmRequestRepository:733`、`AnswerMemoryRepository:172/276/335/381`、`ActionResultRepository:70` 等）。

影响：这些行在任何按月/按窗口的统计里都会落到 1970-01，污染成本归因和 ROI 度量。

### Bug B：`closeThread` 没有自动调用方

[ReflectionThreadService.ts:1402](../../memory-service/src/core/ReflectionThreadService.ts:1402) 的 `closeThread` 全库只有一个调用方：手工 HTTP 路由 [routes/reflectionThreads.ts:98](../../memory-service/src/routes/reflectionThreads.ts:98)。**反思循环自己永不关闭线程。** 所以清理前 901 条里只有 2 条 closed，那 2 条还是人工关的。这次积压不是偶然，是结构必然。

### 现有的两道闸为什么没拦住

2026-08 事故后加了两道闸，方向对但粒度不够：

1. `REFLECTION_IDLE_PAUSE_DAYS`（默认 7，[ReflectionPlanner.ts:145-186](../../memory-service/src/core/ReflectionPlanner.ts:145)）——**用户级**：全局无新消息才暂停。esone.qiu 消息很多，899 条线程照跑。
2. `getHeartbeatBlockingReason()`——只在**下游有未决产物**（pending confirm / outreach / action）时阻塞，不看"这条线程有没有新证据"。

缺的正是**线程级 × 证据级**的那道闸。

---

## 方案

### A. 前置证据闸（P0，最大收益）

把判断挪到 LLM 之前。在 `runReflection()` 调 `worker.generate()` 前插入一次纯本地检查（零 LLM 成本）：

```ts
// ReflectionThreadService.runReflection()，worker.generate() 之前
const preflight = this.evaluateReflectionPreflight(thread, { triggerType });
if (preflight.decision === 'skip') {
  this.repo.updateThreadProgressMarker(thread.id, {
    nextReflectionAt: now() + preflight.backoffSeconds,
    continueReason: preflight.reasonCode,
  });
  this.recordSkippedRun(thread.id, preflight);   // 计入 analytics，不写 reflection_runs
  return null;
}
```

`evaluateReflectionPreflight` 的判据（全部读现有表，无 LLM）：

| 判据 | 数据来源 | 决策 |
|---|---|---|
| 自 `last_reflected_at` 后无新关联证据 | `topic_memory_links` / `messages_raw.created_at` | `skip` + 退避 |
| 主出口合约为 `parked_until_new_evidence` | `open_question_exit_contracts.state` | `skip` + 长退避 |
| 主出口合约为 `handoff_to_evidence_watch` | 同上 | `skip`，交由 `resumeForEvidenceWatch` 唤醒 |
| 已有 blocking reason | 现有 `getHeartbeatBlockingReason` | `skip`（沿用现状，但改为退避而非平坦） |

**这一条单独就能把 AGT 那类 419 次压到个位数**，且不需要新表。

### B. 退避 + 出口（P0）

`nextReflectionAt` 改成函数。新增线程字段（复用已有 `metadata_json`，避免加列）：

```ts
type ReflectionThreadMeta = {
  noNewEvidenceStreak: number;   // 连续无新证据次数
  lastEvidenceRef?: string;      // 上次参与反思的最新证据指纹
  parkedUntil?: number;
};
```

退避曲线（沿用 governor plan 的 Stop-Loss 口径，落成代码）：

| 连续无新证据 | 下次反思 | 说明 |
|---|---|---|
| 0（有新证据） | `now + heartbeat` | 与现状一致 |
| 1-2 | `now + heartbeat × 2^streak` | 30min / 60min |
| 3 | `now + 24h` | governor 的「3 次降级 weekly digest」 |
| 5 | `now + 14d`，state → `parked` | governor 的「5 次暂停 14 天」 |
| streak ≥5 且 `source_type` 有 TTL | `closeThread(reason)` | 见下表 |

**自动关闭 TTL**（补上 Bug B 的缺口，给循环装出口）：

| source_type | TTL（无命中即关） | 理由 |
|---|---|---|
| `entity_property` | 30 天 | 事实跟进；属性本体仍在 entities 表，关线程不丢信息 |
| `confirm_request` | 问题的 `expires_at`，缺省 30 天 | 已有 96 条过期 confirm 说明这类天然有期限 |
| `message` / `dream` / `profile_item` | **不自动关** | 真正的经验提炼，只退避不关闭 |

关闭时写 `closure_reason`，并保持 `resumeThread()` 可恢复（governor 的 Resume Triggers 全部沿用：用户在 Ask/Lens/Today Pilot 问到、Freshness 检测到来源变化、新证据提到同一 entity、用户手动恢复、上游工具恢复可用）。

### C. 入口收紧 + topic 去重（P1）

0. **静态身份字段禁止建线程**（新增，由 2026-09-11 清理查明的事故残留直接推出）：`profile_item` 入口（[:753](../../memory-service/src/core/ReflectionThreadService.ts:753)）对 `name` / `timezone` / `language_preference` 这类**本质不变或变了也无需反思**的字段直接不建线程。这批线程在 8 个账号上空转了最高 291 次，反思"用户叫什么名字"不可能有产出。建议做成白名单而非黑名单：`profile_item` 只有在字段属于「可演化且影响决策」集合（如 `working_hours`、`current_projects`、`communication_preference`）时才允许建线程。

1. **建线程需要退出条件**：`upsertThread` 入参增加必填的 `exitCriteria: { evidenceSignal: string; ttlDays: number }`。填不出来的（"是否有尚未披露的计划？"）不建线程，降级为一条免费的 fact-change event。
2. **`entity_property` 默认不建线程**：只记 fact-change event；仅当①该 entity 与用户活跃项目关联，或②用户近 14 天主动问过该 entity 时，才升级为线程。
3. **建线程前语义去重**：复用 `OpenQuestionExitContractService` 已有的 `questionTokens` + Jaccard，对 active 线程做相似度检索，命中阈值即 merge 到既有线程（记 `merged_into`）。
4. **实体名归一化**：中英别名表（`Google Sheets`/`Google 表格`、`微软`/`Microsoft`）复用 `user_identity_aliases` 的同类机制，消除同义线程。

### D. 监控 / 反思架构拆分（P1，本 plan 的架构主张）

核心判断：**"某个 ticket 状态会不会变"是监控，不是反思。** 监控不需要 LLM 定期跑，只需要新证据到达时被动触发。

好消息是被动监控这条线**已经落地**：`EvidenceWatchContractService` + `evidence_watch_contracts/runs/links`，而且已有 118 条出口合约 `handoff_to_evidence_watch`。所以这不是新建基建，而是**改默认归属**：

```
现状： entity_property 变化 → 建 reflection_thread（LLM 轮询）→ 有时才移交 evidence watch
目标： entity_property 变化 → evidence_watch_contract（被动等证据，零 LLM）
                              └─ 仅当证据到达且与用户决策相关 → 才唤醒一次 reflection run
```

落地步骤：

1. `ReflectionThreadService` 里创建 `entity_property` 线程的入口**只有一处**（[:712](../../memory-service/src/core/ReflectionThreadService.ts:712)，block 起于 `:700` 一带），改为默认产出 evidence watch contract——改动面比预想更小。五类 source 的建线程入口分别在 `:611` confirm_request、`:666` message、`:712` entity_property、`:753` profile_item、`:792` dream。
2. 反思只保留三类 source：`message`（实体反思／经验提炼）、`dream`、`profile_item`——即本次清理**保留下来的那 8 条**的形态。
3. 存量迁移：把 `entity_property` 的 active 线程转成 evidence watch contract（保留 `thread_id` 反向链，可回滚）。
4. 边界写进 `docs/features/`：**reflection 回答"我从自己的决策里学到了什么"；evidence watch 回答"外面那件事变了没有"**。

> 归属对齐：`memory-freshness-radar-plan.md` 拥有"来源变化检测"，`EvidenceWatchContractService` 是它落地的一半。本 plan 不动检测逻辑，只把 `entity_property` 的**默认入口**从 reflection 挪到 watch。两边的分界线是「谁拥有验证责任」，正好复用出口合约已有的 `evidence_watch_owns_verification` reason code。

### E. Bug 修复（P0）

**E1 — 时间戳兜底**。新增 `resolveTimestamp()` 并替换约 20 处 `?? now()`：

```ts
// utils/time.ts
export function resolveTimestamp(input: number | null | undefined): number {
  return Number.isFinite(input) && (input as number) > 0 ? (input as number) : now();
}
```

**E2 — DB 层护栏**。`migrations/074_timestamp_guards.sql`：回填脏行 + 加 CHECK 约束，让同类 bug 以后写不进来。

```sql
-- 回填：用同线程相邻 run 的时间，兜底用线程 created_at
UPDATE reflection_runs SET created_at = (
  SELECT COALESCE(
    (SELECT MIN(r2.created_at) FROM reflection_runs r2
      WHERE r2.thread_id = reflection_runs.thread_id AND r2.created_at > 0),
    (SELECT t.created_at FROM reflection_threads t WHERE t.id = reflection_runs.thread_id)
  )
) WHERE created_at <= 0 OR created_at < 1600000000;

UPDATE proposed_actions SET created_at = (
  SELECT COALESCE(
    (SELECT t.created_at FROM reflection_threads t WHERE t.id = proposed_actions.thread_id),
    strftime('%s','now')
  )
) WHERE created_at <= 0 OR created_at < 1600000000;
-- CHECK 约束需 12-step table rebuild（SQLite 不支持 ADD CONSTRAINT），
-- 参照 073_fix_fts_content_column.sql 的重建范式
```

**E3 — 卡死的 OpenClaw 委派与畸形行**（原 `approved_at` 待定项已查清为设计行为，见根因 5 附带结论）：

- 68 条 `delegate_openclaw` 永久 pending（39 queued + 29 failed，仅 2 成功）。需要一条出口：失败 2 次即阻断同类委派并提示能力缺口（governor Stop-Loss 原文规则），queued 超 TTL 未获批准即过期关闭。
- 19 条 `requires_approval`/`execution_mode`/`state` 全空的畸形 action 行，与 `created_at=0` 同批，migration 074 一并处理（要么补全默认值，要么标记 `dead_letter`）。

### F. ROI 可观测（P2，接进既有 analytics）

不新建页面。在 `docs/features/usage_analytics.md`「成本治理与 2026-08 事故复盘」下新增一组反思指标，数据来自 `AnalyticsStore` 既有后台打点：

| 指标 | 定义 | 健康线 |
|---|---|---|
| `reflection.skip_rate` | 前置闸拦掉的 / 总应跑 | 上线后应 >60% |
| `reflection.novel_discovery_rate` | 产生**新** discovery 的 run 占比（与上次 summary 相似度 <0.8） | 基线未知，先观测；<10% 触发告警 |
| `reflection.cost_per_artifact` | 反思 token 成本 / `reflection_artifacts` 增量 | 现状≈5521 run/23 artifact，改造后应降一个数量级 |
| `reflection.thread_close_rate` | 自动关闭 / 新建 | 应趋近 1（只进不出即为回归） |
| `reflection.starvation_p95` | 线程从创建到首次 run 的 p95 延迟 | 现状 = ∞（665 条从未跑）；目标 <24h |
| **`reflection.notify_ctr`** | `notification_records` 中反思来源的 `clicked_at` / `sent_at` | **现状 0.09%（2176→2）**；这是最终价值指标，低于 2% 说明产出形态仍然无用 |

两个指标口径要点：

- `novel_discovery_rate` 是对根因 5 的直接回应——**把"确认了没有变化"从 discovery 里剔除**。
- `notify_ctr` 取代原先设想的"批准率"（`approved_at` 恒空是设计使然，见根因 5 附带结论）。它是唯一能证伪"反思到底有没有用"的指标：**如果改造后调度成本降了 60% 但 CTR 还是 0.09%，那说明该砍的不是轮询频率，而是这类产出本身**——届时应直接执行方案 D 的彻底版（事实跟进完全退出用户通知通道，只在用户主动查询时按需回答）。

并在 `tools/eval-usage-analytics-guardrails.mjs` 增加一条断言：若 `thread_close_rate < 0.5` 持续 7 天则失败（防止"只进不出"悄悄回归）。

---

## 实施切片

| 切片 | 内容 | 依赖 | 规模 |
|---|---|---|---|
| **P0-1** | 方案 A 前置证据闸 + 方案 B 退避曲线 | 无 | 1-1.5 天 |
| **P0-2** | 方案 B 自动关闭 TTL + `closure_reason` + resume 保障 | P0-1 | 0.5 天 |
| **P0-3** | 方案 E1/E2 时间戳兜底 + migration 074 回填 | 无（可并行） | 1 天 |
| **P1-1** | 方案 C 入口退出条件 + topic 去重 + 别名归一 | P0 | 2 天 |
| **P1-2** | 方案 D `entity_property` 默认改归 evidence watch | P1-1；需与 freshness-radar 归属对齐 | 2-3 天 |
| **P1-3** | 方案 D 存量线程迁移（带反向链，可回滚） | P1-2 | 1 天 |
| **P2-1** | 方案 F analytics 指标 + guardrails 断言 | P0 已上线一周有数据 | 1.5 天 |
| **P2-2** | 方案 E3 `approved_at` 结论与后续修复 | 待定项 1 | 0.5-1 天 |

生效范围：**新闸门默认开启**（对所有用户止血，不藏 flag）；退避/TTL 常量走 `runtimeConfig`，可按用户覆盖。

---

## 历史积压清理

### 已执行（esone.qiu，2026-09-11）

已做软归档，非删除：`status='active' → 'closed'`，`closure_reason='stale_backlog_2026_08_cleanup'`，markdown 与底层 entity/property 数据未动，可 `resumeThread()` 恢复。

- 归档 **439** 条：2026-04 创建 × `reflection_count=0` × `source_type IN ('entity_property','confirm_request')`
- 保留 **8** 条：7 条 `message` 实体反思 + `Sophia (Jinmei) Lin · status`（用户指定保留）
- 结果：`active 899→460`，`closed 2→441`

### 已执行（全部账号，2026-09-11，用户已授权）

工具：[`memory-service/tools/cleanup-reflection-backlog.mjs`](../../memory-service/tools/cleanup-reflection-backlog.mjs)（dry-run 默认 / `--apply` / `--rollback`，执行写 JSON 凭证）。

只读报告先揭示了一个**与预期相反的事实**：积压几乎全部集中在 esone.qiu，其余账号 active 线程都只有 0-3 条——但那 0-3 条却各自空转了 200-291 次。所以原定的「never-ran 积压」口径对它们**一条都抓不到**，真正的问题是另一种形态，于是把规则拆成四条：

| 规则 | 口径 | 命中 | 依据 |
|---|---|---|---|
| `R1_static_profile` | `profile_item` 且标题含 name/timezone/language，14 天无活动 | 17 | 2026-08 事故残留（见下） |
| `R2_never_ran_backlog` | `entity_property`/`confirm_request` 且 `reflection_count=0`，创建超 60 天 | 190 | 入口无退出条件的纯积压 |
| `R3_dormant_fact_tracking` | `entity_property` 跑过但休眠超 60 天 | 144 | 事实跟进属监控，休眠即应关闭 |
| `R4_review_only` | `ask`/`message`/`dream` 休眠超 60 天 | 53 | **不归档**，仅列出供人判断 |

结果：**归档 351 条**（10 个账号），保留 53 条待人工判断，1 条用户显式豁免（`Sophia (Jinmei) Lin · status`，已写入工具的 `KEEP_THREAD_IDS` 并附原因，任何规则不得再命中）。

- esone.qiu：active 460 → **146**（剩 `entity_property 57` / `confirm_request 31` / `message 28` / `ask 18` / `dream 12`）
- 其余 9 个账号：active 归零或仅剩 1 条（Alison.Lan 留 1 条 `ask`，交人工判断）
- 回滚已演练：`--rollback` dry-run 精确命中 351 条，且**不误伤**上轮手工归档的 439 条（靠 `closure_reason` 的 `:<ruleId>` 后缀区分）

### 由此查明：2026-08 事故的残留物与真实机制

`usage_analytics.md` 复盘里"一个零前台活动的用户（2 条遗留 active 线程）烧 0.93M tok/周 ≈ $38/月"，这次看清了那 2 条线程到底是什么：

```
画像反思: name       （Quintin.Xiao 291 次、Swain.Zheng 287 次、sophia.lin 220 次、zong.zheng 216 次…）
画像反思: timezone   （同量级）
画像反思: language_preference
```

**系统在反复反思用户自己的姓名和时区**——8 个账号共 17 条，首跑 2026-08-18、末跑 08-24，正好是事故窗口。反思关闭后它们休眠至今，不再烧钱，但仍是 `active` 且 `next_reflection_at` 早已逾期：**任何人重新打开反思，这批线程会立刻重新点火。** 本次已全部归档，同时给方案 C 增加了一条入口硬规则（见下）。

> 注意：P0 上线后新增线程会自动带 TTL 与退避。本次清理已完成，但**若 P0 迟迟不上线，esone.qiu 的积压会以原速长回来**（其余账号因反思默认关闭，暂不会）。

---

## 验证

1. **单测**：`evaluateReflectionPreflight` 的四类判据 × 退避曲线边界（streak 0/1/3/5）；`resolveTimestamp(0)` 必须返回 `now()`
2. **回归**：用 esone.qiu 库快照做离线重放——对 AGT(419)、Remi(380)、NeuBird(367) 三条线程，改造后的调度应分别产生 ≤5 次 run
3. **饥饿验证**：注入 200 条 priority-9 新线程，24h 内首次 run 覆盖率应 >95%（现状 0%）
4. **成本验证**：`node tools/eval-usage-analytics-guardrails.mjs` 新断言 + 上线后 7 天对比反思 token 周消耗（预期降幅 >60%）
5. **eval suite**：沿用 governor plan 已设计的用例目录 `evals/cases/reflection-governor/`，补 `no-new-evidence-backoff`、`parked-contract-must-not-rerun`、`entity-property-routes-to-watch` 三例
6. **数据校验**：migration 074 后 `SELECT count(*) FROM reflection_runs WHERE created_at < 1600000000` 必须为 0

---

## 与既有 plan 的关系

| Plan | 关系 |
|---|---|
| `memory-reflection-governor-plan.md`（搁置） | **本 plan 是它推迟的运行时那一半**。复用其 Utility Score / Stop Loss Rules / Resume Triggers 设计，落成调度代码；不复活巡航页——其搁置结论（治理只做内部诊断）继续有效。需在该文件顶部加指针。 |
| `memory-freshness-radar-plan.md` | 拥有"来源变化检测"，`EvidenceWatchContractService` 是其落地形态。方案 D 只改 `entity_property` 的默认入口归属，不动检测逻辑。**P1-2 启动前需与该 plan 对齐归属边界。** |
| `memory-echo-dampener-plan.md` | 它做 claim 层的 origin-family 折叠（证据计票），本 plan 做 thread 层的 topic 去重（别建重复线程）。同一哲学、不同对象，不冲突；别名归一可共用。 |
| `memory-lifecycle-gardener-plan.md`（Ambient Memory Forgetting） | 同一套衰减哲学（后台自动、不做审批页、降权而非删除）应用到反思线程上。TTL/park 的常量口径应与其保持一致。 |
| `memory-outcome-loop-plan.md` | 方案 F 的 ROI 指标是其"成效账本"在反思域的一个消费端；`confirm_requests` 22% 回答率是现成的负反馈信号，未来应接入其回授闭环给线程打分（本 plan 不做，只留接口）。 |
| `memory-proactivity-cost-asymmetry-plan.md` | 同类"公式级改造"范式。反思线程的 priority 通胀（90% 挤在 0.8-0.9）与其 utility 通胀同源，长期应共用一套打分归一化。 |
| `docs/features/usage_analytics.md` | 方案 F 的落点；2026-08 事故复盘的两道闸（`REFLECTION_DEFAULT_ENABLED`、`REFLECTION_IDLE_PAUSE_DAYS`）是本 plan 的前序工作，本 plan 补的是它们缺的线程级粒度。 |

---

## 风险与边界

1. **退避过猛导致漏掉真实变化**——缓解：退避只作用于"无新证据"，任何新证据到达都立即重置 streak 并唤醒；resume 触发器全部保留。用户主动问到该 topic 时必须立刻可用（走 `resumeForSource`）。
2. **自动关闭误伤**——缓解：`message`/`dream`/`profile_item` 不自动关；关闭是软状态（`closed` + reason），`resumeThread()` 可恢复；所有自动关闭留审计痕迹。
3. **方案 D 跨模块边界**——P1-2 需先与 freshness-radar 归属对齐，未对齐前不动代码。存量迁移保留 `thread_id` 反向链以便回滚。
4. **`novel_discovery_rate` 的相似度阈值需要调参**——先观测两周再定告警线，避免一上线就误报。
5. **多租户影响面**：改动对那台机器上全部 ~20 个真实账号生效。P0 是纯止血（只减少无谓 run），风险低；但仍建议先在 esone.qiu 观察 48h 再让 P1 生效。
6. **不在本 plan 范围**：1485 条自动 executed 的 action 具体产出了什么（需另开一轮 `result_json` 取证，可能是另一处更大的静默烧钱点）。

---

## 待定项（需决策后才动代码）

1. ~~`approved_at` 恒为 0 的语义~~ → **2026-09-11 已查清：设计行为，非 bug**。ROI 改用 `notify_ctr` + confirm 回答率（方案 F 已更新）。附带查出 68 条卡死委派与 19 条畸形行，已并入方案 E3。
2. **`priority` 语义是否重做**：现状 6-10 五档且 90% 集中在高位，等于没打分。要么重新归一化（与 cost-asymmetry plan 共用），要么在排序里彻底降权、改用 `salience × 时间衰减 × 用户互动`。倾向后者，但会改变现有排序行为。
3. ~~批量清理其余账号的执行授权~~ → **2026-09-11 用户已授权全部用户数据改造**。执行记录见"历史积压清理"。

## 悬而未决的根本问题

`notify_ctr = 0.09%` 把一个更大的问题摆上台面：本 plan 的 P0/P1 能把**成本**降一个数量级，但**不能自动让产出变得有用**。如果改造后 CTR 仍无起色，正确结论不是继续优化调度，而是承认"事实跟进"这类内容不该进用户通道——只在用户主动问起时按需回答（方案 D 的彻底版）。

建议把 `notify_ctr` 作为 P2 上线后**两周的验收闸**：达不到 2% 就启动方案 D 彻底版的评估，而不是再做一轮调参。
