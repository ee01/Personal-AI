import { beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { ComposerAudienceResolver } from '../core/ComposerAudienceResolver.js';
import {
  formatPersonaProjectionForGeneration,
  PersonaProjectionService,
  validatePersonaProjectionOutput,
} from '../core/PersonaProjectionService.js';
import type { ComposerAssistRequest } from '../types/index.js';
import { getTestDb } from './setup.js';

describe('Persona Projection Contract', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = getTestDb();
    db.prepare('DELETE FROM social_edges').run();
    db.prepare('DELETE FROM user_profile_items').run();
  });

  it('prefers confirmed social edges over relationship hints', () => {
    insertPerson(db, 'person-manager', 'Morgan Manager', ['Morgan']);
    insertConfirmedEdge(db, {
      id: 'edge-manager',
      personId: 'person-manager',
      relationType: 'reports_to',
      confidence: 0.94,
    });

    const composeRequest = request({
      audience: {
        people: ['Morgan'],
        relationshipHint: 'peer colleague',
      },
    });
    const result = new ComposerAudienceResolver(db).resolve(composeRequest);

    expect(result).toMatchObject({
      type: 'manager',
      source: 'confirmed_social_edge',
      confidence: 0.94,
      matchedPeople: 1,
      unresolvedPeople: 0,
    });
    const generationControl = formatPersonaProjectionForGeneration(
      new PersonaProjectionService(db).project({
        request: composeRequest,
        suggestionType: 'reply_context',
      }),
    );
    expect(generationControl).toContain('"audienceType":"manager"');
    expect(generationControl).toContain('中性正式且责任清晰');
    expect(generationControl).not.toContain('peer colleague');
  });

  it('uses mixed for confirmed and unresolved group participants', () => {
    insertPerson(db, 'person-client', 'Client One', []);
    insertConfirmedEdge(db, {
      id: 'edge-client',
      personId: 'person-client',
      relationType: 'client',
      confidence: 0.88,
    });

    const result = new ComposerAudienceResolver(db).resolve(
      request({ audience: { people: ['Client One', 'Unknown Person'] } }),
    );

    expect(result.type).toBe('mixed');
    expect(result.source).toBe('confirmed_social_edge');
    expect(result.unresolvedPeople).toBe(1);
  });

  it('uses mixed when confirmed participants have different relationship types', () => {
    insertPerson(db, 'person-manager-mixed', 'Morgan Lead', []);
    insertPerson(db, 'person-peer-mixed', 'Ryan Peer', []);
    insertConfirmedEdge(db, {
      id: 'edge-manager-mixed',
      personId: 'person-manager-mixed',
      relationType: 'manager',
      confidence: 0.92,
    });
    insertConfirmedEdge(db, {
      id: 'edge-peer-mixed',
      personId: 'person-peer-mixed',
      relationType: 'colleague',
      confidence: 0.89,
    });

    const result = new ComposerAudienceResolver(db).resolve(
      request({
        audience: { people: ['Morgan Lead', 'Ryan Peer'] },
      }),
    );

    expect(result).toMatchObject({
      type: 'mixed',
      source: 'confirmed_social_edge',
      matchedPeople: 2,
      unresolvedPeople: 0,
    });
  });

  it('falls back to a normalized relationship hint', () => {
    const result = new ComposerAudienceResolver(db).resolve(
      request({
        audience: {
          people: ['Ryan Chen'],
          relationshipHint: 'developer peer group',
        },
      }),
    );

    expect(result.type).toBe('peer');
    expect(result.source).toBe('relationship_hint');
    expect(result.confidence).toBe(0.6);
  });

  it('allows peer style controls but blocks pending style for managers', () => {
    insertProfile(db, {
      id: 'confirmed-style',
      itemType: 'preference',
      key: 'writing_style.ringcentral.reply',
      value: 'Use one concise paragraph.',
      confirmed: true,
    });
    insertProfile(db, {
      id: 'pending-style',
      itemType: 'preference',
      key: 'writing_style.ringcentral.casual_reply',
      value: 'Use a relaxed greeting.',
      confirmed: false,
    });

    const service = new PersonaProjectionService(db);
    const peer = service.project({
      request: request({
        scenario: 'instant_message_reply',
        audience: { relationshipHint: 'peer colleague' },
      }),
      suggestionType: 'reply_context',
    });
    const manager = service.project({
      request: request({
        scenario: 'instant_message_reply',
        audience: { relationshipHint: 'manager' },
      }),
      suggestionType: 'reply_context',
    });

    expect(peer.controls.map((slot) => slot.key)).toContain(
      'writing_style.ringcentral.reply',
    );
    expect(peer.softControls.map((slot) => slot.key)).toContain(
      'writing_style.ringcentral.casual_reply',
    );
    expect(peer.summary.representationMode).toBe('draft_only');
    expect(manager.softControls).toHaveLength(0);
    expect(manager.summary.representationMode).toBe('draft_preview_required');
    expect(manager.summary.reasonCodes).toContain(
      'blocked_pending_style_high_responsibility',
    );
  });

  it('allows only relevant confirmed work identity facts', () => {
    insertProfile(db, {
      id: 'confirmed-team',
      itemType: 'fact',
      key: 'team',
      value: 'AI platform team',
      confirmed: true,
    });
    insertProfile(db, {
      id: 'pending-title',
      itemType: 'fact',
      key: 'job_title',
      value: 'Unconfirmed VP of Product',
      confirmed: false,
    });
    insertProfile(db, {
      id: 'secret-token',
      itemType: 'fact',
      key: 'api_token',
      value: 'ghp_1234567890abcdef',
      confirmed: true,
    });
    insertProfile(db, {
      id: 'unknown-fact',
      itemType: 'fact',
      key: 'favorite_unknown_thing',
      value: 'Silver workflow',
      confirmed: true,
    });

    const projection = new PersonaProjectionService(db).project({
      request: request({
        primaryText: 'Which team owns the Factory AI rollout?',
      }),
      suggestionType: 'reply_context',
    });

    expect(projection.speakableContext.map((slot) => slot.value)).toEqual([
      'AI platform team',
    ]);
    expect(projection.summary.reasonCodes).toEqual(
      expect.arrayContaining([
        'blocked_unconfirmed_profile',
        'blocked_secret',
        'blocked_unknown_scope',
      ]),
    );
    expect(projection.blockedValues).toContain('unconfirmed vp of product');
  });

  it('blocks expired, sensitive, and scene-mismatched profile slots', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    insertProfile(db, {
      id: 'expired-language',
      itemType: 'preference',
      key: 'language_preference',
      value: 'Always reply in German',
      confirmed: true,
      validTo: timestamp - 1,
    });
    insertProfile(db, {
      id: 'sensitive-salary',
      itemType: 'fact',
      key: 'compensation_note',
      value: 'Salary target is private',
      confirmed: true,
    });
    insertProfile(db, {
      id: 'jira-style-on-ringcentral',
      itemType: 'preference',
      key: 'writing_style.jira.comment',
      value: 'Use a formal issue template',
      confirmed: true,
    });

    const projection = new PersonaProjectionService(db).project({
      request: request(),
      suggestionType: 'reply_context',
      timestamp,
    });

    expect(projection.summary.reasonCodes).toEqual(
      expect.arrayContaining([
        'blocked_expired',
        'blocked_sensitive_profile',
        'blocked_style_scope_mismatch',
      ]),
    );
    expect(projection.summary.usedCount).toBe(0);
  });

  it('keeps prompt patches profile-free and allows explicit Web AI context', () => {
    insertProfile(db, {
      id: 'personal-goal',
      itemType: 'preference',
      key: 'personal_preference',
      value: 'Prefer an actionable recommendation after the evidence summary',
      confirmed: true,
    });
    insertProfile(db, {
      id: 'work-role',
      itemType: 'fact',
      key: 'job_title',
      value: 'Scrum Master',
      confirmed: true,
    });

    const service = new PersonaProjectionService(db);
    const webRequest = request({
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      draftText:
        '请根据我的 personal preference 给出 evidence summary 后的 actionable recommendation。',
    });
    const patch = service.project({
      request: webRequest,
      suggestionType: 'prompt_patch',
    });
    const context = service.project({
      request: webRequest,
      suggestionType: 'context_pack',
    });

    expect(patch.summary.voiceMode).toBe('never_speak_as_user');
    expect(patch.summary.usedCount).toBe(0);
    expect(patch.summary.requiresPreview).toBe(true);
    expect(context.summary.voiceMode).toBe('speak_about_user');
    expect(context.speakableContext.map((slot) => slot.key)).toEqual([
      'personal_preference',
    ]);
    expect(context.speakableContext.map((slot) => slot.value)).not.toContain(
      'Scrum Master',
    );
  });

  it('blocks output that contains a blocked profile value or credential', () => {
    insertProfile(db, {
      id: 'pending-title-output',
      itemType: 'fact',
      key: 'job_title',
      value: 'Unconfirmed VP of Product',
      confirmed: false,
    });
    const projection = new PersonaProjectionService(db).project({
      request: request(),
      suggestionType: 'reply_context',
    });

    expect(
      validatePersonaProjectionOutput(
        'I am the Unconfirmed VP of Product.',
        projection,
      ),
    ).toEqual({ valid: false, reasonCode: 'projection_output_blocked_slot' });
    expect(
      validatePersonaProjectionOutput(
        'Use bearer abcdefghijklmnopqrstuvwxyz for the request.',
        projection,
      ),
    ).toEqual({ valid: false, reasonCode: 'projection_output_secret' });
    expect(
      validatePersonaProjectionOutput(
        'Temporary password: factory-ai-prod-2026',
        projection,
      ),
    ).toEqual({ valid: false, reasonCode: 'projection_output_secret' });
  });

  it('fails closed when profile and relationship storage is unavailable', () => {
    const brokenDb = {
      prepare: () => {
        throw new Error('storage unavailable');
      },
    } as unknown as BetterSqlite3.Database;
    const projection = new PersonaProjectionService(brokenDb).project({
      request: request(),
      suggestionType: 'reply_context',
    });

    expect(projection.summary).toMatchObject({
      audienceType: 'unknown',
      audienceSource: 'unresolved',
      usedCount: 0,
      degraded: true,
    });
    expect(projection.summary.reasonCodes).toEqual(
      expect.arrayContaining([
        'audience_resolution_failed',
        'profile_candidate_load_failed',
      ]),
    );
  });
});

