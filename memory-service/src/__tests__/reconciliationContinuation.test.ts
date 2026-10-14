import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {getTestDb,cleanupTestDb} from './setup.js';
import {UnitRecallReader} from '../core/v3/UnitRecallReader.js';
import {rerankDeepRecall} from '../core/v3/DeepRecallReranker.js';
import {reconciliationRoutes} from '../routes/reconciliation.js';
import {SleepReconciliation} from '../core/v3/SleepReconciliation.js';
import {UnitTruthMaintainer} from '../core/v3/UnitTruthMaintainer.js';
import {reconcileModelVersion} from '../core/v3/ReconcileModel.js';
import {EpisodeRepository} from '../core/v3/EpisodeRepository.js';
import {ContextRecallService} from '../core/ContextRecallService.js';
import {RecallEngine} from '../core/RecallEngine.js';
import {embedWithE5,setE5PipelineForTesting} from '../core/v3/UnitEmbeddingWorker.js';
const llm=vi.hoisted(()=>vi.fn());
const loadPipeline=vi.hoisted(()=>vi.fn());
vi.mock('@xenova/transformers',()=>({pipeline:loadPipeline}));
vi.mock('../llm/LLMClient.js',()=>({LLMClient:class {generateJSON=llm;}}));
let db:ReturnType<typeof getTestDb>;
const now=Math.floor(Date.now()/1000);
function seed(text:string,subject:string,owner='owner',egress='approved_destinations',created=now-100) {
  const id=randomUUID(),ep=randomUUID();
  db.prepare("INSERT INTO entities(id,type,name,created_at) VALUES (?,'Project',?,?)").run(subject,subject,created);
  db.prepare("INSERT INTO messages_raw(id,content,source_type,sender,scope,timestamp,created_at) VALUES (?,?,'manual','human','work',?,?)").run(ep,text,created,created);
  db.prepare(`INSERT INTO memory_units(id,owner_user_id,memory_form,kind,status,subject_key,predicate_key,text,observed_at,scope_locator,egress_policy,tx_start,created_at,updated_at)
    VALUES (?,?,'semantic','fact','active',?,'status',?,?,'work',?,?,?,?)`).run(id,owner,subject,text,created,egress,created,created,created);
  db.prepare(`INSERT INTO memory_unit_sources(unit_id,episode_id,span_start_byte,span_end_byte,span_text_hash,source_role,evidence_key,provenance_family,evidence_class,created_at)
    VALUES (?,?,0,?,'test','primary',?,?,'first_party_record',?)`).run(id,ep,Buffer.byteLength(text),ep,ep,created);
  db.prepare(`INSERT INTO memory_unit_views(unit_id,view_kind,raw_text,segmented_text,source_unit_revision,created_by,created_at) VALUES (?,'body',?,?,1,'test',?)`).run(id,text,text,created);
  return {id,ep};
}
function edge(from:string,to:string) {
  db.prepare("INSERT INTO relationships(from_entity_id,to_entity_id,relation_type,created_at) VALUES (?,?,'related_to',?)").run(from,to,now);
}
beforeEach(()=>{cleanupTestDb();db=getTestDb();llm.mockReset();vi.stubEnv('MEMORY_READ_V3_VECTOR','');vi.stubEnv('MEMORY_DEEP_RERANKER','false');});
afterEach(()=>{cleanupTestDb();vi.unstubAllEnvs();});
describe('reconciliation continuation',()=>{
  it('C qualification counts erroneous supersede as a both-valid false positive',()=>{
    vi.stubEnv('RECONCILE_C_MODE','live');
    for(let i=0;i<50;i++) {
      const old=seed(`old ${i}`,`Old-${i}`),newer=seed(`new ${i}`,`New-${i}`),id=randomUUID();
      const expected=i<15?'refine':'corroborate',decision=i<3?'supersede':expected;
      db.prepare(`INSERT INTO unit_reconcile_decisions(id,tenant_id,owner_user_id,phase,unit_id,candidate_unit_id,evidence_digest,evidence_keys_json,
        decision,state,expected_revisions_json,model_version,created_at) VALUES (?,'default','owner','C',?,?,?,'[]',?,'shadow','[1,1]',?,?)`)
        .run(id,newer.id,old.id,id,decision,reconcileModelVersion(),now);
      db.prepare('INSERT INTO reconcile_shadow_reviews(decision_id,expected_decision,reviewed_by,reviewed_at) VALUES (?,?,?,?)').run(id,expected,'human-fixture',now);
    }
    expect(new SleepReconciliation(db).liveAllowed('C','owner','default')).toBe(false);
  });
  it('passive current recall suppresses superseded raw evidence and projects the new fact without a model',async()=>{
    vi.stubEnv('MEMORY_READ_TWO_LANES','true');vi.stubEnv('MEMORY_CONSOLIDATION_V3','A,B');vi.stubEnv('RECONCILE_B_MODE','shadow');
    const old=seed('Alpha design pending, waiting for approval','Alpha','owner','approved_destinations',now-3600);
    const newer=seed('Alpha design approved, development started','Beta');db.prepare("UPDATE memory_units SET subject_key='Alpha' WHERE id=?").run(newer.id);
    await new SleepReconciliation(db,async()=>({decision:'supersede',reason:'new firsthand update'})).reconcile('B',now);
    const receipt=db.prepare('SELECT id FROM unit_reconcile_decisions').get() as {id:string};
    new UnitTruthMaintainer(db,new EpisodeRepository(db)).applyReconcileDecision(receipt.id,now);
    const spy=vi.spyOn(RecallEngine.prototype,'recall').mockResolvedValue({items:[{id:old.ep,type:'message',content:'Alpha design pending, waiting for approval',scope:'work',score:.9,source:'manual',timestamp:now-3600}],totalFound:1,channels:['fts'],queryTimeMs:1});
    try {
      const result=await new ContextRecallService(db,'owner').recall({surface:'web_passive',contextType:'webpage',title:'Alpha design approval development status',scope:'work',debug:true});
      expect(result.matches.map(m=>m.id)).not.toContain(old.ep);
      expect(result.matches.map(m=>m.id)).toContain(`unit:${newer.id}`);expect(llm).not.toHaveBeenCalled();
    } finally {spy.mockRestore();}
  });
  it('profile proposal remains pending until explicit confirmation and is not recreated after rejection',async()=>{
    const pref=seed('I prefer concise answers','owner');db.prepare("UPDATE memory_units SET kind='preference' WHERE id=?").run(pref.id);
    const runner=new SleepReconciliation(db);runner.derive(now);
    const app=Fastify();app.decorateRequest('userContext',null);app.addHook('preHandler',async req=>{req.userContext={db,userId:'owner'} as any;});await app.register(reconciliationRoutes);
    try {
      const proposal=(await app.inject({url:'/reconciliation/profiles'})).json().proposals[0];expect(proposal.revision).toBe(1);
      expect((await app.inject({method:'POST',url:`/reconciliation/profiles/${proposal.id}/confirm`,payload:{accept:false,revision:1}})).statusCode).toBe(200);
      runner.derive(now+86400);expect(db.prepare('SELECT count(*) n FROM profile_slots').get()).toEqual({n:1});
      expect((await app.inject({url:'/reconciliation/profiles'})).json().proposals).toHaveLength(0);
      expect((await app.inject({method:'POST',url:`/reconciliation/profiles/${proposal.id}/confirm`,payload:{accept:true,revision:1}})).statusCode).toBe(409);
      const second=seed('I prefer Spanish answers','self');db.prepare("UPDATE memory_units SET kind='preference' WHERE id=?").run(second.id);
      runner.derive(now+86400);
      const next=(await app.inject({url:'/reconciliation/profiles'})).json().proposals[0];
      expect((await app.inject({method:'POST',url:`/reconciliation/profiles/${next.id}/confirm`,payload:{accept:true,revision:1}})).json()).toEqual({confirmed:true});
      expect(db.prepare('SELECT confirmation_state,current_revision FROM memory_units WHERE id=?').get(second.id))
        .toEqual({confirmation_state:'user_confirmed',current_revision:2});
      expect(db.prepare("SELECT actor_type FROM memory_unit_revisions WHERE unit_id=?").get(second.id)).toEqual({actor_type:'user'});
      runner.derive(now+2*86400);expect(db.prepare('SELECT count(*) n FROM profile_slots').get()).toEqual({n:2});
    } finally {await app.close();}
  });
  it('daughter gift anchoring does not mix in a sons preference',async()=>{
    seed('Alex parent','Alex');const daughter=seed('likes princess figurines','Emma');const son=seed('likes football','Oliver');
    db.prepare("INSERT INTO relationships(from_entity_id,to_entity_id,relation_type,created_at) VALUES ('Alex','Emma','has_daughter',?)").run(now);
    db.prepare("INSERT INTO relationships(from_entity_id,to_entity_id,relation_type,created_at) VALUES ('Alex','Oliver','has_son',?)").run(now);
    const result=new UnitRecallReader(db).recall('gift for Alex daughter',10,undefined,{ownerUserId:'owner'});
    expect(result.candidates.map(c=>c.unitId)).toContain(daughter.id);expect(result.candidates.map(c=>c.unitId)).not.toContain(son.id);
    const deep=await new UnitRecallReader(db).recallLanes('gift for Alex daughter',10,{policy:{ownerUserId:'owner'},explicitDeep:true});
    expect(deep.candidates.map(c=>c.unitId)).not.toContain(son.id);
  });
  it('shares one cold vector model load across concurrent queries',async()=>{
    setE5PipelineForTesting(undefined);
    loadPipeline.mockImplementation(async()=>{await new Promise(resolve=>setImmediate(resolve));return async()=>({tolist:()=>[[1,0]]});});
    try {
      expect(await Promise.all([embedWithE5('a','query:'),embedWithE5('b','query:')])).toEqual([[1,0],[1,0]]);
      expect(loadPipeline).toHaveBeenCalledTimes(1);
    } finally {setE5PipelineForTesting(null);}
  });
  it('deep traverses two readable hops, fast/passive do not, and records content-free metrics',async()=>{
    seed('Alpha launch','Alpha');seed('Beta supplier','Beta');const target=seed('Gamma deadline','Gamma');edge('Alpha','Beta');edge('Beta','Gamma');
    const reader=new UnitRecallReader(db),policy={ownerUserId:'owner',egressDestination:'llm' as const};
    expect((await reader.recallLanes('Alpha',10,{policy})).candidates.map(c=>c.unitId)).not.toContain(target.id);
    const deep=await reader.recallLanes('Alpha',10,{policy,explicitDeep:true});
    expect(deep.candidates.map(c=>c.unitId)).toContain(target.id);
    expect((await reader.recallLanes('Alpha',10,{policy:{...policy,accessibilityMode:'passive'},explicitDeep:true})).lane).toBe('fast');
    expect(db.prepare('SELECT count(*) n FROM recall_lane_metrics').get()).toEqual({n:3});expect(llm).not.toHaveBeenCalled();
    await reader.recallLanes('Alpha',10,{policy:{...policy,recordMetrics:false}});
    expect(db.prepare('SELECT count(*) n FROM recall_lane_metrics').get()).toEqual({n:3});
  });
  it('cannot traverse a hidden intermediary into readable evidence',async()=>{
    seed('Alpha launch','Alpha');seed('Beta hidden','Beta','another');const target=seed('Gamma deadline','Gamma');edge('Alpha','Beta');edge('Beta','Gamma');
    const result=await new UnitRecallReader(db).recallLanes('Alpha',10,{policy:{ownerUserId:'owner',egressDestination:'llm'},explicitDeep:true});
    expect(result.candidates.map(c=>c.unitId)).not.toContain(target.id);
  });
  it('reranks only approved active evidence, validates all ids and preserves fallback order',async()=>{
    vi.stubEnv('MEMORY_DEEP_RERANKER','true');seed('Alpha launch','Alpha');seed('Alpha notes','Beta');
    const candidates=new UnitRecallReader(db).recall('Alpha',10).candidates;
    llm.mockResolvedValue({unitIds:candidates.map(c=>c.unitId).reverse()});
    const policy={ownerUserId:'owner',egressDestination:'llm' as const};
    expect((await rerankDeepRecall('Alpha',candidates,policy)).map(c=>c.unitId)).toEqual(candidates.map(c=>c.unitId).reverse());
    expect(llm.mock.calls[0][1]).toMatchObject({timeoutMs:3000,retryCount:0});
    llm.mockResolvedValue({unitIds:['invented']});expect(await rerankDeepRecall('Alpha',candidates,policy)).toEqual(candidates);
    llm.mockRejectedValue(new Error('timeout'));expect(await rerankDeepRecall('Alpha',candidates,policy)).toEqual(candidates);
    llm.mockClear();await rerankDeepRecall('Alpha',candidates,{...policy,accessibilityMode:'passive'});
    await rerankDeepRecall('Alpha',candidates,{...policy,egressDestination:'local'});expect(llm).not.toHaveBeenCalled();
  });
  it('receipt API enforces owner visibility, revisions on undo, and isolated metrics',async()=>{
    vi.stubEnv('MEMORY_CONSOLIDATION_V3','A,B');vi.stubEnv('RECONCILE_B_MODE','shadow');
    const old=seed('Alpha old','Alpha','owner','approved_destinations',now-3600);
    // Same subject: entity projection exists already.
    const newer=seed('Alpha new','Beta','owner','approved_destinations',now-100);
    db.prepare('UPDATE memory_units SET subject_key=? WHERE id=?').run('Alpha',newer.id);
    await new SleepReconciliation(db,async()=>({decision:'supersede',reason:'new status'})).reconcile('B',now);
    const receipt=db.prepare('SELECT id FROM unit_reconcile_decisions').get() as {id:string};
    let owner='owner';const app=Fastify();app.decorateRequest('userContext',null);
    app.addHook('preHandler',async req=>{req.userContext={db,userId:owner} as any;});await app.register(reconciliationRoutes);
    try {
      const sample=(await app.inject({url:'/reconciliation/samples?phase=B'})).json();
      expect(sample.availablePairs).toBe(1);expect(sample.labels[0].expectedDecision).toBeNull();
      expect(sample.labels[0]).not.toHaveProperty('decision');expect(sample.labels[0].older.sources[0].quote).toBe('Alpha old');
      expect(new UnitTruthMaintainer(db,new EpisodeRepository(db)).applyReconcileDecision(receipt.id,now)).toBe(true);
      expect((await app.inject({url:'/reconciliation'})).json().receipts[0].units[0].sourceCount).toBe(1);
      owner='another';expect((await app.inject({url:'/reconciliation'})).json().receipts).toHaveLength(0);
      expect((await app.inject({method:'POST',url:`/reconciliation/${receipt.id}/revert`})).statusCode).toBe(404);
      owner='owner';db.prepare('UPDATE memory_units SET current_revision=current_revision+1 WHERE id=?').run(old.id);
      expect((await app.inject({method:'POST',url:`/reconciliation/${receipt.id}/revert`})).statusCode).toBe(409);
      const metrics=(await app.inject({url:'/reconciliation/metrics'})).json();expect(metrics.active.p95Ms).toBeNull();expect(metrics.liveAllowed.B).toBe(false);
    } finally {await app.close();}
  });
});
