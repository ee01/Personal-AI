# Prompt Config 暂停风险保存确认

## 目标

随机巡检目标：`自定义消息分析提示词` / Prompt Config。

把启用提示词里的风险语句视为长期配置保存边界，而不是只看当前是否进入运行时注入。即使用户暂时暂停提示词来源或消息/项目作用域，风险提示词仍会随配置保存，后续重新开启后才进入真实分析，因此保存和融合前仍需要明确确认。

## 外部参考结论

- ChatGPT / Claude 等记忆与自定义偏好产品都强调用户可查看、关闭、删除或迁移长期偏好。
- Humanloop / PromptLayer / LangSmith 类 prompt management 强调版本、影响、评估和回滚，不把编辑态误当作生产态。
- 近期 memory poisoning / personalization 研究提醒：持久化上下文会跨会话影响后续输出，风险检查应贴近“保存到长期偏好”边界，而不仅是当下是否注入。

## 实施步骤

1. 修改 Prompt Config 保存前确认逻辑，让所有已启用且命中风险的提示词都要求确认。
2. 在生效预览的风险提示里显示运行时状态：当前会注入，或当前已暂停但仍会随配置保存。
3. 调整 summary / 保存影响 helper，让安全提示计数覆盖暂停但会保存的风险提示词。
4. 更新 `docs/features/custom_prompts.md` 和 `docs/features/index.md`。
5. 跑 `verify-custom-prompts`、开发构建、Prompt Config E2E 和 diff 检查。
