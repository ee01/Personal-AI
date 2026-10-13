import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { UnitTruthMaintainer } from '../src/core/v3/UnitTruthMaintainer.js';
import { EpisodeRepository } from '../src/core/v3/EpisodeRepository.js';

// Operator tool; never auto-generates gold labels or enables live itself.
const [command,path,input,reviewer]=process.argv.slice(2);
if(!path || !['review','revert'].includes(command)) throw new Error('Usage: tsx tools/review-sleep-reconciliation.ts review <db> <labels.json> <reviewer> | revert <db> <decision-id>');
const db=new Database(path,{fileMustExist:true});db.pragma('foreign_keys=ON');
try {
  if(command==='review') {
    if(!reviewer) throw new Error('An identified human reviewer is required');
    const labels=JSON.parse(readFileSync(input,'utf8')) as Array<{decisionId:string;expectedDecision:string}>;
    db.transaction(()=>{
      for(const label of labels) {
        if(!['corroborate','refine','supersede','dispute','noop'].includes(label.expectedDecision)) throw new Error('Invalid gold label');
        const decision=db.prepare("SELECT 1 FROM unit_reconcile_decisions WHERE id=? AND state='shadow'").get(label.decisionId);
        if(!decision) throw new Error('Review requires an existing shadow decision');
        db.prepare(`INSERT INTO reconcile_shadow_reviews(decision_id,expected_decision,reviewed_by,reviewed_at) VALUES (?,?,?,?)
          ON CONFLICT(decision_id) DO UPDATE SET expected_decision=excluded.expected_decision,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at`)
          .run(label.decisionId,label.expectedDecision,reviewer,Math.floor(Date.now()/1000));
      }
    }).immediate();
    console.log(JSON.stringify({reviewed:labels.length}));
  } else {
    const reverted=new UnitTruthMaintainer(db,new EpisodeRepository(db)).revertReconcileDecision(input);
    console.log(JSON.stringify({reverted}));if(!reverted) process.exitCode=1;
  }
} finally {db.close();}
