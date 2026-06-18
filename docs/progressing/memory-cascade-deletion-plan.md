# 信任升级：级联删除与可删除性 / Cascade Deletion & True Deletability

> 生成时间：2026-06-11 CST
> 来源：盘点 B 确认的孤儿引用缺口 + Agentic Unlearning 再污染（arXiv:2602.17692）+ GDPR 删除权对 AI 记忆的适用 + 「真正可删除的记忆」差异化定位
> 优先级：P2（正确性债 + 信任卖点）
> 预估规模：4-5 天（lineage 工具 + 级联修复 + 重算钩子 + 对账脚本）

## 结论

修复删除路径的**级联完整性**：删除一条 message/capsule 时，所有派生物（entity_properties、relationships 证据、反思/梦境引用、向量与 FTS 索引、缝合摘要）要么级联清理、要么触发重算。目标是能对用户承诺一句大厂给不了的话：**"删了就是删了——包括它留下的影子。"** 参数化记忆做不到 unlearning，外部记忆的可删除性是本系统的结构性优势，前提是把它做实。

它不是：
- 不是把软删除改成物理删除（forgotten/archived 的生命周期语义不变；本 plan 管的是**用户显式删除**时的彻底性）
- 不是新的删除 UI（DELETE /memories 与 memory-exploring 既有入口不变，变的是删除的深度）
- 不是每次删除都全库重算（影响图按 lineage 精确定位，只重算受影响的派生物）

## 假设场景：一步步的体验（无 UI，before/after 数据对比）

**人物与背景**：5 月里你把一段私人对话（某来源 `ringcentral:private-x`）同步进了记忆库；6/1 的夜间反思把其中一条信息蒸馏进了周报摘要。现在你想彻底删掉这个来源。

**Before（现状）**

```
DELETE /memories {source: "ringcentral:private-x", scope: "personal"}
→ { deleted: { messages: 41, chunks: 38 } }          // 看起来干净了
```

实际残留：

```
entity_properties   3 行 source_message_id 指向已删消息（孤儿）
relationships       evidence_message_ids_json 含 5 个失效 id（脏数组）
reflections/2026-06-01.md   仍写着「…私人对话中提到 X 决定离职…」
```

两周后你问 /ask「最近有什么人事变动」→ 反思摘要被召回 → **已删除的信息被复述出来**（再污染）。

**After（级联 + 重算）**

```
DELETE /memories {source: "ringcentral:private-x", scope: "personal"}
→ { deleted: { messages: 41, chunks: 38 },
    cascade: { vecRows: 38, ftsRows: 38, entityProperties: 3,
               evidenceTrims: { relationships: 5, profileItems: 2 },
               orphansArchived: { entities: 1 },
               recomputeQueued: { reflections: 2, dreams: 1 } } }
```

- 心跳异步消费 recomputeQueue：`reflections/2026-06-01.md` 中该句替换为 `[已删除的来源]`，frontmatter 标 `evidence_redacted: true`；其中一篇反思全部证据被删 → 整篇 retracted，不再被 Reindex 索引。
- 一条 profile item 证据数从 3 掉到 1（低于晋升阈值）→ 状态回退 candidate。
- 再问 /ask「最近有什么人事变动」→ 「相关来源已被你删除，没有可引用的记忆。」（abstention，体检 plan 的拒答 case 同源）
- 周频 `tools/memory-integrity-check.ts` 报告：孤儿 entity_properties 0（上线前首跑清掉了历史存量 17 条）。

**红线再确认**：以上级联只由你的显式删除触发；ForgettingEngine 的自动衰减永远只降级、不物理删。

## 依据

- 盘点 B 实测缺口：`DELETE /memories`（routes/memories.ts:293-387）级联了 chunks_vec/chunks/messages_vec/messages_raw/memory_metadata，**但不处理**：entity_properties.source_message_id（孤儿属性）、relationships.evidence_message_ids_json（脏证据数组）、reflection_artifacts.source_message_ids_json（引用已删消息）。
- Agentic Unlearning：参数删除后外部记忆把信息"再污染"回系统——同构风险在本系统内部：消息删了，反思摘要里的结论还在，下次召回照样把已删信息说出来。
- 正例已在库内：source_memory_capsules 全链 ON DELETE CASCADE（migrations 029）——本 plan 把同等纪律推广到 message 链。
- GDPR/删除权：个人 AI 的可信删除是合规友好叙事；ChatGPT/Claude/Gemini 都把"可删除"做成产品语义。

## 现状（代码事实）

