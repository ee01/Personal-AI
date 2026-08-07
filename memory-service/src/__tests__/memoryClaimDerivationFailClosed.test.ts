import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateJSONMock } = vi.hoisted(() => ({
  generateJSONMock: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generateJSON: generateJSONMock,
  }),
}));

import { MemoryChangeLedgerService } from '../core/MemoryChangeLedgerService.js';
import { OnlineReflection } from '../core/OnlineReflection.js';
import { contentHash } from '../utils/hashing.js';
import { getTestDb } from './setup.js';

const db = getTestDb();
const TEST_TIME = 1_785_497_600;

function clearDerivedMemoryState(): void {
  db.prepare('DELETE FROM memory_claim_links').run();
  db.prepare('DELETE FROM memory_claim_revisions').run();
  db.prepare('DELETE FROM memory_claims').run();
  db.prepare('DELETE FROM memory_change_events').run();
  db.prepare('DELETE FROM memory_change_chains').run();
  db.prepare('DELETE FROM memory_change_extractions').run();
  db.prepare('DELETE FROM entity_properties').run();
  db.prepare('DELETE FROM user_profile_items').run();
  db.prepare('DELETE FROM messages_raw').run();
  db.prepare(
    `UPDATE profile_sync_state
     SET profile_dirty = 0
     WHERE id = 'singleton'`,
  ).run();
  generateJSONMock.mockReset();
}

function seedMessage(input: {
  id: string;
  content: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}): void {
  db.prepare(
    `INSERT INTO messages_raw (
       id, content, source_type, sender, timestamp, importance, sentiment,
       metadata_json, claim_attribution_status, claim_attribution_version,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'test-sender', ?, 0.8, 'neutral', ?, 'pending', 1, ?, ?)`,
  ).run(
    input.id,
    input.content,
    input.sourceType ?? 'glip',
    TEST_TIME,
    JSON.stringify(input.metadata ?? {}),
    TEST_TIME,
    TEST_TIME,
  );
}

function syncMessageChange(input: {
  id: string;
  content: string;
  messageMetadata?: Record<string, unknown>;
  sourceType?: string;
  issueKey: string;
  changeEvents: Array<Record<string, unknown>>;
  ledgerMetadata?: Record<string, unknown>;
}) {
  seedMessage({
    id: input.id,
    content: input.content,
    sourceType: input.sourceType,
    metadata: input.messageMetadata,
  });
  return new MemoryChangeLedgerService(db).syncSource({
    sourceRefType: 'message',
    sourceRefId: input.id,
    sourceMessageId: input.id,
    sourceKind: input.sourceType ?? 'glip',
    text: input.content,
    metadata: {
      issueKey: input.issueKey,
      ...(input.ledgerMetadata ?? {}),
      changeEvents: input.changeEvents,
    },
    observedAt: TEST_TIME,
  });
}

function countRows(table: string, where = '1 = 1'): number {
  return (
    db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get() as {
      count: number;
    }
  ).count;
}

beforeEach(clearDerivedMemoryState);

