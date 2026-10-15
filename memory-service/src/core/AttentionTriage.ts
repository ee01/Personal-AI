/** Deterministic, passive triage. Neither extraction nor triage represents consent. */
export type Audience = 'me' | 'team_including_me' | 'others' | 'unknown';
export interface TriageInput {
  text: string;
  timestamp: number;
  now: number;
  timezone: string;
  origin: string;
  audience: Audience;
  senderWeight: number;
  importance: number;
  kinds?: string[];
  dates?: number[];
  matchedRule?: boolean;
  ownerAuthored?: boolean;
}
export interface TriageDecision {
  kind: 'deadline' | 'request' | 'commitment' | 'waiting' | 'open_question';
  title: string;
  due_at: number;
  confidence: number;
  reasons: string[];
}
export function plainMessage(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
export function localParts(at: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at * 1000);
  const n = (key: string) => Number(parts.find((p) => p.type === key)?.value);
  return { year: n('year'), month: n('month'), day: n('day') };
}
export function wallTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  timezone: string,
): number {
  const desired = Date.UTC(year, month - 1, day, hour);
  let value = desired;
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const n = (key: string) => Number(p.find((x) => x.type === key)?.value);
    value +=
      desired -
      Date.UTC(
        n('year'),
        n('month') - 1,
        n('day'),
        n('hour'),
        n('minute'),
        n('second'),
      );
  }
  return value / 1000;
}
export function parseAttentionDates(
  text: string,
  timestamp: number,
  timezone = 'Asia/Shanghai',
): number[] {
  const local = localParts(timestamp, timezone);
  const values: number[] = [];
  const add = (year: number, month: number, day: number) => {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    )
      values.push(wallTime(year, month, day, 23, timezone) + 3599);
  };
  for (const m of text.matchAll(
    /\b(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})日?/g,
  ))
    add(+m[1], +m[2], +m[3]);
  const remaining = text.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g, '');
  for (const m of remaining.matchAll(
    /(?:^|[^\d/])(\d{1,2})[\/月](\d{1,2})(?:\/(20\d{2})|日)?(?![\d/])/g,
  ))
    add(m[3] ? +m[3] : local.year, +m[1], +m[2]);
  const months = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  for (const m of text.matchAll(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(20\d{2}))?/gi,
  ))
    add(
      m[3] ? +m[3] : local.year,
      months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1,
      +m[2],
    );
  const shift = (days: number) => {
    const d = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
    add(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  };
  if (/后天|day after tomorrow/i.test(text)) shift(2);
  else if (/明天|tomorrow/i.test(text)) shift(1);
  if (/今天|today/i.test(text)) shift(0);
  const weekDay = new Date(
    Date.UTC(local.year, local.month - 1, local.day),
  ).getUTCDay();
  const names = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  for (const m of text.matchAll(
    /(下周|上周|本周|这周|周|星期)([一二三四五六日天])|\b((?:next|last)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
  )) {
    const target = m[2]
      ? '日一二三四五六'.indexOf(m[2].replace('天', '日'))
      : names.indexOf(m[4].toLowerCase());
    let delta = (target - weekDay + 7) % 7;
    if (m[1] === '下周') delta = (target || 7) - (weekDay || 7) + 7;
    else if (m[1] === '上周') delta = (target || 7) - (weekDay || 7) - 7;
    else if (m[1] === '本周' || m[1] === '这周')
      delta = (target || 7) - (weekDay || 7);
    else if (m[3]?.trim().toLowerCase() === 'last')
      delta = delta === 0 ? -7 : delta - 7;
    else if (m[3] && delta === 0) delta = 7;
    shift(delta);
  }
  return [...new Set(values)].sort((a, b) => a - b);
}
export function inferAudience(
  text: string,
  meta: Record<string, unknown>,
  ownerNames: string[],
): Audience {
  const t = plainMessage(text);
  // Mentions of another person never inherit a generic team-membership guess.
  if (
    ownerNames.some((n) => n && t.toLowerCase().includes('@' + n.toLowerCase()))
  )
    return 'me';
  if (meta.replyToOwner === true || meta.isDirectMessage === true) return 'me';
  if (
    /@team\b|请大家|大家.{0,16}(完成|提交|回复)|\b(?:team|everyone|all teams)[,:\s]|hi all/i.test(
      t,
    )
  )
    return 'team_including_me';
  if (/@[\w\u4e00-\u9fff]/.test(t)) return 'others';
  return 'unknown';
}
export function triageAttention(input: TriageInput): TriageDecision | null {
  const { now, timestamp, timezone } = input;
  const text = plainMessage(input.text);
  if (
    !['owner', 'observed'].includes(input.origin) ||
    input.audience === 'others' ||
    input.audience === 'unknown'
  )
    return null;
  if (
    /<\/?(?:root|reply|standalone|message)\b|\bwrote:|posted in|已在.{0,80}中发布|__原文__|AI 晨报|\bnews(?:letter)?\b|Example Prompt/i.test(
      input.text,
    )
  )
    return null;
  if (
    /请.{0,8}加入|please join|meeting id:|会议 ID|\b(?:already completed|has been completed)\b|已完成[：:]/i.test(
      text,
    )
  )
    return null;
  const request =
    /提交|完成|回复|交付|整理|填写|确认|帮我|务必|\b(?:submit|complete|reply|deliver|send|share|finish|please|could you|can you|need to)\b/i.test(
      text,
    );
  const commitment =
    input.ownerAuthored &&
    /我来|我会|我.{0,8}(给你|交付)|\bI(?:'ll| will)\b/i.test(text);
  const waiting = input.ownerAuthored && /[?？]/.test(text);
  if (input.ownerAuthored && !commitment && !waiting) return null;
  const open =
    !request &&
    input.kinds?.includes('open_question') &&
    input.senderWeight >= 0.6;
  if (!request && !commitment && !waiting && !open) return null;
  const deadlineSpan = text.match(
    /(?:deadline|截止(?:日期|时间)?)\s*[:：是为]?\s*(.{1,50})/i,
  )?.[1];
  const dates = input.dates?.length
    ? input.dates
    : parseAttentionDates(deadlineSpan ?? text, timestamp, timezone);
  if (!dates.length && /\b20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}/.test(text))
    return null;
  // An explicit past date must not become a fresh default deadline.
  const due = dates.length
    ? dates[0]
    : (() => {
        const p = localParts(timestamp, timezone);
        if (open) {
          const d = new Date(Date.UTC(p.year, p.month - 1, p.day + 7));
          return (
            wallTime(
              d.getUTCFullYear(),
              d.getUTCMonth() + 1,
              d.getUTCDate(),
              23,
              timezone,
            ) + 3599
          );
        }
        let d = new Date(Date.UTC(p.year, p.month - 1, p.day));
        let left = waiting ? 2 : 3;
        while (left) {
          d.setUTCDate(d.getUTCDate() + 1);
          if (![0, 6].includes(d.getUTCDay())) left--;
        }
        return (
          wallTime(
            d.getUTCFullYear(),
            d.getUTCMonth() + 1,
            d.getUTCDate(),
            23,
            timezone,
          ) + 3599
        );
      })();
  if (due <= now || due > now + 90 * 86400) return null;
  const weight = input.matchedRule ? 1 : input.senderWeight;
  const confidence = Math.min(
    1,
    0.5 +
      (dates.length ? 0.2 : 0) +
      weight * 0.2 +
      (input.audience === 'me' ? 0.15 : 0.05),
  );
  if (confidence < 0.75) return null;
  const title =
    text
      .replace(/@Team\b/gi, '')
      .replace(/(?:Deadline|截止).*/i, '')
      .replace(
        /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}(?:\/20\d{2})?/g,
        '',
      )
      .trim()
      .slice(0, 160) || text.slice(0, 160);
  return {
    kind: commitment
      ? 'commitment'
      : waiting
      ? 'waiting'
      : dates.length
      ? 'deadline'
      : open
      ? 'open_question'
      : 'request',
    title,
    due_at: due,
    confidence,
    reasons: [
      dates.length ? 'explicit_deadline' : 'default_workdays',
      input.audience,
      input.matchedRule ? 'matched_rule' : `sender_weight:${weight}`,
    ],
  };
}
export function reminderPlan(due: number, timezone: string): number[] {
  const p = localParts(due, timezone);
  return [-2, -1, 0].map((delta) => {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day + delta));
    return wallTime(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      9,
      timezone,
    );
  });
}
