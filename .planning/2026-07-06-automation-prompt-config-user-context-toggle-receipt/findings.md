# Prompt Config 用户上下文来源待保存回执 Findings

## 仓库发现

- `docs/features/custom_prompts.md` 已描述用户上下文注入的核心合同：按消息 / 项目范围裁剪、低优先级 `user_context` 数据块、安全提示、草稿 / 基线、范围依据和保存影响。
- `src/modals/prompt-config.tsx` 中 `renderInjectionControl()` 直接用 `updateValue('preferenceInjection.userContextEnabled', e.target.checked)` 修改页面草稿；`buildPreferenceInjectionReceipt()` 和用户上下文页签总览会随草稿立即变化。
- 当前已有 `pending-change-summary` 和 `preference-change-impact`，但它们不贴在“用户上下文”来源开关旁。用户关闭来源后，首屏控制区只看到开关变了，不容易马上确认“真实分析还没有切换，必须保存后才生效”。
- `tools/verify-custom-prompts-e2e.mjs` 已经定位 `contextSourceToggle`，适合直接补充关闭 / 重新开启来源后的 UI 断言。

## Reminder 发现

- EventKit 授权成功，`Personal AI` 列表存在。
- 列表共 4 条，未完成 0 条；条目均已完成，主题为 Doubao 近期重点、测试、豆包记忆推送日志、Weekly Dream Digest 空壳同步。
- 无条目与 Prompt Config、用户上下文注入、偏好来源开关、保存影响、敏感上下文或 profile 融合相关。

## 外部参考

- OpenAI Memory FAQ / Memory controls：长期记忆与自定义指令需要由用户控制，可以关闭、删除或用临时对话绕过。对本功能的启发是开关改变必须显式区分“页面草稿”和“真实生效”。
- Anthropic Claude Memory / Claude Code memory：Claude 支持查看 / 编辑 / 关闭 memory，Claude Code memory 也强调记忆是上下文，不是强制配置。对本功能的启发是用户上下文来源应被称为低优先级运行时上下文，不应表现成系统级规则。
- LaMP 个性化研究：profile augmentation 的价值在于检索与任务相关的用户资料；本功能继续坚持按消息 / 项目范围裁剪，而不是扩大注入内容。
- Promptware kill chain 和 long-term memory poisoning 讨论：持久上下文污染可成为攻击持久化阶段；本轮改动不改变防护算法，只把“来源开关草稿未保存”的边界放到用户刚操作的位置。

## 决策

- 实现保持 presentation-first：不改数据合同和真实注入算法，只补一个 source-toggle draft receipt。
- 回执仅在 `lastPersistedConfig.preferenceInjection.userContextEnabled` 与当前草稿不同且页面有未保存修改时出现。
- 关闭和重新开启都要说清楚当前只是页面草稿；保存后才改变本机配置并尝试记忆服务备份，不会自动触发真实分析、融合画像或写入记忆服务。
