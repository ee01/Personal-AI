import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidTimelineOffsetValue,
  parseTimelineOffsetInputValue,
} from '../timelineFormatting.js';

test('Timeline offset input only accepts complete integer values', () => {
  assert.equal(parseTimelineOffsetInputValue('-1'), -1);
  assert.equal(parseTimelineOffsetInputValue('0'), 0);
  assert.equal(parseTimelineOffsetInputValue('30'), 30);
  assert.equal(parseTimelineOffsetInputValue(''), undefined);
  assert.equal(parseTimelineOffsetInputValue('-'), undefined);
  assert.equal(parseTimelineOffsetInputValue('1.5'), undefined);
  assert.equal(parseTimelineOffsetInputValue('abc'), undefined);
});

test('Timeline offset validation enforces the supported day range', () => {
  assert.equal(isValidTimelineOffsetValue(-30), true);
  assert.equal(isValidTimelineOffsetValue(30), true);
  assert.equal(isValidTimelineOffsetValue('-1'), true);
  assert.equal(isValidTimelineOffsetValue(-31), false);
  assert.equal(isValidTimelineOffsetValue(31), false);
  assert.equal(isValidTimelineOffsetValue('1.5'), false);
  assert.equal(isValidTimelineOffsetValue(undefined), false);
});
