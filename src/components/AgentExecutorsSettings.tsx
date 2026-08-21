import React, { useEffect, useMemo, useState } from 'react';

import { getMemoryServiceClient } from '../services/MemoryServiceClient';
import { DesktopAppClient } from '../services/DesktopAppClient';
import { ToggleField } from './ToggleField';

export type AgentExecutorTypeOption =
  | 'openclaw-responses'
  | 'openclaw-gateway'
  | 'acp-codex'
  | 'acp-claude-code';

export type AgentExecutorDraft = {
  id: string;
  label: string;
  type: AgentExecutorTypeOption;
  baseUrl?: string;
  apiKey?: string;
  cwd?: string;
  runtime?: 'local' | 'remote';
  workerId?: string;
  /** Kept for API compatibility; listed executors are always treated as available. */
  enabled?: boolean;
  apiKeyConfigured?: boolean;
  clearApiKey?: boolean;
};

export type ExecutorDefaultsDraft = {
  agent_task: string;
  reflection_research: string;
};

type ProbeChip = {
  ok: boolean;
  stage: string;
  detail: string;
  nextAction?: string;
  cached?: boolean;
  at: number;
};

type WorkerOption = {
  id: string;
  label: string;
  status: string;
  hostKind?: string;
  hostname?: string;
};

type Props = {
  executors: AgentExecutorDraft[];
  defaults: ExecutorDefaultsDraft;
  /** Master switch: reflection / 联动 external delegation. Does not affect Agent Task. */
  externalDelegationEnabled: boolean;
  openClawTimeoutMs: number;
  openClawApiKeyConfigured: boolean;
  minOpenClawTimeoutSeconds: number;
  highlighted?: boolean;
  sectionRef?: React.Ref<HTMLDivElement>;
  onChange: (next: {
    executors: AgentExecutorDraft[];
    defaults: ExecutorDefaultsDraft;
    openClawEnabled: boolean;
    openClawBaseUrl: string;
    openClawTimeoutMs?: number;
    clearOpenClawApiKey?: boolean;
  }) => void;
};

const DESKTOP_RELEASES_URL =
  'https://github.com/ee01/Personal-AI/releases?q=desktop-v';
const PLATFORM_SCHEDULE_DOC =
  'https://github.com/ee01/Personal-AI/blob/develop/docs/features/agent_executor_runtime.md';
const PROBE_TTL_MS = 5 * 60 * 1000;

function newId(): string {
  return `exec_${Math.random().toString(36).slice(2, 8)}`;
}

function isOpenClawType(type: AgentExecutorTypeOption): boolean {
  return type === 'openclaw-responses' || type === 'openclaw-gateway';
}

function isAcpType(type: AgentExecutorTypeOption): boolean {
  return type === 'acp-codex' || type === 'acp-claude-code';
}

