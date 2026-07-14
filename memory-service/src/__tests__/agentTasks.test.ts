import { describe, expect, it } from 'vitest';

import {
  normalizeAgentTaskNotifyTarget,
  resolveAgentTaskNotificationTarget,
} from '../routes/agentTasks.js';

describe('AgentTask notification target', () => {
  it('normalizes private Glip users for result notifications', () => {
    expect(
      normalizeAgentTaskNotifyTarget({
        type: 'private',
        glipUser: 'Esone Qiu',
      }),
    ).toMatchObject({
      type: 'private',
      targetUserId: 'esone.qiu',
      glipUser: 'Esone Qiu',
    });

    expect(
      normalizeAgentTaskNotifyTarget({
        glipUserName: 'esone.qiu@ringcentral.com+john.doe',
      }),
    ).toMatchObject({
      type: 'private',
      targetUserId: 'esone.qiu',
    });
  });

  it('keeps group targets distinct from private fallbacks', () => {
    const notifyTarget = normalizeAgentTaskNotifyTarget({
      type: 'group',
      glipTeamId: '1234567890',
      glipUser: 'Esone Qiu',
    });

    expect(notifyTarget).toMatchObject({
      type: 'group',
      targetGroupId: '1234567890',
    });
    expect(resolveAgentTaskNotificationTarget(notifyTarget, 'esone.qiu')).toEqual({
      type: 'group',
      targetGroupId: '1234567890',
      defaulted: false,
    });
  });

  it('defaults to the memory user when no Glip user is passed', () => {
    expect(resolveAgentTaskNotificationTarget(undefined, 'esone.qiu')).toEqual({
      type: 'private',
      targetUserId: 'esone.qiu',
      defaulted: true,
    });
  });

  it('falls back to bot runtime defaults only for the default user scope', () => {
    expect(resolveAgentTaskNotificationTarget(undefined, 'default')).toEqual({
      type: 'default_bot_config',
      defaulted: true,
    });
  });
});
