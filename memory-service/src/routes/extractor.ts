import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { getLLMClient } from '../llm/LLMClient.js';
import {
  SOURCE_TYPES,
  type IngestResult,
  type MemoryScope,
  type SourceType,
} from '../types/index.js';

interface ChatSegment {
  id?: string;
  speaker?: string;
  timestamp?: number;
  text: string;
}

interface ExtractFromChatBody {
  source: string;
  sourceType?: string;
  scope?: MemoryScope;
  autoClassify?: boolean;
  extractMode?: 'chat' | 'agent_session';
  conversationMeta?: Record<string, unknown>;
  segments: ChatSegment[];
}

interface ExtractedArtifact {
  kind: string;
  text: string;
  source_quote: string;
  conversation_ref: string;
}

interface ExtractFromChatResponse {
  artifacts: ExtractedArtifact[];
  ingestResults: IngestResult[];
  scopeUsed: MemoryScope;
  outcomeSignals?: ToolUsageOutcomeSignal[];
}

interface LLMExtractorArtifact {
  kind?: string;
  text?: string;
  source_quote?: string;
  conversation_ref?: string;
}

interface LLMExtractorResponse {
  artifacts?: LLMExtractorArtifact[];
  scope?: MemoryScope;
  scope_confidence?: number;
  outcome_signals?: ToolUsageOutcomeSignal[];
}

interface PreparedSegment {
  ref: string;
  speaker?: string;
  timestamp?: number;
  text: string;
}

interface ToolUsageOutcomeSignal {
  tool_key?: string;
  task_kind?: string;
  outcome?: string;
  produced_artifact?: boolean;
  verification_signal?: string;
  note?: string;
}

const DEFAULT_SCOPE: MemoryScope = 'work';
const AUTO_CLASSIFY_THRESHOLD = 0.65;
const SYSTEM_SOURCE_TYPE = 'system';
const AGENT_SESSION_MAX_SEGMENT_CHARS = 1800;

