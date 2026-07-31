import { Database } from '../storage/Database.js';
import { MemoryChangeLedgerService } from '../core/MemoryChangeLedgerService.js';

interface CapsuleRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  status: string;
  metadata_json: string | null;
  saved_at: number | null;
  updated_at: number;
  content_preview: string | null;
  message_content: string | null;
}

interface BackfillOptions {
  dbPath: string;
  issueKey?: string;
  limit: number;
}

function parseOptions(argv: string[]): BackfillOptions {
  let dbPath = '';
  let issueKey: string | undefined;
  let limit = 100;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--db' && argv[index + 1]) {
      dbPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--issue' && argv[index + 1]) {
      issueKey = argv[index + 1].trim().toUpperCase();
      index += 1;
      continue;
    }
    if (arg === '--limit' && argv[index + 1]) {
      limit = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  if (!dbPath) throw new Error('Missing required --db <path>.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('--limit must be an integer between 1 and 1000.');
  }
  return { dbPath, issueKey, limit };
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function sourceObservedAt(row: CapsuleRow, metadata: Record<string, unknown>): number {
  const raw = metadata.sourceAsOf ?? metadata.observedAt;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  return row.saved_at ?? row.updated_at;
}

const options = parseOptions(process.argv.slice(2));
const db = new Database({ dbPath: options.dbPath });
db.migrate();
const ledger = new MemoryChangeLedgerService(db.raw);
const issueFilter = options.issueKey ? `%${options.issueKey}%` : '%';
const rows = db.raw
  .prepare(
    `SELECT c.id, c.source_kind, c.source_url, c.source_title, c.status,
            c.metadata_json, c.saved_at, c.updated_at, c.content_preview,
            m.content AS message_content
       FROM source_memory_capsules c
       LEFT JOIN messages_raw m ON m.id = c.message_id
      WHERE c.status IN ('saved', 'dismissed')
        AND (UPPER(c.source_title) LIKE ? OR UPPER(COALESCE(c.source_url, '')) LIKE ?)
      ORDER BY COALESCE(c.saved_at, c.updated_at) ASC, c.id ASC
      LIMIT ?`,
  )
  .all(issueFilter, issueFilter, options.limit) as CapsuleRow[];

let extractedEvents = 0;
let checked = 0;
for (const row of rows) {
  const metadata = parseMetadata(row.metadata_json);
  const receipt = ledger.syncSource({
    sourceRefType: 'source_memory',
    sourceRefId: row.id,
    sourceKind: row.source_kind,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url ?? undefined,
    text: row.message_content ?? row.content_preview ?? row.source_title,
    metadata,
    observedAt: sourceObservedAt(row, metadata),
    active: row.status === 'saved',
  });
  checked += 1;
  extractedEvents += receipt.extractedCount;
}

console.log(JSON.stringify({
  dbPath: options.dbPath,
  issueKey: options.issueKey ?? null,
  checked,
  extractedEvents,
}, null, 2));
