# 用户上下文注入总览改进计划

## 目标

目标功能：`用户上下文注入`（Prompt Config / `docs/features/custom_prompts.md`）。

本轮改进聚焦用户在填写个人、团队、工作、沟通、分析偏好时的首屏判断：当前预览范围到底会读取多少用户上下文信号，哪些专项信号只是保留但不进入本轮分析，以及这个总览不会保存、触发分析、融合画像或写入记忆服务。

## 外部参考

- ChatGPT Custom Instructions / Memory：显式指令和记忆是分开的个人化来源，用户需要能开启、关闭和管理。
- Claude personalization / project memory：个人化能力按 profile、project、memory 等不同范围生效。
- LaMP / personalized LLM 研究：个性化应选取和当前任务相关的 profile/context，而不是无差别注入全部资料。
- Memory poisoning / prompt injection 研究：长期上下文可能长期影响后续模型行为，所以 UI 需要把低优先级和非执行边界提前显示。

## 实施步骤

1. 复用 `buildUserContextScopeBreakdown()`，在 Prompt Config 用户上下文页签上方增加 `用户上下文本轮范围` 总览。
2. 总览跟随 `全部 / 消息 / 项目` 预览范围，显示基础、消息、项目上下文信号的当前读取与排除情况。
3. 在总览里明确边界：该总览只解释预览和保存后的注入范围，不保存配置、不触发真实分析、不融合画像、不写入记忆服务；草稿未保存时真实分析仍读取已生效基线。
4. 更新静态 verifier、E2E 和功能文档。
5. 运行 `verify:custom-prompts`、`npm start` 首次成功编译、`verify:custom-prompts:e2e`、scoped `git diff --check`。
