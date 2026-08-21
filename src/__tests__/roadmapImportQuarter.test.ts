/**
 * Guards the quarter backfill used by Roadmap's JQL import.
 *
 * Real data that motivated this: NOVA-13139 has no `Target Delivery Quarter` of
 * its own, its parent INIT-30074 carries `2026-Q4`, and the Epic's Target dates
 * (2026-07-01 → 2026-09-30) would have suggested Q3. So the parent's value is
 * the only correct source, and date-derived guessing is deliberately absent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyParentQuarters,
  chunk,
  parentKeysNeedingQuarter,
  PARENT_LOOKUP_BATCH,
} from '../roadmapImportQuarter.js';

test('asks only for parents of rows that still lack a quarter, deduplicated', () => {
  const rows = [
    { key: 'NOVA-1' },
    { key: 'NOVA-2' },
    { key: 'NOVA-3', quarter: '2026-Q3' },
    { key: 'NOVA-4' },
  ];
  const parents = new Map([
    ['NOVA-1', 'INIT-10'],
    ['NOVA-2', 'INIT-10'],
    ['NOVA-3', 'INIT-77'],
    // NOVA-4 has no Parent Link at all.
  ]);
  assert.deepEqual(parentKeysNeedingQuarter(rows, parents), ['INIT-10']);
});

test('copies the parent quarter onto children that have none', () => {
  const rows = [{ key: 'NOVA-13139' }, { key: 'NOVA-13140' }];
  const parents = new Map([
    ['NOVA-13139', 'INIT-30074'],
    ['NOVA-13140', 'INIT-30074'],
  ]);
  const filled = applyParentQuarters(
    rows,
    parents,
    new Map([['INIT-30074', '2026-Q4']]),
  );
  assert.equal(filled, 2);
  assert.deepEqual(
    rows.map((r) => r.quarter),
    ['2026-Q4', '2026-Q4'],
  );
});

test("never overwrites a quarter the Epic set itself", () => {
  const rows = [{ key: 'NOVA-1', quarter: '2026-Q3' }];
  const filled = applyParentQuarters(
    rows,
    new Map([['NOVA-1', 'INIT-10']]),
    new Map([['INIT-10', '2026-Q4']]),
  );
  assert.equal(filled, 0);
  assert.equal(rows[0].quarter, '2026-Q3');
});

test('leaves rows untouched when the parent has no quarter either', () => {
  const rows = [{ key: 'NOVA-1' }];
  const filled = applyParentQuarters(
    rows,
    new Map([['NOVA-1', 'INIT-10']]),
    new Map(),
  );
  assert.equal(filled, 0);
  assert.equal(rows[0].quarter, undefined);
});

test('batches parent lookups so one import cannot blow the Jira page size', () => {
  const keys = Array.from({ length: 120 }, (_, i) => `INIT-${i}`);
  const batches = chunk(keys);
  assert.equal(batches.length, 3);
  assert.ok(batches.every((b) => b.length <= PARENT_LOOKUP_BATCH));
  assert.deepEqual(batches.flat(), keys);
});
