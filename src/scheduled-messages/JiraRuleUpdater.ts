/**
 * Jira Automation Rule 自动更新器
 * 负责检测和更新用户已部署的 Jira Automation 规则
 * 
 * 参考 AppScriptUpdater.ts 的架构实现
 */

import ruleTemplate from './jira-rule-template.json';
import { SheetConfig } from './types';
import { ConfigSyncService } from './ConfigSyncService';
import { 
  JiraAutomationService, 
  JiraAutomationConfig, 
  JIRA_RULE_VERSION, 
  JIRA_RULE_LAST_UPDATED 
} from './JiraAutomationService';
import { getEnvConfig } from '../utils';

export interface JiraRuleUpdateCheckResult {
  needsUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  error?: string;
}

export interface JiraRuleUpdateResult {
  success: boolean;
  message: string;
  newVersion?: string;
  error?: string;
}

export class JiraRuleUpdater {
  private config: SheetConfig | null = null;
  private jiraService: JiraAutomationService;
  
  // 缓存版本信息，避免重复读取
  private static cachedVersionInfo: { version: string; lastUpdated: string } | null = null;
  
  constructor(config?: SheetConfig) {
    this.config = config || null;
    this.jiraService = new JiraAutomationService();
  }
  
  /**
   * 从模板文件中解析版本信息
   */
  private static parseVersionFromTemplate(): { version: string; lastUpdated: string } {
    // 如果已经缓存，直接返回
    if (JiraRuleUpdater.cachedVersionInfo) {
      return JiraRuleUpdater.cachedVersionInfo;
    }
    
    // 从导入的模板中读取 _metadata
    const metadata = (ruleTemplate as any)._metadata;
    
    if (metadata && metadata.version) {
      const versionInfo = {
        version: metadata.version,
        lastUpdated: metadata.lastUpdated || new Date().toISOString().split('T')[0]
      };
      
      // 缓存结果
      JiraRuleUpdater.cachedVersionInfo = versionInfo;
      
      console.log(`📦 从模板文件解析到 Jira Rule 版本信息: ${versionInfo.version} (${versionInfo.lastUpdated})`);
      return versionInfo;
    }
    
    // 回退到常量版本（从 JiraAutomationService 导出）
    const fallbackVersion = { 
      version: JIRA_RULE_VERSION, 
      lastUpdated: JIRA_RULE_LAST_UPDATED 
    };
    JiraRuleUpdater.cachedVersionInfo = fallbackVersion;
    return fallbackVersion;
  }
  
  /**
   * 获取最新的 Jira Rule 版本号
   */
  static getLatestVersion(): string {
    const versionInfo = JiraRuleUpdater.parseVersionFromTemplate();
    return versionInfo.version;
  }
  
  /**
   * 获取最新的更新日期
   */
  static getLatestUpdateDate(): string {
    const versionInfo = JiraRuleUpdater.parseVersionFromTemplate();
    return versionInfo.lastUpdated;
  }
  
