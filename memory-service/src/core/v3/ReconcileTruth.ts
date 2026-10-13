import type Database from 'better-sqlite3';
import { unitPromotionEligible } from '../WriteProvenanceGate.js';
import { ConfirmRequestRepository } from '../../repositories/ConfirmRequestRepository.js';

export type ReconcileDecision = 'corroborate' | 'refine' | 'supersede' | 'dispute' | 'noop';
export interface ReconcileUnit {
  id: string; tenant_id: string; owner_user_id: string; scope_locator: string | null;
  sensitivity: string; egress_policy: string; status: string; current_revision: number;
  subject_key: string | null; predicate_key: string | null; memory_form: string; kind: string;
  text: string; confidence: number; observed_at: number | null; created_at: number;
  valid_to: number | null; confirmation_state: string;
}
export interface ReconcileSource { evidence_key: string; provenance_family: string; evidence_class: string }
export function sourcesFor(db: Database.Database, id: string): ReconcileSource[] {
  return db.prepare(`SELECT evidence_key,provenance_family,evidence_class FROM memory_unit_sources
    WHERE unit_id=? AND promotion_eligible=1 ORDER BY evidence_key,provenance_family,evidence_class`).all(id) as ReconcileSource[];
}
const authority: Record<string, number> = { self_statement: 5, first_party_record: 4,
  official_source: 3, third_party_report: 2, system_inference: 1 };
function requiresConfirmation(db:Database.Database,u:ReconcileUnit) {
  const self=u.subject_key==='self'||u.subject_key===u.owner_user_id||sourcesFor(db,u.id).some(s=>s.evidence_class==='self_statement');
  const identity=/^(identity|name|birthdate|gender|nationality|姓名|生日|性别|身份)$/i.test(u.predicate_key??'');
  return u.sensitivity==='restricted'||u.confirmation_state==='user_confirmed'||self&&(u.kind==='preference'||identity);
}
export function canReplace(db: Database.Database, newer: ReconcileUnit, older: ReconcileUnit): boolean {
  if(['insight','brief'].includes(newer.kind)) return false;
  const canonical=(key:string|null) => (db.prepare(`SELECT canonical_entity_id FROM reconcile_entity_aliases WHERE alias_entity_id=?
    UNION SELECT canonical_entity_id FROM reconcile_subject_aliases WHERE alias_key=? LIMIT 1`).get(key,key?.toLowerCase().trim()) as {canonical_entity_id:string}|undefined)?.canonical_entity_id??key;
  if (!newer.subject_key || canonical(newer.subject_key)!==canonical(older.subject_key) || !newer.predicate_key || newer.predicate_key!==older.predicate_key) return false;
  const n = sourcesFor(db,newer.id), o = sourcesFor(db,older.id);
  const rank = (s: ReconcileSource[]) => Math.max(0,...s.map(x => authority[x.evidence_class] ?? 0));
  return !requiresConfirmation(db,older) && newer.observed_at != null && older.observed_at != null
    && newer.observed_at > older.observed_at && rank(n) >= rank(o) && rank(n) > 1;
}

