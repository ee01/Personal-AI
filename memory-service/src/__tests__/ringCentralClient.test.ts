import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { UserDataManager } from '../storage/UserDataManager.js';

describe('RingCentralClient', () => {
  const fetchMock = vi.fn();
  let userDataManager: UserDataManager;
  let tempDir: string;

  beforeEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

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
      if (url.includes('/team-messaging/v1/chats?recordCount=200')) {
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
      if (url.includes('/team-messaging/v1/teams?recordCount=200')) {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ message: 'not found' }),
        };
      }
      if (url.includes('/glip/teams?recordCount=200')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ records: [], navigation: {} }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=200&pageToken=page-2')) {
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
      if (url.includes('/team-messaging/v1/chats?recordCount=200')) {
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
                prevPageToken: 'page-2',
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
      if (url.includes('/team-messaging/v1/teams?recordCount=200')) {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ message: 'not found' }),
        };
      }
      if (url.includes('/glip/teams?recordCount=200&pageToken=team-page-2')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: '54490570758',
                  name: 'RCV Mobile VT3',
                  description: 'Release room',
                },
              ],
              navigation: {},
            }),
        };
      }
      if (url.includes('/glip/teams?recordCount=200')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'team-1',
                  name: 'General',
                },
              ],
              navigation: {
                prevPageToken: 'team-page-2',
              },
            }),
        };
      }
      if (url.includes('/team-messaging/v1/chats?recordCount=200')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ records: [], navigation: {} }),
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
});
