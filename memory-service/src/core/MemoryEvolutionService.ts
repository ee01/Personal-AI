import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';

/**
 * MemoryEvolutionService (P1-6 slice B): A-MEM style re-consolidation run nightly.
 * For each of the day's new chunks it finds older near-neighbors and records
 * associative `memory_links` (which also feed PPR chunk-association and weave),
 * and — when a neighbor is the same message's earlier summary — appends an
 * evolution note to the message summary while recording a `chunk_revisions`
 * audit row.
 *
 * The original chunk content is NEVER rewritten — only derived layers (links,
 * message summaries) evolve, and every summary change is auditable/reversible.
 */

export interface EvolutionResult {
  newChunks: number;
  linksAdded: number;
  revisions: number;
}

const NEIGHBOR_LIMIT = 5;
const SIMILARITY_THRESHOLD = 0.8;
const DAILY_BUDGET = 50;

export class MemoryEvolutionService {
  constructor(private db: Database.Database) {}

  private hasTable(name: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`)
      .get(name);
    return !!row;
  }

  private linkExists(from: number, to: number): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM memory_links
          WHERE (from_chunk_id = ? AND to_chunk_id = ?)
             OR (from_chunk_id = ? AND to_chunk_id = ?) LIMIT 1`,
      )
      .get(from, to, to, from);
    return !!row;
  }

  /** Run evolution over chunks created since `sinceTs` (default last 24h). */
  async run(sinceTs?: number): Promise<EvolutionResult> {
    const result: EvolutionResult = { newChunks: 0, linksAdded: 0, revisions: 0 };
    if (!this.hasTable('memory_links')) return result;
    const since = sinceTs ?? now() - 86400;

    const newChunks = this.db
      .prepare(
        `SELECT chunk_id, content, related_entity_id
           FROM chunks
          WHERE created_at >= ? AND merged_into IS NULL
          ORDER BY created_at DESC
          LIMIT ?`,
      )
      .all(since, DAILY_BUDGET) as Array<{
      chunk_id: number;
      content: string;
      related_entity_id: string | null;
    }>;
    result.newChunks = newChunks.length;
    if (newChunks.length === 0) return result;

    let client: Awaited<ReturnType<typeof EmbeddingClient.getInstance>> | null = null;
    try {
      client = await EmbeddingClient.getInstance();
    } catch {
      return result; // no embeddings -> no evolution this run
    }

    const nowTs = now();
    const insertLink = this.db.prepare(
      `INSERT OR IGNORE INTO memory_links (from_chunk_id, to_chunk_id, reason, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const insertRevision = this.db.prepare(
      `INSERT INTO chunk_revisions (chunk_id, old_summary, new_summary, reason, evidence_chunk_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const nc of newChunks) {
      let embedding: number[];
      try {
        embedding = await client.embed(nc.content);
      } catch {
        continue;
      }
      let neighbors: Array<{ chunk_id: number; distance: number }>;
      try {
        neighbors = this.db
          .prepare(
            `SELECT chunk_id, distance FROM chunks_vec
              WHERE embedding MATCH ? ORDER BY distance LIMIT ?`,
          )
          .all(JSON.stringify(embedding), NEIGHBOR_LIMIT + 1) as typeof neighbors;
      } catch {
        continue;
      }

      for (const nb of neighbors) {
        if (nb.chunk_id === nc.chunk_id) continue;
        const sim = 1 / (1 + nb.distance);
        if (sim < SIMILARITY_THRESHOLD) continue;
        if (this.linkExists(nc.chunk_id, nb.chunk_id)) continue;

        insertLink.run(nc.chunk_id, nb.chunk_id, 'evolution_assoc', nowTs);
        result.linksAdded += 1;

        // Evolve the related message summary when the neighbor belongs to the
        // same message (a later observation about the same subject).
        const neighbor = this.db
          .prepare(`SELECT related_entity_id FROM chunks WHERE chunk_id = ?`)
          .get(nb.chunk_id) as { related_entity_id: string | null } | undefined;
        if (
          neighbor?.related_entity_id &&
          nc.related_entity_id &&
          neighbor.related_entity_id !== nc.related_entity_id
        ) {
          const msg = this.db
            .prepare(`SELECT summary FROM messages_raw WHERE id = ?`)
            .get(neighbor.related_entity_id) as { summary: string | null } | undefined;
          const note = `（后续关联：${new Date(nowTs * 1000).toISOString().slice(0, 10)} 有新记忆补充）`;
          const oldSummary = msg?.summary ?? null;
          if (msg && (oldSummary == null || !oldSummary.includes(note))) {
            const newSummary = `${oldSummary ?? ''}${note}`.slice(0, 2000);
            this.db
              .prepare(`UPDATE messages_raw SET summary = ?, updated_at = ? WHERE id = ?`)
              .run(newSummary, nowTs, neighbor.related_entity_id);
            insertRevision.run(
              nb.chunk_id,
              oldSummary,
              newSummary,
              'evolution_followup',
              nc.chunk_id,
              nowTs,
            );
            result.revisions += 1;
          }
        }
      }
    }
    return result;
  }
}
