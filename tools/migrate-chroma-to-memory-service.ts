#!/usr/bin/env npx tsx
/**
 * ChromaDB -> Memory Service Migration Tool
 *
 * Reads data from ChromaDB HTTP API and writes to the new memory-service backend.
 *
 * Usage:
 *   npx tsx tools/migrate-chroma-to-memory-service.ts [options]
 *
 * Options:
 *   --chroma-host     ChromaDB host (default: localhost)
 *   --chroma-port     ChromaDB port (default: 8000)
 *   --memory-url      Memory service base URL (default: http://localhost:3210/api/v1)
 *   --user            Username / collection prefix (default: esone.qiu)
 *   --user-id         X-User-Id header for memory-service (default: same as --user)
 *   --batch-size      Batch size for ingest (default: 50)
 *   --phases          Comma-separated phases to run (default: all)
 *                     Available: scan,messages,entities,webpages,threads,profiles
 *   --dry-run         Scan only, don't write anything
 */

// ---------------------------------------------------------------------------
// Config & CLI parsing
// ---------------------------------------------------------------------------

interface Config {
  chromaHost: string;
  chromaPort: number;
  memoryUrl: string;
  username: string;
  userId: string;
  batchSize: number;
  phases: Set<string>;
  dryRun: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    chromaHost: '10.32.56.212',
    chromaPort: 8000,
    memoryUrl: 'http://localhost:3210/api/v1',
    username: 'esone.qiu',
    userId: '',
    batchSize: 50,
    phases: new Set(['scan', 'messages', 'entities', 'webpages', 'threads', 'profiles']),
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '--chroma-host': config.chromaHost = next; i++; break;
      case '--chroma-port': config.chromaPort = parseInt(next, 10); i++; break;
      case '--memory-url': config.memoryUrl = next; i++; break;
      case '--user': config.username = next; i++; break;
      case '--user-id': config.userId = next; i++; break;
      case '--batch-size': config.batchSize = parseInt(next, 10); i++; break;
      case '--phases': config.phases = new Set(next.split(',')); i++; break;
      case '--dry-run': config.dryRun = true; break;
      case '--help':
        console.log(`Usage: npx tsx tools/migrate-chroma-to-memory-service.ts [options]
Options:
  --chroma-host  HOST   ChromaDB host (default: localhost)
  --chroma-port  PORT   ChromaDB port (default: 8000)
  --memory-url   URL    Memory service URL (default: http://localhost:3210/api/v1)
  --user         NAME   Username/collection prefix (default: esone.qiu)
  --user-id      ID     X-User-Id for memory-service (default: same as --user)
  --batch-size   N      Batch size (default: 50)
  --phases       LIST   Comma-separated phases (default: all)
  --dry-run              Scan only, don't write
  --help                 Show this help`);
        process.exit(0);
    }
  }

  if (!config.userId) config.userId = config.username;
  return config;
}

// ---------------------------------------------------------------------------
// ChromaDB HTTP client (minimal, no npm dependency)
// ---------------------------------------------------------------------------

class ChromaHTTPClient {
  private baseUrl: string;
  private tenant: string;
  private database: string;

  constructor(host: string, port: number, tenant = 'default_tenant', database = 'default_database') {
    this.baseUrl = `http://${host}:${port}`;
    this.tenant = tenant;
    this.database = database;
  }

  private get v2Path(): string {
    return `${this.baseUrl}/api/v2/tenants/${this.tenant}/databases/${this.database}`;
  }

  async heartbeat(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v2/heartbeat`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<Array<{ name: string; id: string }>> {
    const res = await fetch(`${this.v2Path}/collections`);
    if (!res.ok) throw new Error(`Failed to list collections: ${res.status}`);
    const arr = await res.json();
    return arr.map((c: { name: string; id: string }) => ({ name: c.name, id: c.id }));
  }

  async getCollectionCount(collectionId: string): Promise<number> {
    const res = await fetch(`${this.v2Path}/collections/${collectionId}/count`);
    if (!res.ok) return 0;
    return res.json();
  }

  async getCollectionData(
    collectionId: string,
    offset: number,
    limit: number,
  ): Promise<{
    ids: string[];
    documents: (string | null)[];
    metadatas: (Record<string, any> | null)[];
  }> {
    const res = await fetch(`${this.v2Path}/collections/${collectionId}/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        include: ['documents', 'metadatas'],
        offset,
        limit,
      }),
    });
    if (!res.ok) throw new Error(`Failed to get collection data: ${res.status}`);
    return res.json();
  }
}

