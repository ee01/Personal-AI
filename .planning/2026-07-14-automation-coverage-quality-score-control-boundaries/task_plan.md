# Coverage 质量分控制点边界计划

## Goal

本轮从 `docs/features/index.md` 随机样本中选中 `Coverage 质量分`。目标是让用户在点击质量分相关控件前，就能知道操作只作用于当前 Coverage 快照或只读诊断切片，不会重扫、同步、写库、标记已读或外发。

## Scope

- In: `MemoryCoveragePage.vue` 中质量分焦点 `查看平台`、排序切换、P0 切片刷新等控制点的 `title` / `aria-label`。
- In: 现有 Coverage E2E 增加真实 DOM 控制点断言。
- In: `docs/features/memory_coverage_map.md` 与 `docs/features/index.md` 的简短文档更新。
- Out: 质量分算法、`/coverage/map` 聚合、`priorityFocus` 排序、provider sync、智能录入、备份下载/恢复和真实 Memory Service 写入。

## Plan

1. [complete] 读取 `AGENT.md`、`docs/progressing/to-verify.md`、自动化记忆、功能索引和 Reminders。
2. [complete] 完成业内产品 / 论文检索，并确认本轮建设性改进方向。
3. [complete] 实现质量分控制点级 hover / 读屏边界。
4. [complete] 更新 Coverage E2E 和 canonical docs。
5. [complete] 运行针对性验证、`npm start` 首次编译和 scoped diff check。
6. [complete] 写回自动化 memory，总结本轮 Reminder 状态和验证结果。

## Decisions

- 选择 `Coverage 质量分`，避开今天刚覆盖的 Meeting Pilot ASR、Snooze、Timeline、Skill Foundry、Relationship Radar 等新鲜目标。
- EventKit 可读 `Personal AI` Reminders；列表 4 条总项、0 条未完成，本轮无需标记 done。
- 本轮采用 presentation/accessibility-only 方案，因为页面已有正确的评分解释和只读回执，剩余 UX 缺口在点击控件本身。

## Validation Target

- `node --check tools/verify-memory-coverage-e2e.mjs`
- `npm start -- --progress`，等首次 successful compile 后停止
- `npm run verify:memory-coverage:e2e`
- `git diff --check -- src/modals/components/MemoryCoveragePage.vue tools/verify-memory-coverage-e2e.mjs docs/features/memory_coverage_map.md docs/features/index.md .planning/2026-07-14-automation-coverage-quality-score-control-boundaries`

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `verify:memory-coverage:e2e` failed because the `刷新切片` boundary said `不会...、重跑 provider sync` instead of repeating `不会重跑 provider sync`. | First E2E run | Made each non-effect explicit in source and docs, then reran build/E2E. |
