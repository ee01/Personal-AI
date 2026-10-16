import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getMemoryServiceClient } from '../services/MemoryServiceClient';
import type {
  MemoryBackupStatusResponse,
  MemoryMirrorPreviewResponse,
  MemoryMirrorStatusResponse,
  RuntimeConfigResponse,
  UpdateRuntimeConfigPayload,
} from '../services/MemoryServiceClient';
import { DesktopAppClient } from '../services/DesktopAppClient';

const DESKTOP_RELEASES_URL =
  'https://github.com/ee01/Personal-AI/releases?q=desktop-v';
const DESKTOP_BACKUP_LINK = 'personal-ai://settings/backup';

type ChannelTab = 'webdav' | 's3' | 'local' | 'github';

type Draft = {
  autoBackupEnabled: boolean;
  autoBackupScheduleType: 'daily' | 'every_x_hours' | 'weekly';
  autoBackupPreferredHour: number;
  autoBackupIntervalHours: number;
  autoBackupProvider: 'webdav' | 's3';
  autoBackupWebdavUrl: string;
  autoBackupWebdavUsername: string;
  autoBackupWebdavPassword: string;
  clearAutoBackupWebdavPassword: boolean;
  autoBackupS3Endpoint: string;
  autoBackupS3Region: string;
  autoBackupS3Bucket: string;
  autoBackupS3AccessKeyId: string;
  autoBackupS3SecretAccessKey: string;
  clearAutoBackupS3AccessKeyId: boolean;
  clearAutoBackupS3SecretAccessKey: boolean;
  autoBackupPrefix: string;
  autoBackupEncryptionEnabled: boolean;
  autoBackupEncryptionPassphrase: string;
  clearAutoBackupEncryptionPassphrase: boolean;
  autoBackupRetentionCount: number;
  autoBackupIncludeVectors: boolean;
  autoBackupGithubEnabled: boolean;
  autoBackupGithubRepo: string;
  autoBackupGithubBranch: string;
  autoBackupGithubToken: string;
  autoBackupGithubMode: 'markdown' | 'encrypted';
  autoBackupGithubScope: 'all' | 'self_only';
  autoBackupGithubPrefix: string;
  clearAutoBackupGithubToken: boolean;
  webdavPasswordConfigured: boolean;
  s3AccessConfigured: boolean;
  s3SecretConfigured: boolean;
  passphraseConfigured: boolean;
  githubTokenConfigured: boolean;
};

const emptyDraft = (): Draft => ({
  autoBackupEnabled: false,
  autoBackupScheduleType: 'daily',
  autoBackupPreferredHour: 3,
  autoBackupIntervalHours: 24,
  autoBackupProvider: 'webdav',
  autoBackupWebdavUrl: '',
  autoBackupWebdavUsername: '',
  autoBackupWebdavPassword: '',
  clearAutoBackupWebdavPassword: false,
  autoBackupS3Endpoint: '',
  autoBackupS3Region: 'auto',
  autoBackupS3Bucket: '',
  autoBackupS3AccessKeyId: '',
  autoBackupS3SecretAccessKey: '',
  clearAutoBackupS3AccessKeyId: false,
  clearAutoBackupS3SecretAccessKey: false,
  autoBackupPrefix: 'personal-ai-backups',
  autoBackupEncryptionEnabled: true,
  autoBackupEncryptionPassphrase: '',
  clearAutoBackupEncryptionPassphrase: false,
  autoBackupRetentionCount: 7,
  autoBackupIncludeVectors: true,
  autoBackupGithubEnabled: false,
  autoBackupGithubRepo: '',
  autoBackupGithubBranch: 'main',
  autoBackupGithubToken: '',
  autoBackupGithubMode: 'markdown',
  autoBackupGithubScope: 'all',
  autoBackupGithubPrefix: '',
  clearAutoBackupGithubToken: false,
  webdavPasswordConfigured: false,
  s3AccessConfigured: false,
  s3SecretConfigured: false,
  passphraseConfigured: false,
  githubTokenConfigured: false,
});

