#!/usr/bin/env node
import Database from 'better-sqlite3';

const OUTAGE_TS = Math.floor(new Date('2026-07-01T00:00:00Z').getTime() / 1000);
const dbPath = process.argv[2] || '/app/data/users/esone.qiu/memory.db';
const db = new Database(dbPath, { readonly: true });

const missingEntities = db
  .prepare(
    `SELECT COUNT(*) AS c FROM messages_raw m
     WHERE m.timestamp >= ?
       AND m.content IS NOT NULL AND TRIM(m.content) != ''
       AND (m.entities_json IS NULL OR TRIM(m.entities_json) = '')`,
  )
  .get(OUTAGE_TS).c;

const highValue = db
  .prepare(
    `SELECT COUNT(*) AS c FROM messages_raw m
     WHERE m.timestamp >= ?
       AND m.content IS NOT NULL AND TRIM(m.content) != ''
       AND (m.importance >= 0.7 OR (m.summary IS NOT NULL AND TRIM(m.summary) != ''))
       AND (m.entities_json IS NULL OR TRIM(m.entities_json) = '')`,
  )
  .get(OUTAGE_TS).c;

console.log(
  JSON.stringify(
    {
      outageStart: '2026-07-01',
      missingEntitiesJsonSinceOutage: missingEntities,
      highValueMissingEntitiesJson: highValue,
    },
    null,
    2,
  ),
);
db.close();
