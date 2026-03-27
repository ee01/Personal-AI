import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  DoubaoBridgeClient,
  type DoubaoBridgeBinding,
  type DoubaoBridgeBindingType,
  type DoubaoBridgeHealth,
  type DoubaoBridgeSettings,
  type DoubaoBridgeStatus,
  type DoubaoBridgeSyncResult,
} from '../services/DoubaoBridgeClient';
import {
  MemoryServiceClient,
  type HealthResponse,
  type ProviderContextPackageResponse,
  type ProviderMemoryProduct,
} from '../services/MemoryServiceClient';

type PanelMode = 'idle' | 'loading' | 'success' | 'error';

interface LogEntry {
  id: number;
  time: string;
  message: string;
  kind: PanelMode;
}

const DEFAULT_SETTINGS: DoubaoBridgeSettings = {
  baseUrl: 'http://127.0.0.1:46321',
  bridgeToken: '',
  autoRefreshMs: 12_000,
};

const RELEASE_DOWNLOAD_URL = 'https://github.com/ee01/personal-ai/releases/latest';

const PROVIDER = 'doubao';

const PROVIDER_BINDING_TYPES: Record<DoubaoBridgeBindingType, 'memory_sync_thread' | 'mobile_context_thread'> = {
  memory_sync: 'memory_sync_thread',
  mobile_context: 'mobile_context_thread',
};

