/**
 * Jira Automation 服务
 * 负责创建和管理 Bot 推送的 Jira Automation 规则
 */

import executorRuleTemplate from './jira-rule-template.json';
import timelineSyncRuleTemplate from './jira-timeline-sync-rule-template.json';
import { getEnvConfig } from '../utils';
import { getJiraToken, jiraFetch } from '../jira';
import { buildTimelineSyncComponentsFragment } from './timelineProjects';
import { BotAutomationConfig, BotAutomationRule } from './types';

// Jira Rule 版本信息（从模板的 _metadata 字段读取）
export const JIRA_EXECUTOR_RULE_VERSION = (executorRuleTemplate as any)._metadata?.version || '1.3.0';
export const JIRA_EXECUTOR_RULE_LAST_UPDATED = (executorRuleTemplate as any)._metadata?.lastUpdated || '2026-03-18';
export const JIRA_TIMELINE_SYNC_RULE_VERSION = (timelineSyncRuleTemplate as any)._metadata?.version || JIRA_EXECUTOR_RULE_VERSION;
export const JIRA_TIMELINE_SYNC_RULE_LAST_UPDATED =
  (timelineSyncRuleTemplate as any)._metadata?.lastUpdated || JIRA_EXECUTOR_RULE_LAST_UPDATED;
export const JIRA_RULE_VERSION = JIRA_EXECUTOR_RULE_VERSION;
export const JIRA_RULE_LAST_UPDATED = JIRA_EXECUTOR_RULE_LAST_UPDATED;

export interface JiraAutomationConfig {
  jiraUrl: string;  // Jira 实例 URL，如 https://jira.ringcentral.com
  projectKey: string;  // 项目 Key，如 MTR
  token?: string;  // Personal Access Token (可选，用于认证)
}

// Jira 规则完整对象（从 API 返回）
export interface JiraRule {
  id: number;
  clientKey?: string;
  name: string;
  state: string;
  description?: string;
  canOtherRuleTrigger: boolean;
  notifyOnError: string;
  authorAccountId: string;
  actorAccountId: string;
  created?: number;
  updated?: number;
  trigger: any;
  components: any[];
  projects: any[];
  labels: any[];
  tags: any[];
}

type JiraRuleTemplateKind = 'executor' | 'timelineSync';

interface CreateRuleContext {
  projectId: string;
  userKey: string;
  ruleNameBase: string;
  webAppUrl: string;
  userEmail: string;
  envConfig: Awaited<ReturnType<typeof getEnvConfig>>;
}

export class JiraAutomationService {
  /**
   * 获取有效的 token（优先使用 config.token，否则自动从配置获取）
   */
  private async getEffectiveToken(config: JiraAutomationConfig): Promise<string | undefined> {
    // 如果 config 中明确指定了 token，优先使用
    if (config.token) {
      return config.token;
    }
    // 否则从全局配置自动获取
    const token = await getJiraToken();
    return token || undefined;
  }
  
  /**
   * 获取当前用户的 account key
   */
  private async getCurrentUserKey(config: JiraAutomationConfig): Promise<string> {
    const url = `${config.jiraUrl}/rest/api/2/myself`;
    const token = await this.getEffectiveToken(config);
    
    const response = await jiraFetch(url, { token });
    
    if (!response.ok) {
      throw new Error(`无法获取用户信息 (${response.status}): ${await response.text()}`);
    }
    
    const userInfo = await response.json();
    
    // Jira Cloud 使用 accountId，Jira Server/Data Center 使用 key
    const userKey = userInfo.accountId || userInfo.key;
    
    if (!userKey) {
      throw new Error('无法从用户信息中获取 accountId 或 key');
    }
    
    console.log('当前用户 Key:', userKey);
    return userKey;
  }
  
  /**
   * 通过项目 Key 获取项目 ID
   */
  private async getProjectId(config: JiraAutomationConfig): Promise<string> {
    const url = `${config.jiraUrl}/rest/api/2/project/${config.projectKey}`;
    const token = await this.getEffectiveToken(config);
    
    const response = await jiraFetch(url, { token });
    
    if (!response.ok) {
      throw new Error(`无法获取项目信息 (${response.status}): ${await response.text()}`);
    }
    
    const project = await response.json();
    return project.id;
  }
  
  /**
   * 检查 Jira 登录状态
   */
  private async checkJiraLoginStatus(jiraUrl: string): Promise<{ loggedIn: boolean; cookies: string[] }> {
    try {
      const domain = new URL(jiraUrl).hostname;
      const cookies = await chrome.cookies.getAll({ domain });
      
      // Jira 的主要认证 cookies
      const authCookies = cookies.filter(cookie => 
        cookie.name === 'cloud.session.token' ||  // Jira Cloud
        cookie.name === 'JSESSIONID' ||           // Jira Server/Data Center
        cookie.name === 'atlassian.xsrf.token'
      );
      
      return {
        loggedIn: authCookies.length > 0,
        cookies: authCookies.map(c => c.name)
      };
    } catch (error) {
      console.error('检查 Jira 登录状态失败:', error);
      return { loggedIn: false, cookies: [] };
    }
  }
  
