import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compareAppScriptVersions,
  isValidAppScriptVersion,
  isAppScriptVersionOlder,
} from '../src/scheduled-messages/appScriptVersioning';
import {
  AppScriptUpdater,
  APP_SCRIPT_DEPLOYMENT_MISMATCH_ERROR,
  APP_SCRIPT_DEPLOYMENT_VERIFY_FAILED_ERROR,
  APP_SCRIPT_PROJECT_HISTORY_LIMIT_ERROR,
  APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR,
  buildAppScriptProjectUrl,
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
  'docs/features/scheduled_messages_manager.md',
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
  /getGoogleAuthTokenSilently\(\{\s*caller: 'ScheduledMessagesManager\.checkForUpdates\.auto',\s*scopes: GOOGLE_AUTH_SCOPE_SETS\.APPS_SCRIPT_ADMIN,\s*\}\)/
    .test(managerSource),
  'Automatic update checks should use silent App Script admin-scoped Google auth',
);
assert.ok(
  /getGoogleAuthToken\(\{\s*caller: 'ScheduledMessagesManager\.checkForUpdates\.manual',\s*scopes: GOOGLE_AUTH_SCOPE_SETS\.APPS_SCRIPT_ADMIN,\s*\}\)/
    .test(managerSource),
  'Manual update checks should keep an interactive App Script admin-scoped Google auth path',
);
assert.ok(
  managerSource.includes('checkForUpdates({ interactive: false })'),
  'Page-load update check should explicitly be non-interactive',
);
assert.ok(
  managerSource.includes('updater.checkForUpdates({') &&
    managerSource.includes('syncKnownVersionToConfig: interactive'),
  'Page-load update checks should be read-only and avoid Config metadata writeback',
);
assert.ok(
  managerSource.includes('checkForUpdates({ interactive: true, showCurrentAlert: true })'),
  'The UI should expose an explicit manual update check path',
);
assert.ok(
  managerSource.includes('if (deferEnrichment) {') &&
    managerSource.includes('void enrichMessages()') &&
    managerSource.includes('return baseMessages;'),
  'Scheduled Messages should show the first screen from base Sheet rows before Jira/Outreach enrichment finishes',
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
const projectContentGuardIndex = updaterSource.indexOf(
  'await this.assertCurrentProjectLooksManagedByPersonalAi(this.config.scriptId);',
  updateMethodIndex,
);
assert.ok(
  versionCapacityIndex > deploymentPreflightIndex,
  'App Script updates should check Project History capacity after deployment preflight',
);
assert.ok(
  projectContentGuardIndex > deploymentPreflightIndex,
  'App Script updates should verify project content ownership after deployment preflight',
);
assert.ok(
  projectContentGuardIndex < contentUpdateIndex,
  'App Script updates should verify project content ownership before mutating project content',
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
  updaterSource.includes("credentials: 'omit'"),
  'App Script version probes should not send Chrome profile cookies to script.google.com',
);
assert.ok(
  updaterSource.includes('版本端点返回非 JSON 响应') &&
    updaterSource.includes('无法确认线上版本'),
  'App Script version probes should not treat non-JSON login/error pages as legacy scripts',
);
assert.ok(
  updaterSource.includes('verifyUpdatedDeploymentServingVersion') &&
    updaterSource.includes('配置不会被标记为最新'),
  'App Script updates should verify the Web App URL serves the new version before syncing config metadata',
);
assert.ok(
  updaterSource.includes('msg_appscript-recovery') &&
    updaterSource.includes('App Script 需要检查'),
  'Background auto-update failures with recovery links should create actionable notifications',
);
assert.ok(
  updaterSource.includes('当前配置缺少 Script ID'),
  'Update checks should not present an upgrade action when the Script ID needed for deployment updates is missing',
);
assert.ok(
  updaterSource.includes('无法读取最新 App Script 模板版本'),
  'App Script updates should fail closed when the bundled template version cannot be read',
);
assert.ok(
  updaterSource.includes('APP_SCRIPT_VERSION 必须是有效 SemVer'),
  'App Script updates should fail closed when the bundled template version is not valid SemVer',
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
  updaterSource.includes('assertCurrentProjectLooksManagedByPersonalAi') &&
    updaterSource.includes(APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR) &&
    updaterSource.includes('避免覆盖用户自定义或错误项目'),
  'App Script updates should fail closed when the configured script content is not a Personal AI scheduled script',
);
assert.ok(
  updaterSource.includes('private async syncConfigSheetFirst()') &&
    updaterSource.includes('await this.syncConfigSheetFirst();'),
  'App Script version metadata should use the same Sheet-first Config sync path',
);
assert.ok(
  updaterSource.includes('syncKnownVersionToConfig = true') &&
    updaterSource.includes('if (!needsUpdate && syncKnownVersionToConfig)'),
  'App Script update checks should support read-only checks that skip Config metadata sync',
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
  managerSource.includes('先打开版本端点确认是否返回 JSON version/lastUpdated') &&
    managerSource.includes('打开版本端点') &&
    managerSource.includes('打开 Apps Script') &&
    managerSource.includes("buildAppScriptWebAppActionUrl(config.webAppUrl, 'getVersion')") &&
    managerSource.includes('buildAppScriptProjectUrl(config.scriptId)'),
  'Scheduled Messages UI should offer direct diagnostics when App Script update checks fail',
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
  featureDoc.includes('读取远端项目代码确认 Personal AI 调度脚本标记'),
  'Feature doc should describe the remote project-content ownership preflight',
);
assert.ok(
  featureDoc.includes('版本探测临时失败或非 JSON 响应不会被当成旧版脚本'),
  'Feature doc should describe transient version-probe failure handling',
);
assert.ok(
  featureDoc.includes('不携带 Chrome profile cookie') &&
    featureDoc.includes('重定向到错误的 `/u/N/`'),
  'Feature doc should describe anonymous App Script version probes',
);
assert.ok(
  featureDoc.includes('非 JSON') &&
    featureDoc.includes('不会按旧版脚本继续升级'),
  'Feature doc should describe non-JSON version-probe responses as uncertain state',
);
assert.ok(
  featureDoc.includes('部署生效确认') &&
    featureDoc.includes('未确认返回目标版本时，不会把配置标记为最新'),
  'Feature doc should describe post-deployment version verification before config sync',
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
    managerSource.includes('失败回退旧部署') &&
    managerSource.includes('Web App URL 不变'),
  'Scheduled Messages UI should summarize update status, safety, and last check context',
);
assert.ok(
  managerSource.includes('App Script 升级前检查') &&
    managerSource.includes('重新确认线上版本') &&
    managerSource.includes('匹配当前 Web App deployment') &&
    managerSource.includes('确认新版本已生效') &&
    managerSource.includes('失败回退旧 deployment') &&
    managerSource.includes('更新后同步 Sheet 配置'),
  'Scheduled Messages UI should show the preflight path before upgrade',
);
assert.ok(
  managerSource.includes('appScriptUpgradeProofReceipt') &&
    managerSource.includes('升级证明回执') &&
    managerSource.includes('只有 getVersion 返回目标版本才把 Sheet/Storage 标记最新') &&
    managerSource.includes('未确认时保留旧配置并走回退/检查页面') &&
    managerSource.includes('aria-label="App Script 升级证明回执"') &&
    managerSource.includes('title={appScriptUpgradeProofReceipt}'),
  'Scheduled Messages update banner should expose the post-upgrade proof and recovery boundary before click',
);
assert.ok(
  managerSource.includes('提交后确认新版本已生效') &&
    managerSource.includes('不会把配置标记为最新') &&
    managerSource.includes('尝试回退到升级前 deployment 版本'),
  'Scheduled Messages UI should explain post-deployment verification, rollback, and stale-config protection',
);
assert.ok(
  managerSource.includes('appScriptRecoveryUrl') &&
    managerSource.includes('App Script deployment 需要检查') &&
    managerSource.includes('检查页面'),
  'Scheduled Messages UI should offer a recovery link when deployment preflight fails',
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
const updateAvailableBannerIndex = managerSource.indexOf('{updateAvailable && (');
const updateAvailableBannerEnd = managerSource.indexOf('{/* Bot 配置失效警告 */}', updateAvailableBannerIndex);
const updateAvailableBannerSource = managerSource.slice(
  updateAvailableBannerIndex,
  updateAvailableBannerEnd,
);
assert.ok(
  updateAvailableBannerSource.includes('appScriptRecheckActionBoundary') &&
    updateAvailableBannerSource.includes('aria-label={appScriptRecheckActionBoundary}') &&
    updateAvailableBannerSource.includes('重新检查') &&
    updateAvailableBannerSource.includes('isCheckingUpdates || isUpdating'),
  'Scheduled Messages update banner should let users re-check after cleaning Project History without reloading',
);
assert.ok(
  managerSource.includes('buildAppScriptUpdateActionBoundary') &&
    managerSource.includes('只读取版本端点、deployment 和 Project History，不写 Sheet、Script 或 Jira Rule') &&
    managerSource.includes('只有 Web App 版本端点确认目标版本后才标记 Sheet/Storage 为最新') &&
    managerSource.includes('点击只打开恢复页面，不重新提交升级、不写 Sheet/Script/Jira Rule'),
  'Scheduled Messages should build button-level App Script update action boundaries',
);
assert.ok(
  managerSource.includes('title={appScriptCheckActionBoundary}') &&
    managerSource.includes('aria-label={appScriptCheckActionBoundary}') &&
    managerSource.includes('title={appScriptUpgradeActionBoundary}') &&
    managerSource.includes('aria-label={appScriptUpgradeActionBoundary}') &&
    managerSource.includes('title={appScriptProjectHistoryActionBoundary}') &&
    managerSource.includes('aria-label={appScriptProjectHistoryActionBoundary}') &&
    managerSource.includes('title={appScriptVersionProbeActionBoundary}') &&
    managerSource.includes('aria-label={appScriptVersionProbeActionBoundary}') &&
    managerSource.includes('title={appScriptRecoveryActionBoundary}') &&
    managerSource.includes('aria-label={appScriptRecoveryActionBoundary}'),
  'App Script update controls should expose hover and screen-reader action boundaries',
);
assert.ok(
  managerSource.includes('buildAppScriptUpgradeNotice') &&
    managerSource.includes('App Script 升级结果回执') &&
    managerSource.includes('App Script 升级结果需要处理'),
  'Scheduled Messages should build a persistent App Script upgrade result receipt',
);
assert.ok(
  managerSource.includes('buildAppScriptUpgradePendingNotice') &&
    managerSource.includes('App Script 升级请求回执') &&
    managerSource.includes('升级请求已提交，正在依次检查 Sheet、App Script deployment 和 Jira Automation') &&
    managerSource.includes('尚未确认: Web App URL 返回新版本、Sheet/Storage 标记最新、Jira rule 更新完成') &&
    managerSource.includes('等待完成前不发送定时消息、不触发 Bot/Chrome/Doubao、不确认通知'),
  'Scheduled Messages should show an in-flight App Script upgrade request receipt before final results',
);
assert.ok(
  managerSource.includes('setAppScriptUpgradeNotice(buildAppScriptUpgradeNotice') &&
    managerSource.includes('边界: 已是最新时跳过脚本写入；失败项保留现有版本') &&
    managerSource.includes('下一步:') &&
    managerSource.includes('打开检查页面处理后重试检查'),
  'App Script upgrade receipt should preserve skipped/mutation boundaries and recovery next steps',
);
assert.ok(
  managerSource.includes('appScriptUpgradeNotice.recoveryUrl') &&
    managerSource.includes('打开检查页面') &&
    managerSource.includes('关闭 App Script 升级结果回执'),
  'App Script upgrade receipt should expose recovery and dismissal controls',
);

assert.equal(compareAppScriptVersions('2.6.16', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('v2.6.16', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('2.6.16+build.7', '2.6.16'), 0);
assert.equal(compareAppScriptVersions('2.6.16-beta.1', '2.6.16'), -1);
assert.equal(compareAppScriptVersions('2.10.0', '2.9.9'), 1);
assert.equal(isAppScriptVersionOlder('legacy', '2.6.16'), true);
assert.equal(isAppScriptVersionOlder('2.6.16+build.7', '2.6.16'), false);
assert.equal(isValidAppScriptVersion('2.6.16'), true);
assert.equal(isValidAppScriptVersion('v2.6.16-beta.1+build.7'), true);
assert.equal(isValidAppScriptVersion('2.6'), false);
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
    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response(appScriptTemplate, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/exec?action=getVersion') {
        assert.equal(
          init?.credentials,
          'omit',
          'getVersion probes should omit Chrome profile credentials',
        );
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

async function verifyReadOnlyUpdateCheckSkipsConfigMetadataSync(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let sheetCalls = 0;
  let scriptApiCalls = 0;
  let storageWrites = 0;

  (AppScriptUpdater as any).cachedVersionInfo = null;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async () => {
          storageWrites += 1;
        },
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

      if (url === 'https://example.com/exec?action=getVersion') {
        assert.equal(
          init?.credentials,
          'omit',
          'read-only update checks should still use anonymous Web App version probes',
        );
        return new Response(JSON.stringify({
          version: templateVersion,
          lastUpdated: templateLastUpdated,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.startsWith('https://sheets.googleapis.com/')) {
        sheetCalls += 1;
        return new Response(JSON.stringify({ values: [] }), {
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
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.checkForUpdates({ syncKnownVersionToConfig: false });

    assert.equal(result.needsUpdate, false);
    assert.equal(result.currentVersion, templateVersion);
    assert.equal(result.latestVersion, templateVersion);
    assert.equal(result.error, undefined);
    assert.equal(sheetCalls, 0);
    assert.equal(scriptApiCalls, 0);
    assert.equal(storageWrites, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyReadOnlyUpdateCheckSkipsConfigMetadataSync();

async function verifyMissingScriptIdBlocksUpgradeState(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let scriptApiCalls = 0;

  (AppScriptUpdater as any).cachedVersionInfo = null;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
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
          version: '1.0.0',
          lastUpdated: '2025-01-01',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.startsWith('https://script.googleapis.com/')) {
        scriptApiCalls += 1;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      webAppUrl: 'https://example.com/exec',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.checkForUpdates();

    assert.equal(result.needsUpdate, false);
    assert.equal(result.currentVersion, '1.0.0');
    assert.equal(result.latestVersion, templateVersion);
    assert.match(result.error || '', /Script ID/);
    assert.equal(scriptApiCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyMissingScriptIdBlocksUpgradeState();

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

    assert.deepEqual(events, ['sheet-read', 'sheet-read', 'sheet-write', 'storage']);
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
  let deploymentUpdated = false;

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
          version: deploymentUpdated ? templateVersion : '1.0.0',
          lastUpdated: deploymentUpdated ? templateLastUpdated : '2025-01-01',
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

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-match' && init?.method !== 'PUT') {
        return new Response(JSON.stringify(matchingDeployment), {
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

      if (url === 'https://script.googleapis.com/v1/projects/script-123/content') {
        return new Response(JSON.stringify({
          files: [{
            name: 'Code',
            type: 'SERVER_JS',
            source: appScriptTemplate,
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/versions' && init?.method === 'POST') {
        versionCreated = true;
        return new Response(JSON.stringify({ versionNumber: 13 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-match' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        assert.equal(
          body.deploymentConfig.scriptId,
          'script-123',
          'deployments.update should include scriptId in deploymentConfig',
        );
        updatedDeploymentId = 'deployment-match';
        deploymentUpdated = true;
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

async function verifyProjectContentMismatchStopsScriptMutations(): Promise<void> {
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

      if (url === 'https://example.com/exec?action=getVersion') {
        return new Response(JSON.stringify({
          version: '1.0.0',
          lastUpdated: '2025-01-01',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-123') {
        return new Response(JSON.stringify({
          deploymentId: 'deployment-123',
          deploymentConfig: { versionNumber: 7 },
          entryPoints: [{
            entryPointType: 'WEB_APP',
            webApp: { url: 'https://example.com/exec' },
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/content' && init?.method !== 'PUT') {
        return new Response(JSON.stringify({
          files: [{
            name: 'Code',
            type: 'SERVER_JS',
            source: 'function unrelatedAutomation() { return true; }',
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (
        (url === 'https://script.googleapis.com/v1/projects/script-123/content' && init?.method === 'PUT') ||
        (url === 'https://script.googleapis.com/v1/projects/script-123/versions' && init?.method === 'POST') ||
        (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-123' && init?.method === 'PUT')
      ) {
        mutationCalls += 1;
        return new Response('{}', { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      deploymentId: 'deployment-123',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, false);
    assert.equal(result.errorCode, APP_SCRIPT_PROJECT_CONTENT_MISMATCH_ERROR);
    assert.equal(result.helpUrl, buildAppScriptProjectUrl('script-123'));
    assert.match(result.error || '', /Personal AI Scheduled Messages/);
    assert.equal(mutationCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyProjectContentMismatchStopsScriptMutations();

async function verifyPostDeploymentVersionMismatchDoesNotSyncConfig(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  const originalAttempts = (AppScriptUpdater as any).deploymentVerificationAttempts;
  const originalDelay = (AppScriptUpdater as any).deploymentVerificationDelayMs;
  let contentUpdated = false;
  let versionCreated = false;
  const deploymentVersionUpdates: number[] = [];
  let configWrites = 0;

  (AppScriptUpdater as any).cachedVersionInfo = null;
  (AppScriptUpdater as any).deploymentVerificationAttempts = 2;
  (AppScriptUpdater as any).deploymentVerificationDelayMs = 0;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    storage: {
      local: {
        set: async () => {
          configWrites += 1;
        },
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

      if (url === 'https://example.com/exec?action=getVersion') {
        return new Response(JSON.stringify({
          version: '1.0.0',
          lastUpdated: '2025-01-01',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-123' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        assert.equal(
          body.deploymentConfig.scriptId,
          'script-123',
          'rollback deployments.update should include scriptId in deploymentConfig',
        );
        deploymentVersionUpdates.push(body.deploymentConfig.versionNumber);
        return new Response('{}', { status: 200 });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/deployments/deployment-123') {
        return new Response(JSON.stringify({
          deploymentId: 'deployment-123',
          deploymentConfig: { versionNumber: 7 },
          entryPoints: [{
            entryPointType: 'WEB_APP',
            webApp: { url: 'https://example.com/exec' },
          }],
        }), {
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

      if (url === 'https://script.googleapis.com/v1/projects/script-123/content') {
        return new Response(JSON.stringify({
          files: [{
            name: 'Code',
            type: 'SERVER_JS',
            source: appScriptTemplate,
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://script.googleapis.com/v1/projects/script-123/versions' && init?.method === 'POST') {
        versionCreated = true;
        return new Response(JSON.stringify({ versionNumber: 8 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('https://sheets.googleapis.com/')) {
        configWrites += 1;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const updater = new AppScriptUpdater('test-token', {
      sheetId: 'sheet-123',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      scriptId: 'script-123',
      webAppUrl: 'https://example.com/exec',
      deploymentId: 'deployment-123',
      sheet_version: '2.7',
      created_by: 'Personal AI Extension',
      created_at: '2026-04-30 12:00:00',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, false);
    assert.equal(result.errorCode, APP_SCRIPT_DEPLOYMENT_VERIFY_FAILED_ERROR);
    assert.equal(result.currentVersion, '1.0.0');
    assert.equal(result.latestVersion, templateVersion);
    assert.match(result.error || '', /配置不会被标记为最新/);
    assert.match(result.error || '', /回退到升级前版本 7/);
    assert.equal(contentUpdated, true);
    assert.equal(versionCreated, true);
    assert.deepEqual(deploymentVersionUpdates, [8, 7]);
    assert.equal(configWrites, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
    (AppScriptUpdater as any).deploymentVerificationAttempts = originalAttempts;
    (AppScriptUpdater as any).deploymentVerificationDelayMs = originalDelay;
  }
}

await verifyPostDeploymentVersionMismatchDoesNotSyncConfig();

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
    assert.equal(result.errorCode, APP_SCRIPT_DEPLOYMENT_MISMATCH_ERROR);
    assert.match(result.error || '', /Web App URL 匹配/);
    assert.equal(result.helpUrl, buildAppScriptProjectUrl('script-123'));
    assert.match(result.helpMessage || '', /Manage deployments/);
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

async function verifyNonJsonVersionProbeStopsScriptMutations(): Promise<void> {
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
        return new Response('<html><body>Please sign in</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
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
      deploymentId: 'deployment-123',
      appScriptVersion: '1.0.0',
      appScriptLastUpdated: '2025-01-01',
    } as any);

    const result = await updater.updateAppScript();

    assert.equal(result.success, false);
    assert.match(result.error || '', /无法确认线上 App Script 版本/);
    assert.match(result.error || '', /非 JSON/);
    assert.equal(scriptApiCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyNonJsonVersionProbeStopsScriptMutations();

async function verifyInvalidTemplateSemverStopsScriptMutations(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalChrome = (globalThis as any).chrome;
  let remoteCalls = 0;

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
    const invalidTemplate = appScriptTemplate.replace(
      /var APP_SCRIPT_VERSION = '[^']+';/,
      "var APP_SCRIPT_VERSION = '2.8';",
    );

    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url === 'chrome-extension://test/app-script-template.gs') {
        return new Response(invalidTemplate, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      remoteCalls += 1;
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
    assert.match(checkResult.error || '', /有效 SemVer/);

    (AppScriptUpdater as any).cachedVersionInfo = null;
    const updateResult = await updater.updateAppScript();
    assert.equal(updateResult.success, false);
    assert.match(updateResult.error || '', /有效 SemVer/);
    assert.equal(remoteCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).chrome = originalChrome;
    (AppScriptUpdater as any).cachedVersionInfo = null;
  }
}

await verifyInvalidTemplateSemverStopsScriptMutations();

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
