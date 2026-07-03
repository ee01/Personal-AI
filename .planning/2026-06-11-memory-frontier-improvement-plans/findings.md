# Findings & Decisions

## Requirements
- 用户要求：把本会话综合报告的每条建议整理成「完整可落地的方案」；已在正确方向的找增量；大改造单独成 plan 文档存 docs/progressing/，稍后分开实现。

## 建议清单（来自综合报告，待逐条对照代码）

### P0（低成本高收益）
1. **缝合可感知**：跨来源结论在 Lens/Storyline/通知上加「N 来源 × M 天」徽章（书的"最致命错位"教训：AI 台面下做了网状缝合，台面上只展示普通摘要）
2. **行为亲密度 → SalienceScorer**：把 ambient_calibration_traces 聚合成 per-entity/per-source 亲密度因子进打分（书的排序配方：组织关系/信息性质/行为亲密度）
3. **graph 通道升级 PPR**（HippoRAG，arXiv:2502.14802）：RecallEngine 加 2–3 步个性化 PageRank，sqlite 邻接表 + JS 即可
4. **LongMemEval 风格体检套件**：evals/ 加端到端五能力 case（信息抽取/多会话推理/时序推理/知识更新/拒答），固定 judge 模型与提示词；对齐 LongMemEval-V2（2026-05）题型；HaluMem（记忆幻觉）方向 TruthMaintainer 应有优势

### P1（中成本）
5. **补两个时间场景**：高压后 catch-up（离开 N 小时回来按 salience 缝合摘要）+ 晚间收尾（"今天的事都交代好了"确定性卡片），复用 Today Pilot 基建（书的三段式场景：晨间排兵/会后补课/晚间查漏）
6. **chunk 级合并决策 + 记忆演化**：Consolidation 加 Mem0 式 ADD/UPDATE/DELETE/NOOP 与 A-MEM 式旧记忆元数据改写（arXiv:2502.12110，记忆再巩固）
7. **sleep-time 预计算**：dreaming/夜间巩固追加「预答明天可能的问题」通道（meeting prep 是雏形，推广到非会议）+ 失败复盘通道（被纠正的回答 → guardrail 规则）（Letta sleep-time compute arXiv:2504.13171）
8. **ProactivityPolicy 显式建模漏报/误报不对称**（书：「成本约束精打细算 vs 重要信息因静默被错过」；ProAct 论文族：意图预测 × 时机成本两因子，通知附依据记忆引用）

### P2（战略层）
9. **MCP server 接口**：跨 AI 平台记忆愿景的捷径（2026 事实标准；mem0/redis/basic-memory 均已提供）
10. **级联删除 + "真正可删除"叙事**：删 episode → 重算受影响的蒸馏记忆（derived_from 溯源；Agentic Unlearning arXiv:2602.17692 再污染问题）
11. **设计原则文档化**：①观察不产生副作用（书：已读恐怖主义/责任迁移红线）；②每个新 surface 必须先有反馈闭环和 eval case 才算入账（反"每日一包"记账法）

### 补充（论文代理完整版新增）
12. **记忆注入防护** ⚠️：网页捕捉是 prompt injection 攻击面（SpAIware）；①召回注入 prompt 时网页来源内容用中性框架包裹；②高置信自动入库的网页做指令剥离/可疑模式检测
13. **经验跟随质量门控**（arXiv:2505.16067）：坏经验同样复利；SkillLibraryService/writing style/工作流记忆写入侧质量门控（正反馈或验证通过才可检索），执行侧回写 success_count，失败多触发改写或退役
14. **TTL 缓冲区**（Gemini Temporary Chats 模式）：低置信捕获先进 72h TTL 缓冲，夜间巩固确认有价值才转长期，否则自动过期
15. **L0/L1/L2 渐进加载**（OpenViking）：写入时生成一句话/概览/全文三级，召回注入按需取级，省 token
16. **Recent digest 标准注入块**：active_focus_digest 提升为所有入口（/ask、compose、quick-ask）标准注入块（ChatGPT "Recent Conversation Content" 性价比之王）
17. **洞察查询端点**（honcho dialectic API）：ProfileManager 暴露"这个用户会怎么想/偏好什么"的洞察查询，返回洞察而非原文
18. **六操作完备性**（arXiv:2505.00675）：consolidation/indexing/updating/forgetting/retrieval/compression 自查——独立 forgetting 端点与 compression 当前未显式暴露