describe('MemoryChangeLedgerService claim fail-closed boundary', () => {
  it('upgrades only the exact self-owned claim from a mixed AI/user message', () => {
    const aiEvidence = '另一位 AI 建议状态改为 Done；';
    const selfEvidence = '我的决定是状态保持 In Progress。';
    const content = `${aiEvidence}${selfEvidence}`;

    const receipt = syncMessageChange({
      id: 'ledger-mixed',
      content,
      messageMetadata: { role: 'user' },
      issueKey: 'NOVA-501',
      changeEvents: [
        {
          field: 'Status',
          oldValue: 'Open',
          newValue: 'Done',
          evidenceQuote: aiEvidence,
        },
        {
          field: 'Status',
          oldValue: 'Open',
          newValue: 'In Progress',
          evidenceQuote: selfEvidence,
        },
      ],
    });

    expect(receipt).toMatchObject({ status: 'ready', extractedCount: 1 });
    const events = db
      .prepare(
        `SELECT new_value_json, evidence_quote
         FROM memory_change_events
         WHERE source_ref_id = ?`,
      )
      .all('ledger-mixed') as Array<{
      new_value_json: string;
      evidence_quote: string;
    }>;
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].new_value_json).normalized).toBe('in progress');
    expect(events[0].evidence_quote).toBe(selfEvidence);

    const linkedClaims = db
      .prepare(
        `SELECT c.owner_kind, c.source_text, l.link_role
         FROM memory_claim_links l
         JOIN memory_claims c ON c.id = l.claim_id
         WHERE l.target_type = 'memory_change_event'`,
      )
      .all();
    expect(linkedClaims).toEqual([
      {
        owner_kind: 'self',
        source_text: selfEvidence,
        link_role: 'current_truth',
      },
    ]);
  });

  it.each([
    {
      label: 'AI suggestion',
      id: 'ledger-ai',
      issueKey: 'NOVA-503',
      content: '另一位 AI 建议状态改为 Done。',
      sourceType: 'glip',
      messageMetadata: { role: 'user' },
      ledgerMetadata: {},
    },
    {
      label: 'quoted text',
      id: 'ledger-quote',
      issueKey: 'NOVA-504',
      content: '“状态从 Open 改为 Done。”',
      sourceType: 'glip',
      messageMetadata: { role: 'user' },
      ledgerMetadata: {},
    },
    {
      label: 'unknown-owner import',
      id: 'ledger-unknown',
      issueKey: 'NOVA-505',
      content: '状态从 Open 改为 Done。',
      sourceType: 'chatgpt',
      messageMetadata: {},
      ledgerMetadata: {},
    },
    {
      label: 'unverified authoritative flag',
      id: 'ledger-unverified-authority',
      issueKey: 'NOVA-506',
      content: '另一位 AI 建议状态改为 Done。',
      sourceType: 'glip',
      messageMetadata: { role: 'user' },
      ledgerMetadata: { authoritative: true },
    },
  ])('does not create a ledger event for $label', (testCase) => {
    const receipt = syncMessageChange({
      id: testCase.id,
      content: testCase.content,
      sourceType: testCase.sourceType,
      messageMetadata: testCase.messageMetadata,
      issueKey: testCase.issueKey,
      ledgerMetadata: testCase.ledgerMetadata,
      changeEvents: [
        {
          field: 'Status',
          oldValue: 'Open',
          newValue: 'Done',
          evidenceQuote: testCase.content,
        },
      ],
    });

    expect(receipt).toMatchObject({ status: 'no_change', extractedCount: 0 });
    expect(
      countRows('memory_change_events', `source_ref_id = '${testCase.id}'`),
    ).toBe(0);
  });

  it('rejects a candidate whose evidence merely contains an eligible claim', () => {
    const content = '我的决定是状态保持 In Progress。';
    const receipt = syncMessageChange({
      id: 'ledger-substring-evidence',
      content,
      messageMetadata: { role: 'user' },
      issueKey: 'NOVA-502',
      changeEvents: [
        {
          field: 'Status',
          oldValue: 'Open',
          newValue: 'Done',
          evidenceQuote: `${content} 但系统随后推断为 Done。`,
        },
      ],
    });

    expect(receipt).toMatchObject({ status: 'no_change', extractedCount: 0 });
    expect(countRows('memory_change_events')).toBe(0);
  });

  it('removes an earlier ledger promotion when its linked claim becomes ineligible', () => {
    const id = 'ledger-revoked-claim';
    const content = '我的决定是状态保持 In Progress。';
    const changeEvents = [
      {
        field: 'Status',
        oldValue: 'Open',
        newValue: 'In Progress',
        evidenceQuote: content,
      },
    ];
    const first = syncMessageChange({
      id,
      content,
      messageMetadata: { role: 'user' },
      issueKey: 'NOVA-507',
      changeEvents,
    });
    expect(first).toMatchObject({ status: 'ready', extractedCount: 1 });
    expect(countRows('memory_claim_links')).toBe(1);

    db.prepare(
      `UPDATE memory_claims
       SET current_truth_candidate = 0
       WHERE source_message_id = ?`,
    ).run(id);
    const second = new MemoryChangeLedgerService(db).syncSource({
      sourceRefType: 'message',
      sourceRefId: id,
      sourceMessageId: id,
      sourceKind: 'glip',
      text: content,
      metadata: { issueKey: 'NOVA-507', changeEvents },
      observedAt: TEST_TIME,
    });

    expect(second).toMatchObject({ status: 'no_change', extractedCount: 0 });
    expect(countRows('memory_change_events')).toBe(0);
    expect(countRows('memory_claim_links', `status = 'active'`)).toBe(0);
    expect(countRows('memory_claim_links', `status = 'invalidated'`)).toBe(1);
  });
});