/** Called only through UnitTruthMaintainer: SQLite CAS, receipt and snapshots in one transaction. */
export function applyReconciliation(db: Database.Database, receiptId: string, at: number): boolean {
  return db.transaction(() => {
    const receipt = db.prepare('SELECT * FROM unit_reconcile_decisions WHERE id=?').get(receiptId) as any;
    if (!receipt || receipt.state !== 'shadow') return false;
    const pair = [receipt.unit_id,receipt.candidate_unit_id].map(id => db.prepare('SELECT * FROM memory_units WHERE id=?').get(id) as ReconcileUnit);
    const [newer,older] = pair;
    const revisions = JSON.parse(receipt.expected_revisions_json) as number[];
    if (!newer || !older || JSON.stringify(pair.map(u=>sourcesFor(db,u.id)))!==receipt.evidence_keys_json || pair.some((u,i) => u.current_revision !== revisions[i]
      || !['active','provisional','disputed'].includes(u.status) || !unitPromotionEligible(db,u.id))
      || newer.tenant_id !== older.tenant_id || newer.owner_user_id !== older.owner_user_id
      || newer.scope_locator !== older.scope_locator || newer.sensitivity !== older.sensitivity
      || newer.egress_policy !== older.egress_policy) {
      db.prepare("UPDATE unit_reconcile_decisions SET state='stale' WHERE id=?").run(receiptId);
      return false;
    }
    let decision = receipt.decision as ReconcileDecision;
    if (decision === 'supersede' && !canReplace(db,newer,older)) decision = 'dispute';
    const before = JSON.stringify(pair);
    const beforeSources=JSON.stringify(pair.map(u=>db.prepare('SELECT * FROM memory_unit_sources WHERE unit_id=?').all(u.id)));
    if (decision === 'supersede') {
      db.prepare("UPDATE memory_units SET status='superseded',superseded_by=?,valid_to=? WHERE id=?")
        .run(newer.id,newer.observed_at,older.id);
      db.prepare("UPDATE memory_units SET status='active' WHERE id=?").run(newer.id);
    } else if (decision === 'dispute') {
      db.prepare("UPDATE memory_units SET status='disputed' WHERE id IN (?,?)").run(newer.id,older.id);
    } else if (decision === 'corroborate') {
      // Source rows keep their original unit attribution. Reinforcement counts
      // only genuinely new evidence AND provenance families, never exposure.
      const oldSources = sourcesFor(db,older.id), newSources = sourcesFor(db,newer.id);
      const keys = new Set(oldSources.map(s => s.evidence_key));
      const families = new Set(oldSources.map(s => s.provenance_family));
      const independent = new Set(newSources.filter(s => !keys.has(s.evidence_key) && !families.has(s.provenance_family)).map(s => s.provenance_family)).size;
      db.prepare(`INSERT OR IGNORE INTO memory_unit_sources
        (unit_id,episode_id,span_start_byte,span_end_byte,span_text_hash,source_role,evidence_key,provenance_family,origin_type,evidence_class,created_at)
        SELECT ?,episode_id,span_start_byte,span_end_byte,span_text_hash,source_role,evidence_key,provenance_family,origin_type,evidence_class,created_at
        FROM memory_unit_sources WHERE unit_id=? AND promotion_eligible=1`).run(older.id,newer.id);
      db.prepare("UPDATE memory_units SET confidence=min(0.95,confidence+?),status='active' WHERE id=?").run(independent*0.08,older.id);
      db.prepare("UPDATE memory_units SET status='superseded',superseded_by=? WHERE id=?").run(older.id,newer.id);
    } else if (decision === 'refine') {
      // Complementary claims remain independent; receipt provides the link.
      db.prepare("UPDATE memory_units SET status='active' WHERE id IN (?,?)").run(newer.id,older.id);
    }
    if (decision !== 'noop') {
      for (const unit of pair) {
        db.prepare('UPDATE memory_units SET current_revision=current_revision+1,updated_at=? WHERE id=? AND current_revision=?')
          .run(at,unit.id,unit.current_revision);
        const after = db.prepare('SELECT * FROM memory_units WHERE id=?').get(unit.id) as ReconcileUnit;
        db.prepare(`INSERT INTO memory_unit_revisions(unit_id,revision,operation,before_snapshot_json,after_snapshot_json,
          reason,actor_type,actor_id,request_id,truth_policy_version,created_at) VALUES (?,?,?,?,?,?,'system','sleep-reconcile',?,'sleep-v1',?)`)
          .run(unit.id,after.current_revision,decision,JSON.stringify(unit),JSON.stringify(after),receipt.reason,receiptId,at);
        db.prepare(`INSERT OR IGNORE INTO projection_outbox(projection_key,unit_id,view_kind,source_unit_revision,projection_config_hash,status,created_at,updated_at)
          VALUES (?,?,'body',?,'sleep-v1','pending',?,?)`).run(`sleep:${unit.id}:${after.current_revision}`,unit.id,after.current_revision,at,at);
      }
    }
    db.prepare(`UPDATE unit_reconcile_decisions SET state='applied',decision=?,before_snapshots_json=?,before_sources_json=?,after_revisions_json=? WHERE id=?`)
      .run(decision,before,beforeSources,JSON.stringify(pair.map(u => u.current_revision+(decision === 'noop'?0:1))),receiptId);
    if(decision==='dispute' && pair.some(u=>requiresConfirmation(db,u))) {
      const confirmation=new ConfirmRequestRepository(db).createOrReusePending({
        question:'这两条重要记忆存在冲突，哪一条仍然有效？',context:JSON.stringify(pair.map(u=>({unitId:u.id,text:u.text,observedAt:u.observed_at}))),
        options:[{label:'保留较早记忆',value:'keep_old'},{label:'保留较新记忆',value:'keep_new'},{label:'两条都有效',value:'both_valid'}],
        evidenceRefs:pair.map(u=>`unit:${u.id}`),category:'sleep_reconcile',routing:'decision',reasonCode:'durable_memory_conflict',sourceAnchor:receiptId,
        dedupeKey:`sleep:${receiptId}`,createdAt:at,
      });
      db.prepare('INSERT OR IGNORE INTO reconcile_confirm_links(confirm_id,decision_id,expected_revisions_json) VALUES (?,?,?)')
        .run(confirmation.record.id,receiptId,JSON.stringify(pair.map(u=>u.current_revision+1)));
    }
    return true;
  }).immediate();
}

