/**
 * Ask route — Natural language Q&A over the memory store.
 *
 * POST /ask - Combines recall + LLM generation to answer questions
 *             using the user's stored memories as context.
 */

import type { FastifyInstance } from 'fastify';

import type { RecallItem } from '../types/index.js';
import { RecallEngine } from '../core/RecallEngine.js';
import type { ProfileManager } from '../core/ProfileManager.js';
import { LLMClient } from '../llm/LLMClient.js';
import { getConfig } from '../config.js';
import type { UserDataManager } from '../storage/UserDataManager.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskBody {
  query: string;
  context?: string;
  includeEvidence?: boolean;
}

interface AskResponse {
  answer: string;
  evidence?: RecallItem[];
  queryTimeMs: number;
}

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
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a personal AI assistant with access to the user's memory. Answer based on the provided context. If the information is not in the context, say so honestly. Be concise and accurate.`;

/**
 * Load the USER_CORE.md file via the per-user UserDataManager.
 * Returns the file content, or an empty string if the file does not exist.
 */
function loadUserCore(userDataManager: UserDataManager): string {
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

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function askRoutes(
  app: FastifyInstance,
): Promise<void> {
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
                    timestamp: { type: 'number' },
                  },
                },
              },
              queryTimeMs: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db, profileManager, userDataManager } = request.userContext;
      const recallEngine = new RecallEngine(db);
      const startMs = Date.now();
      const { query, context: userContext, includeEvidence } = request.body;

      try {
        // Step 1: Recall relevant memories
        const recallResult = await recallEngine.recall({
          query,
          topK: 10,
          includeMetadata: false,
        });

        const recalledItems = recallResult.items;

        // Step 2: Build the LLM prompt with recalled context
        const memoryContext = formatRecalledContext(recalledItems);

        let fullPrompt = `Context:\n${memoryContext}`;

        if (userContext) {
          fullPrompt += `\n\nAdditional context from user:\n${userContext}`;
        }

        fullPrompt += `\n\nQuestion: ${query}`;

        // Step 3: Call the LLM (inject agent persona + USER_CORE.md into system prompt)
        let enhancedPrompt = SYSTEM_PROMPT;
        const agentPersona = loadAgentPersona(profileManager);
        if (agentPersona) enhancedPrompt += '\n\n' + agentPersona;
        const userCore = loadUserCore(userDataManager);
        if (userCore) enhancedPrompt += '\n\n--- User Context ---\n' + userCore;
        const systemPrompt = enhancedPrompt;

        const llmResponse = await llmClient.generate(fullPrompt, {
          systemPrompt,
          temperature: 0.3,
          maxTokens: 1500,
        });

        // Step 4: Build the response
        const queryTimeMs = Date.now() - startMs;

        const response: AskResponse = {
          answer: llmResponse.content,
          queryTimeMs,
        };

        if (includeEvidence) {
          response.evidence = recalledItems;
        }

        return reply.status(200).send(response);
      } catch (err) {
        request.log.error(err, 'Ask endpoint failed');

        const queryTimeMs = Date.now() - startMs;
        return reply.status(500).send({
          answer: 'Sorry, I was unable to process your question. Please try again later.',
          queryTimeMs,
          error: (err as Error).message,
        });
      }
    },
  );
}
