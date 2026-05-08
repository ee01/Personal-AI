import type { RecallItem } from '../types/index.js';
import type { CandidateArtifact } from './EvidenceResolutionPlanner.js';

export type DecisionEvidenceChainType =
  | 'why_decided'
  | 'what_changed'
  | 'decision_status'
  | 'who_committed'
  | 'tradeoff_history'
  | 'not_a_decision';

export type DecisionEvidenceStance =
  | 'supports'
  | 'contradicts'
  | 'background'
  | 'open_question';

export interface DecisionEvidenceRef {
  sourceType: string;
  sourceId: string;
  timestamp?: number;
  speakerOrActor?: string;
  stance: DecisionEvidenceStance;
  snippet: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  score?: number;
}

export interface DecisionEvidenceChainPayload {
  question: string;
  decisionDetected: boolean;
  chainType: DecisionEvidenceChainType;
  answerSummary: string;
  decisionStatement?: string;
  then?: {
    knownAt?: number;
    conclusion: string;
    rationale: string[];
    assumptions: string[];
    evidenceRefs: DecisionEvidenceRef[];
  };
  now?: {
    checkedAt: number;
    stillValid: string[];
    changed: string[];
    contradictedBy: DecisionEvidenceRef[];
    missingEvidence: string[];
  };
  confidence: number;
  saveCandidate?: {
    suggestedTitle: string;
    reasonToSave: string;
    defaultStatus: 'candidate' | 'active' | 'revisit_needed';
  };
}

export interface DecisionEvidenceChainBlock {
  type: 'decision_evidence_chain';
  title: string;
  payload: DecisionEvidenceChainPayload;
}

interface BuildDecisionEvidenceChainInput {
  query: string;
  recalledItems: RecallItem[];
  externalEvidence?: CandidateArtifact[];
  checkedAt?: number;
}

const DECISION_INTENT_PATTERNS: Array<{
  type: DecisionEvidenceChainType;
  pattern: RegExp;
}> = [
  {
    type: 'why_decided',
    pattern:
      /为什么.*(当时|之前|上次)?.*(决定|定|选择|选|采用|推|安排|给|接|主导)|当时.*(为什么|怎么).*(决定|定|选|安排)|why.*(decid|choose|chose|pick|picked|settle|route)|how.*(decid|choose|settle)/iu,
  },
  {
    type: 'what_changed',
    pattern:
      /(现在|后来|之后).*(变|变化|改变|调整|还|是否).*(成立|有效|推进|按上次|继续)|有没有.*(变化|变更|改变)|what changed|changed since|still valid|still hold/iu,
  },
  {
    type: 'decision_status',
    pattern:
      /(上次|之前|当时).*(结论|决定|方案).*(成立|有效|推进|继续)?|这个.*(结论|决定|方案).*(还|是否).*(成立|有效)|decision.*(status|valid)|conclusion.*(valid|still)/iu,
  },
  {
    type: 'who_committed',
    pattern:
      /谁.*(决定|承诺|负责|owner|主导|接|跟进)|谁是.*(owner|负责人)|who.*(decided|committed|owns|owner|responsible)/iu,
  },
  {
    type: 'tradeoff_history',
    pattern:
      /(为什么.*不是|为什么.*不用|取舍|对比|方案.*比较|选.*还是|而不是)|instead of|rather than|trade.?off|why not/iu,
  },
];

const DECISION_SENTENCE_PATTERN =
  /决定|确认|结论|选择|采用|主导|负责|倾向|先这样|后续|owner|approved?|agreed?|decided?|decision|should|will|route|choose|chosen|picked|leaning|go with|use/iu;
const CONTRADICT_PATTERN =
  /不再|取消|推翻|变更|改变|调整|阻塞|风险|问题|但|不过|然而|除非|需要复查|approval changed|\b(changed|instead|however|but|risk|blocked|blocker|issue|problem|concern)\b/iu;
const OPEN_QUESTION_PATTERN =
  /[?？]|需要核实|未确认|不清楚|待确认|不知道|unclear|unknown|need to verify|tbd|pending/iu;
const SUPPORT_PATTERN =
  /决定|确认|同意|批准|审批|采用|选择|主导|负责|倾向|应该|approved?|approve|agree|agreed|decided?|decision|should|will|owner|route|choose|chosen|picked|leaning/iu;
const ASSUMPTION_PATTERN =
  /因为|基于|前提|如果|只要|需要|考虑到|由于|as long as|because|assuming|assumption|given that|need to|depends on/iu;

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function firstNonEmpty(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }
  return undefined;
}

