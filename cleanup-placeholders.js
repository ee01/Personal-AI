/**
 * 占位符实体清理工具
 * 用于一键清理云端 ChromaDB 中的所有占位符实体
 * 使用完请删除此文件
 */

import { ChromaClient } from 'chromadb';

class PlaceholderCleaner {
  constructor() {
    this.client = null;
    this.collections = new Map();
    this.username = '';
  }

  /**
   * 初始化清理工具
   */
  async initialize() {
    try {
      console.log('🔧 初始化占位符清理工具...');

      // 获取用户信息
      const userinfo = await this.getUserInfo();
      this.username = userinfo.username;

      // 初始化 ChromaDB 客户端
      this.client = new ChromaClient({
        path: 'http://10.32.56.212:8000'  // 修改为你的 ChromaDB 地址
      });

      // 获取实体集合
      const collectionName = `${this.username}-graph-entities`;
      this.collections.set(collectionName, await this.client.getCollection({ 
        name: collectionName 
      }));

      console.log('✅ 清理工具初始化完成');
      return true;
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      return false;
    }
  }

  /**
   * 扫描并清理占位符实体
   */
  async cleanPlaceholders() {
    try {
      console.log('🔍 扫描占位符实体...');

      const collectionName = `${this.username}-graph-entities`;
      const collection = this.collections.get(collectionName);
      
      if (!collection) {
        console.log('❌ 集合不存在');
        return;
      }

      // 获取所有实体
      const result = await collection.get({
        include: ['metadatas']
      });

      if (!result.ids || !result.metadatas) {
        console.log('📭 集合中没有数据');
        return;
      }

      // 找出占位符实体
      const placeholderIds = [];
      for (let i = 0; i < result.ids.length; i++) {
        const metadata = result.metadatas[i];
        
        // 检查是否为占位符（多种判断方式）
        if (this.isPlaceholder(metadata)) {
          placeholderIds.push(result.ids[i]);
        }
      }

      console.log(`🎯 发现 ${placeholderIds.length} 个占位符实体`);

      if (placeholderIds.length === 0) {
        console.log('✨ 没有发现占位符实体，无需清理');
        return;
      }

      // 确认清理
      const confirmed = await this.confirmCleanup(placeholderIds);
      if (!confirmed) {
        console.log('❌ 用户取消清理操作');
        return;
      }

      // 批量删除占位符
      await this.deletePlaceholders(collection, placeholderIds);

      console.log(`✅ 清理完成！删除了 ${placeholderIds.length} 个占位符实体`);

    } catch (error) {
      console.error('❌ 清理过程出错:', error);
    }
  }

  /**
   * 判断是否为占位符实体
   */
  isPlaceholder(metadata) {
    // 方法1: 检查 properties.placeholder 字段
    if (metadata.properties) {
      try {
        const properties = typeof metadata.properties === 'string' 
          ? JSON.parse(metadata.properties) 
          : metadata.properties;
        
        if (properties.placeholder === true || properties.createdBy === 'system') {
          return true;
        }
      } catch (e) {
        // 解析失败，继续其他检查
      }
    }

    // 方法2: 检查描述是否为占位符描述
    if (metadata.description === '自动生成的占位符实体') {
      return true;
    }

    // 方法3: 检查 importance 是否为占位符的低权重值
    if (metadata.importance === 0.1 && metadata.accessCount === 0) {
      return true;
    }

    // 方法4: 检查名称是否符合占位符模式（从entityId解析的简单名称）
    if (metadata.name && metadata.id) {
      const [type, name] = metadata.id.split('_', 2);
      const expectedName = name?.replace(/_/g, ' ') || metadata.id;
      if (metadata.name === expectedName && metadata.importance <= 0.1) {
        return true;
      }
    }

    return false;
  }

  /**
   * 确认清理操作
   */
  async confirmCleanup(placeholderIds) {
    console.log('\n📋 即将删除的占位符实体ID列表:');
    placeholderIds.slice(0, 10).forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    
    if (placeholderIds.length > 10) {
      console.log(`  ... 还有 ${placeholderIds.length - 10} 个`);
    }

    console.log('\n⚠️  此操作不可撤销！');
    console.log('请确认要清理这些占位符实体吗？');
    console.log('如果要继续，请在浏览器控制台中运行: cleaner.forceClean = true');
    
    // 在实际使用中，这里应该等待用户确认
    // 这里默认返回 false，需要用户手动设置 forceClean = true
    return this.forceClean === true;
  }

