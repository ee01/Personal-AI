/**
 * Shared cue comparison for rehearsal activation and Assist A-slot anchors.
 *
 * Substring matching (`"central"` inside `"ringcentral"`) was letting global
 * stopwords and owner identity words count as a hit. Comparison is whole-token
 * for Latin, contiguous run for CJK, and a stopword list covers the company
 * vocabulary that appears in almost every work thread.
 */

export const GLOBAL_CUE_STOPWORDS = new Set([
  'ringcentral',
  'glip',
  'jira',
  'slack',
  'zoom',
  'teams',
  'google',
  'chrome',
  'gmail',
  'calendar',
  'meeting',
  'message',
  'comment',
  'thread',
  'email',
  'personal',
  'ai',
  'please',
  'thanks',
  'thank',
  'hello',
  'hi',
  'ok',
  'okay',
  'yes',
  'no',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'about',
  'company',
  'team',
  'group',
  'project',
  'issue',
  'ticket',
  'update',
  'status',
  'review',
  'reply',
  'follow',
  'followup',
]);

const GENERIC_TOPIC_STOPWORDS = new Set([
  ...GLOBAL_CUE_STOPWORDS,
  'work',
  'chat',
  'video',
  'call',
  'sync',
  'today',
  'tomorrow',
  'morning',
  'afternoon',
]);

export function normalizeCueValue(value: string | undefined | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/^[@#]+/, '')
    .replace(/^(group|conversation|meeting|issue|url):/i, '')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCueStopword(value: string | undefined | null): boolean {
  const normalized = normalizeCueValue(value);
  if (!normalized) return true;
  if (GLOBAL_CUE_STOPWORDS.has(normalized)) return true;
  if (GENERIC_TOPIC_STOPWORDS.has(normalized)) return true;
  return false;
}

export function isInformativeTopicCue(value: string | undefined | null): boolean {
  const normalized = normalizeCueValue(value);
  if (!normalized || normalized.length < 3) return false;
  if (isCueStopword(normalized)) return false;
  return true;
}

function isCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function tokensContainSequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((token, offset) => haystack[index + offset] === token)) {
      return true;
    }
  }
  return false;
}

/**
 * True when `cue` and `scene` refer to the same token, not a substring of a
 * longer identifier. `"central"` does not match `"ringcentral"`. `"colin"`
 * matches `"colin liu"`. CJK uses a contiguous run of at least 2 characters.
 */
export function cueValuesMatch(cue: string, scene: string): boolean {
  const left = normalizeCueValue(cue);
  const right = normalizeCueValue(scene);
  if (!left || !right) return false;
  if (left === right) return true;
  if (isCueStopword(left) || isCueStopword(right)) return false;

  if (isCjk(left) || isCjk(right)) {
    const [shorter, longer] =
      left.length <= right.length ? [left, right] : [right, left];
    return shorter.length >= 2 && longer.includes(shorter);
  }

  const leftTokens = left.split(' ').filter(Boolean);
  const rightTokens = right.split(' ').filter(Boolean);
  if (
    leftTokens.length === 1 &&
    leftTokens[0].length >= 3 &&
    rightTokens.includes(leftTokens[0])
  ) {
    return true;
  }
  if (
    rightTokens.length === 1 &&
    rightTokens[0].length >= 3 &&
    leftTokens.includes(rightTokens[0])
  ) {
    return true;
  }
  if (left.length >= 4 && tokensContainSequence(rightTokens, leftTokens)) {
    return true;
  }
  if (right.length >= 4 && tokensContainSequence(leftTokens, rightTokens)) {
    return true;
  }
  return false;
}
