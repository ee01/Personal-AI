# Source Memory 召回卡片资料回执 Plan

## 目标

随机命中的功能是 `Source Memory 召回卡片`（Memory Capture）。当前卡片已经有资料类型、保存方式、来源安全和详情打开能力，但这些信息散在 meta chip / source status 中。改进目标是在首屏增加资料专属回执，让用户不用推断就能知道这条提示是已保存资料证据、当前蒸馏状态、可复核入口和只读边界。

## 外部参考

- NotebookLM 把上传/导入的内容明确称为 sources，并说明回答会基于选中的 sources；这支持把资料来源/选中范围作为第一屏对象。
- Perplexity API 的 citation guide 强调 search results 与生成文本引用之间要能实时映射；这支持把“详情/来源可复核”放在用户行动前。
- CHI 2025 RAG trust work指出 source attribution 和高亮来源片段比单独 confidence 更能提升理解与信任。
- EMNLP 2024 MIRAGE 论文指出自引 citation 可能格式错误、引用不存在或不能反映实际上下文使用；这支持保留“只读资料，不确认事实”的边界。

## 实施步骤

1. 在 `src/web-intelligence/contextRecallGuards.ts` 增加 `buildSourceMemoryRecallReceiptItems()`，从 `type/sourceLabel/metadata/whyRelevant/exploreLink/sourceLinks` 生成稳定的资料回执行。
2. 在 `src/contentScriptWebIntelligence.ts` 的 Expanded Card 中仅对 `source_memory` 渲染 `资料回执`，样式复用现有 receipt 语言但与 Rehearsal 分开。
3. 扩展 `tools/verify-webpage-memory-detection.ts` 和 `desktop-app/scripts/webpage-memory-detection-check.mjs`，覆盖 ready distillation、敏感来源隐藏时的详情可复核和只读边界。
4. 更新 `docs/features/memory_capture.md` 与 `docs/features/index.md` 的简要说明。
5. 验证：`npm run verify:webpage-memory-detection`，`npm start` 首次成功编译，`npm run verify:webpage-memory-detection:e2e`， scoped `git diff --check`。
