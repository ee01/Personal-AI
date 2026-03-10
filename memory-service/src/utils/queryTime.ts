import { now } from './time.js';

export interface QueryTimeRange {
  start: number;
  end: number;
}

const CHINESE_DIGITS: Record<string, number> = {
  '零': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
};

function parseChineseNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  if (value === '十') {
    return 10;
  }

  if (value.includes('十')) {
    const [tensRaw, onesRaw] = value.split('十');
    const tens = tensRaw ? CHINESE_DIGITS[tensRaw] : 1;
    const ones = onesRaw ? CHINESE_DIGITS[onesRaw] : 0;
    if (tens == null || ones == null) return null;
    return tens * 10 + ones;
  }

  return CHINESE_DIGITS[value] ?? null;
}

function startOfLocalDay(epochSeconds: number): number {
  const date = new Date(epochSeconds * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function startOfCurrentWeek(epochSeconds: number): number {
  const date = new Date(epochSeconds * 1000);
  date.setHours(0, 0, 0, 0);
  const dayOfWeek = date.getDay();
  return Math.floor(date.getTime() / 1000) - dayOfWeek * 86400;
}

function startOfCurrentMonth(epochSeconds: number): number {
  const date = new Date(epochSeconds * 1000);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Parse common English and Chinese time expressions from a natural-language query.
 */
export function parseQueryTimeRange(
  query: string,
  referenceTime = now(),
): QueryTimeRange | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const startOfToday = startOfLocalDay(referenceTime);

  if (/\btoday\b/.test(normalized) || /今天|今日/.test(query)) {
    return { start: startOfToday, end: referenceTime };
  }

  if (/\byesterday\b/.test(normalized) || /昨天/.test(query)) {
    const start = startOfToday - 86400;
    return { start, end: startOfToday - 1 };
  }

  if (/\bthis week\b/.test(normalized) || /本周|这周/.test(query)) {
    return { start: startOfCurrentWeek(referenceTime), end: referenceTime };
  }

  if (/\blast week\b/.test(normalized) || /上周/.test(query)) {
    const startOfThisWeek = startOfCurrentWeek(referenceTime);
    return {
      start: startOfThisWeek - 7 * 86400,
      end: startOfThisWeek - 1,
    };
  }

  if (/\bthis month\b/.test(normalized) || /本月/.test(query)) {
    return { start: startOfCurrentMonth(referenceTime), end: referenceTime };
  }

  if (/\blast month\b/.test(normalized) || /上个月|上月/.test(query)) {
    const currentMonth = new Date(referenceTime * 1000);
    currentMonth.setHours(0, 0, 0, 0);
    currentMonth.setDate(1);

    const startOfThisMonth = Math.floor(currentMonth.getTime() / 1000);
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    const startOfLastMonth = Math.floor(currentMonth.getTime() / 1000);

    return { start: startOfLastMonth, end: startOfThisMonth - 1 };
  }

  const englishRelative = normalized.match(
    /(?:past|last)\s+(\d+)\s+(hours?|days?|weeks?|months?)/,
  );
  if (englishRelative) {
    const amount = parseInt(englishRelative[1], 10);
    const unit = englishRelative[2];

    if (unit.startsWith('hour')) {
      return { start: referenceTime - amount * 3600, end: referenceTime };
    }
    if (unit.startsWith('day')) {
      return { start: referenceTime - amount * 86400, end: referenceTime };
    }
    if (unit.startsWith('week')) {
      return { start: referenceTime - amount * 7 * 86400, end: referenceTime };
    }
    if (unit.startsWith('month')) {
      const date = new Date(referenceTime * 1000);
      date.setMonth(date.getMonth() - amount);
      return { start: Math.floor(date.getTime() / 1000), end: referenceTime };
    }
  }

  const chineseRelative = query.match(
    /(?:最近|近|过去)([0-9一二两三四五六七八九十]+)(?:个)?(小时|天|周|星期|个月|月)/,
  );
  if (chineseRelative) {
    const amount = parseChineseNumber(chineseRelative[1]);
    const unit = chineseRelative[2];

    if (amount != null) {
      if (unit === '小时') {
        return { start: referenceTime - amount * 3600, end: referenceTime };
      }
      if (unit === '天') {
        return { start: referenceTime - amount * 86400, end: referenceTime };
      }
      if (unit === '周' || unit === '星期') {
        return { start: referenceTime - amount * 7 * 86400, end: referenceTime };
      }
      if (unit === '个月' || unit === '月') {
        const date = new Date(referenceTime * 1000);
        date.setMonth(date.getMonth() - amount);
        return { start: Math.floor(date.getTime() / 1000), end: referenceTime };
      }
    }
  }

  const isoDateMatch = query.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/);
  if (isoDateMatch) {
    const normalizedDate = isoDateMatch[1].replace(/\//g, '-');
    const date = new Date(`${normalizedDate}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const dayStart = Math.floor(date.getTime() / 1000);
      return { start: dayStart, end: dayStart + 86400 - 1 };
    }
  }

  return null;
}
