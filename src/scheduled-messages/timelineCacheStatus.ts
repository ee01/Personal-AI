export type TimelineCacheProjectStatusCode = 'ready' | 'missing' | 'expired' | 'invalid' | 'error';

export interface TimelineCacheProjectStatus {
  project: string;
  paramKey: string;
  cached: boolean;
  valid: boolean;
  expired: boolean;
  status: TimelineCacheProjectStatusCode;
  updatedAt?: string;
  ageMs?: number | null;
  expiresAt?: string;
  milestoneKeys?: string[];
  error?: string;
  lastAttempt?: TimelineCacheSyncAttempt;
}

export interface TimelineCacheSyncAttempt {
  success: boolean;
  attemptedAt?: string;
  ageMs?: number | null;
  errorCode?: string;
  error?: string;
  parseError?: string;
  requestContentType?: string;
  nextAction?: string;
  requestBodyBytes?: number;
  payloadBytes?: number;
  maxBytes?: number;
  milestoneCount?: number;
  milestoneKeys?: string[];
}

export interface TimelineCacheStatus {
  success: boolean;
  generatedAt: string;
  maxAgeMs: number;
  totalProjects: number;
  readyProjects: number;
  missingProjects: number;
  staleProjects: number;
  allProjectsReady: boolean;
  projects: TimelineCacheProjectStatus[];
  error?: string;
}

export const TIMELINE_CACHE_AUTO_REFRESH_MIN_INTERVAL_MS = 5000;

const TIMELINE_CACHE_STATUS_CODES: TimelineCacheProjectStatusCode[] = [
  'ready',
  'missing',
  'expired',
  'invalid',
  'error',
];

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOptionalFiniteNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function summarizeResponseSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function buildNonJsonTimelineCacheStatusError(responseText: string): string {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return 'Timeline 缓存状态响应为空，请确认 App Script Web App 已重新部署并允许扩展访问。';
  }

  const snippet = summarizeResponseSnippet(trimmed);
  if (/^(<!doctype\s+html|<html|<head|<body|<)/i.test(trimmed)) {
    return `Timeline 缓存状态响应是 HTML 页面，通常是 App Script 部署 URL、权限或登录页问题。请重新部署最新 App Script 后再刷新状态。响应片段：${snippet}`;
  }

  return `Timeline 缓存状态响应不是 JSON，请确认 App Script Web App URL 指向最新部署。响应片段：${snippet}`;
}

function isTimelineCacheProjectStatusCode(value: unknown): value is TimelineCacheProjectStatusCode {
  return typeof value === 'string' && TIMELINE_CACHE_STATUS_CODES.indexOf(value as TimelineCacheProjectStatusCode) !== -1;
}

function normalizeMilestoneKeys(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
}

function normalizeTimelineCacheSyncAttempt(value: unknown): TimelineCacheSyncAttempt | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const attempt: TimelineCacheSyncAttempt = {
    success: value.success === true,
  };
  const attemptedAt = getString(value.attemptedAt).trim();
  const errorCode = getString(value.errorCode).trim();
  const error = getString(value.error).trim();
  const parseError = getString(value.parseError).trim();
  const requestContentType = getString(value.requestContentType).trim();
  const nextAction = getString(value.nextAction).trim();
  const ageMs = getOptionalFiniteNumber(value.ageMs);
  const requestBodyBytes = getOptionalFiniteNumber(value.requestBodyBytes);
  const payloadBytes = getOptionalFiniteNumber(value.payloadBytes);
  const maxBytes = getOptionalFiniteNumber(value.maxBytes);
  const milestoneCount = getOptionalFiniteNumber(value.milestoneCount);
  const milestoneKeys = normalizeMilestoneKeys(value.milestoneKeys);

  if (attemptedAt) {
    attempt.attemptedAt = attemptedAt;
  }
  if (ageMs !== undefined) {
    attempt.ageMs = ageMs;
  }
  if (errorCode) {
    attempt.errorCode = errorCode;
  }
  if (error) {
    attempt.error = error;
  }
  if (parseError) {
    attempt.parseError = parseError;
  }
  if (requestContentType) {
    attempt.requestContentType = requestContentType;
  }
  if (nextAction) {
    attempt.nextAction = nextAction;
  }
  if (requestBodyBytes !== undefined && requestBodyBytes !== null) {
    attempt.requestBodyBytes = requestBodyBytes;
  }
  if (payloadBytes !== undefined && payloadBytes !== null) {
    attempt.payloadBytes = payloadBytes;
  }
  if (maxBytes !== undefined && maxBytes !== null) {
    attempt.maxBytes = maxBytes;
  }
  if (milestoneCount !== undefined && milestoneCount !== null) {
    attempt.milestoneCount = milestoneCount;
  }
  if (milestoneKeys) {
    attempt.milestoneKeys = milestoneKeys;
  }

  return attempt;
}

