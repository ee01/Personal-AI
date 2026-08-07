# 记忆时间轴刷新快照回执计划

## 目标

本轮从 `docs/index.md` 随机抽中 `记忆时间轴`。当前时间轴已经具备范围、来源、定位、打开动作和刷新失败回执，但用户在同一 scope / 时间窗口点击刷新时，旧列表会先被全屏 loading 挡住。作为真实用户，这会让人短暂无法判断：当前看到的是正在重新读取、旧快照仍有效，还是列表已经被清空。

## 外部对照

- Microsoft Recall 把 timeline segment、搜索、app/site 控制和隐私边界放在同一回找路径里，说明时间线应该让用户持续理解当前窗口和来源控制。
- Google My Activity 支持按日期、产品、关键词过滤历史活动，适合对照 Personal AI 的时间、scope、source 过滤心智。
- THEANINE / timeline-based memory research 强调记忆时间线的价值在于保留事件演化和上下文关系，不应在短暂读取中断时让上下文消失。
- KFTF / PIM 研究强调 refinding 依赖可恢复路径；刷新失败和刷新中都应该保留“我刚才在哪里”的线索。

## 改进 Plan

1. 在 timeline presentation 层新增 `buildTimelineRefreshingSnapshotReceipt()`，说明同范围刷新正在进行、下面仍是上次成功快照、来源筛选仍只作用于旧批次、刷新成功后会替换。
2. Timeline 页面区分同范围刷新和跨范围加载：同范围已有数据时不隐藏列表，只显示刷新中快照回执；切换 scope / 时间窗口后仍使用阻塞 loading，避免旧范围冒充新范围。
3. 更新 `docs/memory_system.md` 的时间轴描述，补上刷新中和刷新失败的快照边界。
4. 扩展 `tools/verify-memory-timeline.ts` 与 `tools/verify-memory-timeline-e2e.mjs`，覆盖 helper 文案、刷新中保留列表、跨范围失败不复用旧快照。

## 验证

- `npm run verify:memory-timeline`
- `npm start` 首次成功 compile 后停止 watcher
- `node tools/verify-memory-timeline-e2e.mjs`
- `git diff --check -- src/modals/timelinePresentation.ts src/modals/components/TimelinePage.vue tools/verify-memory-timeline.ts tools/verify-memory-timeline-e2e.mjs docs/memory_system.md .planning/2026-06-21-automation-memory-timeline-refresh-snapshot/plan.md`
