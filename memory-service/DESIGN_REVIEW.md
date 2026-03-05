# Memory System Overhaul -- Design Review

**Reviewer**: TEST & CODE REVIEW Agent
**Date**: 2026-02-24
**Plan file**: `.cursor/plans/memory_system_overhaul_166717d9.plan.md`
**Scaffold status**: Phase 1 partially scaffolded (`memory-service/` exists with Database.ts, config.ts, types, migration SQL)

---

## 1. Executive Summary

The plan is ambitious, well-structured, and technically detailed. It defines a clear dual-loop architecture (reactive + proactive), a thorough SQLite schema with bitemporal properties, and a 7-phase rollout spanning approximately 13 weeks. The existing scaffold (`Database.ts`, `001_initial.sql`, type definitions) already aligns with the plan.

**Strengths**:
- Comprehensive schema design with proper indexes, FTS5, and sqlite-vec integration.
- The bitemporal entity_properties table is a solid approach for truth maintenance.
- Clear separation of concerns: IngestionPipeline, RecallEngine, TruthMaintainer, etc.
- The plan correctly identifies that the Extension should become "thin" while the Service becomes "thick."
- Embedding model choice (all-MiniLM-L6-v2, 384 dimensions) matches the current Extension's offscreen model, which greatly simplifies migration.

**Weaknesses**:
- No migration strategy for existing ChromaDB data (4 collections, ~4500+ lines of CloudStorage.ts logic).
- Authentication is mentioned only as a single `API_KEY` env var -- insufficient for a multi-user system.
- No analysis of better-sqlite3 synchronous blocking impact on Fastify's event loop.
- Embedding model cold-start time and memory footprint not addressed.
- No error recovery strategy for crash mid-ingestion or mid-consolidation.
- No rate limiting or abuse prevention on API endpoints.
- No monitoring, logging, or observability plan.

**Overall assessment**: The plan is 75% complete. It excels at the "what" but under-specifies the "how" for operational concerns. The gaps identified below must be addressed before Phase 1 is considered done.

---

## 2. Gap Analysis

### GAP-1: Data Migration from ChromaDB to SQLite (Critical)

**Severity**: Critical

**Description**: The current system stores data in 7 ChromaDB collections (`messages`, `webpages`, `projects`, `documents`, `graph-entities`, `userprofiles`, `followed_thread_messages`), each namespaced per user (`{username}-{collection}`). The plan makes no mention of how existing data will be migrated. CloudStorage.ts alone is 4514 lines with complex entity types (`MemoryEntity` with deeply nested `relatedData`, `statistic`, `readStatus` fields). Losing this data means users lose their entire memory history.

**Recommendation**: See Section 3 (Migration Strategy) below for a complete plan. Add a `phase0-migration` task before Phase 1 or as a parallel workstream.

---

### GAP-2: Authentication Mechanism (High)

**Severity**: High

**Description**: The config has a single `apiKey` field. The plan references per-user data isolation (`data/{userId}/`) but does not specify how the service authenticates requests or maps them to user IDs. The Extension currently runs in a single-user context (the Chrome profile owner), but the Service API is exposed as HTTP.

**Current state in scaffold**: `config.ts` line 74: `apiKey: process.env.API_KEY || ''` -- defaults to empty string (no auth).

**Recommendation**:
1. For Phase 1 (single-user local deployment): Implement a simple Bearer token check middleware. Reject requests when `API_KEY` is empty.
2. For multi-user: Add a `X-User-Id` header that the Extension sends, validated against the token. Store the user-to-token mapping in a `users` table or use JWT.
3. Add Fastify `onRequest` hook that extracts userId and attaches it to the request context.

```typescript
// Suggested: src/middleware/auth.ts
fastify.addHook('onRequest', async (request, reply) => {
  const token = request.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== config.apiKey) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  // For single-user, userId can be derived from config or a default
  request.userId = request.headers['x-user-id'] || 'default';
});
```

---

### GAP-3: better-sqlite3 Synchronous Blocking on Fastify Event Loop (Medium)

**Severity**: Medium

**Description**: `better-sqlite3` is synchronous. Every `db.prepare().run()` or `db.prepare().all()` blocks the Node.js event loop. The existing `Database.ts` exposes only synchronous methods (`run`, `get`, `all`). While this is fine for small queries, the consolidation engine runs complex queries (full table scans of `memory_metadata` with `EXP()` calculations, chunk re-indexing) that could block for hundreds of milliseconds.

