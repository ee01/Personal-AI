import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimelineCacheDiagnosticText,
  formatTimelineSyncDryRunResult,
  formatTimelineCacheAge,
  formatTimelineCacheLastAttempt,
  getTimelineCacheAttemptQuickFixText,
  getTimelineCacheExecutionImpactText,
  getTimelineProjectCacheSaveBlockText,
  getTimelineCacheReadinessBlockText,
  getTimelineCacheSaveBlockText,
  getTimelineCacheStatusActionText,
  getTimelineCacheStatusLabel,
  validateTimelineCacheStatusResponse,
  parseTimelineCacheStatusResponseText,
  parseTimelineSyncDryRunResponseText,
  shouldAutoRefreshTimelineCacheStatus,
  type TimelineCacheStatus,
} from '../timelineCacheStatus.js';

const readyStatus: TimelineCacheStatus = {
  success: true,
  generatedAt: '2026-05-03T00:00:00.000Z',
  maxAgeMs: 36 * 60 * 60 * 1000,
  totalProjects: 1,
  readyProjects: 1,
  missingProjects: 0,
  staleProjects: 0,
  allProjectsReady: true,
  projects: [
    {
      project: 'mThor',
      paramKey: 'mThor',
      cached: true,
      valid: true,
      expired: false,
      status: 'ready',
      milestoneKeys: ['FF', 'Release'],
    },
  ],
};

test('Timeline cache readiness does not block save while status is loading', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: true,
    status: null,
    error: '',
  });

  assert.equal(reason, '');
});

test('Timeline cache readiness does not block save when status request failed', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: false,
    status: null,
    error: 'HTTP 500',
  });

  assert.equal(reason, '');
});

test('Timeline cache readiness does not block save before cache status has been read', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: false,
    status: null,
    error: '',
  });

  assert.equal(reason, '');
});

test('Timeline cache readiness allows save when status is available', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: false,
    status: readyStatus,
    error: '',
  });

  assert.equal(reason, '');
});

test('Timeline project cache save guard does not block missing and stale project caches', () => {
  assert.equal(
    getTimelineProjectCacheSaveBlockText({
      isLoading: false,
      status: readyStatus,
      error: '',
      project: 'Nova',
    }),
    '',
  );

  assert.equal(
    getTimelineProjectCacheSaveBlockText({
      isLoading: false,
      status: {
        ...readyStatus,
        readyProjects: 0,
        staleProjects: 1,
        allProjectsReady: false,
        projects: [{
          project: 'mThor',
          paramKey: 'mThor',
          cached: true,
          valid: true,
          expired: true,
          status: 'expired',
        }],
      },
      error: '',
      project: 'mThor',
    }),
    '',
  );
});

test('Timeline project cache save guard does not block when cache status is unavailable', () => {
  assert.equal(
    getTimelineProjectCacheSaveBlockText({
      isLoading: false,
      status: null,
      error: 'HTTP 404',
      project: 'mThor',
    }),
    '',
  );

  assert.equal(
    getTimelineProjectCacheSaveBlockText({
      isLoading: false,
      status: null,
      error: '',
      project: 'mThor',
    }),
    '',
  );
});

test('Timeline project cache save guard allows ready project cache', () => {
  assert.equal(
    getTimelineProjectCacheSaveBlockText({
      isLoading: false,
      status: readyStatus,
      error: '',
      project: 'mThor',
    }),
    '',
  );
});

test('Timeline cache labels and actions stay user-facing', () => {
  assert.equal(getTimelineCacheStatusLabel('ready'), '缓存可用');
  assert.equal(getTimelineCacheStatusLabel('missing'), '尚未同步');
  assert.match(getTimelineCacheStatusActionText('expired'), /手动运行 Timeline Sync Rule/);
  assert.match(getTimelineCacheSaveBlockText({
    project: 'mThor',
    paramKey: 'mThor',
    cached: true,
    valid: true,
    expired: true,
    status: 'expired',
  }), /手动运行 Timeline Sync Rule/);
});

