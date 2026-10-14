/**
 * v3 UnitRecallReader (memory-foundation plan §7/§11.7, P2 slice 1):
 * reads the v3 truth plane (memory_units + projections) for dual-read
 * shadow comparison against the legacy chunk/message recall.
 *
 * Hard invariants encoded here (plan §4.2/§7.2/§7.5):
 *   I6  retracted/quarantined/deletion_pending/archived units never return
 *       (status gate via JOIN — a projection row alone is not enough).
 *   I8  results are unit-deduplicated by construction (one row per unit).
 *   I11 reader is SHADOW-only: no access reinforcement, no exposure records.
 *
 * Channels (P0.5 adjudicated):
 *   - lexical-segment (porter, unit_views_fts_seg over segmented text)
 *   - lexical-trigram (unit_views_fts_tri, CJK substring recall; +5.2pp CI)
 *   - vector deferred: units corpus is still small (P1 shadow); e5-small is
 *     the adjudicated candidate (§11.5) and joins as a channel when
 *     unit_views_vec lands.
 */

import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { rerankDeepRecall } from './DeepRecallReranker.js';

export interface UnitRecallCandidate {
  unitId: string;
  kind: string;
  text: string;
  language: string | null;
  observedAt: number | null;
  status: string;
  /** Channels that surfaced this unit (per-unit best rank per channel). */
  channels: string[];
  score: number;
}

export interface UnitRecallResult {
  candidates: UnitRecallCandidate[];
  channelStats: { channel: string; candidateCount: number }[];
  queryTimeMs: number;
}

/** Statuses that may participate in recall (§4.3). */
const RECALLABLE_STATUSES = "('provisional', 'active', 'disputed')";

/**
 * F5 fix (reviewed-plan §3.1): server-side policy context that the reader
 * must receive before being wired into user-visible paths.
 */
export interface ReadPolicyContext {
  /** Evaluation reads must not pollute production rollout statistics. */
  recordMetrics?: boolean;
  egressDestination?: 'local' | 'llm';
  ownerUserId?: string;
  tenantId?: string;
  accessibilityMode?: 'active' | 'passive';
  /** Restrict to specific scope locator (e.g. 'work'). Null = no scope filter. */
  scopeLocator?: string | null;
  /** Maximum sensitivity the caller may see. Higher levels are filtered. */
  maxSensitivity?: 'public' | 'internal' | 'private' | 'restricted';
  /** Only return units with at least one source in these evidence classes. */
  allowedEvidenceClasses?: string[] | null;
  /** Temporal query mode: current facts vs historical vs audit. */
  temporalMode?: 'current' | 'historical' | 'audit';
  /** For historical/audit: return facts valid at this epoch time. */
  asOfValid?: number | null;
}

const SENSITIVITY_RANK = { public: 0, internal: 1, private: 2, restricted: 3 };

export class UnitRecallReader {
  constructor(private readonly db: Database.Database) {}

