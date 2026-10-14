/** Isolated before/after proof. Uses the eval schema and an injected gold judge;
 * never opens user data, sends an LLM request, or qualifies a production live gate. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestDb, cleanupTestDb } from '../src/__tests__/setup.js';
import { SleepReconciliation } from '../src/core/v3/SleepReconciliation.js';
import { UnitTruthMaintainer } from '../src/core/v3/UnitTruthMaintainer.js';
import { EpisodeRepository } from '../src/core/v3/EpisodeRepository.js';
import { UnitRecallReader } from '../src/core/v3/UnitRecallReader.js';
import { ForgettingEngine } from '../src/core/ForgettingEngine.js';

process.env.MEMORY_CONSOLIDATION_V3 = 'A,B';
process.env.RECONCILE_B_MODE = 'shadow';
process.env.MEMORY_READ_V3_VECTOR = '';
process.env.FORGETTING_KIND_POLICY = 'on';
const db = getTestDb();
const at = Math.floor(Date.now() / 1000);
const day = 86400;
function seed(text: string, subject: string, kind: string, age: number, evidence: string) {
  const id = randomUUID(), ep = randomUUID(), ts = at - age;
  db.prepare(`INSERT INTO messages_raw(id,content,source_type,sender,scope,timestamp,created_at)
    VALUES (?,?,'manual','demo','work',?,?)`).run(ep,text,ts,ts);
  db.prepare(`INSERT INTO memory_units(id,owner_user_id,memory_form,kind,status,subject_key,predicate_key,
    text,normalized_text,observed_at,scope_locator,tx_start,created_at,updated_at)
    VALUES (?,'demo','semantic',?,'provisional',?,'status',?,?,?,'work',?,?,?)`)
    .run(id,kind,subject,text,text.toLowerCase(),ts,ts,ts,ts);
  db.prepare(`INSERT INTO memory_unit_sources(unit_id,episode_id,span_start_byte,span_end_byte,span_text_hash,
    source_role,evidence_key,provenance_family,evidence_class,created_at)
    VALUES (?,?,0,?,'demo','primary',?,?,?,?)`).run(id,ep,Buffer.byteLength(text),ep,ep,evidence,ts);
  db.prepare(`INSERT INTO memory_unit_views(unit_id,view_kind,raw_text,segmented_text,source_unit_revision,created_by,created_at)
    VALUES (?,'body',?,?,1,'demo',?)`).run(id,text,text,ts);
  return {id,ep};
}
try {
  console.log('隔离演示：内存数据库；固定判决；不代表真实模型质量、生产 live 或界面验收。');
  const old = seed('Aurora：等待设计，尚未开始开发','Aurora','fact',3*day,'third_party_report');
  const newer = seed('Aurora：设计已批准，已开始开发','Aurora','fact',3600,'first_party_record');
  const reader = new UnitRecallReader(db);
  const read = (q: string, mode: 'active'|'passive' = 'active') => reader.recall(q,10,undefined,
    {ownerUserId:'demo',scopeLocator:'work',accessibilityMode:mode}).candidates;
  const before = read('Aurora');
  assert.equal(before.length,2);
  const runner = new SleepReconciliation(db,async () => ({decision:'supersede',reason:'演示 gold：较新一手记录替代旧转述'}));
  runner.deterministic(at);
  await runner.reconcile('B',at);
  const receipt = db.prepare("SELECT id,state,decision FROM unit_reconcile_decisions WHERE phase='B'").get() as {id:string;state:string;decision:string};
  assert.equal(receipt.state,'shadow');
  assert.equal(read('Aurora').length,2); // Shadow never changes truth.
  // Explicit application exists only in this disposable fixture, not a live qualification bypass.
  assert.equal(new UnitTruthMaintainer(db,new EpisodeRepository(db)).applyReconcileDecision(receipt.id,at),true);
  const after = read('Aurora');
  assert.deepEqual(after.map(c=>c.unitId),[newer.id]);
  assert.equal((db.prepare('SELECT content FROM messages_raw WHERE id=?').get(old.ep) as {content:string}).content,
    'Aurora：等待设计，尚未开始开发');
  console.table([
    {场景:'同槽当前召回',整理前:before.map(c=>c.text).join('；'),整理后:after.map(c=>c.text).join('；')},
    {场景:'旧原文',整理前:'存在',整理后:'仍存在；旧 unit 已 superseded；修订回执可追溯'},
    {场景:'shadow',整理前:'两条',整理后:'仍两条，只有 fixture 显式应用后才改变'},
  ]);

  const parent = randomUUID(), child = randomUUID();
  db.prepare("INSERT INTO entities(id,type,name,aliases_json,created_at) VALUES (?,'Person','朋友A','[\"Alex\"]',?)").run(parent,at);
  db.prepare("INSERT INTO entities(id,type,name,created_at) VALUES (?,'Person','朋友A的女儿',?)").run(child,at);
  db.prepare("INSERT INTO relationships(from_entity_id,to_entity_id,relation_type,created_at) VALUES (?,?,'has_daughter',?)")
    .run(parent,child,at);
  const pref = seed('喜欢公主角色的手办',child,'preference',4*365*day,'third_party_report');
  db.prepare("INSERT INTO memory_metadata(target_type,target_id,salience_score,half_life_days,created_at) VALUES ('unit',?,0.8,30,?)")
    .run(pref.id,at-4*365*day);
  runner.deterministic(at);
  await new ForgettingEngine(db).runForgettingCycle();
  const query = '给 Alex 的女儿挑生日礼物';
  assert.ok(read(query).some(c=>c.unitId===pref.id));
  assert.ok(!read(query,'passive').some(c=>c.unitId===pref.id));
  const metadata = db.prepare('SELECT consolidation_level,retrieval_tier FROM memory_metadata WHERE target_id=?').get(pref.id);
  assert.deepEqual(metadata,{consolidation_level:'archived',retrieval_tier:'archive_only'});
  console.table([{场景:'四年前的偏好',提问:query,主动召回:read(query).map(c=>c.text).join('；'),被动展示:'不展示已归档偏好',遗忘:'archive_only，未软删'}]);
  console.log('PASS：最新值单独召回、旧原文保留、shadow 不改真值、亲属/alias 锚定、远期偏好不软删。');
} finally {
  cleanupTestDb();
}
