function getCalendarDayDiff(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / (1000 * 60 * 60 * 24));
}

function formatSameDayDuration(diffMinutes: number): string {
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟后`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (minutes === 0) {
    return `${hours} 小时后`;
  }

  return `${hours} 小时 ${minutes} 分钟后`;
}

/**
 * 格式化提醒时间显示。
 */
export function formatRemindTime(date: Date, now = new Date()): string {
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
  const calendarDayDiff = getCalendarDayDiff(now, date);

  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });

  if (diffMs <= 0) {
    return `即将提醒 (${timeStr})`;
  }

  if (calendarDayDiff === 0) {
    return `${formatSameDayDuration(diffMinutes)} (${timeStr})`;
  }

  if (calendarDayDiff === 1) {
    return `明天 ${timeStr}`;
  }

  if (calendarDayDiff > 1 && calendarDayDiff < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
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
