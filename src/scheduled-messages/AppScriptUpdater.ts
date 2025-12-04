/**
 * App Script 自动更新器
 * 负责检测和更新用户已部署的 App Script 代码
 */

import { SheetConfig } from './types';
import { ConfigSyncService } from './ConfigSyncService';

export interface UpdateCheckResult {
  needsUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  error?: string;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  newVersion?: string;
  error?: string;
}

export class AppScriptUpdater {
  private token: string;
  private config: SheetConfig | null = null;
  
  // 缓存版本信息，避免重复读取文件
  private static cachedVersionInfo: { version: string; lastUpdated: string } | null = null;
  
  constructor(token: string, config?: SheetConfig) {
    this.token = token;
    this.config = config || null;
  }
  
  /**
   * 从 App Script 模板文件中解析版本信息
   */
  private static async parseVersionFromTemplate(): Promise<{ version: string; lastUpdated: string }> {
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
        version: versionMatch[1],
        lastUpdated: lastUpdatedMatch[1]
      };
      
      // 缓存结果
      AppScriptUpdater.cachedVersionInfo = versionInfo;
      
      console.log(`📦 从模板文件解析到版本信息: ${versionInfo.version} (${versionInfo.lastUpdated})`);
      return versionInfo;
      
    } catch (error) {
      console.error('解析模板文件版本信息失败:', error);
      // 回退到默认版本
      const fallbackVersion = { version: '1.0.0', lastUpdated: new Date().toISOString().split('T')[0] };
      AppScriptUpdater.cachedVersionInfo = fallbackVersion;
      return fallbackVersion;
    }
  }
  
  /**
   * 获取最新的 App Script 版本号
   */
  static async getLatestVersion(): Promise<string> {
    const versionInfo = await AppScriptUpdater.parseVersionFromTemplate();
    return versionInfo.version;
  }
  
  /**
   * 检查是否需要更新
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      // 获取最新版本号
      const latestVersion = await AppScriptUpdater.getLatestVersion();
      
      if (!this.config?.webAppUrl) {
        return {
          needsUpdate: false,
          currentVersion: 'unknown',
          latestVersion,
          error: '未找到 Web App 配置'
        };
      }
      
      // 从 Web App 获取当前部署的版本
      const currentVersion = await this.getDeployedVersion();
      
      // 比较版本
      const needsUpdate = this.compareVersions(currentVersion, latestVersion) < 0;
      
      return {
        needsUpdate,
        currentVersion,
        latestVersion
      };
      
    } catch (error) {
      console.error('检查更新失败:', error);
      // 发生错误时也需要获取最新版本号
      const latestVersion = await AppScriptUpdater.getLatestVersion().catch(() => '1.0.0');
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
  private async getDeployedVersion(): Promise<string> {
    if (!this.config?.webAppUrl) {
      throw new Error('未找到 Web App URL');
    }
    
    try {
      const response = await fetch(`${this.config.webAppUrl}?action=getVersion`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取版本失败: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.version || '0.0.0';
      
    } catch (error) {
      console.warn('无法获取已部署的版本，可能是旧版本脚本:', error);
      // 如果 getVersion 端点不存在，说明是旧版本
      return '0.0.0';
    }
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
      const latestVersion = await AppScriptUpdater.getLatestVersion();
      
      // 1. 加载最新的 App Script 模板代码
      const scriptCode = await this.loadAppScriptTemplate();
      
      // 2. 更新 App Script 项目代码
      await this.updateProjectContent(this.config.scriptId, scriptCode);
      
      // 3. 创建新版本
      const versionNumber = await this.createVersion(this.config.scriptId, latestVersion);
      
      // 4. 获取现有的 deployment ID（必须是有 versionNumber 的正式部署，不是 @HEAD）
      const deploymentId = await this.getOrCreateDeploymentId();
      
      // 5. 更新部署到新版本（保持 URL 不变）
      await this.updateDeployment(this.config.scriptId, deploymentId, versionNumber, latestVersion);
      
      // 6. 更新配置中的版本信息
      await this.updateConfigVersion(latestVersion);
      
      console.log('App Script 更新成功！');
      
      return {
        success: true,
        message: `App Script 已更新到版本 ${latestVersion}`,
        newVersion: latestVersion
      };
      
    } catch (error) {
      console.error('更新 App Script 失败:', error);
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
      throw new Error(`创建版本失败: ${error}`);
    }
    
    const versionResult = await response.json();
    console.log(`✅ 版本创建成功: ${versionResult.versionNumber}`);
    return versionResult.versionNumber;
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
          console.warn('⚠️ 配置中的 deployment 是 @HEAD deployment（只读），需要查找正式版本');
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
    const versionedDeployment = deployments.find((d: any) => 
      d.deploymentConfig?.versionNumber &&  // 必须有 versionNumber
      d.entryPoints?.some((ep: any) => ep.entryPointType === 'WEB_APP')
    );
    
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
    
    // 如果没有找到正式版本 deployment，列出所有 deployment 供调试
    console.error('❌ 未找到正式版本的 Web App deployment');
    console.error('所有 deployments:', deployments.map((d: any) => ({
      id: d.deploymentId,
      hasVersion: !!d.deploymentConfig?.versionNumber,
      version: d.deploymentConfig?.versionNumber,
      updateTime: d.updateTime
    })));
    
    throw new Error('未找到可更新的 Web App deployment（需要有 versionNumber 的正式部署）');
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
      
      // 检查是否有 versionNumber（正式版本）
      return !!deployment.deploymentConfig?.versionNumber;
      
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
    version: string
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
            versionNumber: versionNumber,
            manifestFileName: 'appsscript',
            description: `Personal AI Scheduled Messages v${version}`
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
  
  /**
   * 更新配置中的版本信息
   */
  private async updateConfigVersion(version: string): Promise<void> {
    if (!this.config) {
      return;
    }
    
    this.config.appScriptVersion = version;
    this.config.appScriptLastUpdated = new Date().toISOString();
    
    // 保存到 Chrome Storage
    await this.saveConfigToStorage();
    
    // 同步到 Google Sheet
    await this.syncConfigToSheet();
  }
  
  /**
   * 保存配置到 Chrome Storage
   */
  private async saveConfigToStorage(): Promise<void> {
    if (!this.config) {
      return;
    }
    
    await chrome.storage.local.set({ scheduledMessagesConfig: this.config });
    console.log('✅ 配置已保存到 Chrome Storage');
  }
  
  /**
   * 同步配置到 Google Sheet
   */
  private async syncConfigToSheet(): Promise<void> {
    try {
      const syncService = new ConfigSyncService(this.token);
      await syncService.saveConfigToSheet(this.config!);
      console.log('✅ 配置已同步到 Google Sheet');
    } catch (error) {
      console.warn('同步配置到 Sheet 失败（不影响功能）:', error);
    }
  }
  
  /**
   * 比较版本号
   * @returns -1: v1 < v2, 0: v1 = v2, 1: v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      
      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }
    
    return 0;
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
      const config = result.scheduledMessagesConfig as SheetConfig | undefined;
      
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