const extractFromChatBodySchema = {
  type: 'object' as const,
  required: ['source', 'segments'],
  properties: {
    source: { type: 'string' as const, minLength: 1 },
    sourceType: { type: 'string' as const, enum: SOURCE_TYPES },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal'],
    },
    autoClassify: { type: 'boolean' as const },
    extractMode: {
      type: 'string' as const,
      enum: ['chat', 'agent_session'],
    },
    conversationMeta: {
      type: 'object' as const,
      additionalProperties: true,
    },
    segments: {
      type: 'array' as const,
      minItems: 1,
      maxItems: 500,
      items: {
        type: 'object' as const,
        required: ['text'],
        properties: {
          id: { type: 'string' as const },
          speaker: { type: 'string' as const },
          timestamp: { type: 'number' as const },
          text: { type: 'string' as const, minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isObviousNoise(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  if (
    /^(sent from my iphone|message deleted|attachment omitted|image omitted|gif omitted|sticker omitted|typing\.\.\.)$/iu.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/^https?:\/\/\S+$/iu.test(normalized)) {
    return true;
  }
  if (/^[\p{P}\p{S}\s]+$/u.test(normalized)) {
    return true;
  }
  const signal = normalized.replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '');
  return signal.length < 2;
}

function prepareSegments(segments: ChatSegment[]): PreparedSegment[] {
  return segments
    .map((segment, index) => {
      const text = normalizeWhitespace(segment.text);
      const ref = segment.id?.trim() || `segment-${index + 1}`;
      return {
        ref,
        speaker: segment.speaker?.trim() || undefined,
        timestamp: segment.timestamp,
        text,
      };
    })
    .filter((segment) => !isObviousNoise(segment.text));
}

function prepareAgentSessionSegments(segments: ChatSegment[]): PreparedSegment[] {
  return segments
    .map((segment, index) => {
      const text = compactAgentSessionText(segment.text);
      const ref = segment.id?.trim() || `segment-${index + 1}`;
      return {
        ref,
        speaker: normalizeWhitespace(segment.speaker ?? '') || undefined,
        timestamp: segment.timestamp,
        text,
      };
    })
    .filter((segment) => !isObviousNoise(segment.text));
}

function compactAgentSessionText(text: string): string {
  const withoutCodeFences = text.replace(/```[\s\S]*?```/g, '[code omitted]');
  const lines = withoutCodeFences
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      if (!line.trim()) return false;
      if (/^([+-]{3}|@@|diff --git|index [a-f0-9]+\.\.)/.test(line)) {
        return false;
      }
      if (/^[+-]\s/.test(line) && line.length > 12) return false;
      if (/^(npm|pnpm|yarn|uv|cargo|go|python|node)\s+/.test(line)) {
        return true;
      }
      if (/^[│┃┆╭╰├└]/.test(line)) return false;
      return true;
    });
  const compacted = normalizeWhitespace(lines.join(' '));
  return compacted.length > AGENT_SESSION_MAX_SEGMENT_CHARS
    ? `${compacted.slice(0, AGENT_SESSION_MAX_SEGMENT_CHARS).trimEnd()}...`
    : compacted;
}

function buildTranscript(segments: PreparedSegment[]): string {
  return segments
    .map((segment) => {
      const parts = [segment.ref];
      if (segment.speaker) {
        parts.push(segment.speaker);
      }
      if (segment.timestamp != null) {
        parts.push(new Date(segment.timestamp * 1000).toISOString());
      }
      return `${parts.join(' | ')} | ${segment.text}`;
    })
    .join('\n');
}

function pickConversationTimestamp(
  segments: PreparedSegment[],
): number | undefined {
  const stamped = segments
    .map((segment) => segment.timestamp)
    .filter((timestamp): timestamp is number => typeof timestamp === 'number');
  return stamped.length > 0 ? Math.max(...stamped) : undefined;
}

function normalizeArtifacts(
  rawArtifacts: LLMExtractorArtifact[] | undefined,
  segments: PreparedSegment[],
): ExtractedArtifact[] {
  if (!Array.isArray(rawArtifacts) || rawArtifacts.length === 0) {
    return [];
  }

  const segmentByRef = new Map(
    segments.map((segment) => [segment.ref, segment]),
  );
  const seen = new Set<string>();
  const normalized: ExtractedArtifact[] = [];

  for (const rawArtifact of rawArtifacts) {
    const kind = normalizeWhitespace(rawArtifact.kind ?? '');
    const text = normalizeWhitespace(rawArtifact.text ?? '');
    if (!kind || !text) continue;

    const requestedRef = normalizeWhitespace(
      rawArtifact.conversation_ref ?? '',
    );
    const referencedSegment = requestedRef
      ? segmentByRef.get(requestedRef)
      : undefined;
    const fallbackSegment =
      referencedSegment ??
      segments.find((segment) => {
        const quote = normalizeWhitespace(rawArtifact.source_quote ?? '');
        return quote.length > 0 && segment.text.includes(quote);
      }) ??
      segments[0];

    if (!fallbackSegment) continue;

    const providedQuote = normalizeWhitespace(rawArtifact.source_quote ?? '');
    const sourceQuote =
      providedQuote && fallbackSegment.text.includes(providedQuote)
        ? providedQuote
        : fallbackSegment.text;

    const artifact: ExtractedArtifact = {
      kind,
      text,
      source_quote: sourceQuote,
      conversation_ref: fallbackSegment.ref,
    };

    const dedupeKey = `${artifact.kind}::${artifact.text}::${artifact.conversation_ref}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(artifact);
  }

  return normalized;
}

function resolveScope(
  requestedScope: MemoryScope,
  autoClassify: boolean,
  llmResult: LLMExtractorResponse,
): MemoryScope {
  if (!autoClassify) {
    return requestedScope;
  }

  if (
    llmResult.scope &&
    llmResult.scope_confidence != null &&
    llmResult.scope_confidence >= AUTO_CLASSIFY_THRESHOLD
  ) {
    return llmResult.scope;
  }

  return requestedScope;
}

function buildExtractionPrompt(
  source: string,
  requestedScope: MemoryScope,
  autoClassify: boolean,
  transcript: string,
): string {
  return `You extract durable memory artifacts from a chat transcript.

Source: ${source}
Requested scope fallback: ${requestedScope}
Auto classify scope: ${autoClassify ? 'yes' : 'no'}

Chat transcript:
${transcript}

Return JSON only with this shape:
{
  "scope": "work" | "personal",
  "scope_confidence": 0.0,
  "artifacts": [
    {
      "kind": "decision|task|fact|preference|note",
      "text": "clean memory statement",
      "source_quote": "exact quote copied from one transcript line",
      "conversation_ref": "segment reference like segment-2"
    }
  ]
}

Rules:
- Extract only durable facts, decisions, tasks, preferences, or other memory-worthy notes.
- Ignore greetings, acknowledgements, transport noise, and filler.
- source_quote must be copied exactly from one transcript line.
- conversation_ref must match the segment reference for that quote.
- Keep artifact text concise and declarative.
- If scope is uncertain, still return your best guess and lower scope_confidence.
- Return an empty artifacts array when nothing should be remembered.`;
}

function buildAgentSessionExtractionPrompt(
  source: string,
  sourceType: string,
  requestedScope: MemoryScope,
  autoClassify: boolean,
  transcript: string,
  conversationMeta?: Record<string, unknown>,
): string {
  const meta = conversationMeta
    ? JSON.stringify(conversationMeta).slice(0, 1200)
    : '{}';
  return `You extract compact durable memory from a coding-agent session.

Source: ${source}
Source type: ${sourceType}
Requested scope fallback: ${requestedScope}
Auto classify scope: ${autoClassify ? 'yes' : 'no'}
Conversation metadata: ${meta}

Agent transcript, already pre-filtered to remove most code/diff noise:
${transcript}

Return JSON only with this shape:
{
  "scope": "work" | "personal",
  "scope_confidence": 0.0,
  "artifacts": [
    {
      "kind": "intent|result|failure|decision|next_step|fact|preference",
      "text": "concise statement focused on what the user wanted, what the agent did, what changed, what failed, or what should happen next",
      "source_quote": "exact quote copied from one transcript line",
      "conversation_ref": "segment reference like segment-2"
    }
  ],
  "outcome_signals": [
    {
      "tool_key": "codex_cli|claude_code_cli|cursor_agent_cli|unknown",
      "task_kind": "repo_bugfix|code_review|ui_demo|source_research|unknown",
      "outcome": "produced_artifact|failed|blocked|needs_review|unknown",
      "produced_artifact": true,
      "verification_signal": "tests passed|diff produced|not mentioned",
      "note": "short reason"
    }
  ]
}

Rules:
- Extract the user's intent and the agent's result before implementation details.
- Keep code, stack traces, diffs, terminal output, and file contents out of artifact text unless the exact file name or command result is the memory.
- Prefer statements like "Codex produced a patch for X and tests Y passed" over raw implementation.
- Capture blockers such as missing permissions, missing repo, quota, login state, failed tests, or incomplete context.
- source_quote must be copied exactly from one transcript line.
- Return an empty artifacts array when the session has no durable value.`;
}

function normalizeOutcomeSignals(
  signals: ToolUsageOutcomeSignal[] | undefined,
): ToolUsageOutcomeSignal[] {
  if (!Array.isArray(signals)) return [];
  return signals
    .map((signal) => ({
      tool_key: normalizeWhitespace(signal.tool_key ?? ''),
      task_kind: normalizeWhitespace(signal.task_kind ?? ''),
      outcome: normalizeWhitespace(signal.outcome ?? ''),
      produced_artifact:
        typeof signal.produced_artifact === 'boolean'
          ? signal.produced_artifact
          : undefined,
      verification_signal: normalizeWhitespace(signal.verification_signal ?? ''),
      note: normalizeWhitespace(signal.note ?? ''),
    }))
    .filter(
      (signal) =>
        signal.tool_key ||
        signal.task_kind ||
        signal.outcome ||
        signal.verification_signal ||
        signal.note,
    )
    .slice(0, 8);
}

function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

function scoreExtractedArtifactImportance(kind: string): number {
  switch (normalizeWhitespace(kind).toLowerCase()) {
    case 'decision':
    case 'task':
    case 'next_step':
    case 'result':
    case 'failure':
      return 0.78;
    case 'fact':
    case 'preference':
      return 0.7;
    case 'intent':
    case 'note':
      return 0.58;
    default:
      return 0.55;
  }
}

export async function extractorRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ExtractFromChatBody }>(
    '/extractor/from-chat',
    {
      schema: {
        body: extractFromChatBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              artifacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string' },
                    text: { type: 'string' },
                    source_quote: { type: 'string' },
                    conversation_ref: { type: 'string' },
                  },
                  required: [
                    'kind',
                    'text',
                    'source_quote',
                    'conversation_ref',
                  ],
                },
              },
              ingestResults: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['created', 'duplicate', 'error'],
                    },
                    entitiesExtracted: { type: 'number' },
                    matchedProjects: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    decision: {
                      type: 'object',
                      additionalProperties: true,
                    },
                  },
                  required: ['id', 'status'],
                },
              },
              scopeUsed: {
                type: 'string',
                enum: ['work', 'personal'],
              },
              outcomeSignals: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
            required: ['artifacts', 'ingestResults', 'scopeUsed'],
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: ExtractFromChatBody }>,
      reply: FastifyReply,
    ) => {
      const { db, userDataManager } = request.userContext;
      const pipeline = new IngestionPipeline(
        db,
        userDataManager,
        request.userId,
      );
      const requestedScope = request.body.scope ?? DEFAULT_SCOPE;
      const source = request.body.source.trim();
      const extractMode = request.body.extractMode ?? 'chat';
      const rawSourceType =
        normalizeWhitespace(request.body.sourceType ?? '') ||
        SYSTEM_SOURCE_TYPE;
      if (!isSourceType(rawSourceType)) {
        return reply.status(400).send({
          message: `Unsupported sourceType: ${rawSourceType}`,
        });
      }
      const sourceType = rawSourceType;
      const preparedSegments =
        extractMode === 'agent_session'
          ? prepareAgentSessionSegments(request.body.segments)
          : prepareSegments(request.body.segments);

      if (preparedSegments.length === 0) {
        return reply.status(400).send({
          message: 'No meaningful chat segments remained after cleaning.',
        });
      }

      const llm = getLLMClient();
      const transcript = buildTranscript(preparedSegments);
      const llmResult = await llm.generateJSON<LLMExtractorResponse>(
        extractMode === 'agent_session'
          ? buildAgentSessionExtractionPrompt(
              source,
              sourceType,
              requestedScope,
              request.body.autoClassify === true,
              transcript,
              request.body.conversationMeta,
            )
          : buildExtractionPrompt(
              source,
              requestedScope,
              request.body.autoClassify === true,
              transcript,
            ),
        {
          temperature: 0.1,
          maxTokens: extractMode === 'agent_session' ? 2200 : 1800,
          systemPrompt:
            'You are a careful memory extractor. Return only valid JSON.',
        },
      );

      const artifacts = normalizeArtifacts(
        llmResult.artifacts,
        preparedSegments,
      );
      const scopeUsed = resolveScope(
        requestedScope,
        request.body.autoClassify === true,
        llmResult,
      );
      const timestamp = pickConversationTimestamp(preparedSegments);
      const ingestResults: IngestResult[] = [];
      const outcomeSignals = normalizeOutcomeSignals(
        llmResult.outcome_signals,
      );

      for (const artifact of artifacts) {
        const result = await pipeline.ingest({
          content: artifact.text,
          sourceType,
          source,
          scope: scopeUsed,
          timestamp,
          skipExtraction: true,
          metadata: {
            extractor: 'from-chat',
            extractMode,
            kind: artifact.kind,
            indexExtractedArtifact: true,
            importance: scoreExtractedArtifactImportance(artifact.kind),
            summary: artifact.text,
            sourceQuote: artifact.source_quote,
            conversationRef: artifact.conversation_ref,
            originalSegmentCount: preparedSegments.length,
            conversationMeta: request.body.conversationMeta,
            toolFitSignals: outcomeSignals,
          },
        });
        ingestResults.push(result);
      }

      const response: ExtractFromChatResponse = {
        artifacts,
        ingestResults,
        scopeUsed,
        outcomeSignals,
      };

      return reply.status(200).send(response);
    },
  );
}
