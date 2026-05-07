import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterDoubaoSyncMessages,
  isPersonalAiSyncUserMessage,
} from '../explorer/sources/doubaoSyncFilter.js';
import type { RawMessageRecord } from '../explorer/types.js';

function makeMessage(
  overrides: Partial<RawMessageRecord> & {
    role: string;
    content: string;
  },
  index = 0,
): RawMessageRecord {
  return {
    source: 'doubao',
    conversationId: overrides.conversationId ?? 'conv-1',
    messageId: overrides.messageId ?? `msg-${index}`,
    ts: overrides.ts ?? new Date().toISOString(),
    role: overrides.role,
    contentHash: overrides.contentHash ?? `hash-${index}`,
    content: overrides.content,
  };
}

test('isPersonalAiSyncUserMessage matches all known sync prefixes', () => {
  const samples = [
    '建立长期记忆同步线程。后续我会同步...',
    '请把以下长期稳定信息存入随手记：- A',
    '请把以下近期记忆重点记录到随手记：',
    '请把以下近期重点记录到随手记：',
    '请把以下信息存入随手记：',
    '请把以下内容存入随手记：',
    '请在随手记中记录以下待办事项：- todo',
    '下面是一些通知推送，请不要记录为待办，也不要当作长期记忆。',
    '问题：今天天气怎么样\n服务端检索结论：晴天',
    '📚 长期记忆同步\n\n📊 类型分布:',
    '📦 随手记同步 (3 条)',
    '📋 随手记概览:\n',
  ];
  for (const sample of samples) {
    assert.equal(
      isPersonalAiSyncUserMessage(sample),
      true,
      `expected sync match for: ${sample.slice(0, 24)}`,
    );
  }
});

test('isPersonalAiSyncUserMessage ignores ordinary user content', () => {
  const samples = [
    '帮我推荐一道川菜',
    '请帮我写一段 SQL',
    '问题不大，先这样吧',
    '',
  ];
  for (const sample of samples) {
    assert.equal(isPersonalAiSyncUserMessage(sample), false);
  }
});

test('filterDoubaoSyncMessages drops sync user message and assistant ack pair', () => {
  const messages = [
    makeMessage(
      { role: 'user', content: '请把以下长期稳定信息存入随手记：- A' },
      0,
    ),
    makeMessage({ role: 'assistant', content: '已存入随手记。' }, 1),
    makeMessage({ role: 'user', content: '今天上海天气如何？' }, 2),
    makeMessage(
      { role: 'assistant', content: '今天上海多云，最高 25 度。' },
      3,
    ),
  ];

  const { kept, filteredCount, conversationDropped } =
    filterDoubaoSyncMessages(messages);

  assert.equal(conversationDropped, false);
  assert.equal(filteredCount, 2);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].content, '今天上海天气如何？');
  assert.equal(kept[1].role, 'assistant');
});

test('filterDoubaoSyncMessages does not drop assistant turn that is not an ack', () => {
  const messages = [
    makeMessage({ role: 'user', content: '帮我列张清单' }, 0),
    makeMessage(
      { role: 'user', content: '请把以下信息存入随手记：- A' },
      1,
    ),
    makeMessage({ role: 'user', content: '继续帮我写' }, 2),
    makeMessage({ role: 'assistant', content: '好的，下面是清单...' }, 3),
  ];

  const { kept, filteredCount } = filterDoubaoSyncMessages(messages);

  assert.equal(filteredCount, 1);
  // The trailing assistant reply is preserved because it follows a normal user turn,
  // not the sync push (the dropNextAssistant flag is reset by the next user message).
  assert.deepEqual(
    kept.map((m) => m.content),
    ['帮我列张清单', '继续帮我写', '好的，下面是清单...'],
  );
});

test('filterDoubaoSyncMessages drops the entire conversation when bound', () => {
  const messages = [
    makeMessage(
      { role: 'user', content: '一些随便的内容', conversationId: 'thread-1' },
      0,
    ),
    makeMessage(
      { role: 'assistant', content: '回复', conversationId: 'thread-1' },
      1,
    ),
  ];

  const { kept, filteredCount, conversationDropped } =
    filterDoubaoSyncMessages(messages, {
      boundConversationIds: new Set(['thread-1']),
    });

  assert.equal(conversationDropped, true);
  assert.equal(filteredCount, 2);
  assert.equal(kept.length, 0);
});

test('filterDoubaoSyncMessages keeps everything when no rules match', () => {
  const messages = [
    makeMessage({ role: 'user', content: '聊聊近况' }, 0),
    makeMessage({ role: 'assistant', content: '好啊' }, 1),
  ];

  const { kept, filteredCount, conversationDropped } =
    filterDoubaoSyncMessages(messages);

  assert.equal(conversationDropped, false);
  assert.equal(filteredCount, 0);
  assert.equal(kept.length, 2);
});
