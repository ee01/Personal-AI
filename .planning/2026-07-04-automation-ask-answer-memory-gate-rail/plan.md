# Ask 活答案门控状态栏改进计划

## 目标

- 随机候选：`Ask 活答案记忆`，来源于 `docs/features/index.md`。
- 目标文档：`docs/features/ask.md`。
- 目标代码：`src/modals/components/SearchResultPage.vue`、`tools/verify-ask-clarification-e2e.mjs`。

## 现状

- `AnswerMemoryService` 已经区分 `observed`、`promoted`、`priorHit`、`updated`、`skipped`，并返回 `authority.decision`。
- Search Result 页已经在答案前显示 `Ask 本轮状态`，但权威门控的具体结论主要在答案下方的活答案回执里。
- 真实用户在查看持续状态问题时，最容易误读的是：命中过往活答案后，系统到底是写了新版本、同证据复核未写、还是等待新的权威证据。

## Reminder 检查

- AppleScript 枚举未列出 `Personal AI`。
- EventKit 找到 `Personal AI`，共 4 条，均为已完成的 Doubao / Notification 历史反馈。
- 没有未完成 Ask 相关条目，本轮不标记 Reminder。

## 外部参考

- OpenAI ChatGPT Memory Sources 强调个性化回答旁展示影响来源。
- Claude memory / chat search 强调历史上下文可被检索、汇总、管理，且有项目边界。
- CONQRR、QReCC 等 conversational QA 研究支持把短问句改写成可检索问题，再进入证据检索。
- STALE 指出 agent memory 常见失败是检索到新证据后仍接受旧状态假设，因此旧答案、当前证据和更新门控需要显式区分。

## 改进步骤

1. 在 Search Result 的 `Ask 本轮状态` 里根据 `answerMemory.authority.decision` 生成具体门控摘要。
2. 对 `same_meaning_no_change` 明确展示“同证据同义复核，只记录复核，不写新版本”。
3. 对 `supporting_only` / `wait_for_authority_source` 明确展示“不能改写长期答案，等待当前权威证据”。
4. 保留 `authorized_change` 的成功语义，但说明它只是允许创建/更新活答案版本，不代表外部动作。
5. 用现有 Ask E2E mock 覆盖同证据同义复核状态栏，并确认状态栏仍在答案正文之前。
6. 更新 `docs/features/ask.md` 的 UI 行为描述和验证清单。

## 验证

- `node --check tools/verify-ask-clarification-e2e.mjs`
- `npm start -- --progress` 首次成功编译后停止
- `node tools/verify-ask-clarification-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/answerMemoryService.test.ts src/__tests__/api-ask.test.ts`
- scoped `git diff --check`
