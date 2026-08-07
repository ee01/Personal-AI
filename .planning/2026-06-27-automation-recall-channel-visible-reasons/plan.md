# 四通道召回可见原因回执

## 目标

- 随机目标：`四通道召回`（Memory Service）。
- 本轮 reroll 说明：第一次随机落到 `记忆导入/导出/备份`，但 automation memory 标记 2026-06-25 刚做过该 exact surface，因此 reroll 到 `四通道召回`。
- Reminder 状态：本机 Reminders 可读，但不存在 `Personal AI` 列表；本轮没有 Reminder 条目可合并或完成。

## 现状

- `docs/memory_system.md` 已描述四通道召回和 `召回通道回执`。
- `RecallEngine` 已返回 `channelDiagnostics.reason`，例如 vector embedding 不可用时返回 `embedding_unavailable`。
- 搜索结果页目前只把原因放进通道 chip 的 `title`。真实用户在移动端、截图、键盘导航或不 hover 时只看到“语义未运行”，看不到“为什么没运行”。

## External Scan

- Azure AI Search hybrid search 官方文档说明 keyword 和 vector 并行运行，并用 RRF 合并结果；产品语义上应让用户知道当前融合结果由哪些检索路径构成。
- OpenAI Memory Sources 让用户检查个性化回答背后的来源，并可标记 relevant / not relevant，说明记忆召回需要可解释的来源和反馈入口。
- Microsoft 365 Copilot Semantic Index 说明检索会结合 Microsoft Graph、语义索引和权限关系；关系/权限通道缺席会影响用户对结果完整性的判断。
- GraphRAG、LightRAG 和 RAPTOR 都强调不同检索结构覆盖不同问题：图谱补关系，层级摘要补长文全局上下文，混合检索补 keyword/vector 的互补盲区。因此 Personal AI 不应把通道缺席压成一个不可见 tooltip。

## Plan

1. 不改 RecallEngine 排序、候选合并或后端 schema，只改展示层。
2. 在 `formatRecallChannelReceipt()` 中把跳过/失败原因整理成可见 `diagnostics` 行。
3. 搜索结果页在 `召回通道回执` 下展示这些原因，例如 `语义未运行：语义索引不可用`。
4. 补 `tools/verify-memory-search-results.ts` 和 `tools/verify-memory-search-scope-e2e.mjs` 断言。
5. 更新 `docs/memory_system.md` 说明原因现在是可见回执，不再只依赖 hover title。
6. 验证：targeted helper、`npm start` 首次成功编译、搜索页 E2E、scoped `git diff --check`。
