import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ActorContext, TeamSnapshot } from '../types.js';

// config.ts reads DATA_DIR at import time, so the temp dir has to exist first.
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-test-'));

const { applyIntent, createTeam, getTeamSnapshot, listActivity } = await import(
  '../core/TeamService.js'
);

const actor: ActorContext = {
  name: 'Tester',
  clientId: 'test-client',
  source: 'creator',
};

const JQL =
  `issueFunction in portfolioChildrenOf('project = INIT AND Team in ("Nova CA - Brandy")') ` +
  `and issuetype = Epic and project=NOVA`;

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

let teamId = '';

beforeAll(() => {
  const snapshot = createTeam({ name: 'Nova CA', jql: JQL, actor });
  teamId = snapshot.team.id;
  expectOk(
    apply(teamId, {
      op: 'import',
      quarters: ['2026-Q3'],
      overwrite: true,
      items: [
        { key: 'NOVA-1', type: 'Epic', title: 'Imported one', quarter: '2026-Q3' },
        { key: 'NOVA-2', type: 'Epic', title: 'Imported two', quarter: '2026-Q3' },
      ],
    }),
  );
});

describe('snapshot contract', () => {
  it('exposes jqlHints derived from the team JQL', () => {
    const snapshot = getTeamSnapshot(teamId)!;
    expect(snapshot.team.jqlHints).toEqual({
      projectKey: 'NOVA',
      itemType: 'Epic',
      subType: 'Task',
      linkField: 'customfield_11450',
      confident: true,
    });
  });

  it('marks imported rows as jira and mirrors the key into jiraKey', () => {
    const item = itemOf(getTeamSnapshot(teamId)!, 'NOVA-1');
    expect(item.source).toBe('jira');
    expect(item.jiraKey).toBe('NOVA-1');
    expect(item.projectKey).toBe('NOVA');
  });
});

describe('add_item / delete_item', () => {
  it('creates a manual row with an immutable synthetic key', () => {
    const result = expectOk(
      apply(teamId, {
        op: 'add_item',
        title: 'Manual work',
        quarter: '2026-Q3',
        estimate: 2,
      }),
    );
    expect(result.itemKey).toMatch(/^LOCAL-[\w-]{8}$/);
    const item = itemOf(result.snapshot, result.itemKey!);
    expect(item.source).toBe('manual');
    expect(item.jiraKey).toBeNull();
    expect(item.type).toBe('Epic');
    expect(item.projectKey).toBe('NOVA');
  });

  it('hard-deletes an unresolved manual row together with its subs', () => {
    const created = expectOk(
      apply(teamId, { op: 'add_item', title: 'Throwaway' }),
    );
    const key = created.itemKey!;
    expectOk(apply(teamId, { op: 'add_sub', itemKey: key, title: 'child' }));
    const removed = expectOk(apply(teamId, { op: 'delete_item', itemKey: key }));
    expect(
      removed.snapshot.items.some((item) => item.key === key),
    ).toBe(false);
  });

  it('refuses to delete rows that already have a Jira issue', () => {
    const result = apply(teamId, { op: 'delete_item', itemKey: 'NOVA-1' });
    expect(result).toEqual({ ok: false, error: 'item_has_jira' });
  });
});

describe('resolve_item', () => {
  it('backfills the Jira key without any version check and stays idempotent', () => {
    const key = expectOk(
      apply(teamId, { op: 'add_item', title: 'To be created', quarter: '2026-Q3' }),
    ).itemKey!;

    // Simulate a concurrent drag bumping the version before the key comes back.
    const before = itemOf(getTeamSnapshot(teamId)!, key);
    expectOk(
      apply(teamId, {
        op: 'schedule',
        itemKey: key,
        baseVersion: before.version,
        start: '2026-07-01',
        days: 10,
      }),
    );

    const resolved = expectOk(
      apply(teamId, { op: 'resolve_item', itemKey: key, jiraKey: 'NOVA-77' }),
    );
    const item = itemOf(resolved.snapshot, key);
    expect(item.key).toBe(key);
    expect(item.jiraKey).toBe('NOVA-77');
    expect(item.source).toBe('manual');

    const again = expectOk(
      apply(teamId, { op: 'resolve_item', itemKey: key, jiraKey: 'NOVA-77' }),
    );
    expect(itemOf(again.snapshot, key).version).toBe(item.version);

    expect(apply(teamId, { op: 'delete_item', itemKey: key })).toEqual({
      ok: false,
      error: 'item_has_jira',
    });
  });

  it('corrects type and projectKey when provided', () => {
    const key = expectOk(apply(teamId, { op: 'add_item', title: 'Retyped' }))
      .itemKey!;
    const resolved = expectOk(
      apply(teamId, {
        op: 'resolve_item',
        itemKey: key,
        jiraKey: 'OTHER-5',
        type: 'Task',
        projectKey: 'OTHER',
      }),
    );
    const item = itemOf(resolved.snapshot, key);
    expect(item.type).toBe('Task');
    expect(item.projectKey).toBe('OTHER');
  });
});

