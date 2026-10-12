# 新能力：Resident One-pager / 常驻用户一页纸

> 状态：仅规划，待决策。本轮未改任何运行时代码。
> 生成日期：2026-10-09 CST
> 代码核查基线：工作区 `develop` 分支，引用均为 `path:line`。
> Demo：[`memory-resident-one-pager-demo.html`](./memory-resident-one-pager-demo.html)（注入回执视图）
> 来源：E-72 第二轮。对照 Instinct 的四块常驻上下文（identity、~4,250 token memory one-pager、todo 索引、compaction recap）与 Hermes / OpenClaw 的预算化 USER.md。

## 1. 一句话结论

Instinct 每次对话都带着一页约 4k token 的「关于你」的一页纸，而我们每次 /ask 与 Compose 都从零检索。我们缺的不是画像数据（`user_profile_items`、`profile_slots`、`USER_CORE.md`、`RecentFocusService` 都在），而是**一个有预算、有生成时间戳、分段标新鲜度、由睡眠期重生成、按 surface 投影的常驻块**。Instinct 被黑盒指出的缺陷（画像滞后 2 天且不标时间）恰好是我们能做对的点。

## 2. 两个使用场景

### 场景 A：Compose 不知道我是谁

用户在 Glip 回复一条关于 Q4 目标的消息。Compose Assist 检索到三条相关消息，但不知道用户是敏捷教练、Sophia 是直属上级、本周正在赶 OKR 提交。草稿语气像陌生人。

- **After**：one-pager 的 `identity`（角色、团队、时区）与 `active_workstreams`（「Q4 Goal Setting，截止 10/13」）常驻在 Compose 的 system 段；草稿默认带上「我这边 10/13 前会在 WD 提交」。回执显示「依据：一页纸 · 身份段（生成于今晨 03:12）· 进行中事务段（来源 2 条，最新 1 小时前）」。

### 场景 B：/ask 反复问同一类背景

用户每天问「BE 那边 ready 了吗」。每次都要靠 `MemoryContextMatchService` 锁 topic、再四通道检索。

- **After**：one-pager 的 `open_loops` 段常驻「MTR-141852 等 BE 设计确认（最后更新 10/07）」；/ask 在检索前已有锚点，短指代直接命中；深车道不触发。

## 3. 现状（代码事实）

| 已有 | 位置 | 缺口 |
|---|---|---|
| `USER_CORE.md` 由 P3.5 Profile 阶段重建 | `ConsolidationEngine.ts:696-815` | 文件视图，不常驻 prompt；`agent-task-ledger-plan.md` §13.5 记录其长期近乎空白（`user_profile_items` 仅 3 行） |
| `RecentFocusService` / `renderActiveFocusDigest`（salience ≥ 0.35，14 天窗） | `RecentFocusService.ts` | frontier index QW-1 建议抽成 `getRecentFocusBlock(tokenBudget)`，尚未成为标准注入块 |
| `ContextPackService` scope `identity_preferences / recent_focus / today / projects` | `ContextPackService.ts:1-10` | 只读、按需、面向外部 AI；不是内部每次调用的常驻块 |
| `PersonaProjectionService` 保证 USER_CORE 原文不外吐 | `PersonaProjectionService.ts` | 投影逻辑可复用 |
| `profile_slots`（v3 T0 ≤ 40 slot 设计） | migration 070–072；foundation §6.6 / §8.3 | 表在，供给未复活 |
| `AnticipationService` 夜间预答 ≤ 8 条 | `AnticipationService.ts:57-205` | 只给 /ask 短路，不进常驻块 |
| Instinct 侧对照 | Supermemory 黑盒（2026-09-20） | one-pager ~4,250 token、每日更新、无时间戳、滞后最多 2 天 |

## 4. 方案

### 4.1 one-pager 结构（总预算 3,000 token，可配）

