import { getConfig } from '../config.js';
import {
  EvidenceResolutionPlanner,
  type EvidenceResolutionActionType,
  type EvidenceResolutionPlan,
  type EvidenceResolutionPolicy,
} from './EvidenceResolutionPlanner.js';
import {
  EvidenceCohesionGateService,
  type EvidenceCohesionCandidate,
  type EvidenceCohesionReceipt,
  type EvidenceCohesionResult,
} from './EvidenceCohesionGateService.js';
import { resolveDelegateOpenClawPolicy } from './actions/delegateOpenClawPolicy.js';
import { getLLMClient } from '../llm/LLMClient.js';
import { listFocusProjects } from './FocusProjectSyncService.js';
import { buildFocusParagraphContext } from './FocusProjectContextBuilder.js';
import { ProjectTimelineExtractor } from './ProjectTimelineExtractor.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';
import type { ReflectionThreadRecord } from '../repositories/ReflectionThreadRepository.js';
import type { RehearsalActivationCues } from '../types/index.js';
import { formatDateTime } from '../utils/time.js';

export interface ReflectionEvidenceItem {
  sourceKind: string;
  sourceId: string;
  title: string;
  snippet: string;
  createdAt?: number;
  role: string;
}

export interface DraftReflectionAction {
  actionType: string;
  title: string;
  description?: string;
  params?: Record<string, unknown>;
  confidence?: number;
  requiresApproval?: boolean;
  executionMode?: 'manual' | 'auto';
  priority?: number;
  utilityScore?: number;
  urgencyScore?: number;
  riskLevel?: string;
  evidenceRefs?: string[];
  scheduledAt?: number;
}

export interface DraftRehearsalCandidate {
  title: string;
  dedupeKey?: string;
  scenarioType?: string;
  summary?: string;
  content: string;
  activationCues?: RehearsalActivationCues;
  confidence?: number;
  priority?: number;
  validUntil?: number;
  evidenceRefs?: string[];
}

export interface ReflectionOutputLanguagePreference {
  code: 'zh-CN' | 'en-US';
  label: string;
  source: string;
}

export interface GeneratedReflection {
  summary: string;
  hypothesisAfter?: string;
  discoveries: string[];
  openQuestions: string[];
  actionProposals: DraftReflectionAction[];
  rehearsalCandidates?: DraftRehearsalCandidate[];
  cohesionReceipt?: EvidenceCohesionReceipt;
  usedEvidenceRefs?: string[];
  markdownBody: string;
}

interface WorkerResponse {
  summary: string;
  hypothesisAfter?: string;
  discoveries?: string[];
  openQuestions?: string[];
  rehearsalCandidates?: DraftRehearsalCandidate[];
}

function clampScore(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(value!, 1));
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  );
}

function renderOutputLanguageInstruction(
  preference: ReflectionOutputLanguagePreference | undefined,
): string {
  if (!preference) {
    return '- No explicit user language preference was resolved. Follow the dominant language of the evidence for user-facing prose.';
  }
  return [
    `- Write all user-facing prose in ${preference.label}.`,
    '- This especially applies to rehearsalCandidates.title, rehearsalCandidates.summary, and rehearsalCandidates.content.',
    '- Preserve names, product names, group names, URLs, IDs, Jira keys, and quoted source terms in their original language.',
    `- Language preference source: ${preference.source}.`,
  ].join('\n');
}

function isSelfOrUnknownOutreachTarget(targetRef: unknown): boolean {
  if (typeof targetRef !== 'string') return true;
  const normalized = targetRef.trim().toLowerCase();
  if (!normalized) return true;
  return [
    'me',
    'myself',
    'self',
    'user',
    'current_user',
    'current user',
    '我',
    '自己',
  ].includes(normalized);
}

const INTERNAL_AUTO_ACTION_TYPES = new Set([
  'notify_user',
  'create_confirm_request',
  'update_truth_property',
  'ask_external_user',
]);

function normalizeExecutionMode(value: unknown): 'manual' | 'auto' | undefined {
  if (value === 'manual' || value === 'auto') return value;
  return undefined;
}

function defaultExecutionModeForAction(
  actionType: string,
  params: Record<string, unknown>,
): 'manual' | 'auto' {
  if (INTERNAL_AUTO_ACTION_TYPES.has(actionType)) {
    return 'auto';
  }
  if (actionType === 'delegate_openclaw' && params.mode === 'write') {
    return 'manual';
  }
  return 'manual';
}

