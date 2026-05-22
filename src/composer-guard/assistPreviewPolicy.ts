export type ComposerAssistFeedbackKind = 'accepted' | 'rejected';

export const DEFAULT_ASSIST_CONFIDENCE_THRESHOLD = 0.78;
export const DEFAULT_ASSIST_PREVIEW_LIMIT = 520;
const MIN_ADAPTIVE_ASSIST_CONFIDENCE = 0.62;
const MAX_ADAPTIVE_ASSIST_CONFIDENCE = 0.92;
const ACCEPT_THRESHOLD_ADJUSTMENT_RATE = 0.12;
const REJECT_THRESHOLD_ADJUSTMENT_RATE = 0.16;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundThreshold(value: number): number {
  return Number(value.toFixed(3));
}

export function normalizeComposerAssistThreshold(
  value: unknown,
  fallback = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return roundThreshold(
      clamp(
        Number.isFinite(fallback)
          ? fallback
          : DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
        MIN_ADAPTIVE_ASSIST_CONFIDENCE,
        MAX_ADAPTIVE_ASSIST_CONFIDENCE,
      ),
    );
  }
  return roundThreshold(
    clamp(
      candidate,
      MIN_ADAPTIVE_ASSIST_CONFIDENCE,
      MAX_ADAPTIVE_ASSIST_CONFIDENCE,
    ),
  );
}

export function getNextComposerAssistThreshold(
  currentValue: number,
  feedbackKind: ComposerAssistFeedbackKind,
): number {
  const current = normalizeComposerAssistThreshold(currentValue);
  if (feedbackKind === 'accepted') {
    const delta =
      (current - MIN_ADAPTIVE_ASSIST_CONFIDENCE) *
      ACCEPT_THRESHOLD_ADJUSTMENT_RATE;
    return normalizeComposerAssistThreshold(current - delta);
  }

  const delta =
    (MAX_ADAPTIVE_ASSIST_CONFIDENCE - current) *
    REJECT_THRESHOLD_ADJUSTMENT_RATE;
  return normalizeComposerAssistThreshold(current + delta);
}

export function sanitizeComposerAssistInsertText(text?: string): string {
  return (text || '')
    .replace(/^Personal AI context to consider before replying:\s*/i, '')
    .replace(/^Personal AI context pack \(review before sending\):\s*/i, '')
    .replace(/^Personal AI context for [^\n]+:\s*/i, '')
    .replace(/\n?\s*Please review and edit before sending\.?\s*$/i, '')
    .replace(
      /\n?\s*Please verify against the current Jira state before posting\.?\s*$/i,
      '',
    )
    .trim();
}

export function getComposerAssistPreviewText(
  text: string | undefined,
  options: {
    forceFull?: boolean;
    maxLength?: number;
  } = {},
): string {
  const preview = sanitizeComposerAssistInsertText(text);
  const maxLength =
    Number.isFinite(options.maxLength) && Number(options.maxLength) > 0
      ? Number(options.maxLength)
      : DEFAULT_ASSIST_PREVIEW_LIMIT;

  if (options.forceFull || preview.length <= maxLength) {
    return preview;
  }

  return `${preview.slice(0, maxLength).trimEnd()}...`;
}
