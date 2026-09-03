import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deliverAgentTaskRunNotifications,
  readLedgerNotifyConfig,
  shouldDeliverLedgerNotifications,
} from '../core/agentTaskNotification.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
import { composeNoticeMarkdown } from '../utils/botSender.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('Task Center home-lane delivery', () => {
  const db = getTestDb();
  const repo = new ActionRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM channel_delivery_records').run();
    vi.restoreAllMocks();
  });

  it('treats a Task Center agent row as a ledger notify candidate', () => {
    const action = repo.create({
      actionType: 'delegate_agent',
      title: '查 Jira',
      taskKind: 'agent',
      sourceKind: 'task_center',
      executionMode: 'auto',
    });
    expect(shouldDeliverLedgerNotifications(action)).toBe(true);
  });

  it('does not re-notify a reminder that already went through notify_user', () => {
    const action = repo.create({
      actionType: 'notify_user',
      title: '提醒我',
      taskKind: 'remind',
      executionMode: 'auto',
    });
    expect(shouldDeliverLedgerNotifications(action)).toBe(false);
  });

  it('reads plugin channel from the flatter Task Center payload', () => {
    const action = repo.create({
      actionType: 'delegate_agent',
      title: '查 Jira',
      taskKind: 'agent',
      params: {
        channel: 'plugin',
        successReceipt: true,
      },
    });
    expect(readLedgerNotifyConfig(action).notifyVia).toBe('plugin');
  });

  it('writes a Chrome notification record when via=plugin', async () => {
    const glip = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true });
    const action = repo.create({
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team',
      taskKind: 'agent',
      sourceKind: 'task_center',
      params: {
        task: '查 JQL',
        notifyVia: 'plugin',
        channel: 'plugin',
        metadata: { notifyVia: 'plugin', successReceipt: true },
      },
      executionMode: 'auto',
    });

    const result = await deliverAgentTaskRunNotifications({
      db,
      userId: 'esone.qiu',
      action,
      execution: {
        queueStatus: 'succeeded',
        result: { status: 'success', summary: '查到 3 条' },
      },
    });

    expect(result.delivered).toBeGreaterThan(0);
    expect(glip).not.toHaveBeenCalled();
    const row = db
      .prepare(`SELECT title, body, channel FROM notification_records LIMIT 1`)
      .get() as { title: string; body: string; channel: string };
    expect(row.channel).toBe('task_center');
    expect(row.title).toContain('Nova 缺少 Team');
    expect(row.body).toContain('查到 3 条');
  });

  it('records notifyDeliveryError without failing the run when Bot delivery fails', async () => {
    vi.spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip').mockResolvedValue({
      sent: false,
      error: 'bot not a member of target group',
    });
    const action = repo.create({
      actionType: 'delegate_agent',
      title: '同步 Committed',
      taskKind: 'agent',
      sourceKind: 'agent_task',
      params: {
        task: '同步',
        metadata: {
          notifyVia: 'bot',
          successReceipt: false,
          notifyTarget: { type: 'group', targetGroupId: '164506140678' },
        },
      },
      executionMode: 'auto',
    });

    const result = await deliverAgentTaskRunNotifications({
      db,
      userId: 'esone.qiu',
      action,
      execution: {
        queueStatus: 'succeeded',
        result: { status: 'success', summary: '已同步' },
      },
    });

    expect(result.delivered).toBe(0);
    expect(result.errors[0]).toContain('bot not a member');
    const stored = repo.getById(action.id);
    const metadata = stored?.params?.metadata as Record<string, unknown>;
    expect(String(metadata.notifyDeliveryError)).toContain('bot not a member');
  });

  it('keeps a 0-match write run out of the target chat and marks the ledger', async () => {
    const glip = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true });
    const action = repo.create({
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team 的 Epics（自动填入 INIT）',
      taskKind: 'agent',
      sourceKind: 'agent_task',
      params: {
        task: '回填 Team',
        mode: 'write',
        metadata: {
          notifyVia: 'bot',
          successReceipt: false,
          notifyTarget: { type: 'group', targetGroupId: '164506140678' },
        },
      },
      executionMode: 'auto',
    });

    const result = await deliverAgentTaskRunNotifications({
      db,
      userId: 'esone.qiu',
      action,
      execution: {
        queueStatus: 'succeeded',
        result: {
          status: 'success',
          summary: '10 个 Epic 的 INIT 都是多团队，未回填',
          artifacts: [
            {
              kind: 'query_result',
              title: 'Team 回填扫描结果：0 个 Epic 需更新',
              metadata: { sourceSystem: 'jira', matchCount: 0 },
            },
          ],
        },
      },
    });

    expect(glip).not.toHaveBeenCalled();
    expect(result.emptyResultSkipped).toBe(true);
    const stored = repo.getById(action.id);
    const metadata = stored?.params?.metadata as Record<string, any>;
    expect(metadata.notifyEmptyResultSkipped).toMatchObject({ mode: 'write' });
  });

  it('still pushes a 0-match write run when the task opted in', async () => {
    const glip = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true });
    const action = repo.create({
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team 的 Epics（自动填入 INIT）',
      taskKind: 'agent',
      sourceKind: 'agent_task',
      params: {
        task: '回填 Team',
        mode: 'write',
        metadata: {
          notifyVia: 'bot',
          successReceipt: false,
          notifyWhenEmpty: true,
          notifyTarget: { type: 'group', targetGroupId: '164506140678' },
        },
      },
      executionMode: 'auto',
    });

    const result = await deliverAgentTaskRunNotifications({
      db,
      userId: 'esone.qiu',
      action,
      execution: {
        queueStatus: 'succeeded',
        result: { status: 'success', summary: '未回填任何 Epic' },
      },
    });

    expect(result.delivered).toBe(1);
    expect(result.emptyResultSkipped).toBeUndefined();
    expect(glip).toHaveBeenCalled();
  });

  it('still pushes a 0-match read scan, which is the mode default', async () => {
    const glip = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true });
    const action = repo.create({
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team 的 Epics',
      taskKind: 'agent',
      sourceKind: 'agent_task',
      params: {
        task: '查找缺少 Team 的 Epic',
        mode: 'read',
        metadata: {
          notifyVia: 'bot',
          successReceipt: false,
          notifyTarget: { type: 'group', targetGroupId: '164506140678' },
        },
      },
      executionMode: 'auto',
    });

    const result = await deliverAgentTaskRunNotifications({
      db,
      userId: 'esone.qiu',
      action,
      execution: {
        queueStatus: 'succeeded',
        result: { status: 'success', summary: 'JQL 命中 0 张' },
      },
    });

    expect(result.delivered).toBe(1);
    expect(glip).toHaveBeenCalled();
  });

  it('sends group result notices as the body only, without 任务完成', async () => {
    const glip = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true });
    const action = repo.create({
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team 的 Epics',
      taskKind: 'agent',
      sourceKind: 'agent_task',
      params: {
        task: '查找缺少 Team 的 Epic',
        metadata: {
          notifyVia: 'bot',
          successReceipt: false,
          notifyTarget: { type: 'group', targetGroupId: '164506140678' },
        },
      },
      executionMode: 'auto',
    });

    await deliverAgentTaskRunNotifications({
      db,
      userId: 'esone.qiu',
      action,
      execution: {
        queueStatus: 'succeeded',
        result: {
          status: 'success',
          summary: 'JQL 命中 1 张',
          artifacts: [
            {
              kind: 'note',
              content: '* NOVA-7248 Debug @Tony Lin',
            },
          ],
        },
      },
    });

    expect(glip).toHaveBeenCalled();
    const payload = glip.mock.calls[0][0] as { title: string; body: string };
    expect(payload.title).toBe('');
    expect(payload.body).not.toContain('任务完成');
    expect(payload.body).toContain('Nova 缺少 Team 的 Epics');
    expect(payload.body).toContain('* NOVA-7248 Debug @Tony Lin');
    expect(composeNoticeMarkdown(payload.title, payload.body)).toBe(payload.body.trim());
  });
});
