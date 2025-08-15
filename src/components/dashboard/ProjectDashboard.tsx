import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getEnvConfig, EnvConfigType } from '../../utils';

// 新仪表盘数据结构（与 docs/demo/项目进展图-缩放版.html 对齐）

type PlatformKey = 'sdk' | 'ios' | 'android' | 'qa' | 'dev';

interface PlatformState { status: string; assignee?: string; jira?: string }
interface MilestonePoint { id: string; label: string; date?: string }
interface FishboneTask {
  id: string;
  type: 'dep' | 'task' | 'design';
  title: string;
  status: string; // dep: todo|progress|testBuild|rollout|blocked; design: todo|progress|review|done; task: todo|progress|testing|closed|rollout
  eta?: string;   // YYYY-MM-DD
  desc?: string;
  platforms?: Partial<Record<PlatformKey, PlatformState>>;
  jira?: Array<{ key: string; title: string }>
}
interface FishboneProject {
  id: string;
  name: string;
  description?: string;
  milestones: MilestonePoint[]; // 动态多点
  tasks: FishboneTask[];
  platformConfig?: PlatformKey[]; // 默认 sdk/ios/android/qa，可选 dev
}

const ProjectDashboard: React.FC = () => {
  const [projects, setProjects] = useState<FishboneProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [env, setEnv] = useState<EnvConfigType | null>(null);

  // 新增项目入口
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPrompt, setNewProjectPrompt] = useState('');
  const [platformConfig, setPlatformConfig] = useState<Record<PlatformKey, boolean>>({
    sdk: true, ios: true, android: true, qa: true, dev: false
  });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // 里程碑配置
  const [milestones, setMilestones] = useState<Array<{label: string; date: string}>>([
    { label: 'Alpha', date: '' },
    { label: 'Beta', date: '' },
    { label: 'GA', date: '' }
  ]);

  // 详情弹窗
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  
  // 任务添加功能
  const [showAddTask, setShowAddTask] = useState<{projectId: string; position: number} | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'dep'|'task'|'design'>('task');
  
  // 拖拽功能状态
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    draggedTask: string | null;
    startX: number;
    startY: number;
    startPosition: number;
    containerWidth: number;
    mouseDownTime: number;
  }>({ isDragging: false, draggedTask: null, startX: 0, startY: 0, startPosition: 0, containerWidth: 0, mouseDownTime: 0 });
  
  const [taskPositions, setTaskPositions] = useState<Record<string, number>>({});

  const selectedTask = useMemo(() => {
    for (const p of projects) {
      const t = p.tasks.find(t => t.id === detailTaskId);
      if (t) return { project: p, task: t };
    }
    return null;
  }, [projects, detailTaskId]);

  useEffect(() => {
    getEnvConfig().then(setEnv).catch(() => setEnv(null));
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_PROJECT_DATA' });
      if (res?.success) {
        setProjects(res.projects || []);
        setLastRefresh(new Date());
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    const timer = setInterval(loadProjects, 30000);
    return () => clearInterval(timer);
  }, []);

  // 将任务均匀分布在 10% ~ 90% 的横向范围，排序优先使用 eta
  const computeLeftPercent = (index: number, total: number) => {
    if (total <= 1) return 50;
    const start = 10;
    const end = 90;
    const step = (end - start) / (total - 1);
    return start + step * index;
  };

  const openDetail = (taskId: string) => setDetailTaskId(taskId);
  const closeDetail = () => setDetailTaskId(null);

  const updateTask = async (projectId: string, itemType: 'dep'|'task'|'design', taskId: string, changes: any) => {
    // 乐观更新
    setProjects(prev => prev.map(p => p.id !== projectId ? p : ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...changes } : t)
    })));
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_PROJECT_ITEM', projectId, itemType, itemId: taskId, changes,
        userContext: { timestamp: Date.now(), source: 'dashboard_edit' }
      });
    } catch {
      loadProjects();
    }
  };

  const addJira = async (projectId: string, task: FishboneTask) => {
    const key = prompt('请输入JIRA Key (例如: PROJ-123):');
    const title = prompt('请输入JIRA标题:');
    if (!key || !title) return;
    const newList = [...(task.jira || []), { key, title }];
    await updateTask(projectId, task.type, task.id, { jira: newList });
  };

  const removeJira = async (projectId: string, task: FishboneTask, index: number) => {
    const list = [...(task.jira || [])];
    list.splice(index, 1);
    await updateTask(projectId, task.type, task.id, { jira: list });
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      // 改用 getAllKnownProjects 获取项目建议
      const { getAllKnownProjects } = await import('../../vectorStore');
      const allProjects = await getAllKnownProjects();
      
      // 按项目名称长度倒序排列（可能代表信息量）
      const sortedProjects = allProjects
        .filter(name => name && name.trim().length > 0)
        .sort((a, b) => b.length - a.length)
        .slice(0, 8);
      
      setSuggestions(sortedProjects);
    } catch (error) {
      console.error('获取项目建议失败:', error);
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  };

  // 新增项目弹窗打开时自动获取建议
  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
    // 延迟一下自动获取建议
    setTimeout(() => {
      if (!suggesting && suggestions.length === 0) {
        handleSuggest();
      }
    }, 300);
  };

  const handleCreateProject = async () => {
    const platformList = (Object.keys(platformConfig) as PlatformKey[]).filter(k => platformConfig[k]);
    const milestoneList = milestones.filter(m => m.label.trim() && m.date).map(m => ({
      id: `milestone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: m.label.trim(),
      date: m.date
    }));
    
    const res = await chrome.runtime.sendMessage({
      type: 'ADD_PROJECT',
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      platformConfig: platformList,
      milestones: milestoneList,
      prompt: newProjectPrompt.trim()
    });
    if (res?.success) {
      setCreateModalOpen(false);
      setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setSuggestions([]);
      setPlatformConfig({ sdk: true, ios: true, android: true, qa: true, dev: false });
      setMilestones([
        { label: 'Alpha', date: '' },
        { label: 'Beta', date: '' },
        { label: 'GA', date: '' }
      ]);
      await loadProjects();
    }
  };

  const jiraUrl = (key: string) => {
    const base = env?.JIRA_BASE_URL || 'https://jira.example.com';
    return `${base}/browse/${encodeURIComponent(key)}`;
  };

  // 同步数据
  const handleSyncData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action: 'sync_data',
        data: { projectId: 'all' }
      });

      if (response?.success) {
        console.log('数据同步完成');
        await loadProjects();
      } else {
        console.error('同步失败:', response?.error);
      }
    } catch (error) {
      console.error('同步数据失败:', error);
    }
  };

  // 导出报告
  const handleExportReport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action: 'export_report',
        data: { projectId: 'all' }
      });

      if (response?.success) {
        console.log('报告导出完成');
        // 这里可以添加下载逻辑
      } else {
        console.error('导出失败:', response?.error);
      }
    } catch (error) {
      console.error('导出报告失败:', error);
    }
  };

  // 添加新任务
  const handleAddTask = async () => {
    if (!showAddTask || !newTaskTitle.trim()) return;
    
    const newTask: FishboneTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: newTaskType,
      title: newTaskTitle.trim(),
      status: 'todo',
      eta: '',
      desc: ''
    };

    const res = await chrome.runtime.sendMessage({
      type: 'ADD_PROJECT_ITEM',
      projectId: showAddTask.projectId,
      itemType: 'task',
      itemData: newTask
    });

    if (res?.success) {
      setShowAddTask(null);
      setNewTaskTitle('');
      setNewTaskType('task');
      await loadProjects();
    }
  };

  // 时间线点击添加任务（基于锚点位置）
  const handleTimelineClick = (projectId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const containerPadding = 40;
    
    // 计算点击位置相对于时间线的百分比（10%-90%范围）
    const relativeX = clickX - containerPadding;
    const availableWidth = rect.width - (containerPadding * 2);
    const anchorPosition = (relativeX / availableWidth) * 80 + 10;
    
    // 根据锚点位置自动选择对应的milestone阶段
    const project = projects.find(p => p.id === projectId);
    let selectedMilestone = '';
    if (project?.milestones) {
      // 找到最接近的milestone
      let closestMilestone = project.milestones[0];
      let minDistance = Math.abs(computeLeftPercent(0, project.milestones.length) - anchorPosition);
      
      project.milestones.forEach((milestone, index) => {
        const milestonePosition = computeLeftPercent(index, project.milestones.length);
        const distance = Math.abs(milestonePosition - anchorPosition);
        if (distance < minDistance) {
          minDistance = distance;
          closestMilestone = milestone;
        }
      });
      selectedMilestone = closestMilestone.label;
    }
    
    setShowAddTask({ projectId, position: Math.round(anchorPosition) });
    // 如果有选中的milestone，可以在创建任务时使用
    console.log(`点击锚点位置 ${anchorPosition.toFixed(1)}% 对应milestone: ${selectedMilestone}`);
  };

  // 任务拖拽完成处理（旧版本，保留兼容性）
  const handleTaskDragEnd = async (task: FishboneTask, projectId: string, e: React.DragEvent) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
    
    // 找到对应的项目
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // 计算新的任务顺序位置
    const allTasks = project.tasks.sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
    const newIndex = Math.round((newPosition / 100) * (allTasks.length - 1));
    
    console.log(`任务 "${task.title}" 拖拽到新位置: ${newPosition.toFixed(1)}%, 新索引: ${newIndex}`);
    
    // 这里可以实现重新排序逻辑，或者更新任务的ETA时间
    // 暂时只在控制台输出，实际实现可以调用后端API更新任务位置
  };

  // 新的拖拽功能实现 - 智能检测点击vs拖拽，基于锚点计算
  const handleMouseDown = (e: React.MouseEvent, task: FishboneTask, projectId: string) => {
    // 不立即阻止默认行为，让点击事件能正常触发
    const target = e.currentTarget as HTMLElement;
    const container = target.closest('.fishbone-container') as HTMLElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const containerPadding = 40;
    const availableWidth = rect.width - (containerPadding * 2);
    
    // 获取当前锚点位置（以百分比表示）
    const currentAnchorPercent = getTaskAnchorPosition(task.id, projectId);
    
    // 计算锚点的像素位置（相对于容器）
    const anchorPixelPosition = containerPadding + ((currentAnchorPercent - 10) / 80) * availableWidth;
    
    // 记录鼠标按下状态，但不立即开始拖拽
    setDragState({
      isDragging: false, // 初始不拖拽
      draggedTask: task.id,
      startX: e.clientX,
      startY: e.clientY,
      startPosition: anchorPixelPosition, // 存储锚点位置
      containerWidth: availableWidth,
      mouseDownTime: Date.now()
    });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.draggedTask) return;
    
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 如果还没有开始拖拽，检查是否应该开始
    if (!dragState.isDragging) {
      const dragThreshold = 5; // 移动5像素以上才开始拖拽
      if (distance > dragThreshold) {
        // 开始拖拽
        const target = document.querySelector(`[data-task-id="${dragState.draggedTask}"]`) as HTMLElement;
        if (target) {
          target.classList.add('dragging');
          document.body.classList.add('modal-open');
        }
        
        setDragState(prev => ({
          ...prev,
          isDragging: true
        }));
      }
      return;
    }
    
    // 执行拖拽逻辑 - 基于锚点计算
    const deltaXFromStart = e.clientX - dragState.startX;
    const newAnchorPixelPosition = dragState.startPosition + deltaXFromStart;
    const containerPadding = 40;
    
    // 限制锚点在容器边界内（给卡片留出空间）
    const minAnchorPosition = containerPadding + 50; // 最小位置，留给卡片空间
    const maxAnchorPosition = containerPadding + dragState.containerWidth - 50; // 最大位置
    const clampedAnchorPosition = Math.max(minAnchorPosition, Math.min(maxAnchorPosition, newAnchorPixelPosition));
    
    // 转换锚点位置为百分比
    let newAnchorPercent = ((clampedAnchorPosition - containerPadding) / dragState.containerWidth) * 80 + 10;
    
    // 应用吸附功能（基于锚点）
    const projectId = projects.find(p => p.tasks.some(t => t.id === dragState.draggedTask))?.id;
    if (projectId) {
      newAnchorPercent = getSnapPosition(newAnchorPercent, projectId);
    }
    
    // 更新锚点位置（taskPositions现在存储的是锚点位置）
    setTaskPositions(prev => ({
      ...prev,
      [dragState.draggedTask!]: newAnchorPercent
    }));
  };
  
  const handleMouseUp = () => {
    if (!dragState.draggedTask) return;
    
    if (dragState.isDragging) {
      // 清除拖拽样式
      const target = document.querySelector(`[data-task-id="${dragState.draggedTask}"]`) as HTMLElement;
      if (target) {
        target.classList.remove('dragging');
        target.classList.add('was-dragging');
      }
      document.body.classList.remove('modal-open');
      
      // 清除was-dragging标记
      setTimeout(() => {
        if (target) {
          target.classList.remove('was-dragging');
        }
      }, 100);
    }
    
    // 重置拖拽状态
    setDragState({ 
      isDragging: false, 
      draggedTask: null, 
      startX: 0, 
      startY: 0,
      startPosition: 0, 
      containerWidth: 0,
      mouseDownTime: 0 
    });
  };
  
  // 获取不同类型任务的锚点偏移量（相对于卡片左边）
  const getConnectorAnchorOffset = (taskType: 'dep' | 'task' | 'design') => {
    // 基础卡片宽度估算（padding 12px+16px + 内容）+ connector的right偏移
    const baseCardWidth = 180; // 这是CSS中设置的min-width
    switch (taskType) {
      case 'dep':
      case 'design':
        return baseCardWidth + 27; // right: -27px
      case 'task':
        return baseCardWidth + 30; // right: -30px
      default:
        return baseCardWidth + 27;
    }
  };

  // 获取任务锚点位置（以bone-connector为基准，支持自定义位置）
  const getTaskAnchorPosition = (taskId: string, projectId: string) => {
    if (taskPositions[taskId]) {
      return taskPositions[taskId];
    }
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return 50;
    
    const tasks = [...project.tasks].sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
    const index = tasks.findIndex(t => t.id === taskId);
    
    return computeLeftPercent(index, tasks.length);
  };

  // 获取任务卡片位置（基于锚点位置计算卡片左边位置）
  const getTaskPosition = (taskId: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return 50;
    
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return 50;
    
    const anchorPosition = getTaskAnchorPosition(taskId, projectId);
    
    // 获取容器的实际宽度用于更精确的计算
    const containerElement = document.querySelector('.fishbone-container') as HTMLElement;
    const containerWidth = containerElement ? containerElement.offsetWidth : 1000; // 默认宽度
    const containerPadding = 40;
    const availableWidth = containerWidth - (containerPadding * 2);
    
    // 计算卡片实际宽度（动态计算，考虑文字长度和平台状态）
    let estimatedCardWidth = Math.max(180, task.title.length * 8 + 60); // 基于标题长度估算
    
    // 如果有平台信息，增加宽度
    if (task.platforms && Object.keys(task.platforms).length > 0) {
      estimatedCardWidth += 20;
    }
    
    // 如果有ETA信息，增加宽度
    if (task.eta) {
      estimatedCardWidth += 40;
    }
    
    // 计算连接器偏移相对于容器的百分比
    const connectorOffsetPercent = (estimatedCardWidth + (task.type === 'task' ? 30 : 27)) / availableWidth * 80;
    
    // 锚点位置减去连接器偏移，得到卡片左边位置
    const cardLeftPosition = anchorPosition - connectorOffsetPercent;
    
    return Math.max(2, Math.min(98 - connectorOffsetPercent, cardLeftPosition)); // 动态限制范围
  };
  
  // 处理点击事件（智能判断是否是拖拽后的点击）
  const handleTaskClick = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    
    // 如果刚完成拖拽，不触发点击
    if (target.classList.contains('was-dragging')) {
      return;
    }
    
    // 如果当前正在拖拽这个任务，不触发点击
    if (dragState.isDragging && dragState.draggedTask === taskId) {
      return;
    }
    
    openDetail(taskId);
  };

  // 监听全局鼠标事件
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.draggedTask) {
        handleMouseMove(e as any);
      }
    };
    
    const handleGlobalMouseUp = () => {
      if (dragState.draggedTask) {
        handleMouseUp();
      }
    };
    
    if (dragState.draggedTask) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState.draggedTask, dragState.isDragging]);

  // 响应式处理 - 监听窗口大小变化（基于锚点）
  React.useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      // 延迟重新计算位置，避免频繁调用
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // 重新计算所有任务锚点位置，保持相对比例
        setTaskPositions(prev => {
          const newPositions: Record<string, number> = {};
          
          // 为每个项目重新计算任务锚点位置
          projects.forEach(project => {
            project.tasks.forEach((task, index) => {
              if (prev[task.id]) {
                // 如果已有自定义锚点位置，保持不变
                newPositions[task.id] = prev[task.id];
              } else {
                // 使用默认的均匀分布锚点位置
                const tasks = [...project.tasks].sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
                const taskIndex = tasks.findIndex(t => t.id === task.id);
                newPositions[task.id] = computeLeftPercent(taskIndex, tasks.length);
              }
            });
          });
          
          return newPositions;
        });
      }, 300);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [projects]);

  // 吸附功能 - 任务锚点拖拽时可以吸附到里程碑
  const getSnapPosition = (currentAnchorPercent: number, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project?.milestones) return currentAnchorPercent;
    
    const tolerance = 8; // 增加吸附容差，因为现在基于锚点
    
    for (let i = 0; i < project.milestones.length; i++) {
      const milestonePercent = computeLeftPercent(i, project.milestones.length);
      if (Math.abs(currentAnchorPercent - milestonePercent) < tolerance) {
        return milestonePercent;
      }
    }
    
    return currentAnchorPercent;
  };

              return (
    <div className="project-dashboard fishbone">
      <div id="notification-area" className="notification-area" />
      
      {/* 完整的仪表盘头部 */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">📊 项目进度仪表盘</h1>
          <p className="dashboard-subtitle">智能项目管理与团队协作可视化</p>
        </div>
        <div className="dashboard-controls">
          <span className="last-refresh">最后更新: {lastRefresh.toLocaleTimeString()}</span>
          <button 
            className="control-button" 
            disabled={isLoading}
            onClick={loadProjects}
          >
            🔄 {isLoading ? '刷新中...' : '刷新数据'}
          </button>
          <button className="control-button secondary" onClick={handleSyncData}>
            ⚡ 同步数据
          </button>
          <button className="control-button success" onClick={handleExportReport}>
            📄 导出报告
          </button>
          <button className="control-button primary" onClick={handleOpenCreateModal}>
            ➕ 新增项目
          </button>
        </div>
      </div>

      <div className="container">
        <div className="project-list">
          {projects.map(project => {
            const milestones = project.milestones || [];
            const tasks = [...(project.tasks || [])]
              .sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
              return (
              <div className="project-card" key={project.id}>
                <div className="project-header">
                  <div>
                    <h2 className="project-title">{project.name}</h2>
                    {project.description && <p style={{ margin: '5px 0 0', color: 'var(--text-muted)' }}>{project.description}</p>}
                  </div>
                </div>
                                <div 
                  className="fishbone-container" 
                  onClick={(e) => {
                    // 只在点击空白区域时添加任务
                    if ((e.target as HTMLElement).classList.contains('fishbone-container')) {
                      handleTimelineClick(project.id, e);
                    }
                  }}
                >
                  <div className="timeline-spine" />
                  <div className="timeline-arrow" />
                  
                  {/* 添加任务提示 */}
                  <div className="add-task-hint">💡 点击时间线空白处添加任务</div>

                  {milestones.map((m, i) => (
                    <div key={m.id} className={`milestone ${m.label.toLowerCase()}`} style={{ left: `${computeLeftPercent(i, milestones.length)}%` }}>
                      <div className="milestone-label">{m.label}</div>
                      {m.date && <div className="milestone-date">{m.date}</div>}
                      {m.label}
        </div>
                  ))}

                  {tasks.map((t, i) => {
                    const taskPosition = getTaskPosition(t.id, project.id);
                    return (
                      <React.Fragment key={t.id}>
                        <div 
                          className={`task-bone ${t.type}`} 
                          data-task-id={t.id}
                          style={{ 
                            left: `${taskPosition}%`,
                            transform: dragState.draggedTask === t.id ? 'scale(1.08)' : undefined,
                            transition: dragState.draggedTask === t.id ? 'none' : 'all 0.3s ease',
                            zIndex: dragState.draggedTask === t.id ? 20 : undefined
                          }} 
                          onClick={(e) => handleTaskClick(t.id, e)}
                          onDoubleClick={(e) => handleTaskClick(t.id, e)}
                          onMouseDown={(e) => handleMouseDown(e, t, project.id)}
                        >
                          {/* 连接线现在在卡片内部 */}
                          <div className={`bone-connector ${t.type}`} />
                          
                          <div className="task-title">{t.title}</div>
                          <div className="task-meta">
                            <span className={`status-tag status-${(t.status || 'pending').toLowerCase()}`}>{t.status}</span>
                            {t.eta && <span className="eta-tag">ETA: {t.eta}</span>}
                          </div>
                          {t.platforms && (
                            <div className="platforms">
                              {Object.entries(t.platforms).map(([name, p]) => (
                                <div key={name} className={`platform-dot ${(p?.status || 'pending').toLowerCase()}`} title={`${name.toUpperCase()}: ${p?.status}${p?.assignee ? ' - ' + p.assignee : ''}${p?.jira ? ' (' + p.jira + ')' : ''}`} />
                              ))}
                            </div>
                          )}
                          <div className="drag-indicator">⋮⋮</div>
                        </div>
                      </React.Fragment>
                    );
                  })}
          </div>
              </div>
            );
          })}
        </div>
      </div>

      {createModalOpen && (
        <div className="zoom-overlay active" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('zoom-overlay')) setCreateModalOpen(false); }}>
          <div className="zoom-content" style={{ width: 720 }}>
            <div className="zoom-header">
              <h2 className="zoom-title">新增项目</h2>
              <button className="close-btn" onClick={() => setCreateModalOpen(false)}>×</button>
                </div>
            <div className="zoom-body">
              <div className="detail-section">
                <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--primary)' }}>ℹ️</span>基本信息</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">项目名称</span>
                    <input className="edit-input" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="请输入项目名称" />
                  </div>
                  <div className="info-item">
                    <span className="info-label">项目描述</span>
                    <input className="edit-input" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="选填：简要描述" />
                  </div>
                </div>
              </div>
              
              <div className="detail-section">
                <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--info)' }}>🧠</span>项目建议</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">查找提示词</span>
                    <input className="edit-input" value={newProjectPrompt} onChange={e => setNewProjectPrompt(e.target.value)} placeholder="输入线索（如：某团队、某功能、关键词）" />
                    </div>
                  <div className="info-item" style={{ alignItems: 'flex-end' }}>
                    <button className="refresh-btn" onClick={handleSuggest} disabled={suggesting}>{suggesting ? '建议中...' : '刷新建议'}</button>
                    </div>
                      </div>
                {suggesting && (
                  <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
                    🤖 正在从向量数据库获取项目建议...
                  </div>
                )}
                {!!suggestions.length && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>💡 建议的项目名称（点击应用）：</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {suggestions.map(s => (
                        <button key={s} className="badge" onClick={() => setNewProjectName(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

              <div className="detail-section">
                <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--warning)' }}>🎯</span>关键里程碑</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {milestones.map((milestone, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 12, alignItems: 'center' }}>
                      <input 
                        className="edit-input" 
                        value={milestone.label} 
                        onChange={e => setMilestones(prev => prev.map((m, i) => i === index ? { ...m, label: e.target.value } : m))}
                        placeholder="里程碑名称" 
                      />
                      <input 
                        className="edit-input" 
                        type="date" 
                        value={milestone.date} 
                        onChange={e => setMilestones(prev => prev.map((m, i) => i === index ? { ...m, date: e.target.value } : m))}
                      />
              <button
                        className="delete-jira-btn" 
                        onClick={() => setMilestones(prev => prev.filter((_, i) => i !== index))}
                        disabled={milestones.length <= 1}
                      >
                        🗑️
              </button>
          </div>
                  ))}
          <button
                    className="refresh-btn" 
                    style={{ background: 'var(--success)', alignSelf: 'flex-start' }}
                    onClick={() => setMilestones(prev => [...prev, { label: '', date: '' }])}
          >
                    + 添加里程碑
          </button>
        </div>
      </div>

              <div className="detail-section">
                <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--success)' }}>🧩</span>平台配置</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(Object.keys(platformConfig) as PlatformKey[]).map(k => (
                    <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={platformConfig[k]} onChange={e => setPlatformConfig(prev => ({ ...prev, [k]: e.target.checked }))} /> {k.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="edit-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="save-btn" onClick={handleCreateProject} disabled={!newProjectName.trim()}>创建</button>
                <button className="cancel-btn" onClick={() => setCreateModalOpen(false)}>取消</button>
                    </div>
                    </div>
          </div>
                      </div>
                    )}

      {selectedTask && (
        <div className="zoom-overlay active" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('zoom-overlay')) closeDetail(); }}>
          <div className="zoom-content">
            <div className="zoom-header">
              <h2 className="zoom-title">{selectedTask.task.title}</h2>
              <button className="close-btn" onClick={closeDetail}>×</button>
                  </div>
            <div className="zoom-body">
              <div className="detail-section">
                <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--primary)' }}>ℹ️</span>基本信息</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">任务标题</span>
                    <input 
                      className="edit-input" 
                      value={selectedTask.task.title} 
                      onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { title: e.target.value })} 
                      placeholder="输入任务标题"
                    />
              </div>
                  <div className="info-item">
                    <span className="info-label">任务类型</span>
                    <select 
                      className="edit-select" 
                      value={selectedTask.task.type} 
                      onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { type: e.target.value })}
                    >
                      <option value="dep">依赖 (Dependency)</option>
                      <option value="task">任务 (Task)</option>
                      <option value="design">设计 (Design)</option>
                    </select>
            </div>
                  <div className="info-item">
                    <span className="info-label">当前状态</span>
                    <select className="edit-select" value={selectedTask.task.status} onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { status: e.target.value })}>
                      {selectedTask.task.type === 'dep' && (
                        <>
                          <option value="todo">待办</option>
                          <option value="progress">进行中</option>
                          <option value="testBuild">测试构建</option>
                          <option value="rollout">发布</option>
                          <option value="blocked">阻塞</option>
                        </>
                      )}
                      {selectedTask.task.type === 'design' && (
                        <>
                          <option value="todo">待办</option>
                          <option value="progress">进行中</option>
                          <option value="review">评审中</option>
                          <option value="done">完成</option>
                        </>
                      )}
                      {selectedTask.task.type === 'task' && (
                        <>
                          <option value="todo">待办</option>
                          <option value="progress">进行中</option>
                          <option value="testing">测试中</option>
                          <option value="closed">关闭</option>
                          <option value="rollout">发布</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预计完成时间</span>
                    <input className="edit-input" type="date" value={selectedTask.task.eta || ''} onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { eta: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <span className="info-label">任务描述</span>
                  <textarea 
                    className="edit-textarea" 
                    value={selectedTask.task.desc || ''} 
                    onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { desc: e.target.value })} 
                    placeholder="详细描述任务内容、目标和要求..."
                    rows={3}
                  />
                </div>
              </div>

              {selectedTask.task.platforms && (
                <div className="detail-section">
                  <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--info)' }}>📱</span>平台开发进展</h3>
                  <div className="platform-grid">
                    {Object.entries(selectedTask.task.platforms).map(([name, p]) => (
                      <div className="platform-item" key={name}>
                        <div className="platform-name">{name.toUpperCase()}</div>
                        <span className={`platform-status status-${(p?.status || 'pending').toLowerCase()}`}>{p?.status || 'pending'}</span>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          <div><strong>负责人:</strong> <input className="edit-input" value={p?.assignee || ''} onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { platforms: { ...selectedTask.task.platforms, [name]: { ...(p || {}), assignee: e.target.value } } })} /></div>
                          <div><strong>JIRA:</strong> <input className="edit-input" value={p?.jira || ''} onChange={e => updateTask(selectedTask.project.id, selectedTask.task.type, selectedTask.task.id, { platforms: { ...selectedTask.task.platforms, [name]: { ...(p || {}), jira: e.target.value } } })} /></div>
                    </div>
                      </div>
                    ))}
                  </div>
                      </div>
                    )}

              <div className="detail-section">
                <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--success)' }}>🎯</span>关联 JIRA <button className="add-jira-btn" onClick={() => addJira(selectedTask.project.id, selectedTask.task)}>➕</button></h3>
                <div className="jira-list">
                  {(selectedTask.task.jira || []).map((j, idx) => (
                    <div className="jira-item-editable" key={j.key + idx}>
                      <a href={jiraUrl(j.key)} className="jira-item" target="_blank" rel="noreferrer">
                        <span className="jira-icon">J</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{j.key}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{j.title}</div>
          </div>
                      </a>
                      <button className="delete-jira-btn" onClick={() => removeJira(selectedTask.project.id, selectedTask.task, idx)}>🗑️</button>
        </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加任务弹窗 */}
      {showAddTask && (
        <div className="zoom-overlay active" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('zoom-overlay')) setShowAddTask(null); }}>
          <div className="zoom-content" style={{ width: 500 }}>
            <div className="zoom-header">
              <h2 className="zoom-title">添加新任务</h2>
              <button className="close-btn" onClick={() => setShowAddTask(null)}>×</button>
            </div>
            <div className="zoom-body">
              <div className="detail-section">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">任务标题</span>
                    <input 
                      className="edit-input" 
                      value={newTaskTitle} 
                      onChange={e => setNewTaskTitle(e.target.value)} 
                      placeholder="输入任务标题"
                      autoFocus
                    />
                  </div>
                  <div className="info-item">
                    <span className="info-label">任务类型</span>
                    <select 
                      className="edit-select" 
                      value={newTaskType} 
                      onChange={e => setNewTaskType(e.target.value as 'dep'|'task'|'design')}
                    >
                      <option value="dep">依赖 (Dependency)</option>
                      <option value="task">任务 (Task)</option>
                      <option value="design">设计 (Design)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="save-btn" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                    创建任务
                  </button>
                  <button className="cancel-btn" onClick={() => setShowAddTask(null)}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        :root {
          --bg: #f8fafc;
          --card: #ffffff;
          --border: #e2e8f0;
          --text: #1e293b;
          --text-muted: #64748b;
          --primary: #3b82f6;
          --primary-light: #dbeafe;
          --success: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --info: #06b6d4;
          --purple: #8b5cf6;
          --dep-color: #ef4444;
          --epic-color: #1f2937;
          --design-color: #10b981;
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .project-dashboard.fishbone { background: var(--bg); min-height: 100vh; display: flex; flex-direction: column; }
        .container { max-width: 1200px; margin: 0 20px; flex: 1; }
        
        /* 完整的仪表盘头部样式 */
        .dashboard-header { background: white; border-radius: 12px; padding: 24px; margin: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
        .dashboard-title { margin: 0; color: #2c3e50; font-size: 2em; font-weight: 600; }
        .dashboard-subtitle { color: #7f8c8d; margin: 5px 0 0 0; font-size: 1em; }
        .dashboard-controls { display: flex; gap: 12px; align-items: center; }
        .control-button { background: #3498db; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.3s ease; display: flex; align-items: center; gap: 6px; }
        .control-button:hover { background: #2980b9; transform: translateY(-1px); }
        .control-button:disabled { background: #bdc3c7; transform: none; cursor: not-allowed; }
        .control-button.secondary { background: #95a5a6; }
        .control-button.secondary:hover:not(:disabled) { background: #7f8c8d; }
        .control-button.success { background: #27ae60; }
        .control-button.success:hover:not(:disabled) { background: #229954; }
        .control-button.primary { background: #3498db; }
        .project-actions { display: flex; align-items: center; gap: 12px; }
        .last-refresh { font-size: 12px; color: var(--text-muted); }
        .notification-area { position: fixed; top: 16px; right: 16px; z-index: 1000; max-width: 400px; pointer-events: none; }
        .refresh-btn { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: var(--primary-light); color: var(--primary); border: none; cursor: pointer; }

        .project-list { display: flex; flex-direction: column; gap: 30px; }
        .project-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 30px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .project-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .project-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--text); }

        .fishbone-container { position: relative; height: 200px; margin: 20px 0; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 20px; border: 2px solid var(--border); cursor: crosshair; }
        .timeline-spine { position: absolute; left: 40px; right: 40px; top: 50%; height: 4px; background: linear-gradient(90deg, var(--design-color), var(--primary), var(--dep-color)); border-radius: 2px; transform: translateY(-50%); }
        .timeline-arrow { position: absolute; right: 35px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 12px solid var(--dep-color); border-top: 8px solid transparent; border-bottom: 8px solid transparent; }

        .milestone { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; border-radius: 50%; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: white; z-index: 10; }
        .milestone.beta { background: var(--success); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2); }
        .milestone.ga { background: var(--primary); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2); }
        .milestone:hover { transform: translate(-50%, -50%) scale(1.3); box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3); }
        .milestone-label { position: absolute; top: -35px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; }
        .milestone-date { position: absolute; bottom: -35px; left: 50%; transform: translateX(-50%); font-size: 11px; color: var(--text-muted); white-space: nowrap; }

        /* 连接线现在在task-bone内部 */
        .bone-connector { 
          position: absolute; 
          background: currentColor; 
          z-index: 1; 
          pointer-events: none;
        }
        .bone-connector.dep { 
          color: var(--dep-color);
          width: 105px;
          height: 2px;
          bottom: -45px; 
          right: -27px;
          transform: rotate(75deg);
          transform-origin: right center;
        }
        .bone-connector.task { 
          color: var(--epic-color);
          width: 112px;
          height: 2px;
          top: -40px; 
          right: -30px;
          transform: rotate(-75deg);
          transform-origin: right center;
        }
        .bone-connector.design { 
          color: var(--design-color);
          width: 105px;
          height: 2px;
          bottom: -45px; 
          right: -27px;
          transform: rotate(75deg);
          transform-origin: right center;
        }

        .task-bone { 
          position: absolute; 
          background: var(--card); 
          border: 2px solid; 
          border-radius: 12px; 
          padding: 12px 16px; 
          min-width: 180px; 
          cursor: grab; 
          transition: transform 0.2s ease, box-shadow 0.2s ease; 
          box-shadow: var(--shadow); 
          z-index: 5; 
          user-select: none;
        }
        .task-bone.dep { border-color: var(--dep-color); top: 10px; }
        .task-bone.task { border-color: var(--epic-color); bottom: 2px; }
        .task-bone.design { border-color: var(--design-color); top: 10px; }
        .task-bone:hover { 
          transform: scale(1.05); 
          box-shadow: var(--shadow-lg); 
          z-index: 15; 
        }
        
        /* 拖拽样式 */
        .task-bone.dragging {
          cursor: grabbing;
          transform: scale(1.08);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.1);
          z-index: 20;
          transition: none;
          filter: brightness(1.05);
        }
        
        /* 弹窗激活时降低拖拽卡片的z-index */
        body.modal-open .task-bone {
          z-index: 1 !important;
        }
        
        body.modal-open .task-bone.dragging {
          z-index: 2 !important;
        }
        
        /* 悬停时的渐变背景效果 */
        .task-bone::before {
          content: '';
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          background: linear-gradient(135deg, var(--primary), var(--success), var(--warning));
          border-radius: 16px;
          opacity: 0;
          z-index: -1;
          transition: opacity 0.3s ease;
        }
        
        .task-bone:hover::before {
          opacity: 0.1;
        }
        
        .task-bone.dragging::before {
          opacity: 0.2;
        }
        .task-title { font-size: 14px; font-weight: 600; margin: 0 0 6px; color: var(--text); }
        .task-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .status-tag { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; color: white; text-transform: lowercase; }
        .status-progress { background: var(--info); }
        .status-review { background: var(--purple); }
        .status-done { background: var(--success); }
        .status-blocked { background: var(--danger); }
        .status-pending { background: var(--text-muted); }
        .eta-tag { font-size: 10px; color: var(--text-muted); }
        .platforms { display: flex; gap: 3px; margin-top: 6px; }
        .platform-dot { width: 8px; height: 8px; border-radius: 50%; }
        .platform-dot.done { background: var(--success); }
        .platform-dot.progress { background: var(--info); }
        .platform-dot.pending { background: var(--text-muted); }

        .zoom-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 1000; display: none; opacity: 0; transition: opacity 0.4s ease; }
        .zoom-overlay.active { display: flex; opacity: 1; }
        .zoom-content { position: relative; margin: auto; background: var(--card); border-radius: 20px; max-width: 95vw; width: 1000px; max-height: 90vh; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.4s ease; }
        .zoom-overlay.active .zoom-content { transform: scale(1); }
        .zoom-header { padding: 24px 30px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .zoom-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--text); }
        .close-btn { width: 36px; height: 36px; border: none; background: var(--border); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--text-muted); transition: all 0.2s ease; }
        .close-btn:hover { background: var(--danger); color: white; }
        .zoom-body { padding: 30px; max-height: 70vh; overflow-y: auto; }
        .detail-section { margin-bottom: 24px; padding: 20px; background: var(--bg); border-radius: 12px; border: 1px solid var(--border); }
        .section-title { font-size: 16px; font-weight: 600; margin: 0 0 16px; color: var(--text); display: flex; align-items: center; gap: 8px; }
        .section-icon { width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .info-item { display: flex; flex-direction: column; gap: 4px; }
        .info-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
        .edit-input, .edit-select, .edit-textarea { padding: 8px 12px; border: 2px solid var(--primary); border-radius: 6px; font-size: 14px; background: var(--card); color: var(--text); min-width: 150px; }
        .edit-textarea { min-height: 80px; resize: vertical; }
        .jira-list { display: flex; flex-direction: column; gap: 8px; }
        .jira-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text); transition: all .2s ease; }
        .jira-item:hover { border-color: var(--primary); background: var(--primary-light); }
        .jira-item-editable { display: flex; align-items: center; gap: 8px; }
        .jira-icon { width: 24px; height: 24px; background: var(--primary); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
        .delete-jira-btn, .add-jira-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; color: var(--text-muted); }
        .add-jira-btn { margin-left: auto; background: var(--success); color: white; border-color: var(--success); }
        .delete-jira-btn:hover { background: var(--danger); color: white; border-color: var(--danger); }
        
        /* 新增样式 */
        .add-task-hint { position: absolute; top: 8px; right: 8px; font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,0.8); padding: 4px 8px; border-radius: 12px; pointer-events: none; opacity: 0.7; }
        .drag-indicator { position: absolute; top: 4px; right: 4px; font-size: 8px; color: var(--text-muted); opacity: 0.5; }
        .task-bone:hover .drag-indicator { opacity: 1; }
        .save-btn, .cancel-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .save-btn { background: var(--success); color: white; }
        .save-btn:hover:not(:disabled) { background: #0ea55c; }
        .save-btn:disabled { background: var(--text-muted); cursor: not-allowed; }
        .cancel-btn { background: var(--border); color: var(--text); }
        .cancel-btn:hover { background: var(--text-muted); color: white; }

        @media (max-width: 768px) {
          .container { padding: 15px; }
          .project-card { padding: 20px; }
          .fishbone-container { height: 160px; padding: 15px; }
          .task-bone { min-width: 140px; padding: 8px 12px; }
          .zoom-content { margin: 20px; max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); }
          .dashboard-header { flex-direction: column; gap: 16px; text-align: center; margin: 10px; }
          .dashboard-controls { flex-wrap: wrap; justify-content: center; }
          .dashboard-title { font-size: 1.5em; }
        }
      `}</style>
    </div>
  );
};

export default ProjectDashboard;