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

  assert.match(transcript, /请把以下信息存入随手记/);
  assert.match(transcript, /停车位置/);
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

  assert.match(transcript, /请在随手记中记录以下提醒/);
  assert.doesNotMatch(transcript, /不要长期记住/);
});
