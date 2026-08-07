# 主动询问筛选范围回执改进计划

## 目标

随机功能巡检选中 `主动询问会话管理`。本次只补列表筛选路径的用户可见边界，避免用户把状态/来源/计划/thread 筛选误读成已经审批、发送、取消、重试或改写外部系统。

## 步骤

1. 检查 `docs/index.md`、`docs/memory_system.md`、`OutreachSessions.vue`、`OutreachSessionDetail.vue` 和现有 Outreach E2E。
2. 检查本机 Reminders 的 `Personal AI` 列表；如有相关开放项纳入改进并在完成后标记。
3. 参考业内 agent flow / HITL / proactive agent 资料，收敛一个低风险 UX 改进点。
4. 在 Outreach 列表筛选区增加 `筛选范围回执`，覆盖 loading、全部视图、有筛选、有隐藏快照和无副作用边界。
5. 扩展 `tools/verify-outreach-sessions-e2e.mjs`，覆盖默认、来源筛选、空筛选和待审批筛选。
6. 更新 `docs/memory_system.md` 和 `docs/index.md`。
7. 运行 `node --check`、`verify:outreach-sessions:e2e`、`npm start` 首次成功编译和 scoped `git diff --check`。

