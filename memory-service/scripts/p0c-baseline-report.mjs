#!/usr/bin/env node
/**
 * P0c old-stack baseline report (memory-foundation plan §11.4).
 *
 * Measures the current retrieval stack (legacy porter FTS + trigram shadow +
 * dense vector) over a fixture of representative queries so P0.5/P2 can
 * compare against a frozen, dated baseline:
 *   - per-query candidate counts per channel
 *   - trigram-only coverage (the CJK/mixed-language gap)
 *   - real vector coverage (chunks with embeddings / total message chunks)
 *   - aggregate no-result rate
 *
 * Read-only: uses recall channels directly; never writes memory state.
 *
 * Usage (inside memory-service container):
 *   node scripts/p0c-baseline-report.mjs --db-path /app/data/users/esone.qiu/memory.db
 *   node scripts/p0c-baseline-report.mjs --db-path ... --out /app/data/backups/p0c-baseline.json
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { EmbeddingClient } = await import('/app/dist/llm/EmbeddingClient.js');

function parseArgs(argv) {
  const opts = { dbPath: '', out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) opts.out = argv[++i];
  }
  if (!opts.dbPath || !fs.existsSync(opts.dbPath)) {
    throw new Error('--db-path must point to an existing SQLite database');
  }
  return opts;
}

/** Fixture queries: cross-language probes + English keyword probes. */
const FIXTURES = [
  { id: 'cross-lang-cursor-policy', query: '目前 Cursor 的许可/使用政策是怎样的？不活跃用户会被怎么处理？', expect: '2026-03 Cursor billing policy messages' },
  { id: 'cross-lang-meeting-room', query: '会议室申请独占后系统会怎么处理？', expect: 'Chinese meeting-room request messages' },
  { id: 'cross-lang-nova-mention', query: 'NOVA epic 没有 assignee 的时候 mention 机制', expect: 'August 2026 NOVA-164 mention discussion' },
  { id: 'en-cursor-billing', query: 'Cursor billing changed request-based quota token credit usage', expect: '2026-03-03 billing change message' },
  { id: 'en-codex-trial', query: 'Codex Enterprise 30-day free trial no usage limits', expect: '2026-03-11 OpenAI partnership message' },
  { id: 'zh-ai-review', query: 'AI review 是代码合并的前置条件吗', expect: 'AI review Cursor messages' },
  { id: 'zh-estimate', query: 'Jira Original Estimate 人天口径', expect: 'estimate cue discussion' },
  { id: 'mixed-openrouter', query: 'Stripe OpenRouter 收购 pitch deck', expect: 'August 2026 OpenRouter discussion' },
];

function sanitizeFtsQuery(query) {
  const cleaned = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((t) => `"${t}"`).join(' OR ');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const db = new Database(opts.dbPath, { readonly: true });
  let vec = true;
  try {
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
  } catch {
    vec = false;
  }

  // ---- vector coverage (real, reported alongside quality) ----
  const messageChunks = db
    .prepare(`SELECT COUNT(*) c FROM chunks WHERE file_path LIKE 'messages/%'`)
    .get().c;
  const messageChunksWithVec = vec
    ? db
        .prepare(
          `SELECT COUNT(*) c FROM chunks c WHERE c.file_path LIKE 'messages/%'
             AND EXISTS (SELECT 1 FROM chunks_vec v WHERE v.chunk_id = c.chunk_id)`,
        )
        .get().c
    : null;

  let embeddingClient = null;
  try {
    embeddingClient = await EmbeddingClient.getInstance();
    console.log(`[baseline] embedding model ready: ${EmbeddingClient.getModelName()}`);
  } catch (err) {
    console.log(`[baseline] embedding unavailable: ${err.message}`);
  }

  const perQuery = [];
  for (const fixture of FIXTURES) {
    const ftsQuery = sanitizeFtsQuery(fixture.query);
    const cleanedTri = fixture.query.replace(/["'^\-:()\[\]{}*+]/g, ' ').trim();
    const triFragments = [];
    for (const token of cleanedTri.match(/[\u3400-\u9fff]{3,}|[a-zA-Z0-9][a-zA-Z0-9._:-]{2,}/gu) ?? []) {
      if (!/[\u3400-\u9fff]/.test(token) || token.length <= 6) {
        triFragments.push(token);
        continue;
      }
      for (let i = 0; i + 4 <= token.length && triFragments.length < 10; i += 1) {
        triFragments.push(token.slice(i, i + 4));
      }
    }
    const triQuery = triFragments.length > 0 ? triFragments.slice(0, 8).map((f) => JSON.stringify(f)).join(' OR ') : null;

    const porterCount = ftsQuery
      ? db.prepare(`SELECT COUNT(*) c FROM chunks_fts WHERE chunks_fts MATCH ?`).get(ftsQuery).c
      : 0;
    let triCount = null;
    try {
      triCount = db
        .prepare(`SELECT COUNT(*) c FROM chunks_fts_tri WHERE chunks_fts_tri MATCH ?`)
        .get(triQuery).c;
    } catch {
      triCount = null;
    }

    let denseCount = null;
    let denseTopIds = [];
    if (embeddingClient && vec) {
      try {
        const embedding = await embeddingClient.embed(fixture.query);
        const emb = JSON.stringify(embedding);
        const rows = db
          .prepare(
            `SELECT v.chunk_id FROM chunks_vec v
             JOIN chunks c ON c.chunk_id = v.chunk_id
             WHERE c.file_path LIKE 'messages/%'
               AND vec_distance_cosine(v.embedding, ?) < 0.7
             ORDER BY vec_distance_cosine(v.embedding, ?)
             LIMIT 30`,
          )
          .all(emb, emb);
        denseCount = rows.length;
        denseTopIds = rows.map((r) => r.chunk_id);
      } catch (err) {
        console.log(`[baseline] dense probe failed for ${fixture.id}: ${err.message}`);
      }
    }

    perQuery.push({
      id: fixture.id,
      query: fixture.query,
      expect: fixture.expect,
      porterFtsCandidates: porterCount,
      trigramCandidates: triCount,
      denseCandidates: denseCount,
    });
    console.log(
      `[baseline] ${fixture.id}: porter=${porterCount} tri=${triCount} dense=${denseCount}`,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dbPath: opts.dbPath,
    model: embeddingClient ? EmbeddingClient.getModelName() : null,
    vectorCoverage: {
      messageChunks,
      messageChunksWithVec,
      coverageRatio: messageChunksWithVec !== null
        ? Number((messageChunksWithVec / messageChunks).toFixed(4))
        : null,
    },
    queries: perQuery,
    aggregates: {
      noResultPorter: perQuery.filter((q) => q.porterFtsCandidates === 0).length,
      noResultTrigram:
        perQuery.filter((q) => q.trigramCandidates !== null && q.trigramCandidates === 0).length,
      trigramOnlyWins: perQuery.filter(
        (q) =>
          q.trigramCandidates !== null &&
          q.trigramCandidates > 0 &&
          q.porterFtsCandidates === 0,
      ).length,
      denseOnlyWins: perQuery.filter(
        (q) => q.denseCandidates !== null && q.denseCandidates > 0 && q.porterFtsCandidates === 0,
      ).length,
    },
  };

  const out = opts.out || `/app/data/backups/p0c-baseline-${new Date().toISOString().slice(0, 10)}.json`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`[baseline] report: ${out}`);
  db.close();
}

main().catch((err) => {
  console.error('[baseline] failed:', err);
  process.exit(1);
});