test('Timeline cache age formatter keeps compact Chinese labels', () => {
  assert.equal(formatTimelineCacheAge(30 * 1000), '刚刚');
  assert.equal(formatTimelineCacheAge(15 * 60 * 1000), '15 分钟前');
  assert.equal(formatTimelineCacheAge(3 * 60 * 60 * 1000), '3 小时前');
  assert.equal(formatTimelineCacheAge(2 * 24 * 60 * 60 * 1000), '2 天前');
  assert.equal(formatTimelineCacheAge(null), '未知时间');
});

test('Timeline cache response validation rejects old App Script responses', () => {
  assert.throws(
    () => validateTimelineCacheStatusResponse({ status: 'OK', message: 'Personal AI Scheduled Messages API' }),
    /尚不支持 Timeline 缓存状态/,
  );
});

test('Timeline cache response validation surfaces endpoint errors', () => {
  assert.throws(
    () => validateTimelineCacheStatusResponse({ success: false, error: 'UNKNOWN_ACTION' }),
    /UNKNOWN_ACTION/,
  );
});

test('Timeline cache response validation surfaces Apps Script error payloads', () => {
  assert.throws(
    () => validateTimelineCacheStatusResponse({ status: 'ERROR', message: 'Script failure' }),
    /Script failure/,
  );
});

test('Timeline cache response parser reports actionable non-JSON responses', () => {
  assert.throws(
    () => parseTimelineCacheStatusResponseText('<!doctype html><html><body>Sign in</body></html>'),
    /HTML 页面.*App Script/,
  );

  assert.throws(
    () => parseTimelineCacheStatusResponseText(''),
    /响应为空.*App Script/,
  );
});

test('Timeline cache response validation normalizes valid project status', () => {
  const normalized = validateTimelineCacheStatusResponse({
    success: true,
    generatedAt: '2026-05-04T00:00:00.000Z',
    maxAgeMs: 36 * 60 * 60 * 1000,
    projects: [
      {
        project: 'mThor',
        paramKey: 'mThor',
        cached: true,
        valid: true,
        expired: false,
        status: 'ready',
        milestoneKeys: [' FF ', 'Release', 123],
      },
    ],
  });

  assert.equal(normalized.totalProjects, 1);
  assert.equal(normalized.readyProjects, 1);
  assert.deepEqual(normalized.projects[0].milestoneKeys, ['FF', 'Release']);
});

test('Timeline cache response validation preserves safe last sync attempt diagnostics', () => {
  const normalized = validateTimelineCacheStatusResponse({
    success: true,
    generatedAt: '2026-05-04T00:00:00.000Z',
    maxAgeMs: 36 * 60 * 60 * 1000,
    projects: [
      {
        project: 'mThor',
        paramKey: 'mThor',
        cached: false,
        valid: false,
        expired: false,
        status: 'error',
        error: 'releaseInfo 必须是非空对象',
        lastAttempt: {
          success: false,
          requestId: 'tl_mThor_abc123',
          attemptedAt: '2026-05-04T00:01:00.000Z',
          ageMs: 15 * 60 * 1000,
          errorCode: 'INVALID_RELEASE_INFO_SCHEMA',
          parseError: 'releaseInfo 必须是非空对象',
          requestContentType: 'application/json',
          nextAction: '检查 Custom data 并重新运行 Timeline Sync Rule。',
          requestBodyBytes: 512,
          payloadBytes: 4096,
          maxBytes: 9216,
          milestoneKeys: [' FF ', 'Release', 123],
        },
      },
    ],
  });

  assert.equal(normalized.projects[0].status, 'error');
  assert.equal(normalized.projects[0].lastAttempt?.success, false);
  assert.equal(normalized.projects[0].lastAttempt?.requestId, 'tl_mThor_abc123');
  assert.equal(normalized.projects[0].lastAttempt?.requestContentType, 'application/json');
  assert.equal(normalized.projects[0].lastAttempt?.nextAction, '检查 Custom data 并重新运行 Timeline Sync Rule。');
  assert.equal(normalized.projects[0].lastAttempt?.requestBodyBytes, 512);
  assert.equal(normalized.projects[0].lastAttempt?.payloadBytes, 4096);
  assert.deepEqual(normalized.projects[0].lastAttempt?.milestoneKeys, ['FF', 'Release']);
  assert.match(
    formatTimelineCacheLastAttempt(normalized.projects[0].lastAttempt),
    /最近同步失败（15 分钟前）：INVALID_RELEASE_INFO_SCHEMA - releaseInfo 必须是非空对象/,
  );
  assert.match(
    formatTimelineCacheLastAttempt(normalized.projects[0].lastAttempt),
    /Content-Type application\/json，请求 ID tl_mThor_abc123，请求体 512B，payload 4KB\/9KB，样例 FF、Release/,
  );
  assert.match(
    formatTimelineCacheLastAttempt(normalized.projects[0].lastAttempt),
    /建议：检查 Custom data 并重新运行 Timeline Sync Rule。/,
  );
});

