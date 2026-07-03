# Task Plan: Memory Frontier Improvement Plans

## Goal
把《置身钉内》+ ChatGPT 对话 + 前沿论文 + GitHub 调研得出的 ~18 条建议，逐条对照现有代码与既有 plan 文档，整理成可落地的实施方案文档存入 docs/progressing/；已在正确方向的标注增量改进，大改造单独成 plan。

## Current Phase
完成（全部 5 phase 收尾）

## Phases

### Phase 1: 盘点（代码现状 + 既有 plan 重叠）
- [x] 4 路并行调研：Salience/Recall/Graph 代码、Ingest/Consolidation/Truth 代码、Proactive/Skill/路由代码、docs/progressing 既有 plan 重叠分析
- [x] 结论写入 findings.md
- **Status:** complete

### Phase 2: 分组定稿
- [x] 18 条建议 → 11 个新文档（10 plan + 1 索引）+ 3 条快赢并入索引
- [x] 记录到 findings.md「分组定稿」
- **Status:** complete

### Phase 3: 写第一批 plan（P0）
- [x] memory-recall-ppr-association-plan.md / memory-salience-behavioral-intimacy-plan.md / memory-weave-provenance-visibility-plan.md / memory-longmemeval-benchmark-plan.md
- **Status:** complete

### Phase 4: 写第二批 plan（安全 + P1）
- [x] memory-injection-defense-plan.md / memory-merge-evolution-ttl-plan.md / memory-sleep-time-compute-plan.md（含两个时间场景）/ memory-proactivity-cost-asymmetry-plan.md
- **Status:** complete

### Phase 5: 写第三批（P2）+ 索引 + 交付
- [x] memory-mcp-server-plan.md / memory-cascade-deletion-plan.md / skill-experience-quality-gate-plan.md
- [x] memory-frontier-2026-index.md（含设计原则文本 + QW-1/2/3 快赢清单 + 落地顺序 + 既有 plan 衔接表）
- [x] 文件核对：12 个新文档全部落盘（~1100 行）
- **Status:** complete

### Phase 6: 场景版块 + HTML demo（2026-06-11 追加需求）
- [x] 11 个 plan 各加「假设场景」版块（插在 ## 依据 之前；7 个无 UI 用 before/after 数据对比）
- [x] 4 个静态 demo：weave / sleep-time / proactivity / skill-quality-gate（复用既有 demo 设计 token；Playwright 截图验证 4/4 渲染正常）
- [x] 索引表格新增「场景与 Demo」列并回填
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 用 .planning/ 隔离目录，root 旧 task_plan.md 不动 | root 是已完成的旧任务，active plan 原指向自动化任务 |
| 新 plan 文档遵循 docs/progressing/ kebab-case `*-plan.md` 惯例 | 与仓库既有 50+ plan 文档一致 |
| 与既有 plan 重叠的方向优先做增量标注而非新建文档 | docs/progressing 已有 outcome-loop/intake-quality-gate/relevance-trainer 等高度相关 plan |

## Errors Encountered
| Error | Resolution |
|-------|------------|
