import type { MessageStatus } from './types';

export interface ScheduledMessageStatusToggleAction {
  canToggle: boolean;
  nextStatus?: Extract<MessageStatus, 'Active' | 'Paused'>;
  buttonLabel?: string;
  buttonIcon?: string;
  title: string;
}

export function getScheduledMessageStatusToggleAction(
  status: MessageStatus,
): ScheduledMessageStatusToggleAction {
  switch (status) {
    case 'Active':
      return {
        canToggle: true,
        nextStatus: 'Paused',
        buttonLabel: '暂停',
        buttonIcon: '⏸️',
        title: '暂停后执行器会跳过此消息',
      };
    case 'Paused':
      return {
        canToggle: true,
        nextStatus: 'Active',
        buttonLabel: '恢复',
        buttonIcon: '▶️',
        title: '恢复后消息会按当前排程继续执行',
      };
    case 'PendingReview':
      return {
        canToggle: false,
        title: '待审核消息请使用批准或拒绝，不能直接切换为 Active',
      };
    case 'Completed':
    case 'Done':
      return {
        canToggle: false,
        title: '已完成消息需要编辑为未来执行时间，或改成仍有下次执行的重复任务后恢复',
      };
    default:
      return {
        canToggle: false,
        title: '当前状态不支持直接切换',
      };
  }
}

export function assertScheduledMessageStatusCanToggle(status: MessageStatus): void {
  const action = getScheduledMessageStatusToggleAction(status);
  if (!action.canToggle) {
    throw new Error(action.title);
  }
}
