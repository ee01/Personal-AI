import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Ambient Calibration API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM ambient_calibration_traces').run();
    db.prepare('DELETE FROM memory_outcome_events').run();
    db.prepare('DELETE FROM memory_outcome_policy_patches').run();
    db.prepare('DELETE FROM skill_platform_bindings').run();
    db.prepare('DELETE FROM skill_versions').run();
    db.prepare('DELETE FROM personal_skills').run();
    db.prepare('DELETE FROM user_writing_style_memories').run();
    db.prepare('DELETE FROM user_profile_items').run();
  });

  it('stores redacted compose assist calibration traces', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        id: 'ambient-compose-1',
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        sourceRequestId: 'composer:req-1',
        action: 'edited_before_send',
        strength: 'strong',
        polarity: 'correction',
        evidenceRefs: [
          {
            id: 'memory-1',
            type: 'message',
            title: 'Factory AI rollout',
            role: 'corrected',
            score: 0.88,
          },
        ],
        redactedDiff: {
          rawTextStored: false,
          suggestionHash: 's1',
          finalHash: 'f1',
          editDistanceBand: 'material',
        },
        privacyClass: 'sensitive_redacted',
        metadata: {
          contextType: 'message_thread',
          scenario: 'instant_message_reply',
        },
        createdAt: 1779235279812,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      traceId: 'ambient-compose-1',
      stored: true,
      calibrationReceipt: {
        stored: true,
        duplicate: false,
        privacyClass: 'sensitive_redacted',
        rawTextStored: false,
        evidenceRefCount: 1,
        cueRefCount: 0,
        styleSignalCount: 0,
        redactedDiffKeys: [
          'editDistanceBand',
          'finalHash',
          'rawTextStored',
          'suggestionHash',
        ],
        boundary: 'hashes_lengths_tags_and_evidence_refs_only',
      },
    });

    const row = db
      .prepare(
        `SELECT surface, scene_key, action, strength, polarity,
                evidence_refs_json, redacted_diff_json, privacy_class
         FROM ambient_calibration_traces
         WHERE id = ?`,
      )
      .get('ambient-compose-1') as {
      surface: string;
      scene_key: string;
      action: string;
      strength: string;
      polarity: string;
      evidence_refs_json: string;
      redacted_diff_json: string;
      privacy_class: string;
    };

    expect(row.surface).toBe('compose_assist');
    expect(row.scene_key).toBe('ringcentral:group-1');
    expect(row.action).toBe('edited_before_send');
    expect(row.strength).toBe('strong');
    expect(row.polarity).toBe('correction');
    expect(row.privacy_class).toBe('sensitive_redacted');
    expect(JSON.parse(row.evidence_refs_json)).toEqual([
      {
        id: 'memory-1',
        type: 'message',
        title: 'Factory AI rollout',
        role: 'corrected',
        score: 0.88,
      },
    ]);
    expect(JSON.parse(row.redacted_diff_json)).toMatchObject({
      rawTextStored: false,
      suggestionHash: 's1',
      finalHash: 'f1',
    });
  });

  it('stores cue ids in compose assist outcome traces', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        id: 'ambient-compose-cue-1',
        surface: 'compose_assist',
        sceneKey: 'jira:MTR-148115',
        sourceRequestId: 'composer:req-cue-1',
        action: 'sent_after_insert',
        strength: 'strong',
        polarity: 'positive',
        evidenceRefs: [
          {
            id: '9321',
            type: 'chunk',
            title: 'MTR-148115 estimate follow-up',
            role: 'used',
            score: 0.62,
            cueId: 'context-cue:vubw4i',
            cue: {
              id: 'context-cue:vubw4i',
              actionType: 'draft_hint',
              compileStatus: 'compiled',
              confidence: 0.6,
              whyNow: '当前场景命中 MTR-148115 original estimate 字段锚点。',
            },
          },
        ],
        redactedDiff: {
          rawTextStored: false,
          suggestionHash: 'cue-suggestion-hash',
        },
        privacyClass: 'sensitive_redacted',
        metadata: {
          cueIds: ['context-cue:vubw4i'],
          suggestionType: 'issue_context',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      traceId: 'ambient-compose-cue-1',
      stored: true,
    });

    const row = db
      .prepare(
        `SELECT evidence_refs_json, metadata_json
         FROM ambient_calibration_traces
         WHERE id = ?`,
      )
      .get('ambient-compose-cue-1') as {
      evidence_refs_json: string;
      metadata_json: string;
    };

    expect(JSON.parse(row.evidence_refs_json)[0]).toMatchObject({
      id: '9321',
      cueId: 'context-cue:vubw4i',
      cue: {
        id: 'context-cue:vubw4i',
        actionType: 'draft_hint',
        compileStatus: 'compiled',
      },
    });
    expect(JSON.parse(row.metadata_json)).toMatchObject({
      cueIds: ['context-cue:vubw4i'],
    });
  });

  it('creates cue-level boost and Skill Foundry suggestion from sent outcomes', async () => {
    const cueKey =
      'jira_estimate:compose_assist:draft_hint:MTR-148115:original estimate:人天';
    for (const id of ['ambient-cue-success-1', 'ambient-cue-success-2']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ambient-calibration/traces',
        payload: {
          id,
          surface: 'compose_assist',
          sceneKey: 'jira:MTR-148115',
          action: 'sent_after_insert',
          strength: 'strong',
          polarity: 'positive',
          evidenceRefs: [
            {
              id: '9251',
              type: 'chunk',
              role: 'used',
              cueId: 'context-cue:success',
              cueKey,
              cue: {
                id: 'context-cue:success',
                cueKey,
                actionType: 'draft_hint',
                compileStatus: 'compiled',
                confidence: 0.82,
              },
            },
          ],
          metadata: {
            cueIds: ['context-cue:success'],
            cueKeys: [cueKey],
          },
          privacyClass: 'sensitive_redacted',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().outcomeLoop.cueEventCount).toBeGreaterThan(0);
    }

    const patches = db
      .prepare(
        `SELECT action, positive_count, negative_count
           FROM memory_outcome_policy_patches
          WHERE cue_key = ?
          ORDER BY action`,
      )
      .all(cueKey) as Array<{
      action: string;
      positive_count: number;
      negative_count: number;
    }>;

    expect(patches.map((patch) => patch.action)).toContain('boost');
    expect(patches.map((patch) => patch.action)).toContain(
      'send_to_skill_foundry',
    );
    expect(patches.find((patch) => patch.action === 'boost')?.positive_count).toBe(2);
    expect(patches.every((patch) => patch.negative_count === 0)).toBe(true);

    const skill = db
      .prepare(
        `SELECT title, suggested_from, suggestion_cluster_key
           FROM personal_skills
          WHERE suggested_from = 'memory_outcome_loop'
          LIMIT 1`,
      )
      .get() as
      | {
          title: string;
          suggested_from: string;
          suggestion_cluster_key: string;
        }
      | undefined;

    expect(skill?.title).toBe('Estimate wording helper');
    expect(skill?.suggestion_cluster_key).toContain(cueKey);
  });

  it('creates a cue-level suppress patch from repeated wrong outcomes', async () => {
    const cueKey =
      'jira_estimate:memory_lens:remember:MTR-148115:original estimate:人天';
    for (const id of ['ambient-cue-wrong-1', 'ambient-cue-wrong-2']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ambient-calibration/traces',
        payload: {
          id,
          surface: 'memory_lens',
          sceneKey: 'jira:MTR-148115',
          action: 'wrong',
          strength: 'strong',
          polarity: 'negative',
          evidenceRefs: [
            {
              id: '9101',
              type: 'chunk',
              role: 'rejected',
              cueId: 'context-cue:wrong',
              cueKey,
              cue: {
                id: 'context-cue:wrong',
                cueKey,
                actionType: 'remember',
                compileStatus: 'compiled',
                confidence: 0.82,
              },
            },
          ],
          metadata: {
            cueIds: ['context-cue:wrong'],
            cueKeys: [cueKey],
          },
          privacyClass: 'sensitive_redacted',
        },
      });
      expect(res.statusCode).toBe(200);
    }

    const patch = db
      .prepare(
        `SELECT action, positive_count, negative_count, reason_codes_json
           FROM memory_outcome_policy_patches
          WHERE cue_key = ? AND action = 'suppress'
          LIMIT 1`,
      )
      .get(cueKey) as
      | {
          action: string;
          positive_count: number;
          negative_count: number;
          reason_codes_json: string;
        }
      | undefined;

    expect(patch?.action).toBe('suppress');
    expect(patch?.positive_count).toBe(0);
    expect(patch?.negative_count).toBe(2);
    expect(JSON.parse(patch?.reason_codes_json || '[]')).toContain(
      'repeated_negative_outcome',
    );
  });

  it('learns Memory Lens not-relevant feedback from the existing feedback route', async () => {
    const now = Math.floor(Date.now() / 1000);
    const cueKey =
      'jira_estimate:memory_lens:remember:MTR-148115:original estimate:人天';
    db.prepare(
      `INSERT OR REPLACE INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope,
         source, source_type, related_project, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'glip', 'glip', 'MTR', ?)`,
    ).run(
      9910,
      'messages/estimate-feedback',
      'MTR-148115 Original Estimate 口径是人天。',
      'hash-estimate-feedback',
      now,
    );
    const detail = JSON.stringify({
      cue_id: 'context-cue:not-relevant',
      cue_key: cueKey,
      cue_action_type: 'remember',
      cue_compile_status: 'compiled',
      scene_anchor_signature: 'jira:MTR-148115',
      feedback_reason: 'not_the_same_scene',
    });

    for (const _ of [0, 1]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/feedback',
        payload: {
          type: 'recall_quality',
          targetType: 'chunk',
          targetId: '9910',
          action: 'negative',
          detail,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().outcomeLoop?.cueEventCount).toBe(1);
    }

    const patch = db
      .prepare(
        `SELECT action, negative_count
           FROM memory_outcome_policy_patches
          WHERE cue_key = ? AND action = 'suppress'
          LIMIT 1`,
      )
      .get(cueKey) as
      | {
          action: string;
          negative_count: number;
        }
      | undefined;

    expect(patch).toMatchObject({
      action: 'suppress',
      negative_count: 2,
    });
  });

  it('rejects top-level raw text fields so traces stay redacted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        action: 'sent_after_insert',
        strength: 'strong',
        polarity: 'positive',
        rawFinalText: '完整发送文本不应该进入校准 trace',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects nested raw text fields inside redacted diff or metadata', async () => {
    const redactedDiffRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        action: 'edited_before_send',
        strength: 'strong',
        polarity: 'correction',
        redactedDiff: {
          rawTextStored: false,
          suggestionHash: 's1',
          finalText: '完整发送文本不应该藏在 redactedDiff 里',
        },
        privacyClass: 'sensitive_redacted',
      },
    });

    expect(redactedDiffRes.statusCode).toBe(400);
    expect(redactedDiffRes.json().error).toContain('redactedDiff.finalText');

    const metadataRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        action: 'sent_without_insert',
        strength: 'medium',
        polarity: 'negative',
        metadata: {
          contextType: 'message_thread',
          debug: {
            rawFinalText: '完整回复文本不能作为调试字段入库',
          },
        },
        privacyClass: 'sensitive_redacted',
      },
    });

    expect(metadataRes.statusCode).toBe(400);
    expect(metadataRes.json().error).toContain('metadata.debug.rawFinalText');
  });

  it('rejects likely raw prose in redacted diff even when the field name is generic', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        surface: 'compose_assist',
        sceneKey: 'ringcentral:group-1',
        action: 'edited_before_send',
        strength: 'strong',
        polarity: 'correction',
        redactedDiff: {
          rawTextStored: false,
          suggestionHash: 's1',
          previewText:
            '我先自己回：当前只确认 production blocker，不引用这条建议。',
        },
        privacyClass: 'sensitive_redacted',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('redactedDiff.previewText');
    expect(res.json().error).toContain('unredacted text');
  });

  it('reports duplicate trace ids as ignored instead of newly stored', async () => {
    const payload = {
      id: 'ambient-compose-duplicate',
      surface: 'compose_assist',
      sceneKey: 'ringcentral:group-1',
      action: 'inserted',
      strength: 'medium',
      polarity: 'positive',
      redactedDiff: {
        rawTextStored: false,
        suggestionHash: 's1',
      },
      privacyClass: 'sensitive_redacted',
    };

    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload,
    });
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload,
    });

    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.json()).toMatchObject({
      traceId: 'ambient-compose-duplicate',
      stored: true,
    });
    expect(duplicateRes.statusCode).toBe(200);
    expect(duplicateRes.json()).toMatchObject({
      traceId: 'ambient-compose-duplicate',
      stored: false,
      calibrationReceipt: {
        stored: false,
        duplicate: true,
        rawTextStored: false,
      },
    });
  });

  it('promotes repeated compose style diffs into USER_CORE writing style memory', async () => {
    for (let index = 1; index <= 3; index += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ambient-calibration/traces',
        payload: {
          id: `ambient-style-peer-${index}`,
          surface: 'compose_assist',
          sceneKey: 'ringcentral:dm:esther-pan',
          action: 'edited_before_send',
          strength: 'strong',
          polarity: 'correction',
          evidenceRefs: [
            {
              id: `message-${index}`,
              type: 'message',
              title: 'Peer tool-help reply',
              role: 'corrected',
            },
          ],
          redactedDiff: {
            rawTextStored: false,
            suggestionHash: `suggestion-${index}`,
            finalHash: `final-${index}`,
            semanticRelation: 'same_intent_shorter_form',
            styleFeatureTags: [
              'casual_opening_haha',
              'tilde_suffix',
              'removed_over_enthusiastic_claim',
              'removed_generic_future_promise',
              'removed_performative_collaboration_phrase',
            ],
          },
          privacyClass: 'sensitive_redacted',
          metadata: {
            nativeSurface: 'ringcentral_message',
            scenario: 'instant_message_reply',
            audienceType: 'peer',
            taskKind: 'casual_reply',
            language: 'zh',
            relationshipKey: 'person:esther_pan',
          },
          createdAt: 1779235279812 + index,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().writingStyleMemory.processed).toBe(true);
    }

    const memory = db
      .prepare(
        `SELECT scope_key, status, confidence, evidence_json,
                positive_rules_json, negative_rules_json
           FROM user_writing_style_memories
          WHERE scope_key = ?
            AND preference_kind = 'anti_ai_style'`,
      )
      .get('writing_style.ringcentral.peer.casual_reply.zh') as {
      scope_key: string;
      status: string;
      confidence: number;
      evidence_json: string;
      positive_rules_json: string;
      negative_rules_json: string;
    };

    expect(memory.status).toBe('active');
    expect(memory.confidence).toBeGreaterThanOrEqual(0.68);
    expect(JSON.parse(memory.evidence_json)).toHaveLength(3);
    expect(JSON.parse(memory.positive_rules_json).join('\n')).toContain(
      '哈哈',
    );
    expect(JSON.parse(memory.negative_rules_json).join('\n')).toContain(
      '我最喜欢聊了',
    );

    const profileItem = db
      .prepare(
        `SELECT item_key, item_value, user_confirmed, status
           FROM user_profile_items
          WHERE item_key = ?`,
      )
      .get('writing_style.ringcentral.peer.casual_reply.zh') as {
      item_key: string;
      item_value: string;
      user_confirmed: number;
      status: string;
    };

    expect(profileItem.user_confirmed).toBe(1);
    expect(profileItem.status).toBe('active');
    expect(profileItem.item_value).toContain('哈哈');
    expect(profileItem.item_value).toContain('我最喜欢聊了');
    expect(profileItem.item_value).not.toContain('下午你直接找我');

    const coreRes = await app.inject({
      method: 'GET',
      url: '/api/v1/profile/core',
    });
    expect(coreRes.statusCode).toBe(200);
    expect(coreRes.json().content).toContain('## Writing Style');
    expect(coreRes.json().content).toContain(
      'writing_style.ringcentral.peer.casual_reply.zh',
    );
  });

  it('accepts downstream AI-tone reaction traces as redacted style evidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: {
        id: 'ambient-style-ai-tone-reaction',
        surface: 'compose_assist',
        sceneKey: 'ringcentral:dm:esther-pan',
        action: 'downstream_reaction',
        strength: 'strong',
        polarity: 'negative',
        evidenceRefs: [
          {
            id: 'reaction-1',
            type: 'message',
            title: 'AI tone reaction',
            role: 'downstream_reaction',
          },
        ],
        redactedDiff: {
          rawTextStored: false,
          suggestionHash: 'suggestion-ai-tone',
          finalHash: 'final-ai-tone',
          recipientReactionTags: ['ai_tone_called_out'],
        },
        privacyClass: 'sensitive_redacted',
        metadata: {
          nativeSurface: 'ringcentral_message',
          scenario: 'instant_message_reply',
          audienceType: 'peer',
          taskKind: 'casual_reply',
          language: 'zh',
          reactionKind: 'ai_tone_called_out',
          rawTextStored: false,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().writingStyleMemory.processed).toBe(true);

    const row = db
      .prepare(
        `SELECT feature_counts_json
           FROM user_writing_style_memories
          WHERE scope_key = ?
          LIMIT 1`,
      )
      .get('writing_style.ringcentral.peer.casual_reply.zh') as {
      feature_counts_json: string;
    };
    expect(JSON.parse(row.feature_counts_json).ai_tone_called_out).toBe(1);
  });
});
