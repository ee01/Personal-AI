import { getLLMClient } from '../llm/LLMClient.js';
import type { ReflectionEvidenceItem } from './ReflectionWorker.js';
import type { ReflectionThreadRecord, ReflectionRunRecord } from '../repositories/ReflectionThreadRepository.js';
import type { RecallQuery } from '../types/index.js';
import type { UserDataManager } from '../storage/UserDataManager.js';

export interface LocalResearchQuery {
  query: string;
  topK: number;
  purpose: string;
  timeRange?: { start?: number; end?: number };
  projectFilter?: string;
  senderFilter?: string[];
  groupFilter?: string[];
  sourceTypes?: RecallQuery['sourceTypes'];
}

interface ResearchPlanResponse {
  local_queries?: Array<{
    query?: string;
    topK?: number;
    purpose?: string;
    timeRange?: { start?: number; end?: number };
    projectFilter?: string;
    senderFilter?: string[];
    groupFilter?: string[];
    sourceTypes?: RecallQuery['sourceTypes'];
  }>;
}

function loadUserCore(userDataManager?: UserDataManager): string {
  if (!userDataManager) return '';
  try {
    return userDataManager.readFile('USER_CORE.md') ?? '';
  } catch {
    return '';
  }
}

function clampTopK(value: number | undefined): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(8, Math.floor(value!)));
}

function uniqStrings(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const items = values
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

export class ReflectionResearcher {
  constructor(private readonly userDataManager?: UserDataManager) {}

  async plan(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    recentRuns: ReflectionRunRecord[],
  ): Promise<LocalResearchQuery[]> {
    try {
      return await this.planWithLlm(thread, evidence, recentRuns);
    } catch (error) {
      console.warn(
        '[ReflectionResearcher] Falling back to no-op research plan:',
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  private async planWithLlm(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    recentRuns: ReflectionRunRecord[],
  ): Promise<LocalResearchQuery[]> {
    const llm = getLLMClient();
    const evidenceText = evidence
      .slice(0, 8)
      .map((item, index) => `${index + 1}. [${item.sourceKind}/${item.role}] ${item.title}\n${item.snippet}`)
      .join('\n\n');
    const runsText = recentRuns
      .slice(0, 3)
      .map((run, index) => `${index + 1}. ${run.summary}`)
      .join('\n');
    const userCore = loadUserCore(this.userDataManager);

    const prompt = `You are planning local memory research for a self-reflection thread.

Thread:
- title: ${thread.title}
- topicKey: ${thread.topicKey}
- currentHypothesis: ${thread.currentHypothesis ?? 'None'}
- openQuestions: ${thread.openQuestions.join(' | ') || 'None'}

Existing evidence:
${evidenceText || 'None'}

Recent runs:
${runsText || 'None'}

User core context:
${userCore || 'None'}

Return JSON only:
{
  "local_queries": [
    {
      "query": "natural language query for local memory recall",
      "topK": 5,
      "purpose": "why this local search is useful",
      "projectFilter": "optional",
      "senderFilter": ["optional"],
      "groupFilter": ["optional"],
      "sourceTypes": ["optional"]
    }
  ]
}

Rules:
- Plan at most 3 local queries.
- Only plan local memory/message lookups inside Personal AI.
- Do not plan external queries here.
- Return [] if existing evidence already seems sufficient.`;

    const parsed = await llm.generateJSON<ResearchPlanResponse>(prompt, {
      temperature: 0.2,
      maxTokens: 700,
    });

    return (parsed.local_queries ?? [])
      .filter((item) => typeof item.query === 'string' && item.query.trim().length > 0)
      .slice(0, 3)
      .map((item) => ({
        query: item.query!.trim(),
        topK: clampTopK(item.topK),
        purpose: typeof item.purpose === 'string' && item.purpose.trim().length > 0
          ? item.purpose.trim()
          : 'Support the next reflection step with local evidence.',
        timeRange:
          item.timeRange && typeof item.timeRange === 'object'
            ? {
                start: Number.isFinite(item.timeRange.start) ? item.timeRange.start : undefined,
                end: Number.isFinite(item.timeRange.end) ? item.timeRange.end : undefined,
              }
            : undefined,
        projectFilter:
          typeof item.projectFilter === 'string' && item.projectFilter.trim().length > 0
            ? item.projectFilter.trim()
            : undefined,
        senderFilter: uniqStrings(item.senderFilter),
        groupFilter: uniqStrings(item.groupFilter),
        sourceTypes: Array.isArray(item.sourceTypes) ? item.sourceTypes : undefined,
      }));
  }
}