- 溯源列已齐（盘点 B）：entity_properties.source_message_id、relationships.evidence_message_ids_json、user_profile_items.evidence_refs、reflection_artifacts.source_message_ids_json、source_memory_takeaways.evidence_anchor_ids_json——**级联重算的数据基础存在，缺执行器**。
- 派生链全景：message → chunks → (entities / relationships / entity_properties / memory_metadata) → (daily.md / projects.md / reflection_artifacts / dreams / reflection_threads / anticipation_briefs*) → user_profile_items（evidence 聚合）。(*若 sleep-time plan 落地)
- 删除入口：DELETE /memories（source+scope 批删）；profile DELETE /profile/items/:id；capsule archive。**无单条 message 删除端点**（只能按 source 批删）。

## 方案

### 1. Lineage 解析器（core/memoryLineage.ts，纯查询）

```
resolveImpact(messageIds[]) → {
  hardCascade:   { chunks, vec rows, fts rows, memory_metadata }          // 直接删
  evidenceTrim:  { relationships: [{id, removeIds}],                      // 从 JSON 数组剔除
                   profile_items: [{id, removeRefs}], ... }
  orphanCheck:   { entity_properties: [...], relationships: [...] }       // 证据清空→整条处理
  recomputeQueue:{ reflection_artifacts: [...], reflection_threads: [...],
                   daily_md: [dates], dream_runs: [...] }                  // 派生结论重算/标注
}
```

### 2. 级联执行（事务内，扩展现有 DELETE /memories）

- hardCascade：补上现缺的三处（entity_properties by source_message_id；relationships/profile 的 evidence 数组剔除；FTS 触发器核对）。
- 孤儿规则：evidence 被清空的 relationship → 删除；entity 的全部 property/evidence 清空且 mention_count 归零 → status='archived'（实体名本身可能仍有其他来源，不武断删）。
- recomputeQueue 异步消费（heartbeat 新任务 `processDeletionRecompute`）：
  - reflection_artifacts / dream md：含被删引用的，文内替换为 `[已删除的来源]` 并在 frontmatter 标 `evidence_redacted: true`；若其**全部**证据被删 → 整篇标 retracted（不再被 Reindex 索引）。
  - 受影响的 profile_items：evidence 数掉到晋升阈值以下 → status 回退 candidate（复用 writing-style 阈值语义）。
- 删除回执：响应扩展 `cascade: {chunks: n, properties: n, evidenceTrims: n, recomputeQueued: n}`——与 ingest decision 回执同风格，可审计。

### 3. 单条删除端点 + 对账

- 新增 `DELETE /memories/message/:id`（单条粒度，走同一 lineage 执行器）——当前只能按 source 批删，用户"删这一条"的诉求无解。
- 对账脚本 `tools/memory-integrity-check.ts`（可进 eval-scheduler 周频）：扫孤儿 entity_properties、脏 evidence 数组、vec/FTS 与 active chunks 行数差——**先跑一次清历史存量**，再上线级联保增量。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | lineage 解析器 + DELETE /memories 补级联 + 删除回执 + 对账脚本（报告模式） | 对账零新增孤儿；回执计数与实删一致 |
| P1 | recompute 异步队列 + reflection/dream 标注 + profile 回退 | 删除后 /ask 不再引用已删信息（红队 case） |
| P2 | 单条删除端点 + 存量清理执行档 + memory-exploring 删除入口接单条 | E2E：删一条消息 → 全链路无残影 |

## 验证

- 红队主案（再污染防护）：注入事实 X → 跑巩固生成反思 → 删除 X 的来源消息 → `/ask 问 X` 必须拒答或明示来源已删（这是 Agentic Unlearning 场景的直接复现测试）。
- 单测：lineage 影响图（多对多 evidence、共享实体）、孤儿判定边界、事务回滚。
- 对账：CI 外周频跑 integrity-check，趋势必须收敛到 0。
- 回归：DELETE /memories 既有契约（响应兼容，新增字段不破坏）；删除性能：千条消息级联 < 5s。

## 与既有 plan 的关系

- `memory-trust-console-plan.md`（搁置）：删除回执与 integrity 报告是其"可信度"叙事的数据层，先有数据后有控制台。
- `memory-merge-evolution-ttl-plan.md`：其 superseded/merged_into 链是 lineage 的新边类型，两 plan 共用 memoryLineage 工具（先落地者建轮子）。
- `memory-coverage-map`（备份导入）：导入的 merge 模式需尊重 retracted/redacted 标记，不复活已删派生物。

## 风险与边界

- markdown 派生物（daily/dreams）是文件不是行——重算用"文内标注 + frontmatter 标记"而非重写全文，保持文件可读历史；用户要求彻底抹除时提供 `--hard` 档重新生成该日文件。
- 性能：lineage 查询全部走已有索引列；evidence JSON 数组剔除是逐行 UPDATE，批删大 source 时分批事务。
- 语义红线：级联只由**用户显式删除**触发；遗忘引擎的自动降级永不触发级联物理删除（自动遗忘 ≠ 用户意志）。