| 段 | 预算 | 来源 | 刷新 | 可见规则 |
|---|---|---|---|---|
| `identity` | 300 | `profile_slots` 中 user_confirmed 的角色 / 团队 / 时区 / 称呼 / 语言 | 变更即刷 | 所有 surface |
| `preferences` | 500 | confirmed 偏好 + 睡眠期 D 阶段 proposal（标 `provisional`） | 每晚 | Ask / Compose；Passive 只用 confirmed |
| `people` | 400 | 关系雷达中高频协作者、上级、直接汇报 | 每晚 | Compose 用于语气与称呼；不含敏感字段 |
| `active_workstreams` | 800 | watched projects + 近 14 天 salience ≥ 0.35 的主题（QW-1） | 每晚 + 事件触发 | 所有 surface |
| `open_loops` | 600 | attention ledger 中 open 的等待项 / 截止项（见 `memory-attention-triage-plan.md`） | 事件触发 | Ask / Compose / Day Pilot |
| `recent_corrections` | 200 | Teach Once / Lexicon 的 scoped 纠正 | 变更即刷 | 所有 surface |
| `meta` | 100 | 每段 `generated_at`、`source_count`、`staleness`、`budget_used` | 每次渲染 | 回执显示 |

### 4.2 生成与注入

- **生成**：睡眠期 D 阶段（见 sleep-time-reconciliation plan）用 smart 模型生成 `preferences` / `people` 的叙述段，其余段为确定性渲染；写入 `user_one_pager(version, generated_at, sections_json, token_count)`，保留最近 7 版。
- **事件刷新**：`open_loops`、`active_workstreams`、`recent_corrections` 为确定性段，由对应服务写入时增量刷新，不等夜间。
- **注入**：`RecallEngine` 之前，由 `OnePagerProjectionService.render(surface, budget)` 产出 system 段；Passive 面只注入 `identity` + `open_loops`（≤ 400 token，无 LLM）；Ask / Compose 注入全部。
- **frozen snapshot**：同一会话内快照不变（保 prefix cache，Hermes 做法）；新会话取最新版。
- **时间戳**：每段带 `generated_at`，超过 48 小时未刷新的段在回执中标 `stale`，Compose 不默认引用 stale 的 `preferences`。

### 4.3 用户可见与可控

- Memory Exploring 新增「一页纸」页签：按段展示、显示生成时间与来源数、每条可「不再放进一页纸」（写 `one_pager_exclusions`，即时生效，可撤销）。
- Compose / Ask 回执新增「依据一页纸 · N 段」行；点击展开段与来源。
- 用户直接编辑 `identity` 段 = user_confirmed 写入 `profile_slots`（durable identity 必须用户确认，foundation §6.6）。

### 4.4 与既有 plan 的关系

| plan | 关系 |
|---|---|
| `memory-frontier-2026-index.md` QW-1 | 本方案是 QW-1「近期重点注入块」的扩展版；QW-1 可先作为 `active_workstreams` 段落地 |
| `agent-task-ledger-plan.md` §13.5–13.6 | 复用「复活画像供给」P0-4；`USER_CORE.md` 退为 one-pager 的 Markdown 视图 |
| `memory-like-humen-persona.md` §3–4 | 三层画像（Core / Extended / Policy）即本方案的 `identity+preferences` / 来源 / 投影规则 |
| `memory-foundation-rearchitecture-plan.md` §6.6 / §8.3 / §10 | 遵守 durable 必须确认、T0 ≤ 40 slot；不做「固定数量 core slots」的硬约束，用 token 预算替代 |
| `ai-context-passport-plan.md` / `ContextPackService` | 对外导出继续走 ContextPack；one-pager 是其内部输入之一，经 `PersonaProjectionService` 投影 |
| `memory-write-provenance-gate-plan.md` | 只有 `promotion_eligible=true` 的 unit 能进 one-pager |
| `memory-attention-triage-plan.md` | `open_loops` 段的数据来源 |

### 4.5 明确不做

