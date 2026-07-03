export interface ProjectReportPlatformState {
  status: string;
  assignee?: string;
  jira?: string;
}

export interface ProjectReportTask {
  id: string;
  type: string;
  title: string;
  status: string;
  eta?: string;
  desc?: string;
  anchorPosition?: number;
  dependencies?: string[];
  platforms?: Record<string, ProjectReportPlatformState>;
  jira?: Array<{ key: string; title: string }>;
}

export interface ProjectReportMilestone {
  id: string;
  label: string;
  date?: string;
}

export interface ProjectReportProject {
  id: string;
  name: string;
  description?: string;
  milestones: ProjectReportMilestone[];
  tasks: ProjectReportTask[];
  platformConfig?: string[];
  lastStatusReviewAt?: string;
}

export type ProjectReportScope = 'single_project' | 'all_projects';
export type ProjectReportImportMode = 'merge' | 'replace';

export interface ProjectReportMetadata {
  version: string;
  exportType: 'project_dashboard_report';
  scope: ProjectReportScope;
  exportedAt: string;
  exportedTimestamp: number;
  source: 'dashboard_memory';
}

export interface ProjectReportSummary {
  projectId: string;
  projectName: string;
  description?: string;
  totalMilestones: number;
  totalTasks: number;
  taskStatusCounts: Record<string, number>;
  taskTypeCounts: Record<string, number>;
  platformStatusCounts: Record<string, number>;
  jiraIssueCount: number;
}

export interface ProjectReportEntry {
  project: ProjectReportProject;
  summary: ProjectReportSummary;
}

export interface ProjectReportFile {
  metadata: ProjectReportMetadata;
  summary: {
    totalProjects: number;
    totalMilestones: number;
    totalTasks: number;
  };
  projects: ProjectReportEntry[];
}

export interface ImportProjectReportResult {
  report: ProjectReportFile;
  projects: ProjectReportProject[];
  stats: {
    importedProjectCount: number;
    createdProjectCount: number;
    updatedProjectCount: number;
    retainedProjectCount: number;
    removedProjectCount: number;
  };
}

const PROJECT_REPORT_VERSION = '1.0.0';

function normalizeToken(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  if (!normalized) return fallback;

  const aliasMap: Record<string, string> = {
    inprogress: 'progress',
    in_progress: 'progress',
    ongoing: 'progress',
    started: 'progress',
    completed: 'closed',
    complete: 'closed',
    done: 'closed',
    finished: 'closed',
    testbuild: 'test_build',
    test_build: 'test_build',
    blocked_by: 'blocked',
    waiting: 'pending',
    queued: 'pending',
    planned: 'todo',
    open: 'todo',
  };

  return aliasMap[normalized] || normalized;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizePlatformState(platform: any): ProjectReportPlatformState {
  return {
    status: typeof platform?.status === 'string' ? platform.status : 'unknown',
    assignee: typeof platform?.assignee === 'string' ? platform.assignee : undefined,
    jira: typeof platform?.jira === 'string' ? platform.jira : undefined,
  };
}

function sanitizeTask(task: any): ProjectReportTask {
  const platforms =
    task?.platforms && typeof task.platforms === 'object'
      ? Object.keys(task.platforms).reduce<Record<string, ProjectReportPlatformState>>((acc, key) => {
          acc[key] = sanitizePlatformState(task.platforms[key]);
          return acc;
        }, {})
      : undefined;

  const jira = Array.isArray(task?.jira)
    ? task.jira
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => ({
          key: typeof item.key === 'string' ? item.key : '',
          title: typeof item.title === 'string' ? item.title : '',
        }))
        .filter((item) => item.key || item.title)
    : undefined;
  const dependencies = Array.isArray(task?.dependencies)
    ? task.dependencies
        .map((item: any) => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean)
    : undefined;

  return {
    id: typeof task?.id === 'string' ? task.id : '',
    type: typeof task?.type === 'string' ? task.type : 'task',
    title: typeof task?.title === 'string' ? task.title : '',
    status: typeof task?.status === 'string' ? task.status : 'unknown',
    eta: typeof task?.eta === 'string' ? task.eta : undefined,
    desc: typeof task?.desc === 'string' ? task.desc : undefined,
    anchorPosition:
      typeof task?.anchorPosition === 'number' && Number.isFinite(task.anchorPosition)
        ? Math.max(0, Math.min(100, task.anchorPosition))
        : undefined,
    dependencies,
    platforms,
    jira,
  };
}

