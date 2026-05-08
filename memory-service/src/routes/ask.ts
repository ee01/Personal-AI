/**
 * Ask route — Natural language Q&A over the memory store.
 *
 * POST /ask - Combines recall + LLM generation to answer questions
 *             using the user's stored memories as context.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import type {
  RecallAnalysis,
  RecallBlock,
  RecallItem,
  RecallScope,
} from '../types/index.js';
import { ActiveRecallService } from '../core/ActiveRecallService.js';
import { QueryIntentParser } from '../core/QueryIntentParser.js';
import type { ParsedQueryIntent } from '../core/QueryIntentParser.js';
import type { ProfileManager } from '../core/ProfileManager.js';
import { OnlineReflection } from '../core/OnlineReflection.js';
import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { resolveDelegateOpenClawPolicy } from '../core/actions/delegateOpenClawPolicy.js';
import {
  DecisionEvidenceChainService,
  type DecisionEvidenceChainBlock,
} from '../core/DecisionEvidenceChainService.js';
import {
  EvidenceResolutionPlanner,
  type CandidateArtifact,
  type EvidenceResolutionPlan,
  type EvidenceResolutionPolicy,
  type EvidenceResolutionState,
} from '../core/EvidenceResolutionPlanner.js';
import { LLMClient } from '../llm/LLMClient.js';
import { getConfig } from '../config.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import type Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskBody {
  query: string;
  context?: string;
  includeEvidence?: boolean;
  scope?: RecallScope;
}

type AskBlock = RecallBlock | DecisionEvidenceChainBlock;

interface StructuredTimelineItem {
  date: string;
  event: string;
}

interface StructuredRelatedEntity {
  name: string;
  type: string;
  relevance: string;
}

interface StructuredAskAnswer {
  timeline?: StructuredTimelineItem[];
  keyFindings?: string[];
  insights?: string[];
  relatedEntities?: StructuredRelatedEntity[];
  confidence?: number;
}

interface AskResponse {
  answer: string;
  evidence?: RecallItem[];
  queryTimeMs: number;
  structuredAnswer?: StructuredAskAnswer;
  /** Structured UI blocks (timeline, evidence_list, media, summary). */
  blocks?: AskBlock[];
  /** Higher-level synthesis derived from the recalled evidence. */
  analysis?: RecallAnalysis;
  resolutionState?: EvidenceResolutionState;
  missingInfo?: string[];
  followUpActions?: Array<{
    id: string;
    actionType: string;
    title: string;
    queueStatus: string;
    executionMode: string;
    sourceKind?: string;
    sourceRefId?: string;
    result?: Record<string, unknown>;
    lastError?: string;
  }>;
  externalEvidence?: CandidateArtifact[];
}

interface PreparedAskContext {
  recalledItems: RecallItem[];
  recallBlocks?: AskBlock[];
  recallAnalysis?: RecallAnalysis;
  intentContext: string;
  combinedMemoryContext: string;
  actionOutcome: {
    followUpActions: NonNullable<AskResponse['followUpActions']>;
    externalEvidence: CandidateArtifact[];
    finalResolutionState: EvidenceResolutionState;
    missingInfo: string[];
  };
}