function normalizeProjectStatus(value: unknown): TimelineCacheProjectStatus | null {
  if (!isRecord(value)) {
    return null;
  }

  const project = getString(value.project).trim();
  const paramKey = getString(value.paramKey).trim();
  const status = isTimelineCacheProjectStatusCode(value.status) ? value.status : undefined;

  if (!project || !paramKey || !status) {
    return null;
  }

  const normalized: TimelineCacheProjectStatus = {
    project,
    paramKey,
    cached: value.cached === true,
    valid: value.valid === true,
    expired: value.expired === true,
    status,
  };
  const updatedAt = getString(value.updatedAt).trim();
  const expiresAt = getString(value.expiresAt).trim();
  const error = getString(value.error).trim();
  const ageMs = getOptionalFiniteNumber(value.ageMs);
  const milestoneKeys = normalizeMilestoneKeys(value.milestoneKeys);
  const lastAttempt = normalizeTimelineCacheSyncAttempt(value.lastAttempt);

  if (updatedAt) {
    normalized.updatedAt = updatedAt;
  }
  if (ageMs !== undefined) {
    normalized.ageMs = ageMs;
  }
  if (expiresAt) {
    normalized.expiresAt = expiresAt;
  }
  if (milestoneKeys) {
    normalized.milestoneKeys = milestoneKeys;
  }
  if (error) {
    normalized.error = error;
  }
  if (lastAttempt) {
    normalized.lastAttempt = lastAttempt;
  }

  return normalized;
}

export function validateTimelineCacheStatusResponse(data: unknown): TimelineCacheStatus {
  if (!isRecord(data)) {
    throw new Error('Timeline 缓存状态响应格式异常，请刷新状态后重试。');
  }

  if (data.success === false) {
    throw new Error(getString(data.error).trim() || 'Timeline 缓存状态读取失败');
  }

  const statusText = getString(data.status).trim().toUpperCase();
  if (statusText === 'ERROR') {
    throw new Error(
      getString(data.error).trim() ||
      getString(data.message).trim() ||
      'Timeline 缓存状态读取失败'
    );
  }

  if (data.success !== true || !Array.isArray(data.projects)) {
    throw new Error('当前 App Script 尚不支持 Timeline 缓存状态，请先升级 App Script 并重新配置 Timeline Sync Rule。');
  }

  const projects = data.projects.map(normalizeProjectStatus);
  if (projects.some(project => project === null)) {
    throw new Error('Timeline 缓存状态响应格式异常，请升级 App Script 后重试。');
  }

  const normalizedProjects = projects as TimelineCacheProjectStatus[];
  const readyProjectCount = normalizedProjects.filter(project => project.status === 'ready').length;
  const missingProjectCount = normalizedProjects.filter(project => project.status === 'missing').length;
  const staleProjectCount = normalizedProjects.filter(project =>
    project.status === 'expired' || project.status === 'invalid' || project.status === 'error'
  ).length;
  const totalProjects = getFiniteNumber(data.totalProjects, normalizedProjects.length);
  const readyProjects = getFiniteNumber(data.readyProjects, readyProjectCount);

  return {
    success: true,
    generatedAt: getString(data.generatedAt).trim() || new Date().toISOString(),
    maxAgeMs: getFiniteNumber(data.maxAgeMs, 0),
    totalProjects,
    readyProjects,
    missingProjects: getFiniteNumber(data.missingProjects, missingProjectCount),
    staleProjects: getFiniteNumber(data.staleProjects, staleProjectCount),
    allProjectsReady: data.allProjectsReady === true || (totalProjects > 0 && readyProjects === totalProjects),
    projects: normalizedProjects,
  };
}

export function parseTimelineCacheStatusResponseText(responseText: string): TimelineCacheStatus {
  try {
    return validateTimelineCacheStatusResponse(JSON.parse(responseText));
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(buildNonJsonTimelineCacheStatusError(responseText));
    }

    throw error;
  }
}

export function shouldAutoRefreshTimelineCacheStatus(input: {
  enabled: boolean;
  isLoading: boolean;
  nowMs: number;
  lastRefreshAtMs?: number | null;
}): boolean {
  if (!input.enabled || input.isLoading) {
    return false;
  }

  const lastRefreshAtMs = input.lastRefreshAtMs;
  if (typeof lastRefreshAtMs !== 'number' || !Number.isFinite(lastRefreshAtMs) || lastRefreshAtMs <= 0) {
    return true;
  }

  return input.nowMs - lastRefreshAtMs >= TIMELINE_CACHE_AUTO_REFRESH_MIN_INTERVAL_MS;
}

