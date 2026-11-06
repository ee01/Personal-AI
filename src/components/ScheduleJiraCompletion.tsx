import * as React from 'react';
import { useState } from 'react';
import { scheduleApi } from '../scheduleService';
import { previewJiraCompletion, completeJiraImport } from '../scheduleJira';
export function ScheduleJiraCompletion() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [id, setId] = useState('');
  const [project, setProject] = useState('');
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewJiraCompletion>> | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<void>) {
    setBusy(true); try { await fn(); } catch(e) { setNotice(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return <details><summary>JIRA Automation 分享导出 / 导入补全</summary>
    <p>分享者先预览并授权规则内容。接收方选择自己的目标项目；新规则以禁用状态创建，核验字段和凭证后再启用。</p>
    <button type="button" disabled={busy} onClick={() => void act(async () => setTasks(await scheduleApi('/tasks?type=jira_automation')))}>读取我的 JIRA 任务</button>
    <select aria-label="JIRA 计划任务" value={id} onChange={e => { setId(e.target.value); setPreview(null); setReviewed(false); }}>
      <option value="">选择任务</option>{tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
    </select>
    <button type="button" disabled={busy || !id} onClick={() => void act(async () => {
      const data = (await chrome.storage.local.get(`scheduleJiraExport:${id}`))[`scheduleJiraExport:${id}`];
      if (!data) throw new Error('该账户没有源规则授权导出，请由规则所有者在 JIRA 页面发起托管');
      setSource(JSON.stringify(data, null, 2)); setPreview(null); setNotice('请检查下方脱敏内容；确认后才允许随分组分享。');
    })}>预览我准备的源规则</button>
    <textarea aria-label="JIRA 规则内容" rows={10} value={source} onChange={e => { setSource(e.target.value); setPreview(null); setReviewed(false); }} style={{ width: '100%' }} placeholder="已授权源规则内容，也可粘贴由源用户提供的导出 JSON" />
    <button type="button" disabled={busy || !id || !source} onClick={() => void act(async () => {
      const task = await scheduleApi(`/tasks/${encodeURIComponent(id)}`);
      const stored = (await chrome.storage.local.get(`scheduleJiraExport:${id}`))[`scheduleJiraExport:${id}`];
      if (!stored || JSON.stringify(JSON.parse(source)) !== JSON.stringify(stored)) throw new Error('仅能发布本账户准备并预览的脱敏导出');
      await scheduleApi(`/tasks/${encodeURIComponent(id)}`, 'PATCH', { config: { ...task.config, jiraRuleExport: stored } });
      setNotice('已授权导出内容。分组分享由 Schedule 服务提供；源规则修改后请重新准备并预览授权。');
    })}>确认授权此规则内容随分组分享</button>
    <label>我的目标 JIRA Project Key<input aria-label="目标 JIRA Project" value={project} onChange={e => { setProject(e.target.value); setPreview(null); setReviewed(false); }} /></label>
    <button type="button" disabled={busy || !id || !project} onClick={() => void act(async () => {
      const value = await previewJiraCompletion(id, project, source || undefined); setPreview(value); setReviewed(false); setNotice('请逐项核验项目字段、JQL、账号、插件及凭证依赖；副本保持禁用。');
    })}>校验目标项目并预览副本</button>
    {preview && <><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{JSON.stringify({ findings: preview.findings, rule: preview.payload }, null, 2)}</pre>
      <label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />已审查上述依赖，创建禁用副本，后续到目标 JIRA 补齐并核验</label>
      <button type="button" disabled={busy || !reviewed} onClick={() => void act(async () => { const result = await completeJiraImport(id, preview); setNotice(`${result.message} 目标 rule ID: ${result.ruleId}`); })}>创建或续绑目标副本</button></>}
    <div role="status">{notice}</div>
  </details>;
}
