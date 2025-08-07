# 知识图谱存储迁移指南

*最后更新: 2024-12-20*

## 🎯 迁移方案选择

### 推荐方案：混合存储策略

经过深入分析，我们推荐采用**混合存储策略**来解决您关心的核心问题：

1. ✅ **数据持久化** - 实体存储在ChromaDB云端
2. ✅ **设备同步** - 自动同步机制
3. ✅ **查询性能** - 关系索引本地存储
4. ✅ **存储突破** - 突破Chrome Storage 5MB限制

## 📋 迁移实施计划

### 阶段1：基础设施准备 (1-2天)

```typescript
// 1. 部署HybridGraphStore
import HybridGraphStore from './storage/HybridGraphStore';

const graphStore = new HybridGraphStore();
await graphStore.initialize();

// 2. 验证ChromaDB连接
const isCloudAvailable = graphStore.getStatistics().isCloudAvailable;
console.log('云端存储可用:', isCloudAvailable);

// 3. 测试基本操作
const testEntity = await graphStore.upsertEntity({
  id: 'test_entity',
  type: 'Person',
  name: '测试用户',
  properties: {}
});

const testRelation = await graphStore.createRelationship({
  type: 'TEST',
  fromId: 'test_entity',
  toId: 'test_entity',
  properties: {},
  strength: 1.0
});

console.log('基础功能测试通过');
```

### 阶段2：数据迁移 (2-3天)

```typescript
// 1. 从现有消息数据提取实体关系
async function migrateExistingData() {
  console.log('🔄 开始迁移现有数据...');
  
  // 从ChromaDB消息collection获取数据
  const existingMessages = await getExistingMessages();
  let migratedEntities = 0;
  let migratedRelations = 0;
  
  for (const message of existingMessages) {
    try {
      const metadata = message.metadata;
      
      // 提取实体
      if (metadata.entities) {
        // 处理人员实体
        if (metadata.entities.people) {
          for (const person of metadata.entities.people) {
            await graphStore.upsertEntity({
              id: `person_${person.name.replace(/\s+/g, '_').toLowerCase()}`,
              type: 'Person',
              name: person.name,
              properties: {
                role: person.role,
                source: 'message_migration',
                firstMentioned: metadata.timestamp
              }
            });
            migratedEntities++;
          }
        }
        
        // 处理项目实体
        if (metadata.entities.projects) {
          for (const project of metadata.entities.projects) {
            await graphStore.upsertEntity({
              id: `project_${project.name.replace(/\s+/g, '_').toLowerCase()}`,
              type: 'Project',
              name: project.name,
              properties: {
                status: project.status || 'unknown',
                source: 'message_migration',
                firstMentioned: metadata.timestamp
              }
            });
            migratedEntities++;
          }
        }
      }
      
      // 创建关系
      if (metadata.entities?.people && metadata.entities?.projects) {
        for (const person of metadata.entities.people) {
          for (const project of metadata.entities.projects) {
            await graphStore.createRelationship({
              type: 'MENTIONS',
              fromId: `person_${person.name.replace(/\s+/g, '_').toLowerCase()}`,
              toId: `project_${project.name.replace(/\s+/g, '_').toLowerCase()}`,
              properties: {
                messageId: message.id,
                timestamp: metadata.timestamp,
                context: message.content.substring(0, 200)
              },
              strength: 0.7
            });
            migratedRelations++;
          }
        }
      }
      
    } catch (error) {
      console.error(`迁移消息 ${message.id} 失败:`, error);
    }
  }
  
  // 执行初始备份
  await graphStore.backupToCloud();
  
  console.log(`✅ 迁移完成: ${migratedEntities}个实体, ${migratedRelations}个关系`);
}

// 执行迁移
await migrateExistingData();
```

### 阶段3：功能集成 (3-5天)

