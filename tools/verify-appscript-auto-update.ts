import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compareAppScriptVersions,
  isAppScriptVersionOlder,
} from '../src/scheduled-messages/appScriptVersioning';
import {
  AppScriptUpdater,
  APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR,
  buildAppScriptWebAppActionUrl,
  type AppScriptVersionUsage,
} from '../src/scheduled-messages/AppScriptUpdater';

const managerSource = readFileSync(
  'src/scheduled-messages/ScheduledMessagesManager.tsx',
  'utf8',
);
const updaterSource = readFileSync(
  'src/scheduled-messages/AppScriptUpdater.ts',
  'utf8',
);
const appScriptTemplate = readFileSync(
  'src/scheduled-messages/app-script-template.gs',
  'utf8',
);
const featureDoc = readFileSync(
  'docs/features/appscript-auto-update.mdc',
  'utf8',
);

const versionMatch = appScriptTemplate.match(/var APP_SCRIPT_VERSION = '([^']+)';/);
const lastUpdatedMatch = appScriptTemplate.match(/var APP_SCRIPT_LAST_UPDATED = '([^']+)';/);

assert.ok(versionMatch, 'APP_SCRIPT_VERSION should be present in the template');
assert.ok(lastUpdatedMatch, 'APP_SCRIPT_LAST_UPDATED should be present in the template');

const [, templateVersion] = versionMatch;
const [, templateLastUpdated] = lastUpdatedMatch;

assert.ok(
  featureDoc.includes(`var APP_SCRIPT_VERSION = '${templateVersion}';`),
  'Feature doc should show the current App Script template version',
);
assert.ok(
  featureDoc.includes(`var APP_SCRIPT_LAST_UPDATED = '${templateLastUpdated}';`),
  'Feature doc should show the current App Script template date',
);

assert.ok(
  managerSource.includes(
    "getGoogleAuthTokenSilently({ caller: 'ScheduledMessagesManager.checkForUpdates.auto' })",
  ),
  'Automatic update checks should use silent Google auth',
);
assert.ok(
  managerSource.includes(
    "getGoogleAuthToken({ caller: 'ScheduledMessagesManager.checkForUpdates.manual' })",
  ),
  'Manual update checks should keep an interactive Google auth path',
);
assert.ok(
  managerSource.includes('checkForUpdates({ interactive: false })'),
  'Page-load update check should explicitly be non-interactive',
);
assert.ok(
  managerSource.includes('checkForUpdates({ interactive: true, showCurrentAlert: true })'),
  'The UI should expose an explicit manual update check path',
);
assert.ok(
  managerSource.includes('App Script 可升级'),
  'The UI should explain an available App Script update before the user upgrades',
);
assert.ok(
  managerSource.includes('保持 Web App URL 不变'),
  'The upgrade confirmation path should explain that the Web App URL stays stable',
);
assert.ok(
  managerSource.includes('预检部署'),
  'The upgrade confirmation path should explain the deployment preflight',
);
assert.equal(
  managerSource.includes("getGoogleAuthToken({ caller: 'ScheduledMessagesManager.checkForUpdates' })"),
  false,
  'Page-load update checks must not use the legacy interactive auth caller',
);

const updateMethodIndex = updaterSource.indexOf('async updateAppScript()');
const deploymentPreflightIndex = updaterSource.indexOf(
  'const deploymentId = await this.getOrCreateDeploymentId();',
  updateMethodIndex,
);
const contentUpdateIndex = updaterSource.indexOf('await this.updateProjectContent', updateMethodIndex);
const versionCreateIndex = updaterSource.indexOf('await this.createVersion', updateMethodIndex);
const deployedVersionCheckIndex = updaterSource.indexOf(
  'deployedVersionInfo = await this.getDeployedVersionInfo();',
  updateMethodIndex,
);

