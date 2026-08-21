export const OUTREACH_CONTINUE_MARKER_PREFIX = 'pai-outreach-continue:';
export const OUTREACH_CONTINUE_MAX_FOLLOWUP = 10;
export const OUTREACH_CONTINUE_MIN_INTERVAL_SECONDS = 3600;
export const OUTREACH_CONTINUE_MAX_INTERVAL_SECONDS = 720 * 3600;

export type OutreachResultNoticeStatus = 'resolved' | 'no_reply' | 'escalated';

export interface OutreachFollowupMessageRef {
  chatId: string;
  postId: string;
}

export interface BuildOutreachResultNoticeInput {
  status: OutreachResultNoticeStatus;
  sessionId: string;
  targetLabel?: string;
  question: string;
  summary: string;
  followupCount?: number;
  followupMessages?: OutreachFollowupMessageRef[];
  originalChatId?: string;
  originalPostId?: string;
}

export function buildGlipMessageUrl(
  chatId?: string | null,
  postId?: string | null,
): string | undefined {
  const chat = typeof chatId === 'string' ? chatId.trim() : '';
  const post = typeof postId === 'string' ? postId.trim() : '';
  if (!chat || !post) return undefined;
  return `https://app.ringcentral.com/messages/${encodeURIComponent(chat)}/${encodeURIComponent(post)}`;
}

export function collectFollowupMessageRefs(
  events: Array<{ eventType?: string; payload?: Record<string, unknown> | null }>,
): OutreachFollowupMessageRef[] {
  const refs: OutreachFollowupMessageRef[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.eventType !== 'followup_sent') continue;
    const chatId =
      typeof event.payload?.chatId === 'string' ? event.payload.chatId.trim() : '';
    const postId =
      typeof event.payload?.postId === 'string' ? event.payload.postId.trim() : '';
    if (!chatId || !postId) continue;
    const key = `${chatId}:${postId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ chatId, postId });
  }
  return refs;
}

export function buildOutreachContinueMarker(sessionId: string): string {
  return `${OUTREACH_CONTINUE_MARKER_PREFIX}${sessionId.trim()}`;
}

export function parseOutreachContinueSessionId(
  text: unknown,
): string | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  const match = text.match(
    /pai-outreach-continue:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1]?.toLowerCase();
}

export function normalizeContinueFollowupInput(input: {
  maxFollowup?: unknown;
  followupIntervalSeconds?: unknown;
}): { maxFollowup: number; followupIntervalSeconds: number } {
  const rawCount = Number(input.maxFollowup ?? 1);
  const maxFollowup = Number.isFinite(rawCount)
    ? Math.min(
        OUTREACH_CONTINUE_MAX_FOLLOWUP,
        Math.max(1, Math.floor(rawCount)),
      )
    : 1;
  const rawInterval = Number(input.followupIntervalSeconds ?? 86400);
  const followupIntervalSeconds = Number.isFinite(rawInterval)
    ? Math.min(
        OUTREACH_CONTINUE_MAX_INTERVAL_SECONDS,
        Math.max(OUTREACH_CONTINUE_MIN_INTERVAL_SECONDS, Math.floor(rawInterval)),
      )
    : 86400;
  return { maxFollowup, followupIntervalSeconds };
}

export function buildOutreachResultNotice(
  input: BuildOutreachResultNoticeInput,
): { title: string; body: string } {
  const title =
    input.status === 'no_reply'
      ? '主动询问超时'
      : input.status === 'escalated'
        ? '主动询问未得到可用结论'
        : '主动询问结果';
  const targetLabel = input.targetLabel?.trim();
  const followupMessages = input.followupMessages ?? [];
  const followupCount = Math.max(
    input.followupCount ?? 0,
    followupMessages.length,
  );
  const latestFollowup = followupMessages[followupMessages.length - 1];
  const followupUrl = latestFollowup
    ? buildGlipMessageUrl(latestFollowup.chatId, latestFollowup.postId)
    : undefined;
  const originalUrl = buildGlipMessageUrl(
    input.originalChatId,
    input.originalPostId,
  );

  const lines = [
    targetLabel ? `对象：${targetLabel}` : '',
    `问题：${input.question.trim()}`,
    `结果：${input.summary.trim()}`,
    followupCount > 0 ? `追问：已发生 ${followupCount} 次` : '追问：未发生',
    followupUrl ? `查看追问消息：${followupUrl}` : '',
    originalUrl ? `原询问：${originalUrl}` : '',
    '继续追问：在本条 Bot 回执上点「继续追问」，设置下次间隔和次数；也可打开主动询问会话详情配置。',
    buildOutreachContinueMarker(input.sessionId),
  ].filter(Boolean);

  return { title, body: lines.join('\n') };
}
