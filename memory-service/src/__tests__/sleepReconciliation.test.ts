import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { getTestDb, cleanupTestDb } from './setup.js';
import { SleepReconciliation } from '../core/v3/SleepReconciliation.js';
import { UnitTruthMaintainer } from '../core/v3/UnitTruthMaintainer.js';
import { EpisodeRepository } from '../core/v3/EpisodeRepository.js';
import { UnitRecallReader } from '../core/v3/UnitRecallReader.js';
import { ForgettingEngine } from '../core/ForgettingEngine.js';
import { truthCandidates } from '../core/v3/TruthCandidatePlan.js';
import { OnlineReflection } from '../core/OnlineReflection.js';
import { ActiveRecallService } from '../core/ActiveRecallService.js';
import { resetConfigForTests, getConfig } from '../config.js';
import { isConsolidationPhaseEnabled } from '../core/v3/ConsolidationPhases.js';
import { MemoryClaimAttributionService } from '../core/MemoryClaimAttributionService.js';
import type { ReconcileUnit } from '../core/v3/ReconcileTruth.js';
import { reconcileModelVersion } from '../core/v3/ReconcileModel.js';

const llmMock=vi.hoisted(()=>vi.fn());
vi.mock('../llm/LLMClient.js',()=>({getLLMClient:()=>({generateJSON:llmMock}),LLMClient:class {generateJSON=llmMock;}}));
let db:Database.Database;
const at=1791878400;
beforeEach(()=>{
  cleanupTestDb(); db=getTestDb();
  vi.stubEnv('MEMORY_CONSOLIDATION_V3','A,B,C,D,E');
  vi.stubEnv('RECONCILE_B_MODE','shadow');vi.stubEnv('RECONCILE_C_MODE','shadow');
  vi.stubEnv('RECONCILE_LLM_BUDGET_PER_NIGHT','120');
  vi.stubEnv('MEMORY_READ_V3_VECTOR','');vi.stubEnv('REFLECTION_DEFAULT_ENABLED','true');resetConfigForTests();
  llmMock.mockReset().mockResolvedValue({userPreferences:[],improvements:[],newFacts:[],shouldStore:false});
});
afterEach(()=>{cleanupTestDb();vi.unstubAllEnvs();resetConfigForTests();});

function seed(text:string,options:{subject?:string;predicate?:string;observed?:number;created?:number;kind?:string;form?:string;evidence?:string;family?:string;scope?:string;owner?:string;eligible?:number}={}) {
  const id=randomUUID(),ep=randomUUID();
  db.prepare(`INSERT INTO messages_raw(id,content,source_type,sender,scope,timestamp,created_at) VALUES (?,?,'glip','human',?,?,?)`)
    .run(ep,text,options.scope??'work',options.observed??at-86400,options.created??at-86400);
  if(options.eligible===0) db.prepare('UPDATE messages_raw SET promotion_eligible=0 WHERE id=?').run(ep);
  db.prepare(`INSERT INTO memory_units(id,owner_user_id,memory_form,kind,status,subject_key,predicate_key,text,normalized_text,
    observed_at,scope_locator,tx_start,created_at,updated_at) VALUES (?,?,?,?,'provisional',?,?,?,?,?,?,?,?,?)`)
    .run(id,options.owner??'owner',options.form??'semantic',options.kind??'fact',options.subject??'Project Aurora',options.predicate??'status',text,text.toLowerCase(),options.observed??at-86400,options.scope??'work',options.created??at-86400,options.created??at-86400,options.created??at-86400);
  db.prepare(`INSERT INTO memory_unit_sources(unit_id,episode_id,span_start_byte,span_end_byte,span_text_hash,source_role,evidence_key,provenance_family,evidence_class,created_at)
    VALUES (?,?,0,?,'test','primary',?,?,?,?)`).run(id,ep,Buffer.byteLength(text),ep,options.family??ep,options.evidence??'first_party_record',at);
  db.prepare(`INSERT INTO memory_unit_views(unit_id,view_kind,raw_text,segmented_text,source_unit_revision,created_by,created_at) VALUES (?,'body',?,?,1,'test',?)`).run(id,text,text,at);
  return {id,ep};
}
function receipt(n:string,o:string,decision:string) {
  const src=(id:string)=>db.prepare('SELECT evidence_key,provenance_family,evidence_class FROM memory_unit_sources WHERE unit_id=? AND promotion_eligible=1 ORDER BY evidence_key,provenance_family,evidence_class').all(id);
  const id=randomUUID();
  db.prepare(`INSERT INTO unit_reconcile_decisions(id,tenant_id,owner_user_id,phase,unit_id,candidate_unit_id,evidence_digest,evidence_keys_json,decision,
    reason,state,expected_revisions_json,created_at) VALUES (?,'default','owner','B',?,?,?, ?,?,'test','shadow','[1,1]',?)`).run(id,n,o,id,JSON.stringify([src(n),src(o)]),decision,at);
  db.prepare('UPDATE unit_reconcile_decisions SET expected_revisions_json=? WHERE id=?').run(JSON.stringify([n,o].map(u=>(db.prepare('SELECT current_revision FROM memory_units WHERE id=?').get(u) as any).current_revision)),id);
  return id;
}
const truth=()=>new UnitTruthMaintainer(db,new EpisodeRepository(db));
const row=(id:string)=>db.prepare('SELECT * FROM memory_units WHERE id=?').get(id) as ReconcileUnit;