export class ReflectionWorker {
  private readonly evidencePlanner = new EvidenceResolutionPlanner();
  private readonly cohesionGate = new EvidenceCohesionGateService();

  constructor(private readonly db?: import('better-sqlite3').Database) {}

  async generate(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    triggerType: string,
    outputLanguage?: ReflectionOutputLanguagePreference,
  ): Promise<GeneratedReflection> {
    const cohesionResult = this.buildCohesionResult(thread, evidence);
    const includedEvidenceRefs = new Set(
      cohesionResult?.includedEvidenceRefs ??
        evidence.map(toReflectionEvidenceRef),
    );
    const cohesiveEvidence = cohesionResult
      ? evidence.filter((item) =>
          includedEvidenceRefs.has(toReflectionEvidenceRef(item)),
        )
      : evidence;

    if (process.env.REFLECTION_FORCE_FALLBACK === 'true') {
      return this.generateFallback(
        thread,
        cohesiveEvidence,
        triggerType,
        cohesionResult,
      );
    }

    try {
      return await this.generateWithLlm(
        thread,
        cohesiveEvidence,
        triggerType,
        outputLanguage,
        cohesionResult,
      );
    } catch (err) {
      console.warn(
        '[ReflectionWorker] Falling back to heuristic reflection:',
        err instanceof Error ? err.message : String(err),
      );
      return this.generateFallback(
        thread,
        cohesiveEvidence,
        triggerType,
        cohesionResult,
      );
    }
  }

  private async generateWithLlm(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    triggerType: string,
    outputLanguage?: ReflectionOutputLanguagePreference,
    cohesionResult?: EvidenceCohesionResult,
  ): Promise<GeneratedReflection> {
    const llm = getLLMClient();
    const evidenceText =
      evidence.length > 0
        ? evidence
            .slice(0, 10)
            .map((item, index) => {
              const ts = item.createdAt
                ? formatDateTime(item.createdAt)
                : 'unknown';
              return `${index + 1}. [${item.sourceKind}/${item.role}] ${item.title} @ ${ts}\n${item.snippet}`;
            })
            .join('\n\n')
        : 'No external evidence attached.';

    let focusBrief = '';
    try {
      if (this.db) {
        const focusProjects = listFocusProjects(this.db);
        const extractor = new ProjectTimelineExtractor(this.db);
        const enriched = focusProjects.map((project) => {
          const receipts = extractor.listOpenReceipts(project.id) as Array<{
            summary?: string;
            event_type?: string;
            status?: string;
          }>;
          return {
            ...project,
            recentEventSummaries: receipts
              .slice(0, 3)
              .map((row) => row.summary || row.event_type || '')
              .filter(Boolean),
            hasUnresolvedDrift: receipts.some((row) => row.status === 'open'),
          };
        });
        focusBrief = buildFocusParagraphContext(enriched);
      }
    } catch {
      focusBrief = '';
    }

    const prompt = `You are maintaining a continuous reflection thread for a personal AI memory system.

Thread title: ${thread.title}
Topic key: ${thread.topicKey}
Current hypothesis: ${thread.currentHypothesis ?? 'None'}
Existing open questions: ${thread.openQuestions.length > 0 ? thread.openQuestions.join(' | ') : 'None'}
Trigger type: ${triggerType}

${focusBrief ? `${focusBrief}\n` : ''}
Evidence:
${evidenceText}

Output language:
${renderOutputLanguageInstruction(outputLanguage)}

Return JSON only:
{
  "summary": "2-4 sentence summary of what changed and what matters next",
  "hypothesisAfter": "updated hypothesis, if any",
  "discoveries": ["short bullet"],
  "openQuestions": ["short question"],
  "rehearsalCandidates": [
    {
      "title": "short future-scene reminder title",
      "dedupeKey": "stable key for the same future scene",
      "scenarioType": "chat|meeting|issue|writing|general",
      "summary": "short optional preview",
      "content": "what the user should remember, say, or do when the future scene appears",
      "activationCues": {
        "people": ["person names"],
        "projects": ["project names"],
        "topics": ["topic names"],
        "keywords": ["keywords"],
        "groupIds": ["chat group ids"],
        "conversationIds": ["conversation ids"],
        "meetingIds": ["meeting ids"],
        "calendarEventIds": ["calendar event ids"],
        "issueKeys": ["Jira or issue keys"],
        "urls": ["canonical urls"],
        "surfaces": ["compose_assist|meeting_pilot|meeting_prep|today_pilot|memory_lens"]
      },
      "confidence": 0.0,
      "priority": 1
    }
  ]
}

Rules:
- Focus on what changed, what matters, and which gaps remain.
- Add rehearsalCandidates only when the evidence supports a concrete future scene: "when X happens, remember/say/do Y".
- Do not use rehearsalCandidates for generic facts, completed history, vague preferences, or ordinary todos without a future trigger.
- Each rehearsal candidate must include at least one activation cue. Prefer stable hard cues such as people, projects, group/conversation ids, meeting/calendar ids, issue keys, or URLs.
- Keep dream-derived or weak associative ideas as low confidence cues unless confirmed by stronger evidence.`;

    const parsed = await llm.generateJSON<WorkerResponse>(prompt, {
      temperature: 0.3,
      maxTokens: 1400,
    });

    const summary = parsed.summary?.trim();
    if (!summary) {
      throw new Error('LLM returned empty reflection summary');
    }

    const discoveries = uniqStrings(parsed.discoveries ?? []);
    const openQuestions = uniqStrings(parsed.openQuestions ?? []);
    const rehearsalCandidates = normalizeRehearsalCandidates(
      parsed.rehearsalCandidates,
    );
    const actionProposals = await this.planActions(
      thread,
      evidence,
      summary,
      openQuestions,
      cohesionResult,
    );

    return {
      summary,
      hypothesisAfter:
        parsed.hypothesisAfter?.trim() || thread.currentHypothesis,
      discoveries,
      openQuestions,
      actionProposals,
      rehearsalCandidates,
      cohesionReceipt: cohesionResult?.receipt,
      usedEvidenceRefs: evidence.map(toReflectionEvidenceRef),
      markdownBody: this.renderMarkdown(
        summary,
        discoveries,
        openQuestions,
        actionProposals,
        rehearsalCandidates,
        evidence,
        cohesionResult?.receipt,
      ),
    };
  }

