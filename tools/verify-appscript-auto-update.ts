import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compareAppScriptVersions,
  isAppScriptVersionOlder,
} from '../src/scheduled-messages/appScriptVersioning';
import {
  AppScriptUpdater,
  APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR,
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

assert.ok(updateMethodIndex >= 0, 'AppScriptUpdater should expose updateAppScript');
assert.ok(deploymentPreflightIndex > updateMethodIndex, 'App Script updates should preflight deployment lookup');
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
  featureDoc.includes('升级会先预检是否存在可更新的正式 Web App deployment'),
  'Feature doc should describe the deployment preflight behavior',
);
assert.ok(
  featureDoc.includes('Project History 版本额度'),
  'Feature doc should describe Project History version-capacity preflight behavior',
);
assert.ok(
  managerSource.includes('清理脚本版本'),
  'Scheduled Messages UI should guide users to clean Project History when the version limit is reached',
);

assert.equal(compareAppScriptVersions('2.6.16', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('v2.6.16', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('2.6.16+build.7', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('2.6.16-beta.1', '2.6.16'), -1);
assert.equal(compareAppScriptVersions('2.10.0', '2.9.9'), 1);
assert.equal(isAppScriptVersionOlder('legacy', '2.6.16'), true);
assert.equal(isAppScriptVersionOlder('2.6.16+build.7', '2.6.16'), false);

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

console.log('App Script auto-update verification passed');
