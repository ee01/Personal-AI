import type { QuickOption } from './snoozeQuickOptions';
import type { UiLanguage } from '../i18n/index.js';

export const SNOOZE_CUSTOM_OPTION_LABEL = '自定义时间';
export const SNOOZE_MANAGE_OPTION_LABEL = '管理稍后处理';

export interface SnoozeQuickMenuReceiptLineView {
  label: string;
  value: string;
  key?: 'create-target' | 'reschedule-target';
}

export interface SnoozeQuickMenuReceiptView {
  title: string;
  lines: SnoozeQuickMenuReceiptLineView[];
  ariaLabel: string;
}

export interface SnoozeQuickMenuExistingSnoozeView {
  label: string;
  cacheState?: SnoozeQuickMenuMarkerCacheState;
}

export interface SnoozeQuickMenuReceiptContext {
  existingSnooze?: SnoozeQuickMenuExistingSnoozeView | null;
  targetTimeLabel?: string | null;
}

export type SnoozeQuickMenuMarkerCacheState =
  | 'fresh'
  | 'stale'
  | 'unrefreshed';

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

function getSnoozeQuickMenuCacheBasisText(
  translate: (value: string) => string,
  cacheState?: SnoozeQuickMenuMarkerCacheState,
): string {
  if (cacheState === 'stale') {
    return translate(
      '来自本地 marker 快照，可能过旧；刷新会话或等待后台同步后再确认',
    );
  }
  if (cacheState === 'unrefreshed') {
    return translate(
      '来自本地 marker 快照，尚未刷新远端状态；以 Scheduled Messages 管理页和后台同步为准',
    );
  }
  return translate(
    '来自本地 marker 快照，不是实时远端查询；以 Scheduled Messages 管理页和后台同步为准',
  );
}

export function buildSnoozeQuickMenuReceipt(
  translate: (value: string) => string = (value) => value,
  separator = '：',
  context: SnoozeQuickMenuReceiptContext = {},
): SnoozeQuickMenuReceiptView {
  const existingSnoozeLabel = context.existingSnooze?.label?.trim();
  const targetTimeLabel = context.targetTimeLabel?.trim();
  const inlineSeparator = separator.trim() === ':' ? '; ' : '；';

  const title = existingSnoozeLabel
    ? translate('改期预览')
    : translate('提醒时间口径');
  const lines: SnoozeQuickMenuReceiptLineView[] = existingSnoozeLabel
    ? [
        {
          label: translate('当前'),
          value: `${translate('已在本地标注为')} ${existingSnoozeLabel}`,
        },
        {
          label: translate('本次点击'),
          value: targetTimeLabel
            ? `${translate('会改到')} ${targetTimeLabel}${inlineSeparator}${translate(
                '仍是同源 Snooze，不新增第二条',
              )}`
            : translate('会改期这条同源 Snooze，不新增第二条'),
          key: 'reschedule-target',
        },
        {
          label: translate('缓存口径'),
          value: getSnoozeQuickMenuCacheBasisText(
            translate,
            context.existingSnooze?.cacheState,
          ),
        },
      ]
    : [
        {
          label: translate('本次点击'),
          value: targetTimeLabel
            ? `${translate('会创建提醒到')} ${targetTimeLabel}`
            : translate('会按所选时间创建 Snooze'),
          key: 'create-target',
        },
        {
          label: translate('写入边界'),
          value: translate(
            '点击具体时间后才写入 Scheduled Messages；不会发送消息、标记已读或完成原消息',
          ),
        },
        {
          label: translate('页面标注'),
          value: translate(
            '成功后原消息标注仍等后台同步；当前页面可能短暂仍显示旧快照',
          ),
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

export function buildSnoozeQuickMenuOptionControlLabel(
  optionView: Pick<SnoozeQuickMenuOptionView, 'ariaLabel'>,
  receipt: Pick<SnoozeQuickMenuReceiptView, 'ariaLabel'>,
): string {
  return `${optionView.ariaLabel}；${receipt.ariaLabel}`;
}

export function buildSnoozeCustomOptionControlLabel(
  translate: (value: string) => string = (value) => value,
  separator = '：',
): string {
  return `${translate(SNOOZE_CUSTOM_OPTION_LABEL)}${separator}${translate(
    '打开自定义时间选择器；不会写入 Scheduled Messages，只有确认未来时间后才创建或改期 Snooze；不会发送消息、标记已读或完成原消息',
  )}`;
}

export function buildSnoozeManageOptionControlLabel(
  translate: (value: string) => string = (value) => value,
  separator = '：',
): string {
  return `${translate(SNOOZE_MANAGE_OPTION_LABEL)}${separator}${translate(
    '只打开 Scheduled Messages 的 Snooze 视图；不会创建、改期、完成或删除提醒，不会发送消息或写记忆',
  )}`;
}
