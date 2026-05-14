import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareConfigSyncFreshness,
  parseConfigSyncTimestamp,
} from '../configSyncFreshness.js';

test('compareConfigSyncFreshness detects newer local config for the same Sheet', () => {
  assert.equal(
    compareConfigSyncFreshness(
      {
        sheetId: 'sheet-123',
        last_sync_time: '2026-05-12T08:00:00.000Z',
      },
      {
        sheetId: 'sheet-123',
        last_sync_time: '2026-05-12T07:00:00.000Z',
      },
    ),
    'local-newer',
  );
});

test('compareConfigSyncFreshness treats a missing Sheet timestamp as older than local', () => {
  assert.equal(
    compareConfigSyncFreshness(
      {
        sheetId: 'sheet-123',
        last_sync_time: '2026-05-12T08:00:00.000Z',
      },
      {
        sheetId: 'sheet-123',
      },
    ),
    'local-newer',
  );
});

test('compareConfigSyncFreshness does not compare unrelated Sheets', () => {
  assert.equal(
    compareConfigSyncFreshness(
      {
        sheetId: 'local-sheet',
        last_sync_time: '2026-05-12T08:00:00.000Z',
      },
      {
        sheetId: 'remote-sheet',
        last_sync_time: '2026-05-12T07:00:00.000Z',
      },
    ),
    'unknown',
  );
});

test('parseConfigSyncTimestamp rejects invalid timestamps', () => {
  assert.equal(parseConfigSyncTimestamp('not-a-date'), null);
  assert.equal(parseConfigSyncTimestamp(''), null);
});
