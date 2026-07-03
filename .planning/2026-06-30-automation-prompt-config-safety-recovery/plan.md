# Prompt Config 安全阻塞恢复计划

## 目标功能

- 随机抽中：`自定义消息分析提示词` / Prompt Config
- 主文档：`docs/features/custom_prompts.md`
- 入口：`prompt-config.html`

## 本轮输入

- `docs/progressing/to-verify.md`：暂无待校验事项。
- Reminders：本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有可纳入或标记完成的 Reminder item。
- 自动化记忆：最近几轮已覆盖 Snooze、Agent Thinking、Glip、Topic、Meeting Pilot ASR、Doubao，避开这些新近主题。

## 外部参考

- OpenAI ChatGPT Custom Instructions：自定义指令可编辑、删除、关闭，且面向未来对话生效；第三方工具场景需要提醒用户不要放入不希望共享的信息。
  https://help.openai.com/en/articles/8096356-custom-instructions-for-chatgpt
- Claude Projects：项目可放入知识和项目指令，且协作场景区分可用/可编辑权限。
  https://support.claude.com/en/articles/9517075-what-are-projects
- LaMP personalization benchmark：个性化有价值，但需要选择与当前任务相关的 profile/context，而不是无差别注入。
  https://arxiv.org/abs/2304.11406
- BIPIA / indirect prompt injection：第三方内容和指令边界混淆是风险来源，边界提醒和显式 reminder 是有效防线方向。
  https://arxiv.org/abs/2312.14197

## 发现的问题

Prompt Config 已经有风险提示、敏感字段提示、保存前确认、草稿/基线回执和保存影响。但真实用户点击保存或融合被拦住时，当前只看到一条错误 toast。问题在于：

- 用户不知道本次到底有没有写入本机配置、记忆服务备份或用户画像。
- 暂停/重新开启注入后，用户不知道应该确认风险、改写提示词，还是去上下文页签删除疑似凭据。
- 阻塞是安全行为，但缺少“恢复路径”，容易被理解成保存失败或系统卡住。

## 改进计划

1. 在 `prompt-config.tsx` 增加安全阻塞回执状态，区分提示词风险、用户上下文疑似凭据、融合前安全阻塞。
2. 保存/融合被阻止时显示持久回执：本次没有保存、没有触发真实分析、没有写入/备份到记忆服务或用户画像，真实分析仍读取已生效基线。
3. 回执里给出下一步：切到提示词页确认/改写，或切到对应上下文页签删除 secret/确认引用。
4. 用户编辑、确认风险、确认敏感字段、保存成功、重新加载或重置时清理过期回执。
5. 更新 `verify-custom-prompts:e2e` 覆盖保存阻塞和融合阻塞回执。
6. 更新 `docs/features/custom_prompts.md`，保持文档为当前行为摘要，不写过细实现。

## 验证计划

- `npm run verify:custom-prompts`
- `npm start` 到第一次 successful compile 后停止
- `npm run verify:custom-prompts:e2e`
- 路径级 `git diff --check` 覆盖本轮触碰文件
