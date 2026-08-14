import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ActorContext } from '../types.js';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-refresh-'));

const { applyIntent, createTeam, getTeamSnapshot, listActivity, JIRA_REFRESH_TTL_MS } =
  await import('../core/TeamService.js');

const actor: ActorContext = {
  name: 'Tester',
  clientId: 'test-client',
  source: 'extension',
};

function apply(teamId: string, intent: Record<string, unknown>) {
  return applyIntent(teamId, intent, actor);
}

function expectOk(result: ReturnType<typeof applyIntent>) {
  if (!result.ok) throw new Error(`intent failed: ${result.error}`);
  return result;
}

describe('refresh_from_jira', () => {
  let teamId = '';

  beforeAll(() => {
    const snapshot = createTeam({
      name: 'Refresh',
      jql: 'project = NOVA AND issuetype = Epic',
      actor,
    });
    teamId = snapshot.team.id;
    expectOk(
      apply(teamId, {
        op: 'import',
        quarters: ['2026-Q3'],
        items: [
          {
            key: 'NOVA-100',
            type: 'Epic',
            title: 'Old title',
            quarter: '2026-Q3',
            targetStart: '2026-08-01',
            targetEnd: '2026-08-14',
          },
        ],
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'schedule',
        itemKey: 'NOVA-100',
        start: '2026-08-01',
        days: 14,
        lane: 0,
        baseVersion: getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-100')!
          .version,
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'add_sub',
        itemKey: 'NOVA-100',
        title: 'child',
        start: '2026-08-03',
        days: 5,
        owner: 'esone',
      }),
    );
    const sub = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-100')!.subs[0];
    expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: sub.id, jiraKey: 'NOVA-101' }],
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'update_assignee_map',
        assigneeMap: { esone: 'Esone Qiu' },
      }),
    );
  });

  it('diffs summary/description/target and relocates a scheduled bar', () => {
    const fetchedAt = Date.now() + 1000;
    expectOk(
      apply(teamId, {
        op: 'refresh_from_jira',
        issues: [
          {
            key: 'NOVA-100',
            fetchedAt,
            fields: {
              summary: 'New title from Jira',
              description: 'Epic body',
              targetStart: '2026-08-04',
              targetEnd: '2026-08-20',
            },
          },
        ],
      }),
    );
    const item = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-100')!;
    expect(item.title).toBe('New title from Jira');
    expect(item.description).toBe('Epic body');
    expect(item.targetStart).toBe('2026-08-04');
    expect(item.targetEnd).toBe('2026-08-20');
    expect(item.start).toBe('2026-08-04');
    expect(item.days).toBe(17);
    expect(item.alias).toBeNull();
    expect(
      listActivity(teamId).some((a) => a.op === 'refresh_from_jira'),
    ).toBe(true);
  });

  it('is idempotent on same values and respects TTL', () => {
    const before = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-100')!;
    const version = before.version;
    expectOk(
      apply(teamId, {
        op: 'refresh_from_jira',
        issues: [
          {
            key: 'NOVA-100',
            fetchedAt: Date.now() + 2000,
            fields: {
              summary: 'New title from Jira',
              description: 'Epic body',
              targetStart: '2026-08-04',
              targetEnd: '2026-08-20',
            },
          },
        ],
      }),
    );
    const afterTtl = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-100')!;
    expect(afterTtl.version).toBe(version);
    expect(JIRA_REFRESH_TTL_MS).toBe(10 * 60 * 1000);
  });

  it('does not rewrite owner when mapped full name matches assignee', () => {
    const sub = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-100')!.subs[0];
    expect(sub.owner).toBe('esone');
    // TTL will skip unless we wait — this test file's previous refresh already
    // stamped jira_refreshed_at. Direct DB poke is avoided; instead verify the
    // matcher via a fresh team below.
  });
});

describe('refresh_from_jira assignee + sub', () => {
  it('updates sub description and remaps unmatched assignee', () => {
    const snapshot = createTeam({
      name: 'Refresh2',
      jql: 'project = NOVA AND issuetype = Epic',
      actor,
    });
    const teamId = snapshot.team.id;
    expectOk(
      apply(teamId, {
        op: 'import',
        quarters: ['2026-Q3'],
        items: [{ key: 'NOVA-200', type: 'Epic', title: 'P', quarter: '2026-Q3' }],
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'add_sub',
        itemKey: 'NOVA-200',
        title: 'old child',
        owner: 'ada',
        start: '2026-08-01',
        days: 4,
      }),
    );
    const sub = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-200')!.subs[0];
    expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: sub.id, jiraKey: 'NOVA-201' }],
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'update_assignee_map',
        assigneeMap: { ada: 'Ada Lovelace' },
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'refresh_from_jira',
        issues: [
          {
            key: 'NOVA-201',
            fetchedAt: Date.now() + 1000,
            fields: {
              summary: 'new child',
              description: 'from jira',
              assignee: 'Ada Lovelace',
            },
          },
        ],
      }),
    );
    const matched = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-200')!.subs[0];
    expect(matched.title).toBe('new child');
    expect(matched.description).toBe('from jira');
    expect(matched.owner).toBe('ada');

    expectOk(
      apply(teamId, {
        op: 'refresh_from_jira',
        issues: [
          {
            key: 'NOVA-201',
            fetchedAt: Date.now() + 2000,
            fields: { assignee: 'Kevin Liu' },
          },
        ],
      }),
    );
    // TTL blocks the second refresh on this team.
    const still = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-200')!.subs[0];
    expect(still.owner).toBe('ada');
  });

  it('rewrites owner when assignee does not match the map', () => {
    const snapshot = createTeam({
      name: 'Refresh3',
      jql: 'project = NOVA AND issuetype = Epic',
      actor,
    });
    const teamId = snapshot.team.id;
    expectOk(
      apply(teamId, {
        op: 'import',
        quarters: ['2026-Q3'],
        items: [{ key: 'NOVA-300', type: 'Epic', title: 'P', quarter: '2026-Q3' }],
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'add_sub',
        itemKey: 'NOVA-300',
        title: 'child',
        owner: 'ada',
        start: '2026-08-01',
        days: 4,
      }),
    );
    const sub = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-300')!.subs[0];
    expectOk(
      apply(teamId, {
        op: 'resolve_draft',
        mappings: [{ draftId: sub.id, jiraKey: 'NOVA-301' }],
      }),
    );
    expectOk(
      apply(teamId, {
        op: 'refresh_from_jira',
        issues: [
          {
            key: 'NOVA-301',
            fetchedAt: Date.now() + 1000,
            fields: { assignee: 'Kevin Liu' },
          },
        ],
      }),
    );
    const updated = getTeamSnapshot(teamId)!.items.find((i) => i.key === 'NOVA-300')!.subs[0];
    expect(updated.owner).toBe('Kevin Liu');
    expect(getTeamSnapshot(teamId)!.members.some((m) => m.name === 'Kevin Liu')).toBe(
      true,
    );
  });
});
