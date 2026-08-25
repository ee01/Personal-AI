# Webpage Analysis 前端迁移 Plan

_创建: 2026-08-25 · 状态: 待评审 · 母文档: [usage-analytics-cost-reconciliation-plan.md](usage-analytics-cost-reconciliation-plan.md) §6_

## 目标

把网页快照的 LLM 分析从**后端服务 key**（claude-sonnet-4-6，7d 5,963 次 / 17.49M tok，占后端量 55%，workday run-rate ≈$120+/月）迁到**前端用户 key**（options 中用户自己配置的 LLM）。后端路由保留 + 降档模型，仅供 desktop-app / e2e 使用。

设计哲学（Esone 已确认）：**用户触发的内容分析用用户的 key；memory service 专注记忆沉淀/理解/二次加工**（heartbeat、consolidation、dreaming、keystone 继续用服务 key）。

## 现状 vs 目标链路

```
现状:  contentScript 抓正文 → background.ts(缓存/退避) → POST /source-memory/webpage-analysis
       → PassiveWebpageAnalysisService → 服务 key + Sonnet 4.6 → 结果返回前端 → 前端驱动候选入库

目标:  contentScript 抓正文 → background.ts(缓存/退避不变) → callLLMJsonAPI(用户 key)
       → 结果本地校验 → 前端驱动候选入库（/candidates/* 不变，无 LLM）
       后端路由保留（降档模型 + 配额护栏），仅 desktop/e2e 调用
```

可行性依据（已核实）：路由无状态（跑完即返回、不落库）；`buildPassiveWebpageAnalysisPrompt` 自包含；前端已有 `callLLMJsonAPI` + `webpageAnalysisBackgroundCache` + `WebpageAnalysisFailureBackoff` 全套设施；候选入库本来就由前端驱动。

## 实施步骤

### Phase A：前端直连（核心）

1. **移植 prompt**：`buildPassiveWebpageAnalysisPrompt` + 输入清洗（`canonicalizeUrl` / `normalizePageText` / 12k 截断 / 注入防护文案）复制为 `src/web-intelligence/passiveWebpageAnalysisPrompt.ts`。PROMPT 版本号标 `passive-webpage-memory-v2-fe`，与后端 `PASSIVE_WEBPAGE_ANALYSIS_PROMPT_VERSION` 建立对照注释，两边改动需互相同步（在两个文件头部互写提醒注释）。
2. **background.ts 切换调用**：网页分析处改为 `callLLMJsonAPI({ prompt, capability: CAPABILITIES.MEMORY_CAPTURE, feature: 'passive_webpage_memory_analysis' })`（沿用历史前端版本的 feature 名，dashboard 口径延续）。缓存 key、退避、in-flight 去重逻辑不动。
3. **结果轻校验**：前端加 `parsePassiveAnalysisResult()`——校验 `decision ∈ {skip, remember, update_existing}`、数组字段存在、`skip` 时强制清空 facts/entities/actionItems（后端 service 有同款收口逻辑，需一并移植，防止小模型不守规矩）。
4. **开关与灰度**：options 加 `WEBPAGE_ANALYSIS_VIA_LOCAL_KEY`（布尔）。灰度顺序：esone.qiu 先开 → 观察 3–5 天 dashboard（质量 + 失败率）→ 默认开。**未配置前端 key 的用户**：Phase A 期间回退后端（此时后端已降档，见 Phase B）；Phase C 移除回退，改为 Options 引导配 key + 分析停用提示。
5. **A/B 抽查**（切默认前）：同批 ~20 个真实页面双跑（前端用户 key vs 后端 Sonnet），对比 decision 一致率与 durableFacts 数量/质量。nano 档若 decision 一致率 <80%，考虑在 options 建议用户为该功能配置中档模型（`OPENAI_REVIEW_MODEL` 同款机制）。

### Phase B：后端降档 + 护栏（与 A 并行，立即可做）

6. **模型降档**：`PassiveWebpageAnalysisService` 支持 `WEBPAGE_ANALYSIS_MODEL` env（如 kimi-k3 / deepseek 档），不再吃 `LLM_PROVIDER` 默认的 Sonnet——即使迁移灰度期间，后端兜底的烧钱速度也先降一个数量级。
7. **配额护栏**：路由加 per-user 每日调用上限（env `WEBPAGE_ANALYSIS_DAILY_LIMIT`，默认如 300），超限返回 429 + 明确错误码，前端退避处理。防止单个用户/失控脚本再造 radar-poc 级消耗。
8. **bad_request 排查配套**：打点失败事件的 meta 存 provider 错误文本前 200 字符（母 plan B9）——当前 8/24 起 webpage-analysis 集中出现 458 次 bad_request 无法定位就是因为没存错误文本。

### Phase C：收尾

9. 移除"未配 key 回退后端"逻辑；后端路由文档标注"仅 desktop/e2e"。
10. 更新 `docs/features/usage_analytics.md`（网页分析口径：前端 feature `passive_webpage_memory_analysis` 为主，后端 route 仅 desktop/e2e）与 `web_intelligence_*` 文档。

## Side effects 与对策

| # | 影响 | 对策 |
|---|---|---|
| 1 | 模型质量下降（nano vs Sonnet） | 步骤 5 的 A/B 抽查设阈值；可引导用户配中档模型 |
| 2 | 未配 key 用户停摆 | Phase A 回退降档后端 → Phase C 改引导提示 |
| 3 | Prompt 迭代变扩展发版节奏 | 两侧版本号对照注释；重大 prompt 改动走扩展发版 checklist |
| 4 | desktop/e2e 依赖后端路由 | 路由保留（降档 + 配额） |
| 5 | 网页内容发往用户自选 endpoint | 用户自己配置的 key/endpoint，知情且可控；注入防护 prompt 原样移植 |
| 6 | Analytics side 迁移 | telemetry 已覆盖 frontend；dashboard「仅前端」视图可见；验收见下 |

## 验收标准

- dashboard：`/source-memory/webpage-analysis`（backend route）调用量降至仅 desktop/e2e 水位（<50 次/周）；前端 `passive_webpage_memory_analysis` feature 量对应上升
- 服务 key（Console "Personal AI - memory service"）日消耗较迁移前下降 ≥50%
- A/B 抽查 decision 一致率 ≥80%，remember 页面的 durableFacts 平均条数不低于后端版的 70%
- 未配 key 用户在 Options 看到明确引导，无静默失败

## 回滚

`WEBPAGE_ANALYSIS_VIA_LOCAL_KEY` 关闭即回后端路径（Phase C 之前随时可回）。

## 明确不做

- 后端 BYOK（per-user LLM key 存服务端）——多用户规模化时再评，见母 plan §6 选项 B
- 移除后端路由
- 迁移 heartbeat / consolidation / dreaming / keystone 等沉淀类任务（定位就该在服务端）