  /**
   * 批量删除占位符实体
   */
  async deletePlaceholders(collection, placeholderIds) {
    console.log(`🗑️  开始删除 ${placeholderIds.length} 个占位符实体...`);

    // 分批删除，避免一次性删除太多
    const batchSize = 50;
    let deletedCount = 0;

    for (let i = 0; i < placeholderIds.length; i += batchSize) {
      const batch = placeholderIds.slice(i, i + batchSize);
      
      try {
        await collection.delete({
          ids: batch
        });
        
        deletedCount += batch.length;
        console.log(`✅ 已删除 ${deletedCount}/${placeholderIds.length} 个占位符`);
        
        // 批间延迟，避免给数据库造成压力
        if (i + batchSize < placeholderIds.length) {
          await this.delay(100);
        }
      } catch (error) {
        console.error(`❌ 删除批次失败 (${i}-${i + batch.length}):`, error);
      }
    }
  }

  /**
   * 预览模式 - 只显示占位符信息，不删除
   */
  async previewPlaceholders() {
    try {
      console.log('👀 预览模式：扫描占位符实体...');

      const collectionName = `${this.username}-graph-entities`;
      const collection = this.collections.get(collectionName);
      
      if (!collection) {
        console.log('❌ 集合不存在');
        return;
      }

      const result = await collection.get({
        include: ['metadatas']
      });

      if (!result.ids || !result.metadatas) {
        console.log('📭 集合中没有数据');
        return;
      }

      console.log(`📊 集合中总共有 ${result.ids.length} 个实体`);

      const placeholderInfo = [];
      for (let i = 0; i < result.ids.length; i++) {
        const metadata = result.metadatas[i];
        
        if (this.isPlaceholder(metadata)) {
          placeholderInfo.push({
            id: result.ids[i],
            name: metadata.name,
            type: metadata.type,
            description: metadata.description,
            importance: metadata.importance
          });
        }
      }

      console.log(`🎯 发现 ${placeholderInfo.length} 个占位符实体:`);
      placeholderInfo.slice(0, 10).forEach((info, index) => {
        console.log(`  ${index + 1}. ${info.id} - ${info.name} (${info.type})`);
      });

      if (placeholderInfo.length > 10) {
        console.log(`  ... 还有 ${placeholderInfo.length - 10} 个占位符`);
      }

      return placeholderInfo;
    } catch (error) {
      console.error('❌ 预览过程出错:', error);
      return [];
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    // 在浏览器环境中运行
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(['userinfo']);
        return result.userinfo || { username: 'default-user' };
      } catch (error) {
        console.warn('获取用户信息失败，使用默认值');
        return { username: 'default-user' };
      }
    }
    
    // 手动设置用户名（如果在 Node.js 环境中运行）
    return { username: 'default-user' };  // 请修改为你的实际用户名
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 使用说明
console.log(`
🔧 占位符清理工具使用说明：

1. 在浏览器控制台中运行以下代码：
   
   // 创建清理器实例
   const cleaner = new PlaceholderCleaner();
   
   // 初始化
   await cleaner.initialize();
   
   // 预览占位符（推荐先运行）
   await cleaner.previewPlaceholders();
   
   // 执行清理（需要确认）
   cleaner.forceClean = true;  // 确认要清理
   await cleaner.cleanPlaceholders();

2. 注意事项：
   - 确保 ChromaDB 正在运行且可访问
   - 修改 getUserInfo() 中的用户名为你的实际用户名
   - 清理操作不可撤销，请先使用预览模式查看
   - 建议在清理前备份重要数据

3. 清理完成后请删除此文件
`);

// 导出清理器类（在浏览器中使用）
if (typeof window !== 'undefined') {
  window.PlaceholderCleaner = PlaceholderCleaner;
}

// Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaceholderCleaner;
}