  private generateFallback(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    triggerType: string,
    cohesionResult?: EvidenceCohesionResult,
  ): GeneratedReflection {
    const evidencePreview = evidence.slice(0, 3);
    const discoveries = evidencePreview.map(
      (item) => `${item.title}: ${item.snippet.slice(0, 140)}`,
    );
    const openQuestions = uniqStrings([
      ...thread.openQuestions,
      evidencePreview.length > 0
        ? `Should ${thread.title} trigger a concrete follow-up action?`
        : undefined,
    ]).slice(0, 5);

    const summary =
      evidencePreview.length > 0
        ? `${thread.title} was revisited by ${triggerType}. ${evidencePreview.length} recent evidence item(s) were attached, with the newest signal pointing to "${evidencePreview[0].title}".`
        : `${thread.title} was revisited by ${triggerType}, but there was no fresh evidence beyond the existing thread state.`;

    const actionProposals: DraftReflectionAction[] = [];
    if (
      thread.sourceType === 'confirm_request' ||
      thread.priority >= 8 ||
      thread.salience >= getConfig().reflectionUrgentNotifyThreshold
    ) {
      actionProposals.push({
        actionType: 'notify_user',
        title: `自我反思提示: ${thread.title}`,
        description: summary,
        confidence: 0.75,
        requiresApproval: false,
        executionMode: 'auto',
        priority: Math.max(7, thread.priority),
        utilityScore: clampScore(thread.salience, 0.7),
        urgencyScore: clampScore(thread.salience, 0.7),
        riskLevel: 'low',
        params: {
          title: `自我反思: ${thread.title}`,
          body: summary,
          payload: {
            threadId: thread.id,
            topicKey: thread.topicKey,
          },
        },
      });
    }

    return {
      summary,
      hypothesisAfter: thread.currentHypothesis,
      discoveries,
      openQuestions,
      actionProposals,
      rehearsalCandidates: [],
      cohesionReceipt: cohesionResult?.receipt,
      usedEvidenceRefs: evidence.map(toReflectionEvidenceRef),
      markdownBody: this.renderMarkdown(
        summary,
        discoveries,
        openQuestions,
        actionProposals,
        [],
        evidence,
        cohesionResult?.receipt,
      ),
    };
  }

