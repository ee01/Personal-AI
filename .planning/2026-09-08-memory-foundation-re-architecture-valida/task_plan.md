# Task Plan — Memory Foundation Re-architecture：校验 + 逐步执行

## Goal

1. 校验 canonical plan（docs/progressing/memory-foundation-rearchitecture-plan.md）方案有效性；
2. 验收 Cursor 会话完成的 memory-index-backfill 工作；
3. 按 plan 顺序逐步执行可落地阶段（R0 → P0a → …），每步带测试/eval 校验；
4. 为 recall/write path 变更跑 memory-abilities 回归，并补 supply evals。

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | 读 plan 文档 + 仓库现状 + 生产库只读验收（A1/A2/Tier1/Tier2/B1/P0a 项） | complete |
| 2 | R0 evidence manifest | complete（并入验收，见 Session 1 findings） |
| 3 | P0a-1 供给解耦 + flag | complete |
| 4 | P0a-4 rehearsal hour-bucket upsert | in_progress |
| 5 | P0a-2/3/5 metadata 契约、EmbeddingClient readiness、空反思/Runs 阻断 | pending |
| 6 | P0a-6 supply metrics/diagnostics | pending |
| 7 | 本地测试 + evals | pending |
| 8 | 部署 + Tier 3 验证 | complete（D1 已批准） |
| 9 | P0b 运行保障 + 预授权数据修复 | in_progress |
| 10 | P0c 后续 | in_progress |

## Decisions（待用户裁决）

| # | 问题 | 选项 |
|---|---|---|
| D1 | P0a 代码修好后是否立即 deploy 到 10.32.56.212 并补跑回填？ | a) 修完+本地测试过就部署止血（推荐，断供每天在扩大）b) 只提交代码，部署由你手动执行 |
| D2 | Tier 2 实体回填已被 Cursor 执行（plan 规定等 P1） | a) 接受现状不回滚（推荐）b) 其他处理 |
| D3 | rehearsal 195 万行历史清理（P0b 预授权） | a) 本轮先不做，等 P0a 稳定（推荐）b) 一起做 |
| D4 | memory-abilities eval 端点 | a) 本地起分支服务跑（不污染线上基线）b) deploy 后对线上跑（覆盖 .baseline） |
| D5 | FTS integrity-check / 后续写入型验证需要维护窗 | 自动择低峰执行 or 用户指定窗口 |

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| ssh 后 docker 不在 PATH | `docker ps` | 用绝对路径 `/usr/local/bin/docker` |
| 只读连接跑 FTS integrity-check 报 SQLITE_READONLY | read-only 容器内 node -e | 待维护窗/部署后执行；只读部分已用其他查询替代 |
| sqlite-vec vec0 模块未加载 | 直接 prepare('SELECT ... chunks_vec') | createRequire + loadExtension 后成功 |

## Session 3-8 增补阶段

| # | Phase | Status |
|---|---|---|
| 11 | P0.5 消融（e5-small +16.9pp CI[10.4,24.0]、trigram +5.2pp CI[2.0,9.1]） | complete |
| 12 | P1 slice 1 v3 truth core（migration 070 + UnitTruthMaintainer） | complete |
| 13 | P1 slice 2 ExtractionWorker（strict contract + 冻结批次 + DLQ） | complete |
| 14 | P1 全员 shadow 上线（cheap 档 + 预算 $10 + usage 归因） | complete（生产验证） |
| 15 | 网页分析后端门（WEBPAGE_ANALYSIS_VIA_LOCAL_KEY 默认关） | complete（生产验证） |
| 16 | 观察期数据采集（safe-mode shadow / v3 shadow lineage / 预算曲线） | in_progress |

## Session 10 — P2 剩余 + P3 + P4 + 文档（用户授权全做）

| # | Phase | Status |
|---|---|---|
| 17 | P2: Ask/Compose/Passive surface flags + 非劣门 eval harness | pending |
| 18 | P3: 巩固引擎 A/B/C/D/E 白名单 | pending |
| 19 | P3: profile proposals + lifecycle + exposure/outcome | pending |
| 20 | P4: ACL/egress policy engine + 负向测试 | pending |
| 21 | P4: adapter 语义面（recall/open_sources/write_explicit/feedback/delete）| pending |
| 22 | 全量 evals + branch-authoritative memory-abilities | pending |
| 23 | Features 文档：v1/v2/v3 数据模型 + 关键逻辑 | pending |
| 24 | 部署 + 切换 P2 flag | pending |
| 25 | 30 天观察 → P5 | deferred（届时告诉用户） |
