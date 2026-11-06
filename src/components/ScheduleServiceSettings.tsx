import { ScheduleJiraCompletion } from './ScheduleJiraCompletion';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { scheduleApi, scheduleBase, scheduleConnection, SCHEDULE_CONNECTION_KEY } from '../scheduleService';
export function ScheduleServiceSettings() {
  const [baseUrl, setBase] = useState('http://schedule.xmnup.com');
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void scheduleConnection().then(c => { if(c) { setBase(c.baseUrl); setToken(c.token); } }); }, []);
  async function save() {
    setBusy(true);
    try {
      const c = { baseUrl: scheduleBase(baseUrl), token: token.trim() };
      if (!c.token) throw new Error('请输入你自己的 API Token');
      const me = await scheduleApi('/me', 'GET', undefined, c);
      await chrome.storage.local.set({ [SCHEDULE_CONNECTION_KEY]: c });
      const response = await chrome.runtime.sendMessage({ type: 'SCHEDULE_SETUP_SAVED' });
      if (!response?.success) throw new Error(response?.error || '续提失败');
      setNotice(`已连接 ${me.email}。${response.message || '打开分享页可导入，缺少的配置在新版补全。'}`);
    } catch(e) { setNotice(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return <div className="form-section" id="personal-schedule-config">
    <h2>Personal Schedule</h2>
    <p>在独立网站管理计划任务。旧任务请自行到原 Google Sheet 维护或手动迁移。</p>
    <label>服务地址<input aria-label="Schedule 服务地址" type="url" value={baseUrl} onChange={e => setBase(e.target.value)} /></label>
    <label>个人 API Token<input aria-label="Schedule API Token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
    <p>保存即授权此网站通过扩展使用你的 Schedule 身份导入任务；Token 只保存在扩展中。</p>
    <button type="button" disabled={busy} onClick={() => void save()}>{busy ? '正在连接…' : '连接并保存'}</button>{' '}
    <button type="button" onClick={() => void chrome.runtime.sendMessage({ type: 'OPEN_SCHEDULED_MESSAGES' })}>打开计划任务</button>
    <div role="status">{notice}</div><ScheduleJiraCompletion />
  </div>;
}
