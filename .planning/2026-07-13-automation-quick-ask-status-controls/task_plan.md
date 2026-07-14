# Quick Ask 状态卡控制点边界

## 目标

本轮从 `docs/features/index.md` 随机抽样后选中 `Quick Ask 状态卡`。现有状态卡正文已经说明数量、来源、刷新失败和状态项动作边界，但 compact 态状态胶囊与卡片内 `重新读取` 按钮在 hover / 读屏层没有同等级边界，点击前容易被误读成打开设置、重试同步、批准待确认项或发送 outreach。

## 外部参考

- Raycast Quick AI 强调从当前工作流内快速提问、在同一窗口继续追问，并在需要时交接到完整 AI Chat：https://manual.raycast.com/ai/chat
- ChatGPT macOS Chat Bar 也把系统级快捷入口和当前 app 上下文放进轻量入口：https://help.openai.com/en/articles/10119604-work-with-apps-on-macos
- Mixed-Initiative Context 研究指出，用户控制感主要来自知道系统正在使用什么上下文、哪些内容可控，以及操作边界是否可见：https://arxiv.org/abs/2604.07121
- Just-in-time information access 方向支持把当前应用上下文作为即时辅助输入，但必须保持用户可理解的时机和控制边界：https://dl.acm.org/doi/10.1145/325737.325776

## Reminder 检查

AppleScript 未列出 `Personal AI`，EventKit 成功读取本机 `Personal AI` 列表。列表共 4 条，均为已完成的 Doubao / Notification 历史反馈；没有未完成的 Quick Ask 状态卡相关条目，因此本轮不标记 Reminder done。

## 实施步骤

1. 在状态胶囊上补 `title` / `aria-label`：说明点击只展开当前运行态状态卡，不打开设置、不批准/重试/发送/取消/归档或写入。
2. 在 `重新读取` 按钮上补 `title` / `aria-label`：说明只重新读取运行态快照，刷新中阻止重复点击，不会执行状态动作或改配置。
3. 扩展 `desktop-app/scripts/quick-ask-status-card-check.mjs`，覆盖胶囊与刷新按钮的边界文案。
4. 更新 `docs/features/doubao_bridge.md` 和 `docs/features/index.md` 的状态卡描述。
5. 验证：`node --check`、`npm run verify:quick-ask:e2e`、`npm start` 首次成功编译、scoped `git diff --check`。