assert.ok(updateMethodIndex >= 0, 'AppScriptUpdater should expose updateAppScript');
assert.ok(deploymentPreflightIndex > updateMethodIndex, 'App Script updates should preflight deployment lookup');
assert.ok(
  deployedVersionCheckIndex > updateMethodIndex,
  'App Script updates should re-check the deployed version before mutating project state',
);
assert.ok(
  deployedVersionCheckIndex < deploymentPreflightIndex,
  'The deployed-version recheck should happen before deployment preflight',
);
assert.ok(
  deploymentPreflightIndex < contentUpdateIndex,
  'Deployment preflight should happen before mutating project content',
);
assert.ok(
  deploymentPreflightIndex < versionCreateIndex,
  'Deployment preflight should happen before creating a script version',
);
const versionCapacityIndex = updaterSource.indexOf(
  'await this.assertProjectVersionCapacity(this.config.scriptId);',
  updateMethodIndex,
);
assert.ok(
  versionCapacityIndex > deploymentPreflightIndex,
  'App Script updates should check Project History capacity after deployment preflight',
);
assert.ok(
  versionCapacityIndex < contentUpdateIndex,
  'Project History capacity should be checked before mutating project content',
);
assert.ok(
  updaterSource.includes('const APP_SCRIPT_VERSION_LIMIT = 200'),
  'AppScriptUpdater should encode the documented 200-version Project History limit',
);
assert.ok(
  updaterSource.includes('/versions?${params.toString()}'),
  'AppScriptUpdater should list project versions for Project History capacity checks',
);
assert.ok(
  updaterSource.includes('nextPageToken'),
  'Project History capacity checks should handle paginated versions.list responses',
);
assert.ok(
  updaterSource.includes('升级前无法确认线上 App Script 版本'),
  'App Script updates should stop when the deployed version cannot be confirmed',
);
assert.ok(
  updaterSource.includes('无法读取最新 App Script 模板版本'),
  'App Script updates should fail closed when the bundled template version cannot be read',
);
assert.equal(
  updaterSource.includes('fallbackVersion'),
  false,
  'App Script template-version failures should not be cached as a synthetic fallback version',
);
assert.ok(
  updaterSource.includes('if (checkResult.error)'),
  'Background auto-update should not treat update-check errors as current state',
);
assert.ok(
  updaterSource.includes('deploymentMatchesConfiguredWebAppUrl') &&
    updaterSource.includes('未找到与当前 Web App URL 匹配的正式 deployment'),
  'App Script updates should only update a deployment that matches the configured Web App URL',
);
assert.ok(
  updaterSource.includes('private async syncConfigSheetFirst()') &&
    updaterSource.includes('await this.syncConfigSheetFirst();'),
  'App Script version metadata should use the same Sheet-first Config sync path',
);
assert.equal(
  updaterSource.includes('同步配置到 Sheet 失败（不影响功能）'),
  false,
  'App Script version metadata sync must not silently leave Sheet Config stale',
);
assert.ok(
  managerSource.includes('updateCheckError') &&
    managerSource.includes('无法确认 App Script 升级状态') &&
    managerSource.includes('当前脚本不会被自动改动'),
  'Scheduled Messages UI should surface update-check failures with a retry path',
);
assert.ok(
  featureDoc.includes('预检是否存在可更新的正式 Web App deployment'),
  'Feature doc should describe the deployment preflight behavior',
);
assert.ok(
  featureDoc.includes('Project History 版本额度'),
  'Feature doc should describe Project History version-capacity preflight behavior',
);
assert.ok(
  featureDoc.includes('已是最新或更高版本时直接跳过脚本写入和版本创建'),
  'Feature doc should describe idempotent App Script update skipping',
);
assert.ok(
  featureDoc.includes('Web App URL 匹配'),
  'Feature doc should describe Web App URL matching before deployment updates',
);
assert.ok(
  featureDoc.includes('版本探测临时失败不会被当成旧版脚本'),
  'Feature doc should describe transient version-probe failure handling',
);
assert.ok(
  managerSource.includes('清理脚本版本'),
  'Scheduled Messages UI should guide users to clean Project History when the version limit is reached',
);
assert.ok(
  managerSource.includes('版本历史接近上限') &&
    managerSource.includes('建议先打开 Project History 清理旧版本'),
  'Scheduled Messages UI should warn before Project History is completely full',
);
assert.ok(
  managerSource.includes('检查于') &&
    managerSource.includes('失败保留旧部署') &&
    managerSource.includes('Web App URL 不变'),
  'Scheduled Messages UI should summarize update status, safety, and last check context',
);
assert.ok(
  managerSource.includes('App Script 升级前检查') &&
    managerSource.includes('重新确认线上版本') &&
    managerSource.includes('匹配当前 Web App deployment') &&
    managerSource.includes('更新后同步 Sheet 配置'),
  'Scheduled Messages UI should show the preflight path before upgrade',
);
const authFailureIndex = managerSource.indexOf('if (!token) {');
const resultErrorIndex = managerSource.indexOf('if (result.error) {', authFailureIndex);
const catchErrorIndex = managerSource.indexOf('} catch (error) {', resultErrorIndex);
assert.ok(
  authFailureIndex >= 0 &&
    managerSource.indexOf('setUpdateAvailable(false);', authFailureIndex) < resultErrorIndex,
  'Failed auth checks should clear stale App Script update availability',
);
assert.ok(
  resultErrorIndex >= 0 &&
    managerSource.indexOf('setUpdateAvailable(false);', resultErrorIndex) < catchErrorIndex,
  'Update-check errors should clear stale App Script update availability',
);
assert.ok(
  catchErrorIndex >= 0 &&
    managerSource.indexOf('setUpdateAvailable(false);', catchErrorIndex) >= 0,
  'Thrown update-check failures should clear stale App Script update availability',
);
assert.ok(
  managerSource.includes('已是最新时不会重复创建脚本版本') ||
    managerSource.includes('如果已是最新，会跳过脚本写入和版本创建'),
  'Scheduled Messages UI should explain that stale update state will not create duplicate script versions',
);

