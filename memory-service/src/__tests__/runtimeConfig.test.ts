import { describe, expect, it } from 'vitest';

import { getConfig } from '../config.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';

describe('getUserRuntimeConfig', () => {
  it('falls back to app defaults when no user config exists', () => {
    const config = getUserRuntimeConfig();
    const appConfig = getConfig();

    // Default is OFF unless REFLECTION_DEFAULT_ENABLED=true (or the legacy
    // REFLECTION_ENABLED) is set — see config.ts's parseReflectionDefaultEnabled
    // and docs/features/usage_analytics.md (成本治理与 2026-08 事故复盘) for why an
    // unset-defaults-to-true footgun is exactly what this guards against.
    expect(config.reflectionEnabled).toBe(false);
    expect(config.reflectionHeartbeatMinutes).toBeGreaterThanOrEqual(1);
    expect(config.dreamDigestEnabled).toBe(true);
    expect(config.openClawExecutorType).toBe(appConfig.openClawExecutorType);
    expect(config.openClawExecutorLabel).toBe(appConfig.openClawExecutorLabel);
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
          botApiBaseUrl: 'https://bot.example/v2',
          botToken: 'test-bot-token',
          botId: 'test-bot-id',
          botType: 'team',
          botTeamId: 'team-42',
          botTargetEmail: 'owner@example.com',
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
    expect(config.openClawTimeoutMs).toBe(600000);
    expect(config.botApiBaseUrl).toBe('https://bot.example/v2');
    expect(config.botToken).toBe('test-bot-token');
    expect(config.botId).toBe('test-bot-id');
    expect(config.botType).toBe('team');
    expect(config.botTeamId).toBe('team-42');
    expect(config.botTargetEmail).toBe('owner@example.com');
  });
});
