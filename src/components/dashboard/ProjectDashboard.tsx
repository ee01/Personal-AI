import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMilestoneClassToken,
  buildMilestoneMarkerText,
  buildProjectFocusSummary,
  buildProjectHealthSummary,
  buildProjectStatusEvidenceItems,
  buildProjectStatusUpdateDraft,
  compareProjectsByDashboardPriority,
  parseProjectDashboardLaunchContext,
  projectMatchesDashboardLaunchContext,
  type ProjectDashboardLaunchContext,
  type ProjectSyncReadiness,
  type ProjectStatusEvidenceItem,
} from '../../utils/dashboardIntegration';
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
  anchorPosition?: number;
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

type AddTaskState = {
  projectId: string;
  position: number;
  milestoneLabel?: string;
  milestoneDate?: string;
};

type TaskAttention = {
  task: FishboneTask;
  level: 'blocked' | 'overdue' | 'due-soon';
  label: string;
  detail: string;
};

const clampPercent = (value: number, min = 10, max = 90) => {
  if (!Number.isFinite(value)) return 50;
  return Math.max(min, Math.min(max, value));
};

const buildTaskPositionKey = (projectId: string, taskId: string) => `${projectId}::${taskId}`;

const normalizeStatusToken = (status: string | undefined) =>
  String(status || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const buildStatusClassToken = (status: string | undefined) => normalizeStatusToken(status) || 'unknown';

const isCompletedTask = (task: FishboneTask) => {
  const token = normalizeStatusToken(task.status);
  return token === 'done' || token === 'closed' || token === 'complete' || token === 'completed';
};

const parseDateOnly = (date: string | undefined): Date | null => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDaysUntil = (date: string | undefined, now = new Date()): number | null => {
  const parsed = parseDateOnly(date);
  if (!parsed) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

const buildProjectAttentionTasks = (project: FishboneProject, now = new Date()): TaskAttention[] => {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];

  return tasks
    .map((task): TaskAttention | null => {
      if (normalizeStatusToken(task.status).includes('blocked')) {
        return {
          task,
          level: 'blocked',
          label: '阻塞',
          detail: task.eta ? `ETA ${task.eta}` : '需要明确处理人',
        };
      }

      if (isCompletedTask(task)) return null;

      const days = getDaysUntil(task.eta, now);
      if (days === null) return null;

      if (days < 0) {
        return {
          task,
          level: 'overdue',
          label: '过期',
          detail: `已超 ${Math.abs(days)} 天`,
        };
      }

      if (days <= 7) {
        return {
          task,
          level: 'due-soon',
          label: '近 7 天',
          detail: days === 0 ? '今天到期' : `${days} 天后到期`,
        };
      }

      return null;
    })
    .filter((item): item is TaskAttention => Boolean(item))
    .sort((a, b) => {
      const levelWeight = { blocked: 0, overdue: 1, 'due-soon': 2 };
      const levelDelta = levelWeight[a.level] - levelWeight[b.level];
      if (levelDelta !== 0) return levelDelta;
      return (a.task.eta || '').localeCompare(b.task.eta || '');
    })
    .slice(0, 4);
};

const ProjectDashboard: React.FC = () => {
  const launchContext = useMemo<ProjectDashboardLaunchContext>(
    () => parseProjectDashboardLaunchContext(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );
  const [projects, setProjects] = useState<FishboneProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [env, setEnv] = useState<EnvConfigType | null>(null);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusDraftPreview, setStatusDraftPreview] = useState<{
    project: FishboneProject;
    draft: string;
    generatedDraft: string;
    evidence: ProjectStatusEvidenceItem[];
    lastGeneratedAt: Date;
  } | null>(null);
  const [syncReadiness, setSyncReadiness] = useState<ProjectSyncReadiness | null>(null);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
  const [detailTaskRef, setDetailTaskRef] = useState<{ projectId: string; taskId: string } | null>(null);
  
  // 任务添加功能
  const [showAddTask, setShowAddTask] = useState<AddTaskState | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'dep'|'task'|'design'>('task');
  const [newTaskEta, setNewTaskEta] = useState('');
  
  // 拖拽功能状态
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    draggedTask: string | null;
    projectId: string | null;
    startX: number;
    startY: number;
    startPosition: number;
    containerWidth: number;
    mouseDownTime: number;
  }>({ isDragging: false, draggedTask: null, projectId: null, startX: 0, startY: 0, startPosition: 0, containerWidth: 0, mouseDownTime: 0 });
  
  const [taskPositions, setTaskPositions] = useState<Record<string, number>>({});
  const dragAnchorRef = useRef<number | null>(null);
  const dragStartedRef = useRef(false);

  const selectedTask = useMemo(() => {
    if (!detailTaskRef) return null;
    const project = projects.find(p => p.id === detailTaskRef.projectId);
    const task = project?.tasks.find(t => t.id === detailTaskRef.taskId);
    if (project && task) return { project, task };
    return null;
  }, [projects, detailTaskRef]);

  const launchContextProject = useMemo(
    () => projects.find(project => projectMatchesDashboardLaunchContext(project, launchContext)) || null,
    [projects, launchContext],
  );

  const dashboardNow = useMemo(() => lastRefresh, [lastRefresh]);

  const dashboardStats = useMemo(() => projects.reduce(
    (acc, project) => {
      const health = buildProjectHealthSummary(project, dashboardNow);
      acc.totalProjects += 1;
      acc.totalTasks += health.totalTasks;
      acc.completedTasks += health.completedTasks;
      acc.blockedTasks += health.blockedTasks;
      acc.overdueTasks += health.overdueTasks;
      acc.dueSoonTasks += health.dueSoonTasks;
      if (health.state === 'off-track') acc.offTrackProjects += 1;
      if (health.state === 'at-risk') acc.atRiskProjects += 1;
      return acc;
    },
    {
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      blockedTasks: 0,
      overdueTasks: 0,
      dueSoonTasks: 0,
      offTrackProjects: 0,
      atRiskProjects: 0,
    },
  ), [projects, dashboardNow]);

  const focusSummary = useMemo(
    () => buildProjectFocusSummary(projects, { now: dashboardNow, maxItems: 8 }),
    [projects, dashboardNow],
  );
  const focusItems = focusSummary.visibleItems;

  const prioritizedProjects = useMemo(
    () => [...projects].sort((a, b) => {
      const aMatchesLaunchContext = projectMatchesDashboardLaunchContext(a, launchContext);
      const bMatchesLaunchContext = projectMatchesDashboardLaunchContext(b, launchContext);

      if (aMatchesLaunchContext !== bMatchesLaunchContext) {
        return aMatchesLaunchContext ? -1 : 1;
      }

      return compareProjectsByDashboardPriority(a, b, dashboardNow);
    }),
    [projects, dashboardNow, launchContext],
  );

  useEffect(() => {
    getEnvConfig().then(setEnv).catch(() => setEnv(null));
  }, []);

  const showActionStatus = (type: 'success' | 'error', text: string) => {
    setActionStatus({ type, text });
  };

  const downloadTextFile = (fileName: string, mimeType: string, content: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall back to the legacy copy path below when browser permission blocks Clipboard API.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('复制到剪贴板失败');
    }
  };

  const loadProjects = async (options?: { silent?: boolean }) => {
    const showLoadingState = !options?.silent;
    if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_PROJECT_DATA' });
      if (res?.success) {
        setProjects(res.projects || []);
        setLastRefresh(new Date());
      } else if (!options?.silent) {
        throw new Error(res?.error || '刷新项目数据失败');
      }
    } catch (error) {
      if (!options?.silent) {
        showActionStatus('error', error instanceof Error ? error.message : '刷新项目数据失败');
      }
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadProjects();
    const timer = setInterval(() => loadProjects({ silent: true }), 30000);
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

  const openDetail = (projectId: string, taskId: string) => setDetailTaskRef({ projectId, taskId });
  const closeDetail = () => setDetailTaskRef(null);

  const updateTask = async (projectId: string, itemType: 'dep'|'task'|'design', taskId: string, changes: any) => {
    // 乐观更新
    setProjects(prev => prev.map(p => p.id !== projectId ? p : ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...changes } : t)
    })));
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_PROJECT_ITEM', projectId, itemType, itemId: taskId, changes,
        userContext: { timestamp: Date.now(), source: 'dashboard_edit' }
      });
      if (!response?.success) {
        throw new Error(response?.error || '保存任务失败');
      }
    } catch (error) {
      showActionStatus('error', error instanceof Error ? error.message : '保存任务失败');
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
      const response = await chrome.runtime.sendMessage({
        type: 'SUGGEST_PROJECTS',
        question: newProjectPrompt.trim() || '建议项目',
      });

      if (!response?.success) {
        throw new Error(response?.error || '获取项目建议失败');
      }

      setSuggestions(Array.isArray(response.suggestions) ? response.suggestions : []);
    } catch (error) {
      console.error('获取项目建议失败:', error);
      setSuggestions([]);
      showActionStatus('error', error instanceof Error ? error.message : '获取项目建议失败');
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

  const handleOpenLaunchProjectCreateModal = () => {
    if (!launchContext.hasContext) return;

    const name = launchContext.projectName || launchContext.projectId || '';
    setNewProjectName(name);
    setNewProjectDesc('');
    setNewProjectPrompt(name);
    setSuggestions([]);
    setCreateModalOpen(true);
  };

  const handleCreateProject = async () => {
    const platformList = (Object.keys(platformConfig) as PlatformKey[]).filter(k => platformConfig[k]);
    const milestoneList = milestones.filter(m => m.label.trim()).map(m => ({
      id: `milestone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: m.label.trim(),
      date: m.date || undefined
    }));
    
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_PROJECT',
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        platformConfig: platformList,
        milestones: milestoneList,
        prompt: newProjectPrompt.trim()
      });
      if (!res?.success) {
        throw new Error(res?.error || '创建项目失败');
      }

      setCreateModalOpen(false);
      setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setSuggestions([]);
      setPlatformConfig({ sdk: true, ios: true, android: true, qa: true, dev: false });
      setMilestones([
        { label: 'Alpha', date: '' },
        { label: 'Beta', date: '' },
        { label: 'GA', date: '' }
      ]);
      showActionStatus('success', `项目 ${res.project?.name || newProjectName.trim()} 已创建`);
      await loadProjects({ silent: true });
    } catch (error) {
      showActionStatus('error', error instanceof Error ? error.message : '创建项目失败');
    }
  };

  const jiraUrl = (key: string) => {
    const base = env?.JIRA_BASE_URL || 'https://jira.example.com';
    return `${base}/browse/${encodeURIComponent(key)}`;
  };

  // 同步数据
  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action: 'sync_data',
        data: { projectId: 'all' }
      });

      if (!response?.success) {
        throw new Error(response?.error || '同步失败');
      }

      if (response.result) {
        setSyncReadiness(response.result as ProjectSyncReadiness);
        setSyncPanelOpen(true);
      }

      showActionStatus('success', response.result?.summary || '数据源状态已检查');
      await loadProjects({ silent: true });
    } catch (error) {
      console.error('同步数据失败:', error);
      showActionStatus('error', error instanceof Error ? error.message : '同步数据失败');
    } finally {
      setIsSyncing(false);
    }
  };

  // 导出报告
  const handleExportReport = async (projectId = 'all') => {
    setIsExporting(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action: 'export_report',
        data: { projectId }
      });

      if (!response?.success) {
        throw new Error(response?.error || '导出失败');
      }

      const result = response.result;
      if (!result?.success || !result?.serializedData || !result?.fileName) {
        throw new Error(result?.error || '导出结果不完整');
      }

      downloadTextFile(
        result.fileName,
        result.mimeType || 'application/json;charset=utf-8',
        result.serializedData,
      );
      showActionStatus('success', projectId === 'all' ? '全部项目报告已导出' : `项目 ${projectId} 报告已导出`);
    } catch (error) {
      console.error('导出报告失败:', error);
      showActionStatus('error', error instanceof Error ? error.message : '导出报告失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenStatusDraftPreview = (project: FishboneProject) => {
    const generatedDraft = buildProjectStatusUpdateDraft(project, { now: dashboardNow });
    setStatusDraftPreview({
      project,
      draft: generatedDraft,
      generatedDraft,
      evidence: buildProjectStatusEvidenceItems(project, { now: dashboardNow, maxAttentionTasks: 8 }),
      lastGeneratedAt: new Date(),
    });
  };

  const handleResetStatusDraft = () => {
    setStatusDraftPreview(prev => {
      if (!prev) return prev;

      const generatedDraft = buildProjectStatusUpdateDraft(prev.project, { now: dashboardNow });
      return {
        ...prev,
        draft: generatedDraft,
        generatedDraft,
        evidence: buildProjectStatusEvidenceItems(prev.project, { now: dashboardNow, maxAttentionTasks: 8 }),
        lastGeneratedAt: new Date(),
      };
    });
  };

  const handleCopyStatusDraft = async (project: FishboneProject, draft?: string) => {
    try {
      await copyTextToClipboard(draft || buildProjectStatusUpdateDraft(project, { now: dashboardNow }));
      showActionStatus('success', `项目 ${project.name} 状态更新草稿已复制`);
    } catch (error) {
      console.error('复制状态草稿失败:', error);
      showActionStatus('error', error instanceof Error ? error.message : '复制状态草稿失败');
    }
  };

  const handleOpenImportReport = () => {
    if (isImporting) return;
    importInputRef.current?.click();
  };

  const handleImportReport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setIsImporting(true);
      try {
        const reportContent = typeof reader.result === 'string' ? reader.result : '';
        if (!reportContent) {
          throw new Error('导入文件内容为空');
        }

        const replaceExisting = window.confirm(
          '是否用导入内容替换当前项目列表？\n选择“确定”会替换当前项目；选择“取消”会合并导入并保留现有项目。',
        );

        const response = await chrome.runtime.sendMessage({
          type: 'IMPORT_PROJECT_REPORT',
          reportContent,
          mode: replaceExisting ? 'replace' : 'merge',
        });

        if (!response?.success) {
          throw new Error(response?.error || '导入失败');
        }

        await loadProjects();

        const stats = response.stats;
        const summary = stats
          ? `导入 ${stats.importedProjectCount} 个项目，新增 ${stats.createdProjectCount}，更新 ${stats.updatedProjectCount}，保留 ${stats.retainedProjectCount}，移除 ${stats.removedProjectCount}`
          : '项目报告导入完成';
        showActionStatus('success', summary);
      } catch (error) {
        console.error('导入项目报告失败:', error);
        showActionStatus('error', error instanceof Error ? error.message : '导入项目报告失败');
      } finally {
        setIsImporting(false);
        input.value = '';
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      input.value = '';
      showActionStatus('error', '读取导入文件失败');
    };

    reader.readAsText(file);
  };

  // 添加新任务
  const handleAddTask = async () => {
    if (!showAddTask || !newTaskTitle.trim()) return;
    
    const newTask: FishboneTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: newTaskType,
      title: newTaskTitle.trim(),
      status: 'todo',
      eta: newTaskEta,
      desc: '',
      anchorPosition: showAddTask.position,
    };

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_PROJECT_ITEM',
        projectId: showAddTask.projectId,
        itemType: 'task',
        itemData: newTask
      });

      if (!res?.success) {
        throw new Error(res?.error || '创建任务失败');
      }
      setShowAddTask(null);
      setNewTaskTitle('');
      setNewTaskType('task');
      setNewTaskEta('');
      showActionStatus('success', `任务 ${newTask.title} 已创建`);
      await loadProjects({ silent: true });
    } catch (error) {
      showActionStatus('error', error instanceof Error ? error.message : '创建任务失败');
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
    const anchorPosition = clampPercent((relativeX / availableWidth) * 80 + 10);
    
    // 根据锚点位置自动选择对应的milestone阶段
    const project = projects.find(p => p.id === projectId);
    let selectedMilestone: MilestonePoint | null = null;
    if (project?.milestones?.length) {
      // 找到最接近的milestone
      let closestMilestone: MilestonePoint = project.milestones[0];
      let minDistance = Math.abs(computeLeftPercent(0, project.milestones.length) - anchorPosition);
      
      project.milestones.forEach((milestone, index) => {
        const milestonePosition = computeLeftPercent(index, project.milestones.length);
        const distance = Math.abs(milestonePosition - anchorPosition);
        if (distance < minDistance) {
          minDistance = distance;
          closestMilestone = milestone;
        }
      });
      selectedMilestone = closestMilestone;
    }
    
    setNewTaskEta(selectedMilestone?.date || '');
    setShowAddTask({
      projectId,
      position: Math.round(anchorPosition),
      milestoneLabel: selectedMilestone?.label,
      milestoneDate: selectedMilestone?.date,
    });
  };

  // 任务拖拽完成处理（旧版本，保留兼容性）
  const _handleTaskDragEnd = async (task: FishboneTask, projectId: string, e: React.DragEvent) => {
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
      projectId,
      startX: e.clientX,
      startY: e.clientY,
      startPosition: anchorPixelPosition, // 存储锚点位置
      containerWidth: availableWidth,
      mouseDownTime: Date.now()
    });
    dragAnchorRef.current = currentAnchorPercent;
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
        dragStartedRef.current = true;
        
        setDragState(prev => ({
          ...prev,
          isDragging: true
        }));
      } else {
        return;
      }
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
    const projectId = dragState.projectId;
    if (projectId) {
      newAnchorPercent = getSnapPosition(newAnchorPercent, projectId);
    }
    
    // 更新锚点位置（taskPositions现在存储的是锚点位置）
    const positionKey = buildTaskPositionKey(projectId || '', dragState.draggedTask);
    dragAnchorRef.current = newAnchorPercent;
    setTaskPositions(prev => ({
      ...prev,
      [positionKey]: newAnchorPercent
    }));
  };
  
  const handleMouseUp = () => {
    if (!dragState.draggedTask) return;
    
    if (dragState.isDragging || dragStartedRef.current) {
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

      const project = projects.find(p => p.id === dragState.projectId);
      const task = project?.tasks.find(t => t.id === dragState.draggedTask);
      const anchorPosition = dragAnchorRef.current;
      if (project && task && typeof anchorPosition === 'number') {
        void updateTask(project.id, task.type, task.id, {
          anchorPosition: Math.round(clampPercent(anchorPosition, 2, 98) * 10) / 10,
        });
      }
    }
    
    // 重置拖拽状态
    setDragState({ 
      isDragging: false, 
      draggedTask: null, 
      projectId: null,
      startX: 0, 
      startY: 0,
      startPosition: 0, 
      containerWidth: 0,
      mouseDownTime: 0 
    });
    dragAnchorRef.current = null;
    dragStartedRef.current = false;
  };
  
  // 获取不同类型任务的锚点偏移量（相对于卡片左边）- 预留扩展用
  const _getConnectorAnchorOffset = (taskType: 'dep' | 'task' | 'design') => {
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
    const positionKey = buildTaskPositionKey(projectId, taskId);
    if (Object.prototype.hasOwnProperty.call(taskPositions, positionKey)) {
      return taskPositions[positionKey];
    }
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return 50;

    const task = project.tasks.find(t => t.id === taskId);
    if (task && typeof task.anchorPosition === 'number' && Number.isFinite(task.anchorPosition)) {
      return clampPercent(task.anchorPosition, 2, 98);
    }
    
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
  const handleTaskClick = (projectId: string, taskId: string, e: React.MouseEvent) => {
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
    
    openDetail(projectId, taskId);
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
            project.tasks.forEach((task, _index) => {
              const positionKey = buildTaskPositionKey(project.id, task.id);
              if (Object.prototype.hasOwnProperty.call(prev, positionKey)) {
                // 如果已有自定义锚点位置，保持不变
                newPositions[positionKey] = prev[positionKey];
              } else {
                // 使用默认的均匀分布锚点位置
                const tasks = [...project.tasks].sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
                const taskIndex = tasks.findIndex(t => t.id === task.id);
                newPositions[positionKey] = computeLeftPercent(taskIndex, tasks.length);
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

  // 计算任务应该在上方还是下方（动态交替排列）
  const getTaskVerticalPosition = (taskId: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return 'top';
    
    // 按照ETA排序，如果没有ETA则按ID排序
    const sortedTasks = [...project.tasks].sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
    const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
    
    // 奇数索引在上方，偶数索引在下方（或者反过来）
    return taskIndex % 2 === 0 ? 'top' : 'bottom';
  };

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
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportReport}
      />
      
      {/* 完整的仪表盘头部 */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">📊 项目进度仪表盘</h1>
          <p className="dashboard-subtitle">智能项目管理与团队协作可视化</p>
          {actionStatus && (
            <div className={`dashboard-status ${actionStatus.type}`}>{actionStatus.text}</div>
          )}
        </div>
        <div className="dashboard-controls">
          <span className="last-refresh">最后更新: {lastRefresh.toLocaleTimeString()}</span>
          <button 
            className="control-button" 
            disabled={isLoading}
            onClick={() => loadProjects()}
          >
            🔄 {isLoading ? '刷新中...' : '刷新数据'}
          </button>
          <button className="control-button secondary" onClick={handleSyncData} disabled={isSyncing}>
            ⚡ {isSyncing ? '检查中...' : '检查数据源'}
          </button>
          <button className="control-button warning" onClick={handleOpenImportReport} disabled={isImporting}>
            📥 {isImporting ? '导入中...' : '导入报告'}
          </button>
          <button className="control-button success" onClick={() => handleExportReport('all')} disabled={isExporting}>
            📄 {isExporting ? '导出中...' : '导出全部'}
          </button>
          <button className="control-button primary" onClick={handleOpenCreateModal}>
            ➕ 新增项目
          </button>
        </div>
      </div>

      <div className="data-source-banner" role="status" aria-live="polite">
        <div className="data-source-copy">
          <span className="data-source-pill">本地工作台</span>
          <div>
            <strong>当前显示的是本地项目数据</strong>
            <span>Jira、GitHub、Confluence 自动同步尚未接入；健康状态基于本地任务、ETA 和阻塞状态计算。</span>
          </div>
        </div>
        <button className="data-source-action" type="button" onClick={handleSyncData} disabled={isSyncing}>
          {isSyncing ? '检查中...' : '检查数据源'}
        </button>
      </div>

      {launchContext.hasContext && (
        <div className={`launch-context-panel ${launchContextProject ? 'found' : 'missing'}`} role="status" aria-live="polite">
          <div className="launch-context-copy">
            <span className="launch-context-pill">来自实体记忆</span>
            <div>
              <strong>
                {launchContextProject
                  ? `已定位到 ${launchContextProject.name}`
                  : `未找到 ${launchContext.projectName || launchContext.projectId} 的本地工作台`}
              </strong>
              <span>
                {launchContextProject
                  ? '该项目已置顶显示，继续查看健康摘要、今日焦点和鱼骨时间线。'
                  : '实体记忆项目和本地仪表盘仍需绑定；可以先用该项目名创建本地工作台。'}
              </span>
            </div>
          </div>
          {!launchContextProject && (
            <button className="launch-context-action" type="button" onClick={handleOpenLaunchProjectCreateModal}>
              用此项目创建工作台
            </button>
          )}
        </div>
      )}

      {syncPanelOpen && syncReadiness && (
        <div className="data-source-panel" role="region" aria-label="数据源检查结果">
          <div className="data-source-panel-header">
            <div>
              <strong>数据源检查结果</strong>
              <span>
                {syncReadiness.summary}
                {syncReadiness.checkedAt ? ` · ${new Date(syncReadiness.checkedAt).toLocaleTimeString()}` : ''}
              </span>
            </div>
            <button className="data-source-close" type="button" onClick={() => setSyncPanelOpen(false)}>
              收起
            </button>
          </div>
          <div className="data-source-grid">
            {syncReadiness.sources.map(source => (
              <div className={`data-source-card ${source.status}`} key={source.source}>
                <div className="data-source-card-top">
                  <strong>{source.label}</strong>
                  <span>{source.configured ? '已配置' : '未配置'}</span>
                </div>
                <p>{source.detail}</p>
                <div className="data-source-next">{source.nextStep}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="dashboard-overview">
          <div className="overview-summary">
            <div>
              <div className="overview-eyebrow">今日焦点</div>
              <h2 className="overview-title">
                {focusSummary.totalItems
                  ? `${focusSummary.totalItems} 个优先处理项`
                  : '暂无阻塞、过期或 7 天内到期任务'}
              </h2>
            </div>
            <div className="overview-metrics">
              <span>{dashboardStats.totalProjects} 项目</span>
              <span>{dashboardStats.completedTasks}/{dashboardStats.totalTasks} 完成</span>
              <span>{dashboardStats.blockedTasks} 阻塞</span>
              <span>{dashboardStats.overdueTasks} 过期</span>
              <span>{dashboardStats.dueSoonTasks} 近 7 天</span>
              <span>{dashboardStats.offTrackProjects + dashboardStats.atRiskProjects} 需关注项目</span>
            </div>
          </div>
          <div className="focus-list" aria-label="跨项目优先处理任务">
            {focusItems.length === 0 ? (
              <div className="focus-empty">当前没有需要立即处理的任务；项目列表会按风险优先排序。</div>
            ) : (
              <>
                {focusItems.map(item => (
                  <button
                    key={`${item.projectId}-${item.task.id}`}
                    type="button"
                    className={`focus-item ${item.level}`}
                    onClick={() => openDetail(item.projectId, item.task.id)}
                    title={item.task.desc || item.task.title}
                  >
                    <span className="focus-label">{item.label}</span>
                    <span className="focus-main">
                      <strong>{item.task.title}</strong>
                      <span>{item.projectName}</span>
                    </span>
                    <span className="focus-detail">{item.detail}</span>
                  </button>
                ))}
                {focusSummary.hiddenItems > 0 && (
                  <div className="focus-overflow" aria-label={`还有 ${focusSummary.hiddenItems} 个优先处理项未在首屏展示`}>
                    还有 {focusSummary.hiddenItems} 个未展示，按刷新后的项目排序继续查看。
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="container">
        <div className="project-list">
          {projects.length === 0 && (
            <div className="empty-projects">
              <h2>暂无项目</h2>
              <p>新增项目后，这里会显示里程碑、任务健康状态和鱼骨时间线。</p>
              <button className="control-button primary" onClick={handleOpenCreateModal}>
                新增项目
              </button>
            </div>
          )}
          {prioritizedProjects.map(project => {
            const milestones = project.milestones || [];
            const tasks = [...(project.tasks || [])]
              .sort((a, b) => (a.eta || a.id).localeCompare(b.eta || b.id));
            const health = buildProjectHealthSummary(project, dashboardNow);
            const attentionTasks = buildProjectAttentionTasks(project, dashboardNow);
            return (
              <div
                className={`project-card ${projectMatchesDashboardLaunchContext(project, launchContext) ? 'launch-highlight' : ''}`}
                key={project.id}
              >
                <div className="project-header">
                  <div>
                    <h2 className="project-title">{project.name}</h2>
                    {project.description && <p style={{ margin: '5px 0 0', color: 'var(--text-muted)' }}>{project.description}</p>}
                  </div>
                  <div className="project-actions">
                    <button
                      className="badge"
                      type="button"
                      onClick={() => handleOpenStatusDraftPreview(project)}
                    >
                      预览状态草稿
                    </button>
                    <button
                      className="badge"
                      type="button"
                      onClick={() => handleExportReport(project.id)}
                      disabled={isExporting}
                    >
                      {isExporting ? '导出中...' : '导出当前项目'}
                    </button>
                  </div>
                </div>
                <div className={`project-health ${health.state}`}>
                  <div className="health-main">
                    <span className="health-badge">{health.label}</span>
                    <span className="health-headline">{health.headline}</span>
                  </div>
                  <div className="health-metrics">
                    <span>{health.completedTasks}/{health.totalTasks} 完成</span>
                    <span>{health.blockedTasks} 阻塞</span>
                    <span>{health.overdueTasks} 过期</span>
                    <span>{health.dueSoonTasks} 近 7 天</span>
                    {health.upcomingMilestone && (
                      <span>下个里程碑: {health.upcomingMilestone.label} · {health.upcomingMilestone.date}</span>
                    )}
                  </div>
                </div>
                {attentionTasks.length > 0 && (
                  <div className="project-alerts" aria-label={`${project.name} 需要关注的任务`}>
                    <div className="project-alerts-title">优先处理</div>
                    <div className="project-alerts-list">
                      {attentionTasks.map(item => (
                        <button
                          key={item.task.id}
                          type="button"
                          className={`project-alert ${item.level}`}
                          onClick={() => openDetail(project.id, item.task.id)}
                          title={item.task.desc || item.task.title}
                        >
                          <span className="project-alert-label">{item.label}</span>
                          <span className="project-alert-title">{item.task.title}</span>
                          <span className="project-alert-detail">{item.detail}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div
                  className="fishbone-container" 
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('.task-bone, .milestone, button, a, input, textarea, select')) return;
                    handleTimelineClick(project.id, e);
                  }}
                >
                  <div className="timeline-spine" />
                  <div className="timeline-arrow" />
                  
                  {/* 添加任务提示 */}
                  <div className="add-task-hint">💡 点击时间线空白处添加任务</div>

                  {milestones.map((m, i) => (
                    <div
                      key={m.id}
                      className={`milestone milestone-${buildMilestoneClassToken(m.label)}`}
                      style={{ left: `${computeLeftPercent(i, milestones.length)}%` }}
                      title={`${m.label}${m.date ? ` · ${m.date}` : ''}`}
                      aria-label={`${m.label}${m.date ? `，${m.date}` : ''}`}
                    >
                      <div className="milestone-label">{m.label}</div>
                      {m.date && <div className="milestone-date">{m.date}</div>}
                      <span className="milestone-marker-text">{buildMilestoneMarkerText(m.label, i)}</span>
                    </div>
                  ))}

                  {tasks.map((t, _i) => {
                    const taskPosition = getTaskPosition(t.id, project.id);
                    const verticalPosition = getTaskVerticalPosition(t.id, project.id);
                    return (
                      <React.Fragment key={t.id}>
                        <div 
                          className={`task-bone ${t.type} ${verticalPosition}`} 
                          data-task-id={t.id}
                          data-project-id={project.id}
                          style={{ 
                            left: `${taskPosition}%`,
                            transform: dragState.draggedTask === t.id ? 'scale(1.08)' : undefined,
                            transition: dragState.draggedTask === t.id ? 'none' : 'all 0.3s ease',
                            zIndex: dragState.draggedTask === t.id ? 20 : undefined
                          }} 
                          onClick={(e) => handleTaskClick(project.id, t.id, e)}
                          onDoubleClick={(e) => handleTaskClick(project.id, t.id, e)}
                          onMouseDown={(e) => handleMouseDown(e, t, project.id)}
                        >
                          {/* 连接线现在在卡片内部，支持动态位置 */}
                          <div className={`bone-connector ${t.type} ${verticalPosition}`} />
                          
                          <div className="task-title">{t.title}</div>
                          <div className="task-meta">
                            <span className={`status-tag status-${buildStatusClassToken(t.status)}`}>{t.status}</span>
                            {t.eta && <span className="eta-tag">ETA: {t.eta}</span>}
                          </div>
                          {t.platforms && (
                            <div className="platforms">
                              {Object.entries(t.platforms).map(([name, p]) => (
                                <div key={name} className={`platform-dot ${buildStatusClassToken(p?.status)}`} title={`${name.toUpperCase()}: ${p?.status}${p?.assignee ? ' - ' + p.assignee : ''}${p?.jira ? ' (' + p.jira + ')' : ''}`} />
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

      {statusDraftPreview && (
        <div className="zoom-overlay active" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('zoom-overlay')) setStatusDraftPreview(null); }}>
          <div className="zoom-content status-draft-modal">
            <div className="zoom-header">
              <h2 className="zoom-title">{statusDraftPreview.project.name} 状态更新草稿</h2>
              <button className="close-btn" onClick={() => setStatusDraftPreview(null)}>×</button>
            </div>
            <div className="zoom-body">
              <div className="status-draft-layout">
                <section className="status-draft-panel">
                  <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--info)' }}>E</span>证据来源</h3>
                  {statusDraftPreview.evidence.length === 0 ? (
                    <div className="status-evidence-empty">暂无可引用证据；请先补充任务 ETA、Jira 或平台状态。</div>
                  ) : (
                    <div className="status-evidence-list">
                      {statusDraftPreview.evidence.map((item, index) => (
                        <div className="status-evidence-item" key={`${item.type}-${item.taskId || 'project'}-${item.title}-${index}`}>
                          <span className={`status-evidence-label ${item.type}`}>{item.label}</span>
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.detail}</span>
                            <em>{item.source}</em>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="status-draft-panel">
                  <h3 className="section-title"><span className="section-icon" style={{ background: 'var(--success)' }}>T</span>可编辑草稿</h3>
                  <textarea
                    className="status-draft-textarea"
                    aria-label="可编辑状态更新草稿"
                    value={statusDraftPreview.draft}
                    onChange={e => setStatusDraftPreview(prev => prev ? { ...prev, draft: e.target.value } : prev)}
                  />
                  <div className="status-draft-meta">
                    <span>{statusDraftPreview.draft === statusDraftPreview.generatedDraft ? '未修改生成稿' : '已手动修改'}</span>
                    <span>{statusDraftPreview.evidence.length} 条证据</span>
                    <span>生成于 {statusDraftPreview.lastGeneratedAt.toLocaleTimeString()}</span>
                  </div>
                </section>
              </div>
              <div className="edit-actions status-draft-actions">
                <button
                  className="cancel-btn"
                  onClick={handleResetStatusDraft}
                  disabled={statusDraftPreview.draft === statusDraftPreview.generatedDraft}
                >
                  恢复生成稿
                </button>
                <button
                  className="save-btn"
                  onClick={() => handleCopyStatusDraft(statusDraftPreview.project, statusDraftPreview.draft)}
                >
                  复制审阅稿
                </button>
                <button className="cancel-btn" onClick={() => setStatusDraftPreview(null)}>
                  关闭
                </button>
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
                        <span className={`platform-status status-${buildStatusClassToken(p?.status)}`}>{p?.status || 'pending'}</span>
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
                    <span className="info-label">时间线位置</span>
                    <div className="timeline-context">
                      <strong>{showAddTask.position}%</strong>
                      {showAddTask.milestoneLabel && (
                        <span>
                          最近里程碑：{showAddTask.milestoneLabel}
                          {showAddTask.milestoneDate ? ` · ${showAddTask.milestoneDate}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
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
                  <div className="info-item">
                    <span className="info-label">预计完成时间</span>
                    <input
                      className="edit-input"
                      type="date"
                      value={newTaskEta}
                      onChange={e => setNewTaskEta(e.target.value)}
                    />
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
        .control-button.warning { background: #f39c12; }
        .control-button.warning:hover:not(:disabled) { background: #d68910; }
        .control-button.success { background: #27ae60; }
        .control-button.success:hover:not(:disabled) { background: #229954; }
        .control-button.primary { background: #3498db; }
        .project-actions { display: flex; align-items: center; gap: 12px; }
        .last-refresh { font-size: 12px; color: var(--text-muted); }
        .dashboard-status { margin-top: 10px; font-size: 13px; font-weight: 600; }
        .dashboard-status.success { color: #1f7a43; }
        .dashboard-status.error { color: #c0392b; }
        .notification-area { position: fixed; top: 16px; right: 16px; z-index: 1000; max-width: 400px; pointer-events: none; }
        .refresh-btn { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: var(--primary-light); color: var(--primary); border: none; cursor: pointer; }
        .badge:disabled { opacity: 0.6; cursor: not-allowed; }

        .data-source-banner { margin: 0 20px 16px; background: var(--card); border: 1px solid var(--border); border-left: 5px solid var(--info); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: var(--shadow); }
        .data-source-copy { min-width: 0; display: flex; align-items: center; gap: 12px; color: var(--text); }
        .data-source-copy strong { display: block; font-size: 13px; margin-bottom: 2px; }
        .data-source-copy span:last-child { display: block; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
        .data-source-pill { flex: 0 0 auto; border-radius: 999px; padding: 4px 9px; background: #ecfeff; border: 1px solid #a5f3fc; color: #0e7490; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .data-source-action { flex: 0 0 auto; padding: 7px 12px; border: 1px solid #a5f3fc; border-radius: 6px; background: #f0fdfa; color: #0f766e; cursor: pointer; font-size: 12px; font-weight: 700; }
        .data-source-action:hover:not(:disabled) { background: #ccfbf1; }
        .data-source-action:disabled { opacity: .65; cursor: not-allowed; }
        .data-source-panel { margin: 0 20px 20px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; box-shadow: var(--shadow); }
        .data-source-panel-header { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 12px; }
        .data-source-panel-header strong { display: block; color: var(--text); font-size: 14px; margin-bottom: 3px; }
        .data-source-panel-header span { display: block; color: var(--text-muted); font-size: 12px; line-height: 1.45; }
        .data-source-close { flex: 0 0 auto; border: 1px solid var(--border); background: var(--bg); color: var(--text-muted); border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 12px; font-weight: 700; }
        .data-source-close:hover { border-color: var(--primary); color: var(--primary); }
        .data-source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
        .data-source-card { border: 1px solid var(--border); border-left: 4px solid var(--text-muted); border-radius: 8px; background: var(--bg); padding: 12px; min-width: 0; }
        .data-source-card.ready { border-left-color: var(--success); }
        .data-source-card.not_configured { border-left-color: var(--warning); }
        .data-source-card-top { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 8px; }
        .data-source-card-top strong { color: var(--text); font-size: 13px; }
        .data-source-card-top span { border-radius: 999px; padding: 2px 7px; background: var(--card); border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-weight: 700; white-space: nowrap; }
        .data-source-card p { margin: 0 0 8px; color: var(--text); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
        .data-source-next { color: var(--text-muted); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
        .launch-context-panel { margin: 0 20px 16px; background: var(--card); border: 1px solid var(--border); border-left: 5px solid var(--primary); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: var(--shadow); }
        .launch-context-panel.missing { border-left-color: var(--warning); }
        .launch-context-copy { min-width: 0; display: flex; align-items: center; gap: 12px; color: var(--text); }
        .launch-context-copy strong { display: block; font-size: 13px; margin-bottom: 2px; }
        .launch-context-copy span:last-child { display: block; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
        .launch-context-pill { flex: 0 0 auto; border-radius: 999px; padding: 4px 9px; background: var(--primary-light); border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .launch-context-panel.missing .launch-context-pill { background: #fffbeb; border-color: #fde68a; color: #92400e; }
        .launch-context-action { flex: 0 0 auto; padding: 7px 12px; border: 1px solid #fde68a; border-radius: 6px; background: #fffbeb; color: #92400e; cursor: pointer; font-size: 12px; font-weight: 700; }
        .launch-context-action:hover { background: #fef3c7; }

        .dashboard-overview { margin: 0 20px 20px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 18px; box-shadow: var(--shadow); }
        .overview-summary { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 14px; }
        .overview-eyebrow { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .overview-title { margin: 4px 0 0; color: var(--text); font-size: 20px; line-height: 1.25; }
        .overview-metrics { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; color: var(--text-muted); font-size: 12px; }
        .overview-metrics span { padding: 5px 9px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; white-space: nowrap; }
        .focus-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
        .focus-empty { padding: 12px; color: var(--text-muted); background: var(--bg); border: 1px dashed var(--border); border-radius: 8px; font-size: 13px; }
        .focus-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; text-align: left; border: 1px solid var(--border); background: var(--card); border-radius: 8px; padding: 10px; cursor: pointer; color: var(--text); transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
        .focus-item:hover { border-color: var(--primary); transform: translateY(-1px); box-shadow: var(--shadow); }
        .focus-label { border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: white; white-space: nowrap; }
        .focus-item.blocked .focus-label { background: var(--danger); }
        .focus-item.overdue .focus-label { background: var(--warning); }
        .focus-item.due-soon .focus-label { background: var(--info); }
        .focus-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .focus-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
        .focus-main span { color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .focus-detail { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
        .focus-overflow { display: flex; align-items: center; min-height: 44px; padding: 10px 12px; color: var(--text-muted); background: var(--bg); border: 1px dashed var(--border); border-radius: 8px; font-size: 12px; line-height: 1.35; }

        .project-list { display: flex; flex-direction: column; gap: 30px; }
        .project-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 30px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .project-card.launch-highlight { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14), var(--shadow); }
        .project-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .project-title { font-size: 24px; font-weight: 700; margin: 0; color: var(--text); }
        .empty-projects { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 28px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
        .empty-projects h2 { margin: 0; color: var(--text); font-size: 20px; }
        .empty-projects p { margin: 0; color: var(--text-muted); }
        .project-health { border: 1px solid var(--border); border-left-width: 5px; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; background: #f8fafc; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
        .project-health.empty { border-left-color: var(--text-muted); }
        .project-health.on-track { border-left-color: var(--success); }
        .project-health.at-risk { border-left-color: var(--warning); }
        .project-health.off-track { border-left-color: var(--danger); }
        .health-main { display: flex; align-items: center; gap: 10px; min-width: 240px; }
        .health-badge { border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 700; color: white; background: var(--text-muted); white-space: nowrap; }
        .project-health.on-track .health-badge { background: var(--success); }
        .project-health.at-risk .health-badge { background: var(--warning); }
        .project-health.off-track .health-badge { background: var(--danger); }
        .health-headline { font-weight: 650; color: var(--text); }
        .health-metrics { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; color: var(--text-muted); font-size: 12px; }
        .health-metrics span { padding: 3px 8px; background: var(--card); border: 1px solid var(--border); border-radius: 999px; white-space: nowrap; }
        .project-alerts { display: flex; gap: 12px; align-items: center; margin: -6px 0 18px; }
        .project-alerts-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; white-space: nowrap; }
        .project-alerts-list { display: flex; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .project-alert { display: inline-flex; align-items: center; gap: 7px; max-width: 320px; border: 1px solid var(--border); background: var(--card); border-radius: 8px; padding: 7px 9px; color: var(--text); cursor: pointer; transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
        .project-alert:hover { border-color: var(--primary); transform: translateY(-1px); box-shadow: var(--shadow); }
        .project-alert-label { border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 700; color: white; white-space: nowrap; }
        .project-alert.blocked .project-alert-label { background: var(--danger); }
        .project-alert.overdue .project-alert-label { background: var(--warning); }
        .project-alert.due-soon .project-alert-label { background: var(--info); }
        .project-alert-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 650; }
        .project-alert-detail { color: var(--text-muted); font-size: 11px; white-space: nowrap; }

        .fishbone-container { position: relative; height: 200px; margin: 20px 0; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 20px; border: 2px solid var(--border); cursor: crosshair; }
        .timeline-spine { position: absolute; left: 40px; right: 40px; top: 50%; height: 4px; background: linear-gradient(90deg, var(--design-color), var(--primary), var(--dep-color)); border-radius: 2px; transform: translateY(-50%); }
        .timeline-arrow { position: absolute; right: 35px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 12px solid var(--dep-color); border-top: 8px solid transparent; border-bottom: 8px solid transparent; }

        .milestone { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: white; z-index: 10; background: var(--purple); border: 2px solid white; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.18); }
        .milestone.milestone-alpha { background: var(--info); box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.2); }
        .milestone.milestone-beta { background: var(--success); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2); }
        .milestone.milestone-ga { background: var(--primary); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2); }
        .milestone:hover { transform: translate(-50%, -50%) scale(1.3); box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3); }
        .milestone-marker-text { max-width: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1; }
        .milestone-label { position: absolute; top: -35px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; }
        .milestone-date { position: absolute; bottom: -35px; left: 50%; transform: translateX(-50%); font-size: 11px; color: var(--text-muted); white-space: nowrap; }

        /* 连接线现在在task-bone内部，支持动态上下位置 */
        .bone-connector { 
          position: absolute; 
          background: currentColor; 
          z-index: 1; 
          pointer-events: none;
        }
        
        /* 上方任务的连接线 */
        .task-bone.top .bone-connector { 
          color: var(--epic-color);
          width: 105px;
          height: 2px;
          top: 4px; 
          right: 0;
          transform: rotate(255deg);
          transform-origin: right center;
        }
        .task-bone.top .bone-connector.dep { 
          color: var(--dep-color);
        }
        .task-bone.top .bone-connector.design { 
          color: var(--design-color);
        }
        .task-bone.top .bone-connector.design { 
          color: var(--design-color);
        }
        
        /* 下方任务的连接线 */
        .task-bone.bottom .bone-connector {
          color: var(--epic-color);
          width: 114px;
          height: 2px;
          bottom: 4px; 
          right: 0;
          transform: rotate(-255deg);
          transform-origin: right center;
        }
        .task-bone.bottom .bone-connector.dep { 
          color: var(--dep-color);
        }
        .task-bone.bottom .bone-connector.design { 
          color: var(--design-color);
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
        
        /* 类型颜色样式 */
        .task-bone.dep { border-color: var(--dep-color); }
        .task-bone.task { border-color: var(--epic-color); }
        .task-bone.design { border-color: var(--design-color); }
        
        /* 动态位置样式 */
        .task-bone.top { top: 10px; }
        .task-bone.bottom { bottom: 2px; }
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
        .status-todo { background: var(--text-muted); }
        .status-progress { background: var(--info); }
        .status-testing { background: var(--warning); }
        .status-testbuild { background: var(--warning); }
        .status-review { background: var(--purple); }
        .status-done { background: var(--success); }
        .status-closed { background: var(--success); }
        .status-complete { background: var(--success); }
        .status-completed { background: var(--success); }
        .status-rollout { background: var(--primary); }
        .status-blocked { background: var(--danger); }
        .status-pending { background: var(--text-muted); }
        .status-unknown { background: var(--text-muted); }
        .eta-tag { font-size: 10px; color: var(--text-muted); }
        .platforms { display: flex; gap: 3px; margin-top: 6px; }
        .platform-dot { width: 8px; height: 8px; border-radius: 50%; }
        .platform-dot.todo { background: var(--text-muted); }
        .platform-dot.done { background: var(--success); }
        .platform-dot.closed { background: var(--success); }
        .platform-dot.complete { background: var(--success); }
        .platform-dot.completed { background: var(--success); }
        .platform-dot.progress { background: var(--info); }
        .platform-dot.testing { background: var(--warning); }
        .platform-dot.testbuild { background: var(--warning); }
        .platform-dot.rollout { background: var(--primary); }
        .platform-dot.blocked { background: var(--danger); }
        .platform-dot.pending { background: var(--text-muted); }
        .platform-dot.unknown { background: var(--text-muted); }

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
        .timeline-context { min-height: 38px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--text-muted); font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
        .timeline-context strong { color: var(--text); font-size: 14px; }
        .task-bone:hover .drag-indicator { opacity: 1; }
        .status-draft-modal { width: min(1100px, 95vw); }
        .status-draft-layout { display: grid; grid-template-columns: minmax(280px, 0.85fr) minmax(360px, 1.15fr); gap: 18px; align-items: stretch; }
        .status-draft-panel { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; min-width: 0; }
        .status-evidence-list { display: flex; flex-direction: column; gap: 10px; }
        .status-evidence-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: flex-start; padding: 10px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; }
        .status-evidence-label { border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: white; background: var(--text-muted); white-space: nowrap; }
        .status-evidence-label.task { background: var(--danger); }
        .status-evidence-label.jira { background: var(--primary); }
        .status-evidence-label.platform { background: var(--warning); }
        .status-evidence-label.milestone { background: var(--success); }
        .status-evidence-item strong { display: block; color: var(--text); font-size: 13px; overflow-wrap: anywhere; }
        .status-evidence-item span:not(.status-evidence-label) { display: block; color: var(--text-muted); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
        .status-evidence-item em { display: block; margin-top: 3px; color: var(--text-muted); font-size: 11px; font-style: normal; }
        .status-evidence-empty { padding: 12px; color: var(--text-muted); background: var(--card); border: 1px dashed var(--border); border-radius: 8px; font-size: 13px; }
        .status-draft-textarea { width: 100%; min-height: 360px; resize: vertical; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--card); color: var(--text); font-size: 13px; line-height: 1.55; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; box-sizing: border-box; }
        .status-draft-textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14); }
        .status-draft-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--text-muted); font-size: 12px; }
        .status-draft-meta span { padding: 3px 8px; background: var(--card); border: 1px solid var(--border); border-radius: 999px; white-space: nowrap; }
        .status-draft-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
        .save-btn, .cancel-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .save-btn { background: var(--success); color: white; }
        .save-btn:hover:not(:disabled) { background: #0ea55c; }
        .save-btn:disabled { background: var(--text-muted); cursor: not-allowed; }
        .cancel-btn { background: var(--border); color: var(--text); }
        .cancel-btn:hover:not(:disabled) { background: var(--text-muted); color: white; }
        .cancel-btn:disabled { opacity: .55; cursor: not-allowed; }

        @media (max-width: 768px) {
          .container { padding: 15px; }
          .project-card { padding: 20px; }
          .project-health { align-items: flex-start; flex-direction: column; }
          .health-main { min-width: 0; }
          .health-metrics { justify-content: flex-start; }
          .fishbone-container { height: 160px; padding: 15px; }
          .task-bone { min-width: 140px; padding: 8px 12px; }
          .zoom-content { margin: 20px; max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); }
          .dashboard-header { flex-direction: column; gap: 16px; text-align: center; margin: 10px; }
          .dashboard-controls { flex-wrap: wrap; justify-content: center; }
          .dashboard-title { font-size: 1.5em; }
          .data-source-banner { margin: 0 10px 10px; flex-direction: column; align-items: flex-start; }
          .data-source-copy { align-items: flex-start; }
          .data-source-panel { margin: 0 10px 10px; }
          .data-source-panel-header { flex-direction: column; }
          .launch-context-panel { margin: 0 10px 10px; flex-direction: column; align-items: flex-start; }
          .launch-context-copy { align-items: flex-start; }
          .dashboard-overview { margin: 0 10px 10px; }
          .overview-summary { flex-direction: column; }
          .overview-metrics { justify-content: flex-start; }
          .focus-item { grid-template-columns: auto minmax(0, 1fr); }
          .focus-detail { grid-column: 2; }
          .status-draft-layout { grid-template-columns: 1fr; }
          .status-draft-textarea { min-height: 280px; }
          .status-draft-actions { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
};

export default ProjectDashboard;