type AskStatusReporter = (message: string) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const askBodySchema = {
  type: 'object' as const,
  required: ['query'],
  properties: {
    query: { type: 'string' as const, minLength: 1 },
    context: { type: 'string' as const },
    includeEvidence: { type: 'boolean' as const },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal', 'both', 'all'],
    },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a personal AI assistant with access to the user's memory.

Answer only from the provided context. If the context is insufficient, say so clearly.

Return a JSON object with this shape:
{
  "answer": "markdown answer",
  "timeline": [{ "date": "YYYY-MM-DD or relative time", "event": "what happened" }],
  "keyFindings": ["important finding"],
  "insights": ["higher-level insight"],
  "relatedEntities": [{ "name": "entity", "type": "Person|Project|Topic|Other", "relevance": "why it matters" }],
  "confidence": 0.0
}

Rules:
- "answer" is required
- Omit optional fields when there is no useful data
- Keep "confidence" between 0 and 1
- Do not invent evidence that is not supported by the provided context`;

const STREAMING_SYSTEM_PROMPT = `You are a personal AI assistant with access to the user's memory.

Answer only from the provided context. If the context is insufficient, say so clearly.

Respond in concise markdown only.
Do not return JSON.
Do not wrap the answer in code fences.`;

/**
 * Load the USER_CORE.md file via the per-user UserDataManager.
 * Returns the file content, or an empty string if the file does not exist.
 */
function loadUserCore(userDataManager?: UserDataManager | null): string {
  if (!userDataManager) return '';
  try {
    return userDataManager.readFile('USER_CORE.md') ?? '';
  } catch {
    return '';
  }
}

/**
 * Load the active IDENTITY and SOUL agent profiles from the database.
 * Returns a formatted persona string, or an empty string if no profiles exist.
 */
function loadAgentPersona(profileManager: ProfileManager): string {
  const identity = profileManager.getActiveProfile('identity');
  const soul = profileManager.getActiveProfile('soul');

  const parts: string[] = [];

  if (identity) {
    parts.push(`--- AI Identity ---\n${identity}`);
  }

  if (soul) {
    parts.push(`--- AI Values & Boundaries ---\n${soul}`);
  }

  return parts.join('\n\n');
}

/**
 * Load active user preferences from the database.
 * Returns a formatted string of preferences, or empty string if none found.
 */
function loadUserPreferences(db: Database.Database): string {
  try {
    const rows = db
      .prepare(
        `SELECT item_key, item_value
         FROM user_profile_items
         WHERE item_type = 'preference' AND status = 'active'
         ORDER BY salience_score DESC
         LIMIT 10`,
      )
      .all() as Array<{ item_key: string; item_value: string }>;

    if (rows.length === 0) return '';

    return rows.map((r) => `- ${r.item_key}: ${r.item_value}`).join('\n');
  } catch {
    return '';
  }
}

/**
 * Format recalled items as bullet-point context for the LLM prompt.
 */
function formatRecalledContext(items: RecallItem[]): string {
  if (items.length === 0) {
    return '(No relevant memories found)';
  }

  return items
    .map((item, index) => {
      const parts: string[] = [];
      parts.push(`[${index + 1}]`);

      if (item.source) {
        parts.push(`(${item.source})`);
      }

      if (item.timestamp) {
        const date = new Date(item.timestamp * 1000).toISOString().slice(0, 10);
        parts.push(`[${date}]`);
      }

      parts.push(item.content.slice(0, 500)); // Truncate very long content

      return `- ${parts.join(' ')}`;
    })
    .join('\n');
}

function formatIntentContext(intent: ParsedQueryIntent): string {
  const parts: string[] = [];

  if (intent.intent !== 'search') {
    parts.push(`- intent: ${intent.intent}`);
  }
  if (intent.filters.senderNames?.length) {
    parts.push(`- sender filter: ${intent.filters.senderNames.join(', ')}`);
  }
  if (intent.filters.groupNames?.length) {
    parts.push(`- group filter: ${intent.filters.groupNames.join(', ')}`);
  }
  if (intent.filters.projectNames?.length) {
    parts.push(`- project filter: ${intent.filters.projectNames.join(', ')}`);
  }
  if (intent.filters.sourceTypes?.length) {
    parts.push(`- source filter: ${intent.filters.sourceTypes.join(', ')}`);
  }
  if (intent.filters.minImportance != null) {
    parts.push(`- minimum importance: ${intent.filters.minImportance}`);
  }
  if (intent.filters.timeRange) {
    parts.push(
      `- time range: ${new Date(intent.filters.timeRange.start * 1000).toISOString()} -> ` +
        `${new Date(intent.filters.timeRange.end * 1000).toISOString()}`,
    );
  }

  return parts.join('\n');
}

function parseStructuredAnswer(raw: string): {
  answer: string;
  structuredAnswer?: StructuredAskAnswer;
} {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const structuredAnswer: StructuredAskAnswer = {};

    if (Array.isArray(parsed.timeline)) {
      const timeline = parsed.timeline
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object',
        )
        .map((item) => ({
          date: String(item.date ?? ''),
          event: String(item.event ?? ''),
        }))
        .filter((item) => item.date && item.event);
      if (timeline.length > 0) structuredAnswer.timeline = timeline;
    }

    if (Array.isArray(parsed.keyFindings)) {
      const keyFindings = parsed.keyFindings
        .map((item) => String(item))
        .filter(Boolean);
      if (keyFindings.length > 0) structuredAnswer.keyFindings = keyFindings;
    }

    if (Array.isArray(parsed.insights)) {
      const insights = parsed.insights
        .map((item) => String(item))
        .filter(Boolean);
      if (insights.length > 0) structuredAnswer.insights = insights;
    }

    if (Array.isArray(parsed.relatedEntities)) {
      const relatedEntities = parsed.relatedEntities
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object',
        )
        .map((item) => ({
          name: String(item.name ?? ''),
          type: String(item.type ?? ''),
          relevance: String(item.relevance ?? ''),
        }))
        .filter((item) => item.name && item.type && item.relevance);
      if (relatedEntities.length > 0)
        structuredAnswer.relatedEntities = relatedEntities;
    }

    if (
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
    ) {
      structuredAnswer.confidence = parsed.confidence;
    }

    const answer =
      typeof parsed.answer === 'string' && parsed.answer.trim()
        ? parsed.answer.trim()
        : raw;

    return {
      answer,
      structuredAnswer:
        Object.keys(structuredAnswer).length > 0 ? structuredAnswer : undefined,
    };
  } catch {
    return { answer: raw };
  }
}

function structuredAnswerToAnalysis(
  structured: StructuredAskAnswer | undefined,
): RecallAnalysis | undefined {
  if (!structured) return undefined;
  const summaryParts = (structured.keyFindings ?? []).slice(0, 3);
  const summary = summaryParts.join(' ').trim();
  if (
    !summary &&
    !structured.insights?.length &&
    structured.confidence == null
  ) {
    return undefined;
  }
  const analysis: RecallAnalysis = {
    summary: summary || (structured.insights?.[0] ?? ''),
  };
  if (structured.keyFindings?.length) {
    analysis.keyFindings = [...structured.keyFindings];
  }
  if (structured.insights?.length) {
    analysis.insights = [...structured.insights];
  }
  if (typeof structured.confidence === 'number') {
    analysis.confidence = structured.confidence;
  }
  if (!analysis.summary && !analysis.keyFindings && !analysis.insights) {
    return undefined;
  }
  return analysis;
}

function buildAugmentedSystemPrompt(
  db: Database.Database,
  profileManager: ProfileManager,
  userDataManager: UserDataManager | null | undefined,
  basePrompt: string,
): string {
  let enhancedPrompt = basePrompt;
  const agentPersona = loadAgentPersona(profileManager);
  if (agentPersona) enhancedPrompt += '\n\n' + agentPersona;
  const userCore = loadUserCore(userDataManager);
  if (userCore) enhancedPrompt += '\n\n--- User Context ---\n' + userCore;
  const preferences = loadUserPreferences(db);
  if (preferences) {
    enhancedPrompt +=
      '\n\n--- User Preferences (apply these silently when relevant) ---\n' +
      preferences;
  }
  return enhancedPrompt;
}

function buildPromptEnvelope(
  query: string,
  memoryContext: string,
  userContext: string | undefined,
  intentContext: string,
  instruction: string,
): string {
  let fullPrompt = `Context:\n${memoryContext}`;

  if (userContext) {
    fullPrompt += `\n\nAdditional context from user:\n${userContext}`;
  }

  if (intentContext) {
    fullPrompt += `\n\nDetected query constraints:\n${intentContext}`;
  }

  fullPrompt += `\n\nQuestion: ${query}`;
  fullPrompt += `\n\n${instruction}`;
  return fullPrompt;
}

async function recallForAsk(
  db: Database.Database,
  query: string,
  includeEvidence?: boolean,
  scope?: RecallScope,
): Promise<{
  parsedIntent: ParsedQueryIntent;
  recalledItems: RecallItem[];
  recallBlocks?: RecallBlock[];
  memoryContext: string;
  intentContext: string;
}> {
  const parser = new QueryIntentParser(db);
  const parsedIntent = parser.parse(query);
  const recallQueryText = parsedIntent.cleanedQuery || query;
  // /ask runs its own LLM pass for the prose answer, so we ask
  // ActiveRecallService for deterministic blocks only and skip its analysis
  // pass to avoid double LLM cost.
  const activeRecall = new ActiveRecallService(db);
  const recallScope = scope ?? 'work';
  const recallResult = await activeRecall.recall(
    {
      query: recallQueryText,
      topK:
        parsedIntent.intent === 'profile' ||
        Object.keys(parsedIntent.filters).length > 0
          ? 15
          : 10,
      includeMetadata: true,
      scope: recallScope,
      timeRange: parsedIntent.filters.timeRange,
      projectFilter: parsedIntent.filters.projectNames?.[0],
      senderFilter: parsedIntent.filters.senderNames,
      groupFilter: parsedIntent.filters.groupNames,
      minImportance: parsedIntent.filters.minImportance,
      sourceTypes: parsedIntent.filters.sourceTypes,
      blockTypes: ['evidence_list', 'timeline', 'media'],
    },
    { skipAnalysis: true },
  );

  const recalledItems = recallResult.items;
  return {
    parsedIntent,
    recalledItems,
    recallBlocks: recallResult.blocks,
    memoryContext: formatRecalledContext(recalledItems),
    intentContext: formatIntentContext(parsedIntent),
  };
}

function detectExplicitActionIntent(query: string): boolean {
  return /\b(create|update|modify|edit|submit|file|open)\b|创建|新建|修改|更新|提交|发起|创建一张|建一个/iu.test(
    query,
  );
}

function buildAskResolutionPolicy(query: string): EvidenceResolutionPolicy {
  const explicitActionIntent = detectExplicitActionIntent(query);
  return {
    scene: 'ask',
    userIntentMode: explicitActionIntent ? 'explicit_action' : 'informational',
    externalRead: 'auto',
    externalWrite: explicitActionIntent ? 'approval_required' : 'disabled',
    allowAskExternalUser: false,
    allowCreateConfirmRequest: true,
    syncExecutionBudgetMs: 15_000,
  };
}

function buildAskEvidenceItems(items: RecallItem[]) {
  return items.map((item) => ({
    sourceKind: item.type,
    sourceId: item.id,
    title: item.sourceTitle ?? item.source ?? item.type,
    url: item.sourceUrl,
    content: item.content,
    createdAt: item.timestamp,
    metadata: item.metadata,
  }));
}

function formatExternalEvidenceContext(
  externalEvidence: CandidateArtifact[],
): string {
  if (externalEvidence.length === 0) return '';
  return externalEvidence
    .map((artifact, index) => {
      const parts = [
        artifact.title ? `title=${artifact.title}` : undefined,
        artifact.url ? `url=${artifact.url}` : undefined,
        artifact.content ? `content=${artifact.content}` : undefined,
      ].filter(Boolean);
      return `- [${index + 1}] ${parts.join(' | ')}`;
    })
    .join('\n');
}

function normalizeArtifactArray(value: unknown): CandidateArtifact[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object',
    )
    .map((item) => ({
      kind: typeof item.kind === 'string' ? item.kind : 'note',
      title: typeof item.title === 'string' ? item.title : undefined,
      url: typeof item.url === 'string' ? item.url : undefined,
      content: typeof item.content === 'string' ? item.content : undefined,
      metadata:
        item.metadata &&
        typeof item.metadata === 'object' &&
        !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : undefined,
    }));
}

async function executeAskResolutionAction(
  db: Database.Database,
  userDataManager: UserDataManager | null | undefined,
  userId: string | undefined,
  requestId: string,
  query: string,
  plan: EvidenceResolutionPlan,
  reportStatus?: AskStatusReporter,
): Promise<{
  followUpActions: NonNullable<AskResponse['followUpActions']>;
  externalEvidence: CandidateArtifact[];
  finalResolutionState: EvidenceResolutionState;
  missingInfo: string[];
}> {
  if (plan.recommendedAction === 'none') {
    return {
      followUpActions: [],
      externalEvidence: [],
      finalResolutionState: plan.resolutionState,
      missingInfo: [...plan.remainingQuestions],
    };
  }

  if (reportStatus) {
    if (plan.recommendedAction === 'delegate_openclaw') {
      await reportStatus(
        plan.directFindings.length > 0
          ? '已提取本地结论，正在调用外部工具补充细节...'
          : '正在调用外部工具查证...',
      );
    } else if (plan.recommendedAction === 'create_confirm_request') {
      await reportStatus('本地信息不足，正在创建待确认事项...');
    } else if (plan.recommendedAction === 'ask_external_user') {
      await reportStatus('本地信息不足，正在准备外部询问...');
    }
  }

  const repo = new ActionRepository(db);
  const executor = new ActionExecutor(db, userDataManager ?? undefined, userId);
  const baseParams =
    plan.actionParams &&
    typeof plan.actionParams === 'object' &&
    !Array.isArray(plan.actionParams)
      ? { ...plan.actionParams }
      : {};
  if (
    plan.recommendedAction === 'create_confirm_request' &&
    typeof baseParams.sourceAnchor !== 'string'
  ) {
    baseParams.sourceAnchor = `ask:${requestId}`;
  }
  const delegatePolicy =
    plan.recommendedAction === 'delegate_openclaw'
      ? resolveDelegateOpenClawPolicy({
          params: baseParams,
          defaultExecutionMode: baseParams.mode === 'write' ? 'manual' : 'auto',
          defaultRequiresApproval: baseParams.mode === 'write',
        })
      : null;
  const action = repo.create({
    actionType: plan.recommendedAction,
    title:
      plan.recommendedAction === 'delegate_openclaw'
        ? `外部查证: ${query.slice(0, 60)}`
        : `跟进处理: ${query.slice(0, 60)}`,
    description: plan.summary,
    params: {
      ...baseParams,
      metadata: {
        ...(baseParams.metadata &&
        typeof baseParams.metadata === 'object' &&
        !Array.isArray(baseParams.metadata)
          ? (baseParams.metadata as Record<string, unknown>)
          : {}),
        askRequestId: requestId,
        suppressRecoveryNotifications: true,
      },
    },
    executionMode: delegatePolicy?.executionMode ?? 'auto',
    requiresApproval: delegatePolicy?.requiresApproval ?? false,
    queueStatus: 'queued',
    priority: plan.recommendedAction === 'create_confirm_request' ? 8 : 6,
    confidence: plan.confidence,
    sourceKind: 'ask_request',
    sourceRefId: requestId,
  });

  const shouldExecuteSync =
    action.executionMode === 'auto' &&
    (plan.recommendedAction === 'delegate_openclaw' ||
      plan.recommendedAction === 'create_confirm_request');
  if (!shouldExecuteSync) {
    return {
      followUpActions: [
        {
          id: action.id,
          actionType: action.actionType,
          title: action.title,
          queueStatus: action.queueStatus,
          executionMode: action.executionMode,
          sourceKind: action.sourceKind,
          sourceRefId: action.sourceRefId,
          result: action.result,
          lastError: action.lastError,
        },
      ],
      externalEvidence: [],
      finalResolutionState: plan.resolutionState,
      missingInfo: [...plan.remainingQuestions],
    };
  }

  const result = await executor.executeAction(action.id);
  const updatedPrimary = repo.getById(action.id);
  const followUpActionIds = Array.isArray(result.result?.followUpActionIds)
    ? result.result?.followUpActionIds.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
    : [];
  const actionRecords = [
    updatedPrimary,
    ...followUpActionIds.map((id) => repo.getById(id)),
  ].filter((item): item is NonNullable<typeof updatedPrimary> => Boolean(item));
  const followUpActions = actionRecords.map((item) => ({
    id: item.id,
    actionType: item.actionType,
    title: item.title,
    queueStatus: item.queueStatus,
    executionMode: item.executionMode,
    sourceKind: item.sourceKind,
    sourceRefId: item.sourceRefId,
    result: item.result,
    lastError: item.lastError,
  }));
  const externalEvidence = normalizeArtifactArray(result.result?.artifacts);
  const finalResolutionState: EvidenceResolutionState =
    externalEvidence.length > 0
      ? plan.directFindings.length > 0
        ? 'complete'
        : 'partial'
      : plan.resolutionState;
  const missingInfo =
    externalEvidence.length > 0 ? [] : [...plan.remainingQuestions];

  return {
    followUpActions,
    externalEvidence,
    finalResolutionState,
    missingInfo,
  };
}

async function prepareAskContext(
  db: Database.Database,
  userDataManager: UserDataManager | null | undefined,
  userId: string | undefined,
  requestId: string,
  query: string,
  userContext: string | undefined,
  includeEvidence: boolean | undefined,
  scope: RecallScope | undefined,
  reportStatus?: AskStatusReporter,
): Promise<PreparedAskContext> {
  await reportStatus?.('正在检索相关记忆...');
  const { recalledItems, recallBlocks, memoryContext, intentContext } =
    await recallForAsk(db, query, includeEvidence, scope);
  await reportStatus?.('正在分析已知信息...');
  const resolutionPlanner = new EvidenceResolutionPlanner();
  const initialPlan = await resolutionPlanner.resolve({
    question: query,
    context: userContext,
    evidence: buildAskEvidenceItems(recalledItems),
    policy: buildAskResolutionPolicy(query),
  });
  const actionOutcome = await executeAskResolutionAction(
    db,
    userDataManager,
    userId,
    requestId,
    query,
    initialPlan,
    reportStatus,
  );
  const externalContext = formatExternalEvidenceContext(
    actionOutcome.externalEvidence,
  );
  const combinedMemoryContext = externalContext
    ? `${memoryContext}\n\nExternal evidence:\n${externalContext}`
    : memoryContext;
  if (actionOutcome.externalEvidence.length > 0) {
    await reportStatus?.('已获取外部证据，正在整合上下文...');
  }
  const decisionEvidenceChain = new DecisionEvidenceChainService().build({
    query,
    recalledItems,
    externalEvidence: actionOutcome.externalEvidence,
  });
  const askBlocks: AskBlock[] = decisionEvidenceChain
    ? [...(recallBlocks ?? []), decisionEvidenceChain]
    : (recallBlocks ?? []);

  return {
    recalledItems,
    recallBlocks: askBlocks.length > 0 ? askBlocks : undefined,
    intentContext,
    combinedMemoryContext,
    actionOutcome,
  };
}

function writeSseEvent(
  reply: {
    raw: NodeJS.WritableStream & {
      writeHead?: Function;
      flushHeaders?: Function;
      end: Function;
    };
  },
  event: string,
  payload: Record<string, unknown>,
) {
  const enrichedPayload = {
    type: event,
    ...payload,
  };
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(enrichedPayload)}\n\n`);
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function askRoutes(app: FastifyInstance): Promise<void> {
  const config = getConfig();
  const llmClient = new LLMClient(config);

  app.post<{ Body: AskBody }>(
    '/ask',
    {
      schema: {
        body: askBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    content: { type: 'string' },
                    score: { type: 'number' },
                    source: { type: 'string' },
                    sourceUrl: { type: 'string' },
                    sourceTitle: { type: 'string' },
                    timestamp: { type: 'number' },
                    metadata: { type: 'object', additionalProperties: true },
                  },
                },
              },
              queryTimeMs: { type: 'number' },
              structuredAnswer: {
                type: 'object',
                nullable: true,
                properties: {
                  timeline: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        event: { type: 'string' },
                      },
                    },
                  },
                  keyFindings: { type: 'array', items: { type: 'string' } },
                  insights: { type: 'array', items: { type: 'string' } },
                  relatedEntities: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        relevance: { type: 'string' },
                      },
                    },
                  },
                  confidence: { type: 'number' },
                },
              },
              resolutionState: { type: 'string', nullable: true },
              missingInfo: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              followUpActions: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    actionType: { type: 'string' },
                    title: { type: 'string' },
                    queueStatus: { type: 'string' },
                    executionMode: { type: 'string' },
                    sourceKind: { type: 'string' },
                    sourceRefId: { type: 'string' },
                    result: { type: 'object', additionalProperties: true },
                    lastError: { type: 'string' },
                  },
                },
              },
              externalEvidence: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string' },
                    title: { type: 'string' },
                    url: { type: 'string' },
                    content: { type: 'string' },
                    metadata: { type: 'object', additionalProperties: true },
                  },
                },
              },
              blocks: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    type: { type: 'string' },
                    title: { type: 'string' },
                    payload: { type: 'object', additionalProperties: true },
                  },
                },
              },
              analysis: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
                properties: {
                  summary: { type: 'string' },
                  keyFindings: { type: 'array', items: { type: 'string' } },
                  insights: { type: 'array', items: { type: 'string' } },
                  rankingRationale: { type: 'string' },
                  openQuestions: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db, profileManager, userDataManager } = request.userContext;
      const startMs = Date.now();
      const {
        query,
        context: userContext,
        includeEvidence,
        scope,
      } = request.body;
      const requestId = randomUUID();

      try {
        const {
          recalledItems,
          recallBlocks,
          intentContext,
          combinedMemoryContext,
          actionOutcome,
        } = await prepareAskContext(
          db,
          userDataManager,
          request.userId,
          requestId,
          query,
          userContext,
          includeEvidence,
          scope,
        );
        const fullPrompt = buildPromptEnvelope(
          query,
          combinedMemoryContext,
          userContext,
          intentContext,
          'Return JSON only. Required key: "answer". Optional keys: "timeline", "keyFindings", "insights", "relatedEntities", "confidence". Do not wrap the JSON in prose.',
        );
        const systemPrompt = buildAugmentedSystemPrompt(
          db,
          profileManager,
          userDataManager,
          SYSTEM_PROMPT,
        );

        const llmResponse = await llmClient.generate(fullPrompt, {
          systemPrompt,
          temperature: 0.3,
          maxTokens: 1800,
        });

        // Step 4: Build the response
        const queryTimeMs = Date.now() - startMs;
        const parsedAnswer = parseStructuredAnswer(llmResponse.content);

        const response: AskResponse = {
          answer: parsedAnswer.answer,
          queryTimeMs,
          structuredAnswer: parsedAnswer.structuredAnswer,
          blocks: recallBlocks,
          analysis: structuredAnswerToAnalysis(parsedAnswer.structuredAnswer),
          resolutionState: actionOutcome.finalResolutionState,
          missingInfo: actionOutcome.missingInfo,
        };

        if (includeEvidence) {
          response.evidence = recalledItems;
        }
        if (actionOutcome.followUpActions.length > 0) {
          response.followUpActions = actionOutcome.followUpActions;
        }
        if (actionOutcome.externalEvidence.length > 0) {
          response.externalEvidence = actionOutcome.externalEvidence;
        }

        const usedItemIds = recalledItems.slice(0, 5).map((item) => item.id);
        const onlineReflection = new OnlineReflection(db, userDataManager);
        void onlineReflection.reflect({
          query,
          recalledItems,
          llmResponse: parsedAnswer.answer,
          usedItemIds,
        });

        return reply.status(200).send(response);
      } catch (err) {
        request.log.error(err, 'Ask endpoint failed');

        const queryTimeMs = Date.now() - startMs;
        return reply.status(500).send({
          answer:
            'Sorry, I was unable to process your question. Please try again later.',
          queryTimeMs,
          error: (err as Error).message,
        });
      }
    },
  );

  app.post<{ Body: AskBody }>(
    '/ask/stream',
    {
      schema: {
        body: askBodySchema,
      },
    },
    async (request, reply) => {
      const { db, profileManager, userDataManager } = request.userContext;
      const startMs = Date.now();
      const {
        query,
        context: userContext,
        includeEvidence,
        scope,
      } = request.body;
      const requestId = randomUUID();

      reply.hijack();
      reply.raw.writeHead?.(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      reply.raw.flushHeaders?.();

      try {
        writeSseEvent(reply, 'start', { requestId });

        const {
          recalledItems,
          recallBlocks,
          intentContext,
          combinedMemoryContext,
          actionOutcome,
        } = await prepareAskContext(
          db,
          userDataManager,
          request.userId,
          requestId,
          query,
          userContext,
          includeEvidence,
          scope,
          (message) => writeSseEvent(reply, 'status', { message }),
        );

        // Emit recall_done so the UI can render evidence/timeline/media blocks
        // immediately, in parallel with LLM token streaming.
        writeSseEvent(reply, 'recall_done', {
          itemsCount: recalledItems.length,
          blocks: recallBlocks ?? [],
          evidence: includeEvidence
            ? recalledItems
            : recalledItems.slice(0, 5).map((item) => ({
                id: item.id,
                type: item.type,
                displayTitle: item.displayTitle,
                previewText: item.previewText,
                exploreLink: item.exploreLink,
                sourceUrl: item.sourceUrl,
                sourceTitle: item.sourceTitle,
                score: item.score,
              })),
        });
        const answerSystemPrompt = buildAugmentedSystemPrompt(
          db,
          profileManager,
          userDataManager,
          STREAMING_SYSTEM_PROMPT,
        );
        const enrichmentSystemPrompt = buildAugmentedSystemPrompt(
          db,
          profileManager,
          userDataManager,
          SYSTEM_PROMPT,
        );
        const answerPrompt = buildPromptEnvelope(
          query,
          combinedMemoryContext,
          userContext,
          intentContext,
          'Answer the question in markdown only. Do not return JSON.',
        );
        writeSseEvent(reply, 'status', { message: '正在生成回答...' });

        let streamedAnswer = '';
        const answerResponse = await llmClient.generateStream(
          answerPrompt,
          {
            systemPrompt: answerSystemPrompt,
            temperature: 0.3,
            maxTokens: 1400,
          },
          async (delta) => {
            if (!delta) return;
            streamedAnswer += delta;
            writeSseEvent(reply, 'delta', { text: delta });
          },
        );

        const finalAnswer =
          (answerResponse.content || streamedAnswer).trim() ||
          streamedAnswer.trim();
        writeSseEvent(reply, 'answer_done', { answer: finalAnswer });

        let structuredAnswer: StructuredAskAnswer | undefined;
        try {
          writeSseEvent(reply, 'status', { message: '正在整理结构化要点...' });
          const enrichmentPrompt = buildPromptEnvelope(
            query,
            combinedMemoryContext,
            userContext,
            intentContext,
            [
              'Return JSON only.',
              'Required key: "answer".',
              'Set "answer" to the best final markdown answer for the question.',
              'Optional keys: "timeline", "keyFindings", "insights", "relatedEntities", "confidence".',
              `Existing answer draft:\n${finalAnswer}`,
            ].join('\n'),
          );
          const enrichmentResponse = await llmClient.generate(
            enrichmentPrompt,
            {
              systemPrompt: enrichmentSystemPrompt,
              temperature: 0.2,
              maxTokens: 1200,
            },
          );
          structuredAnswer = parseStructuredAnswer(
            enrichmentResponse.content,
          ).structuredAnswer;
        } catch (error) {
          request.log.warn(error, 'Ask stream enrichment failed');
        }

        const result: AskResponse = {
          answer: finalAnswer,
          queryTimeMs: Date.now() - startMs,
          structuredAnswer,
          blocks: recallBlocks,
          analysis: structuredAnswerToAnalysis(structuredAnswer),
          resolutionState: actionOutcome.finalResolutionState,
          missingInfo: actionOutcome.missingInfo,
        };
        if (includeEvidence) {
          result.evidence = recalledItems;
        }
        if (actionOutcome.followUpActions.length > 0) {
          result.followUpActions = actionOutcome.followUpActions;
        }
        if (actionOutcome.externalEvidence.length > 0) {
          result.externalEvidence = actionOutcome.externalEvidence;
        }

        writeSseEvent(
          reply,
          'result',
          result as unknown as Record<string, unknown>,
        );
        reply.raw.end();

        const usedItemIds = recalledItems.slice(0, 5).map((item) => item.id);
        const onlineReflection = new OnlineReflection(db, userDataManager);
        void onlineReflection.reflect({
          query,
          recalledItems,
          llmResponse: finalAnswer,
          usedItemIds,
        });
      } catch (err) {
        request.log.error(err, 'Ask stream endpoint failed');
        writeSseEvent(reply, 'error', {
          message: (err as Error).message || 'Unable to process the question.',
        });
        reply.raw.end();
      }
    },
  );
}
