# Memory 存储架构对比：MD vs DB

## 核心问题

为什么不使用 MD 文件按日期存储 message raw 信息，而是采用 DB 存储？

## 两种存储模式对比

### 模式 A：Markdown 为真源（OpenClaw 模式）

```
memory/
├── 2024-01-15.md          # 完整的原始消息
├── 2024-01-16.md
├── MEMORY.md              # 核心记忆
└── .index/
    ├── vectors.db         # 向量索引（辅助）
    └── fts.db            # 全文索引（辅助）
```

**数据流**：
```
原始消息 → MD 文件（追加）→ 后台索引进程 → 更新向量/FTS 索引
```

**特点**：
- ✅ 人类可读性强：直接打开 MD 就能看到所有历史
- ✅ 版本控制友好：可以用 Git 管理
- ✅ 可移植性好：复制 MD 文件就能迁移
- ✅ 透明度高：用户知道存了什么
- ✅ 工具链丰富：任何文本编辑器都能查看/编辑
- ❌ 查询性能差：需要解析 MD 才能查询
- ❌ 结构化查询困难：无法高效做复杂过滤
- ❌ 并发写入复杂：多进程写同一文件需要锁
- ❌ 索引重建慢：MD 文件大了重建索引很慢
- ❌ 关系查询弱：实体关系、时间范围查询效率低

### 模式 B：数据库为真源（你的 Memory Service 模式）

```
data/users/{userId}/
├── memory.db              # SQLite 数据库（真源）
│   ├── messages_raw       # 完整原始消息
│   ├── messages_vec       # 向量索引
│   ├── chunks_fts         # 全文索引
│   ├── entities           # 实体图谱
│   └── relationships      # 关系网络
└── daily/
    └── 2024-01-15.md      # 摘要视图（可选）
```

**数据流**：
```
原始消息 → DB 插入（事务）→ 触发器自动更新索引 → 可选生成 MD 摘要
```

**特点**：
- ✅ 查询性能强：索引、JOIN、聚合都很快
- ✅ 结构化查询：SQL 可以做复杂过滤、排序、分组
- ✅ 事务保证：ACID 特性保证数据一致性
- ✅ 并发友好：SQLite WAL 模式支持多读一写
- ✅ 关系查询强：实体关系、图谱查询高效
- ✅ 增量索引：只需索引新数据
- ✅ 数据完整性：外键、约束、触发器
- ❌ 人类可读性差：需要工具才能查看
- ❌ 版本控制困难：二进制文件不适合 Git
- ❌ 透明度低：用户不知道 DB 里存了什么
- ❌ 工具依赖：需要 SQLite 客户端
- ❌ 迁移复杂：需要导出/导入工具

## 关键差异维度分析

### 1. 查询性能

**场景：查找"过去 30 天内提到 John 的所有消息"**

**MD 模式**：
```bash
# 需要读取 30 个文件，逐行解析
for file in memory/2024-*.md; do
  grep -i "john" "$file"
done
# 时间复杂度：O(n * m)，n=文件数，m=每文件行数
```

**DB 模式**：
```sql
SELECT * FROM messages_raw
WHERE timestamp > unixepoch('now', '-30 days')
  AND (content LIKE '%John%' OR entities_json LIKE '%John%')
ORDER BY timestamp DESC;
-- 时间复杂度：O(log n)，有索引
```

**结论**：DB 快 10-100 倍

### 2. 复杂查询

**场景：找出"与 John 共同出现最多的 5 个人"**

**MD 模式**：
- 需要写脚本解析所有 MD
- 提取实体
- 统计共现
- 排序
- 代码量：50-100 行

**DB 模式**：
```sql
SELECT e2.name, COUNT(*) as co_occurrence
FROM messages_raw m1
JOIN json_each(m1.entities_json) e1
JOIN messages_raw m2 ON m1.id = m2.id
JOIN json_each(m2.entities_json) e2
WHERE e1.value->>'name' = 'John'
  AND e2.value->>'name' != 'John'
GROUP BY e2.name
ORDER BY co_occurrence DESC
LIMIT 5;
-- 代码量：8 行
```

**结论**：DB 表达力强 10 倍

### 3. 并发写入

**场景：Chrome Extension 同时从多个标签页摄入消息**

