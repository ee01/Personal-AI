import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { getLLMClient } from '../llm/LLMClient.js';

/**
 * MergeDecisionService (P1-6 slice A): chunk-level write decision. When a freshly
 * indexed chunk has a high-similarity neighbor (cos >= 0.86, below the 0.92
 * denoise threshold to leave decision room), an LLM decides:
 *   ADD    — independent info, keep both (default / fallback)
 *   UPDATE — new is a newer version of the neighbor -> mark neighbor
 *            superseded_by=new, downgrade neighbor to weak
 *   MERGE  — complementary -> fold neighbors into the new chunk (merged_into=new),
 *            downgrade originals (kept for provenance)
 *   NOOP   — pure redundancy -> drop the new chunk's relevance, reinforce neighbor
 *
 * Never physically deletes: messages_raw and chunk rows stay; only retrieval
 * tiers and superseded_by/merged_into links move (auditable + reversible).
 */

export type MergeOp = 'ADD' | 'UPDATE' | 'MERGE' | 'NOOP';

export interface MergeNeighbor {
  chunkId: number;
  content: string;
  createdAt: number;
  source: string | null;
}

export interface MergeDecision {
  op: MergeOp;
  neighborIds: number[];
  reason: string;
}

export type MergeDecider = (
  newContent: string,
  neighbors: MergeNeighbor[],
) => Promise<MergeDecision>;

const SIMILARITY_THRESHOLD = 0.86;
const NEIGHBOR_LIMIT = 3;

export class MergeDecisionService {
  constructor(
    private db: Database.Database,
    /** Injectable for tests; defaults to an LLM-backed decider. */
    private decider: MergeDecider = defaultLlmDecider,
  ) {}

  /** Find near neighbors of the given chunk via chunks_vec. */
  async findNeighbors(chunkId: number, content: string): Promise<MergeNeighbor[]> {
    let embedding: number[];
    try {
      const client = await EmbeddingClient.getInstance();
      embedding = await client.embed(content);
    } catch {
      return [];
    }
    try {
      const rows = this.db
        .prepare(
          `SELECT v.chunk_id AS chunk_id, v.distance AS distance
             FROM chunks_vec v
            WHERE v.embedding MATCH ?
            ORDER BY v.distance
            LIMIT ?`,
        )
        .all(JSON.stringify(embedding), NEIGHBOR_LIMIT + 1) as Array<{
        chunk_id: number;
        distance: number;
      }>;
      const neighbors: MergeNeighbor[] = [];
      for (const r of rows) {
        if (r.chunk_id === chunkId) continue;
        const sim = 1 / (1 + r.distance);
        if (sim < SIMILARITY_THRESHOLD) continue;
        const chunk = this.db
          .prepare(`SELECT chunk_id, content, source, created_at, merged_into FROM chunks WHERE chunk_id = ?`)
          .get(r.chunk_id) as
          | { chunk_id: number; content: string; source: string | null; created_at: number; merged_into: number | null }
          | undefined;
        if (chunk && chunk.merged_into == null) {
          neighbors.push({
            chunkId: chunk.chunk_id,
            content: chunk.content,
            createdAt: chunk.created_at,
            source: chunk.source,
          });
        }
        if (neighbors.length >= NEIGHBOR_LIMIT) break;
      }
      return neighbors;
    } catch {
      return [];
    }
  }

  /**
   * Decide and apply the merge op for a newly created chunk. Returns the decision
   * (op 'ADD' when no neighbors / on any failure — identical to legacy behavior).
   */
  async decideAndApply(newChunkId: number, newContent: string): Promise<MergeDecision> {
    const neighbors = await this.findNeighbors(newChunkId, newContent);
    if (neighbors.length === 0) {
      return { op: 'ADD', neighborIds: [], reason: 'no_near_neighbor' };
    }
    let decision: MergeDecision;
    try {
      decision = await this.decider(newContent, neighbors);
    } catch {
      return { op: 'ADD', neighborIds: [], reason: 'decider_failed' };
    }
    this.applyDecision(newChunkId, decision);
    return decision;
  }

