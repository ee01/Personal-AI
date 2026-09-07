export type RepeatUnit = 'Day' | 'Week' | 'Month' | 'Year';
export type NotifyVia = 'plugin' | 'bot' | 'asme';
export type TargetType = 'private' | 'group';

export const WEEK_DAYS = [
  { day: 0, label: '日' },
  { day: 1, label: '一' },
  { day: 2, label: '二' },
  { day: 3, label: '三' },
  { day: 4, label: '四' },
  { day: 5, label: '五' },
  { day: 6, label: '六' },
] as const;

export const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatLocalTime(date = new Date()): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function setDateDay(scheduleDate: string, day: number): string {
  const parsed = parseLocalDate(scheduleDate) ?? new Date();
  const max = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
  parsed.setDate(Math.min(Math.max(day, 1), max));
  return formatLocalDate(parsed);
}

export function dayOfMonth(scheduleDate: string): number {
  return parseLocalDate(scheduleDate)?.getDate() ?? new Date().getDate();
}

export function toStorageUserName(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const parts = trimmed.includes('.') ? trimmed.split('.') : trimmed.split(/\s+/);
  return parts.filter(Boolean).join('.');
}

export function toDisplayUserName(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const parts = trimmed.includes('.') ? trimmed.split('.') : trimmed.split(/\s+/);
  return parts
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isValidUserName(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const parts = trimmed.includes('.') ? trimmed.split('.') : trimmed.split(/\s+/);
  return parts.length >= 2 && parts.every((part) => part.length > 0);
}

export function addRecipientTag(tags: string[], raw: string): { tags: string[]; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { tags };
  if (!isValidUserName(trimmed)) {
    return { tags, error: '人名需包含名和姓，例如 Esone Qiu 或 esone.qiu' };
  }
  const display = toDisplayUserName(trimmed);
  if (tags.includes(display)) return { tags };
  return { tags: [...tags, display] };
}

export function buildNotifyPayload(input: {
  notifyVia: NotifyVia;
  targetType: TargetType;
  recipients: string[];
  glipTeamId: string;
}): {
  notifyVia: NotifyVia;
  channel: NotifyVia;
  notifyTarget:
    | { type: 'group'; targetGroupId: string; glipTeamId: string }
    | { type: 'private'; targetUserId: string; glipUserName: string; glipUser: string }
    | undefined;
} {
  if (input.notifyVia === 'plugin') {
    return { notifyVia: 'plugin', channel: 'plugin', notifyTarget: undefined };
  }
  if (input.targetType === 'group') {
    const groupId = input.glipTeamId.trim();
    return {
      notifyVia: input.notifyVia,
      channel: input.notifyVia,
      notifyTarget: groupId
        ? { type: 'group', targetGroupId: groupId, glipTeamId: groupId }
        : undefined,
    };
  }
  const stored = input.recipients.map(toStorageUserName).filter(Boolean);
  const targetUserId = stored[0] ?? '';
  const glipUserName = stored.join('+');
  return {
    notifyVia: input.notifyVia,
    channel: input.notifyVia,
    notifyTarget: targetUserId
      ? {
          type: 'private',
          targetUserId,
          glipUserName,
          glipUser: stored[0],
        }
      : undefined,
  };
}

export function buildRecurrenceSpec(input: {
  repeating: boolean;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
  scheduleDate: string;
  scheduleTime: string;
  weekDays: number[];
  endDate: string;
  repeatCount: number | '';
  timezone?: string;
}): Record<string, unknown> | undefined {
  if (!input.repeating) return undefined;
  const every = Number(input.repeatEvery);
  if (!Number.isFinite(every) || every < 1) return undefined;
  const spec: Record<string, unknown> = {
    repeatEvery: every,
    repeatUnit: input.repeatUnit,
    scheduleDate: input.scheduleDate,
    scheduleTime: input.scheduleTime || '09:00',
    timezone: input.timezone || 'Asia/Shanghai',
  };
  if (input.repeatUnit === 'Week' && input.weekDays.length > 0) {
    spec.repeatDays = [...input.weekDays].sort((a, b) => a - b).join(',');
  }
  if (input.endDate.trim()) spec.endDate = input.endDate.trim();
  if (input.repeatCount !== '' && Number(input.repeatCount) > 0) {
    spec.repeatCount = Number(input.repeatCount);
  }
  return spec;
}

export function resolveScheduledAtMs(input: {
  scheduleDate: string;
  scheduleTime: string;
}): number {
  const date = parseLocalDate(input.scheduleDate) ?? new Date();
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(input.scheduleTime.trim());
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }
  return date.getTime();
}

