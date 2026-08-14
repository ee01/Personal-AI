import { describe, expect, it } from 'vitest';

import {
  normalizeAgentTaskNotifyTarget,
  planAgentTaskNotifications,
  resolveAgentTaskNotificationTarget,
  resolveExplicitAgentTaskResultTarget,
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

  it('resolves only explicit result targets (no owner default)', () => {
    expect(resolveExplicitAgentTaskResultTarget(undefined)).toBeUndefined();
    expect(
      resolveExplicitAgentTaskResultTarget({
        type: 'group',
        targetGroupId: '148192141318',
      }),
    ).toEqual({
      type: 'group',
      targetGroupId: '148192141318',
      defaulted: false,
    });
  });
});

describe('AgentTask notification matrix', () => {
  const owner = 'esone.qiu';
  const groupTarget = {
    type: 'group' as const,
    targetGroupId: '148192141318',
    defaulted: false,
  };
  const otherPrivate = {
    type: 'private' as const,
    targetUserId: 'teammate.one',
    defaulted: false,
  };
  const ownerPrivate = {
    type: 'private' as const,
    targetUserId: owner,
    defaulted: false,
  };

  it('group + successReceipt: result to group + owner success receipt', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: true,
        resultTarget: groupTarget,
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'result',
        targetGroupId: '148192141318',
        useTemplate: true,
      },
      {
        kind: 'success_receipt',
        targetUserId: owner,
        useTemplate: false,
      },
    ]);
  });

  it('group + !successReceipt: result to group only', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: false,
        resultTarget: groupTarget,
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'result',
        targetGroupId: '148192141318',
        useTemplate: true,
      },
    ]);
  });

  it('owner private + successReceipt: merge into one templated result', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: true,
        resultTarget: ownerPrivate,
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'result',
        targetUserId: owner,
        useTemplate: true,
      },
    ]);
  });

  it('no result target + successReceipt: owner success receipt without template', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: true,
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'success_receipt',
        targetUserId: owner,
        useTemplate: false,
      },
    ]);
  });

  it('no result target + !successReceipt: silent success', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: false,
        ownerUserId: owner,
      }),
    ).toEqual([]);
  });

  it('failure always sends owner receipt even when successReceipt is false', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: false,
        notify: true,
        successReceipt: false,
        resultTarget: groupTarget,
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'failure_receipt',
        targetUserId: owner,
        useTemplate: false,
      },
    ]);
  });

  it('failure never delivers to notifyTarget', () => {
    const deliveries = planAgentTaskNotifications({
      succeeded: false,
      notify: true,
      successReceipt: true,
      resultTarget: otherPrivate,
      ownerUserId: owner,
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      kind: 'failure_receipt',
      targetUserId: owner,
    });
    expect(deliveries[0]?.targetGroupId).toBeUndefined();
  });

  it('notify:false suppresses all deliveries including failure', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: false,
        notify: false,
        successReceipt: true,
        resultTarget: groupTarget,
        ownerUserId: owner,
      }),
    ).toEqual([]);
  });

  it('ignores defaulted result targets (legacy owner fallback is not result notify)', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: true,
        resultTarget: {
          type: 'private',
          targetUserId: owner,
          defaulted: true,
        },
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'success_receipt',
        targetUserId: owner,
        useTemplate: false,
      },
    ]);
  });

  it('other private + successReceipt: result + owner receipt', () => {
    expect(
      planAgentTaskNotifications({
        succeeded: true,
        notify: true,
        successReceipt: true,
        resultTarget: otherPrivate,
        ownerUserId: owner,
      }),
    ).toEqual([
      {
        kind: 'result',
        targetUserId: 'teammate.one',
        useTemplate: true,
      },
      {
        kind: 'success_receipt',
        targetUserId: owner,
        useTemplate: false,
      },
    ]);
  });
});
