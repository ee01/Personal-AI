import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import BetterSqlite3 from 'better-sqlite3';
vi.mock('../llm/LLMClient.js', () => ({getLLMClient: () => ({generate: vi.fn(), generateJSON: vi.fn()}), LLMClient: vi.fn()}));
vi.mock('../llm/EmbeddingClient.js', () => ({EmbeddingClient: {getInstance: vi.fn().mockRejectedValue(new Error('disabled')), isLoaded:()=>false, getModelName:()=> 'disabled'}}));
import { getTestDb } from './setup.js';
import { IngestionPipeline } from '../core/IngestionPipeline.js';
import { classifyWrite, SystemWriteContext, markRecalled, stripRecalled, backfillWriteProvenance, applyTurnTaint, episodePromotionEligible } from '../core/WriteProvenanceGate.js';
import { SalienceScorer } from '../core/SalienceScorer.js';
import { ExtractionWorker } from '../core/v3/ExtractionWorker.js';
import { MemoryClaimAttributionService } from '../core/MemoryClaimAttributionService.js';
import { TruthMaintainer } from '../core/TruthMaintainer.js';
import { assembleEvidenceContext, formatRecalledContext } from '../routes/ask.js';
import { buildComposerGenerationPrompt } from '../core/ContextAssistService.js';
import type { RecallItem, ComposerAssistEvidence } from '../types/index.js';

let db: BetterSqlite3.Database;
let pipeline: IngestionPipeline;
const kinds = ['heartbeat','cron','subagent','reflection','dream'] as const;
beforeAll(() => {
  vi.stubEnv('INGEST_LLM_EXTRACTION_ENABLED', 'false');
  vi.stubEnv('INGEST_EMBEDDING_ENABLED', 'false');
  vi.stubEnv('MEMORY_SUPPLY_DECOUPLED', 'true');
  vi.stubEnv('MEMORY_WRITE_V3_SHADOW', 'true');
  for (const flag of ['WRITE_ORIGIN_GATE_ENABLED','RECALL_LOOP_GUARD_ENABLED','TURN_TAINT_ENABLED']) vi.stubEnv(flag,'true');
  db = getTestDb(); pipeline = new IngestionPipeline(db, undefined, 'owner');
});
afterAll(() => vi.unstubAllEnvs());

describe('background durable boundary (10)', () => {
  it.each(Array.from({length:10},(_,i)=>i))('artifact %i is persisted, gated in claims and shadow queue', async i => {
    const kind = kinds[i%5];
    const result = await SystemWriteContext.run(kind, () => pipeline.ingest({content:`我喜欢简洁沟通。后台产物 ${i}`,sourceType:i<5?'manual':'system', metadata:{isSelf:true}}));
    expect(result.status).toBe('created');
    expect(db.prepare('SELECT origin_class,session_kind,promotion_eligible FROM messages_raw WHERE id=?').get(result.id)).toEqual({origin_class:'system',session_kind:kind,promotion_eligible:0});
    expect(new ExtractionWorker(db,'owner').enqueueEpisode(result.id)).toBeNull();
    expect(new MemoryClaimAttributionService(db).getClaimsForMessage(result.id).every(c=> !c.policy.profileCandidate && !c.policy.currentTruthCandidate && !c.policy.actionCandidate)).toBe(true);
    expect(await new TruthMaintainer(db).processPropertyChange({entityId:'missing',key:'style',value:'brief',actionType:'set',sourceMessageId:result.id})).toEqual({action:'rejected',propertyId:0});
  });
  it('async contexts do not leak between simultaneous sessions', async () => {
    const values = await Promise.all(kinds.map(kind => SystemWriteContext.run(kind,async()=>{await Promise.resolve();return classifyWrite({sourceType:'manual'}).sessionKind;})));
    expect(values).toEqual(kinds); expect(SystemWriteContext.current()).toBeUndefined();
  });
});

