# Prompt Config 版本恢复影响回执计划

## 目标

随机选中 `docs/index.md` 里的 `自定义消息分析提示词`。本轮聚焦 `prompt-config.html` 的版本历史恢复路径：用户点“恢复”前应能知道旧版本如果保存，会相对当前已生效基线改变哪些注入状态，而不是只看到“变更：消息提示词”这类区块摘要。

## 改进计划

1. 核对 `docs/features/custom_prompts.md`、`src/modals/prompt-config.tsx` 和现有验证脚本，确认文档是否仍描述真实行为。
2. 查本机 `Personal AI` Reminders，纳入与 Prompt Config / 自定义提示词 / 用户上下文相关的未完成反馈。
3. 参考业内产品和论文：自定义指令、项目级指令、prompt injection 风险，以及 prompt management 的恢复/回滚心智。
4. 实现一个窄 UI 改进：版本历史列表显示“恢复前影响”，复用现有 `buildPreferenceChangeImpact` 比较口径，说明恢复后保存会改变当前预览范围的注入体积、提示词范围、安全提示和回执状态；点击恢复本身仍只是页面草稿，不写入真实分析基线。
5. 更新验证脚本和文档索引。
6. 按 AGENT.md 运行 targeted verifier、`npm start` 首次成功编译、Prompt Config E2E 和 scoped `git diff --check`。

## 非目标

- 不改 `chrome.storage.local` / memory-service 配置结构。
- 不新增云端版本历史、完整 diff、A/B eval 或多端冲突解决。
- 不改变真实分析 prompt 注入、风险检测、保存、融合用户画像或备份语义。