function request(
  overrides: Partial<ComposerAssistRequest> = {},
): ComposerAssistRequest {
  return {
    surface: 'ringcentral_message',
    contextType: 'message_thread',
    scenario: 'instant_message_reply',
    title: 'AI project chat',
    primaryText: 'Factory AI rollout status and next step',
    ...overrides,
  };
}

function insertPerson(
  db: BetterSqlite3.Database,
  id: string,
  name: string,
  aliases: string[],
): void {
  const timestamp = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT OR REPLACE INTO entities
      (id, type, name, aliases_json, importance, access_count, status,
       created_at, updated_at)
     VALUES (?, 'Person', ?, ?, 0.5, 0, 'active', ?, ?)`,
  ).run(id, name, JSON.stringify(aliases), timestamp, timestamp);
}

function insertConfirmedEdge(
  db: BetterSqlite3.Database,
  input: {
    id: string;
    personId: string;
    relationType: string;
    confidence: number;
  },
): void {
  const timestamp = Math.floor(Date.now() / 1000);
  const ownerId = `owner-${input.id}`;
  insertPerson(db, ownerId, ownerId, []);
  db.prepare(
    `INSERT INTO social_edges
      (id, from_entity_id, to_entity_id, relation_type, strength,
       confidence, user_confirmed, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0.8, ?, 1, ?, ?)`,
  ).run(
    input.id,
    ownerId,
    input.personId,
    input.relationType,
    input.confidence,
    timestamp,
    timestamp,
  );
}

function insertProfile(
  db: BetterSqlite3.Database,
  input: {
    id: string;
    itemType: string;
    key: string;
    value: string;
    confirmed: boolean;
    validTo?: number | null;
  },
): void {
  const timestamp = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO user_profile_items
      (id, item_type, item_key, item_value, source_kind, confidence,
       user_confirmed, status, salience_score, mention_count, last_seen,
       valid_to, created_at, updated_at, fingerprint)
     VALUES (?, ?, ?, ?, ?, 0.9, ?, ?, 0.9, 1, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.itemType,
    input.key,
    input.value,
    input.confirmed ? 'explicit' : 'inferred',
    input.confirmed ? 1 : 0,
    input.confirmed ? 'active' : 'pending_confirm',
    timestamp,
    input.validTo ?? null,
    timestamp,
    timestamp,
    `${input.key}:${input.value}`,
  );
}
