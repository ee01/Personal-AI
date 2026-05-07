import test from 'node:test';
import assert from 'node:assert/strict';

import { getToolbarRuntimeActionError } from '../toolbarActionResult.js';

test('toolbar runtime action accepts successful background responses', () => {
  assert.equal(getToolbarRuntimeActionError({ success: true }, '打开失败'), null);
});

test('toolbar runtime action surfaces background error text', () => {
  assert.equal(
    getToolbarRuntimeActionError(
      { success: false, error: '窗口创建失败' },
      '打开失败',
    ),
    '窗口创建失败',
  );
});

test('toolbar runtime action falls back when response is missing or empty', () => {
  assert.equal(getToolbarRuntimeActionError(undefined, '打开失败'), '打开失败');
  assert.equal(
    getToolbarRuntimeActionError({ success: false, error: '   ' }, '打开失败'),
    '打开失败',
  );
});
