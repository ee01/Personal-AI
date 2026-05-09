/**
 * 仪表盘集成工具
 * 为项目仪表盘组件提供数据接口和消息处理
 */

import {
  buildProjectReport,
  buildProjectReportFileName,
  importProjectsFromReport,
  sanitizeProject,
  serializeProjectReport,
  type ProjectReportFile,
  type ProjectReportImportMode,
} from './projectReport';

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
  anchorPosition?: number;
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

export type ProjectHealthState = 'empty' | 'on-track' | 'at-risk' | 'off-track';

export interface ProjectHealthSummary {
  state: ProjectHealthState;
  label: string;
  headline: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  upcomingMilestone?: {
    label: string;
    date: string;
    daysUntil: number;
  };
}

export interface ProjectStatusDraftOptions {
  now?: Date;
  maxAttentionTasks?: number;
}

export type ProjectAttentionLevel = 'blocked' | 'overdue' | 'due-soon';

export interface ProjectFocusItem {
  projectId: string;
  projectName: string;
  task: FishboneTask;
  level: ProjectAttentionLevel;
  label: string;
  detail: string;
  daysUntil: number | null;
  priority: number;
}

export interface ProjectFocusSummary {
  totalItems: number;
  visibleItems: ProjectFocusItem[];
  hiddenItems: number;
}

export type ProjectStatusEvidenceType = 'task' | 'jira' | 'platform' | 'milestone';

export interface ProjectStatusEvidenceItem {
  type: ProjectStatusEvidenceType;
  label: string;
  title: string;
  detail: string;
  source: string;
  priority: number;
  taskId?: string;
}

export interface ProjectSyncSourceStatus {
  source: 'jira' | 'github' | 'confluence';
  label: string;
  configured: boolean;
  status: 'not_configured' | 'ready';
  detail: string;
  nextStep: string;
}

export interface ProjectSyncReadiness {
  success: boolean;
  checkedAt: string;
  summary: string;
  sources: ProjectSyncSourceStatus[];
  error?: string;
}

export interface ProjectDashboardLaunchContext {
  hasContext: boolean;
  projectId?: string;
  projectName?: string;
}

const PROJECT_DASHBOARD_STORAGE_KEY = 'projectDashboardFishboneProjects';

const PROJECT_HEALTH_PRIORITY: Record<ProjectHealthState, number> = {
  'off-track': 0,
  'at-risk': 1,
  empty: 2,
  'on-track': 3,
};

const PROJECT_ATTENTION_PRIORITY: Record<ProjectAttentionLevel, number> = {
  blocked: 0,
  overdue: 1,
  'due-soon': 2,
};