function sanitizeMilestone(milestone: any): ProjectReportMilestone {
  return {
    id: typeof milestone?.id === 'string' ? milestone.id : '',
    label: typeof milestone?.label === 'string' ? milestone.label : '',
    date: typeof milestone?.date === 'string' ? milestone.date : undefined,
  };
}

export function sanitizeProject(project: any): ProjectReportProject {
  return {
    id: typeof project?.id === 'string' ? project.id : '',
    name: typeof project?.name === 'string' ? project.name : '',
    description: typeof project?.description === 'string' ? project.description : undefined,
    milestones: Array.isArray(project?.milestones) ? project.milestones.map(sanitizeMilestone) : [],
    tasks: Array.isArray(project?.tasks) ? project.tasks.map(sanitizeTask) : [],
    platformConfig: Array.isArray(project?.platformConfig)
      ? project.platformConfig.filter((item: any) => typeof item === 'string')
      : undefined,
    lastStatusReviewAt:
      typeof project?.lastStatusReviewAt === 'string' ? project.lastStatusReviewAt : undefined,
  };
}

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] || 0) + 1;
}

export function buildProjectSummary(project: ProjectReportProject): ProjectReportSummary {
  const safeProject = sanitizeProject(project);
  const taskStatusCounts: Record<string, number> = {};
  const taskTypeCounts: Record<string, number> = {};
  const platformStatusCounts: Record<string, number> = {};

  let jiraIssueCount = 0;

  safeProject.tasks.forEach((task) => {
    incrementCounter(taskStatusCounts, normalizeToken(task.status, 'unknown'));
    incrementCounter(taskTypeCounts, normalizeToken(task.type, 'task'));
    jiraIssueCount += task.jira?.length || 0;

    if (task.platforms) {
      Object.values(task.platforms).forEach((platform) => {
        incrementCounter(platformStatusCounts, normalizeToken(platform?.status, 'unknown'));
      });
    }
  });

  return {
    projectId: safeProject.id,
    projectName: safeProject.name,
    description: safeProject.description,
    totalMilestones: safeProject.milestones.length,
    totalTasks: safeProject.tasks.length,
    taskStatusCounts,
    taskTypeCounts,
    platformStatusCounts,
    jiraIssueCount,
  };
}

function buildExportSummary(projects: ProjectReportProject[]): ProjectReportFile['summary'] {
  return projects.reduce(
    (acc, project) => {
      acc.totalProjects += 1;
      acc.totalMilestones += project.milestones.length;
      acc.totalTasks += project.tasks.length;
      return acc;
    },
    { totalProjects: 0, totalMilestones: 0, totalTasks: 0 },
  );
}

export function buildProjectReport(
  projects: ProjectReportProject[],
  options?: {
    scope?: ProjectReportScope;
    exportedAt?: Date;
  },
): ProjectReportFile {
  const safeProjects = projects.map((project) => sanitizeProject(project));
  const exportedAt = options?.exportedAt || new Date();
  const scope = options?.scope || (safeProjects.length === 1 ? 'single_project' : 'all_projects');

  return {
    metadata: {
      version: PROJECT_REPORT_VERSION,
      exportType: 'project_dashboard_report',
      scope,
      exportedAt: exportedAt.toISOString(),
      exportedTimestamp: exportedAt.getTime(),
      source: 'dashboard_memory',
    },
    summary: buildExportSummary(safeProjects),
    projects: safeProjects.map((project) => ({
      project: cloneJsonValue(project),
      summary: buildProjectSummary(project),
    })),
  };
}

export function serializeProjectReport(report: ProjectReportFile): string {
  return JSON.stringify(report, null, 2);
}

export function buildProjectReportFileName(scope: ProjectReportScope, projectId?: string, exportedAt?: Date): string {
  const timestamp = (exportedAt || new Date()).toISOString().slice(0, 19).replace(/[:.]/g, '-');
  if (scope === 'single_project' && projectId) {
    return `project-report-${projectId}-${timestamp}.json`;
  }

  return `project-report-all-${timestamp}.json`;
}

function parseLegacySingleProjectReport(parsed: any): ProjectReportFile | null {
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.projectName !== 'string' ||
    !Array.isArray(parsed.milestones) ||
    !Array.isArray(parsed.tasks)
  ) {
    return null;
  }

  const exportedAt =
    typeof parsed.generatedAt === 'string' && parsed.generatedAt
      ? new Date(parsed.generatedAt)
      : new Date();
  const projectId = normalizeToken(parsed.projectName, 'imported_project');
  const legacyProject = sanitizeProject({
    id: projectId,
    name: parsed.projectName,
    milestones: parsed.milestones,
    tasks: parsed.tasks,
  });

  return buildProjectReport([legacyProject], {
    scope: 'single_project',
    exportedAt: exportedAt,
  });
}

