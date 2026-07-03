export function formatMatchedRuleForDisplay(
  matchedRule: unknown,
  fallback = '消息匹配',
): string {
  const raw = typeof matchedRule === 'string' ? matchedRule.trim() : '';
  if (!raw) return fallback;

  const cleaned = raw
    .replace(/(^|[\n;；])\s*规则\s*\d+\s*[:：]\s*/g, '$1')
    .replace(/\s*\[RULE_REF:[^\]]+\]\s*/g, ' ')
    .replace(/\s*\[RULE_ID:\d+\]\s*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return cleaned || fallback;
}
