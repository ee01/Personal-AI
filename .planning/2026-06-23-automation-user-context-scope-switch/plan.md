# 用户上下文注入范围切换计划

随机选中 `用户上下文注入`。本轮聚焦 Prompt Config 用户上下文页签里的一个 UX 缺口：页面已经能解释当前全部 / 消息 / 项目预览会读取哪些信号，但用户在填写上下文字段时需要去下方生效预览区才能切换范围，容易把消息专项或项目专项信号误读成丢失、全局生效或已经进入真实分析。

## 外部参考

- ChatGPT Memory / Custom Instructions、Claude Memory、Gemini Personal Context 和 Microsoft 365 Copilot Memory 都强调长期偏好需要可开关、可管理，并说明何时会用于个性化。
- LaMP、CoPS 等个性化研究支持按当前任务选择相关 user profile/context，而不是把完整长期上下文无差别注入。
- OWASP Prompt Injection、LLM privacy 讨论和用户上下文污染研究提示：用户可编辑长期上下文必须被明确降级为低优先级数据，并把实际读取范围前置。

## 改进步骤

1. 在用户上下文页签首屏的 `用户上下文本轮范围` 回执里加入 `全部 / 消息 / 项目` 范围切换控件。
2. 切换后同步更新回执、下方生效预览、注入回执和专项信号排除说明。
3. 保留现有边界：切换范围只改变当前页面预览，不保存配置、不触发真实分析、不融合画像、不写入记忆服务；草稿未保存时真实分析仍读取已生效基线。
4. 更新 `docs/features/custom_prompts.md` 和 `tools/verify-custom-prompts-e2e.mjs`，运行 Prompt Config 目标验证、dev compile、E2E 和 scoped diff check。

## Reminder 状态

本机 Reminders 可访问，但不存在 `Personal AI` 列表；本轮没有可纳入或可标记完成的 Reminder 条目。
