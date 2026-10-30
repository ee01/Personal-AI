/**
 * Integration tests for RingCentral Team Messaging webhook POC.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockRejectedValue(new Error('LLM not available in tests')),
    generateJSON: vi
      .fn()
      .mockRejectedValue(new Error('LLM not available in tests')),
  }),
  LLMClient: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { resetConfigForTests } from '../config.js';

describe('RingCentral Team Messaging webhook', () => {
  let app: FastifyInstance;
  const token = 'test-webhook-token';

  beforeAll(async () => {
    process.env.RINGCENTRAL_TM_WEBHOOK_TOKEN = token;
    process.env.RINGCENTRAL_TM_WEBHOOK_USER_ID = 'test';
    resetConfigForTests();
    const db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    delete process.env.RINGCENTRAL_TM_WEBHOOK_TOKEN;
    delete process.env.RINGCENTRAL_TM_WEBHOOK_USER_ID;
    resetConfigForTests();
    await app.close();
  });

  it('echoes Validation-Token on subscription handshake', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/webhooks/ringcentral/team-messaging/${token}`,
      headers: { 'validation-token': 'rc-handshake-123' },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['validation-token']).toBe('rc-handshake-123');
  });

  it('ingests PostAdded with metadata.postId dedup', async () => {
    const payload = {
      uuid: 'delivery-1',
      body: {
        id: 'post-100',
        groupId: 'group-9',
        text: 'hello from webhook',
        creatorId: 'ext-1',
        creationTime: '2026-10-30T10:00:00.000Z',
        eventType: 'PostAdded',
      },
    };
    const first = await app.inject({
      method: 'POST',
      url: `/webhooks/ringcentral/team-messaging/${token}`,
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().kind).toBe('ingested');

    const second = await app.inject({
      method: 'POST',
      url: `/webhooks/ringcentral/team-messaging/${token}`,
      payload: { ...payload, uuid: 'delivery-2' },
    });
    expect(second.json().kind).toBe('duplicate');
  });

  it('updates on PostChanged and revokes on PostRemoved', async () => {
    const base = {
      uuid: 'delivery-changed-base',
      body: {
        id: 'post-200',
        groupId: 'group-10',
        text: 'version one',
        eventType: 'PostAdded',
        creationTime: '2026-10-30T11:00:00.000Z',
      },
    };
    await app.inject({
      method: 'POST',
      url: `/webhooks/ringcentral/team-messaging/${token}`,
      payload: base,
    });

    const changed = await app.inject({
      method: 'POST',
      url: `/webhooks/ringcentral/team-messaging/${token}`,
      payload: {
        uuid: 'delivery-changed',
        body: {
          ...base.body,
          text: 'version two',
          eventType: 'PostChanged',
          modifiedTime: '2026-10-30T11:05:00.000Z',
        },
      },
    });
    expect(changed.json().kind).toBe('updated');

    const removed = await app.inject({
      method: 'POST',
      url: `/webhooks/ringcentral/team-messaging/${token}`,
      payload: {
        uuid: 'delivery-removed',
        body: {
          id: 'post-200',
          groupId: 'group-10',
          eventType: 'PostRemoved',
        },
      },
    });
    expect(removed.json().kind).toBe('revoked');
  });
});
