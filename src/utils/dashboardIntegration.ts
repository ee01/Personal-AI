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
import { getMemoryServiceClient } from '../services/MemoryServiceClient';

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
  lastStatusReviewAt?: string;
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

export type ProjectFreshnessState = 'fresh' | 'aging' | 'stale' | 'unscheduled';

export interface ProjectFreshnessSummary {
  state: ProjectFreshnessState;
  label: string;
  headline: string;
  datedItems: number;
  latestDate?: string;
  daysSinceLatest?: number;
  nextStep: string;
}

export type ProjectReviewState = 'current' | 'due' | 'overdue' | 'unreviewed';

export interface ProjectReviewSummary {
  state: ProjectReviewState;
  label: string;
  headline: string;
  lastReviewedAt?: string;
  daysSinceReview: number | null;
  nextDueDate?: string;
  nextStep: string;
}

export interface ProjectReviewQueueItem {
  projectId: string;
  projectName: string;
  reviewState: ProjectReviewState;
  label: string;
  headline: string;
  nextStep: string;
  daysSinceReview: number | null;
  nextDueDate?: string;
  healthLabel: string;
  viewLabel: string;
  severity: ProjectDecisionSignalSeverity;
}

export interface ProjectReviewQueueSummary {
  totalItems: number;
  visibleItems: ProjectReviewQueueItem[];
  hiddenItems: number;
}

export interface ProjectStatusDraftOptions {
  now?: Date;
  maxAttentionTasks?: number;
}

export type ProjectAttentionLevel = 'blocked' | 'overdue' | 'due-soon';

export interface ProjectTaskRiskSummary {
  score: number;
  label: string;
  drivers: string[];
}

export interface ProjectTaskSourceSummary {
  hasSource: boolean;
  jiraKeys: string[];
  platformSourceLabels: string[];
  sourceLabels: string[];
}

export interface ProjectFocusItem {
  projectId: string;
  projectName: string;
  task: FishboneTask;
  level: ProjectAttentionLevel;
  label: string;
  detail: string;
  daysUntil: number | null;
  priority: number;
  risk: ProjectTaskRiskSummary;
}

export interface ProjectFocusSummary {
  totalItems: number;
  visibleItems: ProjectFocusItem[];
  hiddenItems: number;
}

export type ProjectStatusEvidenceType =
  | 'task'
  | 'jira'
  | 'platform'
  | 'milestone'
  | 'freshness'
  | 'review'
  | 'data-quality';

export interface ProjectStatusEvidenceItem {
  type: ProjectStatusEvidenceType;
  label: string;
  title: string;
  detail: string;
  source: string;
  priority: number;
  taskId?: string;
}

export type ProjectDecisionSignalSeverity = 'critical' | 'warning' | 'info' | 'neutral';

export interface ProjectDecisionSignal {
  id: string;
  label: string;
  title: string;
  detail: string;
  severity: ProjectDecisionSignalSeverity;
  priority: number;
}

export interface ProjectDecisionSummary {
  nextAction: string;
  signals: ProjectDecisionSignal[];
  dataQuality: ProjectDataQualitySummary;
  dataGaps: {
    missingEtaTasks: number;
    missingSourceTasks: number;
  };
}

export interface ProjectDashboardViewReason {
  filter: Exclude<ProjectDashboardViewFilter, 'all'>;
  label: string;
  headline: string;
  detail: string;
  severity: ProjectDecisionSignalSeverity;
}

export type ProjectEvidenceRepairTarget = 'eta' | 'source';

export type ProjectDashboardDecisionBriefAction =
  | {
      type: 'open-task';
      label: string;
      projectId: string;
      taskId: string;
      evidenceFocus?: ProjectEvidenceRepairTarget;
    }
  | {
      type: 'review-project';
      label: string;
      projectId: string;
    }
  | {
      type: 'filter-projects';
      label: string;
      filter: ProjectDashboardViewFilter;
    }
  | {
      type: 'create-project';
      label: string;
    };

export interface ProjectDashboardDecisionBrief {
  tone: ProjectDecisionSignalSeverity;
  label: string;
  headline: string;
  detail: string;
  primaryAction: ProjectDashboardDecisionBriefAction;
  supportingSignals: string[];
}

export type ProjectDataQualityState = 'complete' | 'partial' | 'poor' | 'empty';

export interface ProjectDataQualitySummary {
  state: ProjectDataQualityState;
  label: string;
  headline: string;
  activeTasks: number;
  missingEtaTasks: number;
  missingSourceTasks: number;
  etaCoverage: number;
  sourceCoverage: number;
  overallCoverage: number;
  nextStep: string;
}

export type ProjectVisualizationPanelId = 'gantt' | 'dependencies' | 'burndown';
export type ProjectVisualizationState = 'ready' | 'partial' | 'attention' | 'empty';
export type ProjectVisualizationMarkerTone = 'critical' | 'warning' | 'neutral' | 'complete';

export interface ProjectVisualizationAction {
  label: string;
  taskId: string;
  evidenceFocus?: ProjectEvidenceRepairTarget;
}

export interface ProjectVisualizationMarker {
  id: string;
  label: string;
  detail: string;
  position: number;
  tone: ProjectVisualizationMarkerTone;
}

export interface ProjectVisualizationDriver {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: ProjectVisualizationMarkerTone;
  action?: ProjectVisualizationAction;
}

export interface ProjectVisualizationPanel {
  id: ProjectVisualizationPanelId;
  label: string;
  state: ProjectVisualizationState;
  headline: string;
  detail: string;
  metrics: string[];
  nextStep: string;
  action?: ProjectVisualizationAction;
  progressPercent?: number;
  markers?: ProjectVisualizationMarker[];
  drivers?: ProjectVisualizationDriver[];
}

export interface ProjectVisualizationSummary {
  headline: string;
  nextStep: string;
  panels: ProjectVisualizationPanel[];
}

export type ProjectEvidenceGapType = 'missing-both' | 'missing-eta' | 'missing-source';

export interface ProjectEvidenceGapItem {
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  gapType: ProjectEvidenceGapType;
  label: string;
  headline: string;
  detail: string;
  nextStep: string;
  eta?: string;
  risk: ProjectTaskRiskSummary;
  priority: number;
}

export interface ProjectEvidenceGapSummary {
  totalItems: number;
  visibleItems: ProjectEvidenceGapItem[];
  hiddenItems: number;
  counts: Record<ProjectEvidenceGapType, number>;
  breakdownLabel: string;
}

