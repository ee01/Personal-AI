import { getLLMClient } from '../llm/LLMClient.js';

export type EvidenceResolutionScene = 'outreach' | 'ask' | 'reflection';
export type EvidenceResolutionState =
  | 'complete'
  | 'partial'
  | 'insufficient'
  | 'deferred';
export type EvidenceResolutionActionType =
  | 'delegate_openclaw'
  | 'ask_external_user'
  | 'create_confirm_request'
  | 'none';
export type LegacyReplyClassification =
  | 'answer'
  | 'defer'
  | 'irrelevant'
  | 'decline'
  | 'unclear';
export type ExternalAccessMode =
  | 'disabled'
  | 'suggest'
  | 'auto'
  | 'approval_required';
export type UserIntentMode = 'informational' | 'explicit_action';
export type EvidenceResolutionDisposition =
  | 'decision'
  | 'auto_verify'
  | 'watch';
export type EvidenceResolutionReasonCode =
  | 'authority_required'
  | 'approval_required'
  | 'future_monitoring'
  | 'owner_eta_gap'
  | 'artifact_gap'
  | 'time_sensitive_blocker';
export type EvidenceResolutionGapType =
  | 'future_monitoring'
  | 'owner_eta'
  | 'artifact_check'
  | 'decision_blocker';

export interface EvidenceResolutionPolicy {
  scene: EvidenceResolutionScene;
  userIntentMode: UserIntentMode;
  externalRead: ExternalAccessMode;
  externalWrite: ExternalAccessMode;
  allowAskExternalUser: boolean;
  allowCreateConfirmRequest: boolean;
  syncExecutionBudgetMs?: number;
}

export interface EvidenceResolutionEvidenceItem {
  sourceKind: string;
  sourceId?: string;
  title?: string;
  content: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export interface CandidateArtifact {
  kind: string;
  title?: string;
  url?: string;
  content?: string;
  sourceKind?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceResolutionInput {
  question: string;
  context?: string;
  informationGoal?: string;
  evidence: EvidenceResolutionEvidenceItem[];
  policy: EvidenceResolutionPolicy;
}

export interface EvidenceResolutionPlan {
  resolutionState: EvidenceResolutionState;
  directFindings: string[];
  resolvedConclusion?: string;
  remainingQuestions: string[];
  candidateArtifacts: CandidateArtifact[];
  disposition: EvidenceResolutionDisposition;
  reasonCode?: EvidenceResolutionReasonCode;
  sourceAnchor?: string;
  gapType?: EvidenceResolutionGapType;
  recommendedAction: EvidenceResolutionActionType;
  actionParams?: Record<string, unknown>;
  confidence: number;
  legacyClassification: LegacyReplyClassification;
  goalSatisfied?: boolean;
  goalGaps: string[];
  summary: string;
  reason?: string;
  etaAt?: number;
}

interface PlannerLlmResponse {
  resolutionState?: EvidenceResolutionState;
  directFindings?: string[];
  resolvedConclusion?: string;
  remainingQuestions?: string[];
  candidateArtifacts?: CandidateArtifact[];
  disposition?: EvidenceResolutionDisposition;
  reasonCode?: EvidenceResolutionReasonCode;
  sourceAnchor?: string;
  gapType?: EvidenceResolutionGapType;
  recommendedAction?: EvidenceResolutionActionType;
  actionParams?: Record<string, unknown>;
  confidence?: number;
  legacyClassification?: LegacyReplyClassification;
  goalSatisfied?: boolean;
  goalGaps?: string[];
  summary?: string;
  reason?: string;
}

const DIRECT_CUE_PATTERN =
  /应该|已|目前|现在|在|完成|安排|计划|relevant|related|status|eta|预计|下周|tomorrow|today|完成了|会在|将在/i;
const PURE_DEFER_PATTERN =
  /^(稍后|晚点|之后|以后|回头|later|tomorrow|next week|明天|下周)(回复|再说|告知|同步)?[。.!?]*$/i;
const DEFER_CUE_PATTERN =
  /(稍后|晚点|之后|以后|回头|later|tomorrow|next week|明天|下周|\d+\s*(day|days|天|hour|hours|小时))/i;
const DECLINE_PATTERN =
  /(不能|无法|不方便|拒绝|不行|没法|cannot|can't|unable|decline|拒绝提供)/i;
const ACK_PATTERN =
  /^(ok|thanks|收到|好的|明白|嗯|嗯嗯|知道了|got it)[。.!?]*$/i;
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
const URL_PATTERN = /(https?:\/\/[^\s)]+)/gi;
const GENERIC_ARTIFACT_PATTERN =
  /\b(calendar|doc|docs|sheet|spreadsheet|link|ticket|issue)\b|日历|文档|表格|链接|工单|页面/iu;
const FUTURE_MONITORING_PATTERN =
  /会不会|是否会|未来|接下来|有没有计划|是否有计划|迁移|重命名|调整|变化|变更|roadmap|plan|rename|migrate|change/iu;
const OWNER_ETA_PATTERN =
  /负责人|owner|eta|时间表|上线时间|何时|什么时候|进展|deadline|due date|排期/iu;
const APPROVAL_PATTERN =
  /审批|批准|授权|approval|approve|permission|决定怎么做|帮我决定|should we|是否要|选方向/iu;
const GOAL_GAP_SIGNAL_PATTERN =
  /尚未|还没有|没有.*明确|未.*(回复|完成|提供|确认|添加|补充)|缺少|仍需|还缺|不足以|not yet|missing|no explicit|no .*reply|does not satisfy/iu;

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  );
}