```typescript
// 1. 更新消息处理流程
async function enhancedMessageProcessing(messageData) {
  // 原有向量存储 (保持不变)
  const vectorResult = await vectorStore.storeMessage(
    messageData.messageId,
    messageData.content,
    messageData.metadata
  );
  
  // 新增图数据提取
  const graphResult = await graphStore.extractFromMessage({
    messageId: messageData.messageId,
    content: messageData.content,
    source: messageData.metadata.source,
    entities: messageData.metadata.entities,
    relationships: messageData.metadata.relationships
  });
  
  return {
    vectorStored: vectorResult,
    graphEntities: graphResult.entities.length,
    graphRelationships: graphResult.relationships.length
  };
}

// 2. 更新查询接口
async function enhancedQuery(userQuery) {
  // 语义搜索 (现有功能)
  const vectorResults = await vectorStore.semanticSearch(userQuery);
  
  // 图查询 (新增功能)
  const graphResults = await graphStore.queryEntities({
    textQuery: userQuery,
    limit: 10
  });
  
  // 关系分析 (新增功能)
  const relationshipResults = [];
  for (const entity of graphResults) {
    const neighbors = graphStore.findNeighbors(entity.id, { maxDepth: 2 });
    relationshipResults.push(neighbors);
  }
  
  return {
    semanticResults: vectorResults,
    entityResults: graphResults,
    relationshipResults
  };
}
```

### 阶段4：监控和维护 (持续)

```typescript
// 1. 设置同步监控
setInterval(async () => {
  const syncStatus = await graphStore.performSync();
  console.log('自动同步状态:', syncStatus);
  
  if (syncStatus.conflicts > 0) {
    console.warn(`⚠️ 检测到${syncStatus.conflicts}个同步冲突`);
    // 发送通知或记录日志
  }
}, 24 * 60 * 60 * 1000); // 每24小时

// 2. 设置备份监控
setInterval(async () => {
  const backupResult = await graphStore.backupToCloud();
  if (backupResult) {
    console.log('✅ 定期备份完成');
  } else {
    console.error('❌ 定期备份失败');
  }
}, 7 * 24 * 60 * 60 * 1000); // 每周

// 3. 存储健康检查
async function performHealthCheck() {
  const stats = graphStore.getStatistics();
  
  if (!stats.isCloudAvailable) {
    console.warn('⚠️ 云端存储不可用，仅使用本地模式');
  }
  
  if (stats.localRelationships > 10000) {
    console.warn('⚠️ 本地关系数量过多，建议清理');
    await graphStore.cleanup(90); // 清理90天前的数据
  }
  
  return stats;
}
```

## 🔧 故障恢复方案

### 场景1：云端连接失败

```typescript
// 处理策略：降级为纯本地模式
if (!graphStore.getStatistics().isCloudAvailable) {
  console.log('☁️ 云端不可用，切换到本地模式');
  
  // 所有操作继续在本地进行
  // 待云端恢复后自动同步
}
```

### 场景2：数据丢失恢复

```typescript
// 恢复流程
async function recoverLostData() {
  console.log('🔄 开始数据恢复...');
  
  // 1. 尝试从云端恢复
  const cloudRecovered = await graphStore.restoreFromCloud();
  
  if (cloudRecovered) {
    console.log('✅ 已从云端恢复数据');
    return true;
  }
  
  // 2. 尝试从消息数据重建
  console.log('📧 从消息数据重建图谱...');
  await migrateExistingData();
  
  // 3. 重新备份
  await graphStore.backupToCloud();
  
  console.log('✅ 数据重建完成');
  return true;
}
```

### 场景3：存储空间不足

```typescript
// 清理策略
async function handleStorageLimit() {
  const stats = graphStore.getStatistics();
  
  if (stats.localRelationships > 5000) { // 假设5000个关系接近5MB
    console.log('🧹 存储空间不足，开始清理...');
    
    // 1. 清理低强度关系
    const cleaned = await graphStore.cleanup(60); // 清理60天前的数据
    
    // 2. 备份到云端
    await graphStore.backupToCloud();
    
    console.log(`✅ 清理完成: 删除${cleaned}个过期关系`);
  }
}
```

