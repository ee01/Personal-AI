/**
 * 定时任务处理器
 * 负责执行各种分析任务，生成需要通知的事项
 */

import { NotificationItem } from './NotificationManager';
import { getMemoryServiceClient } from '../services/MemoryServiceClient';
import { IntelligentAgent } from '../agentThinking';

// 基础任务处理器接口
export interface TaskProcessor {
  execute(): Promise<NotificationItem[]>;
  getName(): string;
  getDescription(): string;
}

// 依赖项数据接口
interface Dependency {
  id: string;
  type: 'design' | 'backend' | 'external' | 'internal';
  source: string;
  target: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  criticality: 'high' | 'medium' | 'low';
  estimatedCompletion: Date;
  actualCompletion?: Date;
  lastUpdate: number;
  contactPerson?: string;
  blockerReason?: string;
  description: string;
  projectId: string;
  projectName: string;
}

// 项目数据接口
interface ProjectData {
  id: string;
  name: string;
  status: 'planning' | 'in-progress' | 'at-risk' | 'completed';
  overallProgress: number;
  milestones: Milestone[];
  risks: Risk[];
  dependencies: Dependency[];
  team: TeamMember[];
  lastActivity: number;
  deadline?: Date;
}

interface Milestone {
  id: string;
  name: string;
  progress: number;
  plannedDate: Date;
  actualDate?: Date;
  status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  assignee: string;
  estimatedHours: number;
  actualHours?: number;
  priority: 'high' | 'medium' | 'low';
  lastUpdate: number;
}

interface Risk {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  probability: number;
  status: 'open' | 'mitigating' | 'resolved';
  lastUpdate: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  currentWorkload: number;
  availability: number;
  lastActivity: number;
}

/**
 * 依赖项监控处理器
 */
export class DependencyMonitorProcessor implements TaskProcessor {
  private agent: IntelligentAgent;

  constructor() {
    this.agent = new IntelligentAgent();
  }

  getName(): string {
    return 'DependencyMonitor';
  }

  getDescription(): string {
    return '监控项目依赖项状态，识别即将逾期或存在风险的依赖';
  }

  async execute(): Promise<NotificationItem[]> {
    console.log('🔍 执行依赖项监控分析...');
    
    try {
      const notifications: NotificationItem[] = [];
      
      // 1. 获取所有活跃项目的依赖项
      const projects = await this.getActiveProjects();
      
      for (const project of projects) {
        const dependencies = await this.getProjectDependencies(project.id);
        
        // 2. 分析每个依赖项
        for (const dependency of dependencies) {
          const analysis = await this.analyzeDependency(dependency, project);
          
          if (analysis.requiresNotification) {
            const notification = this.createDependencyNotification(dependency, analysis, project);
            notifications.push(notification);
          }
        }
      }
      
      console.log(`✅ 依赖项监控完成，发现 ${notifications.length} 个需要关注的事项`);
      return notifications;
      
    } catch (error) {
      console.error('❌ 依赖项监控失败:', error);
      return [];
    }
  }

  private async getActiveProjects(): Promise<ProjectData[]> {
    try {
      // 从存储中获取项目数据，或通过API查询
      const result = await chrome.storage.local.get('activeProjects');
      let projects = result.activeProjects || [];
      
      // 如果没有缓存的项目数据，尝试通过智能分析获取
      if (projects.length === 0) {
        projects = await this.extractProjectsFromMemory();
      }
      
      return projects.filter(p => p.status === 'in-progress' || p.status === 'at-risk');
      
    } catch (error) {
      console.error('获取活跃项目失败:', error);
      return [];
    }
  }