describe('ask → compose → ingest loop (10)', () => {
  it.each(Array.from({length:10},(_,i)=>i))('replay %i adds exposures and creates no raw or unit', async i => {
    const id=`message:original-${i}`;
    const item = {id,type:'message',content:'我喜欢简洁沟通。',source:'glip',score:0.9} as RecallItem;
    const askContext = i%2 ? formatRecalledContext([item]) : assembleEvidenceContext([item],{tokenBudget:1000,fullCount:1}).text;
    expect(askContext).toContain('<recalled');
    const before = db.prepare('SELECT (SELECT count(*) FROM messages_raw) raw,(SELECT count(*) FROM memory_units) units,(SELECT count(*) FROM memory_exposures) exposures').get() as any;
    const compose = buildComposerGenerationPrompt(
      {surface:'ringcentral_message',contextType:'message_thread',scenario:'instant_message_reply',primaryText:'请复述偏好。',visibleMessages:[{sender:'Alice',text:'请复述偏好。'}]},
      [{id,type:'message',snippet:askContext} as ComposerAssistEvidence],
      'instant_message_reply',
      {summary:{scene:'work_im',voiceMode:'speak_as_user',representationMode:'user_draft',usedSlotKinds:[],reasonCodes:[]} as any,controls:[],speakableContext:[],softControls:[],blockedValues:[]},
    );
    expect(compose).toContain('<recalled');
    const content = compose!;
    const result = await pipeline.ingest({sourceType:'ai_chat',content, metadata:{role:'assistant',turn_id:`replay-${i}`}});
    expect(result.decision?.reason).toBe('recalled_exposure');
    const after = db.prepare('SELECT (SELECT count(*) FROM messages_raw) raw,(SELECT count(*) FROM memory_units) units,(SELECT count(*) FROM memory_exposures) exposures').get() as any;
    expect(after.raw).toBe(before.raw);expect(after.units).toBe(before.units);expect(after.exposures).toBe(before.exposures+1);
    expect(db.prepare('SELECT surface,turn_id FROM memory_exposures ORDER BY id DESC LIMIT 1').get()).toEqual({surface:'ingest_loop',turn_id:`replay-${i}`});
    expect(stripRecalled(content)).not.toMatch(/<\/?recalled/);
  });
});

describe('independent source salience (10)', () => {
  it.each(Array.from({length:10},(_,i)=>i))('same author family %i cannot reinforce itself', async i => {
    const term=`FamilyGate${i}`;
    const sender=`colleague-${i}`;
    const scorer=new SalienceScorer(db);
    const family=`glip:${sender}`;
    await pipeline.ingest({sourceType:'glip',sender,content:`${term} discussed once`});
    const first=scorer.computeFrequency([term],7,family);
    await pipeline.ingest({sourceType:'glip',sender,content:`${term} discussed again`});
    expect(scorer.computeFrequency([term],7,family)).toBe(first);
    await pipeline.ingest({sourceType:'system',sender:'system',content:`${term} generated by heartbeat`});
    expect(scorer.computeFrequency([term],7,family)).toBe(first);
    await pipeline.ingest({sourceType:'glip',sender:`independent-${i}`,content:`${term} independently observed`});
    expect(scorer.computeFrequency([term],7,family)).toBe(first+1);
  });
});

describe('declared external tool turn taint (6)', () => {
  it.each(['web_fetch','openclaw','external_ai','web_fetch','openclaw','external_ai'])('tool %s taints subsequent assistant and resets at user', async (tool) => {
    const session=crypto.randomUUID();
    await pipeline.ingest({sourceType:'manual',content:`external ${session}`,metadata:{session_id:session,role:'tool',tool_name:tool}});
    for (const n of [1,2]) {
      const result=await pipeline.ingest({sourceType:'manual',content:`assistant ${session} ${n}`,metadata:{session_id:session,role:'assistant'}});
      expect(db.prepare('SELECT origin_class,promotion_eligible FROM messages_raw WHERE id=?').get(result.id)).toEqual({origin_class:'untrusted',promotion_eligible:0});
    }
    const local=applyTurnTaint(db,{sourceType:'manual',metadata:{session_id:`local-${session}`,role:'assistant',tool_name:'read_file'}});
    expect(local.metadata?.turn_tainted).toBeUndefined();
    await pipeline.ingest({sourceType:'manual',content:`user ${session}`,metadata:{session_id:session,role:'user'}});
    expect(classifyWrite(applyTurnTaint(db,{sourceType:'manual',metadata:{session_id:session,role:'assistant'}})).originClass).toBe('agent');
  });
});