Key concern areas:
- `runForgettingCycle()` scans the entire `memory_metadata` table.
- `rebuildChunkIndex()` deletes + re-inserts all chunks for changed files with embeddings.
- `multiChannelRecall()` runs 4 parallel queries but they serialize at the SQLite level.

**Recommendation**:
1. Move heavy batch operations (consolidation, forgetting, chunk re-indexing) to a worker thread using `worker_threads`. better-sqlite3 supports being opened in a worker.
2. For the API-facing queries (`/recall`, `/ingest`), keep them on the main thread but add monitoring for query duration. Log a warning if any query exceeds 50ms.
3. Use prepared statements aggressively (the current `Database.ts` creates new statements on every call).

```typescript
// Suggested: prepared statement cache
private stmtCache = new Map<string, Statement>();

preparedRun(sql: string, ...params: unknown[]): RunResult {
  let stmt = this.stmtCache.get(sql);
  if (!stmt) {
    stmt = this.db.prepare(sql);
    this.stmtCache.set(sql, stmt);
  }
  return stmt.run(...params);
}
```

---

### GAP-4: Embedding Model Memory Footprint (Medium)

**Severity**: Medium

**Description**: The plan uses `@xenova/transformers` with `Xenova/all-MiniLM-L6-v2` (same as the current Extension's offscreen document). In the Extension, this runs in a Chrome offscreen document with its own process. In the Memory Service, it runs in the main Node.js process. The ONNX model typically consumes ~200-500MB of RAM. Combined with SQLite caches and Node.js overhead, the service could require 1-2GB of RAM.

The current Extension's `offscreen.ts` shows the model loading pattern (lines 7-17): lazy load on first use with no preload.

**Recommendation**:
1. Document the minimum system requirements: 2GB RAM recommended.
2. Implement lazy loading with timeout: load the model on first `/ingest` or `/recall` request. Show `degraded` status in `/health` while loading.
3. Add a `PRELOAD_EMBEDDING_MODEL=true|false` config option for environments where cold-start latency is acceptable vs. not.
4. Consider adding an `embeddingProvider: 'api'` path that uses OpenAI's `text-embedding-3-small` as a fallback for memory-constrained environments. The config already has `embeddingProvider` and `embeddingDimension` fields, but the dimension mismatch (384 vs 1536) requires the `vec0` table to be rebuilt.
5. If switching embedding models, all existing vectors must be recomputed. This must be a documented, explicit operation.

---

### GAP-5: Error Recovery / Crash Resilience (Medium)

**Severity**: Medium

**Description**: The plan describes complex multi-step workflows (IngestionPipeline: parse -> score -> store -> embed -> index -> truth-check -> markdown-write) but no error handling or recovery strategy. If the process crashes mid-ingestion:
- A message might be in `messages_raw` but not in `messages_vec` (missing embedding).
- A chunk might be in `chunks` but not in `chunks_vec`.
- Daily consolidation could leave `daily/{date}.md` in a partial state.

**Recommendation**:
1. Wrap multi-step ingestion in a SQLite transaction. Only commit after all DB writes succeed. Markdown writes should happen after the transaction commits (they are idempotent via overwrite).
2. Add a `processing_state` column to `messages_raw`: `pending` -> `indexed` -> `embedded`. On startup, re-process any messages stuck in `pending` or `indexed` state.
3. For consolidation: write output to a temp file first, then atomically rename. This prevents partial markdown files.
4. Add a startup self-check routine that verifies index consistency: count of `messages_raw` rows with embeddings vs. count of `messages_vec` rows.
5. SQLite WAL mode (already enabled in `Database.ts` line 46) provides crash safety for DB operations but not for the markdown filesystem.

---

### GAP-6: Rate Limiting for API Endpoints (Low)

**Severity**: Low

**Description**: No rate limiting is specified. While the service is designed for a single user, the `/ingest/batch` endpoint could receive large payloads. The `/ask` endpoint triggers LLM calls that cost money. The heartbeat loop also generates LLM calls.

**Recommendation**:
1. Add `@fastify/rate-limit` with sensible defaults (e.g., 100 requests/minute for ingest, 20/minute for ask).
2. Add request body size limits in Fastify config (default 1MB should be sufficient).
3. Track LLM token usage per day. Add a `daily_llm_token_budget` config with a default (e.g., 100k tokens/day). Log warnings at 80% usage.

---

### GAP-7: Monitoring and Observability (Low)

**Severity**: Low

**Description**: The plan mentions a `/health` and `/stats` endpoint but no structured logging, metrics collection, or alerting.

**Recommendation**:
1. Use Fastify's built-in `pino` logger with structured JSON output.
2. Log key events: ingestion count, recall latency, consolidation duration, LLM call count/cost, embedding generation time.
3. The `/stats` endpoint should return: message count, entity count, chunk count, embedding cache hit rate, last consolidation time, memory usage (`process.memoryUsage()`), uptime.
4. Consider adding a simple metrics endpoint compatible with Prometheus (optional, Phase 7).

---

## 3. Migration Strategy: ChromaDB to SQLite

### 3.1 Collection Mapping

| ChromaDB Collection              | New SQLite Table(s)                         | Notes                                            |
|----------------------------------|---------------------------------------------|--------------------------------------------------|
| `{user}-messages`                | `messages_raw` + `messages_vec`              | Map `metadata.timestamp` to `timestamp`          |
| `{user}-webpages`                | `messages_raw` (source_type='web')           | Webpages become messages with `source_type='web'` |
| `{user}-graph-entities`          | `entities` + `entity_properties` + `relationships` | Decompose `MemoryEntity.properties` into rows   |
| `{user}-userprofiles`            | New `user_profiles` table or `entities` with type='UserProfile' | Decide: keep separate or merge |
| `{user}-projects`                | `watched_projects` + `entities`              | Map highlighted projects to watched_projects     |
| `{user}-documents`               | `messages_raw` (source_type='document')      | Or a new `documents` table                       |
| `{user}-followed_thread_messages`| `messages_raw` with metadata tag             | Add `is_followed_thread` flag or metadata        |

### 3.2 Entity Format Conversion

The current `MemoryEntity` (CloudStorage.ts lines 13-153) is a deeply nested object stored as a single ChromaDB document. The new schema decomposes it:

```
MemoryEntity
  -> entities (id, type, name, description, importance, ...)
  -> entity_properties (one row per key-value in MemoryEntity.properties)
  -> relationships (derived from MemoryEntity.relatedData.cooccurringEntities)
  -> messages_raw (MemoryEntity.relatedData.conversations -> individual messages)
  -> memory_metadata (importance, accessCount, lastAccessed -> salience tracking)
```

Key conversions:
- `MemoryEntity.properties` (Record<string, any>) -> iterate keys, insert into `entity_properties` with `action_type='set'`, `tx_start=migrationTimestamp`, `confidence=1.0`, `source_authority='system'`
- `MemoryEntity.statistic` -> computed views, not stored (derive from JOIN counts)
- `MemoryEntity.relatedData.conversations` -> if not already in `messages_raw`, insert them
- `MemoryEntity.relatedData.people/projects/topics` -> `relationships` table entries
- `MemoryEntity.readStatus` -> store in entity metadata or a dedicated field
- `MemoryEntity.hotness`, `criticalityScore` -> `memory_metadata.salience_score`

### 3.3 Embedding Re-computation Strategy

**Good news**: Both the current Extension (`offscreen.ts` line 11) and the new Service (`config.ts` line 70) use `Xenova/all-MiniLM-L6-v2` with 384 dimensions. This means:

1. **Existing ChromaDB embeddings can be directly exported and imported** into `messages_vec` and `chunks_vec` without re-computation, provided the ChromaDB API returns stored embeddings.
2. If ChromaDB does not return embeddings on export (the `include` parameter in ChromaDB's `get()` must explicitly request `'embeddings'`), re-computation is required.
3. Re-computation cost estimate: ~50ms per text on CPU. For 10,000 messages, that is ~8 minutes. Acceptable as a one-time batch job.

**If switching to a different embedding model later**:
- All `vec0` virtual tables must be dropped and recreated with the new dimension.
- All embeddings must be recomputed.
- Add a `migrations/002_recompute_embeddings.sql` that drops and recreates vec0 tables.
- The migration script should mark all `messages_raw` and `chunks` as needing re-embedding.

### 3.4 Phased Rollout Plan

```
Week 0-1: Build migration script
  - Write ChromaDB export tool (read all collections via chromadb Python/JS client)
  - Write SQLite import tool (transform + insert)
  - Test with a copy of production data

Week 1-2: Shadow mode
  - Deploy Memory Service alongside ChromaDB
  - Extension sends data to BOTH services (dual-write)
  - Compare recall results between old and new systems
  - Log discrepancies

Week 2-3: Primary cutover
  - Switch Extension to use Memory Service as primary
  - Keep ChromaDB as read-only fallback
  - Monitor for 1 week

Week 3-4: Decommission
  - Remove ChromaDB dependency from Extension
  - Archive ChromaDB data
  - Remove CloudStorage.ts, entityExtraction.ts, MemoryLifecycleManager.ts
```

### 3.5 Rollback Plan

1. Keep ChromaDB running for at least 2 weeks after cutover.
2. The Extension's `MemoryServiceClient` should have a feature flag: `USE_MEMORY_SERVICE=true|false`. When false, fall back to the existing `CloudStorage` path.
3. SQLite data directory can be safely deleted and re-migrated from ChromaDB at any time during the transition period.
4. Add a `/api/v1/migration/status` endpoint that reports migration progress and data counts.

---

## 4. Performance Analysis

### 4.1 better-sqlite3 Blocking Time Estimates

All operations below are synchronous and block the Node.js event loop:

| Operation                         | Expected Rows | Estimated Blocking Time | Acceptable? |
|-----------------------------------|---------------|------------------------|-------------|
| INSERT into messages_raw          | 1             | <1ms                   | Yes         |
| INSERT into messages_vec          | 1             | <1ms                   | Yes         |
| FTS5 search (chunks_fts)          | ~1000 chunks  | 1-5ms                  | Yes         |
| vec0 KNN search (chunks_vec)      | ~1000 vectors | 5-20ms                 | Yes         |
| vec0 KNN search (messages_vec)    | ~10000 vectors| 10-50ms                | Marginal    |
| Entity lookup by ID               | 1             | <1ms                   | Yes         |
| Entity + properties JOIN          | ~10-50 props  | 1-3ms                  | Yes         |
| Relationships 2-hop traversal     | ~100-500 rows | 5-20ms                 | Yes         |
| Forgetting cycle (full scan)      | ~10000 rows   | 50-200ms               | Move to worker |
| Chunk re-index (per file)         | ~50-200 chunks| 20-100ms + embedding   | Move to worker |
| Daily consolidation               | Multiple ops  | 500ms-5s (with LLM)   | Move to worker |

**Conclusion**: API-facing operations (`/ingest`, `/recall`) should stay under 50ms of SQLite blocking. Batch operations (consolidation, forgetting, re-indexing) should run in a worker thread.

### 4.2 Expected Throughput

Based on the current system's usage patterns:
- **Messages/day**: 100-1000 (chat messages, webpage captures)
- **Recalls/day**: 10-50 (user queries via `/ask` or `/recall`)
- **Entities**: ~500-2000 total, growing slowly
- **Chunks**: ~2000-10000 total after consolidation builds markdown files

At these volumes, SQLite is well within its comfort zone. SQLite handles millions of rows and hundreds of writes per second. The bottleneck will be LLM calls, not database operations.

### 4.3 Embedding Model Load Time

- **Cold start**: 10-30 seconds to download and initialize the ONNX model on first use.
- **Warm start** (model cached on disk): 2-5 seconds to load into memory.
- **Per-embedding latency**: 20-80ms per text (CPU), 5-15ms (if WebGPU/WASM optimized).

**Impact on `/ingest`**: First ingest request after service restart will take 10-30s. Subsequent requests will be fast.

**Mitigation**: Preload the model on server startup (configurable). Show `degraded` status in `/health` until the model is ready.

### 4.4 sqlite-vec Query Performance

sqlite-vec uses brute-force KNN (no approximate index like HNSW). Performance characteristics:
- 1,000 vectors: <5ms
- 10,000 vectors: 10-50ms
- 100,000 vectors: 100-500ms

For the expected scale (10,000-50,000 vectors max), sqlite-vec is adequate. If scale grows beyond 100k vectors, consider migrating to `usearch` or a dedicated vector DB.

### 4.5 Memory Budget

| Component                    | Estimated RAM  |
|------------------------------|----------------|
| Node.js base + Fastify       | 50-100MB       |
| ONNX embedding model         | 200-500MB      |
| SQLite memory-mapped I/O     | 50-200MB       |
| SQLite page cache (default)  | 2MB (adjustable via PRAGMA cache_size) |
| Application data structures  | 20-50MB        |
| **Total**                    | **320MB - 850MB** |

**Recommendation**: Set `PRAGMA cache_size = -64000` (64MB) for better query performance. Monitor with `process.memoryUsage()` via `/stats` endpoint. Document minimum 1GB RAM, recommended 2GB RAM.

---

## 5. Testing Strategy

### Phase 1: Service Scaffold

**Unit Tests**:
- `Database.ts`: open/close, migration execution, WAL mode verification, vec extension loading
- `config.ts`: env var parsing, defaults, missing values
- Schema validation: all tables created, all indexes exist, FTS5 triggers work
- `/ingest` route: valid payload accepted, invalid payload rejected (schema validation)
- `/recall` route: basic single-channel vector search
- `/health` route: returns correct status

**Integration Tests**:
- End-to-end: POST to `/ingest` -> verify row in `messages_raw` -> verify embedding in `messages_vec`
- Markdown directory initialization: verify folder structure created
- Database migration: apply 001, verify tables, apply again (idempotent)

**Key Test Scenarios**:
- Ingest a message with no embedding model loaded (should queue or return degraded)
- Ingest duplicate content (content_hash dedup)
- Recall with empty database (should return empty, not error)

**Acceptance Criteria**:
- Server starts in <5s (excluding model load)
- `/health` returns `ok` when DB is connected
- `/ingest` returns 201 with message ID
- `/recall` returns results sorted by score

---

### Phase 2: Multi-channel Recall + Salience + Forgetting

**Unit Tests**:
- `SalienceScorer.ts`: formula correctness with known inputs, boundary conditions (all zeros, all ones, redundancy >0.95)
- `RecallEngine.ts`: each channel independently (vector, FTS, graph, time), merge/dedup logic, MMR reranking
- `ForgettingEngine.ts`: decay formula, reinforcement logic (access_count incrementing, decay_rate reduction), threshold-based actions (forget, archive, downgrade)

**Integration Tests**:
- Ingest 50 messages -> recall by semantic query -> verify top-K relevance
- Ingest messages over time -> verify recency scoring works
- Recall a memory 5 times -> verify salience increases, decay_rate decreases
- Run forgetting cycle -> verify low-salience items archived/forgotten

**Key Test Scenarios**:
- Recall with conflicting channels (vector says A is best, FTS says B) -> MMR resolves correctly
- Recall with `projectFilter` -> only project-related results returned
- Forgetting with `consolidation_level='permanent'` items -> never forgotten

**Acceptance Criteria**:
- Recall@5 precision >= 70% on a hand-crafted test set of 100 messages + 20 queries
- Forgetting cycle completes in <10s for 10,000 items
- Reinforcement increases salience by measurable amount

---

### Phase 3: Truth Maintenance + Watched Projects

**Unit Tests**:
- `TruthMaintainer.ts`: each action_type (set, update, reject, confirm, propose), authority weight comparison, conflict detection, supersede logic, dependency propagation
- Bitemporal queries: "what was the value at time T?" using valid_from/valid_to and tx_start/tx_end
- `WatchedProjects` CRUD: create, read, update, delete, alias matching, auto_capture_rules matching
- Confirm request creation and answering flow

**Integration Tests**:
- Ingest message with property -> entity_property created with correct source
- Ingest conflicting property from higher authority -> supersedes previous
- Ingest conflicting property from lower authority -> creates confirm_request
- Answer confirm_request -> property status updated
- Watch a project -> ingest matching message -> matched_projects populated

**Key Test Scenarios**:
- Race condition: two conflicting properties ingested simultaneously
- Property with `is_final=true` -> new incoming value creates confirm_request instead of superseding
- Entity merge: mark entity as `merged_into` another -> verify all relationships and properties transfer

**Acceptance Criteria**:
- Current property value always reflects highest-authority active value
- Timeline API returns complete history in chronological order
- No orphaned entity_properties after conflict resolution

---

### Phase 4: Proactive Thinking Engine

**Unit Tests**:
- `ProactiveScheduler.ts`: heartbeat interval configuration, cron expression parsing, start/stop lifecycle
- `HeartbeatLoop.ts`: each check (unprocessed messages, truth conflicts >24h, project updates, upcoming deadlines)
- `ProactivityPolicy.ts`: utility calculation, threshold comparisons, throttle logic (same topic interval, daily limit), quiet hours
- `microConsolidate()`: message grouping by project, duplicate detection, mention_count update

**Integration Tests**:
- Start scheduler -> verify heartbeat fires at configured interval
- Ingest messages matching watched project -> heartbeat detects and creates notification
- Send 11 notifications in a day -> 11th is throttled
- Set quiet hours -> notification during quiet hours is suppressed

**Key Test Scenarios**:
- Heartbeat with no new data (should be a no-op, not error)
- Two heartbeats racing (ensure idempotency)
- User answers a confirm_request between heartbeats (no duplicate reminder)

**Acceptance Criteria**:
- Heartbeat completes in <5s
- Notifications respect quiet hours and daily limits
- SSE events delivered to connected clients within 1s of notification creation

---

### Phase 5: Consolidation + Dreaming + Export

**Unit Tests**:
- `ConsolidationEngine.ts`: daily summary generation (mock LLM), duplicate cluster detection, project summary update, chunk re-indexing
- `GenerativeReplay.ts`: topic selection (top-5 by salience), dream prompt construction, discovery extraction, low-confidence relationship insertion
- `OnlineReflection.ts`: memory reinforcement after query, new fact extraction, user preference update
- `MarkdownManager.ts`: file read/write, chunk splitting (400 token / 80 overlap), reindex, content_hash
- `ExportEngine.ts`: zip creation, file inclusion, correct directory structure

**Integration Tests**:
- Run daily consolidation with 50 messages -> verify daily log created, project summaries updated, chunks re-indexed
- Run weekly dreaming -> verify dreams directory populated, low-confidence relationships inserted
- Export -> unzip -> verify markdown files readable and consistent with database
- Modify a markdown file externally -> reindex -> verify chunks updated

**Key Test Scenarios**:
- Consolidation with 0 messages (empty day) -> should still run without error, create empty or skip daily log
- Dreaming with <5 salient topics -> should dream on whatever is available
- Export while consolidation is running (concurrent access)

**Acceptance Criteria**:
- Daily consolidation completes in <60s for 500 messages
- Exported zip can be imported to reconstruct the SQLite database
- Markdown files are valid, readable, and accurate summaries

---

### Phase 6: Extension Migration + UI

**Unit Tests**:
- `MemoryServiceClient.ts`: all API methods, error handling (network failure, 401, 500), retry logic, timeout handling
- Request/response type serialization (camelCase <-> snake_case conversion if needed)
- SSE connection lifecycle: connect, receive events, reconnect on disconnect

**Integration Tests**:
- Extension sends message to `/ingest` -> verify stored in Service
- Extension calls `/recall` -> verify results displayed in UI
- Extension receives SSE notification -> verify Chrome notification shown
- Watched project UI: add/edit/delete project -> verify API calls
- Notification center: display pending, answer confirm request, snooze

**Key Test Scenarios**:
- Service is down -> Extension shows degraded mode, queues messages for later
- Service returns 429 (rate limited) -> Extension backs off
- Long SSE disconnect -> Extension reconnects and fetches missed notifications

**Acceptance Criteria**:
- All existing Extension functionality works through the new Service
- No data loss when switching from CloudStorage to MemoryServiceClient
- UI responsiveness: no perceivable lag from HTTP round-trips (<200ms for most operations)

---

### Phase 7: Evaluation + Tuning

**Unit Tests**:
- Evaluation harness: test dataset loading, metric calculation (precision@K, recall@K, MRR)
- Parameter sweep runner: vary salience weights, measure impact on metrics

**Integration Tests**:
- End-to-end recall benchmark: 100 queries against a fixed dataset, measure P@5 and P@10
- Truth accuracy benchmark: 50 property-change scenarios, measure correct resolution rate
- Notification utility benchmark: 30 notification scenarios, measure user-satisfaction proxy

**Key Test Scenarios**:
- Performance regression test: ensure recall latency <200ms at P95
- Memory leak test: run service for 24h with simulated traffic, check RSS growth
- Concurrent load test: 10 simultaneous ingest + recall requests

**Acceptance Criteria**:
- Recall P@5 >= 70%
- Truth accuracy >= 85% on test scenarios
- P95 recall latency <500ms
- No memory leak (RSS growth <10% over 24h)
- OpenAPI spec generated and validates

---

## 6. Risk Register

### Risk 1: Data Loss During ChromaDB Migration

**Likelihood**: Medium | **Impact**: Critical

**Description**: ChromaDB data export may be incomplete (missing embeddings, corrupted metadata, or collection inconsistencies). The 4514-line CloudStorage.ts has complex entity serialization that may not round-trip cleanly.

**Mitigation**:
1. Build a validation step that compares counts and checksums between ChromaDB and SQLite after migration.
2. Keep ChromaDB running in read-only mode for 30 days post-migration.
3. Write migration in dry-run mode first (validate without committing).
4. Back up the entire ChromaDB data directory before starting.

---

### Risk 2: Embedding Model Causing OOM or Instability

**Likelihood**: Medium | **Impact**: High

**Description**: `@xenova/transformers` loading `all-MiniLM-L6-v2` in Node.js uses ONNX runtime which can consume 200-500MB. On resource-constrained environments (small VPS, Docker with low memory limits), this could cause OOM kills, especially during consolidation when LLM calls also consume memory.

**Mitigation**:
1. Add `--max-old-space-size=2048` to Node.js startup flags.
2. Implement graceful degradation: if embedding model fails to load, service continues without vector search (FTS-only mode).
3. Add memory monitoring to `/health` endpoint. Return `degraded` when RSS exceeds 80% of available memory.
4. Document Docker memory requirements: `deploy.resources.limits.memory: 2g` in docker-compose.yml.

---

### Risk 3: LLM Cost Overrun from Proactive Engine

**Likelihood**: High | **Impact**: Medium

**Description**: The plan specifies a heartbeat every 15 minutes, daily consolidation, weekly dreaming, and online reflection after each query. Each of these can trigger 1-5 LLM calls. At $0.15/1K tokens for GPT-4o-mini:
- Heartbeat: ~96/day x 1-2 calls = ~100-200 calls/day
- Consolidation: ~10-20 calls/day
- Dreaming: ~5-10 calls/week
- Online reflection: ~10-50 calls/day
- Entity extraction: ~100-1000 calls/day (1 per ingested message)

Total: 200-1500 LLM calls/day. At ~500 tokens/call, that is 100K-750K tokens/day, or $15-$112/month.

**Mitigation**:
1. Use cheaper models for entity extraction and summarization (GPT-4o-mini, not GPT-4).
2. Batch entity extraction: process 10 messages in a single LLM call.
3. Add token budget tracking with automatic throttling.
4. Make heartbeat interval configurable and start with 30 minutes (not 15).
5. Skip entity extraction for low-importance messages (importance < 0.3 based on simple heuristics before LLM).

---

### Risk 4: Synchronous SQLite Blocking Degrades API Latency

**Likelihood**: Medium | **Impact**: Medium

**Description**: During daily consolidation or chunk re-indexing, the main thread could be blocked for 500ms-5s. If a user sends a `/recall` request during this time, they experience the full delay.

**Mitigation**:
1. Run consolidation/forgetting/re-indexing in a Node.js worker thread.
2. Use `WAL` mode (already enabled) to allow concurrent reads during writes.
3. Break large batch operations into smaller chunks with `setImmediate()` yields (not possible with better-sqlite3 sync API -- reinforces the worker thread approach).
4. Add a middleware that measures and logs request latency. Alert if P95 > 500ms.

---

### Risk 5: Schema Evolution Difficulty After Launch

**Likelihood**: High | **Impact**: Medium

**Description**: The 001_initial.sql migration creates 12+ tables with complex schemas. Once users have data, schema changes require careful migrations. SQLite does not support `ALTER TABLE DROP COLUMN` (until 3.35.0) or adding constraints to existing columns. The bitemporal `entity_properties` table is particularly difficult to modify.

**Mitigation**:
1. Freeze the schema before Phase 1 launch. Review with at least one additional engineer.
2. Add version tracking in the `_migrations` table (already present).
3. Design migrations to be forward-only (no rollback). Test each migration against a copy of production data.
4. Keep the Markdown files as the canonical source: worst case, the SQLite database can be fully rebuilt from Markdown + re-extraction from messages_raw content.
5. Add a `rebuild_index` CLI command that recreates all derived tables (chunks, vec tables, FTS) from source data.

---

*End of design review.*