export function resolveReconcileConfirmation(db:Database.Database,id:string,answer:string,owner:string,at:number) {
  if(!['keep_old','keep_new','both_valid'].includes(answer)) throw new Error('invalid reconciliation answer');
  return db.transaction(()=>{
    const link=db.prepare(`SELECT l.*,d.unit_id,d.candidate_unit_id,d.owner_user_id FROM reconcile_confirm_links l
      JOIN unit_reconcile_decisions d ON d.id=l.decision_id WHERE l.confirm_id=?`).get(id) as any;
    if(!link || link.owner_user_id!==owner) throw new Error('confirmation not found');
    const request=db.prepare('SELECT state FROM confirm_requests WHERE id=?').get(id) as {state:string};
    if(!['pending','snoozed'].includes(request.state)) throw new Error('confirmation already answered');
    const units=[link.unit_id,link.candidate_unit_id].map(uid=>db.prepare('SELECT * FROM memory_units WHERE id=?').get(uid) as ReconcileUnit);
    const expected=JSON.parse(link.expected_revisions_json) as number[];
    if(units.some((u,i)=>u.current_revision!==expected[i])) throw new Error('confirmation already stale; reconciliation must run again');
    for(const [i,u] of units.entries()) {
      const keep=answer==='both_valid'||(answer==='keep_new'?i===0:i===1);
      db.prepare(`UPDATE memory_units SET status=?,confirmation_state=?,current_revision=current_revision+1,updated_at=? WHERE id=?`)
        .run(keep?'active':'retracted',keep?'user_confirmed':'user_rejected',at,u.id);
      const after=db.prepare('SELECT * FROM memory_units WHERE id=?').get(u.id) as ReconcileUnit;
      db.prepare(`INSERT INTO memory_unit_revisions(unit_id,revision,operation,before_snapshot_json,after_snapshot_json,reason,actor_type,actor_id,request_id,truth_policy_version,created_at)
        VALUES (?,?,'user_confirmation',?,?,?,'user',?,?,'sleep-v1',?)`).run(u.id,after.current_revision,JSON.stringify(u),JSON.stringify(after),answer,owner,id,at);
      db.prepare(`INSERT OR IGNORE INTO projection_outbox(projection_key,unit_id,view_kind,source_unit_revision,projection_config_hash,status,created_at,updated_at)
        VALUES (?,?,'body',?,'sleep-v1','pending',?,?)`).run(`sleep:${u.id}:${after.current_revision}`,u.id,after.current_revision,at,at);
    }
    db.prepare("UPDATE confirm_requests SET state='answered',user_answer=?,answered_at=? WHERE id=?").run(answer,at,id);
  }).immediate();
}

export function revertReconciliation(db:Database.Database,id:string,at:number):boolean {
  return db.transaction(()=>{
    const r=db.prepare("SELECT * FROM unit_reconcile_decisions WHERE id=? AND state='applied'").get(id) as any;
    if(!r) return false;
    const before=JSON.parse(r.before_snapshots_json) as Array<ReconcileUnit&{superseded_by:string|null}>;
    const expected=JSON.parse(r.after_revisions_json) as number[];
    const current=before.map(u=>db.prepare('SELECT * FROM memory_units WHERE id=?').get(u.id) as ReconcileUnit);
    if(current.some((u,i)=>u.current_revision!==expected[i])) return false;
    const originalSources=JSON.parse(r.before_sources_json) as any[][];
    for(const [i,u] of before.entries()) {
      if(r.decision==='corroborate') {
        const keys=new Set(originalSources[i].map(s=>JSON.stringify([s.episode_id,s.span_start_byte,s.span_end_byte,s.source_role])));
        const sources=db.prepare('SELECT * FROM memory_unit_sources WHERE unit_id=?').all(u.id) as any[];
        for(const s of sources) if(!keys.has(JSON.stringify([s.episode_id,s.span_start_byte,s.span_end_byte,s.source_role]))) {
          db.prepare('DELETE FROM memory_unit_sources WHERE unit_id=? AND episode_id=? AND span_start_byte=? AND span_end_byte=? AND source_role=?')
            .run(u.id,s.episode_id,s.span_start_byte,s.span_end_byte,s.source_role);
        }
      }
      db.prepare('UPDATE memory_units SET status=?,confidence=?,valid_to=?,superseded_by=?,current_revision=current_revision+1,updated_at=? WHERE id=?')
        .run(u.status,u.confidence,u.valid_to,u.superseded_by,at,u.id);
      const after=db.prepare('SELECT * FROM memory_units WHERE id=?').get(u.id) as ReconcileUnit;
      db.prepare(`INSERT INTO memory_unit_revisions(unit_id,revision,operation,before_snapshot_json,after_snapshot_json,reason,actor_type,actor_id,request_id,truth_policy_version,created_at)
        VALUES (?,?,'reverted',?,?,'operator rollback','system','sleep-reconcile',?,'sleep-v1',?)`)
        .run(u.id,after.current_revision,JSON.stringify(current[i]),JSON.stringify(after),id,at);
      db.prepare(`INSERT OR IGNORE INTO projection_outbox(projection_key,unit_id,view_kind,source_unit_revision,projection_config_hash,status,created_at,updated_at)
        VALUES (?,?,'body',?,'sleep-v1','pending',?,?)`).run(`sleep:${u.id}:${after.current_revision}`,u.id,after.current_revision,at,at);
    }
    db.prepare("UPDATE unit_reconcile_decisions SET state='reverted' WHERE id=?").run(id);
    db.prepare("UPDATE confirm_requests SET state='expired' WHERE id IN (SELECT confirm_id FROM reconcile_confirm_links WHERE decision_id=?) AND state IN ('pending','snoozed')").run(id);
    return true;
  }).immediate();
}
