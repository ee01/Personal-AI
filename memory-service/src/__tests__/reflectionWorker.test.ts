import { describe, expect, it } from 'vitest';

import { ReflectionWorker } from '../core/ReflectionWorker.js';
import type { ReflectionThreadRecord } from '../repositories/ReflectionThreadRepository.js';

describe('ReflectionWorker', () => {
  const thread: ReflectionThreadRecord = {
    id: 'thread-1',
    topicKey: 'project:orbit',
    title: '项目反思: Orbit',
    status: 'active',
    priority: 8,
    salience: 0.85,
    openQuestions: [],
    reflectionCount: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  it('defaults internal actions to auto execution when not explicitly manual', () => {
    const worker = new ReflectionWorker() as any;

    const confirmAction = worker.normalizeAction(
      {
        actionType: 'create_confirm_request',
        title: '需要你确认下一步',
      },
      thread,
    );
    expect(confirmAction?.executionMode).toBe('auto');
    expect(confirmAction?.requiresApproval).toBe(false);

    const outreachAction = worker.normalizeAction(
      {
        actionType: 'ask_external_user',
        title: '向 Maya 询问',
        params: {
          targetType: 'person',
          targetRef: 'maya',
          question: 'Can you confirm the current status?',
        },
      },
      thread,
    );
    expect(outreachAction?.executionMode).toBe('auto');
    expect(outreachAction?.requiresApproval).toBe(false);
  });
});
