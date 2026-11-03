import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_MULTICA_API_ORIGIN,
  DEFAULT_MULTICA_WEB_ORIGIN,
} from './multicaContract.js';
import type { ScheduledMessage } from '../types';
import { sendMulticaExtensionMessage } from './multicaConnection.js';

export interface MulticaDraft {
  ready: boolean;
  blockReason: string;
  apiOrigin: string;
  webOrigin: string;
  userId: string;
  accountLabel: string;
  workspaceId: string;
  workspaceSlug: string;
  agentId: string;
  projectId: string;
}

interface WorkspaceChoice { id: string; slug: string; name: string }
interface AgentChoice { id: string; name: string; runtimeLabel: string }
interface ProjectChoice { id: string; name: string }

function sendMultica(type: string, data?: Record<string, unknown>): Promise<any> {
  return sendMulticaExtensionMessage(type, data);
}

export function MulticaAgentTaskPanel(props: {
  disabled?: boolean;
  initial?: ScheduledMessage | null;
  onChange: (draft: MulticaDraft) => void;
}): JSX.Element {
  const initial = props.initial?.Agent_Provider === 'multica' ? props.initial : null;
  const [advanced, setAdvanced] = useState(true);
  const [apiOrigin, setApiOrigin] = useState(initial?.Agent_Multica_Api_Origin || DEFAULT_MULTICA_API_ORIGIN);
  const [webOrigin, setWebOrigin] = useState(initial?.Agent_Multica_Web_Origin || DEFAULT_MULTICA_WEB_ORIGIN);
  const [pat, setPat] = useState('');
  const [remember, setRemember] = useState(true);
  const [accountLabel, setAccountLabel] = useState('');
  const [userId, setUserId] = useState(initial?.Agent_Multica_User_ID || '');
  const [connected, setConnected] = useState(false);
  const [hasStoredPat, setHasStoredPat] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[]>([]);
  const [workspaceId, setWorkspaceId] = useState(initial?.Agent_Multica_Workspace_ID || '');
  const [agents, setAgents] = useState<AgentChoice[]>([]);
  const [projects, setProjects] = useState<ProjectChoice[]>([]);
  const [agentId, setAgentId] = useState(initial?.Agent_Multica_Agent_ID || '');
  const [projectId, setProjectId] = useState(initial?.Agent_Multica_Project_ID || '');
  const [status, setStatus] = useState('粘贴你自己的 PAT 后验证连接。扩展不会使用这台电脑上别人的 Multica 登录。');
  const [busy, setBusy] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const insecure = /^http:\/\//i.test(apiOrigin.trim()) || /^http:\/\//i.test(webOrigin.trim());
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const agent = agents.find((item) => item.id === agentId);
  const ready = connected && !busy && workspaces.some(item => item.id === workspaceId)
    && agents.some(item => item.id === agentId)
    && (!projectId || projects.some(item => item.id === projectId));
  const blockReason = busy ? '正在恢复 Multica 连接，请稍候'
    : !connected ? '请先验证 Multica 连接'
    : !workspaces.some(item => item.id === workspaceId) ? '请选择 workspace'
    : !agents.some(item => item.id === agentId) ? '请选择可访问的已有 Agent'
    : projectId && !projects.some(item => item.id === projectId) ? '原 project 已不可用，请重新选择或取消 project'
    : '';


  useEffect(() => {
    if (!hydrated) return;
    props.onChange({
      ready,
      blockReason,
      apiOrigin,
      webOrigin,
      userId,
      accountLabel,
      workspaceId,
      workspaceSlug: workspace?.slug || initial?.Agent_Multica_Workspace_Slug || '',
      agentId,
      projectId,
    });
  }, [hydrated, ready, blockReason, apiOrigin, webOrigin, userId, accountLabel, workspaceId, workspace?.slug, agentId, projectId]);

  const applyRestored = (response: any) => {
    const connection = response.connection;
    setConnected(true);
    setHasStoredPat(true);
    setApiOrigin(connection.apiOrigin);
    setWebOrigin(connection.webOrigin);
    setAccountLabel(connection.accountLabel || '');
    setUserId(connection.userId || '');
    setRemember(connection.remember === true);
    setWorkspaces(response.workspaces || []);
    setWorkspaceId(connection.workspaceId || '');
    setAgents(response.agents || []);
    setProjects(response.projects || []);
    const defaults = response.defaults?.workspaceId === connection.workspaceId ? response.defaults : undefined;
    const desiredAgent = initial?.Agent_Multica_Agent_ID ?? defaults?.agentId ?? '';
    const desiredProject = initial?.Agent_Multica_Project_ID ?? defaults?.projectId ?? '';
    setAgentId(initial || (response.agents || []).some((item: AgentChoice) => item.id === desiredAgent) ? desiredAgent : '');
    setProjectId(initial || (response.projects || []).some((item: ProjectChoice) => item.id === desiredProject) ? desiredProject : '');
    setStatus(`已复用 ${connection.accountLabel || connection.userId} 的本机 PAT，无需重新填写。`);
  };

  const restore = async (useInitial = true) => {
    const response = await sendMultica('MULTICA_RESTORE', useInitial && initial ? {
      apiOrigin: initial.Agent_Multica_Api_Origin,
      userId: initial.Agent_Multica_User_ID,
      workspaceId: initial.Agent_Multica_Workspace_ID,
    } : undefined);
    applyRestored(response);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await sendMultica('MULTICA_STATUS');
        if (cancelled || !response.connection?.connected) return;
        setHasStoredPat(true);
        setRemember(response.connection.remember === true);
        if (!initial) {
          setApiOrigin(response.connection.apiOrigin);
          setWebOrigin(response.connection.webOrigin);
        }
        // Keep the task's values when restoring fails; never silently rebind an edited task.
        if (initial) {
          setApiOrigin(initial.Agent_Multica_Api_Origin || response.connection.apiOrigin);
          setWebOrigin(initial.Agent_Multica_Web_Origin || response.connection.webOrigin);
          setWorkspaceId(initial.Agent_Multica_Workspace_ID || '');
          setAgentId(initial.Agent_Multica_Agent_ID || '');
          setProjectId(initial.Agent_Multica_Project_ID || '');
          setUserId(initial.Agent_Multica_User_ID || '');
        }
        await restore();
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : '恢复连接失败，请重试。');
      } finally {
        if (!cancelled) { setBusy(false); setHydrated(true); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveDefaults = async (nextAgent: string, nextProject: string, nextWorkspace = workspaceId) => {
    try {
      await sendMultica('MULTICA_SAVE_DEFAULTS', {
        workspaceId: nextWorkspace, agentId: nextAgent, projectId: nextProject,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存默认选择失败');
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await sendMultica('MULTICA_VERIFY', { apiOrigin, webOrigin, pat, remember });
      setPat('');
      setHasStoredPat(true);
      await restore();
    } catch (error) {
      setConnected(false);
      setStatus(error instanceof Error ? error.message : '验证失败');
    } finally {
      setBusy(false);
    }
  };

  const chooseWorkspace = async (nextId: string) => {
    const selected = workspaces.find((item) => item.id === nextId);
    setWorkspaceId(nextId);
    setAgentId('');
    setProjectId('');
    setAgents([]);
    setProjects([]);
    if (!selected) return;
    setBusy(true);
    try {
      await sendMultica('MULTICA_SELECT_WORKSPACE', { workspaceId: selected.id, workspaceSlug: selected.slug });
      const resources = await sendMultica('MULTICA_LIST_RESOURCES', { workspaceId: nextId });
      await saveDefaults('', '', nextId);
      setAgents(resources.agents || []);
      setProjects(resources.projects || []);
      const offline = (resources.runtimes || []).filter((item: { status?: string }) => /offline|unavailable/i.test(item.status || ''));
      setStatus(resources.agents?.length
        ? (offline.length ? 'Agent 已列出，但有 runtime 显示离线。离线时仍可保存计划，到点执行可能被跳过。' : '可以选择 Agent。')
        : '这个 workspace 里还没有 Agent。请先在 Multica 准备 Agent 和 runtime，扩展不会自动安装。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '读取 workspace 失败');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const response = await sendMultica('MULTICA_DISCONNECT');
    setConnected(false);
    setHasStoredPat(false);
    setUserId('');
    setAccountLabel('');
    setWorkspaces([]);
    setAgents([]);
    setWorkspaceId('');
    setAgentId('');
    setStatus(response.message || '已断开本机连接。');
  };

  return (
    <section style={panelStyle} aria-label="连接你的 Multica">
      <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}>连接你的 Multica</h3>
      <p style={hintStyle}>
        用你自己的 PAT 选择 workspace 和已有 Agent。保存时会创建一个只有 Webhook 的 Autopilot。时间仍由 Jira 触发，这次保存不会马上执行。
      </p>
      <button type="button" style={linkButton} onClick={() => setAdvanced((value) => !value)}>
        {advanced ? '收起服务地址' : '自托管地址'}
      </button>
      {advanced && (
        <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
          <label>API 地址<input style={inputStyle} value={apiOrigin} onChange={(event) => { setApiOrigin(event.target.value); setConnected(false); }} /></label>
          <label>网页地址<input style={inputStyle} value={webOrigin} onChange={(event) => { setWebOrigin(event.target.value); setConnected(false); }} /></label>
        </div>
      )}
      {insecure && (
        <p style={hintStyle}>
          这个地址是 HTTP，PAT 会明文发送。请求由扩展后台直接发出，不会改成 HTTPS。只填写你信任的地址。
        </p>
      )}
      <label style={{ display: 'block', marginTop: '10px' }}>
        Personal Access Token
        <input style={inputStyle} type="password" autoComplete="off" value={pat} placeholder={hasStoredPat ? '已保存 PAT，留空复用；填写新值可更换' : '粘贴你的 PAT'} onChange={(event) => setPat(event.target.value)} />
      </label>
      <label style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
        <input
          type="checkbox"
          checked={remember}
          onChange={async (event) => {
            setRemember(event.target.checked);
            if (connected) await sendMultica('MULTICA_SET_REMEMBER', { remember: event.target.checked }).catch(() => undefined);
          }}
        />
        记住此设备。关闭浏览器后仍保留 PAT。这不是加密保险箱，只放在本机扩展存储里。
      </label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" disabled={props.disabled || busy || (!hasStoredPat && !pat.trim())} onClick={() => { void verify(); }}>{hasStoredPat && !pat.trim() ? '重新检查连接' : '验证连接'}</button>
        <button type="button" disabled={props.disabled || !hasStoredPat} onClick={() => { void disconnect(); }}>断开连接</button>
      </div>
      <p role="status" style={hintStyle}>{status}</p>
      {workspaces.length > 0 && (
        <label style={{ display: 'block' }}>
          Workspace
          <select style={inputStyle} disabled={busy || props.disabled} value={workspaceId} onChange={(event) => { void chooseWorkspace(event.target.value); }}>
            <option value="">选择 workspace</option>
            {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name || item.slug}</option>)}
          </select>
        </label>
      )}
      {(agents.length > 0 || agentId) && (
        <label style={{ display: 'block', marginTop: '8px' }}>
          Agent
          <select style={inputStyle} disabled={busy || props.disabled} value={agentId} onChange={(event) => { setAgentId(event.target.value); void saveDefaults(event.target.value, projectId); }}>
            <option value="">选择 Agent</option>
            {agentId && !agents.some(item => item.id === agentId) && <option value={agentId}>原 Agent（当前不可用）</option>}
            {agents.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.runtimeLabel}</option>)}
          </select>
        </label>
      )}
      {(projects.length > 0 || projectId) && (
        <label style={{ display: 'block', marginTop: '8px' }}>
          Project（可选）
          <select style={inputStyle} disabled={busy || props.disabled} value={projectId} onChange={(event) => { setProjectId(event.target.value); void saveDefaults(agentId, event.target.value); }}>
            <option value="">不指定 project</option>
            {projectId && !projects.some(item => item.id === projectId) && <option value={projectId}>原 project（当前不可用）</option>}
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <p style={hintStyle}>
        {ready
          ? `可创建任务。账号 ${accountLabel || userId}，Agent ${agent?.name || agentId}。`
          : `${blockReason}。首次获取 PAT、安装 runtime 和工具登录仍需要打开 Multica。`}
        断开连接只删除本机 PAT，不会停止已经创建的周期或 Webhook。
      </p>
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #dbe3ea',
  borderRadius: '8px',
  padding: '14px',
  marginBottom: '14px',
};
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px' };
const hintStyle: React.CSSProperties = { color: '#4b5563', fontSize: '12px', lineHeight: 1.5 };
const linkButton: React.CSSProperties = { background: 'none', border: 'none', color: '#1d4ed8', padding: 0, cursor: 'pointer' };
