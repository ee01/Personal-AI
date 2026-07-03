# 自动答复内容就绪回执改进计划

## 目标

随机抽中的功能是 `自动答复 / Reply`。本次只改一个窄体验问题：自动答复规则可以保存为“固定文本为空且不使用 AI 生成”，运行时会正确跳过入队，但用户在保存前和列表里不够容易看见这个规则的自动答复部分其实不会产生队列行。

## 外部参考

- Gmail / Google Chat Smart Reply 和 Outlook Suggested Replies 都把生成文本当成可编辑建议，用户仍要选择或发送。
- Microsoft Human-AI Interaction Guidelines 强调状态反馈、用户控制和错误恢复。
- Smart Reply 论文把短回复建议设计成候选项，而不是隐藏的自动发送；Personal AI 的自动答复因此需要把内容就绪、fallback 和跳过路径放在用户保存前。

## 实施步骤

1. 在 `autoReplyPresentation` 增加自动答复内容就绪回执：固定文本就绪、AI 生成但无 fallback、AI 生成有 fallback、固定文本未就绪。
2. 在规则配置页和编辑页展示该回执，不改变保存、匹配、AI 生成或定时消息创建语义。
3. 在规则列表里对所有已启用自动答复的规则展示状态：有草稿显示草稿；AI 无模板显示无固定 fallback；固定空文本显示未就绪和恢复路径。
4. 更新自动答复 presentation 单测、消息分析 E2E 断言和 `docs/features/message_reaction.md`。
5. 跑 focused tests、`npm start` 首次成功编译、E2E 和 scoped `git diff --check`。