## Research Findings

### docs/progressing plan 文档格式惯例（取样 memory-outcome-loop-plan.md, 1481 行）
- 标题：`# 新能力：<英文名> / <中文名>`；头部引用块：生成时间 CST、会话标题建议、交付物、Demo 链接（可选）
- 第一节必是 `## 结论`（结论先行，一句话产品定义 + "它不是什么"边界）
- 常见节：反馈澄清/真实边界、现状、方案设计（数据模型/API/流程图 text diagram）、实施切片、验证
- 既有 plan 多配套 `*-demo.html`；本批新 plan 不做 demo（用户未要求），在索引中注明可后补
- 新 plan 目标长度 150-300 行：完整但不铺张（既有文档有的 1400+ 行，过长）

### 盘点 A：Salience / Recall / 反馈链路（代码事实）
- **SalienceScorer.ts:62-69** 公式 `S = 0.35*importance + 0.20*frequency + 0.15*recency + 0.10*surprise − 0.05*max(0,redundancy−0.7) + 0.15*userInterestBoost`；STORAGE_THRESHOLD=0.3（:54）；输出 memory_metadata.salience_score / effective_salience
- **行为亲密度缺失确认**：打分仅有 userInterestBoost（user_profile_items 关键词匹配 :239-272）+ 事后 access_count 强化；无点击/hover/停留/回复速度信号 → 建议 2 成立
- **RecallEngine.ts** 4 通道各 topK*3=30；融合=type:id 去重+多通道 bonus 0.05/通道（:1310-1356）；MMR=0.7*rel−0.3*maxSim（:1503-1583）；relevance=(score+0.15*recency+0.1*effectiveSalience)*lifecycleWeight；召回后 fire-and-forget 强化 +0.02 salience（:1593-1646）
- **Graph 通道现状**（:1055-1231）：1 跳全量 + 2 跳 strength*0.5 折扣，无 PPR、无种子权重、无全局图分数 → 建议 3 成立（已有 2 跳基础，升级成本低）
- **图表结构**（migrations/001:87-156）：entities(importance, access_count, mention_count, status) / relationships(strength, co_occurrence_count, evidence_message_ids_json) / entity_properties(双时态)
- **反馈两条线均 query-time 实时**：①outcome（037 migration）events→policy（2 次负反馈→suppress TTL7d；sent_after_insert→boost TTL14d）作用于 cue 编译；②recall_relevance_patches（036）hide/demote −0.35 scene-scoped。**均不回写 SalienceScorer/RecallEngine 主排序** → 建议 2 的接入点：把 outcome/trace 聚合为亲密度因子进 salience 或 recall relevance
- **无全局注意力预算**：topK 控制 + jira_estimate 场景单 cue；displayPriority hidden/p1/p2 由 patch 驱动 → 建议 15/16 的挂点在 prompt 组装层
- **Prompt 组装**（ask.ts）：formatRecalledContext `- [n] (source) [date] [title] content`（:494-523）；buildPromptEnvelope 无中性框架包裹（:926-945）；SYSTEM_PROMPT 有 "Answer only from the provided context"（:190-208）；网页内容仅 HTML 剥离（:709-723），**无指令剥离** → 建议 12 成立