function normalizeLaunchContextValue(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

export function parseProjectDashboardLaunchContext(search = ''): ProjectDashboardLaunchContext {
  const rawSearch = String(search || '').trim();
  const query = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const params = new URLSearchParams(query);
  const projectId = normalizeLaunchContextValue(params.get('projectId'));
  const projectName = normalizeLaunchContextValue(params.get('projectName'));
  const context: ProjectDashboardLaunchContext = {
    hasContext: Boolean(projectId || projectName),
  };

  if (projectId) context.projectId = projectId;
  if (projectName) context.projectName = projectName;

  return context;
}

export function buildProjectDashboardLaunchPath(
  context: Partial<Pick<ProjectDashboardLaunchContext, 'projectId' | 'projectName'>> = {},
): string {
  const params = new URLSearchParams();
  const projectId = normalizeLaunchContextValue(context.projectId);
  const projectName = normalizeLaunchContextValue(context.projectName);

  if (projectId) params.set('projectId', projectId);
  if (projectName) params.set('projectName', projectName);

  const query = params.toString();
  return query ? `project-dashboard.html?${query}` : 'project-dashboard.html';
}

export function projectMatchesDashboardLaunchContext(
  project: Pick<FishboneProject, 'id' | 'name'>,
  context: ProjectDashboardLaunchContext,
): boolean {
  if (!context.hasContext) return false;

  const projectId = normalizeLaunchContextValue(project.id)?.toLowerCase();
  const projectName = normalizeLaunchContextValue(project.name)?.toLowerCase();
  const targetId = normalizeLaunchContextValue(context.projectId)?.toLowerCase();
  const targetName = normalizeLaunchContextValue(context.projectName)?.toLowerCase();

  return Boolean(
    (targetId && projectId === targetId) ||
    (targetName && projectName === targetName),
  );
}

function normalizeProjectSuggestionName(input: unknown): string {
  if (typeof input === 'string') return input.trim();
  if (input && typeof input === 'object' && 'name' in input) {
    return String((input as { name?: unknown }).name || '').trim();
  }
  return '';
}

function tokenizeProjectSuggestionQuery(question: string): string[] {
  return String(question || '')
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function rankProjectSuggestionNames(
  items: Array<{ name?: unknown } | string>,
  question = '',
  maxItems = 8,
): string[] {
  const query = String(question || '').trim().toLowerCase();
  const tokens = tokenizeProjectSuggestionQuery(question);
  const seen = new Set<string>();
  const names = (Array.isArray(items) ? items : [])
    .map(normalizeProjectSuggestionName)
    .filter((name) => {
      if (!name) return false;
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const scored = names.map((name, index) => {
    const lowerName = name.toLowerCase();
    const tokenScore = tokens.reduce(
      (score, token) => score + (lowerName.includes(token) ? 2 : 0),
      0,
    );
    const exactScore = query && lowerName.includes(query) ? 4 : 0;
    return {
      name,
      index,
      score: tokenScore + exactScore,
    };
  });

  const hasQueryMatches = scored.some((item) => item.score > 0);

  return scored
    .filter((item) => !hasQueryMatches || item.score > 0)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;

      const lengthDelta = b.name.length - a.name.length;
      if (lengthDelta !== 0) return lengthDelta;

      return a.index - b.index;
    })
    .slice(0, maxItems)
    .map((item) => item.name);
}

function normalizeStatusToken(status: string | undefined): string {
  return String(status || 'unknown').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function buildMilestoneClassToken(label: string | undefined): string {
  const token = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return token || 'milestone';
}

export function buildMilestoneMarkerText(label: string | undefined, index = 0): string {
  const trimmed = String(label || '').trim();
  if (!trimmed) return String(index + 1);

  const trailingNumber = trimmed.match(/\d+$/)?.[0];
  if (trailingNumber) return trailingNumber.slice(-2);

  const words = trimmed
    .split(/[\s_-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length >= 2 && words.every((word) => /^[a-z0-9]/i.test(word))) {
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  return Array.from(trimmed).slice(0, 2).join('').toUpperCase();
}

function parseDateOnly(date: string | undefined): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(date: string | undefined, now: Date): number | null {
  const parsed = parseDateOnly(date);
  if (!parsed) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isCompletedStatus(status: string | undefined): boolean {
  const token = normalizeStatusToken(status);
  return token === 'done' || token === 'closed' || token === 'complete' || token === 'completed';
}

function isBlockedStatus(status: string | undefined): boolean {
  return normalizeStatusToken(status).includes('blocked');
}

export function buildProjectHealthSummary(
  project: FishboneProject,
  now = new Date(),
): ProjectHealthSummary {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];

  const completedTasks = tasks.filter((task) => isCompletedStatus(task.status)).length;
  const blockedTasks = tasks.filter((task) => isBlockedStatus(task.status)).length;
  const overdueTasks = tasks.filter((task) => {
    if (isCompletedStatus(task.status)) return false;
    const delta = daysUntil(task.eta, now);
    return delta !== null && delta < 0;
  }).length;
  const dueSoonTasks = tasks.filter((task) => {
    if (isCompletedStatus(task.status)) return false;
    const delta = daysUntil(task.eta, now);
    return delta !== null && delta >= 0 && delta <= 7;
  }).length;

  const upcomingMilestone = milestones
    .map((milestone) => ({
      label: milestone.label,
      date: milestone.date || '',
      daysUntil: daysUntil(milestone.date, now),
    }))
    .filter(
      (milestone): milestone is { label: string; date: string; daysUntil: number } =>
        Boolean(milestone.label && milestone.date) && milestone.daysUntil !== null && milestone.daysUntil >= 0,
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];

  if (tasks.length === 0) {
    return {
      state: 'empty',
      label: '待规划',
      headline: milestones.length
        ? `已配置 ${milestones.length} 个里程碑，等待拆解任务`
        : '还没有任务或里程碑',
      totalTasks: 0,
      completedTasks: 0,
      blockedTasks: 0,
      overdueTasks: 0,
      dueSoonTasks: 0,
      upcomingMilestone,
    };
  }

  if (blockedTasks > 0 || overdueTasks > 0) {
    return {
      state: 'off-track',
      label: '需处理',
      headline:
        blockedTasks > 0
          ? `${blockedTasks} 个阻塞项需要先处理`
          : `${overdueTasks} 个任务已超过 ETA`,
      totalTasks: tasks.length,
      completedTasks,
      blockedTasks,
      overdueTasks,
      dueSoonTasks,
      upcomingMilestone,
    };
  }

  if (dueSoonTasks > 0) {
    return {
      state: 'at-risk',
      label: '需关注',
      headline: `${dueSoonTasks} 个任务 7 天内到期`,
      totalTasks: tasks.length,
      completedTasks,
      blockedTasks,
      overdueTasks,
      dueSoonTasks,
      upcomingMilestone,
    };
  }

  return {
    state: 'on-track',
    label: '正常',
    headline: upcomingMilestone
      ? `下个里程碑 ${upcomingMilestone.label} 还有 ${upcomingMilestone.daysUntil} 天`
      : `${completedTasks}/${tasks.length} 个任务已完成`,
    totalTasks: tasks.length,
    completedTasks,
    blockedTasks,
    overdueTasks,
    dueSoonTasks,
    upcomingMilestone,
  };
}

export function compareProjectsByDashboardPriority(
  left: FishboneProject,
  right: FishboneProject,
  now = new Date(),
): number {
  const leftHealth = buildProjectHealthSummary(left, now);
  const rightHealth = buildProjectHealthSummary(right, now);

  const healthDelta = PROJECT_HEALTH_PRIORITY[leftHealth.state] - PROJECT_HEALTH_PRIORITY[rightHealth.state];
  if (healthDelta !== 0) return healthDelta;

  const blockedDelta = rightHealth.blockedTasks - leftHealth.blockedTasks;
  if (blockedDelta !== 0) return blockedDelta;

  const overdueDelta = rightHealth.overdueTasks - leftHealth.overdueTasks;
  if (overdueDelta !== 0) return overdueDelta;

  const dueSoonDelta = rightHealth.dueSoonTasks - leftHealth.dueSoonTasks;
  if (dueSoonDelta !== 0) return dueSoonDelta;

  const leftMilestoneDays = leftHealth.upcomingMilestone?.daysUntil ?? Number.POSITIVE_INFINITY;
  const rightMilestoneDays = rightHealth.upcomingMilestone?.daysUntil ?? Number.POSITIVE_INFINITY;
  const milestoneDelta = leftMilestoneDays - rightMilestoneDays;
  if (milestoneDelta !== 0) return milestoneDelta;

  return left.name.localeCompare(right.name);
}

export function buildProjectFocusItems(
  projects: FishboneProject[],
  options: { now?: Date; maxItems?: number } = {},
): ProjectFocusItem[] {
  const now = options.now || new Date();
  const maxItems = options.maxItems ?? 8;

  return collectProjectFocusItems(projects, now).slice(0, maxItems);
}

export function buildProjectFocusSummary(
  projects: FishboneProject[],
  options: { now?: Date; maxItems?: number } = {},
): ProjectFocusSummary {
  const now = options.now || new Date();
  const maxItems = options.maxItems ?? 8;
  const allItems = collectProjectFocusItems(projects, now);
  const visibleItems = allItems.slice(0, maxItems);

  return {
    totalItems: allItems.length,
    visibleItems,
    hiddenItems: Math.max(0, allItems.length - visibleItems.length),
  };
}

function collectProjectFocusItems(projects: FishboneProject[], now: Date): ProjectFocusItem[] {
  return (Array.isArray(projects) ? projects : [])
    .flatMap((project) => {
      const tasks = Array.isArray(project.tasks) ? project.tasks : [];

      return tasks
        .map((task): ProjectFocusItem | null => {
          if (isBlockedStatus(task.status)) {
            return {
              projectId: project.id,
              projectName: project.name,
              task,
              level: 'blocked',
              label: '阻塞',
              detail: task.eta ? `ETA ${task.eta}` : '需要明确负责人或解除条件',
              daysUntil: daysUntil(task.eta, now),
              priority: PROJECT_ATTENTION_PRIORITY.blocked,
            };
          }

          if (isCompletedStatus(task.status)) return null;

          const delta = daysUntil(task.eta, now);
          if (delta === null) return null;

          if (delta < 0) {
            return {
              projectId: project.id,
              projectName: project.name,
              task,
              level: 'overdue',
              label: '过期',
              detail: `已超 ${Math.abs(delta)} 天`,
              daysUntil: delta,
              priority: PROJECT_ATTENTION_PRIORITY.overdue,
            };
          }

          if (delta <= 7) {
            return {
              projectId: project.id,
              projectName: project.name,
              task,
              level: 'due-soon',
              label: '近 7 天',
              detail: delta === 0 ? '今天到期' : `${delta} 天后到期`,
              daysUntil: delta,
              priority: PROJECT_ATTENTION_PRIORITY['due-soon'],
            };
          }

          return null;
        })
        .filter((item): item is ProjectFocusItem => Boolean(item));
    })
    .sort((a, b) => {
      const priorityDelta = a.priority - b.priority;
      if (priorityDelta !== 0) return priorityDelta;

      const leftDays = a.daysUntil ?? Number.POSITIVE_INFINITY;
      const rightDays = b.daysUntil ?? Number.POSITIVE_INFINITY;
      const dateDelta = leftDays - rightDays;
      if (dateDelta !== 0) return dateDelta;

      const projectDelta = a.projectName.localeCompare(b.projectName);
      if (projectDelta !== 0) return projectDelta;

      return a.task.title.localeCompare(b.task.title);
    });
}

function buildTaskJiraKeys(task: FishboneTask): string[] {
  const keys = new Set<string>();

  (task.jira || []).forEach((item) => {
    if (item?.key) keys.add(item.key);
  });

  Object.values(task.platforms || {}).forEach((platform) => {
    if (platform?.jira) keys.add(platform.jira);
  });

  return Array.from(keys);
}

function formatRelativeDays(days: number): string {
  if (days === 0) return '今天';
  if (days > 0) return `${days} 天后`;
  return `已超 ${Math.abs(days)} 天`;
}

function buildStatusDraftAttentionTasks(
  project: FishboneProject,
  now: Date,
  maxItems: number,
): Array<{
  task: FishboneTask;
  label: string;
  detail: string;
  priority: number;
}> {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];

  return tasks
    .map((task) => {
      if (isBlockedStatus(task.status)) {
        return {
          task,
          label: '阻塞',
          detail: task.eta ? `ETA ${task.eta}` : '需要明确负责人或解除条件',
          priority: 0,
        };
      }

      if (isCompletedStatus(task.status)) return null;

      const delta = daysUntil(task.eta, now);
      if (delta === null) return null;

      if (delta < 0) {
        return {
          task,
          label: '过期',
          detail: `已超 ${Math.abs(delta)} 天`,
          priority: 1,
        };
      }

      if (delta <= 7) {
        return {
          task,
          label: '近 7 天到期',
          detail: delta === 0 ? '今天到期' : `${delta} 天后到期`,
          priority: 2,
        };
      }

      return null;
    })
    .filter(
      (
        item,
      ): item is {
        task: FishboneTask;
        label: string;
        detail: string;
        priority: number;
      } => Boolean(item),
    )
    .sort((a, b) => {
      const priorityDelta = a.priority - b.priority;
      if (priorityDelta !== 0) return priorityDelta;
      return (a.task.eta || '').localeCompare(b.task.eta || '');
    })
    .slice(0, maxItems);
}

export function buildProjectStatusEvidenceItems(
  project: FishboneProject,
  options: ProjectStatusDraftOptions = {},
): ProjectStatusEvidenceItem[] {
  const now = options.now || new Date();
  const maxItems = options.maxAttentionTasks ?? 8;
  const evidence: ProjectStatusEvidenceItem[] = [];
  const health = buildProjectHealthSummary(project, now);
  const attentionTasks = buildStatusDraftAttentionTasks(project, now, maxItems);

  attentionTasks.forEach(({ task, label, detail, priority }) => {
    const jiraKeys = buildTaskJiraKeys(task);
    const jiraDetail = jiraKeys.length ? `；Jira ${jiraKeys.join(', ')}` : '';
    evidence.push({
      type: 'task',
      label,
      title: task.title,
      detail: `${detail}${jiraDetail}`,
      source: '本地任务状态 / ETA',
      priority,
      taskId: task.id,
    });
  });

  if (health.upcomingMilestone) {
    evidence.push({
      type: 'milestone',
      label: '里程碑',
      title: health.upcomingMilestone.label,
      detail: `${health.upcomingMilestone.date}，${formatRelativeDays(health.upcomingMilestone.daysUntil)}`,
      source: '本地里程碑计划',
      priority: 3,
    });
  }

  const jiraEvidenceKeys = new Set<string>();
  (Array.isArray(project.tasks) ? project.tasks : []).forEach((task) => {
    buildTaskJiraKeys(task).forEach((jiraKey) => {
      const key = `${task.id}:${jiraKey}`;
      if (jiraEvidenceKeys.has(key)) return;
      jiraEvidenceKeys.add(key);
      evidence.push({
        type: 'jira',
        label: 'Jira',
        title: jiraKey,
        detail: task.title,
        source: '任务关联 Jira',
        priority: 4,
        taskId: task.id,
      });
    });

    Object.entries(task.platforms || {}).forEach(([platformName, platform]) => {
      const status = normalizeStatusToken(platform?.status);
      if (!status || isCompletedStatus(status)) return;
      if (!status.includes('blocked') && status !== 'pending' && status !== 'todo') return;

      evidence.push({
        type: 'platform',
        label: platformName.toUpperCase(),
        title: task.title,
        detail: `${platform?.status || 'pending'}${platform?.assignee ? ` · ${platform.assignee}` : ''}${platform?.jira ? ` · ${platform.jira}` : ''}`,
        source: '平台状态',
        priority: status.includes('blocked') ? 1 : 5,
        taskId: task.id,
      });
    });
  });

  return evidence
    .sort((a, b) => {
      const priorityDelta = a.priority - b.priority;
      if (priorityDelta !== 0) return priorityDelta;
      const labelDelta = a.label.localeCompare(b.label);
      if (labelDelta !== 0) return labelDelta;
      return a.title.localeCompare(b.title);
    })
    .slice(0, maxItems);
}

export function buildProjectStatusUpdateDraft(
  project: FishboneProject,
  options: ProjectStatusDraftOptions = {},
): string {
  const now = options.now || new Date();
  const maxAttentionTasks = options.maxAttentionTasks ?? 5;
  const health = buildProjectHealthSummary(project, now);
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  const attentionTasks = buildStatusDraftAttentionTasks(project, now, maxAttentionTasks);
  const evidenceItems = buildProjectStatusEvidenceItems(project, {
    now,
    maxAttentionTasks: Math.max(maxAttentionTasks, 6),
  });

  const lines: string[] = [
    `${project.name} 状态更新`,
    '',
    `状态：${health.label} - ${health.headline}`,
    `关键指标：${health.completedTasks}/${health.totalTasks} 完成，${health.blockedTasks} 阻塞，${health.overdueTasks} 过期，${health.dueSoonTasks} 个 7 天内到期。`,
  ];

  if (health.upcomingMilestone) {
    lines.push(
      `下个里程碑：${health.upcomingMilestone.label} (${health.upcomingMilestone.date}，还有 ${health.upcomingMilestone.daysUntil} 天)`,
    );
  }

  if (milestones.length) {
    lines.push(
      `里程碑：${milestones
        .map((milestone) => `${milestone.label}${milestone.date ? ` ${milestone.date}` : ' 待定'}`)
        .join('；')}`,
    );
  }

  lines.push('', '证据来源：');
  if (!evidenceItems.length) {
    lines.push('- 本地项目工作台暂无可引用证据。');
  } else {
    evidenceItems.forEach((item) => {
      lines.push(`- [${item.label}] ${item.title}：${item.detail}（${item.source}）`);
    });
  }

  lines.push('', '需要关注：');

  if (!attentionTasks.length) {
    lines.push('- 暂无阻塞、过期或 7 天内到期任务。');
  } else {
    attentionTasks.forEach(({ task, label, detail }) => {
      const jiraKeys = buildTaskJiraKeys(task);
      const evidence = jiraKeys.length ? `；Jira ${jiraKeys.join(', ')}` : '';
      lines.push(`- [${label}] ${task.title} (${detail}${evidence})`);
    });
  }

  lines.push('', '建议下一步：');
  if (health.blockedTasks > 0) {
    lines.push('- 先确认阻塞项负责人、解除条件和下一次检查时间。');
  } else if (health.overdueTasks > 0) {
    lines.push('- 重新确认过期任务 ETA，并同步受影响的里程碑。');
  } else if (health.dueSoonTasks > 0) {
    lines.push('- 检查近 7 天到期任务是否需要资源或排期调整。');
  } else {
    lines.push('- 保持当前节奏，并在下次状态更新前补充新的证据来源。');
  }

  return lines.join('\n');
}

function sanitizeFishboneProject(project: FishboneProject): FishboneProject {
  const sanitized = sanitizeProject(project) as FishboneProject;
  return {
    ...sanitized,
    platformConfig: sanitized.platformConfig?.filter((item): item is PlatformKey =>
      ['sdk', 'ios', 'android', 'qa', 'dev'].includes(item),
    ),
  };
}

function sanitizeFishboneChanges(changes: any): any {
  if (!changes || typeof changes !== 'object') return {};

  const next = { ...changes };
  if ('anchorPosition' in next) {
    const value = Number(next.anchorPosition);
    next.anchorPosition = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined;
  }
  return next;
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
  private storageLoadPromise: Promise<void> | null = null;
  private storageLoaded = false;

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

  private getChromeStorage(): chrome.storage.LocalStorageArea | null {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return chrome.storage.local;
      }
    } catch {
      // chrome is unavailable in local node verifiers.
    }

    return null;
  }

  private async ensureFishboneProjectsLoaded(): Promise<void> {
    if (this.storageLoaded) return;
    if (this.storageLoadPromise) {
      await this.storageLoadPromise;
      return;
    }

    this.storageLoadPromise = (async () => {
      const storage = this.getChromeStorage();
      if (!storage) {
        this.storageLoaded = true;
        return;
      }

      try {
        const result = await storage.get(PROJECT_DASHBOARD_STORAGE_KEY);
        const stored = result?.[PROJECT_DASHBOARD_STORAGE_KEY];
        const storedProjects = Array.isArray(stored)
          ? stored
          : Array.isArray(stored?.projects)
            ? stored.projects
            : null;

        if (storedProjects) {
          this.fishboneProjects = storedProjects.map(sanitizeFishboneProject);
        }
      } catch (error) {
        console.warn('读取项目仪表盘本地数据失败，继续使用默认数据:', error);
      } finally {
        this.storageLoaded = true;
      }
    })();

    await this.storageLoadPromise;
  }

  private async persistFishboneProjects(): Promise<void> {
    const storage = this.getChromeStorage();
    if (!storage) return;

    this.fishboneProjects = this.fishboneProjects.map(sanitizeFishboneProject);

    await storage.set({
      [PROJECT_DASHBOARD_STORAGE_KEY]: {
        version: 1,
        savedAt: Date.now(),
        projects: this.fishboneProjects.map(sanitizeFishboneProject),
      },
    });
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
    await this.ensureFishboneProjectsLoaded();

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
    if (!this.fishboneProjects) {
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
      await this.ensureFishboneProjectsLoaded();

      const project = this.fishboneProjects.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }
      const safeChanges = sanitizeFishboneChanges(changes);

      // 根据类型更新对应的项目（鱼骨模型）
      switch (itemType) {
        case 'project':
          Object.assign(project, safeChanges);
          break;
        case 'milestone': {
          const milestone = project.milestones.find((m: any) => m.id === itemId);
          if (!milestone) return { success: false, error: '里程碑不存在' };
          Object.assign(milestone, safeChanges);
          break;
        }
        case 'task':
        case 'dep':
        case 'design': {
          const task = project.tasks.find((t: any) => t.id === itemId);
          if (!task) return { success: false, error: '任务不存在' };
          Object.assign(task, safeChanges);
          break;
        }
        default:
          return { success: false, error: `不支持的项目项类型: ${itemType}` };
      }
      await this.persistFishboneProjects();
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
      await this.ensureFishboneProjectsLoaded();

      const project = this.fishboneProjects.find(p => p.id === projectId);
      if (!project) {
        return { success: false, error: '项目不存在' };
      }

      const newItem = { id: `${itemType}-${Date.now()}`, ...sanitizeFishboneChanges(itemData) };
      switch (itemType) {
        case 'milestone':
          project.milestones.push({ id: newItem.id, label: newItem.label || 'M', date: newItem.date });
          break;
        case 'task':
        case 'dep':
        case 'design':
          project.tasks.push({
            id: newItem.id,
            type: (newItem.type || 'task'),
            title: newItem.title || '新任务',
            status: newItem.status || 'todo',
            eta: newItem.eta,
            desc: newItem.desc,
            anchorPosition: newItem.anchorPosition,
            platforms: newItem.platforms,
            jira: newItem.jira
          });
          break;
        default:
          return { success: false, error: `不支持的项目项类型: ${itemType}` };
      }
      await this.persistFishboneProjects();
      return { success: true, newItem };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 同步项目数据
   */
  async syncProjectData(_projectId: string): Promise<ProjectSyncReadiness> {
    try {
      await this.ensureFishboneProjectsLoaded();

      const sources: ProjectSyncSourceStatus[] = [
        {
          source: 'jira',
          label: 'Jira',
          configured: false,
          status: 'not_configured',
          detail: '尚未接入真实 Jira 项目同步',
          nextStep: '继续维护本地任务，或通过报告导入 Jira 摘要',
        },
        {
          source: 'github',
          label: 'GitHub',
          configured: false,
          status: 'not_configured',
          detail: '尚未接入 GitHub PR / commit 同步',
          nextStep: '后续可按项目仓库映射接入 PR 状态',
        },
        {
          source: 'confluence',
          label: 'Confluence',
          configured: false,
          status: 'not_configured',
          detail: '尚未接入 Confluence 页面同步',
          nextStep: '后续可按项目空间或页面链接同步状态材料',
        },
      ];

      return {
        success: true,
        checkedAt: new Date().toISOString(),
        summary: '真实数据源尚未接入；当前显示的是本地项目工作台数据。',
        sources,
      };
    } catch (error: any) {
      return {
        success: false,
        checkedAt: new Date().toISOString(),
        summary: '数据源状态检查失败',
        sources: [],
        error: error.message,
      };
    }
  }

  /**
   * 导出项目报告
   */
  async exportProjectReport(projectId: string): Promise<{
    success: boolean;
    fileName?: string;
    mimeType?: string;
    data?: ProjectReportFile;
    serializedData?: string;
    error?: string;
  }> {
    try {
      await this.ensureFishboneProjectsLoaded();

      const isAllProjects = !projectId || projectId === 'all';
      const projects = isAllProjects
        ? this.fishboneProjects
        : this.fishboneProjects.filter((project) => project.id === projectId);

      if (!projects.length) {
        return { success: false, error: '项目不存在' };
      }

      const exportedAt = new Date();
      const scope = isAllProjects ? 'all_projects' : 'single_project';
      const report = buildProjectReport(projects as any[], {
        scope,
        exportedAt,
      });

      return {
        success: true,
        fileName: buildProjectReportFileName(scope, isAllProjects ? undefined : projectId, exportedAt),
        mimeType: 'application/json;charset=utf-8',
        data: report,
        serializedData: serializeProjectReport(report),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async importProjectReport(
    reportContent: string,
    mode: ProjectReportImportMode = 'merge',
  ): Promise<{
    success: boolean;
    importedData?: ProjectReportFile;
    stats?: {
      importedProjectCount: number;
      createdProjectCount: number;
      updatedProjectCount: number;
      retainedProjectCount: number;
      removedProjectCount: number;
    };
    totalProjects?: number;
    error?: string;
  }> {
    try {
      await this.ensureFishboneProjectsLoaded();

      const result = importProjectsFromReport(this.fishboneProjects as any[], reportContent, { mode });
      this.fishboneProjects = result.projects as FishboneProject[];
      await this.persistFishboneProjects();

      return {
        success: true,
        importedData: result.report,
        stats: result.stats,
        totalProjects: this.fishboneProjects.length,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /** 新增项目（前端新增入口调用；目前仅内存保存） */
  async createProject(data: {
    name: string;
    description?: string;
    platformConfig?: PlatformKey[];
    milestones?: MilestonePoint[];
    prompt?: string;
  }): Promise<{ success: boolean; project?: FishboneProject; error?: string }> {
    try {
      await this.ensureFishboneProjectsLoaded();

      const projectName = String(data.name || '').trim();
      if (!projectName) {
        return { success: false, error: '项目名称不能为空' };
      }

      const id = this.createUniqueProjectId(projectName);
      const project: FishboneProject = {
        id,
        name: projectName,
        description: data.description || '',
        milestones: Array.isArray(data.milestones)
          ? data.milestones
              .filter((milestone) => milestone.label?.trim())
              .map((milestone, index) => ({
                id: milestone.id || `milestone-${id}-${index + 1}`,
                label: milestone.label.trim(),
                date: milestone.date,
              }))
          : [],
        tasks: [],
        platformConfig: data.platformConfig?.length ? data.platformConfig : ['sdk', 'ios', 'android', 'qa']
      };
      this.fishboneProjects.push(project);
      await this.persistFishboneProjects();
      return { success: true, project };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  private createUniqueProjectId(name: string): string {
    const base = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `p-${Date.now()}`;
    const existingIds = new Set(this.fishboneProjects.map((project) => project.id));

    if (!existingIds.has(base)) return base;

    let index = 2;
    while (existingIds.has(`${base}-${index}`)) {
      index += 1;
    }

    return `${base}-${index}`;
  }

  /** 🔄 使用向量数据库为项目名提供建议 */
  async suggestProjects(question: string): Promise<{ success: boolean; suggestions: string[]; error?: string }> {
    try {
      const { getMemoryServiceClient } = await import('../services/MemoryServiceClient');
      const client = getMemoryServiceClient();

      // Recall similar messages for context (result not directly used for names)
      await client.recall(question, { topK: 10 });

      const projectResult = await client.getEntities('Project');
      const suggestions = rankProjectSuggestionNames(projectResult.items || [], question);
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

      case 'IMPORT_PROJECT_REPORT':
        console.log('📥 导入项目报告');
        await this.handleImportProjectReport(request, sendResponse);
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

      if (result && result.success === false) {
        sendResponse({ success: false, error: result.error, result });
        return;
      }

      sendResponse({ success: true, result });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleAddProject(request: any, sendResponse: (response: any) => void) {
    try {
      const { name, description, platformConfig, milestones, prompt } = request;
      const res = await this.dataManager.createProject({ name, description, platformConfig, milestones, prompt });
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

  private async handleImportProjectReport(request: any, sendResponse: (response: any) => void) {
    try {
      const result = await this.dataManager.importProjectReport(
        request.reportContent,
        request.mode === 'replace' ? 'replace' : 'merge',
      );
      sendResponse(result);
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }
}
