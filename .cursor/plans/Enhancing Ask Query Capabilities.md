# Ask 智能查询增强计划

## 设计校正（2026-03-10）

在对照现有代码后，原计划有几处需要先纠正，否则实现会偏离当前架构：

1. **不新增平行的 `KnowledgeIndexer`**
当前仓库已经有可复用的 Markdown 索引链路：
- [`MarkdownManager.reindexFile()`](/Users/Esone/git/personal-ai/memory-service/src/core/MarkdownManager.ts)
- [`ConsolidationEngine.phaseReindex()`](/Users/Esone/git/personal-ai/memory-service/src/core/ConsolidationEngine.ts)

本次应直接复用并补齐这条链路，而不是再引入一套新的索引器。否则会出现切块策略、`source_type` 推断、`file_path` 语义不一致的问题。

2. **先做确定性 Intent 解析，不把 LLM 解析放在主链路**
`ask()` 当前已经包含一次召回 + 一次生成。如果再把“意图解析”也放成默认 LLM 调用，会直接增加不必要延迟，并放大失败面。第一版应以：
- 正则/关键词
- 数据库词典（sender、group、watched projects）
- 共享的时间表达式解析

为主。LLM fallback 可以保留为后续增强，但不应成为首批交付的依赖。

3. **项目过滤必须统一“显示名”和“slug”**
现状里：
- `messages_raw.matched_projects_json` 保存的是项目显示名
- `chunks.related_project` / `projects/*.md` 索引里保存的是 slug 风格值

因此不能简单把 `projectNames?.[0]` 直接传给 RecallEngine。实现时必须在 Recall 过滤层统一比较逻辑，允许 `Personal AI` 和 `personal-ai` 命中同一项目。

4. **优先修复现有 reindex 路径语义问题**
当前 [`ConsolidationEngine.phaseReindex()`](/Users/Esone/git/personal-ai/memory-service/src/core/ConsolidationEngine.ts) 使用了绝对路径访问 `chunks.file_path`，而 [`MarkdownManager.reindexFile()`](/Users/Esone/git/personal-ai/memory-service/src/core/MarkdownManager.ts) 使用的是相对路径。这会导致：
- 部分历史 chunk 无法被正确识别/替换
- ask 对 Markdown 知识的召回结果不稳定

本次应先统一为相对路径语义。

5. **专项 SQL 注入和前端分流先降级为后续项**
原计划中的“Supplementary Context 注入”和“聚合/统计查询前端分流”方向没有问题，但它们不属于 ask 检索能力增强的最小闭环。本轮先完成：
- 查询意图解析
- Recall 过滤增强
- 结构化回答恢复
- USER_CORE / reflection / dream 纳入现有索引链路

这样可以先解决现实场景中的主问题：问法识别不准、过滤丢失、生成性知识不可检索、前端结构化区块一直空白。

## 本轮实施顺序

按以下顺序落地，避免交叉返工：

1. 抽出共享的时间表达式解析工具，供 `RecallEngine` 与 `QueryIntentParser` 复用
2. 新增 `QueryIntentParser`，先实现确定性规则解析
3. 扩展 `RecallQuery` / `RecallEngine` 过滤能力（sender、group、importance、sourceType、项目规范化匹配）
4. 改造 `ask.ts`：接入 intent 解析，恢复结构化回答输出
5. 复用 `MarkdownManager.reindexFile()`，让 `USER_CORE.md`、`reflections/*.md`、`dreams/*.md` 能被 ask 检索
6. 补测试，至少覆盖 parser、ask 响应结构、USER_CORE 索引 source type

## 背景

