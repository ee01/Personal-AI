/**
 * 仪表盘集成工具
 * 为项目仪表盘组件提供数据接口和消息处理
 */

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
  private mockData: ProjectData[] = [];

  static getInstance(): DashboardDataManager {
    if (!DashboardDataManager.instance) {
      DashboardDataManager.instance = new DashboardDataManager();
    }
    return DashboardDataManager.instance;
  }

  constructor() {
    this.initializeMockData();
  }

  /**
   * 初始化模拟数据
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
            status: 'in-progress',
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
   * 获取项目数据
   */
  async getProjectData(projectId?: string): Promise<ProjectData[]> {
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (projectId) {
      return this.mockData.filter(p => p.id === projectId);
    }
    
    return this.mockData;
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
      const project = this.mockData.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      // 根据类型更新对应的项目
      switch (itemType) {
        case 'project':
          Object.assign(project, changes);
          break;
        case 'milestone':
          const milestone = project.milestones.find(m => m.id === itemId);
          if (milestone) {
            Object.assign(milestone, changes);
          }
          break;
        case 'task':
          for (const milestone of project.milestones) {
            const task = milestone.tasks.find(t => t.id === itemId);
            if (task) {
              Object.assign(task, changes);
              break;
            }
          }
          break;
        case 'risk':
          const risk = project.risks.find(r => r.id === itemId);
          if (risk) {
            Object.assign(risk, changes);
          }
          break;
      }

      project.lastUpdated = new Date();
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
      const project = this.mockData.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      const newItem = {
        id: `${itemType}-${Date.now()}`,
        ...itemData,
        createdAt: new Date()
      };

      switch (itemType) {
        case 'milestone':
          project.milestones.push(newItem);
          break;
        case 'task':
          // 添加到第一个里程碑（或创建默认里程碑）
          if (project.milestones.length === 0) {
            project.milestones.push({
              id: `milestone-${Date.now()}`,
              name: '默认里程碑',
              description: '自动创建的默认里程碑',
              progress: 0,
              plannedDate: new Date(),
              status: 'on-track',
              dependencies: [],
              assignees: [],
              tasks: [newItem]
            });
          } else {
            project.milestones[0].tasks.push(newItem);
          }
          break;
        case 'risk':
          project.risks.push(newItem);
          break;
      }

      project.lastUpdated = new Date();
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
      const project = this.mockData.find(p => p.id === projectId);
      if (project) {
        project.lastUpdated = new Date();
      }

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
      const project = this.mockData.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      const report = {
        projectName: project.name,
        generatedAt: new Date().toISOString(),
        overallProgress: project.overallProgress,
        milestones: project.milestones.map(m => ({
          name: m.name,
          progress: m.progress,
          status: m.status,
          tasksTotal: m.tasks.length,
          tasksCompleted: m.tasks.filter(t => t.status === 'done').length
        })),
        teamMetrics: {
          totalMembers: project.team.length,
          averageWorkload: project.team.reduce((sum, m) => sum + m.currentWorkload, 0) / project.team.length,
          skillDistribution: project.team.flatMap(m => m.skills)
        },
        riskSummary: {
          totalRisks: project.risks.length,
          highRisks: project.risks.filter(r => r.severity === 'high').length,
          openRisks: project.risks.filter(r => r.status === 'open').length
        }
      };

      return { success: true, report };
    } catch (error: any) {
      return { success: false, error: error.message };
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

  async handleMessage(request: any, sendResponse: Function): Promise<boolean> {
    switch (request.type) {
      case 'GET_PROJECT_DATA':
        this.handleGetProjectData(request, sendResponse);
        return true;
        
      case 'UPDATE_PROJECT_ITEM':
        this.handleUpdateProjectItem(request, sendResponse);
        return true;
        
      case 'QUICK_ACTION':
        this.handleQuickAction(request, sendResponse);
        return true;
        
      default:
        return false;
    }
  }

  private async handleGetProjectData(request: any, sendResponse: Function) {
    try {
      const { projectId } = request;
      const projects = await this.dataManager.getProjectData(projectId);
      sendResponse({ success: true, projects });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleUpdateProjectItem(request: any, sendResponse: Function) {
    try {
      const { projectId, itemType, itemId, changes } = request;
      const result = await this.dataManager.updateProjectItem(projectId, itemType, itemId, changes);
      sendResponse(result);
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleQuickAction(request: any, sendResponse: Function) {
    try {
      const { action, data } = request;
      let result = null;

      switch (action) {
        case 'sync_data':
          result = await this.dataManager.syncProjectData(data.projectId);
          break;
        case 'export_report':
          result = await this.dataManager.exportProjectReport(data.projectId);
          break;
        case 'create_milestone':
        case 'create_task':
        case 'log_risk':
          const itemType = action.replace('create_', '').replace('log_', '');
          result = await this.dataManager.createProjectItem(data.projectId, itemType, data);
          break;
        default:
          throw new Error(`Unknown quick action: ${action}`);
      }

      sendResponse({ success: true, result });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }
}