export function applyQuickSchedule(
  kind: 'one-minute' | 'next-hour' | 'default-morning',
  now = new Date(),
): { scheduleDate: string; scheduleTime: string } {
  const next = new Date(now);
  if (kind === 'one-minute') {
    next.setMinutes(next.getMinutes() + 1, 0, 0);
  } else if (kind === 'next-hour') {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setHours(9, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  }
  return { scheduleDate: formatLocalDate(next), scheduleTime: formatLocalTime(next) };
}

export function snapScheduleDateToWeekDays(
  scheduleDate: string,
  weekDays: number[],
  now = new Date(),
): string {
  if (weekDays.length === 0) return scheduleDate;
  const start = parseLocalDate(scheduleDate) ?? now;
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (weekDays.includes(candidate.getDay())) return formatLocalDate(candidate);
  }
  return scheduleDate;
}

export function notifyTargetIncomplete(input: {
  notifyVia: NotifyVia;
  targetType: TargetType;
  recipients: string[];
  glipTeamId: string;
  allowEmptyPrivate?: boolean;
}): boolean {
  if (input.notifyVia === 'plugin') return false;
  if (input.targetType === 'group') return !input.glipTeamId.trim();
  if (input.allowEmptyPrivate) return false;
  return input.recipients.length === 0;
}

export function recurrenceLabelFromSpec(spec?: Record<string, unknown> | null): string {
  if (!spec) return '一次性';
  const every = Number(spec.repeatEvery) || 1;
  const unit = String(spec.repeatUnit ?? '');
  const map: Record<string, string> = { Day: '工作日', Week: '周', Month: '月', Year: '年' };
  const unitLabel = map[unit] ?? unit;
  const days = typeof spec.repeatDays === 'string' && spec.repeatDays.trim()
    ? spec.repeatDays
        .split(',')
        .map((day) => WEEK_DAYS.find((item) => item.day === Number(day.trim()))?.label)
        .filter(Boolean)
        .join('、')
    : '';
  if (unit === 'Week' && days) return `每 ${every} 周 · 周${days}`;
  if (unit === 'Month' && typeof spec.scheduleDate === 'string') {
    const day = dayOfMonth(spec.scheduleDate);
    return `每 ${every} 月 · ${day} 号`;
  }
  return `每 ${every} ${unitLabel}`;
}

export type TaskDraftKind = 'push' | 'agent' | 'remind' | 'dev' | 'reflection' | 'outreach';
export type TaskDraftLane = 'memory_cron' | 'jira_sheet';

export interface TaskCenterDraft {
  taskKind: TaskDraftKind;
  title: string;
  content: string;
  acceptance: string;
  mode: 'read' | 'write';
  remindPreset: string;
  lane: TaskDraftLane | undefined;
  pushMethod: 'message' | 'ai';
  notifyVia: NotifyVia;
  targetType: TargetType;
  recipients: string[];
  recipientInput: string;
  glipTeamId: string;
  successReceipt: boolean;
  extraText: string;
  outreachMaxFollowup: number;
  outreachFollowupHours: number;
  scheduleDate: string;
  scheduleTime: string;
  repeating: boolean;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
  weekDays: number[];
  endDate: string;
  repeatCount: number | '';
}

