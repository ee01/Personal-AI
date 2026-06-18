import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';

/**
 * SynonymEdgeService (P0-3 P1): nightly generation of `synonym_of` graph edges
 * so PPR associative recall survives entity-name drift ("MTR 项目" / "MTR-148115"
 * / "地铁项目"). It writes `relationships(relation_type='synonym_of', strength=0.5,
 * context='consolidation_synonym')`, which the PPR BFS expansion already picks up
 * (no recall-side change needed).
 *
 * Strategy, cheapest signal first (plan: "先合并 alias 命中再算嵌入"):
 *  1. Normalized-name / alias collisions — deterministic, zero LLM cost.
 *  2. Embedding similarity ≥ threshold, but only among entities that share a
 *     normalized token (token-bucketing keeps it from being O(n²)).
 *
 * Idempotent: an existing synonym edge between a pair is never duplicated.
 */

export interface SynonymRollupResult {
  /** entities considered */
  entities: number;
  /** new synonym_of edges written this run */
  edgesAdded: number;
  /** whether the embedding pass ran (false when embeddings unavailable) */
  usedEmbeddings: boolean;
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  aliases_json: string | null;
  mention_count: number | null;
}

const DEFAULT_MAX_ENTITIES = 800;
const DEFAULT_SIM_THRESHOLD = 0.85;

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-_./\\]+/g, '')
    .replace(/[（）()【】\[\]「」“”"'`,，。;；:：!！?？]/g, '')
    .trim();
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[\s\-_./\\（）()【】\[\]「」、,，。;；:：]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class SynonymEdgeService {
  constructor(private db: Database.Database) {}

  private aliasesOf(row: EntityRow): string[] {
    if (!row.aliases_json) return [];
    try {
      const parsed = JSON.parse(row.aliases_json);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  /** True if a synonym edge already exists between the pair (either direction). */
  private edgeExists(a: string, b: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM relationships
          WHERE relation_type = 'synonym_of'
            AND ((from_entity_id = ? AND to_entity_id = ?)
              OR (from_entity_id = ? AND to_entity_id = ?))
          LIMIT 1`,
      )
      .get(a, b, b, a);
    return !!row;
  }

  private insertEdge(a: string, b: string, nowTs: number): void {
    this.db
      .prepare(
        `INSERT INTO relationships
           (from_entity_id, to_entity_id, relation_type, strength, co_occurrence_count,
            evidence_message_ids_json, context, created_at, updated_at)
         VALUES (?, ?, 'synonym_of', 0.5, 1, '[]', 'consolidation_synonym', ?, ?)`,
      )
      .run(a, b, nowTs, nowTs);
  }

  async generate(
    options: { maxEntities?: number; similarityThreshold?: number; useEmbeddings?: boolean } = {},
  ): Promise<SynonymRollupResult> {
    const maxEntities = options.maxEntities ?? DEFAULT_MAX_ENTITIES;
    const threshold = options.similarityThreshold ?? DEFAULT_SIM_THRESHOLD;
    const nowTs = now();

    const entities = this.db
      .prepare(
        `SELECT id, type, name, aliases_json, mention_count
           FROM entities
          WHERE status = 'active'
          ORDER BY mention_count DESC
          LIMIT ?`,
      )
      .all(maxEntities) as EntityRow[];

    let edgesAdded = 0;
    const linked = new Set<string>(); // pair-key guard within this run
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    const tryLink = (a: string, b: string): void => {
      if (a === b) return;
      const key = pairKey(a, b);
      if (linked.has(key)) return;
      if (this.edgeExists(a, b)) {
        linked.add(key);
        return;
      }
      this.insertEdge(a, b, nowTs);
      linked.add(key);
      edgesAdded++;
    };

    // Pass 1: normalized-name / alias collisions (deterministic).
    // Map normalized surface form -> entity ids that present it (name or alias).
    const formToIds = new Map<string, string[]>();
    for (const e of entities) {
      const forms = new Set<string>([normalizeName(e.name), ...this.aliasesOf(e).map(normalizeName)]);
      for (const f of forms) {
        if (!f) continue;
        const arr = formToIds.get(f) ?? [];
        arr.push(e.id);
        formToIds.set(f, arr);
      }
    }
    for (const ids of formToIds.values()) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          tryLink(ids[i], ids[j]);
        }
      }
    }

    // Pass 2: embedding similarity within shared-token buckets.
    let usedEmbeddings = false;
    if (options.useEmbeddings !== false) {
      try {
        const client = await EmbeddingClient.getInstance();
        // Token bucket -> candidate entity ids (bounded fan-out).
        const tokenBuckets = new Map<string, string[]>();
        for (const e of entities) {
          for (const tok of new Set(tokenize(e.name))) {
            const arr = tokenBuckets.get(tok) ?? [];
            if (arr.length < 40) arr.push(e.id);
            tokenBuckets.set(tok, arr);
          }
        }
        // Collect candidate unordered pairs that share at least one token.
        const candidatePairs = new Set<string>();
        for (const ids of tokenBuckets.values()) {
          if (ids.length < 2) continue;
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              const k = pairKey(ids[i], ids[j]);
              if (!linked.has(k)) candidatePairs.add(k);
            }
          }
        }
        if (candidatePairs.size > 0) {
          const byId = new Map(entities.map((e) => [e.id, e] as const));
          const embCache = new Map<string, number[]>();
          const embOf = async (id: string): Promise<number[] | null> => {
            if (embCache.has(id)) return embCache.get(id)!;
            const e = byId.get(id);
            if (!e) return null;
            try {
              const v = await client.embed(e.name);
              embCache.set(id, v);
              return v;
            } catch {
              return null;
            }
          };
          usedEmbeddings = true;
          // Cap total embedding work for safety.
          let budget = 2000;
          for (const k of candidatePairs) {
            if (budget-- <= 0) break;
            const [a, b] = k.split('|');
            if (this.edgeExists(a, b)) {
              linked.add(k);
              continue;
            }
            const ea = await embOf(a);
            const eb = await embOf(b);
            if (!ea || !eb) continue;
            if (cosine(ea, eb) >= threshold) tryLink(a, b);
          }
        }
      } catch {
        // Embeddings unavailable — deterministic pass already ran.
        usedEmbeddings = false;
      }
    }

    return { entities: entities.length, edgesAdded, usedEmbeddings };
  }
}
