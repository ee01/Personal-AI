#!/usr/bin/env node
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';

const require = createRequire(import.meta.url);
const dbPath = process.argv[2] || '/app/data/users/esone.qiu/memory.db';
const db = new Database(dbPath, { readonly: true });

const rows = db
  .prepare(
    `SELECT m.id, m.source_type, m.timestamp, m.created_at,
            length(m.content) AS content_len,
            length(trim(m.content)) AS trim_len,
            substr(trim(m.content), 1, 120) AS preview
     FROM messages_raw m
     WHERE NOT EXISTS (
       SELECT 1 FROM chunks c WHERE c.file_path = 'messages/' || m.id
     )
     ORDER BY m.created_at DESC
     LIMIT 50`,
  )
  .all();

console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
db.close();
