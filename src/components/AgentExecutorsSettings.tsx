import React, { useMemo } from 'react';

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
  /** Kept for API compatibility; listed executors are always treated as available. */
  enabled?: boolean;
  apiKeyConfigured?: boolean;
  clearApiKey?: boolean;
};

export type ExecutorDefaultsDraft = {
  agent_task: string;
  reflection_research: string;
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

function newId(): string {
  return `exec_${Math.random().toString(36).slice(2, 8)}`;
}

function isOpenClawType(type: AgentExecutorTypeOption): boolean {
  return type === 'openclaw-responses' || type === 'openclaw-gateway';
}

function primaryOpenClaw(
  executors: AgentExecutorDraft[],
): AgentExecutorDraft | undefined {
  return (
    executors.find((item) => item.id === 'openclaw') ||
    executors.find((item) => isOpenClawType(item.type))
  );
}

/** Listed executors are always available; force enabled=true for persistence. */
function asListed(executors: AgentExecutorDraft[]): AgentExecutorDraft[] {
  return executors.map((item) => ({ ...item, enabled: true }));
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
        / 联动操作，不影响 Agent Task。
      </small>

      <div
        className="form-group"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        <button type="button" className="secondary-button" onClick={addExecutor}>
          添加执行器
        </button>
      </div>

      {listed.length === 0 ? (
        <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
          尚无执行器。点击「添加执行器」，或保存后由旧 OpenClaw 配置自动导入一条
          openclaw。
        </div>
      ) : (
        listed.map((item) => (
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
                  <option value="openclaw-responses">OpenClaw（HTTP）</option>
                  <option value="openclaw-gateway">OpenClaw Gateway</option>
                  <option value="acp-codex">本机 Codex ACP</option>
                  <option value="acp-claude-code">本机 Claude Code ACP</option>
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
                onClick={() => removeExecutor(item.id)}
              >
                删除
              </button>
            </div>
          </div>
        ))
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
