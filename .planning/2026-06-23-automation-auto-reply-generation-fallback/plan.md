# 自动答复 AI 生成失败 fallback 改进计划

## 目标

`自动答复 / Reply` 代表用户向 RingCentral 会话发送或排队发送内容。当前配置页已经说明保存规则不会立即发送，但代码在 AI 生成失败且固定模板为空时仍可能写入硬编码短句。这会让用户以为系统只是在“建议回复”，实际却排队了一个没有上下文的默认答复。

## 外部参考

- Gmail Smart Reply / Google Docs Smart Reply 和 Outlook Suggested Replies 都把 AI 文本作为可编辑建议，最终发送动作仍由用户确认。
- Google Agent Assist Smart Reply 面向 human agent 展示候选回答，适合作为“建议先于发送”的参照。
- Smart Reply 论文强调 response diversity 和高吞吐，但 Personal AI 的自动答复是用户授权的代表性发言，失败时应宁可跳过，也不要造默认句。
- Automation bias / overreliance 研究提示：AI 建议一旦看起来确定，用户容易过度相信；因此失败、空文本和 fallback 必须在配置前可见。

## 实施步骤

1. 在自动答复处理器中移除硬编码默认回复。AI 生成失败时，仅当固定文本非空才 fallback；否则返回未处理并跳过本次队列创建。
2. 固定文本模式也保护空文本：固定文本为空时不创建 Scheduled Message。
3. 在配置页“发送口径”回执里补充 fallback/skip 文案，区分 AI 生成失败且有固定文本、AI 生成失败且无固定文本、固定文本为空三种路径。
4. 更新 `docs/features/message_reaction.md` 和 `docs/index.md`，保持文档导航级别，不展开实现细节。
5. 用 message-reaction 单测、规则诊断 E2E、dev extension compile 和 whitespace 检查验证。

## 验收

- AI 生成失败且没有固定文本时不会创建自动答复队列行。
- 配置页在保存前说明失败 fallback 或跳过行为。
- 现有 PendingReview / Active 审核队列语义不变。
