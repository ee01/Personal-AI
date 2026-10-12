# 新能力：Write Provenance Gate / 写入侧来源闭集与回路防护

> 状态：仅规划，待决策。本轮未改任何运行时代码。
> 生成日期：2026-10-09 CST
> 代码核查基线：工作区 `develop` 分支，引用均为 `path:line`。
> Demo：无。纯后台写入治理，用真实数据 before/after 代替界面 demo。
> 来源：E-72 第二轮。对照 OpenClaw memory-core 的「写入路径就是安全边界」与 Instinct 的「入站 firewall + 动作 monitor 与 agent 解耦」。

## 1. 一句话结论

我们已经有 `trust_class`（trusted / internal / untrusted）、注入标记、句级 claim attribution 和 `evidence_class` 五值闭集，但缺三件 OpenClaw 已经写进默认值的事：**(1) 后台会话（heartbeat / cron / 子代理 / 反思）产出的内容不得成为 durable 候选；(2) 被召回注入到 prompt 的内容必须带结构标记，永不被再次抽取成新记忆；(3) 网络来源污染在同一轮内传播到之后的所有 assistant 输出。** 这三条都是确定性规则，零 LLM，直接堵住「派生物自我强化」与「心跳噪音进画像」两类已登记风险。

## 2. 两个使用场景

### 场景 A：心跳把自己的话记成了用户的话

Heartbeat 每 15 分钟跑一次，会生成 `notification_records` 与 watched project 的「N new messages」摘要。Reflection（若开启）会写 `reflection_artifacts`。这些文本一旦被任何路径再 ingest 或被 P5 reindex 成 chunk，就会以 `sender=system` 或空 sender 的形态进入召回；v3 shadow 又曾按「有 sender 就算 self_statement」归类（reviewed plan F11）。

- **Before**：2026-08 事故里 `zong.zheng` 心跳 595 次研究尝试，产物反复进入线程；899 条 active thread 中 665 条从未反思却持续存在。
- **After**：所有由 `session_kind ∈ {heartbeat, cron, subagent, reflection, dream}` 产生的 episode 落库时带 `origin_class=system`，`promotion_eligible=false`；它们可以被搜到、可以做任务产物，但永远不进 profile / truth / one-pager / attention 候选。

### 场景 B：召回一百次，事实还是一条

/ask 把三条记忆注入上下文，LLM 回答里复述了其中一条；OnlineReflection 或 Compose 的草稿又把这段话送回 ingest（`source_type=ai_chat`）。

- **Before**：同一事实以 AI 复述的形态再次入库，`evidence_class` 变成 `system_inference` 或被误判 `self_statement`，salience 被「多来源」加分。
- **After**：注入 prompt 的记忆段带 `<recalled id=...>` 结构标记；ingest 看到标记直接 `origin_class=agent`、`derived_from=[ids]`、不加 salience、不生成新 unit，只写 `memory_exposures`（I9：exposure ≠ confirmation）。

## 3. 现状（代码事实）

| 已有 | 位置 | 缺口 |
|---|---|---|
| `classifyTrust()` 三级 trust_class、`screenForInjection()` 只打标不删改 | `memory-service/src/core/injectionScreen.ts:1-20` | 分类按 **source type**，不按 **session kind**；心跳 / 反思产物不是 untrusted 也不是 system |
| 句级 claim attribution（self / other / ai_agent，引用 / 转述 / 假设） | `MemoryClaimAttributionService.ts`，`IngestionPipeline.ts:499-525` | 规则层，无 LLM；但 v3 ExtractionWorker 曾绕过它（reviewed F11） |
| `evidence_class` 五值闭集、I3「LLM 不能提权」 | foundation plan §4.3 / §4.2 | 闭集在 source row 轴；没有 `origin_class` 表达「谁产生了这段文本」 |
| flagged 证据强制 `manual_confirm` | `ActionReadinessService.ts`；`memory-injection-defense-plan.md` | 只管动作链，不管写入 durable |
| P5 reindex 已排除 `reflections/`、`dreams/` 目录 | `ConsolidationEngine.ts:891-896` | 只排除了两个目录；`daily/`、`projects/` 仍由 LLM 摘要生成后重新 chunk 进召回 |
| `memory_exposures` 表（v3） | migration 070–072 | 已有表，写入方不完整 |
| OnlineReflection `newFacts` 置空，只写 pending_confirm 偏好 | `OnlineReflection.ts:160-164` | 好的局部决定，但未成为全局规则 |

