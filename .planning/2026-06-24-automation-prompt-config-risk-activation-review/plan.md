# Prompt Config 风险提示激活复核

## 目标功能

- 随机目标：`自定义消息分析提示词`（Prompt Config / `docs/features/custom_prompts.md`）。
- 本轮重点：长期自定义提示词中带有 prompt injection / 记忆污染风险语句时，区分“暂停但保留”和“重新开启后会进入真实分析”。

## 外部参考结论

- ChatGPT / Claude 的长期偏好和记忆都强调用户可管理、可关闭、可恢复，但持久偏好会跨会话影响模型行为。
- prompt management 产品通常把版本、差异、回滚和发布前影响检查作为核心能力。
- 近期 memory poisoning / indirect prompt injection 研究说明，持久记忆或长期偏好一旦从保留状态变成可注入状态，风险边界会升级，不能只复用早先的普通确认。

## 改进计划

1. 检查 Prompt Config 文档、保存路径、风险提示和 E2E，确认当前文档是否匹配实现。
2. 修复风险提示确认 key：把风险提示词当前是 `active` 还是 `paused` 纳入确认上下文，避免暂停状态确认被复用于重新激活。
3. 扩展保存影响：安全提示行显示 `注入` / `暂停` 状态，且从暂停变注入时标记为需要重新确认的激活状态变化。
4. 更新 `verify:custom-prompts` 和 `verify:custom-prompts:e2e`，覆盖暂停确认后重新开启必须重新确认。
5. 更新 `docs/features/custom_prompts.md`，记录新的激活复核边界。

## 验证

- `npm run verify:custom-prompts`
- `node --check tools/verify-custom-prompts-e2e.mjs`
- `npm start` 首次成功编译后停止 watch
- `npm run verify:custom-prompts:e2e`
- scoped `git diff --check`