  private async extractProjectsFromMemory(): Promise<ProjectData[]> {
    try {
      // 🔄 使用向量搜索查找项目相关信息
      const projectQuery = '项目 进度 任务 依赖 团队';
      const client = getMemoryServiceClient();
      const recallResult = await client.recall(projectQuery, {
        topK: 20,
        channels: ['vector', 'fts']
      });

      if (!recallResult || !recallResult.items || recallResult.items.length === 0) {
        return [];
      }

      // 转换为兼容格式
      const memoryResults = recallResult.items.map(item => ({
        id: item.id,
        content: item.content,
        metadata: {
          sender: item.metadata?.sender,
          groupName: item.metadata?.groupName,
          datetime: item.metadata?.datetime,
          summary: item.metadata?.summary
        }
      }));

      // 使用智能代理分析记忆内容，提取项目信息
      const analysisResult = await this.agent.analyze({
        type: 'memory_analysis',
        content: memoryResults.map(r => r.content).join('\n\n'),
        request: '从这些记忆中提取所有活跃的项目信息，包括项目名称、状态、依赖关系和团队成员'
      }, {
        type: 'project',
        analysisDepth: 'normal'
      });

      // 解析分析结果为项目数据
      return this.parseProjectsFromAnalysis(analysisResult);

    } catch (error) {
      console.error('从记忆中提取项目失败:', error);
      return [];
    }
  }

  private parseProjectsFromAnalysis(analysisResult: any): ProjectData[] {
    // 这里需要解析智能代理的分析结果
    // 实际实现时需要根据具体的返回格式进行解析
    try {
      if (analysisResult.entities?.projects) {
        return analysisResult.entities.projects.map(project => ({
          id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: project.name,
          status: project.status || 'in-progress',
          overallProgress: project.progress || 0,
          milestones: [],
          risks: [],
          dependencies: [],
          team: [],
          lastActivity: Date.now()
        }));
      }
      return [];
    } catch (error) {
      console.error('解析项目数据失败:', error);
      return [];
    }
  }

  private async getProjectDependencies(projectId: string): Promise<Dependency[]> {
    try {
      // 首先尝试从缓存获取
      const result = await chrome.storage.local.get(`dependencies-${projectId}`);
      let dependencies = result[`dependencies-${projectId}`] || [];
      
      // 如果没有缓存，尝试从记忆中提取
      if (dependencies.length === 0) {
        dependencies = await this.extractDependenciesFromMemory(projectId);
      }
      
      return dependencies;
      
    } catch (error) {
      console.error(`获取项目 ${projectId} 依赖失败:`, error);
      return [];
    }
  }

  private async extractDependenciesFromMemory(projectId: string): Promise<Dependency[]> {
    try {
      // 🔄 查询项目相关的依赖信息
      const dependencyQuery = `项目 ${projectId} 依赖 设计 后端 外部 团队 阻塞`;
      const client = getMemoryServiceClient();
      const recallResult = await client.recall(dependencyQuery, {
        topK: 10,
        channels: ['vector', 'fts']
      });

      if (!recallResult || !recallResult.items || recallResult.items.length === 0) {
        return [];
      }

      // 转换为兼容格式
      const memoryResults = recallResult.items.map(item => ({
        id: item.id,
        content: item.content,
        metadata: {
          sender: item.metadata?.sender,
          groupName: item.metadata?.groupName,
          datetime: item.metadata?.datetime,
          summary: item.metadata?.summary
        }
      }));

      // 使用智能代理分析依赖关系
      const analysisResult = await this.agent.analyze({
        type: 'dependency_analysis',
        content: memoryResults.map(r => r.content).join('\n\n'),
        projectId: projectId,
        request: '提取项目的所有依赖关系，包括依赖类型、状态、截止时间和负责人'
      }, {
        type: 'project',
        analysisDepth: 'deep'
      });

      return this.parseDependenciesFromAnalysis(analysisResult, projectId);

    } catch (error) {
      console.error('从记忆中提取依赖失败:', error);
      return [];
    }
  }

