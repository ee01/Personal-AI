import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContinueFollowupRunSummary,
  buildGlipMessageUrl,
  parseOutreachContinueSessionId,
} from '../outreachResultReceipt.js';

test('parseOutreachContinueSessionId reads the bot receipt marker', () => {
  const sessionId = 'f1ed8986-c549-4922-96d0-1ba362fbf14d';
  assert.equal(
    parseOutreachContinueSessionId(
      `结果：超时\n继续追问：在本条 Bot 回执上点「继续追问」\npai-outreach-continue:${sessionId}`,
    ),
    sessionId,
  );
  assert.equal(parseOutreachContinueSessionId('no marker here'), undefined);
});

test('buildGlipMessageUrl encodes chat and post ids', () => {
  assert.equal(
    buildGlipMessageUrl('chat-1', 'post-2'),
    'https://app.ringcentral.com/messages/chat-1/post-2',
  );
  assert.equal(buildGlipMessageUrl('', 'post-2'), '');
});

test('buildContinueFollowupRunSummary states wait then bump', () => {
  assert.match(
    buildContinueFollowupRunSummary({ intervalHours: 24, maxFollowup: 2 }),
    /等待 24 小时再追问，最多再追问 2 次/,
  );
});
