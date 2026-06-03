import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIMELINE_PROJECT,
  getTimelineSyncDryRunHelp,
  getTimelineSyncPayloadHelp,
  normalizeTimelineProjectValue,
  resolveTimelineProjectForSave,
} from '../timelineProjects.js';

test('Timeline project normalization accepts display names and Jira param keys', () => {
  assert.equal(normalizeTimelineProjectValue('Jupiter web'), 'Jupiter web');
  assert.equal(normalizeTimelineProjectValue('jupiterWeb'), 'Jupiter web');
  assert.equal(normalizeTimelineProjectValue('Unknown'), undefined);
});

test('Timeline trigger saves the selected project only when it is valid', () => {
  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: true,
      pushMethod: 'Bot',
      hasProjectVariables: false,
      timelineProject: 'Nova',
    }),
    'Nova',
  );

  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: true,
      pushMethod: 'Bot',
      hasProjectVariables: false,
      timelineProject: 'jupiterWeb',
    }),
    'Jupiter web',
  );

  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: true,
      pushMethod: 'Bot',
      hasProjectVariables: false,
      timelineProject: 'Unknown',
    }),
    undefined,
  );
});

test('Bot and AI project variables persist a project even for time-triggered messages', () => {
  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: false,
      pushMethod: 'AI',
      hasProjectVariables: true,
      timelineProject: 'Jupiter web',
    }),
    'Jupiter web',
  );

  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: false,
      pushMethod: 'Bot',
      hasProjectVariables: true,
      timelineProject: 'jupiterWeb',
    }),
    'Jupiter web',
  );

  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: false,
      pushMethod: 'Bot',
      hasProjectVariables: true,
      timelineProject: undefined,
    }),
    DEFAULT_TIMELINE_PROJECT,
  );
});

test('AsMe and messages without project variables do not save timeline project context', () => {
  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: false,
      pushMethod: 'AsMe',
      hasProjectVariables: true,
      timelineProject: 'mThor',
    }),
    undefined,
  );

  assert.equal(
    resolveTimelineProjectForSave({
      isTimelineTrigger: false,
      pushMethod: 'Bot',
      hasProjectVariables: false,
      timelineProject: 'mThor',
    }),
    undefined,
  );
});

test('Timeline sync payload help returns the exact Jira GET request for a project', () => {
  const help = getTimelineSyncPayloadHelp('Jupiter web');

  assert.equal(help?.project, 'Jupiter web');
  assert.equal(help?.paramKey, 'jupiterWeb');
  assert.equal(help?.variableName, 'jupiterWebReleaseInfo');
  assert.equal(help?.method, 'GET');
  assert.equal(
    help?.url,
    '{{WEB_APP_URL}}?action=cacheReleaseInfo&project=jupiterWeb&releaseInfo={{jupiterWebReleaseInfo.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}',
  );
  assert.equal(help?.contentType, 'empty');
  assert.equal(help?.customBody, '');
});

test('Timeline sync dry-run help builds a safe Apps Script probe request', () => {
  const help = getTimelineSyncDryRunHelp({
    project: 'Jupiter web',
    webAppUrl: 'https://script.google.com/macros/s/example/exec',
    milestone: 'Release',
  });

  assert.equal(help?.project, 'Jupiter web');
  assert.equal(help?.sampleMilestone, 'Release');
  assert.equal(help?.method, 'GET');
  assert.match(help?.url || '', /^https:\/\/script\.google\.com\/macros\/s\/example\/exec\?action=cacheReleaseInfo&project=jupiterWeb&dryRun=true&releaseInfo=/);
  assert.match(decodeURIComponent(help?.url || ''), /"Release":"12\/31\/2026"/);
  assert.equal(help?.contentType, 'empty');
  assert.equal(help?.customBody, '');
  assert.match(help?.curlCommand || '', /^curl -sS /);
  assert.match(help?.curlCommand || '', /dryRun=true/);
});

test('Timeline sync dry-run help falls back to FF when no milestone is selected', () => {
  const help = getTimelineSyncDryRunHelp({
    project: 'mThor',
    webAppUrl: 'https://script.google.com/macros/s/example/exec',
  });

  assert.equal(help?.sampleMilestone, 'FF');
  assert.match(decodeURIComponent(help?.url || ''), /"FF":"12\/31\/2026"/);
});

test('Timeline sync dry-run help appends action to URLs with existing query strings', () => {
  const help = getTimelineSyncDryRunHelp({
    project: 'mThor',
    webAppUrl: 'https://script.google.com/macros/s/example/exec?debug=1',
  });

  assert.match(help?.url || '', /^https:\/\/script\.google\.com\/macros\/s\/example\/exec\?debug=1&action=cacheReleaseInfo&project=mThor&dryRun=true&releaseInfo=/);
});
