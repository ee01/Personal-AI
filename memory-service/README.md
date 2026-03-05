# Personal AI Memory Service

Backend service for the Personal AI Chrome Extension memory system. Ingests messages from multiple sources (Glip, Jira, web, manual notes), extracts entities and relationships, maintains a knowledge graph with bitemporal truth tracking, and provides multi-channel recall with LLM-powered Q&A.

## Architecture

The service uses a **dual-loop architecture**:

- **Reactive loop** -- triggered by incoming data. When a message is ingested via `/ingest`, the IngestionPipeline extracts entities, computes salience, stores embeddings, detects truth conflicts, and appends to the daily markdown log. When a query hits `/recall` or `/ask`, the RecallEngine runs 4-channel parallel search (vector, FTS, graph, time) and reranks with MMR.

- **Proactive loop** -- runs on timers. A heartbeat (default every 15 min) performs micro-consolidation, checks for deadline notifications, and detects project updates. A daily cron job (23:00) runs full consolidation: compress, denoise, structure, clean, reindex, reflect. A weekly cron job (Sunday 03:00) runs generative replay ("dreaming") to discover implicit connections across memories.

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
cd memory-service
cp .env.example .env
# Edit .env with your API keys
npm install
npm run dev
```

The server starts at http://localhost:3210
API docs at http://localhost:3210/docs

### Build & Run

```bash
npm run build
npm start
```

### Database Migrations

```bash
npm run migrate
```

## API Endpoints

All endpoints are prefixed with `/api/v1`. A top-level `/health` is also available for container orchestrators.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with DB stats, uptime, embedding status |
| `POST` | `/ingest` | Ingest a single message through the pipeline |
| `POST` | `/ingest/batch` | Batch ingest multiple messages |
| `POST` | `/recall` | Multi-channel memory recall (vector, FTS, graph, time) |
| `POST` | `/ask` | Natural language Q&A over stored memories |
| `GET` | `/entities` | List entities with type/search/status filters |
| `GET` | `/entities/:id` | Get entity detail with active properties |
| `GET` | `/entities/:id/properties` | Get property history (with superseded flag) |
| `GET` | `/entities/:id/timeline` | Get property change timeline |
| `GET` | `/entities/:id/relationships` | Get entity relationships (configurable depth) |
| `GET` | `/projects/watched` | List watched projects |
| `POST` | `/projects/watched` | Create a watched project |
| `GET` | `/projects/watched/:id` | Get a single watched project |
| `PUT` | `/projects/watched/:id` | Update a watched project (partial) |
| `DELETE` | `/projects/watched/:id` | Soft-delete a watched project |
| `GET` | `/notifications` | List notifications (filterable) |
| `POST` | `/notifications/:id/action` | Process notification action (click/dismiss) |
| `GET` | `/notifications/stats` | Notification statistics |
| `GET` | `/events` | SSE stream for real-time push events |
| `POST` | `/export` | Export memory data as markdown manifest |
| `GET` | `/stats` | Aggregate counts across all tables |
| `POST` | `/consolidate` | Manually trigger daily or weekly consolidation |
| `GET` | `/confirm-requests` | List pending confirm requests |
| `POST` | `/confirm-requests/:id/answer` | Answer a confirm request |

## Core Engines

| Engine | Description |
|--------|-------------|
| **IngestionPipeline** | Accepts messages, deduplicates, extracts entities via LLM, computes salience, generates embeddings, stores in DB and markdown, matches watched projects. |
| **RecallEngine** | 4-channel parallel recall (vector via sqlite-vec, FTS5, knowledge graph traversal, time window) with MMR reranking for relevance-diversity balance. |
| **SalienceScorer** | Computes salience = weighted sum of importance, frequency, recency, surprise minus redundancy penalty. Memories below 0.3 are stored but not indexed. |
| **ForgettingEngine** | Exponential decay model with configurable half-life. Memories below 0.05 are soft-deleted, below 0.15 archived, and large drops trigger consolidation-level downgrades. |
| **TruthMaintainer** | Bitemporal property management with conflict resolution. Uses authority weights and confidence scores to resolve disagreements or escalates to the user via confirm requests. |
| **ProactiveScheduler** | Orchestrates the three timer loops: heartbeat interval, daily cron, and weekly cron. Catches all async errors so the scheduler never crashes the process. |
| **HeartbeatLoop** | Runs every 15 min: micro-consolidation of new messages, truth-conflict reminders, watched project update detection, deadline notifications, proactivity filtering. |
| **ConsolidationEngine** | Nightly 6-phase process: compress (daily summary), denoise (merge duplicates), structure (project summaries), clean (forgetting cycle), reindex (chunk rebuild), reflect (daily reflection). |
| **GenerativeReplay** | Weekly "dreaming": selects salient topics from the past 30 days, recalls related memories, asks the LLM to weave narratives, discovers implicit relationships, reinforces accessed memories. |
| **OnlineReflection** | Post-interaction reflection after `/ask`: reinforces used memories, extracts new entity facts, detects user preferences, suggests recall improvements. |
| **ProactivityPolicy** | Utility model for notification decisions. Computes benefit (importance, urgency, confidence, actionability) minus cost (busy, quiet hours, spam penalty) to decide notify/silent/throttle. |
| **MarkdownManager** | Content-level markdown operations: writes structured daily logs, project summaries, entity profiles, and reindexes chunks with embeddings. |
| **ExportEngine** | Packages memory data for export: lists files, exports DB contents as structured JSON, produces a high-level manifest. |

## Data Storage

- **SQLite** (`data/index.sqlite`) -- Messages, entities, properties, relationships, watched projects, memory metadata, notifications, confirm requests, reflection artifacts, proposed actions.
- **Markdown** (`data/`) -- Daily logs, project summaries, reflections, dream narratives, entity profiles. Human-readable and version-controllable.
- **sqlite-vec** -- Vector embeddings for semantic search over messages and chunks.
- **FTS5** -- Full-text search index over chunk content using BM25 ranking.

## Configuration

Key environment variables (see `.env.example` for all options):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3210` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Directory for SQLite DB and markdown files |
| `LOG_LEVEL` | `info` | Pino log level |
| `LLM_PROVIDER` | `openai` | LLM backend: `openai`, `groq`, `ollama`, `dify` |
| `OPENAI_API_KEY` | -- | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model to use |
| `EMBEDDING_PROVIDER` | `local` | Embedding backend: `local` (Xenova/transformers) |
| `EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` | Embedding model name |
| `EMBEDDING_DIMENSION` | `384` | Vector dimension |
| `API_KEY` | -- | Optional API key for authentication |
| `HEARTBEAT_INTERVAL_MS` | `900000` | Heartbeat loop interval (ms) |
| `DAILY_CRON` | `0 23 * * *` | Daily consolidation cron expression |
| `WEEKLY_CRON` | `0 3 * * 0` | Weekly dreaming cron expression |
| `QUIET_HOURS_START` | `22` | Quiet hours start (suppress notifications) |
| `QUIET_HOURS_END` | `8` | Quiet hours end |