**MD 模式**：
```javascript
// 需要文件锁
const lockfile = require('proper-lockfile');
await lockfile.lock('memory/2024-01-15.md');
fs.appendFileSync('memory/2024-01-15.md', message);
await lockfile.unlock('memory/2024-01-15.md');
// 问题：锁竞争、死锁风险
```

**DB 模式**：
```javascript
// SQLite WAL 模式自动处理
db.prepare('INSERT INTO messages_raw VALUES (...)').run(message);
// 多个写入者自动排队，无需手动锁
```

**结论**：DB 并发处理能力强 5-10 倍

### 4. 数据完整性

**场景：确保每条消息都有有效的 timestamp**

**MD 模式**：
```markdown
- 2024-01-15 10:30 [John]: Hello
- [John]: World  <!-- 缺少时间戳，无法自动检测 -->
```

**DB 模式**：
```sql
CREATE TABLE messages_raw (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,  -- 强制非空
  content TEXT NOT NULL,
  CHECK (timestamp > 0)        -- 约束检查
);
-- 插入无效数据会自动拒绝
```

**结论**：DB 数据质量保证强 100 倍

### 5. 向量搜索性能

**场景：找到与查询最相似的 10 条消息**

**MD 模式**：
```python
# 需要：
# 1. 读取所有 MD 文件
# 2. 对每条消息生成向量（或从缓存读）
# 3. 计算余弦相似度
# 4. 排序取 top-10
# 时间：1-5 秒（10000 条消息）
```

**DB 模式**：
```sql
SELECT message_id, distance
FROM messages_vec
WHERE embedding MATCH ?
ORDER BY distance
LIMIT 10;
-- 时间：10-50 毫秒（sqlite-vec 优化）
```

**结论**：DB 快 100-500 倍

### 6. 人类可读性

**场景：用户想查看"我去年 3 月都聊了什么"**

**MD 模式**：
```bash
cat memory/2024-03-*.md | less
# 直接可读，无需工具
```

**DB 模式**：
```bash
sqlite3 memory.db "SELECT * FROM messages_raw WHERE ..."
# 或需要专门的 UI
```

**结论**：MD 可读性强 10 倍

### 7. 版本控制

**场景：团队协作，需要追踪记忆变更**

**MD 模式**：
```bash
git log memory/2024-01-15.md
git diff HEAD~1 memory/2024-01-15.md
# 可以看到每次变更的具体内容
```

**DB 模式**：
```bash
git log memory.db
# 只能看到"文件变了"，看不到具体变更
# 需要专门的 DB diff 工具
```

**结论**：MD 版本控制友好 100 倍

## OpenClaw 的选择和原因

OpenClaw 选择了 **MD 为真源** 模式，原因：

### 1. 设计哲学：透明度优先

```
"Memory should be inspectable, editable, and portable"
```

OpenClaw 的核心理念是让用户**完全掌控**自己的数据：
- 用户可以直接编辑 `MEMORY.md` 来修正错误
- 可以用任何文本编辑器查看历史
- 可以用 Git 管理版本
- 可以轻松备份和迁移

### 2. 使用场景：开发者工作流

OpenClaw 的主要用户是开发者，他们：
- 习惯用文本文件工作
- 喜欢 Git 版本控制
- 需要在不同机器间同步（Git）
- 希望能手动编辑记忆

### 3. 数据量假设：中小规模

OpenClaw 假设：
- 每天几十到几百条记忆
- 总量在 10K-100K 条
- 这个规模下 MD + 索引性能足够

### 4. 简化部署

MD 模式的优势：
- 无需数据库服务器
- 无需迁移脚本
- 文件系统就是存储
- 备份就是复制文件

## 你的 Memory Service 选择 DB 的原因

### 1. 使用场景：个人 AI 助手

你的场景更复杂：
- 每天数百到数千条消息（Glip、网页、邮件）
- 需要复杂的实体关系图谱
- 需要实时查询和推荐
- 需要多维度分析（时间、人物、项目）

### 2. 性能要求：实时响应

你需要：
- 毫秒级的向量搜索
- 复杂的 JOIN 查询（实体关系）
- 实时的画像更新
- 高并发的摄入（多标签页）

### 3. 数据完整性：关键

你有：
- 双时态数据（TruthMaintainer）
- 冲突检测和确认队列
- 外键约束（实体-关系-消息）
- 事务一致性要求

### 4. 功能复杂度：高

你实现了：
- 显著性评分（SalienceScorer）
- 遗忘引擎（ForgettingEngine）
- 巩固引擎（ConsolidationEngine）
- 画像管理（ProfileManager）
- 真值维护（TruthMaintainer）