function clampConfidence(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value!));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptionalText(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  return collapseWhitespace(value) || undefined;
}

function getInformationGoal(input: EvidenceResolutionInput): string | undefined {
  return (
    normalizeOptionalText(input.informationGoal) ??
    (input.policy.scene === 'outreach'
      ? normalizeOptionalText(input.context)
      : undefined)
  );
}

function normalizeGoalSatisfied(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function buildInformationGoalGap(informationGoal: string): string {
  return `仍需满足信息目标：${informationGoal}`;
}

function textSignalsGoalGap(values: Array<string | undefined | null>): boolean {
  const combined = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .join('\n');
  return combined.length > 0 && GOAL_GAP_SIGNAL_PATTERN.test(combined);
}

function extractTerms(value: string): string[] {
  const matches =
    value.match(/[a-z0-9][a-z0-9._:-]{1,}|[\u4e00-\u9fff]{2,}/giu) ?? [];
  const expanded: string[] = [];
  for (const match of matches) {
    const normalized = match.toLowerCase();
    expanded.push(normalized);
    if (/^[\u4e00-\u9fff]{3,}$/u.test(match)) {
      for (let index = 0; index <= match.length - 2; index += 1) {
        expanded.push(match.slice(index, index + 2));
      }
    }
  }
  return uniqStrings(expanded).filter((item) => item.length >= 2);
}

function overlapScore(line: string, terms: string[]): number {
  const normalized = line.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (normalized.includes(term)) score += term.length >= 4 ? 2 : 1;
  }
  return score;
}

function looksLikePureArtifactLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (
    /^[^\n]{1,120}$/.test(trimmed) &&
    GENERIC_ARTIFACT_PATTERN.test(trimmed) &&
    !DIRECT_CUE_PATTERN.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function extractCandidateArtifacts(
  evidence: EvidenceResolutionEvidenceItem[],
): CandidateArtifact[] {
  const artifacts: CandidateArtifact[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    const content = item.content ?? '';
    let linkMatch: RegExpExecArray | null;
    LINK_PATTERN.lastIndex = 0;
    while ((linkMatch = LINK_PATTERN.exec(content)) !== null) {
      const artifact: CandidateArtifact = {
        kind: 'link',
        title: collapseWhitespace(linkMatch[1] ?? ''),
        url: linkMatch[2],
        sourceKind: item.sourceKind,
        metadata: {
          sourceId: item.sourceId,
        },
      };
      const key = `${artifact.url}|${artifact.title ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push(artifact);
    }

    let urlMatch: RegExpExecArray | null;
    URL_PATTERN.lastIndex = 0;
    while ((urlMatch = URL_PATTERN.exec(content)) !== null) {
      const url = urlMatch[1];
      const key = `${url}|`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push({
        kind: 'url',
        url,
        sourceKind: item.sourceKind,
        metadata: {
          sourceId: item.sourceId,
        },
      });
    }

    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (!looksLikePureArtifactLine(line)) continue;
      const key = `title:${line.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push({
        kind: 'reference',
        title: line,
        sourceKind: item.sourceKind,
        metadata: {
          sourceId: item.sourceId,
        },
      });
    }
  }

  return artifacts.slice(0, 8);
}

function inferTargetSystemHint(
  artifacts: CandidateArtifact[],
): string | undefined {
  const combined = artifacts
    .flatMap((artifact) => [artifact.url, artifact.title, artifact.content])
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .join('\n')
    .toLowerCase();

  if (!combined) return undefined;
  if (
    combined.includes('atlassian') ||
    combined.includes('jira') ||
    combined.includes('ticket') ||
    combined.includes('issue')
  ) {
    return 'jira';
  }
  if (
    combined.includes('calendar') ||
    combined.includes('gcal') ||
    combined.includes('google calendar')
  ) {
    return 'calendar';
  }
  if (
    combined.includes('docs.google.com') ||
    combined.includes('spreadsheet') ||
    combined.includes('sheet')
  ) {
    return 'google_workspace';
  }
  if (combined.includes('ringcentral')) {
    return 'ringcentral';
  }
  return 'web';
}

function buildRemainingQuestion(
  question: string,
  artifacts: CandidateArtifact[],
): string {
  if (artifacts.length > 0) {
    return '需要从外部线索中核实更精确的时间或细节。';
  }
  if (question.trim().length > 0) {
    return `当前证据仍不足以完整回答“${question.trim()}”。`;
  }
  return '当前证据仍不足以完整回答问题。';
}

function inferSourceAnchor(input: EvidenceResolutionInput): string | undefined {
  for (const item of input.evidence) {
    const metadata =
      item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    if (
      typeof metadata.askRequestId === 'string' &&
      metadata.askRequestId.trim()
    ) {
      return `ask:${metadata.askRequestId.trim()}`;
    }
    if (typeof metadata.sessionId === 'string' && metadata.sessionId.trim()) {
      return `outreach:${metadata.sessionId.trim()}`;
    }
    if (
      item.sourceKind === 'outreach_reply' &&
      typeof item.sourceId === 'string' &&
      item.sourceId.trim()
    ) {
      return `outreach:${item.sourceId.trim()}`;
    }
    if (
      item.sourceKind === 'ask_request' &&
      typeof item.sourceId === 'string' &&
      item.sourceId.trim()
    ) {
      return `ask:${item.sourceId.trim()}`;
    }
  }
  return undefined;
}

function parseEtaFromText(text: string): number | undefined {
  const currentTime = Math.floor(Date.now() / 1000);
  const lower = text.toLowerCase();
  const dayMatch = lower.match(/(\d+)\s*(day|days|天)/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (Number.isFinite(days) && days > 0) {
      return currentTime + days * 86400;
    }
  }
  const hourMatch = lower.match(/(\d+)\s*(hour|hours|小时)/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return currentTime + hours * 3600;
    }
  }
  if (/tomorrow|明天|下周|next week/.test(lower)) {
    return currentTime + 86400;
  }
  return undefined;
}

function summarizeDirectFindings(lines: string[]): string | undefined {
  const normalized = uniqStrings(lines).slice(0, 2);
  if (normalized.length === 0) return undefined;
  return normalized.join('；');
}

function buildDelegateActionParams(
  input: EvidenceResolutionInput,
  directFindings: string[],
  remainingQuestions: string[],
  candidateArtifacts: CandidateArtifact[],
  mode: 'read' | 'write',
): Record<string, unknown> {
  const targetSystem = inferTargetSystemHint(candidateArtifacts);
  const taskLines = [
    '请基于以下上下文执行外部核实，并返回可验证 artifact。',
    `场景: ${input.policy.scene}`,
    input.question.trim() ? `原问题: ${input.question.trim()}` : undefined,
    getInformationGoal(input)
      ? `信息目标 / 完成标准: ${getInformationGoal(input)}`
      : undefined,
    normalizeOptionalText(input.context) &&
    normalizeOptionalText(input.context) !== getInformationGoal(input)
      ? `补充上下文: ${normalizeOptionalText(input.context)}`
      : undefined,
    directFindings.length > 0
      ? `已知结论: ${directFindings.join('；')}`
      : undefined,
    remainingQuestions.length > 0
      ? `待核实问题: ${remainingQuestions.join('；')}`
      : undefined,
    candidateArtifacts.length > 0
      ? `候选线索:\n${candidateArtifacts
          .map((artifact, index) => {
            const parts = [
              artifact.title ? `title=${artifact.title}` : undefined,
              artifact.url ? `url=${artifact.url}` : undefined,
              artifact.content ? `content=${artifact.content}` : undefined,
            ].filter(Boolean);
            return `${index + 1}. ${parts.join(' | ')}`;
          })
          .join('\n')}`
      : undefined,
  ].filter(Boolean);

  return {
    task: taskLines.join('\n'),
    mode,
    targetSystem,
    metadata: {
      scene: input.policy.scene,
      question: input.question,
      context: input.context,
      informationGoal: getInformationGoal(input),
      directFindings,
      remainingQuestions,
      candidateArtifacts,
    },
  };
}

function buildConfirmRequestParams(
  input: EvidenceResolutionInput,
  summary: string,
  remainingQuestions: string[],
  disposition: EvidenceResolutionDisposition,
  reasonCode?: EvidenceResolutionReasonCode,
  gapType?: EvidenceResolutionGapType,
  sourceAnchor?: string,
): Record<string, unknown> {
  return {
    question:
      remainingQuestions[0] ??
      `如何继续处理“${input.question.trim() || '当前问题'}”？`,
    context: summary,
    options: [
      { label: '继续查证', value: 'continue' },
      { label: '先记录当前结论', value: 'record_current' },
      { label: '暂不处理', value: 'skip' },
    ],
    category: 'evidence_resolution',
    priority: 'normal',
    routing: disposition === 'watch' ? 'watch' : 'decision',
    reasonCode,
    gapType,
    sourceAnchor,
  };
}

function buildSummary(
  resolutionState: EvidenceResolutionState,
  resolvedConclusion: string | undefined,
  remainingQuestions: string[],
  legacyClassification: LegacyReplyClassification,
  etaAt?: number,
): string {
  if (resolvedConclusion) {
    if (resolutionState === 'partial' && remainingQuestions.length > 0) {
      return `${resolvedConclusion}；仍需继续核实更精确细节。`;
    }
    return resolvedConclusion;
  }
  if (resolutionState === 'deferred') {
    if (etaAt) {
      return '对方表示稍后回复，系统将继续等待。';
    }
    return '对方表示稍后回复。';
  }
  if (legacyClassification === 'decline') {
    return '对方明确表示暂时无法提供信息。';
  }
  if (resolutionState === 'insufficient') {
    return remainingQuestions.length > 0
      ? `已收到线索，但仍需补充信息。${remainingQuestions[0]}`
      : '已收到线索，但当前仍不足以直接下结论。';
  }
  return '已收到回复。';
}

function normalizeLegacyClassification(
  value: unknown,
  fallback: LegacyReplyClassification,
): LegacyReplyClassification {
  if (
    value === 'answer' ||
    value === 'defer' ||
    value === 'irrelevant' ||
    value === 'decline' ||
    value === 'unclear'
  ) {
    return value;
  }
  return fallback;
}

function normalizeRecommendedAction(
  value: unknown,
  fallback: EvidenceResolutionActionType,
): EvidenceResolutionActionType {
  if (
    value === 'delegate_openclaw' ||
    value === 'ask_external_user' ||
    value === 'create_confirm_request' ||
    value === 'none'
  ) {
    return value;
  }
  return fallback;
}

function normalizeDisposition(
  value: unknown,
  fallback: EvidenceResolutionDisposition,
): EvidenceResolutionDisposition {
  if (value === 'decision' || value === 'auto_verify' || value === 'watch') {
    return value;
  }
  return fallback;
}

function inferDisposition(
  input: EvidenceResolutionInput,
  resolutionState: EvidenceResolutionState,
  candidateArtifacts: CandidateArtifact[],
): {
  disposition: EvidenceResolutionDisposition;
  reasonCode?: EvidenceResolutionReasonCode;
  gapType?: EvidenceResolutionGapType;
} {
  const combinedQuestion = [
    input.question,
    input.context ?? '',
    getInformationGoal(input) ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  if (
    candidateArtifacts.length > 0 &&
    (input.policy.externalRead === 'auto' ||
      input.policy.externalRead === 'suggest') &&
    (resolutionState === 'insufficient' || resolutionState === 'partial')
  ) {
    return {
      disposition: 'auto_verify',
      reasonCode: 'artifact_gap',
      gapType: 'artifact_check',
    };
  }

  if (
    APPROVAL_PATTERN.test(combinedQuestion) ||
    input.policy.userIntentMode === 'explicit_action'
  ) {
    return {
      disposition: 'decision',
      reasonCode:
        input.policy.externalWrite === 'approval_required'
          ? 'approval_required'
          : 'authority_required',
      gapType: 'decision_blocker',
    };
  }

  if (FUTURE_MONITORING_PATTERN.test(combinedQuestion)) {
    return {
      disposition: 'watch',
      reasonCode: 'future_monitoring',
      gapType: 'future_monitoring',
    };
  }

  if (OWNER_ETA_PATTERN.test(combinedQuestion)) {
    return {
      disposition: 'watch',
      reasonCode: 'owner_eta_gap',
      gapType: 'owner_eta',
    };
  }

  if (resolutionState === 'insufficient' || resolutionState === 'partial') {
    return {
      disposition: 'watch',
      reasonCode: 'owner_eta_gap',
      gapType: 'owner_eta',
    };
  }

  return {
    disposition: 'decision',
    reasonCode: 'authority_required',
    gapType: 'decision_blocker',
  };
}

function shouldPreferArtifactDelegation(
  input: EvidenceResolutionInput,
  resolutionState: EvidenceResolutionState,
  candidateArtifacts: CandidateArtifact[],
): boolean {
  return (
    candidateArtifacts.length > 0 &&
    (resolutionState === 'partial' || resolutionState === 'insufficient') &&
    (input.policy.externalRead === 'auto' ||
      input.policy.externalRead === 'suggest')
  );
}

export class EvidenceResolutionPlanner {
  async resolve(
    input: EvidenceResolutionInput,
  ): Promise<EvidenceResolutionPlan> {
    const heuristic = this.resolveHeuristically(input);
    try {
      const llm = getLLMClient();
      const informationGoal = getInformationGoal(input);
      const auxiliaryContext = normalizeOptionalText(input.context);
      const evidenceText = input.evidence
        .slice(0, 8)
        .map((item, index) => {
          const title = item.title?.trim() ? ` title=${item.title.trim()}` : '';
          return `${index + 1}. [${item.sourceKind}]${title}\n${item.content}`;
        })
        .join('\n\n');
      const prompt = [
        '你负责把一组证据解析成“已知结论 + 剩余缺口 + 下一步动作建议”。',
        '只返回 JSON，不要输出任何额外解释。',
        'JSON shape:',
        '{',
        '  "resolutionState": "complete|partial|insufficient|deferred",',
        '  "directFindings": ["直接能确定的结论"],',
        '  "resolvedConclusion": "一句话结论",',
        '  "remainingQuestions": ["还缺什么"],',
        '  "candidateArtifacts": [{"kind":"link|reference|document|web_page","title":"...","url":"...","content":"..."}],',
        '  "recommendedAction": "delegate_openclaw|ask_external_user|create_confirm_request|none",',
        '  "actionParams": {},',
        '  "confidence": 0.0,',
        '  "legacyClassification": "answer|defer|irrelevant|decline|unclear",',
        '  "goalSatisfied": true,',
        '  "goalGaps": ["信息目标还缺什么"],',
        '  "summary": "用户可读摘要",',
        '  "reason": "短原因"',
        '}',
        '',
        '决策规则：',
        '- 先提炼已经明确回答的部分，不要被“稍后/下周”这类词覆盖掉已有结论。',
        '- 若已有直接结论，但还缺更精确的时间/细节，resolutionState 用 partial。',
        '- 若只有可继续查证的线索，没有直接结论，resolutionState 用 insufficient。',
        '- 只有在没有直接结论、且对方明确表示稍后回复时，才用 deferred。',
        '- 如果给出了“信息目标 / 完成标准”，complete 只能用于证据已经明确满足该目标；只回答了原问题的一部分，或摘要里说明“尚未/没有/缺少”目标信息时，必须用 partial 或 insufficient。',
        '- goalSatisfied 表示证据是否已经满足“信息目标 / 完成标准”；goalGaps 写仍缺的目标信息。没有信息目标时可省略 goalGaps。',
        '- resolvedConclusion 和 summary 必须与 resolutionState 一致；如果仍有 remainingQuestions，不要写成“已成功获取完整结果”。',
        '- outreach 场景下，如果补充上下文说明这是周期性执行，不要把上一周期的旧回复当成本周期答案。',
        '- 仅在策略允许时才推荐动作。',
        `- scene=${input.policy.scene}`,
        `- userIntentMode=${input.policy.userIntentMode}`,
        `- externalRead=${input.policy.externalRead}`,
        `- externalWrite=${input.policy.externalWrite}`,
        `- allowAskExternalUser=${input.policy.allowAskExternalUser}`,
        `- allowCreateConfirmRequest=${input.policy.allowCreateConfirmRequest}`,
        '',
        `问题: ${input.question || '无'}`,
        `信息目标 / 完成标准: ${informationGoal || '无'}`,
        `补充上下文: ${
          auxiliaryContext && auxiliaryContext !== informationGoal
            ? auxiliaryContext
            : '无'
        }`,
        '',
        '证据:',
        evidenceText || '无',
        '',
        `候选 artifact（启发式提取）: ${JSON.stringify(heuristic.candidateArtifacts)}`,
      ].join('\n');
      const parsed = await llm.generateJSON<PlannerLlmResponse>(prompt, {
        temperature: 0.1,
        maxTokens: 1200,
        timeoutMs: 2500,
        retryCount: 0,
      });
      return this.normalizePlan(input, parsed, heuristic);
    } catch {
      return heuristic;
    }
  }

  private normalizePlan(
    input: EvidenceResolutionInput,
    parsed: PlannerLlmResponse,
    fallback: EvidenceResolutionPlan,
  ): EvidenceResolutionPlan {
    const directFindings = uniqStrings(
      parsed.directFindings ?? fallback.directFindings,
    );
    const candidateArtifacts =
      Array.isArray(parsed.candidateArtifacts) &&
      parsed.candidateArtifacts.length > 0
        ? parsed.candidateArtifacts.slice(0, 8)
        : fallback.candidateArtifacts;
    let remainingQuestions = uniqStrings(
      parsed.remainingQuestions ?? fallback.remainingQuestions,
    );
    const legacyClassification = normalizeLegacyClassification(
      parsed.legacyClassification,
      fallback.legacyClassification,
    );
    let resolutionState =
      parsed.resolutionState === 'complete' ||
      parsed.resolutionState === 'partial' ||
      parsed.resolutionState === 'insufficient' ||
      parsed.resolutionState === 'deferred'
        ? parsed.resolutionState
        : fallback.resolutionState;
    const informationGoal = getInformationGoal(input);
    const parsedGoalSatisfied = normalizeGoalSatisfied(parsed.goalSatisfied);
    let goalSatisfied =
      informationGoal === undefined
        ? undefined
        : parsedGoalSatisfied ?? fallback.goalSatisfied;
    let goalGaps =
      informationGoal === undefined
        ? []
        : uniqStrings([
            ...(Array.isArray(parsed.goalGaps) ? parsed.goalGaps : []),
            ...(Array.isArray(fallback.goalGaps) ? fallback.goalGaps : []),
          ]);
    if (informationGoal) {
      const hasGoalGapSignal = textSignalsGoalGap([
        parsed.summary,
        parsed.resolvedConclusion,
        ...remainingQuestions,
      ]);
      if (
        parsedGoalSatisfied === false ||
        remainingQuestions.length > 0 ||
        hasGoalGapSignal
      ) {
        goalSatisfied = false;
        if (goalGaps.length === 0) {
          goalGaps = [buildInformationGoalGap(informationGoal)];
        }
      }
      if (
        resolutionState === 'complete' &&
        legacyClassification !== 'decline' &&
        (goalSatisfied === false || remainingQuestions.length > 0)
      ) {
        resolutionState =
          directFindings.length > 0 || parsed.resolvedConclusion
            ? 'partial'
            : 'insufficient';
        remainingQuestions = uniqStrings([
          ...remainingQuestions,
          ...goalGaps,
        ]);
      }
      if (resolutionState === 'complete' && goalSatisfied !== false) {
        goalSatisfied = true;
        goalGaps = [];
      }
    } else if (
      resolutionState === 'complete' &&
      remainingQuestions.length > 0 &&
      legacyClassification !== 'decline'
    ) {
      resolutionState = 'partial';
    }
    let recommendedAction = normalizeRecommendedAction(
      parsed.recommendedAction,
      fallback.recommendedAction,
    );
    const actionParams =
      parsed.actionParams &&
      typeof parsed.actionParams === 'object' &&
      !Array.isArray(parsed.actionParams)
        ? { ...parsed.actionParams }
        : fallback.actionParams;
    const inferredDisposition = inferDisposition(
      input,
      resolutionState,
      candidateArtifacts,
    );
    const inferredSourceAnchor = inferSourceAnchor(input);
    const disposition = normalizeDisposition(
      parsed.disposition,
      fallback.disposition ?? inferredDisposition.disposition,
    );

    if (
      recommendedAction === 'ask_external_user' &&
      !input.policy.allowAskExternalUser
    ) {
      recommendedAction = input.policy.allowCreateConfirmRequest
        ? 'create_confirm_request'
        : 'none';
    }
    if (
      recommendedAction === 'create_confirm_request' &&
      !input.policy.allowCreateConfirmRequest
    ) {
      recommendedAction = 'none';
    }
    if (recommendedAction === 'delegate_openclaw') {
      const mode = actionParams?.mode === 'write' ? 'write' : 'read';
      if (mode === 'write' && input.policy.externalWrite === 'disabled') {
        recommendedAction =
          input.policy.externalRead === 'auto' ||
          input.policy.externalRead === 'suggest'
            ? 'delegate_openclaw'
            : input.policy.allowCreateConfirmRequest
              ? 'create_confirm_request'
              : 'none';
        if (recommendedAction === 'delegate_openclaw') {
          Object.assign(
            actionParams ?? {},
            buildDelegateActionParams(
              input,
              directFindings,
              remainingQuestions,
              candidateArtifacts,
              'read',
            ),
          );
        }
      } else if (mode === 'read' && input.policy.externalRead === 'disabled') {
        recommendedAction = input.policy.allowCreateConfirmRequest
          ? 'create_confirm_request'
          : 'none';
      }
    }
    if (
      shouldPreferArtifactDelegation(input, resolutionState, candidateArtifacts)
    ) {
      recommendedAction = 'delegate_openclaw';
    }

    let normalizedActionParams = actionParams;
    if (recommendedAction === 'delegate_openclaw') {
      const mode = shouldPreferArtifactDelegation(
        input,
        resolutionState,
        candidateArtifacts,
      )
        ? 'read'
        : normalizedActionParams?.mode === 'write'
          ? 'write'
          : 'read';
      normalizedActionParams = {
        ...buildDelegateActionParams(
          input,
          directFindings,
          remainingQuestions,
          candidateArtifacts,
          mode,
        ),
        ...(normalizedActionParams ?? {}),
      };
      normalizedActionParams.mode = mode;
    } else if (recommendedAction === 'create_confirm_request') {
      normalizedActionParams = {
        ...buildConfirmRequestParams(
          input,
          parsed.summary?.trim() || fallback.summary,
          remainingQuestions,
          disposition,
          parsed.reasonCode ??
            fallback.reasonCode ??
            inferredDisposition.reasonCode,
          parsed.gapType ?? fallback.gapType ?? inferredDisposition.gapType,
          typeof parsed.sourceAnchor === 'string' &&
            parsed.sourceAnchor.trim().length > 0
            ? parsed.sourceAnchor.trim()
            : (fallback.sourceAnchor ?? inferredSourceAnchor),
        ),
        ...(normalizedActionParams ?? {}),
      };
    }

    const resolvedConclusion =
      collapseWhitespace(
        typeof parsed.resolvedConclusion === 'string' &&
          parsed.resolvedConclusion.trim().length > 0
          ? parsed.resolvedConclusion
          : (fallback.resolvedConclusion ?? ''),
      ) || undefined;
    const etaAt = resolutionState === 'deferred' ? fallback.etaAt : undefined;
    const parsedSummary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary
        : undefined;
    const summaryShouldUseParsed =
      Boolean(parsedSummary) &&
      !(
        informationGoal &&
        goalSatisfied === false &&
        parsed.resolutionState === 'complete' &&
        !textSignalsGoalGap([parsedSummary])
      );
    const summary = collapseWhitespace(
      summaryShouldUseParsed && parsedSummary
        ? parsedSummary
        : buildSummary(
            resolutionState,
            resolvedConclusion,
            remainingQuestions,
            legacyClassification,
            etaAt,
          ),
    );

    return {
      resolutionState,
      directFindings,
      resolvedConclusion,
      remainingQuestions,
      candidateArtifacts,
      disposition,
      reasonCode:
        parsed.reasonCode ??
        fallback.reasonCode ??
        inferredDisposition.reasonCode,
      sourceAnchor:
        typeof parsed.sourceAnchor === 'string' &&
        parsed.sourceAnchor.trim().length > 0
          ? parsed.sourceAnchor.trim()
          : (fallback.sourceAnchor ?? inferredSourceAnchor),
      gapType:
        parsed.gapType ?? fallback.gapType ?? inferredDisposition.gapType,
      recommendedAction,
      actionParams: normalizedActionParams,
      confidence: clampConfidence(parsed.confidence, fallback.confidence),
      legacyClassification,
      goalSatisfied,
      goalGaps,
      summary: summary || fallback.summary,
      reason:
        typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
          ? parsed.reason.trim()
          : fallback.reason,
      etaAt,
    };
  }

  private resolveHeuristically(
    input: EvidenceResolutionInput,
  ): EvidenceResolutionPlan {
    const combinedText = input.evidence
      .map((item) => item.content)
      .join('\n')
      .trim();
    const candidateArtifacts = extractCandidateArtifacts(input.evidence);
    const lines = uniqStrings(
      input.evidence.flatMap((item) =>
        item.content
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );
    const informationGoal = getInformationGoal(input);
    const terms = extractTerms(
      [input.question, input.context ?? '', informationGoal ?? '']
        .filter(Boolean)
        .join('\n'),
    );

    const decline = DECLINE_PATTERN.test(combinedText);
    const pureDefer =
      combinedText.length > 0 &&
      (PURE_DEFER_PATTERN.test(collapseWhitespace(combinedText)) ||
        (DEFER_CUE_PATTERN.test(combinedText) &&
          !DIRECT_CUE_PATTERN.test(combinedText)));

    const scoredLines = lines
      .map((line) => {
        const artifactOnly = looksLikePureArtifactLine(line);
        const ackOnly = ACK_PATTERN.test(line);
        let score = overlapScore(line, terms);
        if (DIRECT_CUE_PATTERN.test(line)) score += 2;
        if (DEFER_CUE_PATTERN.test(line) && !PURE_DEFER_PATTERN.test(line))
          score += 1;
        if (artifactOnly) score -= 3;
        if (ackOnly) score -= 4;
        if (DECLINE_PATTERN.test(line)) score -= 2;
        return { line, score, artifactOnly, ackOnly };
      })
      .filter((item) => !item.ackOnly)
      .sort((a, b) => b.score - a.score);

    const directFindings = scoredLines
      .filter((item) => item.score >= 2 && !item.artifactOnly)
      .map((item) => item.line)
      .slice(0, 3);
    const resolvedConclusion = summarizeDirectFindings(directFindings);

    let resolutionState: EvidenceResolutionState = 'insufficient';
    let legacyClassification: LegacyReplyClassification = 'unclear';
    let recommendedAction: EvidenceResolutionActionType = 'none';
    const inferredDisposition = inferDisposition(
      input,
      resolutionState,
      candidateArtifacts,
    );
    const inferredSourceAnchor = inferSourceAnchor(input);
    let disposition: EvidenceResolutionDisposition =
      inferredDisposition.disposition;
    let remainingQuestions: string[] = [];
    let etaAt: number | undefined;
    let reason = 'fallback_heuristic';
    let goalSatisfied: boolean | undefined;
    let goalGaps: string[] = [];

    if (directFindings.length > 0) {
      legacyClassification = decline ? 'decline' : 'answer';
      if (candidateArtifacts.length > 0) {
        resolutionState = 'partial';
        remainingQuestions = [
          buildRemainingQuestion(input.question, candidateArtifacts),
        ];
      } else {
        resolutionState = 'complete';
      }
    } else if (decline) {
      legacyClassification = 'decline';
      resolutionState = 'complete';
      reason = 'decline_signal';
    } else if (pureDefer) {
      legacyClassification = 'defer';
      resolutionState = 'deferred';
      etaAt = parseEtaFromText(combinedText);
      reason = 'defer_signal';
    } else if (candidateArtifacts.length > 0) {
      legacyClassification = 'unclear';
      resolutionState = 'insufficient';
      remainingQuestions = [
        buildRemainingQuestion(input.question, candidateArtifacts),
      ];
      reason = 'artifact_requires_followup';
    } else if (
      combinedText &&
      ACK_PATTERN.test(collapseWhitespace(combinedText))
    ) {
      legacyClassification = 'irrelevant';
      resolutionState = 'insufficient';
      reason = 'ack_without_answer';
    }

    if (
      shouldPreferArtifactDelegation(input, resolutionState, candidateArtifacts)
    ) {
      recommendedAction = 'delegate_openclaw';
      disposition = 'auto_verify';
    } else if (
      resolutionState === 'insufficient' &&
      input.policy.allowCreateConfirmRequest
    ) {
      recommendedAction = 'create_confirm_request';
      disposition = inferredDisposition.disposition;
    }

    if (informationGoal) {
      const hasGoalGapSignal = textSignalsGoalGap([
        combinedText,
        resolvedConclusion,
        ...remainingQuestions,
      ]);
      if (legacyClassification === 'decline') {
        goalSatisfied = false;
        goalGaps = [buildInformationGoalGap(informationGoal)];
      } else if (resolutionState === 'complete' && !hasGoalGapSignal) {
        goalSatisfied = true;
      } else {
        goalSatisfied = false;
        goalGaps = [buildInformationGoalGap(informationGoal)];
        remainingQuestions = uniqStrings([...remainingQuestions, ...goalGaps]);
        if (resolutionState === 'complete') {
          resolutionState = directFindings.length > 0 ? 'partial' : 'insufficient';
        }
      }
    }

    const actionParams =
      recommendedAction === 'delegate_openclaw'
        ? buildDelegateActionParams(
            input,
            directFindings,
            remainingQuestions,
            candidateArtifacts,
            'read',
          )
        : recommendedAction === 'create_confirm_request'
          ? buildConfirmRequestParams(
              input,
              buildSummary(
                resolutionState,
                resolvedConclusion,
                remainingQuestions,
                legacyClassification,
                etaAt,
              ),
              remainingQuestions,
              disposition,
              inferredDisposition.reasonCode,
              inferredDisposition.gapType,
              inferredSourceAnchor,
            )
          : undefined;

    return {
      resolutionState,
      directFindings,
      resolvedConclusion,
      remainingQuestions,
      candidateArtifacts,
      disposition,
      reasonCode: inferredDisposition.reasonCode,
      sourceAnchor: inferredSourceAnchor,
      gapType: inferredDisposition.gapType,
      recommendedAction,
      actionParams,
      confidence:
        resolutionState === 'complete'
          ? 0.72
          : resolutionState === 'partial'
            ? 0.68
            : resolutionState === 'deferred'
              ? 0.75
              : 0.55,
      legacyClassification,
      goalSatisfied,
      goalGaps,
      summary: buildSummary(
        resolutionState,
        resolvedConclusion,
        remainingQuestions,
        legacyClassification,
        etaAt,
      ),
      reason,
      etaAt,
    };
  }
}
