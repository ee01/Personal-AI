import type Database from 'better-sqlite3';
import type { ReconcileUnit } from './ReconcileTruth.js';

/** Truth candidates are a UNION, never recall's RRF Top-K. Same-key slots
 * are exhaustive; each projection channel independently contributes Top-m. */
export function truthCandidates(db: Database.Database, unit: ReconcileUnit, topM=10): ReconcileUnit[] {
  const canonical = (key:string|null) => (db.prepare(`SELECT canonical_entity_id FROM reconcile_entity_aliases WHERE alias_entity_id=?
    UNION SELECT canonical_entity_id FROM reconcile_subject_aliases WHERE alias_key=? LIMIT 1`).get(key,key?.toLowerCase().trim()) as {canonical_entity_id:string}|undefined)?.canonical_entity_id??key;
  const subject=canonical(unit.subject_key);
  const aliases=(db.prepare(`SELECT alias_entity_id FROM reconcile_entity_aliases WHERE canonical_entity_id=?
    UNION SELECT alias_key AS alias_entity_id FROM reconcile_subject_aliases WHERE canonical_entity_id=?`).all(subject,subject) as Array<{alias_entity_id:string}>).map(r=>r.alias_entity_id);
  const keys=[...new Set([unit.subject_key,subject,...aliases].filter((s):s is string=>!!s))];
  const allowed = (u:ReconcileUnit) => u.id!==unit.id && u.tenant_id===unit.tenant_id && u.owner_user_id===unit.owner_user_id
    && u.scope_locator===unit.scope_locator && u.sensitivity===unit.sensitivity && u.egress_policy===unit.egress_policy
    && ['active','provisional','disputed'].includes(u.status) && (u.created_at<unit.created_at || u.created_at===unit.created_at && u.id<unit.id);
  const rows = new Map<string,ReconcileUnit>();
  if(keys.length && unit.predicate_key) {
    const slots=db.prepare(`SELECT * FROM promotion_eligible_units WHERE lower(trim(subject_key)) IN (${keys.map(()=>'?').join(',')}) AND predicate_key=?
      AND tenant_id=? AND owner_user_id=? AND coalesce(scope_locator,'')=coalesce(?,'')`).all(...keys.map(k=>k.toLowerCase().trim()),unit.predicate_key,unit.tenant_id,unit.owner_user_id,unit.scope_locator) as ReconcileUnit[];
    slots.filter(allowed).forEach(u=>rows.set(u.id,u));
  }
  const query=unit.text.replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(s=>s.length>=3).slice(0,12).map(s=>JSON.stringify(s)).join(' OR ');
  for (const table of ['unit_views_fts_seg','unit_views_fts_tri']) {
    if(!query) break;
    try {
      const candidates=db.prepare(`SELECT u.* FROM ${table} f JOIN memory_unit_views v ON v.view_id=f.rowid
        JOIN promotion_eligible_units u ON u.id=v.unit_id WHERE ${table} MATCH ? AND u.tenant_id=? AND u.owner_user_id=?
        AND coalesce(u.scope_locator,'')=coalesce(?,'') AND u.sensitivity=? AND u.egress_policy=?
        AND (u.created_at<? OR u.created_at=? AND u.id<?) AND u.status IN ('active','provisional','disputed')
        GROUP BY u.id ORDER BY min(f.rank) LIMIT ?`).all(query,unit.tenant_id,unit.owner_user_id,unit.scope_locator,unit.sensitivity,unit.egress_policy,unit.created_at,unit.created_at,unit.id,topM) as ReconcileUnit[];
      candidates.filter(allowed).forEach(u=>rows.set(u.id,u));
    } catch { /* Missing FTS projection falls back to deterministic slots. */ }
  }
  // Reuse stored embeddings only within the identical model space. No online
  // embedding/LLM is needed to enumerate truth candidates.
  const view=db.prepare(`SELECT embedding,embedding_model FROM memory_unit_views WHERE unit_id=? AND embedding IS NOT NULL AND embedding_model IS NOT NULL ORDER BY source_unit_revision DESC LIMIT 1`).get(unit.id) as {embedding:string;embedding_model:string}|undefined;
  if(view) {
    try {
      const embedding=JSON.parse(view.embedding) as number[];
      const dense=db.prepare(`SELECT u.*,v.embedding FROM memory_unit_views v JOIN promotion_eligible_units u ON u.id=v.unit_id
        WHERE v.embedding_model=? AND v.embedding IS NOT NULL AND u.tenant_id=? AND u.owner_user_id=?
        AND coalesce(u.scope_locator,'')=coalesce(?,'') AND u.sensitivity=? AND u.egress_policy=?
        AND u.status IN ('active','provisional','disputed') AND (u.created_at<? OR u.created_at=? AND u.id<?)`)
        .all(view.embedding_model,unit.tenant_id,unit.owner_user_id,unit.scope_locator,unit.sensitivity,unit.egress_policy,unit.created_at,unit.created_at,unit.id) as Array<ReconcileUnit&{embedding:string}>;
      const best=new Map<string,{u:ReconcileUnit;score:number}>();
      for(const u of dense) {
        const score=cosine(embedding,JSON.parse(u.embedding));
        if(score<0.8 || !allowed(u)) continue;
        if(score>(best.get(u.id)?.score??-1)) best.set(u.id,{u,score});
      }
      [...best.values()].sort((a,b)=>b.score-a.score).slice(0,topM).forEach(({u})=>rows.set(u.id,u));
    } catch { /* Malformed vector projections cannot change truth. */ }
  }
  return [...rows.values()];
}
function cosine(a:number[],b:number[]) {
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length) return -1;
  let dot=0,x=0,y=0;
  for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i])) return -1;dot+=a[i]*b[i];x+=a[i]**2;y+=b[i]**2;}
  return x&&y?dot/Math.sqrt(x*y):-1;
}
