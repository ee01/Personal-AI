import type { FastifyInstance } from 'fastify';
import { SleepReconciliation } from '../core/v3/SleepReconciliation.js';
import { UnitTruthMaintainer } from '../core/v3/UnitTruthMaintainer.js';
import { EpisodeRepository } from '../core/v3/EpisodeRepository.js';
import { reconcileModelVersion } from '../core/v3/ReconcileModel.js';
import { sourcesFor } from '../core/v3/ReconcileTruth.js';
import { unitPromotionEligible } from '../core/WriteProvenanceGate.js';
import { now } from '../utils/time.js';

export async function reconciliationRoutes(app: FastifyInstance) {
  app.get('/reconciliation/profiles',async request=>{
    const {db,userId}=request.userContext;
    return {proposals:db.prepare(`SELECT p.id,p.slot_value AS value,p.current_revision AS revision FROM profile_slots p
      JOIN memory_units u ON u.id=json_extract(p.source_unit_ids,'$[0]')
      WHERE p.owner_user_id=? AND p.status='pending_confirmation' AND p.slot_key LIKE 'sleep:%'
      AND json_array_length(p.source_unit_ids)=1 AND u.owner_user_id=? AND u.sensitivity!='restricted'
      AND u.status IN ('active','provisional') ORDER BY p.created_at DESC LIMIT 20`).all(userId,userId)};
  });
  app.post<{Params:{id:string};Body:{accept:boolean;revision:number}}>('/reconciliation/profiles/:id/confirm',{
    schema:{body:{type:'object',required:['accept','revision'],properties:{accept:{type:'boolean'},revision:{type:'integer',minimum:1}},additionalProperties:false}},
  },async (request,reply)=>{
    const {db,userId}=request.userContext;
    const accepted=db.transaction(()=>{
      const slot=db.prepare(`SELECT * FROM profile_slots WHERE id=? AND owner_user_id=? AND status='pending_confirmation'
        AND slot_key LIKE 'sleep:%' AND current_revision=?`).get(request.params.id,userId,request.body.revision) as any;
      if(!slot)return false;
      const ids=JSON.parse(slot.source_unit_ids) as string[];
      if(ids.length!==1)return false;
      const unit=db.prepare('SELECT * FROM memory_units WHERE id=? AND owner_user_id=?').get(ids[0],userId) as any;
      if(!unit || slot.slot_value!==unit.text || unit.sensitivity==='restricted'||!['active','provisional'].includes(unit.status)||!unitPromotionEligible(db,unit.id)
        ||!sourcesFor(db,unit.id).some(s=>s.evidence_class!=='system_inference'))return false;
      const at=now();
      db.prepare('UPDATE profile_slots SET status=?,current_revision=current_revision+1,updated_at=? WHERE id=?')
        .run(request.body.accept?'active':'rejected',at,slot.id);
      if(request.body.accept) {
        db.prepare("UPDATE memory_units SET status='active',confirmation_state='user_confirmed',current_revision=current_revision+1,updated_at=? WHERE id=?")
          .run(at,unit.id);
        const after=db.prepare('SELECT * FROM memory_units WHERE id=?').get(unit.id) as any;
        db.prepare(`INSERT INTO memory_unit_revisions(unit_id,revision,operation,before_snapshot_json,after_snapshot_json,reason,actor_type,actor_id,request_id,truth_policy_version,created_at)
          VALUES (?,?,'user_confirmation',?,?,'confirmed profile proposal','user',?,?,'sleep-v1',?)`)
          .run(unit.id,after.current_revision,JSON.stringify(unit),JSON.stringify(after),userId,slot.id,at);
        db.prepare(`INSERT OR IGNORE INTO projection_outbox(projection_key,unit_id,view_kind,source_unit_revision,projection_config_hash,status,created_at,updated_at)
          VALUES (?,?,'body',?,'sleep-v1','pending',?,?)`).run(`sleep:${unit.id}:${after.current_revision}`,unit.id,after.current_revision,at,at);
      }
      return true;
    }).immediate();
    return accepted?{confirmed:request.body.accept}:reply.code(409).send({error:'proposal changed or source is no longer eligible'});
  });
  app.get<{Querystring:{phase:'B'|'C'}}>('/reconciliation/samples',{
    schema:{querystring:{type:'object',required:['phase'],properties:{phase:{type:'string',enum:['B','C']}},additionalProperties:false}},
  },async request=>{
    const {db,userId}=request.userContext,modelVersion=reconcileModelVersion();
    const rows=db.prepare(`SELECT id,unit_id,candidate_unit_id FROM (
      SELECT d.*,row_number() OVER (PARTITION BY d.unit_id,d.candidate_unit_id ORDER BY d.created_at DESC,d.id) AS pair_rank
      FROM unit_reconcile_decisions d JOIN memory_units n ON n.id=d.unit_id JOIN memory_units o ON o.id=d.candidate_unit_id
      WHERE d.phase=? AND d.owner_user_id=? AND d.model_version=? AND d.state='shadow'
      AND n.owner_user_id=? AND o.owner_user_id=? AND n.sensitivity!='restricted' AND o.sensitivity!='restricted'
      AND n.current_revision=json_extract(d.expected_revisions_json,'$[0]')
      AND o.current_revision=json_extract(d.expected_revisions_json,'$[1]'))
      WHERE pair_rank=1 ORDER BY id LIMIT 50`).all(request.query.phase,userId,modelVersion,userId,userId) as any[];
    const evidence=(id:string)=>{
      const unit=db.prepare('SELECT text,observed_at AS observedAt,kind,confirmation_state AS confirmationState FROM memory_units WHERE id=?').get(id);
      const effective=sourcesFor(db,id);
      const sources=db.prepare(`SELECT m.content,m.source_type AS sourceType,s.span_start_byte,s.span_end_byte,s.evidence_key
        FROM memory_unit_sources s JOIN messages_raw m ON m.id=s.episode_id WHERE s.unit_id=? AND s.promotion_eligible=1 LIMIT 5`).all(id) as any[];
      return {unit,sources:sources.map(s=>({sourceType:s.sourceType,
        evidenceClass:effective.find(e=>e.evidence_key===s.evidence_key)?.evidence_class,
        quote:Buffer.from(s.content,'utf8').subarray(s.span_start_byte,s.span_end_byte).toString('utf8').slice(0,2000)}))};
    };
    return {phase:request.query.phase,modelVersion,requiredPairs:50,availablePairs:rows.length,
      labels:rows.map(r=>({decisionId:r.id,expectedDecision:null,older:evidence(r.candidate_unit_id),newer:evidence(r.unit_id)}))};
  });
  app.get<{Querystring:{limit?:number;unitId?:string}}>('/reconciliation', {
    schema:{querystring:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:50},unitId:{type:'string',maxLength:100}},additionalProperties:false}},
  },async request=>{
    const {db,userId}=request.userContext;
    const receipts=db.prepare(`SELECT d.id,d.phase,d.decision,d.state,d.reason,d.model_version AS modelVersion,
      d.created_at AS createdAt,d.decided_at AS decidedAt,d.unit_id,d.candidate_unit_id
      FROM unit_reconcile_decisions d JOIN memory_units n ON n.id=d.unit_id JOIN memory_units o ON o.id=d.candidate_unit_id
      WHERE d.owner_user_id=? AND n.owner_user_id=? AND o.owner_user_id=?
      AND n.sensitivity!='restricted' AND o.sensitivity!='restricted'
      AND (? IS NULL OR d.unit_id=? OR d.candidate_unit_id=?) ORDER BY d.created_at DESC,d.id LIMIT ?`)
      .all(userId,userId,userId,request.query.unitId??null,request.query.unitId??null,request.query.unitId??null,request.query.limit??20) as any[];
    return {receipts:receipts.map(r=>({...r,units:[r.candidate_unit_id,r.unit_id].map(id=>{
      const unit=db.prepare('SELECT id,text,status,observed_at AS observedAt,current_revision AS revision FROM memory_units WHERE id=?').get(id) as any;
      const sources=db.prepare(`SELECT DISTINCT episode_id AS episodeId,evidence_class AS evidenceClass FROM memory_unit_sources
        WHERE unit_id=? AND promotion_eligible=1 LIMIT 20`).all(id);
      const sourceCount=(db.prepare('SELECT count(DISTINCT episode_id) AS n FROM memory_unit_sources WHERE unit_id=? AND promotion_eligible=1').get(id) as {n:number}).n;
      return {...unit,sources,sourceCount};
    })}))};
  });
  app.post<{Params:{id:string}}>('/reconciliation/:id/revert',async (request,reply)=>{
    const {db,userId}=request.userContext;
    const receipt=db.prepare(`SELECT d.id FROM unit_reconcile_decisions d JOIN memory_units n ON n.id=d.unit_id
      JOIN memory_units o ON o.id=d.candidate_unit_id WHERE d.id=? AND d.owner_user_id=?
      AND n.owner_user_id=? AND o.owner_user_id=? AND n.sensitivity!='restricted' AND o.sensitivity!='restricted'`)
      .get(request.params.id,userId,userId,userId);
    if(!receipt) return reply.code(404).send({error:'receipt not found'});
    if(!new UnitTruthMaintainer(db,new EpisodeRepository(db)).revertReconcileDecision(request.params.id,now())) {
      return reply.code(409).send({error:'receipt is not applied or has newer revisions; no changes made'});
    }
    return {reverted:true};
  });
  app.get('/reconciliation/metrics',async request=>{
    const {db,userId}=request.userContext, since=now()-7*86400;
    const rows=db.prepare(`SELECT surface,lane,elapsed_ms FROM (SELECT surface,lane,elapsed_ms FROM recall_lane_metrics
      WHERE owner_user_id=? AND created_at>=? AND traffic_class='production' ORDER BY created_at DESC,id DESC LIMIT 10000) ORDER BY elapsed_ms`)
      .all(userId,since) as Array<{surface:string;lane:string;elapsed_ms:number}>;
    const summary=(surface:string)=>{
      const group=rows.filter(r=>r.surface===surface);
      return {samples:group.length,p95Ms:group.length?group[Math.ceil(group.length*.95)-1].elapsed_ms:null,
        deepRate:group.length?group.filter(r=>r.lane==='deep').length/group.length:null};
    };
    const runner=new SleepReconciliation(db);
    return {windowDays:7,sampleLimit:10000,active:summary('active'),passive:summary('passive'),
      flags:{phases:process.env.MEMORY_CONSOLIDATION_V3??'',twoLanes:process.env.MEMORY_READ_TWO_LANES==='true',
        B:process.env.RECONCILE_B_MODE??'shadow',C:process.env.RECONCILE_C_MODE??'shadow'},
      liveAllowed:{B:runner.liveAllowed('B',userId,'default'),C:runner.liveAllowed('C',userId,'default')},
      budgets:db.prepare(`SELECT night,phase,calls,reserved_tokens AS reservedTokens FROM reconcile_nightly_budgets
        WHERE owner_user_id=? ORDER BY night DESC,phase LIMIT 21`).all(userId),
      nightlyRuns:db.prepare('SELECT night,trigger_kind AS triggerKind,started_at AS startedAt,finished_at AS finishedAt FROM reconcile_nightly_runs ORDER BY night DESC LIMIT 7').all(),
      decisions:db.prepare(`SELECT phase,state,count(*) AS count FROM unit_reconcile_decisions WHERE owner_user_id=?
        GROUP BY phase,state`).all(userId)};
  });
}
