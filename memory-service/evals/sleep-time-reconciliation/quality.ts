import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getTestDb, cleanupTestDb } from '../../src/__tests__/setup.js';
import { SleepReconciliation } from '../../src/core/v3/SleepReconciliation.js';
import { UnitTruthMaintainer } from '../../src/core/v3/UnitTruthMaintainer.js';
import { EpisodeRepository } from '../../src/core/v3/EpisodeRepository.js';

// Gold fixtures grounded in the issue's Jira/meeting and gift scenarios. Names,
// values and elapsed years are controlled stress fixtures, not production quotes.
// This runs the REAL configured judge. No synthetic labels enter a user DB.
process.env.MEMORY_CONSOLIDATION_V3='A,B,C';
process.env.RECONCILE_B_MODE='shadow';process.env.RECONCILE_C_MODE='shadow';
const groups = [
  ...Array.from({length:20},(_,i)=>({group:'latest',expected:'supersede',
    old:`Aurora-${i} status: awaiting design, not ready for development.`,
    newer:`Aurora-${i}: the previous awaiting-design status is obsolete. Jira now confirms design approved and development started.`,oldEvidence:'third_party_report',newEvidence:'first_party_record',predicate:'status'})),
  ...Array.from({length:15},(_,i)=>({group:'both_valid',expected:'refine',
    old:`Person-${i} likes collecting princess figurines.`,newer:`Person-${i} also likes reading science fiction; the earlier hobby is still valid.`,oldEvidence:'third_party_report',newEvidence:'third_party_report',predicate:'interests'})),
  ...Array.from({length:5},(_,i)=>({group:'corroborate',expected:'corroborate',
    old:`Aurora-${i} development has started.`,newer:`Aurora-${i} implementation is underway.`,oldEvidence:'first_party_record',newEvidence:'first_party_record',predicate:'status'})),
  ...Array.from({length:10},(_,i)=>({group:'authority',expected:'dispute',
    old:`Jira confirms Aurora-${i} is ready for development.`,newer:`A system guesses Aurora-${i} is blocked; no new external evidence was found.`,oldEvidence:'first_party_record',newEvidence:'system_inference',predicate:'status'})),
];
const results:Array<Record<string,unknown>>=[];
let consumedTokens=0;
for(const [i,c] of groups.entries()) {
  cleanupTestDb();const db=getTestDb();const at=Math.floor(Date.now()/1000);
  const seed=(text:string,evidence:string,ts:number) => {
    const id=randomUUID(),ep=randomUUID();
    db.prepare(`INSERT INTO messages_raw(id,content,source_type,sender,scope,timestamp,created_at) VALUES (?,?,'jira','human','work',?,?)`).run(ep,text,ts,ts);
    db.prepare(`INSERT INTO memory_units(id,owner_user_id,memory_form,kind,subject_key,predicate_key,text,observed_at,scope_locator,tx_start,created_at,updated_at)
      VALUES (?,'quality-fixture','semantic','fact',?,?,?,?,'work',?,?,?)`).run(id,`subject-${i}`,c.predicate,text,ts,ts,ts,ts);
    db.prepare(`INSERT INTO memory_unit_sources(unit_id,episode_id,span_start_byte,span_end_byte,span_text_hash,source_role,evidence_key,provenance_family,evidence_class,created_at)
      VALUES (?,?,0,?,'fixture','primary',?,?,?,?)`).run(id,ep,Buffer.byteLength(text),ep,ep,evidence,ts);
    return id;
  };
  const old=seed(c.old,c.oldEvidence,at-3*86400),newer=seed(c.newer,c.newEvidence,at-86400);
  await new SleepReconciliation(db).reconcile(c.group==='both_valid'?'C':'B',at);
  const receipt=db.prepare('SELECT id,decision,state,reason,model_version FROM unit_reconcile_decisions').get() as any;
  const budget=db.prepare('SELECT reserved_tokens FROM reconcile_nightly_budgets').get() as any;
  consumedTokens+=budget?.reserved_tokens??0;
  let protectedAuthority=true;
  if(receipt?.state==='shadow') {
    new UnitTruthMaintainer(db,new EpisodeRepository(db)).applyReconcileDecision(receipt.id,at);
    protectedAuthority=!(db.prepare("SELECT 1 FROM memory_units WHERE id=? AND status='superseded'").get(old));
  }
  const pass=receipt?.state==='shadow' && (c.group==='authority'?protectedAuthority:receipt.decision===c.expected || c.group==='both_valid'&&receipt.decision==='noop');
  results.push({id:`judge-${i}`,group:c.group,expected:c.expected,decision:receipt?.decision,state:receipt?.state,pass,protectedAuthority,model:receipt?.model_version,error:receipt?.state==='failed'?receipt.reason:undefined});
  console.log(`${i+1}/${groups.length} ${c.group}: ${receipt?.decision??receipt?.state??'missing'} ${pass?'PASS':'FAIL'}`);
  writeFileSync(new URL('./quality-report.json',import.meta.url),JSON.stringify({generatedAt:new Date().toISOString(),realLLM:true,grounding:'issue scenarios; controlled anonymous fixtures',reservedTokenUpperBound:consumedTokens,results},null,2));
}
const latest=results.filter(r=>r.group==='latest'),both=results.filter(r=>r.group==='both_valid'),authority=results.filter(r=>r.group==='authority');
const agreement=results.filter(r=>r.decision===r.expected || r.group==='both_valid'&&r.decision==='noop').length/results.length;
const scores={latestAccuracy:latest.filter(r=>r.pass).length/latest.length,bothValidFalsePositive:both.filter(r=>r.decision==='dispute'||r.decision==='supersede').length/both.length,
  authorityViolations:authority.filter(r=>!r.protectedAuthority||r.state!=='shadow').length,agreement};
const pass=scores.latestAccuracy>=0.9 && scores.bothValidFalsePositive<=0.1 && scores.authorityViolations===0 && scores.agreement>=0.85;
writeFileSync(new URL('./quality-report.json',import.meta.url),JSON.stringify({generatedAt:new Date().toISOString(),realLLM:true,grounding:'issue scenarios; controlled anonymous fixtures',reservedTokenUpperBound:consumedTokens,scores,pass,results},null,2));
cleanupTestDb();console.log(JSON.stringify({scores,pass}));if(!pass) process.exitCode=1;
