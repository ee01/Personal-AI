import { getConfig } from '../config.js';
import { getLLMClient } from '../llm/LLMClient.js';
import type { QueuedActionRecord } from '../repositories/ActionRepository.js';
import type { ReflectionThreadRecord } from '../repositories/ReflectionThreadRepository.js';
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

export interface GeneratedReflection {
  summary: string;
  hypothesisAfter?: string;
  discoveries: string[];
  openQuestions: string[];
  actionProposals: DraftReflectionAction[];
  markdownBody: string;
}

interface WorkerResponse {
  summary: string;
  hypothesisAfter?: string;
  discoveries?: string[];
  openQuestions?: string[];
  actionProposals?: DraftReflectionAction[];
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

export class ReflectionWorker {
  async generate(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    triggerType: string,
  ): Promise<GeneratedReflection> {
    if (process.env.REFLECTION_FORCE_FALLBACK === 'true') {
      return this.generateFallback(thread, evidence, triggerType);
    }

    try {
      return await this.generateWithLlm(thread, evidence, triggerType);
    } catch (err) {
      console.warn(
        '[ReflectionWorker] Falling back to heuristic reflection:',
        err instanceof Error ? err.message : String(err),
      );
      return this.generateFallback(thread, evidence, triggerType);
    }
  }

  private async generateWithLlm(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    triggerType: string,
  ): Promise<GeneratedReflection> {
    const llm = getLLMClient();
    const evidenceText = evidence.length > 0
      ? evidence
          .slice(0, 10)
          .map((item, index) => {
            const ts = item.createdAt ? formatDateTime(item.createdAt) : 'unknown';
            return `${index + 1}. [${item.sourceKind}/${item.role}] ${item.title} @ ${ts}\n${item.snippet}`;
          })
          .join('\n\n')
      : 'No external evidence attached.';

    const prompt = `You are maintaining a continuous reflection thread for a personal AI memory system.

Thread title: ${thread.title}
Topic key: ${thread.topicKey}
Current hypothesis: ${thread.currentHypothesis ?? 'None'}
Existing open questions: ${(thread.openQuestions.length > 0 ? thread.openQuestions.join(' | ') : 'None')}
Trigger type: ${triggerType}

Evidence:
${evidenceText}

Return JSON only:
{
  "summary": "2-4 sentence summary of what changed and what matters next",
  "hypothesisAfter": "updated hypothesis, if any",
  "discoveries": ["short bullet"],
  "openQuestions": ["short question"],
  "actionProposals": [
    {
      "actionType": "notify_user | create_confirm_request | update_truth_property | query_external_tool",
      "title": "short title",
      "description": "why this action matters",
      "confidence": 0.0,
      "requiresApproval": true,
      "executionMode": "manual | auto",
      "priority": 1,
      "utilityScore": 0.0,
      "urgencyScore": 0.0,
      "riskLevel": "low | medium | high",
      "params": {}
    }
  ]
}`;

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
    const actionProposals = (parsed.actionProposals ?? [])
      .map((action) => this.normalizeAction(action, thread))
      .filter((action): action is DraftReflectionAction => Boolean(action));

    return {
      summary,
      hypothesisAfter: parsed.hypothesisAfter?.trim() || thread.currentHypothesis,
      discoveries,
      openQuestions,
      actionProposals,
      markdownBody: this.renderMarkdown(summary, discoveries, openQuestions, actionProposals, evidence),
    };
  }

  private generateFallback(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    triggerType: string,
  ): GeneratedReflection {
    const evidencePreview = evidence.slice(0, 3);
    const discoveries = evidencePreview.map((item) => `${item.title}: ${item.snippet.slice(0, 140)}`);
    const openQuestions = uniqStrings([
      ...thread.openQuestions,
      evidencePreview.length > 0 ? `Should ${thread.title} trigger a concrete follow-up action?` : undefined,
    ]).slice(0, 5);

    const summary = evidencePreview.length > 0
      ? `${thread.title} was revisited by ${triggerType}. ${evidencePreview.length} recent evidence item(s) were attached, with the newest signal pointing to "${evidencePreview[0].title}".`
      : `${thread.title} was revisited by ${triggerType}, but there was no fresh evidence beyond the existing thread state.`;

    const actionProposals: DraftReflectionAction[] = [];
    if (thread.sourceType === 'confirm_request' || thread.priority >= 8 || thread.salience >= getConfig().reflectionUrgentNotifyThreshold) {
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
      markdownBody: this.renderMarkdown(summary, discoveries, openQuestions, actionProposals, evidence),
    };
  }

  private normalizeAction(
    action: DraftReflectionAction,
    thread: ReflectionThreadRecord,
  ): DraftReflectionAction | null {
    if (!action.actionType?.trim() || !action.title?.trim()) return null;

    return {
      actionType: action.actionType.trim(),
      title: action.title.trim(),
      description: action.description?.trim(),
      params: action.params ?? {},
      confidence: clampScore(action.confidence, 0.6),
      requiresApproval: action.requiresApproval ?? action.executionMode !== 'auto',
      executionMode: action.executionMode === 'auto' ? 'auto' : 'manual',
      priority: Math.max(1, Math.min(Math.round(action.priority ?? thread.priority), 10)),
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
    evidence: ReflectionEvidenceItem[],
  ): string {
    const discoveriesMd = discoveries.length > 0
      ? discoveries.map((item) => `- ${item}`).join('\n')
      : '- None';
    const questionsMd = openQuestions.length > 0
      ? openQuestions.map((item) => `- ${item}`).join('\n')
      : '- None';
    const actionsMd = actions.length > 0
      ? actions.map((action) => `- [${action.actionType}] ${action.title}${action.description ? `: ${action.description}` : ''}`).join('\n')
      : '- None';
    const evidenceMd = evidence.length > 0
      ? evidence.map((item) => `- **${item.title}** (${item.sourceKind}/${item.role})${item.createdAt ? ` @ ${formatDateTime(item.createdAt)}` : ''}: ${item.snippet}`).join('\n')
      : '- None';

    return `## Summary
${summary}

## Discoveries
${discoveriesMd}

## Open Questions
${questionsMd}

## Proposed Actions
${actionsMd}

## Evidence
${evidenceMd}
`;
  }
}
