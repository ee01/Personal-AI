import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { memorySystem } from '../memory';

// 实体类型配置（中文映射）
const ENTITY_TYPE_CONFIG: Record<string, { name: string; icon: string; description: string }> = {
  'Person': { 
    name: '人物', 
    icon: '👥', 
    description: '团队成员、联系人、项目相关人员等'
  },
  'Project': { 
    name: '项目', 
    icon: '🚀', 
    description: '工作项目、产品开发、研究项目等'
  },
  'Task': { 
    name: '任务', 
    icon: '📋', 
    description: '具体工作任务、待办事项、行动项等'
  },
  'Organization': { 
    name: '组织', 
    icon: '🏢', 
    description: '公司、部门、团队、客户组织等'
  },
  'Document': { 
    name: '文档', 
    icon: '📄', 
    description: '文件、资料、规范、报告等'
  },
  'Technology': { 
    name: '技术', 
    icon: '🔧', 
    description: '技术栈、工具、框架、平台等'
  },
  'Topic': { 
    name: '主题', 
    icon: '💡', 
    description: '讨论话题、知识领域、专业概念等'
  }
};

// 扩展Window接口
declare global {
  interface Window {
    hideLoadingOverlay?: () => void;
  }
}

// 数据接口定义
interface EntityType {
  type: string;
  name: string;
  icon: string;
  count: number;
}

interface EntityItem {
  id: string;
  name: string;
  type: string;
  description?: string;
  importance?: number;
  accessCount?: number;
  lastAccessed?: number;
  updated?: number;
  relationshipsCount?: number;
  relatedMessagesCount?: number;
  relatedWebpagesCount?: number;
  tags?: string[];
  status?: string;
  avatarUrl?: string;
}

interface TimelineEvent {
  id: string;
  type: 'message' | 'webpage' | 'relation_created' | 'entity_updated';
  title: string;
  content: string;
  timestamp: number;
  source?: string;
  metadata?: any;
}

interface OverviewStats {
  totalEntities: number;
  totalRelationships: number;
  entitiesCreatedToday: number;
  entitiesCreatedThisWeek: number;
  entitiesCreatedThisMonth: number;
  entityCounts: Record<string, number>;
  topEntitiesByType: Record<string, EntityItem[]>;
}

