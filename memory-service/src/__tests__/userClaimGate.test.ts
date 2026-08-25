/**
 * TOFU claim-gate unit tests (no HTTP).
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Database } from '../storage/Database.js';
import {
  countAllUserApiKeys,
  hasUserContent,
  isNamespaceClaimable,
  recordClaim,
} from '../core/auth/userClaim.js';
import { issueUserApiKey, revokeUserApiKey } from '../core/auth/userApiKeys.js';

function openTempDb(): { db: Database['raw']; close: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-gate-'));
  const database = new Database({ dataDir: dir });
  database.migrate();
  return {
    db: database.raw,
    close: () => {
      database.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('userClaim gate', () => {
  it('treats a freshly migrated namespace as claimable', () => {
    const { db, close } = openTempDb();
    try {
      expect(countAllUserApiKeys(db)).toBe(0);
      expect(hasUserContent(db)).toBe(false);
      expect(isNamespaceClaimable(db)).toBe(true);
    } finally {
      close();
    }
  });

  it('system seed agent profiles do not count as user content', () => {
    const { db, close } = openTempDb();
    try {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        `INSERT INTO agent_profile_versions
          (id, kind, content_md, author, rationale, is_active, created_at)
         VALUES ('seed-1', 'identity', 'seed', 'system', 'Initial seed', 1, ?)`,
      ).run(now);
      expect(hasUserContent(db)).toBe(false);
      expect(isNamespaceClaimable(db)).toBe(true);
    } finally {
      close();
    }
  });

  it('blocks claim after any historical key, including revoked', () => {
    const { db, close } = openTempDb();
    try {
      const issued = issueUserApiKey(db, 'alice');
      expect(isNamespaceClaimable(db)).toBe(false);
      revokeUserApiKey(db, issued.record.id);
      expect(countAllUserApiKeys(db)).toBe(1);
      expect(isNamespaceClaimable(db)).toBe(false);
    } finally {
      close();
    }
  });

  it('blocks claim when messages_raw has content even without keys', () => {
    const { db, close } = openTempDb();
    try {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        `INSERT INTO messages_raw
          (id, content, summary, source_type, sender, timestamp, created_at, scope)
         VALUES ('m1', 'hello', 'hello', 'manual', 'alice', ?, ?, 'work')`,
      ).run(now, now);
      expect(hasUserContent(db)).toBe(true);
      expect(isNamespaceClaimable(db)).toBe(false);
    } finally {
      close();
    }
  });

  it('empty concerned_items_state array is not user content', () => {
    const { db, close } = openTempDb();
    try {
      db.prepare(
        `INSERT INTO concerned_items_state (singleton_id, version, items_json, updated_at)
         VALUES (1, 1, '[]', ?)`,
      ).run(Math.floor(Date.now() / 1000));
      expect(hasUserContent(db)).toBe(false);
      expect(isNamespaceClaimable(db)).toBe(true);
    } finally {
      close();
    }
  });

  it('non-empty concerned_items_state counts as user content', () => {
    const { db, close } = openTempDb();
    try {
      db.prepare(
        `INSERT INTO concerned_items_state (singleton_id, version, items_json, updated_at)
         VALUES (1, 1, ?, ?)`,
      ).run(JSON.stringify([{ id: 'c1' }]), Math.floor(Date.now() / 1000));
      expect(hasUserContent(db)).toBe(true);
      expect(isNamespaceClaimable(db)).toBe(false);
    } finally {
      close();
    }
  });

  it('recordClaim writes the audit singleton', () => {
    const { db, close } = openTempDb();
    try {
      recordClaim(db, { issuedFromIp: '127.0.0.1', issuedFromUa: 'test' });
      const row = db
        .prepare(`SELECT * FROM user_namespace_claims WHERE id = 1`)
        .get() as { issued_from_ip: string };
      expect(row.issued_from_ip).toBe('127.0.0.1');
    } finally {
      close();
    }
  });
});
