export type SnoozeCreateFailureReason =
  | 'invalid_time'
  | 'not_initialized'
  | 'request_pending'
  | 'background_error'
  | 'runtime_error';

export interface SnoozeReminderResult {
  success: boolean;
  messageId?: string;
  updated?: boolean;
  reason?: SnoozeCreateFailureReason;
  error?: string;
}

export function getSnoozeCreateFailureMessage(
  result: SnoozeReminderResult,
): string | null {
  if (
    result.success ||
    result.reason === 'not_initialized' ||
    result.reason === 'request_pending'
  ) {
    return null;
  }

  if (result.reason === 'invalid_time') {
    return result.error || '请选择未来的提醒时间';
  }

  return result.error || '创建提醒失败，请稍后重试';
}
