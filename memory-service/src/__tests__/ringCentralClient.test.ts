import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { getTestDb } from './setup.js';

describe('RingCentralClient', () => {
  const db = getTestDb();
  const fetchMock = vi.fn();
  let userDataManager: UserDataManager;
  let tempDir: string;

  beforeEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    db.prepare('DELETE FROM rc_directory_users').run();
    db.prepare('DELETE FROM rc_directory_teams').run();
    db.prepare('DELETE FROM rc_directory_sync_state').run();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ringcentral-client-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        outreachEnabled: true,
        ringCentralServerUrl: 'https://platform.ringcentral.example.com',
        ringCentralClientId: 'client-id',
        ringCentralClientSecret: 'client-secret',
        ringCentralJwt: 'jwt-token',
      }),
    );
  });

  afterEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reuses shared auth token and extension directory cache across instances', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.includes('/restapi/v1.0/account/~/extension?type=User&status=Enabled&recordCount=200')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'ext-1',
                  contact: { firstName: 'Alice', lastName: 'Service', email: 'alice.service@example.com' },
                  extensionNumber: '101',
                },
              ],
            }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ records: [], navigation: {} }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const firstClient = new RingCentralClient(userDataManager);
    const secondClient = new RingCentralClient(userDataManager);

    const firstResult = await firstClient.searchTargets({ targetType: 'private', targetRef: 'ali' });
    const secondResult = await secondClient.searchTargets({ targetType: 'private', targetRef: 'alice' });

    expect(firstResult).toHaveLength(1);
    expect(secondResult).toHaveLength(1);
    expect(firstResult[0].label).toBe('Alice Service');
    expect(secondResult[0].label).toBe('Alice Service');

    const authCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/restapi/oauth/token'),
    );
    const extensionCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/restapi/v1.0/account/~/extension?type=User&status=Enabled&recordCount=200'),
    );

    expect(authCalls).toHaveLength(1);
    expect(extensionCalls).toHaveLength(1);
  });

  it('resolves RingCentral chat link ids directly for group targets', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.includes('/team-messaging/v1/chats/54490570758')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: '54490570758',
              type: 'Team',
              name: 'RCV Mobile VT3',
              description: 'Release room',
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const client = new RingCentralClient(userDataManager);
    const result = await client.resolveTarget({
      targetType: 'group',
      targetRef: 'https://app.ringcentral.com/l/messages/54490570758',
    });

    expect(result.status).toBe('resolved');
    expect(result.resolved?.chatId).toBe('54490570758');
    expect(result.resolved?.label).toBe('RCV Mobile VT3');
  });

  it('enriches remembered private user aliases with an existing direct chat id', async () => {
    userDataManager.writeFile(
      'agent/ringcentral-target-aliases.json',
      JSON.stringify([
        {
          targetType: 'private',
          kind: 'user',
          entityId: '3997606020',
          label: 'Tom Chen',
          subtitle: 'tom.chen@ringcentral.com · ext 8886',
          source: 'extension',
          updatedAt: Date.now(),
        },
      ]),
    );

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.endsWith('/restapi/v1.0/account/~/extension/~')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: '1325046020' }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: '1365354487810',
                  type: 'Direct',
                  members: [{ id: '1325046020' }, { id: '3997606020' }],
                },
              ],
              navigation: {},
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const client = new RingCentralClient(userDataManager);
    const result = await client.resolveTarget({
      targetType: 'private',
      targetRef: 'tom.chen',
      limit: 8,
    });

    expect(result.status).toBe('resolved');
    expect(result.resolved?.entityId).toBe('3997606020');
    expect(result.resolved?.chatId).toBe('1365354487810');
    expect(result.candidates[0]?.chatId).toBe('1365354487810');
  });

  it('supports searching direct chats by participant name and group chats across pagination', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.endsWith('/restapi/v1.0/account/~/extension/~')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'self-user' }),
        };
      }
      if (url.includes('/restapi/v1.0/account/~/extension?type=User&status=Enabled&recordCount=200')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'ext-1',
                  contact: { firstName: 'Alice', lastName: 'Service', email: 'alice.service@example.com' },
                  extensionNumber: '101',
                },
              ],
            }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50&pageToken=page-2')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: '54490570758',
                  type: 'Team',
                  name: 'RCV Mobile VT3',
                  description: 'Release room',
                },
              ],
              navigation: {},
            }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: '1463750737922',
                  type: 'Direct',
                  members: [{ id: 'self-user' }, { id: 'ai-service-person' }],
                },
              ],
              navigation: {
                nextPageToken: 'page-2',
              },
            }),
        };
      }
      if (url.includes('/team-messaging/v1/persons/ai-service-person')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: 'ai-service-person',
              firstName: 'AI',
              lastName: 'Service',
              email: 'sync.service@ringcentral.com',
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const client = new RingCentralClient(userDataManager);

    const personResults = await client.searchTargets({
      targetType: 'person',
      targetRef: 'AI Service',
      limit: 5,
    });
    expect(personResults.some((item) => item.chatId === '1463750737922' && item.label === 'AI Service')).toBe(true);

    const groupResults = await client.searchTargets({
      targetType: 'group',
      targetRef: 'RCV Mobile VT3',
      limit: 5,
    });
    expect(groupResults.some((item) => item.chatId === '54490570758' && item.label === 'RCV Mobile VT3')).toBe(true);
  });

  it('enriches directory-resolved private users with an existing direct chat id', async () => {
    const updatedAt = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO rc_directory_users
        (entity_id, display_name, email, extension_number, search_text, raw_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      '3997606020',
      'Tom Chen',
      'tom.chen@ringcentral.com',
      '8886',
      'tom chen tom.chen@ringcentral.com 8886 3997606020',
      null,
      updatedAt,
    );
    db.prepare(
      `INSERT INTO rc_directory_sync_state
        (scope, status, last_started_at, last_finished_at, last_success_at, record_count, last_error)
       VALUES ('users', 'ready', ?, ?, ?, 1, NULL),
              ('teams', 'ready', ?, ?, ?, 1, NULL)`,
    ).run(updatedAt, updatedAt, updatedAt, updatedAt, updatedAt, updatedAt);

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.endsWith('/restapi/v1.0/account/~/extension/~')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: '1325046020' }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: '1365354487810',
                  type: 'Direct',
                  members: [{ id: '1325046020' }, { id: '3997606020' }],
                },
              ],
              navigation: {},
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const client = new RingCentralClient(userDataManager, db);
    const result = await client.resolveTarget({
      targetType: 'private',
      targetRef: 'tom.chen',
      limit: 8,
    });

    expect(result.status).toBe('resolved');
    expect(result.resolved?.entityId).toBe('3997606020');
    expect(result.resolved?.chatId).toBe('1365354487810');
    expect(result.candidates[0]?.chatId).toBe('1365354487810');
  });

  it('supports searching teams by group name via teams directory pagination', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50&pageToken=team-page-2')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: '54490570758',
                  type: 'Team',
                  name: 'RCV Mobile VT3',
                  description: 'Release room',
                },
              ],
              navigation: {},
            }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=50')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'team-1',
                  type: 'Team',
                  name: 'General',
                },
              ],
              navigation: {
                nextPageToken: 'team-page-2',
              },
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const client = new RingCentralClient(userDataManager);
    const groupResults = await client.searchTargets({
      targetType: 'group',
      targetRef: 'RCV Mobile VT3',
      limit: 5,
    });

    expect(groupResults.some((item) => item.chatId === '54490570758' && item.label === 'RCV Mobile VT3')).toBe(true);
  });

  it('resolves readable sender names when listing chat posts', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.includes('/team-messaging/v1/chats/chat-123/posts?recordCount=50')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'post-1',
                  text: '26.2.10',
                  creator: {
                    id: 'user-42',
                    firstName: 'Ada',
                    lastName: 'Lovelace',
                  },
                  creationTime: '2026-03-30T08:00:00Z',
                },
                {
                  id: 'post-2',
                  text: '已同步',
                  creator: {
                    id: 'user-77',
                  },
                  creationTime: '2026-03-30T08:05:00Z',
                },
              ],
            }),
        };
      }
      if (url.includes('/team-messaging/v1/persons/user-77')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: 'user-77',
              firstName: 'Grace',
              lastName: 'Hopper',
              email: 'grace.hopper@example.com',
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const client = new RingCentralClient(userDataManager);
    const posts = await client.listPosts('chat-123');

    expect(posts).toHaveLength(2);
    expect(posts[0].creatorName).toBe('Ada Lovelace');
    expect(posts[1].creatorName).toBe('Grace Hopper');
  });
});
