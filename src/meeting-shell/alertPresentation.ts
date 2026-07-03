import type { MeetingPilotAlert } from './protocol';

type MeetingPilotAlertCandidate = Pick<
  MeetingPilotAlert,
  'level' | 'title' | 'body' | 'source'
> &
  Partial<Pick<MeetingPilotAlert, 'createdAt'>>;

export type MeetingPilotAlertReceipt = {
  reason: string;
  nextStep: string;
  boundary: string;
  signal: string;
};

export type MeetingPilotAlertReceiptOptions = {
  now?: number;
};

const OLD_ALERT_THRESHOLD_MS = 5 * 60 * 1000;

function normalizeAlertText(value?: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isContextOnlyMeetingPilotAlert(
  alert: MeetingPilotAlertCandidate,
): boolean {
  if (
    alert.level === 'P0' ||
    alert.source === 'mention' ||
    alert.source === 'action'
  ) {
    return false;
  }

  const title = normalizeAlertText(alert.title);
  const body = normalizeAlertText(alert.body);
  const combined = `${title} ${body}`;

  if (
    /(?:当前|current)\s*(?:主讲人?|speaker)\s*(?:切换|更新|变化|changed|updated|switch(?:ed)?)/i.test(
      combined,
    ) ||
    /(?:主讲人?|speaker)\s*(?:切换|更新|变化)/i.test(combined)
  ) {
    return true;
  }

  if (
    /(?:正在主讲|is speaking|speaking now).*(?:上下文|context).*(?:刷新|更新|切换|refresh|updated|switch(?:ed)?)/i.test(
      combined,
    ) ||
    /(?:对话上下文|会议上下文|meeting context|conversation context).*(?:刷新|更新|切换|refresh|updated|switch(?:ed)?)/i.test(
      combined,
    ) ||
    /meeting pilot\s*(?:已|has)?\s*(?:切换|switched).*(?:上下文|context)/i.test(
      combined,
    )
  ) {
    return true;
  }

  return false;
}

export function shouldSurfaceMeetingPilotAlert(
  alert: MeetingPilotAlertCandidate,
): boolean {
  return !isContextOnlyMeetingPilotAlert(alert);
}

function getLevelInterruptionCopy(level: MeetingPilotAlert['level']): string {
  if (level === 'P0') {
    return '立即看：可能需要你马上回应或校正会议方向。';
  }
  if (level === 'P1') {
    return '本轮处理：建议在当前话题结束前确认。';
  }
  return '旁路参考：不需要打断当前发言。';
}

function normalizeAlertTimestamp(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function formatAlertAge(createdAt?: number, now = Date.now()): {
  label: string;
  stale: boolean;
  hasTimestamp: boolean;
} {
  const timestamp = normalizeAlertTimestamp(createdAt);
  if (!timestamp) {
    return {
      label: '缺少生成时间',
      stale: true,
      hasTimestamp: false,
    };
  }

  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < 45_000) {
    return {
      label: '刚刚生成',
      stale: false,
      hasTimestamp: true,
    };
  }
  if (ageMs < 90_000) {
    return {
      label: '1 分钟前',
      stale: false,
      hasTimestamp: true,
    };
  }
  if (ageMs < 60 * 60 * 1000) {
    return {
      label: `${Math.round(ageMs / 60_000)} 分钟前`,
      stale: ageMs >= OLD_ALERT_THRESHOLD_MS,
      hasTimestamp: true,
    };
  }
  if (ageMs < 24 * 60 * 60 * 1000) {
    return {
      label: `${Math.round(ageMs / (60 * 60 * 1000))} 小时前`,
      stale: true,
      hasTimestamp: true,
    };
  }
  return {
    label: `${Math.round(ageMs / (24 * 60 * 60 * 1000))} 天前`,
    stale: true,
    hasTimestamp: true,
  };
}

function buildAlertSignalCopy(
  alert: MeetingPilotAlertCandidate,
  now?: number,
): string {
  const age = formatAlertAge(alert.createdAt, now);
  const prefix = age.hasTimestamp
    ? age.stale
      ? `较旧信号（${age.label}）：`
      : `新近信号（${age.label}）：`
    : '信号时间未知：';

  if (alert.source === 'mention') {
    return `${prefix}来自 transcript 或会中事件点名线索；先核对原句，别把它当成已经回应。`;
  }
  if (alert.source === 'action') {
    return `${prefix}来自 transcript 或会中事件待办线索；先核对 owner、deadline 和依据句。`;
  }
  if (alert.source === 'memory') {
    return `${prefix}来自记忆召回，不是新事实；需要时再打开来源核对。`;
  }
  if (alert.source === 'share') {
    return `${prefix}来自共享画面或 OCR 观察，可能延迟；以当前画面和时间线为准。`;
  }
  return `${prefix}来自会中摘要、话题或开放问题变化；先用 Catch Up 或时间线复核上下文。`;
}

export function buildMeetingPilotAlertReceipt(
  alert: MeetingPilotAlertCandidate,
  options: MeetingPilotAlertReceiptOptions = {},
): MeetingPilotAlertReceipt {
  const levelCopy = getLevelInterruptionCopy(alert.level);
  if (alert.source === 'mention') {
    return {
      reason: `${levelCopy} 检测到有人点名你、要求你确认，或把问题交给你。`,
      nextStep: '先判断是否需要当场回应；如果变成后续任务，再去行动项页复核。',
      boundary:
        '这里只是会内提醒，不会替你发言、发送消息、写入外部任务或确认任何结论。',
      signal: buildAlertSignalCopy(alert, options.now),
    };
  }

  if (alert.source === 'action') {
    return {
      reason: `${levelCopy} 检测到可能的 owner、deadline 或明确待办。`,
      nextStep: '打开行动项页核对负责人、截止时间和 transcript 依据。',
      boundary:
        '待复核项不会自动进入跟进清单、外部任务系统或会议纪要外发内容。',
      signal: buildAlertSignalCopy(alert, options.now),
    };
  }

  if (alert.source === 'memory') {
    return {
      reason: `${levelCopy} 当前讨论命中了强相关历史记忆或预演提醒。`,
      nextStep: '先看会中关联记忆的来源线索；只在需要时打开记忆库或原始来源。',
      boundary:
        '这是召回提示，不会修改记忆、分享来源、发送消息或把旧上下文当作新事实。',
      signal: buildAlertSignalCopy(alert, options.now),
    };
  }

  if (alert.source === 'share') {
    return {
      reason: `${levelCopy} 共享画面或 OCR 观察出现了可能影响讨论的变化。`,
      nextStep: '对照当前画面和时间线，确认是否需要追问、截留风险或补充行动项。',
      boundary:
        '画面观察可能有延迟；它不代表已保存截图、外发画面内容或确认页面事实。',
      signal: buildAlertSignalCopy(alert, options.now),
    };
  }

  return {
    reason: `${levelCopy} 会议话题、决策或开放问题出现了值得留意的变化。`,
    nextStep: '用 Catch Up 或时间线核对上下文，再决定是否追问或加入行动项。',
    boundary:
      '这是当前会议内的摘要提示，不会自动改写议程、确认决策或通知其他参会人。',
    signal: buildAlertSignalCopy(alert, options.now),
  };
}
