import type { ExplorerIngestSourceId, SourceId } from './types.js';

const INGEST_SOURCE_IDS: Record<SourceId, ExplorerIngestSourceId> = {
  doubao: 'doubao_chat',
  chatgpt: 'chatgpt',
};

export function toExplorerIngestSourceId(
  source: SourceId,
): ExplorerIngestSourceId {
  return INGEST_SOURCE_IDS[source];
}
