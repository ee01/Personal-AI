import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFollowupAskRunSummary,
  buildFollowupAskSubmittingMessage,
  buildFollowupAskToastMessage,
} from '../followupAskPresentation.js';

test('buildFollowupAskSubmittingMessage keeps the pending state side-effect boundary visible', () => {
  const message = buildFollowupAskSubmittingMessage();

  assert.match(message, /正在创建或复用跟进会话/);
  assert.match(message, /不会发送追问/);
  assert.match(message, /不写 Google Sheet/);
  assert.match(message, /不创建可复用 Outreach template/);
  assert.match(message, /先检查原消息线程/);
  assert.match(message, /刷新本地跟进标注/);
});

test('buildFollowupAskSubmittingMessage explains zero automatic followup mode', () => {
  const message = buildFollowupAskSubmittingMessage({ maxFollowup: 0 });

  assert.match(message, /正在创建或复用跟进会话/);
  assert.match(message, /最多追问次数为 0/);
  assert.match(message, /只检查完成标准/);
  assert.match(message, /不会自动发送 AI 追问/);
});

test('buildFollowupAskRunSummary updates max followup semantics', () => {
  const zeroMessage = buildFollowupAskRunSummary({
    messageCreatedAt: 1_700_000_000,
    intervalHours: 24,
    maxFollowup: 0,
    nowSeconds: 1_700_000_000,
    timeZone: 'UTC',
  });

  assert.match(zeroMessage, /预计/);
  assert.match(zeroMessage, /最多追问次数为 0/);
  assert.match(zeroMessage, /不自动发送 AI 追问/);
  assert.doesNotMatch(zeroMessage, /后追问/);

  const boundedMessage = buildFollowupAskRunSummary({
    messageCreatedAt: 1_700_000_000,
    intervalHours: 24,
    maxFollowup: 2,
    nowSeconds: 1_700_000_000,
    timeZone: 'UTC',
  });

  assert.match(boundedMessage, /最多自动追问 2 次/);
});

test('buildFollowupAskToastMessage explains new message followup boundaries', () => {
  const message = buildFollowupAskToastMessage({
    created: true,
    session: {
      status: 'waiting_reply',
      nextCheckAt: 1_700_000_000,
      waitUntil: 1_700_003_600,
    },
  }, {
    nowSeconds: 1_700_000_000,
    timeZone: 'UTC',
  });

  assert.match(message, /已创建跟进会话/);
  assert.match(message, /未立刻发送追问/);
  assert.match(message, /先检查原消息线程/);
  assert.match(message, /最早/);
  assert.match(message, /后追问/);
});

test('buildFollowupAskToastMessage keeps zero followup success as check-only', () => {
  const message = buildFollowupAskToastMessage({
    created: true,
    session: {
      status: 'waiting_reply',
      nextCheckAt: 1_700_000_000,
      waitUntil: 1_700_003_600,
    },
  }, {
    nowSeconds: 1_700_000_000,
    timeZone: 'UTC',
    maxFollowup: 0,
  });

  assert.match(message, /已创建跟进会话/);
  assert.match(message, /未立刻发送追问/);
  assert.match(message, /再次检查/);
  assert.match(message, /最多追问次数为 0/);
  assert.match(message, /不会自动发送 AI 追问/);
  assert.doesNotMatch(message, /后追问/);
});

test('buildFollowupAskToastMessage can show a future check time', () => {
  const message = buildFollowupAskToastMessage({
    created: true,
    session: {
      status: 'deferred',
      nextCheckAt: 1_700_003_600,
    },
  }, {
    nowSeconds: 1_700_000_000,
    timeZone: 'UTC',
  });

  assert.match(message, /下一次检查/);
  assert.match(message, /11\/14/);
});

test('buildFollowupAskToastMessage preserves existing goal on duplicate session', () => {
  const message = buildFollowupAskToastMessage({
    created: false,
    session: {
      renderedContext:
        '确认最终发布日期和是否需要额外资源，同时确认 owner、上线窗口和客户通知口径，超过长度后应该省略',
      waitUntil: 1_700_000_030,
    },
  }, {
    nowSeconds: 1_700_000_000,
    timeZone: 'UTC',
  });

  assert.match(message, /已有跟进/);
  assert.match(message, /未覆盖原目标/);
  assert.match(message, /确认最终发布日期/);
  assert.match(message, /当前检查轮次后追问/);
});
