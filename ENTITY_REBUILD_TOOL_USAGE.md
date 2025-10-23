# 实体重建工具使用指南

## 概述

实体重建工具 (`EntityRebuildTool`) 是一个新的数据库维护工具，用于从不同数据源重建实体的关联数据。

## 功能

### 1. 📧 从聊天消息重建

**用途**：修复空 `conversations` 的实体问题

**工作流程**：
1. 扫描所有聊天消息记录（`{username}-messages` 集合）
2. 从每条消息的 metadata 中提取实体信息
3. 调用 `updateEntitiesWithRelatedData()` 方法
4. 为每个实体建立 `conversations` 关联
5. 更新实体的统计信息（conversations 数量、热度等）

**适用场景**：
- V6 迁移后实体 conversations 为空
- 系统升级后需要重建实体关联
- 实体数据损坏需要修复

**使用方法**：
1. 打开扩展程序的选项页面
2. 找到"数据库维护"部分
3. 点击"📧 从聊天消息重建"按钮
4. 确认操作提示
5. 等待处理完成

**注意事项**：
- 处理时间取决于消息数量（每10条消息为一批）
- 建议在系统空闲时执行
- 不会删除现有数据，只会更新/添加关联

### 2. 🌐 从网页浏览重建（开发中）

**未来功能**：
- 从浏览历史中提取实体
- 建立实体与网页的关联
- 更新 `webpages` 关联数据

### 3. 🗑️ 清空所有实体

**用途**：完全清空实体数据，用于重置或测试

**操作内容**：
1. 删除 `{username}-graph-entities` 集合
2. 清空本地缓存（`ENTITIES`, `ENTITY_TO_RELATIONS`, `TYPE_TO_ENTITIES`）
3. **不会**影响原始消息和网页数据

**安全机制**：
- 需要确认对话框
- 需要输入 "DELETE" 文本确认
- 操作不可逆

**使用场景**：
- 需要完全重建实体系统
- 测试环境重置
- 数据迁移前清理

## 界面元素

### 进度显示
- **进度条**：显示当前处理进度
- **实时状态**：显示当前处理的消息 ID
- **百分比**：显示完成百分比

### 统计信息
重建完成后显示：
- 处理消息数
- 关联的 conversations 数
- 错误数
- 成功率

### 状态消息
颜色编码：
- 🔵 **蓝色**（info）：处理中
- 🟢 **绿色**（success）：成功
- 🟡 **黄色**（warning）：警告
- 🔴 **红色**（error）：错误

## 技术实现

### 核心逻辑

```typescript
// 1. 获取所有消息
const messagesResult = await messagesCollection.get({
    include: ['metadatas'] as any
});

// 2. 批量处理（每批10条）
for (let i = 0; i < messagesResult.ids.length; i += batchSize) {
    // 3. 提取实体
    const entities = typeof metadata.entities === 'string' 
        ? JSON.parse(metadata.entities)
        : metadata.entities;
    
    // 4. 重建关联
    await cloudStorage.updateEntitiesWithRelatedData(
        metadata,
        messageId
    );
}
```

### 与 updateEntitiesWithRelatedData 的协作

重建工具依赖于更新后的 `updateEntitiesWithRelatedData` 方法：

```typescript
async updateEntitiesWithRelatedData(
    messageMetadata: any,
    messageId: string,
): Promise<void> {
    // 1. 从 metadata 提取实体
    const extractedEntities = this.extractEntitiesFromMetadata(messageMetadata, messageId);
    
    // 2. 阶段1：确保所有实体存在
    const entityIdMap = new Map<string, string>();
    for (const entity of extractedEntities) {
        // 检查现有 or 创建新实体
    }
    
    // 3. 阶段2：构建关联数据
    for (const entity of extractedEntities) {
        const relatedData = await this.buildEntityRelatedDataFromMessage(...);
        await memorySystem.updateEntity(entityId, { relatedData });
    }
}
```

## 性能考虑

### 批处理策略
- **批次大小**：10条消息/批
- **批次间延迟**：100ms
- **原因**：避免过载 ChromaDB 和浏览器

### 资源占用
- **内存**：中等（需要加载消息 metadata）
- **CPU**：中等（实体提取和向量计算）
- **网络**：高（频繁与 ChromaDB 通信）

### 时间估算
假设：
- 1000 条消息
- 每条消息平均 3 个实体
- 每个实体处理 ~200ms

**总时间**：约 10-15 分钟

## 故障排查

### 问题：重建失败

**可能原因**：
1. ChromaDB 连接失败
   - 检查 ChromaDB 服务是否运行
   - 检查配置中的 CHROMA_HOST 和 CHROMA_PORT

2. Entities 解析失败
   - 检查消息 metadata 中的 entities 字段格式
   - 查看浏览器控制台的错误日志

3. 权限不足
   - 确保扩展有足够的权限访问 Chrome Storage

### 问题：处理速度慢

**解决方案**：
1. 关闭其他标签页减少资源占用
2. 等待系统空闲时再执行
3. 检查 ChromaDB 服务器性能

### 问题：统计数据不准确

**可能原因**：
- 某些消息没有 entities 字段
- Entities 格式不正确
- 实体已存在但未被识别为相似实体

**检查方法**：
查看浏览器控制台日志：
```
⏭️ 跳过消息（无实体）: msg_xxx
⏭️ 跳过消息（空实体）: msg_xxx
✅ 消息处理完成: msg_xxx
❌ 处理消息失败: msg_xxx
```

## 最佳实践

### 首次使用
1. **备份数据**：先导出配置和重要数据
2. **小规模测试**：可以先手动处理几条消息验证
3. **监控日志**：打开控制台观察处理过程
4. **验证结果**：完成后检查几个实体的 conversations

### 定期维护
1. **每月重建一次**：保持数据最新
2. **V6 迁移后**：立即执行重建
3. **系统升级后**：验证数据完整性

### 清空操作
1. **三思而后行**：确认真的需要清空
2. **备份数据**：先备份到其他地方
3. **重建计划**：清空后立即重建

## 相关文档

- [V6 迁移 Bug 分析](./V6_MIGRATION_CONVERSATIONS_BUG.md)
- [实体来源追踪实施方案](./ENTITY_SOURCE_TRACKING_IMPLEMENTATION.md)
- [Conversations 空值诊断](./CONVERSATIONS_EMPTY_DIAGNOSIS.md)

## 更新日志

### v1.0.0 (2024-10-22)
- ✅ 实现从聊天消息重建功能
- ✅ 添加进度显示和统计信息
- ✅ 实现清空所有实体功能
- ⏳ 预留从网页浏览重建功能

## 未来计划

1. **从网页浏览重建**
   - 扫描 `{username}-webpages` 集合
   - 提取网页中的实体
   - 建立 `webpages` 关联

2. **增量重建**
   - 只处理最近 N 天的消息
   - 避免全量重建的性能问题

3. **智能去重**
   - 检测重复的 conversations
   - 自动清理冗余关联

4. **并行处理**
   - 使用 Web Workers
   - 提升大规模重建的速度

5. **实体来源追踪**
   - 记录 createdBy 和 updatedBy
   - 支持按来源筛选和统计

