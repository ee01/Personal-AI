# Meeting Pilot 会议历史归档读取回执改进计划

## 目标功能

- 随机选中功能：`会议历史归档`
- 所属文档：`docs/features/meeting_pilot.md`
- 主要代码：`src/modals/components/MeetingHistoryPage.vue`
- 验证脚本：`desktop-app/scripts/meeting-pilot-history-check.mjs`

## 当前确认

- `docs/progressing/to-verify.md` 当前为 `暂无。`。
- 本机 Reminders 可读，但没有可见的 `Personal AI` 列表，因此没有合并或完成 Reminder 条目。
- 文档描述的主能力与代码基本一致：历史页支持分页、关键词搜索、状态筛选、不安全 PDF 阻断、从历史打开 Panorama、从 safe URL 打开 PDF。

## 外部参考

- Zoom AI Companion transcripts 支持按日期、状态、meeting ID、topic、keyword 找历史转写，说明历史归档检索应把服务端筛选结果和当前显示范围讲清楚。
- Microsoft Teams Recap 将录制、转写、共享文件、笔记、议程和 follow-up tasks 放在会后 recap 中，说明归档页需要保留结构化回看入口，而不是只给 PDF 链接。
- Otter Action Items 将跨会议 action items 聚合在可回看的首页入口，说明历史页的刷新/search 需要和行动项状态区分，不应暗示已经重新处理或更新任务。
- LLM-powered meeting recap 研究指出 recap 可能有漏项、误归因和个人相关性不足，说明历史页应明确刷新只是读取归档，不是重新生成或修正 recap。

## 改进点

1. 在会议历史页增加持久的 `会议归档读取回执`。
2. 覆盖初始加载、手动刷新、搜索/状态筛选、清除筛选、加载更早会议。
3. 回执展示触发来源、筛选范围、已显示/总数、只读边界和下一步。
4. 明确本次操作没有重新分析会议、生成 PDF、写入 Memory Service、发送纪要或修改行动项。

## 实现步骤

1. 在 `MeetingHistoryPage.vue` 中增加 receipt state、构建函数和 UI block。
2. 调整 `loadMeetings` / `applyArchiveFilters` / `clearArchiveFilters` / `loadMoreMeetings`，在成功读取后更新 receipt。
3. 在 `meeting-pilot-history-check.mjs` 中断言初始、筛选、清除和加载更多后的回执文本。
4. 在 `docs/features/meeting_pilot.md` 补一条行为摘要。

## 验证计划

- `npm --prefix memory-service test -- --run src/__tests__/api-meetings.test.ts`
- `npm start` 等待首次成功 webpack dev compile 后停止 watch
- `npm run test:meeting-pilot-history`
- `git diff --check -- src/modals/components/MeetingHistoryPage.vue desktop-app/scripts/meeting-pilot-history-check.mjs docs/features/meeting_pilot.md .planning/2026-06-18-automation-meeting-history-refresh-receipt/plan.md`
- 检查没有遗留 webpack watch 进程