export function parseProjectReport(content: string): ProjectReportFile {
  let parsed: any;

  try {
    parsed = JSON.parse(content);
  } catch (error: any) {
    throw new Error(`项目报告 JSON 解析失败: ${error.message}`);
  }

  const legacyReport = parseLegacySingleProjectReport(parsed);
  if (legacyReport) {
    return legacyReport;
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('项目报告内容无效');
  }

  if (parsed?.metadata?.exportType !== 'project_dashboard_report') {
    throw new Error('不支持的项目报告类型');
  }

  if (!Array.isArray(parsed.projects)) {
    throw new Error('项目报告缺少 projects 数组');
  }

  const seenProjectIds = new Set<string>();
  const projects = parsed.projects.map((entry: any, index: number) => {
    const project = sanitizeProject(entry?.project);
    if (!project.id || !project.name) {
      throw new Error(`项目报告中的第 ${index + 1} 个项目缺少 id 或 name`);
    }
    if (seenProjectIds.has(project.id)) {
      throw new Error(`项目报告中存在重复的项目 id: ${project.id}`);
    }
    seenProjectIds.add(project.id);

    return {
      project,
      summary: buildProjectSummary(project),
    };
  });

  return {
    metadata: {
      version: typeof parsed.metadata?.version === 'string' ? parsed.metadata.version : PROJECT_REPORT_VERSION,
      exportType: 'project_dashboard_report',
      scope: parsed.metadata?.scope === 'single_project' ? 'single_project' : 'all_projects',
      exportedAt:
        typeof parsed.metadata?.exportedAt === 'string' ? parsed.metadata.exportedAt : new Date().toISOString(),
      exportedTimestamp:
        typeof parsed.metadata?.exportedTimestamp === 'number'
          ? parsed.metadata.exportedTimestamp
          : Date.now(),
      source: 'dashboard_memory',
    },
    summary: buildExportSummary(projects.map((entry) => entry.project)),
    projects,
  };
}

export function importProjectsFromReport(
  currentProjects: ProjectReportProject[],
  reportOrContent: ProjectReportFile | string,
  options?: { mode?: ProjectReportImportMode },
): ImportProjectReportResult {
  const report = typeof reportOrContent === 'string' ? parseProjectReport(reportOrContent) : buildProjectReport(
    reportOrContent.projects.map((entry) => entry.project),
    {
      scope: reportOrContent.metadata.scope,
      exportedAt: new Date(reportOrContent.metadata.exportedAt),
    },
  );
  const mode = options?.mode || 'merge';
  const safeCurrentProjects = currentProjects.map((project) => sanitizeProject(project));
  const importedProjects = report.projects.map((entry) => sanitizeProject(entry.project));

  let createdProjectCount = 0;
  let updatedProjectCount = 0;
  let retainedProjectCount = 0;
  let removedProjectCount = 0;

  let nextProjects: ProjectReportProject[] = [];

  if (mode === 'replace') {
    const existingIds = new Set(safeCurrentProjects.map((project) => project.id));
    const importedIds = new Set(importedProjects.map((project) => project.id));

    importedProjects.forEach((project) => {
      if (existingIds.has(project.id)) {
        updatedProjectCount += 1;
      } else {
        createdProjectCount += 1;
      }
    });

    safeCurrentProjects.forEach((project) => {
      if (!importedIds.has(project.id)) {
        removedProjectCount += 1;
      }
    });

    nextProjects = importedProjects.map((project) => cloneJsonValue(project));
  } else {
    const importedMap = new Map<string, ProjectReportProject>();
    importedProjects.forEach((project) => {
      importedMap.set(project.id, cloneJsonValue(project));
    });

    nextProjects = safeCurrentProjects.map((project) => {
      const imported = importedMap.get(project.id);
      if (imported) {
        importedMap.delete(project.id);
        updatedProjectCount += 1;
        return cloneJsonValue(imported);
      }

      retainedProjectCount += 1;
      return cloneJsonValue(project);
    });

    importedMap.forEach((project) => {
      createdProjectCount += 1;
      nextProjects.push(cloneJsonValue(project));
    });
  }

  return {
    report,
    projects: nextProjects,
    stats: {
      importedProjectCount: importedProjects.length,
      createdProjectCount,
      updatedProjectCount,
      retainedProjectCount,
      removedProjectCount,
    },
  };
}
