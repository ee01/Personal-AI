import { getJiraBaseUrl, jiraFetch } from './jira';
import { JiraAutomationService, type JiraAutomationConfig } from './scheduled-messages/JiraAutomationService';
import { buildJiraAutomationImportRule, parseJiraAutomationExport, buildJiraAutomationImportReviewFindings,
  JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER } from './jira-automation-import/transform';
import { openSchedule, scheduleApi, scheduleConnection, SCHEDULE_PENDING_KEY } from './scheduleService';
const service = () => new JiraAutomationService();
async function jiraConfig(projectKey: string): Promise<JiraAutomationConfig> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) throw new Error('请输入有效的目标项目 Key');
  const jiraUrl = (await getJiraBaseUrl()).replace(/\/+$/, '');
  if (new URL(jiraUrl).hostname.endsWith('.atlassian.net')) throw new Error('当前适配器仅支持已核验的 Jira Server/Data Center，Cloud API 需单独适配');
  return { jiraUrl, projectKey };
}
async function jiraJson(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
  const response = await jiraFetch(path, { method, body, requestLabel: 'Schedule JIRA completion' });
  if (!response.ok) throw new Error(`JIRA 请求失败 (${response.status})，请检查自己的项目权限`);
  return response.json();
}
export function prepareJiraSharedRule(rule: any) {
  const safe = buildJiraAutomationImportRule(rule, { projectId: 'TARGET_PROJECT', ownerId: 'TARGET_ACTOR',
    replaceSensitiveValues: true, disableAfterImport: true, allowOtherRuleTrigger: false });
  // Never carry the source trigger (including the source webhook secret).
  safe.trigger = { id: '__NEW__TRIGGER', component: 'TRIGGER', type: 'jira.incoming.webhook',
    value: { webhookToken: JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER, searchOrProvide: 'none', jql: null } };
  return { schemaVersion: 1, rules: [safe], requiresReview: true };
}
export function jiraScheduleSpec(schedule: any, timezone: string) {
  if (schedule?.method === 'FIXED') {
    const minutes = Number(schedule.rate) * Number(schedule.rateInterval) / 60;
    if (!Number.isFinite(minutes) || minutes < 1) throw new Error('JIRA 固定间隔无效');
    return { kind: 'rate', intervalMinutes: minutes, timezone };
  }
  const fields = String(schedule?.cronExpression || '').trim().split(/\s+/);
  if (fields.length === 7 && fields[6] === '*') fields.pop();
  if (fields.length !== 6 || /[LW#]/i.test(fields.join(' ').replace(/(?:JUL|WED)/gi, ''))) throw new Error('此 JIRA CRON 无法无损转换，请在新版选择计划；源规则保持不变');
  fields[3] = fields[3] === '?' ? '*' : fields[3];
  fields[5] = fields[5] === '?' ? '*' : fields[5].replace(/\d+/g, n => {
    const day = Number(n); if (day < 1 || day > 7) throw new Error('Invalid Quartz weekday'); return String(day - 1);
  });
  return { kind: 'cron', expr: fields.join(' '), timezone };
}

export async function hostJiraSchedule(data: any): Promise<any> {
  if (!await scheduleConnection()) {
    await chrome.storage.local.set({ [SCHEDULE_PENDING_KEY]: { kind: 'jira', data, savedAt: Date.now() } });
    await openSchedule();
    return { success: false, setupRequired: true, error: '请在设置中连接 Schedule，保存后继续托管' };
  }
  const config = await jiraConfig(data.projectKey);
  const ruleId = String(data.ruleId);
  const rules = await service().getRules(config);
  const rule = rules.find(r => String(r.id) === ruleId);
  if (!rule) throw new Error('源规则不存在或无权限');
  const trigger = rule.trigger;
  if (trigger?.type !== 'jira.incoming.webhook' &&
      !(trigger?.type === 'jira.jql.scheduled' && trigger.value?.executionMode === 'nosearch')) {
    throw new Error('仅支持无需 JQL/issue 上下文的定时规则；保留原规则，未进行转换');
  }
  const tasks = await scheduleApi('/tasks?type=jira_automation');
  let task = tasks.find((t: any) => String(t.config?.jiraRuleRef?.ruleId) === ruleId && t.config?.jiraRuleRef?.jiraUrl === config.jiraUrl);
  if (!task) {
    const result = await scheduleApi('/tasks', 'POST', { type: 'jira_automation', title: rule.name,
      content: data.content || '', scheduleSpec: data.scheduleSpec, status: 'paused',
      config: { jiraRuleRef: { jiraUrl: config.jiraUrl, projectId: data.projectId, projectKey: config.projectKey, ruleId } } });
    task = result.task;
  }
  // Source export is prepared by the authorized owner, never by the receiver.
  // It is staged privately; publishing it requires explicit source-side review.
  const ruleExport = prepareJiraSharedRule(rule);
  await chrome.storage.local.set({ [`scheduleJiraExport:${task.id}`]: ruleExport });
  const webhookUrl = trigger.type === 'jira.incoming.webhook'
    ? `${config.jiraUrl}/rest/cb-automation/latest/hooks/${trigger.value.webhookToken}`
    : await service().convertToWebhookTrigger(config, ruleId);
  await scheduleApi(`/tasks/${encodeURIComponent(task.id)}`, 'PATCH', { config: { ...task.config, webhookUrl } });
  await chrome.storage.local.remove(SCHEDULE_PENDING_KEY);
  return { success: true, taskId: task.id, message: '托管已绑定，任务保持暂停；请在新版检查计划后启用。分享规则需先在扩展设置预览并授权。' };
}
export async function previewJiraCompletion(taskId: string, projectKey: string, suppliedExport?: string) {
  const task = await scheduleApi(`/tasks/${encodeURIComponent(taskId)}`);
  if (task.type !== 'jira_automation') throw new Error('不是 JIRA 托管任务');
  const config = await jiraConfig(projectKey);
  const [project, actor] = await Promise.all([
    jiraJson(`${config.jiraUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}`),
    jiraJson(`${config.jiraUrl}/rest/api/2/myself`),
  ]);
  // Only accept reviewed source-side material, never send receiver credentials to
  // a URL from a share, and never fetch the source project under receiver auth.
  const artifact = suppliedExport ? parseJiraAutomationExport(suppliedExport) : task.config?.jiraRuleExport;
  if (!artifact || artifact.schemaVersion !== 1 && !suppliedExport) throw new Error('源分享未包含已授权规则内容；请让分享者在扩展设置预览并授权导出');
  const rule = artifact.rules?.[0];
  if (!rule || artifact.rules.length !== 1) throw new Error('需要单条规则导出');
  const payload = buildJiraAutomationImportRule(rule, { projectId: String(project.id), ownerId: actor.key || actor.accountId || actor.name,
    projectKey, projectTypeKey: project.projectTypeKey, disableAfterImport: true, replaceSensitiveValues: true, allowOtherRuleTrigger: false });
  payload.trigger = { id: '__NEW__TRIGGER', component: 'TRIGGER', type: 'jira.incoming.webhook',
    value: { searchOrProvide: 'none', jql: null } };
  return { config, projectId: String(project.id), payload, findings: buildJiraAutomationImportReviewFindings(rule) };
}
export async function completeJiraImport(taskId: string, preview: Awaited<ReturnType<typeof previewJiraCompletion>>) {
  // The journal is receiver + service + task + destination scoped. It is saved
  // before POST. Unknown create outcomes must be reconciled, never blindly retried.
  const me = await scheduleApi('/me');
  const c = await scheduleConnection();
  const key = `scheduleJiraImport:${c!.baseUrl}:${me.id}:${taskId}`;
  let journal = (await chrome.storage.local.get(key))[key];
  if (journal && (journal.jiraUrl !== preview.config.jiraUrl || journal.projectId !== preview.projectId)) throw new Error('已有目标规则映射；先处理该副本，不能直接切换项目重建');
  const marker = journal?.marker || `PAI-${crypto.randomUUID()}`;
  const name = `${preview.payload.name.slice(0, 190)} [${marker}]`;
  const list = await service().getRules(preview.config); // also verifies target read permission
  let target = journal?.ruleId ? list.find(r => String(r.id) === journal.ruleId) : list.find(r => r.name.endsWith(`[${marker}]`));
  if (!target && journal) throw new Error('先前创建结果未知，请到目标 JIRA 核对残留规则；不会自动重复创建');
  if (!target) {
    journal = { marker, jiraUrl: preview.config.jiraUrl, projectId: preview.projectId, state: 'creating' };
    await chrome.storage.local.set({ [key]: journal });
    target = await service().createRule(preview.config, { ...preview.payload, name, state: 'DISABLED', canOtherRuleTrigger: false });
    if (!target?.id) throw new Error('创建结果缺少 rule ID，需核对目标项目');
    journal = { ...journal, ruleId: String(target.id), state: 'created_disabled' };
    await chrome.storage.local.set({ [key]: journal });
  }
  // A fresh target-side token is minted by createRule; no source credentials.
  if (target.state !== 'DISABLED' || target.trigger?.type !== 'jira.incoming.webhook' || !target.trigger?.value?.webhookToken) throw new Error('目标规则必须为禁用的 webhook 规则；请核对后重试');
  const webhookUrl = `${preview.config.jiraUrl}/rest/cb-automation/latest/hooks/${target.trigger.value.webhookToken}`;
  const task = await scheduleApi(`/tasks/${encodeURIComponent(taskId)}`);
  await scheduleApi(`/tasks/${encodeURIComponent(taskId)}`, 'PATCH', { config: { ...task.config, webhookUrl,
    jiraRuleRef: { jiraUrl: preview.config.jiraUrl, projectId: preview.projectId, ruleId: String(target.id) },
    jiraImportState: 'created_disabled_needs_review', jiraImportMarker: marker } });
  await scheduleApi(`/tasks/${encodeURIComponent(taskId)}/status`, 'POST', { status: 'paused' });
  await chrome.storage.local.set({ [key]: { ...journal, ruleId: String(target.id), state: 'bound_disabled' } });
  return { ruleId: String(target.id), url: service().getRuleUrl(preview.config, String(target.id)),
    message: '已创建并绑定禁用副本。请在目标 JIRA 核验字段、凭证和权限，启用规则后再到 Schedule 启用任务。仅新 webhook 触发，无 JIRA 时间源。' };
}
