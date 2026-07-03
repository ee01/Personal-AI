# Ask 查证与缺口回执改进计划

## 目标功能

- 随机选中功能：`Ask 主动问答`
- 主文档：`docs/features/ask.md`
- 当前用户路径：用户在记忆搜索首页发起 Ask，答案区展示文本、证据、活答案回执和范围回执。

## 本轮观察

1. `/ask` 后端已经能返回 `resolutionState`、`missingInfo`、`followUpActions` 和 `externalEvidence`。
2. `memory-store` 只保留 answer、evidence、answerMemory、scopeReceipt、blocks 和 channelDiagnostics，导致 Search Result Ask UI 丢失查证队列和证据缺口状态。
3. 作为用户，看到一个“部分回答”时无法判断 Personal AI 是已创建外部查证、只是缺证、还是已经拿到外部证据；这会放大对 Ask 答案的误信。

## 外部参考约束

- ChatGPT / Claude memory 产品都强调记忆来源、项目/范围边界和用户可控性。
- CONQRR、QReCC、Apple question rewriting 等 conversational QA 研究支持先澄清或重写短问句再检索。
- STALE 这类 agent memory 研究提醒：系统检索到旧状态或新证据后，必须显式区分旧假设、当前证据和仍未确认的缺口。

## 实施计划

1. 在 `src/modals/memory-store.ts` 透传 Ask 的 `resolutionState`、`missingInfo`、`followUpActions` 和 `externalEvidence`。
2. 在 `SearchResultPage.vue` 的 Ask answer section 增加 `Ask 查证回执` / `Ask 缺口回执`。
3. 回执展示动作数、完成/队列/失败/需人工、外部证据数和缺口数。
4. 回执文案明确：查证动作不等于结论已确认，不代表用户发消息，不把缺口写成长期事实。
5. 扩展现有 memory-search E2E mock，验证真实扩展页面会渲染这些状态。
6. 更新 `docs/features/ask.md`，只记录当前行为边界，不展开过细实现。

## 验证计划

- `npm --prefix memory-service test -- --run src/__tests__/api-ask.test.ts src/__tests__/answerMemoryService.test.ts`
- `npm start` 到第一次成功编译后停止
- `npm run verify:memory-search-feedback:e2e`
- `git diff --check -- src/modals/memory-store.ts src/modals/components/SearchResultPage.vue tools/verify-memory-search-feedback-e2e.mjs docs/features/ask.md .planning/2026-06-17-automation-ask-followup-receipt/plan.md`
