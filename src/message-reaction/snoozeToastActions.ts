export type SnoozeSuccessToastActionKind = 'undo' | 'manage';

export interface SnoozeSuccessToastActionView {
  kind: SnoozeSuccessToastActionKind;
  label: string;
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
