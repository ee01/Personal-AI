/** Jira Server/Data Center business-rule operations. No task scheduler or Sheet. */
import { jiraFetch } from '../jira';
export interface JiraAutomationConfig { jiraUrl: string; projectKey: string; token?: string }
export interface JiraRule {
  id: number; name: string; state: string; trigger: any; components: any[];
  [key: string]: any;
}
export class JiraAutomationService {
  private async request(config: JiraAutomationConfig, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<any> {
    const base = new URL(config.jiraUrl);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid JIRA URL');
    const response = await jiraFetch(`${base.origin}${path}`, { method, body, token: config.token, requestLabel: 'Schedule Jira rule' });
    if (!response.ok) throw new Error(`JIRA 请求失败 (${response.status})，请检查项目权限`);
    return response.json();
  }
  private async projectId(config: JiraAutomationConfig): Promise<string> {
    const project = await this.request(config, `/rest/api/2/project/${encodeURIComponent(config.projectKey)}`);
    if (!project.id) throw new Error('JIRA project ID missing');
    return String(project.id);
  }
  async getRules(config: JiraAutomationConfig): Promise<JiraRule[]> {
    const projectId = await this.projectId(config);
    const result = await this.request(config, `/rest/cb-automation/latest/project/${encodeURIComponent(projectId)}/rule`);
    if (!Array.isArray(result)) throw new Error('不支持的 JIRA Automation 响应格式');
    return result;
  }
  async getRuleById(config: JiraAutomationConfig, ruleId: string): Promise<JiraRule | null> {
    return (await this.getRules(config)).find(rule => String(rule.id) === String(ruleId)) || null;
  }
  private async secureToken(config: JiraAutomationConfig): Promise<string> {
    const projectId = await this.projectId(config);
    const result = await this.request(config, `/rest/cb-automation/latest/project/${encodeURIComponent(projectId)}/securetoken`);
    if (!result.token) throw new Error('JIRA 未返回 webhook token');
    return result.token;
  }
  async createRule(config: JiraAutomationConfig, rule: any): Promise<JiraRule> {
    const projectId = await this.projectId(config);
    let payload = rule;
    if (rule.trigger?.type === 'jira.incoming.webhook') {
      const webhookToken = await this.secureToken(config);
      payload = { ...rule, trigger: { ...rule.trigger, id: '__NEW__TRIGGER',
        value: { ...rule.trigger.value, webhookToken, searchOrProvide: rule.trigger.value?.searchOrProvide || 'none', jql: rule.trigger.value?.jql || null } } };
    }
    return this.request(config, `/rest/cb-automation/latest/project/${encodeURIComponent(projectId)}/rule`, 'POST', payload);
  }
  async convertToWebhookTrigger(config: JiraAutomationConfig, ruleId: string): Promise<string> {
    const projectId = await this.projectId(config);
    const rule = await this.getRuleById(config, ruleId);
    if (!rule) throw new Error('JIRA rule not found');
    const webhookToken = await this.secureToken(config);
    await this.request(config, `/rest/cb-automation/latest/project/${encodeURIComponent(projectId)}/rule/${encodeURIComponent(ruleId)}`, 'PUT', {
      ...rule, isNewRule: false,
      trigger: { id: '__NEW__TRIGGER', component: 'TRIGGER', type: 'jira.incoming.webhook', value: { webhookToken, searchOrProvide: 'none', jql: null } },
    });
    return `${config.jiraUrl.replace(/\/+$/, '')}/rest/cb-automation/latest/hooks/${webhookToken}`;
  }
  getRuleUrl(config: JiraAutomationConfig, ruleId: string): string {
    return `${config.jiraUrl}/secure/AutomationProjectAdminAction!default.jspa?projectKey=${encodeURIComponent(config.projectKey)}#/rule/${encodeURIComponent(ruleId)}`;
  }
}
