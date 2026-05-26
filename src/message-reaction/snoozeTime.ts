import type { UiLanguage } from '../i18n/index.js';

function getCalendarDayDiff(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round(
    (toDay.getTime() - fromDay.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function formatDurationPart(amount: number, unit: 'minute' | 'hour'): string {
  const unitLabel =
    unit === 'minute'
      ? amount === 1
        ? 'minute'
        : 'minutes'
      : amount === 1
      ? 'hour'
      : 'hours';
  return `${amount} ${unitLabel}`;
}

function formatSameDayDuration(
  diffMinutes: number,
  language: UiLanguage,
): string {
  if (diffMinutes < 60) {
    if (language === 'en-US') {
      return `In ${formatDurationPart(diffMinutes, 'minute')}`;
    }
    return `${diffMinutes} 分钟后`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (minutes === 0) {
    if (language === 'en-US') {
      return `In ${formatDurationPart(hours, 'hour')}`;
    }
    return `${hours} 小时后`;
  }

  if (language === 'en-US') {
    return `In ${formatDurationPart(hours, 'hour')} ${formatDurationPart(
      minutes,
      'minute',
    )}`;
  }
  return `${hours} 小时 ${minutes} 分钟后`;
}

function formatReminderTimeOfDay(date: Date, language: UiLanguage): string {
  if (language === 'en-US') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReminderDate(date: Date, language: UiLanguage): string {
  if (language === 'en-US') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 格式化提醒时间显示。
 */
export function formatRemindTime(
  date: Date,
  now = new Date(),
  language: UiLanguage = 'zh-CN',
): string {
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
  const calendarDayDiff = getCalendarDayDiff(now, date);

  const timeStr = formatReminderTimeOfDay(date, language);
  const dateStr = formatReminderDate(date, language);

  if (diffMs <= 0) {
    if (language === 'en-US') {
      return `Due now (${timeStr})`;
    }
    return `即将提醒 (${timeStr})`;
  }

  if (calendarDayDiff === 0) {
    return `${formatSameDayDuration(diffMinutes, language)} (${timeStr})`;
  }

  if (calendarDayDiff === 1) {
    if (language === 'en-US') {
      return `Tomorrow ${timeStr}`;
    }
    return `明天 ${timeStr}`;
  }

  if (calendarDayDiff > 1 && calendarDayDiff < 7) {
    const weekdays =
      language === 'en-US'
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${weekdays[date.getDay()]} ${timeStr}`;
  }

  return `${dateStr} ${timeStr}`;
}

export function isValidFutureSnoozeTime(
  remindAt: Date,
  nowMs = Date.now(),
): boolean {
  return (
    remindAt instanceof Date &&
    !Number.isNaN(remindAt.getTime()) &&
    remindAt.getTime() > nowMs
  );
}