  private downgradeChunk(chunkId: number, nowTs: number): void {
    this.db
      .prepare(
        `INSERT INTO memory_metadata
           (target_type, target_id, retrieval_tier, created_at, updated_at, lifecycle_updated_at)
         VALUES ('chunk', ?, 'weak', ?, ?, ?)
         ON CONFLICT(target_type, target_id) DO UPDATE SET
           retrieval_tier = 'weak', updated_at = excluded.updated_at,
           lifecycle_updated_at = excluded.lifecycle_updated_at`,
      )
      .run(String(chunkId), nowTs, nowTs, nowTs);
  }

  /** Apply a decision's links/tier moves. Public for testability. */
  applyDecision(newChunkId: number, decision: MergeDecision): void {
    const nowTs = now();
    const ids = decision.neighborIds.filter((n) => Number.isFinite(n));
    const tx = this.db.transaction(() => {
      if (decision.op === 'UPDATE') {
        for (const nid of ids) {
          this.db
            .prepare(`UPDATE chunks SET superseded_by = ?, merge_reason = ? WHERE chunk_id = ?`)
            .run(newChunkId, decision.reason.slice(0, 280), nid);
          this.downgradeChunk(nid, nowTs);
        }
      } else if (decision.op === 'MERGE') {
        for (const nid of ids) {
          this.db
            .prepare(`UPDATE chunks SET merged_into = ?, merge_reason = ? WHERE chunk_id = ?`)
            .run(newChunkId, decision.reason.slice(0, 280), nid);
          this.downgradeChunk(nid, nowTs);
        }
      } else if (decision.op === 'NOOP') {
        // Pure redundancy: drop the new chunk's relevance, reinforce the neighbor.
        this.downgradeChunk(newChunkId, nowTs);
        this.db
          .prepare(`UPDATE chunks SET merged_into = ?, merge_reason = 'noop_redundant' WHERE chunk_id = ?`)
          .run(ids[0] ?? null, newChunkId);
        for (const nid of ids) {
          this.db
            .prepare(
              `UPDATE memory_metadata SET access_count = COALESCE(access_count,0) + 1, updated_at = ?
                WHERE target_type='chunk' AND target_id = ?`,
            )
            .run(nowTs, String(nid));
        }
      }
      // ADD: nothing to do.
    });
    tx();
  }
}

const MERGE_PROMPT = `你在做记忆库的"写入决策"。给你一条新记忆和若干条与它高度相似的旧记忆。
判断新记忆相对这些旧记忆应当怎么写入，只能选一个 op：
- ADD：信息相互独立，应各自保留。
- UPDATE：新记忆是某条旧记忆的"更新版"（同一对象的新状态/新数值）。
- MERGE：新旧互补，应合并成一条更完整的记忆。
- NOOP：新记忆与旧记忆纯属重复，不必新增。
只输出 JSON：{"op": "...", "neighborIds": [相关旧记忆的 chunkId], "reason": "一句中文理由"}`;

const defaultLlmDecider: MergeDecider = async (newContent, neighbors) => {
  const llm = getLLMClient();
  const neighborText = neighbors
    .map((n) => `chunkId=${n.chunkId} (来源 ${n.source ?? '未知'}): ${n.content}`)
    .join('\n');
  const prompt = `${MERGE_PROMPT}\n\n[新记忆]\n${newContent}\n\n[相似旧记忆]\n${neighborText}`;
  const parsed = await llm.generateJSON<{ op?: string; neighborIds?: number[]; reason?: string }>(prompt, {
    maxTokens: 200,
  });
  const op = (['ADD', 'UPDATE', 'MERGE', 'NOOP'] as const).includes(parsed.op as MergeOp)
    ? (parsed.op as MergeOp)
    : 'ADD';
  const neighborIds = Array.isArray(parsed.neighborIds)
    ? parsed.neighborIds.filter((x): x is number => typeof x === 'number')
    : neighbors.map((n) => n.chunkId);
  return { op, neighborIds: op === 'ADD' ? [] : neighborIds, reason: parsed.reason || op };
};