test('Timeline cache last attempt formatter includes oversized payload diagnostics', () => {
  assert.match(
    formatTimelineCacheLastAttempt({
      success: false,
      ageMs: 2 * 60 * 1000,
      errorCode: 'TIMELINE_CACHE_TOO_LARGE',
      payloadBytes: 11264,
      maxBytes: 9216,
      milestoneCount: 120,
      milestoneKeys: ['Gate 0', 'Gate 1', 'Gate 2', 'Gate 3', 'Gate 4'],
    }),
    /TIMELINE_CACHE_TOO_LARGE；payload 11KB\/9KB，Milestone 120 个，样例 Gate 0、Gate 1、Gate 2、Gate 3 等/,
  );
});

test('Timeline cache last attempt formatter falls back to attemptedAt when age is absent', () => {
  assert.equal(
    formatTimelineCacheLastAttempt({
      success: true,
      attemptedAt: '2026-05-04T00:01:00.000Z',
    }),
    '最近同步成功：2026-05-04T00:01:00.000Z',
  );

  assert.match(
    formatTimelineCacheLastAttempt({
      success: false,
      attemptedAt: '2026-05-04T00:02:00.000Z',
      errorCode: 'MISSING_RELEASE_INFO',
    }),
    /最近同步失败（2026-05-04T00:02:00.000Z）：MISSING_RELEASE_INFO/,
  );
});

test('Timeline cache quick fix text summarizes the next user action', () => {
  assert.equal(
    getTimelineCacheAttemptQuickFixText({
      success: false,
      errorCode: 'INVALID_POST_JSON',
      nextAction: 'long fallback',
    }),
    '把 Timeline Sync Rule 的 Apps Script 写缓存请求改回 GET；POST 可能停在 Google 302 重定向。',
  );

  assert.equal(
    getTimelineCacheAttemptQuickFixText({
      success: false,
      errorCode: 'MISSING_RELEASE_INFO',
    }),
    '确认变量先保存 {{webhookResponse.body}}，GET URL 包含 project 和 releaseInfo={{变量.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}。',
  );

  assert.equal(
    getTimelineCacheAttemptQuickFixText({
      success: false,
      errorCode: 'RELEASE_INFO_TOO_DEEP',
    }),
    '压平 releaseInfo 结构；Timeline 缓存只需要项目字段和 Milestone 日期。',
  );

  assert.equal(
    getTimelineCacheAttemptQuickFixText({
      success: false,
      errorCode: 'UNKNOWN',
      nextAction: '打开 Timeline Sync Rule 后重试。',
    }),
    '打开 Timeline Sync Rule 后重试。',
  );
});