## 4. 方案

### 4.1 origin_class 闭集（写入时确定，LLM 不可改）

| origin_class | 来源 | promotion_eligible | 进 one-pager | 进 attention 候选 |
|---|---|---|---|---|
| `owner` | 用户在可信渠道亲自输入 / 发送（Glip 自己发的消息、手动记住、Jira 自己的评论） | 是 | 是 | 是 |
| `observed` | 用户看到的他人内容（Glip 他人消息、会议转写、日历）；配合 claim attribution 的 other-owner | 是（作为 third_party / first_party_record） | 经 attribution 过滤 | 是 |
| `agent` | 由本系统 LLM 从 owner / observed 派生（摘要、insight、one-pager、AI 回答） | 否（只能作 derived，带 expiry） | 只作输入不作来源 | 否 |
| `untrusted` | 网页、外部 AI 输出、OpenClaw / 委派结果、外部邮件 | 否，除非用户显式确认 | 否 | 仅可生成「待核」提示 |
| `system` | heartbeat / cron / subagent / reflection / dream 会话产物、脚手架 | 否 | 否 | 否 |

无法判定时：外部来源 → `untrusted`；内部脚手架 → `system`；**永不默认为 `owner`**。

### 4.2 session_kind 门控

`ingest` / `ingestBatch` 请求与所有内部写入都带 `session_kind ∈ {interactive, heartbeat, cron, subagent, reflection, dream, import}`。除 `interactive` 与 `import` 外，一律 `promotion_eligible=false`。`ProactiveScheduler`、`HeartbeatLoop`、`ReflectionWorker`、`GenerativeReplay` 的写入统一走一个 `SystemWriteContext`，不能漏。

### 4.3 召回回路防护

- `RecallEngine` / `ContextPackService` / Compose 注入的每段记忆外包 `<recalled id="unit:123" exposure="...">`，并同步写 `memory_exposures`。
- `IngestionPipeline` 第 2 步（注入筛查之后）检测该标记：命中则 `origin_class=agent`、`derived_from` 填 id、跳过抽取与 salience 加分、不建新 unit。
- `SalienceScorer` 的「多来源加分」只接受不同 `EvidenceOriginFamily`（对齐 `memory-echo-dampener-plan.md`）。

### 4.4 同轮污染传播

与 OpenClaw 的 turn taint 一致：一轮内只要有工具结果声明为网络来源（`web_fetch`、OpenClaw 委派、外部 AI），之后该轮所有 assistant 输出写入时 `origin_class` 降为 `untrusted`；下一条用户消息清除。覆盖面取决于工具是否声明，未声明的本地读取不污染。

### 4.5 与既有 plan 的关系

| plan | 关系 |
|---|---|
| `memory-injection-defense-plan.md` | 本方案是其第二层：trust_class 管「内容像不像指令」，origin_class 管「文本是谁产生的」，两轴正交 |
| `memory-foundation-rearchitecture-plan.md` §4.3 / I3 / §8.2 | 复用 `evidence_class`；`origin_class` 落在 source row 旁；§8.2「反思不再整篇回灌」推广为规则 |
| `memory-foundation-rearchitecture-reviewed-plan.md` F7 / F11 | 修 F11：v3 写侧必须经 `MemoryClaimEnvelope`，且 `sender` 非空不得推 self_statement |
| `memory-echo-dampener-plan.md` | 本方案提供其需要的 `derived_from` 父指针，连接器不再事后猜 |
| `memory-sleep-time-reconciliation-plan.md` | 睡眠期阶段 B / C 只处理 `promotion_eligible=true` 的 unit |
| `memory-claim_attribution`（`docs/features/memory_claim_attribution.md`） | 不改其语义；attribution 继续在 `observed` 内部区分 self / other |

