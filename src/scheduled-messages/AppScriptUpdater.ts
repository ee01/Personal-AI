/**
 * App Script 自动更新器
 * 负责检测和更新用户已部署的 App Script 代码
 */

import { SheetConfig } from './types';
import { ConfigSyncService } from './ConfigSyncService';
import { normalizeSheetConfig } from './botAutomationConfig';
import {
  compareAppScriptVersions,
  isValidAppScriptVersion,
  isAppScriptVersionOlder,
} from './appScriptVersioning';

export interface UpdateCheckResult {
  needsUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  versionUsage?: AppScriptVersionUsage;
  error?: string;
}

export interface UpdateCheckOptions {
  syncKnownVersionToConfig?: boolean;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  newVersion?: string;
  currentVersion?: string;
  latestVersion?: string;
  skipped?: boolean;
  error?: string;
  errorCode?: string;
  helpUrl?: string;
  helpMessage?: string;
  updatedConfig?: SheetConfig;
}

export interface AppScriptVersionInfo {
  version: string;
  lastUpdated: string;
}

interface DeployedAppScriptVersionInfo {
  version: string;
  lastUpdated?: string;
  legacyFallback?: boolean;
}

export interface AppScriptVersionUsage {
  count: number;
  limit: number;
  remaining: number;
  nearLimit: boolean;
  projectHistoryUrl: string;
}

export const APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR = 'APP_SCRIPT_PROJECT_HISTORY_LIMIT';
export const APP_SCRIPT_DEPLOYMENT_MISMATCH_ERROR = 'APP_SCRIPT_DEPLOYMENT_MISMATCH';
export const APP_SCRIPT_DEPLOYMENT_NOT_FOUND_ERROR = 'APP_SCRIPT_DEPLOYMENT_NOT_FOUND';
export const APP_SCRIPT_DEPLOYMENT_VERIFY_FAILED_ERROR = 'APP_SCRIPT_DEPLOYMENT_VERIFY_FAILED';
export const APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR = 'APP_SCRIPT_PROJECT_CONTENT_MISMATCH';
const APP_SCRIPT_VERSION_LIMIT = 200;
const APP_SCRIPT_VERSION_WARNING_THRESHOLD = 195;

export function buildProjectHistoryUrl(scriptId: string): string {
  return `https://script.google.com/home/projects/${encodeURIComponent(scriptId)}/projecthistory`;
}

export function buildAppScriptProjectUrl(scriptId: string): string {
  return `https://script.google.com/home/projects/${encodeURIComponent(scriptId)}/edit`;
}

export function buildAppScriptWebAppActionUrl(webAppUrl: string, action: string): string {
  try {
    const url = new URL(webAppUrl);
    url.searchParams.set('action', action);
    return url.toString();
  } catch {
    const separator = webAppUrl.includes('?') ? '&' : '?';
    return `${webAppUrl}${separator}action=${encodeURIComponent(action)}`;
  }
}

function normalizeWebAppUrlForDeploymentMatch(webAppUrl: string): string {
  const trimmedUrl = webAppUrl.trim();
  if (!trimmedUrl) {
    return '';
  }

  try {
    const url = new URL(trimmedUrl);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/+$/, '');
  } catch {
    return trimmedUrl.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

function getDeploymentWebAppEntryPoint(deployment: any): any | undefined {
  return deployment?.entryPoints?.find((entryPoint: any) => entryPoint?.entryPointType === 'WEB_APP');
}

function getDeploymentWebAppUrl(deployment: any): string {
  const webAppUrl = getDeploymentWebAppEntryPoint(deployment)?.webApp?.url;
  return typeof webAppUrl === 'string' ? webAppUrl.trim() : '';
}

function isVersionedWebAppDeployment(deployment: any): boolean {
  return Boolean(
    deployment?.deploymentConfig?.versionNumber &&
    getDeploymentWebAppEntryPoint(deployment)
  );
}

function isProjectHistoryLimitError(errorText: string): boolean {
  return (
    errorText.includes('Cannot create more versions') ||
    errorText.includes('reached the limit of 200 versions')
  );
}

function summarizeVersionProbeResponse(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '空响应';
  }

  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}

