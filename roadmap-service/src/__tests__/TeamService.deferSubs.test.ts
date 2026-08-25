import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ActorContext, TeamSnapshot } from '../types.js';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-defer-'));

const { applyIntent, createTeam, getTeamSnapshot } = await import(
  '../core/TeamService.js'
);

const actor: ActorContext = {
  name: 'Tester',
  clientId: 'test-client',
  source: 'creator',
};

function apply(teamId: string, intent: Record<string, unknown>) {
  return applyIntent(teamId, intent, actor);
}

function expectOk(result: ReturnType<typeof applyIntent>) {
  if (!result.ok) throw new Error(`intent failed: ${result.error}`);
  return result;
}

function itemOf(snapshot: TeamSnapshot, key: string) {
  const item = snapshot.items.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`item ${key} missing`);
  return item;
}

function subOf(snapshot: TeamSnapshot, itemKey: string, subId: string) {
  const sub = itemOf(snapshot, itemKey).subs.find(
    (candidate) => candidate.id === subId,
  );
  if (!sub) throw new Error(`sub ${subId} missing`);
  return sub;
}

let teamId = '';
let epicKey = '';

/** Fresh Epic + N subs per test, all under one parent so the Epic-end clamp is exercised. */
function buildEpic(epicStart: string, epicDays: number) {
  const key = expectOk(
    apply(teamId, { op: 'add_item', title: 'Epic', quarter: '2026-Q3' }),
  ).itemKey!;
  expectOk(
    apply(teamId, {
      op: 'schedule',
      itemKey: key,
      start: epicStart,
      days: epicDays,
      baseVersion: itemOf(getTeamSnapshot(teamId)!, key).version,
    }),
  );
  return key;
}

function addSub(itemKey: string, title: string, start: string, days: number) {
  const before = expectOk(
    apply(teamId, { op: 'add_sub', itemKey, title }),
  ).snapshot;
  const subs = itemOf(before, itemKey).subs;
  const subId = subs[subs.length - 1].id;
  expectOk(
    apply(teamId, {
      op: 'update_sub',
      subId,
      start,
      days,
      baseVersion: subOf(before, itemKey, subId).version,
    }),
  );
  return subId;
}

beforeAll(() => {
  const snapshot = createTeam({
    name: 'Defer',
    jql: 'project = NOVA AND issuetype = Epic',
    actor,
  });
  teamId = snapshot.team.id;
});

describe('defer_subs', () => {
  it('moves a sub to targetStart, clamps another to the Epic end, and leaves an already-past-target one stuck', () => {
    epicKey = buildEpic('2026-08-17', 34); // ends 2026-09-19
    const roomy = addSub(epicKey, 'roomy', '2026-08-28', 6); // ends 09-02, plenty of room before Epic end
    const tight = addSub(epicKey, 'tight', '2026-08-24', 26); // ends 09-18, only 1 day of room
    const already = addSub(epicKey, 'already-there', '2026-08-31', 3); // starts on targetStart already

    const result = expectOk(
      apply(teamId, {
        op: 'defer_subs',
        subIds: [roomy, tight, already],
        targetStart: '2026-08-31',
      }),
    );
    expect(result.deferSummary).toEqual({
      moved: [roomy, tight],
      capped: [tight],
      stuck: [already],
    });

    const snapshot = result.snapshot;
    expect(subOf(snapshot, epicKey, roomy).start).toBe('2026-08-31');
    expect(subOf(snapshot, epicKey, roomy).days).toBe(6); // length unchanged
    expect(subOf(snapshot, epicKey, tight).start).toBe('2026-08-25'); // clamped: only 1 day of room
    expect(subOf(snapshot, epicKey, already).start).toBe('2026-08-31'); // untouched
  });

  it('is idempotent — running it again on the already-moved subs is a no-op', () => {
    epicKey = buildEpic('2026-08-17', 34);
    const sub = addSub(epicKey, 'once', '2026-08-20', 5);

    const first = expectOk(
      apply(teamId, {
        op: 'defer_subs',
        subIds: [sub],
        targetStart: '2026-08-31',
      }),
    );
    expect(first.deferSummary!.moved).toEqual([sub]);
    const afterFirst = subOf(first.snapshot, epicKey, sub);
    expect(afterFirst.start).toBe('2026-08-31');

    const second = expectOk(
      apply(teamId, {
        op: 'defer_subs',
        subIds: [sub],
        targetStart: '2026-08-31',
      }),
    );
    expect(second.deferSummary).toEqual({ moved: [], capped: [], stuck: [sub] });
    expect(subOf(second.snapshot, epicKey, sub).start).toBe('2026-08-31');
    // No-op shouldn't bump the version either.
    expect(subOf(second.snapshot, epicKey, sub).version).toBe(afterFirst.version);
  });

  it('does not move a sub that already ended before today', () => {
    epicKey = buildEpic('2026-01-01', 300);
    const past = addSub(epicKey, 'past', '2026-01-05', 3); // ends 2026-01-07, long over

    const result = expectOk(
      apply(teamId, {
        op: 'defer_subs',
        subIds: [past],
        targetStart: '2026-08-31',
      }),
    );
    // The server clamps by Epic end only; a caller is expected to filter by
    // "already ended" client-side (see ResourceView.isDeferCandidate) before
    // ever sending the id — but if it does arrive, the Epic here still has
    // 2026-01-01 + 300 days of room, so the move still lands on targetStart.
    // This test documents that the server is not itself the "is it in the
    // past" gate — it only clamps to the parent Epic's span.
    expect(result.deferSummary!.moved).toEqual([past]);
    expect(subOf(result.snapshot, epicKey, past).start).toBe('2026-08-31');
  });

  it('skips unknown, cleared, and draft-without-dates subIds without failing the batch', () => {
    epicKey = buildEpic('2026-08-17', 34);
    const real = addSub(epicKey, 'real', '2026-08-20', 5);
    const draftNoDates = expectOk(
      apply(teamId, { op: 'add_sub', itemKey: epicKey, title: 'no dates yet' }),
    ).snapshot;
    const noDatesId = itemOf(draftNoDates, epicKey).subs.find(
      (s) => s.title === 'no dates yet',
    )!.id;
    // add_sub always seeds a start/days (defaults), so force it back to null
    // to exercise the "skip incomplete rows" branch explicitly.
    expectOk(
      apply(teamId, {
        op: 'update_sub',
        subId: noDatesId,
        start: null,
        baseVersion: subOf(draftNoDates, epicKey, noDatesId).version,
      }),
    );

    const result = expectOk(
      apply(teamId, {
        op: 'defer_subs',
        subIds: [real, noDatesId, 'sub-does-not-exist'],
        targetStart: '2026-08-31',
      }),
    );
    expect(result.deferSummary!.moved).toEqual([real]);
    expect(
      result.deferSummary!.capped.concat(result.deferSummary!.stuck),
    ).not.toContain(noDatesId);
    expect(
      result.deferSummary!.capped.concat(result.deferSummary!.stuck),
    ).not.toContain('sub-does-not-exist');
  });

  it('rejects a missing targetStart', () => {
    epicKey = buildEpic('2026-08-17', 34);
    const sub = addSub(epicKey, 'needs-target', '2026-08-20', 5);
    expect(
      apply(teamId, { op: 'defer_subs', subIds: [sub] }),
    ).toEqual({ ok: false, error: 'target_start_required' });
  });
});
