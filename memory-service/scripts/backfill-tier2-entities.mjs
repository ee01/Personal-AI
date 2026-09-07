#!/usr/bin/env node
/**
 * Tier 2: LLM entity extraction backfill for messages missing entities_json.
 * High-value filter by default. See docs/progressing/memory-index-backfill-plan.md
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { getLLMClient } from '../dist/llm/LLMClient.js';
import { toSlug } from '../dist/utils/slug.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTAGE_TS = Math.floor(new Date('2026-07-01T00:00:00Z').getTime() / 1000);
const CONTENT_MAX = 6000;
const ENTITY_CATEGORY_MAP = {
  people: 'Person',
  projects: 'Project',
  topics: 'Topic',
  technologies: 'Technology',
  organizations: 'Organization',
};

function now() {
  return Math.floor(Date.now() / 1000);
}

function parseArgs(argv) {
  const opts = {
    dbPath: '',
    apply: false,
    filter: 'high-value',
    batchSize: 20,
    limit: 0,
    pauseMs: 500,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--db-path' && next) {
      opts.dbPath = path.resolve(next);
      i += 1;
    } else if (arg === '--apply') opts.apply = true;
    else if (arg === '--filter' && next) {
      opts.filter = next;
      i += 1;
    } else if (arg === '--batch-size' && next) {
      opts.batchSize = Number(next);
      i += 1;
    } else if (arg === '--limit' && next) {
      opts.limit = Number(next);
      i += 1;
    } else if (arg === '--pause-ms' && next) {
      opts.pauseMs = Number(next);
      i += 1;
    }
  }
  if (!opts.dbPath || !fs.existsSync(opts.dbPath)) {
    throw new Error('--db-path required');
  }
  return opts;
}

function openDb(dbPath, readonly) {
  const db = new Database(dbPath, readonly ? { readonly: true } : undefined);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 30000');
  if (readonly) db.pragma('query_only = ON');
  return db;
}

function flattenEntities(extraction) {
  const result = [];
  for (const [category, names] of Object.entries(extraction.entities || {})) {
    const entityType = ENTITY_CATEGORY_MAP[category];
    if (!entityType || !Array.isArray(names)) continue;
    for (const name of names) {
      if (typeof name === 'string' && name.trim()) {
        result.push({ type: entityType, name: name.trim() });
      }
    }
  }
  return result;
}

function truncateContent(content) {
  if (content.length <= CONTENT_MAX) return content;
  return `${content.slice(0, CONTENT_MAX)}\n...[truncated]`;
}

function buildPrompt(row) {
  const content = truncateContent(row.content);
  return `Given the following message content and context, extract structured information.

Message: "${content.replace(/"/g, '\\"')}"
Sender: ${row.sender ?? 'unknown'}
Group: ${row.group_name ?? 'unknown'}
Time: ${new Date(row.timestamp * 1000).toISOString()}

Return JSON:
{
  "entities": {
    "people": ["name1"],
    "projects": ["project name"],
    "topics": ["topic"],
    "technologies": ["tech term"],
    "organizations": ["org name"]
  },
  "importance": 0.7,
  "sentiment": "neutral",
  "summary": "one-line summary"
}

Rules:
- importance is 0-1
- sentiment: positive, negative, neutral, mixed
- Return ONLY valid JSON`;
}

function ensureProgressTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backfill_progress (
      tier TEXT NOT NULL,
      last_message_id TEXT,
      done_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (tier)
    );
  `);
}

function selectCandidates(db, afterId, limit, filter) {
  const filterClause =
    filter === 'high-value'
      ? `AND (m.importance >= 0.7 OR (m.summary IS NOT NULL AND TRIM(m.summary) != ''))`
      : '';
  return db
    .prepare(
      `SELECT m.id, m.content, m.sender, m.group_name, m.timestamp, m.summary,
              m.importance, m.sentiment, m.entities_json, m.metadata_json
       FROM messages_raw m
       WHERE m.timestamp >= ?
         AND m.content IS NOT NULL AND TRIM(m.content) != ''
         ${filterClause}
         AND (
           m.entities_json IS NULL OR TRIM(m.entities_json) = ''
         )
         AND (? IS NULL OR m.id > ?)
       ORDER BY m.id
       LIMIT ?`,
    )
    .all(OUTAGE_TS, afterId, afterId, limit);
}

function upsertEntities(db, entitiesList, messageId, ts) {
  const entityIds = [];
  for (const entity of entitiesList) {
    const entityId = `${entity.type.toLowerCase()}_${toSlug(entity.name)}`;
    const existing = db
      .prepare(
        `SELECT id FROM entities
         WHERE id = ? OR (LOWER(name) = LOWER(?) AND type = ?)
         LIMIT 1`,
      )
      .get(entityId, entity.name, entity.type);
    if (existing) {
      db.prepare(
        `UPDATE entities SET last_seen = ?, mention_count = mention_count + 1, updated_at = ? WHERE id = ?`,
      ).run(ts, now(), existing.id);
      entityIds.push(existing.id);
    } else {
      db.prepare(
        `INSERT INTO entities
          (id, type, name, importance, access_count, first_seen, last_seen,
           mention_count, status, created_at, updated_at)
         VALUES (?, ?, ?, 0.5, 0, ?, ?, 1, 'active', ?, ?)`,
      ).run(entityId, entity.type, entity.name, ts, ts, now(), now());
      entityIds.push(entityId);
    }
  }
  if (entityIds.length >= 2) {
    for (let i = 0; i < entityIds.length; i += 1) {
      for (let j = i + 1; j < entityIds.length; j += 1) {
        const fromId = entityIds[i];
        const toId = entityIds[j];
        const existing = db
          .prepare(
            `SELECT id, co_occurrence_count, evidence_message_ids_json
             FROM relationships
             WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = 'co_occurs'
             LIMIT 1`,
          )
          .get(fromId, toId);
        if (existing) {
          let evidenceIds = [];
          try {
            evidenceIds = existing.evidence_message_ids_json
              ? JSON.parse(existing.evidence_message_ids_json)
              : [];
          } catch {
            evidenceIds = [];
          }
          if (!Array.isArray(evidenceIds)) evidenceIds = [];
          if (!evidenceIds.includes(messageId)) evidenceIds.push(messageId);
          db.prepare(
            `UPDATE relationships
             SET co_occurrence_count = ?, evidence_message_ids_json = ?, updated_at = ?
             WHERE id = ?`,
          ).run(existing.co_occurrence_count + 1, JSON.stringify(evidenceIds), now(), existing.id);
        } else {
          db.prepare(
            `INSERT INTO relationships
              (from_entity_id, to_entity_id, relation_type, strength,
               co_occurrence_count, evidence_message_ids_json, created_at, updated_at)
             VALUES (?, ?, 'co_occurs', 0.5, 1, ?, ?, ?)`,
          ).run(fromId, toId, JSON.stringify([messageId]), now(), now());
        }
      }
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(JSON.stringify({ mode: opts.apply ? 'APPLY' : 'DRY_RUN', ...opts }, null, 2));

  const readDb = openDb(opts.dbPath, true);
  const pending = selectCandidates(readDb, null, 5, opts.filter).length;
  const totalPending = readDb
    .prepare(
      `SELECT COUNT(*) AS c FROM messages_raw m
       WHERE m.timestamp >= ?
         AND m.content IS NOT NULL AND TRIM(m.content) != ''
         ${opts.filter === 'high-value' ? `AND (m.importance >= 0.7 OR (m.summary IS NOT NULL AND TRIM(m.summary) != ''))` : ''}
         AND (m.entities_json IS NULL OR TRIM(m.entities_json) = '')`,
    )
    .get(OUTAGE_TS).c;
  readDb.close();
  console.log(`[tier2] pending candidates: ${totalPending}, sample batch: ${pending}`);

  if (!opts.apply) return;

  const db = openDb(opts.dbPath, false);
  ensureProgressTable(db);
  const checkpoint = db
    .prepare(`SELECT last_message_id, done_count FROM backfill_progress WHERE tier = ?`)
    .get('tier2');
  let afterId = checkpoint?.last_message_id ?? null;
  let doneCount = checkpoint?.done_count ?? 0;
  let processed = 0;
  const llm = getLLMClient();
  const updateMsg = db.prepare(
    `UPDATE messages_raw
     SET entities_json = ?, summary = COALESCE(NULLIF(summary, ''), ?),
         importance = ?, sentiment = ?, updated_at = ?
     WHERE id = ?`,
  );
  const setCheckpoint = db.prepare(
    `INSERT INTO backfill_progress (tier, last_message_id, done_count, updated_at)
     VALUES ('tier2', ?, ?, ?)
     ON CONFLICT(tier) DO UPDATE SET
       last_message_id = excluded.last_message_id,
       done_count = excluded.done_count,
       updated_at = excluded.updated_at`,
  );

  const processRow = async (row) => {
    const extraction = await llm.generateJSON(buildPrompt(row), {
      temperature: 0.2,
      maxTokens: 1200,
      systemPrompt: 'You are an entity extraction assistant. Return only valid JSON.',
    });
    const entitiesList = flattenEntities(extraction);
    const tx = db.transaction(() => {
      updateMsg.run(
        entitiesList.length ? JSON.stringify(entitiesList) : '[]',
        extraction.summary ?? null,
        extraction.importance ?? row.importance ?? 0.5,
        extraction.sentiment ?? row.sentiment ?? 'neutral',
        now(),
        row.id,
      );
      if (entitiesList.length) upsertEntities(db, entitiesList, row.id, row.timestamp);
      doneCount += 1;
      afterId = row.id;
      setCheckpoint.run(afterId, doneCount, now());
    });
    tx();
    processed += 1;
    console.log(`[tier2] ${row.id}: entities=${entitiesList.length} (${doneCount}/${totalPending})`);
  };

  while (true) {
    const batchLimit =
      opts.limit > 0 ? Math.min(opts.batchSize, opts.limit - processed) : opts.batchSize;
    if (batchLimit <= 0) break;
    const batch = selectCandidates(db, afterId, batchLimit, opts.filter);
    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        await processRow(row);
      } catch (err) {
        console.error(`[tier2] failed ${row.id}:`, err);
        db.prepare(
          `UPDATE messages_raw SET entities_json = '[]', updated_at = ? WHERE id = ?`,
        ).run(now(), row.id);
        afterId = row.id;
        doneCount += 1;
        setCheckpoint.run(afterId, doneCount, now());
      }
      if (opts.pauseMs > 0) {
        await new Promise((r) => setTimeout(r, opts.pauseMs));
      }
      if (opts.limit > 0 && processed >= opts.limit) break;
    }
    if (opts.limit > 0 && processed >= opts.limit) break;
  }

  let gapFillBatches = 0;
  while (true) {
    const batchLimit =
      opts.limit > 0 ? Math.min(opts.batchSize, opts.limit - processed) : opts.batchSize;
    if (batchLimit <= 0) break;
    const gapBatch = selectCandidates(db, null, batchLimit, opts.filter);
    if (gapBatch.length === 0) break;
    gapFillBatches += 1;
    for (const row of gapBatch) {
      try {
        await processRow(row);
      } catch (err) {
        console.error(`[tier2] gap-fill failed ${row.id}:`, err);
        afterId = row.id;
        doneCount += 1;
        setCheckpoint.run(afterId, doneCount, now());
      }
      if (opts.pauseMs > 0) {
        await new Promise((r) => setTimeout(r, opts.pauseMs));
      }
      if (opts.limit > 0 && processed >= opts.limit) break;
    }
    console.log(`[tier2] gap-fill batch ${gapFillBatches}: +${gapBatch.length}`);
    if (opts.limit > 0 && processed >= opts.limit) break;
  }

  db.close();
  console.log(`[tier2] done processed=${processed} total_done=${doneCount} gap_fill_batches=${gapFillBatches}`);
}

main().catch((err) => {
  console.error('[tier2] fatal:', err);
  process.exit(1);
});
