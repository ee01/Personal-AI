export type SnoozeSuccessToastActionKind = 'undo' | 'manage';

export interface SnoozeSuccessToastActionView {
  kind: SnoozeSuccessToastActionKind;
  label: string;
}

export type SnoozeSuccessToastReceipt =
  | '可撤销；管理会定位到这条提醒'
  | '管理会打开 Snooze 列表确认'
  | '同一条消息的旧提醒已改期；管理会定位到原提醒';

export const SNOOZE_MARKER_SYNC_NOTICE =
  '原消息标注会随后台同步刷新，当前页面可能短暂仍显示旧快照';

export const SNOOZE_UNDO_BOUNDARY_NOTICE =
  '只删除这条未完成 Snooze；不会删除原消息、其他定时消息或改写记忆';

export const SNOOZE_UNDO_FAILURE_NOTICE =
  '提醒可能仍在 Snooze 队列；请从管理入口定位确认或删除';

export const SNOOZE_PENDING_NO_DUPLICATE_NOTICE =
  '已有同源 Snooze 请求处理中；这次点击没有创建第二条提醒、没有改期、没有写记忆或发送 Bot 消息';

export const SNOOZE_PENDING_RECOVERY_NOTICE =
  '首个请求完成后会显示结果；若页面一直无变化，可从管理入口确认 Snooze 队列';

export interface SnoozeSuccessToastMessageOptions {
  updated: boolean;
  timeLabel: string;
  messageId?: string;
  translate?: (value: string) => string;
  separator?: string;
}

export interface SnoozeManagerOpenRequestData {
  category: 'Snooze';
  messageId?: string;
}

export interface SnoozeUndoToastMessageOptions {
  timeLabel: string;
  translate?: (value: string) => string;
  separator?: string;
}

export interface SnoozeUndoFailureToastMessageOptions {
  errorMessage: string;
  translate?: (value: string) => string;
  separator?: string;
}

export interface SnoozePendingToastMessageOptions {
  translate?: (value: string) => string;
  separator?: string;
}

function normalizeSnoozeManagerMessageId(messageId?: string): string {
  return (messageId || '').trim();
}

export function buildSnoozeManagerOpenRequestData(
  messageId?: string,
): SnoozeManagerOpenRequestData {
  const normalizedMessageId = normalizeSnoozeManagerMessageId(messageId);
  return {
    category: 'Snooze',
    ...(normalizedMessageId ? { messageId: normalizedMessageId } : {}),
  };
}

export function buildSnoozeManagerPagePath(messageId?: string): string {
  const params = new URLSearchParams({ category: 'Snooze' });
  const normalizedMessageId = normalizeSnoozeManagerMessageId(messageId);
  if (normalizedMessageId) {
    params.set('messageId', normalizedMessageId);
  }
  return `scheduled-messages.html?${params.toString()}`;
}

export function getSnoozeSuccessToastActions(
  updated: boolean,
  messageId?: string,
): SnoozeSuccessToastActionView[] {
  const actions: SnoozeSuccessToastActionView[] = [];
  if (!updated && messageId?.trim()) {
    actions.push({ kind: 'undo', label: '撤销' });
  }
  actions.push({ kind: 'manage', label: '管理' });
  return actions;
}

export function getSnoozeSuccessToastReceipt(
  updated: boolean,
  messageId?: string,
): SnoozeSuccessToastReceipt {
  if (updated && messageId?.trim()) {
    return '同一条消息的旧提醒已改期；管理会定位到原提醒';
  }
  if (!updated && messageId?.trim()) {
    return '可撤销；管理会定位到这条提醒';
  }
  return '管理会打开 Snooze 列表确认';
}

export function buildSnoozeSuccessToastMessage({
  updated,
  timeLabel,
  messageId,
  translate = (value) => value,
  separator = '：',
}: SnoozeSuccessToastMessageOptions): string {
  const prefix = updated ? '已更新提醒' : '已设置提醒';
  const receipt = getSnoozeSuccessToastReceipt(updated, messageId);
  return [
    `${translate(prefix)}${separator}${timeLabel}`,
    translate(receipt),
    translate(SNOOZE_MARKER_SYNC_NOTICE),
  ].join(' · ');
}

export function buildSnoozeUndoSuccessToastMessage({
  timeLabel,
  translate = (value) => value,
  separator = '：',
}: SnoozeUndoToastMessageOptions): string {
  return [
    `${translate('已撤销提醒')}${separator}${timeLabel}`,
    translate(SNOOZE_UNDO_BOUNDARY_NOTICE),
    translate(SNOOZE_MARKER_SYNC_NOTICE),
  ].join(' · ');
}

export function buildSnoozeUndoFailureToastMessage({
  errorMessage,
  translate = (value) => value,
  separator = '：',
}: SnoozeUndoFailureToastMessageOptions): string {
  return [
    `${translate('未撤销提醒')}${separator}${errorMessage}`,
    translate(SNOOZE_UNDO_FAILURE_NOTICE),
  ].join(' · ');
}

export function buildSnoozePendingToastMessage({
  translate = (value) => value,
  separator = '：',
}: SnoozePendingToastMessageOptions = {}): string {
  return [
    `${translate('提醒处理中')}${separator}${translate(
      '同一条消息已有请求',
    )}`,
    translate(SNOOZE_PENDING_NO_DUPLICATE_NOTICE),
    translate(SNOOZE_PENDING_RECOVERY_NOTICE),
  ].join(' · ');
}