function draftFromConfig(config: RuntimeConfigResponse): Draft {
  return {
    ...emptyDraft(),
    autoBackupEnabled: Boolean(config.autoBackupEnabled),
    autoBackupScheduleType: config.autoBackupScheduleType || 'daily',
    autoBackupPreferredHour: Number(config.autoBackupPreferredHour) || 3,
    autoBackupIntervalHours: Number(config.autoBackupIntervalHours) || 24,
    autoBackupProvider: config.autoBackupProvider === 's3' ? 's3' : 'webdav',
    autoBackupWebdavUrl: config.autoBackupWebdavUrl || '',
    autoBackupWebdavUsername: config.autoBackupWebdavUsername || '',
    autoBackupS3Endpoint: config.autoBackupS3Endpoint || '',
    autoBackupS3Region: config.autoBackupS3Region || 'auto',
    autoBackupS3Bucket: config.autoBackupS3Bucket || '',
    autoBackupPrefix: config.autoBackupPrefix || 'personal-ai-backups',
    autoBackupEncryptionEnabled: config.autoBackupEncryptionEnabled !== false,
    autoBackupRetentionCount: Number(config.autoBackupRetentionCount) || 7,
    autoBackupIncludeVectors: config.autoBackupIncludeVectors !== false,
    autoBackupGithubEnabled: Boolean(config.autoBackupGithubEnabled),
    autoBackupGithubRepo: config.autoBackupGithubRepo || '',
    autoBackupGithubBranch: config.autoBackupGithubBranch || 'main',
    autoBackupGithubMode:
      config.autoBackupGithubMode === 'encrypted' ? 'encrypted' : 'markdown',
    autoBackupGithubScope:
      config.autoBackupGithubScope === 'self_only' ? 'self_only' : 'all',
    autoBackupGithubPrefix: config.autoBackupGithubPrefix || '',
    webdavPasswordConfigured: Boolean(config.autoBackupWebdavPasswordConfigured),
    s3AccessConfigured: Boolean(config.autoBackupS3AccessKeyIdConfigured),
    s3SecretConfigured: Boolean(config.autoBackupS3SecretAccessKeyConfigured),
    passphraseConfigured: Boolean(config.autoBackupEncryptionPassphraseConfigured),
    githubTokenConfigured: Boolean(config.autoBackupGithubTokenConfigured),
  };
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function AutoBackupSettings(): React.ReactElement {
  return (
    <AutoBackupErrorBoundary>
      <AutoBackupSettingsForm />
    </AutoBackupErrorBoundary>
  );
}

class AutoBackupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: string } {
    return { error: error.message || String(error) };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="form-section" style={{ marginTop: 24 }}>
          <h2>自动备份</h2>
          <p style={{ color: '#b42318', fontSize: 13 }}>
            配置区未能加载：{this.state.error}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function AutoBackupSettingsForm(): React.ReactElement {
  const [tab, setTab] = useState<ChannelTab>('webdav');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [status, setStatus] = useState<MemoryBackupStatusResponse | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [desktopInstalled, setDesktopInstalled] = useState<boolean | null>(null);
  const [mirrorStatus, setMirrorStatus] = useState<MemoryMirrorStatusResponse | null>(null);
  const [mirrorPreview, setMirrorPreview] = useState<MemoryMirrorPreviewResponse | null>(null);
  const [mirrorUnsupported, setMirrorUnsupported] = useState(false);
  // Once the user picks a tab this session, keep it across reloads (saves,
  // refreshes) instead of snapping back to the object-storage provider tab.
  const tabTouched = React.useRef(false);

  const load = useCallback(async (alive?: () => boolean) => {
    const client = getMemoryServiceClient();
    const mirrorPromise = client
      .getMirrorStatus()
      .then((value) => {
        setMirrorUnsupported(false);
        return value;
      })
      .catch((error: unknown) => {
        // 404 means the deployed memory-service predates the mirror channel;
        // in that case the server also strips the github config fields on save.
        const status =
          typeof error === 'object' && error && 'status' in error
            ? Number((error as { status?: number }).status)
            : 0;
        if (status === 404 || status === 501) setMirrorUnsupported(true);
        return null;
      });
    const [config, backupStatus, mirror] = await Promise.all([
      client.getRuntimeConfig(),
      client.getBackupStatus().catch(() => null),
      mirrorPromise,
    ]);
    if (alive && !alive()) return;
    setDraft(draftFromConfig(config));
    setStatus(backupStatus);
    setMirrorStatus(mirror);
    setTab((current) => {
      if (tabTouched.current) return current;
      if (config.autoBackupGithubEnabled) return 'github';
      return config.autoBackupProvider === 's3' ? 's3' : 'webdav';
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const desktop = new DesktopAppClient();
    void load(() => !cancelled).catch((error) => {
      if (!cancelled) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
    void desktop
      .getHealth()
      .then((health) => {
        if (!cancelled) setDesktopInstalled(Boolean(health?.ok));
      })
      .catch(() => {
        if (!cancelled) setDesktopInstalled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const patch = (partial: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...partial }));

  const savePayload = (): UpdateRuntimeConfigPayload => ({
    autoBackupEnabled: draft.autoBackupEnabled,
    autoBackupScheduleType: draft.autoBackupScheduleType,
    autoBackupPreferredHour: draft.autoBackupPreferredHour,
    autoBackupIntervalHours: draft.autoBackupIntervalHours,
    autoBackupProvider: tab === 's3' ? 's3' : tab === 'webdav' ? 'webdav' : draft.autoBackupProvider,
    autoBackupWebdavUrl: draft.autoBackupWebdavUrl,
    autoBackupWebdavUsername: draft.autoBackupWebdavUsername,
    autoBackupWebdavPassword: draft.autoBackupWebdavPassword || undefined,
    clearAutoBackupWebdavPassword: draft.clearAutoBackupWebdavPassword,
    autoBackupS3Endpoint: draft.autoBackupS3Endpoint,
    autoBackupS3Region: draft.autoBackupS3Region,
    autoBackupS3Bucket: draft.autoBackupS3Bucket,
    autoBackupS3AccessKeyId: draft.autoBackupS3AccessKeyId || undefined,
    autoBackupS3SecretAccessKey: draft.autoBackupS3SecretAccessKey || undefined,
    clearAutoBackupS3AccessKeyId: draft.clearAutoBackupS3AccessKeyId,
    clearAutoBackupS3SecretAccessKey: draft.clearAutoBackupS3SecretAccessKey,
    autoBackupPrefix: draft.autoBackupPrefix,
    autoBackupEncryptionEnabled: draft.autoBackupEncryptionEnabled,
    autoBackupEncryptionPassphrase:
      draft.autoBackupEncryptionPassphrase || undefined,
    clearAutoBackupEncryptionPassphrase: draft.clearAutoBackupEncryptionPassphrase,
    autoBackupRetentionCount: draft.autoBackupRetentionCount,
    autoBackupIncludeVectors: draft.autoBackupIncludeVectors,
    autoBackupGithubEnabled: draft.autoBackupGithubEnabled,
    autoBackupGithubRepo: draft.autoBackupGithubRepo,
    autoBackupGithubBranch: draft.autoBackupGithubBranch,
    autoBackupGithubToken: draft.autoBackupGithubToken || undefined,
    autoBackupGithubMode: draft.autoBackupGithubMode,
    autoBackupGithubScope: draft.autoBackupGithubScope,
    autoBackupGithubPrefix: draft.autoBackupGithubPrefix,
    clearAutoBackupGithubToken: draft.clearAutoBackupGithubToken,
  });

  const save = async () => {
    if (!draft.autoBackupEncryptionEnabled) {
      const confirmed = window.confirm(
        '已关闭加密：备份中的 config.json 含 API 密钥明文，将暴露给远端存储。确定继续？',
      );
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await getMemoryServiceClient().updateRuntimeConfig(savePayload());
      await load();
      setMessage('自动备份配置已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setBusy(true);
    try {
      await getMemoryServiceClient().updateRuntimeConfig(savePayload());
      const result = await getMemoryServiceClient().testBackupConnection();
      setMessage(result.detail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      await getMemoryServiceClient().updateRuntimeConfig(savePayload());
      const result = await getMemoryServiceClient().runAutoBackup();
      setMessage(
        result.status === 'success'
          ? `备份完成 ${formatBytes(result.sizeBytes)}`
          : result.error || result.status,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const lastPull = useMemo(
    () => status?.history.find((item) => item.channel === 'desktop_pull'),
    [status],
  );

  const persistMirror = async () => {
    await getMemoryServiceClient().updateRuntimeConfig(savePayload());
  };

  const testMirror = async () => {
    setBusy(true);
    try {
      await persistMirror();
      const result = await getMemoryServiceClient().testMirrorConnection();
      setMessage(result.detail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const previewMirror = async () => {
    setBusy(true);
    try {
      await persistMirror();
      const result = await getMemoryServiceClient().previewMirror();
      setMirrorPreview(result);
      setMessage(`将推送 ${result.files.length} 个文件`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const runMirror = async () => {
    setBusy(true);
    try {
      await persistMirror();
      const result = await getMemoryServiceClient().runMirror();
      setMessage(
        result.status === 'success'
          ? `镜像完成，变更 ${result.filesChanged} 个文件`
          : result.status === 'skipped'
            ? '没有变更，跳过 commit'
            : result.error || '镜像失败',
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const openDesktop = () => {
    window.location.href = DESKTOP_BACKUP_LINK;
    setTimeout(() => {
      if (desktopInstalled === false) {
        window.open(DESKTOP_RELEASES_URL, '_blank', 'noreferrer');
      }
    }, 600);
  };

  return (
    <div className="form-section" style={{ marginTop: 24 }}>
      <h2>自动备份</h2>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
        服务端按周期把加密快照推到 WebDAV / S3。状态看 Coverage 页；个人电脑拉取在桌面端配置。
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ minWidth: 110, color: '#666' }}>自动备份</label>
        <input
          type="checkbox"
          checked={draft.autoBackupEnabled}
          onChange={(event) => patch({ autoBackupEnabled: event.target.checked })}
        />
        <span style={{ color: '#888', fontSize: 12 }}>关闭后调度器会跳过该用户</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['webdav', 's3', 'local', 'github'] as ChannelTab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'primary' : undefined}
            onClick={() => {
              tabTouched.current = true;
              setTab(item);
              if (item === 's3' || item === 'webdav') {
                patch({ autoBackupProvider: item });
              }
            }}
          >
            {item === 'webdav'
              ? 'WebDAV 推送'
              : item === 's3'
                ? 'S3 兼容推送'
                : item === 'local'
                  ? '个人电脑拉取'
                  : 'GitHub 镜像'}
          </button>
        ))}
      </div>

      {tab === 'local' ? (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#fafbfc',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            此通道在 desktop-app 中配置，这里只做引导
          </div>
          <p style={{ color: '#666', fontSize: 13 }}>
            桌面端用已有服务地址 + 设备密钥定时把备份拉回本机（outbound HTTPS）。Mac
            不开任何入站端口。建议保存到 iCloud Drive。
          </p>
          <ol style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li>
              安装 Personal AI 桌面端{' '}
              <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">
                下载 ↗
              </a>
            </li>
            <li>桌面端已连接本服务（与插件同账号）</li>
            <li>在桌面端 设置 → 自动备份拉取 里配置周期、目录与保留份数</li>
          </ol>
          <button type="button" onClick={openDesktop}>
            在 desktop-app 中配置 ↗
          </button>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            拉取状态：{' '}
            {lastPull
              ? `${lastPull.at.slice(0, 16).replace('T', ' ')} · ${
                  lastPull.deviceName || '桌面端'
                } · ${lastPull.status === 'success' ? '成功' : '失败'} ${formatBytes(
                  lastPull.sizeBytes,
                )}`
              : '尚未配置'}
          </div>
        </div>
      ) : tab === 'github' ? (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ minWidth: 110, color: '#666' }}>GitHub 镜像</label>
            <input
              type="checkbox"
              checked={draft.autoBackupGithubEnabled}
              onChange={(event) =>
                patch({ autoBackupGithubEnabled: event.target.checked })
              }
            />
            <span style={{ color: '#888', fontSize: 12 }}>
              每晚巩固后把 Markdown 投影提交一次
            </span>
          </div>
          <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
            只推送投影（画像 / entities / knowledge / timeline / DIARY / interop），
            <strong>不含原文、SQLite、config.json</strong>。本地 Markdown 是视图不是真源；
            全量恢复仍走加密 zip。
          </p>
          {mirrorUnsupported ? (
            <p
              style={{
                color: '#b42318',
                fontSize: 13,
                border: '1px solid #f04438',
                borderRadius: 6,
                padding: 10,
                background: '#fef3f2',
              }}
            >
              当前连接的 Memory Service 还没有部署「GitHub 镜像」通道（接口 404）。
              在服务端升级之前，「测试连接」会一直 404，而且这里保存的镜像配置不会被服务端接受——旧服务会把未知的镜像字段直接丢弃，所以刷新后会消失。请先部署服务端，再回来填写。
            </p>
          ) : null}
          <div className="form-group">
            <label>仓库（owner/name）</label>
            <input
              type="text"
              value={draft.autoBackupGithubRepo}
              placeholder="esone/memory-mirror"
              onChange={(event) => patch({ autoBackupGithubRepo: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label>分支</label>
            <input
              type="text"
              value={draft.autoBackupGithubBranch}
              onChange={(event) => patch({ autoBackupGithubBranch: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Fine-grained token（仅该仓库 Contents: Read and write）</label>
            <input
              type="password"
              value={draft.autoBackupGithubToken}
              placeholder={draft.githubTokenConfigured ? '已配置（不回显）' : ''}
              onChange={(event) =>
                patch({
                  autoBackupGithubToken: event.target.value,
                  clearAutoBackupGithubToken: false,
                })
              }
            />
            {draft.githubTokenConfigured ? (
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={draft.clearAutoBackupGithubToken}
                  onChange={(event) =>
                    patch({ clearAutoBackupGithubToken: event.target.checked })
                  }
                />{' '}
                清除已保存的 token
              </label>
            ) : null}
          </div>
          <div className="form-group">
            <label>模式</label>
            <select
              value={draft.autoBackupGithubMode}
              onChange={(event) =>
                patch({
                  autoBackupGithubMode: event.target.value as Draft['autoBackupGithubMode'],
                })
              }
            >
              <option value="markdown">可读 Markdown</option>
              <option value="encrypted">加密包（.zip.enc）</option>
            </select>
          </div>
          <div className="form-group">
            <label>范围</label>
            <select
              value={draft.autoBackupGithubScope}
              onChange={(event) =>
                patch({
                  autoBackupGithubScope: event.target.value as Draft['autoBackupGithubScope'],
                })
              }
            >
              <option value="all">全部已确认内容</option>
              <option value="self_only">只镜像关于我的内容</option>
            </select>
          </div>
          <div className="form-group">
            <label>仓库内子目录（可选）</label>
            <input
              type="text"
              value={draft.autoBackupGithubPrefix}
              placeholder="mirror"
              onChange={(event) => patch({ autoBackupGithubPrefix: event.target.value })}
            />
          </div>
          {draft.autoBackupGithubMode === 'encrypted' && !draft.passphraseConfigured ? (
            <p style={{ color: '#b42318', fontSize: 13 }}>
              加密包模式需要先在下方配置加密口令。
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" onClick={save} disabled={busy}>
              保存
            </button>
            <button type="button" onClick={testMirror} disabled={busy}>
              测试连接
            </button>
            <button type="button" onClick={previewMirror} disabled={busy}>
              预览推送清单
            </button>
            <button type="button" className="primary" onClick={runMirror} disabled={busy}>
              立即镜像一次
            </button>
          </div>
          {mirrorStatus?.lastRun ? (
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
              <div>
                上次运行：{new Date(mirrorStatus.lastRun.startedAt * 1000)
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ')}{' '}
                · {mirrorStatus.lastRun.status} · 变更 {mirrorStatus.lastRun.filesChanged} / 共{' '}
                {mirrorStatus.lastRun.filesTotal} · 被过滤{' '}
                {mirrorStatus.lastRun.excludedByPolicy}
              </div>
              {mirrorStatus.lastRun.commitUrl ? (
                <div>
                  上次 commit：
                  <a href={mirrorStatus.lastRun.commitUrl} target="_blank" rel="noreferrer">
                    {mirrorStatus.lastRun.commitSha?.slice(0, 7)} ↗
                  </a>
                </div>
              ) : null}
              {mirrorStatus.lastRun.conflictPaths.length > 0 ? (
                <div style={{ color: '#b54708' }}>
                  远端手改 {mirrorStatus.lastRun.conflictPaths.length} 个文件，已保留并在
                  conflict-&lt;date&gt;/ 存档，未覆盖。
                </div>
              ) : null}
              {mirrorStatus.lastRun.error ? (
                <div style={{ color: '#b42318' }}>{mirrorStatus.lastRun.error}</div>
              ) : null}
            </div>
          ) : null}
          {mirrorPreview ? (
            <div
              style={{
                marginTop: 12,
                maxHeight: 220,
                overflow: 'auto',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: 10,
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {mirrorPreview.files.map((file) => (
                <div key={file.path}>
                  {file.path} · {formatBytes(file.bytes)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>备份周期</label>
            <select
              value={draft.autoBackupScheduleType}
              onChange={(event) =>
                patch({
                  autoBackupScheduleType: event.target.value as Draft['autoBackupScheduleType'],
                })
              }
            >
              <option value="daily">每天（指定小时）</option>
              <option value="every_x_hours">每 N 小时</option>
              <option value="weekly">每周</option>
            </select>
          </div>
          {draft.autoBackupScheduleType === 'every_x_hours' ? (
            <div className="form-group">
              <label>间隔小时</label>
              <input
                type="number"
                min={1}
                value={draft.autoBackupIntervalHours}
                onChange={(event) =>
                  patch({ autoBackupIntervalHours: Number(event.target.value) || 1 })
                }
              />
            </div>
          ) : (
            <div className="form-group">
              <label>首选小时（0-23）</label>
              <input
                type="number"
                min={0}
                max={23}
                value={draft.autoBackupPreferredHour}
                onChange={(event) =>
                  patch({ autoBackupPreferredHour: Number(event.target.value) || 0 })
                }
              />
            </div>
          )}

          {tab === 'webdav' ? (
            <>
              <div className="form-group">
                <label>WebDAV 地址</label>
                <input
                  type="url"
                  value={draft.autoBackupWebdavUrl}
                  onChange={(event) => patch({ autoBackupWebdavUrl: event.target.value })}
                  placeholder="https://dav.jianguoyun.com/dav/personal-ai/"
                />
              </div>
              <div className="form-group">
                <label>用户名</label>
                <input
                  type="text"
                  value={draft.autoBackupWebdavUsername}
                  onChange={(event) =>
                    patch({ autoBackupWebdavUsername: event.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>密码（应用密码）</label>
                <input
                  type="password"
                  value={draft.autoBackupWebdavPassword}
                  placeholder={
                    draft.webdavPasswordConfigured ? '已配置，留空保持不变' : '未配置'
                  }
                  onChange={(event) =>
                    patch({
                      autoBackupWebdavPassword: event.target.value,
                      clearAutoBackupWebdavPassword: false,
                    })
                  }
                />
                {draft.webdavPasswordConfigured ? (
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        clearAutoBackupWebdavPassword: true,
                        autoBackupWebdavPassword: '',
                        webdavPasswordConfigured: false,
                      })
                    }
                  >
                    清除
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Endpoint</label>
                <input
                  type="url"
                  value={draft.autoBackupS3Endpoint}
                  onChange={(event) => patch({ autoBackupS3Endpoint: event.target.value })}
                  placeholder="https://<accountid>.r2.cloudflarestorage.com"
                />
              </div>
              <div className="form-group">
                <label>Region</label>
                <input
                  type="text"
                  value={draft.autoBackupS3Region}
                  onChange={(event) => patch({ autoBackupS3Region: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Bucket</label>
                <input
                  type="text"
                  value={draft.autoBackupS3Bucket}
                  onChange={(event) => patch({ autoBackupS3Bucket: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Access Key ID</label>
                <input
                  type="text"
                  value={draft.autoBackupS3AccessKeyId}
                  placeholder={draft.s3AccessConfigured ? '已配置，留空保持不变' : ''}
                  onChange={(event) =>
                    patch({ autoBackupS3AccessKeyId: event.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Secret Key</label>
                <input
                  type="password"
                  value={draft.autoBackupS3SecretAccessKey}
                  placeholder={draft.s3SecretConfigured ? '已配置，留空保持不变' : '未配置'}
                  onChange={(event) =>
                    patch({ autoBackupS3SecretAccessKey: event.target.value })
                  }
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>端到端加密</label>
            <input
              type="checkbox"
              checked={draft.autoBackupEncryptionEnabled}
              onChange={(event) =>
                patch({ autoBackupEncryptionEnabled: event.target.checked })
              }
            />
            {draft.autoBackupEncryptionEnabled ? (
              <>
                <input
                  type="password"
                  value={draft.autoBackupEncryptionPassphrase}
                  placeholder={
                    draft.passphraseConfigured
                      ? '已配置，留空保持不变'
                      : '加密口令（scrypt → AES-256-GCM）'
                  }
                  onChange={(event) =>
                    patch({ autoBackupEncryptionPassphrase: event.target.value })
                  }
                  style={{ marginLeft: 8, minWidth: 240 }}
                />
                <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>
                  请抄写保存口令：口令丢失 = 备份不可恢复。更换口令只影响之后的备份。
                </div>
              </>
            ) : (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                已关闭加密：备份中的 config.json 含 OpenClaw / RingCentral / Bot 等 API
                密钥明文。仅建议在完全私有的存储上关闭。
              </div>
            )}
          </div>

          <div className="form-group">
            <label>保留最近份数</label>
            <input
              type="number"
              min={1}
              value={draft.autoBackupRetentionCount}
              onChange={(event) =>
                patch({ autoBackupRetentionCount: Number(event.target.value) || 1 })
              }
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={draft.autoBackupIncludeVectors}
                onChange={(event) =>
                  patch({ autoBackupIncludeVectors: event.target.checked })
                }
              />{' '}
              包含向量索引（关闭 = slim，体积更小，恢复后需回填）
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={() => void save()}>
              保存配置
            </button>
            <button type="button" disabled={busy} onClick={() => void testConnection()}>
              测试连接
            </button>
            <button type="button" disabled={busy} onClick={() => void runNow()}>
              立即备份
            </button>
          </div>
        </>
      )}

      {status ? (
        <p style={{ fontSize: 13, color: '#555', marginTop: 14 }}>
          上次备份：{status.lastBackup?.at?.replace('T', ' ').slice(0, 16) || '尚无'} ·
          下次预计：{status.nextEstimatedAt?.replace('T', ' ').slice(0, 16) || '—'} ·
          连续失败：{status.consecutiveFailures}
          {' · '}
          <a href="/memory-exploring.html#/coverage">查看 Coverage 状态中心</a>
        </p>
      ) : null}
      {message ? (
        <p style={{ fontSize: 13, color: '#1d4ed8', marginTop: 8 }}>{message}</p>
      ) : null}
    </div>
  );
}
