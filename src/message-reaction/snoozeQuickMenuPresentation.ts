import type { QuickOption } from './snoozeQuickOptions';
import type { UiLanguage } from '../i18n/index.js';

export const SNOOZE_CUSTOM_OPTION_LABEL = '自定义时间';
export const SNOOZE_MANAGE_OPTION_LABEL = '管理稍后处理';

export interface SnoozeQuickMenuReceiptLineView {
  label: string;
  value: string;
}

export interface SnoozeQuickMenuReceiptView {
  title: string;
  lines: SnoozeQuickMenuReceiptLineView[];
  ariaLabel: string;
}

export interface SnoozeQuickMenuExistingSnoozeView {
  label: string;
}

export interface SnoozeQuickMenuReceiptContext {
  existingSnooze?: SnoozeQuickMenuExistingSnoozeView | null;
}

export interface SnoozeQuickMenuOptionView {
  index: number;
  label: string;
  icon: string;
  timeLabel: string;
  ariaLabel: string;
}

export function formatSnoozeQuickMenuExistingSnoozeLabel(
  label: string,
  language: UiLanguage = 'zh-CN',
): string {
  const normalizedLabel = label.trim();
  if (language !== 'en-US') return normalizedLabel;
  if (/^Remind(?:\s|$)/.test(normalizedLabel)) return normalizedLabel;

  const snoozePrefixMatch = normalizedLabel.match(/^稍后(?:处理)?\s*/);
  if (!snoozePrefixMatch) return normalizedLabel;

  const compactTime = normalizedLabel.slice(snoozePrefixMatch[0].length).trim();
  return compactTime ? `Remind ${compactTime}` : 'Remind';
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

export function buildSnoozeQuickMenuReceipt(
  translate: (value: string) => string = (value) => value,
  separator = '：',
  context: SnoozeQuickMenuReceiptContext = {},
): SnoozeQuickMenuReceiptView {
  const title = translate('提醒路径');
  const existingSnoozeLabel = context.existingSnooze?.label?.trim();
  const lines = existingSnoozeLabel
    ? [
        {
          label: translate('当前'),
          value: `${translate('已在本地标注为')} ${existingSnoozeLabel}`,
        },
        {
          label: translate('本次点击'),
          value: translate('会改期这条同源 Snooze，不新增第二条'),
        },
        {
          label: translate('恢复'),
          value: translate('选错可从成功 Toast 或管理稍后处理确认'),
        },
        {
          label: translate('缓存口径'),
          value: translate(
            '来自本地 marker 快照；以 Scheduled Messages 管理页和后台同步为准',
          ),
        },
      ]
    : [
        {
          label: translate('去向'),
          value: translate('写入 Scheduled Messages 的 Snooze 队列'),
        },
        {
          label: translate('回到消息'),
          value: translate('到点由 Bot 推送，并在原消息显示稍后标注'),
        },
        {
          label: translate('恢复'),
          value: translate('选错可撤销，或从管理稍后处理改期'),
        },
        {
          label: translate('时间口径'),
          value: translate('预计时间会在悬停、聚焦和点击前刷新'),
        },
      ];
  const ariaLabel = [
    title,
    ...lines.map((line) => `${line.label}${separator}${line.value}`),
  ].join('；');

  return {
    title,
    lines,
    ariaLabel,
  };
}

export function buildSnoozeQuickMenuOptions(
  quickOptions: QuickOption[],
  formatTime: (date: Date) => string,
  language: UiLanguage = 'zh-CN',
): SnoozeQuickMenuOptionView[] {
  return quickOptions.map((option, index) =>
    buildSnoozeQuickMenuOptionView(option, index, formatTime, language),
  );
}

export function buildSnoozeQuickMenuOptionView(
  option: QuickOption,
  index: number,
  formatTime: (date: Date) => string,
  language: UiLanguage = 'zh-CN',
  remindAt: Date = option.getTime(),
): SnoozeQuickMenuOptionView {
  const timeLabel = formatTime(remindAt);
  const separator = language === 'en-US' ? ', ' : '，';
  return {
    index,
    label: option.label,
    icon: option.icon,
    timeLabel,
    ariaLabel: `${option.label}${separator}${timeLabel}`,
  };
}
