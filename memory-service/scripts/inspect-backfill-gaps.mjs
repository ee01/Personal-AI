#!/usr/bin/env node
import Database from 'better-sqlite3';

const OUTAGE_TS = Math.floor(new Date('2026-07-01T00:00:00Z').getTime() / 1000);
const dbPath = process.argv[2] || '/app/data/users/esone.qiu/memory.db';
const db = new Database(dbPath, { readonly: true });

const stuckHighValue = db
  .prepare(
    `SELECT m.id, length(m.content) AS len, m.importance,
            substr(m.content, 1, 300) AS preview
     FROM messages_raw m
     WHERE m.timestamp >= ?
       AND (m.importance >= 0.7 OR (m.summary IS NOT NULL AND TRIM(m.summary) != ''))
       AND (m.entities_json IS NULL OR TRIM(m.entities_json) = '' OR m.entities_json = '[]')
     LIMIT 3`,
  )
  .all(OUTAGE_TS);

const missingChunk = db
  .prepare(
    `SELECT m.id, length(m.content) AS len, substr(m.content, 1, 120) AS preview
     FROM messages_raw m
     WHERE m.content IS NOT NULL AND TRIM(m.content) != ''
       AND NOT EXISTS (
         SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
       )
     LIMIT 5`,
  )
  .all();

console.log(JSON.stringify({ stuckHighValue, missingChunk }, null, 2));
db.close();
