export interface FollowupAskToastSession {
  renderedContext?: unknown;
  status?: unknown;
  waitUntil?: unknown;
  nextCheckAt?: unknown;
  maxFollowup?: unknown;
}

export interface FollowupAskToastResponse {
  created?: unknown;
  session?: FollowupAskToastSession | null;
}

export interface FollowupAskSubmittingOptions {
  maxFollowup?: unknown;
}

export interface FollowupAskRunSummaryOptions {
  messageCreatedAt?: unknown;
  intervalHours: number;
  maxFollowup: number;
  nowSeconds?: number;
  locale?: string;
  timeZone?: string;
}

export interface FollowupAskSubmitBoundaryOptions
  extends FollowupAskRunSummaryOptions {
  targetLabel?: unknown;
  submitting?: boolean;
}

interface FollowupAskToastOptions {
  nowSeconds?: number;
  locale?: string;
  timeZone?: string;
  maxFollowup?: unknown;
}

export function buildFollowupAskSubmittingMessage(
  options: FollowupAskSubmittingOptions = {},
): string {
  const base =
    '正在创建或复用跟进会话；此刻不会发送追问、不写 Google Sheet，也不创建可复用 Outreach template。创建成功后只会先检查原消息线程，并刷新本地跟进标注。';
  const maxFollowup = normalizeFollowupCount(options.maxFollowup);
  if (maxFollowup === undefined) return base;
  if (maxFollowup === 0) {
    return `${base} 本次设置最多追问次数为 0，只检查完成标准，不会自动发送 AI 追问。`;
  }
  return `${base} 本次最多自动追问 ${maxFollowup} 次。`;
}

function normalizeFollowupGoalForDisplay(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

function normalizeFollowupTargetForDisplay(value: unknown): string {
  if (typeof value !== 'string') return '当前会话';
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || '当前会话';
}

function normalizeEpochSeconds(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.floor(numeric);
}

function normalizeFollowupCount(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return Math.floor(numeric);
}

function formatFollowupReceiptTime(
  epochSeconds: number,
  options: FollowupAskToastOptions,
): string {
  return new Date(epochSeconds * 1000).toLocaleString(
    options.locale ?? 'zh-CN',
    {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: options.timeZone,
    },
  );
}

function buildFollowupCountReceipt(maxFollowup: unknown): string {
  const normalized = normalizeFollowupCount(maxFollowup);
  if (normalized === 0) {
    return '最多追问次数为 0，只检查完成标准，不自动发送 AI 追问。';
  }
  if (normalized && normalized > 0) {
    return `未命中时最多自动追问 ${normalized} 次。`;
  }
  return '未命中时才继续追问。';
}

export function buildFollowupAskRunSummary(
  options: FollowupAskRunSummaryOptions,
): string {
  const intervalHours = Math.max(1, Math.floor(options.intervalHours || 1));
  const maxFollowupReceipt = buildFollowupCountReceipt(options.maxFollowup);
  const createdAt = normalizeEpochSeconds(options.messageCreatedAt);
  if (!createdAt) {
    return `创建后会先检查当前会话是否已有满足目标的回复；${maxFollowupReceipt}`;
  }

  const dueAt = createdAt + intervalHours * 3600;
  const nowSeconds =
    options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (dueAt <= nowSeconds) {
    return `原消息已超过 ${intervalHours} 小时，创建后会立即检查是否已有满足目标的回复；${maxFollowupReceipt}`;
  }

  return `预计 ${formatFollowupReceiptTime(
    dueAt,
    options,
  )} 后检查回复；如果已有回复满足目标，会自动结束。${maxFollowupReceipt}`;
}

export function buildFollowupAskSubmitBoundary(
  options: FollowupAskSubmitBoundaryOptions,
): string {
  const target = normalizeFollowupTargetForDisplay(options.targetLabel);
  const runSummary = options.submitting
    ? buildFollowupAskSubmittingMessage({
        maxFollowup: options.maxFollowup,
      })
    : buildFollowupAskRunSummary(options);
  return `创建跟进：锚定 ${target}和这条原消息；${runSummary} 点击只会创建或复用 message reaction Outreach session，不会立刻发送新消息、不写 Google Sheet，也不创建可复用 Outreach template；同一原消息已有跟进时会复用旧 session。`;
}

function buildFollowupScheduleReceipt(
  session: FollowupAskToastSession | null | undefined,
  options: FollowupAskToastOptions,
): string | undefined {
  const nowSeconds =
    options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxFollowup = normalizeFollowupCount(
    options.maxFollowup ?? session?.maxFollowup,
  );
  const noAutoFollowupSuffix =
    maxFollowup === 0
      ? '最多追问次数为 0，不会自动发送 AI 追问。'
      : '';
  const waitUntil = normalizeEpochSeconds(session?.waitUntil);
  if (waitUntil) {
    if (waitUntil > nowSeconds + 60) {
      const checkTime = formatFollowupReceiptTime(waitUntil, options);
      return noAutoFollowupSuffix
        ? `若仍未满足完成标准，最早 ${checkTime} 后再次检查；${noAutoFollowupSuffix}`
        : `若仍未满足完成标准，最早 ${checkTime} 后追问。`;
    }
    return noAutoFollowupSuffix
      ? `若仍未满足完成标准，会进入当前检查轮次；${noAutoFollowupSuffix}`
      : '若仍未满足完成标准，会进入当前检查轮次后追问。';
  }

  const nextCheckAt = normalizeEpochSeconds(session?.nextCheckAt);
  if (nextCheckAt && nextCheckAt > nowSeconds + 60) {
    const nextCheckLabel = formatFollowupReceiptTime(nextCheckAt, options);
    return noAutoFollowupSuffix
      ? `下一次检查：${nextCheckLabel}；${noAutoFollowupSuffix}`
      : `下一次检查：${nextCheckLabel}。`;
  }

  return undefined;
}

export function buildFollowupAskToastMessage(
  response: FollowupAskToastResponse,
  options: FollowupAskToastOptions = {},
): string {
  if (response?.created === false) {
    const existingGoal = normalizeFollowupGoalForDisplay(
      response?.session?.renderedContext,
    );
    const base = existingGoal
      ? `这条消息已有跟进，未覆盖原目标：${existingGoal}`
      : '这条消息已有跟进，未覆盖原目标';
    const scheduleReceipt = buildFollowupScheduleReceipt(
      response?.session,
      options,
    );
    return scheduleReceipt ? `${base}；${scheduleReceipt}` : base;
  }

  const scheduleReceipt = buildFollowupScheduleReceipt(
    response?.session,
    options,
  );
  return scheduleReceipt
    ? `已创建跟进会话；未立刻发送追问，会先检查原消息线程。${scheduleReceipt}`
    : '已创建跟进会话；未立刻发送追问，会先检查原消息线程。';
}
