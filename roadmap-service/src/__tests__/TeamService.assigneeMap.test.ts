import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ActorContext } from '../types.js';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-asg-'));

const { applyIntent, createTeam, getTeamSnapshot } = await import(
  '../core/TeamService.js'
);

const actor: ActorContext = {
  name: 'Esone Qiu',
  clientId: 'test-client',
  source: 'creator',
};

describe('assignee map intent', () => {
  let teamId = '';

  beforeAll(() => {
    const snapshot = createTeam({
      name: 'Asg Map',
      jql: 'project = NOVA AND issuetype = Epic',
      actor,
    });
    teamId = snapshot.team.id;
  });

  it('defaults to empty map and persists update_assignee_map', () => {
    expect(getTeamSnapshot(teamId)!.team.assigneeMap).toEqual({});
    const result = applyIntent(
      teamId,
      {
        op: 'update_assignee_map',
        assigneeMap: { ray: 'Ray Zhang', Vivi: 'Vivi Wang' },
      },
      actor,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.team.assigneeMap).toEqual({
      ray: 'Ray Zhang',
      vivi: 'Vivi Wang',
    });
  });
});