export interface ProjectSyncSourceStatus {
  source: 'memory' | 'jira' | 'github' | 'confluence';
  label: string;
  configured: boolean;
  status: 'not_configured' | 'ready' | 'unavailable';
  badge?: string;
  detail: string;
  nextStep: string;
  highlights?: string[];
  diagnostics?: string[];
  boundaries?: string[];
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

export interface MemoryWatchedProjectSummary {
  id?: string;
  name: string;
  description?: string;
  aliases?: string[];
  isActive?: boolean;
  priority?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProjectWatchedProjectSyncResult {
  projects: FishboneProject[];
  watchedProjectCount: number;
  matchedProjectCount: number;
  createdProjectCount: number;
  skippedProjectCount: number;
  createdProjectNames: string[];
  matchedProjectNames: string[];
}

export type ProjectDashboardViewFilter = 'all' | 'needs-action' | 'watch' | 'empty' | 'on-track';

export const PROJECT_DASHBOARD_VIEW_FILTER_LABELS: Record<ProjectDashboardViewFilter, string> = {
  all: '全部',
  'needs-action': '需处理',
  watch: '需关注',
  empty: '待规划',
  'on-track': '正常',
};

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

const PROJECT_FRESHNESS_PRIORITY: Record<ProjectFreshnessState, number> = {
  stale: 0,
  aging: 1,
  unscheduled: 2,
  fresh: 3,
};

const PROJECT_REVIEW_PRIORITY: Record<ProjectReviewState, number> = {
  overdue: 0,
  unreviewed: 1,
  due: 2,
  current: 3,
};

const PROJECT_DATA_QUALITY_PRIORITY: Record<ProjectDataQualityState, number> = {
  poor: 0,
  partial: 1,
  complete: 2,
  empty: 2,
};

const PROJECT_STALE_PLAN_THRESHOLD_DAYS = 30;
const PROJECT_STATUS_REVIEW_CADENCE_DAYS = 7;
const PROJECT_STATUS_REVIEW_OVERDUE_DAYS = 14;
const DEFAULT_PROJECT_PLATFORM_CONFIG: PlatformKey[] = ['sdk', 'ios', 'android', 'qa'];

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

function slugifyProjectId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeProjectMatchToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildProjectMatchTokens(project: Pick<FishboneProject, 'id' | 'name'>): string[] {
  return [
    project.id,
    project.name,
    slugifyProjectId(project.id),
    slugifyProjectId(project.name),
  ]
    .map(normalizeProjectMatchToken)
    .filter(Boolean);
}

function buildWatchedProjectMatchTokens(project: MemoryWatchedProjectSummary): string[] {
  return [
    project.id,
    project.name,
    slugifyProjectId(project.id),
    slugifyProjectId(project.name),
    ...(project.aliases || []),
  ]
    .map(normalizeProjectMatchToken)
    .filter(Boolean);
}

function projectMatchesWatchedProject(
  project: Pick<FishboneProject, 'id' | 'name'>,
  watchedProject: MemoryWatchedProjectSummary,
): boolean {
  const projectTokens = buildProjectMatchTokens(project);
  const watchedTokens = buildWatchedProjectMatchTokens(watchedProject);

  return watchedTokens.some((token) => projectTokens.includes(token));
}

function createUniqueDashboardProjectId(candidate: unknown, existingIds: Set<string>): string {
  const base = slugifyProjectId(candidate) || `memory-project-${Date.now()}`;
  if (!existingIds.has(base)) return base;

  let index = 2;
  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

function formatProjectNamePreview(names: string[], maxItems = 3): string {
  const uniqueNames = Array.from(new Set(
    names
      .map((name) => String(name || '').trim())
      .filter(Boolean),
  ));
  const visibleNames = uniqueNames.slice(0, maxItems);
  const hiddenCount = Math.max(0, uniqueNames.length - visibleNames.length);

  if (!visibleNames.length) return '';

  return `${visibleNames.join('、')}${hiddenCount ? ` 等 ${uniqueNames.length} 个` : ''}`;
}

function buildWatchedProjectSyncHighlights(syncResult: ProjectWatchedProjectSyncResult): string[] {
  const highlights: string[] = [];
  const createdPreview = formatProjectNamePreview(syncResult.createdProjectNames);
  const matchedPreview = formatProjectNamePreview(syncResult.matchedProjectNames);

  if (createdPreview) {
    highlights.push(`新增：${createdPreview}`);
  }
  if (matchedPreview) {
    highlights.push(`已匹配：${matchedPreview}`);
  }
  if (!highlights.length && syncResult.watchedProjectCount === 0) {
    highlights.push('Memory Service 当前没有 active watched projects');
  }

  return highlights;
}

interface ProjectSyncLocalCoverage {
  projectCount: number;
  activeTaskCount: number;
  tasksWithEta: number;
  tasksMissingEta: FishboneTask[];
  tasksWithSource: number;
  tasksMissingSource: FishboneTask[];
  jiraTaskCount: number;
  jiraKeyCount: number;
  sampleJiraKeys: string[];
  platformSourceTaskCount: number;
  platformSourceCount: number;
  etaCoverage: number;
  sourceCoverage: number;
}

function coveragePercent(covered: number, total: number): number {
  if (!total) return 0;
  return Math.round((covered / total) * 100);
}

function buildProjectSyncLocalCoverage(projects: FishboneProject[]): ProjectSyncLocalCoverage {
  const projectList = Array.isArray(projects) ? projects : [];
  const activeTasks = projectList.flatMap((project) =>
    (Array.isArray(project.tasks) ? project.tasks : []).filter((task) => !isCompletedStatus(task.status)),
  );
  const tasksWithEta = activeTasks.filter((task) => Boolean(parseDateOnly(task.eta))).length;
  const tasksMissingEta = activeTasks.filter((task) => !parseDateOnly(task.eta));
  const tasksMissingSource: FishboneTask[] = [];
  let jiraTaskCount = 0;
  const jiraKeys = new Set<string>();
  let tasksWithSource = 0;
  let platformSourceTaskCount = 0;
  let platformSourceCount = 0;

  activeTasks.forEach((task) => {
    const sourceSummary = buildProjectTaskSourceSummary(task);

    if (sourceSummary.hasSource) {
      tasksWithSource += 1;
    } else {
      tasksMissingSource.push(task);
    }

    if (sourceSummary.jiraKeys.length) {
      jiraTaskCount += 1;
      sourceSummary.jiraKeys.forEach((key) => jiraKeys.add(key));
    }

    if (sourceSummary.platformSourceLabels.length) {
      platformSourceTaskCount += 1;
      platformSourceCount += sourceSummary.platformSourceLabels.length;
    }
  });

  return {
    projectCount: projectList.length,
    activeTaskCount: activeTasks.length,
    tasksWithEta,
    tasksMissingEta,
    tasksWithSource,
    tasksMissingSource,
    jiraTaskCount,
    jiraKeyCount: jiraKeys.size,
    sampleJiraKeys: Array.from(jiraKeys).slice(0, 3),
    platformSourceTaskCount,
    platformSourceCount,
    etaCoverage: coveragePercent(tasksWithEta, activeTasks.length),
    sourceCoverage: coveragePercent(tasksWithSource, activeTasks.length),
  };
}

function buildMemorySourceDiagnostics(coverage: ProjectSyncLocalCoverage): string[] {
  return [
    `本地工作台：${coverage.projectCount} 个项目，${coverage.activeTaskCount} 个活动任务`,
    `ETA 覆盖 ${coverage.etaCoverage}%，来源覆盖 ${coverage.sourceCoverage}%`,
  ];
}

function buildJiraSourceDiagnostics(coverage: ProjectSyncLocalCoverage): string[] {
  if (!coverage.activeTaskCount) {
    return [
      '当前没有活动任务；新增任务后再补 Jira 或平台来源证据',
      '暂无缺来源任务',
    ];
  }

  const jiraKeyPreview = coverage.sampleJiraKeys.length
    ? `；样例 ${coverage.sampleJiraKeys.join('、')}`
    : '';
  const missingSourcePreview = coverage.tasksMissingSource.length
    ? `缺来源任务：${summarizeTaskTitles(coverage.tasksMissingSource, 2)}`
    : '活动任务已具备 Jira 或平台来源证据';

  return [
    `${coverage.jiraTaskCount}/${coverage.activeTaskCount} 个活动任务有 Jira key，共 ${coverage.jiraKeyCount} 个 key${jiraKeyPreview}`,
    missingSourcePreview,
  ];
}

function buildPlatformSourceDiagnostics(coverage: ProjectSyncLocalCoverage): string[] {
  if (!coverage.activeTaskCount) {
    return [
      '当前没有活动任务；外部映射接入前暂无本地来源缺口',
      '新增任务后再补平台状态、负责人或来源字段',
    ];
  }

  return [
    `${coverage.platformSourceTaskCount}/${coverage.activeTaskCount} 个活动任务有平台状态、负责人或平台来源字段`,
    coverage.tasksMissingEta.length
      ? `缺 ETA 任务：${summarizeTaskTitles(coverage.tasksMissingEta, 2)}`
      : '活动任务 ETA 已补齐，可继续补真实外部映射',
  ];
}

export function mergeWatchedProjectsIntoDashboard(
  currentProjects: FishboneProject[],
  watchedProjects: MemoryWatchedProjectSummary[],
  _options: { reviewedAt?: Date } = {},
): ProjectWatchedProjectSyncResult {
  const nextProjects = (Array.isArray(currentProjects) ? currentProjects : [])
    .map(sanitizeFishboneProject);
  const existingIds = new Set(nextProjects.map((project) => project.id).filter(Boolean));
  const activeWatchedProjects = (Array.isArray(watchedProjects) ? watchedProjects : [])
    .filter((project) => project?.isActive !== false && String(project?.name || '').trim());
  const createdProjectNames: string[] = [];
  const matchedProjectNames: string[] = [];

  activeWatchedProjects.forEach((watchedProject) => {
    const matched = nextProjects.find((project) => projectMatchesWatchedProject(project, watchedProject));

    if (matched) {
      matchedProjectNames.push(matched.name);
      return;
    }

    const id = createUniqueDashboardProjectId(watchedProject.id || watchedProject.name, existingIds);
    existingIds.add(id);
    const projectName = String(watchedProject.name || '').trim();
    const description = String(watchedProject.description || '').trim();
    nextProjects.push({
      id,
      name: projectName,
      description: description
        ? `${description}（来自 Memory Service 关注项目）`
        : '来自 Memory Service 关注项目，待补充本地里程碑和任务。',
      milestones: [],
      tasks: [],
      platformConfig: DEFAULT_PROJECT_PLATFORM_CONFIG,
    });
    createdProjectNames.push(projectName);
  });

  return {
    projects: nextProjects,
    watchedProjectCount: activeWatchedProjects.length,
    matchedProjectCount: matchedProjectNames.length,
    createdProjectCount: createdProjectNames.length,
    skippedProjectCount: Math.max(0, activeWatchedProjects.length - matchedProjectNames.length - createdProjectNames.length),
    createdProjectNames,
    matchedProjectNames,
  };
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

function parseDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysUntil(date: string | undefined, now: Date): number | null {
  const parsed = parseDateOnly(date);
  if (!parsed) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function daysSinceDate(value: string | undefined, now: Date): number | null {
  const parsed = parseDateTime(value);
  if (!parsed) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.max(0, Math.round((today.getTime() - target.getTime()) / 86_400_000));
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

export function buildProjectFreshnessSummary(
  project: FishboneProject,
  now = new Date(),
): ProjectFreshnessSummary {
  const datedItems = [
    ...(Array.isArray(project.tasks) ? project.tasks : [])
      .map((task) => task.eta)
      .filter((date): date is string => Boolean(parseDateOnly(date))),
    ...(Array.isArray(project.milestones) ? project.milestones : [])
      .map((milestone) => milestone.date)
      .filter((date): date is string => Boolean(parseDateOnly(date))),
  ];

  if (!datedItems.length) {
    return {
      state: 'unscheduled',
      label: '缺时间线',
      headline: '没有 ETA 或里程碑日期',
      datedItems: 0,
      nextStep: '先补齐关键任务 ETA 和里程碑日期',
    };
  }

  const latestDate = datedItems
    .sort((left, right) => {
      const leftTime = parseDateOnly(left)?.getTime() ?? 0;
      const rightTime = parseDateOnly(right)?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];
  const latestDelta = daysUntil(latestDate, now) ?? 0;

  if (latestDelta >= 0) {
    return {
      state: 'fresh',
      label: '计划可用',
      headline: latestDelta === 0
        ? `计划更新到今天 ${latestDate}`
        : `计划延伸到 ${latestDate}，还有 ${latestDelta} 天`,
      datedItems: datedItems.length,
      latestDate,
      daysSinceLatest: 0,
      nextStep: '继续维护任务 ETA 和状态来源',
    };
  }

  const daysSinceLatest = Math.abs(latestDelta);
  if (daysSinceLatest > PROJECT_STALE_PLAN_THRESHOLD_DAYS) {
    return {
      state: 'stale',
      label: '计划陈旧',
      headline: `最近计划日期 ${latestDate} 已过 ${daysSinceLatest} 天`,
      datedItems: datedItems.length,
      latestDate,
      daysSinceLatest,
      nextStep: '先更新 ETA / 里程碑，或归档已结束项目',
    };
  }

  return {
    state: 'aging',
    label: '需复核',
    headline: `最近计划日期 ${latestDate} 已过 ${daysSinceLatest} 天`,
    datedItems: datedItems.length,
    latestDate,
    daysSinceLatest,
    nextStep: '确认项目是否仍在推进，并刷新下一次检查日期',
  };
}

export function buildProjectReviewSummary(
  project: FishboneProject,
  now = new Date(),
): ProjectReviewSummary {
  const lastReviewedAt = typeof project.lastStatusReviewAt === 'string'
    ? project.lastStatusReviewAt
    : undefined;
  const lastReviewDate = parseDateTime(lastReviewedAt);
  const daysSinceReview = daysSinceDate(lastReviewedAt, now);

  if (!lastReviewDate || daysSinceReview === null) {
    return {
      state: 'unreviewed',
      label: '未复核',
      headline: '还没有状态复核记录',
      daysSinceReview: null,
      nextStep: '先预览状态草稿，确认证据后标记已复核',
    };
  }

  const nextDueDate = formatDateOnly(addDays(lastReviewDate, PROJECT_STATUS_REVIEW_CADENCE_DAYS));

  if (daysSinceReview <= PROJECT_STATUS_REVIEW_CADENCE_DAYS) {
    return {
      state: 'current',
      label: '已复核',
      headline: daysSinceReview === 0 ? '今天已复核状态' : `${daysSinceReview} 天前复核状态`,
      lastReviewedAt,
      daysSinceReview,
      nextDueDate,
      nextStep: '继续按当前节奏维护状态证据',
    };
  }

  if (daysSinceReview <= PROJECT_STATUS_REVIEW_OVERDUE_DAYS) {
    return {
      state: 'due',
      label: '待复核',
      headline: `${daysSinceReview} 天未复核状态`,
      lastReviewedAt,
      daysSinceReview,
      nextDueDate,
      nextStep: '复制状态草稿前快速检查证据和下一步',
    };
  }

  return {
    state: 'overdue',
    label: '复核过期',
    headline: `${daysSinceReview} 天未复核状态`,
    lastReviewedAt,
    daysSinceReview,
    nextDueDate,
    nextStep: '先确认项目健康、阻塞和下一步，再同步状态',
  };
}

export function buildProjectReviewQueueSummary(
  projects: FishboneProject[],
  options: { now?: Date; maxItems?: number } = {},
): ProjectReviewQueueSummary {
  const now = options.now || new Date();
  const maxItems = options.maxItems ?? 5;
  const candidates = (Array.isArray(projects) ? projects : [])
    .map((project) => ({
      project,
      review: buildProjectReviewSummary(project, now),
      health: buildProjectHealthSummary(project, now),
      viewReason: buildProjectDashboardViewReason(project, now),
    }))
    .filter((item) => item.review.state !== 'current')
    .sort((a, b) => {
      const reviewDelta = PROJECT_REVIEW_PRIORITY[a.review.state] - PROJECT_REVIEW_PRIORITY[b.review.state];
      if (reviewDelta !== 0) return reviewDelta;

      const dashboardDelta = compareProjectsByDashboardPriority(a.project, b.project, now);
      if (dashboardDelta !== 0) return dashboardDelta;

      return a.project.name.localeCompare(b.project.name);
    });

  const visibleItems: ProjectReviewQueueItem[] = candidates.slice(0, maxItems).map(({ project, review, health, viewReason }) => {
    const severity: ProjectDecisionSignalSeverity = health.state === 'off-track'
      ? 'critical'
      : review.state === 'overdue' || review.state === 'unreviewed'
        ? 'warning'
        : 'info';

    return {
      projectId: project.id,
      projectName: project.name,
      reviewState: review.state,
      label: review.label,
      headline: review.headline,
      nextStep: review.nextStep,
      daysSinceReview: review.daysSinceReview,
      nextDueDate: review.nextDueDate,
      healthLabel: health.label,
      viewLabel: viewReason.label,
      severity,
    };
  });

  return {
    totalItems: candidates.length,
    visibleItems,
    hiddenItems: Math.max(0, candidates.length - visibleItems.length),
  };
}

export function getProjectDashboardViewFilter(
  project: FishboneProject,
  now = new Date(),
): Exclude<ProjectDashboardViewFilter, 'all'> {
  return buildProjectDashboardViewReason(project, now).filter;
}

export function buildProjectDashboardViewReason(
  project: FishboneProject,
  now = new Date(),
): ProjectDashboardViewReason {
  const health = buildProjectHealthSummary(project, now);
  const freshness = buildProjectFreshnessSummary(project, now);
  const review = buildProjectReviewSummary(project, now);
  const dataQuality = buildProjectDataQualitySummary(project);

  switch (health.state) {
    case 'off-track':
      return {
        filter: 'needs-action',
        label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS['needs-action'],
        headline: health.headline,
        detail: health.blockedTasks > 0
          ? '先确认阻塞负责人和解除条件'
          : '重估过期任务 ETA 并同步里程碑',
        severity: 'critical',
      };
    case 'at-risk':
      return {
        filter: 'watch',
        label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.watch,
        headline: health.headline,
        detail: '检查近 7 天任务的资源和排期',
        severity: 'warning',
      };
    case 'empty':
      return {
        filter: 'empty',
        label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.empty,
        headline: health.headline,
        detail: '先把里程碑拆成可跟踪任务',
        severity: 'info',
      };
    case 'on-track':
    default:
      if (freshness.state === 'stale' || freshness.state === 'aging') {
        return {
          filter: 'watch',
          label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.watch,
          headline: freshness.headline,
          detail: freshness.nextStep,
          severity: freshness.state === 'stale' ? 'warning' : 'info',
        };
      }
      if (freshness.state === 'unscheduled') {
        return {
          filter: 'empty',
          label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.empty,
          headline: freshness.headline,
          detail: freshness.nextStep,
          severity: 'info',
        };
      }
      if (review.state !== 'current') {
        return {
          filter: 'watch',
          label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.watch,
          headline: review.headline,
          detail: review.nextStep,
          severity: review.state === 'overdue' || review.state === 'unreviewed' ? 'warning' : 'info',
        };
      }
      if (dataQuality.state === 'poor') {
        return {
          filter: 'watch',
          label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.watch,
          headline: dataQuality.headline,
          detail: dataQuality.nextStep,
          severity: 'warning',
        };
      }
      if (dataQuality.state === 'partial') {
        return {
          filter: 'watch',
          label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS.watch,
          headline: dataQuality.headline,
          detail: dataQuality.nextStep,
          severity: 'info',
        };
      }
      return {
        filter: 'on-track',
        label: PROJECT_DASHBOARD_VIEW_FILTER_LABELS['on-track'],
        headline: health.headline,
        detail: '继续维护任务状态、ETA 和来源链接',
        severity: 'neutral',
      };
  }
}

export function filterProjectsByDashboardView<T extends FishboneProject>(
  projects: T[],
  filter: ProjectDashboardViewFilter,
  now = new Date(),
): T[] {
  const list = Array.isArray(projects) ? projects : [];
  if (filter === 'all') return list;

  return list.filter((project) => getProjectDashboardViewFilter(project, now) === filter);
}

export function buildProjectDashboardViewFilterCounts(
  projects: FishboneProject[],
  now = new Date(),
): Record<ProjectDashboardViewFilter, number> {
  const counts: Record<ProjectDashboardViewFilter, number> = {
    all: 0,
    'needs-action': 0,
    watch: 0,
    empty: 0,
    'on-track': 0,
  };

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    counts.all += 1;
    counts[getProjectDashboardViewFilter(project, now)] += 1;
  });

  return counts;
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

  const leftFreshness = buildProjectFreshnessSummary(left, now);
  const rightFreshness = buildProjectFreshnessSummary(right, now);
  const freshnessDelta =
    PROJECT_FRESHNESS_PRIORITY[leftFreshness.state] - PROJECT_FRESHNESS_PRIORITY[rightFreshness.state];
  if (freshnessDelta !== 0) return freshnessDelta;

  const freshnessAgeDelta = (rightFreshness.daysSinceLatest || 0) - (leftFreshness.daysSinceLatest || 0);
  if (freshnessAgeDelta !== 0) return freshnessAgeDelta;

  const leftReview = buildProjectReviewSummary(left, now);
  const rightReview = buildProjectReviewSummary(right, now);
  const reviewStateDelta = PROJECT_REVIEW_PRIORITY[leftReview.state] - PROJECT_REVIEW_PRIORITY[rightReview.state];
  if (reviewStateDelta !== 0) return reviewStateDelta;

  const reviewDelta = (rightReview.daysSinceReview || 0) - (leftReview.daysSinceReview || 0);
  if (reviewDelta !== 0) return reviewDelta;

  const leftDataQuality = buildProjectDataQualitySummary(left);
  const rightDataQuality = buildProjectDataQualitySummary(right);
  const dataQualityDelta =
    PROJECT_DATA_QUALITY_PRIORITY[leftDataQuality.state] - PROJECT_DATA_QUALITY_PRIORITY[rightDataQuality.state];
  if (dataQualityDelta !== 0) return dataQualityDelta;

  const coverageDelta = leftDataQuality.overallCoverage - rightDataQuality.overallCoverage;
  if (coverageDelta !== 0) return coverageDelta;

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

export function buildProjectEvidenceGapSummary(
  projects: FishboneProject[],
  options: { now?: Date; maxItems?: number } = {},
): ProjectEvidenceGapSummary {
  const now = options.now || new Date();
  const maxItems = options.maxItems ?? 6;
  const items = collectProjectEvidenceGapItems(projects, now);
  const visibleItems = items.slice(0, maxItems);
  const counts = buildProjectEvidenceGapCounts(items);

  return {
    totalItems: items.length,
    visibleItems,
    hiddenItems: Math.max(0, items.length - visibleItems.length),
    counts,
    breakdownLabel: formatProjectEvidenceGapBreakdown(counts),
  };
}

export function buildProjectDashboardDecisionBrief(
  projects: FishboneProject[],
  options: { now?: Date } = {},
): ProjectDashboardDecisionBrief {
  const now = options.now || new Date();
  const projectList = Array.isArray(projects) ? projects : [];

  if (!projectList.length) {
    return {
      tone: 'info',
      label: '先建立工作台',
      headline: '暂无本地项目',
      detail: '先新增一个项目，补齐里程碑和首批可跟踪任务',
      primaryAction: {
        type: 'create-project',
        label: '新增项目',
      },
      supportingSignals: ['0 个项目', '0 个焦点任务', '0 个证据缺口'],
    };
  }

  const focusItems = collectProjectFocusItems(projectList, now);
  const evidenceGapItems = collectProjectEvidenceGapItems(projectList, now);
  const evidenceGapCounts = buildProjectEvidenceGapCounts(evidenceGapItems);
  const reviewQueue = buildProjectReviewQueueSummary(projectList, {
    now,
    maxItems: 1,
  });
  const reviewItem = reviewQueue.visibleItems[0];
  const staleProjects = projectList.filter((project) => {
    const freshness = buildProjectFreshnessSummary(project, now);
    return freshness.state === 'stale' || freshness.state === 'aging';
  }).length;
  const support = [
    focusItems.length
      ? `${focusItems.length} 个阻塞/过期/临期任务`
      : '无阻塞、过期或 7 天内到期任务',
    evidenceGapItems.length
      ? `${evidenceGapItems.length} 个证据缺口：${formatProjectEvidenceGapBreakdown(evidenceGapCounts)}`
      : '证据覆盖暂无明显缺口',
    reviewQueue.totalItems
      ? `${reviewQueue.totalItems} 个项目待复核`
      : '状态复核节奏正常',
  ];

  if (staleProjects > 0) {
    support.push(`${staleProjects} 个项目计划需复核`);
  }

  const topFocus = focusItems[0];
  if (topFocus) {
    const tone: ProjectDecisionSignalSeverity = topFocus.level === 'due-soon' ? 'warning' : 'critical';
    const label = topFocus.level === 'blocked'
      ? '先处理阻塞'
      : topFocus.level === 'overdue'
        ? '先重估过期项'
        : '先确认临期项';
    const nextStep = topFocus.level === 'blocked'
      ? '打开任务确认负责人、解除条件和下一次检查时间'
      : topFocus.level === 'overdue'
        ? '打开任务重估 ETA，并同步受影响里程碑'
        : '打开任务确认资源和排期是否仍可达成';
    const driverDetail = topFocus.risk.drivers.slice(0, 3).join('；');

    return {
      tone,
      label,
      headline: `${topFocus.projectName} · ${topFocus.task.title}`,
      detail: `${topFocus.detail}；${topFocus.risk.label} ${topFocus.risk.score}/100${driverDetail ? `；${driverDetail}` : ''}`,
      primaryAction: {
        type: 'open-task',
        label: '打开任务',
        projectId: topFocus.projectId,
        taskId: topFocus.task.id,
      },
      supportingSignals: [nextStep, ...support],
    };
  }

  const topEvidenceGap = evidenceGapItems[0];
  if (topEvidenceGap) {
    const tone: ProjectDecisionSignalSeverity = topEvidenceGap.gapType === 'missing-both' ? 'warning' : 'info';
    return {
      tone,
      label: '先补齐证据',
      headline: `${topEvidenceGap.projectName} · ${topEvidenceGap.taskTitle}`,
      detail: `${topEvidenceGap.label}：${topEvidenceGap.headline}；${topEvidenceGap.nextStep}`,
      primaryAction: {
        type: 'open-task',
        label: '补任务证据',
        projectId: topEvidenceGap.projectId,
        taskId: topEvidenceGap.taskId,
        evidenceFocus: topEvidenceGap.gapType === 'missing-source' ? 'source' : 'eta',
      },
      supportingSignals: [
        `风险分 ${topEvidenceGap.risk.score}/100`,
        ...support,
      ],
    };
  }

  if (reviewItem) {
    return {
      tone: reviewItem.severity,
      label: '先复核状态',
      headline: `${reviewItem.projectName} · ${reviewItem.headline}`,
      detail: reviewItem.nextStep,
      primaryAction: {
        type: 'review-project',
        label: '复核草稿',
        projectId: reviewItem.projectId,
      },
      supportingSignals: support,
    };
  }

  return {
    tone: 'neutral',
    label: '节奏正常',
    headline: '暂无需要立即升级的项目',
    detail: '继续按当前节奏维护 ETA、来源和状态更新',
    primaryAction: {
      type: 'filter-projects',
      label: '查看全部项目',
      filter: 'all',
    },
    supportingSignals: support,
  };
}

function buildProjectEvidenceGapCounts(
  items: ProjectEvidenceGapItem[],
): Record<ProjectEvidenceGapType, number> {
  return items.reduce<Record<ProjectEvidenceGapType, number>>(
    (counts, item) => {
      counts[item.gapType] += 1;
      return counts;
    },
    {
      'missing-both': 0,
      'missing-eta': 0,
      'missing-source': 0,
    },
  );
}

function formatProjectEvidenceGapBreakdown(
  counts: Record<ProjectEvidenceGapType, number>,
): string {
  const parts = [
    counts['missing-both'] ? `${counts['missing-both']} 个缺 ETA+来源` : '',
    counts['missing-eta'] ? `${counts['missing-eta']} 个缺 ETA` : '',
    counts['missing-source'] ? `${counts['missing-source']} 个缺来源` : '',
  ].filter(Boolean);

  return parts.length ? parts.join('，') : '无明显证据缺口';
}

function collectProjectEvidenceGapItems(projects: FishboneProject[], now: Date): ProjectEvidenceGapItem[] {
  return (Array.isArray(projects) ? projects : [])
    .flatMap((project) => {
      const tasks = Array.isArray(project.tasks) ? project.tasks : [];

      return tasks
        .filter((task) => !isCompletedStatus(task.status))
        .map((task): ProjectEvidenceGapItem | null => {
          const missingEta = !parseDateOnly(task.eta);
          const missingSource = !hasTaskSourceEvidence(task);
          if (!missingEta && !missingSource) return null;

          const risk = buildProjectTaskRiskSummary(project, task, { now });
          const gapType: ProjectEvidenceGapType = missingEta && missingSource
            ? 'missing-both'
            : missingEta
              ? 'missing-eta'
              : 'missing-source';
          const label = gapType === 'missing-both'
            ? '缺 ETA 和来源'
            : gapType === 'missing-eta'
              ? '缺 ETA'
              : '缺来源';
          const headline = gapType === 'missing-both'
            ? '风险排序缺少时间和外部证据'
            : gapType === 'missing-eta'
              ? '风险排序缺少目标日期'
              : '状态判断缺少 Jira / 平台来源';
          const nextStep = gapType === 'missing-both'
            ? '补 ETA 后关联 Jira 或平台状态'
            : gapType === 'missing-eta'
              ? '补上可复核 ETA'
              : '关联 Jira 或平台状态';
          const priority = gapType === 'missing-both' ? 0 : gapType === 'missing-eta' ? 1 : 2;

          return {
            projectId: project.id,
            projectName: project.name,
            taskId: task.id,
            taskTitle: task.title,
            gapType,
            label,
            headline,
            detail: risk.drivers.join('；'),
            nextStep,
            eta: task.eta,
            risk,
            priority,
          };
        })
        .filter((item): item is ProjectEvidenceGapItem => Boolean(item));
    })
    .sort((a, b) => {
      const priorityDelta = a.priority - b.priority;
      if (priorityDelta !== 0) return priorityDelta;

      const riskDelta = b.risk.score - a.risk.score;
      if (riskDelta !== 0) return riskDelta;

      const leftDate = daysUntil(a.eta, now) ?? Number.POSITIVE_INFINITY;
      const rightDate = daysUntil(b.eta, now) ?? Number.POSITIVE_INFINITY;
      const dateDelta = leftDate - rightDate;
      if (dateDelta !== 0) return dateDelta;

      const projectDelta = a.projectName.localeCompare(b.projectName);
      if (projectDelta !== 0) return projectDelta;

      return a.taskTitle.localeCompare(b.taskTitle);
    });
}

function collectProjectFocusItems(projects: FishboneProject[], now: Date): ProjectFocusItem[] {
  return (Array.isArray(projects) ? projects : [])
    .flatMap((project) => {
      const tasks = Array.isArray(project.tasks) ? project.tasks : [];

      return tasks
        .map((task): ProjectFocusItem | null => {
          const risk = buildProjectTaskRiskSummary(project, task, { now });

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
              risk,
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
              risk,
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
              risk,
            };
          }

          return null;
        })
        .filter((item): item is ProjectFocusItem => Boolean(item));
    })
    .sort((a, b) => {
      const priorityDelta = a.priority - b.priority;
      if (priorityDelta !== 0) return priorityDelta;

      const riskDelta = b.risk.score - a.risk.score;
      if (riskDelta !== 0) return riskDelta;

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
    const key = String(item?.key || '').trim();
    if (key) keys.add(key);
  });

  Object.values(task.platforms || {}).forEach((platform) => {
    const key = String(platform?.jira || '').trim();
    if (key) keys.add(key);
  });

  return Array.from(keys);
}

function buildTaskPlatformJiraKeys(task: FishboneTask): Set<string> {
  const keys = new Set<string>();

  Object.values(task.platforms || {}).forEach((platform) => {
    const key = String(platform?.jira || '').trim();
    if (key) keys.add(key);
  });

  return keys;
}

function buildTaskPlatformSourceLabels(task: FishboneTask): string[] {
  return Object.entries(task.platforms || {})
    .map(([platformName, platform]) => {
      const status = String(platform?.status || '').trim();
      const assignee = String(platform?.assignee || '').trim();
      const jira = String(platform?.jira || '').trim();
      if (!status && !assignee && !jira) return '';

      const details = [status, assignee, jira ? `Jira ${jira}` : ''].filter(Boolean);
      return `${platformName.toUpperCase()}${details.length ? ` ${details.join(' · ')}` : ''}`;
    })
    .filter(Boolean);
}

export function buildProjectTaskSourceSummary(task: FishboneTask): ProjectTaskSourceSummary {
  const jiraKeys = buildTaskJiraKeys(task);
  const platformJiraKeys = buildTaskPlatformJiraKeys(task);
  const platformSourceLabels = buildTaskPlatformSourceLabels(task);
  const standaloneJiraLabels = jiraKeys
    .filter((key) => !platformJiraKeys.has(key))
    .map((key) => `Jira ${key}`);
  const sourceLabels = [
    ...standaloneJiraLabels,
    ...platformSourceLabels,
  ];

  return {
    hasSource: sourceLabels.length > 0,
    jiraKeys,
    platformSourceLabels,
    sourceLabels,
  };
}

function hasTaskSourceEvidence(task: FishboneTask): boolean {
  return buildProjectTaskSourceSummary(task).hasSource;
}

function clampRiskScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getRiskLabel(score: number): string {
  if (score >= 70) return '高风险';
  if (score >= 40) return '中风险';
  if (score > 0) return '低风险';
  return '低风险';
}

export function buildProjectTaskRiskSummary(
  project: FishboneProject,
  task: FishboneTask,
  options: { now?: Date } = {},
): ProjectTaskRiskSummary {
  const now = options.now || new Date();
  const drivers: string[] = [];

  if (isCompletedStatus(task.status)) {
    return {
      score: 0,
      label: '已完成',
      drivers: ['任务已完成'],
    };
  }

  let score = 0;
  const delta = daysUntil(task.eta, now);

  if (isBlockedStatus(task.status)) {
    score += 45;
    drivers.push('任务阻塞');
  }

  if (delta === null) {
    score += 12;
    drivers.push('缺 ETA');
  } else if (delta < 0) {
    score += Math.min(30, 15 + Math.abs(delta) * 2);
    drivers.push(`过期 ${Math.abs(delta)} 天`);
  } else if (delta <= 7) {
    score += Math.max(8, 20 - delta * 2);
    drivers.push(delta === 0 ? '今天到期' : `${delta} 天后到期`);
  } else if (delta <= 14) {
    score += 4;
    drivers.push(`${delta} 天后到期`);
  }

  if (!hasTaskSourceEvidence(task)) {
    score += 8;
    drivers.push('缺 Jira / 平台来源');
  }

  const platformStates = Object.values(task.platforms || {});
  const blockedPlatforms = platformStates.filter((platform) => isBlockedStatus(platform?.status)).length;
  const pendingPlatforms = platformStates.filter((platform) => {
    const status = normalizeStatusToken(platform?.status);
    return status === 'pending' || status === 'todo';
  }).length;

  if (blockedPlatforms > 0) {
    score += Math.min(18, blockedPlatforms * 9);
    drivers.push(`${blockedPlatforms} 个平台阻塞`);
  }
  if (pendingPlatforms > 0) {
    score += Math.min(8, pendingPlatforms * 4);
    drivers.push(`${pendingPlatforms} 个平台待启动`);
  }

  const upcomingMilestone = buildProjectHealthSummary(project, now).upcomingMilestone;
  if (upcomingMilestone && upcomingMilestone.daysUntil <= 7) {
    score += 5;
    drivers.push(`${upcomingMilestone.label} 里程碑临近`);
  }

  const normalizedScore = clampRiskScore(score);
  return {
    score: normalizedScore,
    label: getRiskLabel(normalizedScore),
    drivers: drivers.length ? drivers : ['暂无显著风险信号'],
  };
}

function calculateCoveragePercent(completeItems: number, totalItems: number): number {
  if (totalItems <= 0) return 100;
  return Math.round((completeItems / totalItems) * 100);
}

function buildDataQualityNextStep(missingEtaTasks: number, missingSourceTasks: number): string {
  if (missingEtaTasks > 0 && missingSourceTasks > 0) {
    return '先补齐 ETA 和 Jira / 平台来源，避免风险排序失真';
  }
  if (missingEtaTasks > 0) {
    return '优先补齐缺 ETA 的活动任务';
  }
  if (missingSourceTasks > 0) {
    return '补充 Jira 或平台来源，方便状态回溯';
  }
  return '继续维护任务状态、ETA 和来源链接';
}

export function buildProjectDataQualitySummary(project: FishboneProject): ProjectDataQualitySummary {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const activeTasks = tasks.filter((task) => !isCompletedStatus(task.status));
  const activeTaskCount = activeTasks.length;

  if (!activeTaskCount) {
    return {
      state: 'empty',
      label: '无活动任务',
      headline: '没有进行中的任务需要补充证据',
      activeTasks: 0,
      missingEtaTasks: 0,
      missingSourceTasks: 0,
      etaCoverage: 100,
      sourceCoverage: 100,
      overallCoverage: 100,
      nextStep: '新增任务时同步补齐 ETA 和 Jira / 平台来源',
    };
  }

  const missingEtaTasks = activeTasks.filter((task) => !parseDateOnly(task.eta)).length;
  const missingSourceTasks = activeTasks.filter((task) => !hasTaskSourceEvidence(task)).length;
  const etaCoverage = calculateCoveragePercent(activeTaskCount - missingEtaTasks, activeTaskCount);
  const sourceCoverage = calculateCoveragePercent(activeTaskCount - missingSourceTasks, activeTaskCount);
  const overallCoverage = calculateCoveragePercent(
    activeTaskCount * 2 - missingEtaTasks - missingSourceTasks,
    activeTaskCount * 2,
  );

  if (overallCoverage === 100) {
    return {
      state: 'complete',
      label: '证据完整',
      headline: `${activeTaskCount} 个活动任务已补齐 ETA 和来源`,
      activeTasks: activeTaskCount,
      missingEtaTasks,
      missingSourceTasks,
      etaCoverage,
      sourceCoverage,
      overallCoverage,
      nextStep: '继续维护任务状态、ETA 和来源链接',
    };
  }

  const headline = `证据覆盖 ${overallCoverage}%：${missingEtaTasks} 个缺 ETA，${missingSourceTasks} 个缺来源`;

  if (overallCoverage < 60) {
    return {
      state: 'poor',
      label: '证据不足',
      headline,
      activeTasks: activeTaskCount,
      missingEtaTasks,
      missingSourceTasks,
      etaCoverage,
      sourceCoverage,
      overallCoverage,
      nextStep: buildDataQualityNextStep(missingEtaTasks, missingSourceTasks),
    };
  }

  return {
    state: 'partial',
    label: '证据待补',
    headline,
    activeTasks: activeTaskCount,
    missingEtaTasks,
    missingSourceTasks,
    etaCoverage,
    sourceCoverage,
    overallCoverage,
    nextStep: buildDataQualityNextStep(missingEtaTasks, missingSourceTasks),
  };
}

function buildVisualizationMarkerTone(task: FishboneTask, now: Date): ProjectVisualizationMarkerTone {
  if (isCompletedStatus(task.status)) return 'complete';
  if (isBlockedStatus(task.status)) return 'critical';
  const delta = daysUntil(task.eta, now);
  if (delta !== null && delta < 0) return 'critical';
  if (delta !== null && delta <= 7) return 'warning';
  return 'neutral';
}

function buildVisualizationTaskDriver(
  task: FishboneTask,
  label: string,
  detail: string,
  tone: ProjectVisualizationMarkerTone,
  action?: ProjectVisualizationAction,
): ProjectVisualizationDriver {
  return {
    id: task.id,
    label,
    title: task.title || task.id,
    detail,
    tone,
    action: action || {
      label: '打开任务',
      taskId: task.id,
    },
  };
}

function buildGanttReadinessPanel(
  project: FishboneProject,
  now: Date,
): ProjectVisualizationPanel {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const activeTasks = tasks.filter((task) => !isCompletedStatus(task.status));
  const datedActiveTasks = activeTasks
    .map((task) => ({ task, date: parseDateOnly(task.eta) }))
    .filter((item): item is { task: FishboneTask; date: Date } => Boolean(item.date))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const datedMilestones = (Array.isArray(project.milestones) ? project.milestones : [])
    .map((milestone) => ({ milestone, date: parseDateOnly(milestone.date) }))
    .filter((item): item is { milestone: MilestonePoint; date: Date } => Boolean(item.date))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const allDates = [
    ...datedActiveTasks.map((item) => item.date),
    ...datedMilestones.map((item) => item.date),
  ];
  const missingEtaTasks = activeTasks.filter((task) => !parseDateOnly(task.eta));
  const firstMissingEta = missingEtaTasks[0];

  if (!activeTasks.length && !datedMilestones.length) {
    return {
      id: 'gantt',
      label: '甘特就绪度',
      state: 'empty',
      headline: '还没有可排期内容',
      detail: '项目缺少活动任务和带日期里程碑，当前只能作为待规划工作台。',
      metrics: ['0 个活动任务', '0 个日期锚点'],
      nextStep: '先拆出任务并补上 ETA 或里程碑日期',
    };
  }

  if (!allDates.length) {
    return {
      id: 'gantt',
      label: '甘特就绪度',
      state: 'attention',
      headline: '缺少可画时间轴的日期',
      detail: `${activeTasks.length} 个活动任务还没有 ETA，鱼骨位置不能代表真实排期。`,
      metrics: [`0/${activeTasks.length} 活动任务有 ETA`, '0 个里程碑有日期'],
      nextStep: '先补任务 ETA，再判断任务是否集中挤在同一里程碑前',
      action: firstMissingEta ? {
        label: '补 ETA',
        taskId: firstMissingEta.id,
        evidenceFocus: 'eta',
      } : undefined,
      drivers: missingEtaTasks.slice(0, 3).map((task) => buildVisualizationTaskDriver(
        task,
        '缺 ETA',
        '补 ETA 后才可生成可信时间轴',
        'warning',
        {
          label: '补 ETA',
          taskId: task.id,
          evidenceFocus: 'eta',
        },
      )),
    };
  }

  const earliest = allDates.reduce((min, date) => date < min ? date : min, allDates[0]);
  const latest = allDates.reduce((max, date) => date > max ? date : max, allDates[0]);
  const spanMs = Math.max(1, latest.getTime() - earliest.getTime());
  const markers = datedActiveTasks.slice(0, 4).map(({ task, date }): ProjectVisualizationMarker => ({
    id: task.id,
    label: task.title || task.id,
    detail: `${formatDateOnly(date)} · ${task.status || 'unknown'}`,
    position: allDates.length === 1
      ? 50
      : Math.round(((date.getTime() - earliest.getTime()) / spanMs) * 100),
    tone: buildVisualizationMarkerTone(task, now),
  }));
  const datedDrivers = datedActiveTasks.slice(0, 3).map(({ task, date }) => buildVisualizationTaskDriver(
    task,
    `ETA ${formatDateOnly(date)}`,
    `状态 ${task.status || 'unknown'}`,
    buildVisualizationMarkerTone(task, now),
  ));
  const missingEtaDrivers = missingEtaTasks.slice(0, Math.max(1, 3 - datedDrivers.length)).map((task) => buildVisualizationTaskDriver(
    task,
    '缺 ETA',
    '鱼骨位置不能代表真实排期',
    'warning',
    {
      label: '补 ETA',
      taskId: task.id,
      evidenceFocus: 'eta',
    },
  ));
  const rangeLabel = formatDateOnly(earliest) === formatDateOnly(latest)
    ? formatDateOnly(earliest)
    : `${formatDateOnly(earliest)} 至 ${formatDateOnly(latest)}`;

  if (missingEtaTasks.length) {
    return {
      id: 'gantt',
      label: '甘特就绪度',
      state: 'partial',
      headline: `可画 ${datedActiveTasks.length}/${activeTasks.length} 个活动任务`,
      detail: `时间范围 ${rangeLabel}；仍有 ${missingEtaTasks.length} 个活动任务缺 ETA。`,
      metrics: [
        `${datedActiveTasks.length}/${activeTasks.length} 活动任务有 ETA`,
        `${datedMilestones.length} 个里程碑有日期`,
        `缺 ETA ${missingEtaTasks.length}`,
      ],
      nextStep: '补齐缺 ETA 任务后再把鱼骨位置当作排期视图使用',
      action: firstMissingEta ? {
        label: '补 ETA',
        taskId: firstMissingEta.id,
        evidenceFocus: 'eta',
      } : undefined,
      markers,
      drivers: [
        ...datedDrivers,
        ...missingEtaDrivers,
      ],
    };
  }

  return {
    id: 'gantt',
    label: '甘特就绪度',
    state: 'ready',
    headline: `${datedActiveTasks.length} 个活动任务有 ETA`,
    detail: `时间范围 ${rangeLabel}；当前适合用鱼骨时间线做轻量排期检查。`,
    metrics: [
      `${datedActiveTasks.length}/${activeTasks.length} 活动任务有 ETA`,
      `${datedMilestones.length} 个里程碑有日期`,
      `范围 ${rangeLabel}`,
    ],
    nextStep: '继续维护 ETA 变化，并用状态复核确认计划仍有效',
    markers,
    drivers: datedDrivers,
  };
}

function buildDependencyReadinessPanel(project: FishboneProject): ProjectVisualizationPanel {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const activeDependencyTasks = tasks.filter(
    (task) => task.type === 'dep' && !isCompletedStatus(task.status),
  );
  const blockedDependencies = activeDependencyTasks.filter((task) => isBlockedStatus(task.status));
  const unsourcedDependencies = activeDependencyTasks.filter((task) => !hasTaskSourceEvidence(task));
  const firstActionTask = blockedDependencies[0] || unsourcedDependencies[0];
  const sourceReadyCount = activeDependencyTasks.length - unsourcedDependencies.length;
  const blockedDrivers = blockedDependencies.slice(0, 3).map((task) => buildVisualizationTaskDriver(
    task,
    '阻塞',
    hasTaskSourceEvidence(task)
      ? '已有来源；先确认 owner、解除条件和检查时间'
      : '缺 Jira 或平台来源；先补来源再确认解除条件',
    'critical',
    {
      label: hasTaskSourceEvidence(task) ? '打开依赖' : '补依赖来源',
      taskId: task.id,
      evidenceFocus: hasTaskSourceEvidence(task) ? undefined : 'source',
    },
  ));
  const unsourcedDrivers = unsourcedDependencies.slice(0, Math.max(1, 3 - blockedDrivers.length)).map((task) => buildVisualizationTaskDriver(
    task,
    '缺来源',
    '依赖图缺少可审阅的 Jira 或平台来源',
    'warning',
    {
      label: '补依赖来源',
      taskId: task.id,
      evidenceFocus: 'source',
    },
  ));
  const readyDrivers = activeDependencyTasks.slice(0, 3).map((task) => buildVisualizationTaskDriver(
    task,
    '可跟踪',
    '已有来源；可用状态和 ETA 扫描依赖风险',
    'neutral',
  ));

  if (!activeDependencyTasks.length) {
    return {
      id: 'dependencies',
      label: '依赖图',
      state: 'empty',
      headline: '没有单独标记依赖任务',
      detail: '当前项目没有活动 dependency 任务，依赖图只能显示为空。',
      metrics: ['0 个活动依赖', '0 个阻塞依赖'],
      nextStep: '如果存在跨团队或平台阻塞，把它建成依赖任务并关联来源',
    };
  }

  if (blockedDependencies.length) {
    return {
      id: 'dependencies',
      label: '依赖图',
      state: 'attention',
      headline: `${blockedDependencies.length} 个依赖被阻塞`,
      detail: summarizeTaskTitles(blockedDependencies, 2),
      metrics: [
        `${activeDependencyTasks.length} 个活动依赖`,
        `${blockedDependencies.length} 个阻塞`,
        `${sourceReadyCount}/${activeDependencyTasks.length} 有来源`,
      ],
      nextStep: '先确认阻塞依赖的 owner、解除条件和下一次检查时间',
      action: firstActionTask ? {
        label: '打开阻塞依赖',
        taskId: firstActionTask.id,
        evidenceFocus: hasTaskSourceEvidence(firstActionTask) ? undefined : 'source',
      } : undefined,
      drivers: [
        ...blockedDrivers,
        ...unsourcedDrivers,
      ],
    };
  }

  if (unsourcedDependencies.length) {
    return {
      id: 'dependencies',
      label: '依赖图',
      state: 'partial',
      headline: `${unsourcedDependencies.length} 个依赖缺来源`,
      detail: '依赖关系可以显示，但缺少 Jira 或平台来源会降低可审阅性。',
      metrics: [
        `${activeDependencyTasks.length} 个活动依赖`,
        '0 个阻塞',
        `${sourceReadyCount}/${activeDependencyTasks.length} 有来源`,
      ],
      nextStep: '给依赖任务补 Jira、平台状态或负责人后再对外同步状态',
      action: firstActionTask ? {
        label: '补依赖来源',
        taskId: firstActionTask.id,
        evidenceFocus: 'source',
      } : undefined,
      drivers: unsourcedDrivers,
    };
  }

  return {
    id: 'dependencies',
    label: '依赖图',
    state: 'ready',
    headline: `${activeDependencyTasks.length} 个依赖可跟踪`,
    detail: '活动依赖都有来源，当前适合用状态和 ETA 扫描阻塞风险。',
    metrics: [
      `${activeDependencyTasks.length} 个活动依赖`,
      '0 个阻塞',
      `${sourceReadyCount}/${activeDependencyTasks.length} 有来源`,
    ],
    nextStep: '继续维护依赖状态，阻塞时优先记录 owner 和解除条件',
    drivers: readyDrivers,
  };
}

function buildBurndownReadinessPanel(
  project: FishboneProject,
  now: Date,
): ProjectVisualizationPanel {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const completedTasks = tasks.filter((task) => isCompletedStatus(task.status));
  const activeTasks = tasks.filter((task) => !isCompletedStatus(task.status));
  const blockedTasks = activeTasks.filter((task) => isBlockedStatus(task.status));
  const overdueTasks = activeTasks.filter((task) => {
    const delta = daysUntil(task.eta, now);
    return delta !== null && delta < 0;
  });
  const missingEtaTasks = activeTasks.filter((task) => !parseDateOnly(task.eta));
  const completionPercent = calculateCoveragePercent(completedTasks.length, tasks.length);
  const actionTask = blockedTasks[0] || overdueTasks[0] || missingEtaTasks[0];
  const overdueOnlyTasks = overdueTasks.filter(
    (task) => !blockedTasks.some((blockedTask) => blockedTask.id === task.id),
  );
  const blockedDrivers = blockedTasks.slice(0, 3).map((task) => buildVisualizationTaskDriver(
    task,
    '阻塞',
    '阻塞项会让燃尽趋势失真',
    'critical',
    {
      label: '打开阻塞项',
      taskId: task.id,
    },
  ));
  const overdueDrivers = overdueOnlyTasks.slice(0, Math.max(1, 3 - blockedDrivers.length)).map((task) => buildVisualizationTaskDriver(
    task,
    '过期',
    `ETA ${task.eta || '未记录'} 已过，需要重新评估`,
    'critical',
    {
      label: '重估 ETA',
      taskId: task.id,
      evidenceFocus: 'eta',
    },
  ));
  const missingEtaDrivers = missingEtaTasks.slice(0, 3).map((task) => buildVisualizationTaskDriver(
    task,
    '缺 ETA',
    '剩余工作缺少时间锚点，只能显示完成率',
    'warning',
    {
      label: '补 ETA',
      taskId: task.id,
      evidenceFocus: 'eta',
    },
  ));
  const readyTasks = activeTasks.length ? activeTasks : completedTasks;
  const readyDrivers = readyTasks.slice(0, 3).map((task) => buildVisualizationTaskDriver(
    task,
    isCompletedStatus(task.status) ? '已完成' : '剩余',
    parseDateOnly(task.eta)
      ? `ETA ${task.eta}；状态 ${task.status || 'unknown'}`
      : `状态 ${task.status || 'unknown'}`,
    isCompletedStatus(task.status) ? 'complete' : buildVisualizationMarkerTone(task, now),
  ));

  if (!tasks.length) {
    return {
      id: 'burndown',
      label: '燃尽/完成',
      state: 'empty',
      headline: '还没有可燃尽任务',
      detail: '项目缺少任务，无法计算完成率或剩余工作。',
      metrics: ['0/0 已完成', '0 个未完成'],
      nextStep: '先把里程碑拆成可关闭的任务',
      progressPercent: 0,
    };
  }

  if (blockedTasks.length || overdueTasks.length) {
    return {
      id: 'burndown',
      label: '燃尽/完成',
      state: 'attention',
      headline: `${completionPercent}% 完成，${blockedTasks.length + overdueTasks.length} 个风险项`,
      detail: blockedTasks.length
        ? `${blockedTasks.length} 个未完成任务被阻塞`
        : `${overdueTasks.length} 个未完成任务已超过 ETA`,
      metrics: [
        `${completedTasks.length}/${tasks.length} 已完成`,
        `${activeTasks.length} 个未完成`,
        `${blockedTasks.length} 阻塞`,
        `${overdueTasks.length} 过期`,
      ],
      nextStep: blockedTasks.length
        ? '先处理阻塞项，再判断剩余工作是否仍能按期完成'
        : '先重估过期项 ETA，再更新状态草稿',
      action: actionTask ? {
        label: blockedTasks.length ? '打开阻塞项' : '重估 ETA',
        taskId: actionTask.id,
        evidenceFocus: blockedTasks.length ? undefined : 'eta',
      } : undefined,
      progressPercent: completionPercent,
      drivers: [
        ...blockedDrivers,
        ...overdueDrivers,
      ],
    };
  }

  if (missingEtaTasks.length) {
    return {
      id: 'burndown',
      label: '燃尽/完成',
      state: 'partial',
      headline: `${completionPercent}% 完成，剩余工作缺 ETA`,
      detail: `${missingEtaTasks.length} 个未完成任务没有 ETA，燃尽趋势只能作为完成率摘要。`,
      metrics: [
        `${completedTasks.length}/${tasks.length} 已完成`,
        `${activeTasks.length} 个未完成`,
        `缺 ETA ${missingEtaTasks.length}`,
      ],
      nextStep: '补齐未完成任务 ETA 后再判断进度是否偏离计划',
      action: actionTask ? {
        label: '补 ETA',
        taskId: actionTask.id,
        evidenceFocus: 'eta',
      } : undefined,
      progressPercent: completionPercent,
      drivers: missingEtaDrivers,
    };
  }

  return {
    id: 'burndown',
    label: '燃尽/完成',
    state: 'ready',
    headline: `${completionPercent}% 完成`,
    detail: `${activeTasks.length} 个未完成任务都有 ETA，当前可用完成率和临期任务判断节奏。`,
    metrics: [
      `${completedTasks.length}/${tasks.length} 已完成`,
      `${activeTasks.length} 个未完成`,
      '0 阻塞',
      '0 过期',
    ],
    nextStep: '继续关闭完成项并复核下一批 ETA',
    progressPercent: completionPercent,
    drivers: readyDrivers,
  };
}

export function buildProjectVisualizationSummary(
  project: FishboneProject,
  options: { now?: Date } = {},
): ProjectVisualizationSummary {
  const now = options.now || new Date();
  const panels = [
    buildGanttReadinessPanel(project, now),
    buildDependencyReadinessPanel(project),
    buildBurndownReadinessPanel(project, now),
  ];
  const attentionPanels = panels.filter((panel) => panel.state === 'attention');
  const partialPanels = panels.filter((panel) => panel.state === 'partial');
  const readyPanels = panels.filter((panel) => panel.state === 'ready');
  const priorityPanel = attentionPanels[0] || partialPanels[0] || panels[0];

  if (attentionPanels.length) {
    return {
      headline: `${attentionPanels.length} 个图表需要先处理风险或数据缺口`,
      nextStep: priorityPanel.nextStep,
      panels,
    };
  }

  if (partialPanels.length) {
    return {
      headline: `${readyPanels.length}/3 个图表数据已就绪`,
      nextStep: priorityPanel.nextStep,
      panels,
    };
  }

  return {
    headline: '图表数据可用',
    nextStep: '继续维护 ETA、依赖来源和完成状态',
    panels,
  };
}

function summarizeTaskTitles(tasks: FishboneTask[], maxItems = 2): string {
  const titles = tasks
    .map((task) => String(task.title || '').trim())
    .filter(Boolean)
    .slice(0, maxItems);

  const remaining = tasks.length - titles.length;
  return `${titles.join('、')}${remaining > 0 ? ` 等 ${tasks.length} 项` : ''}`;
}

export function buildProjectDecisionSummary(
  project: FishboneProject,
  options: { now?: Date; maxSignals?: number } = {},
): ProjectDecisionSummary {
  const now = options.now || new Date();
  const maxSignals = options.maxSignals ?? 5;
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const activeTasks = tasks.filter((task) => !isCompletedStatus(task.status));
  const health = buildProjectHealthSummary(project, now);
  const freshness = buildProjectFreshnessSummary(project, now);
  const review = buildProjectReviewSummary(project, now);
  const dataQuality = buildProjectDataQualitySummary(project);
  const signals: ProjectDecisionSignal[] = [];

  const blockedTasks = activeTasks.filter((task) => isBlockedStatus(task.status));
  const nonBlockedActiveTasks = activeTasks.filter((task) => !isBlockedStatus(task.status));
  if (blockedTasks.length) {
    signals.push({
      id: 'blocked',
      label: '阻塞',
      title: `${blockedTasks.length} 个任务被阻塞`,
      detail: summarizeTaskTitles(blockedTasks),
      severity: 'critical',
      priority: 0,
    });
  }

  const overdueTasks = nonBlockedActiveTasks.filter((task) => {
    const delta = daysUntil(task.eta, now);
    return delta !== null && delta < 0;
  });
  if (overdueTasks.length) {
    signals.push({
      id: 'overdue',
      label: '过期',
      title: `${overdueTasks.length} 个任务超过 ETA`,
      detail: summarizeTaskTitles(overdueTasks),
      severity: 'critical',
      priority: 1,
    });
  }

  const dueSoonTasks = nonBlockedActiveTasks.filter((task) => {
    const delta = daysUntil(task.eta, now);
    return delta !== null && delta >= 0 && delta <= 7;
  });
  if (dueSoonTasks.length) {
    signals.push({
      id: 'due-soon',
      label: '近 7 天',
      title: `${dueSoonTasks.length} 个任务即将到期`,
      detail: summarizeTaskTitles(dueSoonTasks),
      severity: 'warning',
      priority: 2,
    });
  }

  if (freshness.state === 'stale' || freshness.state === 'aging') {
    signals.push({
      id: 'stale-plan',
      label: freshness.label,
      title: freshness.headline,
      detail: freshness.nextStep,
      severity: freshness.state === 'stale' ? 'warning' : 'info',
      priority: 3,
    });
  } else if (freshness.state === 'unscheduled' && activeTasks.length) {
    signals.push({
      id: 'missing-timeline',
      label: freshness.label,
      title: freshness.headline,
      detail: freshness.nextStep,
      severity: 'info',
      priority: 3,
    });
  }

  if (review.state !== 'current') {
    signals.push({
      id: 'status-review',
      label: review.label,
      title: review.headline,
      detail: review.nextStep,
      severity: review.state === 'overdue' || review.state === 'unreviewed' ? 'warning' : 'info',
      priority: 4,
    });
  }

  const missingEtaTasks = activeTasks.filter((task) => !parseDateOnly(task.eta));
  if (missingEtaTasks.length) {
    signals.push({
      id: 'missing-eta',
      label: '数据缺口',
      title: `${missingEtaTasks.length} 个任务缺少 ETA`,
      detail: summarizeTaskTitles(missingEtaTasks),
      severity: 'info',
      priority: 5,
    });
  }

  const missingSourceTasks = activeTasks.filter((task) => !hasTaskSourceEvidence(task));
  if (missingSourceTasks.length) {
    signals.push({
      id: 'missing-source',
      label: '证据不足',
      title: `${missingSourceTasks.length} 个任务没有 Jira 或平台来源`,
      detail: summarizeTaskTitles(missingSourceTasks),
      severity: 'neutral',
      priority: 6,
    });
  }

  if (health.upcomingMilestone) {
    signals.push({
      id: 'upcoming-milestone',
      label: '里程碑',
      title: `${health.upcomingMilestone.label} ${health.upcomingMilestone.date}`,
      detail: health.upcomingMilestone.daysUntil === 0
        ? '今天到期'
        : `${health.upcomingMilestone.daysUntil} 天后到期`,
      severity: health.upcomingMilestone.daysUntil <= 7 ? 'warning' : 'info',
      priority: 7,
    });
  } else if (health.state === 'empty') {
    signals.push({
      id: 'empty-plan',
      label: '待规划',
      title: '还没有可跟踪任务',
      detail: project.milestones?.length ? '已有里程碑，等待拆解任务' : '先补充里程碑和任务',
      severity: 'info',
      priority: 7,
    });
  }

  const nextAction = (() => {
    if (blockedTasks.length) return '先确认阻塞负责人和解除条件';
    if (overdueTasks.length) return '重估过期任务 ETA 并同步里程碑';
    if (dueSoonTasks.length) return '检查近 7 天任务的资源和排期';
    if (freshness.state === 'stale') return '先刷新项目 ETA / 里程碑，确认计划仍有效';
    if (freshness.state === 'aging') return '复核项目计划日期，补上下一次检查点';
    if (review.state === 'overdue' || review.state === 'unreviewed') return '复核状态草稿并记录本次项目检查';
    if (review.state === 'due') return '快速复核项目状态，确认是否需要同步更新';
    if (missingEtaTasks.length) return '补齐任务 ETA，避免风险被低估';
    if (health.state === 'empty') return '先把里程碑拆成可跟踪任务';
    if (missingSourceTasks.length) return '补充 Jira 或平台来源，方便回溯';
    return '维持当前节奏，下一次更新前补充新证据';
  })();

  return {
    nextAction,
    signals: signals
      .sort((a, b) => {
        const priorityDelta = a.priority - b.priority;
        if (priorityDelta !== 0) return priorityDelta;
        return a.title.localeCompare(b.title);
      })
      .slice(0, maxSignals),
    dataQuality,
    dataGaps: {
      missingEtaTasks: missingEtaTasks.length,
      missingSourceTasks: missingSourceTasks.length,
    },
  };
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
  risk: ProjectTaskRiskSummary;
}> {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];

  return tasks
    .map((task) => {
      const risk = buildProjectTaskRiskSummary(project, task, { now });

      if (isBlockedStatus(task.status)) {
        return {
          task,
          label: '阻塞',
          detail: task.eta ? `ETA ${task.eta}` : '需要明确负责人或解除条件',
          priority: 0,
          risk,
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
          risk,
        };
      }

      if (delta <= 7) {
        return {
          task,
          label: '近 7 天到期',
          detail: delta === 0 ? '今天到期' : `${delta} 天后到期`,
          priority: 2,
          risk,
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
        risk: ProjectTaskRiskSummary;
      } => Boolean(item),
    )
    .sort((a, b) => {
      const priorityDelta = a.priority - b.priority;
      if (priorityDelta !== 0) return priorityDelta;
      const riskDelta = b.risk.score - a.risk.score;
      if (riskDelta !== 0) return riskDelta;
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
  const freshness = buildProjectFreshnessSummary(project, now);
  const review = buildProjectReviewSummary(project, now);
  const dataQuality = buildProjectDataQualitySummary(project);
  const attentionTasks = buildStatusDraftAttentionTasks(project, now, maxItems);

  attentionTasks.forEach(({ task, label, detail, priority, risk }) => {
    const sourceSummary = buildProjectTaskSourceSummary(task);
    const sourceDetail = sourceSummary.jiraKeys.length
      ? `；Jira ${sourceSummary.jiraKeys.join(', ')}`
      : sourceSummary.platformSourceLabels.length
        ? `；平台来源 ${sourceSummary.platformSourceLabels.join(', ')}`
        : '';
    evidence.push({
      type: 'task',
      label,
      title: task.title,
      detail: `${detail}；${risk.label} ${risk.score}/100${sourceDetail}`,
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

  if (freshness.state !== 'fresh') {
    evidence.push({
      type: 'freshness',
      label: freshness.label,
      title: freshness.latestDate ? `最近计划日期 ${freshness.latestDate}` : '项目时间线',
      detail: `${freshness.headline}；${freshness.nextStep}`,
      source: '本地任务 ETA / 里程碑日期',
      priority: freshness.state === 'stale' ? 2 : 3,
    });
  }

  if (review.state !== 'current') {
    const nextDueDetail = review.nextDueDate ? `；下次复核 ${review.nextDueDate}` : '';
    evidence.push({
      type: 'review',
      label: review.label,
      title: review.lastReviewedAt ? `上次复核 ${formatDateOnly(parseDateTime(review.lastReviewedAt) || now)}` : '状态复核记录',
      detail: `${review.headline}；${review.nextStep}${nextDueDetail}`,
      source: '本地状态复核时间',
      priority: review.state === 'overdue' || review.state === 'unreviewed' ? 2 : 3,
    });
  }

  if (dataQuality.state === 'partial' || dataQuality.state === 'poor') {
    evidence.push({
      type: 'data-quality',
      label: dataQuality.label,
      title: `${dataQuality.overallCoverage}% 覆盖`,
      detail: `${dataQuality.missingEtaTasks} 个缺 ETA，${dataQuality.missingSourceTasks} 个缺来源；${dataQuality.nextStep}`,
      source: '本地任务 ETA / Jira / 平台来源',
      priority: dataQuality.state === 'poor' ? 2 : 3,
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
  const freshness = buildProjectFreshnessSummary(project, now);
  const review = buildProjectReviewSummary(project, now);
  const dataQuality = buildProjectDataQualitySummary(project);
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
    `数据新鲜度：${freshness.label} - ${freshness.headline}`,
    `状态复核：${review.label} - ${review.headline}${review.nextDueDate ? `；下次复核 ${review.nextDueDate}` : ''}`,
    `证据覆盖：${dataQuality.label} - ${dataQuality.headline}`,
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
    attentionTasks.forEach(({ task, label, detail, risk }) => {
      const sourceSummary = buildProjectTaskSourceSummary(task);
      const evidence = sourceSummary.jiraKeys.length
        ? `；Jira ${sourceSummary.jiraKeys.join(', ')}`
        : sourceSummary.platformSourceLabels.length
          ? `；平台来源 ${sourceSummary.platformSourceLabels.join(', ')}`
          : '';
      lines.push(`- [${label}] ${task.title} (${detail}；${risk.label} ${risk.score}/100${evidence})`);
    });
  }

  lines.push('', '建议下一步：');
  if (health.blockedTasks > 0) {
    lines.push('- 先确认阻塞项负责人、解除条件和下一次检查时间。');
  } else if (health.overdueTasks > 0) {
    lines.push('- 重新确认过期任务 ETA，并同步受影响的里程碑。');
  } else if (health.dueSoonTasks > 0) {
    lines.push('- 检查近 7 天到期任务是否需要资源或排期调整。');
  } else if (review.state !== 'current') {
    lines.push('- 完成本次状态复核后，记录复核时间，避免正常项目长期无人检查。');
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
  if ('lastStatusReviewAt' in next && typeof next.lastStatusReviewAt !== 'string') {
    next.lastStatusReviewAt = undefined;
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

      const sources: ProjectSyncSourceStatus[] = [];
      let summary = '真实 Jira/GitHub/Confluence 数据源尚未接入；当前显示的是本地项目工作台数据。';
      let localCoverage = buildProjectSyncLocalCoverage(this.fishboneProjects);

      try {
        const client = getMemoryServiceClient();
        const watchedProjects = await client.getWatchedProjects(true);
        const syncResult = mergeWatchedProjectsIntoDashboard(this.fishboneProjects, watchedProjects);
        this.fishboneProjects = syncResult.projects;
        localCoverage = buildProjectSyncLocalCoverage(this.fishboneProjects);
        const highlights = buildWatchedProjectSyncHighlights(syncResult);
        const highlightDetail = highlights.length ? ` ${highlights.join('；')}。` : '';

        if (syncResult.createdProjectCount > 0) {
          await this.persistFishboneProjects();
        }

        summary = syncResult.createdProjectCount > 0
          ? `已从 Memory Service 关注项目新增 ${syncResult.createdProjectCount} 个本地工作台，已匹配 ${syncResult.matchedProjectCount} 个。`
          : `已检查 Memory Service 关注项目：${syncResult.matchedProjectCount}/${syncResult.watchedProjectCount} 个已在本地工作台。`;

        sources.push({
          source: 'memory',
          label: 'Memory Service',
          configured: true,
          status: 'ready',
          badge: '可读取',
          detail: [
            `读取 ${syncResult.watchedProjectCount} 个 active watched projects`,
            `新增 ${syncResult.createdProjectCount} 个`,
            `匹配 ${syncResult.matchedProjectCount} 个。${highlightDetail}`,
          ].join('；').trim(),
          nextStep: syncResult.createdProjectCount > 0
            ? '为新增项目补充里程碑、任务 ETA 和来源证据'
            : '继续在本地维护里程碑、任务 ETA 和来源证据',
          highlights,
          diagnostics: buildMemorySourceDiagnostics(localCoverage),
          boundaries: [
            '只补齐本地工作台，不删除本地项目，也不反写 Memory Service',
            '不包含 Jira/GitHub/Confluence 的真实任务状态',
          ],
        });
      } catch (error: any) {
        sources.push({
          source: 'memory',
          label: 'Memory Service',
          configured: true,
          status: 'unavailable',
          badge: '暂不可用',
          detail: `Memory Service 已配置，但本次无法读取 watched projects：${error?.message || '服务不可用'}`,
          nextStep: '确认记忆服务地址、API Key 和本机 memory-service 是否可用',
          diagnostics: buildMemorySourceDiagnostics(localCoverage),
          boundaries: [
            '当前保留本地工作台数据，不会清空或覆盖项目',
            'Jira/GitHub/Confluence 状态仍不会参与本次检查',
          ],
        });
        summary = 'Memory Service 关注项目暂不可用；当前仍显示本地项目工作台数据。';
      }

      sources.push(
        {
          source: 'jira',
          label: 'Jira',
          configured: false,
          status: 'not_configured',
          badge: '未接入',
          detail: `尚未接入真实 Jira 项目同步；当前只能读取本地手动 Jira / 平台来源证据`,
          nextStep: localCoverage.tasksMissingSource.length
            ? `先补 ${localCoverage.tasksMissingSource.length} 个缺来源任务的 Jira、平台状态或负责人`
            : '本地来源证据已补齐，可作为后续真实 Jira 映射种子',
          diagnostics: buildJiraSourceDiagnostics(localCoverage),
          boundaries: [
            '不会读取 Jira 任务、状态、负责人或评论',
            '当前 Jira 链接只作为手动来源证据',
          ],
        },
        {
          source: 'github',
          label: 'GitHub',
          configured: false,
          status: 'not_configured',
          badge: '未接入',
          detail: '尚未接入 GitHub PR / commit 同步',
          nextStep: '后续可按项目仓库映射接入 PR 状态',
          diagnostics: [
            '未配置项目仓库映射，当前不会用代码活动修正项目健康判断',
            ...buildPlatformSourceDiagnostics(localCoverage),
          ],
          boundaries: [
            '不会读取 PR、commit、release 或 issue 状态',
            '不会用代码活动自动更新项目健康判断',
          ],
        },
        {
          source: 'confluence',
          label: 'Confluence',
          configured: false,
          status: 'not_configured',
          badge: '未接入',
          detail: '尚未接入 Confluence 页面同步',
          nextStep: '后续可按项目空间或页面链接同步状态材料',
          diagnostics: [
            '未配置空间/页面映射，状态草稿不会引用决策记录或状态报告',
            ...buildPlatformSourceDiagnostics(localCoverage),
          ],
          boundaries: [
            '不会读取页面、决策记录或状态报告',
            '状态草稿仍只引用本地任务和手动来源',
          ],
        },
      );

      return {
        success: true,
        checkedAt: new Date().toISOString(),
        summary,
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
        platformConfig: data.platformConfig?.length ? data.platformConfig : DEFAULT_PROJECT_PLATFORM_CONFIG,
        lastStatusReviewAt: new Date().toISOString(),
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
