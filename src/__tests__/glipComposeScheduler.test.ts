import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildComposeScheduleRequest,
  buildComposeScheduleTopic,
  buildQuickScheduleOptions,
  hasUnsupportedTeamMentionText,
  normalizeGlipPersonNameForStorage,
} from '../glipComposeScheduler.js';

test('normalizes Glip person mentions to scheduled message storage format', () => {
  assert.equal(normalizeGlipPersonNameForStorage('@Esone Qiu'), 'esone.qiu');
  assert.equal(normalizeGlipPersonNameForStorage('esone.qiu'), 'esone.qiu');
  assert.equal(
    normalizeGlipPersonNameForStorage('Esone.Qiu@ringcentral.com'),
    'esone.qiu',
  );
});

test('detects unsupported team-like mentions without blocking normal mentions', () => {
  assert.equal(hasUnsupportedTeamMentionText('hi @team please check'), true);
  assert.equal(hasUnsupportedTeamMentionText('@all release update'), true);
  assert.equal(hasUnsupportedTeamMentionText('hi @esone.qiu please check'), false);
});

test('builds a concise scheduled compose topic from message content', () => {
  assert.equal(
    buildComposeScheduleTopic('Please check this release plan\nsecond line'),
    '定时发送: Please check this release plan',
  );
  assert.equal(buildComposeScheduleTopic(''), '定时发送消息');
});

test('quick schedule options are future times relative to the supplied clock', () => {
  const now = new Date('2026-05-26T10:00:00');
  const options = buildQuickScheduleOptions(now);

  assert.deepEqual(
    options.map((option) => option.label),
    ['1 分钟后', '30 分钟后', '1 小时后', '明天 9 点'],
  );
  assert.equal(options.every((option) => option.date.getTime() > now.getTime()), true);
});

test('builds scheduled compose create request payload', () => {
  const request = buildComposeScheduleRequest({
    content: 'hi @esone.qiu',
    scheduledAt: new Date('2026-05-26T10:30:00.000Z'),
    sourceUrl: 'https://app.ringcentral.com/messages/123',
    target: {
      chatId: '123',
      targetType: 'private',
      glipUserName: 'esone.qiu',
      label: 'Esone Qiu',
      isThreadReply: false,
    },
    warnings: {
      hasMentions: true,
      unsupportedTeamMention: false,
      unresolvedMentions: [],
    },
  });

  assert.equal(request.topic, '定时发送: hi @esone.qiu');
  assert.equal(request.chatId, '123');
  assert.equal(request.targetType, 'private');
  assert.equal(request.glipUserName, 'esone.qiu');
  assert.equal(request.sourceUrl, 'https://app.ringcentral.com/messages/123');
  assert.equal(request.warnings.hasMentions, true);
});