describe('historical backfill owner safety (100)', () => {
  it('production content-free owner sample has <=2% misclassification', () => {
    const sample = JSON.parse(readFileSync(new URL('../../evals/write-provenance-gate/owner-sample.json', import.meta.url), 'utf8'));
    expect(sample).toHaveLength(100);
    const rejected = sample.filter((row:any) => classifyWrite(row, 'owner').originClass !== 'owner');
    expect(rejected.length).toBeLessThanOrEqual(2);
  });
  it('actual migration and user-aware backfill preserve 100 owner rows, malformed JSON, and existing exposures', () => {
    const old=new BetterSqlite3(':memory:');
    // Pre-074 schema: only columns the migration reads/writes. Execute the
    // production migration verbatim, not a duplicate implementation.
    old.exec(`CREATE TABLE messages_raw(id TEXT PRIMARY KEY,content TEXT,source_type TEXT,sender TEXT,metadata_json TEXT,timestamp INTEGER);
    CREATE TABLE memory_unit_sources(unit_id TEXT,episode_id TEXT,evidence_key TEXT);
    CREATE TABLE memory_units(id TEXT PRIMARY KEY);
    CREATE TABLE memory_exposures(id INTEGER PRIMARY KEY,request_id TEXT,unit_id TEXT,surface TEXT,rank INTEGER,shown INTEGER,quieted INTEGER,no_result INTEGER,policy_version TEXT,created_at INTEGER);
    CREATE TABLE reflection_artifacts(id TEXT); CREATE TABLE notification_records(id TEXT); CREATE TABLE dream_runs(id TEXT);
    CREATE TABLE memory_claims(source_message_id TEXT,profile_candidate INTEGER,current_truth_candidate INTEGER,action_candidate INTEGER);
    INSERT INTO memory_units VALUES ('original');
    INSERT INTO memory_exposures VALUES(1,'old','original','ask',0,1,0,0,NULL,1);`);
    const insert=old.prepare('INSERT INTO messages_raw VALUES(?,?,?,?,?,?)');
    for(let i=0;i<100;i++) insert.run(`owner-${i}`,'original owner fact',i%2?'glip':'manual',i%2?'owner':null,i%3===0?'invalid JSON':JSON.stringify({isSelf:true}),1);
    insert.run('background','我喜欢重复。','manual','owner',JSON.stringify({session_kind:'heartbeat',isSelf:true}),1);
    insert.run('unknown','unknown','unrecognized',null,'{}',1);
    old.exec(readFileSync(new URL('../storage/migrations/074_write_provenance_gate.sql',import.meta.url),'utf8'));
    const receipt=SystemWriteContext.run('cron', () => backfillWriteProvenance(old,'owner'));
    expect(receipt.rows).toBe(102);
    expect((old.prepare("SELECT count(*) n FROM messages_raw WHERE id LIKE 'owner-%' AND origin_class='owner' AND promotion_eligible=1").get() as any).n).toBe(100);
    expect(episodePromotionEligible(old,'background')).toBe(false);
    expect(old.prepare("SELECT origin_class FROM messages_raw WHERE id='unknown'").get()).toEqual({origin_class:'untrusted'});
    expect((old.prepare('SELECT count(*) n FROM memory_exposures').get() as any).n).toBe(1);
    expect(backfillWriteProvenance(old,'owner').changed).toBe(0);
    expect(classifyWrite({sourceType:'manual',sender:'memory-import',metadata:{importBatchId:'batch'}}).originClass).toBe('untrusted');
    old.close();
  });
});
