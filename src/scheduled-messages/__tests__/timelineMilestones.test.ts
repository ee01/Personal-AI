import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimelineMilestoneOptions,
  formatTimelineMilestoneKeys,
  isTimelineMilestoneMissingFromCache,
} from '../timelineMilestones.js';

test('Timeline milestone options follow current cache keys when cache is ready', () => {
  const options = buildTimelineMilestoneOptions(['Release', 'FF', 'Custom Gate']);

  assert.deepEqual(options.map(option => option.value), ['FF', 'Release', 'Custom Gate']);
  assert.equal(options.find(option => option.value === 'FF')?.label, '🎯 FF');
  assert.equal(options.find(option => option.value === 'Custom Gate')?.label, 'Custom Gate');
});

test('Timeline milestone options keep the selected missing value visible', () => {
  const options = buildTimelineMilestoneOptions(['FF', 'Release'], 'Regression');

  assert.deepEqual(options.map(option => option.value), ['FF', 'Release', 'Regression']);
  assert.match(options[2].label, /当前缓存缺失/);
});

test('Timeline milestone missing check only blocks when cache keys are known', () => {
  assert.equal(isTimelineMilestoneMissingFromCache('Regression', ['FF', 'Release']), true);
  assert.equal(isTimelineMilestoneMissingFromCache('FF', ['FF', 'Release']), false);
  assert.equal(isTimelineMilestoneMissingFromCache('Regression', []), false);
  assert.equal(isTimelineMilestoneMissingFromCache('Regression', undefined), false);
});

test('Timeline milestone key formatter de-duplicates display names', () => {
  assert.equal(formatTimelineMilestoneKeys(['FF', 'Release', 'FF']), 'FF / Release');
  assert.equal(formatTimelineMilestoneKeys([]), '无可用 Milestone');
});
