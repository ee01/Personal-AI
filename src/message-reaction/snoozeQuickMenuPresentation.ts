import type { QuickOption } from './SnoozeManager';

export const SNOOZE_CUSTOM_OPTION_LABEL = '自定义时间';
export const SNOOZE_MANAGE_OPTION_LABEL = '管理稍后处理';

export interface SnoozeQuickMenuOptionView {
  index: number;
  label: string;
  icon: string;
  timeLabel: string;
  ariaLabel: string;
}

export function escapeSnoozeMenuText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

export function buildSnoozeQuickMenuOptions(
  quickOptions: QuickOption[],
  formatTime: (date: Date) => string,
): SnoozeQuickMenuOptionView[] {
  return quickOptions.map((option, index) => {
    const timeLabel = formatTime(option.getTime());
    return {
      index,
      label: option.label,
      icon: option.icon,
      timeLabel,
      ariaLabel: `${option.label}，${timeLabel}`,
    };
  });
}
