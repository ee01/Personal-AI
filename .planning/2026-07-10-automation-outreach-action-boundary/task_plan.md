# 主动询问操作边界改进计划

## Goal

随机抽中 `主动询问`（Memory Service / `docs/features/memory_system.md`），检查当前代码与文档，结合行业资料和 Reminder 信号，做一个不需要额外用户决策的 UX/缺陷改进，并完成代码、文档和验证闭环。

## Current Context

- `docs/progressing/to-verify.md` 为空，没有待续项。
- 自动化记忆显示最近刚改过 Memory Lens、Project Dashboard、Skill Foundry、Meeting Local ASR、Coverage、多用户隔离等；本轮避开这些新鲜目标。
- EventKit 找到 `Personal AI` Reminder 列表，4 条均为已完成历史项，暂无和主动询问相关的 open item。
- 当前工作区已有大量历史脏文件；本轮只触碰主动询问相关代码、验证、文档、计划和自动化记忆。

## Phases

| Phase | Status | Notes |
|---|---|---|
| 1. Inspect docs/code/tests | complete | 主动询问已有列表筛选、焦点对象、详情操作范围、发送前复核、列表/详情提交回执和 E2E |
| 2. External references | complete | HITL / workflow / proactive-agent 资料支持按钮级审批和副作用边界 |
| 3. Plan improvement | complete | 聚焦补齐按钮本身的 hover/ARIA 动作边界 |
| 4. Implement | complete | 修改 Outreach 列表/详情按钮属性、E2E 断言和 canonical docs/index |
| 5. Verify | complete | `node --check`、`npm start` 首次成功编译、Outreach E2E、scoped `git diff --check` 均通过 |
| 6. Closeout | complete | Reminder 无 open 相关项；自动化记忆已更新 |

## Validation Target

- 优先使用现有主动询问相关 verifier/E2E。
- Runtime 源码变更后按 `AGENT.md` 至少跑 targeted verifier + `npm start` 首次成功编译 + 对应 E2E + scoped `git diff --check`。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `pgrep` matched its own process-check command | Process cleanup check | Re-ran with `ps | grep -E '[w]ebpack --watch|[v]erify-outreach-sessions-e2e\\.mjs'`, confirmed no lingering process |
