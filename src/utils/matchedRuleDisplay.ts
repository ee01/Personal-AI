function splitMatchedRuleLines(value: string): string[] {
  return value
    .split(/\n+|；|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

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

export function mergeMatchedRuleDisplay(
  existing: unknown,
  incoming: unknown,
): string {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const source of [existing, incoming]) {
    const formatted = formatMatchedRuleForDisplay(source, '');
    if (!formatted) continue;
    for (const line of splitMatchedRuleLines(formatted)) {
      const key = line.replace(/（@提醒）$/, '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(line);
    }
  }

  return unique.join('\n');
}
