# 四通道召回：单结果通道边界回执

## 目标

随机抽中 `docs/index.md` 里的 `四通道召回`。本轮只做结果页呈现层改进：当搜索只返回 1 条可见结果时，也显示证据通道交叉/边界回执，避免用户把一个单通道命中误读成多通道交叉验证。

## 发现

- `docs/progressing/to-verify.md` 当前为“暂无”。
- EventKit 能读取本机 `Personal AI` Reminder list；4 条均已完成，且都是历史 Doubao / Notification 反馈，和四通道召回无关。
- `memory_system.md` 已描述 `channelDiagnostics`、召回通道回执和多结果证据通道交叉回执。
- 代码里 `formatEvidenceChannelOverlapReceipt` 当前对 `visibleResults.length <= 1` 直接返回 `null`，导致单结果页没有本地交叉支持边界。

## 外部参考

- Azure AI Search hybrid search：keyword 与 vector 并行后融合，适合作为“通道参与状态要可见”的产品参照。
- Microsoft 365 Copilot Semantic Index：语义索引结合 Microsoft Graph/权限边界，说明关系/权限来源不应被压成一个黑盒总分。
- GraphRAG / LightRAG / RAPTOR：研究侧共同指向平面 chunk 召回的局限，关系结构和摘要层有价值，但也应说明当前证据实际来自哪些路径。

## 实施步骤

1. 让单条可见结果且有 channel metadata 时也返回 `证据通道交叉回执`。
2. 单条单通道文案明确“只有 1 条单通道证据，尚无通道交叉支持”；单条多通道保留交叉组合。
3. 更新 `tools/verify-memory-search-results.ts` 的 helper 断言。
4. 更新 `tools/verify-memory-search-scope-e2e.mjs`，覆盖默认 work 搜索的单结果回执。
5. 简要更新 `docs/memory_system.md`，不改召回算法、排序、反馈写入或 Memory Service API。

## 验证计划

- `npm run verify:memory-search-results`
- `npm start -- --progress` 等首次成功编译后停止
- `npm run verify:memory-search-scope:e2e`
- `npm run verify:i18n`
- `git diff --check -- <owned files>`
