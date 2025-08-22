# ChromaDB 距离计算修正指南

## 问题诊断

### 用户报告的问题
- Distance 值基本都是 0.9999xxxx
- 使用 `1/(1+distance)` 公式计算出的 relevanceScore 不合理
- distance 0.9999994481332326 → score 0.5000001379667299

### 根本原因分析
1. **EmbeddingFunction 配置错误**: 返回全零向量
2. **距离度量未明确指定**: 导致使用默认设置
3. **查询方式不统一**: 混用 `queryTexts` 和 `queryEmbeddings`
4. **相关度计算公式错误**: 不匹配 ChromaDB 的距离类型

## 修正方案

### 1. ChromaDB 配置修正

**修正前**:
```javascript
// embeddingFunction 返回全零向量
const embeddingFunction = {
  generate: async (texts: string[]) => {
    return new Array(texts.length).fill(new Array(384).fill(0));
  }
};

// 没有指定距离度量
await this.chromaClient.createCollection({
  name: collectionName,
  metadata: { description: '图实体数据存储' },
  embeddingFunction
});
```

**修正后**:
```javascript
// embeddingFunction 返回真实embedding
const embeddingFunction = {
  generate: async (texts: string[]) => {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await getEmbeddingViaOffscreen(text || '');
      embeddings.push(embedding);
    }
    return embeddings;
  }
};

// 明确指定余弦相似度
await this.chromaClient.createCollection({
  name: collectionName,
  metadata: { 
    description: '图实体数据存储',
    "hnsw:space": "cosine"  // 明确使用余弦相似度
  },
  embeddingFunction
});
```

### 2. 查询方式统一

**修正前**:
```javascript
const queryParams = {
  queryTexts: [entity.name],  // 使用文本查询，依赖 embeddingFunction
  nResults: options?.limit || 20
};
```

**修正后**:
```javascript
// 生成真实查询向量
const queryEmbedding = await getEmbeddingViaOffscreen(entity.name);

const queryParams = {
  queryEmbeddings: [queryEmbedding],  // 直接使用embedding向量
  nResults: options?.limit || 20
};
```

### 3. 相关度计算公式修正

**错误公式**: `relevanceScore = 1 / (1 + distance)`
- 问题：不适用于余弦距离 (0-1 范围)
- 结果：distance 接近 1 时，score 接近 0.5

**正确公式**: `relevanceScore = 1 - distance`
- 适用于余弦距离 (0-1 范围)
- distance = 0 → relevanceScore = 1.0 (完全匹配)
- distance = 1 → relevanceScore = 0.0 (完全不相关)
- distance = 0.9999 → relevanceScore = 0.0001 (几乎不相关)

### 4. 调试信息增强

```javascript
// 添加embedding长度检查
console.log(`🔍 查询实体 "${entity.name}" 的embedding长度: ${queryEmbedding?.length || 0}`);

// 添加距离分布统计
const distances = queryResult.distances?.[0] || [];
console.log(`📊 查询返回 ${queryResult.ids[0].length} 条结果，距离分布:`, {
  min: Math.min(...distances),
  max: Math.max(...distances),
  avg: distances.reduce((a, b) => a + b, 0) / distances.length,
  sample: distances.slice(0, 3)
});
```

## 预期改进效果

### 修正前的问题
- 所有查询向量可能都是零向量
- Distance 计算不准确
- RelevanceScore 不能正确反映相关性

### 修正后的预期
- 使用真实的 embedding 向量进行查询
- Distance 反映真实的语义相似度
- RelevanceScore 准确表示 0-1 范围内的相关性

## 验证方法

1. **检查 Embedding 长度**:
   ```
   🔍 查询实体 "项目名称" 的embedding长度: 384
   ```

2. **观察距离分布**:
   ```
   📊 查询返回 10 条结果，距离分布: {
     min: 0.1234,
     max: 0.9876,
     avg: 0.5432,
     sample: [0.1234, 0.3456, 0.5678]
   }
   ```

3. **验证相关度计算**:
   - 高相关性: distance < 0.3 → relevanceScore > 0.7
   - 中等相关性: 0.3 ≤ distance ≤ 0.7 → 0.3 ≤ relevanceScore ≤ 0.7
   - 低相关性: distance > 0.7 → relevanceScore < 0.3

## 阈值建议

基于修正后的 0-1 相关度评分系统：

```javascript
// 高质量结果过滤
minRelevanceScore: 0.7   // 只要高相关度结果

// 中等质量结果过滤  
minRelevanceScore: 0.3   // 过滤掉明显不相关的结果

// 宽松过滤（调试用）
minRelevanceScore: 0.001 // 几乎不过滤，用于观察分布
```

## 注意事项

1. **新建 Collection**: 新创建的 collection 将使用正确的配置
2. **现有 Collection**: 可能需要重建或迁移数据以应用新配置
3. **性能监控**: 观察查询性能和结果质量是否改善
4. **阈值调优**: 根据实际使用效果调整 minRelevanceScore 阈值
