import {
  getTimelineSyncDryRunHelp,
  getTimelineSyncPayloadHelp,
} from './timelineProjects.js';

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
  requestId?: string;
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

export interface TimelineSyncDryRunResult {
  success: boolean;
  dryRun?: boolean;
  wouldCache?: boolean;
  requestId?: string;
  project?: string;
  paramKey?: string;
  errorCode?: string;
  error?: string;
  parseError?: string;
  nextAction?: string;
  payloadBytes?: number;
  maxBytes?: number;
  milestoneCount?: number;
  milestoneKeys?: string[];
}

export type TimelineCacheUsage = 'timeline-trigger' | 'project-variables';

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

function buildNonJsonTimelineDryRunError(responseText: string): string {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return 'Apps Script dry-run 响应为空，请确认 Web App 已重新部署并允许扩展访问。';
  }

  const snippet = summarizeResponseSnippet(trimmed);
  if (/^(<!doctype\s+html|<html|<head|<body|<)/i.test(trimmed)) {
    return `Apps Script dry-run 响应是 HTML 页面，通常是 Web App URL、权限或登录页问题。响应片段：${snippet}`;
  }

  return `Apps Script dry-run 响应不是 JSON，请确认 Web App URL 指向最新部署。响应片段：${snippet}`;
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
  const requestId = getString(value.requestId).trim();
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
  if (requestId) {
    attempt.requestId = requestId;
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

export function validateTimelineSyncDryRunResponse(data: unknown): TimelineSyncDryRunResult {
  if (!isRecord(data)) {
    throw new Error('Apps Script dry-run 响应格式异常，请复制测试 curl 手动确认。');
  }

  const explicitSuccess = data.success === true || data.success === false;
  const statusText = getString(data.status).trim().toUpperCase();
  if (!explicitSuccess && statusText !== 'ERROR') {
    throw new Error('Apps Script dry-run 响应格式异常，请升级 App Script 后重试。');
  }

  const result: TimelineSyncDryRunResult = {
    success: data.success === true,
  };

  if (data.dryRun === true) {
    result.dryRun = true;
  }
  if (data.wouldCache === true) {
    result.wouldCache = true;
  }

  const requestId = getString(data.requestId).trim();
  const project = getString(data.project).trim();
  const paramKey = getString(data.paramKey).trim();
  const errorCode = getString(data.errorCode).trim() || (statusText === 'ERROR' ? 'DRY_RUN_ERROR' : '');
  const error = getString(data.error).trim() || getString(data.message).trim();
  const parseError = getString(data.parseError).trim();
  const nextAction = getString(data.nextAction).trim();
  const payloadBytes = getOptionalFiniteNumber(data.payloadBytes);
  const maxBytes = getOptionalFiniteNumber(data.maxBytes);
  const milestoneCount = getOptionalFiniteNumber(data.milestoneCount);
  const milestoneKeys = normalizeMilestoneKeys(data.milestoneKeys);

  if (requestId) {
    result.requestId = requestId;
  }
  if (project) {
    result.project = project;
  }
  if (paramKey) {
    result.paramKey = paramKey;
  }
  if (errorCode) {
    result.errorCode = errorCode;
  }
  if (error) {
    result.error = error;
  }
  if (parseError) {
    result.parseError = parseError;
  }
  if (nextAction) {
    result.nextAction = nextAction;
  }
  if (payloadBytes !== undefined && payloadBytes !== null) {
    result.payloadBytes = payloadBytes;
  }
  if (maxBytes !== undefined && maxBytes !== null) {
    result.maxBytes = maxBytes;
  }
  if (milestoneCount !== undefined && milestoneCount !== null) {
    result.milestoneCount = milestoneCount;
  }
  if (milestoneKeys) {
    result.milestoneKeys = milestoneKeys;
  }

  if (result.success && result.dryRun !== true) {
    throw new Error('Apps Script 返回了成功结果，但不是 dry-run 响应；请确认请求 URL 包含 dryRun=true。');
  }

  return result;
}

export function parseTimelineSyncDryRunResponseText(responseText: string): TimelineSyncDryRunResult {
  try {
    return validateTimelineSyncDryRunResponse(JSON.parse(responseText));
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(buildNonJsonTimelineDryRunError(responseText));
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
  if (attempt.requestId) {
    details.push(`请求 ID ${attempt.requestId}`);
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

function formatTimelineCacheAttemptTime(attempt: TimelineCacheSyncAttempt): string {
  if (typeof attempt.ageMs === 'number' && Number.isFinite(attempt.ageMs)) {
    return formatTimelineCacheAge(attempt.ageMs);
  }

  return attempt.attemptedAt || '未知时间';
}

export function formatTimelineCacheLastAttempt(attempt?: TimelineCacheSyncAttempt): string {
  if (!attempt) {
    return '';
  }

  const ageText = formatTimelineCacheAttemptTime(attempt);
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

export function getTimelineCacheAttemptQuickFixText(attempt?: TimelineCacheSyncAttempt): string {
  if (!attempt || attempt.success) {
    return '';
  }

  switch (attempt.errorCode) {
    case 'INVALID_POST_JSON':
      return '把 Timeline Sync Rule 的 Apps Script 写缓存请求改回 GET；POST 可能停在 Google 302 重定向。';
    case 'MISSING_RELEASE_INFO':
      return '确认变量先保存 {{webhookResponse.body}}，GET URL 包含 project 和 releaseInfo={{变量.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}。';
    case 'UNKNOWN_PROJECT':
      return '确认 URL 里的 project 使用生成规则里的项目参数名。';
    case 'TIMELINE_CACHE_TOO_LARGE':
      return '减少同步字段或 Milestone 数量后，手动运行 Timeline Sync Rule。';
    case 'RELEASE_INFO_TOO_LARGE':
      return '减少 releaseInfo 字符数到限制内，或只同步 Timeline 需要的字段。';
    case 'RELEASE_INFO_TOO_DEEP':
      return '压平 releaseInfo 结构；Timeline 缓存只需要项目字段和 Milestone 日期。';
    case 'INVALID_RELEASE_INFO_SCHEMA':
      return '确认 releaseInfo 下至少有一个 MM/DD/YYYY 格式的 Milestone 日期。';
    case 'PARSE_RELEASE_INFO_FAILED':
      return '确认 Jira 变量保存的是 webhookResponse.body；GET URL 先移除 ASCII 撇号再编码，避免旧版 Apps Script 把字段名里的撇号当成字符串边界。';
    case 'CACHE_RELEASE_INFO_EXCEPTION':
      return '复制诊断后查看 Apps Script 执行日志，按请求 ID 对照失败请求。';
    default:
      return attempt.nextAction || '';
  }
}

export function getTimelineCacheExecutionImpactText(input: {
  usage: TimelineCacheUsage;
  status?: TimelineCacheProjectStatus;
  selectedMilestone?: string;
  projectMissingFromStatus?: boolean;
  hasReadError?: boolean;
}): string {
  const status = input.status;
  const selectedMilestone = input.selectedMilestone?.trim();
  const isProjectVariables = input.usage === 'project-variables';
  const unavailableImpact = isProjectVariables
    ? '执行时如果缓存仍不可用，项目变量会保留原样。'
    : '执行时如果缓存仍不可用，Timeline 触发会被跳过。';

  if (input.hasReadError) {
    return `可继续保存，但当前无法确认 Timeline 缓存状态；${unavailableImpact}`;
  }

  if (input.projectMissingFromStatus) {
    return isProjectVariables
      ? '可继续保存，但当前 App Script 未返回该项目；执行时项目变量会保留原样，直到 App Script 和 Sync Rule 项目清单更新。'
      : '可继续保存，但当前 App Script 未返回该项目；这条 Timeline 不会命中该项目，直到 App Script 和 Sync Rule 项目清单更新。';
  }

  if (!status) {
    return '';
  }

  if (!isProjectVariables && isTimelineMilestoneMissingForDiagnostics(selectedMilestone, status.milestoneKeys)) {
    return `可继续保存，但执行器会跳过这条 Timeline，直到 ${status.project} 缓存包含 ${selectedMilestone}。`;
  }

  switch (status.status) {
    case 'missing':
      return isProjectVariables
        ? `可继续保存；Timeline Sync Rule 成功写入 ${status.project} 缓存前，项目变量会保留原样。`
        : `可继续保存；Timeline Sync Rule 成功写入 ${status.project} 缓存前，这条 Timeline 不会触发。`;
    case 'expired':
      return isProjectVariables
        ? '可继续保存；缓存已过期，执行时项目变量可能保留原样，直到重新同步成功。'
        : '可继续保存；缓存已过期，执行器会跳过这条 Timeline，直到重新同步成功。';
    case 'invalid':
    case 'error':
      return isProjectVariables
        ? '可继续保存；当前缓存不可用，执行时项目变量会保留原样，直到修复同步并刷新状态。'
        : '可继续保存；当前缓存不可用，执行器会跳过这条 Timeline，直到修复同步并刷新状态。';
    case 'ready':
      if (status.lastAttempt?.success === false) {
        return isProjectVariables
          ? '当前已有缓存仍可替换项目变量；最近同步失败可能让后续发布节奏停留在旧缓存。'
          : '当前已有缓存仍可触发；最近同步失败可能让后续发布节奏停留在旧缓存。';
      }
      return '';
    default:
      return '';
  }
}

export function formatTimelineSyncDryRunResult(result: TimelineSyncDryRunResult): string {
  const details = formatTimelineCacheAttemptDetails({
    success: result.success,
    requestId: result.requestId,
    errorCode: result.errorCode,
    error: result.error,
    parseError: result.parseError,
    nextAction: result.nextAction,
    payloadBytes: result.payloadBytes,
    maxBytes: result.maxBytes,
    milestoneCount: result.milestoneCount,
    milestoneKeys: result.milestoneKeys,
  });

  if (result.success) {
    return [
      '样例测试通过：Apps Script Web App 可访问，payload 可解析并通过缓存预检；不会写入 Timeline 缓存，也不会代表 Jira Rule 已同步。',
      details,
    ].filter(Boolean).join(' ');
  }

  const reason = [result.errorCode, result.parseError || result.error]
    .filter(Boolean)
    .join(' - ');
  const nextAction = result.nextAction ? ` 下一步：${result.nextAction}` : '';

  return [
    `测试失败${reason ? `：${reason}` : ''}。`,
    details,
    nextAction,
  ].filter(Boolean).join(' ');
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

  return status.projects.find(item => item.project === project || item.paramKey === project);
}

export function getTimelineCacheReadinessBlockText(input: {
  isLoading: boolean;
  status: TimelineCacheStatus | null;
  error: string;
}): string {
  void input;
  // Cache status is advisory for create/save. The status panel still explains
  // missing, expired, and failed sync states, but it should not block drafting.
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

  return '';
}

export function buildTimelineCacheDiagnosticText(input: {
  status: TimelineCacheStatus | null;
  error: string;
  selectedProject?: string;
  selectedMilestone?: string;
  timelineSyncRuleUrl?: string;
  webAppUrl?: string;
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
    const payloadHelp = getTimelineSyncPayloadHelp(selectedProject);
    const dryRunHelp = getTimelineSyncDryRunHelp({
      project: selectedProject,
      webAppUrl: input.webAppUrl,
    });

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

    if (payloadHelp) {
      lines.push('Jira Send web request 修复模板:');
      lines.push(`Method: ${payloadHelp.method}`);
      lines.push(`URL: ${payloadHelp.url}`);
      if (payloadHelp.method === 'GET') {
        lines.push('Body: (empty)');
        lines.push('注意: Apps Script callback 必须保持 GET；POST 可能停在 Google 302 重定向。');
      } else {
        lines.push(`Header: Content-Type=${payloadHelp.contentType}`);
        lines.push('Custom data:');
        lines.push(payloadHelp.customBody);
      }
    }

    if (dryRunHelp) {
      lines.push('Apps Script dry-run 测试 curl:');
      lines.push(dryRunHelp.curlCommand);
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