  private async planActions(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    summary: string,
    openQuestions: string[],
    cohesionResult?: EvidenceCohesionResult,
  ): Promise<DraftReflectionAction[]> {
    if (isReflectionCohesionBlocking(cohesionResult)) return [];
    const question =
      openQuestions[0] ??
      thread.continueReason ??
      `${thread.title} 当前最需要补齐的信息是什么？`;
    const policy = this.buildResolutionPolicy(thread);
    const plan = await this.evidencePlanner.resolve({
      question,
      context: [thread.currentHypothesis, summary].filter(Boolean).join('\n'),
      evidence: evidence.map((item) => ({
        sourceKind: item.sourceKind,
        sourceId: item.sourceId,
        title: item.title,
        content: item.snippet,
        createdAt: item.createdAt,
        metadata: {
          role: item.role,
        },
      })),
      policy,
    });
    const action = this.buildActionFromResolutionPlan(thread, question, plan);
    if (!action) return [];
    const evidenceRefs = evidence.map(toReflectionEvidenceRef);
    return [
      {
        ...action,
        evidenceRefs,
        params: {
          ...(action.params ?? {}),
          ...(cohesionResult
            ? { evidenceCohesion: cohesionResult.receipt }
            : {}),
        },
      },
    ];
  }

  private buildCohesionResult(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
  ): EvidenceCohesionResult | undefined {
    if (evidence.length === 0) return undefined;
    const topicSuffix = thread.topicKey.includes(':')
      ? thread.topicKey.slice(thread.topicKey.indexOf(':') + 1)
      : thread.topicKey;
    const topicLabel = topicSuffix.replace(/[-_]+/g, ' ').trim() || thread.title;
    const questionOrTask = [
      thread.title,
      thread.topicKey,
      thread.currentHypothesis,
      thread.continueReason,
      ...thread.openQuestions,
    ]
      .filter(Boolean)
      .join('\n');

    return this.cohesionGate.evaluate({
      entrypoint: 'reflection_worker',
      intent: 'reflect_fact',
      questionOrTask,
      selectedTopic: {
        id: thread.topicKey,
        label: topicLabel,
        aliases: uniqStrings([thread.title, topicSuffix]),
        sourceAnchors: [thread.topicKey],
      },
      candidates: evidence.map(toReflectionCohesionCandidate),
      policy: { allowBackground: true },
    });
  }

  private buildResolutionPolicy(
    thread: ReflectionThreadRecord,
  ): EvidenceResolutionPolicy {
    const summarySignals = [
      thread.title,
      thread.latestSummary,
      thread.continueReason,
      thread.currentHypothesis,
      ...thread.openQuestions,
    ]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join('\n');
    const explicitActionIntent =
      /\b(create|update|modify|submit|file)\b|创建|新建|修改|更新|提交|写入/i.test(
        summarySignals,
      );

    return {
      scene: 'reflection',
      userIntentMode: explicitActionIntent
        ? 'explicit_action'
        : 'informational',
      externalRead: 'auto',
      externalWrite: explicitActionIntent ? 'approval_required' : 'disabled',
      allowAskExternalUser: true,
      allowCreateConfirmRequest: true,
    };
  }

  private buildActionFromResolutionPlan(
    thread: ReflectionThreadRecord,
    question: string,
    plan: EvidenceResolutionPlan,
  ): DraftReflectionAction | null {
    const actionType = plan.recommendedAction;
    if (actionType === 'none') return null;

    const description = plan.summary;
    let title = '';
    if (actionType === 'delegate_openclaw') {
      title = `继续外部核实: ${thread.title}`;
    } else if (actionType === 'ask_external_user') {
      title = `继续询问外部对象: ${thread.title}`;
    } else if (actionType === 'create_confirm_request') {
      title = `需要你决定下一步: ${thread.title}`;
    } else {
      title = question.slice(0, 48);
    }
    const planActionParams =
      plan.actionParams &&
      typeof plan.actionParams === 'object' &&
      !Array.isArray(plan.actionParams)
        ? plan.actionParams
        : {};
    const sourceAnchor =
      typeof planActionParams.sourceAnchor === 'string' &&
      planActionParams.sourceAnchor.trim().length > 0
        ? planActionParams.sourceAnchor.trim()
        : (plan.sourceAnchor ?? `thread:${thread.id}`);
    const resolutionParams = {
      sourceAnchor,
      gapType: plan.gapType,
      reasonCode: plan.reasonCode,
      routing:
        actionType === 'create_confirm_request' && plan.disposition === 'watch'
          ? 'watch'
          : undefined,
      evidenceResolution: {
        disposition: plan.disposition,
        reasonCode: plan.reasonCode,
        gapType: plan.gapType,
        sourceAnchor,
      },
    };

    return this.normalizeAction(
      {
        actionType: actionType as EvidenceResolutionActionType,
        title,
        description,
        params:
          actionType === 'create_confirm_request'
            ? {
                ...planActionParams,
                ...resolutionParams,
              }
            : {
                ...planActionParams,
                ...resolutionParams,
              },
        confidence: plan.confidence,
        priority:
          actionType === 'create_confirm_request'
            ? Math.max(7, thread.priority)
            : thread.priority,
        utilityScore: thread.salience,
        urgencyScore:
          plan.resolutionState === 'partial' ||
          plan.resolutionState === 'insufficient'
            ? Math.max(0.6, thread.salience)
            : thread.salience,
        riskLevel: actionType === 'delegate_openclaw' ? 'low' : 'medium',
        evidenceRefs: [],
      },
      thread,
    );
  }

