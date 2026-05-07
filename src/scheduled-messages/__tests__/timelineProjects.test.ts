import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIMELINE_PROJECT,
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
