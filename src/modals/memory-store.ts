import { defineStore } from 'pinia';
import { ref, nextTick, toRaw } from 'vue';
import { memorySystem } from '../memory';

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

// 阅读状态接口
interface ReadStatus {
  isRead: boolean;
  lastReadTime: number | null;
  unreadCount: number;
  lastUpdateTime: number;
}

interface ConversationMessage {
  id: string;
  isRead?: boolean;
  [key: string]: any;
}

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
  const closedTodayCards = ref(new Set<string>()); // 今日已关闭的卡片

  const initialize = async () => {
    isLoading.value = true;
    try {
      await memorySystem.initialize();
      
      // 恢复已关闭的今日卡片
      loadClosedCardsFromLocalStorage();
      
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
      await memorySystem.initialize();
      const response = await chromeAPI.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit,
        offset
      });
      
      if (response && (response as any).success) {
        entities.value = (response as any).data || [];
        await nextTick();
      } else {
        entities.value = generateMockEntities(entityType);
      }
    } catch (error) {
      entities.value = generateMockEntities(entityType);
    } finally {
      isLoading.value = false;

      // 如果是第一页 Topic 数据，恢复已读状态
      if (offset === 0 && entityType === 'Topic') {
        loadReadStatusFromLocalStorage();
        updateTopicUnreadCount();
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
          readStatus: {
            isRead: false,
            lastReadTime: null as number | null,
            unreadCount: 7,
            lastUpdateTime: Date.now() - 1800000
          },
          unreadDiscussions: [
            { text: '张三分享了GPT-4 API的Token优化策略,可以减少30%成本', time: '30分钟前' },
            { text: '李四提出了自动化测试框架的新方案', time: '1小时前' },
            { text: 'AI工作流中异常处理的最佳实践讨论', time: '2小时前' }
          ],
          recentDataDetails: {
            conversations: [
              {
                id: 'msg-1',
                sender: '张三',
                groupName: '技术讨论组',
                datetime: Date.now() - 1800000,
                summary: '分享了最新的GPT-4 API集成经验，讨论了Token优化策略',
                originalContent: '我找到了一些优化Token使用的方法，可以减少30%的成本',
                highlightText: 'GPT-4 API Token优化策略',
                teamUrl: '#',
                matchedRules: ['AI', '优化'],
                relevanceScore: 0.95,
                contextMessages: [] as any[],
                isRead: false
              },
              {
                id: 'msg-2',
                sender: '李四',
                groupName: '产品团队',
                datetime: Date.now() - 7200000,
                summary: '讨论了自动化测试的实现方案，提出了新的测试框架选型建议',
                originalContent: '建议采用Playwright + Jest的组合，覆盖率会更高',
                highlightText: '自动化测试实现方案',
                teamUrl: '#',
                matchedRules: ['测试', '自动化'],
                relevanceScore: 0.88,
                contextMessages: [] as any[],
                isRead: false
              }
            ],
            resources: [
              {
                id: 'resource-1',
                name: 'GPT-4 API 官方文档',
                url: 'https://platform.openai.com/docs',
                type: 'docs'
              },
              {
                id: 'resource-2',
                name: '自动化实践指南',
                url: '#',
                type: 'docs'
              }
            ],
            projects: [
              {
                id: 'project-1',
                name: 'Personal-AI',
                status: '开发中',
                description: 'Chrome扩展智能助手'
              },
              {
                id: 'project-2',
                name: 'Automation Tools',
                status: '规划中',
                description: 'CI/CD自动化工具链'
              }
            ],
            webpages: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          },
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
          readStatus: {
            isRead: false,
            lastReadTime: null,
            unreadCount: 4,
            lastUpdateTime: Date.now() - 7200000
          },
          unreadDiscussions: [
            { text: 'React 18并发模式实战经验分享', time: '2小时前' },
            { text: 'Webpack Bundle分析工具对比', time: '3小时前' },
            { text: '图片懒加载优化方案讨论', time: '4小时前' }
          ],
          recentDataDetails: {
            conversations: [
              {
                id: 'msg-3',
                sender: '王五',
                groupName: '前端团队',
                datetime: Date.now() - 7200000,
                summary: '分析了React 18的并发特性对性能的影响',
                originalContent: 'React 18的并发特性可以显著提升用户体验',
                highlightText: 'React 18并发特性',
                teamUrl: '#',
                matchedRules: ['React', '性能'],
                relevanceScore: 0.92,
                contextMessages: [] as any[],
                isRead: false
              },
              {
                id: 'msg-4',
                sender: '张三',
                groupName: '技术讨论组',
                datetime: Date.now() - 14400000,
                summary: 'Bundle体积优化技巧分享，减少30%的包大小',
                originalContent: '通过Webpack配置优化，我们成功减少了30%的Bundle大小',
                highlightText: 'Bundle体积优化',
                teamUrl: '#',
                matchedRules: ['优化', 'Webpack'],
                relevanceScore: 0.89,
                contextMessages: [] as any[],
                isRead: false
              }
            ],
            resources: [
              {
                id: 'resource-3',
                name: 'React 18 性能指南',
                url: '#',
                type: 'docs'
              },
              {
                id: 'resource-4',
                name: 'Webpack 优化手册',
                url: '#',
                type: 'docs'
              }
            ],
            projects: [
              {
                id: 'project-3',
                name: 'Web Platform',
                status: '优化中',
                description: '前端Web平台'
              }
            ],
            webpages: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          },
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
          readStatus: {
            isRead: true,
            lastReadTime: Date.now() - 43200000,
            unreadCount: 0,
            lastUpdateTime: Date.now() - 14400000
          },
          unreadDiscussions: [],
          recentDataDetails: {
            conversations: [
              {
                id: 'msg-5',
                sender: '李四',
                groupName: '设计团队',
                datetime: Date.now() - 14400000,
                summary: '用户研究方法在产品迭代中的应用案例分析',
                originalContent: '通过用户访谈和行为分析，我们发现了几个重要的改进点',
                highlightText: '用户研究方法应用',
                teamUrl: '#',
                matchedRules: ['用户研究', '产品迭代'],
                relevanceScore: 0.87,
                contextMessages: [] as any[],
                isRead: true  // 这个主题已经全部已读
              },
              {
                id: 'msg-6',
                sender: '产品经理',
                groupName: '产品团队',
                datetime: Date.now() - 21600000,
                summary: '设计系统在大型项目中的管理经验分享',
                originalContent: '建立统一的设计系统对大型项目的协作效率有显著提升',
                highlightText: '设计系统管理经验',
                teamUrl: '#',
                matchedRules: ['设计系统', '项目管理'],
                relevanceScore: 0.85,
                contextMessages: [] as any[],
                isRead: true  // 这个主题已经全部已读
              }
            ],
            resources: [
              {
                id: 'resource-5',
                name: '设计思维实践手册',
                url: '#',
                type: 'docs'
              }
            ],
            projects: [
              {
                id: 'project-4',
                name: 'Design System',
                status: '进行中',
                description: '设计系统组件库'
              },
              {
                id: 'project-5',
                name: 'Mobile App',
                status: '设计中',
                description: '移动应用产品'
              }
            ],
            webpages: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          },
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
          recentDataDetails: {
            conversations: [] as any[],
            webpages: [] as any[],
            resources: [] as any[],
            projects: [] as any[],
            people: [] as any[],
            topics: [] as any[],
            jiraTickets: [] as any[],
            cooccurringEntities: [] as any[]
          }
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
      recentDataDetails: {
        conversations: [] as any[],
        webpages: [] as any[],
        resources: [] as any[],
        projects: [] as any[],
        people: [] as any[],
        topics: [] as any[],
        jiraTickets: [] as any[],
        cooccurringEntities: [] as any[]
      }
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
          contextMessages: [
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
          contextMessages: [
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
          contextMessages: [
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

  /**
   * ==========================================
   * LocalStorage 持久化函数
   * ==========================================
   */
  
  /**
   * 保存已读状态到本地缓存 (通过后台脚本)
   * 这会将 readStatus 保存到 chrome.storage.local，并在同步时上传到云端
   */
  const saveReadStatusToLocalStorage = async () => {
    try {
      let savedCount = 0;
      const savePromises = [];
      
      // 使用 toRaw 获取原始数组
      const rawEntities = toRaw(entities.value);
      for (const entity of rawEntities) {
        if (entity.type === 'Topic' && entity.readStatus) {
          // 通过后台脚本缓存实体（包括 readStatus）
          // 使用 toRaw 确保实体对象也是原始对象
          const promise = chromeAPI.sendMessage({
            type: 'CACHE_ENTITY',
            entity: toRaw(entity)
          });
          savePromises.push(promise);
          savedCount++;
        }
      }
      
      // 并行保存所有实体
      await Promise.allSettled(savePromises);
      console.log('[LocalStorage] 已读状态已保存到本地缓存,共', savedCount, '个主题');
    } catch (error) {
      console.error('[LocalStorage] 保存已读状态失败:', error);
    }
  };

  /**
   * 从LocalStorage恢复已读状态
   * 注意：现在 readStatus 已经包含在实体中，从 chrome.storage.local 加载实体时会自动恢复
   * 此函数保留用于处理实体加载后的 UI 同步
   */
  const loadReadStatusFromLocalStorage = () => {
    try {
      let restoredCount = 0;
      
      entities.value.forEach((entity: any) => {
        if (entity.type === 'Topic' && entity.readStatus) {
          // 如果已读,清空未读讨论
          if (entity.readStatus.isRead) {
            entity.unreadDiscussions = [];
            
            // 标记所有聊天消息为已读
            if (entity.latestConversations) {
              entity.latestConversations.forEach((conv: any) => {
                conv.isRead = true;
              });
            }
          }
          
          restoredCount++;
        }
      });
      
      console.log('[LocalStorage] 已读状态已恢复,共', restoredCount, '个主题');
    } catch (error) {
      console.error('[LocalStorage] 恢复已读状态失败:', error);
    }
  };

  /**
   * 保存已关闭的今日卡片
   */
  const saveClosedCardsToLocalStorage = () => {
    try {
      const today = new Date().toDateString();
      localStorage.setItem('closed-cards-date', today);
      // 使用 toRaw 确保存储的是原始 Set 对象
      const rawClosedCards = toRaw(closedTodayCards.value);
      localStorage.setItem('closed-cards', JSON.stringify(Array.from(rawClosedCards)));
      console.log('[LocalStorage] 已关闭卡片已保存,共', rawClosedCards.size, '张');
    } catch (error) {
      console.error('[LocalStorage] 保存关闭卡片失败:', error);
    }
  };

  /**
   * 恢复已关闭的今日卡片
   */
  const loadClosedCardsFromLocalStorage = () => {
    try {
      const savedDate = localStorage.getItem('closed-cards-date');
      const today = new Date().toDateString();
      
      // 如果是新的一天,清空
      if (savedDate !== today) {
        localStorage.removeItem('closed-cards');
        localStorage.removeItem('closed-cards-date');
        console.log('[LocalStorage] 新的一天,清空已关闭卡片');
        closedTodayCards.value = new Set();
        return;
      }
      
      const saved = localStorage.getItem('closed-cards');
      if (saved) {
        closedTodayCards.value = new Set(JSON.parse(saved));
        console.log('[LocalStorage] 已关闭卡片已恢复,共', closedTodayCards.value.size, '张');
      }
    } catch (error) {
      console.error('[LocalStorage] 恢复关闭卡片失败:', error);
    }
  };

  /**
   * 标记主题已读并清空所有未读消息
   */
  const markTopicAsRead = async (topicId: string) => {
    const entity = entities.value.find((e: any) => e.id === topicId);
    if (!entity) return;
    
    // 标记为已读
    entity.readStatus = {
      lastReadTime: Date.now(),
      unreadCount: 0,
      lastUpdateTime: entity.readStatus?.lastUpdateTime || Date.now()
    };
    
    // 清空未读讨论
    if (entity.unreadDiscussions) {
      entity.unreadDiscussions = [];
    }
    
    // 标记所有聊天消息为已读
    if (entity.relatedData?.conversations) {
      entity.relatedData?.conversations?.forEach((conv: any) => {
        conv.isRead = true;
      });
    }
    
    // 持久化到LocalStorage，使用 toRaw 确保存储原始对象
    const promise = chromeAPI.sendMessage({
      type: 'CACHE_ENTITY',
      entity: toRaw(entity)
    });
    
    // 更新侧边栏计数
    updateTopicUnreadCount();
    
    console.log(`[主题阅读] "${entity.name}" 已标记为已读`);
  };
  
  /**
   * 标记单条消息已读
   */
  const markConversationAsRead = async (topicId: string, conversationId: string) => {
    const topic = topicDetailData.value;
    if (!topic || topic.id !== topicId) return;
    
    const conversations = topic.recentDataDetails?.conversations;
    if (!Array.isArray(conversations)) return;
    
    const conversation = conversations.find((c: any) => c.id === conversationId);
    if (conversation) {
      conversation.isRead = true;
      
      // 持久化到LocalStorage，使用 toRaw 确保存储原始对象
      const promise = chromeAPI.sendMessage({
        type: 'CACHE_ENTITY',
        entity: toRaw(topic)
      });
      
      // 检查是否所有消息都已读，如果是则标记整个主题为已读
      const allRead = conversations.every((c: any) => c.isRead === true);
      if (allRead) {
        await markTopicAsRead(topicId);
      } else {
        // 更新主题未读计数
        updateTopicUnreadCountAfterMessageRead(topicId);
      }
      
      console.log(`[消息阅读] 消息 "${conversationId}" 已标记为已读`);
    }
  };
  
  /**
   * 关闭今日卡片
   */
  const closeTodayCard = (cardId: string) => {
    closedTodayCards.value.add(cardId);
    saveClosedCardsToLocalStorage();
    console.log(`[今日卡片] "${cardId}" 已关闭`);
  };
  
  /**
   * 获取未读主题列表
   */
  const getUnreadTopics = () => {
    return entities.value.filter((e: any) => 
      e.type === 'Topic' && 
      (!e.readStatus?.isRead || e.readStatus?.unreadCount > 0)
    );
  };
  
  /**
   * 获取未读主题(按热度排序)
   */
  const getUnreadTopicsByImportance = () => {
    const unreadTopics = getUnreadTopics();
    return unreadTopics.sort((a: any, b: any) => {
      const scoreA = (a.importance || 0.5) + ((a.statistic?.conversations || 0) / 20);
      const scoreB = (b.importance || 0.5) + ((b.statistic?.conversations || 0) / 20);
      return scoreB - scoreA;
    });
  };
  
  /**
   * 获取未读主题(按最新讨论时间排序)
   */
  const getUnreadTopicsByLatestMessage = () => {
    const unreadTopics = getUnreadTopics();
    return unreadTopics.sort((a: any, b: any) => {
      const timeA = a.readStatus?.lastUpdateTime || a.updated || 0;
      const timeB = b.readStatus?.lastUpdateTime || b.updated || 0;
      return timeB - timeA;
    });
  };
  
  /**
   * 更新主题未读计数(在侧边栏显示)
   */
  const updateTopicUnreadCount = () => {
    const unreadCount = getUnreadTopics().length;
    const topicType = entityTypes.value.find(t => t.type === 'Topic');
    if (topicType) {
      topicType.count = unreadCount;
    }
  };
  
  /**
   * 更新主题未读计数(单条消息已读后)
   */
  const updateTopicUnreadCountAfterMessageRead = (topicId: string) => {
    const topic = topicDetailData.value;
    if (!topic || topic.id !== topicId) return;
    
    const conversations = topic.recentDataDetails?.conversations;
    const unreadCount = Array.isArray(conversations) 
      ? conversations.filter((c: any) => !c.isRead).length 
      : 0;
    
    // 更新实体列表中的主题状态
    const entity = entities.value.find((e: any) => e.id === topicId);
    if (entity && entity.readStatus) {
      entity.readStatus.unreadCount = unreadCount;
      entity.readStatus.isRead = unreadCount === 0;
      if (unreadCount === 0) {
        entity.readStatus.lastReadTime = Date.now();
      }
    }
    
    updateTopicUnreadCount();
  };

  /**
   * ==========================================
   * 智能搜索状态管理
   * ==========================================
   */
  
  // 搜索上下文状态
  const searchContext = ref<{
    mode: 'overview' | 'entity' | null;  // 搜索模式
    query: string;  // 搜索关键词
    askResult: any | null;  // ask() 的返回结果
    entityType?: string;  // 如果是实体搜索，记录类型
  }>({
    mode: null,
    query: '',
    askResult: null
  });

  /**
   * 执行智能搜索 (使用 ask() 方法)
   * 用于首页概览搜索
   */
  const performAskSearch = async (query: string) => {
    isLoading.value = true;
    searchContext.value.mode = 'overview';
    searchContext.value.query = query;
    searchQuery.value = query;
    
    try {
      const result = await memorySystem.ask(query);
      if (result.success) {
        searchContext.value.askResult = result;
        
        // 将 entitiesByType 展平为 entities 数组
        const allEntities: any[] = [];
        for (const [type, entityList] of Object.entries(result.entitiesByType || {})) {
          allEntities.push(...(entityList as any[]));
        }
        entities.value = allEntities;
        
        console.log('[智能搜索] Ask 搜索完成:', {
          query,
          entitiesCount: allEntities.length,
          hasStructuredAnswer: !!result.structuredAnswer
        });
      } else {
        console.error('[智能搜索] Ask 搜索失败:', result.message);
        // 失败时显示空结果
        entities.value = [];
        searchContext.value.askResult = null;
      }
    } catch (error) {
      console.error('[智能搜索] Ask 搜索异常:', error);
      entities.value = [];
      searchContext.value.askResult = null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 执行向量搜索 (不使用 ask())
   * 用于实体分栏搜索
   */
  const performEntityVectorSearch = async (query: string, entityType?: string) => {
    isLoading.value = true;
    searchContext.value.mode = 'entity';
    searchContext.value.query = query;
    searchContext.value.entityType = entityType;
    searchContext.value.askResult = null;  // 清空之前的 AI 结果
    searchQuery.value = query;
    
    try {
      const response = await chromeAPI.sendMessage({
        type: 'VECTOR_SEARCH_ENTITIES',
        query,
        entityType,  // 如果指定类型，只搜索该类型
        limit: 30
      }) as any;
      
      if (response && response.success) {
        entities.value = response.data || [];
        console.log('[向量搜索] 搜索完成:', {
          query,
          entityType,
          entitiesCount: entities.value.length
        });
      } else {
        // 使用模拟数据展示向量搜索结果
        entities.value = generateMockVectorSearchResults(query);
      }
    } catch (error) {
      console.error('[向量搜索] 搜索失败:', error);
      // 使用模拟数据
      entities.value = generateMockVectorSearchResults(query);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 清空搜索上下文
   */
  const clearSearchContext = () => {
    searchContext.value = {
      mode: null,
      query: '',
      askResult: null
    };
    searchQuery.value = '';
  };

  return {
    isLoading, searchQuery, entities, entityTypes, overviewStats, topicDetailData, personDetailData, closedTodayCards,
    initialize, loadEntitiesByType, searchEntities, vectorSearchEntities, loadTopicDetail,
    markTopicAsRead, markConversationAsRead, closeTodayCard,
    getUnreadTopics, getUnreadTopicsByImportance, getUnreadTopicsByLatestMessage, updateTopicUnreadCount,
    // 智能搜索相关
    searchContext, performAskSearch, performEntityVectorSearch, clearSearchContext
  };
});
