# Prompt Config 调研发现

## 本地现状

- `docs/progressing/to-verify.md` 为空。
- `Personal AI` Reminders 通过 EventKit 可读，共 4 条，全部已完成；没有和 Prompt Config、自定义提示词、用户上下文、prompt injection 或版本恢复相关的未完成条目。
- `docs/features/custom_prompts.md` 已覆盖提示词清洗、来源/作用域开关、风险确认、保存影响、生效基线、复制预览、历史恢复草稿、用户上下文敏感提示等边界。
- 现有版本历史只显示保存时间、摘要和 `changeSummary`。恢复前缺少相对当前已生效基线的影响说明，用户需要先恢复成草稿后才看到保存影响。

## 外部参考

- OpenAI ChatGPT Custom Instructions 官方帮助说明：custom instructions 可以编辑/删除/关闭，更新影响未来对话，并有 1500 字符限制。对应本功能应继续强调长期偏好不是一次性草稿，恢复旧版本前要看清未来影响。https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions
- Anthropic Claude Projects 帮助说明：Project instructions 在项目内所有 chats 生效，项目知识和可见性/权限需要清晰管理。对应 Prompt Config 的消息/项目范围切换应继续避免把审计并集误读成单次运行范围。https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects
- OWASP LLM01 Prompt Injection：用户输入可直接或间接改变模型行为，防护建议包括约束模型行为、定义并验证输出格式、过滤输入输出。对应本功能应把风险提示词保持为低优先级偏好，并让恢复旧版本前看见安全提示状态。https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- HouYi prompt injection paper：真实 LLM-integrated applications 存在 prompt leak / prompt abuse 风险，单纯 prompt 包裹和转义防线可能不足。对应本功能不应只依赖保存拦截，还应在历史恢复前展示旧版本会重新带来的风险状态。https://arxiv.org/html/2306.05499v3

## 结论

本轮最小建设性改进是补齐版本恢复前的“影响预览”。它沿用现有保存影响比较逻辑，不需要新后端；同时正好回应外部参考里“长期指令可编辑/可关闭/有范围”和“prompt injection 风险需要持续可见”的共同要求。

