/**
 * 仪表盘集成工具
 * 为项目仪表盘组件提供数据接口和消息处理
 */

// ==================== 鱼骨时间线新模型类型（对齐 demo 结构） ====================
export type FishboneTaskType = 'dep' | 'task' | 'design';
export type DepStatus = 'todo' | 'progress' | 'testBuild' | 'rollout' | 'blocked';
export type DesignStatus = 'todo' | 'progress' | 'review' | 'done';
export type TaskStatus = 'todo' | 'progress' | 'testing' | 'closed' | 'rollout';
export type PlatformKey = 'sdk' | 'ios' | 'android' | 'qa' | 'dev';

export interface PlatformState {
  status: string;
  assignee?: string;
  jira?: string;
}

export interface FishboneTask {
  id: string;
  type: FishboneTaskType;
  title: string;
  status: DepStatus | DesignStatus | TaskStatus | string;
  eta?: string;
  desc?: string;
  platforms?: Partial<Record<PlatformKey, PlatformState>>;
  jira?: Array<{ key: string; title: string }>;
}

export interface MilestonePoint {
  id: string;
  label: string;    // 如 Beta / GA / M1
  date?: string;    // YYYY-MM-DD 可选
}

export interface FishboneProject {
  id: string;
  name: string;
  description?: string;
  milestones: MilestonePoint[];
  tasks: FishboneTask[];
  platformConfig?: PlatformKey[]; // 默认: sdk/ios/android/qa，可选 dev
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'in-progress' | 'at-risk' | 'completed';
  overallProgress: number;
  startDate: Date;
  endDate: Date;
  milestones: Milestone[];
  dependencies: Dependency[];
  team: TeamMember[];
  risks: Risk[];
  lastUpdated: Date;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  progress: number;
  plannedDate: Date;
  actualDate?: Date;
  status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  dependencies: string[];
  assignees: TeamMember[];
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  assignee: string;
  estimatedHours: number;
  actualHours?: number;
  priority: 'high' | 'medium' | 'low';
  jiraTicketId?: string;
  dependencies: string[];
  startDate: Date;
  endDate: Date;
}

export interface Dependency {
  id: string;
  type: 'design' | 'backend' | 'external' | 'internal';
  source: string;
  target: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  criticality: 'high' | 'medium' | 'low';
  estimatedCompletion: Date;
  actualCompletion?: Date;
  blockerReason?: string;
  contactPerson?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  currentWorkload: number;
  availability: number;
  skills: string[];
  email?: string;
  timezone?: string;
  status?: 'available' | 'busy' | 'away' | 'offline';
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  probability: number;
  impact: string;
  mitigation: string;
  owner: string;
  status: 'open' | 'mitigating' | 'resolved';
  identifiedDate: Date;
  targetResolutionDate: Date;
  actualResolutionDate?: Date;
  category?: 'technical' | 'resource' | 'schedule' | 'business' | 'external';
  tags?: string[];
}

/**
 * 仪表盘数据管理器
 */
export class DashboardDataManager {
  private static instance: DashboardDataManager;
  // 旧 mockData 将逐步废弃，保留定义避免其他引用报错
  private mockData: ProjectData[] = [];
  // 新鱼骨模型数据源
  private fishboneProjects: FishboneProject[] = [];

  static getInstance(): DashboardDataManager {
    if (!DashboardDataManager.instance) {
      DashboardDataManager.instance = new DashboardDataManager();
    }
    return DashboardDataManager.instance;
  }

  constructor() {
    this.initializeMockData(); // 兼容旧接口（即使前端不再使用）
    this.initializeFishboneMock();
  }