describe('latest version (20)',()=>{
  it.each(Array.from({length:20},(_,i)=>i))('newer firsthand status replaces version %i, originals traceable',i=>{
    const old=seed(`Aurora-${i}: waiting for design`,{observed:at-3*86400,created:at-3*86400,evidence:'third_party_report'});
    const newer=seed(`Aurora-${i}: development started`,{observed:at-86400,created:at-86400});
    const decision=receipt(newer.id,old.id,'supersede');
    expect(truth().applyReconcileDecision(decision,at)).toBe(true);
    expect(row(old.id).status).toBe('superseded');expect((row(old.id) as any).superseded_by).toBe(newer.id);
    expect(row(newer.id).status).toBe('active');
    expect(db.prepare('SELECT content FROM messages_raw WHERE id=?').get(old.ep)).toEqual({content:`Aurora-${i}: waiting for design`});
    expect(db.prepare('SELECT count(*) n FROM memory_unit_revisions').get()).toEqual({n:2});
    expect(truth().applyReconcileDecision(decision,at)).toBe(false);
  });
});
describe('old preferences (15)',()=>{
  it.each(Array.from({length:15},(_,i)=>i))('entity anchored preference %i survives years and remains actively searchable',async i=>{
    const person=`朋友${i}的女儿`,alias=`Daughter-${i}`,entity=randomUUID();
    db.prepare("INSERT INTO entities(id,type,name,aliases_json,created_at) VALUES (?,'Person',?,?,?)").run(entity,person,JSON.stringify([alias]),at-4*365*86400);
    const unit=seed('喜欢某公主角色的手办',{subject:entity,kind:'preference',observed:at-4*365*86400,created:at-4*365*86400});
    db.prepare("INSERT INTO memory_metadata(target_type,target_id,salience_score,half_life_days,created_at) VALUES ('unit',?,0.8,30,?)").run(unit.id,at-4*365*86400);
    const runner=new SleepReconciliation(db);runner.deterministic(at);
    await new ForgettingEngine(db).runForgettingCycle();
    expect(db.prepare("SELECT consolidation_level,retrieval_tier FROM memory_metadata WHERE target_id=?").get(unit.id)).toEqual({consolidation_level:'archived',retrieval_tier:'archive_only'});
    expect(row(unit.id).status).toBe('provisional');
    const reader=new UnitRecallReader(db);
    expect(reader.recall(`给 ${alias} 挑生日礼物`,10,undefined,{scopeLocator:'work',accessibilityMode:'active'}).candidates.map(c=>c.unitId)).toContain(unit.id);
    expect(reader.recall(`给 ${alias} 挑生日礼物`,10,undefined,{accessibilityMode:'passive'}).candidates).toHaveLength(0);
  });
});
describe('both valid (15)',()=>{
  it.each(Array.from({length:15},(_,i)=>i))('complementary claims %i are retained; cooldown prevents repeated judge calls',async i=>{
    const a=seed(`Aurora-${i} supports web`,{created:at-2*86400});
    const b=seed(`Aurora-${i} supports mobile`,{created:at-86400});
    const judge=vi.fn().mockResolvedValue({decision:'refine',reason:'both supported platforms'});
    const runner=new SleepReconciliation(db,judge);
    await runner.reconcile('C',at);await runner.reconcile('C',at+86400);
    expect(judge).toHaveBeenCalledTimes(1);
    const r=db.prepare("SELECT id FROM unit_reconcile_decisions WHERE phase='C'").get() as {id:string};
    expect(truth().applyReconcileDecision(r.id,at)).toBe(true);
    expect(row(a.id).status).toBe('active');expect(row(b.id).status).toBe('active');
  });
});
describe('authority (10)',()=>{
  it.each(Array.from({length:10},(_,i)=>i))('inference %i cannot overwrite firsthand record even if judge requests it',i=>{
    const old=seed('Jira record: ready',{observed:at-2*86400,created:at-2*86400});
    const newer=seed('Probably blocked',{observed:at-86400,created:at-86400,evidence:'system_inference'});
    expect(truth().applyReconcileDecision(receipt(newer.id,old.id,'supersede'),at)).toBe(true);
    expect(row(old.id).status).toBe('disputed');expect((row(old.id) as any).superseded_by).toBeNull();expect(row(old.id).text).toBe('Jira record: ready');
  });
});
describe('cost (7 nights)',()=>{
  it.each(Array.from({length:7},(_,i)=>i))('night %i persists reservations and defers remaining pairs across restarts',async day=>{
    vi.stubEnv('RECONCILE_LLM_BUDGET_PER_NIGHT','1');vi.stubEnv('RECONCILE_B_TOKEN_CAP','15000');
    const night=at+day*86400;
    seed('Aurora status one',{created:night-3600});seed('Aurora status two',{created:night-1800});seed('Aurora status three',{created:night-300});
    const judge=vi.fn().mockResolvedValue({decision:'noop',reason:'needs more evidence'});
    const runner=new SleepReconciliation(db,judge);runner.deterministic(night);
    expect(judge).not.toHaveBeenCalled();
    await runner.reconcile('B',night);await new SleepReconciliation(db,judge).reconcile('B',night);
    expect(judge).toHaveBeenCalledTimes(1);
    expect(db.prepare("SELECT count(*) n FROM unit_reconcile_decisions WHERE state='deferred'").get()).toEqual({n:2});
    const budget=db.prepare('SELECT calls,reserved_tokens FROM reconcile_nightly_budgets').get() as any;
    expect(budget.calls).toBe(1);expect(budget.reserved_tokens).toBeLessThanOrEqual(15000);
  });
});