describe('OnlineReflection claim fail-closed boundary', () => {
  function mockReflection(overrides: Record<string, unknown> = {}): void {
    generateJSONMock.mockResolvedValue({
      newFacts: [
        {
          entity: 'Project Aurora',
          key: 'status',
          value: 'done',
          confidence: 0.99,
        },
      ],
      userPreferences: ['I prefer verbose answers.'],
      improvements: [],
      shouldStore: true,
      ...overrides,
    });
  }

  async function reflect(query: string): Promise<void> {
    db.prepare(
      `INSERT OR IGNORE INTO entities (
         id, type, name, status, created_at, updated_at
       ) VALUES (
         'reflection-project-aurora', 'Project', 'Project Aurora', 'active', ?, ?
       )`,
    ).run(TEST_TIME, TEST_TIME);
    await new OnlineReflection(db).reflect({
      query,
      recalledItems: [],
      llmResponse: 'A response that must not become user truth.',
      usedItemIds: [],
    });
  }

  it.each([
    {
      label: 'AI-authored preference',
      query: 'Claude says I prefer verbose answers. What should I choose?',
      preference: 'I prefer verbose answers.',
    },
    {
      label: 'quoted preference',
      query: '“I prefer verbose answers.” What should I choose?',
      preference: 'I prefer verbose answers.',
    },
    {
      label: 'pure Ask question',
      query: 'Do I prefer concise answers?',
      preference: 'concise answers',
    },
  ])('does not persist profile or fact data from $label', async (testCase) => {
    mockReflection({ userPreferences: [testCase.preference] });

    await reflect(testCase.query);

    expect(countRows('user_profile_items')).toBe(0);
    expect(countRows('entity_properties')).toBe(0);
  });

  it('does not let an eligible self claim authorize an AI claim from the same mixed query', async () => {
    mockReflection({ userPreferences: ['I prefer verbose answers.'] });

    await reflect(
      'Claude says I prefer verbose answers. I prefer concise answers. What should I choose?',
    );

    expect(countRows('user_profile_items')).toBe(0);
    expect(countRows('entity_properties')).toBe(0);
  });

  it('stores only verbatim-grounded user preference text as pending_confirm and never stores LLM facts', async () => {
    mockReflection({
      userPreferences: ['concise answers', 'I prefer dark mode.'],
    });

    await reflect('I prefer concise answers. Can you summarize this?');

    const rows = db
      .prepare(
        `SELECT item_type, item_key, item_value, status, user_confirmed
         FROM user_profile_items`,
      )
      .all();
    expect(rows).toEqual([
      {
        item_type: 'preference',
        item_key: 'response_style',
        item_value: 'concise answers',
        status: 'pending_confirm',
        user_confirmed: 0,
      },
    ]);
    expect(countRows('user_profile_items', `item_type = 'fact'`)).toBe(0);
    expect(countRows('user_profile_items', `status = 'active'`)).toBe(0);
    expect(countRows('entity_properties')).toBe(0);
  });

  it('does not reinforce an already confirmed preference through LLM reflection', async () => {
    const fingerprint = contentHash('preference:concise answers');
    db.prepare(
      `INSERT INTO user_profile_items (
         id, item_type, item_key, item_value, evidence_refs, source_kind,
         confidence, user_confirmed, status, salience_score, mention_count,
         last_seen, created_at, updated_at, fingerprint
       ) VALUES (
         'confirmed-pref', 'preference', 'response_style', 'concise answers',
         '[]', 'explicit', 1, 1, 'active', 0.9, 3, ?, ?, ?, ?
       )`,
    ).run(TEST_TIME, TEST_TIME, TEST_TIME, fingerprint);
    mockReflection({
      newFacts: [],
      userPreferences: ['concise answers'],
    });

    await reflect('I prefer concise answers. Can you summarize this?');

    expect(
      db
        .prepare(
          `SELECT status, user_confirmed, mention_count
           FROM user_profile_items
           WHERE id = 'confirmed-pref'`,
        )
        .get(),
    ).toEqual({
      status: 'active',
      user_confirmed: 1,
      mention_count: 3,
    });
    expect(countRows('user_profile_items')).toBe(1);
  });
});