  /**
   * 初始化模拟数据（旧结构，保留以兼容历史函数）
   */
  private initializeMockData() {
    this.mockData = [
      {
        id: 'project-1',
        name: '个人AI助手扩展',
        description: '基于Chrome扩展的智能项目管理和信息处理平台，模拟人脑的信息处理机制',
        status: 'in-progress',
        overallProgress: 75,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        milestones: [
          {
            id: 'milestone-1',
            name: '网页智能分析系统',
            description: '实现通用网页内容智能分析，支持Chrome AI和规则引擎',
            progress: 95,
            plannedDate: new Date('2024-03-15'),
            actualDate: new Date('2024-03-20'),
            status: 'completed',
            dependencies: [],
            assignees: [
              { id: 'user1', name: '开发者A', role: '前端工程师', currentWorkload: 75, availability: 80, skills: ['React', 'TypeScript'], status: 'available' }
            ],
            tasks: [
              {
                id: 'task-1',
                title: '实现UniversalContentScript',
                description: '通用内容脚本开发，支持所有网页的智能分析',
                status: 'done',
                assignee: 'user1',
                estimatedHours: 16,
                actualHours: 18,
                priority: 'high',
                dependencies: [],
                startDate: new Date('2024-03-01'),
                endDate: new Date('2024-03-10')
              },
              {
                id: 'task-2',
                title: '集成Chrome内置AI',
                description: '集成Chrome Built-in AI API进行本地分析',
                status: 'done',
                assignee: 'user1',
                estimatedHours: 12,
                actualHours: 14,
                priority: 'medium',
                dependencies: ['task-1'],
                startDate: new Date('2024-03-10'),
                endDate: new Date('2024-03-18')
              }
            ]
          },
          {
            id: 'milestone-2',
            name: '项目可视化仪表盘',
            description: '项目进度和团队状态可视化，包含甘特图、依赖图等',
            progress: 85,
            plannedDate: new Date('2024-06-15'),
            status: 'on-track',
            dependencies: ['milestone-1'],
            assignees: [
              { id: 'user1', name: '开发者A', role: '前端工程师', currentWorkload: 75, availability: 80, skills: ['React', 'TypeScript'], status: 'available' }
            ],
            tasks: [
              {
                id: 'task-3',
                title: '甘特图组件开发',
                description: '实现交互式甘特图，支持拖拽编辑',
                status: 'done',
                assignee: 'user1',
                estimatedHours: 24,
                actualHours: 26,
                priority: 'high',
                dependencies: [],
                startDate: new Date('2024-05-01'),
                endDate: new Date('2024-05-20')
              },
              {
                id: 'task-4',
                title: '依赖关系图组件',
                description: '项目依赖关系可视化，支持多种布局算法',
                status: 'done',
                assignee: 'user1',
                estimatedHours: 20,
                actualHours: 22,
                priority: 'medium',
                dependencies: ['task-3'],
                startDate: new Date('2024-05-20'),
                endDate: new Date('2024-06-10')
              },
              {
                id: 'task-5',
                title: '团队指标面板',
                description: '团队工作负载和技能分析面板',
                status: 'in-progress',
                assignee: 'user1',
                estimatedHours: 16,
                actualHours: 12,
                priority: 'medium',
                dependencies: ['task-4'],
                startDate: new Date('2024-06-10'),
                endDate: new Date('2024-06-25')
              }
            ]
          },
          {
            id: 'milestone-3',
            name: '记忆管理优化',
            description: '智能记忆生命周期管理和遗忘机制',
            progress: 60,
            plannedDate: new Date('2024-09-15'),
            status: 'on-track',
            dependencies: ['milestone-2'],
            assignees: [
              { id: 'user1', name: '开发者A', role: '前端工程师', currentWorkload: 75, availability: 80, skills: ['React', 'TypeScript'], status: 'available' }
            ],
            tasks: [
              {
                id: 'task-6',
                title: '记忆生命周期管理器',
                description: '实现智能记忆遗忘和巩固算法',
                status: 'in-progress',
                assignee: 'user1',
                estimatedHours: 32,
                actualHours: 20,
                priority: 'high',
                dependencies: [],
                startDate: new Date('2024-08-01'),
                endDate: new Date('2024-08-31')
              },
              {
                id: 'task-7',
                title: '混合图存储系统',
                description: '向量+图数据库的混合存储架构',
                status: 'todo',
                assignee: 'user1',
                estimatedHours: 28,
                priority: 'high',
                dependencies: ['task-6'],
                startDate: new Date('2024-09-01'),
                endDate: new Date('2024-09-15')
              }
            ]
          }
        ],
        dependencies: [
          {
            id: 'dep-1',
            type: 'design',
            source: 'milestone-1',
            target: 'milestone-2',
            status: 'completed',
            criticality: 'high',
            estimatedCompletion: new Date('2024-03-31'),
            actualCompletion: new Date('2024-03-20'),
            contactPerson: '开发者A'
          },
          {
            id: 'dep-2',
            type: 'backend',
            source: 'milestone-2',
            target: 'milestone-3',
            status: 'in-progress',
            criticality: 'medium',
            estimatedCompletion: new Date('2024-07-15'),
            contactPerson: '开发者A'
          }
        ],
        team: [
          {
            id: 'user1',
            name: '开发者A',
            role: '全栈工程师',
            currentWorkload: 75,
            availability: 80,
            skills: ['React', 'TypeScript', 'Chrome Extensions', 'AI Integration', 'Vector Databases'],
            status: 'available',
            email: 'dev@example.com',
            timezone: 'Asia/Shanghai'
          }
        ],
        risks: [
          {
            id: 'risk-1',
            title: 'Chrome AI API变更风险',
            description: 'Chrome内置AI API仍在实验阶段，可能发生破坏性变更',
            severity: 'medium',
            probability: 30,
            impact: '可能需要重写AI集成部分，影响网页分析功能',
            mitigation: '维护fallback方案，使用云端AI作为备选',
            owner: 'user1',
            status: 'mitigating',
            identifiedDate: new Date('2024-02-15'),
            targetResolutionDate: new Date('2024-08-01'),
            category: 'technical',
            tags: ['AI', 'Chrome', 'API']
          },
          {
            id: 'risk-2',
            title: '性能优化压力',
            description: '随着功能增加，扩展可能出现性能问题',
            severity: 'low',
            probability: 60,
            impact: '用户体验下降，可能需要重构部分模块',
            mitigation: '持续监控性能，实施渐进式优化策略',
            owner: 'user1',
            status: 'open',
            identifiedDate: new Date('2024-05-01'),
            targetResolutionDate: new Date('2024-10-01'),
            category: 'technical',
            tags: ['性能', '优化']
          }
        ],
        lastUpdated: new Date()
      }
    ];
  }

