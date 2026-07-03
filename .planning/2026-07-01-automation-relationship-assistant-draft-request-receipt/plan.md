# Relationship Radar Assistant Draft Request Receipt

## 真实体验角色

我作为一个谨慎的项目协作用户，在 Relationship Radar 里给高频联系人生成 follow-up 草稿。我的偏好是：生成中的旧草稿不能看起来像新结果，敏感上下文是否进入草稿要明确，任何复制/发送/写入边界都要在行动前可见。

## 改进计划

1. 在回复助手生成请求发出后立即显示 `草稿生成请求回执`，列出目标人物、用户目标、旧草稿快照状态和默认隐私范围。
2. 生成期间锁定复制旧草稿，明确本次请求尚未替换当前结果，也不会写入人物画像、发送消息、创建跟进或临时包含敏感上下文。
3. 成功后清除请求回执；失败时保留未确认回执和旧草稿边界。
4. 扩展 Relationship Radar E2E，用延迟响应验证 pending 回执、按钮锁定和成功后清理。
5. 更新 `docs/features/relationship_radar.md`，把该请求中边界纳入 canonical 行为。

## 验证

- `npm run verify:relationship-radar`
- `npm start` 首次成功编译后停止
- `npm run verify:relationship-radar:e2e`
- `git diff --check` scoped to touched files
