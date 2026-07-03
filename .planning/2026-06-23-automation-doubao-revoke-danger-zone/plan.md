# Doubao Revoke Danger Zone Plan

## 目标

随机目标为 `Revoke ingested memory`（Doubao Bridge）。这轮只做一个小而可验证的 UX 改进：让 Explorer 来源卡片里的撤回入口更像真实删除操作，而不是普通二级操作，并继续清楚区分 Memory Service 删除、本地 artifact 审计和远端聊天原文。

## 检查结论

- `docs/progressing/to-verify.md` 当前为 `暂无。`。
- 本机 Reminders 可读，但没有 `Personal AI` 列表；没有可纳入或可标记完成的 Reminder 项。
- 现有后端链路已经按 `source + scope` 调用 Memory Service 删除，并把本地 artifact 标记为 revoked；单元测试覆盖了这个契约。
- 当前 UX 缺口在按钮区：撤回会删除长期记忆，但按钮仍是普通 `secondary` 样式，静态说明使用“当前范围”，容易被误读成未保存表单草稿。

## 外部参考

- OpenAI Memory FAQ: saved memory、chat history 和源聊天删除是分层控制；删除时应说明影响哪一层。
- Gemini Apps Privacy: 删除 Gemini Apps Activity 不会删除其它 Google 服务中保存的数据；这支持“撤回记忆不回删来源”的明确边界。
- Machine unlearning verification 论文强调删除请求需要可验证结果；这里对应为分别展示 Memory Service 删除数和本地审计标记数。

## 实施步骤

1. completed - 把来源卡片撤回区改为危险操作区，按钮使用 `danger` 样式并写明“按已保存范围撤回记忆”。
2. completed - 把静态说明统一成“按已保存默认范围”，并给撤回状态加 `role=status` / `aria-live=polite`。
3. completed - 更新确认弹窗，第一句直接说明“按已保存默认范围”，并把“删除 Memory Service 记忆”作为显式风险句。
4. completed - 扩展 `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`，断言危险按钮、说明文案、确认弹窗和现有 revoke payload/result。
5. completed - 更新 `docs/features/doubao_bridge.md` 的当前行为说明。
6. completed - 运行桌面端目标 E2E、桌面端 build、根扩展 `npm start` 首次成功编译和 scoped `git diff --check`。

## 验证结果

- passed - `npm --prefix desktop-app run test:source-toggle-gating`
- passed - `npm --prefix desktop-app run build`
- passed - `npm start` 首次 webpack development compile，随后停止 watch
- passed - `git diff --check -- desktop-app/app/index.html desktop-app/app/app.css desktop-app/app/renderer.js desktop-app/scripts/doubao-source-toggle-gating-check.mjs docs/features/doubao_bridge.md .planning/2026-06-23-automation-doubao-revoke-danger-zone/plan.md`
- passed - process cleanup check: no `webpack` / `doubao-source-toggle-gating` / desktop build process remained
