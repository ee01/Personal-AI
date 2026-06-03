import type { ExplorerIngestSourceId, SourceId } from './types.js';

export const EXPLORER_SOURCE_IDS: SourceId[] = [
  'doubao',
  'chatgpt',
  'codex_cli',
  'claude_code_cli',
  'cursor_agent_cli',
];

const INGEST_SOURCE_IDS: Record<SourceId, ExplorerIngestSourceId> = {
  doubao: 'doubao_chat',
  chatgpt: 'chatgpt',
  codex_cli: 'codex_cli',
  claude_code_cli: 'claude_code_cli',
  cursor_agent_cli: 'cursor_agent_cli',
};

export function toExplorerIngestSourceId(
  source: SourceId,
): ExplorerIngestSourceId {
  return INGEST_SOURCE_IDS[source];
}
