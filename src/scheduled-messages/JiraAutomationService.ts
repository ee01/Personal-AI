/**
 * Jira Automation 服务
 * 负责创建和管理 Bot 推送的 Jira Automation 规则
 */

import ruleTemplate from './jira-rule-template.json';
import { getEnvConfig } from '../utils';

// Jira Rule 版本信息（从模板的 _metadata 字段读取）
export const JIRA_RULE_VERSION = (ruleTemplate as any)._metadata?.version || '1.0.0';
export const JIRA_RULE_LAST_UPDATED = (ruleTemplate as any)._metadata?.lastUpdated || '2025-12-04';

export interface JiraAutomationConfig {
  jiraUrl: string;  // Jira 实例 URL，如 https://jira.ringcentral.com
  projectKey: string;  // 项目 Key，如 MTR
  token?: string;  // Personal Access Token (可选，用于认证)
}

export interface BotExecutorRule {
  ruleId: string;
  ruleName: string;
  webhookUrl: string;
  projectKey: string;
  createdAt: string;
  ruleVersion?: string;  // 规则版本号
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

export class JiraAutomationService {
  /**
   * 获取当前用户的 account key
   */
  private async getCurrentUserKey(config: JiraAutomationConfig): Promise<string> {
    const url = `${config.jiraUrl}/rest/api/2/myself`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
      },
      credentials: 'include'
    });
    
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
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
      },
      credentials: 'include'
    });
    
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
      // 先检查登录状态
      const loginStatus = await this.checkJiraLoginStatus(config.jiraUrl);
      console.log('Jira 登录状态:', loginStatus);
      
      if (!loginStatus.loggedIn && !config.token) {
        return { 
          success: false, 
          message: '未检测到 Jira 登录状态。请先在浏览器中打开 Jira 并登录，或提供 Personal Access Token。' 
        };
      }
      
      // 获取项目 ID
      console.log('正在获取项目 ID...');
      const projectId = await this.getProjectId(config);
      console.log(`项目 ${config.projectKey} 的 ID: ${projectId}`);
      
      const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
        },
        credentials: 'include'  // 使用 cookies 认证
      });
      
      console.log('Jira API 响应状态:', response.status);
      
      if (response.ok) {
        return { success: true, message: '连接成功！可以访问 Jira Automation API。' };
      } else if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        console.error('认证失败，响应:', errorText);
        
        // 提供更详细的错误信息
        if (!loginStatus.loggedIn) {
          return { 
            success: false, 
            message: '认证失败：未检测到 Jira 登录。请在新标签页中打开 Jira 并完成登录后重试。' 
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
  
  /**
   * 创建 Bot 执行器规则
   * 每分钟调用 AppScript Web App，获取需要执行的 Bot 消息并推送
   */
  async createBotExecutorRule(
    config: JiraAutomationConfig,
    webAppUrl: string
  ): Promise<BotExecutorRule> {
    
    // 获取当前用户 Key
    console.log('正在获取当前用户信息...');
    const userKey = await this.getCurrentUserKey(config);
    console.log(`当前用户 Key: ${userKey}`);
    
    // 获取项目 ID
    console.log('正在获取项目 ID...');
    const projectId = await this.getProjectId(config);
    console.log(`项目 ${config.projectKey} 的 ID: ${projectId}`);
    
    // 读取 Bot 配置
    console.log('正在读取 Bot 配置...');
    const envConfig = await getEnvConfig();
    const { userinfo } = await chrome.storage.local.get('userinfo');
    const ruleName = `[${userinfo.fullName.split(' ')[0]}] Scheduled Messages`;
    console.log(`Bot Type: ${envConfig.BOT_TYPE}`);
    console.log(`用户邮箱: ${userinfo.userEmail}`);
    
    // 从模板创建规则 payload（模板中已包含完整结构和 smart values）
    const templateString = JSON.stringify(ruleTemplate);
    const rulePayloadString = templateString
      .replace(/{{RULE_NAME}}/g, ruleName)
      .replace(/{{RULE_VERSION}}/g, JIRA_RULE_VERSION)
      .replace(/{{WEB_APP_URL}}/g, webAppUrl)
      .replace(/{{BOT_API_BASE_URL}}/g, envConfig.BOT_API_BASE_URL)
      .replace(/{{BOT_TOKEN}}/g, envConfig.BOT_TOKEN)
      .replace(/{{BOT_ID}}/g, envConfig.BOT_ID)
      .replace(/{{USER_EMAIL}}/g, userinfo.userEmail)
      .replace(/{{PROJECT_KEY}}/g, config.projectKey)
      .replace(/{{PROJECT_ID}}/g, projectId)
      .replace(/{{USER_KEY}}/g, userKey);
    
    const rulePayload = JSON.parse(rulePayloadString);
    
    // 移除 _metadata 字段（这是模板内部使用的，不应发送到 Jira）
    delete rulePayload._metadata;
    
    console.log('创建 Jira Automation 规则:', ruleName);
    console.log('用户 Key:', userKey);
    console.log('项目 ID:', projectId);
    console.log('Web App URL:', webAppUrl);
    console.log('Bot API Base URL:', envConfig.BOT_API_BASE_URL);
    console.log('Rule Payload:', JSON.stringify(rulePayload, null, 2));
    
    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check',
        ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify(rulePayload)
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
      ruleName: `${ruleName} v${JIRA_RULE_VERSION}`,
      webhookUrl: webAppUrl,
      projectKey: config.projectKey,
      createdAt: new Date().toISOString(),
      ruleVersion: JIRA_RULE_VERSION
    };
  }
  
  /**
   * 获取项目的所有规则
   */
  async getRules(config: JiraAutomationConfig): Promise<any[]> {
    // 获取项目 ID 
    const projectId = await this.getProjectId(config);
    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
      },
      credentials: 'include'
    });
    
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
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Atlassian-Token': 'no-check',
        ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
      },
      credentials: 'include'
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
    console.log('Rule Payload:', JSON.stringify(mergedPayload, null, 2));
    
    const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule/${ruleId}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check',
        'Cache-Control': 'no-cache',
        ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify(mergedPayload)
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
}

