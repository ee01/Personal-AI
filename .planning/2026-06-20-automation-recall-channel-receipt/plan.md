# 四通道召回通道回执

## 目标

- 随机目标：`四通道召回`（Memory Service）。
- 用户体验问题：搜索结果页虽然已经显示各通道 chip，但用户需要先自行理解“语义未运行 / 图谱无命中 / 时间无命中”对当前证据完整性的影响。
- 本轮不改 RecallEngine 排序和候选合并，只补搜索结果页的首屏解释边界。

## Plan

1. 检查 `RecallEngine`、搜索页和功能文档，确认四通道诊断字段是否已经真实返回。
2. 检索业内产品与论文，确认多通道召回应该暴露来源、权限、通道缺席和关系/时间上下文，而不是只给一个黑箱分数。
3. 在搜索结果摘要区新增 `召回通道回执`，说明本轮结果来自几个通道、哪些通道未完整覆盖，以及查看/刷新不会写入或确认答案。
4. 更新 `docs/memory_system.md` 与 `docs/index.md`。
5. 运行 helper、dev compile、搜索页 E2E 和 scoped diff 验证。

## External Scan

- OpenAI Memory Sources：个性化答案需要能查看来源、编辑记忆、标记来源相关性。
- Microsoft 365 Copilot Semantic Index：语义检索结合 Graph、关系和权限边界。
- Azure AI Search RAG：hybrid query 结合 keyword 和 vector 来改善 recall。
- GraphRAG / LightRAG / RAPTOR：关系图、双层检索和摘要层级能补足平面 chunk 检索缺口，但也需要让用户知道当前证据来自哪些检索路径。

