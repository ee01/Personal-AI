/**
 * 浏览器控制台版本 - 占位符清理工具
 * 直接在浏览器控制台中复制粘贴运行
 * 使用完请删除此文件
 */

(async function() {
  // 检查是否在浏览器环境
  if (typeof window === 'undefined') {
    console.error('此工具只能在浏览器环境中运行');
    return;
  }

  // 占位符清理器类
  class PlaceholderCleaner {
    constructor() {
      this.client = null;
      this.collections = new Map();
      this.username = '';
      this.forceClean = false;
    }

    /**
     * 初始化清理工具
     */
    async initialize() {
      try {
        console.log('🔧 初始化占位符清理工具...');

        // 动态加载 ChromaDB 客户端
        if (!window.ChromaClient) {
          console.log('📦 加载 ChromaDB 客户端...');
          
          // 尝试从现有的模块加载
          try {
            const chromaModule = await import('chromadb');
            window.ChromaClient = chromaModule.ChromaClient;
          } catch (error) {
            console.error('❌ 无法加载 ChromaDB 客户端，请确保应用正在运行:', error);
            return false;
          }
        }

        // 获取用户信息
        const userinfo = await this.getUserInfo();
        this.username = userinfo.username;
        console.log(`👤 用户: ${this.username}`);

        // 初始化 ChromaDB 客户端
        this.client = new window.ChromaClient({
          path: 'http://10.32.56.212:8000'  // 默认 ChromaDB 地址
        });

        // 测试连接
        try {
          await this.client.heartbeat();
          console.log('✅ ChromaDB 连接成功');
        } catch (error) {
          console.error('❌ ChromaDB 连接失败，请确保服务正在运行:', error);
          return false;
        }

        // 获取实体集合
        const collectionName = `${this.username}-graph-entities`;
        try {
          const collection = await this.client.getCollection({ 
            name: collectionName 
          });
          this.collections.set(collectionName, collection);
          console.log(`✅ 连接到集合: ${collectionName}`);
        } catch (error) {
          console.error(`❌ 无法连接到集合 ${collectionName}:`, error);
          return false;
        }

        console.log('✅ 清理工具初始化完成');
        return true;
      } catch (error) {
        console.error('❌ 初始化失败:', error);
        return false;
      }
    }

    /**
     * 预览占位符实体
     */
    async preview() {
      try {
        console.log('👀 扫描占位符实体...');

        const collectionName = `${this.username}-graph-entities`;
        const collection = this.collections.get(collectionName);
        
        if (!collection) {
          console.log('❌ 集合不存在');
          return [];
        }

        const result = await collection.get({
          include: ['metadatas']
        });

        if (!result.ids || !result.metadatas) {
          console.log('📭 集合中没有数据');
          return [];
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
              importance: metadata.importance,
              properties: metadata.properties
            });
          }
        }

        console.log(`🎯 发现 ${placeholderInfo.length} 个占位符实体`);
        
        if (placeholderInfo.length > 0) {
          console.log('\n📋 占位符实体详情:');
          placeholderInfo.slice(0, 10).forEach((info, index) => {
            console.log(`  ${index + 1}. ${info.id}`);
            console.log(`     名称: ${info.name}`);
            console.log(`     类型: ${info.type}`);
            console.log(`     描述: ${info.description}`);
            console.log('     ---');
          });

          if (placeholderInfo.length > 10) {
            console.log(`  ... 还有 ${placeholderInfo.length - 10} 个占位符`);
          }

          console.log('\n🗑️  要清理这些占位符，请运行:');
          console.log('cleaner.forceClean = true;');
          console.log('await cleaner.clean();');
        } else {
          console.log('✨ 没有发现占位符实体');
        }

        return placeholderInfo;
      } catch (error) {
        console.error('❌ 预览过程出错:', error);
        return [];
      }
    }

    /**
     * 清理占位符实体
     */
    async clean() {
      if (!this.forceClean) {
        console.log('❌ 请先设置 cleaner.forceClean = true 以确认清理操作');
        return;
      }

      try {
        console.log('🔍 开始清理占位符实体...');

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
          
          if (this.isPlaceholder(metadata)) {
            placeholderIds.push(result.ids[i]);
          }
        }

        console.log(`🎯 发现 ${placeholderIds.length} 个占位符实体`);

        if (placeholderIds.length === 0) {
          console.log('✨ 没有发现占位符实体，无需清理');
          return;
        }

        // 批量删除占位符
        console.log(`🗑️  开始删除 ${placeholderIds.length} 个占位符实体...`);

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
            
            // 批间延迟
            if (i + batchSize < placeholderIds.length) {
              await this.delay(100);
            }
          } catch (error) {
            console.error(`❌ 删除批次失败 (${i}-${i + batch.length}):`, error);
          }
        }

        console.log(`✅ 清理完成！删除了 ${deletedCount} 个占位符实体`);
        
        // 重置强制清理标志
        this.forceClean = false;

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
      if (metadata.description === '自动生成的占位符实体' || 
          metadata.description === '本地占位符实体（缺失的关系引用）') {
        return true;
      }

      // 方法3: 检查 importance 是否为占位符的低权重值
      if (metadata.importance === 0.1 && metadata.accessCount === 0) {
        return true;
      }

      // 方法4: 检查名称是否符合占位符模式
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
     * 获取用户信息
     */
    async getUserInfo() {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await chrome.storage.local.get(['userinfo']);
          return result.userinfo || { username: 'default-user' };
        } catch (error) {
          console.warn('获取用户信息失败，使用默认值');
          return { username: 'default-user' };
        }
      }
      
      return { username: 'default-user' };
    }

    /**
     * 延迟函数
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // 创建全局实例
  window.cleaner = new PlaceholderCleaner();

  // 显示使用说明
  console.log(`
🔧 占位符清理工具已加载！

使用步骤：
1. 初始化工具：
   await cleaner.initialize();

2. 预览占位符（推荐先运行）：
   await cleaner.preview();

3. 执行清理：
   cleaner.forceClean = true;
   await cleaner.clean();

4. 清理完成后刷新页面以清除此工具

注意：清理操作不可撤销，请先使用预览模式查看！
  `);

})();