test('Timeline cache execution impact distinguishes trigger skips from variable fallback', () => {
  assert.match(
    getTimelineCacheExecutionImpactText({
      usage: 'timeline-trigger',
      status: readyStatus.projects[0],
      selectedMilestone: 'Regression',
    }),
    /执行器会跳过这条 Timeline.*Regression/,
  );

  assert.match(
    getTimelineCacheExecutionImpactText({
      usage: 'timeline-trigger',
      status: {
        project: 'mThor',
        paramKey: 'mThor',
        cached: false,
        valid: false,
        expired: false,
        status: 'missing',
      },
      selectedMilestone: 'FF',
    }),
    /mThor 缓存前，这条 Timeline 不会触发/,
  );

  assert.match(
    getTimelineCacheExecutionImpactText({
      usage: 'project-variables',
      status: {
        project: 'mThor',
        paramKey: 'mThor',
        cached: true,
        valid: false,
        expired: false,
        status: 'error',
      },
    }),
    /项目变量会保留原样/,
  );

  assert.match(
    getTimelineCacheExecutionImpactText({
      usage: 'project-variables',
      projectMissingFromStatus: true,
    }),
    /项目清单更新/,
  );

  assert.match(
    getTimelineCacheExecutionImpactText({
      usage: 'timeline-trigger',
      hasReadError: true,
    }),
    /无法确认 Timeline 缓存状态/,
  );
});

