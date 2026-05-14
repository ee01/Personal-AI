import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIMELINE_PROJECT,
  getTimelineSyncDryRunHelp,
  getTimelineSyncPayloadHelp,
  resolveTimelineProjectForSave,
} from '../timelineProjects.js';

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

test('Timeline sync payload help returns the exact Jira custom data for a project', () => {
  const help = getTimelineSyncPayloadHelp('Jupiter web');

  assert.equal(help?.project, 'Jupiter web');
  assert.equal(help?.paramKey, 'jupiterWeb');
  assert.equal(help?.variableName, 'jupiterWebReleaseInfo');
  assert.equal(help?.method, 'POST');
  assert.equal(help?.url, '{{WEB_APP_URL}}?action=cacheReleaseInfo');
  assert.equal(help?.contentType, 'application/json');
  assert.equal(
    help?.customBody,
    '{\n  "project": "jupiterWeb",\n  "releaseInfo": {{jupiterWebReleaseInfo.asJsonString}}\n}',
  );
});

test('Timeline sync dry-run help builds a safe Apps Script probe request', () => {
  const help = getTimelineSyncDryRunHelp({
    project: 'Jupiter web',
    webAppUrl: 'https://script.google.com/macros/s/example/exec',
  });

  assert.equal(help?.project, 'Jupiter web');
  assert.equal(help?.method, 'POST');
  assert.equal(help?.url, 'https://script.google.com/macros/s/example/exec?action=cacheReleaseInfo');
  assert.equal(help?.contentType, 'application/json');
  assert.match(help?.customBody || '', /"project": "jupiterWeb"/);
  assert.match(help?.customBody || '', /"dryRun": true/);
  assert.match(help?.customBody || '', /"FF": "12\/31\/2026"/);
  assert.match(help?.curlCommand || '', /curl -sS -X POST/);
  assert.match(help?.curlCommand || '', /Content-Type: application\/json/);
  assert.match(help?.curlCommand || '', /dryRun/);
});

test('Timeline sync dry-run help appends action to URLs with existing query strings', () => {
  const help = getTimelineSyncDryRunHelp({
    project: 'mThor',
    webAppUrl: 'https://script.google.com/macros/s/example/exec?debug=1',
  });

  assert.equal(help?.url, 'https://script.google.com/macros/s/example/exec?debug=1&action=cacheReleaseInfo');
});
