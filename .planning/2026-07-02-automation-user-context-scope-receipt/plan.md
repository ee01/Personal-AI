# 用户上下文注入范围回执改进计划

## 选中功能

- 随机候选：`用户上下文注入`
- 所属能力：Prompt Config
- 主文档：`docs/features/custom_prompts.md`
- 主要代码：`src/modals/prompt-config.tsx`、`src/services/userConfigPreview.ts`

## 当前检查

- `docs/progressing/to-verify.md` 当前无待校验事项。
- AppleScript 未列出 `Personal AI` Reminders list；EventKit 可见该 list。
- EventKit 看到 4 条 `Personal AI` item，均已完成，内容是 Doubao 同步或 notification digest 历史反馈，和本次 Prompt Config / 用户上下文注入无直接关系，因此不纳入本次改动，也不需要标记 done。
- 代码已经具备草稿/已保存、注入开关、消息/项目范围、敏感上下文提示、低优先级 `user_context` 包裹。

## 外部参考要点

- ChatGPT Custom Instructions / Memory 把显式长期指令和对话中沉淀的记忆区分，并强调用户可以管理这些内容。
- ChatGPT Projects 与 Claude Projects 都强调项目/工作空间上下文的范围边界，不应把一个工作空间的全部知识默认为所有对话都使用。
- Claude RAG for Projects 说明项目知识会按需检索，而不是一次性全部塞入上下文。
- 个性化 RAG / user memory selection 论文也指出，长期用户画像应按当前任务选择子集，而不是无差别注入完整 profile。

## 改进计划

1. 新增共享 helper，生成当前预览范围的 `范围依据` 回执：
   - `全部`：说明这是审计并集，用来一次性检查消息/项目长期偏好，不代表某次真实分析会同时注入两套专项上下文。
   - `消息`：说明对应真实消息分析会读取的用户上下文和消息提示词。
   - `项目`：说明对应项目、会议、文档和通用内容分析会读取的用户上下文和项目提示词。
2. 在 Prompt Config 的生效预览顶部显示该回执，并在用户上下文页签的首屏范围总览中复用同一口径。
3. 更新目标 verifier 和 extension E2E，覆盖三种范围说明。
4. 更新 `docs/features/custom_prompts.md`，记录该 UX 边界。

## 不做的事

- 不改变真实 prompt 注入内容、存储格式、风险门禁、memory-service 备份或用户画像融合。
- 不实现单条用户上下文开关；这仍需要更细的数据模型和用户决策。
