import {
  BridgeMemoryServiceClient,
  BridgeMemoryServiceHttpError,
  type ExtractFromChatResponse,
} from '../memoryServiceClient.js';
import type { RawMessageRecord, SourceId } from './types.js';
import { RawMessageStore } from './cache/RawMessageStore.js';
import { toExplorerIngestSourceId } from './sourceIds.js';

interface ExplorerExtractorClient {
  extractFromChat(input: {
    source: string;
    scope: 'work' | 'personal';
    autoClassify?: boolean;
    segments: Array<{
      id: string;
      speaker: string;
      timestamp?: number;
      text: string;
    }>;
  }): Promise<ExtractFromChatResponse>;
}

function toUnixSeconds(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.floor(parsed / 1000);
}

function isNoMeaningfulSegmentsError(error: unknown): boolean {
  if (
    !(error instanceof BridgeMemoryServiceHttpError) ||
    error.status !== 400
  ) {
    return false;
  }

  const payloadMessage =
    error.payload &&
    typeof error.payload === 'object' &&
    'message' in error.payload &&
    typeof (error.payload as { message?: unknown }).message === 'string'
      ? (error.payload as { message: string }).message
      : '';

  return /No meaningful chat segments remained after cleaning/i.test(
    payloadMessage || error.message,
  );
}

function toArtifactKind(
  kind: string,
): 'fact' | 'preference' | 'event' | 'plan' {
  if (kind === 'preference' || kind === 'event' || kind === 'plan') {
    return kind;
  }
  return 'fact';
}

export class ExplorerExtractor {
  constructor(
    private readonly memoryClient: ExplorerExtractorClient,
    private readonly rawStore: RawMessageStore,
  ) {}

  async extractPendingMessages(options: {
    source: SourceId;
    defaultScope: 'work' | 'personal';
    autoClassify: boolean;
  }): Promise<{
    conversationCount: number;
    messageCount: number;
    skippedConversationCount: number;
  }> {
    const pendingMessages = this.rawStore.listPendingMessages({
      source: options.source,
    });
    if (pendingMessages.length === 0) {
      return {
        conversationCount: 0,
        messageCount: 0,
        skippedConversationCount: 0,
      };
    }

    const messagesByConversation = new Map<string, RawMessageRecord[]>();
    for (const message of pendingMessages) {
      const conversationMessages =
        messagesByConversation.get(message.conversationId) ?? [];
      conversationMessages.push(message);
      messagesByConversation.set(message.conversationId, conversationMessages);
    }

    let conversationCount = 0;
    let messageCount = 0;
    let skippedConversationCount = 0;

    for (const messages of messagesByConversation.values()) {
      const extractedAt = new Date().toISOString();
      try {
        const response = await this.memoryClient.extractFromChat({
          source: toExplorerIngestSourceId(options.source),
          scope: options.defaultScope,
          autoClassify: options.autoClassify,
          segments: messages.map((message) => ({
            id: message.messageId,
            speaker: message.role,
            timestamp: toUnixSeconds(message.ts),
            text: message.content,
          })),
        });
        this.persistConversationArtifacts(
          options.source,
          messages[0]!.conversationId,
          response,
          extractedAt,
        );
      } catch (error) {
        if (!isNoMeaningfulSegmentsError(error)) {
          throw error;
        }
        this.rawStore.replaceConversationArtifacts({
          source: options.source,
          conversationId: messages[0]!.conversationId,
          extractedAt,
          artifacts: [],
        });
        skippedConversationCount += 1;
      }

      this.rawStore.markExtracted(messages, extractedAt);
      conversationCount += 1;
      messageCount += messages.length;
    }

    return { conversationCount, messageCount, skippedConversationCount };
  }

  private persistConversationArtifacts(
    source: SourceId,
    conversationId: string,
    response: ExtractFromChatResponse,
    extractedAt: string,
  ): void {
    this.rawStore.replaceConversationArtifacts({
      source,
      conversationId,
      extractedAt,
      artifacts: response.artifacts.map((artifact) => ({
        kind: toArtifactKind(artifact.kind),
        text: artifact.text,
        sourceQuote: artifact.source_quote,
        conversationRef: artifact.conversation_ref,
      })),
    });
  }
}
