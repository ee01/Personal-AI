import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import {
  listFocusProjects,
  syncFocusProjectsForTeam,
  type FocusSyncItem,
} from '../core/FocusProjectSyncService.js';
// Both sides of the seam, so a rename in either build tree fails here.
import { buildStateMessage } from '../../../roadmap-service/web/src/composables/useRoadmapContract';
import { toFocusSyncItem } from '../../../src/roadmapFocusContract';
import { cleanupTestDb, getTestDb } from './setup.js';

const TEAM_ID = 'team-nova';
const DRAFT_KEY = 'LOCAL-ab12cd34';

function sync(db: BetterSqlite3.Database, items: FocusSyncItem[], syncedAt: number) {
  return syncFocusProjectsForTeam(db, {
    teamId: TEAM_ID,
    teamName: 'Nova',
    items,
    syncedAt,
  });
}

function draftItem(overrides: Partial<FocusSyncItem> = {}): FocusSyncItem {
  return {
    key: DRAFT_KEY,
    title: '手动新增的 backlog 条目',
    alias: '手动条目',
    displayName: '手动条目',
    isDraft: true,
    jiraKey: null,
    keywords: ['低端机'],
    quarter: '2026Q3',
    ...overrides,
  };
}

describe('syncFocusProjectsForTeam draft handling', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = getTestDb();
    db.prepare('DELETE FROM watched_projects').run();
  });

  afterAll(() => {
    cleanupTestDb();
  });

  it('stores a draft with jiraKey=null and keeps the synthetic key out of aliases', () => {
    sync(db, [draftItem()], 1_000);

    const [project] = listFocusProjects(db);
    expect(project.externalRef).toMatchObject({
      itemKey: DRAFT_KEY,
      jiraKey: null,
      isDraft: true,
      teamName: 'Nova',
      quarter: '2026Q3',
    });
    expect(project.aliases).toEqual(['手动条目', '低端机']);
    expect(project.aliases).not.toContain(DRAFT_KEY);
  });

  it('keeps the same project id after the draft gets a real Jira key', () => {
    sync(db, [draftItem()], 1_000);
    const draftId = listFocusProjects(db)[0].id;

    const result = sync(
      db,
      [draftItem({ isDraft: false, jiraKey: 'NOVA-77' })],
      2_000,
    );
    expect(result.archived).toBe(0);

    const [project] = listFocusProjects(db);
    expect(project.id).toBe(draftId);
    expect(project.externalRef).toMatchObject({
      itemKey: DRAFT_KEY,
      jiraKey: 'NOVA-77',
      isDraft: false,
    });
    expect(project.aliases).toContain('NOVA-77');
  });

  /**
   * The extension is the only thing that ever calls this in production, so the
   * payload it actually builds — not a hand-written one — is what has to work.
   */
  it('accepts the payload the extension builds from a page state message', () => {
    const state = buildStateMessage({
      teamId: TEAM_ID,
      teamName: 'Nova',
      quarter: '2026-Q3',
      editable: true,
      items: [
        {
          key: DRAFT_KEY,
          type: 'Epic',
          title: '手动新增的 backlog 条目',
          source: 'manual',
          jiraKey: null,
          projectKey: 'NOVA',
          alias: '手动条目',
          quarter: '2026-Q3',
          estimate: null,
          targetStart: null,
          targetEnd: null,
          scheduled: true,
          start: '2026-07-06',
          days: 21,
          lane: 0,
          expanded: false,
          version: 1,
          subs: [
            {
              id: 's1',
              key: null,
              title: '子任务',
              alias: null,
              owner: null,
              start: '2026-07-06',
              days: 7,
              temp: true,
              createdBy: 'Tester',
              version: 1,
            },
          ],
        },
      ],
    });

    sync(db, state.items.map(toFocusSyncItem) as FocusSyncItem[], 1_000);

    const [project] = listFocusProjects(db);
    expect(project.externalRef).toMatchObject({
      itemKey: DRAFT_KEY,
      jiraKey: null,
      isDraft: true,
      // `start` travels as an ISO date string end to end; nothing does maths on it.
      start: '2026-07-06',
      days: 21,
    });
    expect(project.aliases).not.toContain(DRAFT_KEY);
    // subActivity arrives nested, so it still reaches the priority score.
    expect(project.priority).toBeGreaterThan(40);
  });

  it('keeps the item key in aliases for regular Jira-backed items', () => {
    sync(
      db,
      [
        {
          key: 'NOVA-1',
          title: 'Refactor media pipeline',
          alias: '媒体重构',
        },
      ],
      1_000,
    );

    const [project] = listFocusProjects(db);
    expect(project.aliases).toContain('NOVA-1');
    expect(project.externalRef).toMatchObject({
      itemKey: 'NOVA-1',
      jiraKey: 'NOVA-1',
      isDraft: false,
    });
  });
});
