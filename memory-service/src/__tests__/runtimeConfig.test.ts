import { describe, expect, it } from 'vitest';

import { getConfig } from '../config.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';

describe('getUserRuntimeConfig', () => {
  it('falls back to app defaults when no user config exists', () => {
    const config = getUserRuntimeConfig();
    const appConfig = getConfig();

    expect(config.reflectionEnabled).toBe(true);
    expect(config.reflectionHeartbeatMinutes).toBeGreaterThanOrEqual(1);
    expect(config.dreamDigestEnabled).toBe(true);
    expect(config.openClawEnabled).toBe(appConfig.openClawEnabled);
    expect(config.openClawBaseUrl).toBeDefined();
    expect(config.openClawTimeoutMs).toBe(600000);
    expect(config.outreachResultPushTarget).toBe('me');
    expect(config.outreachResultPushGroupId).toBe('');
  });

  it('applies per-user reflection and dream push overrides from config.json', () => {
    const fakeUserDataManager = {
      readFile(path: string) {
        if (path !== 'config.json') return null;
        return JSON.stringify({
          reflectionEnabled: false,
          reflectionHeartbeatMinutes: 42,
          dreamDigestPushTarget: 'none',
          weeklyReportPushTarget: 'none',
          outreachResultPushTarget: 'group',
          outreachResultPushGroupId: 'group-42',
          openClawEnabled: true,
          openClawBaseUrl: 'https://openclaw.example.com',
          openClawApiKey: 'test-openclaw-key',
          openClawTimeoutMs: 45000,
        });
      },
    } as any;

    const config = getUserRuntimeConfig(fakeUserDataManager);

    expect(config.reflectionEnabled).toBe(false);
    expect(config.reflectionHeartbeatMinutes).toBe(42);
    expect(config.dreamDigestEnabled).toBe(false);
    expect(config.dreamDigestPushTarget).toBe('none');
    expect(config.weeklyReportEnabled).toBe(false);
    expect(config.outreachResultPushTarget).toBe('group');
    expect(config.outreachResultPushGroupId).toBe('group-42');
    expect(config.openClawEnabled).toBe(true);
    expect(config.openClawBaseUrl).toBe('https://openclaw.example.com');
    expect(config.openClawApiKey).toBe('test-openclaw-key');
    expect(config.openClawTimeoutMs).toBe(300000);
  });
});
