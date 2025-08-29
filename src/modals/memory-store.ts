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
  const personDetailData = ref(null);

  const initialize = async () => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({ type: 'GET_ENTITY_STATISTICS' });
      if (response && (response as any).success) {
        overviewStats.value = (response as any).data;
      }
    } catch (error) {
      console.warn('获取实体统计失败，使用模拟数据');
    } finally {
      isLoading.value = false;
    }
  };

  const loadEntitiesByType = async (entityType: string, offset = 0, limit = 30) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit,
        offset
      });
      
      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
        
        // 如果是第一页数据，检查 Topic 类型实体是否需要补充 recent data
        if (offset === 0 && entityType === 'Topic') {
          await enrichTopicEntitiesWithDetails(entities.value);
        }
      } else {
        entities.value = generateMockEntities(entityType);
      }
    } catch (error) {
      entities.value = generateMockEntities(entityType);
    } finally {
      isLoading.value = false;
    }
  };

  // 为 Topic 实体补充详细信息
  const enrichTopicEntitiesWithDetails = async (topicEntities: any[]) => {
    for (const entity of topicEntities) {
      // 检查是否缺少 recent data（没有讨论、资源、项目）
      const hasRecentData = (
        (entity.statistic?.conversations > 0) ||
        (entity.recentDataDetails?.conversations && entity.recentDataDetails.conversations.length > 0) ||
        (entity.recentDataDetails?.resources && entity.recentDataDetails.resources.length > 0) ||
        (entity.recentDataDetails?.projects && entity.recentDataDetails.projects.length > 0)
      );
      
      if (!hasRecentData) {
        try {
          // 调用 handleGetTopicDetail 获取详细信息
          const detailResponse = await chromeAPI.sendMessage({
            type: 'GET_TOPIC_DETAIL',
            topicId: entity.id
          });
          
          if (detailResponse && (detailResponse as any).success && (detailResponse as any).data) {
            const details = (detailResponse as any).data;
            
            // 更新实体信息（使用统一的 CachedEntityDetail 结构）
            if (!entity.statistic) entity.statistic = {};
            entity.statistic.conversations = details.statistic?.conversations || 0;
            entity.statistic.webpages = details.statistic?.webpages || 0;
            if (!entity.recentDataDetails) entity.recentDataDetails = {
              conversations: [],
              webpages: [],
              resources: [],
              projects: [],
              people: [],
              topics: [],
              jiraTickets: [],
              cooccurringEntities: []
            };
            entity.recentDataDetails.conversations = details.recentDataDetails?.conversations?.slice(0, 2) || [];
            entity.recentDataDetails.resources = details.recentDataDetails?.resources?.slice(0, 2) || [];
            entity.recentDataDetails.projects = details.recentDataDetails?.projects?.slice(0, 2) || [];
            entity.cachedAt = details.cachedAt || Date.now();
          }
        } catch (error) {
          console.error(`补充 Topic ${entity.id} 详细信息失败:`, error);
        }
      }
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
      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const vectorSearchEntities = async (query: string) => {
    if (!query.trim()) return;
    isLoading.value = true;
    searchQuery.value = query;
    try {
      const response = await chromeAPI.sendMessage({
        type: 'VECTOR_SEARCH_ENTITIES',
        query,
        limit: 20
      });
      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
      } else {
        // 使用模拟数据展示向量搜索结果
        entities.value = generateMockVectorSearchResults(query);
      }
    } catch (error) {
      console.error('向量搜索失败:', error);
      // 使用模拟数据
      entities.value = generateMockVectorSearchResults(query);
    } finally {
      isLoading.value = false;
    }
  };

  const loadTopicDetail = async (topicId: string) => {
    isLoading.value = true;
    try {
      const response = await chromeAPI.sendMessage({ type: 'GET_TOPIC_DETAIL', topicId });
      if (response && (response as any).success) {
        topicDetailData.value = (response as any).data;
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
    const config = ENTITY_TYPE_CONFIG[entityType as keyof typeof ENTITY_TYPE_CONFIG];
    if (!config) return [];
    
    if (entityType === 'Topic') {
      return [
        {
          id: 'topic-ai-workflow',
          name: 'AI 工作流自动化',
          type: entityType,
          description: '讨论AI在工作流程中的应用和自动化实践',
          importance: 0.9,
          updated: Date.now() - 1800000, // 30分钟前
          latestConversations: [
            {
              id: 'msg-1',
              sender: '张三',
              group: '技术讨论组',
              datetime: new Date(Date.now() - 1800000).toISOString(),
              summary: '分享了最新的GPT-4 API集成经验，讨论了Token优化策略',
              originalContent: '我找到了一些优化Token使用的方法，可以减少30%的成本',
              highlightText: 'GPT-4 API Token优化策略',
              teamUrl: '#',
              matchedRules: ['AI', '优化'],
              relevanceScore: 0.95,
              context: [] as any[]
            },
            {
              id: 'msg-2',
              sender: '李四',
              group: '产品团队',
              datetime: new Date(Date.now() - 7200000).toISOString(),
              summary: '讨论了自动化测试的实现方案，提出了新的测试框架选型建议',
              originalContent: '建议采用Playwright + Jest的组合，覆盖率会更高',
              highlightText: '自动化测试实现方案',
              teamUrl: '#',
              matchedRules: ['测试', '自动化'],
              relevanceScore: 0.88,
              context: [] as any[]
            }
          ],
          relatedResources: [
            {
              id: 'resource-1',
              name: 'GPT-4 API 官方文档',
              url: 'https://platform.openai.com/docs'
            },
            {
              id: 'resource-2',
              name: '自动化实践指南',
              url: '#'
            }
          ],
          relatedProjects: [
            {
              id: 'project-1',
              name: 'Personal-AI',
              status: '开发中'
            },
            {
              id: 'project-2',
              name: 'Automation Tools',
              status: '规划中'
            }
          ],
          tags: ['AI', '自动化', '工作流'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 12,
            projects: 2,
            participants: 8,
            resources: 2,
            documents: 1,
            webpages: 3,
            relationships: 5
          }
        },
        {
          id: 'topic-frontend-optimization',
          name: '前端性能优化策略',
          type: entityType,
          description: '前端应用性能优化的技术讨论和最佳实践分享',
          importance: 0.8,
          updated: Date.now() - 7200000, // 2小时前
          latestConversations: [
            {
              id: 'msg-3',
              sender: '王五',
              group: '前端团队',
              datetime: new Date(Date.now() - 7200000).toISOString(),
              summary: '分析了React 18的并发特性对性能的影响',
              originalContent: 'React 18的并发特性可以显著提升用户体验',
              highlightText: 'React 18并发特性',
              teamUrl: '#',
              matchedRules: ['React', '性能'],
              relevanceScore: 0.92,
              context: [] as any[]
            },
            {
              id: 'msg-4',
              sender: '张三',
              group: '技术讨论组',
              datetime: new Date(Date.now() - 14400000).toISOString(),
              summary: 'Bundle体积优化技巧分享，减少30%的包大小',
              originalContent: '通过Webpack配置优化，我们成功减少了30%的Bundle大小',
              highlightText: 'Bundle体积优化',
              teamUrl: '#',
              matchedRules: ['优化', 'Webpack'],
              relevanceScore: 0.89,
              context: [] as any[]
            }
          ],
          relatedResources: [
            {
              id: 'resource-3',
              name: 'React 18 性能指南',
              url: '#'
            },
            {
              id: 'resource-4',
              name: 'Webpack 优化手册',
              url: '#'
            }
          ],
          relatedProjects: [
            {
              id: 'project-3',
              name: 'Web Platform',
              status: '优化中'
            }
          ],
          tags: ['前端', '性能', 'React'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 8,
            projects: 1,
            participants: 5,
            resources: 2,
            documents: 2,
            webpages: 1,
            relationships: 3
          }
        },
        {
          id: 'topic-design-thinking',
          name: '产品设计思维方法',
          type: entityType,
          description: '产品设计流程、用户体验设计方法论的探讨',
          importance: 0.7,
          updated: Date.now() - 14400000, // 4小时前
          latestConversations: [
            {
              id: 'msg-5',
              sender: '李四',
              group: '设计团队',
              datetime: new Date(Date.now() - 14400000).toISOString(),
              summary: '用户研究方法在产品迭代中的应用案例分析',
              originalContent: '通过用户访谈和行为分析，我们发现了几个重要的改进点',
              highlightText: '用户研究方法应用',
              teamUrl: '#',
              matchedRules: ['用户研究', '产品迭代'],
              relevanceScore: 0.87,
              context: [] as any[]
            },
            {
              id: 'msg-6',
              sender: '产品经理',
              group: '产品团队',
              datetime: new Date(Date.now() - 21600000).toISOString(),
              summary: '设计系统在大型项目中的管理经验分享',
              originalContent: '建立统一的设计系统对大型项目的协作效率有显著提升',
              highlightText: '设计系统管理经验',
              teamUrl: '#',
              matchedRules: ['设计系统', '项目管理'],
              relevanceScore: 0.85,
              context: [] as any[]
            }
          ],
          relatedResources: [
            {
              id: 'resource-5',
              name: '设计思维实践手册',
              url: '#'
            }
          ],
          relatedProjects: [
            {
              id: 'project-4',
              name: 'Design System',
              status: '进行中'
            },
            {
              id: 'project-5',
              name: 'Mobile App',
              status: '设计中'
            }
          ],
          tags: ['设计', 'UX', '产品'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 6,
            projects: 2,
            participants: 4,
            resources: 1,
            documents: 1,
            webpages: 2,
            relationships: 2
          }
        }
      ];
    }
    
    if (entityType === 'Project') {
      return [
        {
          id: 'project-personal-ai',
          name: 'Personal-AI',
          type: entityType,
          description: 'Chrome扩展智能助手，帮助用户管理知识图谱和提升工作效率',
          importance: 0.95,
          accessCount: 156,
          lastAccessed: Date.now() - 7200000, // 2小时前
          tags: ['Chrome扩展', 'AI', '智能助手'],
          status: 'active',
          isHighlighted: true,
          cachedAt: Date.now(),
          statistic: {
            conversations: 67,
            projects: 1,
            participants: 8,
            resources: 15,
            documents: 10,
            webpages: 34,
            relationships: 23
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[],
          relatedResources: [] as any[],
          relatedProjects: [] as any[]
        },
        {
          id: 'project-data-pipeline',
          name: 'Data Pipeline',
          type: entityType,
          description: '数据处理流水线，支持大规模数据的ETL处理和分析',
          importance: 0.8,
          accessCount: 89,
          lastAccessed: Date.now() - 18000000, // 5小时前
          tags: ['数据处理', 'ETL', '大数据'],
          status: 'active',
          isHighlighted: false,
          cachedAt: Date.now(),
          statistic: {
            conversations: 42,
            projects: 1,
            participants: 5,
            resources: 8,
            documents: 5,
            webpages: 18,
            relationships: 15
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[],
          relatedResources: [] as any[],
          relatedProjects: [] as any[]
        },
        {
          id: 'project-web-platform',
          name: 'Web Platform',
          type: entityType,
          description: '前端Web平台，提供统一的用户界面和交互体验',
          importance: 0.7,
          accessCount: 134,
          lastAccessed: Date.now() - 43200000, // 12小时前
          tags: ['前端', 'Web', '用户体验'],
          status: 'active',
          isHighlighted: true,
          cachedAt: Date.now(),
          statistic: {
            conversations: 78,
            projects: 1,
            participants: 12,
            resources: 20,
            documents: 15,
            webpages: 45,
            relationships: 28
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[],
          relatedResources: [] as any[],
          relatedProjects: [] as any[]
        },
        {
          id: 'project-design-system',
          name: 'Design System',
          type: entityType,
          description: '设计系统组件库，统一产品设计语言和组件规范',
          importance: 0.6,
          accessCount: 67,
          lastAccessed: Date.now() - 86400000, // 1天前
          tags: ['设计系统', 'UI组件', '规范'],
          status: 'active',
          isHighlighted: false,
          cachedAt: Date.now(),
          statistic: {
            conversations: 29,
            projects: 1,
            participants: 6,
            resources: 10,
            documents: 8,
            webpages: 16,
            relationships: 12
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[],
          relatedResources: [] as any[],
          relatedProjects: [] as any[]
        },
        {
          id: 'project-automation-tools',
          name: 'Automation Tools',
          type: entityType,
          description: 'CI/CD自动化工具链，提升开发和部署效率',
          importance: 0.75,
          accessCount: 93,
          lastAccessed: Date.now() - 172800000, // 2天前
          tags: ['自动化', 'CI/CD', '工具链'],
          status: 'active',
          isHighlighted: false,
          cachedAt: Date.now(),
          statistic: {
            conversations: 36,
            projects: 1,
            participants: 8,
            resources: 12,
            documents: 7,
            webpages: 22,
            relationships: 18
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[],
          relatedResources: [] as any[],
          relatedProjects: [] as any[]
        }
      ];
    }
    
    if (entityType === 'Person') {
      return [
        {
          id: 'person-zhangsan',
          name: '张三',
          type: entityType,
          description: '前端开发工程师，擅长React和TypeScript开发，团队中的技术专家',
          role: '前端工程师',
          team: '技术团队',
          lastContact: Date.now() - 3600000, // 1小时前
          expertise: ['React', 'TypeScript', '性能优化', '组件设计'],
          recentCollaborations: [
            {
              id: 'collab-1',
              projectId: 'project-personal-ai',
              projectName: 'Personal-AI',
              time: '1小时前'
            },
            {
              id: 'collab-2',
              projectId: 'project-web-platform',
              projectName: 'Web Platform',
              time: '3小时前'
            }
          ],
          recentMessages: [
            {
              id: 'msg-1',
              summary: '代码审查反馈：建议优化组件性能',
              time: '1小时前'
            },
            {
              id: 'msg-2',
              summary: '分享了一个有用的React Hook实现方案',
              time: '2小时前'
            }
          ],
          tags: ['前端', '技术专家', 'React'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 25,
            projects: 2,
            participants: 1,
            resources: 5,
            documents: 3,
            webpages: 8,
            relationships: 12
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[]
        },
        {
          id: 'person-lisi',
          name: '李四',
          type: entityType,
          description: 'UI/UX设计师，专注用户体验设计和交互原型，设计团队核心成员',
          role: 'UI/UX设计师',
          team: '设计团队',
          lastContact: Date.now() - 10800000, // 3小时前
          expertise: ['用户体验', 'Figma', '交互设计', '设计系统'],
          recentCollaborations: [
            {
              id: 'collab-3',
              projectId: 'project-design-system',
              projectName: 'Design System',
              time: '3小时前'
            },
            {
              id: 'collab-4',
              projectId: 'project-personal-ai',
              projectName: 'Personal-AI',
              time: '5小时前'
            }
          ],
          recentMessages: [
            {
              id: 'msg-3',
              summary: '设计稿更新通知：新版用户界面已完成',
              time: '3小时前'
            },
            {
              id: 'msg-4',
              summary: '用户体验测试报告分享，发现了几个可改进点',
              time: '4小时前'
            }
          ],
          tags: ['设计', 'UX', '原型'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 18,
            projects: 2,
            participants: 1,
            resources: 8,
            documents: 5,
            webpages: 12,
            relationships: 8
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[]
        },
        {
          id: 'person-wangwu',
          name: '王五',
          type: entityType,
          description: '后端开发工程师，负责系统架构设计和API开发，技术栈涵盖多种语言',
          role: '后端工程师',
          team: '技术团队',
          lastContact: Date.now() - 21600000, // 6小时前
          expertise: ['系统架构', 'API设计', 'Node.js', '数据库'],
          recentCollaborations: [
            {
              id: 'collab-5',
              projectId: 'project-data-pipeline',
              projectName: 'Data Pipeline',
              time: '6小时前'
            },
            {
              id: 'collab-6',
              projectId: 'project-automation-tools',
              projectName: 'Automation Tools',
              time: '1天前'
            }
          ],
          recentMessages: [
            {
              id: 'msg-5',
              summary: '会议纪要分享：API架构优化方案讨论',
              time: '6小时前'
            },
            {
              id: 'msg-6',
              summary: '数据库性能优化建议和实施计划',
              time: '8小时前'
            }
          ],
          tags: ['后端', '架构师', 'API'],
          status: 'active',
          cachedAt: Date.now(),
          statistic: {
            conversations: 22,
            projects: 2,
            participants: 1,
            resources: 12,
            documents: 8,
            webpages: 6,
            relationships: 15
          },
          latestConversations: [] as any[],
          latestWebpages: [] as any[]
        }
      ];
    }
    
    // 其他类型实体的原始生成逻辑
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${entityType.toLowerCase()}-${i + 1}`,
      name: `${config.name} ${i + 1}`,
      type: entityType,
      description: `这是一个${config.description}的示例`,
      importance: Math.random(),
      accessCount: Math.floor(Math.random() * 100),
      lastAccessed: Date.now() - Math.floor(Math.random() * 86400000),
      tags: ['示例', '测试'],
      status: 'active',
      cachedAt: Date.now(),
      statistic: {
        conversations: Math.floor(Math.random() * 50),
        projects: Math.floor(Math.random() * 10),
        participants: Math.floor(Math.random() * 15),
        resources: Math.floor(Math.random() * 20),
        documents: Math.floor(Math.random() * 10),
        webpages: Math.floor(Math.random() * 30),
        relationships: Math.floor(Math.random() * 20)
      },
      latestConversations: [] as any[],
      latestWebpages: [] as any[],
      relatedResources: [] as any[],
      relatedProjects: [] as any[]
    }));
  };

  const generateMockVectorSearchResults = (query: string) => {
    // 基于查询生成模拟的向量搜索结果，包含多种类型的实体
    const searchTerms = query.toLowerCase();
    const results = [];
    
    // AI相关搜索
    if (searchTerms.includes('ai') || searchTerms.includes('人工智能') || searchTerms.includes('智能')) {
      results.push(
        {
          id: 'topic-ai-workflow',
          name: 'AI 工作流自动化',
          type: 'Topic',
          description: '讨论AI在工作流程中的应用和自动化实践',
          relevanceScore: 0.95,
          tags: ['AI', '自动化', '工作流']
        },
        {
          id: 'project-personal-ai',
          name: 'Personal-AI',
          type: 'Project',
          description: 'Chrome扩展智能助手，帮助用户管理知识图谱',
          relevanceScore: 0.88,
          tags: ['Chrome扩展', 'AI', '智能助手']
        }
      );
    }
    
    // 前端相关搜索
    if (searchTerms.includes('前端') || searchTerms.includes('react') || searchTerms.includes('web')) {
      results.push(
        {
          id: 'topic-frontend-optimization',
          name: '前端性能优化策略',
          type: 'Topic',
          description: '前端应用性能优化的技术讨论和最佳实践分享',
          relevanceScore: 0.82,
          tags: ['前端', '性能', 'React']
        },
        {
          id: 'person-zhangsan',
          name: '张三',
          type: 'Person',
          description: '前端开发工程师，擅长React和TypeScript开发',
          relevanceScore: 0.75,
          tags: ['前端', '技术专家', 'React']
        }
      );
    }
    
    // 设计相关搜索
    if (searchTerms.includes('设计') || searchTerms.includes('ui') || searchTerms.includes('ux')) {
      results.push(
        {
          id: 'topic-design-thinking',
          name: '产品设计思维方法',
          type: 'Topic',
          description: '产品设计流程、用户体验设计方法论的探讨',
          relevanceScore: 0.78,
          tags: ['设计', 'UX', '产品']
        },
        {
          id: 'person-lisi',
          name: '李四',
          type: 'Person',
          description: 'UI/UX设计师，专注用户体验设计和交互原型',
          relevanceScore: 0.73,
          tags: ['设计', 'UX', '原型']
        }
      );
    }
    
    // 默认结果（通用搜索）
    if (results.length === 0) {
      results.push(
        {
          id: 'topic-ai-workflow',
          name: 'AI 工作流自动化',
          type: 'Topic',
          description: '讨论AI在工作流程中的应用和自动化实践',
          relevanceScore: 0.65,
          tags: ['AI', '自动化', '工作流']
        },
        {
          id: 'project-web-platform',
          name: 'Web Platform',
          type: 'Project',
          description: '前端Web平台，提供统一的用户界面和交互体验',
          relevanceScore: 0.58,
          tags: ['前端', 'Web', '用户体验']
        }
      );
    }
    
    // 按相关性分数排序
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
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
      relatedTickets: [
        { id: 'AI-123', title: '实现智能推荐算法', status: '进行中', assignee: '张三', priority: '高' },
        { id: 'AI-124', title: '优化用户界面响应速度', status: '待开始', assignee: '李四', priority: '中' },
        { id: 'AI-125', title: '集成第三方AI服务', status: '已完成', assignee: '王五', priority: '低' }
      ],
      conversations: [
        {
          id: 'conv-1',
          sender: '张三',
          group: '技术讨论组',
          time: '30分钟前',
          summary: '分享了最新的GPT-4 API集成经验，讨论了Token优化策略',
          context: [
            { sender: '李四', content: '最近GPT-4的API调用成本有点高', time: '35分钟前' },
            { sender: '张三', content: '我找到了一些优化Token使用的方法，可以减少30%的成本', time: '30分钟前', isMainMessage: true },
            { sender: '王五', content: '能分享一下具体的优化策略吗？', time: '28分钟前' }
          ]
        },
        {
          id: 'conv-2',
          sender: '李四',
          group: '产品团队',
          time: '2小时前',
          summary: '讨论了自动化测试的实现方案，提出了新的测试框架选型建议',
          context: [
            { sender: '产品经理', content: '我们需要一个更好的自动化测试方案', time: '2.5小时前' },
            { sender: '李四', content: '建议采用Playwright + Jest的组合，覆盖率会更高', time: '2小时前', isMainMessage: true },
            { sender: '测试负责人', content: '这个方案看起来不错，我们可以试试', time: '1.5小时前' }
          ]
        },
        {
          id: 'conv-3',
          sender: '王五',
          group: 'AI研发团队',
          time: '4小时前',
          summary: '探讨了多模态AI模型在产品中的应用场景',
          context: [
            { sender: '技术总监', content: '现在多模态AI技术越来越成熟了', time: '4.5小时前' },
            { sender: '王五', content: '我们可以考虑在用户界面中集成图像识别和文本理解', time: '4小时前', isMainMessage: true },
            { sender: '产品经理', content: '这样可以大大提升用户体验', time: '3.5小时前' }
          ]
        }
      ],
      webpages: [
        {
          id: 'webpage-1',
          title: 'OpenAI GPT-4 API 官方文档',
          url: 'https://platform.openai.com/docs/models/gpt-4',
          type: 'docs',
          visitTime: '2小时前',
          relevanceScore: 0.95,
          summary: '详细介绍了GPT-4 API的使用方法、参数配置和最佳实践',
          tags: ['API文档', 'GPT-4', '官方文档']
        },
        {
          id: 'webpage-2',
          title: 'Chrome Extension Automation Best Practices',
          url: 'https://developer.chrome.com/docs/extensions/mv3/automation',
          type: 'docs',
          visitTime: '昨天',
          relevanceScore: 0.78,
          summary: 'Chrome扩展自动化开发的最佳实践和技术指南',
          tags: ['Chrome扩展', '自动化', '最佳实践']
        },
        {
          id: 'webpage-3',
          title: 'GitHub Actions 工作流配置指南',
          url: 'https://docs.github.com/en/actions/workflows',
          type: 'github',
          visitTime: '3天前',
          relevanceScore: 0.82,
          summary: 'CI/CD自动化工作流的配置方法和实用技巧',
          tags: ['GitHub Actions', 'CI/CD', '自动化']
        }
      ]
    };
  };

  return {
    isLoading, searchQuery, entities, entityTypes, overviewStats, topicDetailData, personDetailData,
    initialize, loadEntitiesByType, searchEntities, vectorSearchEntities, loadTopicDetail
  };
});
