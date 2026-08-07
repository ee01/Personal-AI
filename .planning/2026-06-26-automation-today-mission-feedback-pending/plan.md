# Today Pilot Mission Feedback Pending

## 目标

随机扫到 `docs/index.md` 里的 `今天 Mission`。本轮聚焦首页 mission 反馈路径：用户点击完成、稍后、静默、有用或不准确后，界面不能在 Memory Service 确认前让人误以为来源任务、排程或排序反馈已经完成。

## 外部参考

- Microsoft 365 Copilot meeting prep 和 Google Gemini Daily Brief 都把每日/会前摘要做成可扫描的优先级快照，并强调来源和用户可继续查看的上下文。
- Viva Daily Briefing / collaborative reminder 研究支持把承诺、请求和 follow-up 这类协作事项作为 AI reminder 的核心，而不是把所有同步事件都推给用户。
- proactive agent 与 notification batching 相关讨论强调透明度、用户控制和低打扰；反馈提交中状态应明确“待确认”，不能提前制造成功感。

## 改进 Plan

1. 保留已有 Today Pilot mission 生成、排序和 feedback API 契约。
2. 在前端增加 mission feedback pending set，阻止同一卡片重复提交。
3. 点击反馈后先显示 `正在提交反馈` 回执，说明 Memory Service 确认前尚未写入展示/排序反馈，也没有改来源系统。
4. 服务端确认成功后才移除卡片或显示最终反馈回执；失败时卡片保持可见并显示 no-write 回执。
5. 更新 Today Pilot 文档和 verify/E2E，覆盖慢反馈响应时卡片仍可见、按钮锁定、pending 回执可见。

## 验证

- `tools/verify-day-pilot-home.ts` 检查 pending lock、pending receipt 和 no-write boundary。
- `tools/verify-today-pilot-home-e2e.mjs` 用延迟 feedback mock 证明卡片不会在服务确认前消失。
- 运行 `npm start` 到首次 webpack dev compile 后停止，再执行 Today Pilot E2E。
