import assert from 'node:assert/strict';
import test from 'node:test';

import { smartFormat } from '../memoFormatter.js';

test('smartFormat uses explicit memo wording for stable-memory sync', () => {
  const transcript = smartFormat(
    [
      {
        type: 'parking',
        title: '停车位置',
        content: '我车停在 B2 层 A 区 123 号',
        metadata: {
          location: 'B2 A123',
          source: 'memory_service',
        },
      },
    ],
    'stable',
  );

  assert.match(
    transcript,
    /来自 Personal AI \(私人 AI\) 的长期记忆信息存入随手记/,
  );
  assert.match(transcript, /停车位置/);
});

test('smartFormat uses explicit source wording for briefing sync', () => {
  const transcript = smartFormat(
    [
      {
        type: 'note',
        title: '项目 A 卡在接口联调',
        content: '项目 A 卡在接口联调，本周优先处理发布问题。',
      },
    ],
    'briefing',
  );

  assert.match(
    transcript,
    /来自 Personal AI \(私人 AI\) 的近期重点记录到随手记/,
  );
  assert.match(transcript, /项目 A 卡在接口联调/);
});

test('smartFormat uses explicit memo wording for reminder sync', () => {
  const transcript = smartFormat(
    [
      {
        type: 'todo',
        title: '明天上午十点周会',
        content: '明天上午十点周会',
        metadata: {
          dueDate: '2026-04-01T10:00:00',
          importance: 'medium',
        },
      },
    ],
    'reminder',
  );

  assert.match(
    transcript,
    /来自 Personal AI \(私人 AI\) 的待办事项记录到随手记/,
  );
  assert.doesNotMatch(transcript, /不要长期记住/);
  assert.doesNotMatch(transcript, /✅/);
});
