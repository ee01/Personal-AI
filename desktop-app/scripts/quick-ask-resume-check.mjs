import assert from 'node:assert/strict';

import {
  ASK_RESUME_STORAGE_KEY,
  ASK_RESUME_TTL_MS,
  clearAskResumeSnapshot,
  createAskResumeSnapshot,
  loadAskResumeSnapshot,
  saveAskResumeSnapshot,
  toAskResumeContextHints,
} from '../app/quick-ask-resume.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const now = Date.parse('2026-07-15T02:00:00.000Z');
const storage = createStorage();
const snapshot = createAskResumeSnapshot({
  now,
  query:
    'MTR-141852 下一步找谁？ email=esone@example.com access_token=secret-value-123456',
  result: {
    answer:
      '先确认 backend owner。Bearer abcdefghijklmnop，联系人 +1 (415) 555-1234，详情 https://example.com/path?token=private#section',
    contextMatch: {
      state: 'locked',
      selectedTopic: {
        id: 'topic-ai-vbg',
        label: 'MTR-141852: AI Custom VBG',
        score: 0.91,
      },
    },
    evidence: [
      {
        id: 'jira:MTR-141852',
        type: 'jira',
        sourceTitle: 'MTR-141852: AI Custom VBG',
      },
    ],
  },
});

assert.ok(snapshot);
assert.equal(snapshot.localOnly, true);
assert.equal(snapshot.lastUserMessage.redacted, true);
assert.match(snapshot.lastUserMessage.textPreview, /\[邮箱已隐藏\]/);
assert.doesNotMatch(JSON.stringify(snapshot), /secret-value|abcdefghijklmnop|555-1234|token=private/);
assert.deepEqual(snapshot.riskFlags, ['sensitive', 'long_transcript_redacted']);

assert.ok(saveAskResumeSnapshot(snapshot, storage));
assert.ok(storage.getItem(ASK_RESUME_STORAGE_KEY));
const loaded = loadAskResumeSnapshot(storage, now + ASK_RESUME_TTL_MS - 1);
assert.equal(loaded?.topic?.title, 'MTR-141852: AI Custom VBG');
assert.equal(loaded?.evidenceRefs[0]?.id, 'jira:MTR-141852');

const hints = toAskResumeContextHints(loaded);
assert.deepEqual(hints, {
  source: 'local_ask_resume_snapshot',
  localOnly: true,
  updatedAt: '2026-07-15T02:00:00.000Z',
  topicTitle: 'MTR-141852: AI Custom VBG',
  previousQuestion:
    'MTR-141852 下一步找谁？ email=[邮箱已隐藏] access_token=[已隐藏]',
  previousAnswerSummary:
    '先确认 backend owner。Bearer [已隐藏]，联系人 [电话已隐藏]，详情 https://example.com/path',
  evidenceRefs: ['jira:MTR-141852'],
});

assert.equal(loadAskResumeSnapshot(storage, now + ASK_RESUME_TTL_MS), null);
assert.equal(storage.getItem(ASK_RESUME_STORAGE_KEY), null);
assert.equal(clearAskResumeSnapshot(storage), true);

storage.setItem(ASK_RESUME_STORAGE_KEY, '{broken');
assert.equal(loadAskResumeSnapshot(storage, now), null);
assert.equal(storage.getItem(ASK_RESUME_STORAGE_KEY), null);

console.log('Quick Ask resume storage check passed.');
