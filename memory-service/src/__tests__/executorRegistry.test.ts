import { describe, expect, it } from 'vitest';

import {
  buildPersistedLegacyOpenClawImport,
  findEnabledExecutor,
  publicExecutorOptions,
  resolveAgentExecutors,
  resolveAgentTaskExecutorId,
  resolveExecutorDefaults,
} from '../integrations/executors/executorRegistry.js';
import {
  hasVerifiableArtifact,
  normalizeObservedFieldLabels,
} from '../integrations/executors/agentResultContract.js';

describe('executorRegistry', () => {
  it('synthesizes a legacy OpenClaw executor when agentExecutors is empty', () => {
    const executors = resolveAgentExecutors({
      openClawEnabled: true,
      openClawBaseUrl: 'https://openclaw.example',
      openClawApiKey: 'secret',
      agentExecutors: [],
    });
    expect(executors).toEqual([
      expect.objectContaining({
        id: 'openclaw',
        type: 'openclaw-gateway',
        enabled: true,
        baseUrl: 'https://openclaw.example',
      }),
    ]);
    expect(
      publicExecutorOptions({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example',
        openClawApiKey: 'secret',
        agentExecutors: [],
      }),
    ).toEqual([
      { id: 'openclaw', label: 'OpenClaw', type: 'openclaw-gateway' },
    ]);
  });

  it('uses env executor type and label when synthesizing the default gateway', () => {
    const executors = resolveAgentExecutors({
      openClawEnabled: true,
      openClawBaseUrl: 'http://claw.xmnup.com',
      openClawApiKey: 'secret',
      openClawExecutorType: 'openclaw-gateway',
      openClawExecutorLabel: 'Mac mini Openclaw',
      agentExecutors: [],
    });
    expect(executors).toEqual([
      expect.objectContaining({
        id: 'openclaw',
        label: 'Mac mini Openclaw',
        type: 'openclaw-gateway',
        baseUrl: 'http://claw.xmnup.com',
      }),
    ]);
  });

  it('imports disabled legacy OpenClaw config into a persisted executor row', () => {
    const imported = buildPersistedLegacyOpenClawImport({
      openClawEnabled: false,
      openClawBaseUrl: 'https://openclaw.example',
      openClawApiKey: 'secret',
      agentExecutors: [],
    });
    expect(imported?.agentExecutors).toEqual([
      expect.objectContaining({
        id: 'openclaw',
        enabled: true,
        type: 'openclaw-gateway',
        baseUrl: 'https://openclaw.example',
      }),
    ]);
    expect(imported?.executorDefaults.agent_task).toBe('openclaw');
    expect(
      buildPersistedLegacyOpenClawImport({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example',
        agentExecutors: [
          {
            id: 'openclaw',
            label: 'OpenClaw',
            type: 'openclaw-responses',
            enabled: true,
          },
        ],
      }),
    ).toBeNull();
  });

  it('imports env gateway defaults for a brand-new user with empty config', () => {
    const imported = buildPersistedLegacyOpenClawImport(
      {},
      {
        openClawEnabled: true,
        openClawBaseUrl: 'http://claw.xmnup.com',
        openClawApiKey: 'gw-key',
        openClawExecutorType: 'openclaw-gateway',
        openClawExecutorLabel: 'Mac mini Openclaw',
      },
    );
    expect(imported?.agentExecutors[0]).toMatchObject({
      id: 'openclaw',
      label: 'Mac mini Openclaw',
      type: 'openclaw-gateway',
      baseUrl: 'http://claw.xmnup.com',
    });
    expect(imported?.executorDefaults).toEqual({
      agent_task: 'openclaw',
      reflection_research: 'openclaw',
    });
  });

  it('does not import env defaults when the user already has executors', () => {
    expect(
      buildPersistedLegacyOpenClawImport(
        {
          agentExecutors: [
            {
              id: 'codex',
              label: 'Codex',
              type: 'acp-codex',
              enabled: true,
            },
          ],
        },
        {
          openClawBaseUrl: 'http://claw.xmnup.com',
          openClawApiKey: 'gw-key',
        },
      ),
    ).toBeNull();
  });

  it('treats listed executors as available even when legacy enabled=false', () => {
    const config = {
      openClawEnabled: false,
      openClawBaseUrl: 'https://legacy',
      openClawApiKey: '',
      agentExecutors: [
        {
          id: 'oc-main',
          label: 'Main',
          type: 'openclaw-responses' as const,
          enabled: false,
        },
        {
          id: 'codex',
          label: 'Codex',
          type: 'acp-codex' as const,
          enabled: false,
        },
      ],
      executorDefaults: {
        agent_task: 'codex',
        reflection_research: 'oc-main',
      },
    };
    expect(findEnabledExecutor(config, 'codex')?.id).toBe('codex');
    const defaults = resolveExecutorDefaults(config);
    expect(defaults.agent_task).toBe('codex');
    expect(defaults.reflection_research).toBe('oc-main');
  });

  it('stores runtime=remote and workerId on ACP instances', () => {
    const executors = resolveAgentExecutors({
      openClawEnabled: true,
      openClawBaseUrl: '',
      openClawApiKey: '',
      agentExecutors: [
        {
          id: 'codex-remote',
          label: 'Remote Codex',
          type: 'acp-codex',
          runtime: 'remote',
          workerId: 'worker-1',
          enabled: true,
        },
      ],
    });
    expect(executors[0]).toMatchObject({
      id: 'codex-remote',
      runtime: 'remote',
      workerId: 'worker-1',
    });
  });

  it('treats listed executors as available even when enabled=false', () => {
    const config = {
      openClawEnabled: true,
      openClawBaseUrl: 'https://legacy',
      openClawApiKey: '',
      agentExecutors: [
        {
          id: 'oc-main',
          label: 'Main',
          type: 'openclaw-responses' as const,
          enabled: true,
        },
        {
          id: 'codex',
          label: 'Codex',
          type: 'acp-codex' as const,
          // Compat field only — listed means available.
          enabled: false,
        },
      ],
      executorDefaults: {
        agent_task: 'codex',
        reflection_research: 'missing',
      },
    };
    const defaults = resolveExecutorDefaults(config);
    expect(defaults.agent_task).toBe('codex');
    expect(defaults.reflection_research).toBe('oc-main');
    expect(findEnabledExecutor(config, 'openclaw')?.id).toBeUndefined();
    expect(findEnabledExecutor(config, 'oc-main')?.id).toBe('oc-main');
    expect(findEnabledExecutor(config, 'codex')?.id).toBe('codex');
  });

  it('uses Agent Task default only when executor is omitted', () => {
    const defaults = {
      agent_task: 'exec_t4com0',
      reflection_research: 'openclaw',
    };
    expect(resolveAgentTaskExecutorId(undefined, defaults)).toBe('exec_t4com0');
    expect(resolveAgentTaskExecutorId('', defaults)).toBe('exec_t4com0');
    expect(resolveAgentTaskExecutorId('openclaw', defaults)).toBe('openclaw');
    expect(resolveAgentTaskExecutorId('exec_t4com0', defaults)).toBe('exec_t4com0');
  });
});

describe('agentResultContract observedFields', () => {
  it('accepts object-shaped observedFields', () => {
    expect(
      normalizeObservedFieldLabels({ url: 'https://example.com', tabId: 1 }),
    ).toEqual(['url=https://example.com', 'tabId=1']);
    expect(
      hasVerifiableArtifact([
        {
          kind: 'browser',
          content: 'opened',
          metadata: {
            sourceSystem: 'chrome',
            entityId: 'tab-1',
            verification: 'read_dom',
            observedFields: { url: 'https://example.com' },
          },
        },
      ]),
    ).toBe(true);
  });
});