// 实体记忆查询组件
const MemoryInterface = () => {
  // 状态管理
  const [activeView, setActiveView] = useState<'overview' | 'timeline' | 'entity-detail' | 'topic-detail'>('overview');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('overview');
  const [selectedEntity, setSelectedEntity] = useState<EntityItem | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<EntityItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [topicDetailData, setTopicDetailData] = useState<any>(null);
  const [activeTopicTab, setActiveTopicTab] = useState<string>('overview');
  
  // 聊天记录相关状态
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatFilter, setChatFilter] = useState('all');
  const [chatPage, setChatPage] = useState(1);
  const [chatPageSize] = useState(10);
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());
  
  // 主题最新讨论缓存
  const [topicDiscussions, setTopicDiscussions] = useState<Record<string, any[]>>({});

  // 实体类型配置在文件顶部定义

  // 初始化数据
  useEffect(() => {
    initializeMemoryInterface();
    
    // 额外的安全措施：延迟隐藏loading overlay以防初始化过快
    const hideLoadingTimeout = setTimeout(() => {
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
        loadingOverlay.classList.add('hidden');
        console.log('⏰ 延迟隐藏加载遮罩（安全措施）');
      }
    }, 2000);

    // 清理定时器
    return () => {
      clearTimeout(hideLoadingTimeout);
    };
  }, []);

  // 监听搜索变化
  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch(searchQuery);
    } else if (selectedEntityType !== 'overview' && selectedEntityType !== 'timeline') {
      loadEntitiesByType(selectedEntityType);
    }
  }, [searchQuery, selectedEntityType]);

  // 初始化接口
  const initializeMemoryInterface = async () => {
    setIsLoading(true);
    console.log('🚀 开始初始化记忆界面...');
    try {
      // 初始化记忆系统
      console.log('🧠 初始化记忆系统...');
      const memoryInitialized = await memorySystem.initialize();
      if (!memoryInitialized) {
        console.warn('⚠️ 记忆系统初始化失败，将使用降级模式');
      }
      
      // 加载概览统计
      console.log('📊 加载概览统计...');
      await loadOverviewStats();
      
      // 加载实体类型统计
      console.log('📋 加载实体类型...');
      await loadEntityTypes();
      
      // 加载最近时间轴
      if (activeView === 'timeline') {
        console.log('⏰ 加载时间轴...');
        await loadRecentTimeline();
      }

      console.log('✅ 记忆界面初始化完成');
    } catch (error) {
      console.error('❌ 初始化记忆界面失败:', error);
    } finally {
      setIsLoading(false);
      
      // 直接操作DOM隐藏HTML中的加载遮罩
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        console.log('📱 加载遮罩已隐藏');
      }
    }
  };

  // 加载概览统计
  const loadOverviewStats = async () => {
    try {
      console.log('📊 请求实体统计数据...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ENTITY_STATISTICS'
      });

      console.log('📊 实体统计响应:', response);
      if (response && response.success) {
        console.log('📊 设置概览统计数据:', response.data);
        setOverviewStats(response.data);
      } else {
        console.warn('📊 获取实体统计失败:', response?.error);
      }
    } catch (error) {
      console.error('❌ 加载概览统计失败:', error);
      // 设置默认数据
      const defaultStats = {
        totalEntities: 0,
        totalRelationships: 0,
        entitiesCreatedToday: 0,
        entitiesCreatedThisWeek: 0,
        entitiesCreatedThisMonth: 0,
        entityCounts: {},
        topEntitiesByType: {}
      };
      console.log('📊 使用默认统计数据:', defaultStats);
      setOverviewStats(defaultStats);
    }
  };

  // 加载实体类型
  const loadEntityTypes = async () => {
    try {
      console.log('📋 请求实体类型数据...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ENTITY_TYPES'
      });

      console.log('📋 实体类型响应:', response);
      if (response && response.success) {
        // 使用新的API响应格式
        if (response.data.entityTypes && Array.isArray(response.data.entityTypes)) {
          console.log('📋 使用新格式的实体类型数据:', response.data.entityTypes);
          const types: EntityType[] = response.data.entityTypes.map((entityType: any) => ({
            type: entityType.type,
            name: entityType.name,
            icon: entityType.icon,
            count: entityType.count
          }));
          console.log('📋 设置实体类型:', types);
          setEntityTypes(types);
        } else {
          // 向后兼容：使用entityCounts
          console.log('📋 使用向后兼容格式:', response.data.entityCounts);
          const types: EntityType[] = Object.entries(response.data.entityCounts || {}).map(([type, count]) => ({
            type,
            name: ENTITY_TYPE_CONFIG[type]?.name || type,
            icon: ENTITY_TYPE_CONFIG[type]?.icon || '📂',
            count: count as number
          }));
          console.log('📋 设置兼容格式实体类型:', types);
          setEntityTypes(types);
        }
      } else {
        console.warn('📋 获取实体类型失败:', response?.error);
      }
    } catch (error) {
      console.error('❌ 加载实体类型失败:', error);
      // 设置默认类型
      const defaultTypes = Object.entries(ENTITY_TYPE_CONFIG).map(([type, config]) => ({
        type,
        name: config.name,
        icon: config.icon,
        count: 0
      }));
      console.log('📋 使用默认实体类型:', defaultTypes);
      setEntityTypes(defaultTypes);
    }
  };

  // 按类型加载实体
  const loadEntitiesByType = async (entityType: string) => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit: 50
      });

      if (response && response.success) {
        const entitiesData = response.data || [];
        setEntities(entitiesData);
        
        // 如果是Topic类型，加载每个主题的最新讨论
        if (entityType === 'Topic') {
          await loadTopicDiscussions(entitiesData);
        }
      }
    } catch (error) {
      console.error('加载实体失败:', error);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载主题最新讨论（优化版：优先使用本地缓存）
  const loadTopicDiscussions = async (topics: EntityItem[]) => {
    const discussions: Record<string, any[]> = {};
    const topicsNeedingCloudQuery: EntityItem[] = [];
    
    // 1. 先尝试从本地缓存获取数据
    for (const topic of topics.slice(0, 10)) { // 限制并发数量
      try {
        // 获取缓存的最近数据
        const cachedData = await memorySystem.getRecentData(topic.id);
        
        if (cachedData && cachedData.conversations.length > 0) {
          // 使用缓存数据，取最新的2条
          discussions[topic.id] = cachedData.conversations.slice(0, 2);
          console.log(`📦 主题 ${topic.name} 使用缓存数据 (${cachedData.conversations.length} 条)`);
        } else {
          // 缓存中没有数据，需要从云端查询
          topicsNeedingCloudQuery.push(topic);
        }
      } catch (error) {
        console.warn(`获取主题 ${topic.id} 的缓存数据失败:`, error);
        topicsNeedingCloudQuery.push(topic);
      }
    }
    
    // 2. 对没有缓存的主题进行云端查询（批量处理以提高性能）
    if (topicsNeedingCloudQuery.length > 0) {
      console.log(`☁️ 需要从云端查询 ${topicsNeedingCloudQuery.length} 个主题的数据`);
      
      // 限制并发数量，避免一次性发起太多请求
      const batchSize = 3;
      for (let i = 0; i < topicsNeedingCloudQuery.length; i += batchSize) {
        const batch = topicsNeedingCloudQuery.slice(i, i + batchSize);
        
        await Promise.allSettled(batch.map(async (topic) => {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'GET_TOPIC_DETAIL',
              topicId: topic.id
            });
            
            if (response && response.success && response.data.conversations) {
              // 取最新的2条讨论
              const recentConversations = response.data.conversations.slice(0, 2);
              discussions[topic.id] = recentConversations;
              
              // 缓存前5条数据到本地，供下次使用
              const conversationsToCache = response.data.conversations.slice(0, 5);
              for (const conversation of conversationsToCache) {
                await memorySystem.updateRecentData(topic.id, 'conversation', conversation);
              }
              
              console.log(`☁️ 主题 ${topic.name} 从云端获取并缓存了 ${conversationsToCache.length} 条数据`);
            } else {
              discussions[topic.id] = [];
            }
          } catch (error) {
            console.warn(`从云端加载主题 ${topic.id} 的讨论失败:`, error);
            discussions[topic.id] = [];
          }
        }));
        
        // 小延迟避免请求过于密集
        if (i + batchSize < topicsNeedingCloudQuery.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    setTopicDiscussions(discussions);
    
    const cachedCount = topics.length - topicsNeedingCloudQuery.length;
    const cloudCount = topicsNeedingCloudQuery.length;
    console.log(`📊 主题讨论加载完成: ${cachedCount} 个使用缓存, ${cloudCount} 个从云端获取`);
  };

  // 执行搜索
  const performSearch = async (query: string) => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        entityType: selectedEntityType !== 'overview' && selectedEntityType !== 'timeline' 
          ? selectedEntityType : undefined,
        limit: 30
      });

      if (response && response.success) {
        setEntities(response.data || []);
      }
    } catch (error) {
      console.error('搜索实体失败:', error);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载最近时间轴
  const loadRecentTimeline = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECENT_TIMELINE',
        limit: 50
      });

      if (response && response.success) {
        setTimeline(response.data || []);
      }
    } catch (error) {
      console.error('加载时间轴失败:', error);
      setTimeline([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 选择实体类型
  const handleEntityTypeSelect = (type: string) => {
    setSelectedEntityType(type);
    setSelectedEntity(null);
    setSearchQuery('');
    
    if (type === 'overview') {
      setActiveView('overview');
    } else if (type === 'timeline') {
      setActiveView('timeline');
      loadRecentTimeline();
    } else {
      setActiveView('entity-detail');
      loadEntitiesByType(type);
    }
  };

  // 查看实体详情
  const handleEntityClick = async (entity: EntityItem) => {
    if (entity.type === 'Topic') {
      // 如果是主题，显示主题详情页
      await handleTopicClick(entity);
    } else {
    setSelectedEntity(entity);
    
    // 更新访问统计
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ENTITY_ACCESS',
        entityId: entity.id
      });
    } catch (error) {
      console.error('更新实体访问失败:', error);
      }
    }
  };

  // 查看主题详情
  const handleTopicClick = async (topic: EntityItem) => {
    setSelectedTopic(topic);
    setActiveView('topic-detail');
    setActiveTopicTab('overview');
    
    // 加载主题详情数据
    await loadTopicDetailData(topic.id);
    
    // 更新访问统计
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ENTITY_ACCESS',
        entityId: topic.id
      });
    } catch (error) {
      console.error('更新主题访问失败:', error);
    }
  };

  // 加载主题详情数据（优化版：使用缓存策略）
  const loadTopicDetailData = async (topicId: string) => {
    setIsLoading(true);
    try {
      // 1. 先尝试从本地缓存获取完整的主题详情
      const cachedTopicDetails = await memorySystem.getCachedTopicDetails(topicId);
      
      if (cachedTopicDetails) {
        console.log(`📦 主题详情页使用缓存数据: ${topicId}`);
        setTopicDetailData(cachedTopicDetails);
        setIsLoading(false);
        return;
      }

      // 2. 缓存不存在，从云端获取数据
      console.log(`☁️ 从云端获取主题详情: ${topicId}`);
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TOPIC_DETAIL',
        topicId: topicId
      });

      if (response && response.success) {
        const topicData = response.data;
        setTopicDetailData(topicData);

        // 3. 缓存详情数据到本地，供下次使用
        try {
          await memorySystem.cacheTopicDetails(topicId, {
            conversations: topicData.conversations || [],
            resources: topicData.relatedResources || [],
            projects: topicData.relatedProjects || [],
            webpages: topicData.webpages || []
          });

          // 4. 同时更新最近数据缓存（前5条）
          const itemsToCache = [
            { type: 'conversation', items: topicData.conversations },
            { type: 'resource', items: topicData.relatedResources },
            { type: 'project', items: topicData.relatedProjects },
            { type: 'webpage', items: topicData.webpages }
          ];

          for (const { type, items } of itemsToCache) {
            if (items && Array.isArray(items)) {
              const recentItems = items.slice(0, 5);
              for (const item of recentItems) {
                await memorySystem.updateRecentData(
                  topicId,
                  type as 'conversation' | 'resource' | 'project' | 'webpage',
                  item
                );
              }
            }
          }

          console.log(`💾 主题详情已缓存: ${topicId}`);
        } catch (cacheError) {
          console.warn('缓存主题详情失败:', cacheError);
        }
      } else {
        // 如果后端接口不存在，使用模拟数据
        console.log(`🎭 使用模拟数据: ${topicId}`);
        const mockTopicData = {
          overview: {
            discussions: 12,
            projects: 5,
            participants: 8,
            resources: 15
          },
          relatedProjects: [
            { id: 'project-1', name: 'Personal-AI', status: '开发中', description: 'Chrome扩展智能助手' },
            { id: 'project-2', name: 'Automation Tools', status: '规划中', description: 'CI/CD自动化工具链' }
          ],
          relatedResources: [
            { id: 'resource-1', name: 'AI开发最佳实践', type: '技术文档', url: '#' },
            { id: 'resource-2', name: '自动化工具指南', type: '教程', url: '#' }
          ],
          conversations: [
            {
              id: 'conv-1',
              sender: '张三',
              group: '技术讨论组',
              time: '30分钟前',
              summary: '分享了最新的AI实现方案和技术心得',
              context: [
                { sender: '李四', content: '这个AI方案看起来很有潜力', time: '35分钟前' },
                { sender: '张三', content: '是的，我们可以在下个版本中集成', time: '30分钟前', isMainMessage: true }
              ]
            }
          ],
          webpages: [
            {
              id: 'webpage-1',
              title: 'AI开发技术文档',
              url: 'https://example.com/ai-docs',
              type: 'docs',
              visitTime: '2小时前',
              summary: '详细介绍了AI开发的关键技术和实现方法',
              tags: ['AI', '技术文档', '开发指南']
            }
          ]
        };
        setTopicDetailData(mockTopicData);
      }
    } catch (error) {
      console.error('加载主题详情失败:', error);
      setTopicDetailData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 返回主题列表
  const handleBackToTopicList = () => {
    setActiveView('entity-detail');
    setSelectedTopic(null);
    setTopicDetailData(null);
  };

  // 执行搜索
  const handleSearch = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim());
    }
  };

  // 处理搜索输入
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 调试功能
  const handleDiagnoseData = async () => {
    console.log('🔍 开始诊断数据状态...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DIAGNOSE_ENTITY_DATA'
      });
      
      console.log('🔍 诊断结果:', response);
      if (response.success) {
        const diagnosis = response.data;
        alert(`诊断结果：
实体数量: ${diagnosis.entitiesCount}
关系数量: ${diagnosis.relationshipsCount}
实体类型: ${diagnosis.entityTypes.join(', ')}

问题: ${diagnosis.issues.join('; ')}
建议: ${diagnosis.suggestions.join('; ')}`);
      }
    } catch (error) {
      console.error('诊断失败:', error);
      alert('诊断失败: ' + error.message);
    }
  };

  const handleInitializeSampleData = async () => {
    if (!confirm('确定要初始化示例数据吗？这将创建一些测试实体和关系。')) {
      return;
    }
    
    console.log('🚀 开始初始化示例数据...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'INITIALIZE_SAMPLE_DATA'
      });
      
      console.log('🚀 初始化结果:', response);
      if (response.success) {
        alert(response.data.message);
        // 刷新界面数据
        await initializeMemoryInterface();
      } else {
        alert('初始化失败: ' + (response.error || response.data?.message));
      }
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败: ' + error.message);
    }
  };

  const handleRebuildIndexes = async () => {
    if (!confirm('确定要重建实体索引吗？')) {
      return;
    }
    
    console.log('🔄 开始重建索引...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REBUILD_ENTITY_INDEXES'
      });
      
      console.log('🔄 重建结果:', response);
      alert(response.message);
      if (response.success) {
        // 刷新界面数据
        await initializeMemoryInterface();
      }
    } catch (error) {
      console.error('重建失败:', error);
      alert('重建失败: ' + error.message);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  // 标记为重点项目
  const handleMarkAsHighlightProject = async (entity: EntityItem) => {
    try {
      // 获取现有的重点项目列表
      const result = await chrome.storage.local.get('highlightProjects');
      const highlightProjects = result.highlightProjects || [];
      
      // 检查是否已经是重点项目
      const isAlreadyHighlighted = highlightProjects.some((p: any) => p.id === entity.id);
      
      if (isAlreadyHighlighted) {
        // 移除重点标记
        const updatedProjects = highlightProjects.filter((p: any) => p.id !== entity.id);
        await chrome.storage.local.set({ highlightProjects: updatedProjects });
        
        // 可以显示一个提示
        alert(`已将 "${entity.name}" 从重点项目中移除`);
      } else {
        // 添加为重点项目
        const projectInfo = {
          id: entity.id,
          name: entity.name,
          description: entity.description,
          addedAt: Date.now(),
          lastViewed: entity.lastAccessed,
          importance: entity.importance,
          tags: entity.tags || []
        };
        
        const updatedProjects = [...highlightProjects, projectInfo];
        await chrome.storage.local.set({ highlightProjects: updatedProjects });
        
        // 设置实体标签，标记为重点项目
        await chrome.runtime.sendMessage({
          type: 'SET_ENTITY_TAGS',
          entityId: entity.id,
          tags: [...(entity.tags || []), 'highlight-project']
        });
        
        alert(`已将 "${entity.name}" 标记为重点项目`);
      }
      
      // 刷新当前视图
      if (selectedEntityType === 'Project') {
        loadEntitiesByType('Project');
      }
      
    } catch (error) {
      console.error('标记重点项目失败:', error);
      alert('操作失败，请稍后重试');
    }
  };

  // 打开项目仪表盘
  const openProjectDashboard = async (entity: EntityItem) => {
    try {
      // 先确保项目在重点项目列表中
      const result = await chrome.storage.local.get('highlightProjects');
      const highlightProjects = result.highlightProjects || [];
      const isHighlighted = highlightProjects.some((p: any) => p.id === entity.id);
      
      if (!isHighlighted) {
        // 如果不在重点项目中，询问是否添加
        const shouldAdd = confirm(`"${entity.name}" 不在重点项目列表中，是否添加并打开仪表盘？`);
        if (shouldAdd) {
          await handleMarkAsHighlightProject(entity);
        }
      }
      
      // 打开项目仪表盘
      const dashboardUrl = chrome.runtime.getURL(`project-dashboard.html?projectId=${entity.id}&projectName=${encodeURIComponent(entity.name)}`);
      
      // 使用弹窗方式打开
      chrome.windows.create({
        url: dashboardUrl,
        type: 'popup',
        width: 1200,
        height: 900,
        focused: true
      });
      
    } catch (error) {
      console.error('打开项目仪表盘失败:', error);
      alert('打开仪表盘失败，请稍后重试');
    }
  };

  // 获取实体图标
  const getEntityIcon = (type: string) => {
    return ENTITY_TYPE_CONFIG[type]?.icon || '📂';
  };

  // 获取时间轴事件图标
  const getTimelineIcon = (type: string) => {
    const icons: Record<string, string> = {
      'message': '💬',
      'webpage': '🌐',
      'relation_created': '🔗',
      'entity_updated': '📝'
    };
    return icons[type] || '📅';
  };

  // 聊天记录相关函数
  const handleChatSearch = (query: string) => {
    setChatSearchQuery(query);
    setChatPage(1); // 重置到第一页
  };

  const handleChatFilter = (filter: string) => {
    setChatFilter(filter);
    setChatPage(1); // 重置到第一页
  };

  const toggleConversationExpand = (conversationId: string) => {
    const newExpanded = new Set(expandedConversations);
    if (newExpanded.has(conversationId)) {
      newExpanded.delete(conversationId);
    } else {
      // 收缩其他展开的对话
      newExpanded.clear();
      newExpanded.add(conversationId);
    }
    setExpandedConversations(newExpanded);
  };

  const getFilteredConversations = () => {
    if (!topicDetailData?.conversations) return [];
    
    let filtered = topicDetailData.conversations;
    
    // 应用搜索过滤
    if (chatSearchQuery.trim()) {
      const query = chatSearchQuery.toLowerCase();
      filtered = filtered.filter((conv: any) => 
        conv.summary.toLowerCase().includes(query) ||
        conv.sender.toLowerCase().includes(query) ||
        conv.group.toLowerCase().includes(query) ||
        conv.originalContent?.toLowerCase().includes(query)
      );
    }
    
    // 应用群组过滤
    if (chatFilter !== 'all') {
      filtered = filtered.filter((conv: any) => {
        switch (chatFilter) {
          case 'team':
            return conv.group.includes('团队') || conv.group.includes('Team');
          case 'project':
            return conv.group.includes('项目') || conv.group.includes('Project');
          case 'tech':
            return conv.group.includes('技术') || conv.group.includes('Tech') || conv.group.includes('开发');
          default:
            return true;
        }
      });
    }
    
    return filtered;
  };

  const getPaginatedConversations = () => {
    const filtered = getFilteredConversations();
    const startIndex = (chatPage - 1) * chatPageSize;
    const endIndex = startIndex + chatPageSize;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalChatPages = () => {
    const filtered = getFilteredConversations();
    return Math.ceil(filtered.length / chatPageSize);
  };

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="highlight">$1</mark>');
  };

  return (
    <div className="memory-container">
      {/* 左侧导航 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">🧠 记忆查询系统</div>
        </div>
        
        <div className="entity-types">
          <div 
            className={`entity-type ${selectedEntityType === 'overview' ? 'active' : ''}`}
            onClick={() => handleEntityTypeSelect('overview')}
          >
            <div className="entity-icon">🏠</div>
            <div className="entity-name">首页概览</div>
          </div>
          
          <div 
            className={`entity-type ${selectedEntityType === 'timeline' ? 'active' : ''}`}
            onClick={() => handleEntityTypeSelect('timeline')}
          >
            <div className="entity-icon">⏰</div>
            <div className="entity-name">时间轴</div>
          </div>
          
          <hr className="sidebar-divider" />
          
          {entityTypes.map((entityType) => (
            <div 
              key={entityType.type}
              className={`entity-type ${selectedEntityType === entityType.type ? 'active' : ''}`}
              onClick={() => handleEntityTypeSelect(entityType.type)}
            >
              <div className="entity-icon">{entityType.icon}</div>
              <div className="entity-name">{entityType.name}</div>
              <div className="entity-count">{entityType.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 搜索头部 */}
        <div className="search-header">
          <div className="search-box">
            <div className="search-icon">🔍</div>
            <input 
              type="text" 
              className="search-input" 
              placeholder="搜索任何内容、实体或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
          </div>
          <div className="filter-btn" onClick={handleSearch}>
            📊 搜索
          </div>
          <div className="filter-btn" onClick={() => setSearchQuery('')}>
            🔄 重置
          </div>
          <div className="filter-btn debug-btn" onClick={handleDiagnoseData} title="诊断数据状态">
            🔍 诊断
          </div>
          <div className="filter-btn debug-btn" onClick={handleInitializeSampleData} title="初始化示例数据">
            🚀 示例数据
          </div>
          <div className="filter-btn debug-btn" onClick={handleRebuildIndexes} title="重建索引">
            🔄 重建索引
          </div>
        </div>

        {/* 首页概览 */}
        {activeView === 'overview' && (
          <div className="overview-section">
            <div className="greeting-card">
              <div className="greeting-title">
                <span>🌅</span>
                <span>欢迎来到记忆查询系统</span>
              </div>
              <div className="greeting-content">
                <p>您的个人知识图谱中包含:</p>
                <ul className="quick-summary">
                  <li>📊 {overviewStats?.totalEntities || 0} 个实体，{overviewStats?.totalRelationships || 0} 个关系</li>
                  <li>📈 今日新增 {overviewStats?.entitiesCreatedToday || 0} 个实体</li>
                  <li>📅 本周新增 {overviewStats?.entitiesCreatedThisWeek || 0} 个实体</li>
                  <li>📆 本月新增 {overviewStats?.entitiesCreatedThisMonth || 0} 个实体</li>
                </ul>
                <p>点击左侧类别开始探索您的记忆 👈</p>
              </div>
            </div>

            <div className="content-grid">
              {/* 今日重点项目 */}
              <div className="content-card" onClick={() => handleEntityTypeSelect('Project')}>
                  <div className="card-header">
                    <div className="card-title">
                    <span>🚀</span>
                    <span>今日重点项目</span>
                    </div>
                  <div className="card-badge">{entityTypes.find(t => t.type === 'Project')?.count || 0} 个活跃</div>
                  </div>
                  <div className="card-content">
                  最近活跃的项目和相关信息
                  </div>
                  <div className="info-list">
                  <div className="info-item">
                    <span>🔥</span>
                    <span>Personal-AI - Chrome 扩展开发</span>
                    <span className="info-time">2 小时前</span>
                      </div>
                  <div className="info-item">
                    <span>📊</span>
                    <span>Data Pipeline - 性能优化</span>
                    <span className="info-time">5 小时前</span>
                  </div>
                  <div className="info-item">
                    <span>🎨</span>
                    <span>Design System - 组件库更新</span>
                    <span className="info-time">1 天前</span>
                  </div>
                  </div>
                  <div className="view-more-btn">
                  <span>查看所有项目</span>
                    <span>→</span>
                  </div>
                </div>

              {/* 热门主题讨论 */}
              <div className="content-card" onClick={() => handleEntityTypeSelect('Topic')}>
                <div className="card-header">
                  <div className="card-title">
                    <span>💡</span>
                    <span>热门主题讨论</span>
                  </div>
                  <div className="card-badge">{entityTypes.find(t => t.type === 'Topic')?.count || 0} 个活跃</div>
                </div>
                <div className="card-content">
                  最近讨论频繁的话题和观点
                </div>
                <div className="info-list">
                  <div className="info-item">
                    <span>🤖</span>
                    <span>AI 工作流自动化实践</span>
                    <span className="info-time">30 分钟前</span>
                  </div>
                  <div className="info-item">
                    <span>⚡</span>
                    <span>前端性能优化策略</span>
                    <span className="info-time">2 小时前</span>
                  </div>
                  <div className="info-item">
                    <span>🎯</span>
                    <span>产品设计思维方法</span>
                    <span className="info-time">4 小时前</span>
                  </div>
                </div>
                <div className="view-more-btn">
                  <span>查看所有主题</span>
                  <span>→</span>
                </div>
              </div>

              {/* 重要联系人动态 */}
              <div className="content-card" onClick={() => handleEntityTypeSelect('People')}>
                <div className="card-header">
                  <div className="card-title">
                    <span>👥</span>
                    <span>重要联系人动态</span>
                  </div>
                  <div className="card-badge">新消息</div>
                </div>
                <div className="card-content">
                  来自同事和合作伙伴的重要更新
                </div>
                <div className="info-list">
                  <div className="info-item">
                    <span>👤</span>
                    <span>张三 - 代码审查反馈</span>
                    <span className="info-time">1 小时前</span>
                  </div>
                  <div className="info-item">
                    <span>👤</span>
                    <span>李四 - 设计稿更新通知</span>
                    <span className="info-time">3 小时前</span>
                  </div>
                  <div className="info-item">
                    <span>👤</span>
                    <span>王五 - 会议纪要分享</span>
                    <span className="info-time">6 小时前</span>
                  </div>
                </div>
                <div className="view-more-btn">
                  <span>查看所有联系人</span>
                  <span>→</span>
                </div>
              </div>

              {/* AI 推荐内容 */}
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">
                    <span>🎯</span>
                    <span>AI 推荐内容</span>
                  </div>
                  <div className="card-badge">智能推荐</div>
                </div>
                <div className="card-content">
                  基于你的兴趣和工作习惯推荐的内容
                </div>
                <div className="info-list">
                  <div className="info-item">
                    <span>📖</span>
                    <span>《Clean Architecture》读书笔记复习</span>
                    <span className="info-time">推荐</span>
                  </div>
                  <div className="info-item">
                    <span>🔧</span>
                    <span>Webpack 5 迁移指南</span>
                    <span className="info-time">推荐</span>
                  </div>
                  <div className="info-item">
                    <span>💡</span>
                    <span>React 18 新特性总结</span>
                    <span className="info-time">推荐</span>
                  </div>
                </div>
                <div className="view-more-btn">
                  <span>查看更多推荐</span>
                  <span>→</span>
                </div>
              </div>

              {/* 今日提醒事项 */}
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">
                    <span>⏰</span>
                    <span>今日提醒事项</span>
                  </div>
                  <div className="card-badge">3 项待办</div>
                </div>
                <div className="card-content">
                  来自日历、Jira 和 AI 生成的待办事项
                </div>
                <div className="info-list">
                  <div className="info-item">
                    <span>🎯</span>
                    <span>完成 Personal-AI 的单元测试</span>
                    <span className="info-time">今天</span>
                  </div>
                  <div className="info-item">
                    <span>📞</span>
                    <span>与产品团队的同步会议</span>
                    <span className="info-time">14:00</span>
                  </div>
                  <div className="info-item">
                    <span>📝</span>
                    <span>更新项目文档</span>
                    <span className="info-time">明天</span>
                  </div>
                </div>
                <div className="view-more-btn">
                  <span>查看完整日程</span>
                  <span>→</span>
                </div>
              </div>

              {/* 最近浏览记录 */}
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">
                    <span>🌐</span>
                    <span>最近浏览记录</span>
                  </div>
                  <div className="card-badge">技术文档</div>
                </div>
                <div className="card-content">
                  你最近查看的技术文档和学习资源
                </div>
                <div className="info-list">
                  <div className="info-item">
                    <span>📘</span>
                    <span>React Query 官方文档</span>
                    <span className="info-time">2 小时前</span>
                  </div>
                  <div className="info-item">
                    <span>🎨</span>
                    <span>Figma API 开发指南</span>
                    <span className="info-time">昨天</span>
                  </div>
                  <div className="info-item">
                    <span>⚡</span>
                    <span>Vite 构建优化技巧</span>
                    <span className="info-time">2 天前</span>
                  </div>
                </div>
                <div className="view-more-btn">
                  <span>查看浏览历史</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 时间轴视图 */}
        {activeView === 'timeline' && (
          <div className="timeline-view">
            <h2>⏰ 最近活动时间轴</h2>
            
            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>加载时间轴数据...</span>
              </div>
            ) : (
              <div className="timeline-container">
                {timeline.map((event, index) => (
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-dot">{getTimelineIcon(event.type)}</div>
                    <div className="timeline-content">
                      <div className="timeline-time">{formatTime(event.timestamp)}</div>
                      <div className="content-card">
                        <div className="card-title">{event.title}</div>
                        <div className="card-content">{event.content}</div>
                        {event.source && (
                          <div className="event-source">来源: {event.source}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {timeline.length === 0 && (
                  <div className="empty-state">
                    <span>📭</span>
                    <p>暂无时间轴数据</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 主题详情视图 */}
        {activeView === 'topic-detail' && selectedTopic && (
          <div className="topic-detail">
            <div className="detail-header">
              <button className="back-btn" onClick={handleBackToTopicList}>
                <span>←</span>
                <span>返回主题列表</span>
              </button>
              <div className="topic-header">
                <div className="topic-avatar">{getEntityIcon(selectedTopic.type)}</div>
                <div className="topic-info">
                  <h2>{selectedTopic.name}</h2>
                  <div className="topic-meta">
                    <span className="meta-item">📈 {topicDetailData?.overview?.discussions || 0} 条讨论</span>
                    <span className="meta-item">🔗 {topicDetailData?.overview?.projects || 0} 个关联项目</span>
                    <span className="meta-item">⏰ 最后更新：{formatTime(selectedTopic.lastAccessed || Date.now())}</span>
                  </div>
                </div>
                <div className="topic-actions">
                  <button className="action-btn">📝 编辑主题</button>
                  <button className="action-btn">🔗 添加关联</button>
                </div>
              </div>
            </div>

            <div className="topic-detail-content">
              {/* 选项卡导航 */}
              <div className="tab-navigation">
                <button 
                  className={`tab-btn ${activeTopicTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTopicTab('overview')}
                >
                  📊 概览
                </button>
                <button 
                  className={`tab-btn ${activeTopicTab === 'projects' ? 'active' : ''}`}
                  onClick={() => setActiveTopicTab('projects')}
                >
                  🚀 相关项目
                </button>
                <button 
                  className={`tab-btn ${activeTopicTab === 'resources' ? 'active' : ''}`}
                  onClick={() => setActiveTopicTab('resources')}
                >
                  📚 相关资源
                </button>
                <button 
                  className={`tab-btn ${activeTopicTab === 'conversations' ? 'active' : ''}`}
                  onClick={() => setActiveTopicTab('conversations')}
                >
                  💬 聊天记录
                </button>
                <button 
                  className={`tab-btn ${activeTopicTab === 'webpages' ? 'active' : ''}`}
                  onClick={() => setActiveTopicTab('webpages')}
                >
                  🌐 网页记录
                </button>
              </div>

              {/* 概览标签页 */}
              {activeTopicTab === 'overview' && (
                <div className="tab-content active">
                  <div className="overview-grid">
                    <div className="summary-card">
                      <div className="card-header">
                        <div className="card-title">
                          <span>📈</span>
                          <span>主题统计</span>
                        </div>
                      </div>
                      <div className="stats-grid">
                        <div className="stat-item">
                          <div className="stat-number">{topicDetailData?.overview?.discussions || 0}</div>
                          <div className="stat-label">讨论条数</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-number">{topicDetailData?.overview?.projects || 0}</div>
                          <div className="stat-label">相关项目</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-number">{topicDetailData?.overview?.participants || 0}</div>
                          <div className="stat-label">参与人员</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-number">{topicDetailData?.overview?.resources || 0}</div>
                          <div className="stat-label">相关资源</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 相关项目标签页 */}
              {activeTopicTab === 'projects' && (
                <div className="tab-content active">
                  <div className="section-header">
                    <h3>📂 相关项目</h3>
                    <button className="add-btn">+ 添加项目</button>
                  </div>
                  <div className="items-grid">
                    {topicDetailData?.relatedProjects?.map((project: any) => (
                      <div key={project.id} className="item-card">
                        <div className="item-header">
                          <div className="item-title">
                            <span>🚀</span>
                            <span>{project.name}</span>
                          </div>
                          <div className="item-actions">
                            <button className="item-action" title="取消关联">❌</button>
                          </div>
                        </div>
                        <div className="item-content">
                          <div className="card-badge-container">
                            <span className="card-badge">{project.status}</span>
                          </div>
                          <p>{project.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 相关资源标签页 */}
              {activeTopicTab === 'resources' && (
                <div className="tab-content active">
                  <div className="section-header">
                    <h3>📚 相关资源</h3>
                    <button className="add-btn">+ 添加资源</button>
                  </div>
                  <div className="items-grid">
                    {topicDetailData?.relatedResources?.map((resource: any) => (
                      <div key={resource.id} className="item-card">
                        <div className="item-header">
                          <div className="item-title">
                            <span>📚</span>
                            <span>{resource.name}</span>
                          </div>
                          <div className="item-actions">
                            <button className="item-action" title="删除资源">❌</button>
                          </div>
                        </div>
                        <div className="item-content">
                          <div className="card-badge-container">
                            <span className="card-badge">{resource.type}</span>
                          </div>
                          <p><a href={resource.url} style={{color: '#60a5fa'}}>查看资源</a></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 聊天记录标签页 */}
              {activeTopicTab === 'conversations' && (
                <div className="tab-content active">
                  <div className="section-header">
                    <h3>💬 聊天记录</h3>
                    <div className="search-controls">
                      <input 
                        type="text" 
                        className="search-input" 
                        placeholder="搜索聊天记录..." 
                        value={chatSearchQuery}
                        onChange={(e) => handleChatSearch(e.target.value)}
                      />
                      <select 
                        className="filter-select"
                        value={chatFilter}
                        onChange={(e) => handleChatFilter(e.target.value)}
                      >
                        <option value="all">全部群组</option>
                        <option value="team">团队群</option>
                        <option value="project">项目群</option>
                        <option value="tech">技术讨论</option>
                      </select>
                    </div>
                  </div>
                  <div className="conversations-list">
                    {getPaginatedConversations().map((conv: any) => {
                      const isExpanded = expandedConversations.has(conv.id);
                      return (
                        <div key={conv.id} className={`conversation-item ${isExpanded ? 'expanded' : ''}`}>
                          <div className="conversation-header">
                            <div className="conversation-meta">
                              <div className="sender-avatar">{conv.sender.charAt(0)}</div>
                              <div className="sender-info">
                                <div className="sender-name">{conv.sender}</div>
                                <div className="group-name">{conv.group}</div>
                              </div>
                            </div>
                            <div className="conversation-time">{conv.time}</div>
                          </div>
                          <div 
                            className="conversation-summary"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(conv.summary, chatSearchQuery)
                            }}
                          />
                          {conv.matchedRules && conv.matchedRules.length > 0 && (
                            <div className="matched-rules">
                              <span className="rules-label">匹配规则:</span>
                              {conv.matchedRules.map((rule: string, index: number) => (
                                <span key={index} className="rule-tag">{rule}</span>
                              ))}
                            </div>
                          )}
                          <div 
                            className={`context-indicator ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleConversationExpand(conv.id)}
                          >
                            <span className="indicator-text">
                              {isExpanded ? '🔼 收起上下文' : `🔍 查看上下文 (${conv.context?.length || 0} 条相关消息)`}
                            </span>
                          </div>
                          {isExpanded && conv.context && conv.context.length > 0 && (
                            <div className="context-content expanded">
                              <div className="context-divider"></div>
                              {conv.context.map((contextMsg: any, index: number) => (
                                <div key={index} className={`context-item ${contextMsg.isMainMessage ? 'main-message' : ''}`}>
                                  <div className="context-header">
                                    <div className="context-sender">{contextMsg.sender}</div>
                                    <div className="context-time">{contextMsg.time || contextMsg.datetime}</div>
                                  </div>
                                  <div 
                                    className="context-content-text"
                                    dangerouslySetInnerHTML={{
                                      __html: contextMsg.isMainMessage 
                                        ? highlightText(contextMsg.content, chatSearchQuery)
                                        : contextMsg.content
                                    }}
                                  />
                                </div>
                              ))}
                              {conv.teamUrl && (
                                <div className="context-actions">
                                  <a href={conv.teamUrl} target="_blank" rel="noopener noreferrer" className="view-in-team-btn">
                                    🔗 在团队中查看完整对话
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {getTotalChatPages() > 1 && (
                    <div className="pagination">
                      <button 
                        className="page-btn"
                        disabled={chatPage === 1}
                        onClick={() => setChatPage(chatPage - 1)}
                      >
                        上一页
                      </button>
                      <span className="page-info">
                        第 {chatPage} 页，共 {getTotalChatPages()} 页 ({getFilteredConversations().length} 条记录)
                      </span>
                      <button 
                        className="page-btn"
                        disabled={chatPage === getTotalChatPages()}
                        onClick={() => setChatPage(chatPage + 1)}
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 网页记录标签页 */}
              {activeTopicTab === 'webpages' && (
                <div className="tab-content active">
                  <div className="section-header">
                    <h3>🌐 网页记录</h3>
                    <div className="search-controls">
                      <input type="text" className="search-input" placeholder="搜索网页记录..." />
                      <select className="filter-select">
                        <option value="all">全部类型</option>
                        <option value="docs">文档</option>
                        <option value="blog">博客</option>
                        <option value="github">GitHub</option>
                      </select>
                    </div>
                  </div>
                  <div className="webpages-list">
                    {topicDetailData?.webpages?.map((webpage: any) => (
                      <div key={webpage.id} className="webpage-item">
                        <div className="webpage-header">
                          <div className="webpage-icon">🌐</div>
                          <div className="webpage-info">
                            <div className="webpage-title">{webpage.title}</div>
                            <div className="webpage-url">{webpage.url}</div>
                            <div className="webpage-meta">
                              <span>访问时间：{webpage.visitTime}</span>
                            </div>
                          </div>
                        </div>
                        <div className="webpage-content">{webpage.summary}</div>
                        <div className="webpage-tags">
                          {webpage.tags?.map((tag: string, index: number) => (
                            <span key={index} className="webpage-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 实体详情视图 */}
        {activeView === 'entity-detail' && (
          <div className="entity-detail">
            <div className="entity-header">
              <div className="entity-avatar">{getEntityIcon(selectedEntityType)}</div>
              <div className="entity-info">
                <h2>{ENTITY_TYPE_CONFIG[selectedEntityType]?.name || selectedEntityType}</h2>
                <div className="entity-meta">
                  共 {entities.length} 个{ENTITY_TYPE_CONFIG[selectedEntityType]?.name || '实体'} 
                  {searchQuery && ` • 搜索: "${searchQuery}"`}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>加载实体数据...</span>
              </div>
            ) : (
              <div className="entities-grid">
                {entities.map((entity) => (
                  <div 
                    key={entity.id} 
                    className="entity-card"
                    onClick={() => handleEntityClick(entity)}
                  >
                    <div className="entity-card-header">
                      <div className="entity-card-title">
                        <span>{getEntityIcon(entity.type)}</span>
                        <span>{entity.name}</span>
                      </div>
                      {entity.importance !== undefined && (
                        <div className="importance-indicator">
                          <div 
                            className="importance-bar" 
                            style={{ width: `${entity.importance * 100}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    
                    {entity.description && (
                      <div className="entity-description">{entity.description}</div>
                    )}
                    
                    <div className="entity-stats">
                      <div className="stat-item">
                        <span>🔗</span>
                        <span>{entity.relationshipsCount || 0} 关系</span>
                      </div>
                      <div className="stat-item">
                        <span>💬</span>
                        <span>{entity.relatedMessagesCount || 0} 消息</span>
                      </div>
                      <div className="stat-item">
                        <span>🌐</span>
                        <span>{entity.relatedWebpagesCount || 0} 网页</span>
                      </div>
                      <div className="stat-item">
                        <span>👁️</span>
                        <span>{entity.accessCount || 0} 访问</span>
                      </div>
                    </div>
                    
                    {/* 主题特殊预览信息 */}
                    {entity.type === 'Topic' && (
                      <div className="topic-preview">
                        <h4 className="preview-title">💬 最新讨论</h4>
                        <div className="preview-messages">
                          {topicDiscussions[entity.id] && topicDiscussions[entity.id].length > 0 ? (
                            topicDiscussions[entity.id].map((conversation: any, idx: number) => (
                              <div key={idx} className="preview-message">
                                <span className="message-sender">{conversation.sender}</span>
                                <span className="message-content">
                                  {conversation.summary.length > 30 
                                    ? conversation.summary.substring(0, 30) + '...' 
                                    : conversation.summary}
                                </span>
                                <span className="message-time">{conversation.time}</span>
                              </div>
                            ))
                          ) : (
                            <div className="preview-message">
                              <span className="message-content" style={{color: '#888', fontStyle: 'italic'}}>
                                暂无相关讨论
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <h4 className="preview-title">🔗 关联项目</h4>
                        <div className="preview-projects">
                          <div className="preview-project">
                            <span className="project-icon">🚀</span>
                            <span className="project-name">Personal-AI</span>
                            <span className="project-status">开发中</span>
                          </div>
                          <div className="preview-project">
                            <span className="project-icon">🔧</span>
                            <span className="project-name">Automation Tools</span>
                            <span className="project-status">规划中</span>
                          </div>
                        </div>
                        
                        <h4 className="preview-title">📚 相关资源</h4>
                        <div className="preview-resources">
                          <div className="preview-resource">
                            <span className="resource-icon">📖</span>
                            <span className="resource-name">技术文档</span>
                          </div>
                          <div className="preview-resource">
                            <span className="resource-icon">💡</span>
                            <span className="resource-name">最佳实践</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 项目特殊操作按钮 */}
                    {entity.type === 'Project' && (
                      <div className="project-actions">
                        <button 
                          className="project-action-btn highlight"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsHighlightProject(entity);
                          }}
                          title="标记为重点项目"
                        >
                          ⭐ 重点项目
                        </button>
                        <button 
                          className="project-action-btn dashboard"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProjectDashboard(entity);
                          }}
                          title="打开项目仪表盘"
                        >
                          📊 仪表盘
                        </button>
                      </div>
                    )}
                    
                    {entity.tags && entity.tags.length > 0 && (
                      <div className="entity-tags">
                        {entity.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="entity-tag">{tag}</span>
                        ))}
                        {entity.tags.length > 3 && (
                          <span className="entity-tag more-tags">+{entity.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="entity-footer">
                      <span className="last-accessed">
                        最后访问: {formatTime(entity.lastAccessed || Date.now())}
                      </span>
                      {entity.status && (
                        <span className={`status-indicator ${entity.status}`}>
                          {entity.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {entities.length === 0 && !isLoading && (
                  <div className="empty-state">
                    <span>{getEntityIcon(selectedEntityType)}</span>
                    <p>暂无{ENTITY_TYPE_CONFIG[selectedEntityType]?.name || '实体'}数据</p>
                    {searchQuery && (
                      <p>尝试修改搜索条件或清空搜索框</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 样式 */}
      <style>{`
        .memory-container {
          display: flex;
          min-height: 100vh;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
          color: #ffffff;
        }

        /* 左侧导航样式 */
        .sidebar {
          width: 280px;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(148, 163, 184, 0.1);
          padding: 2rem 0;
        }

        .sidebar-header {
          padding: 0 2rem 2rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .logo {
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .entity-types {
          padding: 1.5rem 0;
        }

        .entity-type {
          display: flex;
          align-items: center;
          padding: 0.75rem 2rem;
          margin: 0.25rem 0;
          cursor: pointer;
          transition: all 0.3s ease;
          border-left: 3px solid transparent;
        }

        .entity-type:hover {
          background: rgba(59, 130, 246, 0.1);
          border-left-color: #60a5fa;
        }

        .entity-type.active {
          background: rgba(59, 130, 246, 0.2);
          border-left-color: #60a5fa;
        }

        .entity-icon {
          width: 1.5rem;
          height: 1.5rem;
          margin-right: 0.75rem;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .entity-name {
          font-weight: 500;
          flex: 1;
          font-size: 1rem;
        }

        .entity-count {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 0.25rem 0.5rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .sidebar-divider {
          margin: 1rem 0;
          border: none;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        /* 主内容区样式 */
        .main-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        /* 搜索头部样式 */
        .search-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .search-box {
          flex: 1;
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 0.75rem;
          color: #ffffff;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        }

        .search-input::placeholder {
          color: #64748b;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .filter-btn {
          padding: 0.75rem 1.5rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.75rem;
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .filter-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .filter-btn.debug-btn {
          background: rgba(255, 165, 0, 0.1);
          border-color: rgba(255, 165, 0, 0.3);
          color: #ffb366;
          font-size: 0.75rem;
        }

        .filter-btn.debug-btn:hover {
          background: rgba(255, 165, 0, 0.2);
        }

        /* 概览部分样式 */
        .overview-section {
          animation: fadeInUp 0.6s ease-out;
        }

        .greeting-card {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 1rem;
          padding: 2rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(10px);
        }

        .greeting-title {
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .greeting-content {
          color: #cbd5e1;
          line-height: 1.6;
          font-size: 1.1rem;
        }

        .quick-summary {
          list-style: none;
          margin: 1rem 0;
          padding: 0;
        }

        .quick-summary li {
          padding: 0.5rem 0;
          border-left: 3px solid #60a5fa;
          padding-left: 1rem;
          margin: 0.5rem 0;
        }

        /* 内容网格样式 */
        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .content-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 1rem;
          padding: 1.5rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          cursor: pointer;
        }

        .content-card:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .card-badge {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .card-content {
          color: #cbd5e1;
          line-height: 1.5;
          margin-bottom: 1rem;
          font-size: 1rem;
        }

        .info-list {
          margin: 1rem 0;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          transition: all 0.3s ease;
        }

        .info-item:hover {
          background: rgba(59, 130, 246, 0.05);
          border-radius: 0.5rem;
          padding-left: 0.5rem;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-time {
          color: #64748b;
          font-size: 0.875rem;
          margin-left: auto;
        }

        .view-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #60a5fa;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .view-more-btn:hover {
          color: #93c5fd;
        }

        /* 时间轴样式 */
        .timeline-view {
          animation: fadeInUp 0.6s ease-out;
        }

        .timeline-view h2 {
          margin-bottom: 2rem;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .timeline-container {
          position: relative;
        }

        .timeline-item {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .timeline-item:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 1.25rem;
          top: 3rem;
          width: 2px;
          height: calc(100% + 1rem);
          background: linear-gradient(to bottom, #60a5fa, rgba(96, 165, 250, 0.3));
        }

        .timeline-dot {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          color: white;
          flex-shrink: 0;
          z-index: 1;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-time {
          color: #64748b;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .event-source {
          color: #94a3b8;
          font-size: 0.75rem;
          margin-top: 0.5rem;
        }

        /* 实体详情样式 */
        .entity-detail {
          animation: fadeInUp 0.6s ease-out;
        }

        .entity-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .entity-avatar {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .entity-info h2 {
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .entity-meta {
          color: #64748b;
          font-size: 1rem;
        }

        /* 实体网格样式 */
        .entities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1rem;
        }

        .entity-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 0.75rem;
          padding: 1rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .entity-card:hover {
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateY(-2px);
        }

        .entity-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .entity-card-title {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
        }

        .importance-indicator {
          width: 60px;
          height: 4px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .importance-bar {
          height: 100%;
          background: linear-gradient(90deg, #60a5fa, #a78bfa);
          transition: width 0.3s ease;
        }

        .entity-description {
          color: #cbd5e1;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.75rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .entity-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .entity-tags {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .entity-tag {
          padding: 0.125rem 0.375rem;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 0.25rem;
          font-size: 0.625rem;
        }

        .entity-tag.more-tags {
          background: rgba(148, 163, 184, 0.2);
          color: #94a3b8;
        }

        .entity-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: #64748b;
        }

        /* 主题预览样式 */
        .topic-preview {
          margin-top: 1rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
          padding-top: 1rem;
        }

        .preview-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #60a5fa;
          margin-bottom: 0.5rem;
          margin-top: 0.75rem;
        }

        .preview-title:first-child {
          margin-top: 0;
        }

        .preview-messages, .preview-projects, .preview-resources {
          margin-bottom: 0.75rem;
        }

        .preview-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.05);
          font-size: 0.75rem;
        }

        .preview-message:last-child {
          border-bottom: none;
        }

        .message-sender {
          font-weight: 600;
          color: #93c5fd;
          min-width: 3rem;
        }

        .message-content {
          flex: 1;
          color: #cbd5e1;
        }

        .message-time {
          color: #64748b;
          font-size: 0.625rem;
          min-width: 4rem;
          text-align: right;
        }

        .preview-project, .preview-resource {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
          font-size: 0.75rem;
        }

        .project-icon, .resource-icon {
          width: 1rem;
          font-size: 0.875rem;
        }

        .project-name, .resource-name {
          flex: 1;
          color: #cbd5e1;
        }

        .project-status {
          padding: 0.125rem 0.375rem;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 0.25rem;
          font-size: 0.625rem;
        }

        /* 项目操作按钮样式 */
        .project-actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .project-action-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          flex: 1;
        }

        .project-action-btn.highlight {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
        }

        .project-action-btn.highlight:hover {
          background: linear-gradient(135deg, #d97706, #b45309);
          transform: translateY(-1px);
        }

        .project-action-btn.dashboard {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .project-action-btn.dashboard:hover {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          transform: translateY(-1px);
        }

        .last-accessed {
          color: #64748b;
        }

        .status-indicator {
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 500;
        }

        .status-indicator.active {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .status-indicator.inactive {
          background: rgba(148, 163, 184, 0.2);
          color: #94a3b8;
        }

        /* 加载和空状态样式 */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #94a3b8;
        }

        .loading-spinner {
          width: 2rem;
          height: 2rem;
          border: 2px solid rgba(96, 165, 250, 0.3);
          border-top: 2px solid #60a5fa;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #94a3b8;
          text-align: center;
        }

        .empty-state span {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        /* 动画 */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* 主题详情页样式 */
        .topic-detail {
          animation: fadeInUp 0.6s ease-out;
        }

        .detail-header {
          margin-bottom: 2rem;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          padding: 0.75rem 1.5rem;
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 1.5rem;
        }

        .back-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .topic-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
        }

        .topic-avatar {
          width: 4rem;
          height: 4rem;
          border-radius: 1rem;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          flex-shrink: 0;
        }

        .topic-info {
          flex: 1;
        }

        .topic-info h2 {
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .topic-meta {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .meta-item {
          color: #94a3b8;
          font-size: 0.875rem;
        }

        .topic-actions {
          display: flex;
          gap: 0.75rem;
        }

        .action-btn {
          padding: 0.75rem 1.5rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .action-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        /* 选项卡样式 */
        .tab-navigation {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          padding-bottom: 1rem;
          overflow-x: auto;
        }

        .tab-btn {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          border-radius: 0.5rem;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          font-size: 0.875rem;
        }

        .tab-btn.active {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .tab-btn:hover:not(.active) {
          background: rgba(59, 130, 246, 0.1);
          color: #93c5fd;
        }

        /* 选项卡内容 */
        .tab-content {
          display: block;
          animation: fadeInUp 0.4s ease-out;
        }

        /* 概览页面 */
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
        }

        .summary-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 1rem;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-top: 1rem;
        }

        .stat-item {
          text-align: center;
          padding: 1rem;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 0.75rem;
        }

        .stat-number {
          font-size: 1.75rem;
          font-weight: 700;
          color: #60a5fa;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }

        /* 列表项样式 */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .section-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .add-btn {
          padding: 0.75rem 1.5rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.5rem;
          color: #22c55e;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 1rem;
        }

        .add-btn:hover {
          background: rgba(34, 197, 94, 0.2);
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1rem;
        }

        .item-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 0.75rem;
          padding: 1rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .item-card:hover {
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateY(-2px);
        }

        .item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .item-title {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
        }

        .item-actions {
          display: flex;
          gap: 0.25rem;
        }

        .item-action {
          padding: 0.25rem;
          background: transparent;
          border: none;
          border-radius: 0.25rem;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .item-action:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .item-content {
          color: #cbd5e1;
          font-size: 1rem;
          line-height: 1.5;
        }

        .card-badge-container {
          margin-bottom: 0.5rem;
        }

        /* 搜索控件 */
        .search-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .filter-select {
          padding: 0.75rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 0.5rem;
          color: #ffffff;
          min-width: 120px;
          font-size: 1rem;
        }

        /* 聊天记录样式 */
        .conversations-list {
          margin-bottom: 2rem;
        }

        .conversation-item {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1rem;
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .conversation-item:hover {
          border-color: rgba(59, 130, 246, 0.3);
        }

        .conversation-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .conversation-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .sender-avatar {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }

        .sender-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .sender-name {
          font-weight: 600;
          font-size: 1rem;
        }

        .group-name {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .conversation-time {
          font-size: 0.875rem;
          color: #64748b;
        }

        .conversation-summary {
          color: #cbd5e1;
          line-height: 1.5;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        /* 匹配规则样式 */
        .matched-rules {
          margin: 0.75rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .rules-label {
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .rule-tag {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        /* 上下文指示器样式 */
        .context-indicator {
          margin-top: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
          user-select: none;
        }

        .context-indicator:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .context-indicator.expanded {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .indicator-text {
          font-size: 0.875rem;
          color: #60a5fa;
          font-weight: 500;
        }

        /* 上下文内容样式 */
        .context-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }

        .context-content.expanded {
          max-height: 500px;
          overflow-y: auto;
        }

        .context-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.3), transparent);
          margin: 1rem 0;
        }

        .context-item {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 0.5rem;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          transition: all 0.3s ease;
        }

        .context-item:last-child {
          margin-bottom: 0;
        }

        .context-item.main-message {
          border-color: rgba(34, 197, 94, 0.3);
          background: rgba(34, 197, 94, 0.1);
        }

        .context-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .context-sender {
          font-weight: 600;
          font-size: 0.875rem;
          color: #e2e8f0;
        }

        .context-time {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .context-content-text {
          color: #cbd5e1;
          line-height: 1.5;
          font-size: 0.875rem;
        }

        .context-actions {
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .view-in-team-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          color: #60a5fa;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .view-in-team-btn:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
          transform: translateY(-1px);
        }

        /* 高亮样式 */
        .highlight {
          background: rgba(251, 191, 36, 0.3);
          color: #fbbf24;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-weight: 600;
        }

        /* 分页样式改进 */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 2rem;
          padding: 1rem 0;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .page-btn {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          color: #60a5fa;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .page-btn:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
          transform: translateY(-1px);
        }

        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 500;
        }

        /* 网页记录样式 */
        .webpages-list {
          margin-bottom: 2rem;
        }

        .webpage-item {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1rem;
          transition: all 0.3s ease;
        }

        .webpage-item:hover {
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateY(-1px);
        }

        .webpage-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .webpage-icon {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .webpage-info {
          flex: 1;
          min-width: 0;
        }

        .webpage-title {
          font-weight: 600;
          margin-bottom: 0.25rem;
          font-size: 1.1rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .webpage-url {
          font-size: 0.875rem;
          color: #60a5fa;
          margin-bottom: 0.5rem;
          word-break: break-all;
        }

        .webpage-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .webpage-content {
          color: #cbd5e1;
          font-size: 1rem;
          line-height: 1.5;
          margin-bottom: 0.75rem;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .webpage-tags {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .webpage-tag {
          padding: 0.25rem 0.5rem;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .memory-container {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            height: auto;
            position: static;
          }

          .main-content {
            padding: 1rem;
          }

          .content-grid,
          .entities-grid {
            grid-template-columns: 1fr;
          }

          .search-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .search-box {
            width: 100%;
          }

          .topic-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .topic-actions {
            width: 100%;
            justify-content: stretch;
          }

          .action-btn {
            flex: 1;
          }

          .tab-navigation {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};

// 渲染组件
ReactDOM.render(
  <React.StrictMode>
    <MemoryInterface />
  </React.StrictMode>,
  document.getElementById('memory-root')
);
