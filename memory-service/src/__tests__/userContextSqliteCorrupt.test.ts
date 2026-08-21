import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { UserContextManager } from '../core/UserContextManager.js';
import { isSqliteCorruptError } from '../utils/sqliteErrors.js';

describe('isSqliteCorruptError', () => {
  it('matches SQLITE_CORRUPT and malformed-disk messages', () => {
    expect(
      isSqliteCorruptError(
        Object.assign(new Error('database disk image is malformed'), {
          code: 'SQLITE_CORRUPT',
        }),
      ),
    ).toBe(true);
    expect(
      isSqliteCorruptError(
        Object.assign(new Error('database disk image is malformed'), {
          code: 'SQLITE_CORRUPT_VTAB',
        }),
      ),
    ).toBe(true);
    expect(isSqliteCorruptError(new Error('no such table: foo'))).toBe(false);
  });
});

describe('UserContextManager sqlite reconnect', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('opens a new connection after SQLITE_CORRUPT on the cached one', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucm-corrupt-'));
    dirs.push(dir);
    const ucm = new UserContextManager(dir);
    const first = ucm.getContext('esone.qiu');
    const originalPrepare = first.db.prepare.bind(first.db);
    first.db.prepare = ((sql: string) => {
      if (String(sql).includes('SELECT 1')) {
        throw Object.assign(new Error('database disk image is malformed'), {
          code: 'SQLITE_CORRUPT',
        });
      }
      return originalPrepare(sql);
    }) as typeof first.db.prepare;

    const second = ucm.getContext('esone.qiu');
    expect(second.db).not.toBe(first.db);
    expect(second.db.prepare('SELECT 1 AS ok').get()).toEqual({ ok: 1 });
    ucm.closeAll();
  });
});