  /**
   * 检查是否需要更新
   */
  async checkForUpdates(): Promise<JiraRuleUpdateCheckResult> {
    try {
      // 获取最新版本号
      const latestVersion = JiraRuleUpdater.getLatestVersion();
      
      if (!this.config?.botExecutor?.ruleId || !this.config?.botExecutor?.jiraUrl) {
        return {
          needsUpdate: false,
          currentVersion: 'unknown',
          latestVersion,
          error: '未找到 Bot Executor 配置'
        };
      }
      
      // 从已部署规则获取当前版本
      const currentVersion = await this.getDeployedVersion();
      
      // 比较版本
      const needsUpdate = this.compareVersions(currentVersion, latestVersion) < 0;
      
      return {
        needsUpdate,
        currentVersion,
        latestVersion
      };
      
    } catch (error) {
      console.error('检查 Jira Rule 更新失败:', error);
      const latestVersion = JiraRuleUpdater.getLatestVersion();
      return {
        needsUpdate: false,
        currentVersion: 'unknown',
        latestVersion,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 获取已部署的 Jira Rule 版本
   * 通过解析规则名称中的版本号获取
   */
  private async getDeployedVersion(): Promise<string> {
    if (!this.config?.botExecutor?.ruleId || !this.config?.botExecutor?.jiraUrl) {
      throw new Error('未找到 Bot Executor 配置');
    }
    
    const jiraConfig: JiraAutomationConfig = {
      jiraUrl: this.config.botExecutor.jiraUrl,
      projectKey: this.config.botExecutor.projectKey
    };
    
    try {
      // 获取规则详情
      const rule = await this.jiraService.getRuleById(jiraConfig, this.config.botExecutor.ruleId);
      
      if (!rule) {
        console.warn('⚠️ 无法获取规则详情，可能规则已被删除');
        return '0.0.0';
      }
      
      // 从规则名称解析版本号
      const version = JiraAutomationService.parseVersionFromRuleName(rule.name);
      
      if (version) {
        console.log(`📋 已部署规则版本: ${version}`);
        return version;
      }
      
      // 如果名称中没有版本号，尝试从配置中读取
      if (this.config.botExecutor.ruleVersion) {
        console.log(`📋 从配置读取规则版本: ${this.config.botExecutor.ruleVersion}`);
        return this.config.botExecutor.ruleVersion;
      }
      
      // 如果都没有，返回 0.0.0 表示旧版本
      console.warn('⚠️ 无法解析规则版本，假定为旧版本 (0.0.0)');
      return '0.0.0';
      
    } catch (error) {
      console.warn('获取已部署版本失败:', error);
      return '0.0.0';
    }
  }
  
  /**
   * 执行更新
   * 使用 PUT API 更新现有规则，保持 Rule ID 不变
   */
  async updateJiraRule(): Promise<JiraRuleUpdateResult> {
    try {
      if (!this.config?.botExecutor?.ruleId || !this.config?.botExecutor?.jiraUrl) {
        return {
          success: false,
          message: '未找到 Bot Executor 配置',
          error: 'BOT_EXECUTOR_NOT_FOUND'
        };
      }
      
      console.log('🔄 开始更新 Jira Automation Rule...');
      
      // 0. 获取最新版本号
      const latestVersion = JiraRuleUpdater.getLatestVersion();
      
      // 1. 准备 Jira 配置
      const jiraConfig: JiraAutomationConfig = {
        jiraUrl: this.config.botExecutor.jiraUrl,
        projectKey: this.config.botExecutor.projectKey
      };
      
      // 2. 获取现有规则
      const existingRule = await this.jiraService.getRuleById(
        jiraConfig, 
        this.config.botExecutor.ruleId
      );
      
      if (!existingRule) {
        return {
          success: false,
          message: '规则不存在或已被删除',
          error: 'RULE_NOT_FOUND'
        };
      }
      
      // 3. 准备新的规则 payload
      const newRulePayload = await this.prepareRulePayload(existingRule);
      
      // 4. 调用更新 API
      const updatedRule = await this.jiraService.updateRule(
        jiraConfig,
        this.config.botExecutor.ruleId,
        newRulePayload
      );
      
      // 5. 更新配置中的版本信息
      await this.updateConfigVersion(latestVersion, updatedRule.name);
      
      console.log('✅ Jira Automation Rule 更新成功！');
      
      return {
        success: true,
        message: `Jira Rule 已更新到版本 ${latestVersion}`,
        newVersion: latestVersion
      };
      
    } catch (error) {
      console.error('❌ 更新 Jira Rule 失败:', error);
      return {
        success: false,
        message: '更新失败',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 准备规则 payload
   * 从模板创建新的规则内容，替换占位符
   */
  private async prepareRulePayload(existingRule: any): Promise<any> {
    // 获取环境配置
    const envConfig = await getEnvConfig();
    const { userinfo } = await chrome.storage.local.get('userinfo');
    
    // 保持原有的规则名称前缀（用户名部分）
    const nameMatch = existingRule.name.match(/^\[([^\]]+)\]/);
    const userName = nameMatch ? nameMatch[1] : (userinfo?.fullName?.split(' ')[0] || 'User');
    const ruleName = `[${userName}] Scheduled Messages`;
    
    // 获取 Web App URL
    const webAppUrl = this.config?.webAppUrl || this.config?.botExecutor?.webhookUrl || '';
    
    // 从模板创建规则 payload
    const templateString = JSON.stringify(ruleTemplate);
    const rulePayloadString = templateString
      .replace(/{{RULE_NAME}}/g, ruleName)
      .replace(/{{RULE_VERSION}}/g, JiraRuleUpdater.getLatestVersion())
      .replace(/{{WEB_APP_URL}}/g, webAppUrl)
      .replace(/{{BOT_API_BASE_URL}}/g, envConfig.BOT_API_BASE_URL)
      .replace(/{{BOT_TOKEN}}/g, envConfig.BOT_TOKEN)
      .replace(/{{BOT_ID}}/g, envConfig.BOT_ID)
      .replace(/{{USER_EMAIL}}/g, userinfo?.userEmail || '')
      .replace(/{{PROJECT_KEY}}/g, this.config?.botExecutor?.projectKey || '')
      .replace(/{{PROJECT_ID}}/g, String(existingRule.projects?.[0]?.projectId || ''))
      .replace(/{{USER_KEY}}/g, existingRule.authorAccountId || '');
    
    const rulePayload = JSON.parse(rulePayloadString);
    
    // 移除 _metadata 字段（这是模板内部使用的，不应发送到 Jira）
    delete rulePayload._metadata;
    
    return rulePayload;
  }
  
  /**
   * 更新配置中的版本信息
   */
  private async updateConfigVersion(version: string, ruleName: string): Promise<void> {
    if (!this.config || !this.config.botExecutor) {
      return;
    }
    
    this.config.botExecutor.ruleVersion = version;
    this.config.botExecutor.ruleLastUpdated = new Date().toISOString();
    this.config.botExecutor.ruleName = ruleName;
    
    // 保存到 Chrome Storage
    await this.saveConfigToStorage();
    
    // 尝试同步到 Google Sheet（不阻塞）
    this.syncConfigToSheet().catch(err => {
      console.warn('同步配置到 Sheet 失败（不影响功能）:', err);
    });
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
      // 获取 Google token
      console.log('🔐 [JiraRuleUpdater.syncConfigToSheet] getAuthToken 被调用, interactive=false');
      const token = await new Promise<string>((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError || !token) {
            console.warn('🔐 [JiraRuleUpdater.syncConfigToSheet] 无法获取 token:', chrome.runtime.lastError?.message || 'No token');
            reject(new Error(chrome.runtime.lastError?.message || 'No token'));
          } else {
            console.log('🔐 [JiraRuleUpdater.syncConfigToSheet] getAuthToken 成功');
            resolve(token);
          }
        });
      });
      
      const syncService = new ConfigSyncService(token);
      await syncService.saveConfigToSheet(this.config!);
      console.log('✅ 配置已同步到 Google Sheet');
    } catch (error) {
      console.warn('同步配置到 Sheet 失败:', error);
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
   * 静态方法：检查并自动更新 Jira Rule
   * 用于 background script 在扩展启动/更新时调用
   * 
   * @param getToken - 获取 Google OAuth token 的函数（可选，用于同步配置）
   * @param options - 可选配置
   * @param options.delay - 执行前的延迟时间（毫秒），默认 5000ms
   * @param options.showNotification - 是否显示 Chrome 通知，默认 true
   */
  static async checkAndAutoUpdate(
    getToken?: () => Promise<string | null>,
    options: {
      delay?: number;
      showNotification?: boolean;
    } = {}
  ): Promise<void> {
    const { delay = 5000, showNotification = true } = options;
    
    try {
      // 延迟执行，避免与其他初始化冲突
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // 从 Chrome Storage 读取配置
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const config = result.scheduledMessagesConfig as SheetConfig | undefined;
      
      if (!config || !config.botExecutor?.ruleId || !config.botExecutor?.jiraUrl) {
        console.log('⏭️ 未找到 Jira Bot Executor 配置，跳过 Jira Rule 更新检查');
        return;
      }
      
      console.log('✅ 找到 Bot Executor 配置，检查 Jira Rule 版本...');
      
      // 创建更新器实例
      const updater = new JiraRuleUpdater(config);
      
      // 检查是否需要更新
      const checkResult = await updater.checkForUpdates();
      
      if (checkResult.error) {
        console.warn(`⚠️ 检查 Jira Rule 更新时出错: ${checkResult.error}`);
        return;
      }
      
      if (!checkResult.needsUpdate) {
        console.log(`✅ Jira Rule 已是最新版本 (${checkResult.currentVersion})`);
        return;
      }
      
      console.log(`🔄 发现新版本: ${checkResult.latestVersion}，当前版本: ${checkResult.currentVersion}`);
      console.log('🚀 开始自动更新 Jira Rule...');
      
      // 执行更新
      const updateResult = await updater.updateJiraRule();
      
      if (updateResult.success) {
        console.log(`✅ ${updateResult.message}`);
        
        // 发送成功通知
        if (showNotification) {
          chrome.notifications.create(
            `jira-rule-update-success-${Date.now()}`,
            {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'Personal AI - Jira Rule 已更新',
              message: `定时消息 Bot 规则已自动更新到最新版本 ${updateResult.newVersion}`,
              priority: 1
            }
          );
        }
      } else {
        console.error(`❌ Jira Rule 更新失败: ${updateResult.error}`);
        
        // 发送失败通知
        if (showNotification) {
          chrome.notifications.create(
            `jira-rule-update-failed-${Date.now()}`,
            {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'Personal AI - Jira Rule 更新失败',
              message: '定时消息 Bot 规则更新失败，请手动检查或重新配置',
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

