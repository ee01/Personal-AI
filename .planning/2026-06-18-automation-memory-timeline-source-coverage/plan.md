# 记忆时间轴来源覆盖改进计划

## 目标功能

- 索引条目：`记忆时间轴`
- 所属能力：Memory Exploring
- 主文档：`docs/features/memory_system.md`
- 主要实现：`src/modals/components/TimelinePage.vue`

## 当前判断

时间轴已经具备范围、时间窗口、来源筛选、定位置顶、安全链接、打开动作、反馈和刷新失败快照回执。作为真实用户回找某段记忆时，剩余阻塞主要不是缺少后端能力，而是来源分布不够直观：筛选后能看到隐藏数量，但不知道哪些来源被隐藏，用户需要反复打开下拉试探。

本机 Reminders 可读取列表名，但没有 `Personal AI` 列表，所以没有可合并或可标记完成的用户反馈项。

## 外部参考

- Microsoft Recall：时间线、搜索线索和 app/site 控制共同服务“回到看到过的内容”。
- Google My Activity：支持按日期和产品一起过滤个人活动。
- KFTF / PIM 研究：个人信息管理的核心问题之一是找到后能再次找到，需要来源和路径线索。
- THEANINE：长程对话 agent 的 timeline memory 价值来自保留事件演化、时间关系和上下文线索。

## 改进计划

1. 在时间轴回执下方新增“来源覆盖”概览。
2. 展示当前已加载时间窗口里的每个来源及数量。
3. 当前来源筛选生效时，在其他来源 chip 上标明“已隐藏”。
4. 点击来源 chip 只切换本地来源筛选，不重新请求 `/recall`，不扩大检索范围。
5. 保留现有下拉筛选、定位置顶、安全跳转和反馈语义。
6. 更新主功能文档和 timeline E2E 覆盖。

## 边界

- 不新增 Memory Service route。
- 不写入记忆、反馈或来源资料。
- 不重新同步或确认来源内容。
- 不改变 `/recall` 的 time 通道排序、范围、窗口和来源返回格式。

## 验证

- `npm run verify:memory-timeline`
- `npm start` 等首次成功 dev compile 后停止 watch
- `npm run verify:memory-timeline:e2e`
- scoped `git diff --check`
