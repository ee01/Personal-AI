import { describe, expect, it } from 'vitest';

import { getUserRuntimeConfig } from '../runtimeConfig.js';

describe('getUserRuntimeConfig', () => {
  it('falls back to app defaults when no user config exists', () => {
    const config = getUserRuntimeConfig();

    expect(config.reflectionEnabled).toBe(false);
    expect(config.reflectionHeartbeatMinutes).toBeGreaterThanOrEqual(1);
    expect(config.dreamDigestEnabled).toBe(true);
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
        });
      },
    } as any;

    const config = getUserRuntimeConfig(fakeUserDataManager);

    expect(config.reflectionEnabled).toBe(false);
    expect(config.reflectionHeartbeatMinutes).toBe(42);
    expect(config.dreamDigestEnabled).toBe(false);
    expect(config.dreamDigestPushTarget).toBe('none');
    expect(config.weeklyReportEnabled).toBe(false);
  });
});
