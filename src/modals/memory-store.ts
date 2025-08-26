import { defineStore } from 'pinia';
import { ref } from 'vue';

// 实体类型配置
export const ENTITY_TYPE_CONFIG = {
  'Person': { name: '人物', icon: '👥', description: '团队成员、联系人、项目相关人员等' },
  'Project': { name: '项目', icon: '🚀', description: '工作项目、产品开发、研究项目等' },
  'Task': { name: '任务', icon: '📋', description: '具体工作任务、待办事项、行动项等' },
  'Organization': { name: '组织', icon: '🏢', description: '公司、部门、团队、客户组织等' },
  'Document': { name: '文档', icon: '📄', description: '文件、资料、规范、报告等' },
  'Technology': { name: '技术', icon: '🔧', description: '技术栈、工具、框架、平台等' },
  'Topic': { name: '主题', icon: '💡', description: '讨论话题、知识领域、专业概念等' }
};

// Chrome Extension API 封装
export const chromeAPI = {
  async sendMessage(message: any) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
      });
    }
    console.log('模拟Chrome API调用:', message);
    return { success: true, data: null };
  }
};

// Pinia Store
export const useMemoryStore = defineStore('memory', () => {
  const isLoading = ref(false);
  const searchQuery = ref('');
  const entities = ref([]);
  const entityTypes = ref([
    { type: 'Project', name: '项目', icon: '🚀', count: 12 },
    { type: 'Topic', name: '主题', icon: '💡', count: 28 },
    { type: 'Person', name: '人物', icon: '👥', count: 45 },
    { type: 'Organization', name: '组织', icon: '🏢', count: 8 },
    { type: 'Document', name: '文档', icon: '📄', count: 156 },
    { type: 'Technology', name: '技术', icon: '🔧', count: 23 }
  ]);
  const overviewStats = ref({
    totalEntities: 272,
    totalRelationships: 156,
    entitiesCreatedToday: 5,
    entitiesCreatedThisWeek: 23,
    entitiesCreatedThisMonth: 89
  });
  const topicDetailData = ref(null);

  const initialize = async () => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({ type: 'GET_ENTITY_STATISTICS' });
      if (response && response.success) {
        overviewStats.value = response.data;
      }
    } catch (error) {
      console.warn('获取实体统计失败，使用模拟数据');
    } finally {
      isLoading.value = false;
    }
  };

  const loadEntitiesByType = async (entityType: string) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit: 50
      });
      
      if (response && response.success) {
        entities.value = response.data || [];
      } else {
        entities.value = generateMockEntities(entityType);
      }
    } catch (error) {
      entities.value = generateMockEntities(entityType);
    } finally {
      isLoading.value = false;
    }
  };

  const searchEntities = async (query: string) => {
    if (!query.trim()) return;
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        limit: 30
      });
      if (response && response.success) {
        entities.value = response.data || [];
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const loadTopicDetail = async (topicId: string) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({ type: 'GET_TOPIC_DETAIL', topicId });
      if (response && response.success) {
        topicDetailData.value = response.data;
      } else {
        topicDetailData.value = getMockTopicDetail(topicId);
      }
    } catch (error) {
      topicDetailData.value = getMockTopicDetail(topicId);
    } finally {
      isLoading.value = false;
    }
  };

  const generateMockEntities = (entityType: string) => {
    const config = ENTITY_TYPE_CONFIG[entityType];
    if (!config) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${entityType.toLowerCase()}-${i + 1}`,
      name: `${config.name} ${i + 1}`,
      type: entityType,
      description: `这是一个${config.description}的示例`,
      importance: Math.random(),
      accessCount: Math.floor(Math.random() * 100),
      lastAccessed: Date.now() - Math.floor(Math.random() * 86400000),
      relationshipsCount: Math.floor(Math.random() * 20),
      relatedMessagesCount: Math.floor(Math.random() * 50),
      relatedWebpagesCount: Math.floor(Math.random() * 30),
      tags: ['示例', '测试'],
      status: 'active'
    }));
  };

  const getMockTopicDetail = (topicId: string) => {
    return {
      id: topicId,
      title: 'AI 工作流自动化',
      overview: { discussions: 12, projects: 5, participants: 8, resources: 15 },
      relatedProjects: [
        { id: 'project-1', name: 'Personal-AI', status: '开发中', description: 'Chrome扩展智能助手' },
        { id: 'project-2', name: 'Automation Tools', status: '规划中', description: 'CI/CD自动化工具链' }
      ],
      relatedResources: [
        { id: 'resource-1', name: 'AI开发最佳实践', type: '技术文档', url: '#' },
        { id: 'resource-2', name: '自动化工具指南', type: '教程', url: '#' }
      ],
      conversations: [{
        id: 'conv-1',
        sender: '张三',
        group: '技术讨论组',
        time: '30分钟前',
        summary: '分享了最新的AI实现方案和技术心得',
        context: [
          { sender: '李四', content: '这个AI方案看起来很有潜力', time: '35分钟前' },
          { sender: '张三', content: '是的，我们可以在下个版本中集成', time: '30分钟前', isMainMessage: true }
        ]
      }],
      webpages: [{
        id: 'webpage-1',
        title: 'AI开发技术文档',
        url: 'https://example.com/ai-docs',
        type: 'docs',
        visitTime: '2小时前',
        summary: '详细介绍了AI开发的关键技术和实现方法',
        tags: ['AI', '技术文档', '开发指南']
      }]
    };
  };

  return {
    isLoading, searchQuery, entities, entityTypes, overviewStats, topicDetailData,
    initialize, loadEntitiesByType, searchEntities, loadTopicDetail
  };
});