describe('resolve_draft', () => {
  function subOf(snapshot: TeamSnapshot, itemKey: string, subId: string) {
    const sub = itemOf(snapshot, itemKey).subs.find(
      (candidate) => candidate.id === subId,
    );
    if (!sub) throw new Error(`sub ${subId} missing`);
    return sub;
  }

  function activityFor(snapshotTeamId: string, subId: string) {
    return listActivity(snapshotTeamId, 200).filter(
      (entry) => entry.op === 'resolve_draft' && entry.targetKey === subId,
    );
  }

  /**
   * Both the create modal and the extension write the same child mapping — the
   * extension right after the issue exists, the page once the batch returns.
   */
  it('is a no-op when the same mapping arrives twice', () => {
    const itemKey = expectOk(
      apply(teamId, { op: 'add_item', title: 'Parent for children' }),
    ).itemKey!;
    const withSub = expectOk(
      apply(teamId, { op: 'add_sub', itemKey, title: 'child one' }),
    ).snapshot;
    const subId = itemOf(withSub, itemKey).subs[0].id;

    const first = expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: subId, jiraKey: 'NOVA-500' }],
      }),
    ).snapshot;
    const resolved = subOf(first, itemKey, subId);
    expect(resolved.key).toBe('NOVA-500');
    expect(resolved.temp).toBe(false);

    const second = expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: subId, jiraKey: 'NOVA-500' }],
      }),
    ).snapshot;
    const again = subOf(second, itemKey, subId);
    expect(again.version).toBe(resolved.version);
    expect(again.key).toBe('NOVA-500');
    expect(activityFor(teamId, subId)).toHaveLength(1);
  });

  it('still applies a corrected key for an already resolved sub', () => {
    const itemKey = expectOk(
      apply(teamId, { op: 'add_item', title: 'Parent for retry' }),
    ).itemKey!;
    const withSub = expectOk(
      apply(teamId, { op: 'add_sub', itemKey, title: 'child two' }),
    ).snapshot;
    const subId = itemOf(withSub, itemKey).subs[0].id;

    expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: subId, jiraKey: 'NOVA-600' }],
      }),
    );
    const corrected = expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: subId, jiraKey: 'NOVA-601' }],
      }),
    ).snapshot;
    expect(subOf(corrected, itemKey, subId).key).toBe('NOVA-601');
  });
});

describe('import guard', () => {
  it('keeps manual rows (and their subs) out of an overwrite import', () => {
    const key = expectOk(
      apply(teamId, {
        op: 'add_item',
        title: 'Survivor',
        quarter: '2026-Q3',
      }),
    ).itemKey!;
    expectOk(apply(teamId, { op: 'add_sub', itemKey: key, title: 'sub keeps' }));

    const after = expectOk(
      apply(teamId, {
        op: 'import',
        quarters: ['2026-Q3'],
        overwrite: true,
        items: [
          {
            key: 'NOVA-3',
            type: 'Epic',
            title: 'Only survivor of the import',
            quarter: '2026-Q3',
          },
        ],
      }),
    ).snapshot;

    const survivor = itemOf(after, key);
    expect(survivor.source).toBe('manual');
    expect(survivor.subs.map((sub) => sub.title)).toContain('sub keeps');
    expect(after.items.some((item) => item.key === 'NOVA-1')).toBe(false);
    expect(after.items.some((item) => item.key === 'NOVA-3')).toBe(true);
  });

  it('updates the manual row in place when its Jira key is imported', () => {
    const key = expectOk(
      apply(teamId, { op: 'add_item', title: 'Created in Jira', quarter: '2026-Q4' }),
    ).itemKey!;
    expectOk(
      apply(teamId, { op: 'resolve_item', itemKey: key, jiraKey: 'NOVA-900' }),
    );

    const after = expectOk(
      apply(teamId, {
        op: 'import',
        quarters: ['2026-Q4'],
        overwrite: true,
        items: [
          {
            key: 'NOVA-900',
            type: 'Epic',
            title: 'Created in Jira (renamed)',
            quarter: '2026-Q4',
          },
        ],
      }),
    ).snapshot;

    expect(after.items.filter((item) => item.jiraKey === 'NOVA-900')).toHaveLength(
      1,
    );
    expect(after.items.some((item) => item.key === 'NOVA-900')).toBe(false);
    const promoted = itemOf(after, key);
    expect(promoted.source).toBe('jira');
    expect(promoted.title).toBe('Created in Jira (renamed)');
  });
});