  /**
   * 初始化鱼骨模型的模拟数据
   */
  private initializeFishboneMock() {
    this.fishboneProjects = [
      {
        id: 'p1',
        name: 'Project 1',
        description: '核心功能开发项目',
        milestones: [
          { id: 'ms-beta', label: 'Beta', date: '2025-05-05' },
          { id: 'ms-ga', label: 'GA', date: '2025-06-10' }
        ],
        tasks: [
          {
            id: 't1',
            type: 'dep',
            title: 'BE dependency',
            status: 'progress',
            eta: '2025-05-02',
            desc: 'RCV-xxxx BUG FOR XXX - 后端依赖修复',
            jira: [
              { key: 'PROJ-1234', title: '修复登录接口bug' },
              { key: 'PROJ-1235', title: '优化数据库查询性能' }
            ]
          },
          {
            id: 't2',
            type: 'design',
            title: 'Design',
            status: 'progress',
            eta: '2025-04-20',
            desc: 'UI/UX设计方案制定',
            jira: [ { key: 'DESIGN-101', title: '用户界面设计评审' } ]
          },
          {
            id: 't3',
            type: 'task',
            title: 'Epic 1',
            status: 'review',
            eta: '2025-04-24',
            desc: '用户认证系统重构',
            jira: [
              { key: 'E1-1234', title: 'Epic: 用户认证系统' },
              { key: 'E1-1235', title: 'Story: 单点登录集成' }
            ],
            platforms: {
              sdk: { status: 'done', assignee: 'Alice Wang', jira: 'SDK-123' },
              ios: { status: 'done', assignee: 'Bob Chen', jira: 'IOS-456' },
              android: { status: 'progress', assignee: 'Carol Li', jira: 'AND-789' },
              qa: { status: 'progress', assignee: 'David Zhang', jira: 'QA-101' }
            }
          },
          {
            id: 't4',
            type: 'task',
            title: 'Epic 2',
            status: 'done',
            eta: '2025-04-30',
            desc: '数据分析模块',
            jira: [ { key: 'E2-5678', title: 'Epic: 数据分析功能' } ],
            platforms: {
              sdk: { status: 'done', assignee: 'Alice Wang', jira: 'SDK-124' },
              ios: { status: 'done', assignee: 'Bob Chen', jira: 'IOS-457' },
              android: { status: 'done', assignee: 'Carol Li', jira: 'AND-790' },
              qa: { status: 'done', assignee: 'David Zhang', jira: 'QA-102' }
            }
          }
        ],
        platformConfig: ['sdk', 'ios', 'android', 'qa']
      },
      {
        id: 'p2',
        name: 'Project 2',
        description: '性能优化项目',
        milestones: [
          { id: 'ms-beta', label: 'Beta', date: '2025-04-15' },
          { id: 'ms-ga', label: 'GA', date: '2025-06-30' }
        ],
        tasks: [
          {
            id: 't5',
            type: 'task',
            title: 'Epic A',
            status: 'progress',
            eta: '2025-04-20',
            desc: 'Frontend性能优化',
            jira: [ { key: 'EA-100', title: 'Epic: 前端性能优化' } ],
            platforms: {
              sdk: { status: 'progress', assignee: 'Eve Liu', jira: 'SDK-125' },
              ios: { status: 'pending', assignee: 'Frank Wu', jira: 'IOS-458' },
              android: { status: 'pending', assignee: 'Grace Zhou', jira: 'AND-791' },
              qa: { status: 'pending', assignee: 'Henry Xu', jira: 'QA-103' }
            }
          },
          {
            id: 't6',
            type: 'dep',
            title: 'BE API v2',
            status: 'blocked',
            eta: '2025-05-01',
            desc: '等待网关升级完成',
            jira: [ { key: 'API-200', title: 'API v2 开发计划' } ]
          }
        ],
        platformConfig: ['sdk', 'ios', 'android', 'qa']
      },
      {
        id: 'p3',
        name: 'Project 3',
        description: '移动端适配项目',
        milestones: [
          { id: 'ms-beta', label: 'Beta', date: '2025-04-08' },
          { id: 'ms-ga', label: 'GA', date: '2025-05-28' }
        ],
        tasks: [
          {
            id: 't7',
            type: 'design',
            title: 'Mobile Design',
            status: 'review',
            eta: '2025-04-10',
            desc: '移动端UI适配设计',
            jira: [ { key: 'MOB-001', title: '移动端设计规范' } ]
          },
          {
            id: 't8',
            type: 'task',
            title: 'Mobile Epic',
            status: 'progress',
            eta: '2025-05-02',
            desc: '移动端功能开发',
            jira: [ { key: 'ME-001', title: 'Epic: 移动端功能' } ],
            platforms: {
              sdk: { status: 'done', assignee: 'Iris Chen', jira: 'SDK-126' },
              ios: { status: 'progress', assignee: 'Jack Wang', jira: 'IOS-459' },
              android: { status: 'progress', assignee: 'Kate Li', jira: 'AND-792' },
              qa: { status: 'pending', assignee: 'Leo Zhang', jira: 'QA-104' }
            }
          }
        ],
        platformConfig: ['sdk', 'ios', 'android', 'qa']
      }
    ];
  }

