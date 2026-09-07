#!/usr/bin/env node
import Database from 'better-sqlite3';
import fs from 'node:fs';

const dbPath = process.argv[2] || '/app/data/users/esone.qiu/memory.db';
const beforeBytes = fs.statSync(dbPath).size;
console.log(`[vacuum] before: ${(beforeBytes / 1e9).toFixed(2)} GB`);

const db = new Database(dbPath);
db.pragma('busy_timeout = 60000');
const started = Date.now();
db.exec('VACUUM');
db.close();
console.log(`[vacuum] completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);

const afterDb = new Database(dbPath, { readonly: true });
const check = afterDb.prepare('PRAGMA quick_check').all();
afterDb.close();
const afterBytes = fs.statSync(dbPath).size;
console.log(
  JSON.stringify(
    {
      beforeBytes,
      afterBytes,
      savedBytes: beforeBytes - afterBytes,
      quickCheck: check,
    },
    null,
    2,
  ),
);