  /**
   * Async read: lexical channels + the e5 vector channel when enabled.
   * Same fusion/dedup/status rules as recall().
   */
  async recallAsync(queryText: string, limit = 20, policy?: ReadPolicyContext): Promise<UnitRecallResult> {
    const { getUnitVectorChannel, embedWithE5 } = await import(
      './UnitEmbeddingWorker.js'
    );
    if (getUnitVectorChannel() === 'e5') {
      try {
        const started = Date.now();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const embedding = await Promise.race([
          embedWithE5(queryText,'query:'),
          new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('v3_vector_read_deadline')),400);}),
        ]).finally(()=>{if(timeout)clearTimeout(timeout);});
        const rows = this.db
          .prepare(
            `SELECT v.view_id, v.unit_id
             FROM unit_views_vec_e5 vec
             JOIN memory_unit_views v ON v.view_id = vec.view_id
             JOIN memory_units u ON u.id = v.unit_id
             WHERE u.status IN ${RECALLABLE_STATUSES}
             ORDER BY vec_distance_cosine(vec.embedding, ?)
             LIMIT 50`,
          )
          .all(JSON.stringify(embedding)) as Array<{ view_id: number; unit_id: string }>;
        const map = new Map<string, number>();
        rows.forEach((r, idx) => {
          if (!map.has(r.unit_id)) map.set(r.unit_id, idx);
        });
        if (map.size > 0) {
          const precomputed = new Map<string, Map<string, number>>([
            ['vector_e5', map],
          ]);
          return this.recall(queryText, limit, precomputed, policy);
        }
      } catch (err) {
        console.warn(
          '[UnitRecallReader] vector_e5 channel failed (degrading to lexical-only):',
          (err as Error).message,
        );
      }
    }
    return this.recall(queryText, limit, undefined, policy);
  }

  recall(
    queryText: string,
    limit = 20,
    precomputedChannels?: Map<string, Map<string, number>>,
    policy?: ReadPolicyContext,
  ): UnitRecallResult {
    const policyGate = policy ?? {};
    const started = Date.now();
    const perChannel = new Map<string, Map<string, number>>(); // channel → unitId → rank
    this.entityChannel(queryText,perChannel,policyGate);

    this.lexicalChannel(
      'lexical_seg',
      'unit_views_fts_seg',
      sanitizeSegQuery(queryText),
      perChannel,
    );
    this.lexicalChannel(
      'lexical_tri',
      'unit_views_fts_tri',
      buildTriFtsQuery(queryText),
      perChannel,
    );
    // e5 vector channel (P2 slice 2): prefetched by recallAsync (async embed),
    // passed in as unit-id → rank. I6 status gate was applied in SQL there
    // and is re-applied at hydration below.
    if (precomputedChannels) {
      for (const [channel, map] of precomputedChannels) {
        if (map.size > 0) perChannel.set(channel, map);
      }
    }

    // RRF across channels; per-unit dedup is inherent (unit-keyed).
    const rrfK = 60;
    const fused = new Map<string, { channels: string[]; score: number }>();
    for (const [channel, units] of perChannel) {
      for (const [unitId, rank] of units) {
        const entry = fused.get(unitId) ?? { channels: [], score: 0 };
        entry.channels.push(channel);
        entry.score += 1 / (rrfK + rank + 1);
        fused.set(unitId, entry);
      }
    }

    const top = [...fused.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      ;

    const metaStmt = this.db.prepare(
      `SELECT kind, text, language, observed_at, status, scope_locator, sensitivity,tenant_id,owner_user_id,egress_policy,
              valid_from, valid_to
       FROM memory_units WHERE id = ?`,
    );
    const candidates: UnitRecallCandidate[] = [];
    for (const [unitId, entry] of top) {
      const row = metaStmt.get(unitId) as
        | {
            kind: string; text: string; language: string | null;
            observed_at: number | null; status: string;
            scope_locator: string | null; sensitivity: string;
            valid_from: number | null; valid_to: number | null;
            tenant_id: string; owner_user_id: string;
            egress_policy: string;
          }
        | undefined;
      if (!row) continue;
      // Re-verify status at read time (I6: projection can lag truth).
      if (!['provisional', 'active', 'disputed'].includes(row.status)) continue;
      if (policyGate.ownerUserId && row.owner_user_id!==policyGate.ownerUserId) continue;
      if (policyGate.tenantId && row.tenant_id!==policyGate.tenantId) continue;
      if (policyGate.egressDestination==='llm' && row.egress_policy!=='approved_destinations') continue;
      if (policyGate.allowedEvidenceClasses?.length && !this.db.prepare(`SELECT 1 FROM memory_unit_sources WHERE unit_id=?
        AND evidence_class IN (${policyGate.allowedEvidenceClasses.map(()=>'?').join(',')}) LIMIT 1`).get(unitId,...policyGate.allowedEvidenceClasses)) continue;
      if (policyGate.accessibilityMode==='passive') {
        const lifecycle=this.db.prepare('SELECT accessibility_tier FROM unit_lifecycle WHERE unit_id=?').get(unitId) as {accessibility_tier:string}|undefined;
        if (lifecycle?.accessibility_tier==='archived') continue;
      }

      // F5 fix: scope gate — filter by scope_locator when policy specifies it.
      if (policyGate.scopeLocator != null && row.scope_locator !== policyGate.scopeLocator) {
        continue;
      }

      // F5 fix: sensitivity gate — filter out more-sensitive-than-allowed items.
      if (
        policyGate.maxSensitivity &&
        SENSITIVITY_RANK[(row.sensitivity as keyof typeof SENSITIVITY_RANK) ?? 'internal']
          > SENSITIVITY_RANK[policyGate.maxSensitivity]
      ) {
        continue;
      }

      // F5 fix: temporal gate — current mode checks valid_from/to is active now.
      if (policyGate.temporalMode === 'current') {
        const nowSec = Math.floor(Date.now() / 1000);
        if (row.valid_from != null && row.valid_from > nowSec) continue;
        if (row.valid_to != null && row.valid_to <= nowSec) continue;
      } else if (policyGate.temporalMode === 'historical' && policyGate.asOfValid != null) {
        const t = policyGate.asOfValid;
        if (row.valid_from != null && row.valid_from > t) continue;
        if (row.valid_to != null && row.valid_to <= t) continue;
      }
      candidates.push({
        unitId,
        kind: row.kind,
        text: row.text,
        language: row.language,
        observedAt: row.observed_at,
        status: row.status,
        channels: entry.channels,
        score: Number(entry.score.toFixed(6)),
      });
      if (candidates.length>=Math.max(1,limit)) break;
    }

    return {
      candidates,
      channelStats: [...perChannel.entries()].map(([channel, units]) => ({
        channel,
        candidateCount: units.size,
      })),
      queryTimeMs: Date.now() - started,
    };
  }

  /** Exact entity/alias anchoring is independent of embedding and text similarity. */
  private entityChannel(query: string, channels: Map<string,Map<string,number>>, policy: ReadPolicyContext) {
    const q=query.toLowerCase();
    const kinship=/女儿|儿子|孩子|\b(?:daughter|son|child|children)\b/i.test(query);
    const contains=(name:string) => /^[a-z0-9._-]+$/i.test(name)
      ? new RegExp(`(^|[^a-z0-9_])${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^a-z0-9_])`,'i').test(query)
      : q.includes(name.toLowerCase());
    const entities=this.db.prepare("SELECT id,name,aliases_json FROM entities WHERE status='active'").all() as Array<{id:string;name:string;aliases_json:string|null}>;
    const keys=new Set<string>();
    for (const e of entities) {
      let aliases:string[]=[];
      try { const parsed=JSON.parse(e.aliases_json??'[]'); if(Array.isArray(parsed)) aliases=parsed.filter(x=>typeof x==='string'); } catch { /* no identity from malformed JSON */ }
      const names=[e.name,...aliases].filter(n=>n.trim().length>=2 || kinship && /^[A-Z]$/.test(n) && query.includes(n));
      if (names.some(contains)) { keys.add(e.id);names.forEach(n=>keys.add(n)); }
    }
    if(kinship) {
      const parents=entities.filter(e=>keys.has(e.id)).map(e=>e.id);
      for(const parent of parents) {
        const relations=this.db.prepare(`SELECT to_entity_id AS child,relation_type AS relationType FROM relationships WHERE from_entity_id=?
          AND relation_type IN ('parent_of','has_child','has_daughter','has_son','father_of','mother_of') AND valid_to IS NULL
          UNION SELECT from_entity_id AS child,relation_type AS relationType FROM relationships WHERE to_entity_id=?
          AND relation_type IN ('child_of','daughter_of','son_of') AND valid_to IS NULL`).all(parent,parent) as Array<{child:string;relationType:string}>;
        for(const {child,relationType} of relations) {
          const entity=entities.find(e=>e.id===child);
          const daughter=/女儿|\bdaughter\b/i.test(query),son=/儿子|\bson\b/i.test(query);
          if(daughter&&!son && !['has_daughter','daughter_of'].includes(relationType) && !/女儿|\bdaughter\b/i.test(entity?.name??'')) continue;
          if(son&&!daughter && !['has_son','son_of'].includes(relationType) && !/儿子|\bson\b/i.test(entity?.name??'')) continue;
          keys.add(child);if(entity) keys.add(entity.name);
        }
      }
    }
    // Named subject keys also work before entity projection catches up.
    const rows=this.db.prepare(`SELECT id,subject_key FROM memory_units WHERE status IN ${RECALLABLE_STATUSES}
      AND (? IS NULL OR owner_user_id=?) AND (? IS NULL OR tenant_id=?) ORDER BY observed_at DESC,created_at DESC`).all(
        policy.ownerUserId??null,policy.ownerUserId??null,policy.tenantId??null,policy.tenantId??null) as Array<{id:string;subject_key:string|null}>;
    const map=new Map<string,number>();
    for(const r of rows) if(r.subject_key && (keys.has(r.subject_key)||r.subject_key.length>=2 && contains(r.subject_key))) map.set(r.id,map.size);
    if(map.size) channels.set('entity_anchor',map);
  }

  async recallLanes(query: string, limit: number, options: {policy?:ReadPolicyContext;explicitDeep?:boolean;deepQuestion?:boolean}={}) {
    const started=Date.now();
    const finish = (result: UnitRecallResult & {lane:'fast'|'deep';escalated:boolean}) => {
      if(options.policy?.ownerUserId && options.policy.recordMetrics!==false) {
        try {
        this.db.prepare(`INSERT INTO recall_lane_metrics(owner_user_id,tenant_id,surface,lane,elapsed_ms,candidate_count,created_at,traffic_class)
          VALUES (?,?,?,?,?,?,?,'production')`).run(options.policy.ownerUserId,options.policy.tenantId??'default',
            options.policy.accessibilityMode==='passive'?'passive':'active',result.lane,Date.now()-started,result.candidates.length,Math.floor(Date.now()/1000));
        this.db.prepare('DELETE FROM recall_lane_metrics WHERE created_at<?').run(Math.floor(Date.now()/1000)-30*86400);
        } catch {
          // Observability must never fail retrieval during a concurrent writer.
        }
      }
      return {...result,queryTimeMs:Date.now()-started};
    };
    const fast=await this.recallAsync(query,limit,options.policy);
    const strong=fast.candidates.some(c=>c.status==='active' && (c.channels.includes('entity_anchor') || c.channels.length>=2));
    if (options.policy?.accessibilityMode==='passive' || !(options.explicitDeep || options.deepQuestion && !strong)) {
      return finish({...fast,lane:'fast',escalated:false});
    }
    // Bounded deterministic decomposition and temporal expansion. Every read
    // uses the same ACL/status gates; deep failure returns the fast evidence.
    try {
      const pieces=query.split(/[。？！?;；\n]/).map(s=>s.trim()).filter(Boolean).slice(0,3);
      pieces.push(query.replace(/(?:去年|前年|今年|三年前|上个月|最近|last year|last month|recently)/gi,' ').trim());
      const results=pieces.map(q=>this.recall(q,limit,undefined,options.policy));
      // Expand at most two explicit relationship hops. Every intermediate
      // entity must have readable evidence under the same policy; no hidden
      // intermediary is used to bridge into an otherwise allowed result.
      const seen = new Set<string>();
      let frontier = [...new Set(fast.candidates.flatMap(c=>{
        const r=this.db.prepare('SELECT subject_key FROM memory_units WHERE id=?').get(c.unitId) as {subject_key:string|null};
        return r.subject_key?[r.subject_key]:[];
      }))].slice(0,20);
      const graph = new Map<string,number>();
      for(let depth=0;depth<2 && frontier.length;depth++) {
        const next:string[]=[];
        for(const entity of frontier) {
          if(seen.has(entity)) continue;
          seen.add(entity);
          const edges=this.db.prepare(`SELECT to_entity_id AS id,relation_type AS type FROM relationships WHERE from_entity_id=? AND valid_to IS NULL
            UNION SELECT from_entity_id AS id,relation_type AS type FROM relationships WHERE to_entity_id=? AND valid_to IS NULL LIMIT 20`).all(entity,entity) as Array<{id:string;type:string}>;
          for(const edge of edges) {
            if(/女儿|\bdaughter\b/i.test(query) && !/儿子|\bson\b/i.test(query) && ['has_son','son_of'].includes(edge.type)) continue;
            if(/儿子|\bson\b/i.test(query) && !/女儿|\bdaughter\b/i.test(query) && ['has_daughter','daughter_of'].includes(edge.type)) continue;
            const units=this.db.prepare(`SELECT id FROM memory_units WHERE subject_key=? AND status IN ${RECALLABLE_STATUSES} LIMIT 50`).all(edge.id) as Array<{id:string}>;
            const channel=new Map(units.map((u,i)=>[u.id,i]));
            const allowed=this.recall('',50,new Map([['graph_deep',channel]]),options.policy);
            if(!allowed.candidates.length) continue;
            for(const c of allowed.candidates) if(graph.size<100 && !graph.has(c.unitId)) graph.set(c.unitId,graph.size);
            if(!seen.has(edge.id) && next.length<20) next.push(edge.id);
          }
        }
        frontier=[...new Set(next)];
      }
      results.push(this.recall('',Math.max(limit,20),new Map([['graph_deep',graph]]),options.policy));
      const candidates=new Map<string,{candidate:UnitRecallCandidate;score:number}>();
      for(const r of [fast,...results]) r.candidates.forEach((c,rank)=>{
        const entry=candidates.get(c.unitId)??{candidate:c,score:0};entry.score+=1/(60+rank);candidates.set(c.unitId,entry);
      });
      const merged=[...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,Math.max(limit,20)).map(e=>e.candidate);
      const ranked=await rerankDeepRecall(query,merged,options.policy);
      return finish({...fast,candidates:ranked.slice(0,limit),lane:'deep',escalated:true});
    } catch { return finish({...fast,lane:'fast',escalated:false}); }
  }

  /**
   * Lexical channel over a unit-views FTS table. External content joins back
   * through memory_unit_views → memory_units; the status gate happens in SQL
   * (§5.4: FTS joins to the truth table for status filtering) and again at
   * hydration time.
   */
  private lexicalChannel(
    channel: string,
    table: string,
    ftsQuery: string,
    perChannel: Map<string, Map<string, number>>,
  ): void {
    if (!ftsQuery) return;
    let rows: Array<{ unit_id: string }> = [];
    try {
      rows = this.db
        .prepare(
          `SELECT v.unit_id
           FROM ${table} f
           JOIN memory_unit_views v ON v.view_id = f.rowid
           JOIN memory_units u ON u.id = v.unit_id
           WHERE ${table} MATCH ?
             AND u.status IN ${RECALLABLE_STATUSES}
           ORDER BY rank
           LIMIT 50`,
        )
        .all(ftsQuery) as Array<{ unit_id: string }>;
    } catch (err) {
      // Missing table/tokenizer must degrade, never break the shadow probe.
      console.warn(`[UnitRecallReader] ${channel} failed:`, (err as Error).message);
      return;
    }
    const map = perChannel.get(channel) ?? new Map<string, number>();
    rows.forEach((row, idx) => {
      if (!map.has(row.unit_id)) map.set(row.unit_id, idx);
    });
    perChannel.set(channel, map);
  }
}

function sanitizeSegQuery(query: string): string {
  const cleaned = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((t) => `"${t}"`).join(' OR ');
}

/** CJK 4-gram sliding windows + latin fragments, OR-joined (same as shadow). */
function buildTriFtsQuery(queryText: string): string {
  const cleaned = queryText.replace(/["'^\-:()\[\]{}*+]/g, ' ').trim();
  if (!cleaned.length) return '';
  const fragments: string[] = [];
  for (const token of cleaned.match(/[\u3400-\u9fff]{3,}|[a-zA-Z0-9][a-zA-Z0-9._:-]{2,}/gu) ?? []) {
    if (!/[\u3400-\u9fff]/.test(token) || token.length <= 6) {
      fragments.push(token);
      continue;
    }
    for (let i = 0; i + 4 <= token.length && fragments.length < 10; i += 1) {
      fragments.push(token.slice(i, i + 4));
    }
  }
  if (fragments.length === 0) return '';
  return fragments.slice(0, 10).map((f) => JSON.stringify(f)).join(' OR ');
}

/** Deterministic request id for shadow diff correlation. */
export function shadowRequestId(query: string, ts = Date.now()): string {
  return createHash('sha256').update(`${ts}:${query}`).digest('hex').slice(0, 16);
}