当前 `POST /ask` 接口虽然底层依赖了功能强大的 [RecallEngine](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts#275-1105)（4 通道并行检索 + MMR 重排），但调用时只传了 `{ query, topK: 10 }`，**丢弃了 RecallQuery 已支持的全部过滤参数**。同时，系统通过 `ConsolidationEngine` 和 [GenerativeReplay](file:///Users/Esone/git/personal-ai/memory-service/src/core/GenerativeReplay.ts#98-406) 生成的高质量 MD 文件（反思、做梦、项目总结、用户画像）**从未被索引**，对 ask() 完全不可见。

此外，v8 重构后 ask() 丢失了**结构化输出能力**（timeline、keyFindings、insights），前端 [SearchResultPage.vue](file:///Users/Esone/git/personal-ai/src/modals/components/SearchResultPage.vue) 中的时间线等 UI 组件永远无法渲染。

基于两份场景分析文档，本计划分 **5 个阶段** 逐步增强 ask() 的能力。

---

## 阶段一：Query Intent 解析层（覆盖场景 1, 2, 8）

> 核心思想：在 ask() 路由中，将用户的自然语言问题**先做一轮轻量 NLU 解析**，提取出结构化过滤条件，再传给 RecallEngine。

### 1.1 新增 QueryIntentParser 模块

#### [NEW] [QueryIntentParser.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/QueryIntentParser.ts)

创建一个纯函数模块，负责从自然语言 query 中提取结构化意图：

```typescript
interface ParsedQueryIntent {
  // 原始查询（可能被清洗）
  cleanedQuery: string;
  // 从查询中提取出的过滤条件
  filters: {
    senderNames?: string[];     // "John 说过什么" → ['John']
    groupNames?: string[];      // "在 DevOps 群里" → ['DevOps']
    timeRange?: { start: number; end: number };  // "上周" → 计算
    entityNames?: string[];     // "关于 INIT-27288" → ['INIT-27288']
    projectNames?: string[];    // "Personal-AI 项目" → ['Personal-AI']
    minImportance?: number;     // "重要的消息" → 0.7
    sourceTypes?: string[];     // "Glip 消息" → ['glip']
  };
  // 查询意图分类
  intent: 'search' | 'aggregate' | 'timeline' | 'profile' | 'entity_detail';
}
```

**实现方式**：采用**正则 + 关键词匹配**为主、LLM 为辅的双层策略：

- **第一层（正则，0ms 开销）**：
  - 人名提取：基于 entities 表的 name/aliases 做词典匹配
  - 时间解析：复用现有 [parseTimeRange()](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts#145-220) 并扩展中文（"上周"、"最近三个月"）
  - 群组/项目名：基于 `watched_projects` 表和常见群名做匹配
  - 重要性关键词："重要的"、"urgent"、"critical" → `minImportance: 0.7`
  - 来源类型："Glip 消息"、"网页" → `sourceTypes: ['glip']`

- **第二层（可选 LLM，200-500ms 开销）**：
  - 仅在第一层未提取到任何过滤条件时触发
  - 使用低 Token 的 prompt 让 LLM 返回 JSON 格式的 filters
  - 可通过配置 `QUERY_INTENT_USE_LLM=false` 关闭

> [!TIP]
> 第一层正则解析几乎零开销。第二层 LLM 解析仅在需要时触发，且用小 prompt（< 200 tokens），延迟可控在 300ms 以内。

### 1.2 扩展 RecallQuery 接口

#### [MODIFY] [index.ts](file:///Users/Esone/git/personal-ai/memory-service/src/types/index.ts)

```diff
 export interface RecallQuery {
   query: string;
   topK?: number;
   channels?: ('vector' | 'fts' | 'graph' | 'time')[];
   timeRange?: { start?: number; end?: number };
   entityTypes?: EntityType[];
   projectFilter?: string;
   minSalience?: number;
   includeMetadata?: boolean;
+  senderFilter?: string[];
+  groupFilter?: string[];
+  minImportance?: number;
+  sourceTypes?: SourceType[];
 }
```

### 1.3 扩展 passesFilters 方法

#### [MODIFY] [RecallEngine.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts)

在 [passesFilters](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts#1085-1104) 方法中新增对 sender、group、importance、sourceTypes 的过滤：

```diff
 private passesFilters(msg: MessageRow, query: RecallQuery): boolean {
   if (query.timeRange) { /* existing */ }
   if (query.projectFilter) { /* existing */ }
+  if (query.senderFilter?.length) {
+    if (!msg.sender || !query.senderFilter.some(s =>
+      msg.sender!.toLowerCase().includes(s.toLowerCase())
+    )) return false;
+  }
+  if (query.groupFilter?.length) {
+    if (!msg.group_name || !query.groupFilter.some(g =>
+      msg.group_name!.toLowerCase().includes(g.toLowerCase())
+    )) return false;
+  }
+  if (query.minImportance != null) {
+    if (msg.importance < query.minImportance) return false;
+  }
+  if (query.sourceTypes?.length) {
+    if (!query.sourceTypes.includes(msg.source_type)) return false;
+  }
   return true;
 }
```

> [!NOTE]
> [passesFilters](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts#1085-1104) 是 **post-filter**，在 vector/fts/time 通道的候选结果已经拿回来之后过滤。对于 sender/group 这类高选择性过滤，这意味着可能会浪费一些向量检索的资源。不过考虑到 `topK * VEC_OVER_FETCH_FACTOR = 30` 的量级，这个开销完全可接受。如果未来数据量极大，可以考虑在 SQL 层做 pre-filter。

### 1.4 重构 ask 路由

#### [MODIFY] [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts)

```diff
+import { QueryIntentParser } from '../core/QueryIntentParser.js';

 // 在 handler 中：
-const recallResult = await recallEngine.recall({
-  query,
-  topK: 10,
-  includeMetadata: false,
-});
+const parser = new QueryIntentParser(db);
+const intent = await parser.parse(query);
+
+const recallResult = await recallEngine.recall({
+  query: intent.cleanedQuery,
+  topK: 15,  // 提升 topK 以容纳更多过滤后的结果
+  includeMetadata: true,
+  timeRange: intent.filters.timeRange,
+  projectFilter: intent.filters.projectNames?.[0],
+  senderFilter: intent.filters.senderNames,
+  groupFilter: intent.filters.groupNames,
+  minImportance: intent.filters.minImportance,
+  sourceTypes: intent.filters.sourceTypes,
+});
```

---

## 阶段二：生成性知识索引化（覆盖场景 6 增强 + 做梦/反思检索）

> 核心思想：将 `ConsolidationEngine` 和 [GenerativeReplay](file:///Users/Esone/git/personal-ai/memory-service/src/core/GenerativeReplay.ts#98-406) 生成的 MD 文件**切块并存入 chunks + chunks_vec 表**，使其可被 RecallEngine 的 vector 和 fts 通道自然检索到。

### 2.1 扩展 SourceType

#### [MODIFY] [index.ts](file:///Users/Esone/git/personal-ai/memory-service/src/types/index.ts)

```diff
-export type SourceType = 'glip' | 'jira' | 'web' | 'manual' | 'system';
+export type SourceType = 'glip' | 'jira' | 'web' | 'manual' | 'system'
+  | 'reflection' | 'dream' | 'consolidation' | 'user_core';
```

### 2.2 新增 KnowledgeIndexer 模块

#### [NEW] [KnowledgeIndexer.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/KnowledgeIndexer.ts)

该模块负责将生成的 MD 文件切块、向量化、存入 chunks 表：

```typescript
export class KnowledgeIndexer {
  /**
   * 索引一个 MD 文件到 chunks + chunks_vec 表。
   * 
   * @param filePath  相对路径，如 "reflections/2026-03-09.md"
   * @param content   文件内容
   * @param sourceType  来源类型
   * @param relatedProject  可选的关联项目
   */
  async indexMarkdownFile(
    filePath: string,
    content: string,
    sourceType: SourceType,
    relatedProject?: string,
  ): Promise<{ chunksCreated: number }>;
  
  /**
   * 删除某个文件的旧 chunks（用于重建索引时先清理）
   */
  removeChunksByFilePath(filePath: string): void;
}
```

**切块策略**：
- 按 Markdown 标题（`## Section`）分块
- 每块最大 512 tokens，超出则按段落再分
- 保留标题作为 chunk 的 context prefix

> [!IMPORTANT]
> 这是性能敏感操作。每个 chunk 需要生成一次向量嵌入（~5ms/chunk），一篇 reflection 约产生 3-8 个 chunks。建议在写入 MD 后**异步执行**索引，不阻塞主流程。

### 2.3 在 ConsolidationEngine 和 GenerativeReplay 中触发索引

#### [MODIFY] [ConsolidationEngine.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/ConsolidationEngine.ts)

在写入 `reflections/{date}.md` 后，调用 `KnowledgeIndexer.indexMarkdownFile`：

```typescript
// 写入反思文件后
udm.writeFile(reflectionPath, reflectionMd);
// 异步索引
await knowledgeIndexer.indexMarkdownFile(reflectionPath, reflectionMd, 'reflection');
```

#### [MODIFY] [GenerativeReplay.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/GenerativeReplay.ts)

在写入 `dreams/{slug}-{date}.md` 后，同样触发索引：

```typescript
udm.writeFile(dreamPath, dreamMd);
await knowledgeIndexer.indexMarkdownFile(dreamPath, dreamMd, 'dream');
```

### 2.4 USER_CORE.md 也纳入索引

#### [MODIFY] ProfileManager 或相关的 user core 更新逻辑

当 `USER_CORE.md` 被重新生成时，也触发 `KnowledgeIndexer`：

```typescript
await knowledgeIndexer.indexMarkdownFile('USER_CORE.md', content, 'user_core');
```

这样，当用户问 "我的工作偏好是什么？" 时，RecallEngine 的 vector 通道就能直接从 `USER_CORE.md` 的向量化 chunks 中检索到高质量的画像条目，而不仅仅依赖 system prompt 中静态注入的文本。

### 2.5 索引数据迁移：为历史 MD 文件建索引

#### [NEW] [index-existing-knowledge.ts](file:///Users/Esone/git/personal-ai/memory-service/scripts/index-existing-knowledge.ts)

一次性脚本，扫描 `data/users/{userId}/` 下的所有 `reflections/`, `dreams/`, `projects/`, `entities/` 目录，为历史文件建立 chunk 索引。

> [!WARNING]
> 根据目录下的文件数量（约 282 个 daily logs + reflections + dreams），首次全量索引可能需要 **2-5 分钟**（取决于嵌入模型速度）。建议作为一次性迁移脚本执行，不影响运行时。

---

## 阶段三：专项数据通道注入（覆盖场景 5, 6, 7）

> 核心思想：对于 RecallEngine 四通道无法覆盖的结构化查询（双时态、用户画像表、冲突检测），在 ask 路由中**追加专项数据**作为 LLM 的额外上下文，而不强迫 RecallEngine 也去做这些事。

### 3.1 在 ask 路由中添加 Supplementary Context

#### [MODIFY] [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts)

根据 `QueryIntentParser` 解析出的 intent 类型，按需注入额外上下文：

```typescript
let supplementaryContext = '';

// ---- 场景 5: 双时态查询 ----
// 如果 intent 中发现了实体名 + "变更/历史/什么时候"
if (intent.intent === 'entity_detail' && intent.filters.entityNames?.length) {
  const entityName = intent.filters.entityNames[0];
  const entity = db.prepare(
    `SELECT id FROM entities WHERE LOWER(name) = LOWER(?) LIMIT 1`
  ).get(entityName);
  
  if (entity) {
    const timeline = db.prepare(
      `SELECT property_key, property_value, valid_from, valid_to,
              source_authority, confidence, action_type
       FROM entity_properties WHERE entity_id = ?
       ORDER BY tx_start DESC LIMIT 20`
    ).all(entity.id);
    
    if (timeline.length > 0) {
      supplementaryContext += '\n\n--- Entity Property History ---\n';
      supplementaryContext += timeline.map(t =>
        `- ${t.property_key}: "${t.property_value}" (${t.action_type}, ` +
        `confidence: ${t.confidence}, authority: ${t.source_authority})`
      ).join('\n');
    }
  }
}

// ---- 场景 6: 用户画像查询增强 ----
// 如果问的是"我的偏好/习惯/喜好"
if (intent.intent === 'profile') {
  const profileItems = db.prepare(
    `SELECT item_key, item_value, confidence, salience_score, mention_count
     FROM user_profile_items
     WHERE status = 'active'
     ORDER BY salience_score DESC LIMIT 15`
  ).all();
  
  if (profileItems.length > 0) {
    supplementaryContext += '\n\n--- User Profile Items ---\n';
    supplementaryContext += profileItems.map(p =>
      `- ${p.item_key}: ${p.item_value} (confidence: ${p.confidence}, ` +
      `salience: ${p.salience_score}, mentions: ${p.mention_count})`
    ).join('\n');
  }
}

// ---- 场景 7: 冲突检测 ----
// 如果问的是"有什么需要确认/冲突"
if (query.match(/冲突|矛盾|待确认|confirm|conflict/i)) {
  const pending = db.prepare(
    `SELECT question, context, options_json, category
     FROM confirm_requests WHERE state = 'pending'
     ORDER BY priority DESC, created_at ASC LIMIT 5`
  ).all();
  
  if (pending.length > 0) {
    supplementaryContext += '\n\n--- Pending Confirmations ---\n';
    supplementaryContext += pending.map(p =>
      `- [${p.category}] ${p.question}\n  Context: ${p.context || 'N/A'}`
    ).join('\n');
  }
}

// 将 supplementaryContext 拼入 LLM prompt
if (supplementaryContext) {
  fullPrompt += `\n\n${supplementaryContext}`;
}
```

> [!NOTE]
> 这些额外查询都是简单的 **索引命中 SQL**（5-10ms），不会带来明显的延迟。是用最小代价覆盖最多场景的务实方案。

---

## 阶段四：前端 Ask 体验增强（覆盖场景 4, 9, 10）

> 核心思想：场景 4（聚合分析）、9（图谱展示）、10（实时推荐）天然不适合 [ask()](file:///Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts#504-518) 的 RAG 模式，应通过**专用 API + 前端路由分流**解决，而不是把 ask() 做肿。

### 4.1 前端搜索路由智能分发

#### [MODIFY] [memory-store.ts](file:///Users/Esone/git/personal-ai/src/modals/memory-store.ts)

在 [performAskSearch](file:///Users/Esone/git/personal-ai/src/modals/memory-store.ts#1582-1633) 中添加前端预判断，部分场景直接调用专用 API 而非 ask()：

```typescript
const performAskSearch = async (query: string) => {
  // 前端快速判断：是否为聚合/统计类查询
  if (/趋势|统计|热度|每个项目|分布/.test(query)) {
    // 直接调用统计 API（如果有）或标记为不适合 ask
    console.log('[搜索] 检测到聚合查询，建议使用统计面板');
  }
  
  // 其他情况走现有 ask() 逻辑
  const client = getMemoryServiceClient();
  const result = await client.ask(query, undefined, true);
  // ...
};
```

### 4.2 ask 接口新增 `mode` 参数（可选增强）

#### [MODIFY] [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts)

```diff
 interface AskBody {
   query: string;
   context?: string;
   includeEvidence?: boolean;
+  mode?: 'auto' | 'fast' | 'deep';
 }
```

- **`fast`**：跳过 LLM 意图解析，只用正则提取 filters，topK=10，适合实时推荐场景
- **`deep`**：启用 LLM 意图解析 + 额外数据通道注入 + topK=20，适合深度问答
- **`auto`**（默认）：根据 query 长度和复杂度自动选择

> [!IMPORTANT]
> 场景 10（实时推荐，< 100ms）不应走 ask()。前端应直接调用 `POST /recall` 获取原始检索结果，跳过 LLM 生成步骤。`/recall` 路由只需 30-50ms。

---

## 阶段五：结构化回答输出（恢复 Timeline + 增强展示）

> 核心思想：v8 重构后 [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts) 只返回纯文本 [answer](file:///Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts#742-756)，丢失了旧版的结构化输出（timeline、keyFindings、insights）。前端 [SearchResultPage.vue](file:///Users/Esone/git/personal-ai/src/modals/components/SearchResultPage.vue) 中已有对应的渲染模板但 `structuredAnswer` 始终为 `undefined`。本阶段通过让 LLM 返回 JSON 格式的结构化回答来恢复此能力。

### 5.1 重新设计 AskResponse 类型

#### [MODIFY] [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts)

```diff
 interface AskResponse {
   answer: string;
   evidence?: RecallItem[];
   queryTimeMs: number;
+  structuredAnswer?: {
+    timeline?: Array<{ date: string; event: string }>;
+    keyFindings?: string[];
+    insights?: string[];
+    relatedEntities?: Array<{ name: string; type: string; relevance: string }>;
+    confidence?: number;  // 0-1，LLM 对回答的置信度
+  };
 }
```

### 5.2 改造 LLM Prompt 为结构化输出

#### [MODIFY] [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts)

将 `SYSTEM_PROMPT` 改为要求 LLM 返回 JSON：

```typescript
const SYSTEM_PROMPT = `You are a personal AI assistant with access to the user's memory.
Answer based on the provided context. If the information is not in the context, say so honestly.

You MUST return a JSON object with this structure:
{
  "answer": "your main answer in markdown format",
  "timeline": [{"date": "YYYY-MM-DD or relative", "event": "description"}],
  "keyFindings": ["finding1", "finding2"],
  "insights": ["insight1"],
  "relatedEntities": [{"name": "...", "type": "Person|Project|...", "relevance": "why relevant"}],
  "confidence": 0.85
}

Rules:
- "answer" is required, all other fields are optional
- Only include "timeline" if the query involves time-based events
- Only include "keyFindings" if there are notable discoveries
- Only include "insights" if you can infer deeper patterns
- Only include "relatedEntities" if specific entities are relevant
- Set "confidence" based on how well the context covers the question`;
```

**解析逻辑**：在 LLM 返回后，用 `JSON.parse` 提取结构化字段。如果解析失败（LLM 偶尔不遵守格式），graceful fallback 到纯文本模式：

```typescript
let structured: AskResponse['structuredAnswer'] = undefined;
let answerText = llmResponse.content;

try {
  const parsed = JSON.parse(llmResponse.content);
  answerText = parsed.answer || llmResponse.content;
  structured = {
    timeline: parsed.timeline,
    keyFindings: parsed.keyFindings,
    insights: parsed.insights,
    relatedEntities: parsed.relatedEntities,
    confidence: parsed.confidence,
  };
  // 清理空数据
  if (!structured.timeline?.length) delete structured.timeline;
  if (!structured.keyFindings?.length) delete structured.keyFindings;
  if (!structured.insights?.length) delete structured.insights;
  if (!structured.relatedEntities?.length) delete structured.relatedEntities;
  if (Object.keys(structured).length === 0) structured = undefined;
} catch {
  // LLM 未返回有效 JSON，回退为纯文本
  structured = undefined;
}

const response: AskResponse = {
  answer: answerText,
  structuredAnswer: structured,
  queryTimeMs,
};
```

> [!TIP]
> 使用 `generateJSON` 方法（`LLMClient` 已有此方法，[GenerativeReplay](file:///Users/Esone/git/personal-ai/memory-service/src/core/GenerativeReplay.ts#98-406) 中已在使用）可以提高 JSON 输出的可靠性。但考虑到 ask() 的稳定性要求，建议保留 graceful fallback。

### 5.3 前端对接结构化数据

#### [MODIFY] [memory-store.ts](file:///Users/Esone/git/personal-ai/src/modals/memory-store.ts)

在 [performAskSearch](file:///Users/Esone/git/personal-ai/src/modals/memory-store.ts#1582-1633) 中传递 `structuredAnswer`：

```diff
 searchContext.value.askResult = {
   answer: result.answer,
+  structuredAnswer: result.structuredAnswer,
   evidence,
   entitiesByType: {},
   metadata: { ... },
 };
```

#### [MODIFY] [MemoryServiceClient.ts](file:///Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts)

更新 [AskResponse](file:///Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts#85-90) 类型以包含 `structuredAnswer` 字段。

> [!NOTE]
> 前端 [SearchResultPage.vue](file:///Users/Esone/git/personal-ai/src/modals/components/SearchResultPage.vue) 和 [EntityListPage.vue](file:///Users/Esone/git/personal-ai/src/modals/components/EntityListPage.vue) **已有** timeline/keyFindings/insights 的渲染模板（通过 `v-if="searchContext.askResult.structuredAnswer.timeline?.length"`），无需修改模板，只需确保数据正确传入即可。

### 5.4 性能考量

- **JSON 格式输出 vs 纯文本**：要求 LLM 返回 JSON 通常会多消耗 ~100-200 tokens（因为格式开销），但不会显著增加延迟
- **maxTokens 需从 1500 提升至 2000**：结构化输出比纯文本略长
- **JSON 解析**：< 1ms，可忽略

---

## 性能影响评估

| 增强项 | 额外延迟 | 评估 |
|:---|:---|:---|
| 正则 Intent 解析 | < 5ms | ✅ 可忽略 |
| LLM Intent 解析（可选） | 200-500ms | ⚠️ 仅在需要时触发 |
| 扩展 passesFilters | < 1ms | ✅ 可忽略 |
| 补充上下文 SQL 查询 | 5-20ms | ✅ 低开销 |
| 知识索引化（运行时） | 50-200ms/文件 | ✅ 异步执行，不阻塞请求 |
| 知识索引化（首次迁移） | 2-5分钟 | ⚠️ 一次性脚本 |
| 结构化 JSON 输出 | +100-200 tokens | ✅ 延迟增量 < 200ms |
| topK 15→20 | +10ms | ✅ 可忽略 |

**总结**：在默认 `auto` 模式下，ask() 总响应时间从目前的 ~2s 增加到 ~2.5s（主要是 LLM 生成耗时），额外开销约 200-500ms，完全可接受。

---

## 各场景覆盖度变化

| 场景 | 改进前 | 改进后 | 改进手段 |
|:---:|:---:|:---:|:---|
| 1. 时间线查询 | ⚠️ 部分 | ✅ 完全 | 阶段一：Intent 解析 sender + time |
| 2. 实体关系 | ⚠️ 部分 | ⚠️→✅ | 阶段一：entity 提取 + 阶段三：关系数据注入 |
| 3. 向量搜索 | ✅ 完全 | ✅ 完全 | 无需改动 |
| 4. 聚合分析 | ❌ 不覆盖 | 🔄 分流 | 阶段四：前端分流到统计 API |
| 5. 双时态查询 | ❌ 不覆盖 | ✅ 完全 | 阶段三：entity_properties 注入 |
| 6. 用户画像 | ⚠️ 间接 | ✅ 完全 | 阶段二：USER_CORE 索引 + 阶段三：profile_items 注入 |
| 7. 冲突检测 | ❌ 不覆盖 | ✅ 完全 | 阶段三：confirm_requests 注入 |
| 8. 全文搜索 | ⚠️ 部分 | ✅ 完全 | 阶段一：importance 过滤 |
| 9. 图谱查询 | ⚠️ 部分 | 🔄 分流 | 阶段四：前端分流到图谱 API |
| 10. 实时推荐 | ⚠️ 不合适 | 🔄 分流 | 阶段四：前端直接走 /recall |

---

## 推荐实施顺序

1. **阶段五**（最快见效）：结构化输出 → 立即恢复 timeline/keyFindings/insights 展示
2. **阶段一**（最高 ROI）：Intent 解析 + RecallQuery 扩展 → 一次性覆盖场景 1, 2, 8
3. **阶段二**（基础设施）：知识索引化 → 让反思/做梦结果可被检索
4. **阶段三**（精准增强）：补充上下文注入 → 覆盖场景 5, 6, 7
5. **阶段四**（体验优化）：前端路由分流 → 让不适合 ask 的场景走专用通道

## 涉及文件清单

| 文件 | 操作 | 阶段 |
|:---|:---:|:---:|
| [QueryIntentParser.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/QueryIntentParser.ts) | NEW | 1 |
| [index.ts](file:///Users/Esone/git/personal-ai/memory-service/src/types/index.ts) | MODIFY | 1, 2 |
| [RecallEngine.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts) | MODIFY | 1 |
| [ask.ts](file:///Users/Esone/git/personal-ai/memory-service/src/routes/ask.ts) | MODIFY | 1, 3, 4, 5 |
| [KnowledgeIndexer.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/KnowledgeIndexer.ts) | NEW | 2 |
| [ConsolidationEngine.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/ConsolidationEngine.ts) | MODIFY | 2 |
| [GenerativeReplay.ts](file:///Users/Esone/git/personal-ai/memory-service/src/core/GenerativeReplay.ts) | MODIFY | 2 |
| [index-existing-knowledge.ts](file:///Users/Esone/git/personal-ai/memory-service/scripts/index-existing-knowledge.ts) | NEW | 2 |
| [memory-store.ts](file:///Users/Esone/git/personal-ai/src/modals/memory-store.ts) | MODIFY | 4, 5 |
| [MemoryServiceClient.ts](file:///Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts) | MODIFY | 4, 5 |

## Verification Plan

### Automated Tests

项目 `memory-service/` 下目前没有针对 [ask](file:///Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts#504-518) 或 [RecallEngine](file:///Users/Esone/git/personal-ai/memory-service/src/core/RecallEngine.ts#275-1105) 的单元测试。建议：

1. **QueryIntentParser 单元测试** — 纯函数，最容易测试：
   - 输入："上周 John 提到 deadline 的重要消息" → 验证提取出 `senderNames: ['John']`, `timeRange`, `minImportance: 0.7`
   - 输入："我的工作偏好" → 验证 `intent: 'profile'`
   - 框架：使用 `vitest` 或 `node --test`

2. **passesFilters 扩展测试** — 构造 mock MessageRow 验证各 filter 组合的通过/拒绝

### Manual Verification

1. 启动 `memory-service`（`npm run dev`），通过 `curl` 直接调用 `POST /ask`：
   ```bash
   # 场景 1 测试
   curl -X POST http://localhost:18790/ask \
     -H "Content-Type: application/json" \
     -H "X-User-Id: esone.qiu" \
     -d '{"query": "上周 Yulia 在 DevOps 群提到 Stage 部署了吗？", "includeEvidence": true}'
   ```
   验证 evidence 中的结果是否精确过滤了 sender 和 group。

2. 执行知识索引迁移脚本后，测试反思内容是否可检索：
   ```bash
   curl -X POST http://localhost:18790/ask \
     -H "Content-Type: application/json" \
     -H "X-User-Id: esone.qiu" \
     -d '{"query": "最近反思中有什么重要发现？", "includeEvidence": true}'
   ```
   验证 evidence 中是否包含来自 `reflections/` 的 chunks。

> [!NOTE]
> 由于本项目无完整的集成测试框架，建议用户在实施后通过上述 curl 命令手动验证核心场景。
