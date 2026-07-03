import { getLLMClient } from '../llm/LLMClient.js';
import type { ReflectionEvidenceItem } from './ReflectionWorker.js';
import type {
  ReflectionThreadRecord,
  ReflectionRunRecord,
} from '../repositories/ReflectionThreadRepository.js';
import {
  SOURCE_TYPES,
  type RecallQuery,
  type RecallSourceType,
} from '../types/index.js';
import type { UserDataManager } from '../storage/UserDataManager.js';

const DEFAULT_LOCAL_RESEARCH_SOURCE_TYPES: RecallSourceType[] = [
  'glip',
  'jira',
  'web',
  'manual',
  'system',
  'source_memory',
  'user_core',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
  'daily_log',
  'project_summary',
  'entity_profile',
];

const SUPPORTED_LOCAL_RESEARCH_SOURCE_TYPES = new Set<RecallSourceType>([
  ...SOURCE_TYPES,
  'daily_log',
  'project_summary',
  'reflection',
  'dream',
  'rehearsal',
  'reflection_thread',
  'source_memory',
  'entity_profile',
  'markdown',
  'user_core',
]);

export interface LocalResearchQuery {
  query: string;
  topK: number;
  purpose: string;
  timeRange?: { start?: number; end?: number };
  projectFilter?: string;
  senderFilter?: string[];
  groupFilter?: string[];
  sourceTypes?: RecallQuery['sourceTypes'];
  requestedSourceTypes?: string[];
  rejectedSourceTypes?: string[];
  scopeNotice?: string;
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
    .filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    )
    .map((item) => item.trim());
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

function resolveSourceTypes(values: unknown): Pick<
  LocalResearchQuery,
  'sourceTypes' | 'requestedSourceTypes' | 'rejectedSourceTypes' | 'scopeNotice'
> {
  const requested = uniqStrings(values);
  if (!requested) {
    return {
      sourceTypes: [...DEFAULT_LOCAL_RESEARCH_SOURCE_TYPES],
    };
  }

  const accepted = requested.filter((item): item is RecallSourceType =>
    SUPPORTED_LOCAL_RESEARCH_SOURCE_TYPES.has(item as RecallSourceType),
  );
  const rejected = requested.filter(
    (item) => !SUPPORTED_LOCAL_RESEARCH_SOURCE_TYPES.has(item as RecallSourceType),
  );
  const sourceTypes =
    accepted.length > 0
      ? accepted
      : [...DEFAULT_LOCAL_RESEARCH_SOURCE_TYPES];
  const scopeNotice =
    rejected.length > 0
      ? accepted.length > 0
        ? `研究范围已裁剪：仅查询 Personal AI 支持的本地来源 ${sourceTypes.join(
            ' / ',
          )}；已忽略不支持的来源 ${rejected.join(' / ')}。`
        : `研究范围已裁剪：模型建议的来源 ${rejected.join(
            ' / ',
          )} 当前不支持，已改用默认本地来源 ${sourceTypes.join(' / ')}。`
      : undefined;

  return {
    sourceTypes,
    requestedSourceTypes: requested,
    rejectedSourceTypes: rejected.length > 0 ? rejected : undefined,
    scopeNotice,
  };
}

function compactText(value: string | undefined | null): string | undefined {
  const compacted = value?.replace(/\s+/g, ' ').trim();
  return compacted || undefined;
}

function fallbackTopicText(topicKey: string): string | undefined {
  const [, ...parts] = topicKey.split(':');
  return compactText(parts.join(' ')) ?? compactText(topicKey);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
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
        '[ReflectionResearcher] Falling back to deterministic research plan:',
        error instanceof Error ? error.message : String(error),
      );
      return this.planFallback(thread);
    }
  }

  private planFallback(thread: ReflectionThreadRecord): LocalResearchQuery[] {
    const primaryQuestion = compactText(thread.openQuestions[0]);
    const queryParts = [
      compactText(thread.title),
      primaryQuestion,
      compactText(thread.currentHypothesis),
      fallbackTopicText(thread.topicKey),
    ].filter((value): value is string => Boolean(value));
    const dedupedParts = Array.from(new Set(queryParts));
    if (dedupedParts.length === 0) return [];

    return [
      {
        query: truncate(dedupedParts.slice(0, 4).join(' '), 220),
        topK: 5,
        purpose: primaryQuestion
          ? truncate(
              `Fallback local research for unresolved reflection question: ${primaryQuestion}`,
              180,
            )
          : 'Fallback local research to keep reflection grounded in existing evidence.',
        sourceTypes: [...DEFAULT_LOCAL_RESEARCH_SOURCE_TYPES],
      },
    ];
  }

  private async planWithLlm(
    thread: ReflectionThreadRecord,
    evidence: ReflectionEvidenceItem[],
    recentRuns: ReflectionRunRecord[],
  ): Promise<LocalResearchQuery[]> {
    const llm = getLLMClient();
    const evidenceText = evidence
      .slice(0, 8)
      .map(
        (item, index) =>
          `${index + 1}. [${item.sourceKind}/${item.role}] ${item.title}\n${item.snippet}`,
      )
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
      .filter(
        (item) =>
          typeof item.query === 'string' && item.query.trim().length > 0,
      )
      .slice(0, 3)
      .map((item) => {
        const sourceTypeScope = resolveSourceTypes(item.sourceTypes);
        return {
          query: item.query!.trim(),
          topK: clampTopK(item.topK),
          purpose:
            typeof item.purpose === 'string' && item.purpose.trim().length > 0
              ? item.purpose.trim()
              : 'Support the next reflection step with local evidence.',
          timeRange:
            item.timeRange && typeof item.timeRange === 'object'
              ? {
                  start: Number.isFinite(item.timeRange.start)
                    ? item.timeRange.start
                    : undefined,
                  end: Number.isFinite(item.timeRange.end)
                    ? item.timeRange.end
                    : undefined,
                }
              : undefined,
          projectFilter:
            typeof item.projectFilter === 'string' &&
            item.projectFilter.trim().length > 0
              ? item.projectFilter.trim()
              : undefined,
          senderFilter: uniqStrings(item.senderFilter),
          groupFilter: uniqStrings(item.groupFilter),
          ...sourceTypeScope,
        };
      });
  }
}
