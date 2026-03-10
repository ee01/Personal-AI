# ChromaDB -> Memory Service Migration Tool

## Background

Old memory system (develop branch) uses ChromaDB vector database via `CloudStorage.ts` managing 7 collections:
- `{username}-graph-entities` -- Entities (Person, Project, Task, Topic...)
- `{username}-messages` -- Chat messages
- `{username}-webpages` -- Web browsing records
- `{username}-userprofiles` -- User profile observations
- `{username}-followed_thread_messages` -- Followed message threads
- `{username}-projects` / `{username}-documents` -- Projects and documents

New memory system (v8 branch) uses a standalone Fastify + SQLite backend (`memory-service/`), data via REST API:
- `messages_raw` -- Raw messages
- `entities` -- Knowledge graph entities
- `entity_properties` -- Entity properties (bi-temporal event sourcing)
- `relationships` -- Entity relationships
- `chunks` / `chunks_vec` -- Text chunks + vector index
- `memory_metadata` -- Memory salience metadata
- `watched_projects` -- Watched projects
- `user_profile_items` -- User profile
- `social_edges` / `opinion_items` -- Social relationships and opinions

---

## Revised Architecture Decision

### Why standalone script instead of Chrome extension component

The original plan proposed a React component in the options page. After analysis, a **standalone TypeScript script** is better because:

1. **Long-running operation** -- Migration of thousands of messages can take minutes/hours. Chrome extension pages may be killed by the browser.
2. **No Chrome APIs needed** -- Both ChromaDB and memory-service are HTTP APIs, no Chrome-specific APIs required.
3. **Better DX** -- Console output with progress bars, easy to re-run, can be piped/logged.
4. **Simpler** -- No React UI to build, no webpack bundling needed.

### Key optimization: `skipExtraction` flag

The ingest API normally runs LLM entity extraction on every message, which would mean thousands of expensive LLM calls during migration. Instead:

1. Add `skipExtraction` flag to `IngestPayload` -- when true, skip LLM extraction and just store the raw message with existing metadata.
2. Import entities separately via new `POST /entities` and `POST /entities/batch` endpoints.
3. Optionally run extraction later in batches via a separate consolidation pass.

---

## Data Migration Strategy

### 1. Messages -- Fast raw migration
| Old System | New System | Method |
|------------|------------|--------|
| ChromaDB `messages` collection | `messages_raw` table | `/ingest/batch` with `skipExtraction: true` |

Old message metadata contains: `sender`, `datetime`, `groupName`, `groupId`, `summary`, `entities`, `postId`, etc.
Map directly to IngestPayload fields. Store old `summary` and `entities` in metadata for reference.

### 2. Entities -- Direct import
| Old System | New System | Method |
|------------|------------|--------|
| ChromaDB `graph-entities` | `entities` table | New `POST /entities/batch` endpoint |

Import: id, type, name, description, importance, tags, status.
Skip: `relatedData` (will be rebuilt if/when messages are re-processed with extraction).

### 3. Webpages -- As messages with sourceType 'web'
| Old System | New System | Method |
|------------|------------|--------|
| ChromaDB `webpages` collection | `messages_raw` table | `/ingest/batch` with `skipExtraction: true`, `sourceType: 'web'` |

### 4. User Profiles -- Via profile API
| Old System | New System | Method |
|------------|------------|--------|
| ChromaDB `userprofiles` | `user_profile_items` table | `POST /profile/items` |

Extract key facts from old profile records and convert to profile items.

### 5. Followed Threads -- As messages
Same as messages, with metadata tag `{ source: 'followed_thread' }`.

### 6. LocalStorage cache -- Skip
Not needed.

---

## Implementation Plan

### Phase 1: Backend API changes

#### [MODIFY] memory-service/src/types/index.ts
Add `skipExtraction?: boolean` to `IngestPayload`.

#### [MODIFY] memory-service/src/core/IngestionPipeline.ts
When `skipExtraction` is true in the payload:
- Skip LLM entity extraction (step 2)
- Skip salience scoring (step 3)
- Use metadata-provided summary/importance/sentiment if available
- Still store in messages_raw, still generate embedding
- Skip entity/chunk/profile processing (steps 6, 6b, 6c)

#### [MODIFY] memory-service/src/routes/ingest.ts + ingestBatch.ts
Allow `skipExtraction` in the body schema.

#### [NEW] memory-service/src/routes/migrate.ts
New migration-specific routes:
- `POST /migrate/entities` -- Batch create entities (direct INSERT, no LLM)
- `POST /migrate/entity-properties` -- Batch create entity properties

### Phase 2: Migration script

#### [NEW] tools/migrate-chroma-to-memory-service.ts
Standalone TypeScript script runnable with `npx tsx`:

1. **Config** -- ChromaDB host/port, memory-service URL, username, batch size
2. **Scan phase** -- Connect to ChromaDB, list collections, count items per collection
3. **Messages phase** -- Read messages in batches, transform to IngestPayload, POST to /ingest/batch with skipExtraction
4. **Entities phase** -- Read graph-entities, transform, POST to /migrate/entities
5. **Webpages phase** -- Read webpages, transform to IngestPayload (sourceType: 'web'), POST to /ingest/batch
6. **Followed threads phase** -- Same as messages
7. **User profiles phase** -- Read userprofiles, transform to profile items, POST to /profile/items
8. **Summary** -- Print migration statistics

---

## Verification Plan

1. Run `npm run build` in memory-service to verify no build errors
2. Start memory-service, run migration script against test data
3. Check `/stats` endpoint to verify data counts match
4. Spot-check entities and messages via API
