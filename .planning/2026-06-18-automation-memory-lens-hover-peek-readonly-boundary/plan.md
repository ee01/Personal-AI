# Memory Lens Hover Peek 只读边界计划

## 目标

本轮重抽命中 `docs/index.md` 里的 `记忆提示 Hover Peek / Memory Lens`。当前文档和代码已经覆盖强/弱相关、来源 footer、p2 低打扰、拖拽锚点和 Expanded Card 来源状态，但 Hover Peek 本身只显示相关性与来源，不直接说明这是只读提示。用户在 hover/focus 的第一眼可能仍需要进入卡片才知道不会写入网页、插入输入框或发送消息。

## 外部参考

- Microsoft Edge Copilot 页面上下文策略把页面内容访问作为可控制边界：https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/copilotpagecontext
- Slack AI Search 强调答案来自用户已有权限内的消息和文件：https://slack.com/help/articles/31739993134867-Search-with-AI-in-Slack
- Notion Enterprise Search 明确回答会引用来源，方便回到原文：https://www.notion.com/help/enterprise-search
- Context-aware recommender explanation 研究显示解释能改善长期信任，但解释也会带来理解成本；Hover Peek 应保持低负担：https://link.springer.com/article/10.1007/s10462-024-10939-4

## 改进计划

1. 在 `src/contentScriptWebIntelligence.ts` 的 Hover Peek 中新增一行 compact 只读边界：点击只是打开详情，不会保存网页、插入内容或发送消息。
2. 补充 CSS，保持一行可截断，避免抢占 Hover Peek 主体摘要空间。
3. 更新 `desktop-app/scripts/webpage-memory-detection-check.mjs`，覆盖强相关和可能相关 Hover Peek 都显示只读边界。
4. 更新 `tools/verify-webpage-memory-detection.ts` 的源码断言，防止后续移除该边界。
5. 更新 `docs/features/memory_lens.md`，把 Hover Peek 的当前行为写进功能文档。

## 验证

- `npm run verify:webpage-memory-detection`
- `npm start` 首次 successful compile 后停止
- `npm run verify:webpage-memory-detection:e2e`
- `git diff --check -- src/contentScriptWebIntelligence.ts tools/verify-webpage-memory-detection.ts desktop-app/scripts/webpage-memory-detection-check.mjs docs/features/memory_lens.md .planning/2026-06-18-automation-memory-lens-hover-peek-readonly-boundary/plan.md`
