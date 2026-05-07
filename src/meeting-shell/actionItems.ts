import type { MeetingPilotActionItem } from './protocol';

interface InferActionItemArgs {
  text: string;
  speaker: string;
  chapterId: string;
  index: number;
  ts?: number;
}

const ACTION_LABEL_RE = /(?:action item|todo|待办|行动项)\s*[:：]/i;
const OWNER_LABEL_RE = /(?:owner|负责人)\s*[:：]\s*[^,，。;；\n]+/i;
const CHINESE_ASSIGNMENT_VERB_RE = /(?:负责|跟进|处理|推进|完成|确认|对齐)/;
const ENGLISH_ACTION_VERBS =
  '(?:follow up|own|handle|drive|confirm|update|prepare|send)';
const ENGLISH_DEADLINE_RE =
  /\b(?:by|before|deadline|tomorrow|next\s+(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?|friday|monday|tuesday|wednesday|thursday)\b/i;

const NAMED_OWNER_PATTERN =
  /([A-Za-z][A-Za-z .'-]{0,39}|[\u4e00-\u9fa5]{1,12})/;

function hasActionItemSignal(text: string): boolean {
  if (ACTION_LABEL_RE.test(text) || OWNER_LABEL_RE.test(text)) {
    return true;
  }

  if (
    /(?:我|俺)\s*(?:来)?(?:负责|跟进|处理|推进|完成|确认|对齐)/.test(text)
  ) {
    return true;
  }

  const namedChineseAssignment = new RegExp(
    `(?:由|让|请)\\s*${NAMED_OWNER_PATTERN.source}\\s*(?:来)?${CHINESE_ASSIGNMENT_VERB_RE.source}`,
    'i',
  );
  if (namedChineseAssignment.test(text)) {
    return true;
  }

  const directChineseAssignment = new RegExp(
    `${NAMED_OWNER_PATTERN.source}\\s*(?:来)?(?:负责|跟进|处理|推进|完成|对齐)`,
    'i',
  );
  if (directChineseAssignment.test(text)) {
    return true;
  }

  const firstPersonEnglishAssignment = new RegExp(
    `\\b(?:i(?:'ll| will)?|me)\\s+${ENGLISH_ACTION_VERBS}\\b`,
    'i',
  );
  if (firstPersonEnglishAssignment.test(text)) {
    return true;
  }

  const namedEnglishAssignment = new RegExp(
    `[A-Za-z][A-Za-z .'-]{0,39}\\s+(?:will|should|needs? to|to)\\s+${ENGLISH_ACTION_VERBS}\\b`,
    'i',
  );
  if (namedEnglishAssignment.test(text)) {
    return true;
  }

  const directEnglishWithDeadline = new RegExp(
    `\\b${ENGLISH_ACTION_VERBS}\\b`,
    'i',
  );
  return directEnglishWithDeadline.test(text) && ENGLISH_DEADLINE_RE.test(text);
}

function formatActionTimestamp(ts?: number): string | undefined {
  if (!Number.isFinite(ts)) return undefined;
  return new Date(Number(ts)).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeOwnerCandidate(
  value: string | undefined,
  speaker: string,
): string | undefined {
  let owner = String(value || '')
    .replace(/^[\s:：-]+/, '')
    .split(/[,，。;；、\n]/)[0]
    .trim();
  owner = owner
    .replace(/\s+(?:will|should|needs? to|to)\b.*$/i, '')
    .replace(/\s*(?:负责|跟进|处理|推进|完成|确认|对齐).*$/i, '')
    .replace(/\b(?:action|todo|ddl|deadline)\b.*$/i, '')
    .trim();

  if (/^(?:我|俺|me|myself|i)$/i.test(owner)) {
    return speaker || 'Unknown';
  }
  if (!owner || owner.length > 40) return undefined;
  return owner;
}

function extractActionOwner(text: string, speaker: string): string {
  if (
    /(?:我|俺)\s*(?:来)?(?:负责|跟进|处理|推进|完成|确认|对齐)/.test(text) ||
    /\b(?:i(?:'ll| will)?|me)\s+(?:follow up|own|handle|drive|confirm|update|prepare|send)\b/i.test(
      text,
    )
  ) {
    return speaker || 'Unknown';
  }

  const patterns = [
    /(?:owner|负责人)\s*[:：]\s*([^,，。;；\n]+)/i,
    new RegExp(
      `(?:由|让|请)\\s*${NAMED_OWNER_PATTERN.source}\\s*(?:来)?(?:负责|跟进|处理|推进|完成|对齐|确认)`,
      'i',
    ),
    new RegExp(
      `${NAMED_OWNER_PATTERN.source}\\s*(?:来)?(?:负责|跟进|处理|推进|完成|对齐|确认)`,
      'i',
    ),
    /([A-Za-z][A-Za-z .'-]{0,39})\s+(?:will|should|needs? to|to)\s+(?:follow up|own|handle|drive|confirm|update|prepare|send)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const owner = normalizeOwnerCandidate(match?.[1], speaker);
    if (owner) return owner;
  }

  return speaker || 'Unknown';
}

function extractActionDeadline(text: string): string | undefined {
  const explicit = text.match(
    /(?:ddl|deadline|截止|到|by)\s*[:：]?\s*([A-Za-z]+(?:\s+(?:morning|afternoon|evening|eod))?|\d{1,2}[-/]\d{1,2}|下周[一二三四五六日天]?|本周[一二三四五六日天]?|周[一二三四五六日天]|今天|明天)/i,
  );
  if (explicit?.[1]) return explicit[1].trim();

  const relative = text.match(
    /(下周[一二三四五六日天]?|本周[一二三四五六日天]?|周[一二三四五六日天]|今天|明天|tomorrow|next\s+(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?|friday|monday|tuesday|wednesday|thursday)/i,
  );
  return relative?.[1]?.trim();
}

function extractActionTitle(text: string): string {
  const labeled = text.match(
    /(?:action item|action|todo|待办|行动项)\s*[:：]\s*([^,，。;；]+)/i,
  );
  if (labeled?.[1]) return labeled[1].trim();

  const afterResponsibilityVerb = text.match(
    /(?:负责|跟进|处理|推进|完成|对齐|确认)\s*([^,，。;；]+?)(?:\s*(?:ddl|deadline|截止|到|by)\b|[,，。;；]|$)/i,
  );
  if (afterResponsibilityVerb?.[1]?.trim()) {
    return afterResponsibilityVerb[1].trim();
  }

  const needsFollowUp = text.match(
    /([^,，。;；]{2,60})\s*需要(?:我|[A-Za-z][A-Za-z .'-]{0,39}|[\u4e00-\u9fa5]{1,12})\s*(?:来)?(?:负责|跟进|处理|推进|完成|确认)/i,
  );
  if (needsFollowUp?.[1]?.trim()) return needsFollowUp[1].trim();

  const englishFollowUp = text.match(
    /(?:follow up|own|handle|drive|confirm|update|prepare|send)\s+(.+?)(?:\s+(?:by|before|deadline)\b|[,，。;；]|$)/i,
  );
  if (englishFollowUp?.[1]?.trim()) return englishFollowUp[1].trim();

  return text
    .replace(/^(?:决定|确认)\s*/i, '')
    .replace(/(?:[,，;；]\s*)?(?:ddl|deadline|截止|到|by)\s*[:：]?.*$/i, '')
    .trim()
    .slice(0, 96);
}

export function inferActionItemFromText(
  args: InferActionItemArgs,
): MeetingPilotActionItem | undefined {
  const text = String(args.text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || !hasActionItemSignal(text)) return undefined;

  const owner = extractActionOwner(text, args.speaker);
  const timestamp = formatActionTimestamp(args.ts);
  return {
    id: `action-${args.index}`,
    title: extractActionTitle(text) || text.slice(0, 96),
    owner,
    deadline: extractActionDeadline(text),
    status: 'pending',
    reviewState: 'suggested',
    chapterId: args.chapterId,
    evidence: text.slice(0, 160),
    timestamp,
    source: 'heuristic',
  };
}
