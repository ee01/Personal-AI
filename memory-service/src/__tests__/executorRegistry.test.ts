import { describe, expect, it } from 'vitest';

import {
  findEnabledExecutor,
  publicExecutorOptions,
  resolveAgentExecutors,
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
        type: 'openclaw-responses',
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
      { id: 'openclaw', label: 'OpenClaw', type: 'openclaw-responses' },
    ]);
  });

  it('prefers explicit agentExecutors and resolves defaults to enabled ids', () => {
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
          enabled: false,
        },
      ],
      executorDefaults: {
        agent_task: 'codex',
        reflection_research: 'missing',
      },
    };
    const defaults = resolveExecutorDefaults(config);
    expect(defaults.agent_task).toBe('oc-main');
    expect(defaults.reflection_research).toBe('oc-main');
    expect(findEnabledExecutor(config, 'openclaw')?.id).toBeUndefined();
    expect(findEnabledExecutor(config, 'oc-main')?.id).toBe('oc-main');
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