// ---------------------------------------------------------------------------
// Memory Service HTTP client (minimal)
// ---------------------------------------------------------------------------

class MemoryHTTPClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;
  }

  private async post<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: { 'X-User-Id': this.userId },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async ingestBatch(items: any[]): Promise<{
    totalCreated: number;
    totalDuplicate: number;
    totalError: number;
  }> {
    return this.post('/ingest/batch', { items });
  }

  async migrateEntities(items: any[]): Promise<{
    totalCreated: number;
    totalUpdated: number;
    totalError: number;
  }> {
    return this.post('/migrate/entities', { items });
  }

  async createProfileItem(body: {
    itemType: string;
    itemKey: string;
    itemValue: string;
    confidence?: number;
  }): Promise<any> {
    return this.post('/profile/items', body);
  }
}

// ---------------------------------------------------------------------------
// Progress logging
// ---------------------------------------------------------------------------

class Progress {
  private startTime: number;
  private phaseName = '';
  private phaseTotal = 0;
  private phaseDone = 0;

  constructor() {
    this.startTime = Date.now();
  }

  startPhase(name: string, total: number) {
    this.phaseName = name;
    this.phaseTotal = total;
    this.phaseDone = 0;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Phase: ${name} (${total} items)`);
    console.log('='.repeat(60));
  }

  advance(count: number, detail?: string) {
    this.phaseDone += count;
    const pct = this.phaseTotal > 0 ? Math.round((this.phaseDone / this.phaseTotal) * 100) : 100;
    const bar = '#'.repeat(Math.floor(pct / 2)).padEnd(50, '-');
    const msg = detail ? ` | ${detail}` : '';
    process.stdout.write(`\r  [${bar}] ${pct}% (${this.phaseDone}/${this.phaseTotal})${msg}  `);
  }

  endPhase(summary: string) {
    console.log(`\n  Done: ${summary}`);
  }

  elapsed(): string {
    const ms = Date.now() - this.startTime;
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }
}

// ---------------------------------------------------------------------------
// Collection info
// ---------------------------------------------------------------------------

interface CollectionInfo {
  id: string;
  name: string;
  count: number;
  type: 'messages' | 'entities' | 'webpages' | 'userprofiles' | 'threads' | 'other';
}

function classifyCollection(name: string, username: string): CollectionInfo['type'] {
  if (name === `${username}-messages`) return 'messages';
  if (name === `${username}-graph-entities`) return 'entities';
  if (name === `${username}-webpages`) return 'webpages';
  if (name === `${username}-userprofiles`) return 'userprofiles';
  if (name === `${username}-followed_thread_messages`) return 'threads';
  return 'other';
}

// ---------------------------------------------------------------------------
// Migration phases
// ---------------------------------------------------------------------------

async function scanPhase(
  chroma: ChromaHTTPClient,
  username: string,
): Promise<CollectionInfo[]> {
  console.log('\nScanning ChromaDB collections...');

  const collections = await chroma.listCollections();
  const results: CollectionInfo[] = [];

  for (const coll of collections) {
    const count = await chroma.getCollectionCount(coll.id);
    const type = classifyCollection(coll.name, username);
    results.push({ id: coll.id, name: coll.name, count, type });
  }

  console.log(`\nFound ${results.length} collections:`);
  for (const c of results) {
    const marker = c.type !== 'other' ? ` [${c.type}]` : '';
    console.log(`  ${c.name}: ${c.count} items${marker}`);
  }

  return results;
}

async function migrateMessages(
  chroma: ChromaHTTPClient,
  memory: MemoryHTTPClient,
  collection: CollectionInfo,
  batchSize: number,
  progress: Progress,
  sourceTag?: string,
): Promise<{ created: number; duplicate: number; error: number }> {
  const totals = { created: 0, duplicate: 0, error: 0 };
  progress.startPhase(sourceTag ? `Messages (${sourceTag})` : 'Messages', collection.count);

  for (let offset = 0; offset < collection.count; offset += batchSize) {
    const data = await chroma.getCollectionData(collection.id, offset, batchSize);

    const items = data.ids.map((id, i) => {
      const doc = data.documents[i] ?? '';
      const meta = data.metadatas[i] ?? {};

      // Parse datetime -- could be ISO string or epoch
      let timestamp: number | undefined;
      if (meta.datetime) {
        const parsed = typeof meta.datetime === 'number'
          ? meta.datetime
          : new Date(meta.datetime).getTime();
        if (!isNaN(parsed)) timestamp = parsed;
      }

      return {
        content: doc,
        sourceType: (meta.sourceType as string) ?? 'glip',
        sender: meta.sender as string | undefined,
        groupId: meta.groupId as string | undefined,
        groupName: meta.groupName as string | undefined,
        sourceUrl: meta.url as string | undefined,
        sourceTitle: meta.title as string | undefined,
        timestamp,
        skipExtraction: true,
        metadata: {
          chromaId: id,
          postId: meta.postId,
          summary: meta.summary,
          entities: meta.entities,
          ...(sourceTag ? { migrationSource: sourceTag } : {}),
        },
      };
    });

    try {
      const result = await memory.ingestBatch(items);
      totals.created += result.totalCreated;
      totals.duplicate += result.totalDuplicate;
      totals.error += result.totalError;
      progress.advance(
        items.length,
        `+${result.totalCreated} new, ${result.totalDuplicate} dup`,
      );
    } catch (err) {
      console.error(`\n  Batch error at offset ${offset}:`, (err as Error).message);
      totals.error += items.length;
      progress.advance(items.length, 'BATCH ERROR');
    }
  }

  progress.endPhase(`created=${totals.created}, duplicate=${totals.duplicate}, error=${totals.error}`);
  return totals;
}

async function migrateEntities(
  chroma: ChromaHTTPClient,
  memory: MemoryHTTPClient,
  collection: CollectionInfo,
  batchSize: number,
  progress: Progress,
): Promise<{ created: number; updated: number; error: number }> {
  const totals = { created: 0, updated: 0, error: 0 };
  progress.startPhase('Entities', collection.count);

  for (let offset = 0; offset < collection.count; offset += batchSize) {
    const data = await chroma.getCollectionData(collection.id, offset, batchSize);

    const items = data.ids.map((_id, i) => {
      const doc = data.documents[i] ?? '';
      const meta = data.metadatas[i] ?? {};

      // The old system stores MemoryEntity as JSON in metadata or document
      let entity: any = {};
      try {
        entity = JSON.parse(doc);
      } catch {
        // If document is not JSON, use metadata
        entity = meta;
      }

      // Build properties from entity.properties
      const properties: Record<string, string> = {};
      if (entity.properties && typeof entity.properties === 'object') {
        for (const [k, v] of Object.entries(entity.properties)) {
          if (v != null && typeof v !== 'object') {
            properties[k] = String(v);
          } else if (v != null) {
            properties[k] = JSON.stringify(v);
          }
        }
      }

      // Extract tags
      let tags: string[] = [];
      if (Array.isArray(entity.tags)) {
        tags = entity.tags;
      } else if (typeof meta.tags === 'string') {
        try { tags = JSON.parse(meta.tags); } catch { /* */ }
      }

      return {
        name: entity.name ?? meta.name ?? _id,
        type: entity.type ?? meta.type ?? 'Topic',
        description: entity.description ?? meta.description,
        importance: typeof entity.importance === 'number' ? entity.importance : 0.5,
        tags,
        aliases: [],
        status: entity.status ?? 'active',
        properties,
        firstSeen: entity.created ? Math.floor(entity.created / 1000) : undefined,
        lastSeen: entity.updated ? Math.floor(entity.updated / 1000) : undefined,
      };
    });

    try {
      const result = await memory.migrateEntities(items);
      totals.created += result.totalCreated;
      totals.updated += result.totalUpdated;
      totals.error += result.totalError;
      progress.advance(
        items.length,
        `+${result.totalCreated} new, ${result.totalUpdated} upd`,
      );
    } catch (err) {
      console.error(`\n  Batch error at offset ${offset}:`, (err as Error).message);
      totals.error += items.length;
      progress.advance(items.length, 'BATCH ERROR');
    }
  }

  progress.endPhase(`created=${totals.created}, updated=${totals.updated}, error=${totals.error}`);
  return totals;
}

async function migrateWebpages(
  chroma: ChromaHTTPClient,
  memory: MemoryHTTPClient,
  collection: CollectionInfo,
  batchSize: number,
  progress: Progress,
): Promise<{ created: number; duplicate: number; error: number }> {
  const totals = { created: 0, duplicate: 0, error: 0 };
  progress.startPhase('Webpages', collection.count);

  for (let offset = 0; offset < collection.count; offset += batchSize) {
    const data = await chroma.getCollectionData(collection.id, offset, batchSize);

    const items = data.ids.map((id, i) => {
      const doc = data.documents[i] ?? '';
      const meta = data.metadatas[i] ?? {};

      let timestamp: number | undefined;
      if (meta.datetime) {
        const parsed = typeof meta.datetime === 'number'
          ? meta.datetime
          : new Date(meta.datetime).getTime();
        if (!isNaN(parsed)) timestamp = parsed;
      }

      return {
        content: doc,
        sourceType: 'web' as const,
        sourceUrl: meta.url as string | undefined,
        sourceTitle: meta.title as string | undefined,
        timestamp,
        skipExtraction: true,
        metadata: {
          chromaId: id,
          domain: meta.domain,
          summary: meta.summary,
          migrationSource: 'webpages',
        },
      };
    });

    try {
      const result = await memory.ingestBatch(items);
      totals.created += result.totalCreated;
      totals.duplicate += result.totalDuplicate;
      totals.error += result.totalError;
      progress.advance(
        items.length,
        `+${result.totalCreated} new, ${result.totalDuplicate} dup`,
      );
    } catch (err) {
      console.error(`\n  Batch error at offset ${offset}:`, (err as Error).message);
      totals.error += items.length;
      progress.advance(items.length, 'BATCH ERROR');
    }
  }

  progress.endPhase(`created=${totals.created}, duplicate=${totals.duplicate}, error=${totals.error}`);
  return totals;
}

async function migrateProfiles(
  chroma: ChromaHTTPClient,
  memory: MemoryHTTPClient,
  collection: CollectionInfo,
  batchSize: number,
  progress: Progress,
): Promise<{ created: number; error: number }> {
  const totals = { created: 0, error: 0 };
  progress.startPhase('User Profiles', collection.count);

  for (let offset = 0; offset < collection.count; offset += batchSize) {
    const data = await chroma.getCollectionData(collection.id, offset, batchSize);

    for (let i = 0; i < data.ids.length; i++) {
      const doc = data.documents[i] ?? '';
      const meta = data.metadatas[i] ?? {};

      // Old profile records are observation-based. Convert to key-value items.
      // Try to parse structured data
      let record: any = {};
      try {
        record = JSON.parse(doc);
      } catch {
        record = { observation: doc };
      }

      // Map common profile fields to profile items
      const profileItems: Array<{ itemType: string; itemKey: string; itemValue: string }> = [];

      if (record.observation) {
        profileItems.push({
          itemType: 'fact',
          itemKey: meta.category ?? 'observation',
          itemValue: typeof record.observation === 'string'
            ? record.observation
            : JSON.stringify(record.observation),
        });
      }

      if (record.preference) {
        profileItems.push({
          itemType: 'preference',
          itemKey: record.preferenceKey ?? 'general',
          itemValue: String(record.preference),
        });
      }

      if (record.habit) {
        profileItems.push({
          itemType: 'habit',
          itemKey: record.habitKey ?? 'general',
          itemValue: String(record.habit),
        });
      }

      // If no structured fields found, store the whole document as a fact
      if (profileItems.length === 0 && doc.trim()) {
        profileItems.push({
          itemType: 'fact',
          itemKey: meta.category ?? meta.type ?? 'migrated_observation',
          itemValue: doc.slice(0, 2000),
        });
      }

      for (const item of profileItems) {
        try {
          await memory.createProfileItem({
            ...item,
            confidence: 0.7,
          });
          totals.created++;
        } catch (err) {
          // 409 = duplicate, treat as success
          if ((err as Error).message.includes('409')) {
            totals.created++;
          } else {
            totals.error++;
          }
        }
      }

      progress.advance(1);
    }
  }

  progress.endPhase(`created=${totals.created}, error=${totals.error}`);
  return totals;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();
  const progress = new Progress();

  console.log('ChromaDB -> Memory Service Migration Tool');
  console.log('-'.repeat(40));
  console.log(`ChromaDB:       ${config.chromaHost}:${config.chromaPort}`);
  console.log(`Memory Service: ${config.memoryUrl}`);
  console.log(`Username:       ${config.username}`);
  console.log(`User ID:        ${config.userId}`);
  console.log(`Batch size:     ${config.batchSize}`);
  console.log(`Phases:         ${[...config.phases].join(', ')}`);
  console.log(`Dry run:        ${config.dryRun}`);

  // Initialize clients
  const chroma = new ChromaHTTPClient(config.chromaHost, config.chromaPort);
  const memory = new MemoryHTTPClient(config.memoryUrl, config.userId);

  // Check connectivity
  console.log('\nChecking connections...');
  const chromaOk = await chroma.heartbeat();
  if (!chromaOk) {
    console.error('ERROR: Cannot connect to ChromaDB. Is it running?');
    process.exit(1);
  }
  console.log('  ChromaDB: OK');

  const memoryOk = await memory.healthCheck();
  if (!memoryOk) {
    console.error('ERROR: Cannot connect to memory-service. Is it running?');
    process.exit(1);
  }
  console.log('  Memory Service: OK');

  // Scan phase
  const collections = await scanPhase(chroma, config.username);

  if (config.dryRun || !config.phases.has('scan') && config.phases.size === 1) {
    console.log('\nDry run complete. No data was written.');
    process.exit(0);
  }

  // Find relevant collections
  const msgColl = collections.find(c => c.type === 'messages');
  const entColl = collections.find(c => c.type === 'entities');
  const webColl = collections.find(c => c.type === 'webpages');
  const threadColl = collections.find(c => c.type === 'threads');
  const profileColl = collections.find(c => c.type === 'userprofiles');

  const summary: Record<string, any> = {};

  // Messages phase
  if (config.phases.has('messages') && msgColl && msgColl.count > 0) {
    summary.messages = await migrateMessages(
      chroma, memory, msgColl, config.batchSize, progress,
    );
  }

  // Entities phase
  if (config.phases.has('entities') && entColl && entColl.count > 0) {
    summary.entities = await migrateEntities(
      chroma, memory, entColl, config.batchSize, progress,
    );
  }

  // Webpages phase
  if (config.phases.has('webpages') && webColl && webColl.count > 0) {
    summary.webpages = await migrateWebpages(
      chroma, memory, webColl, config.batchSize, progress,
    );
  }

  // Followed threads phase
  if (config.phases.has('threads') && threadColl && threadColl.count > 0) {
    summary.threads = await migrateMessages(
      chroma, memory, threadColl, config.batchSize, progress, 'followed_thread',
    );
  }

  // Profiles phase
  if (config.phases.has('profiles') && profileColl && profileColl.count > 0) {
    summary.profiles = await migrateProfiles(
      chroma, memory, profileColl, config.batchSize, progress,
    );
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migration Complete! (${progress.elapsed()})`);
  console.log('='.repeat(60));

  for (const [phase, stats] of Object.entries(summary)) {
    console.log(`\n  ${phase}:`);
    for (const [key, val] of Object.entries(stats as Record<string, number>)) {
      console.log(`    ${key}: ${val}`);
    }
  }

  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