  private normalizeAction(
    action: DraftReflectionAction,
    thread: ReflectionThreadRecord,
  ): DraftReflectionAction | null {
    if (!action.actionType?.trim() || !action.title?.trim()) return null;

    const params =
      action.params &&
      typeof action.params === 'object' &&
      !Array.isArray(action.params)
        ? action.params
        : {};
    const requestedMode =
      action.actionType.trim() === 'delegate_openclaw' &&
      typeof params.mode === 'string'
        ? params.mode.trim().toLowerCase()
        : undefined;
    const normalizedActionType = action.actionType.trim();
    const explicitExecutionMode = normalizeExecutionMode(action.executionMode);

    if (normalizedActionType === 'ask_external_user') {
      const targetRef =
        params.targetRef ??
        params.target_ref ??
        params.targetId ??
        params.chatId;
      const question =
        typeof params.question === 'string' ? params.question.trim() : '';
      if (isSelfOrUnknownOutreachTarget(targetRef) || !question) {
        return null;
      }
    }

    const shouldForceAutoInternalAction =
      INTERNAL_AUTO_ACTION_TYPES.has(normalizedActionType) &&
      explicitExecutionMode !== 'manual';
    const defaultExecutionMode = shouldForceAutoInternalAction
      ? 'auto'
      : (explicitExecutionMode ??
        defaultExecutionModeForAction(normalizedActionType, params));
    const defaultRequiresApproval = shouldForceAutoInternalAction
      ? false
      : (action.requiresApproval ?? defaultExecutionMode !== 'auto');
    const delegatePolicy =
      normalizedActionType === 'delegate_openclaw'
        ? resolveDelegateOpenClawPolicy({
            params,
            requestedExecutionMode: explicitExecutionMode,
            requestedRequiresApproval: action.requiresApproval,
            defaultExecutionMode,
            defaultRequiresApproval,
          })
        : null;
    const executionMode = delegatePolicy?.executionMode ?? defaultExecutionMode;
    const requiresApproval =
      delegatePolicy?.requiresApproval ?? defaultRequiresApproval;

    return {
      actionType: normalizedActionType,
      title: action.title.trim(),
      description: action.description?.trim(),
      params,
      confidence: clampScore(action.confidence, 0.6),
      requiresApproval,
      executionMode,
      priority: Math.max(
        1,
        Math.min(Math.round(action.priority ?? thread.priority), 10),
      ),
      utilityScore: clampScore(action.utilityScore, thread.salience),
      urgencyScore: clampScore(action.urgencyScore, thread.salience),
      riskLevel: action.riskLevel ?? 'low',
      evidenceRefs: uniqStrings(action.evidenceRefs ?? []),
      scheduledAt: action.scheduledAt,
    };
  }