function isPrivateOrLoopbackUrl(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function primaryOpenClaw(
  executors: AgentExecutorDraft[],
): AgentExecutorDraft | undefined {
  return (
    executors.find((item) => item.id === 'openclaw') ||
    executors.find((item) => isOpenClawType(item.type))
  );
}

function asListed(executors: AgentExecutorDraft[]): AgentExecutorDraft[] {
  return executors.map((item) => ({ ...item, enabled: true }));
}

function chipColor(probe?: ProbeChip): string {
  if (!probe) return '#9ca3af';
  return probe.ok ? '#16a34a' : '#dc2626';
}

export function AgentExecutorsSettings({
  executors,
  defaults,
  externalDelegationEnabled,
  openClawTimeoutMs,
  openClawApiKeyConfigured,
  minOpenClawTimeoutSeconds,
  highlighted = false,
  sectionRef,
  onChange,
}: Props) {
  const listed = useMemo(() => asListed(executors), [executors]);
  const [probes, setProbes] = useState<Record<string, ProbeChip>>({});
  const [probingId, setProbingId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [desktopOnline, setDesktopOnline] = useState<boolean | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [installCommand, setInstallCommand] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => {
    let cancelled = false;
    const client = getMemoryServiceClient();
    const desktop = new DesktopAppClient();
    void client
      .listAgentWorkers()
      .then((res) => {
        if (!cancelled) setWorkers(res.workers || []);
      })
      .catch(() => {
        if (!cancelled) setWorkers([]);
      });
    void desktop
      .getHealth()
      .then((health) => {
        if (!cancelled) setDesktopOnline(Boolean(health?.ok));
      })
      .catch(() => {
        if (!cancelled) setDesktopOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function emit(
    nextExecutors: AgentExecutorDraft[],
    nextDefaults: ExecutorDefaultsDraft = defaults,
    patch: {
      openClawEnabled?: boolean;
      openClawTimeoutMs?: number;
    } = {},
  ) {
    const normalized = asListed(nextExecutors);
    const openclaw = primaryOpenClaw(normalized);
    onChange({
      executors: normalized,
      defaults: nextDefaults,
      openClawEnabled:
        patch.openClawEnabled !== undefined
          ? patch.openClawEnabled
          : externalDelegationEnabled,
      openClawBaseUrl: openclaw?.baseUrl || '',
      openClawTimeoutMs: patch.openClawTimeoutMs,
      clearOpenClawApiKey: openclaw?.clearApiKey === true ? true : undefined,
    });
  }

  function updateExecutor(id: string, patch: Partial<AgentExecutorDraft>) {
    emit(
      listed.map((item) =>
        item.id === id ? { ...item, ...patch, enabled: true } : item,
      ),
    );
  }

  function removeExecutor(id: string) {
    const nextExecutors = listed.filter((item) => item.id !== id);
    const fallback = nextExecutors[0]?.id || '';
    emit(nextExecutors, {
      agent_task: nextExecutors.some((item) => item.id === defaults.agent_task)
        ? defaults.agent_task
        : fallback,
      reflection_research: nextExecutors.some(
        (item) => item.id === defaults.reflection_research,
      )
        ? defaults.reflection_research
        : fallback,
    });
  }

  function addExecutor() {
    const id = newId();
    const openclaw = primaryOpenClaw(listed);
    emit(
      [
        ...listed,
        {
          id,
          label: '新执行器',
          type: 'openclaw-responses',
          baseUrl: openclaw?.baseUrl || '',
          enabled: true,
          apiKey: '',
          clearApiKey: false,
          apiKeyConfigured: false,
        },
      ],
      {
        agent_task: defaults.agent_task || id,
        reflection_research: defaults.reflection_research || id,
      },
    );
  }

  async function probe(id: string, deep = false) {
    const cached = probes[id];
    if (cached && !deep && Date.now() - cached.at < PROBE_TTL_MS) {
      return;
    }
    setProbingId(id);
    setBanner('');
    try {
      const result = await getMemoryServiceClient().probeAgentExecutor(id, {
        deep,
        force: true,
      });
      setProbes((prev) => ({
        ...prev,
        [id]: {
          ok: result.ok,
          stage: result.stage,
          detail: result.detail,
          nextAction: result.nextAction,
          cached: result.cached,
          at: Date.now(),
        },
      }));
    } catch (error) {
      setProbes((prev) => ({
        ...prev,
        [id]: {
          ok: false,
          stage: 'connect',
          detail: error instanceof Error ? error.message : String(error),
          nextAction: '请先保存执行器，再点测试。',
          at: Date.now(),
        },
      }));
    } finally {
      setProbingId(null);
    }
  }

  async function pairDesktop() {
    setPairingBusy(true);
    setBanner('');
    try {
      const issued = await getMemoryServiceClient().createAgentWorkerPairingToken();
      const desktop = new DesktopAppClient();
      const result = await desktop.pairWorker({
        pairingToken: issued.token,
        serverUrl: issued.serverUrl,
      });
      if (!result.ok) {
        throw new Error(result.error || 'Desktop 配对失败');
      }
      const listedWorkers = await getMemoryServiceClient().listAgentWorkers();
      setWorkers(listedWorkers.workers || []);
      setBanner('已配对本机 Desktop App Worker。');
    } catch (error) {
      setBanner(error instanceof Error ? error.message : String(error));
    } finally {
      setPairingBusy(false);
    }
  }

  async function createHeadlessCommand() {
    setBanner('');
    try {
      const issued = await getMemoryServiceClient().createAgentWorkerPairingToken();
      setInstallCommand(issued.installCommand);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : String(error));
    }
  }

  const hasOpenClaw = listed.some((item) => isOpenClawType(item.type));

  return (
    <div
      id="agent-executors-config"
      ref={sectionRef}
      className="form-section"
      style={
        highlighted
          ? {
              scrollMarginTop: '16px',
              boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.22)',
              borderRadius: '12px',
              transition: 'box-shadow 0.25s ease',
            }
          : {
              scrollMarginTop: '16px',
              transition: 'box-shadow 0.25s ease',
            }
      }
    >
      <h2>Agent 执行器</h2>
      <small style={{ color: '#666', display: 'block', marginBottom: '15px' }}>
        列表里的执行器添加后即可选用。Agent Task 有独立默认执行器；下方「外部委派」开关只影响反思查证
        / 联动操作，不影响 Agent Task。Codex / Claude Code 可跑在 Memory Service 本机，或经
        Desktop App Worker 跑在你自己的电脑上。
      </small>

      {banner ? (
        <div style={{ color: '#b45309', fontSize: 13, marginBottom: 8 }}>{banner}</div>
      ) : null}

      <div
        className="form-group"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        <button type="button" className="secondary-button" onClick={addExecutor}>
          添加执行器
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={pairingBusy || desktopOnline !== true}
          onClick={() => void pairDesktop()}
        >
          {pairingBusy
            ? '配对中…'
            : desktopOnline === null
              ? '检测本机 Desktop App…'
              : '一键配对本机 Desktop App'}
        </button>
        {desktopOnline === false ? (
          <span style={{ color: '#666', fontSize: 13, alignSelf: 'center' }}>
            未检测到本机 Personal AI.app，请先打开应用后再配对（127.0.0.1:46321）。
          </span>
        ) : null}
      </div>

      {listed.length === 0 ? (
        <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
          尚无执行器。点击「添加执行器」，或保存后由旧 OpenClaw 配置自动导入一条
          openclaw。
        </div>
      ) : (
        listed.map((item) => {
          const probe = probes[item.id];
          const runtime = item.runtime === 'remote' ? 'remote' : 'local';
          return (
            <div
              key={item.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                background: '#fafafa',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 8,
                }}
              >
                <label style={{ flex: '1 1 140px' }}>
                  ID
                  <input value={item.id} disabled style={{ width: '100%' }} />
                </label>
                <label style={{ flex: '2 1 180px' }}>
                  名称
                  <input
                    value={item.label}
                    onChange={(e) =>
                      updateExecutor(item.id, { label: e.target.value })
                    }
                    style={{ width: '100%' }}
                  />
                </label>
                <label style={{ flex: '1 1 160px' }}>
                  类型
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateExecutor(item.id, {
                        type: e.target.value as AgentExecutorTypeOption,
                      })
                    }
                    style={{ width: '100%' }}
                  >
                    <option value="openclaw-gateway">OpenClaw Gateway</option>
                    <option value="openclaw-responses">OpenClaw（HTTP）</option>
                    <option value="acp-codex">Codex ACP</option>
                    <option value="acp-claude-code">Claude Code ACP</option>
                  </select>
                </label>
              </div>
              {isOpenClawType(item.type) ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 8,
                  }}
                >
                  <label style={{ flex: '2 1 220px' }}>
                    Base URL
                    <input
                      value={item.baseUrl || ''}
                      onChange={(e) =>
                        updateExecutor(item.id, { baseUrl: e.target.value })
                      }
                      placeholder="http://127.0.0.1:18789 或 .../v1/chat/completions"
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ flex: '1 1 160px' }}>
                    API Key（留空保留已有）
                    <input
                      type="password"
                      value={item.apiKey || ''}
                      onChange={(e) =>
                        updateExecutor(item.id, {
                          apiKey: e.target.value,
                          clearApiKey: false,
                        })
                      }
                      placeholder={
                        item.apiKeyConfigured
                          ? '已配置（输入新值可覆盖）'
                          : '可选'
                      }
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label>
                    工作目录 cwd
                    <input
                      value={item.cwd || ''}
                      onChange={(e) =>
                        updateExecutor(item.id, { cwd: e.target.value })
                      }
                      placeholder="/path/to/repo"
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
              )}
              {isOpenClawType(item.type) && isPrivateOrLoopbackUrl(item.baseUrl) ? (
                <div style={{ color: '#b45309', fontSize: 12, marginBottom: 8 }}>
                  该地址仅 Memory Service 主机可达。若服务跑在远端公共机，127.0.0.1 /
                  内网 Gateway 连不上你笔记本上的 OpenClaw。
                </div>
              ) : null}
              {isAcpType(item.type) ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>运行位置</div>
                  <label style={{ marginRight: 12 }}>
                    <input
                      type="radio"
                      checked={runtime === 'local'}
                      onChange={() =>
                        updateExecutor(item.id, { runtime: 'local' })
                      }
                    />{' '}
                    本机（Memory Service 主机）
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={runtime === 'remote'}
                      onChange={() =>
                        updateExecutor(item.id, { runtime: 'remote' })
                      }
                    />{' '}
                    远程（经 Worker）
                  </label>
                  {runtime === 'remote' ? (
                    workers.length > 0 ? (
                      <label style={{ display: 'block', marginTop: 6 }}>
                        绑定 Worker
                        <select
                          value={item.workerId || ''}
                          onChange={(e) =>
                            updateExecutor(item.id, { workerId: e.target.value })
                          }
                          style={{ width: '100%', maxWidth: 420, display: 'block' }}
                        >
                          <option value="">选择已配对的 Worker</option>
                          {workers.map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.label} ({worker.status}
                              {worker.hostKind ? ` / ${worker.hostKind}` : ''}
                              {worker.hostname ? ` @ ${worker.hostname}` : ''})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          border: '1px dashed #d1d5db',
                          borderRadius: 8,
                          fontSize: 13,
                          background: '#fff',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          还没有可用 Worker
                        </div>
                        <ol style={{ margin: '0 0 8px 18px', padding: 0 }}>
                          <li>
                            首选安装{' '}
                            <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">
                              Personal AI Desktop App
                            </a>
                            ，打开应用后点本区块顶部的「一键配对本机 Desktop App」（Chrome 扩展 Options → Agent 执行器）。
                          </li>
                          <li>
                            无桌面环境时用 headless 一行命令：
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ marginLeft: 8 }}
                              onClick={() => void createHeadlessCommand()}
                            >
                              生成安装命令
                            </button>
                          </li>
                          <li>
                            零安装：看{' '}
                            <a href={PLATFORM_SCHEDULE_DOC} target="_blank" rel="noreferrer">
                              platform-schedule
                            </a>{' '}
                            文档。
                          </li>
                        </ol>
                        {installCommand ? (
                          <code
                            style={{
                              display: 'block',
                              whiteSpace: 'pre-wrap',
                              fontSize: 12,
                              background: '#f3f4f6',
                              padding: 8,
                            }}
                          >
                            {installCommand}
                          </code>
                        ) : null}
                        {desktopOnline === false ? (
                          <div style={{ color: '#666', marginTop: 6 }}>
                            本机 Desktop App 未在线：先打开 Applications 里的 Personal AI.app，顶部配对按钮才会可用。
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {isOpenClawType(item.type) ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={item.clearApiKey === true}
                      onChange={(e) =>
                        updateExecutor(item.id, {
                          clearApiKey: e.target.checked,
                          apiKey: e.target.checked ? '' : item.apiKey,
                        })
                      }
                    />{' '}
                    清除已保存 API Key
                  </label>
                ) : null}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={probingId === item.id}
                  onClick={() => void probe(item.id, false)}
                >
                  {probingId === item.id ? '测试中…' : '测试'}
                </button>
                {item.runtime === 'remote' ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={probingId === item.id}
                    onClick={() => void probe(item.id, true)}
                  >
                    深度测试
                  </button>
                ) : null}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: chipColor(probe),
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: chipColor(probe),
                    }}
                  />
                  {probe
                    ? `${probe.ok ? '就绪' : '失败'} · ${probe.stage}${probe.cached ? ' · 缓存' : ''}`
                    : '未测试'}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => removeExecutor(item.id)}
                >
                  删除
                </button>
              </div>
              {probe?.detail ? (
                <div style={{ color: '#4b5563', fontSize: 12, marginTop: 6 }}>
                  {probe.detail}
                  {probe.nextAction ? ` ${probe.nextAction}` : ''}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      <div className="form-group">
        <label htmlFor="AGENT_TASK_DEFAULT_EXECUTOR">
          Agent Task 默认执行器
        </label>
        <select
          id="AGENT_TASK_DEFAULT_EXECUTOR"
          value={defaults.agent_task}
          onChange={(e) =>
            emit(listed, {
              ...defaults,
              agent_task: e.target.value,
            })
          }
          style={{ width: '100%', maxWidth: 420 }}
        >
          <option value="">（自动：列表第一个）</option>
          {listed.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.id})
            </option>
          ))}
        </select>
      </div>

      {hasOpenClaw ? (
        <div className="form-group">
          <label htmlFor="AGENT_OPENCLAW_TIMEOUT_MS">OpenClaw 超时（秒）</label>
          <input
            type="number"
            id="AGENT_OPENCLAW_TIMEOUT_MS"
            value={Math.max(
              minOpenClawTimeoutSeconds,
              Math.floor(Number(openClawTimeoutMs || 600000) / 1000),
            )}
            onChange={(e) => {
              const seconds = Math.max(
                minOpenClawTimeoutSeconds,
                Math.floor(
                  Number(e.target.value) || minOpenClawTimeoutSeconds,
                ),
              );
              emit(listed, defaults, { openClawTimeoutMs: seconds * 1000 });
            }}
            min={String(minOpenClawTimeoutSeconds)}
            step="1"
          />
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            最短 {minOpenClawTimeoutSeconds}{' '}
            秒，适用于 OpenClaw 类型执行器。保存时换算为后端毫秒超时。
            {openClawApiKeyConfigured
              ? ' 后端已保存过 API Key。'
              : ''}
          </small>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 8,
          paddingTop: 12,
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <ToggleField
          id="OPENCLAW_EXTERNAL_DELEGATION"
          name="OPENCLAW_ENABLED"
          checked={externalDelegationEnabled}
          onChange={(e) =>
            emit(listed, defaults, { openClawEnabled: e.target.checked })
          }
          label="允许外部委派（反思查证 / 联动操作）"
          description={
            <>
              默认开启。关闭后自我反思与消息联动不再自动创建外部查证动作；
              不影响 Agent Task /「帮我做」。
            </>
          }
        />

        {externalDelegationEnabled ? (
          <div className="form-group" style={{ marginTop: 0 }}>
            <label htmlFor="REFLECTION_DEFAULT_EXECUTOR">
              反思查证默认执行器
            </label>
            <select
              id="REFLECTION_DEFAULT_EXECUTOR"
              value={defaults.reflection_research}
              onChange={(e) =>
                emit(listed, {
                  ...defaults,
                  reflection_research: e.target.value,
                })
              }
              style={{ width: '100%', maxWidth: 420, display: 'block' }}
            >
              <option value="">（自动：列表第一个）</option>
              {listed.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.id})
                </option>
              ))}
            </select>
            <small style={{ color: '#666', display: 'block', marginTop: 4 }}>
              自我反思 / 联动操作的外部查证走这个执行器。
            </small>
          </div>
        ) : null}
      </div>
    </div>
  );
}
