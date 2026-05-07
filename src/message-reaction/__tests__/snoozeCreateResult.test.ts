import test from 'node:test';
import assert from 'node:assert/strict';

import { getSnoozeCreateFailureMessage } from '../snoozeCreateResult.js';

test('snooze failure message suppresses duplicate toast after init prompt', () => {
  assert.equal(
    getSnoozeCreateFailureMessage({
      success: false,
      reason: 'not_initialized',
      error: '定时消息未初始化',
    }),
    null,
  );
});

test('snooze failure message suppresses duplicate toast while request is pending', () => {
  assert.equal(
    getSnoozeCreateFailureMessage({
      success: false,
      reason: 'request_pending',
      error: '正在创建或更新这条消息的提醒，请稍候',
    }),
    null,
  );
});

test('snooze failure message forwards actionable background errors', () => {
  assert.equal(
    getSnoozeCreateFailureMessage({
      success: false,
      reason: 'background_error',
      error: '请先在设置中初始化定时消息系统',
    }),
    '请先在设置中初始化定时消息系统',
  );
});

test('snooze failure message explains invalid reminder times', () => {
  assert.equal(
    getSnoozeCreateFailureMessage({
      success: false,
      reason: 'invalid_time',
    }),
    '请选择未来的提醒时间',
  );
});