test('Timeline cache diagnostic text summarizes selected project troubleshooting context', () => {
  const diagnostic = buildTimelineCacheDiagnosticText({
    status: {
      ...readyStatus,
      readyProjects: 0,
      staleProjects: 1,
      allProjectsReady: false,
      projects: [{
        project: 'mThor',
        paramKey: 'mThor',
        cached: true,
        valid: true,
        expired: true,
        status: 'expired',
        updatedAt: '2026-05-03T00:00:00.000Z',
        expiresAt: '2026-05-04T12:00:00.000Z',
        milestoneKeys: ['FF', 'Release'],
        lastAttempt: {
          success: false,
          requestId: 'tl_mThor_failed',
          ageMs: 20 * 60 * 1000,
          errorCode: 'INVALID_RELEASE_INFO_SCHEMA',
          parseError: 'releaseInfo 必须是非空对象',
        },
      }],
    },
    error: '',
    selectedProject: 'mThor',
    selectedMilestone: 'Release',
    webAppUrl: 'https://script.google.com/macros/s/example/exec',
    timelineSyncRuleUrl: 'https://jira.example/rule/123',
  });

  assert.match(diagnostic, /Timeline 缓存诊断/);
  assert.match(diagnostic, /项目: mThor/);
  assert.match(diagnostic, /状态: 缓存已过期/);
  assert.match(diagnostic, /最近同步失败（20 分钟前）：INVALID_RELEASE_INFO_SCHEMA - releaseInfo 必须是非空对象/);
  assert.match(diagnostic, /请求 ID tl_mThor_failed/);
  assert.match(diagnostic, /缓存 Milestone: FF、Release/);
  assert.match(diagnostic, /Jira Send web request 修复模板/);
  assert.match(diagnostic, /Method: GET/);
  assert.match(diagnostic, /project=mThor/);
  assert.match(diagnostic, /releaseInfo=\{\{mThorReleaseInfo\.replaceAll\("'",""\)\.urlEncode\.replaceAll/);
  assert.match(diagnostic, /Body: \(empty\)/);
  assert.match(diagnostic, /必须保持 GET/);
  assert.match(diagnostic, /Apps Script dry-run 测试 curl/);
  assert.match(diagnostic, /dryRun/);
  assert.match(diagnostic, /https:\/\/script\.google\.com\/macros\/s\/example\/exec\?action=cacheReleaseInfo/);
  assert.match(diagnostic, /选中 Milestone: Release/);
  assert.match(diagnostic, /Timeline Sync Rule: https:\/\/jira\.example\/rule\/123/);
});

test('Timeline cache diagnostic text flags a selected milestone missing from ready cache', () => {
  const diagnostic = buildTimelineCacheDiagnosticText({
    status: readyStatus,
    error: '',
    selectedProject: 'mThor',
    selectedMilestone: 'Regression',
    timelineSyncRuleUrl: 'https://jira.example/rule/123',
  });

  assert.match(diagnostic, /状态: 缓存可用/);
  assert.match(diagnostic, /缓存 Milestone: FF、Release/);
  assert.match(diagnostic, /Milestone 缺失: 当前项目缓存不包含 Regression/);
  assert.match(diagnostic, /改选缓存中已有的 Milestone/);
});

test('Timeline cache diagnostic text explains ready cache with a later failed sync attempt', () => {
  const diagnostic = buildTimelineCacheDiagnosticText({
    status: {
      ...readyStatus,
      projects: [{
        ...readyStatus.projects[0],
        lastAttempt: {
          success: false,
          ageMs: 10 * 60 * 1000,
          errorCode: 'INVALID_POST_JSON',
        },
      }],
    },
    error: '',
    selectedProject: 'mThor',
    selectedMilestone: 'FF',
    timelineSyncRuleUrl: 'https://jira.example/rule/123',
  });

  assert.match(diagnostic, /状态: 缓存可用/);
  assert.match(diagnostic, /最近同步失败（10 分钟前）：INVALID_POST_JSON/);
  assert.match(diagnostic, /当前影响: 缓存仍可用/);
});

test('Timeline dry-run response parser formats successful validation', () => {
  const result = parseTimelineSyncDryRunResponseText(JSON.stringify({
    success: true,
    dryRun: true,
    wouldCache: true,
    requestId: 'tl_mThor_dry',
    project: 'mThor',
    paramKey: 'mThor',
    payloadBytes: 2048,
    maxBytes: 9216,
    milestoneCount: 2,
    milestoneKeys: [' FF ', 'Release'],
  }));

  assert.equal(result.success, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.requestId, 'tl_mThor_dry');
  assert.deepEqual(result.milestoneKeys, ['FF', 'Release']);
  assert.match(formatTimelineSyncDryRunResult(result), /样例测试通过/);
  assert.match(formatTimelineSyncDryRunResult(result), /不会写入 Timeline 缓存/);
  assert.match(formatTimelineSyncDryRunResult(result), /payload 2KB\/9KB/);
  assert.match(formatTimelineSyncDryRunResult(result), /请求 ID tl_mThor_dry/);
});

test('Timeline dry-run response parser keeps actionable failure diagnostics', () => {
  const result = parseTimelineSyncDryRunResponseText(JSON.stringify({
    success: false,
    dryRun: true,
    requestId: 'tl_mThor_bad',
    errorCode: 'INVALID_RELEASE_INFO_SCHEMA',
    parseError: 'releaseInfo 必须包含至少一个有效日期',
    nextAction: '确认 Milestone 日期格式。',
    payloadBytes: 512,
    maxBytes: 9216,
  }));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'INVALID_RELEASE_INFO_SCHEMA');
  assert.match(formatTimelineSyncDryRunResult(result), /测试失败：INVALID_RELEASE_INFO_SCHEMA/);
  assert.match(formatTimelineSyncDryRunResult(result), /下一步：确认 Milestone 日期格式。/);
});

test('Timeline dry-run parser rejects non dry-run success and non-JSON responses', () => {
  assert.throws(
    () => parseTimelineSyncDryRunResponseText(JSON.stringify({ success: true })),
    /不是 dry-run 响应/,
  );

  assert.throws(
    () => parseTimelineSyncDryRunResponseText('<html>Sign in</html>'),
    /dry-run 响应是 HTML 页面/,
  );
});

test('Timeline cache auto refresh is throttled while the dialog is loading or freshly refreshed', () => {
  assert.equal(shouldAutoRefreshTimelineCacheStatus({
    enabled: false,
    isLoading: false,
    nowMs: 10000,
    lastRefreshAtMs: null,
  }), false);

  assert.equal(shouldAutoRefreshTimelineCacheStatus({
    enabled: true,
    isLoading: true,
    nowMs: 10000,
    lastRefreshAtMs: null,
  }), false);

  assert.equal(shouldAutoRefreshTimelineCacheStatus({
    enabled: true,
    isLoading: false,
    nowMs: 10000,
    lastRefreshAtMs: null,
  }), true);

  assert.equal(shouldAutoRefreshTimelineCacheStatus({
    enabled: true,
    isLoading: false,
    nowMs: 14000,
    lastRefreshAtMs: 10000,
  }), false);

  assert.equal(shouldAutoRefreshTimelineCacheStatus({
    enabled: true,
    isLoading: false,
    nowMs: 16000,
    lastRefreshAtMs: 10000,
  }), true);
});
