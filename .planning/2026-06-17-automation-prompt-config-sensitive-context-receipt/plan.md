# Prompt Config 敏感上下文提示

## 目标

本轮随机命中 `docs/index.md` 里的 `自定义消息分析提示词 / Prompt Config`。当前文档与代码已经覆盖草稿预览、已生效基线、注入范围、复制审计和提示词风险确认，但用户上下文字段如果误粘贴 token、API key、password、private key 或 webhook，页面只会把它当作普通低优先级 `user_context` 数据保存、预览并尝试备份。

## 外部参考

- ChatGPT Custom Instructions / Memory：长期偏好可开关、可编辑，会影响未来上下文，因此需要显式控制和删除路径。
- Claude Code memory：项目/用户记忆会被加载为上下文，而不是硬规则；需要让用户知道它只是上下文。
- LaMP 个性化研究：个性化应选择少量相关 profile/context 项，而不是把完整用户信息无差别注入。
- LLM agent memory privacy / prompt-injection 研究与安全报告：长期记忆和外部/用户输入会带来持久污染、数据泄露和后续会话风险。

## 改进计划

1. 在 `src/services/userConfigPreview.ts` 增加用户上下文敏感值检测，范围限定在明显凭据形态：API key、token、password、Bearer token、private key、常见平台 token、webhook URL。
2. 在 `src/modals/prompt-config.tsx` 增加页内敏感上下文回执：
   - 生效预览区显示“用户上下文敏感提示”，列出字段位置和原因。
   - 具体用户上下文页签显示对应字段提示，帮助用户定位。
   - 保存或融合前要求确认这些内容不是可用凭据，或已改成不可执行引用；确认文案说明不会执行、验证或用这些值调用外部系统。
3. 更新 `tools/verify-custom-prompts.ts` 和 `tools/verify-custom-prompts-e2e.mjs`：
   - 覆盖检测器不误报普通邮箱。
   - 覆盖页面阻断误粘贴 secret 的保存路径，并证明清空后流程恢复。
4. 更新 `docs/features/custom_prompts.md`，把该边界写进当前功能文档。

## 验证

- `npm run verify:custom-prompts`
- `npm start` 到首次成功编译后停止
- `npm run verify:custom-prompts:e2e`
- `git diff --check` scoped 到本轮文件