function isPersonalAiScheduledMessagesSource(source: string): boolean {
  const hasVersionMarker = /\bAPP_SCRIPT_VERSION\b/.test(source);
  const hasScheduledExecutor = /function\s+executeScheduledMessages\s*\(/.test(source);
  const hasMinuteTrigger = /function\s+minuteTrigger\s*\(/.test(source);
  const hasProductMarker = /Personal AI|Scheduled Messages|定时消息/.test(source);

  return hasScheduledExecutor && (hasVersionMarker || hasMinuteTrigger || hasProductMarker);
}

function summarizeProjectContentFiles(files: any[]): string {
  const fileSummaries = files
    .map((file) => {
      const name = typeof file?.name === 'string' && file.name.trim()
        ? file.name.trim()
        : 'unnamed';
      const type = typeof file?.type === 'string' && file.type.trim()
        ? file.type.trim()
        : 'unknown';
      return `${name}(${type})`;
    })
    .slice(0, 8);

  return fileSummaries.length > 0 ? fileSummaries.join(', ') : '未返回文件列表';
}

class AppScriptProjectHistoryLimitError extends Error {
  readonly errorCode = APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR;
  readonly helpUrl: string;
  readonly helpMessage: string;

  constructor(scriptId: string, usage?: AppScriptVersionUsage) {
    const helpUrl = buildProjectHistoryUrl(scriptId);
    const helpMessage = '请打开 Project History 页面，使用右下角批量删除按钮清理旧的未使用版本（建议保留 5 个以内）后重试升级。';
    const usageText = usage
      ? `当前已有 ${usage.count}/${usage.limit} 个历史版本，`
      : '';
    super(`App Script ${usageText}历史版本已达到 200 个上限，无法创建新版本。${helpMessage} ${helpUrl}`);
    this.name = 'AppScriptProjectHistoryLimitError';
    Object.setPrototypeOf(this, AppScriptProjectHistoryLimitError.prototype);
    this.helpUrl = helpUrl;
    this.helpMessage = helpMessage;
  }
}

class AppScriptDeploymentRecoveryError extends Error {
  readonly errorCode: string;
  readonly helpUrl: string;
  readonly helpMessage: string;

  constructor(input: {
    scriptId: string;
    message: string;
    errorCode: string;
    helpMessage: string;
  }) {
    const helpUrl = buildAppScriptProjectUrl(input.scriptId);
    super(`${input.message} ${input.helpMessage} ${helpUrl}`);
    this.name = 'AppScriptDeploymentRecoveryError';
    Object.setPrototypeOf(this, AppScriptDeploymentRecoveryError.prototype);
    this.errorCode = input.errorCode;
    this.helpUrl = helpUrl;
    this.helpMessage = input.helpMessage;
  }
}

class AppScriptDeploymentVerificationError extends Error {
  readonly errorCode = APP_SCRIPT_DEPLOYMENT_VERIFY_FAILED_ERROR;
  readonly helpUrl: string;
  readonly helpMessage: string;
  readonly currentVersion?: string;
  readonly latestVersion: string;
  readonly rollbackAttempted: boolean;
  readonly rollbackSucceeded: boolean;
  readonly rollbackVersionNumber?: number;
  readonly rollbackError?: string;
  readonly reason: string;

  constructor(input: {
    scriptId: string;
    latestVersion: string;
    observedVersion?: string;
    reason: string;
    rollbackAttempted?: boolean;
    rollbackSucceeded?: boolean;
    rollbackVersionNumber?: number;
    rollbackError?: string;
  }) {
    const helpUrl = buildAppScriptProjectUrl(input.scriptId);
    const observedText = input.observedVersion
      ? `最后看到的线上版本是 ${input.observedVersion}，`
      : '';
    const rollbackText = input.rollbackAttempted
      ? input.rollbackSucceeded
        ? `已尝试把 deployment 回退到升级前版本 ${input.rollbackVersionNumber}。`
        : `已尝试回退到升级前 deployment 版本但失败：${input.rollbackError || '未知错误'}。`
      : '';
    const helpMessage = input.rollbackAttempted
      ? input.rollbackSucceeded
        ? `已尝试把 deployment 回退到升级前版本 ${input.rollbackVersionNumber}。请稍后重试检查；如果仍需升级，请打开 Apps Script 项目确认 Manage deployments 状态后再重试。`
        : `尝试回退到升级前 deployment 版本失败：${input.rollbackError || '未知错误'}。请打开 Apps Script 项目，确认 Manage deployments 当前指向的版本。`
      : '请稍后重试检查；如果仍未生效，请打开 Apps Script 项目，确认 Manage deployments 指向刚创建的新版本。';
    super(`App Script deployment 已提交，但 Web App 版本端点尚未确认最新版本 ${input.latestVersion}。${observedText}${rollbackText}配置不会被标记为最新。${helpMessage} 原因：${input.reason} ${helpUrl}`);
    this.name = 'AppScriptDeploymentVerificationError';
    Object.setPrototypeOf(this, AppScriptDeploymentVerificationError.prototype);
    this.helpUrl = helpUrl;
    this.helpMessage = helpMessage;
    this.currentVersion = input.observedVersion;
    this.latestVersion = input.latestVersion;
    this.rollbackAttempted = Boolean(input.rollbackAttempted);
    this.rollbackSucceeded = Boolean(input.rollbackSucceeded);
    this.rollbackVersionNumber = input.rollbackVersionNumber;
    this.rollbackError = input.rollbackError;
    this.reason = input.reason;
  }
}

export class AppScriptUpdater {
  private token: string;
  private config: SheetConfig | null = null;
  private static deploymentVerificationAttempts = 3;
  private static deploymentVerificationDelayMs = 1000;
  
  // 缓存版本信息，避免重复读取文件
  private static cachedVersionInfo: AppScriptVersionInfo | null = null;
  
  constructor(token: string, config?: SheetConfig) {
    this.token = token;
    this.config = config ? normalizeSheetConfig(config) : null;
  }
  
  /**
   * 从 App Script 模板文件中解析版本信息
   */
  private static async parseVersionFromTemplate(): Promise<AppScriptVersionInfo> {
    // 如果已经缓存，直接返回
    if (AppScriptUpdater.cachedVersionInfo) {
      return AppScriptUpdater.cachedVersionInfo;
    }
    
    try {
      const response = await fetch(chrome.runtime.getURL('app-script-template.gs'));
      if (!response.ok) {
        throw new Error(`无法加载模板文件: HTTP ${response.status}`);
      }
      
      const content = await response.text();
      
      // 解析版本号：var APP_SCRIPT_VERSION = '2.1.0';
      const versionMatch = content.match(/var\s+APP_SCRIPT_VERSION\s*=\s*['"`]([^'"`]+)['"`];/);
      if (!versionMatch) {
        throw new Error('无法找到 APP_SCRIPT_VERSION 定义');
      }
      
      // 解析更新日期：var APP_SCRIPT_LAST_UPDATED = '2025-12-04';
      const lastUpdatedMatch = content.match(/var\s+APP_SCRIPT_LAST_UPDATED\s*=\s*['"`]([^'"`]+)['"`];/);
      if (!lastUpdatedMatch) {
        throw new Error('无法找到 APP_SCRIPT_LAST_UPDATED 定义');
      }
      
      const versionInfo = {
        version: versionMatch[1].trim(),
        lastUpdated: lastUpdatedMatch[1].trim()
      };

      if (!isValidAppScriptVersion(versionInfo.version)) {
        throw new Error(`APP_SCRIPT_VERSION 必须是有效 SemVer，例如 2.8.1 或 2.8.1-beta.1，当前值: ${versionInfo.version}`);
      }
      
      // 缓存结果
      AppScriptUpdater.cachedVersionInfo = versionInfo;
      
      console.log(`📦 从模板文件解析到版本信息: ${versionInfo.version} (${versionInfo.lastUpdated})`);
      return versionInfo;
      
    } catch (error) {
      console.error('解析模板文件版本信息失败:', error);
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`无法读取最新 App Script 模板版本，已停止升级以避免误判版本。原因：${reason}`);
    }
  }
  
  /**
   * 获取最新的 App Script 版本号
   */
  static async getLatestVersionInfo(): Promise<AppScriptVersionInfo> {
    return AppScriptUpdater.parseVersionFromTemplate();
  }

  static async getLatestVersion(): Promise<string> {
    const versionInfo = await AppScriptUpdater.getLatestVersionInfo();
    return versionInfo.version;
  }
  
  /**
   * 检查是否需要更新
   */
  async checkForUpdates(options: UpdateCheckOptions = {}): Promise<UpdateCheckResult> {
    const { syncKnownVersionToConfig = true } = options;
    let latestVersion = 'unknown';

    try {
      // 获取最新版本号
      const latestVersionInfo = await AppScriptUpdater.getLatestVersionInfo();
      latestVersion = latestVersionInfo.version;
      
      if (!this.config?.webAppUrl) {
        return {
          needsUpdate: false,
          currentVersion: 'unknown',
          latestVersion,
          error: '未找到 Web App 配置'
        };
      }
      
      // 从 Web App 获取当前部署的版本
      const deployedVersionInfo = await this.getDeployedVersionInfo();
      const currentVersion = deployedVersionInfo.version;
      
      // 比较版本
      const needsUpdate = isAppScriptVersionOlder(currentVersion, latestVersion);
      if (needsUpdate && !this.config.scriptId) {
        return {
          needsUpdate: false,
          currentVersion,
          latestVersion,
          error: '检测到 App Script 需要升级，但当前配置缺少 Script ID，无法定位 Apps Script 项目。请重新绑定调度系统配置后再检查。'
        };
      }

      const versionUsage = needsUpdate && this.config.scriptId
        ? await this.getProjectVersionUsage(this.config.scriptId).catch((error) => {
            console.warn('读取 App Script 历史版本使用量失败:', error);
            return undefined;
          })
        : undefined;

      if (!needsUpdate && syncKnownVersionToConfig) {
        await this.syncKnownDeployedVersionToConfigIfStale(
          deployedVersionInfo,
          latestVersionInfo,
        ).catch((error) => {
          console.warn('同步已部署 App Script 版本到配置失败:', error);
        });
      }
      
      return {
        needsUpdate,
        currentVersion,
        latestVersion,
        versionUsage
      };
      
    } catch (error) {
      console.error('检查更新失败:', error);
      return {
        needsUpdate: false,
        currentVersion: 'unknown',
        latestVersion,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 获取已部署的 App Script 版本
   */
  private async getDeployedVersionInfo(): Promise<DeployedAppScriptVersionInfo> {
    if (!this.config?.webAppUrl) {
      throw new Error('未找到 Web App URL');
    }

    let response: Response;
    try {
      // Probe anonymously so Google multi-login cookies cannot redirect to a wrong /u/N account context.
      response = await fetch(buildAppScriptWebAppActionUrl(this.config.webAppUrl, 'getVersion'), {
        method: 'GET',
        credentials: 'omit',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      throw new Error(`无法连接 App Script Web App 版本端点: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
      throw new Error(`获取 App Script 版本失败: HTTP ${response.status}`);
    }

    let responseText = '';
    try {
      responseText = await response.text();
    } catch (error) {
      throw new Error(`无法读取 App Script 版本端点响应: ${error instanceof Error ? error.message : String(error)}`);
    }

    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      const snippet = summarizeVersionProbeResponse(responseText);
      throw new Error(`App Script 版本端点返回非 JSON 响应，无法确认线上版本。请检查 Web App URL、访问权限或登录状态后重试。响应片段: ${snippet}`);
    }

    const deployedVersion = typeof data?.version === 'string' ? data.version.trim() : '';
    if (!deployedVersion) {
      console.warn('App Script 版本端点未返回 version 字段，按旧版脚本处理');
      return {
        version: '0.0.0',
        lastUpdated: typeof data?.lastUpdated === 'string' ? data.lastUpdated : undefined,
        legacyFallback: true
      };
    }

    return {
      version: deployedVersion,
      lastUpdated: typeof data?.lastUpdated === 'string' ? data.lastUpdated : undefined
    };
  }

  private buildVersionProbeFailureMessage(error: unknown): string {
    const reason = error instanceof Error ? error.message : String(error);
    return `升级前无法确认线上 App Script 版本，已停止本次升级以避免重复创建脚本版本。请检查网络或 Web App URL 后重试。原因：${reason}`;
  }

  private deploymentMatchesConfiguredWebAppUrl(deployment: any): boolean {
    if (!this.config?.webAppUrl) {
      return true;
    }

    const configuredWebAppUrl = normalizeWebAppUrlForDeploymentMatch(this.config.webAppUrl);
    const deploymentWebAppUrl = normalizeWebAppUrlForDeploymentMatch(getDeploymentWebAppUrl(deployment));
    return Boolean(configuredWebAppUrl && deploymentWebAppUrl && configuredWebAppUrl === deploymentWebAppUrl);
  }

  private buildDeploymentMismatchMessage(deployments: any[]): string {
    const configuredWebAppUrl = this.config?.webAppUrl || '未知';
    const knownWebAppUrls = deployments
      .map(getDeploymentWebAppUrl)
      .filter(Boolean);
    const knownUrlSummary = knownWebAppUrls.length > 0
      ? knownWebAppUrls.join(', ')
      : '没有返回可比对的 Web App URL';

    return `未找到与当前 Web App URL 匹配的正式 deployment，已停止升级以避免更新错误的 Web App。当前配置 URL: ${configuredWebAppUrl}；Apps Script API 返回的正式 Web App URL: ${knownUrlSummary}。请重新绑定当前 Web App URL，或在 Apps Script Manage deployments 中确认对应的正式部署后重试。`;
  }
  
  /**
   * 执行更新
   * 使用 deployments.update API 更新现有部署，保持 URL 不变
   */
  async updateAppScript(): Promise<UpdateResult> {
    try {
      if (!this.config?.scriptId) {
        return {
          success: false,
          message: '未找到 Script ID',
          error: 'SCRIPT_ID_NOT_FOUND'
        };
      }
      
      console.log('开始更新 App Script...');
      
      // 0. 获取最新版本号
      const latestVersionInfo = await AppScriptUpdater.getLatestVersionInfo();
      const latestVersion = latestVersionInfo.version;

      // 1. 重新读取线上部署版本，避免 UI 状态过期或重复点击时创建无意义的新版本
      if (this.config.webAppUrl) {
        let deployedVersionInfo: DeployedAppScriptVersionInfo;
        try {
          deployedVersionInfo = await this.getDeployedVersionInfo();
        } catch (error) {
          throw new Error(this.buildVersionProbeFailureMessage(error));
        }

        const deployedVersion = deployedVersionInfo.version;
        const deployedComparison = compareAppScriptVersions(deployedVersion, latestVersion);

        if (deployedComparison >= 0) {
          await this.syncKnownDeployedVersionToConfigIfStale(
            deployedVersionInfo,
            latestVersionInfo,
          );

          console.log(`✅ App Script 已是最新版本 (${deployedVersion})，跳过项目写入和版本创建`);
          return {
            success: true,
            message: `App Script 已是最新版本 ${deployedVersion}`,
            currentVersion: deployedVersion,
            latestVersion,
            newVersion: deployedVersion,
            skipped: true,
            updatedConfig: this.config ? normalizeSheetConfig(this.config) : undefined,
          };
        }
      }
      
      // 2. 先验证存在可更新的正式 deployment，避免预检失败时仍消耗 Apps Script 版本额度
      const deploymentId = await this.getOrCreateDeploymentId();
      const previousDeploymentVersionNumber = await this.getDeploymentVersionNumber(
        this.config.scriptId,
        deploymentId,
      );

      // 3. 确认 Script ID 指向 Personal AI 管理的调度脚本，避免覆盖错误项目或用户自定义脚本
      await this.assertCurrentProjectLooksManagedByPersonalAi(this.config.scriptId);

      // 4. 预检 Project History 版本额度，避免达到 200 上限时仍先覆盖 HEAD 代码
      await this.assertProjectVersionCapacity(this.config.scriptId);
      
      // 5. 加载最新的 App Script 模板代码
      const scriptCode = await this.loadAppScriptTemplate();
      
      // 6. 更新 App Script 项目代码
      await this.updateProjectContent(this.config.scriptId, scriptCode);
      
      // 7. 创建新版本
      const versionNumber = await this.createVersion(this.config.scriptId, latestVersion);
      
      // 8. 更新部署到新版本（保持 URL 不变）
      await this.updateDeployment(this.config.scriptId, deploymentId, versionNumber, latestVersion);

      // 9. 确认当前 Web App URL 已经实际返回新版本，再把配置标记为最新。
      let verifiedVersionInfo: DeployedAppScriptVersionInfo;
      try {
        verifiedVersionInfo = await this.verifyUpdatedDeploymentServingVersion(
          this.config.scriptId,
          latestVersion,
        );
      } catch (error) {
        if (
          error instanceof AppScriptDeploymentVerificationError &&
          previousDeploymentVersionNumber &&
          previousDeploymentVersionNumber !== versionNumber
        ) {
          throw await this.rollbackDeploymentAfterVerificationFailure(
            error,
            this.config.scriptId,
            deploymentId,
            previousDeploymentVersionNumber,
            latestVersion,
          );
        }

        throw error;
      }
      
      // 10. 更新配置中的版本信息
      const persistedVersionInfo = this.buildPersistedVersionInfoFromVerification(
        verifiedVersionInfo,
        latestVersionInfo,
      );
      await this.updateConfigVersion(persistedVersionInfo);
      
      console.log('App Script 更新成功！');
      
      return {
        success: true,
        message: `App Script 已更新到版本 ${persistedVersionInfo.version}`,
        currentVersion: persistedVersionInfo.version,
        latestVersion,
        newVersion: persistedVersionInfo.version,
        updatedConfig: this.config ? normalizeSheetConfig(this.config) : undefined,
      };
      
    } catch (error) {
      console.error('更新 App Script 失败:', error);

      if (error instanceof AppScriptProjectHistoryLimitError) {
        return {
          success: false,
          message: 'App Script 历史版本已达到 200 个上限',
          error: error.message,
          errorCode: error.errorCode,
          helpUrl: error.helpUrl,
          helpMessage: error.helpMessage
        };
      }

      if (error instanceof AppScriptDeploymentRecoveryError) {
        return {
          success: false,
          message: 'App Script deployment 需要检查',
          error: error.message,
          errorCode: error.errorCode,
          helpUrl: error.helpUrl,
          helpMessage: error.helpMessage
        };
      }

      if (error instanceof AppScriptDeploymentVerificationError) {
        return {
          success: false,
          message: 'App Script deployment 已提交但未确认生效',
          error: error.message,
          errorCode: error.errorCode,
          helpUrl: error.helpUrl,
          helpMessage: error.helpMessage,
          currentVersion: error.currentVersion,
          latestVersion: error.latestVersion
        };
      }

      return {
        success: false,
        message: '更新失败',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 加载 App Script 模板代码
   */
  private async loadAppScriptTemplate(): Promise<string> {
    try {
      const response = await fetch(chrome.runtime.getURL('app-script-template.gs'));
      if (!response.ok) {
        throw new Error(`无法加载模板文件: HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('加载 App Script 模板文件失败:', error);
      throw new Error(`加载模板失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 更新 App Script 项目内容
   */
  private async updateProjectContent(scriptId: string, scriptCode: string): Promise<void> {
    const response = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: scriptCode
            },
            {
              name: 'appsscript',
              type: 'JSON',
              source: JSON.stringify({
                timeZone: 'Asia/Shanghai',
                exceptionLogging: 'STACKDRIVER',
                runtimeVersion: 'V8',
                webapp: {
                  access: 'ANYONE_ANONYMOUS',
                  executeAs: 'USER_DEPLOYING'
                },
                executionApi: {
                  access: 'ANYONE'
                }
              })
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`更新项目内容失败: ${error}`);
    }
    
    console.log('✅ 项目代码已更新');
  }

  private async assertCurrentProjectLooksManagedByPersonalAi(scriptId: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(
        `https://script.googleapis.com/v1/projects/${scriptId}/content`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
    } catch (error) {
      throw new AppScriptDeploymentRecoveryError({
        scriptId,
        message: `无法读取 Apps Script 项目当前代码，已停止升级以避免覆盖未知项目。原因：${error instanceof Error ? error.message : String(error)}`,
        errorCode: APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR,
        helpMessage: '请打开 Apps Script 项目确认 Script ID、Web App URL 和 Personal AI 调度脚本是否对应；如需升级，请重新绑定正确项目后重试。'
      });
    }

    if (!response.ok) {
      const error = await response.text();
      throw new AppScriptDeploymentRecoveryError({
        scriptId,
        message: `无法读取 Apps Script 项目当前代码，已停止升级以避免覆盖未知项目。Apps Script API 返回: ${error}`,
        errorCode: APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR,
        helpMessage: '请打开 Apps Script 项目确认 Script ID、Web App URL 和 Personal AI 调度脚本是否对应；如需升级，请重新绑定正确项目后重试。'
      });
    }

    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      throw new AppScriptDeploymentRecoveryError({
        scriptId,
        message: `Apps Script 项目代码响应无法解析，已停止升级以避免覆盖未知项目。原因：${error instanceof Error ? error.message : String(error)}`,
        errorCode: APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR,
        helpMessage: '请打开 Apps Script 项目确认 Script ID、Web App URL 和 Personal AI 调度脚本是否对应；如需升级，请重新绑定正确项目后重试。'
      });
    }

    const files = Array.isArray(data?.files) ? data.files : [];
    const serverFiles = files.filter(
      (file: any) => file?.type === 'SERVER_JS' && typeof file?.source === 'string',
    );
    const matchedFile = serverFiles.find((file: any) => isPersonalAiScheduledMessagesSource(file.source));

    if (!matchedFile) {
      throw new AppScriptDeploymentRecoveryError({
        scriptId,
        message: `当前 Script ID 对应的项目代码未发现 Personal AI Scheduled Messages 标记，已停止升级以避免覆盖用户自定义或错误项目。项目文件: ${summarizeProjectContentFiles(files)}。`,
        errorCode: APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR,
        helpMessage: '请打开 Apps Script 项目确认 Script ID、Web App URL 和 Personal AI 调度脚本是否对应；如需升级，请重新绑定正确项目后重试。'
      });
    }

    console.log(`✅ App Script 项目代码归属已确认: ${matchedFile.name || 'SERVER_JS'}`);
  }
  
  /**
   * 创建新版本
   */
  private async createVersion(scriptId: string, version: string): Promise<number> {
    const response = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/versions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `Auto update to version ${version}`
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      if (isProjectHistoryLimitError(error)) {
        throw new AppScriptProjectHistoryLimitError(scriptId);
      }
      throw new Error(`创建版本失败: ${error}`);
    }
    
    const versionResult = await response.json();
    console.log(`✅ 版本创建成功: ${versionResult.versionNumber}`);
    return versionResult.versionNumber;
  }

  /**
   * 查询 Project History 已使用的版本数量。Apps Script 每个项目最多 200 个版本。
   */
  private async getProjectVersionUsage(scriptId: string): Promise<AppScriptVersionUsage> {
    let pageToken = '';
    let count = 0;

    do {
      const params = new URLSearchParams({ pageSize: String(APP_SCRIPT_VERSION_LIMIT) });
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(
        `https://script.googleapis.com/v1/projects/${scriptId}/versions?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`获取 Project History 版本列表失败: ${error}`);
      }

      const data = await response.json();
      count += Array.isArray(data.versions) ? data.versions.length : 0;
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    const remaining = Math.max(0, APP_SCRIPT_VERSION_LIMIT - count);
    return {
      count,
      limit: APP_SCRIPT_VERSION_LIMIT,
      remaining,
      nearLimit: count >= APP_SCRIPT_VERSION_WARNING_THRESHOLD,
      projectHistoryUrl: buildProjectHistoryUrl(scriptId)
    };
  }

  private async assertProjectVersionCapacity(scriptId: string): Promise<AppScriptVersionUsage> {
    const usage = await this.getProjectVersionUsage(scriptId);

    if (usage.remaining <= 0) {
      throw new AppScriptProjectHistoryLimitError(scriptId, usage);
    }

    if (usage.nearLimit) {
      console.warn(
        `⚠️ App Script Project History 版本额度偏高: ${usage.count}/${usage.limit}，本次升级后剩余 ${usage.remaining - 1}`,
      );
    }

    return usage;
  }

  private async getDeploymentVersionNumber(scriptId: string, deploymentId: string): Promise<number | undefined> {
    const response = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/deployments/${deploymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`读取 deployment 当前版本失败: ${error}`);
    }

    const deployment = await response.json();
    const versionNumber = deployment?.deploymentConfig?.versionNumber;
    return typeof versionNumber === 'number' ? versionNumber : undefined;
  }
  
  /**
   * 获取或创建 Deployment ID
   * 
   * 重要：必须使用有 versionNumber 的正式 deployment，而不是 @HEAD deployment
   * 
   * Deployment 类型：
   * 1. @HEAD Deployment（测试部署）
   *    - 没有 versionNumber
   *    - updateTime 是 1970-01-01T00:00:00Z
   *    - 只读，不能通过 API 修改
   *    - ❌ 不能用于自动更新
   * 
   * 2. 正式版本 Deployment
   *    - 有 versionNumber
   *    - 有正常的 updateTime
   *    - 可以通过 API 更新
   *    - ✅ 用于自动更新
   */
  private async getOrCreateDeploymentId(): Promise<string> {
    // 优先从配置中读取 deploymentId（兼容老版本）
    if (this.config?.deploymentId) {
      console.log(`使用配置中的 deployment ID: ${this.config.deploymentId}`);
      
      // 验证这个 deploymentId 是否是正式版本（有 versionNumber）
      try {
        const isValid = await this.verifyDeploymentId(this.config.deploymentId);
        if (isValid) {
          return this.config.deploymentId;
        } else {
          console.warn('⚠️ 配置中的 deployment 不可更新或与当前 Web App URL 不匹配，需要查找匹配的正式版本');
        }
      } catch (error) {
        console.warn('⚠️ 验证 deployment ID 失败，重新查找:', error);
      }
    }
    
    // 从 API 获取 deployments 列表
    if (!this.config?.scriptId) {
      throw new Error('未找到 Script ID');
    }
    
    const response = await fetch(
      `https://script.googleapis.com/v1/projects/${this.config.scriptId}/deployments`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('获取 deployments 列表失败');
    }
    
    const data = await response.json();
    const deployments = data.deployments || [];
    
    // 查找正式版本的 Web App deployment（必须有 versionNumber）
    const versionedDeployments = deployments.filter(isVersionedWebAppDeployment);
    const versionedDeployment = this.config.webAppUrl
      ? versionedDeployments.find((deployment: any) => this.deploymentMatchesConfiguredWebAppUrl(deployment))
      : versionedDeployments[0];
    
    if (versionedDeployment) {
      const deploymentId = versionedDeployment.deploymentId;
      const versionNumber = versionedDeployment.deploymentConfig.versionNumber;
      console.log(`✅ 找到正式版本 deployment: ${deploymentId} (version ${versionNumber})`);
      
      // 保存到配置
      if (this.config) {
        this.config.deploymentId = deploymentId;
        await this.saveConfigToStorage();
      }
      
      return deploymentId;
    }

    if (this.config.webAppUrl && versionedDeployments.length > 0) {
      console.error('❌ 存在正式 Web App deployment，但没有一个匹配当前配置的 Web App URL');
      console.error('当前配置 Web App URL:', this.config.webAppUrl);
      console.error('正式 Web App deployments:', versionedDeployments.map((d: any) => ({
        id: d.deploymentId,
        version: d.deploymentConfig?.versionNumber,
        webAppUrl: getDeploymentWebAppUrl(d)
      })));
      throw new AppScriptDeploymentRecoveryError({
        scriptId: this.config.scriptId,
        message: this.buildDeploymentMismatchMessage(versionedDeployments),
        errorCode: APP_SCRIPT_DEPLOYMENT_MISMATCH_ERROR,
        helpMessage: '请打开 Apps Script 项目，进入 Deploy > Manage deployments，确认当前 Web App URL 对应的正式 deployment 后重试。'
      });
    }
    
    // 如果没有找到正式版本 deployment，列出所有 deployment 供调试
    console.error('❌ 未找到正式版本的 Web App deployment');
    console.error('所有 deployments:', deployments.map((d: any) => ({
      id: d.deploymentId,
      hasVersion: !!d.deploymentConfig?.versionNumber,
      version: d.deploymentConfig?.versionNumber,
      updateTime: d.updateTime
    })));
    
    throw new AppScriptDeploymentRecoveryError({
      scriptId: this.config.scriptId,
      message: '未找到可更新的 Web App deployment（需要有 versionNumber 的正式部署）。',
      errorCode: APP_SCRIPT_DEPLOYMENT_NOT_FOUND_ERROR,
      helpMessage: '请打开 Apps Script 项目，创建或重新部署一个 Versioned Web App deployment 后重试。'
    });
  }
  
  /**
   * 验证 deployment ID 是否是正式版本（非 @HEAD）
   */
  private async verifyDeploymentId(deploymentId: string): Promise<boolean> {
    if (!this.config?.scriptId) {
      return false;
    }
    
    try {
      const response = await fetch(
        `https://script.googleapis.com/v1/projects/${this.config.scriptId}/deployments/${deploymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      if (!response.ok) {
        return false;
      }
      
      const deployment = await response.json();
      
      // 检查是否有 versionNumber（正式版本），且 Web App URL 与当前配置一致
      if (!isVersionedWebAppDeployment(deployment)) {
        return false;
      }

      if (!this.deploymentMatchesConfiguredWebAppUrl(deployment)) {
        console.warn('⚠️ 配置中的 deployment 与当前 Web App URL 不匹配，需要重新查找匹配部署', {
          deploymentId,
          configuredWebAppUrl: this.config?.webAppUrl,
          deploymentWebAppUrl: getDeploymentWebAppUrl(deployment)
        });
        return false;
      }

      return true;
      
    } catch (error) {
      console.warn('验证 deployment 失败:', error);
      return false;
    }
  }
  
  /**
   * 更新部署（使用 update API 保持 URL 不变）
   */
  private async updateDeployment(
    scriptId: string,
    deploymentId: string,
    versionNumber: number,
    version: string,
    description = `Personal AI Scheduled Messages v${version}`,
  ): Promise<void> {
    const response = await fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}/deployments/${deploymentId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deploymentConfig: {
            scriptId,
            versionNumber: versionNumber,
            manifestFileName: 'appsscript',
            description
          }
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`更新部署失败: ${error}`);
    }
    
    console.log('✅ 部署已更新（URL 保持不变）');
  }

  private async rollbackDeploymentAfterVerificationFailure(
    verificationError: AppScriptDeploymentVerificationError,
    scriptId: string,
    deploymentId: string,
    previousVersionNumber: number,
    failedVersion: string,
  ): Promise<AppScriptDeploymentVerificationError> {
    try {
      await this.updateDeployment(
        scriptId,
        deploymentId,
        previousVersionNumber,
        failedVersion,
        `Personal AI Scheduled Messages rollback after failed v${failedVersion}`,
      );
      console.warn(`⚠️ Web App 新版本未确认生效，已把 deployment 回退到升级前版本 ${previousVersionNumber}`);
      return new AppScriptDeploymentVerificationError({
        scriptId,
        latestVersion: verificationError.latestVersion,
        observedVersion: verificationError.currentVersion,
        reason: verificationError.reason,
        rollbackAttempted: true,
        rollbackSucceeded: true,
        rollbackVersionNumber: previousVersionNumber,
      });
    } catch (rollbackError) {
      const rollbackErrorMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
      console.error('❌ Web App 新版本未确认生效，且 deployment 回退失败:', rollbackError);
      return new AppScriptDeploymentVerificationError({
        scriptId,
        latestVersion: verificationError.latestVersion,
        observedVersion: verificationError.currentVersion,
        reason: verificationError.reason,
        rollbackAttempted: true,
        rollbackSucceeded: false,
        rollbackVersionNumber: previousVersionNumber,
        rollbackError: rollbackErrorMessage,
      });
    }
  }

  private async verifyUpdatedDeploymentServingVersion(
    scriptId: string,
    latestVersion: string
  ): Promise<DeployedAppScriptVersionInfo> {
    if (!this.config?.webAppUrl) {
      return { version: latestVersion };
    }

    const attempts = Math.max(1, AppScriptUpdater.deploymentVerificationAttempts);
    const delayMs = Math.max(0, AppScriptUpdater.deploymentVerificationDelayMs);
    let observedVersion: string | undefined;
    let lastReason = '版本端点没有返回可确认的结果';

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const deployedVersionInfo = await this.getDeployedVersionInfo();
        observedVersion = deployedVersionInfo.version;
        const comparison = compareAppScriptVersions(deployedVersionInfo.version, latestVersion);

        if (!deployedVersionInfo.legacyFallback && comparison >= 0) {
          console.log(`✅ Web App 版本已确认生效: ${deployedVersionInfo.version}`);
          return deployedVersionInfo;
        }

        lastReason = deployedVersionInfo.legacyFallback
          ? '版本端点仍按旧版脚本响应'
          : `版本端点仍返回 ${deployedVersionInfo.version}`;
      } catch (error) {
        lastReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt < attempts && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new AppScriptDeploymentVerificationError({
      scriptId,
      latestVersion,
      observedVersion,
      reason: lastReason
    });
  }

  private buildPersistedVersionInfoFromVerification(
    verifiedVersionInfo: DeployedAppScriptVersionInfo,
    bundledVersionInfo: AppScriptVersionInfo
  ): AppScriptVersionInfo {
    const comparison = compareAppScriptVersions(
      verifiedVersionInfo.version,
      bundledVersionInfo.version,
    );

    if (comparison === 0) {
      return bundledVersionInfo;
    }

    return {
      version: verifiedVersionInfo.version,
      lastUpdated: verifiedVersionInfo.lastUpdated || bundledVersionInfo.lastUpdated
    };
  }
  
  /**
   * 更新配置中的版本信息
   */
  private async updateConfigVersion(versionInfo: AppScriptVersionInfo): Promise<void> {
    if (!this.config) {
      return;
    }
    
    this.config.appScriptVersion = versionInfo.version;
    this.config.appScriptLastUpdated = versionInfo.lastUpdated;
    await this.syncConfigSheetFirst();
  }

  private async syncConfigSheetFirst(): Promise<void> {
    if (!this.config) {
      return;
    }

    const syncService = new ConfigSyncService(this.token);
    let configToSync = this.config;
    try {
      const sheetConfig = await syncService.readConfigFromSheet(this.config.sheetId);
      configToSync = normalizeSheetConfig({
        ...this.config,
        ...sheetConfig,
        // Keep the metadata that this updater just observed or deployed, but
        // adopt schema/Jira/webhook fields from the latest Sheet snapshot.
        deploymentId: this.config.deploymentId || sheetConfig.deploymentId,
        appScriptVersion: this.config.appScriptVersion,
        appScriptLastUpdated: this.config.appScriptLastUpdated,
      }) as SheetConfig;
    } catch (error) {
      console.warn('读取最新 Sheet Config 失败，使用当前 App Script 配置继续写回:', error);
    }

    this.config = await syncService.syncConfig(configToSync, {
      syncAction: 'app_script_metadata_update',
    });
  }

  private async syncKnownDeployedVersionToConfigIfStale(
    deployedVersionInfo: DeployedAppScriptVersionInfo,
    bundledVersionInfo: AppScriptVersionInfo,
  ): Promise<void> {
    if (!this.config || deployedVersionInfo.legacyFallback) {
      return;
    }

    const deployedComparison = compareAppScriptVersions(
      deployedVersionInfo.version,
      bundledVersionInfo.version,
    );
    const versionInfo: AppScriptVersionInfo = {
      version: deployedVersionInfo.version,
      lastUpdated: deployedComparison === 0
        ? bundledVersionInfo.lastUpdated
        : deployedVersionInfo.lastUpdated || this.config.appScriptLastUpdated || bundledVersionInfo.lastUpdated
    };

    const configuredVersion = this.config.appScriptVersion || '0.0.0';
    const configuredLastUpdated = this.config.appScriptLastUpdated || '';
    const configuredComparison = compareAppScriptVersions(configuredVersion, versionInfo.version);
    const versionIsStale = configuredComparison < 0;
    const dateIsStale = configuredComparison === 0 && configuredLastUpdated !== versionInfo.lastUpdated;

    if (versionIsStale || dateIsStale) {
      await this.updateConfigVersion(versionInfo);
    }
  }
  
  /**
   * 保存配置到 Chrome Storage
   */
  private async saveConfigToStorage(): Promise<void> {
    if (!this.config) {
      return;
    }
    
    await chrome.storage.local.set({ scheduledMessagesConfig: normalizeSheetConfig(this.config) });
    console.log('✅ 配置已保存到 Chrome Storage');
  }
  
  /**
   * 静态方法：检查并自动更新 App Script
   * 用于 background script 在扩展启动/更新时调用
   * 
   * @param getToken - 获取 Google OAuth token 的函数
   * @param options - 可选配置
   * @param options.delay - 执行前的延迟时间（毫秒），默认 3000ms
   * @param options.showNotification - 是否显示 Chrome 通知，默认 true
   */
  static async checkAndAutoUpdate(
    getToken: () => Promise<string | null>,
    options: {
      delay?: number;
      showNotification?: boolean;
    } = {}
  ): Promise<void> {
    const { delay = 3000, showNotification = true } = options;
    
    try {
      // 延迟执行，避免与其他初始化冲突
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // 从 Chrome Storage 读取配置
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const config = result.scheduledMessagesConfig
        ? normalizeSheetConfig(result.scheduledMessagesConfig as SheetConfig)
        : undefined;
      
      if (!config || !config.scriptId || !config.webAppUrl) {
        console.log('⏭️ 未找到 Scheduled Messages 配置，跳过 App Script 更新检查');
        return;
      }
      
      console.log('✅ 找到 Scheduled Messages 配置，检查 App Script 版本...');
      
      // 获取 Google OAuth token
      const token = await getToken();
      if (!token) {
        console.warn('⚠️ 无法获取 Google 授权，跳过 App Script 更新');
        return;
      }
      
      // 创建更新器实例
      const updater = new AppScriptUpdater(token, config);
      
      // 检查是否需要更新
      const checkResult = await updater.checkForUpdates();
      if (checkResult.error) {
        console.warn(`⚠️ App Script 更新检查失败，跳过自动升级: ${checkResult.error}`);
        return;
      }
      
      if (!checkResult.needsUpdate) {
        console.log(`✅ App Script 已是最新版本 (${checkResult.currentVersion})`);
        return;
      }
      
      console.log(`🔄 发现新版本: ${checkResult.latestVersion}，当前版本: ${checkResult.currentVersion}`);
      console.log('🚀 开始自动更新 App Script...');
      
      // 执行更新
      const updateResult = await updater.updateAppScript();
      
      if (updateResult.success) {
        console.log(`✅ ${updateResult.message}`);
        
        // 发送成功通知
        if (showNotification) {
          chrome.notifications.create(
            `appscript-update-success-${Date.now()}`,
            {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'Personal AI - App Script 已更新',
              message: `定时消息系统已自动更新到最新版本 ${updateResult.newVersion}`,
              priority: 1
            }
          );
        }
      } else {
        console.error(`❌ App Script 更新失败: ${updateResult.error}`);
        
        // 发送失败通知
        if (showNotification) {
          if (updateResult.errorCode === APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR && updateResult.helpUrl) {
            const notificationId = `msg_appscript-project-history-${Date.now()}`;
            await chrome.storage.local.set({
              [`notification_link_${notificationId}`]: updateResult.helpUrl
            });
            chrome.notifications.create(
              notificationId,
              {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Personal AI - App Script 需要清理历史版本',
                message: '脚本历史版本已达 200 上限。点击打开 Project History 页面，批量删除旧版本后重试升级。',
                priority: 2
              }
            );
            return;
          }

          if (updateResult.helpUrl) {
            const notificationId = `msg_appscript-recovery-${Date.now()}`;
            await chrome.storage.local.set({
              [`notification_link_${notificationId}`]: updateResult.helpUrl
            });
            chrome.notifications.create(
              notificationId,
              {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Personal AI - App Script 需要检查',
                message: updateResult.helpMessage || 'App Script 自动更新未确认成功。点击打开 Apps Script 项目检查部署状态。',
                priority: 2
              }
            );
            return;
          }

          chrome.notifications.create(
            `appscript-update-failed-${Date.now()}`,
            {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'Personal AI - App Script 更新失败',
              message: '定时消息系统更新失败，请手动更新或联系管理员',
              priority: 2
            }
          );
        }
      }
      
    } catch (error) {
      console.error('❌ checkAndAutoUpdate 执行失败:', error);
    }
  }
}