  /**
   * 测试是否能访问 Jira Automation API
   */
  async testAccess(config: JiraAutomationConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 检查是否有可用的认证方式
      const token = await this.getEffectiveToken(config);
      const loginStatus = await this.checkJiraLoginStatus(config.jiraUrl);
      console.log('Jira 登录状态:', loginStatus);
      console.log('Token 可用:', !!token);
      
      if (!loginStatus.loggedIn && !token) {
        return { 
          success: false, 
          message: '未检测到 Jira 登录状态且未配置 Token。请先在浏览器中打开 Jira 并登录，或在设置中配置 Personal Access Token。' 
        };
      }
      
      // 获取项目 ID
      console.log('正在获取项目 ID...');
      const projectId = await this.getProjectId(config);
      console.log(`项目 ${config.projectKey} 的 ID: ${projectId}`);
      
      const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
      
      const response = await jiraFetch(url, { token });
      
      console.log('Jira API 响应状态:', response.status);
      
      if (response.ok) {
        return { success: true, message: '连接成功！可以访问 Jira Automation API。' };
      } else if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        console.error('认证失败，响应:', errorText);
        
        // 提供更详细的错误信息
        if (!loginStatus.loggedIn && !token) {
          return { 
            success: false, 
            message: '认证失败：未检测到 Jira 登录且未配置 Token。请在新标签页中打开 Jira 并完成登录，或在设置中配置 Personal Access Token。' 
          };
        } else {
          return { 
            success: false, 
            message: `认证失败：您可能没有项目 ${config.projectKey} 的 Automation 权限。请检查：\n1. 您是否是该项目的管理员\n2. 项目是否启用了 Automation 功能` 
          };
        }
      } else if (response.status === 404) {
        return { 
          success: false, 
          message: `项目不存在：找不到项目 ${config.projectKey}。请检查 Project Key 是否正确。` 
        };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          message: `无法访问 Jira Automation API (状态码: ${response.status})\n${errorText}` 
        };
      }
    } catch (error: any) {
      console.error('测试连接失败:', error);
      return { success: false, message: `连接失败: ${error.message}` };
    }
  }

  private getRuleTemplate(kind: JiraRuleTemplateKind): any {
    return kind === 'timelineSync' ? timelineSyncRuleTemplate : executorRuleTemplate;
  }

  private getRuleVersion(kind: JiraRuleTemplateKind): string {
    return kind === 'timelineSync' ? JIRA_TIMELINE_SYNC_RULE_VERSION : JIRA_EXECUTOR_RULE_VERSION;
  }

  private buildRulePayloadString(
    kind: JiraRuleTemplateKind,
    context: CreateRuleContext,
    config: JiraAutomationConfig
  ): string {
    const template = this.getRuleTemplate(kind);
    const templateString = JSON.stringify(template);
    const ruleName = kind === 'timelineSync'
      ? `${context.ruleNameBase} Timeline Sync`
      : context.ruleNameBase;

    // 必须先替换 TIMELINE_SYNC_COMPONENTS，再替换 WEB_APP_URL（后者存在于 fragment 中）
    return templateString
      .replace(/{{RULE_NAME}}/g, ruleName)
      .replace(/{{RULE_VERSION}}/g, this.getRuleVersion(kind))
      .replace(/"{{TIMELINE_SYNC_COMPONENTS}}"/g, buildTimelineSyncComponentsFragment())
      .replace(/{{WEB_APP_URL}}/g, context.webAppUrl)
      .replace(/{{BOT_API_BASE_URL}}/g, context.envConfig.BOT_API_BASE_URL)
      .replace(/{{BOT_TOKEN}}/g, context.envConfig.BOT_TOKEN)
      .replace(/{{BOT_ID}}/g, context.envConfig.BOT_ID)
      .replace(/{{USER_EMAIL}}/g, context.userEmail)
      .replace(/{{PROJECT_KEY}}/g, config.projectKey)
      .replace(/{{PROJECT_ID}}/g, context.projectId)
      .replace(/{{USER_KEY}}/g, context.userKey);
  }

  private async createRuleFromTemplate(
    kind: JiraRuleTemplateKind,
    config: JiraAutomationConfig,
    context: CreateRuleContext
  ): Promise<BotAutomationRule> {
    const rulePayloadString = this.buildRulePayloadString(kind, context, config);
    const rulePayload = JSON.parse(rulePayloadString);
    delete rulePayload._metadata;

    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${context.projectId}/rule`;
    const token = await this.getEffectiveToken(config);

    console.log('创建 Jira Automation 规则:', rulePayload.name);
    console.log('Rule Payload:', JSON.stringify(rulePayload, null, 2));

    const response = await jiraFetch(url, {
      method: 'POST',
      headers: { 'X-Atlassian-Token': 'no-check' },
      body: rulePayload,
      token
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('创建规则失败，响应:', errorText);
      throw new Error(`创建 Jira Automation 规则失败 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('创建规则成功:', result);

    return {
      ruleId: String(result.id),
      ruleName: result.name,
      webhookUrl: context.webAppUrl,
      projectKey: config.projectKey,
      jiraUrl: config.jiraUrl,
      createdAt: new Date().toISOString(),
      ruleVersion: this.getRuleVersion(kind),
      ruleLastUpdated: new Date().toISOString(),
    };
  }

  private async buildCreateRuleContext(
    config: JiraAutomationConfig,
    webAppUrl: string
  ): Promise<CreateRuleContext> {
    console.log('正在获取当前用户信息...');
    const userKey = await this.getCurrentUserKey(config);
    console.log(`当前用户 Key: ${userKey}`);

    console.log('正在获取项目 ID...');
    const projectId = await this.getProjectId(config);
    console.log(`项目 ${config.projectKey} 的 ID: ${projectId}`);

    console.log('正在读取 Bot 配置...');
    const envConfig = await getEnvConfig();
    const { userinfo } = await chrome.storage.local.get('userinfo');
    const ruleNameBase = `[${userinfo.fullName.split(' ')[0]}] Scheduled Messages`;

    console.log(`Bot Type: ${envConfig.BOT_TYPE}`);
    console.log(`用户邮箱: ${userinfo.userEmail}`);

    return {
      projectId,
      userKey,
      ruleNameBase,
      webAppUrl,
      userEmail: userinfo.userEmail,
      envConfig,
    };
  }
  
  /**
   * 创建 Bot 执行器规则
   * 每分钟调用 AppScript Web App，获取需要执行的 Bot 消息并推送
   */
  async createBotExecutorRule(
    config: JiraAutomationConfig,
    webAppUrl: string
  ): Promise<BotAutomationRule> {
    const context = await this.buildCreateRuleContext(config, webAppUrl);
    return this.createRuleFromTemplate('executor', config, context);
  }

  /**
   * 创建 Timeline Sync 规则
   * 每天从内网获取 releaseInfo 并按项目写入 App Script 缓存
   */
  async createTimelineSyncRule(
    config: JiraAutomationConfig,
    webAppUrl: string
  ): Promise<BotAutomationRule> {
    const context = await this.buildCreateRuleContext(config, webAppUrl);
    return this.createRuleFromTemplate('timelineSync', config, context);
  }

  /**
   * 一次性创建 Bot 执行规则和 Timeline Sync 规则
   */
  async createBotAutomationRules(
    config: JiraAutomationConfig,
    webAppUrl: string
  ): Promise<BotAutomationConfig> {
    const context = await this.buildCreateRuleContext(config, webAppUrl);

    let timelineSyncRule: BotAutomationRule | undefined;

    try {
      timelineSyncRule = await this.createRuleFromTemplate('timelineSync', config, context);
      const executorRule = await this.createRuleFromTemplate('executor', config, context);

      return {
        executorRule,
        timelineSyncRule,
      };
    } catch (error) {
      if (timelineSyncRule?.ruleId) {
        this.deleteRule(config, timelineSyncRule.ruleId).catch(deleteError => {
          console.warn('清理已创建的 Timeline Sync Rule 失败:', deleteError);
        });
      }

      throw error;
    }
  }
  
  /**
   * 获取项目的所有规则
   */
  async getRules(config: JiraAutomationConfig): Promise<any[]> {
    // 获取项目 ID 
    const projectId = await this.getProjectId(config);
    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
    const token = await this.getEffectiveToken(config);
    
    const response = await jiraFetch(url, { token });
    
    if (!response.ok) {
      throw new Error(`获取规则列表失败 (${response.status})`);
    }
    
    return await response.json();
  }
  
  /**
   * 检查规则是否存在
   * 注意：Jira Automation API 不支持直接通过 rule ID 获取单个规则
   * 需要获取项目的所有规则列表，然后查找指定的 rule ID
   */
  async checkRuleExists(config: JiraAutomationConfig, ruleId: string): Promise<boolean> {
    try {
      console.log(`检查规则是否存在: ${ruleId}`);
      
      // 获取项目的所有规则
      const rules = await this.getRules(config);
      
      // 在规则列表中查找指定的 rule ID
      const ruleExists = rules.some((rule: any) => rule.id === parseInt(ruleId, 10));
      
      console.log(`规则 ${ruleId} ${ruleExists ? '存在' : '不存在'}`);
      return ruleExists;
    } catch (error) {
      console.error('检查规则是否存在时出错:', error);
      // 如果获取规则列表失败（可能是权限问题），假定规则存在，避免误报
      return true;
    }
  }
  
  /**
   * 删除规则
   */
  async deleteRule(config: JiraAutomationConfig, ruleId: string): Promise<void> {
    const url = `${config.jiraUrl}/rest/cb-automation/latest/rule/${ruleId}`;
    const token = await this.getEffectiveToken(config);
    
    const response = await jiraFetch(url, {
      method: 'DELETE',
      headers: { 'X-Atlassian-Token': 'no-check' },
      token
    });
    
    if (!response.ok) {
      throw new Error(`删除规则失败 (${response.status})`);
    }
  }
  
  /**
   * 通过 ID 获取指定规则的完整信息
   * 注意：Jira Automation API 不支持直接通过 rule ID 获取单个规则
   * 需要获取项目的所有规则列表，然后查找指定的 rule ID
   */
  async getRuleById(config: JiraAutomationConfig, ruleId: string): Promise<JiraRule | null> {
    try {
      console.log(`获取规则详情: ${ruleId}`);
      
      // 获取项目的所有规则
      const rules = await this.getRules(config);
      
      // 在规则列表中查找指定的 rule ID
      const rule = rules.find((r: any) => r.id === parseInt(ruleId, 10));
      
      if (rule) {
        console.log(`✅ 找到规则 ${ruleId}: ${rule.name}`);
        return rule as JiraRule;
      } else {
        console.log(`❌ 未找到规则 ${ruleId}`);
        return null;
      }
    } catch (error) {
      console.error('获取规则详情时出错:', error);
      throw error;
    }
  }
  
  /**
   * 更新规则
   * 使用 PUT API 直接更新规则，保持 Rule ID 不变
   * 
   * @param config Jira 配置
   * @param ruleId 规则 ID
   * @param rulePayload 新的规则内容（不含服务器生成的字段如 id, created, updated）
   * @returns 更新后的规则对象
   */
  async updateRule(
    config: JiraAutomationConfig,
    ruleId: string,
    rulePayload: Partial<JiraRule>
  ): Promise<JiraRule> {
    // 获取项目 ID
    const projectId = await this.getProjectId(config);
    
    // 获取现有规则以保留服务器字段
    const existingRule = await this.getRuleById(config, ruleId);
    if (!existingRule) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }
    
    // 合并现有规则和新 payload
    // 保留服务器生成的字段：id, clientKey, authorAccountId, actorAccountId, created, updated
    const mergedPayload: JiraRule = {
      ...existingRule,
      ...rulePayload,
      // 确保保留这些服务器字段
      id: existingRule.id,
      clientKey: existingRule.clientKey,
      authorAccountId: existingRule.authorAccountId,
      actorAccountId: existingRule.actorAccountId,
      created: existingRule.created,
      updated: existingRule.updated,
    };
    
    console.log(`📝 更新规则 ${ruleId}...`);
    
    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`;
    const token = await this.getEffectiveToken(config);
    
    const response = await jiraFetch(url, {
      method: 'PUT',
      headers: { 'X-Atlassian-Token': 'no-check' },
      body: mergedPayload,
      token
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('更新规则失败，响应:', errorText);
      throw new Error(`更新 Jira Automation 规则失败 (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ 规则更新成功:', result.name);
    
    return result as JiraRule;
  }
  
  /**
   * 从规则名称中解析版本号
   * 规则名称格式：`[用户名] Scheduled Messages v1.0.0`
   * 
   * @param ruleName 规则名称
   * @returns 版本号，如果无法解析则返回 null
   */
  static parseVersionFromRuleName(ruleName: string): string | null {
    // 匹配 v 后面的版本号，如 v1.0.0, v2.1.0 等
    const match = ruleName.match(/v(\d+\.\d+\.\d+)/i);
    return match ? match[1] : null;
  }
  
  /**
   * 获取最新的规则版本号（从模板中读取）
   */
  static getLatestVersion(): string {
    return JIRA_RULE_VERSION;
  }
  
  /**
   * 获取规则最后更新日期（从模板中读取）
   */
  static getLatestUpdateDate(): string {
    return JIRA_RULE_LAST_UPDATED;
  }
  
  // =====================================================
  // 以下是为 Scheduled Messages 导入功能新增的方法
  // =====================================================
  
  /**
   * 解析 Scheduled Trigger 的配置信息
   * @param trigger Jira Rule 的 trigger 对象
   * @returns 解析后的调度配置，如果不是 scheduled trigger 则返回 null
   */
  static parseScheduleConfig(trigger: any): ScheduleParsedConfig | null {
    if (!trigger || trigger.type !== 'jira.jql.scheduled') {
      return null;
    }
    
    const value = trigger.value;
    if (!value || !value.schedule) {
      return null;
    }
    
    const schedule = value.schedule;
    const executionMode = value.executionMode; // 'nosearch' 或 'jql'
    
    if (schedule.method === 'CRON') {
      // 解析 Cron 表达式
      return JiraAutomationService.parseCronExpression(schedule.cronExpression, executionMode);
    } else if (schedule.method === 'RATE') {
      // Rate 模式：rate 是间隔数，rateInterval 是间隔分钟数
      // rateInterval: 60 = 分钟, 1440 = 天, 10080 = 周, 43200 = 月（约30天）
      return JiraAutomationService.parseRateConfig(schedule.rate, schedule.rateInterval, executionMode);
    }
    
    return null;
  }
  
  /**
   * 解析 Cron 表达式
   * Jira Automation Cron 格式: 秒 分 时 日 月 星期 [年]
   * 例如: "0 9 * * 1-5 ?" = 周一到周五每天 9:00
   */
  private static parseCronExpression(cron: string, executionMode: string): ScheduleParsedConfig | null {
    if (!cron) return null;
    
    const parts = cron.split(' ');
    if (parts.length < 6) return null;
    
    const [_seconds, minutes, hours, dayOfMonth, _month, dayOfWeek] = parts;
    
    // 解析时间
    const timeMinutes = parseInt(minutes, 10) || 0;
    const timeHours = parseInt(hours, 10) || 0;
    const scheduleTime = `${String(timeHours).padStart(2, '0')}:${String(timeMinutes).padStart(2, '0')}`;
    
    // 解析周期
    let repeatEvery = 1;
    let repeatUnit: 'Day' | 'Week' | 'Month' = 'Day';
    let scheduleDaysOfWeek: number[] | undefined;
    
    // 检查是否是每周特定几天
    if (dayOfWeek !== '*' && dayOfWeek !== '?') {
      // 解析星期，支持 1-5, 1,3,5, MON-FRI 等格式
      scheduleDaysOfWeek = JiraAutomationService.parseDaysOfWeek(dayOfWeek);
      if (scheduleDaysOfWeek && scheduleDaysOfWeek.length > 0) {
        repeatUnit = 'Week';
        repeatEvery = 1;
      }
    }
    
    // 检查是否是每月特定日期
    if (dayOfMonth !== '*' && dayOfMonth !== '?') {
      // 检查是否是每 N 天
      const dayMatch = dayOfMonth.match(/^\*\/(\d+)$/);
      if (dayMatch) {
        repeatEvery = parseInt(dayMatch[1], 10);
        repeatUnit = 'Day';
      } else if (/^\d+$/.test(dayOfMonth)) {
        // 固定日期，视为每月执行
        repeatUnit = 'Month';
        repeatEvery = 1;
      }
    }
    
    // 计算最近的 Schedule_Date
    const scheduleDate = JiraAutomationService.getNextScheduleDate(
      timeHours,
      timeMinutes,
      repeatUnit,
      scheduleDaysOfWeek
    );
    
    return {
      scheduleDate,
      scheduleTime,
      repeatEvery,
      repeatUnit,
      scheduleDaysOfWeek,
      executionMode,
      triggerMethod: 'CRON',
      originalCron: cron
    };
  }
  
  /**
   * 解析星期配置
   * 支持格式：1-5, 1,3,5, MON-FRI, MON,WED,FRI
   * 返回数字数组：1=周日, 2=周一, ..., 7=周六（Jira 使用 1-7）
   */
  private static parseDaysOfWeek(dayOfWeek: string): number[] {
    const dayMap: Record<string, number> = {
      'SUN': 1, 'MON': 2, 'TUE': 3, 'WED': 4, 'THU': 5, 'FRI': 6, 'SAT': 7,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7
    };
    
    const result: number[] = [];
    
    // 处理范围和逗号分隔
    const segments = dayOfWeek.split(',');
    for (const segment of segments) {
      const trimmed = segment.trim().toUpperCase();
      
      // 检查是否是范围
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-');
        const startNum = dayMap[start.trim()] || parseInt(start.trim(), 10);
        const endNum = dayMap[end.trim()] || parseInt(end.trim(), 10);
        
        if (!isNaN(startNum) && !isNaN(endNum)) {
          for (let i = startNum; i <= endNum; i++) {
            if (!result.includes(i)) result.push(i);
          }
        }
      } else {
        const num = dayMap[trimmed] || parseInt(trimmed, 10);
        if (!isNaN(num) && !result.includes(num)) {
          result.push(num);
        }
      }
    }
    
    return result.sort((a, b) => a - b);
  }
  
  /**
   * 计算最近的调度日期
   */
  private static getNextScheduleDate(
    hours: number,
    minutes: number,
    repeatUnit: 'Day' | 'Week' | 'Month',
    daysOfWeek?: number[]
  ): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    
    if (repeatUnit === 'Week' && daysOfWeek && daysOfWeek.length > 0) {
      // 找最近的一个匹配的星期
      // JavaScript Date.getDay(): 0=周日, 1=周一, ..., 6=周六
      // Jira Cron: 1=周日, 2=周一, ..., 7=周六
      const currentJiraDay = now.getDay() + 1; // 转换为 Jira 格式
      
      // 找今天或之后最近的匹配日
      for (let offset = 0; offset < 7; offset++) {
        const checkDay = ((currentJiraDay - 1 + offset) % 7) + 1;
        if (daysOfWeek.includes(checkDay)) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + offset);
          
          // 如果是今天但时间已过，继续找下一天
          if (offset === 0 && now > today) {
            continue;
          }
          
          return targetDate.toISOString().split('T')[0];
        }
      }
    }
    
    // 默认：如果今天时间已过，用明天
    if (now > today) {
      today.setDate(today.getDate() + 1);
    }
    
    return today.toISOString().split('T')[0];
  }
  
  /**
   * 解析 Rate 配置
   */
  private static parseRateConfig(rate: number, rateInterval: number, executionMode: string): ScheduleParsedConfig | null {
    // rateInterval 是基础单位的分钟数
    // 60 = 分钟, 1440 = 天, 10080 = 周, 43200 = 月
    
    let repeatUnit: 'Day' | 'Week' | 'Month' = 'Day';
    let repeatEvery = rate;
    
    if (rateInterval === 1440) {
      // 每 N 天
      repeatUnit = 'Day';
    } else if (rateInterval === 10080) {
      // 每 N 周
      repeatUnit = 'Week';
    } else if (rateInterval === 43200) {
      // 每 N 月
      repeatUnit = 'Month';
    } else if (rateInterval === 60) {
      // 每 N 小时（转换为天）
      repeatUnit = 'Day';
      repeatEvery = 1; // 按天算，精确到小时需要用 cron
    }
    
    return {
      scheduleDate: undefined, // Rate 模式需要从 audit log 获取
      scheduleTime: undefined,
      repeatEvery,
      repeatUnit,
      executionMode,
      triggerMethod: 'RATE',
      rateValue: rate,
      rateInterval
    };
  }
  
  /**
   * 获取规则的 Audit Log（执行历史）
   */
  async getRuleAuditLog(config: JiraAutomationConfig, ruleId: string, limit = 50): Promise<RuleAuditLog[]> {
    try {
      const projectId = await this.getProjectId(config);
      // 使用正确的 API 路径：/rest/cb-automation/latest/audit/{projectId}?limit={limit}&ruleId={ruleId}&offset=0
      const url = `${config.jiraUrl}/rest/cb-automation/latest/audit/${projectId}?limit=${limit}&ruleId=${ruleId}&offset=0`;
      const token = await this.getEffectiveToken(config);
      
      const response = await jiraFetch(url, { token });
      
      if (!response.ok) {
        console.warn(`获取 Audit Log 失败 (${response.status}): ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      
      // 解析 audit log 数据
      const logs: RuleAuditLog[] = (data.results || data || []).map((item: any) => ({
        id: item.id,
        timestamp: item.created || item.timestamp,
        state: item.state || item.status,
        duration: item.duration
      }));
      
      return logs;
    } catch (error) {
      console.error('获取 Audit Log 失败:', error);
      return [];
    }
  }
  
  /**
   * 获取最近一次成功执行的日期
   */
  async getLastExecutionDate(config: JiraAutomationConfig, ruleId: string): Promise<string | null> {
    const logs = await this.getRuleAuditLog(config, ruleId, 50);
    
    // 找到最近一次成功执行
    const successLog = logs.find(log => log.state === 'COMPLETED' || log.state === 'SUCCESS');
    
    if (successLog && successLog.timestamp) {
      // 转换时间戳为日期
      const date = new Date(successLog.timestamp);
      return date.toISOString().split('T')[0];
    }
    
    return null;
  }
  
  /**
   * 获取 Automation 的 securetoken（用于生成新的 webhook URL）
   * 这是一个公共方法，可以在需要时直接调用
   */
  async getSecureToken(config: JiraAutomationConfig): Promise<string> {
    const projectId = await this.getProjectId(config);
    const token = await this.getEffectiveToken(config);
    
    const tokenUrl = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/securetoken`;
    const tokenResponse = await jiraFetch(tokenUrl, { token });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`获取 securetoken 失败 (${tokenResponse.status}): ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.token) {
      throw new Error('未能获取到 securetoken');
    }
    
    return tokenData.token;
  }
  
  /**
   * 创建 JIRA Automation 规则
   * 如果规则包含 incoming webhook trigger，会自动获取新的 securetoken
   * 这是一个公共方法，可用于任何需要创建规则的场景（不仅限于 RPA）
   */
  async createRule(config: JiraAutomationConfig, ruleData: any): Promise<any> {
    const projectId = await this.getProjectId(config);
    const token = await this.getEffectiveToken(config);
    
    // 处理 webhook trigger：如果是 incoming webhook，需要获取新的 securetoken
    let finalRuleData = ruleData;
    
    if (ruleData.trigger?.type === 'jira.incoming.webhook') {
      console.log('📝 检测到 incoming webhook trigger，需要获取新的 securetoken...');
      
      // 获取新的 securetoken
      const webhookToken = await this.getSecureToken(config);
      console.log(`✅ 获取到新的 securetoken: ${webhookToken.substring(0, 8)}...`);
      
      // 构建新的规则数据，使用新的 token
      finalRuleData = {
        ...ruleData,
        trigger: {
          ...ruleData.trigger,
          id: '__NEW__TRIGGER',
          value: {
            webhookToken: webhookToken,
            searchOrProvide: 'provided'
          }
        }
      };
    }
    
    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
    
    const response = await jiraFetch(url, {
      method: 'POST',
      body: finalRuleData,
      token
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`创建规则失败 (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  }
  
  /**
   * 将 Scheduled Trigger 转换为 Incoming Webhook Trigger
   * 
   * 两步操作：
   * 1. 先获取 securetoken（用于生成 webhook URL）
   * 2. 使用 token 更新 rule 的 trigger 为 incoming webhook
   * 
   * @returns 新生成的 Webhook URL
   */
  async convertToWebhookTrigger(config: JiraAutomationConfig, ruleId: string): Promise<string> {
    console.log(`🔄 将规则 ${ruleId} 的 trigger 转换为 incoming webhook...`);
    
    // 获取项目 ID
    const projectId = await this.getProjectId(config);
    
    // 获取现有规则
    const existingRule = await this.getRuleById(config, ruleId);
    if (!existingRule) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }
    
    // 第一步：获取 securetoken
    console.log('📝 步骤1: 获取 securetoken...');
    const webhookToken = await this.getSecureToken(config);
    console.log(`✅ 获取到 securetoken: ${webhookToken.substring(0, 8)}...`);
    
    // 第二步：使用 token 更新 rule 的 trigger 为 incoming webhook
    console.log('📝 步骤2: 更新 rule trigger 为 incoming webhook...');
    
    // 创建 incoming webhook trigger，必须包含 webhookToken 和 searchOrProvide
    const webhookTrigger = {
      id: '__NEW__TRIGGER',
      component: 'TRIGGER',
      type: 'jira.incoming.webhook',
      value: {
        webhookToken: webhookToken,
        searchOrProvide: 'provided'  // 必须设置，否则会报 null 错误
      }
    };
    
    // 构建完整的规则更新 payload
    const updatePayload = {
      ...existingRule,
      trigger: webhookTrigger,
      isNewRule: false
    };
    
    // 直接调用 PUT API 更新规则（不使用 updateRule 方法以避免额外的合并逻辑）
    const updateUrl = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`;
    const token = await this.getEffectiveToken(config);
    
    const updateResponse = await jiraFetch(updateUrl, {
      method: 'PUT',
      body: updatePayload,
      token
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`更新规则 trigger 失败 (${updateResponse.status}): ${errorText}`);
    }
    
    // 解析响应确认更新成功
    await updateResponse.json();
    console.log('✅ 规则 trigger 已更新为 incoming webhook');
    
    // 构建 webhook URL
    // 格式: https://jira.ringcentral.com/rest/cb-automation/latest/hooks/<webhookToken>
    const webhookUrl = `${config.jiraUrl}/rest/cb-automation/latest/hooks/${webhookToken}`;
    
    console.log(`✅ Webhook URL: ${webhookUrl}`);
    return webhookUrl;
  }
  
  /**
   * 获取规则的 URL（用于 Automation_Link）
   */
  getRuleUrl(config: JiraAutomationConfig, ruleId: string): string {
    return `${config.jiraUrl}/jira/software/c/projects/${config.projectKey}/automation#/rule/${ruleId}`;
  }
  
  /**
   * 将 Incoming Webhook Trigger 转换回 Scheduled Trigger
   * 用于撤销托管时恢复原有的定时触发
   * 
   * @param config Jira 配置
   * @param ruleId 规则 ID
   * @param scheduleConfig 调度配置
   * @returns 更新后的规则
   */
  async convertToScheduledTrigger(
    config: JiraAutomationConfig,
    ruleId: string,
    scheduleConfig: {
      scheduleTime: string;  // HH:mm
      repeatEvery: number;
      repeatUnit: 'Day' | 'Week' | 'Month';
      scheduleDaysOfWeek?: number[];  // 周几执行（1-7，仅周重复时使用）
    }
  ): Promise<JiraRule> {
    console.log(`🔄 将规则 ${ruleId} 的 trigger 转换回 scheduled trigger...`);
    
    // 获取项目 ID
    const projectId = await this.getProjectId(config);
    
    // 获取现有规则
    const existingRule = await this.getRuleById(config, ruleId);
    if (!existingRule) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }
    
    // 生成调度配置
    const schedule = this.generateScheduleConfig(scheduleConfig);
    
    console.log('📝 生成的调度配置:', JSON.stringify(schedule, null, 2));
    
    // 创建 scheduled trigger
    const scheduledTrigger = {
      id: '__NEW__TRIGGER',
      component: 'TRIGGER',
      type: 'jira.jql.scheduled',
      value: {
        executionMode: 'nosearch',  // 使用 nosearch 模式
        schedule: schedule
      }
    };
    
    // 构建完整的规则更新 payload
    const updatePayload = {
      ...existingRule,
      trigger: scheduledTrigger,
      isNewRule: false
    };
    
    // 调用 PUT API 更新规则
    const updateUrl = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`;
    const token = await this.getEffectiveToken(config);
    
    const updateResponse = await jiraFetch(updateUrl, {
      method: 'PUT',
      body: updatePayload,
      token
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`更新规则 trigger 失败 (${updateResponse.status}): ${errorText}`);
    }
    
    const updatedRule = await updateResponse.json();
    console.log('✅ 规则 trigger 已恢复为 scheduled trigger');
    
    return updatedRule;
  }
  
  /**
   * 根据调度配置生成 Jira Automation 的 schedule 对象
   * 优先使用 CRON 方法，如果无法用 CRON 表达则使用 FIXED 方法
   * 
   * 注意：FIXED 方法无法指定具体执行时间，只能指定间隔
   */
  private generateScheduleConfig(scheduleConfig: {
    scheduleTime: string;
    repeatEvery: number;
    repeatUnit: 'Day' | 'Week' | 'Month';
    scheduleDaysOfWeek?: number[];
  }): any {
    const { scheduleTime, repeatEvery, repeatUnit, scheduleDaysOfWeek } = scheduleConfig;
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    
    // 判断是否可以使用 CRON
    // 可以用 CRON 的情况：
    // 1. 每天执行（repeatEvery = 1, repeatUnit = 'Day'）
    // 2. 每 N 天执行（repeatUnit = 'Day', repeatEvery > 1）- 可以用 CRON 的 */N 语法
    // 3. 每周执行（repeatUnit = 'Week', repeatEvery = 1）- 无论是否指定 scheduleDaysOfWeek
    // 4. 每月执行（repeatEvery = 1, repeatUnit = 'Month'）- 需要指定日期，这里用每月1号
    
    const canUseCron = 
      (repeatUnit === 'Day') ||  // 每天或每 N 天都可以用 CRON
      (repeatUnit === 'Week' && repeatEvery === 1) ||  // 每周执行（每 1 周）
      (repeatUnit === 'Month' && repeatEvery === 1);
    
    if (canUseCron) {
      // 使用 CRON 方法
      const cronExpression = this.generateCronExpression(hours, minutes, repeatUnit, scheduleDaysOfWeek, repeatEvery);
      console.log(`📅 使用 CRON 方法: ${cronExpression}`);
      return {
        method: 'CRON',
        cronExpression: cronExpression,
        rate: 0,  // CRON 模式下 rate 设为 0
        rateInterval: 60  // 默认值
      };
    } else {
      // 使用 FIXED 方法
      // 注意：FIXED 方法只支持 rate, rateInterval，不支持 rateHour, rateMinute
      // 因此无法指定具体执行时间，只能指定间隔
      // rateInterval 单位是分钟，最大支持 86400 分钟（60 天）
      // - 86400 = 1 天（最大值）
      // - 86400 = 1 周
      // 对于周和月，需要换算成天
      let rate: number;
      let rateInterval: number;
      
      if (repeatUnit === 'Week') {
        // 每 N 周 = 每 (N * 7) 天
        rate = repeatEvery * 7;
        rateInterval = 86400;  // 1 天
        console.warn(`⚠️ 使用 FIXED 方法: 每 ${repeatEvery} 周（换算为每 ${rate} 天，无法指定具体执行时间）`);
      } else if (repeatUnit === 'Month') {
        // 每 N 月 = 每 (N * 30) 天
        rate = repeatEvery * 30;
        rateInterval = 86400;  // 1 天
        console.warn(`⚠️ 使用 FIXED 方法: 每 ${repeatEvery} 月（换算为每 ${rate} 天，无法指定具体执行时间）`);
      } else {
        // Day 类型不应该走到这里，但作为兜底
        rate = repeatEvery;
        rateInterval = 86400;
        console.warn(`⚠️ 使用 FIXED 方法: 每 ${rate} 天（无法指定具体执行时间）`);
      }
      
      // FIXED 方法只需要 rate 和 rateInterval
      return {
        method: 'FIXED',
        rate: rate,
        rateInterval: rateInterval,
        cronExpression: ''  // FIXED 模式下 cronExpression 为空
      };
    }
  }
  
  /**
   * 生成 CRON 表达式
   * Jira Automation CRON 格式: seconds minutes hours dayOfMonth month dayOfWeek
   */
  private generateCronExpression(
    hours: number,
    minutes: number,
    repeatUnit: 'Day' | 'Week' | 'Month',
    scheduleDaysOfWeek?: number[],
    repeatEvery = 1
  ): string {
    // 格式: 秒 分 时 日 月 周
    const seconds = '0';
    const minutesPart = String(minutes);
    const hoursPart = String(hours);
    
    switch (repeatUnit) {
      case 'Day':
        if (repeatEvery === 1) {
          // 每天执行: 0 30 9 * * ?
          return `${seconds} ${minutesPart} ${hoursPart} * * ?`;
        } else {
          // 每 N 天执行: 0 30 9 */N * ?
          return `${seconds} ${minutesPart} ${hoursPart} */${repeatEvery} * ?`;
        }
        
      case 'Week':
        // 每周特定几天执行: 0 30 9 ? * MON,WED,FRI
        if (scheduleDaysOfWeek && scheduleDaysOfWeek.length > 0) {
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          // Jira 的周日是 1，周一是 2，... 周六是 7
          // 转换为 CRON 格式（SUN, MON, TUE, ...）
          const cronDays = scheduleDaysOfWeek
            .map(d => dayNames[(d - 1) % 7])  // d: 1=SUN, 2=MON, ...
            .join(',');
          return `${seconds} ${minutesPart} ${hoursPart} ? * ${cronDays}`;
        }
        // 默认每周一
        return `${seconds} ${minutesPart} ${hoursPart} ? * MON`;
        
      case 'Month':
        // 每月1号执行: 0 30 9 1 * ?
        return `${seconds} ${minutesPart} ${hoursPart} 1 * ?`;
        
      default:
        return `${seconds} ${minutesPart} ${hoursPart} * * ?`;
    }
  }
}

/**
 * 解析后的调度配置
 */
export interface ScheduleParsedConfig {
  scheduleDate?: string;  // YYYY-MM-DD
  scheduleTime?: string;  // HH:mm
  repeatEvery: number;
  repeatUnit: 'Day' | 'Week' | 'Month';
  scheduleDaysOfWeek?: number[];  // 周几执行（1-7）
  executionMode: string;  // 'nosearch' 或 'jql'
  triggerMethod: 'CRON' | 'RATE';
  originalCron?: string;
  rateValue?: number;
  rateInterval?: number;
}

/**
 * 规则执行日志
 */
export interface RuleAuditLog {
  id: string;
  timestamp: number;
  state: string;
  duration?: number;
}
