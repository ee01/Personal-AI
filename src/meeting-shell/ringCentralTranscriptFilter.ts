/**
 * Pure helpers for RingCentral in-meeting transcript / closed-caption scraping.
 * Keeps gallery tiles + bottom-bar chrome out of MEETING_PILOT_TRANSCRIPT_UPDATE.
 */

export function normalizeRingCentralTranscriptText(
  value?: string | null,
): string {
  return (value || '')
    .replace(/â€¢/g, '•')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MEETING_CHROME_CONTROL_LINE_RE =
  /^(unmute|mute|start video|stop video|share|invite|participants|chat|react|raise hand|more|leave|join audio|turn on camera|turn off camera|view notes|report issue)$/i;

const MEETING_CHROME_BANNER_RE =
  /joined late|catch up using meeting notes|view notes/i;

/** Bottom-bar / gallery control phrases that appear in a dumped chrome blob. */
const MEETING_CHROME_CONTROL_PHRASES = [
  'unmute',
  'start video',
  'stop video',
  'share',
  'invite',
  'participants',
  'chat',
  'react',
  'raise hand',
  'more',
  'leave',
] as const;

export function isRingCentralCaptionControlLine(
  value?: string | null,
): boolean {
  const text = normalizeRingCentralTranscriptText(value);
  return /^(closed captions?|captions?|show captions?|hide captions?|caption settings|language|translate|translation|turn on captions?|turn off captions?)$/i.test(
    text,
  );
}

export function isRingCentralCaptionSettingsText(
  value?: string | null,
): boolean {
  const text = normalizeRingCentralTranscriptText(value);
  if (!text) return false;
  return (
    /spoken language/i.test(text) &&
    /translate to/i.test(text) &&
    /(small|medium|large)/i.test(text)
  );
}

export function isRingCentralTranscriptNoiseLine(
  value?: string | null,
): boolean {
  const text = normalizeRingCentralTranscriptText(value);
  if (!text) return true;
  if (/^[a-f0-9]{24,}$/i.test(text)) return true;
  if (/^image(?:[:/]|$)/i.test(text)) return true;
  if (/^svg\+xml/i.test(text)) return true;
  if (/^•?\s*you$/i.test(text)) return true;
  if (MEETING_CHROME_CONTROL_LINE_RE.test(text)) return true;
  if (/^1\/\d+$/.test(text)) return true;
  return /^(search|transcript|notes(?:\s*\(beta\))?|translate|close|pause notes, transcripts and recording)$/i.test(
    text,
  );
}

export function looksLikeTranscriptTimeLine(value?: string | null): boolean {
  return /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/i.test(
    normalizeRingCentralTranscriptText(value),
  );
}

/**
 * Detects gallery + toolbar dumps mistakenly scraped as "caption" text, e.g.
 * "Esone Qiu (You) Karan … Unmute Start video Share Invite Participants 22 … Leave"
 */
export function looksLikeMeetingChromeTranscriptDump(
  value?: string | null,
): boolean {
  const text = normalizeRingCentralTranscriptText(value);
  if (!text) return false;
  if (MEETING_CHROME_BANNER_RE.test(text)) return true;

  const lower = text.toLowerCase();
  let controlHits = 0;
  for (const phrase of MEETING_CHROME_CONTROL_PHRASES) {
    if (lower.includes(phrase)) controlHits += 1;
  }
  if (controlHits < 3) return false;

  // Multiple participant-style tokens (Name Name or Name (You)) plus controls.
  const nameLike = text.match(
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+(?:\s*\([^)]+\))?/g,
  );
  if ((nameLike?.length || 0) >= 2) return true;

  // Long blob dominated by chrome controls even without clear name tokens.
  return text.length >= 80 && controlHits >= 5;
}

export function shouldKeepRingCentralTranscriptText(
  value?: string | null,
): boolean {
  const text = normalizeRingCentralTranscriptText(value);
  if (!text) return false;
  if (text.length < 2) return false;
  if (isRingCentralTranscriptNoiseLine(text)) return false;
  if (isRingCentralCaptionControlLine(text)) return false;
  if (isRingCentralCaptionSettingsText(text)) return false;
  if (looksLikeMeetingChromeTranscriptDump(text)) return false;
  if (looksLikeTranscriptTimeLine(text)) return false;
  return /[a-zA-Z\u4e00-\u9fa5]/.test(text);
}
