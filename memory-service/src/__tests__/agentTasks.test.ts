import { describe, expect, it } from 'vitest';

import {
  buildAgentTaskResultAnnouncementBody,
  deliverAgentTaskAsMeNotice,
  normalizeAgentTaskNotifyTarget,
  normalizeAgentTaskNotifyVia,
  normalizeAsMeSenderCredentials,
  planAgentTaskNotifications,
  resolveAgentTaskDeliveryVia,
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

describe('AgentTask notifyVia', () => {
  it('normalizes unknown values to bot', () => {
    expect(normalizeAgentTaskNotifyVia(undefined)).toBe('bot');
    expect(normalizeAgentTaskNotifyVia('BOT')).toBe('bot');
    expect(normalizeAgentTaskNotifyVia('asme')).toBe('asme');
  });

  it('requires Sheet AsMe sender credentials', () => {
    expect(normalizeAsMeSenderCredentials(undefined)).toBeUndefined();
    expect(
      normalizeAsMeSenderCredentials({
        clientId: 'id',
        clientSecret: 'secret',
      }),
    ).toBeUndefined();
    expect(
      normalizeAsMeSenderCredentials({
        clientId: 'id',
        clientSecret: 'secret',
        jwt: 'jwt-token',
      }),
    ).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      jwt: 'jwt-token',
    });
  });

  it('only success result deliveries use AsMe', () => {
    expect(resolveAgentTaskDeliveryVia('result', 'asme')).toBe('asme');
    expect(resolveAgentTaskDeliveryVia('success_receipt', 'asme')).toBe('bot');
    expect(resolveAgentTaskDeliveryVia('failure_receipt', 'asme')).toBe('bot');
    expect(resolveAgentTaskDeliveryVia('result', 'bot')).toBe('bot');
  });

  it('sends group results through the user RingCentral client', async () => {
    const sendMessage = async (input: { targetType: string; targetRef: string; text: string }) => {
      expect(input.targetType).toBe('group');
      expect(input.targetRef).toBe('148192141318');
      expect(input.text).toContain('帮我做完成');
      return { chatId: '148192141318', postId: 'post-1' };
    };
    const result = await deliverAgentTaskAsMeNotice({
      ringClient: {
        isConfigured: () => true,
        resolveTarget: async () => ({ status: 'unresolved' }),
        resolveDirectConversationChatId: async () => null,
        sendMessage,
      },
      title: '帮我做完成: Daily',
      body: 'done',
      targetGroupId: '148192141318',
    });
    expect(result).toMatchObject({ sent: true, chatId: '148192141318', postId: 'post-1' });
  });

  it('resolves private users before sending', async () => {
    const result = await deliverAgentTaskAsMeNotice({
      ringClient: {
        isConfigured: () => true,
        resolveTarget: async () => ({
          status: 'resolved',
          resolved: { kind: 'user', entityId: 'ext-1' },
        }),
        resolveDirectConversationChatId: async (entityId: string) => {
          expect(entityId).toBe('ext-1');
          return 'dm-9';
        },
        sendMessage: async (input) => {
          expect(input.targetResolvedChatId).toBe('dm-9');
          return { chatId: 'dm-9', postId: 'post-2' };
        },
      },
      title: '帮我做完成: Daily',
      body: 'done',
      targetUserId: 'teammate.one',
    });
    expect(result).toMatchObject({ sent: true, chatId: 'dm-9', postId: 'post-2' });
  });

  it('does not fall back to Bot when RingCentral is missing', async () => {
    const result = await deliverAgentTaskAsMeNotice({
      ringClient: {
        isConfigured: () => false,
        resolveTarget: async () => ({ status: 'unresolved' }),
        resolveDirectConversationChatId: async () => null,
        sendMessage: async () => {
          throw new Error('should not send');
        },
      },
      title: '帮我做完成: Daily',
      body: 'done',
      targetUserId: 'teammate.one',
    });
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/RingCentral not configured/i);
  });
});

describe('buildAgentTaskResultAnnouncementBody', () => {
  it('never includes the owner receipt boilerplate (Run id, trigger source, Sheet boundary)', () => {
    const body = buildAgentTaskResultAnnouncementBody({
      title: 'Nova 缺少 Assignee 的 INIT',
      summary: '对于2026-Q3，Nova teams filter 中共有111个INIT Initiative，但全部已有assignee，无需更新。',
    });

    expect(body).toBe(
      'Nova 缺少 Assignee 的 INIT\n对于2026-Q3，Nova teams filter 中共有111个INIT Initiative，但全部已有assignee，无需更新。',
    );
    expect(body).not.toMatch(/Run:/);
    expect(body).not.toMatch(/触发:/);
    expect(body).not.toMatch(/边界:/);
    expect(body).not.toMatch(/状态:/);
  });

  it('falls back to just the title when there is no summary', () => {
    expect(buildAgentTaskResultAnnouncementBody({ title: 'Daily sync' })).toBe('Daily sync');
  });
});
