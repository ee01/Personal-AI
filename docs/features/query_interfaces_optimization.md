# 查询接口优化 - 相关度优先排序

## 问题描述

用户反馈查询结果没有按照向量关联度倒序排列，而是按时间排序，导致最相关的结果没有优先显示。

## 修改内容

### 1. `queryEntityMessages()` 接口优化

**修改位置**: `src/storage/HybridGraphStore.ts` (line 1560-1669)

**新增参数**:
- `sortBy?: 'relevance' | 'time'` - 排序方式，默认为 `'relevance'`
- `sortOrder?: 'desc' | 'asc'` - 排序顺序，默认为 `'desc'`
- `minRelevanceScore?: number` - 最低相关度阈值 (0-1评分系统)

**主要改进**:
1. **相关度评分修正**: 修正了错误的distance计算公式，使用 `1/(1+distance)` 替代 `1-distance`，确保结果在0-1之间
2. **默认按相关度排序**: 改变默认排序方式从时间排序到相关度排序  
3. **支持过滤条件**: 可以过滤掉低相关度的消息
4. **灵活的排序选项**: 用户可以选择按相关度或时间排序

### 2. `queryEntityWebpages()` 接口同步优化

**修改位置**: `src/storage/HybridGraphStore.ts` (line 1671-1806)

应用了与 `queryEntityMessages()` 相同的优化：
- 支持按相关度/时间排序
- 支持最低相关度过滤
- 相关度评分修正为正确的0-1区间

### 3. 调用处更新

**修改位置**: `src/background.ts` (line 458-463)

更新了调用代码，加入了评分>0.5的过滤条件：

```typescript
const conversations = await hybridStore.queryEntityMessages(topicId, { 
    limit: 20, 
    minRelevanceScore: 0.5,    // 只返回相关度评分>0.5的消息
    sortBy: 'relevance',       // 按相关度排序
    sortOrder: 'desc'          // 最相关的在前面
});
```

## 影响范围

### 正面影响
1. **提升用户体验**: 最相关的内容优先显示
2. **减少噪音**: 过滤掉低相关度的结果
3. **保持灵活性**: 用户仍可选择按时间排序
4. **统一接口设计**: 多个查询接口保持一致的设计模式

### 兼容性考虑
- **向后兼容**: 所有新参数都是可选的，默认行为改为相关度优先
- **类型安全**: 使用TypeScript类型定义，确保参数正确性

## 使用示例

### 基础使用（默认相关度排序）
```typescript
const messages = await hybridStore.queryEntityMessages(entityId, { limit: 10 });
```

### 高质量结果过滤
```typescript
const messages = await hybridStore.queryEntityMessages(entityId, {
    limit: 20,
    minRelevanceScore: 0.7,  // 只要高相关度结果 (0-1评分)
    sortBy: 'relevance'
});
```

### 时间序列分析
```typescript
const messages = await hybridStore.queryEntityMessages(entityId, {
    sortBy: 'time',
    sortOrder: 'desc',
    timeRange: { start: startTime, end: endTime }
});
```

## 验证效果

修改后的日志输出会显示过滤和排序信息：
```
📱 查询实体 XXX 的消息记录: 15/20 条 (排序:relevance, 最低评分:0.5)
```

这表明从20条原始结果中过滤出了15条高质量结果，按相关度排序。

## 重要修正

### 相关度评分公式修正

**问题发现**: 
1. ChromaDB 配置中的 `embeddingFunction` 返回全零向量，影响距离计算
2. 没有明确指定距离度量方法，导致计算结果异常
3. Distance 值接近 0.9999xxxx，表明使用余弦距离但向量不匹配

**修正方案**:
1. **配置修正**: 明确设置 `"hnsw:space": "cosine"` 使用余弦相似度
2. **EmbeddingFunction修正**: 使用真实的 embedding 生成函数
3. **查询优化**: 使用 `queryEmbeddings` 而不是 `queryTexts` 确保向量一致性
4. **公式修正**: `relevanceScore = 1 - distance` (余弦距离范围 0-1)

**正确公式**: `relevanceScore = 1 - distance`
- 当 distance = 0 时，relevanceScore = 1.0 (完全匹配)
- 当 distance = 1 时，relevanceScore = 0.0 (完全不相关)
- 当 distance = 0.9999 时，relevanceScore = 0.0001 (几乎不相关)

## 后续计划

1. 监控用户反馈，调整默认的相关度阈值
2. 考虑添加更多排序选项（如重要性、访问频率等）
3. 优化相关度计算算法，提高结果质量
