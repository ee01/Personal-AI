import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

const { generateJSONMock, timelineExtractMock } = vi.hoisted(() => ({
  generateJSONMock: vi.fn(),
  timelineExtractMock: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockResolvedValue(''),
    generateJSON: generateJSONMock,
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

vi.mock('../core/ProjectTimelineExtractor.js', () => ({
  ProjectTimelineExtractor: class {
    extractFromMessage = timelineExtractMock;
  },
}));

import { UserContextManager } from '../core/UserContextManager.js';
import { buildApp } from '../server.js';

const USER_ID = 'ingest-claim-attribution-user';
const TIMESTAMP = 1_780_200_000;

function emptyExtraction(overrides: Record<string, unknown> = {}) {
  return {
    entities: {
      people: [],
      projects: [],
      topics: [],
      technologies: [],
      organizations: [],
    },
    properties: [],
    importance: 0.9,
    sentiment: 'neutral',
    summary: 'Claim attribution integration test.',
    is_decision: false,
    is_action_item: false,
    profile_candidates: [],
    ...overrides,
  };
}

describe('Ingest API claim attribution', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-claims-'));
    userContextManager = new UserContextManager(tempDir);
    db = userContextManager.getContext(USER_ID).db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_claim_insert_audit (
        status TEXT NOT NULL,
        version INTEGER NOT NULL
      )
    `);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    generateJSONMock.mockReset();
    timelineExtractMock.mockReset().mockResolvedValue([]);

    db.exec('DROP TRIGGER IF EXISTS test_claim_insert_state');
    db.exec('DROP TRIGGER IF EXISTS test_force_claim_failure');
    db.prepare('DELETE FROM test_claim_insert_audit').run();
    db.prepare('DELETE FROM memory_claim_links').run();
    db.prepare('DELETE FROM memory_claim_revisions').run();
    db.prepare('DELETE FROM memory_claims').run();
    db.prepare('DELETE FROM entity_properties').run();
    db.prepare('DELETE FROM relationships').run();
    db.prepare('DELETE FROM opinion_items').run();
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare('DELETE FROM entities').run();
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare(
      `UPDATE profile_sync_state
       SET profile_dirty = 0
       WHERE id = 'singleton'`,
    ).run();
  });

  async function ingest(
    content: string,
    options: {
      skipExtraction?: boolean;
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/ingest',
      headers: { 'x-user-id': USER_ID },
      payload: {
        content,
        sourceType: 'manual',
        sender: 'test-owner',
        timestamp: TIMESTAMP,
        skipExtraction: options.skipExtraction,
        metadata: options.metadata ?? { authorRole: 'owner' },
      },
    });
  }

  function seedFocusProject(): void {
    db.prepare(
      `INSERT INTO watched_projects (
         id, name, aliases_json, is_active, priority, source, tier,
         display_name, created_at
       ) VALUES (
         'project-aurora-focus', 'Project Aurora', '["Aurora"]', 1, 90,
         'roadmap', 'focus', 'Aurora', ?
       )`,
    ).run(TIMESTAMP);
  }

  it('inserts raw messages as pending/version 1 and resolves claims even when extraction is skipped', async () => {
    const content = 'I prefer concise release updates.';
    db.exec(`
      CREATE TRIGGER test_claim_insert_state
      AFTER INSERT ON messages_raw
      WHEN NEW.content = '${content}'
      BEGIN
        INSERT INTO test_claim_insert_audit(status, version)
        VALUES (NEW.claim_attribution_status, NEW.claim_attribution_version);
      END
    `);

    const response = await ingest(content, { skipExtraction: true });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'created',
      decision: {
        extractionStatus: 'skipped',
      },
    });
    expect(generateJSONMock).not.toHaveBeenCalled();
    expect(db.prepare('SELECT * FROM test_claim_insert_audit').get()).toEqual({
      status: 'pending',
      version: 1,
    });
    expect(
      db
        .prepare(
          `SELECT claim_attribution_status, claim_attribution_version
           FROM messages_raw
           WHERE id = ?`,
        )
        .get(response.json().id),
    ).toEqual({
      claim_attribution_status: 'resolved',
      claim_attribution_version: 1,
    });
    expect(
      db
        .prepare(
          `SELECT source_text, owner_kind, speech_mode
           FROM memory_claims
           WHERE source_message_id = ?`,
        )
        .get(response.json().id),
    ).toEqual({
      source_text: content,
      owner_kind: 'self',
      speech_mode: 'direct_assertion',
    });
    expect(response.json().decision.claimAttribution).toMatchObject({
      status: 'resolved',
      claimCount: 1,
      highResponsibilityAllowed: 1,
      highResponsibilityBlocked: 0,
    });
  });

  it('still resolves deterministic claims when the optional LLM extractor is unavailable', async () => {
    generateJSONMock.mockRejectedValue(new Error('LLM unavailable'));
    const content = 'I decided to publish the rollout note today.';

    const response = await ingest(content);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'created',
      decision: {
        extractionStatus: 'unavailable',
      },
    });
    expect(
      db
        .prepare(
          `SELECT claim_attribution_status
           FROM messages_raw
           WHERE id = ?`,
        )
        .get(response.json().id),
    ).toEqual({ claim_attribution_status: 'resolved' });
    expect(response.json().decision.claimAttribution).toMatchObject({
      status: 'resolved',
      claimCount: 1,
      highResponsibilityAllowed: 1,
    });
  });

  it('writes and links only referenced eligible properties/profile/opinions', async () => {
    const content =
      'I prefer concise Project Aurora updates because Alice is unreliable.';
    seedFocusProject();
    generateJSONMock.mockResolvedValue(
      emptyExtraction({
        entities: {
          people: ['Alice'],
          projects: ['Project Aurora'],
          topics: ['release updates'],
          technologies: [],
          organizations: [],
        },
        properties: [
          {
            entity_name: 'Project Aurora',
            entity_type: 'Project',
            key: 'communication_style',
            value: 'concise',
            action_type: 'set',
            confidence: 0.91,
            context: 'Explicit owner statement',
            claim_index: 0,
            claim_text: content,
          },
          {
            entity_name: 'Project Aurora',
            entity_type: 'Project',
            key: 'unreferenced_property',
            value: 'must not be stored',
            action_type: 'set',
            confidence: 0.99,
            context: 'Missing claim reference',
          },
          {
            entity_name: 'Project Aurora',
            entity_type: 'Project',
            key: 'mismatched_property',
            value: 'must not be stored',
            action_type: 'set',
            confidence: 0.99,
            context: 'Index and source text disagree',
            claim_index: 0,
            claim_text: 'This text does not occur in the source message.',
          },
        ],
        sentiment: 'negative',
        profile_candidates: [
          {
            item_type: 'preference',
            item_key: 'communication_style',
            item_value: 'concise Project Aurora updates',
            confidence: 0.92,
            claim_index: 0,
            claim_text: content,
          },
          {
            item_type: 'preference',
            item_key: 'unreferenced_profile',
            item_value: 'must not be stored',
            confidence: 0.99,
          },
          {
            item_type: 'preference',
            item_key: 'mismatched_profile',
            item_value: 'must not be stored',
            confidence: 0.99,
            claim_index: 0,
            claim_text: 'This text does not occur in the source message.',
          },
        ],
      }),
    );

    const response = await ingest(content);

    expect(response.statusCode).toBe(200);
    const extractionPrompt = String(generateJSONMock.mock.calls[0]?.[0]);
    expect(extractionPrompt).toContain('"claim_index": 0');
    expect(extractionPrompt).toContain('"claim_text"');

    expect(
      db
        .prepare(
          `SELECT property_key, property_value
           FROM entity_properties
           WHERE source_message_id = ?`,
        )
        .all(response.json().id),
    ).toEqual([
      {
        property_key: 'communication_style',
        property_value: 'concise',
      },
    ]);
    expect(
      db
        .prepare(
          `SELECT item_key, item_value, status
           FROM user_profile_items
           ORDER BY item_key`,
        )
        .all(),
    ).toEqual([
      {
        item_key: 'communication_style',
        item_value: 'concise Project Aurora updates',
        status: 'pending_confirm',
      },
    ]);
    expect(
      db
        .prepare(
          `SELECT target_entity_id, dimension, status
           FROM opinion_items`,
        )
        .all(),
    ).toEqual([
      {
        target_entity_id: 'person_alice',
        dimension: 'risk',
        status: 'pending_confirm',
      },
    ]);

    const links = db
      .prepare(
        `SELECT target_type, status
         FROM memory_claim_links
         ORDER BY target_type`,
      )
      .all();
    expect(links).toEqual([
      { target_type: 'entity_property', status: 'active' },
      { target_type: 'opinion_item', status: 'active' },
      { target_type: 'profile_item', status: 'active' },
    ]);
    expect(timelineExtractMock).toHaveBeenCalledTimes(1);
    expect(timelineExtractMock.mock.calls[0]?.[0]).toMatchObject({
      messageId: response.json().id,
      content,
      matchedProjectIds: ['project-aurora-focus'],
    });

    expect(
      db.prepare('SELECT content FROM messages_raw WHERE id = ?').get(
        response.json().id,
      ),
    ).toEqual({ content });
    expect(response.json().decision.claimAttribution).toMatchObject({
      status: 'resolved',
      claimCount: 1,
      highResponsibilityAllowed: 1,
    });
  });

  it('passes only current-truth eligible source claims to timeline extraction', async () => {
    const blocked = 'Claude suggested delaying Project Aurora.';
    const eligible = 'I decided Project Aurora ships Friday.';
    seedFocusProject();
    generateJSONMock.mockResolvedValue(
      emptyExtraction({
        entities: {
          people: [],
          projects: ['Project Aurora'],
          topics: [],
          technologies: [],
          organizations: [],
        },
      }),
    );

    const response = await ingest(`${blocked} ${eligible}`);

    expect(response.statusCode).toBe(200);
    expect(timelineExtractMock).toHaveBeenCalledTimes(1);
    const timelineInput = timelineExtractMock.mock.calls[0]?.[0] as {
      content: string;
    };
    expect(timelineInput.content).toBe(eligible);
    expect(timelineInput.content).not.toContain('Claude');
    expect(response.json().decision.claimAttribution).toMatchObject({
      status: 'resolved',
      claimCount: 2,
      highResponsibilityAllowed: 1,
      highResponsibilityBlocked: 1,
    });
  });

  it('does not invoke timeline or infer opinions without a unique eligible self-direct claim', async () => {
    seedFocusProject();
    generateJSONMock.mockResolvedValue(
      emptyExtraction({
        entities: {
          people: ['Alice'],
          projects: ['Project Aurora'],
          topics: [],
          technologies: [],
          organizations: [],
        },
        sentiment: 'negative',
      }),
    );

    const noEligible = await ingest('Claude suggested delaying Project Aurora.');
    expect(noEligible.statusCode).toBe(200);
    expect(timelineExtractMock).not.toHaveBeenCalled();
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM opinion_items').get(),
    ).toEqual({ count: 0 });

    generateJSONMock.mockResolvedValue(
      emptyExtraction({
        entities: {
          people: ['Alice', 'Bob'],
          projects: [],
          topics: [],
          technologies: [],
          organizations: [],
        },
        sentiment: 'negative',
      }),
    );
    const ambiguous = await ingest('I distrust Alice. I trust Bob.');
    expect(ambiguous.statusCode).toBe(200);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM opinion_items').get(),
    ).toEqual({ count: 0 });
    expect(noEligible.json().decision.claimAttribution).toMatchObject({
      status: 'resolved',
      highResponsibilityAllowed: 0,
    });
    expect(ambiguous.json().decision.claimAttribution).toMatchObject({
      status: 'resolved',
      claimCount: 2,
      highResponsibilityAllowed: 2,
    });
  });

  it('keeps raw/chunks/entities/relationships but blocks all high-responsibility writes when attribution fails', async () => {
    const content =
      'I prefer concise Project Aurora updates because Alice at Acme is unreliable.';
    seedFocusProject();
    db.exec(`
      CREATE TRIGGER test_force_claim_failure
      BEFORE INSERT ON memory_claims
      BEGIN
        SELECT RAISE(ABORT, 'forced claim attribution failure');
      END
    `);
    generateJSONMock.mockResolvedValue(
      emptyExtraction({
        entities: {
          people: ['Alice'],
          projects: ['Project Aurora'],
          topics: [],
          technologies: [],
          organizations: ['Acme'],
        },
        properties: [
          {
            entity_name: 'Project Aurora',
            entity_type: 'Project',
            key: 'communication_style',
            value: 'concise',
            action_type: 'set',
            confidence: 0.95,
            context: 'Would otherwise be eligible',
            claim_index: 0,
            claim_text: content,
          },
        ],
        sentiment: 'negative',
        profile_candidates: [
          {
            item_type: 'preference',
            item_key: 'communication_style',
            item_value: 'concise Project Aurora updates',
            claim_index: 0,
            claim_text: content,
          },
        ],
      }),
    );

    const response = await ingest(content);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'created',
      decision: {
        indexed: true,
      },
    });
    expect(
      db
        .prepare(
          `SELECT content, claim_attribution_status
           FROM messages_raw
           WHERE id = ?`,
        )
        .get(response.json().id),
    ).toEqual({
      content,
      claim_attribution_status: 'failed',
    });
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM chunks WHERE related_entity_id = ?')
        .get(response.json().id),
    ).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          `SELECT name
           FROM entities
           WHERE name IN ('Alice', 'Project Aurora', 'Acme')
           ORDER BY name`,
        )
        .all(),
    ).toEqual([{ name: 'Acme' }, { name: 'Alice' }, { name: 'Project Aurora' }]);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM relationships').get(),
    ).toEqual({ count: 3 });

    expect(
      db.prepare('SELECT COUNT(*) AS count FROM entity_properties').get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM user_profile_items').get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM opinion_items').get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM memory_claim_links').get(),
    ).toEqual({ count: 0 });
    expect(timelineExtractMock).not.toHaveBeenCalled();
    expect(response.json().decision.claimAttribution).toMatchObject({
      status: 'failed',
      claimCount: 0,
      highResponsibilityAllowed: 0,
      highResponsibilityBlocked: 1,
    });
  });
});