### 4.6 明确不做

- 不做内容级「坏记忆检测器」；OpenClaw 的经验与我们的 injection plan 一致：写入时结构门控优于事后扫描。
- 不删任何已入库内容；回填只改 `origin_class` 与 `promotion_eligible`。
- 不为 origin_class 引入 LLM 判断。

## 5. 数据契约

- `messages_raw` / `memory_unit_sources` 新增列：`origin_class TEXT CHECK IN (...)`、`session_kind TEXT`、`promotion_eligible INTEGER`、`derived_from_json TEXT`。
- 回填脚本：按 `source_type` 与 `sender`、`metadata_json.session_kind` 保守映射；无法判定的历史行按 §4.1 兜底规则。
- `memory_exposures` 新增 `surface`、`turn_id`，供回路检测与 I9 审计。

## 6. 实施阶段

| 阶段 | 内容 | 天数 | 门槛 |
|---|---|---|---|
| Phase 0 | 只读统计：现库中由 system / agent 产生却进了 profile、truth、chunks 召回的行数；reflection / heartbeat 产物被再 ingest 的次数 | 1 | 数字进本 plan |
| Phase 1 | 列与回填 + `SystemWriteContext` 贯穿所有后台写入 | 3 | 后台写入 100% 带 session_kind |
| Phase 2 | 召回标记 + ingest 检测 + exposures 写入 | 3 | 回放 /ask → compose → ingest 链 0 条新 unit |
| Phase 3 | 睡眠期 / profile / one-pager / attention 候选全部按 `promotion_eligible` 过滤 | 2 | eval 通过 |
| Phase 4 | turn taint（依赖工具声明网络来源） | 2 | 委派结果写入 100% untrusted |

## 7. Evals（上线门槛）

新增 `memory-service/evals/write-provenance-gate/`：

| case 组 | 最少条数 | 门槛 |
|---|---|---|
| heartbeat / cron / reflection 产物不进 durable | 10 | 违规 0 |
| 召回 → 复述 → 回灌不产新 unit | 10 | 新 unit 0；exposures +N |
| 多来源加分只认独立来源 | 10 | 同族来源 salience 增量 0 |
| 外部结果同轮污染 | 6 | 后续 assistant 写入 100% untrusted |
| 历史回填不误伤 owner 内容 | 抽样 100 行 | 误标 ≤ 2% |

纳入 `eval:memory-abilities` 回归门。

## 8. 风险与缓解

- **回填把真实用户输入标成 system**：回填只用确定性字段，不确定的保留 null 并列入人工抽样；`owner` 永不由兜底规则产生，只由明确渠道产生。
- **标记外泄到外部 AI**：`<recalled>` 标记只在内部 prompt 使用；ContextPack 对外导出前剥离标记，`redactionReceipt` 记录。
- **工具未声明网络来源导致漏污染**：登记为已知缺口，与 OpenClaw 相同；后续在委派框架层统一声明。

## 9. 可观测性与回滚

- 指标：各 origin_class 写入量、被拒 promotion 数、回路命中数、taint 触发数。
- Flag：`WRITE_ORIGIN_GATE_ENABLED`、`RECALL_LOOP_GUARD_ENABLED`、`TURN_TAINT_ENABLED`。
- 回滚：关 flag 恢复旧行为；新增列保留不影响旧路径。

## 10. 文档交接

实现后并入 `docs/features/memory_claim_attribution.md`（新增「来源闭集与会话门控」节）与 `docs/features/memory_foundation.md`（安全与隐私硬门），更新 `docs/index.md`，删除本 plan。

## 11. 推荐决策

Phase 0 + Phase 1 可独立于 v3 切换先做（四天，零 LLM），并且是 `memory-sleep-time-reconciliation-plan.md` 与 `memory-resident-one-pager-plan.md` 的前置：没有 `promotion_eligible`，睡眠期判决与 one-pager 都会把心跳噪音当成事实。