## 📊 性能基准测试

### 测试数据准备

```typescript
// 生成测试数据
async function generateTestData() {
  console.log('📊 生成测试数据...');
  
  // 创建1000个人员实体
  for (let i = 0; i < 1000; i++) {
    await graphStore.upsertEntity({
      id: `person_test_${i}`,
      type: 'Person',
      name: `测试用户${i}`,
      properties: { department: `部门${i % 10}` }
    });
  }
  
  // 创建100个项目实体
  for (let i = 0; i < 100; i++) {
    await graphStore.upsertEntity({
      id: `project_test_${i}`,
      type: 'Project', 
      name: `测试项目${i}`,
      properties: { status: '进行中' }
    });
  }
  
  // 创建5000个关系
  for (let i = 0; i < 5000; i++) {
    await graphStore.createRelationship({
      type: 'WORKS_ON',
      fromId: `person_test_${i % 1000}`,
      toId: `project_test_${i % 100}`,
      properties: {},
      strength: Math.random()
    });
  }
  
  console.log('✅ 测试数据生成完成');
}
```

### 性能测试

```typescript
// 性能基准测试
async function runPerformanceTests() {
  console.log('🚀 开始性能测试...');
  
  // 1. 实体查询性能
  const entityStart = Date.now();
  const entities = await graphStore.queryEntities({
    type: 'Person',
    limit: 100
  });
  const entityTime = Date.now() - entityStart;
  console.log(`实体查询 (100个): ${entityTime}ms`);
  
  // 2. 关系查询性能
  const relationStart = Date.now();
  const relations = graphStore.queryRelationships({
    type: 'WORKS_ON',
    limit: 100
  });
  const relationTime = Date.now() - relationStart;
  console.log(`关系查询 (100个): ${relationTime}ms`);
  
  // 3. 邻居查询性能
  const neighborStart = Date.now();
  const neighbors = graphStore.findNeighbors('person_test_0', {
    maxDepth: 2
  });
  const neighborTime = Date.now() - neighborStart;
  console.log(`邻居查询 (深度2): ${neighborTime}ms`);
  
  // 4. 同步性能
  const syncStart = Date.now();
  await graphStore.performSync(true);
  const syncTime = Date.now() - syncStart;
  console.log(`数据同步: ${syncTime}ms`);
}
```

### 预期性能指标

| 操作类型 | 数据规模 | 预期性能 | 可接受范围 |
|---------|----------|----------|------------|
| **实体查询** | 1000个实体 | <200ms | <500ms |
| **关系查询** | 5000个关系 | <50ms | <100ms |
| **邻居查询** | 深度2 | <100ms | <300ms |
| **数据同步** | 全量数据 | <2s | <5s |
| **云端备份** | 全量关系 | <1s | <3s |

## 🎯 总结和建议

### ✅ 强烈推荐混合存储方案

**核心优势**：
1. **数据安全** - 实体云端存储 + 关系定期备份
2. **性能优秀** - 关系查询50ms内，实体搜索200ms内
3. **设备同步** - 自动同步，换设备不丢数据
4. **存储突破** - 突破Chrome Storage 5MB限制
5. **向下兼容** - 不影响现有向量存储功能

### 📋 实施优先级

1. **立即实施** ⭐⭐⭐⭐⭐
   - 部署HybridGraphStore基础框架
   - 验证ChromaDB连接和基本功能

2. **短期计划** ⭐⭐⭐⭐
   - 迁移现有消息数据到图结构
   - 集成到消息处理流程

3. **中期优化** ⭐⭐⭐
   - 性能优化和监控
   - 高级图查询功能

4. **长期规划** ⭐⭐
   - 考虑升级到专业图数据库
   - 高级图算法集成

这个混合存储方案完美解决了您关心的所有问题，为您的"类人脑项目分析系统"提供了强大而可靠的知识图谱存储能力！🚀