export function createEmptyTaskDraft(input: {
  botConfigured: boolean;
  asmeConfigured: boolean;
  now?: Date;
}): TaskCenterDraft {
  const nowDate = input.now ?? new Date();
  return {
    taskKind: 'push',
    title: '',
    content: '',
    acceptance: '',
    mode: 'read',
    remindPreset: '今晚 19:00',
    lane: undefined,
    pushMethod: 'message',
    notifyVia: input.botConfigured ? 'bot' : input.asmeConfigured ? 'asme' : 'plugin',
    targetType: 'private',
    recipients: [],
    recipientInput: '',
    glipTeamId: '',
    successReceipt: true,
    extraText: '',
    outreachMaxFollowup: 2,
    outreachFollowupHours: 24,
    scheduleDate: formatLocalDate(nowDate),
    scheduleTime: formatLocalTime(nowDate),
    repeating: false,
    repeatEvery: 1,
    repeatUnit: 'Week',
    weekDays: [],
    endDate: '',
    repeatCount: '',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeNotifyVia(value: unknown): NotifyVia {
  const raw = readString(value).trim().toLowerCase();
  if (raw === 'asme') return 'asme';
  if (raw === 'bot' || raw === 'group' || raw === 'auto') return 'bot';
  return 'plugin';
}

function parseWeekDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function hydrateTaskDraftFromTask(
  task: {
    title?: string;
    description?: string;
    taskKind?: string;
    lane?: string;
    scheduledAt?: number;
    recurrenceSpec?: Record<string, unknown> | null;
    params?: Record<string, unknown> | null;
  },
  defaults: { botConfigured: boolean; asmeConfigured: boolean; now?: Date },
): TaskCenterDraft {
  const draft = createEmptyTaskDraft(defaults);
  const params = asRecord(task.params);
  const metadata = asRecord(params.metadata);
  const notifyTarget = asRecord(metadata.notifyTarget ?? params.notifyTarget);
  const spec = asRecord(task.recurrenceSpec);
  const kind = readString(task.taskKind) as TaskDraftKind;
  if (['push', 'agent', 'remind', 'dev', 'reflection', 'outreach'].includes(kind)) {
    draft.taskKind = kind;
  }
  draft.title = readString(task.title);
  draft.content =
    readString(params.content) ||
    readString(params.task) ||
    readString(params.question) ||
    readString(params.body) ||
    readString(task.description);
  draft.acceptance = readString(params.acceptance);
  draft.mode = readString(params.mode).toLowerCase() === 'write' ? 'write' : 'read';
  draft.remindPreset = readString(params.remindPreset);
  draft.lane = task.lane === 'jira_sheet' ? 'jira_sheet' : task.lane === 'memory_cron' ? 'memory_cron' : undefined;
  draft.pushMethod = readString(params.pushMethod).toLowerCase() === 'ai' ? 'ai' : 'message';
  draft.extraText = readString(params.extraText);
  draft.successReceipt = metadata.successReceipt !== false && params.successReceipt !== false;
  const maxFollowup = Number(params.maxFollowup);
  if (Number.isFinite(maxFollowup) && maxFollowup >= 0) draft.outreachMaxFollowup = maxFollowup;
  const followupHours = Number(params.followupIntervalHours);
  if (Number.isFinite(followupHours) && followupHours >= 1) draft.outreachFollowupHours = followupHours;

  const channel = metadata.notifyVia ?? params.notifyVia ?? params.channel;
  draft.notifyVia = normalizeNotifyVia(channel);
  const groupId =
    readString(notifyTarget.targetGroupId) ||
    readString(notifyTarget.glipTeamId) ||
    readString(params.teamId) ||
    readString(params.targetRef);
  const privateNames =
    readString(notifyTarget.glipUserName) ||
    readString(notifyTarget.glipUser) ||
    readString(notifyTarget.targetUserId) ||
    (draft.taskKind === 'outreach' ? readString(params.targetRef) : '');
  const outreachType = readString(params.targetType).toLowerCase();
  if (notifyTarget.type === 'group' || outreachType === 'group' || (groupId && !privateNames)) {
    draft.targetType = 'group';
    draft.glipTeamId = groupId;
  } else {
    draft.targetType = 'private';
    draft.glipTeamId = groupId && outreachType !== 'private' ? groupId : '';
    draft.recipients = privateNames
      .split(/[+]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map(toDisplayUserName);
  }

  const scheduled = typeof task.scheduledAt === 'number' && Number.isFinite(task.scheduledAt)
    ? new Date(task.scheduledAt * 1000)
    : defaults.now ?? new Date();
  draft.scheduleDate = readString(spec.scheduleDate) || formatLocalDate(scheduled);
  draft.scheduleTime = readString(spec.scheduleTime) || formatLocalTime(scheduled);
  const every = Number(spec.repeatEvery);
  const unit = readString(spec.repeatUnit) as RepeatUnit;
  draft.repeating = Boolean(every > 0 && ['Day', 'Week', 'Month', 'Year'].includes(unit));
  if (draft.repeating) {
    draft.repeatEvery = every;
    draft.repeatUnit = unit;
    draft.weekDays = parseWeekDays(spec.repeatDays);
    draft.endDate = readString(spec.endDate);
    const count = Number(spec.repeatCount);
    draft.repeatCount = Number.isFinite(count) && count > 0 ? count : '';
  }
  return draft;
}

export function notifyWhenEmptyFromTask(params?: Record<string, unknown> | null): boolean | null {
  const metadata = asRecord(asRecord(params).metadata);
  const raw = metadata.notifyWhenEmpty ?? asRecord(params).notifyWhenEmpty;
  if (raw === true || raw === 'Y') return true;
  if (raw === false || raw === 'N') return false;
  return null;
}

