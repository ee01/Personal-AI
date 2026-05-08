export interface QuickOption {
  label: string;
  icon: string;
  getTime: () => Date;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
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

export function formatWorkdayQuickLabel(
  target: Date,
  now: Date,
  suffix: string,
): string {
  const dayDiff = getCalendarDayDiff(now, target);
  if (dayDiff === 0) return `今天${suffix}`;
  if (dayDiff === 1) return `明天${suffix}`;
  return `${WEEKDAY_LABELS[target.getDay()]} ${suffix.trim()}`;
}

export function getQuickOptions(
  clock: () => Date = () => new Date(),
): QuickOption[] {
  const now = clock();
  const workdayEndTime = getNextWorkdayTime(now, 18, 0, true);
  const nextWorkdayMorning = getNextWorkdayTime(now, 9, 0, false);

  return [
    {
      label: '1 小时后',
      icon: '⏰',
      getTime: () => {
        const d = cloneDate(clock());
        d.setHours(d.getHours() + 1);
        return d;
      },
    },
    {
      label: '3 小时后',
      icon: '🕐',
      getTime: () => {
        const d = cloneDate(clock());
        d.setHours(d.getHours() + 3);
        return d;
      },
    },
    {
      label: formatWorkdayQuickLabel(workdayEndTime, now, '下班前'),
      icon: '🌆',
      getTime: () => getNextWorkdayTime(clock(), 18, 0, true),
    },
    {
      label: formatWorkdayQuickLabel(nextWorkdayMorning, now, ' 9 点'),
      icon: '☀️',
      getTime: () => getNextWorkdayTime(clock(), 9, 0, false),
    },
    {
      label: '下周一 9 点',
      icon: '📅',
      getTime: () => {
        const d = cloneDate(clock());
        const dayOfWeek = d.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        d.setDate(d.getDate() + daysUntilMonday);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];
}