const formatTime = (value?: string | number) => {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

function bridgeBindingsToArray(
  bindings?: Partial<Record<DoubaoBridgeBindingType, DoubaoBridgeBinding>>,
): DoubaoBridgeBinding[] {
  if (!bindings) return [];
  return Object.values(bindings).filter((item): item is DoubaoBridgeBinding => Boolean(item));
}

function stripMarkdownPrefix(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
}

function extractPackageBullets(pkg: ProviderMemoryProduct, limit = 6): string[] {
  const lines = pkg.bodyMd
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets: string[] = [];
  let currentSection = pkg.title;

  for (const line of lines) {
    if (line.startsWith('#')) {
      const heading = stripMarkdownPrefix(line);
      if (heading) currentSection = heading;
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const value = stripMarkdownPrefix(line);
      if (value) {
        bullets.push(currentSection && currentSection !== pkg.title ? `${currentSection}: ${value}` : value);
      }
      if (bullets.length >= limit) break;
      continue;
    }
  }

  if (bullets.length > 0) {
    return bullets.slice(0, limit);
  }

  return lines
    .map((line) => stripMarkdownPrefix(line))
    .filter(Boolean)
    .slice(0, limit)
    .map((line) => `${pkg.title}: ${line}`);
}

function extractReminderItems(pkg: ProviderMemoryProduct, limit = 8) {
  return extractPackageBullets(pkg, limit).map((title) => ({
    title,
    severity: 'medium' as const,
  }));
}

async function findBestOpenedDoubaoTab(): Promise<{ title?: string; url?: string } | null> {
  const tabs = await chrome.tabs.query({
    url: ['https://www.doubao.com/*', 'http://www.doubao.com/*'],
  });

  const candidates = tabs
    .filter((tab) => tab.url && /^https?:\/\/www\.doubao\.com\//.test(tab.url))
    .map((tab) => ({
      title: tab.title,
      url: tab.url,
      active: Boolean(tab.active),
      lastAccessed: (tab as chrome.tabs.Tab & { lastAccessed?: number }).lastAccessed ?? 0,
    }))
    .sort((left, right) => {
      const leftScore =
        (left.title?.includes('手机版对话') ? 10_000 : 0) +
        (left.url?.includes('/chat/') ? 1_000 : 0) +
        (left.active ? 100 : 0) +
        left.lastAccessed;
      const rightScore =
        (right.title?.includes('手机版对话') ? 10_000 : 0) +
        (right.url?.includes('/chat/') ? 1_000 : 0) +
        (right.active ? 100 : 0) +
        right.lastAccessed;
      return rightScore - leftScore;
    });

  if (candidates.length === 0) return null;
  return {
    title: candidates[0].title,
    url: candidates[0].url,
  };
}

export const DoubaoBridgePanel: React.FC = () => {
  const [bridgeClient] = useState(() => new DoubaoBridgeClient(DEFAULT_SETTINGS));
  const [memoryClient] = useState(() => new MemoryServiceClient());
  const [settings, setSettings] = useState<DoubaoBridgeSettings>(DEFAULT_SETTINGS);
  const [health, setHealth] = useState<DoubaoBridgeHealth | null>(null);
  const [status, setStatus] = useState<DoubaoBridgeStatus | null>(null);
  const [memoryHealth, setMemoryHealth] = useState<HealthResponse | null>(null);
  const [memoryHealthError, setMemoryHealthError] = useState<string | null>(null);
  const [bindings, setBindings] = useState<DoubaoBridgeBinding[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [mode, setMode] = useState<PanelMode>('idle');
  const [message, setMessage] = useState('等待连接桥接器');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [queryText, setQueryText] = useState('最近关于下一个版本需求有什么结论？');
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

  const describeError = (error: unknown, opts?: { includeMemoryServiceUrl?: boolean }) => {
    const baseText = error instanceof Error ? error.message : '未知错误';
    if (opts?.includeMemoryServiceUrl && /MemoryService|Failed to fetch|Network error/i.test(baseText)) {
      return `${baseText} (Memory Service: ${memoryClient.getBaseUrl()})`;
    }
    return baseText;
  };

  const reportSyncJob = async (
    rendered: ProviderContextPackageResponse,
    result: DoubaoBridgeSyncResult,
    startedAt: number,
  ) => {
    if (!rendered.syncJob?.id) return;

    const statusValue =
      result.accepted && !result.error ? 'succeeded' : 'failed';

    await memoryClient.reportProviderSyncJob(PROVIDER, rendered.syncJob.id, {
      status: statusValue,
      result: {
        bridgeKind: result.kind,
        targetBindingType: result.targetBindingType,
        transcriptPreview: result.transcript.slice(0, 400),
      },
      errorMessage: result.error,
      externalThreadId: result.threadId,
      completedAt: Date.now(),
      startedAt,
    });
  };

  const renderProviderPackages = async (
    scenario: 'stable_memory' | 'mobile_briefing' | 'query_answer' | 'reminder_sync',
    extra?: { query?: string; deviceContext?: string },
  ) => {
    return memoryClient.renderProviderContextPackage({
      provider: PROVIDER,
      scenario,
      query: extra?.query,
      deviceContext: extra?.deviceContext ?? 'extension_popup',
      createSyncJob: true,
    });
  };

  const refresh = async () => {
    setMode('loading');
    setMessage('正在检查桥接器状态');
    try {
      const loaded = await bridgeClient.loadSettings();
      setSettings((prev) => ({ ...prev, ...loaded }));
      bridgeClient.setBaseUrl(loaded.baseUrl);
      bridgeClient.setBridgeToken(loaded.bridgeToken);

      const [healthResult, statusResult, threadsResult, memoryHealthResult] = await Promise.allSettled([
        bridgeClient.getHealth(),
        bridgeClient.getStatus(),
        bridgeClient.getThreads(),
        memoryClient.getHealth(),
      ]);

      if (healthResult.status !== 'fulfilled' || statusResult.status !== 'fulfilled' || threadsResult.status !== 'fulfilled') {
        throw new Error(
          healthResult.status === 'rejected'
            ? healthResult.reason instanceof Error
              ? healthResult.reason.message
              : 'Bridge health check failed'
            : statusResult.status === 'rejected'
              ? statusResult.reason instanceof Error
                ? statusResult.reason.message
                : 'Bridge status check failed'
              : threadsResult.status === 'rejected'
                ? threadsResult.reason instanceof Error
                  ? threadsResult.reason.message
                  : 'Bridge thread query failed'
                : 'Bridge refresh failed',
        );
      }

      setHealth(healthResult.value);
      setStatus(statusResult.value);
      setBindings(bridgeBindingsToArray(threadsResult.value.bindings));
      if (memoryHealthResult.status === 'fulfilled') {
        setMemoryHealth(memoryHealthResult.value);
        setMemoryHealthError(null);
      } else {
        setMemoryHealth(null);
        setMemoryHealthError(
          memoryHealthResult.reason instanceof Error
            ? memoryHealthResult.reason.message
            : 'Memory Service unreachable',
        );
      }
      setSettings((prev) => ({
        ...prev,
        bridgeToken: bridgeClient.getBridgeToken(),
      }));

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
    }, settings.autoRefreshMs ?? DEFAULT_SETTINGS.autoRefreshMs!);
    return () => window.clearInterval(timer);
  }, [autoRefresh, settings.autoRefreshMs]);

  const saveSettings = async () => {
    setBusyAction('save');
    try {
      const next = await bridgeClient.saveSettings(settings);
      setSettings(next);
      bridgeClient.setBaseUrl(next.baseUrl);
      bridgeClient.setBridgeToken(next.bridgeToken);
      setMode('success');
      setMessage('桥接器配置已保存');
      pushLog('success', '已保存本地桥接器配置');
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : '保存失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const pairBridge = async () => {
    setBusyAction('pair');
    try {
      const result = await bridgeClient.pair();
      setSettings((prev) => ({ ...prev, bridgeToken: result.token }));
      setMode('success');
      setMessage('桥接器配对成功');
      pushLog('success', '已完成桥接器配对并保存 token');
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : '桥接器配对失败';
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
      const result = await bridgeClient.openLogin();
      setMode('success');
      setMessage(`已打开 Doubao 登录窗口：${result.url}`);
      pushLog('success', '已打开 Doubao 登录窗口');
    } catch (error) {
      const text = error instanceof Error ? error.message : '打开登录窗口失败';
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const persistProviderBinding = async (
    bindingType: DoubaoBridgeBindingType,
    binding: DoubaoBridgeBinding,
  ) => {
    const externalThreadId = binding.threadId || binding.threadUrl;
    if (!externalThreadId) return;

    await memoryClient.upsertProviderBinding(PROVIDER, PROVIDER_BINDING_TYPES[bindingType], {
      externalThreadId,
      title: binding.title,
      deviceId: 'extension-popup',
      metadata: binding.threadUrl ? { threadUrl: binding.threadUrl } : undefined,
      isActive: true,
      lastError: null,
    });
  };

  const bindMemorySync = async () => {
    setBusyAction('bind-memory');
    try {
      const thread = await bridgeClient.createMemorySyncThread();
      await persistProviderBinding('memory_sync', {
        bindingType: 'memory_sync',
        threadId: thread.id,
        threadUrl: thread.url,
        title: thread.title,
        updatedAt: thread.updatedAt,
      });
      setMode('success');
      setMessage('长期记忆线程已创建并绑定');
      pushLog('success', '已创建长期记忆同步线程，并回写到 memory-service provider binding');
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
      let binding: DoubaoBridgeBinding | null = null;

      try {
        binding = await bridgeClient.autoBindMobileContextThread('手机版对话');
        pushLog('success', '已自动检索到标题为“手机版对话”的线程，准备完成绑定');
      } catch {
        const openedDoubaoTab = await findBestOpenedDoubaoTab();
        setLastActiveTab(openedDoubaoTab || {});

        if (!openedDoubaoTab?.url || !/doubao\.com/.test(openedDoubaoTab.url)) {
          throw new Error('没有自动找到“手机版对话”线程，也没有找到可绑定的已打开 Doubao 聊天标签页。请先在任意浏览器窗口打开目标 Doubao 聊天页后重试。');
        }

        binding = await bridgeClient.bindMobileContextThread({
          threadUrl: openedDoubaoTab.url,
          title: openedDoubaoTab.title || '手机版对话',
        });
        pushLog('success', `自动检索失败，已退回到已打开的 Doubao 标签页绑定: ${openedDoubaoTab.title || openedDoubaoTab.url}`);
      }

      if (!binding) {
        throw new Error('绑定手机版对话失败');
      }

      await persistProviderBinding('mobile_context', binding);
      setMode('success');
      setMessage('手机版对话线程已绑定');
      pushLog('success', '已绑定手机端真实对话线程，并回写到 memory-service');
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
    const startedAt = Date.now();
    try {
      const rendered = await renderProviderPackages('stable_memory');
      if (rendered.packages.length === 0) {
        throw new Error('memory-service 没有生成可同步的长期记忆内容。');
      }

      const result = await bridgeClient.syncStableMemory({
        items: rendered.packages.map((pkg) => ({
          title: pkg.title,
          body: pkg.bodyMd,
        })),
      });
      await reportSyncJob(rendered, result, startedAt);
      if (result.error) {
        throw new Error(result.error);
      }
      setMode('success');
      setMessage('长期记忆同步完成');
      pushLog('success', `已同步 ${rendered.packages.length} 个稳定记忆包到 Doubao 长期记忆线程`);
      await refresh();
    } catch (error) {
      const text = describeError(error, { includeMemoryServiceUrl: true });
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncBriefing = async () => {
    setBusyAction('sync-briefing');
    const startedAt = Date.now();
    try {
      const rendered = await renderProviderPackages('mobile_briefing', {
        deviceContext: 'commute_popup',
      });
      const bullets = rendered.packages.flatMap((pkg) => extractPackageBullets(pkg, 5)).slice(0, 12);
      if (bullets.length === 0) {
        throw new Error('memory-service 没有生成可同步的手机版上下文。');
      }

      const result = await bridgeClient.syncMobileBriefing({
        title: '今天的 Doubao 手机版上下文',
        bullets,
      });
      await reportSyncJob(rendered, result, startedAt);
      if (result.error) {
        throw new Error(result.error);
      }
      setMode('success');
      setMessage('手机版上下文同步完成');
      pushLog('success', `已同步 ${bullets.length} 条 briefing 到手机版对话线程`);
      await refresh();
    } catch (error) {
      const text = describeError(error, { includeMemoryServiceUrl: true });
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncReminder = async () => {
    setBusyAction('sync-reminder');
    const startedAt = Date.now();
    try {
      const rendered = await renderProviderPackages('reminder_sync');
      const reminders = rendered.packages.flatMap((pkg) => extractReminderItems(pkg)).slice(0, 8);
      if (reminders.length === 0) {
        throw new Error('当前没有需要同步的提醒项。');
      }

      const result = await bridgeClient.syncReminders({
        reminders,
      });
      await reportSyncJob(rendered, result, startedAt);
      if (result.error) {
        throw new Error(result.error);
      }
      setMode('success');
      setMessage('提醒同步完成');
      pushLog('success', `已同步 ${reminders.length} 条提醒到 Doubao 手机版对话`);
      await refresh();
    } catch (error) {
      const text = describeError(error, { includeMemoryServiceUrl: true });
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const syncQueryCard = async () => {
    setBusyAction('sync-query');
    const startedAt = Date.now();
    try {
      const rendered = await renderProviderPackages('query_answer', {
        query: queryText,
      });
      const queryPackage = rendered.packages[0];
      if (!queryPackage) {
        throw new Error('memory-service 没有生成查询答案卡。');
      }

      const result = await bridgeClient.injectQuery({
        query: queryText,
        answer: queryPackage.bodyMd,
        evidence: queryPackage.sourceRefs.map((source) => ({ source })),
      });
      await reportSyncJob(rendered, result, startedAt);
      if (result.error) {
        throw new Error(result.error);
      }
      setMode('success');
      setMessage('查询卡片已注入手机对话');
      pushLog('success', `已通过 memory-service 生成答案卡并注入 Doubao 手机版对话: ${queryText}`);
      await refresh();
    } catch (error) {
      const text = describeError(error, { includeMemoryServiceUrl: true });
      setMode('error');
      setMessage(text);
      pushLog('error', text);
    } finally {
      setBusyAction(null);
    }
  };

  const summary = useMemo(() => {
    const mappedBindings = status?.bindings
      ? bridgeBindingsToArray(status.bindings)
      : bindings;
    const memoryBinding = mappedBindings.find((item) => item.bindingType === 'memory_sync');
    const mobileBinding = mappedBindings.find((item) => item.bindingType === 'mobile_context');
    return {
      memoryBinding,
      mobileBinding,
      lastSyncAt: status?.lastSyncAt,
      authState: status?.authStatus || 'unknown',
      paired: status?.paired || false,
      browserRunning: status?.browserRunning || false,
      currentUrl: status?.currentUrl,
      memoryServiceBaseUrl: memoryClient.getBaseUrl(),
    };
  }, [bindings, memoryClient, status]);

  return (
    <div className="doubao-bridge-page">
      <div className="doubao-bridge-shell">
        <header className="hero">
          <div>
            <div className="eyebrow">Doubao Bridge</div>
            <h1>本机桥接器与豆包会话绑定</h1>
            <p>
              这条链路现在会走真实的 memory-service provider API。长期记忆走独立同步线程，临时重点和查询结果走你绑定的手机版对话线程。
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
                placeholder="http://127.0.0.1:46321"
              />
            </label>
            <label>
              <span>访问令牌</span>
              <input
                value={settings.bridgeToken || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, bridgeToken: e.target.value }))}
                placeholder="桥接器配对后自动写入"
              />
            </label>
            <div className="button-row">
              <button onClick={saveSettings} disabled={busyAction === 'save'}>
                {busyAction === 'save' ? '保存中...' : '保存设置'}
              </button>
              <button onClick={pairBridge} className="ghost" disabled={busyAction === 'pair'}>
                {busyAction === 'pair' ? '配对中...' : '重新配对'}
              </button>
              <button onClick={refresh} className="ghost">
                刷新状态
              </button>
            </div>
            <div className="hint">
              常驻的是桥接器进程，不是浏览器窗口。Playwright profile 只负责保存豆包登录态。
            </div>
          </div>

          <div className="card">
            <h2>状态总览</h2>
            <div className="stat-list">
              <Stat label="健康状态" value={health?.ok ? '可用' : '未连接'} />
              <Stat label="已配对" value={summary.paired ? '是' : '否'} />
              <Stat label="登录状态" value={summary.authState === 'connected' ? '已登录' : summary.authState} />
              <Stat label="浏览器实例" value={summary.browserRunning ? '运行中' : '未启动'} />
              <Stat
                label="Memory Service"
                value={memoryHealth?.status || (memoryHealthError ? '不可达' : '未知')}
              />
              <Stat label="长期记忆线程" value={summary.memoryBinding?.threadId ? '已绑定' : '未绑定'} />
              <Stat label="手机版对话" value={summary.mobileBinding?.threadId ? '已绑定' : '未绑定'} />
            </div>
            <div className="meta-grid">
              <Meta label="版本" value={health?.version || 'unknown'} />
              <Meta label="模式" value={health?.config?.headless ? 'headless' : 'windowed'} />
              <Meta label="最后同步" value={formatTime(summary.lastSyncAt)} />
              <Meta label="当前页面" value={summary.currentUrl || lastActiveTab.url || 'unknown'} />
              <Meta label="Memory URL" value={summary.memoryServiceBaseUrl} />
              <Meta label="Memory 错误" value={memoryHealthError || 'none'} />
            </div>
            <div className="button-row">
              <button onClick={openLogin} disabled={busyAction === 'login'}>
                {busyAction === 'login' ? '打开中...' : '打开登录窗口'}
              </button>
              <button onClick={openLogin} className="ghost" disabled={busyAction === 'login'}>
                重新登录
              </button>
            </div>
          </div>
        </section>

        <section className="panel grid-2">
          <div className="card">
            <h2>线程绑定</h2>
            <p className="card-desc">
              长期记忆同步线程只承接“请记住”类稳定信息；点击“绑定手机对话”后会先自动检索标题为“手机版对话”的线程，失败时再从所有已打开的 Doubao 聊天标签页里挑选最可能的目标绑定。
            </p>
            <div className="button-row">
              <button onClick={bindMemorySync} disabled={busyAction === 'bind-memory'}>
                {busyAction === 'bind-memory' ? '绑定中...' : '创建并绑定长期记忆线程'}
              </button>
              <button onClick={bindMobileContext} className="ghost" disabled={busyAction === 'bind-mobile'}>
                {busyAction === 'bind-mobile' ? '绑定中...' : '绑定手机对话'}
              </button>
            </div>
            <BindingBlock binding={summary.memoryBinding} title="长期记忆线程" />
            <BindingBlock binding={summary.mobileBinding} title="手机版对话" />
          </div>

          <div className="card">
            <h2>同步动作</h2>
            <p className="card-desc">
              这些按钮不再发送占位文本，而是先从 memory-service 渲染 provider context package，再发给本机 bridge，并回写 sync job 结果。
            </p>
            <div className="button-stack">
              <button onClick={syncPersona} disabled={busyAction === 'sync-persona'}>
                {busyAction === 'sync-persona' ? '同步中...' : '同步 persona_core / voice_mode'}
              </button>
              <button onClick={syncBriefing} disabled={busyAction === 'sync-briefing'}>
                {busyAction === 'sync-briefing' ? '同步中...' : '同步今日重点到手机版对话'}
              </button>
              <button onClick={syncReminder} disabled={busyAction === 'sync-reminder'}>
                {busyAction === 'sync-reminder' ? '同步中...' : '同步提醒到手机对话'}
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
                {busyAction === 'sync-query' ? '注入中...' : '查记忆并注入手机对话'}
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
              <li>面向最终用户的交付形态是 release pkg，而不是源码目录。</li>
              <li>安装完成后，打开 `/Applications/Doubao Bridge`。</li>
              <li>前台调试模式：双击 `Start Doubao Bridge.command`，不要关闭弹出的 Terminal 窗口。</li>
              <li>后台常驻模式：双击 `Install Background Sync.command`，之后即使关闭 Terminal 也会继续同步。</li>
              <li>停止与调试：用 `Stop Doubao Bridge.command` 停止进程，用 `Open Doubao Bridge Logs.command` 查看日志。</li>
              <li>第一次连接后，再点击“重新配对”和“打开登录窗口”，完成 Doubao 登录和会话绑定。</li>
            </ul>
            <p className="release-link">
              最终用户下载页：{' '}
              <a href={RELEASE_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                GitHub Releases
              </a>
            </p>
            <pre className="install-block">{`开发者打包:
cd doubao-bridge
npm install
npm run package:macos

最终用户使用:
1. 打开 GitHub Releases 下载页，下载 Doubao-Bridge-Installer.pkg
2. 安装后打开 /Applications/Doubao Bridge
3. 双击 Start Doubao Bridge.command 或 Install Background Sync.command
4. 如需让 bridge 后台自动从已运行的 memory-service 拉取记忆与上下文包，复制安装目录里的 bridge/.env.example 到:
   ~/Library/Application Support/PersonalAI/DoubaoBridge/.env`}</pre>
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
          margin: 0 0 14px;
          padding-left: 20px;
          color: #cbd5e1;
          line-height: 1.7;
        }

        .release-link {
          margin: 0 0 14px;
          color: #cbd5e1;
          line-height: 1.7;
        }

        .release-link a {
          color: #fbbf24;
          text-decoration: none;
          font-weight: 600;
        }

        .release-link a:hover {
          text-decoration: underline;
        }

        .install-block {
          margin: 0;
          padding: 14px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.14);
          overflow: auto;
          color: #f8fafc;
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
        <span>thread url</span>
        <span>{binding?.threadUrl || 'unknown'}</span>
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
