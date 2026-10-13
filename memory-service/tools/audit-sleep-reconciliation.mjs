import Database from 'better-sqlite3';
import { resolve } from 'node:path';

// Open an existing snapshot read-only; never run migrations or backfills.
const snapshot = process.argv[2];
if (!snapshot) throw new Error('Usage: node tools/audit-sleep-reconciliation.mjs <snapshot.db>');
const db = new Database(resolve(snapshot), { readonly: true, fileMustExist: true });
const has = table => !!db.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(table);
const report = { snapshot: snapshot.replace(/^.*\/data\//, 'data/'), readOnly: true,
  generatedAt: new Date().toISOString(), units: null, legacyMultiValueKeys: null,
  unitMultiValueKeys: null, forgottenOldPreferences: null, todayOldSameKeyPairs: null };
if (has('entity_properties')) report.legacyMultiValueKeys = db.prepare(`SELECT COUNT(*) AS count FROM
  (SELECT entity_id,property_key FROM entity_properties WHERE valid_to IS NULL GROUP BY entity_id,property_key HAVING COUNT(DISTINCT property_value)>1)`).get();
if (has('memory_units')) {
  report.units = db.prepare('SELECT COUNT(*) AS count FROM memory_units').get();
  report.unitMultiValueKeys = db.prepare(`SELECT COUNT(*) AS count FROM (SELECT tenant_id,owner_user_id,subject_key,predicate_key,scope_locator
    FROM memory_units WHERE status IN ('active','provisional','disputed') GROUP BY tenant_id,owner_user_id,subject_key,predicate_key,scope_locator
    HAVING COUNT(DISTINCT text)>1)`).get();
  report.todayOldSameKeyPairs = db.prepare(`SELECT COUNT(*) AS count FROM memory_units n JOIN memory_units o
    ON n.subject_key=o.subject_key AND n.predicate_key=o.predicate_key AND n.owner_user_id=o.owner_user_id
    AND n.tenant_id=o.tenant_id AND coalesce(n.scope_locator,'')=coalesce(o.scope_locator,'')
    WHERE n.created_at>=? AND o.created_at<?`).get(Math.floor(Date.now()/1000)-86400,Math.floor(Date.now()/1000)-86400);
  if (has('memory_metadata')) report.forgottenOldPreferences = db.prepare(`SELECT COUNT(*) AS count FROM memory_units u
    JOIN memory_metadata m ON m.target_type='unit' AND m.target_id=u.id
    WHERE u.kind='preference' AND u.observed_at<? AND m.consolidation_level='forgotten'`).get(Math.floor(Date.now()/1000)-3*365*86400);
}
console.log(JSON.stringify(report,null,2));
db.close();
