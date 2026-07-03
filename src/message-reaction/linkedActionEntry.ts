import type { PendingLinkedActionConfig } from '../modals/linkedActionHelpers';

export interface OpenLinkedActionConfigPayload {
  sender?: string;
  groupId?: string;
  groupName?: string;
  content?: string;
  messageId?: string;
  timestamp?: string | number;
  messageLink?: string;
}

export function buildPendingLinkedActionConfig(
  payload: OpenLinkedActionConfigPayload,
  requestedAt = Date.now(),
): PendingLinkedActionConfig {
  return {
    sender: payload.sender,
    groupId: payload.groupId,
    groupName: payload.groupName,
    content: payload.content,
    messageId: payload.messageId,
    timestamp: requestedAt,
    messageTimestamp: payload.timestamp,
    messageLink: payload.messageLink,
  };
}

export function buildLinkedActionConfigLaunchReceipt(): string {
  return [
    '已打开联动操作配置',
    '当前只是草稿入口，尚未创建 RuntimeAction、未调用 OpenClaw，也不会回扫历史消息',
    '只有保存规则且后续新消息命中后，才会进入动作队列并按连接状态和审批设置执行',
  ].join('；');
}
