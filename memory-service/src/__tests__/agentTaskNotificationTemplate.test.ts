import { describe, expect, it, vi, beforeEach } from 'vitest';

const delegateMock = vi.fn();

vi.mock('../integrations/OpenClawDelegationService.js', () => ({
  OpenClawDelegationService: vi.fn().mockImplementation(() => ({
    delegate: delegateMock,
  })),
}));

import { formatSuccessNotificationWithTemplate } from '../routes/agentTasks.js';

describe('formatSuccessNotificationWithTemplate', () => {
  beforeEach(() => {
    delegateMock.mockReset();
  });

  const baseInput = {
    template: '已按当前季度检查并同步 Committed；0 个则说明无需更新',
    title: 'Nova Committed 的 INIT 同步 Epic Commit=Yes',
    task: '同步 Committed 字段',
    defaultBody: '任务: ...\n状态: success\n结果: 已同步',
    userDataManager: {},
    userId: 'esone.qiu',
    taskId: 'agent_task_1',
    actionId: 'action-1',
  };

  it('returns the templated summary on a usable success outcome', async () => {
    delegateMock.mockResolvedValue({
      status: 'success',
      summary: '已按模板整理好的通知文案',
      artifacts: [],
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toBe('已按模板整理好的通知文案');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('falls back to the default body AND logs why when the delegate returns a non-success status', async () => {
    // Mirrors what happens when the OpenClaw gateway is mid-readiness-gate or
    // otherwise degraded: the formatting sub-call comes back non-success
    // without throwing, so nothing upstream would ever see it unless this
    // path logs it itself.
    delegateMock.mockResolvedValue({
      status: 'auth_error',
      summary: '',
      artifacts: [],
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toBe(baseInput.defaultBody);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const [context, message] = log.warn.mock.calls[0];
    expect(message).toMatch(/did not return a usable summary/);
    expect(context).toMatchObject({
      taskId: 'agent_task_1',
      actionId: 'action-1',
      delegationStatus: 'auth_error',
      hasSummary: false,
    });
  });

  it('falls back to the default body AND logs why when the delegate returns success with an empty summary', async () => {
    delegateMock.mockResolvedValue({ status: 'success', summary: '   ', artifacts: [] });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toBe(baseInput.defaultBody);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toMatchObject({ delegationStatus: 'success', hasSummary: false });
  });

  it('falls back to the default body AND logs why when the delegate call throws', async () => {
    delegateMock.mockRejectedValue(new Error('gateway unreachable'));
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toBe(baseInput.defaultBody);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const [context, message] = log.warn.mock.calls[0];
    expect(message).toMatch(/threw/);
    expect(context).toMatchObject({ taskId: 'agent_task_1', actionId: 'action-1' });
    expect((context as any).err).toBeInstanceOf(Error);
  });

  it('skips the delegate call entirely for a blank template', async () => {
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({
      ...baseInput,
      template: '   ',
      log,
    });

    expect(body).toBe(baseInput.defaultBody);
    expect(delegateMock).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });
});
