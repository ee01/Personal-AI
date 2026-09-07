#!/usr/bin/env node
import Database from 'better-sqlite3';

const EPOCH_FLOOR = 946684800;
const dbPath = process.argv[2] || '/app/data/users/esone.qiu/memory.db';
const db = new Database(dbPath, { readonly: true });

const summary = db
  .prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS good_created_at,
       SUM(CASE WHEN updated_at IS NOT NULL AND updated_at >= ? THEN 1 ELSE 0 END) AS good_updated_at,
       SUM(CASE WHEN metadata_json IS NOT NULL AND json_valid(metadata_json) = 1
                AND json_extract(metadata_json, '$.timestamp_recovered') = 1 THEN 1 ELSE 0 END) AS already_recovered
     FROM messages_raw
     WHERE timestamp < ?`,
  )
  .get(EPOCH_FLOOR, EPOCH_FLOOR, EPOCH_FLOOR);

const samples = db
  .prepare(
    `SELECT id, timestamp, created_at, updated_at,
            substr(metadata_json, 1, 200) AS meta_preview
     FROM messages_raw
     WHERE timestamp < ?
     ORDER BY created_at DESC
     LIMIT 8`,
  )
  .all(EPOCH_FLOOR);

console.log(JSON.stringify({ summary, samples }, null, 2));
db.close();