function splitSentences(value: string): string[] {
  return (
    value
      .replace(/<[^>]+>/g, ' ')
      .split(/(?<=[。！？.!?])\s+|\n+/u)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
}

function classifyDecisionIntent(query: string): DecisionEvidenceChainType | null {
  for (const candidate of DECISION_INTENT_PATTERNS) {
    if (candidate.pattern.test(query)) return candidate.type;
  }
  return null;
}

function classifyEvidenceStance(text: string): DecisionEvidenceStance {
  if (CONTRADICT_PATTERN.test(text)) return 'contradicts';
  if (OPEN_QUESTION_PATTERN.test(text)) return 'open_question';
  if (SUPPORT_PATTERN.test(text)) return 'supports';
  return 'background';
}

function sourceTypeFromItem(item: RecallItem): string {
  const metadataSource = firstNonEmpty(
    item.metadata?.sourceType,
    item.metadata?.source,
  );
  return metadataSource || item.source || item.type;
}

function actorFromItem(item: RecallItem): string | undefined {
  return firstNonEmpty(
    item.metadata?.sender,
    item.metadata?.speaker,
    item.metadata?.actor,
    item.metadata?.author,
  );
}

function evidenceFromRecallItem(item: RecallItem): DecisionEvidenceRef {
  const text = firstNonEmpty(item.displayText, item.previewText, item.content) ?? '';
  return {
    sourceType: sourceTypeFromItem(item),
    sourceId: item.id,
    timestamp: item.timestamp,
    speakerOrActor: actorFromItem(item),
    stance: classifyEvidenceStance(text),
    snippet: compactText(text, 260),
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle ?? item.displayTitle,
    exploreLink: item.exploreLink,
    score: item.score,
  };
}

function evidenceFromArtifact(
  artifact: CandidateArtifact,
  index: number,
): DecisionEvidenceRef | null {
  const snippet = firstNonEmpty(artifact.content, artifact.title);
  if (!snippet) return null;
  const sourceId = firstNonEmpty(
    artifact.metadata?.sourceId,
    artifact.metadata?.entityId,
  );
  return {
    sourceType: artifact.sourceKind ?? artifact.kind ?? 'external',
    sourceId: sourceId ?? `external-${index + 1}`,
    stance: classifyEvidenceStance(snippet),
    snippet: compactText(snippet, 260),
    sourceUrl: artifact.url,
    sourceTitle: artifact.title,
  };
}

function pickDecisionStatement(refs: DecisionEvidenceRef[]): string | undefined {
  const explicit = refs.find((ref) => DECISION_SENTENCE_PATTERN.test(ref.snippet));
  const candidate = explicit ?? refs[0];
  if (!candidate) return undefined;
  const sentence =
    splitSentences(candidate.snippet).find((part) =>
      DECISION_SENTENCE_PATTERN.test(part),
    ) ?? splitSentences(candidate.snippet)[0];
  return sentence ? compactText(sentence, 180) : undefined;
}

function buildRationale(
  refs: DecisionEvidenceRef[],
  decisionStatement: string | undefined,
): string[] {
  const bullets = refs
    .filter((ref) => ref.stance === 'supports' || ref.stance === 'background')
    .flatMap((ref) => splitSentences(ref.snippet).slice(0, 2))
    .map((sentence) => compactText(sentence, 150))
    .filter((sentence) => sentence && sentence !== decisionStatement);
  return uniq(bullets).slice(0, 4);
}

function buildAssumptions(refs: DecisionEvidenceRef[]): string[] {
  const assumptions = refs
    .flatMap((ref) => splitSentences(ref.snippet).slice(0, 2))
    .filter((sentence) => ASSUMPTION_PATTERN.test(sentence))
    .map((sentence) => compactText(sentence, 150));
  return uniq(assumptions).slice(0, 3);
}

function buildStillValid(refs: DecisionEvidenceRef[]): string[] {
  const valid = refs
    .filter((ref) => ref.stance === 'supports')
    .map((ref) => compactText(ref.snippet, 140));
  return uniq(valid).slice(0, 3);
}

function computeConfidence(
  refs: DecisionEvidenceRef[],
  decisionStatement: string | undefined,
): number {
  if (refs.length === 0) return 0.12;

  let score = 0.35;
  if (decisionStatement) score += 0.18;
  if (refs.length >= 2) score += 0.14;
  if (refs.length >= 4) score += 0.06;
  if (new Set(refs.map((ref) => ref.sourceType)).size >= 2) score += 0.1;
  if (refs.some((ref) => ref.stance === 'supports')) score += 0.08;
  if (refs.some((ref) => ref.stance === 'contradicts')) score += 0.04;
  if (refs.every((ref) => ref.stance === 'background')) score -= 0.12;

  return Math.max(0, Math.min(0.92, Number(score.toFixed(2))));
}

function titleForChain(
  chainType: DecisionEvidenceChainType,
  decisionStatement: string | undefined,
): string {
  const prefix: Record<DecisionEvidenceChainType, string> = {
    why_decided: '决策依据链',
    what_changed: '决策变化链',
    decision_status: '决策状态链',
    who_committed: '承诺与 owner 证据链',
    tradeoff_history: '方案取舍证据链',
    not_a_decision: '决策证据链',
  };
  return decisionStatement
    ? `${prefix[chainType]}：${compactText(decisionStatement, 48)}`
    : prefix[chainType];
}

export class DecisionEvidenceChainService {
  build(
    input: BuildDecisionEvidenceChainInput,
  ): DecisionEvidenceChainBlock | null {
    const chainType = classifyDecisionIntent(input.query);
    if (!chainType) return null;

    const recalledRefs = input.recalledItems
      .slice(0, 10)
      .map(evidenceFromRecallItem)
      .filter((ref) => ref.snippet);
    const externalRefs = (input.externalEvidence ?? [])
      .slice(0, 5)
      .map(evidenceFromArtifact)
      .filter((ref): ref is DecisionEvidenceRef => Boolean(ref));
    const evidenceRefs = [...recalledRefs, ...externalRefs];
    const checkedAt = input.checkedAt ?? Math.floor(Date.now() / 1000);

    const decisionStatement = pickDecisionStatement(evidenceRefs);
    const confidence = computeConfidence(evidenceRefs, decisionStatement);
    const changedRefs = evidenceRefs.filter(
      (ref) => ref.stance === 'contradicts',
    );
    const missingEvidence =
      evidenceRefs.length === 0
        ? ['未召回到可支撑该历史决策问题的记忆证据。']
        : decisionStatement
          ? changedRefs.length === 0
            ? ['未找到明确推翻或更新该决策的后续证据。']
            : []
          : ['召回到相关记忆，但没有明确的决策结论句。'];

    const supportRefs = evidenceRefs.filter((ref) => ref.stance === 'supports');
    const thenRefs = (supportRefs.length > 0 ? supportRefs : evidenceRefs).slice(
      0,
      4,
    );
    const knownAt = thenRefs
      .map((ref) => ref.timestamp)
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b)[0];
    const rationale = buildRationale(evidenceRefs, decisionStatement);
    const assumptions = buildAssumptions(evidenceRefs);
    const stillValid = buildStillValid(evidenceRefs);
    const changed = changedRefs.map((ref) => compactText(ref.snippet, 160));

    const payload: DecisionEvidenceChainPayload = {
      question: input.query,
      decisionDetected: Boolean(decisionStatement && evidenceRefs.length > 0),
      chainType,
      answerSummary:
        evidenceRefs.length === 0
          ? '这个问题像是在询问历史决策，但当前检索结果不足，不能形成可靠证据链。'
          : `已从 ${evidenceRefs.length} 条记忆证据中整理出决策链；请优先查看原始证据再保存为长期决策记忆。`,
      decisionStatement,
      then:
        evidenceRefs.length > 0
          ? {
              knownAt,
              conclusion:
                decisionStatement ??
                '相关记忆显示存在决策讨论，但没有明确结论句。',
              rationale,
              assumptions,
              evidenceRefs: thenRefs,
            }
          : undefined,
      now: {
        checkedAt,
        stillValid,
        changed,
        contradictedBy: changedRefs,
        missingEvidence,
      },
      confidence,
    };

    if (
      payload.decisionDetected &&
      confidence >= 0.7 &&
      evidenceRefs.length >= 2
    ) {
      payload.saveCandidate = {
        suggestedTitle: compactText(decisionStatement ?? input.query, 80),
        reasonToSave: '这条证据链包含明确结论和多条来源，可作为长期决策记忆候选。',
        defaultStatus: changedRefs.length > 0 ? 'revisit_needed' : 'active',
      };
    }

    return {
      type: 'decision_evidence_chain',
      title: titleForChain(chainType, decisionStatement),
      payload,
    };
  }
}
