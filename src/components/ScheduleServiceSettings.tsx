import { ScheduleJiraCompletion } from './ScheduleJiraCompletion';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { scheduleApi, scheduleBase, scheduleConnection, SCHEDULE_CONNECTION_KEY } from '../scheduleService';
export function ScheduleServiceSettings() {
  const [baseUrl, setBase] = useState('https://schedule.xmnup.com');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallenge] = useState('');
  const [bound, setBound] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void scheduleConnection().then(c => { if(c) { setBase(c.baseUrl); setBound(true); } }); }, []);
  async function authenticate(action: string) {
    setBusy(true); setNotice('');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SCHEDULE_ACCOUNT_AUTH', action, baseUrl, email, code, challengeId });
      if (!response?.success) throw new Error(response?.error || '身份验证失败');
      if (action === 'request-code') {
        setChallenge(response.result.challengeId); setNotice('验证码已发送至邮箱，请在 10 分钟内完成验证。');
      } else if (action === 'disconnect') {
        setBound(false); setChallenge(''); setCode(''); setToken('');
        setNotice('已解除本机绑定。若设备丢失，请在网站设置中吊销该设备令牌。');
        await chrome.runtime.sendMessage({ type: 'SCHEDULE_SETUP_SAVED' });
      } else {
        setBound(true); setChallenge(''); setCode('');
        const continued = await chrome.runtime.sendMessage({ type: 'SCHEDULE_SETUP_SAVED' });
        setNotice(`已绑定 ${response.result.email}。${continued?.success ? '可以打开 Schedule。' : '绑定已保存，待提交任务请在网站核对。'}`);
      }
    } catch(e) { setNotice(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const c = { baseUrl: scheduleBase(baseUrl), token: token.trim() };
      if (!c.token) throw new Error('请输入你自己的 API Token');
      const me = await scheduleApi('/me', 'GET', undefined, c);
      await chrome.storage.local.set({ [SCHEDULE_CONNECTION_KEY]: c });
      setBound(true); setToken('');
      const response = await chrome.runtime.sendMessage({ type: 'SCHEDULE_SETUP_SAVED' });
      if (!response?.success) throw new Error(response?.error || '续提失败');
      setNotice(`已连接 ${me.email}。${response.message || '打开分享页可导入，缺少的配置在新版补全。'}`);
    } catch(e) { setNotice(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return <div className="form-section" id="personal-schedule-config">
    <h2>Personal Schedule</h2>
    <p>在独立网站管理计划任务。旧任务请自行到原 Google Sheet 维护或手动迁移。</p>
    <label>服务地址<input aria-label="Schedule 服务地址" type="url" value={baseUrl} onChange={e => { setBase(e.target.value); setChallenge(''); }} /></label>
    <p>{bound ? '本设备已保存 Schedule 连接。换设备时再次验证本人邮箱即可恢复账号。' : '首次使用先验证邮箱，验证成功后为本设备建立连接。新注册限 @ringcentral.com；已有账号由服务端验证。'}</p>
    <label>本人邮箱<input aria-label="Schedule 登录邮箱" type="email" value={email} onChange={e => { setEmail(e.target.value); setChallenge(''); }} /></label>
    <button type="button" disabled={busy} onClick={() => void authenticate('request-code')}>发送邮箱验证码</button>
    <label>邮箱验证码<input aria-label="Schedule 邮箱验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} /></label>
    <p>验证并绑定即授权本站通过扩展登录和导入任务。需要受信 HTTPS 及真实邮件服务；长期设备凭据只由扩展保存，不交给网页。</p>
    <button type="button" disabled={busy || !challengeId} onClick={() => void authenticate('verify-code')}>验证邮箱并绑定此设备</button>{' '}
    {bound && <button type="button" disabled={busy} onClick={() => void authenticate('disconnect')}>解除本机绑定</button>}
    <details><summary>高级：已有个人 API Token（仅导入连接）</summary>
      <label>个人 API Token<input aria-label="Schedule API Token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
      <p>此方式保留已有集成，不自动授权网页登录。需要登录便利功能时请验证邮箱。</p>
      <button type="button" disabled={busy} onClick={() => void save()}>{busy ? '正在连接…' : '连接并保存'}</button>
    </details>{' '}
    <button type="button" onClick={() => void chrome.runtime.sendMessage({ type: 'OPEN_SCHEDULED_MESSAGES' })}>打开计划任务</button>
    <div role="status">{notice}</div><ScheduleJiraCompletion />
  </div>;
}
