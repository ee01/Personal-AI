# 关注后续筛选空结果回执

## 目标功能

- `关注后续 / Watch`
- 主文档：`docs/features/message_reaction.md`
- 主要界面：`src/modals/components/FollowThreads.vue`

## 当前结论

- `docs/progressing/to-verify.md` 暂无待校验事项，本轮选择新功能切片。
- 本机 AppleScript 未列出 `Personal AI` Reminders；EventKit 可读到 `Personal AI`，但 4 条均为已完成的历史 Doubao / digest / sync 反馈，与 Watch 无关。
- 业内参考：Teams Followed threads 和 Slack Later 都把被跟踪项放在可管理视图里，并提供筛选、恢复和跳回原消息路径；多方聊天线程检测研究说明短消息场景需要显式上下文和状态边界。

## 需要改进的问题

Watch 管理页有状态筛选，但 `filteredItems.length === 0` 时统一显示“暂无手动关注项”。当用户筛到“已过期”而当前只有进行中规则，或筛到“进行中”而当前只有已过期规则时，这个文案会误导用户以为手动规则不存在或读取失败。

## 实施计划

1. 保持 Watch 核心语义不变：不改匹配、通知、索引、保存、延长或取消逻辑。
2. 在 `FollowThreads.vue` 增加筛选空结果回执：
   - 没有任何手动规则时，仍显示“暂无手动关注项”。
   - 有规则但当前状态筛选为空时，显示“当前筛选无结果”、现有总数和 active/expired 分布。
   - 提供“查看全部”按钮恢复 `all` 筛选，并说明这只是本页筛选，不会取消、延长、补发通知或重新读取远端。
3. 扩展 `tools/verify-follow-threads-management-e2e.mjs`：
   - 先切到一个空筛选，断言筛选空结果和恢复按钮。
   - 点击“查看全部”后确认原规则仍存在。
   - 取消规则后仍断言真实无规则空状态。
4. 更新 `docs/features/message_reaction.md` 的 Watch 管理页说明。
5. 验证：
   - `node --check tools/verify-follow-threads-management-e2e.mjs`
   - `npm start -- --progress` 到首次成功编译后停止
   - `npm run verify:follow-threads-management:e2e`
   - 针对本轮触碰文件运行 `git diff --check`