export function formatTimelineCacheAge(ageMs?: number | null): string {
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs)) {
    return '未知时间';
  }

  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }

  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function formatTimelineCacheByteCount(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)}B`;
  }

  const kb = bytes / 1024;
  return `${kb >= 10 ? Math.round(kb) : Math.round(kb * 10) / 10}KB`;
}

function formatTimelineCacheAttemptDetails(attempt: TimelineCacheSyncAttempt): string {
  const details: string[] = [];
  const requestBodyBytes = formatTimelineCacheByteCount(attempt.requestBodyBytes);
  const payloadBytes = formatTimelineCacheByteCount(attempt.payloadBytes);
  const maxBytes = formatTimelineCacheByteCount(attempt.maxBytes);

  if (attempt.requestContentType) {
    details.push(`Content-Type ${attempt.requestContentType}`);
  }
  if (requestBodyBytes) {
    details.push(`请求体 ${requestBodyBytes}`);
  }
  if (payloadBytes && maxBytes) {
    details.push(`payload ${payloadBytes}/${maxBytes}`);
  } else if (payloadBytes) {
    details.push(`payload ${payloadBytes}`);
  }

  if (typeof attempt.milestoneCount === 'number' && Number.isFinite(attempt.milestoneCount)) {
    details.push(`Milestone ${attempt.milestoneCount} 个`);
  }

  const milestoneKeys = attempt.milestoneKeys || [];
  const milestonePreviewKeys = milestoneKeys.slice(0, 4);
  const milestonePreview = milestonePreviewKeys.join('、');
  if (milestonePreview) {
    const hasMoreMilestones = milestoneKeys.length > milestonePreviewKeys.length ||
      (typeof attempt.milestoneCount === 'number' && attempt.milestoneCount > milestonePreviewKeys.length);
    const suffix = hasMoreMilestones
      ? ' 等'
      : '';
    details.push(`样例 ${milestonePreview}${suffix}`);
  }

  return details.join('，');
}

export function formatTimelineCacheLastAttempt(attempt?: TimelineCacheSyncAttempt): string {
  if (!attempt) {
    return '';
  }

  const ageText = formatTimelineCacheAge(attempt.ageMs);
  if (attempt.success) {
    return `最近同步成功：${ageText}`;
  }

  const reason = [attempt.errorCode, attempt.parseError || attempt.error]
    .filter(Boolean)
    .join(' - ');
  const details = formatTimelineCacheAttemptDetails(attempt);
  const nextAction = attempt.nextAction ? `；建议：${attempt.nextAction}` : '';

  return `最近同步失败（${ageText}）${reason ? `：${reason}` : ''}${details ? `；${details}` : ''}${nextAction}`;
}

export function getTimelineCacheStatusLabel(status: TimelineCacheProjectStatusCode): string {
  switch (status) {
    case 'ready':
      return '缓存可用';
    case 'expired':
      return '缓存已过期';
    case 'invalid':
      return '缓存格式异常';
    case 'error':
      return '读取失败';
    default:
      return '尚未同步';
  }
}

export function getTimelineCacheStatusActionText(status: TimelineCacheProjectStatusCode): string {
  switch (status) {
    case 'invalid':
    case 'error':
      return '请升级或修复 Timeline Sync Rule 后重新同步。';
    case 'expired':
      return '请在 Jira Automation 手动运行 Timeline Sync Rule，或等待每日 05:00 自动同步。';
    default:
      return '请先运行 Timeline Sync Rule，让项目 Milestone 缓存生效。';
  }
}

export function getTimelineCacheSaveBlockText(status?: TimelineCacheProjectStatus): string {
  if (!status || status.status === 'ready') {
    return '';
  }

  return getTimelineCacheStatusActionText(status.status);
}

export function getTimelineCacheProjectStatus(
  status: TimelineCacheStatus | null,
  project?: string
): TimelineCacheProjectStatus | undefined {
  if (!status || !project) {
    return undefined;
  }

  return status.projects.find(item => item.project === project);
}

export function getTimelineCacheReadinessBlockText(input: {
  isLoading: boolean;
  status: TimelineCacheStatus | null;
  error: string;
}): string {
  if (input.isLoading) {
    return '正在读取 Timeline 缓存状态，请稍后再保存。';
  }

  const error = input.error.trim();
  if (error) {
    return `Timeline 缓存状态读取失败：${error}\n\n请刷新状态，或打开 Timeline Sync Rule 排查后重新同步。`;
  }

  if (!input.status) {
    return '尚未读取 Timeline 缓存状态，请先刷新状态，确认项目 Milestone 缓存可用后再保存。';
  }

  return '';
}

export function getTimelineProjectCacheSaveBlockText(input: {
  isLoading: boolean;
  status: TimelineCacheStatus | null;
  error: string;
  project?: string;
}): string {
  const readinessBlockText = getTimelineCacheReadinessBlockText(input);
  if (readinessBlockText) {
    return readinessBlockText;
  }

  const project = input.project?.trim();
  if (!project) {
    return '请选择需要替换项目变量的项目。';
  }

  const projectStatus = getTimelineCacheProjectStatus(input.status, project);
  if (!projectStatus) {
    return `${project} 未出现在当前 App Script 返回的 Timeline 缓存状态中。\n\n请先更新 App Script 并重新配置 Timeline Sync Rule。`;
  }

  const cacheBlockText = getTimelineCacheSaveBlockText(projectStatus);
  if (cacheBlockText) {
    return `${project} 的 Timeline 缓存状态为 ${getTimelineCacheStatusLabel(projectStatus.status)}。\n\n${cacheBlockText}`;
  }

  return '';
}

export function buildTimelineCacheDiagnosticText(input: {
  status: TimelineCacheStatus | null;
  error: string;
  selectedProject?: string;
  selectedMilestone?: string;
  timelineSyncRuleUrl?: string;
}): string {
  const lines = ['Timeline 缓存诊断'];
  const error = input.error.trim();
  const status = input.status;
  const selectedProject = input.selectedProject?.trim();
  const selectedMilestone = input.selectedMilestone?.trim();

  if (status) {
    lines.push(`生成时间: ${status.generatedAt}`);
    lines.push(`项目就绪: ${status.readyProjects}/${status.totalProjects}，缺失 ${status.missingProjects}，异常或过期 ${status.staleProjects}`);
  }

  if (error) {
    lines.push(`读取错误: ${error}`);
  }

  if (selectedProject) {
    const projectStatus = getTimelineCacheProjectStatus(status, selectedProject);

    if (projectStatus) {
      lines.push(`项目: ${projectStatus.project}`);
      lines.push(`状态: ${getTimelineCacheStatusLabel(projectStatus.status)}`);

      if (projectStatus.updatedAt) {
        lines.push(`缓存更新时间: ${projectStatus.updatedAt}`);
      }

      if (projectStatus.expiresAt) {
        lines.push(`缓存过期时间: ${projectStatus.expiresAt}`);
      }

      if (projectStatus.error) {
        lines.push(`项目错误: ${projectStatus.error}`);
      }

      const lastAttempt = formatTimelineCacheLastAttempt(projectStatus.lastAttempt);
      if (lastAttempt) {
        lines.push(lastAttempt);
        if (projectStatus.status === 'ready' && projectStatus.lastAttempt?.success === false) {
          lines.push('当前影响: 缓存仍可用；建议手动运行 Timeline Sync Rule 修复最近失败后刷新状态。');
        }
      }

      const milestoneKeys = formatTimelineMilestoneKeysForDiagnostics(projectStatus.milestoneKeys);
      if (milestoneKeys) {
        lines.push(`缓存 Milestone: ${milestoneKeys}`);
      }

      if (isTimelineMilestoneMissingForDiagnostics(selectedMilestone, projectStatus.milestoneKeys)) {
        lines.push(`Milestone 缺失: 当前项目缓存不包含 ${selectedMilestone}`);
        lines.push('建议操作: 先手动运行 Timeline Sync Rule，或改选缓存中已有的 Milestone。');
      }

      const actionText = getTimelineCacheSaveBlockText(projectStatus);
      if (actionText) {
        lines.push(`建议操作: ${actionText}`);
      }
    } else if (status) {
      lines.push(`项目: ${selectedProject} (当前状态响应未返回该项目)`);
      lines.push('建议操作: 请更新 App Script 并重新配置 Timeline Sync Rule。');
    } else {
      lines.push(`项目: ${selectedProject}`);
    }
  }

  if (selectedMilestone) {
    lines.push(`选中 Milestone: ${selectedMilestone}`);
  }

  const timelineSyncRuleUrl = input.timelineSyncRuleUrl?.trim();
  if (timelineSyncRuleUrl) {
    lines.push(`Timeline Sync Rule: ${timelineSyncRuleUrl}`);
  }

  return lines.join('\n');
}

function isTimelineMilestoneMissingForDiagnostics(
  selectedMilestone?: string,
  milestoneKeys?: string[],
): boolean {
  const normalizedSelected = selectedMilestone?.trim();
  if (!normalizedSelected || !milestoneKeys || milestoneKeys.length === 0) {
    return false;
  }

  return !milestoneKeys
    .map(key => key.trim())
    .some(key => key === normalizedSelected);
}

function formatTimelineMilestoneKeysForDiagnostics(milestoneKeys?: string[]): string {
  if (!milestoneKeys || milestoneKeys.length === 0) {
    return '';
  }

  const preview = milestoneKeys.slice(0, 12).join('、');
  return milestoneKeys.length > 12
    ? `${preview} 等 ${milestoneKeys.length} 个`
    : preview;
}