### 盘点 B：Ingest / Consolidation / Truth / Forgetting / 删除（代码事实）
- **IngestionPipeline.ts** 10 步；去重两层（postId → content_normalized+source+sender）；salience≥0.3 才索引（decision: stored_unindexed）；decision 回执字段齐全
- **写入策略 = 仅 INSERT**：messages/chunks 无 Mem0 式 ADD/UPDATE/DELETE/NOOP；entities UPDATE mention_count、relationships UPSERT co_occurrence+1、profile items UPSERT → 建议 6 成立（chunk 级合并缺失）
- **ConsolidationEngine.ts:127-914** 6 阶段：①Compress=日汇总 daily/{date}.md；②Denoise=hash+embedding>0.92 → memory_metadata.status='archived'；③Structure=projects/{slug}.md；③.5 Profile=salience 衰减(0.995~0.96)+superseded 迁移+证据合并+重建 USER_CORE.md；④Clean=ForgettingEngine；⑤Reindex=markdown 重索引；⑥Reflect=日反思 JSON→reflection_artifacts。**profile 层已有演化（supersede），chunk/message 层无 A-MEM 式改写** → 建议 6 部分成立
- **TruthMaintainer.ts:114-817**：entity_properties 双时态 (tx_start/end + valid_from/to)，status 五态，AUTHORITY_WEIGHTS official1.0→dream0.2，冲突→confirm_requests；is_final 保护
- **ForgettingEngine.ts**：S(t)=S0*exp(−t/(T*decay_rate))；<0.05→forgotten、<0.15→archived；levels: temporary/working/consolidated/core（permanent/forgotten/archived 豁免）；强化 increment=5/(1+access_count)，decay_rate*=0.9，half_life*=1.1（cap365d）。**注意：forgotten/archived 的 chunk 仍留在向量索引中未清理**
- **GenerativeReplay.ts:131-532**：近 30 天 top-5 salient entities→recall top-8→LLM dream→新 relationship(confidence0.3, source='generative_replay')+reinforce+dreams/*.md+回流 thread
- **TTL 现状**：仅 proposed_actions.expires_at / confirm_requests.expires_at；记忆无 TTL/试用期机制 → 建议 14 成立
- **删除级联**（routes/memories.ts:293-387）：DELETE /memories（source+scope）级联 chunks_vec/chunks/messages_vec/messages_raw/memory_metadata；**不级联 entity_properties.source_message_id、relationships.evidence_message_ids_json、reflection_artifacts** → 建议 10 成立（孤儿引用风险实在）；source_memory_capsules 自带 ON DELETE CASCADE（参照样板）
- 溯源列已有：entity_properties.source_message_id、relationships.evidence_message_ids_json、user_profile_items.evidence_refs、reflection_artifacts.source_message_ids_json → 级联重算的数据基础存在

### 盘点 C：主动服务 / 技能 / 路由面（代码事实）
- **ProactivityPolicy.ts:158-178** `utility = benefit − cost`；benefit=0.35*importance+0.25*urgency+0.20*confidence+0.20*actionability；cost=quietCost(0.5)+spamPenalty(0~1)+prefCost(0~1)；阈值 notify≥0.40 / confirm_only≥0.25 / silent≥0.10；throttle=10 条/天+同 topic 24h。**无漏报/误报代价区分** → 建议 8 成立
- **notification_records 无 evidence 列**（证据只在 payload 里）→ 通知附记忆引用是真缺口
- **TodayPilotMeetingPrepService**：nightly_llm cron 预计算（36h horizon，5 meetings）→ sleep-time 预计算已有"会议版"先例；**无 catch-up、无晚间收尾场景** → 建议 5、7 成立
- **SkillLibraryService**：无执行日志/success_count（仅 binding.lastError）；skill 不注入 ask/composer prompt → 建议 13 成立
- **UserWritingStyleMemoryService:102-103** 晋升门槛：证据≥3 + confidence≥0.68 → 质量门控可复用先例
- **49 个路由文件；无 MCP server；无 forgetting/compression 端点**（ForgettingEngine 仅由 daily cron 内部触发）→ 建议 9、18 成立
- **ProviderContextService.ts:620-726** renderActiveFocusDigest（salience≥0.35、14 天窗、rolling、session_context）只服务 providers（豆包桥接）；**ask/composer 的 prompt 组装无"近期重点"标准块** → 建议 16 成立
- HeartbeatLoop 任务清单（:190-299）：microConsolidate / checkProfileDirty / decision snooze / conflicts / watchedProjects / deadlines / dreamDigest / ReflectionPlanner.runHeartbeat / ActionExecutor.runDueActions(10)

### 盘点 D：既有 plan 重叠结论（行动建议定稿依据）
- **已 P0 落地**：outcome-loop（jira estimate cue 闭环）、day-pilot（OverviewPage 部分）、proactive_notification_system（policy 已跑）
- **候选未实现**：relevance-trainer、freshness-radar、context-recall-experience-eval（协议已定 E2E 未写）、source-memory-distiller、ai-context-passport、day-pilot 完整版
- **明确搁置（需改形态再复活）**：intake-quality-gate（不做 review queue）、lifecycle-gardener（改 Ambient Forgetting）、reflection-governor、trust-console、egress-firewall、working-memory-return-stack（自动意图检测不可靠）、agent-memory-control-tower、reality-check
- 18 条建议中 12 条与既有 plan 高重叠；3/7/10/13/14/17 需新建或深化

## 分组定稿（Phase 2 决议）
新建 11 个文档（10 plan + 1 索引），3 条并入索引快赢清单：

| 新文档 | 覆盖建议 | 关系 |
|---|---|---|
| memory-frontier-2026-index.md | 总索引 + #11 设计原则文本 + #15/#16/#17 快赢条目 | 引用全部 |
| memory-recall-ppr-association-plan.md | #3 | 新方向（graph 通道已有 2 跳基础） |
| memory-salience-behavioral-intimacy-plan.md | #2 | 复用 outcome/calibration 数据，回写 salience/recall 主排序 |
| memory-weave-provenance-visibility-plan.md | #1 | 新方向 + 补 notification evidence 列 |
| memory-longmemeval-benchmark-plan.md | #4 | 扩展 context-recall-experience-eval-plan |
| memory-injection-defense-plan.md | #12 | 入口侧防护；与 egress-firewall（出口侧）互补 |
| memory-merge-evolution-ttl-plan.md | #6+#14+#18 | 升级 ingest/consolidation；含 forgetting/compression 端点 + 向量索引清理 |
| memory-sleep-time-compute-plan.md | #7+#5 | meeting prep 先例推广 + catch-up/晚间收尾两场景 |
| memory-proactivity-cost-asymmetry-plan.md | #8 | ProactivityPolicy utility v2 |
| memory-mcp-server-plan.md | #9 | 新接口层 |
| memory-cascade-deletion-plan.md | #10 | 修孤儿引用 + derived_from 级联 |
| skill-experience-quality-gate-plan.md | #13 | 复用 writing-style 晋升先例 |

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 不直接修改搁置中的既有 plan 文档 | 搁置有明确产品理由；新 plan 在"与既有 plan 的关系"节中引用并说明形态差异 |
| #11 设计原则不单独成 plan | 是文档增补不是工程项目；原则文本直接写进索引文档供拷贝进 memory_system.md |
| #15/#16/#17 作为索引内快赢条目 | 各自改动面小（单文件级），不值得独立 plan |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- 书原文文本：/tmp/zhishen.txt（333 页 PDF 已提取）
- ChatGPT 对话提取：/tmp/chatgpt_conv.txt
- 关键论文：HippoRAG2 2502.14802 / A-MEM 2502.12110 / sleep-time 2504.13171 / Mem0 2504.19413 / Zep 2501.13956 / LongMemEval 2410.10813 / experience-following 2505.16067 / 操作分类学 2505.00675 / ProAct 2605.25971 / ProMemAssist 2507.21378 / Memory-R1 2508.19828 / Agentic Unlearning 2602.17692
- 业界对照：docs/features/memory_system.md「与业界记忆系统对比」节（1111-1138 行）