  private parseDependenciesFromAnalysis(analysisResult: any, projectId: string): Dependency[] {
    try {
      // 解析分析结果中的依赖信息
      const dependencies: Dependency[] = [];
      
      if (analysisResult.relationships) {
        for (const rel of analysisResult.relationships) {
          if (rel.type.includes('depend') || rel.type.includes('block')) {
            dependencies.push({
              id: `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: this.inferDependencyType(rel.source, rel.target),
              source: rel.source,
              target: rel.target,
              status: this.inferDependencyStatus(rel.context),
              criticality: rel.confidence > 0.8 ? 'high' : 'medium',
              estimatedCompletion: this.inferDeadline(rel.context),
              lastUpdate: Date.now() - (7 * 24 * 60 * 60 * 1000), // 假设一周前更新
              description: rel.context || '从聊天记录中识别的依赖关系',
              projectId: projectId,
              projectName: analysisResult.projectName || 'Unknown Project'
            });
          }
        }
      }
      
      return dependencies;
      
    } catch (error) {
      console.error('解析依赖数据失败:', error);
      return [];
    }
  }

  private inferDependencyType(source: string, target: string): 'design' | 'backend' | 'external' | 'internal' {
    const text = (source + ' ' + target).toLowerCase();
    
    if (text.includes('设计') || text.includes('ui') || text.includes('ux')) {
      return 'design';
    } else if (text.includes('后端') || text.includes('api') || text.includes('服务')) {
      return 'backend';
    } else if (text.includes('外部') || text.includes('第三方') || text.includes('vendor')) {
      return 'external';
    }
    
    return 'internal';
  }

  private inferDependencyStatus(context: string): 'pending' | 'in-progress' | 'completed' | 'blocked' {
    const text = context.toLowerCase();
    
    if (text.includes('完成') || text.includes('done') || text.includes('完毕')) {
      return 'completed';
    } else if (text.includes('阻塞') || text.includes('卡住') || text.includes('blocked')) {
      return 'blocked';
    } else if (text.includes('进行') || text.includes('开发') || text.includes('progress')) {
      return 'in-progress';
    }
    
    return 'pending';
  }

  private inferDeadline(context: string): Date {
    // 简单的日期推断逻辑，实际应该更智能
    const now = new Date();
    const defaultDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 默认一周后
    
    // 尝试从上下文中提取日期信息
    const datePatterns = [
      /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
      /(下周|next week)/i,
      /(本月底|end of month)/i
    ];
    
    for (const pattern of datePatterns) {
      const match = context.match(pattern);
      if (match) {
        try {
          if (match[0].includes('下周') || match[0].includes('next week')) {
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else if (match[0].includes('本月底') || match[0].includes('end of month')) {
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return endOfMonth;
          } else {
            const parsedDate = new Date(match[0]);
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate;
            }
          }
        } catch (error) {
          // 忽略解析错误
        }
      }
    }
    
    return defaultDeadline;
  }

  private async analyzeDependency(dependency: Dependency, project: ProjectData): Promise<DependencyAnalysis> {
    const now = Date.now();
    const timeToDeadline = dependency.estimatedCompletion.getTime() - now;
    const daysToDeadline = timeToDeadline / (1000 * 60 * 60 * 24);
    const daysSinceLastUpdate = (now - dependency.lastUpdate) / (1000 * 60 * 60 * 24);
    
    const analysis: DependencyAnalysis = {
      requiresNotification: false,
      priority: 'info',
      riskLevel: 'low',
      suggestedActions: [],
      reasoning: ''
    };

    // 时间紧迫性分析
    if (daysToDeadline <= 1 && dependency.status !== 'completed') {
      analysis.requiresNotification = true;
      analysis.priority = 'urgent';
      analysis.riskLevel = 'high';
      analysis.reasoning = '依赖项即将逾期且未完成';
      analysis.suggestedActions.push({
        type: 'immediate_contact',
        description: '立即联系依赖团队确认状态',
        contactPerson: dependency.contactPerson,
        urgency: 'immediate'
      });
    } else if (daysToDeadline <= 3 && dependency.status === 'pending') {
      analysis.requiresNotification = true;
      analysis.priority = 'important';
      analysis.riskLevel = 'medium';
      analysis.reasoning = '依赖项即将到期但尚未开始';
      analysis.suggestedActions.push({
        type: 'status_inquiry',
        description: '询问依赖项启动计划',
        contactPerson: dependency.contactPerson,
        urgency: 'today'
      });
    } else if (daysToDeadline <= 7 && dependency.status === 'in-progress') {
      analysis.requiresNotification = true;
      analysis.priority = 'important';
      analysis.riskLevel = 'medium';
      analysis.reasoning = '依赖项时间紧张，需要关注进展';
      analysis.suggestedActions.push({
        type: 'progress_check',
        description: '检查进展并评估风险',
        contactPerson: dependency.contactPerson,
        urgency: 'this_week'
      });
    }

    // 长期无更新分析
    if (daysSinceLastUpdate > 7 && dependency.status === 'in-progress') {
      analysis.requiresNotification = true;
      analysis.priority = analysis.priority === 'urgent' ? 'urgent' : 'important';
      analysis.reasoning += (analysis.reasoning ? '; ' : '') + '超过一周无状态更新';
      analysis.suggestedActions.push({
        type: 'update_request',
        description: '请求状态更新',
        reason: `超过${Math.floor(daysSinceLastUpdate)}天无更新`,
        urgency: 'this_week'
      });
    }

    // 关键路径分析
    if (dependency.criticality === 'high' && analysis.requiresNotification) {
      analysis.priority = analysis.priority === 'info' ? 'important' : 'urgent';
      analysis.riskLevel = analysis.riskLevel === 'low' ? 'medium' : 'high';
      analysis.reasoning += (analysis.reasoning ? '; ' : '') + '位于项目关键路径';
    }

    // 阻塞状态分析
    if (dependency.status === 'blocked') {
      analysis.requiresNotification = true;
      analysis.priority = 'urgent';
      analysis.riskLevel = 'high';
      analysis.reasoning = '依赖项被阻塞';
      analysis.suggestedActions.push({
        type: 'resolve_blocker',
        description: '协助解决阻塞问题',
        reason: dependency.blockerReason || '未知阻塞原因',
        urgency: 'immediate'
      });
    }

    return analysis;
  }

  private createDependencyNotification(
    dependency: Dependency,
    analysis: DependencyAnalysis,
    project: ProjectData
  ): NotificationItem {
    const daysToDeadline = Math.ceil((dependency.estimatedCompletion.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    let title = '';
    let message = '';

    if (analysis.priority === 'urgent') {
      if (dependency.status === 'blocked') {
        title = `🚨 依赖项被阻塞`;
        message = `项目"${project.name}"的${dependency.type}依赖"${dependency.target}"被阻塞，需要立即处理`;
      } else if (daysToDeadline <= 1) {
        title = `🚨 依赖项即将逾期`;
        message = `项目"${project.name}"的${dependency.type}依赖"${dependency.target}"将在${daysToDeadline <= 0 ? '今天' : '明天'}到期`;
      } else {
        title = `🚨 关键依赖项需要关注`;
        message = `项目"${project.name}"的关键依赖"${dependency.target}"需要立即关注`;
      }
    } else if (analysis.priority === 'important') {
      title = `⚠️ 依赖项需要关注`;
      message = `项目"${project.name}"的${dependency.type}依赖"${dependency.target}"还有${daysToDeadline}天到期，当前状态：${this.translateStatus(dependency.status)}`;
    } else {
      title = `ℹ️ 依赖项状态更新`;
      message = `项目"${project.name}"的依赖项"${dependency.target}"需要状态更新`;
    }

    return {
      id: `dependency-${dependency.id}-${Date.now()}`,
      type: 'dependency_alert',
      priority: analysis.priority,
      title,
      message,
      data: {
        dependency,
        analysis,
        project,
        daysToDeadline
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24小时后过期
      actions: this.generateDependencyActions(dependency, analysis)
    };
  }

  private generateDependencyActions(dependency: Dependency, analysis: DependencyAnalysis): any[] {
    const actions: any[] = [];

    if (dependency.contactPerson) {
      actions.push({
        id: 'contact_person',
        label: `联系 ${dependency.contactPerson}`,
        action: 'contact_dependency_team',
        data: { dependency, contactPerson: dependency.contactPerson }
      });
    }

    actions.push({
      id: 'update_status',
      label: '更新状态',
      action: 'update_dependency_status',
      data: { dependency }
    });

    if (dependency.status === 'blocked') {
      actions.push({
        id: 'resolve_blocker',
        label: '协助解决',
        action: 'help_resolve_blocker',
        data: { dependency }
      });
    }

    actions.push({
      id: 'snooze',
      label: '稍后提醒',
      action: 'snooze_dependency_alert',
      data: { dependency, hours: 4 }
    });

    return actions;
  }

  private translateStatus(status: string): string {
    const statusMap = {
      'pending': '待开始',
      'in-progress': '进行中',
      'completed': '已完成',
      'blocked': '已阻塞'
    };
    return statusMap[status] || status;
  }
}

interface DependencyAnalysis {
  requiresNotification: boolean;
  priority: 'urgent' | 'important' | 'info';
  riskLevel: 'high' | 'medium' | 'low';
  suggestedActions: Array<{
    type: string;
    description: string;
    contactPerson?: string;
    reason?: string;
    urgency: 'immediate' | 'today' | 'this_week';
  }>;
  reasoning: string;
}

/**
 * 项目健康检查处理器
 */
export class ProjectHealthCheckProcessor implements TaskProcessor {
  private agent: IntelligentAgent;

  constructor() {
    this.agent = new IntelligentAgent();
  }

  getName(): string {
    return 'ProjectHealthChecker';
  }

  getDescription(): string {
    return '检查项目整体健康状况，识别进度偏差和潜在风险';
  }

  async execute(): Promise<NotificationItem[]> {
    console.log('🏥 执行项目健康检查...');
    
    try {
      const notifications: NotificationItem[] = [];
      const projects = await this.getActiveProjects();
      
      for (const project of projects) {
        const healthAnalysis = await this.analyzeProjectHealth(project);
        
        if (healthAnalysis.requiresNotification) {
          const notification = this.createHealthNotification(project, healthAnalysis);
          notifications.push(notification);
        }
      }
      
      console.log(`✅ 项目健康检查完成，发现 ${notifications.length} 个健康问题`);
      return notifications;
      
    } catch (error) {
      console.error('❌ 项目健康检查失败:', error);
      return [];
    }
  }

  private async getActiveProjects(): Promise<ProjectData[]> {
    // 重用依赖项监控的项目获取逻辑
    const dependencyMonitor = new DependencyMonitorProcessor();
    return await (dependencyMonitor as any).getActiveProjects();
  }

  private async analyzeProjectHealth(project: ProjectData): Promise<ProjectHealthAnalysis> {
    const analysis: ProjectHealthAnalysis = {
      requiresNotification: false,
      healthScore: 100,
      issues: [],
      recommendations: []
    };

    // 进度偏差分析
    if (project.overallProgress < 50 && this.isProjectOverdue(project)) {
      analysis.requiresNotification = true;
      analysis.healthScore -= 30;
      analysis.issues.push({
        type: 'progress_delay',
        severity: 'high',
        description: '项目进度严重滞后'
      });
      analysis.recommendations.push('建议重新评估任务优先级和资源分配');
    }

    // 团队负载分析
    const overloadedMembers = project.team.filter(member => member.currentWorkload > 80);
    if (overloadedMembers.length > project.team.length * 0.5) {
      analysis.requiresNotification = true;
      analysis.healthScore -= 20;
      analysis.issues.push({
        type: 'team_overload',
        severity: 'medium',
        description: `${overloadedMembers.length}名团队成员工作负载过高`
      });
      analysis.recommendations.push('考虑重新分配任务或增加资源');
    }

    // 风险升级分析
    const highRisks = project.risks.filter(risk => 
      risk.severity === 'high' && risk.status === 'open'
    );
    if (highRisks.length > 0) {
      analysis.requiresNotification = true;
      analysis.healthScore -= 25;
      analysis.issues.push({
        type: 'high_risk',
        severity: 'high',
        description: `${highRisks.length}个高风险项目尚未解决`
      });
      analysis.recommendations.push('优先制定风险缓解措施');
    }

    // 活跃度分析
    const daysSinceLastActivity = (Date.now() - project.lastActivity) / (1000 * 60 * 60 * 24);
    if (daysSinceLastActivity > 3) {
      analysis.requiresNotification = true;
      analysis.healthScore -= 15;
      analysis.issues.push({
        type: 'low_activity',
        severity: 'medium',
        description: `项目${Math.floor(daysSinceLastActivity)}天无活动更新`
      });
      analysis.recommendations.push('建议增加项目沟通和状态同步频率');
    }

    return analysis;
  }

  private isProjectOverdue(project: ProjectData): boolean {
    if (!project.deadline) return false;
    return Date.now() > project.deadline.getTime();
  }

  private createHealthNotification(project: ProjectData, analysis: ProjectHealthAnalysis): NotificationItem {
    const majorIssues = analysis.issues.filter(issue => issue.severity === 'high');
    const priority = majorIssues.length > 0 ? 'important' : 'info';
    
    const title = `${priority === 'important' ? '⚠️' : 'ℹ️'} 项目健康检查`;
    const message = `项目"${project.name}"健康评分：${analysis.healthScore}/100，发现${analysis.issues.length}个问题`;

    return {
      id: `health-${project.id}-${Date.now()}`,
      type: 'project_health',
      priority,
      title,
      message,
      data: {
        project,
        analysis,
        healthScore: analysis.healthScore
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + 48 * 60 * 60 * 1000 // 48小时后过期
    };
  }
}

interface ProjectHealthAnalysis {
  requiresNotification: boolean;
  healthScore: number; // 0-100
  issues: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  recommendations: string[];
}

/**
 * 团队协作分析处理器
 */
export class TeamCollaborationProcessor implements TaskProcessor {
  getName(): string {
    return 'TeamCollaborationAnalyzer';
  }

  getDescription(): string {
    return '分析团队协作状况，识别沟通问题和协作瓶颈';
  }

  async execute(): Promise<NotificationItem[]> {
    console.log('🤝 执行团队协作分析...');
    
    try {
      const notifications: NotificationItem[] = [];
      
      // 分析最近的团队消息和活动
      const collaborationIssues = await this.analyzeTeamCollaboration();
      
      for (const issue of collaborationIssues) {
        if (issue.requiresAttention) {
          const notification = this.createCollaborationNotification(issue);
          notifications.push(notification);
        }
      }
      
      console.log(`✅ 团队协作分析完成，发现 ${notifications.length} 个协作问题`);
      return notifications;
      
    } catch (error) {
      console.error('❌ 团队协作分析失败:', error);
      return [];
    }
  }

  private async analyzeTeamCollaboration(): Promise<CollaborationIssue[]> {
    const issues: CollaborationIssue[] = [];

    try {
      // 🔄 查询最近的团队消息
      const client = getMemoryServiceClient();
      const recallResult = await client.recall('团队 协作 讨论 决策 问题', {
        topK: 30,
        channels: ['vector', 'fts']
      });

      if (recallResult && recallResult.items && recallResult.items.length > 0) {
        // 使用智能代理分析协作模式
        const agent = new IntelligentAgent();
        const analysisResult = await agent.analyze({
          type: 'collaboration_analysis',
          content: recallResult.items.map(item => item.content).join('\n\n'),
          request: '分析团队协作模式，识别沟通问题、决策延迟和协作瓶颈'
        }, {
          type: 'message',
          analysisDepth: 'deep'
        });

        // 解析分析结果
        issues.push(...this.parseCollaborationIssues(analysisResult));
      }

    } catch (error) {
      console.error('协作分析失败:', error);
    }

    return issues;
  }

  private parseCollaborationIssues(analysisResult: any): CollaborationIssue[] {
    const issues: CollaborationIssue[] = [];
    
    // 这里需要根据分析结果的具体格式来解析
    // 简化的实现示例
    if (analysisResult.summary && analysisResult.summary.includes('决策延迟')) {
      issues.push({
        type: 'decision_delay',
        description: '检测到决策延迟情况',
        severity: 'medium',
        requiresAttention: true,
        affectedTeam: '多个团队',
        suggestedAction: '加速决策流程'
      });
    }
    
    return issues;
  }

  private createCollaborationNotification(issue: CollaborationIssue): NotificationItem {
    const priority = issue.severity === 'high' ? 'important' : 'info';
    const title = `🤝 团队协作提醒`;
    const message = `检测到协作问题：${issue.description}`;

    return {
      id: `collaboration-${Date.now()}`,
      type: 'team_collaboration',
      priority,
      title,
      message,
      data: {
        issue,
        affectedTeam: issue.affectedTeam
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
  }
}

interface CollaborationIssue {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  requiresAttention: boolean;
  affectedTeam: string;
  suggestedAction: string;
}

/**
 * 每日摘要生成处理器
 */
export class DailySummaryProcessor implements TaskProcessor {
  getName(): string {
    return 'DailySummaryGenerator';
  }

  getDescription(): string {
    return '生成每日项目摘要，汇总重要进展和待办事项';
  }

  async execute(): Promise<NotificationItem[]> {
    console.log('📋 生成每日项目摘要...');
    
    try {
      const summary = await this.generateDailySummary();
      
      if (summary.hasImportantContent) {
        const notification = this.createSummaryNotification(summary);
        return [notification];
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ 每日摘要生成失败:', error);
      return [];
    }
  }

  private async generateDailySummary(): Promise<DailySummary> {
    const summary: DailySummary = {
      date: new Date().toLocaleDateString('zh-CN'),
      completedTasks: [],
      upcomingDeadlines: [],
      riskAlerts: [],
      teamUpdates: [],
      hasImportantContent: false
    };

    try {
      // 🔄 查询今日相关的活动和更新
      const todayQuery = '今天 完成 任务 进展 更新 截止';
      const client = getMemoryServiceClient();
      const recallResult = await client.recall(todayQuery, {
        topK: 20,
        channels: ['vector', 'fts']
      });

      if (recallResult && recallResult.items && recallResult.items.length > 0) {
        // 使用智能代理生成摘要
        const agent = new IntelligentAgent();
        const analysisResult = await agent.analyze({
          type: 'daily_summary',
          content: recallResult.items.map(item => item.content).join('\n\n'),
          date: summary.date,
          request: '生成今日项目活动摘要，包括完成的任务、即将到期的事项和重要更新'
        }, {
          type: 'project',
          analysisDepth: 'normal'
        });

        // 解析摘要内容
        summary.hasImportantContent = this.parseSummaryContent(analysisResult, summary);
      }

    } catch (error) {
      console.error('摘要内容生成失败:', error);
    }
    
    return summary;
  }

  private parseSummaryContent(analysisResult: any, summary: DailySummary): boolean {
    let hasContent = false;
    
    // 这里需要根据分析结果解析具体内容
    // 简化实现示例
    if (analysisResult.summary) {
      summary.completedTasks.push(analysisResult.summary);
      hasContent = true;
    }
    
    return hasContent;
  }

  private createSummaryNotification(summary: DailySummary): NotificationItem {
    const title = `📋 每日项目摘要 - ${summary.date}`;
    const message = `今日完成${summary.completedTasks.length}项任务，${summary.upcomingDeadlines.length}个即将到期的事项`;

    return {
      id: `daily-summary-${Date.now()}`,
      type: 'daily_summary',
      priority: 'info',
      title,
      message,
      data: {
        summary,
        date: summary.date
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
  }
}

interface DailySummary {
  date: string;
  completedTasks: string[];
  upcomingDeadlines: string[];
  riskAlerts: string[];
  teamUpdates: string[];
  hasImportantContent: boolean;
}

/**
 * 记忆生命周期管理处理器
 */
export class MemoryLifecycleProcessor implements TaskProcessor {
  getName(): string {
    return 'MemoryLifecycleManager';
  }

  getDescription(): string {
    return '执行智能记忆遗忘、记忆巩固和生命周期维护';
  }

  async execute(): Promise<NotificationItem[]> {
    console.log('🧠 执行记忆生命周期管理...');
    
    try {
      const { MemoryLifecycleManager } = await import('../memory-management/MemoryLifecycleManager');
      const memoryManager = new MemoryLifecycleManager();
      
      // 执行记忆生命周期管理
      const result = await memoryManager.executeMemoryLifecycle();
      
      const notifications: NotificationItem[] = [];
      
      // 如果遗忘了大量记忆，发送通知
      if (result.forgotten > 10 || result.spaceSaved > 1024 * 1024) { // 超过1MB
        notifications.push({
          id: `memory-cleanup-${Date.now()}`,
          type: 'memory_management',
          priority: 'info',
          title: '🧠 记忆整理完成',
          message: `清理了${result.forgotten}条过期记忆，节省${this.formatBytes(result.spaceSaved)}存储空间`,
          data: {
            result,
            stats: memoryManager.getStats(),
            nextScheduledRun: result.nextScheduledRun
          },
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000
        });
      }
      
      // 如果记忆数量过多，发送预警
      if (result.totalProcessed > 10000) {
        notifications.push({
          id: `memory-warning-${Date.now()}`,
          type: 'memory_warning',
          priority: 'important',
          title: '⚠️ 记忆数量过多',
          message: `当前记忆数量：${result.totalProcessed}，建议调整遗忘策略或手动清理`,
          data: {
            totalMemories: result.totalProcessed,
            suggestion: '考虑降低记忆保留阈值或增加遗忘规则'
          },
          createdAt: Date.now()
        });
      }
      
      console.log(`✅ 记忆生命周期管理完成，生成${notifications.length}个通知`);
      return notifications;
      
    } catch (error) {
      console.error('❌ 记忆生命周期管理失败:', error);
      
      // 发送错误通知
      return [{
        id: `memory-error-${Date.now()}`,
        type: 'system_error',
        priority: 'important',
        title: '❌ 记忆管理系统错误',
        message: `记忆生命周期管理失败：${error.message}`,
        data: { error: error.message },
        createdAt: Date.now()
      }];
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * 任务处理器工厂
 */
export class TaskProcessorFactory {
  private static processors: Map<string, TaskProcessor> = new Map();

  static initialize(): void {
    TaskProcessorFactory.processors.set('dependency-monitor', new DependencyMonitorProcessor());
    TaskProcessorFactory.processors.set('project-health-check', new ProjectHealthCheckProcessor());
    TaskProcessorFactory.processors.set('team-collaboration-analysis', new TeamCollaborationProcessor());
    TaskProcessorFactory.processors.set('daily-summary', new DailySummaryProcessor());
    TaskProcessorFactory.processors.set('memory-lifecycle', new MemoryLifecycleProcessor());

    console.log('⚙️ Task processors initialized');
  }

  static getProcessor(name: string): TaskProcessor | undefined {
    return TaskProcessorFactory.processors.get(name);
  }

  static getAllProcessors(): Map<string, TaskProcessor> {
    return TaskProcessorFactory.processors;
  }

  static getProcessorNames(): string[] {
    return Array.from(TaskProcessorFactory.processors.keys());
  }
}

export default {
  DependencyMonitorProcessor,
  ProjectHealthCheckProcessor,
  TeamCollaborationProcessor,
  DailySummaryProcessor,
  TaskProcessorFactory
};