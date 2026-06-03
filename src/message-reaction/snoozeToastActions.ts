export type SnoozeSuccessToastActionKind = 'undo' | 'manage';

export interface SnoozeSuccessToastActionView {
  kind: SnoozeSuccessToastActionKind;
  label: string;
}

export interface SnoozeManagerOpenRequestData {
  category: 'Snooze';
  messageId?: string;
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
