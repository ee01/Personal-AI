import React, { useMemo } from 'react';

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
  enabled: boolean;
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
  openClawEnabled: boolean;
  openClawBaseUrl: string;
  onChange: (next: {
    executors: AgentExecutorDraft[];
    defaults: ExecutorDefaultsDraft;
  }) => void;
};

function newId(): string {
  return `exec_${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentExecutorsSettings({
  executors,
  defaults,
  openClawEnabled,
  openClawBaseUrl,
  onChange,
}: Props) {
  const enabledOptions = useMemo(
    () => executors.filter((item) => item.enabled),
    [executors],
  );

  function updateExecutor(id: string, patch: Partial<AgentExecutorDraft>) {
    onChange({
      defaults,
      executors: executors.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function removeExecutor(id: string) {
    const nextExecutors = executors.filter((item) => item.id !== id);
    const fallback = nextExecutors.find((item) => item.enabled)?.id || '';
    onChange({
      executors: nextExecutors,
      defaults: {
        agent_task:
          nextExecutors.some((item) => item.id === defaults.agent_task)
            ? defaults.agent_task
            : fallback,
        reflection_research:
          nextExecutors.some((item) => item.id === defaults.reflection_research)
            ? defaults.reflection_research
            : fallback,
      },
    });
  }

  function addExecutor() {
    const id = newId();
    onChange({
      defaults: {
        agent_task: defaults.agent_task || id,
        reflection_research: defaults.reflection_research || id,
      },
      executors: [
        ...executors,
        {
          id,
          label: '新 OpenClaw',
          type: 'openclaw-responses',
          baseUrl: openClawBaseUrl || '',
          enabled: true,
          apiKey: '',
          clearApiKey: false,
          apiKeyConfigured: false,
        },
      ],
    });
  }

  function syncFromOpenClaw() {
    const existing = executors.find((item) => item.id === 'openclaw');
    const next: AgentExecutorDraft = {
      id: 'openclaw',
      label: existing?.label || 'OpenClaw',
      type: 'openclaw-responses',
      baseUrl: openClawBaseUrl || existing?.baseUrl || '',
      enabled: openClawEnabled,
      apiKey: '',
      clearApiKey: false,
      apiKeyConfigured: existing?.apiKeyConfigured,
    };
    const without = executors.filter((item) => item.id !== 'openclaw');
    onChange({
      executors: [next, ...without],
      defaults: {
        agent_task: defaults.agent_task || 'openclaw',
        reflection_research: defaults.reflection_research || 'openclaw',
      },
    });
  }

  return (
    <div id="agent-executors-config" className="form-section">
      <h2>Agent 执行器</h2>
      <small style={{ color: '#666', display: 'block', marginBottom: '15px' }}>
        Agent Task 与反思查证共用这份执行器列表。请求可指定 executor；未指定时走下方用途默认。
        未配置列表时，系统会用上方 OpenClaw 开关自动合成一个「openclaw」执行器。
      </small>

      <div className="form-group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="secondary-button" onClick={syncFromOpenClaw}>
          从当前 OpenClaw 配置同步
        </button>
        <button type="button" className="secondary-button" onClick={addExecutor}>
          添加执行器
        </button>
      </div>

      {executors.length === 0 ? (
        <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
          尚未显式配置执行器实例。保存后仍可依赖 OpenClaw 遗留字段自动合成。
        </div>
      ) : (
        executors.map((item) => (
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <label style={{ flex: '1 1 140px' }}>
                ID
                <input
                  value={item.id}
                  disabled
                  style={{ width: '100%' }}
                />
              </label>
              <label style={{ flex: '2 1 180px' }}>
                名称
                <input
                  value={item.label}
                  onChange={(e) => updateExecutor(item.id, { label: e.target.value })}
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <label style={{ flex: '2 1 220px' }}>
                Base URL
                <input
                  value={item.baseUrl || ''}
                  onChange={(e) => updateExecutor(item.id, { baseUrl: e.target.value })}
                  placeholder="https://..."
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
                    item.apiKeyConfigured ? '已配置（输入新值可覆盖）' : '可选'
                  }
                  style={{ width: '100%' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) =>
                    updateExecutor(item.id, { enabled: e.target.checked })
                  }
                />{' '}
                启用
              </label>
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

      <div className="form-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 200px' }}>
          Agent Task 默认执行器
          <select
            value={defaults.agent_task}
            onChange={(e) =>
              onChange({
                executors,
                defaults: { ...defaults, agent_task: e.target.value },
              })
            }
            style={{ width: '100%' }}
          >
            <option value="">（自动：第一个已启用）</option>
            {enabledOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.id})
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: '1 1 200px' }}>
          反思查证默认执行器
          <select
            value={defaults.reflection_research}
            onChange={(e) =>
              onChange({
                executors,
                defaults: { ...defaults, reflection_research: e.target.value },
              })
            }
            style={{ width: '100%' }}
          >
            <option value="">（自动：第一个已启用）</option>
            {enabledOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.id})
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
