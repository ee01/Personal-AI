# Prompt Config 复制预览快照回执计划

## 目标

随机功能目标：`自定义消息分析提示词 / Prompt Config`。

用户在生效预览里复制清洗后的注入文本后，可能继续切换全部 / 消息 / 项目预览或编辑草稿。复制动作只写本机剪贴板，不会保存配置或触发真实分析；页面需要继续说明剪贴板里仍是上一次复制的范围和文本快照。

## 外部参考信号

- ChatGPT Memory / Custom Instructions 这类长期偏好需要用户可关闭、可管理和可删除，避免把持久偏好误读成单次会话行为。
- LangSmith / PromptLayer / MLflow Prompt Registry 等 prompt 管理产品强调版本、环境、回滚、diff 和发布前影响审计。
- LaMP / CoPS 等个性化研究支持按任务选择少量相关用户 profile/context，而不是无差别注入完整长期偏好。
- OWASP prompt injection 与 memory poisoning 研究说明，用户可编辑或外部来源的长期上下文要保持数据边界和可见审计。

## 实施步骤

1. 保持现有预览与真实注入共享逻辑不变。
2. 复制预览时记录当时的预览范围、清洗后文本、草稿 / 已保存基线状态和复制时间。
3. 当前预览范围、文本或状态变化后，把复制回执从“已复制”派生成“旧快照”，提示重新点击复制才会更新剪贴板。
4. 扩展 `verify-custom-prompts-e2e`：复制全部草稿预览后切换到消息预览，断言旧快照回执出现；再重新复制当前消息预览。
5. 更新 `docs/features/custom_prompts.md`，只记录用户可感知行为，不展开实现细节。

## 验证计划

- `npm run verify:custom-prompts`
- `npm start` 等待首次成功编译后停止
- `npm run verify:custom-prompts:e2e`
- 针对本轮文件运行 `git diff --check`
