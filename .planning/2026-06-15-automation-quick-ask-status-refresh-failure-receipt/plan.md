# Quick Ask 状态卡刷新失败回执

## 目标功能

- 随机选中 `docs/features/index.md` 中的 `豆包互联 / Doubao Bridge`
- 本轮只处理 Quick Ask 的状态胶囊 / 状态卡路径

## 背景检查

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 本机 Reminders 可访问，但没有 `Personal AI` 列表，因此没有可纳入或可标记完成的 Reminder 条目
- 当前工作区已有大量无关脏文件，本轮只触碰 Quick Ask / Doubao Bridge 文档和本计划文件

## 外部参考

- ChatGPT macOS Chat Bar 和 Raycast AI 都强调从全局入口快速发问、减少上下文切换；Quick Ask 适合继续保持轻量状态卡而不是跳转 dashboard。
- Mixed-Initiative Context 论文把上下文视为可显式管理的交互对象，支持把状态来源、范围和新鲜度带入后续追问。
- Automation bias 综述指出透明度只有在帮助用户识别不确定性和错误时才有价值；刷新失败时必须明确“当前状态未确认”。

## 改进 Plan

1. 在 Quick Ask 状态卡上记录最近一次 `重新读取` 失败的错误、失败时间和失败前的快照时间。
2. 刷新失败后保留旧状态项，但把卡片和每条状态项标记为 `刷新失败 · 上次快照`，点击追问时带入“当前状态未确认”的提示。
3. 保持刷新成功路径不变：成功后清除失败标记，显示新快照或空状态。
4. 更新 `desktop-app/scripts/quick-ask-status-card-check.mjs`，覆盖刷新失败后旧快照不会被误当作当前状态。
5. 更新 `docs/features/doubao_bridge.md`，只补充用户可感知的行为边界。
6. 验证顺序：`npm --prefix desktop-app run test:quick-ask-status-card` -> `npm start` 首次成功编译 -> `npm run verify:quick-ask:e2e` -> scoped `git diff --check`。
