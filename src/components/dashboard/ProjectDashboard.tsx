/**
 * 项目进度可视化仪表盘 - 主组件
 * 整合项目进展、依赖关系、团队状态等多维度信息
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { GanttChart } from './charts/GanttChart';
import { DependencyGraph } from './charts/DependencyGraph';
import { BurndownChart } from './charts/BurndownChart';
import { RiskPanel } from './panels/RiskPanel';
import { TeamMetricsPanel } from './panels/TeamMetricsPanel';
import { QuickActionsPanel } from './panels/QuickActionsPanel';
import { EditableOverlay } from './interactions/EditableOverlay';

interface ProjectData {
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
  jiraProjectKey?: string;
  lastUpdated: Date;
}

interface Milestone {
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

interface Task {
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

interface Dependency {
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

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  currentWorkload: number; // 0-100%
  availability: number; // 0-100%
  skills: string[];
}

interface Risk {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  probability: number; // 0-100%
  impact: string;
  mitigation: string;
  owner: string;
  status: 'open' | 'mitigating' | 'resolved';
  identifiedDate: Date;
  targetResolutionDate: Date;
}

type ViewMode = 'gantt' | 'burndown' | 'dependency' | 'overview';

const ProjectDashboard: React.FC = () => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // 用于调试的ref
  const projectsRef = useRef<ProjectData[]>([]);

  // 日期处理函数：修复Chrome消息传递中的日期序列化问题
  const processProjectDates = (projects: any[]): ProjectData[] => {
    console.log('🔄 开始处理项目日期数据...');
    
    return projects.map(project => {
      try {
        return {
          ...project,
          startDate: new Date(project.startDate),
          endDate: new Date(project.endDate),
          lastUpdated: new Date(project.lastUpdated),
          milestones: project.milestones.map((milestone: any) => ({
            ...milestone,
            plannedDate: new Date(milestone.plannedDate),
            actualDate: milestone.actualDate ? new Date(milestone.actualDate) : undefined,
            tasks: milestone.tasks.map((task: any) => ({
              ...task,
              startDate: new Date(task.startDate),
              endDate: new Date(task.endDate)
            }))
          })),
          dependencies: project.dependencies.map((dep: any) => ({
            ...dep,
            estimatedCompletion: new Date(dep.estimatedCompletion),
            actualCompletion: dep.actualCompletion ? new Date(dep.actualCompletion) : undefined
          })),
          risks: project.risks.map((risk: any) => ({
            ...risk,
            identifiedDate: new Date(risk.identifiedDate),
            targetResolutionDate: new Date(risk.targetResolutionDate),
            actualResolutionDate: risk.actualResolutionDate ? new Date(risk.actualResolutionDate) : undefined
          }))
        };
      } catch (error) {
        console.error('❌ 处理项目日期时出错:', project.id, error);
        // 返回原始项目数据作为备选
        return project;
      }
    });
  };

  // 获取项目数据 - 移除依赖项解决闭包问题
  const loadProjectData = useCallback(async (targetProjectId?: string) => {
    const projectId = targetProjectId ?? selectedProject;
    console.log('🔄 开始加载项目数据...', { projectId, timestamp: new Date().toISOString() });
    setIsLoading(true);
    
    try {
      // 检查chrome.runtime是否可用
      if (!chrome || !chrome.runtime) {
        console.error('❌ Chrome运行时不可用');
        showNotification('Chrome扩展运行时错误', 'error');
        return;
      }

      console.log('📤 发送消息到后台脚本:', {
        type: 'GET_PROJECT_DATA',
        projectId: projectId
      });

      // 从多个数据源获取项目信息
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PROJECT_DATA',
        projectId: projectId
      });
      
      console.log('📥 收到后台脚本响应:', response);
      
      if (response && response.success) {
        console.log('✅ 项目数据加载成功:', {
          projectCount: response.projects?.length || 0,
          projects: response.projects
        });
        
        // 调试：检查即将设置的项目数据
        console.log('🔄 正在更新React状态...');
        console.log('设置的项目数据:', response.projects);
        
        const newProjects = response.projects || [];
        
        // 🔧 修复日期序列化问题：将字符串转换回Date对象
        const processedProjects = processProjectDates(newProjects);
        
        console.log('🔄 日期处理后的项目数据:', processedProjects);
        
        // 强制触发状态更新
        setProjects(() => {
          console.log('🔄 setProjects函数式更新执行:', processedProjects.length);
          return processedProjects;
        });
        projectsRef.current = processedProjects;
        setLastRefresh(new Date());
        
        // 使用更长的延迟确保状态更新完成
        setTimeout(() => {
          console.log('🔍 React状态更新后检查:', {
            'newProjects.length': newProjects.length,
            'projectsRef.current.length': projectsRef.current.length,
            'projectsRef内容': projectsRef.current.map(p => ({ id: p.id, name: p.name }))
          });
        }, 200);
        
        showNotification(`成功加载${processedProjects.length}个项目`, 'success');
      } else {
        console.warn('⚠️ 响应格式异常或失败:', response);
        const errorMsg = response?.error || '未知错误';
        showNotification(`加载失败: ${errorMsg}`, 'error');
        
        // 设置空数组避免组件错误
        setProjects([]);
      }
    } catch (error) {
      console.error('❌ 加载项目数据失败:', {
        error: error.message,
        stack: error.stack,
        projectId
      });
      showNotification(`加载错误: ${error.message}`, 'error');
      setProjects([]);
    } finally {
      setIsLoading(false);
      console.log('🏁 项目数据加载完成');
    }
  }, []); // 移除依赖项

  // 初始化和定期刷新
  useEffect(() => {
    console.log('🚀 项目仪表盘组件初始化', {
      timestamp: new Date().toISOString(),
      selectedProject,
      userAgent: navigator.userAgent
    });
    
    // 延迟一点时间确保扩展完全加载
    setTimeout(() => {
      console.log('⏰ 开始首次数据加载');
      loadProjectData();
    }, 100);
    
    // 每30秒自动刷新一次
    const interval = setInterval(() => {
      console.log('🔄 定时刷新项目数据');
      loadProjectData();
    }, 30000);
    
    return () => {
      console.log('🛑 清理项目仪表盘定时器');
      clearInterval(interval);
    };
  }, [loadProjectData]);

  // 监听projects状态变化
  useEffect(() => {
    console.log('📊 projects状态已更新:', {
      projectsLength: projects.length,
      projectNames: projects.map(p => p.name),
      timestamp: new Date().toISOString()
    });
  }, [projects]);

  // 处理快速编辑
  const handleQuickEdit = async (itemType: string, itemId: string, changes: any) => {
    try {
      // 乐观更新UI
      updateLocalState(itemType, itemId, changes);
      
      // 异步同步到后端
      await chrome.runtime.sendMessage({
        type: 'UPDATE_PROJECT_ITEM',
        projectId: selectedProject,
        itemType,
        itemId,
        changes,
        userContext: {
          timestamp: Date.now(),
          source: 'dashboard_edit'
        }
      });
      
      // 显示成功提示
      showNotification('更新成功', 'success');
      
    } catch (error) {
      // 回滚UI更改
      await loadProjectData();
      showNotification('更新失败，请重试', 'error');
    }
  };

  // 更新本地状态
  const updateLocalState = (itemType: string, itemId: string, changes: any) => {
    setProjects(prevProjects => 
      prevProjects.map(project => {
        if (project.id !== selectedProject) return project;
        
        switch (itemType) {
          case 'milestone':
            return {
              ...project,
              milestones: project.milestones.map(milestone =>
                milestone.id === itemId ? { ...milestone, ...changes } : milestone
              )
            };
          case 'task':
            return {
              ...project,
              milestones: project.milestones.map(milestone => ({
                ...milestone,
                tasks: milestone.tasks.map(task =>
                  task.id === itemId ? { ...task, ...changes } : task
                )
              }))
            };
          case 'dependency':
            return {
              ...project,
              dependencies: project.dependencies.map(dep =>
                dep.id === itemId ? { ...dep, ...changes } : dep
              )
            };
          default:
            return project;
        }
      })
    );
  };

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const logMessage = `${emoji} [${timestamp}] ${message}`;
    
    // 控制台日志
    console.log(`${type.toUpperCase()}: ${logMessage}`);
    
    // 尝试在页面上显示通知（如果有通知区域）
    try {
      const notificationArea = document.getElementById('notification-area');
      if (notificationArea) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = logMessage;
        notification.style.cssText = `
          padding: 8px 16px;
          margin: 4px 0;
          border-radius: 4px;
          background: ${type === 'success' ? '#f6ffed' : type === 'error' ? '#fff2f0' : '#e6f7ff'};
          color: ${type === 'success' ? '#52c41a' : type === 'error' ? '#ff4d4f' : '#1890ff'};
          border: 1px solid ${type === 'success' ? '#52c41a' : type === 'error' ? '#ff4d4f' : '#1890ff'};
          font-size: 14px;
        `;
        notificationArea.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      }
    } catch (err) {
      console.log('无法显示页面通知:', err);
    }
  };

  // 获取当前项目数据
  const currentProject = projects.find(p => p.id === selectedProject);

  // 调试：在每次渲染时检查项目状态
  console.log('🎨 ProjectDashboard 渲染中:', {
    projectsLength: projects.length,
    projectNames: projects.map(p => p.name),
    selectedProject,
    currentProject: currentProject?.name
  });

  return (
    <div className="project-dashboard">
      {/* 通知区域 */}
      <div id="notification-area" className="notification-area"></div>
      
      {/* 头部区域 */}
      <div className="dashboard-header">
        <div className="project-selector">
          <select 
            value={selectedProject || ''} 
            onChange={(e) => {
              console.log('📝 项目选择改变:', e.target.value);
              setSelectedProject(e.target.value || null);
            }}
          >
            <option value="">选择项目</option>
            {projects.map((project, index) => {
              console.log(`🔗 渲染项目选项 ${index + 1}:`, project.name, project.id);
              return (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              );
            })}
          </select>
          
          <button 
            className="refresh-btn"
            onClick={() => loadProjectData()}
            disabled={isLoading}
          >
            {isLoading ? '刷新中...' : '刷新'}
          </button>
          
          <button 
            className="refresh-btn"
            onClick={() => {
              console.log('🔄 手动触发状态更新');
              setProjects([...projectsRef.current]);
            }}
            style={{marginLeft: '8px', background: '#52c41a'}}
          >
            强制更新
          </button>
          
          <span className="last-refresh">
            最后更新: {lastRefresh.toLocaleTimeString()}
          </span>
          
          <span className="debug-info" style={{marginLeft: '16px', fontSize: '12px', color: '#666'}}>
            (调试: {projects.length} 个项目)
          </span>
        </div>

        <div className="view-controls">
          <div className="view-mode-selector">
            {(['overview', 'gantt', 'burndown', 'dependency'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                className={`view-btn ${viewMode === mode ? 'active' : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {getViewModeLabel(mode)}
              </button>
            ))}
          </div>
          
          <button
            className={`edit-mode-btn ${editMode ? 'active' : ''}`}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? '退出编辑' : '编辑模式'}
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      {currentProject ? (
        <div className="dashboard-content">
          {/* 项目概览卡片 */}
          {viewMode === 'overview' && (
            <div className="overview-grid">
              <div className="project-summary-card">
                <h3>{currentProject.name}</h3>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${currentProject.overallProgress}%` }}
                  />
                  <span className="progress-text">
                    {currentProject.overallProgress}% 完成
                  </span>
                </div>
                <div className="project-meta">
                  <span>状态: {getStatusLabel(currentProject.status)}</span>
                  <span>团队: {currentProject.team.length} 人</span>
                  <span>里程碑: {currentProject.milestones.length}</span>
                </div>
              </div>
              
              <div className="milestones-grid">
                {currentProject.milestones.map(milestone => (
                  <div key={milestone.id} className="milestone-card">
                    <h4>{milestone.name}</h4>
                    <div className="milestone-progress">
                      <div 
                        className="progress-bar mini"
                        style={{ 
                          '--progress': `${milestone.progress}%`,
                          '--color': getMilestoneColor(milestone.status)
                        } as React.CSSProperties}
                      />
                      <span>{milestone.progress}%</span>
                    </div>
                    <div className="milestone-meta">
                      <span>目标: {milestone.plannedDate.toLocaleDateString()}</span>
                      <span className={`status ${milestone.status}`}>
                        {getStatusLabel(milestone.status)}
                      </span>
                    </div>
                    {editMode && (
                      <div className="edit-actions">
                        <button onClick={() => openMilestoneEditor(milestone)}>
                          编辑
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 甘特图视图 */}
          {viewMode === 'gantt' && (
            <GanttChart
              project={currentProject}
              editable={editMode}
              onTaskEdit={handleQuickEdit}
              onMilestoneEdit={handleQuickEdit}
            />
          )}

          {/* 燃尽图视图 */}
          {viewMode === 'burndown' && (
            <BurndownChart
              project={currentProject}
              showIdealLine={true}
              showVelocity={true}
            />
          )}

          {/* 依赖关系图视图 */}
          {viewMode === 'dependency' && (
            <DependencyGraph
              dependencies={currentProject.dependencies}
              milestones={currentProject.milestones}
              editable={editMode}
              onDependencyEdit={handleQuickEdit}
            />
          )}

          {/* 侧边面板 */}
          <div className="side-panels">
            <RiskPanel 
              risks={currentProject.risks}
              onRiskUpdate={(riskId, changes) => handleQuickEdit('risk', riskId, changes)}
            />
            
            <TeamMetricsPanel 
              team={currentProject.team}
              milestones={currentProject.milestones}
            />
            
            <QuickActionsPanel
              project={currentProject}
              onAction={handleQuickAction}
            />
          </div>
        </div>
      ) : (
        <div className="no-project-selected">
          <div className="placeholder">
            <h3>选择一个项目开始分析</h3>
            <p>从上方下拉菜单中选择要查看的项目</p>
          </div>
        </div>
      )}

      {/* 可编辑覆盖层 */}
      {editMode && (
        <EditableOverlay
          project={currentProject}
          onSave={handleSaveChanges}
          onCancel={() => setEditMode(false)}
        />
      )}

      {/* 样式 */}
      <style>{`
        .project-dashboard {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f5f5f5;
        }

        .notification-area {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 1000;
          max-width: 400px;
          pointer-events: none;
        }

        .notification {
          pointer-events: auto;
          margin-bottom: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .project-selector {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .project-selector select {
          padding: 8px 12px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 14px;
          min-width: 200px;
        }

        .refresh-btn {
          padding: 8px 16px;
          background: #1890ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-btn:hover {
          background: #40a9ff;
        }

        .refresh-btn:disabled {
          background: #d0d0d0;
          cursor: not-allowed;
        }

        .last-refresh {
          font-size: 12px;
          color: #666;
        }

        .view-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .view-mode-selector {
          display: flex;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          overflow: hidden;
        }

        .view-btn {
          padding: 8px 16px;
          background: white;
          border: none;
          cursor: pointer;
          font-size: 14px;
          border-right: 1px solid #d0d0d0;
        }

        .view-btn:last-child {
          border-right: none;
        }

        .view-btn.active {
          background: #1890ff;
          color: white;
        }

        .edit-mode-btn {
          padding: 8px 16px;
          background: white;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .edit-mode-btn.active {
          background: #52c41a;
          color: white;
          border-color: #52c41a;
        }

        .dashboard-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .overview-grid {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        .project-summary-card {
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }

        .project-summary-card h3 {
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 600;
        }

        .progress-bar {
          position: relative;
          width: 100%;
          height: 24px;
          background: #f0f0f0;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1890ff, #40a9ff);
          transition: width 0.3s ease;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-weight: 600;
          font-size: 14px;
          color: white;
        }

        .project-meta {
          display: flex;
          gap: 24px;
          font-size: 14px;
          color: #666;
        }

        .milestones-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .milestone-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s ease;
        }

        .milestone-card:hover {
          transform: translateY(-2px);
        }

        .milestone-card h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .milestone-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .progress-bar.mini {
          height: 8px;
          flex: 1;
          background: var(--color, #1890ff);
        }

        .milestone-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #666;
        }

        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 10px;
        }

        .status.on-track {
          background: #f6ffed;
          color: #52c41a;
        }

        .status.at-risk {
          background: #fff7e6;
          color: #fa8c16;
        }

        .status.delayed {
          background: #fff2f0;
          color: #ff4d4f;
        }

        .status.completed {
          background: #f0f0f0;
          color: #666;
        }

        .side-panels {
          width: 350px;
          background: white;
          border-left: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
        }

        .no-project-selected {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .placeholder {
          text-align: center;
          color: #666;
        }

        .placeholder h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }

        .placeholder p {
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );

  // 辅助函数
  function getViewModeLabel(mode: ViewMode): string {
    const labels = {
      overview: '概览',
      gantt: '甘特图',
      burndown: '燃尽图',
      dependency: '依赖图'
    };
    return labels[mode];
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'planning': '规划中',
      'in-progress': '进行中',
      'at-risk': '有风险',
      'completed': '已完成',
      'on-track': '正常',
      'delayed': '延期'
    };
    return labels[status] || status;
  }

  function getMilestoneColor(status: string): string {
    const colors: Record<string, string> = {
      'on-track': '#52c41a',
      'at-risk': '#fa8c16',
      'delayed': '#ff4d4f',
      'completed': '#666'
    };
    return colors[status] || '#1890ff';
  }

  function openMilestoneEditor(milestone: Milestone) {
    // TODO: 实现里程碑编辑器
    console.log('编辑里程碑:', milestone);
  }

  function handleSaveChanges(changes: any) {
    // TODO: 实现批量保存
    console.log('保存变更:', changes);
    setEditMode(false);
  }

  function handleQuickAction(action: string, data: any) {
    // TODO: 实现快速操作
    console.log('快速操作:', action, data);
  }
};

export default ProjectDashboard;