  /**
   * 获取项目数据
   */
  async getProjectData(projectId?: string): Promise<any[]> {
    console.log('🗂️ DashboardDataManager.getProjectData 开始:', {
      projectId,
      mockDataLength: this.mockData?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    // 检查模拟数据是否已初始化
    if (!this.mockData || this.mockData.length === 0) {
      console.warn('⚠️ 模拟数据为空，重新初始化...');
      this.initializeMockData();
    }
    
    // 新模型优先：返回鱼骨项目
    if (!this.fishboneProjects || this.fishboneProjects.length === 0) {
      this.initializeFishboneMock();
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    const list = projectId ? this.fishboneProjects.filter(p => p.id === projectId) : this.fishboneProjects;
    console.log('📋 返回鱼骨项目:', { totalProjects: list.length, names: list.map(p => p.name) });
    return list;
  }

  /**
   * 更新项目项目
   */
  async updateProjectItem(
    projectId: string, 
    itemType: string, 
    itemId: string, 
    changes: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const project = this.fishboneProjects.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      // 根据类型更新对应的项目（鱼骨模型）
      switch (itemType) {
        case 'project':
          Object.assign(project, changes);
          break;
        case 'milestone': {
          const milestone = project.milestones.find((m: any) => m.id === itemId);
          if (!milestone) return { success: false, error: '里程碑不存在' };
          Object.assign(milestone, changes);
          break;
        }
        case 'task':
        case 'dep':
        case 'design': {
          const task = project.tasks.find((t: any) => t.id === itemId);
          if (!task) return { success: false, error: '任务不存在' };
          Object.assign(task, changes);
          break;
        }
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建新项目项目
   */
  async createProjectItem(
    projectId: string,
    itemType: string,
    itemData: any
  ): Promise<{ success: boolean; newItem?: any; error?: string }> {
    try {
      const project = this.fishboneProjects.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      const newItem = { id: `${itemType}-${Date.now()}`, ...itemData };
      switch (itemType) {
        case 'milestone':
          project.milestones.push({ id: newItem.id, label: newItem.label || 'M', date: newItem.date });
          break;
        case 'task':
        case 'dep':
        case 'design':
          project.tasks.push({
            id: newItem.id,
            type: (itemData.type || 'task'),
            title: itemData.title || '新任务',
            status: itemData.status || 'todo',
            eta: itemData.eta,
            desc: itemData.desc,
            platforms: itemData.platforms,
            jira: itemData.jira
          });
          break;
      }
      return { success: true, newItem };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 同步项目数据
   */
  async syncProjectData(projectId: string): Promise<{ success: boolean; syncResults?: any; error?: string }> {
    try {
      // 模拟同步过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const syncResults = {
        jira: { synced: 5, updated: 2, errors: 0 },
        github: { synced: 8, updated: 1, errors: 0 },
        confluence: { synced: 3, updated: 0, errors: 0 }
      };

      // 更新项目最后同步时间
      // 鱼骨模型暂不更新 lastUpdated 字段

      return { success: true, syncResults };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 导出项目报告
   */
  async exportProjectReport(projectId: string): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const project = this.fishboneProjects.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      const report = {
        projectName: project.name,
        generatedAt: new Date().toISOString(),
        milestones: project.milestones,
        tasks: project.tasks
      };

      return { success: true, report };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /** 新增项目（前端新增入口调用；目前仅内存保存） */
  async createProject(data: {
    name: string;
    description?: string;
    platformConfig?: PlatformKey[];
    prompt?: string;
  }): Promise<{ success: boolean; project?: FishboneProject; error?: string }> {
    try {
      const id = `p_${Date.now()}`;
      const project: FishboneProject = {
        id,
        name: data.name,
        description: data.description || '',
        milestones: [],
        tasks: [],
        platformConfig: data.platformConfig?.length ? data.platformConfig : ['sdk', 'ios', 'android', 'qa']
      };
      this.fishboneProjects.push(project);
      return { success: true, project };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** 🔄 使用向量数据库为项目名提供建议 */
  async suggestProjects(question: string): Promise<{ success: boolean; suggestions: string[]; error?: string }> {
    try {
      const { memorySystem } = await import('../memory');
      await memorySystem.initialize();
      
      const messages = await memorySystem.cloudStorage.getSimilarMessages(question, {
        limit: 10,
        minRelevanceScore: 0.3
      });
      
      const names = new Set<string>();
      // 直接从已知项目列表获取建议
      const allProjects = await memorySystem.cloudStorage.getAllKnownProjects();
      allProjects.forEach(p => names.add(p));
      
      const suggestions = Array.from(names).slice(0, 8);
      return { success: true, suggestions };
    } catch (e: any) {
      return { success: false, suggestions: [], error: e.message };
    }
  }
}

/**
 * 消息处理器 - 用于background.ts集成
 */
export class DashboardMessageHandler {
  private dataManager: DashboardDataManager;

  constructor() {
    this.dataManager = DashboardDataManager.getInstance();
  }

  async handleMessage(request: any, sendResponse: (response: any) => void): Promise<boolean> {
    console.log('🔧 DashboardMessageHandler处理消息:', {
      type: request.type,
      timestamp: new Date().toISOString(),
      request: request
    });
    
    switch (request.type) {
      case 'GET_PROJECT_DATA':
        console.log('📊 处理获取项目数据请求');
        await this.handleGetProjectData(request, sendResponse);
        return true;
        
      case 'UPDATE_PROJECT_ITEM':
        console.log('✏️ 处理更新项目项目请求');
        await this.handleUpdateProjectItem(request, sendResponse);
        return true;
        
      case 'QUICK_ACTION':
        console.log('⚡ 处理快速操作请求');
        await this.handleQuickAction(request, sendResponse);
        return true;

      case 'ADD_PROJECT':
        console.log('➕ 新增项目');
        await this.handleAddProject(request, sendResponse);
        return true;

      case 'SUGGEST_PROJECTS':
        console.log('🤖 项目名称建议');
        await this.handleSuggestProjects(request, sendResponse);
        return true;

      case 'ADD_PROJECT_ITEM':
        console.log('➕ 添加项目项目');
        await this.handleAddProjectItem(request, sendResponse);
        return true;
        
      default:
        console.warn('⚠️ 未知的消息类型:', request.type);
        sendResponse({ success: false, error: `未知的消息类型: ${request.type}` });
        return false;
    }
  }

  private async handleGetProjectData(request: any, sendResponse: (response: any) => void) {
    try {
      const { projectId } = request;
      console.log('🗃️ 开始获取项目数据:', { projectId });
      
      // 检查数据管理器是否初始化
      if (!this.dataManager) {
        console.error('❌ 数据管理器未初始化');
        sendResponse({ success: false, error: '数据管理器未初始化' });
        return;
      }
      
      const projects = await this.dataManager.getProjectData(projectId);
      
      console.log('✅ 项目数据获取成功:', {
        projectCount: projects?.length || 0,
        projects: projects,
        requestedProjectId: projectId
      });
      
      sendResponse({ success: true, projects });
    } catch (error: any) {
      console.error('❌ 获取项目数据失败:', {
        error: error.message,
        stack: error.stack,
        projectId: request.projectId
      });
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleUpdateProjectItem(request: any, sendResponse: (response: any) => void) {
    try {
      const { projectId, itemType, itemId, changes } = request;
      const result = await this.dataManager.updateProjectItem(projectId, itemType, itemId, changes);
      sendResponse(result);
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleQuickAction(request: any, sendResponse: (response: any) => void) {
    try {
      const { action, data } = request;
      let result = null;

      switch (action) {
        case 'create_milestone': {
          result = await this.dataManager.createProjectItem(data.projectId, 'milestone', data);
          break;
        }
        case 'create_task': {
          result = await this.dataManager.createProjectItem(data.projectId, (data.type || 'task'), data);
          break;
        }
        case 'sync_data':
          result = await this.dataManager.syncProjectData(data.projectId);
          break;
        case 'export_report':
          result = await this.dataManager.exportProjectReport(data.projectId);
          break;
        default:
          throw new Error(`Unknown quick action: ${action}`);
      }

      sendResponse({ success: true, result });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleAddProject(request: any, sendResponse: (response: any) => void) {
    try {
      const { name, description, platformConfig, prompt } = request;
      const res = await this.dataManager.createProject({ name, description, platformConfig, prompt });
      sendResponse(res);
    } catch (e: any) {
      sendResponse({ success: false, error: e.message });
    }
  }

  private async handleSuggestProjects(request: any, sendResponse: (response: any) => void) {
    try {
      const { question } = request;
      const res = await this.dataManager.suggestProjects(question || '建议项目');
      sendResponse(res);
    } catch (e: any) {
      sendResponse({ success: false, error: e.message, suggestions: [] });
    }
  }

  private async handleAddProjectItem(request: any, sendResponse: (response: any) => void) {
    try {
      const { projectId, itemType, itemData } = request;
      const result = await this.dataManager.createProjectItem(projectId, itemType, itemData);
      sendResponse(result);
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }
}