import type { UiLanguage } from '../i18n/index.js';

export interface QuickOption {
  label: string;
  icon: string;
  getTime: () => Date;
}

const WEEKDAY_LABELS_ZH = [
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
];
const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

function addMinutes(date: Date, minutes: number): Date {
  const target = cloneDate(date);
  target.setMinutes(target.getMinutes() + minutes);
  return target;
}

function getMinuteKey(date: Date): number {
  return Math.floor(date.getTime() / 60_000);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getCalendarDayDiff(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000);
}

export function getNextWorkdayTime(
  now: Date,
  hour: number,
  minute = 0,
  includeToday = false,
): Date {
  const target = cloneDate(now);
  target.setHours(hour, minute, 0, 0);

  if (includeToday && !isWeekend(now) && target.getTime() > now.getTime()) {
    return target;
  }

  do {
    target.setDate(target.getDate() + 1);
    target.setHours(hour, minute, 0, 0);
  } while (isWeekend(target));

  return target;
}

export function getDefaultCustomSnoozeTime(now: Date = new Date()): Date {
  return getNextWorkdayTime(now, 9, 0, true);
}

function getNextMondayMorning(now: Date): Date {
  const target = cloneDate(now);
  const dayOfWeek = target.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  target.setDate(target.getDate() + daysUntilMonday);
  target.setHours(9, 0, 0, 0);
  return target;
}

export function formatWorkdayQuickLabel(
  target: Date,
  now: Date,
  suffix: string,
  language: UiLanguage = 'zh-CN',
): string {
  const dayDiff = getCalendarDayDiff(now, target);
  if (language === 'en-US') {
    const timeLabel = suffix.includes('下班前') ? 'by EOD' : '9 AM';
    if (dayDiff === 0) return `Today ${timeLabel}`;
    if (dayDiff === 1) return `Tomorrow ${timeLabel}`;
    return `${WEEKDAY_LABELS_EN[target.getDay()]} ${timeLabel}`;
  }
  if (dayDiff === 0) return `今天${suffix}`;
  if (dayDiff === 1) return `明天${suffix}`;
  return `${WEEKDAY_LABELS_ZH[target.getDay()]} ${suffix.trim()}`;
}

function formatRelativeQuickLabel(
  amount: number,
  unit: 'minute' | 'hour',
  language: UiLanguage,
): string {
  if (language === 'en-US') {
    const unitLabel =
      unit === 'minute'
        ? amount === 1
          ? 'minute'
          : 'minutes'
        : amount === 1
        ? 'hour'
        : 'hours';
    return `In ${amount} ${unitLabel}`;
  }
  return unit === 'minute' ? `${amount} 分钟后` : `${amount} 小时后`;
}

export function getQuickOptions(
  clock: () => Date = () => new Date(),
  language: UiLanguage = 'zh-CN',
): QuickOption[] {
  const now = clock();
  const workdayEndTime = getNextWorkdayTime(now, 18, 0, true);
  const nextWorkdayMorning = getNextWorkdayTime(now, 9, 0, false);
  const nextMondayMorning = getNextMondayMorning(now);

  const options: QuickOption[] = [];
  const optionTimeKeys = new Set<number>();
  const addOption = (option: QuickOption, previewTime: Date) => {
    const key = getMinuteKey(previewTime);
    if (optionTimeKeys.has(key)) return;
    optionTimeKeys.add(key);
    options.push(option);
  };

  addOption(
    {
      label: formatRelativeQuickLabel(15, 'minute', language),
      icon: '⏱️',
      getTime: () => addMinutes(clock(), 15),
    },
    addMinutes(now, 15),
  );
  addOption(
    {
      label: formatRelativeQuickLabel(30, 'minute', language),
      icon: '🕧',
      getTime: () => addMinutes(clock(), 30),
    },
    addMinutes(now, 30),
  );
  addOption(
    {
      label: formatRelativeQuickLabel(1, 'hour', language),
      icon: '⏰',
      getTime: () => {
        const d = cloneDate(clock());
        d.setHours(d.getHours() + 1);
        return d;
      },
    },
    addMinutes(now, 60),
  );
  addOption(
    {
      label: formatRelativeQuickLabel(2, 'hour', language),
      icon: '⏳',
      getTime: () => {
        const d = cloneDate(clock());
        d.setHours(d.getHours() + 2);
        return d;
      },
    },
    addMinutes(now, 120),
  );
  addOption(
    {
      label: formatRelativeQuickLabel(3, 'hour', language),
      icon: '🕐',
      getTime: () => {
        const d = cloneDate(clock());
        d.setHours(d.getHours() + 3);
        return d;
      },
    },
    addMinutes(now, 180),
  );
  addOption(
    {
      label: formatWorkdayQuickLabel(workdayEndTime, now, '下班前', language),
      icon: '🌆',
      getTime: () => getNextWorkdayTime(clock(), 18, 0, true),
    },
    workdayEndTime,
  );
  addOption(
    {
      label: formatWorkdayQuickLabel(nextWorkdayMorning, now, ' 9 点', language),
      icon: '☀️',
      getTime: () => getNextWorkdayTime(clock(), 9, 0, false),
    },
    nextWorkdayMorning,
  );

  if (nextMondayMorning.getTime() !== nextWorkdayMorning.getTime()) {
    addOption(
      {
        label: language === 'en-US' ? 'Next Mon 9 AM' : '下周一 9 点',
        icon: '📅',
        getTime: () => getNextMondayMorning(clock()),
      },
      nextMondayMorning,
    );
  }

  return options;
}
