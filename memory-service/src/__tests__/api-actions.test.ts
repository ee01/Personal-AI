import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('Action API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  afterAll(async () => {
    await app.close();
  });

  it('locates an action by id outside the first visible list slice', async () => {
    const repo = new ActionRepository(db);
    repo.create({
      id: 'action-priority-top',
      actionType: 'notify_user',
      title: 'Visible first action',
      createdAt: 1_770_000_200,
      priority: 10,
      queueStatus: 'queued',
    });
    repo.create({
      id: 'action-deep-link-target',
      actionType: 'create_confirm_request',
      title: 'Deep link target action',
      createdAt: 1_770_000_100,
      priority: 1,
      queueStatus: 'queued',
    });

    const firstPage = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?limit=1',
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().items.map((item: { id: string }) => item.id)).toEqual([
      'action-priority-top',
    ]);

    const directLookup = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?actionId=action-deep-link-target&limit=1',
    });
    expect(directLookup.statusCode).toBe(200);
    expect(directLookup.json()).toMatchObject({
      total: 1,
      limit: 1,
      offset: 0,
      items: [
        {
          id: 'action-deep-link-target',
          actionType: 'create_confirm_request',
          queueStatus: 'queued',
        },
      ],
    });
  });
});
