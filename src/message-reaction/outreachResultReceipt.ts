export const OUTREACH_CONTINUE_MARKER_PREFIX = 'pai-outreach-continue:';
export const OUTREACH_CONTINUE_DEFAULT_INTERVAL_HOURS = 24;
export const OUTREACH_CONTINUE_MAX_INTERVAL_HOURS = 720;
export const OUTREACH_CONTINUE_DEFAULT_MAX_FOLLOWUP = 1;
export const OUTREACH_CONTINUE_MAX_FOLLOWUP = 10;

export function parseOutreachContinueSessionId(
  text: unknown,
): string | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  const match = text.match(
    /pai-outreach-continue:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1]?.toLowerCase();
}

export function buildGlipMessageUrl(
  chatId?: string | null,
  postId?: string | null,
): string {
  const chat = typeof chatId === 'string' ? chatId.trim() : '';
  const post = typeof postId === 'string' ? postId.trim() : '';
  if (!chat || !post) return '';
  return `https://app.ringcentral.com/messages/${encodeURIComponent(chat)}/${encodeURIComponent(post)}`;
}

export function buildContinueFollowupRunSummary(options: {
  intervalHours: number;
  maxFollowup: number;
}): string {
  const intervalHours = Math.max(1, Math.floor(options.intervalHours));
  const maxFollowup = Math.max(1, Math.floor(options.maxFollowup));
  return `会先等待 ${intervalHours} 小时再追问，最多再追问 ${maxFollowup} 次；不会重发原问题，只在原帖 bump。`;
}

export function buildContinueFollowupSubmittingMessage(): string {
  return '正在把这条终态询问改回等待回复；此刻不会立刻发送追问，也不会重发原问题。到达间隔后才会 bump 原帖。';
}

export function buildContinueFollowupToastMessage(options: {
  intervalHours: number;
  maxFollowup: number;
  waitUntil?: number | null;
}): string {
  const intervalHours = Math.max(1, Math.floor(options.intervalHours));
  const maxFollowup = Math.max(1, Math.floor(options.maxFollowup));
  const waitText =
    typeof options.waitUntil === 'number' && Number.isFinite(options.waitUntil)
      ? `下次追问不早于 ${new Date(options.waitUntil * 1000).toLocaleString('zh-CN', { hour12: false })}。`
      : `下次追问将按 ${intervalHours} 小时间隔计算。`;
  return `已继续追问：最多再追问 ${maxFollowup} 次。${waitText} 没有立刻发送新消息。`;
}
