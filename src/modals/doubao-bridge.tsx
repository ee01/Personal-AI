import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  DoubaoBridgeClient,
  type DoubaoBridgeHealth,
  type DoubaoBridgeStatus,
} from '../services/DoubaoBridgeClient';

type PanelMode = 'idle' | 'loading' | 'success' | 'error';

const RELEASE_DOWNLOAD_URL = 'https://github.com/ee01/personal-ai/releases/latest';
const APP_HINT = '在 Applications 中打开 “Doubao Bridge.app” 完成登录、线程绑定和 Memory Service 配置。后台同步默认开启，关闭窗口即可继续运行。';

const formatTime = (value?: string | number) => {
  if (!value) return '未发生';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`checkpoint ${ok ? 'checkpoint-ok' : 'checkpoint-warn'}`}>
      <span className="checkpoint-dot" />
      <span>{label}</span>
    </div>
  );
}

export const DoubaoBridgePanel: React.FC = () => {
  const [bridgeClient] = useState(() => new DoubaoBridgeClient());
  const [health, setHealth] = useState<DoubaoBridgeHealth | null>(null);
  const [status, setStatus] = useState<DoubaoBridgeStatus | null>(null);
  const [mode, setMode] = useState<PanelMode>('idle');
  const [message, setMessage] = useState('正在检查本机 Doubao Bridge...');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setMode('loading');
    try {
      await bridgeClient.loadSettings();
      const [healthResult, statusResult] = await Promise.all([
        bridgeClient.getHealth(),
        bridgeClient.getStatus(),
      ]);
      setHealth(healthResult);
      setStatus(statusResult);
      setMode('success');
      setMessage(statusResult.browserRunning ? 'Doubao Bridge 正在运行' : 'Doubao Bridge 已连接，但后台未运行');
    } catch (error) {
      setHealth(null);
      setStatus(null);
      setMode('error');
      setMessage(error instanceof Error ? error.message : '无法连接 Doubao Bridge');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, []);

  const checklist = useMemo(() => {
    const source = status?.setupChecklist;
    return [
      {
        key: 'memory',
        label: 'Memory Service 已连接',
        ok: Boolean(source?.memoryServiceConfigured),
      },
      {
        key: 'login',
        label: '豆包已登录',
        ok: Boolean(source?.doubaoConnected),
      },
      {
        key: 'memory-thread',
        label: '长期记忆线程已绑定',
        ok: Boolean(source?.memorySyncBound),
      },
      {
        key: 'mobile-thread',
        label: '手机对话已绑定',
        ok: Boolean(source?.mobileContextBound),
      },
      {
        key: 'auto-sync',
        label: '后台同步已运行',
        ok: Boolean(status?.syncState?.timerActive),
      },
    ];
  }, [status]);

  const summaryItems = [
    ['Bridge 版本', status?.appVersion || health?.version || '-'],
    ['服务状态', health?.ok ? '可用' : '未连接'],
    ['后台同步', status?.syncState?.timerActive ? '运行中' : '未启动'],
    ['最近同步', formatTime(status?.lastSyncAt)],
    ['当前页面', status?.currentUrl || '未知'],
    ['后台同步', status?.syncState?.timerActive ? '运行中' : '待就绪'],
  ];

  return (
    <div className="doubao-bridge-page">
      <div className="doubao-bridge-shell">
        <header className="hero">
          <div>
            <div className="eyebrow">Doubao Bridge</div>
            <h1>安装引导与服务状态</h1>
            <p>
              Chrome extension 中的这个页面现在只负责检测本机服务、提示缺失步骤，并引导你去
              `Doubao Bridge.app` 中完成真实配置。
            </p>
          </div>
          <div className={`hero-status hero-status-${mode}`}>
            <span className="hero-dot" />
            {message}
          </div>
        </header>

        <section className="panel grid-2">
          <div className="card">
            <h2>下一步</h2>
            <ol className="guide-list">
              <li>下载并安装最新的 `Doubao Bridge.pkg`。</li>
              <li>在 Applications 中打开 `Doubao Bridge.app`。</li>
              <li>在 app 内完成 Memory Service、豆包登录和线程绑定配置。</li>
              <li>关闭 app 窗口后回到这里，确认后台服务已经开始运行。</li>
            </ol>
            <div className="action-row">
              <a className="button-link" href={RELEASE_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                下载最新安装包
              </a>
              <button onClick={() => void refresh()} disabled={busy}>
                刷新状态
              </button>
            </div>
            <p className="helper-text">{APP_HINT}</p>
          </div>

          <div className="card">
            <h2>当前状态</h2>
            <div className="summary-grid">
              {summaryItems.map(([label, value]) => (
                <div className="summary-item" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel grid-2">
          <div className="card">
            <h2>就绪检查</h2>
            <div className="checkpoint-list">
              {checklist.map((item) => (
                <StatusBadge key={item.key} ok={item.ok} label={item.label} />
              ))}
            </div>
          </div>

          <div className="card">
            <h2>当前阻塞原因</h2>
            {status?.blockingReasons?.length ? (
              <div className="reason-list">
                {status.blockingReasons.map((reason) => (
                  <div className="reason-pill" key={reason.code}>
                    <strong>{reason.message}</strong>
                    <span>{reason.syncKinds.join(' / ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reason-pill success-pill">当前没有检测到阻塞项，自动同步应该已经可用。</div>
            )}
          </div>
        </section>

        <section className="card">
          <h2>说明</h2>
          <ul className="guide-list">
              <li>这个 extension 页面不再配置 bridge 地址、token 或自动同步开关。</li>
              <li>Bridge 默认固定运行在 `http://127.0.0.1:46321`，由 app 自动管理。</li>
              <li>真正的登录、线程绑定和同步节奏调整，都应该在 `Doubao Bridge.app` 中完成；后台同步默认开启。</li>
            </ul>
          </section>
      </div>

      <style>{`
        .doubao-bridge-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(204, 116, 59, 0.18), transparent 30%),
            radial-gradient(circle at top right, rgba(45, 119, 73, 0.14), transparent 24%),
            linear-gradient(180deg, #f8f2e8 0%, #f0e7d9 100%);
          color: #1c1f22;
          font-family: "SF Pro Display", "PingFang SC", "Noto Sans SC", sans-serif;
        }

        .doubao-bridge-shell {
          max-width: 1080px;
          margin: 0 auto;
          padding: 28px 24px 36px;
        }

        .hero,
        .card {
          background: rgba(255, 250, 244, 0.92);
          border: 1px solid rgba(28, 31, 34, 0.08);
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(75, 55, 28, 0.08);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 28px;
        }

        .eyebrow {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #b25126;
        }

        h1 {
          margin: 8px 0 0;
          font-size: 36px;
          line-height: 1.1;
        }

        h2 {
          margin: 0 0 14px;
          font-size: 22px;
        }

        p,
        li,
        span {
          line-height: 1.6;
        }

        .hero-status {
          min-width: 220px;
          align-self: flex-start;
          padding: 14px 16px;
          border-radius: 18px;
          font-weight: 600;
        }

        .hero-status-loading,
        .hero-status-idle {
          background: rgba(31, 35, 39, 0.07);
        }

        .hero-status-success {
          background: rgba(43, 125, 69, 0.12);
          color: #1d6a3f;
        }

        .hero-status-error {
          background: rgba(163, 50, 39, 0.12);
          color: #9b2f24;
        }

        .hero-dot,
        .checkpoint-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-right: 8px;
          background: currentColor;
        }

        .panel {
          margin-top: 18px;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .card {
          padding: 22px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .summary-item {
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(28, 31, 34, 0.08);
          display: grid;
          gap: 4px;
        }

        .summary-item span {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(28, 31, 34, 0.58);
        }

        .checkpoint-list,
        .reason-list,
        .guide-list {
          display: grid;
          gap: 10px;
          padding-left: 18px;
        }

        .checkpoint {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(28, 31, 34, 0.08);
        }

        .checkpoint-ok {
          color: #1f6a42;
        }

        .checkpoint-warn {
          color: #87580d;
        }

        .reason-pill {
          display: grid;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(28, 31, 34, 0.08);
        }

        .success-pill {
          color: #1f6a42;
        }

        .action-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        button,
        .button-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 999px;
          padding: 12px 18px;
          background: #b25126;
          color: #fff;
          font: inherit;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .helper-text {
          margin-top: 14px;
          color: rgba(28, 31, 34, 0.7);
        }

        @media (max-width: 880px) {
          .hero,
          .grid-2,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};