assert.equal(compareAppScriptVersions('2.6.16', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('v2.6.16', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('2.6.16+build.7', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('2.6.16-beta.1', '2.6.16'), -1);
assert.equal(compareAppScriptVersions('2.10.0', '2.9.9'), 1);
assert.equal(isAppScriptVersionOlder('legacy', '2.6.16'), true);
assert.equal(isAppScriptVersionOlder('2.6.16+build.7', '2.6.16'), false);
assert.equal(
  buildAppScriptWebAppActionUrl('https://example.com/exec?releaseInfo=abc#debug', 'getVersion'),
  'https://example.com/exec?releaseInfo=abc&action=getVersion#debug',
);

async function verifyProjectHistoryCapacityChecks(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const updater = new AppScriptUpdater('test-token', {
    scriptId: 'script-123',
    webAppUrl: 'https://example.com/exec',
  } as any);

  try {
    let calls = 0;
    globalThis.fetch = (async (input, init) => {
      calls += 1;
      const url = String(input);
      assert.ok(
        url.includes('/versions?pageSize=200'),
        'versions.list should request a full 200-version page',
      );
      if (calls === 2) {
        assert.ok(
          url.includes('pageToken=page-2'),
          'versions.list should request subsequent pages with nextPageToken',
        );
      }
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        'Bearer test-token',
      );

      const versions = Array.from(
        { length: calls === 1 ? 150 : 49 },
        (_, index) => ({ versionNumber: index + 1 }),
      );
      return new Response(JSON.stringify({
        versions,
        nextPageToken: calls === 1 ? 'page-2' : undefined,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const usage = await (updater as any).assertProjectVersionCapacity(
      'script-123',
    ) as AppScriptVersionUsage;
    assert.equal(usage.count, 199);
    assert.equal(usage.limit, 200);
    assert.equal(usage.remaining, 1);
    assert.equal(usage.nearLimit, true);
    assert.equal(calls, 2);

    globalThis.fetch = (async () => new Response(JSON.stringify({
      versions: Array.from({ length: 200 }, (_, index) => ({ versionNumber: index + 1 })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    await assert.rejects(
      () => (updater as any).assertProjectVersionCapacity('script-123'),
      (error: any) => {
        assert.equal(error.errorCode, APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR);
        assert.match(error.message, /200/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await verifyProjectHistoryCapacityChecks();

async function verifyAlreadyCurrentUpdateSkipsScriptMutations(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let scriptApiCalls = 0;

  (AppScriptUpdater as any).cachedVersionInfo = null;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async () => undefined,
      },
    },
  };

  try {
    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response(appScriptTemplate, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/exec?action=getVersion') {
        return new Response(JSON.stringify({
          version: templateVersion,
          lastUpdated: templateLastUpdated,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.startsWith('https://script.googleapis.com/')) {
        scriptApiCalls += 1;
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      appScriptVersion: templateVersion,
      appScriptLastUpdated: templateLastUpdated,
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, true);
    assert.equal(result.skipped, true);
    assert.equal(result.currentVersion, templateVersion);
    assert.equal(result.latestVersion, templateVersion);
    assert.equal(scriptApiCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
  }
}

await verifyAlreadyCurrentUpdateSkipsScriptMutations();

async function verifyVersionMetadataUsesSheetFirstConfigSync(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  const events: string[] = [];
  let storedConfig: any;
  let sheetLastSyncTime = '';

  (globalThis as any).chrome = {
    storage: {
      local: {
        set: async (value: any) => {
          events.push('storage');
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  try {
    globalThis.fetch = (async (_input, init) => {
      if (init?.method === 'PUT') {
        events.push('sheet-write');
        const body = JSON.parse(String(init.body));
        const rows = body.values as [string, string][];
        const configMap = new Map(rows.filter(([key]) => key));
        sheetLastSyncTime = configMap.get('last_sync_time') || '';
        assert.equal(configMap.get('app_script_version'), '2.7.0');
        assert.equal(configMap.get('app_script_last_updated'), '2026-05-09');
        return new Response('{}', { status: 200 });
      }

      events.push('sheet-read');
      return new Response(JSON.stringify({ values: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
      appScriptVersion: '2.6.0',
      appScriptLastUpdated: '2026-04-30',
    } as any);

    await (updater as any).updateConfigVersion({
      version: '2.7.0',
      lastUpdated: '2026-05-09',
    });

    assert.deepEqual(events, ['sheet-read', 'sheet-write', 'storage']);
    assert.ok(sheetLastSyncTime);
    assert.equal(storedConfig.appScriptVersion, '2.7.0');
    assert.equal(storedConfig.appScriptLastUpdated, '2026-05-09');
    assert.equal(storedConfig.last_sync_time, sheetLastSyncTime);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
  }
}

await verifyVersionMetadataUsesSheetFirstConfigSync();

async function verifyDeploymentSelectionMatchesConfiguredWebAppUrl(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let contentUpdated = false;
  let versionCreated = false;
  let updatedDeploymentId = '';
  let storedConfig: any;

  (AppScriptUpdater as any).cachedVersionInfo = null;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async (value: any) => {
          storedConfig = value.scheduledMessagesConfig;
        },
      },
    },
  };

  const wrongDeployment = {
    deploymentId: 'deployment-wrong',
    deploymentConfig: { versionNumber: 11 },
    entryPoints: [{
      entryPointType: 'WEB_APP',
      webApp: { url: 'https://script.google.com/macros/s/wrong/exec' },
    }],
  };
  const matchingDeployment = {
    deploymentId: 'deployment-match',
    deploymentConfig: { versionNumber: 12 },
    entryPoints: [{
      entryPointType: 'WEB_APP',
      webApp: { url: 'https://script.google.com/macros/s/match/exec' },
    }],
  };

  try {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response(appScriptTemplate, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (url === 'https://script.google.com/macros/s/match/exec?debug=1&action=getVersion') {
        return new Response(JSON.stringify({
          version: '1.0.0',
          lastUpdated: '2025-01-01',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-wrong') {
        return new Response(JSON.stringify(wrongDeployment), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments') {
        return new Response(JSON.stringify({ deployments: [wrongDeployment, matchingDeployment] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/versions?pageSize=200') {
        return new Response(JSON.stringify({ versions: [{ versionNumber: 1 }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/content' && init?.method === 'PUT') {
        contentUpdated = true;
        return new Response('{}', { status: 200 });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/versions' && init?.method === 'POST') {
        versionCreated = true;
        return new Response(JSON.stringify({ versionNumber: 13 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-match' && init?.method === 'PUT') {
        updatedDeploymentId = 'deployment-match';
        return new Response('{}', { status: 200 });
      }

      if (url.includes('https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Config!A2:B') && init?.method !== 'PUT') {
        return new Response(JSON.stringify({ values: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Config!A2:B') && init?.method === 'PUT') {
        return new Response('{}', { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      scriptId: 'script-123',
      webAppUrl: 'https://script.google.com/macros/s/match/exec?debug=1',
      deploymentId: 'deployment-wrong',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, true);
    assert.equal(contentUpdated, true);
    assert.equal(versionCreated, true);
    assert.equal(updatedDeploymentId, 'deployment-match');
    assert.equal(storedConfig.deploymentId, 'deployment-match');
    assert.equal(storedConfig.appScriptVersion, templateVersion);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyDeploymentSelectionMatchesConfiguredWebAppUrl();

async function verifyDeploymentUrlMismatchStopsScriptMutations(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let mutationCalls = 0;

  (AppScriptUpdater as any).cachedVersionInfo = null;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async () => undefined,
      },
    },
  };

  try {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response(appScriptTemplate, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (url === 'https://script.google.com/macros/s/current/exec?action=getVersion') {
        return new Response(JSON.stringify({
          version: '1.0.0',
          lastUpdated: '2025-01-01',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments') {
        return new Response(JSON.stringify({
          deployments: [{
            deploymentId: 'deployment-other',
            deploymentConfig: { versionNumber: 12 },
            entryPoints: [{
              entryPointType: 'WEB_APP',
              webApp: { url: 'https://script.google.com/macros/s/other/exec' },
            }],
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (
        url.includes('/content') ||
        (url.endsWith('/versions') && init?.method === 'POST') ||
        (url.includes('/deployments/') && init?.method === 'PUT')
      ) {
        mutationCalls += 1;
        return new Response('{}', { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      scriptId: 'script-123',
      webAppUrl: 'https://script.google.com/macros/s/current/exec',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, false);
    assert.match(result.error || '', /Web App URL 匹配/);
    assert.equal(mutationCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyDeploymentUrlMismatchStopsScriptMutations();

async function verifyTransientVersionProbeStopsScriptMutations(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let scriptApiCalls = 0;

  (AppScriptUpdater as any).cachedVersionInfo = null;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async () => undefined,
      },
    },
  };

  try {
    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response(appScriptTemplate, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/exec?action=getVersion') {
        throw new TypeError('Failed to fetch');
      }

      if (url.startsWith('https://script.googleapis.com/')) {
        scriptApiCalls += 1;
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      deploymentId: 'deployment-123',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, false);
    assert.match(result.error || '', /无法确认线上 App Script 版本/);
    assert.equal(scriptApiCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
  }
}

await verifyTransientVersionProbeStopsScriptMutations();

async function verifyTemplateVersionLoadFailureStopsScriptMutations(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let scriptApiCalls = 0;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async () => undefined,
      },
    },
  };

  try {
    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response('missing template', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (url.startsWith('https://script.googleapis.com/')) {
        scriptApiCalls += 1;
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch after template load failure: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      deploymentId: 'deployment-123',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    (AppScriptUpdater as any).cachedVersionInfo = null;
    const checkResult = await updater.checkForUpdates();
    assert.equal(checkResult.needsUpdate, false);
    assert.equal(checkResult.currentVersion, 'unknown');
    assert.equal(checkResult.latestVersion, 'unknown');
    assert.match(checkResult.error || '', /无法读取最新 App Script 模板版本/);

    (AppScriptUpdater as any).cachedVersionInfo = null;
    const updateResult = await updater.updateAppScript();
    assert.equal(updateResult.success, false);
    assert.match(updateResult.error || '', /无法读取最新 App Script 模板版本/);
    assert.equal(scriptApiCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyTemplateVersionLoadFailureStopsScriptMutations();

console.log('App Script auto-update verification passed');
