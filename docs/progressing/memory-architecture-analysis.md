# Memory 架构分析：你的实现 vs 文档描述

## 核心发现

经过对代码的完整检查，你的 Memory Service 实现与文档中的描述存在一些差异。

## 你的实际实现架构

### 主存储（真源）：SQLite 数据库

你的 Memory Service 采用 **SQLite 为真源** 的架构：

1. **messages_raw 表**：存储完整的原始消息内容
   - 包含：content（完整内容）、summary、entities_json、metadata_json 等
   - 位置：`memory-service/src/storage/migrations/001_initial.sql`

2. **向量索引**：messages_vec 和 chunks_vec
   - 使用 sqlite-vec 扩展存储 384 维向量（all-MiniLM-L6-v2）
   - 支持向量相似度搜索

3. **全文索引**：chunks_fts
   - 使用 FTS5 提供全文搜索能力
   - 通过触发器自动同步

### Markdown 文件：仅作为摘要视图

关键代码在 `memory-service/src/core/IngestionPipeline.ts` 第 304-316 行：

```typescript
// ---- 8. Append to daily markdown log ----
try {
  const udm = this.userDataManager;
  if (udm?.isInitialized) {
    const dateStr = formatDate(ts);
    const logPath = udm.getDailyLogPath(new Date(ts * 1000));
    const header = `# Daily Log — ${dateStr}\n\n`;
    const time = new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
    const sender = payload.sender ?? 'unknown';
    const group = payload.groupName ? ` in ${payload.groupName}` : '';
    const line = `- **${time}** [${sender}${group}]: ${summary ?? contentNormalized.slice(0, 200)}\n`;
    udm.appendToFile(logPath, line, header);
  }
}
```

**关键点**：
- Markdown 文件只保存 **一行摘要**（时间戳 + 发送者 + 摘要或前 200 字符）
- **不保存完整的原始消息内容**
- 这些文件位于 `data/users/{userId}/daily/{YYYY-MM-DD}.md`

### 其他 Markdown 文件用途

MarkdownManager 还管理其他类型的 MD 文件，但都是**生成的视图**而非原始数据：

1. **CORE_MEMORY.md**：用户核心记忆摘要（由 consolidation 生成）
2. **projects/{slug}.md**：项目摘要（定期重新生成）
3. **entities/{type}/{slug}.md**：实体档案（从数据库生成）
4. **reflections/{date}.md**：反思输出
5. **dreams/{topic}-{date}.md**：做梦/关联发现输出

## 数据流向

```
原始消息
    ↓
[IngestionPipeline]
    ↓
├─→ messages_raw (完整内容) ← 真源
├─→ messages_vec (向量)
├─→ chunks + chunks_fts (分块索引)
├─→ entities (提取的实体)
└─→ daily/{date}.md (一行摘要) ← 可读视图
```

## 与 OpenClaw Memory 的对比

| 维度 | 你的 Memory Service | OpenClaw Memory |
|------|-------------------|-----------------|
| 真源 | SQLite 数据库 | Markdown 文件 |
| MD 文件角色 | 摘要视图/导出 | 主存储 |
| 原始内容 | 完整保存在 DB | 完整保存在 MD |
| 索引 | sqlite-vec + FTS5 | sqlite-vec + BM25 |
| 数据恢复 | 从 DB 重建 MD | 从 MD 重建索引 |

## 结论

文档中说"Markdown 更像是导出/日报/可读视图而不是唯一真源"是**正确的**。

你的实现确实是：
- ✅ **SQLite 为真源**：所有原始数据存储在数据库中
- ✅ **MD 为视图**：Markdown 文件只保存摘要和生成的内容
- ✅ **可重建性**：可以从数据库完全重建所有 MD 文件

这与 OpenClaw 的"MD 为真源"架构形成鲜明对比，在设计互操作方案时需要特别注意这一点。

## 建议

如果要与 OpenClaw 互操作，有几个选择：

1. **适配器模式**：Memory Service 提供 API，OpenClaw 通过插件调用
2. **双向同步**：Memory Service 可选地将完整内容也写入 MD（增加一个配置选项）
3. **MCP 协议**：统一接口，隐藏底层存储差异
4. **导出功能**：使用现有的 `/export` 端点生成 OpenClaw 兼容的 MD 文件

推荐使用方案 1 或 3，保持各自架构的独立性。
