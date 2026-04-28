import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { getLLMClient } from '../llm/LLMClient.js';
import type { IngestResult, MemoryScope } from '../types/index.js';

interface ChatSegment {
  id?: string;
  speaker?: string;
  timestamp?: number;
  text: string;
}

interface ExtractFromChatBody {
  source: string;
  scope?: MemoryScope;
  autoClassify?: boolean;
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
}

interface PreparedSegment {
  ref: string;
  speaker?: string;
  timestamp?: number;
  text: string;
}

const DEFAULT_SCOPE: MemoryScope = 'work';
const AUTO_CLASSIFY_THRESHOLD = 0.65;
const SYSTEM_SOURCE_TYPE = 'system';

const extractFromChatBodySchema = {
  type: 'object' as const,
  required: ['source', 'segments'],
  properties: {
    source: { type: 'string' as const, minLength: 1 },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal'],
    },
    autoClassify: { type: 'boolean' as const },
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
                  },
                  required: ['id', 'status'],
                },
              },
              scopeUsed: {
                type: 'string',
                enum: ['work', 'personal'],
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
      const preparedSegments = prepareSegments(request.body.segments);

      if (preparedSegments.length === 0) {
        return reply.status(400).send({
          message: 'No meaningful chat segments remained after cleaning.',
        });
      }

      const llm = getLLMClient();
      const llmResult = await llm.generateJSON<LLMExtractorResponse>(
        buildExtractionPrompt(
          source,
          requestedScope,
          request.body.autoClassify === true,
          buildTranscript(preparedSegments),
        ),
        {
          temperature: 0.1,
          maxTokens: 1800,
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

      for (const artifact of artifacts) {
        const result = await pipeline.ingest({
          content: artifact.text,
          sourceType: SYSTEM_SOURCE_TYPE,
          source,
          scope: scopeUsed,
          timestamp,
          skipExtraction: true,
          metadata: {
            extractor: 'from-chat',
            kind: artifact.kind,
            sourceQuote: artifact.source_quote,
            conversationRef: artifact.conversation_ref,
            originalSegmentCount: preparedSegments.length,
          },
        });
        ingestResults.push(result);
      }

      const response: ExtractFromChatResponse = {
        artifacts,
        ingestResults,
        scopeUsed,
      };

      return reply.status(200).send(response);
    },
  );
}