describe('sleep safety and routing',()=>{
  it('refuses stale revisions and changed provenance',()=>{
    const o=seed('old'),n=seed('new');const r=receipt(n.id,o.id,'dispute');
    db.prepare('UPDATE memory_units SET current_revision=2 WHERE id=?').run(n.id);
    expect(truth().applyReconcileDecision(r,at)).toBe(false);expect(row(o.id).status).toBe('provisional');
  });
  it('preserves confirmed records and rejects cross-scope replacements',()=>{
    const o=seed('confirmed',{created:at-2*86400,observed:at-2*86400}),n=seed('later',{created:at-86400});
    db.prepare("UPDATE memory_units SET confirmation_state='user_confirmed' WHERE id=?").run(o.id);
    truth().applyReconcileDecision(receipt(n.id,o.id,'supersede'),at);expect((row(o.id) as any).superseded_by).toBeNull();
    const x=seed('private',{scope:'personal'});expect(truth().applyReconcileDecision(receipt(x.id,n.id,'supersede'),at)).toBe(false);
  });
  it('does not enable C without A/B',()=>{
    vi.stubEnv('MEMORY_CONSOLIDATION_V3','C');expect(isConsolidationPhaseEnabled('C')).toBe(false);
  });
  it('source replay and same-family corroboration do not reinforce confidence',()=>{
    const o=seed('same',{created:at-3*86400,family:'same-author'}),n=seed('same',{created:at-2*86400,family:'same-author'});
    truth().applyReconcileDecision(receipt(n.id,o.id,'corroborate'),at);expect(row(o.id).confidence).toBe(0.5);
    const independent=seed('same',{family:'second-author'});
    truth().applyReconcileDecision(receipt(independent.id,o.id,'corroborate'),at);
    expect(row(o.id).confidence).toBeCloseTo(0.58);
  });
  it('a derived insight cannot replace a fact even when it cites a firsthand source',()=>{
    const o=seed('recorded fact',{observed:at-3600}),n=seed('derived hypothesis',{kind:'insight',observed:at-300});
    truth().applyReconcileDecision(receipt(n.id,o.id,'supersede'),at);
    expect(row(o.id).status).toBe('disputed');expect((row(o.id) as any).superseded_by).toBeNull();
  });
  it('an AI-owned quote inside an eligible human episode cannot inherit firsthand authority',()=>{
    const o=seed('Jira confirms Project Aurora is ready',{observed:at-3600});
    const n=seed('Claude says Project Aurora is blocked.',{observed:at-300});
    const claims=new MemoryClaimAttributionService(db).getClaimsForMessage(n.ep);
    expect(claims.some(c=>c.owner.kind==='ai_agent')).toBe(true);
    // The historical writer classified the episode as firsthand. Reconcile
    // must honor the more precise, server-derived owner of the support span.
    const d=receipt(n.id,o.id,'supersede');
    const sources=db.prepare('SELECT evidence_keys_json FROM unit_reconcile_decisions WHERE id=?').get(d) as any;
    const evidence=JSON.parse(sources.evidence_keys_json);evidence[0][0].evidence_class='system_inference';
    db.prepare('UPDATE unit_reconcile_decisions SET evidence_keys_json=? WHERE id=?').run(JSON.stringify(evidence),d);
    truth().applyReconcileDecision(d,at);
    expect(row(o.id).status).toBe('disputed');expect((row(o.id) as any).superseded_by).toBeNull();
  });
  it('truth candidates preserve all deterministic slots outside recall top-k',()=>{
    for(let i=0;i<22;i++) seed(`value ${i}`,{created:at-100-i});
    const n=seed('new',{created:at});expect(truthCandidates(db,row(n.id)).length).toBe(22);
  });
  it('truth candidate union includes a lexical neighbor with a different predicate',()=>{
    const o=seed('Aurora mobile version ready',{predicate:'release',created:at-2*86400});
    const n=seed('Aurora mobile version needs review',{predicate:'status',created:at-86400});
    expect(truthCandidates(db,row(n.id)).map(u=>u.id)).toContain(o.id);
  });
  it('an expired judge lease cannot overwrite the replacement attempt',async()=>{
    seed('old',{created:at-3600});seed('new',{created:at-300});
    let resolveFirst!:(value:any)=>void;
    const first=new SleepReconciliation(db,()=>new Promise(resolve=>{resolveFirst=resolve;})).reconcile('B',at);
    await new SleepReconciliation(db,async()=>({decision:'noop',reason:'replacement attempt'})).reconcile('B',at+601);
    resolveFirst({decision:'supersede',reason:'expired attempt'});await first;
    expect(db.prepare('SELECT decision,reason,state FROM unit_reconcile_decisions').get()).toEqual({decision:'noop',reason:'replacement attempt',state:'shadow'});
  });
  it('A alias canonicalization permits B comparisons and alias recall',async()=>{
    db.prepare("INSERT INTO entities(id,type,name,created_at) VALUES ('a','Project','Aurora',?),('b','Project','黎明',?)").run(at,at);
    db.prepare("INSERT INTO relationships(from_entity_id,to_entity_id,relation_type,created_at) VALUES ('b','a','synonym_of',?)").run(at);
    seed('old',{subject:'a',created:at-2*86400});seed('new',{subject:'b',created:at-86400});
    const judge=vi.fn().mockResolvedValue({decision:'supersede',reason:'new status'});
    const runner=new SleepReconciliation(db,judge);runner.deterministic(at);await runner.reconcile('B',at);expect(judge).toHaveBeenCalledTimes(1);
  });
  it('D keeps profile proposals pending, E only produces candidates',()=>{
    seed('I prefer concise answers',{subject:'owner',kind:'preference'});seed('follow up tomorrow',{kind:'action_item'});
    const runner=new SleepReconciliation(db);runner.derive(at);runner.attention(at);
    expect(db.prepare('SELECT status FROM profile_slots').get()).toEqual({status:'pending_confirmation'});
    expect(db.prepare("SELECT count(*) n FROM reconcile_artifacts WHERE kind='attention'").get()).toEqual({n:1});
    expect(db.prepare('SELECT count(*) n FROM confirm_requests').get()).toEqual({n:0});
  });
  it('live requires 50 independent reviews and 85% agreement',()=>{
    vi.stubEnv('RECONCILE_B_MODE','live');expect(new SleepReconciliation(db).liveAllowed('B','owner','default')).toBe(false);
  });
  it('qualified live applies correct shadows, retains a reviewed mismatch, and a model change resets qualification',async()=>{
    vi.stubEnv('RECONCILE_B_MODE','live');vi.stubEnv('RECONCILE_LLM_BUDGET_PER_NIGHT','0');
    const model=reconcileModelVersion();
    let mismatch='';
    for(let i=0;i<50;i++) {
      const o=seed(`old${i}`,{subject:`slot${i}`,observed:at-3600,created:at-3600});
      const n=seed(`new${i}`,{subject:`slot${i}`,observed:at-1800,created:at-1800});const r=receipt(n.id,o.id,'supersede');
      db.prepare('UPDATE unit_reconcile_decisions SET model_version=? WHERE id=?').run(model,r);
      db.prepare('INSERT INTO reconcile_shadow_reviews(decision_id,expected_decision,reviewed_by,reviewed_at) VALUES (?,?,?,?)').run(r,i===49?'dispute':'supersede','human-fixture',at);
      if(i===49) mismatch=o.id;
    }
    const runner=new SleepReconciliation(db);expect(runner.liveAllowed('B','owner','default')).toBe(true);
    const result=await runner.reconcile('B',at);expect(result.applied).toBe(49);expect(row(mismatch).status).toBe('provisional');
    vi.stubEnv('RECONCILE_CHEAP_MODEL','new-model');expect(runner.liveAllowed('B','owner','default')).toBe(false);
  });
  it('reader applies ACL before truncation and never escalates passive',async()=>{
    seed('Aurora private preference',{owner:'another'});const n=seed('Aurora ready');
    const reader=new UnitRecallReader(db);const r=await reader.recallLanes('Project Aurora',1,{policy:{ownerUserId:'owner',accessibilityMode:'passive'},explicitDeep:true});
    expect(r.candidates[0].unitId).toBe(n.id);expect(r.lane).toBe('fast');
  });
  it('samples online reflection once in five across fresh instances',async()=>{
    for(let i=0;i<10;i++) await new OnlineReflection(db).reflect({query:'Hello',recalledItems:[],llmResponse:'Hi',usedItemIds:[]});
    expect(llmMock).toHaveBeenCalledTimes(2);
  });
  it('all-scope active read uses the unit lane rather than falling back to legacy',async()=>{
    vi.stubEnv('MEMORY_READ_TWO_LANES','true');const n=seed('Project Aurora is ready');
    const r=await new ActiveRecallService(db).recall({query:'Project Aurora',scope:'all',retrievalMode:'balanced'});
    expect(r.items[0].metadata?.unitId).toBe(n.id);expect(r.items[0].id).toBe(`unit:${n.id}`);
    expect(r.channels).toContain('entity_anchor');
  });
  it('current two-lane recall suppresses chunks linked to a superseded source and retains source navigation',async()=>{
    vi.stubEnv('MEMORY_READ_TWO_LANES','true');
    const o=seed('Project Aurora waiting for design',{observed:at-3600,created:at-3600});
    const n=seed('Project Aurora development started',{observed:at-300,created:at-300});
    const c=db.prepare(`INSERT INTO chunks(file_path,line_start,line_end,content,content_hash,source_type,related_entity_id,scope,created_at)
      VALUES (?,1,1,?,'old-chunk','glip',?,'work',?)`).run(`messages/${o.ep}`,'Project Aurora waiting for design',o.ep,at-3600);
    truth().applyReconcileDecision(receipt(n.id,o.id,'supersede'),at);
    const r=await new ActiveRecallService(db).recall({query:'Project Aurora',scope:'work',retrievalMode:'balanced'});
    expect(r.items.some(item=>item.id===String(c.lastInsertRowid)&&item.type==='chunk')).toBe(false);
    expect(r.items.find(item=>item.metadata?.unitId===n.id)?.exploreLink).toContain(n.ep);
  });
  it('reverts a reconciliation atomically and preserves monotonic revisions',()=>{
    const o=seed('old',{observed:at-3*86400,created:at-3*86400}),n=seed('new',{observed:at-86400});
    const r=receipt(n.id,o.id,'supersede');expect(truth().applyReconcileDecision(r,at)).toBe(true);
    expect(truth().revertReconcileDecision(r,at+10)).toBe(true);expect(row(o.id).status).toBe('provisional');
    expect(row(o.id).current_revision).toBe(3);expect(row(n.id).current_revision).toBe(3);
    expect(truth().revertReconcileDecision(r,at+20)).toBe(false);
  });
  it('only durable disputes ask for confirmation and user answers preserve both originals',()=>{
    const o=seed('I like short replies',{subject:'owner',kind:'preference'}),n=seed('I like long replies',{subject:'owner',kind:'preference'});
    const r=receipt(n.id,o.id,'dispute');expect(truth().applyReconcileDecision(r,at)).toBe(true);
    const c=db.prepare('SELECT id FROM confirm_requests').get() as {id:string};expect(c).toBeTruthy();
    truth().resolveReconcileConfirmation(c.id,'keep_new','owner',at+5);
    expect(row(n.id).status).toBe('active');expect(row(o.id).status).toBe('retracted');
    expect(db.prepare('SELECT count(*) n FROM messages_raw').get()).toEqual({n:2});
  });
  it('nightly orchestration calls A–E and E still runs after judge failure',async()=>{
    seed('one',{created:at-2*86400});seed('two',{kind:'action_item',created:at-86400});
    const result=await new SleepReconciliation(db,async()=>{throw new Error('unavailable');}).run(at);
    expect(Object.keys(result)).toEqual(['A','B','C','D','E']);expect((result.E as any).candidates).toBe(1);
  });
  it('attention accepts an explicit future event date, excludes past/unknown dates, and is idempotent',()=>{
    seed('2026-11-20 project launch',{kind:'event'});seed('an event with no date',{kind:'event'});
    seed('2025-04-01 project launch',{kind:'event'});
    const runner=new SleepReconciliation(db);expect(runner.attention(at).candidates).toBe(1);expect(runner.attention(at).candidates).toBe(0);
  });
  it('gift query follows an explicit parent/daughter edge without an online model',()=>{
    db.prepare("INSERT INTO entities(id,type,name,created_at) VALUES ('friend','Person','Alice',?),('child','Person','Emma',?)").run(at,at);
    db.prepare("INSERT INTO relationships(from_entity_id,to_entity_id,relation_type,created_at) VALUES ('child','friend','daughter_of',?)").run(at);
    const n=seed('likes princess figurines',{subject:'child',kind:'preference',observed:at-4*365*86400});
    new SleepReconciliation(db).deterministic(at);
    const r=new UnitRecallReader(db).recall("A birthday gift for Alice's daughter",10,undefined,{accessibilityMode:'active'});
    expect(r.candidates.map(c=>c.unitId)).toContain(n.id);expect(llmMock).not.toHaveBeenCalled();
    expect(new UnitRecallReader(db).recall('Alice uses JSON schema',10).candidates.map(c=>c.unitId)).not.toContain(n.id);
  });
});
