# 待校验事项

## 豆包桥接：重新登录后的真实投递体验

- 记录时间：2026-08-15
- 本轮已证实本机 `Personal AI.app` 服务健康、Memory Service 与 User ID 已配置，`memory_sync` 和 `mobile_context` 均有既有目标；但豆包状态为 `needs_login`，两条绑定均未就绪，尚无同步尝试或投递记录。
- 已完成隔离证明：`desktop-app/src/__tests__/bridgeService.test.ts` 与 `doubaoSource.test.ts` 共 22 项通过，`doubao-source-toggle-gating-check.mjs` 与 Desktop build 通过；它们证明未登录 / 未绑定不会发送，不能代替真实页面可见性。
- 待用户在 `Personal AI.app` 完成豆包登录后继续：只读确认状态变为 `connected`、两条绑定重新就绪、日常浏览器不可用时的内置 Chromium 回退状态可见；如需验证真实推送，先展示按钮边界与待确认回执，再由用户明确批准一项无敏感测试内容的发送，最后读取同步审计与目标页可见性。不要在未获批准时点击推送、抓取、绑定、撤回或发送。
- 复查：2026-08-16。本机 `desktop-app` 健康（v4.0.0），但运行状态仍为 `needs_login`；`memory_sync` 与 `mobile_context` 的既有豆包 `/chat/` 绑定仍在，尚不能作为已重新就绪或已投递证明。本轮未执行任何写入，继续等待用户完成登录。
