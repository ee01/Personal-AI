import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimelineCacheDiagnosticText,
  formatTimelineCacheAge,
  formatTimelineCacheLastAttempt,
  getTimelineProjectCacheSaveBlockText,
  getTimelineCacheReadinessBlockText,
  getTimelineCacheSaveBlockText,
  getTimelineCacheStatusActionText,
  getTimelineCacheStatusLabel,
  validateTimelineCacheStatusResponse,
  parseTimelineCacheStatusResponseText,
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

test('Timeline cache readiness blocks save while status is loading', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: true,
    status: null,
    error: '',
  });

  assert.match(reason, /正在读取 Timeline 缓存状态/);
});

test('Timeline cache readiness blocks save when status request failed', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: false,
    status: null,
    error: 'HTTP 500',
  });

  assert.match(reason, /读取失败/);
  assert.match(reason, /HTTP 500/);
});

test('Timeline cache readiness blocks save before cache status has been read', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: false,
    status: null,
    error: '',
  });

  assert.match(reason, /尚未读取 Timeline 缓存状态/);
});

test('Timeline cache readiness allows save when status is available', () => {
  const reason = getTimelineCacheReadinessBlockText({
    isLoading: false,
    status: readyStatus,
    error: '',
  });

  assert.equal(reason, '');
});

test('Timeline project cache save guard blocks missing and stale project caches', () => {
  assert.match(
    getTimelineProjectCacheSaveBlockText({
      isLoading: false,
      status: readyStatus,
      error: '',
      project: 'Nova',
    }),
    /未出现在当前 App Script 返回的 Timeline 缓存状态/,
  );

  assert.match(
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
    /mThor 的 Timeline 缓存状态为 缓存已过期/,
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
    /Content-Type application\/json，请求体 512B，payload 4KB\/9KB，样例 FF、Release/,
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
          ageMs: 20 * 60 * 1000,
          errorCode: 'INVALID_RELEASE_INFO_SCHEMA',
          parseError: 'releaseInfo 必须是非空对象',
        },
      }],
    },
    error: '',
    selectedProject: 'mThor',
    selectedMilestone: 'Release',
    timelineSyncRuleUrl: 'https://jira.example/rule/123',
  });

  assert.match(diagnostic, /Timeline 缓存诊断/);
  assert.match(diagnostic, /项目: mThor/);
  assert.match(diagnostic, /状态: 缓存已过期/);
  assert.match(diagnostic, /最近同步失败（20 分钟前）：INVALID_RELEASE_INFO_SCHEMA - releaseInfo 必须是非空对象/);
  assert.match(diagnostic, /缓存 Milestone: FF、Release/);
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