- 不把 one-pager 写成模型状态或微调；它是文件 / 数据（persona 研究结论）。
- 不让 LLM 一次猜测进入 `identity`；provisional 只在 `preferences` 段并标注。
- 不向 Composer 之外的外部目的地直接导出 one-pager 原文（egress 走 ContextPack）。
- 不做用户手工维护的「个人资料表单」作为主入口；主入口是睡眠期供给 + 可撤销排除。

## 5. 数据契约

- `user_one_pager(id, user_id, version, generated_at, sections_json, token_count, model_version)`。
- `one_pager_exclusions(user_id, unit_id | slot_id, excluded_at, reason)`。
- `OnePagerProjectionService.render(surface: 'passive'|'ask'|'compose'|'daypilot', budget: number) → { systemBlock, receipt: { sections: [{ name, generated_at, source_count, staleness, tokens }] } }`。

## 6. 实施阶段

| 阶段 | 内容 | 天数 | 门槛 |
|---|---|---|---|
| Phase 0 | 落 QW-1：`getRecentFocusBlock(tokenBudget)` 注入 /ask 与 quick-ask，开关 `injection.recentFocusEnabled` | 1 | /ask 上下文命中率不降 |
| Phase 1 | `user_one_pager` 表 + 确定性段（identity / workstreams / open_loops / corrections）+ 回执 | 4 | 回执在 Ask / Compose 可见 |
| Phase 2 | 睡眠期 D 阶段生成 preferences / people 段；frozen snapshot | 3 | 每晚 1 次 smart 调用；stale 标记正确 |
| Phase 3 | Memory Exploring 一页纸页签 + 排除 | 3 | 排除即时生效可撤销 |
| Phase 4 | Passive 注入（≤ 400 token，无 LLM） | 2 | Passive p95 不增加 > 30ms |

## 7. Evals（上线门槛）

新增 `memory-service/evals/resident-one-pager/`：

| case 组 | 最少条数 | 门槛 |
|---|---|---|
| Compose 语气 / 身份一致性（有 vs 无 one-pager） | 15 | LLM-judge 偏好 one-pager 版 ≥ 70% |
| /ask 短指代命中（场景 B） | 15 | 深车道触发率下降 ≥ 30% |
| stale 段不被引用 | 10 | 违规 0 |
| 排除即时生效 | 10 | 违规 0 |
| 预算 | 全部 | 每 surface 不超预算；Passive 0 LLM |

## 8. 风险与缓解

- **一页纸写错比没有更糟**：provisional 标注 + 回执可点 + 一键排除；identity 只收确认值。
- **prefix cache 与新鲜度冲突**：会话内冻结、会话间刷新；事件段用追加而非改写。
- **画像供给仍空白**：Phase 0/1 用确定性段先产出价值，不依赖 LLM 供给复活。

## 9. 可观测性与回滚

- 指标：每 surface 注入 token、各段 staleness 分布、排除次数、回执点击率。
- Flag：`ONE_PAGER_ENABLED`、`ONE_PAGER_BUDGET_TOKENS`、`ONE_PAGER_PASSIVE_ENABLED`。
- 回滚：关 flag 即回到纯检索。

## 10. Demo 说明

`memory-resident-one-pager-demo.html` 模拟 Compose Assist 的回执面板与 Memory Exploring 的一页纸页签：展示各段、生成时间、stale 标记、排除交互。数据为场景 A 的示例，不含真实敏感信息。

## 11. 文档交接

实现后并入 `docs/features/user_profile_system.md`（新增「常驻一页纸」节）与 `docs/features/assist.md`（Compose 回执），更新 `docs/index.md`，删除本 plan，demo 移至 `docs/demo/`。

## 12. 推荐决策

先做 Phase 0（QW-1，一天）与 Phase 1 的确定性段，立刻可见；LLM 段等 `memory-sleep-time-reconciliation-plan.md` 的 D 阶段一起上。