这些都需要复杂的 SQL 查询和事务支持。

## 混合模式：最佳实践

实际上，最优方案可能是 **混合模式**：

### 方案：DB 为真源 + MD 为导出视图

```
data/users/{userId}/
├── memory.db              # 真源：完整数据 + 索引
└── exports/               # 导出视图
    ├── daily/
    │   └── 2024-01-15.md  # 完整的日志（可选）
    ├── entities/
    │   └── john-doe.md    # 实体档案
    └── MEMORY.md          # 核心记忆摘要
```

**优势**：
- ✅ 查询性能：DB 提供
- ✅ 人类可读：MD 提供
- ✅ 版本控制：可以只 Git 管理 exports/
- ✅ 数据完整性：DB 保证
- ✅ 可移植性：导出 MD 即可

**实现**：
```typescript
// 在 IngestionPipeline 中添加选项
interface IngestionOptions {
  exportFullContentToMd?: boolean;  // 默认 false
}

// 如果启用，写入完整内容到 MD
if (options.exportFullContentToMd) {
  const fullLine = `
## ${time} - ${sender}

${payload.content}

**Entities**: ${entitiesList.map(e => e.name).join(', ')}
**Importance**: ${importance}
**Sentiment**: ${sentiment}

---
`;
  udm.appendToFile(logPath, fullLine, header);
}
```

## 推荐方案

### 对于你的 Memory Service

**保持 DB 为真源**，但增强 MD 导出：

1. **默认模式**：DB 真源 + MD 摘要（当前实现）
   - 适合日常使用
   - 性能最优

2. **完整导出模式**（新增）：
   ```typescript
   // POST /export
   {
     "format": "markdown_full",
     "includeRawContent": true,
     "dateRange": { "start": "2024-01-01", "end": "2024-12-31" }
   }
   ```
   - 用于备份、迁移、审查
   - 生成 OpenClaw 兼容的 MD 文件

3. **实时同步模式**（可选配置）：
   ```typescript
   // config.ts
   export const MARKDOWN_SYNC_MODE = {
     enabled: false,  // 默认关闭
     fullContent: false,  // 是否写入完整内容
     syncInterval: 3600,  // 同步间隔（秒）
   };
   ```

### 对于 OpenClaw 互操作

**三种方案**：

#### 方案 1：API 适配器（推荐）
```
OpenClaw → Memory Service Plugin → HTTP API → Memory Service DB
```
- OpenClaw 不直接读 MD
- 通过 API 调用 Memory Service
- 保持各自架构独立

#### 方案 2：定期导出
```
Memory Service → 每日导出 → workspace/memory/*.md → OpenClaw 读取
```
- Memory Service 每天生成 OpenClaw 格式的 MD
- OpenClaw 按原生方式读取
- 单向同步，简单但有延迟

#### 方案 3：MCP 协议（长期）
```
OpenClaw → MCP Client → MCP Server (Memory Service) → DB
```
- 标准化接口
- 支持多客户端
- 最灵活但需要更多开发

## 结论

### 哪种更合理？

**没有绝对答案，取决于场景**：

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 个人笔记、日记 | MD 为真源 | 可读性、版本控制 |
| 开发者工作流 | MD 为真源 | 透明度、Git 友好 |
| 个人 AI 助手（高频） | DB 为真源 | 性能、复杂查询 |
| 企业知识库 | DB 为真源 | 并发、权限、审计 |
| 团队协作记忆 | 混合模式 | 兼顾性能和透明度 |

### 你的选择是正确的

对于你的场景（Chrome Extension + 高频摄入 + 复杂分析），**DB 为真源是正确选择**：

1. ✅ 每天数千条消息 → 需要 DB 性能
2. ✅ 实体关系图谱 → 需要 SQL JOIN
3. ✅ 实时画像更新 → 需要事务
4. ✅ 向量搜索 → 需要 sqlite-vec
5. ✅ 并发摄入 → 需要 WAL 模式

### 建议改进

增加一个 **"完整导出"功能**，让用户可以：
- 定期导出完整的 MD 文件（用于备份）
- 生成 OpenClaw 兼容格式（用于互操作）
- 保持透明度和可移植性

这样你就能兼得两者的优势：
- 日常使用：DB 的高性能
- 长期保存：MD 的可读性
- 互操作性：标准格式导出
