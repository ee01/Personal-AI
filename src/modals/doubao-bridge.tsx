import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  DoubaoBridgeClient,
  type DoubaoBridgeBinding,
  type DoubaoBridgeHealth,
  type DoubaoBridgeSettings,
  type DoubaoBridgeStatus,
} from '../services/DoubaoBridgeClient';

type PanelMode = 'idle' | 'loading' | 'success' | 'error';

interface LogEntry {
  id: number;
  time: string;
  message: string;
  kind: PanelMode;
}

const DEFAULT_SETTINGS: DoubaoBridgeSettings = {
  baseUrl: 'http://127.0.0.1:46321/api/v1',
  bridgeToken: '',
};

const formatTime = (value?: string) => {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const DoubaoBridgePanel: React.FC = () => {
  const [client] = useState(() => new DoubaoBridgeClient(DEFAULT_SETTINGS));
  const [settings, setSettings] = useState<DoubaoBridgeSettings>(DEFAULT_SETTINGS);
  const [health, setHealth] = useState<DoubaoBridgeHealth | null>(null);
  const [status, setStatus] = useState<DoubaoBridgeStatus | null>(null);
  const [bindings, setBindings] = useState<DoubaoBridgeBinding[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [mode, setMode] = useState<PanelMode>('idle');
  const [message, setMessage] = useState('等待连接桥接器');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [queryText, setQueryText] = useState('最近关于这个项目有什么结论？');
  const [lastActiveTab, setLastActiveTab] = useState<{ title?: string; url?: string }>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  const pushLog = (kind: PanelMode, text: string) => {
    setLogs((prev) => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        message: text,
        kind,
      },
      ...prev.slice(0, 7),
    ]);
  };

  const refresh = async () => {
    setMode('loading');
    setMessage('正在检查桥接器状态');
    try {
      const loaded = await client.loadSettings();
      setSettings((prev) => ({ ...prev, ...loaded }));
      client.setBaseUrl(loaded.baseUrl);
      client.setBridgeToken(loaded.bridgeToken);

      const [healthResult, statusResult, bindingsResult] = await Promise.allSettled([
        client.getHealth(),
        client.getStatus(),
        client.getBindings(),
      ]);

      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value);
      } else {
        setHealth(null);
      }

      if (statusResult.status === 'fulfilled') {
        setStatus(statusResult.value);
      } else {
        setStatus(null);
      }

      if (bindingsResult.status === 'fulfilled') {
        setBindings(bindingsResult.value.bindings ?? []);
      } else {
        setBindings([]);
      }

      setMode('success');
      setMessage('桥接器状态已刷新');
      pushLog('success', '已刷新桥接器状态');
    } catch (error) {
      const text = error instanceof Error ? error.message : '未知错误';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void refresh();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const saveSettings = async () => {
    setBusyAction('save');
    try {
      const next = await client.saveSettings(settings);
      setSettings(next);
      client.setBaseUrl(next.baseUrl);
      client.setBridgeToken(next.bridgeToken);
      setMode('success');
      setMessage('桥接器配置已保存');
      pushLog('success', '已保存本地桥接器配置');
    } catch (error) {
      const text = error instanceof Error ? error.message : '保存失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const openLogin = async () => {
    setBusyAction('login');
    try {
      const result = await client.openLogin();
      setMode('success');
      setMessage(result.message || '已打开 Doubao 登录窗口');
      pushLog('success', result.message || '已打开 Doubao 登录窗口');
    } catch (error) {
      const text = error instanceof Error ? error.message : '打开登录窗口失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const requestReauth = async () => {
    setBusyAction('reauth');
    try {
      const result = await client.requestReauth();
      setMode('success');
      setMessage(result.message || '已请求重新登录');
      pushLog('success', result.message || '已请求重新登录');
    } catch (error) {
      const text = error instanceof Error ? error.message : '请求重新登录失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const bindMemorySync = async () => {
    setBusyAction('bind-memory');
    try {
      const result = await client.bindMemorySyncThread({
        title: 'Stable memory sync thread',
        note: 'Dedicated thread for persona_core / voice_mode sync',
      });
      setMode('success');
      setMessage(result.message || '长期记忆线程已绑定');
      pushLog('success', result.message || '长期记忆线程已绑定');
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : '绑定长期记忆线程失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const bindMobileContext = async () => {
    setBusyAction('bind-mobile');
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const activeTab = tabs[0];
      setLastActiveTab({
        title: activeTab?.title,
        url: activeTab?.url,
      });

      const result = await client.bindMobileContextThread({
        threadId: activeTab?.url,
        threadUrl: activeTab?.url,
        title: activeTab?.title || 'Mobile Doubao thread',
        note: 'Bind the current mobile-context conversation thread',
      });
      setMode('success');
      setMessage(result.message || '手机版对话线程已绑定');
      pushLog('success', result.message || '手机版对话线程已绑定');
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : '绑定手机版对话失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncPersona = async () => {
    setBusyAction('sync-persona');
    try {
      const result = await client.syncStableMemory({
        title: 'persona_core',
        body:
          '请记住以下稳定信息，用于之后的长期对话：职业角色、长期偏好、沟通风格、稳定约束、长期目标。' +
          '\n\n这条消息来自本机桥接器，只是长期记忆同步，不要把最近的临时项目状态混入长期记忆。',
        stability: 'stable',
        sourceRefs: ['bridge::persona_core'],
        dedupeKey: 'persona_core::stable',
      });
      setMode('success');
      setMessage(result.message || '长期记忆同步已发起');
      pushLog('success', result.message || '长期记忆同步已发起');
    } catch (error) {
      const text = error instanceof Error ? error.message : '同步长期记忆失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncBriefing = async () => {
    setBusyAction('sync-briefing');
    try {
      const result = await client.syncMobileBriefing({
        title: 'recent_focus_digest',
        body:
          '请把以下内容只作为当前会话上下文，不需要长期记住：\n' +
          '1. 最近关注重点项目\n2. 最近待办\n3. 最近结论\n4. 今天通勤/语音聊天需要顺带提醒的事项',
        sourceRefs: ['bridge::mobile_context'],
        ttlMinutes: 240,
        dedupeKey: `mobile_briefing::${new Date().toISOString().slice(0, 10)}`,
      });
      setMode('success');
      setMessage(result.message || '手机版上下文已同步');
      pushLog('success', result.message || '手机版上下文已同步');
    } catch (error) {
      const text = error instanceof Error ? error.message : '同步手机版上下文失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncReminder = async () => {
    setBusyAction('sync-reminder');
    try {
      const result = await client.syncReminderDigest({
        title: 'reminder_digest',
        body: '请记住这是待提醒事项，优先提醒，不要把它当作长期固定事实。',
        dedupeKey: `reminder_digest::${new Date().toISOString().slice(0, 10)}`,
        sourceRefs: ['bridge::reminder'],
      });
      setMode('success');
      setMessage(result.message || '提醒已同步');
      pushLog('success', result.message || '提醒已同步');
    } catch (error) {
      const text = error instanceof Error ? error.message : '同步提醒失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncQueryCard = async () => {
    setBusyAction('sync-query');
    try {
      const result = await client.syncQueryCard({
        query: queryText,
        title: 'query_answer_card',
        answer:
          '请在当前会话中使用这条答案卡回答用户问题；如果还需要补查，请把证据分段列出，但不要把临时结论写成长期记忆。',
        evidence: [
          { label: 'query', value: queryText },
          { label: 'mode', value: 'temporary_context' },
        ],
      });
      setMode('success');
      setMessage(result.message || '查询卡片已注入');
      pushLog('success', result.message || '查询卡片已注入');
    } catch (error) {
      const text = error instanceof Error ? error.message : '注入查询卡片失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const summary = useMemo(() => {
    const memoryBinding = bindings.find((item) => item.bindingType === 'memory_sync');
    const mobileBinding = bindings.find((item) => item.bindingType === 'mobile_context');
    return {
      memoryBinding,
      mobileBinding,
      lastSyncAt: status?.lastSyncAt || health?.lastLoginAt,
      authState: status?.authState || (health?.signedIn ? 'signed_in' : 'unknown'),
    };
  }, [bindings, health, status]);

  return (
    <div className="doubao-bridge-page">
      <div className="doubao-bridge-shell">
        <header className="hero">
          <div>
            <div className="eyebrow">Doubao Bridge</div>
            <h1>本机桥接器与豆包会话绑定</h1>
            <p>
              桥接器常驻在本机，负责登录态、线程绑定和上下文同步。长期记忆进一个稳定线程，临时上下文进手机版对话线程。
            </p>
          </div>
          <div className={`hero-status hero-status-${mode}`}>
            <span className="hero-dot" />
            {message}
          </div>
        </header>

        <section className="panel grid-2">
          <div className="card">
            <h2>连接设置</h2>
            <label>
              <span>桥接器地址</span>
              <input
                value={settings.baseUrl}
                onChange={(e) => setSettings((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="http://127.0.0.1:46321/api/v1"
              />
            </label>
            <label>
              <span>访问令牌</span>
              <input
                value={settings.bridgeToken || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, bridgeToken: e.target.value }))}
                placeholder="本机桥接器 token"
              />
            </label>
            <div className="button-row">
              <button onClick={saveSettings} disabled={busyAction === 'save'}>
                {busyAction === 'save' ? '保存中...' : '保存设置'}
              </button>
              <button onClick={refresh} className="ghost">
                刷新状态
              </button>
            </div>
            <div className="hint">
              常驻的是桥接器进程，不是浏览器窗口。浏览器 profile 只用于保存登录态。
            </div>
          </div>

          <div className="card">
            <h2>状态总览</h2>
            <div className="stat-list">
              <Stat label="健康状态" value={health?.ok ? '可用' : '未连接'} />
              <Stat label="登录状态" value={summary.authState === 'signed_in' ? '已登录' : '未登录'} />
              <Stat label="长期记忆线程" value={summary.memoryBinding?.threadId ? '已绑定' : '未绑定'} />
              <Stat label="手机版对话" value={summary.mobileBinding?.threadId ? '已绑定' : '未绑定'} />
            </div>
            <div className="meta-grid">
              <Meta label="版本" value={health?.version || 'unknown'} />
              <Meta label="模式" value={health?.mode || 'unknown'} />
              <Meta label="最后同步" value={formatTime(summary.lastSyncAt)} />
              <Meta label="最后活动标签页" value={lastActiveTab.title || 'unknown'} />
            </div>
            <div className="button-row">
              <button onClick={openLogin} disabled={busyAction === 'login'}>
                {busyAction === 'login' ? '打开中...' : '打开登录窗口'}
              </button>
              <button onClick={requestReauth} className="ghost" disabled={busyAction === 'reauth'}>
                重新登录
              </button>
            </div>
          </div>
        </section>

        <section className="panel grid-2">
          <div className="card">
            <h2>线程绑定</h2>
            <p className="card-desc">
              长期记忆同步线程应该长期复用；手机版对话线程绑定到你真正聊天的会话，不要新开线程污染长期记忆。
            </p>
            <div className="button-row">
              <button onClick={bindMemorySync} disabled={busyAction === 'bind-memory'}>
                {busyAction === 'bind-memory' ? '绑定中...' : '绑定长期记忆线程'}
              </button>
              <button onClick={bindMobileContext} className="ghost" disabled={busyAction === 'bind-mobile'}>
                {busyAction === 'bind-mobile' ? '绑定中...' : '绑定手机版对话'}
              </button>
            </div>
            <BindingBlock binding={summary.memoryBinding} title="长期记忆线程" />
            <BindingBlock binding={summary.mobileBinding} title="手机版对话" />
          </div>

          <div className="card">
            <h2>同步动作</h2>
            <p className="card-desc">
              长期信息和临时上下文分开处理。前者进稳定线程，后者进当前会话。
            </p>
            <div className="button-stack">
              <button onClick={syncPersona} disabled={busyAction === 'sync-persona'}>
                {busyAction === 'sync-persona' ? '同步中...' : '同步 persona_core'}
              </button>
              <button onClick={syncBriefing} disabled={busyAction === 'sync-briefing'}>
                {busyAction === 'sync-briefing' ? '同步中...' : '同步今日重点到手机版对话'}
              </button>
              <button onClick={syncReminder} disabled={busyAction === 'sync-reminder'}>
                {busyAction === 'sync-reminder' ? '同步中...' : '同步提醒'}
              </button>
            </div>
            <label>
              <span>查询问题</span>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={4}
                placeholder="例如：最近关于下一个版本需求有什么结论？"
              />
            </label>
            <div className="button-row">
              <button onClick={syncQueryCard} disabled={busyAction === 'sync-query'}>
                {busyAction === 'sync-query' ? '注入中...' : '查记忆并注入当前会话'}
              </button>
              <button onClick={() => setAutoRefresh((value) => !value)} className="ghost">
                {autoRefresh ? '关闭自动刷新' : '开启自动刷新'}
              </button>
            </div>
          </div>
        </section>

        <section className="panel grid-2">
          <div className="card">
            <h2>安装指引</h2>
            <ul className="guide-list">
              <li>桥接器是单独发布的本机常驻程序，不在扩展里保存豆包账号密码。</li>
              <li>首次点击登录时，只在桥接器浏览器窗口里手动登录一次。</li>
              <li>登录后，桥接器复用本地 profile，后续按需同步长期记忆和会话上下文。</li>
              <li>如果你正在用手机或耳机聊天，把当前会话绑定成手机版对话线程。</li>
            </ul>
          </div>

          <div className="card">
            <h2>最近日志</h2>
            <div className="log-list">
              {logs.length === 0 ? (
                <div className="log-empty">还没有操作记录</div>
              ) : (
                logs.map((entry) => (
                  <div key={entry.id} className={`log-item log-item-${entry.kind}`}>
                    <span className="log-time">{entry.time}</span>
                    <span className="log-message">{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        :root {
          color-scheme: dark;
        }

        body {
          margin: 0;
        }

        .doubao-bridge-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(245, 158, 11, 0.22), transparent 28%),
            radial-gradient(circle at top right, rgba(249, 115, 22, 0.18), transparent 26%),
            linear-gradient(180deg, #0f172a 0%, #111827 48%, #0b1220 100%);
          color: #e5e7eb;
          padding: 20px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .doubao-bridge-shell {
          max-width: 1080px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.76);
          backdrop-filter: blur(18px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
        }

        .eyebrow {
          color: #f59e0b;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .hero h1 {
          margin: 0 0 10px;
          font-size: 24px;
          line-height: 1.15;
        }

        .hero p,
        .card-desc,
        .hint {
          margin: 0;
          color: #94a3b8;
          line-height: 1.6;
        }

        .hero-status {
          flex-shrink: 0;
          border-radius: 999px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          max-width: 360px;
        }

        .hero-status-idle { background: rgba(148, 163, 184, 0.15); }
        .hero-status-loading { background: rgba(59, 130, 246, 0.16); }
        .hero-status-success { background: rgba(34, 197, 94, 0.16); }
        .hero-status-error { background: rgba(239, 68, 68, 0.18); }

        .hero-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04);
        }

        .panel {
          display: grid;
          gap: 16px;
        }

        .grid-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.72);
          backdrop-filter: blur(14px);
          padding: 18px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
        }

        .card h2 {
          margin: 0 0 14px;
          font-size: 16px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        label > span {
          font-size: 13px;
          color: #cbd5e1;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.72);
          color: #e5e7eb;
          padding: 12px 14px;
          outline: none;
          font: inherit;
        }

        input:focus,
        textarea:focus {
          border-color: rgba(245, 158, 11, 0.65);
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
        }

        textarea {
          resize: vertical;
        }

        button {
          border: none;
          border-radius: 12px;
          padding: 11px 14px;
          cursor: pointer;
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          color: white;
          font-weight: 600;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(249, 115, 22, 0.26);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        button.ghost {
          background: rgba(30, 41, 59, 0.86);
          color: #e5e7eb;
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .button-row,
        .button-stack {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .button-stack {
          flex-direction: column;
          margin-bottom: 14px;
        }

        .button-row button,
        .button-stack button {
          flex: 1;
          min-width: 0;
        }

        .guide-list {
          margin: 0;
          padding-left: 20px;
          color: #cbd5e1;
          line-height: 1.7;
        }

        .stat-list {
          display: grid;
          gap: 10px;
          margin-bottom: 12px;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          background: rgba(2, 6, 23, 0.56);
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .stat-label {
          color: #94a3b8;
          font-size: 13px;
        }

        .stat-value {
          color: #f8fafc;
          font-weight: 600;
          text-align: right;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .meta {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .meta-label {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .meta-value {
          color: #f8fafc;
          font-weight: 600;
          word-break: break-word;
        }

        .binding-block {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.56);
          border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .binding-title {
          font-size: 13px;
          color: #cbd5e1;
          margin-bottom: 8px;
        }

        .binding-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .log-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 260px;
          overflow: auto;
        }

        .log-empty {
          color: #64748b;
          font-size: 13px;
        }

        .log-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          border: 1px solid rgba(148, 163, 184, 0.14);
          font-size: 13px;
        }

        .log-item-success { border-color: rgba(34, 197, 94, 0.18); }
        .log-item-error { border-color: rgba(239, 68, 68, 0.18); }

        .log-time {
          color: #94a3b8;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .log-message {
          color: #e5e7eb;
          line-height: 1.5;
        }

        @media (max-width: 860px) {
          .grid-2 {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
          }

          .hero-status {
            max-width: none;
          }

          .meta-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

function BindingBlock({ title, binding }: { title: string; binding?: DoubaoBridgeBinding }) {
  return (
    <div className="binding-block">
      <div className="binding-title">{title}</div>
      <div className="binding-line">
        <span>thread id</span>
        <span>{binding?.threadId || '未绑定'}</span>
      </div>
      <div className="binding-line">
        <span>title</span>
        <span>{binding?.title || 'unknown'}</span>
      </div>
      <div className="binding-line">
        <span>updated</span>
        <span>{formatTime(binding?.updatedAt)}</span>
      </div>
    </div>
  );
}
