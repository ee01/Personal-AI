import type {
  OutreachEvidenceItem,
  OutreachEvent,
  OutreachSession,
} from '../../services/MemoryServiceClient';

type UnknownRecord = Record<string, unknown>;

export interface OutreachEvidenceSnapshot {
  hasEvidence: boolean;
  stateLabel: string;
  phaseKey: string;
  phaseLabel: string;
  source: string;
  summary: string;
  relatedMessage: string;
  relatedMessageId: string;
}

export function getLatestReplyEvent(
  session: OutreachSession,
): OutreachEvent | null {
  const replyEvents = (session.events ?? []).filter(
    (event) => event.eventType === 'reply_received',
  );
  return replyEvents.length > 0 ? replyEvents[replyEvents.length - 1] : null;
}

export function getOutreachEvidenceSnapshot(
  session: OutreachSession,
): OutreachEvidenceSnapshot {
  const primaryEvidence = pickPrimaryEvidence(session.evidence ?? []);
  const evidenceMeta = toRecord(primaryEvidence?.metadata);
  const outcome = toRecord(session.outcome);
  const replyEvent = getLatestReplyEvent(session);
  const payload = toRecord(replyEvent?.payload);

  const phaseKey = normalizePhaseKey(
    pickString(
      outcome,
      [
        'answerResolutionPhase',
        'matchPhase',
        'hitPhase',
        'triggerPhase',
        'resolutionPhase',
        'phase',
      ],
      payload,
      [
        'answerResolutionPhase',
        'matchPhase',
        'hitPhase',
        'triggerPhase',
        'resolutionPhase',
        'phase',
      ],
    ) ||
      readString(evidenceMeta, 'answerResolutionPhase') ||
      readString(evidenceMeta, 'phase') ||
      (session.replyRawText?.trim() ? 'direct_reply' : ''),
  );

  const source = normalizeSourceLabel(
    pickString(
      outcome,
      [
        'hitSource',
        'sourceLabel',
        'source',
        'sourceKind',
        'ruleSource',
        'matchedRuleSource',
        'provider',
        'ruleRef',
      ],
      payload,
      [
        'hitSource',
        'sourceLabel',
        'source',
        'sourceKind',
        'ruleSource',
        'matchedRuleSource',
        'provider',
        'ruleRef',
      ],
    ) ||
    readString(evidenceMeta, 'hitSource') ||
    primaryEvidence?.title ||
    primaryEvidence?.sourceKind ||
    '',
  );

  const summary =
    pickString(
      outcome,
      [
        'evidenceSummary',
        'hitSummary',
        'resolvedConclusion',
        'summary',
        'reason',
        'answer',
        'answerText',
        'reply',
      ],
      payload,
      ['evidenceSummary', 'hitSummary', 'summary', 'replyText'],
    ) ||
    primaryEvidence?.content ||
    '';

  const relatedMessage =
    pickString(
      outcome,
      [
        'relatedMessage',
        'relatedMessageText',
        'matchedMessage',
        'sourceMessage',
        'messageText',
        'replyText',
      ],
      payload,
      [
        'relatedMessage',
        'relatedMessageText',
        'matchedMessage',
        'sourceMessage',
        'messageText',
        'replyText',
      ],
    ) ||
    primaryEvidence?.content ||
    session.replyRawText?.trim() ||
    '';

  const relatedMessageId =
    pickString(
      outcome,
      ['relatedMessageId', 'messageId', 'sourceMessageId', 'replyPostId'],
      payload,
      ['relatedMessageId', 'messageId', 'sourceMessageId', 'replyPostId'],
    ) ||
    primaryEvidence?.sourceId ||
    session.replyPostId ||
    '';

  const phaseLabel = phaseDisplayLabel(phaseKey);
  const stateLabel = evidenceStateLabel(
    phaseKey,
    source,
    summary,
    relatedMessage,
  );
  const hasEvidence = Boolean(
    stateLabel || phaseLabel || source || summary || relatedMessage,
  );

  return {
    hasEvidence,
    stateLabel,
    phaseKey,
    phaseLabel,
    source,
    summary,
    relatedMessage,
    relatedMessageId,
  };
}

function pickPrimaryEvidence(
  evidenceItems: OutreachEvidenceItem[],
): OutreachEvidenceItem | null {
  if (!Array.isArray(evidenceItems) || evidenceItems.length === 0) {
    return null;
  }

  return (
    evidenceItems.find((item) => item.sourceKind === 'outreach_reply') ||
    evidenceItems[0]
  );
}

function toRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function pickString(
  primary: UnknownRecord | null,
  primaryKeys: string[],
  secondary?: UnknownRecord | null,
  secondaryKeys: string[] = [],
): string {
  for (const key of primaryKeys) {
    const candidate = readString(primary, key);
    if (candidate) return candidate;
  }
  for (const key of secondaryKeys) {
    const candidate = readString(secondary ?? null, key);
    if (candidate) return candidate;
  }
  return '';
}

function readString(record: UnknownRecord | null, key: string): string {
  if (!record) return '';
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : '';
}

function normalizePhaseKey(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('before_dispatch')) return 'before_dispatch';
  if (normalized.includes('before_followup')) return 'before_followup';
  if (normalized.includes('direct_reply')) return 'direct_reply';
  return normalized;
}

function phaseDisplayLabel(phaseKey: string): string {
  if (phaseKey === 'before_dispatch') return '发送前命中';
  if (phaseKey === 'before_followup') return '追问前命中';
  if (phaseKey === 'direct_reply') return '直接回复';
  return phaseKey;
}

function normalizeSourceLabel(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('target_channel_history')) return '目标群最近会话';
  if (normalized.includes('global_memory')) return '其他群 / 全局记忆';
  if (normalized.includes('direct_reply')) return '直接回复';
  return raw;
}

function evidenceStateLabel(
  phaseKey: string,
  source: string,
  summary: string,
  relatedMessage: string,
): string {
  if (phaseKey === 'before_dispatch') return '触发前命中答案';
  if (phaseKey === 'before_followup') return '追问前命中答案';
  if (phaseKey === 'direct_reply') return '直接回复已解析';
  if (source || summary || relatedMessage) return '系统证据已采集';
  return '';
}
