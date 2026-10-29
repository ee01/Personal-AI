import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  OFFICIAL_MULTICA_API_ORIGIN,
  OFFICIAL_MULTICA_WEB_ORIGIN,
} from './multicaContract.js';
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
  onChange: (draft: MulticaDraft) => void;
}): JSX.Element {
  const [advanced, setAdvanced] = useState(false);
  const [apiOrigin, setApiOrigin] = useState(OFFICIAL_MULTICA_API_ORIGIN);
  const [webOrigin, setWebOrigin] = useState(OFFICIAL_MULTICA_WEB_ORIGIN);
  const [pat, setPat] = useState('');
  const [remember, setRemember] = useState(false);
  const [accountLabel, setAccountLabel] = useState('');
  const [userId, setUserId] = useState('');
  const [connected, setConnected] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [agents, setAgents] = useState<AgentChoice[]>([]);
  const [projects, setProjects] = useState<ProjectChoice[]>([]);
  const [agentId, setAgentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('粘贴你自己的 PAT 后验证连接。扩展不会使用这台电脑上别人的 Multica 登录。');
  const [busy, setBusy] = useState(false);

  const insecure = /^http:\/\//i.test(apiOrigin.trim()) || /^http:\/\//i.test(webOrigin.trim());
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const agent = agents.find((item) => item.id === agentId);
  const ready = connected && Boolean(workspaceId && agentId);
  const blockReason = !connected
    ? '请先验证 Multica 连接'
    : !workspaceId
      ? '请选择 workspace'
      : !agentId
        ? '请选择已有 Agent'
        : '';

  useEffect(() => {
    props.onChange({
      ready,
      blockReason,
      apiOrigin,
      webOrigin,
      userId,
      accountLabel,
      workspaceId,
      workspaceSlug: workspace?.slug || '',
      agentId,
      projectId,
    });
  }, [ready, blockReason, apiOrigin, webOrigin, userId, accountLabel, workspaceId, workspace?.slug, agentId, projectId]);

  useEffect(() => {
    void sendMultica('MULTICA_STATUS').then((response) => {
      const connection = response.connection;
      if (!connection?.connected) return;
      setConnected(true);
      setApiOrigin(connection.apiOrigin || OFFICIAL_MULTICA_API_ORIGIN);
      setWebOrigin(connection.webOrigin || OFFICIAL_MULTICA_WEB_ORIGIN);
      setAccountLabel(connection.accountLabel || '');
      setUserId(connection.userId || '');
      setRemember(connection.remember === true);
      setWorkspaceId(connection.workspaceId || '');
      setStatus(`已连接 ${connection.accountLabel || connection.userId}。PAT 只留在扩展后台。`);
    }).catch(() => undefined);
  }, []);

  const verify = async () => {
    setBusy(true);
    try {
      const response = await sendMultica('MULTICA_VERIFY', { apiOrigin, webOrigin, pat, remember });
      setPat('');
      setConnected(true);
      if (response.connection?.apiOrigin) setApiOrigin(response.connection.apiOrigin);
      if (response.connection?.webOrigin) setWebOrigin(response.connection.webOrigin);
      setAccountLabel(response.connection?.accountLabel || '');
      setUserId(response.connection?.userId || '');
      setWorkspaces(response.workspaces || []);
      setWorkspaceId('');
      setAgents([]);
      setAgentId('');
      setStatus(response.message || `已验证 ${response.connection?.accountLabel || '账号'}。请选择 workspace。`);
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
    setAgents([]);
    if (!selected) return;
    setBusy(true);
    try {
      await sendMultica('MULTICA_SELECT_WORKSPACE', { workspaceId: selected.id, workspaceSlug: selected.slug });
      const resources = await sendMultica('MULTICA_LIST_RESOURCES');
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
          <label>API 地址<input style={inputStyle} value={apiOrigin} onChange={(event) => setApiOrigin(event.target.value)} /></label>
          <label>网页地址<input style={inputStyle} value={webOrigin} onChange={(event) => setWebOrigin(event.target.value)} /></label>
        </div>
      )}
      {insecure && (
        <p style={hintStyle}>
          这个地址是 HTTP。扩展后台经常发不出 HTTP 请求，验证时会改试同主机的 HTTPS。PAT 会明文发送，只填写你信任的地址。
        </p>
      )}
      <label style={{ display: 'block', marginTop: '10px' }}>
        Personal Access Token
        <input style={inputStyle} type="password" autoComplete="off" value={pat} onChange={(event) => setPat(event.target.value)} />
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
        <button type="button" disabled={props.disabled || busy || !pat.trim()} onClick={() => { void verify(); }}>验证连接</button>
        <button type="button" disabled={props.disabled || !connected} onClick={() => { void disconnect(); }}>断开连接</button>
      </div>
      <p role="status" style={hintStyle}>{status}</p>
      {workspaces.length > 0 && (
        <label style={{ display: 'block' }}>
          Workspace
          <select style={inputStyle} value={workspaceId} onChange={(event) => { void chooseWorkspace(event.target.value); }}>
            <option value="">选择 workspace</option>
            {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name || item.slug}</option>)}
          </select>
        </label>
      )}
      {agents.length > 0 && (
        <label style={{ display: 'block', marginTop: '8px' }}>
          Agent
          <select style={inputStyle} value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            <option value="">选择 Agent</option>
            {agents.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.runtimeLabel}</option>)}
          </select>
        </label>
      )}
      {projects.length > 0 && (
        <label style={{ display: 'block', marginTop: '8px' }}>
          Project（可选）
          <select style={inputStyle} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">不指定 project</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <p style={hintStyle}>
        {ready
          ? `可创建任务。账号 ${accountLabel || userId}，Agent ${agent?.name || agentId}。`
          : '通过校验后才会允许保存。首次获取 PAT、安装 runtime 和工具登录仍需要打开 Multica。'}
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