  private renderMarkdown(
    summary: string,
    discoveries: string[],
    openQuestions: string[],
    actions: DraftReflectionAction[],
    rehearsalCandidates: DraftRehearsalCandidate[],
    evidence: ReflectionEvidenceItem[],
    cohesionReceipt?: EvidenceCohesionReceipt,
  ): string {
    const discoveriesMd =
      discoveries.length > 0
        ? discoveries.map((item) => `- ${item}`).join('\n')
        : '- None';
    const questionsMd =
      openQuestions.length > 0
        ? openQuestions.map((item) => `- ${item}`).join('\n')
        : '- None';
    const actionsMd =
      actions.length > 0
        ? actions
            .map(
              (action) =>
                `- [${action.actionType}] ${action.title}${action.description ? `: ${action.description}` : ''}`,
            )
            .join('\n')
        : '- None';
    const rehearsalsMd =
      rehearsalCandidates.length > 0
        ? rehearsalCandidates
            .map(
              (candidate) =>
                `- ${candidate.title}: ${candidate.summary ?? candidate.content}`,
            )
            .join('\n')
        : '- None';
    const evidenceMd =
      evidence.length > 0
        ? evidence
            .map(
              (item) =>
                `- **${item.title}** (${item.sourceKind}/${item.role})${item.createdAt ? ` @ ${formatDateTime(item.createdAt)}` : ''}: ${item.snippet}`,
            )
            .join('\n')
        : '- None';
    const cohesionMd = cohesionReceipt
      ? `- ${cohesionReceipt.state}: ${cohesionReceipt.summary}`
      : '- Not evaluated because no candidate evidence was attached.';

    return `## Summary
${summary}

## Discoveries
${discoveriesMd}

## Open Questions
${questionsMd}

## Proposed Actions
${actionsMd}

## Rehearsal Candidates
${rehearsalsMd}

## Evidence
${evidenceMd}

## Evidence Cohesion
${cohesionMd}
`;
  }
}

function toReflectionEvidenceRef(item: ReflectionEvidenceItem): string {
  return `${item.sourceKind}:${item.sourceId}`;
}

function toReflectionCohesionCandidate(
  item: ReflectionEvidenceItem,
): EvidenceCohesionCandidate {
  const normalizedRole = item.role.toLowerCase();
  return {
    evidenceRef: toReflectionEvidenceRef(item),
    sourceType: item.sourceKind,
    // Research titles describe the query purpose and are not evidence-owned
    // subject labels, so use the actual snippet for cohesion in that case.
    title: normalizedRole === 'research' ? undefined : item.title,
    snippet: item.snippet,
    sourceAnchor: `${item.sourceKind}:${item.sourceId}`,
    subjectKeys:
      normalizedRole === 'research' || !item.title.trim()
        ? []
        : [item.title],
    role:
      normalizedRole === 'background' ||
      normalizedRole === 'dream' ||
      normalizedRole === 'weak'
        ? 'background'
        : 'supporting',
    timestamp: item.createdAt,
  };
}

function isReflectionCohesionBlocking(
  result: EvidenceCohesionResult | undefined,
): boolean {
  return (
    result?.state === 'split_required' ||
    result?.state === 'insufficient_anchor' ||
    result?.state === 'blocked_cross_scene'
  );
}

function normalizeRehearsalCandidates(
  candidates: DraftRehearsalCandidate[] | undefined,
): DraftRehearsalCandidate[] {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((candidate): DraftRehearsalCandidate | null => {
      const title = candidate?.title?.trim();
      const content = candidate?.content?.trim();
      if (!title || !content) return null;
      const activationCues = normalizeActivationCues(
        candidate.activationCues,
      );
      if (!hasCue(activationCues)) return null;
      return {
        title,
        dedupeKey: candidate.dedupeKey?.trim() || undefined,
        scenarioType: candidate.scenarioType?.trim() || 'general',
        summary: candidate.summary?.trim() || undefined,
        content,
        activationCues,
        confidence: clampScore(candidate.confidence, 0.6),
        priority: Math.max(
          1,
          Math.min(Math.round(candidate.priority ?? 5), 10),
        ),
        validUntil: Number.isFinite(candidate.validUntil)
          ? candidate.validUntil
          : undefined,
        evidenceRefs: uniqStrings(candidate.evidenceRefs ?? []),
      };
    })
    .filter(
      (candidate): candidate is DraftRehearsalCandidate =>
        candidate !== null,
    )
    .slice(0, 5);
}

function normalizeActivationCues(
  cues: RehearsalActivationCues | undefined,
): RehearsalActivationCues {
  if (!cues || typeof cues !== 'object') return {};
  const normalized: RehearsalActivationCues = {};
  for (const key of [
    'people',
    'projects',
    'topics',
    'keywords',
    'groupIds',
    'conversationIds',
    'meetingIds',
    'calendarEventIds',
    'issueKeys',
    'urls',
    'surfaces',
  ] as const) {
    const values = Array.isArray(cues[key])
      ? cues[key]!
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : [];
    const unique = Array.from(new Set(values)).slice(0, 12);
    if (unique.length) normalized[key] = unique;
  }
  return normalized;
}

function hasCue(cues: RehearsalActivationCues): boolean {
  return Object.values(cues).some((values) => values.length > 0);
}