## Testing

```bash
npm test              # Run all tests with vitest
npm run test:coverage # Run with coverage report
```

Test fixtures are in `src/__tests__/fixtures/`.

## Project Structure

```
src/
├── server.ts              # Fastify entry point, app builder, graceful shutdown
├── config.ts              # Environment configuration (frozen singleton)
├── core/
│   ├── IngestionPipeline.ts    # Message ingestion and entity extraction
│   ├── RecallEngine.ts         # 4-channel parallel recall with MMR
│   ├── SalienceScorer.ts       # Salience scoring formula
│   ├── ForgettingEngine.ts     # Exponential decay and memory lifecycle
│   ├── TruthMaintainer.ts      # Bitemporal property conflict resolution
│   ├── ProactiveScheduler.ts   # Dual-loop scheduler (heartbeat + cron)
│   ├── HeartbeatLoop.ts        # Micro-consolidation and notifications
│   ├── ConsolidationEngine.ts  # Nightly 6-phase consolidation
│   ├── GenerativeReplay.ts     # Weekly dreaming engine
│   ├── OnlineReflection.ts     # Post-interaction reflection
│   ├── ProactivityPolicy.ts    # Notification utility model
│   ├── MarkdownManager.ts      # Markdown content operations
│   └── ExportEngine.ts         # Data export and packaging
├── routes/
│   ├── health.ts          # GET /health
│   ├── ingest.ts          # POST /ingest
│   ├── ingestBatch.ts     # POST /ingest/batch
│   ├── recall.ts          # POST /recall
│   ├── ask.ts             # POST /ask
│   ├── entities.ts        # Entity CRUD (5 endpoints)
│   ├── projects.ts        # Watched project CRUD (5 endpoints)
│   ├── notifications.ts   # Notification management (3 endpoints)
│   ├── events.ts          # SSE real-time events
│   ├── export.ts          # POST /export
│   ├── stats.ts           # GET /stats
│   ├── consolidate.ts     # POST /consolidate
│   └── confirmRequests.ts # Confirm request management (2 endpoints)
├── storage/
│   ├── Database.ts        # SQLite wrapper (WAL, vec, migrations)
│   ├── UserDataManager.ts # Filesystem directory structure
│   ├── migrate.ts         # Migration runner CLI
│   └── migrations/        # SQL migration files
├── llm/
│   ├── LLMClient.ts       # Multi-provider LLM client
│   └── EmbeddingClient.ts # Local embedding via Xenova/transformers
├── types/
│   └── index.ts           # TypeScript interfaces and type aliases
├── utils/
│   ├── chunking.ts        # Text chunking for indexing
│   ├── hashing.ts         # Content hashing for dedup
│   ├── slug.ts            # String slugification
│   └── time.ts            # Time utilities
└── __tests__/
    ├── setup.ts           # Test setup (in-memory DB)
    ├── fixtures/          # Test data fixtures
    ├── api-health.test.ts
    └── utils.test.ts
```
