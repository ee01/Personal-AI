import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { DayPilotService } from '../core/DayPilotService.js';
import { getTestDb } from './setup.js';

describe('Day Pilot API', () => {
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
    for (const table of [
      'today_meeting_preps',
      'day_brief_feedback',
      'day_brief_cards',
      'day_missions',
      'day_briefs',
      'relationship_radar_people',
      'personal_skills',
      'reflection_threads',
      'notification_records',
      'proposed_actions',
      'calendar_events',
      'messages_raw',
      'entities',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  });

  function seedDayPilotData() {
    const current = Math.floor(Date.now() / 1000);
    const localDate = new Date(current * 1000).toISOString().slice(0, 10);

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, sender, group_id, group_name,
         timestamp, entities_json, matched_projects_json, importance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-mcp-1',
      'Fred 问 webpage-mcp 怎么配，Codex Chrome 插件和 webapp MCP 好像功能有交叉。',
      'Fred asked how to configure webpage-mcp and compare it with Codex Chrome plugin.',
      'glip',
      'Fred Gu',
      'group-ai-tools',
      'AI Tools',
      current - 1800,
      JSON.stringify([{ type: 'Person', name: 'Fred Gu' }]),
      JSON.stringify([{ name: 'Codex' }, { name: 'MCP' }]),
      0.82,
      current - 1800,
    );
    db.prepare(`UPDATE messages_raw SET source_url = ? WHERE id = ?`).run(
      'https://internal.example/codex-mcp?token=secret',
      'msg-mcp-1',
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, sender, group_id, group_name,
         timestamp, entities_json, matched_projects_json, importance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-mcp-2',
      'AGENT.md 里链接检查需要优先用 webpage-mcp；可以整理一份团队复用说明。',
      'Repository workflow prefers webpage-mcp for link inspection.',
      'glip',
      'Esone',
      'group-ai-tools',
      'AI Tools',
      current - 1200,
      JSON.stringify([{ type: 'Technology', name: 'webpage-mcp' }]),
      JSON.stringify([{ name: 'Personal AI' }]),
      0.76,
      current - 1200,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, sender, group_id, group_name,
         timestamp, entities_json, matched_projects_json, importance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-ai-notes',
      'Elina 报告 AI Notes tests failing，同一 GeneratedNotes message 被收到 hundreds of times，需要 RIO owner 排查 retry/ack。',
      'AI Notes repeated GeneratedNotes consumption needs RIO owner diagnosis.',
      'meeting',
      'Elina',
      'group-ai-notes',
      'RCV AI Notes Engineering',
      current - 900,
      JSON.stringify([{ type: 'Person', name: 'Elina' }]),
      JSON.stringify([{ name: 'AI Notes' }]),
      0.88,
      current - 900,
    );

    db.prepare(
      `INSERT INTO calendar_events
        (id, source_system, external_id, series_key, title, description_preview,
         start_at, end_at, organizer_json, attendees_json, cancelled, content_hash,
         metadata_json, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      'cal-ai-sharing',
      'ringcentral_indexeddb',
      'event-ai-sharing',
      'cop-ai-sharing',
      'CoP - 基于AI的个人发展和工具',
      '准备 AI 工具分享材料，包含 Codex、MCP、Factory.ai 和团队案例。',
      current + 3600,
      current + 7200,
      JSON.stringify({ name: 'Ryan' }),
      JSON.stringify([{ name: 'Sophia' }, { name: 'Esone' }]),
      'hash-ai-sharing',
      '{}',
      current,
      current,
      current,
    );
    db.prepare(
      `INSERT INTO calendar_events
        (id, source_system, external_id, series_key, title, description_preview,
         start_at, end_at, organizer_json, attendees_json, cancelled, content_hash,
         metadata_json, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      'cal-recurring-daily',
      'ringcentral_indexeddb',
      'event-daily',
      'daily-sync-series',
      'RCVSDK Daily Sync',
      'regular recurring meeting without new changes',
      current + 2 * 86400,
      current + 2 * 86400 + 1800,
      JSON.stringify({ name: 'Organizer' }),
      JSON.stringify([{ name: 'Esone' }]),
      'hash-daily',
      '{}',
      current,
      current,
      current,
    );

    db.prepare(
      `INSERT INTO proposed_actions
        (id, type, title, description, risk_level, confidence, evidence_refs_json,
         requires_approval, state, created_at, action_type, execution_mode,
         priority, source_kind, source_ref_id, queue_status, utility_score, urgency_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'action-mcp-doc',
      'write_doc',
      '整理 Webpage-MCP / Codex 插件配置说明',
      '把配置边界、安装路径和验证步骤整理成团队可复用说明。',
      'medium',
      0.74,
      JSON.stringify(['message:msg-mcp-1']),
      0,
      'pending',
      current - 600,
      'write_doc',
      'manual',
      8,
      'glip',
      'group-ai-tools',
      'queued',
      0.82,
      0.66,
    );

    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, topic_id, utility_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'notif-ai-notes-conflict',
      'chrome_notification',
      'truth_conflict',
      'AI Notes owner 记忆存在冲突',
      'GeneratedNotes 消费问题的 owner 在旧记录和新记录中不一致。',
      'topic-ai-notes',
      0.84,
      current - 300,
    );
    db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, topic_id, utility_score, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'notif-old-heartbeat-fact',
      'chrome_notification',
      'notify_user',
      '自我反思: 事实跟进: New AI Meetings Desktop Client · focus_areas',
      [
        '事实跟进: New AI Meetings Desktop Client · focus_areas was revisited by heartbeat.',
        '1 recent evidence item(s) were attached, with the newest signal pointing to "事实变化".',
      ].join(' '),
      'topic-old-heartbeat',
      1,
      current - 22 * 86400,
      current - 22 * 86400,
    );

    db.prepare(
      `INSERT INTO reflection_threads
        (id, topic_key, title, status, priority, salience, source_type,
         current_hypothesis, open_questions_json, latest_summary,
         next_reflection_at, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'reflection-context-budget',
      'context-budget',
      '上下文重复解释成本是否影响日常 AI 使用？',
      8,
      0.72,
      'usage_pattern',
      '跨 AI 工具切换时重复解释背景，是近期明显摩擦。',
      JSON.stringify(['是否需要一键上下文包？']),
      '观察 Context Assist 和 Day Pilot 是否降低重复解释。',
      current - 60,
      current - 3600,
      current - 300,
    );

    db.prepare(
      `INSERT INTO personal_skills
        (id, slug, title, summary, scope, risk, trigger_text, not_use_text, status,
         source_kinds_json, repetition, risk_brief, suggested_from, suggested_at,
         suggestion_cluster_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'skill-ai-share',
      'ai-tool-sharing-structure',
      'AI 工具分享材料结构化',
      '多次复用 AI 工具比较、限制、落地案例的材料结构。',
      'presentation',
      'medium',
      '准备 AI 工具分享或比较材料时使用',
      '缺少真实案例时不要使用',
      'suggestion',
      JSON.stringify(['glip', 'meeting']),
      'CoP 分享和工具选型讨论多次出现',
      '注意内部链接 redaction',
      'RingCentral / Codex 记忆',
      current - 120,
      'ai-tool-sharing',
      current - 120,
      current - 120,
    );

    return { current, localDate };
  }

  it('generates concrete mission cards from raw memory sources', async () => {
    const { current, localDate } = seedDayPilotData();
    db.prepare(
      `INSERT INTO today_meeting_preps
        (id, user_id, local_date, timezone, event_external_id, event_series_key,
         event_title, start_at, goal_hash, status, generated_mode, summary_md,
         cue_cards_json, questions_json, evidence_refs_json, context_pack_md,
         redaction_json, llm_usage_json, source_hash, generated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'ready', 'nightly_llm', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'prep-ai-sharing',
      'test',
      localDate,
      'Asia/Shanghai',
      'event-ai-sharing',
      'cop-ai-sharing',
      'CoP - 基于AI的个人发展和工具',
      current + 3600,
      'AI 工具分享会前准备',
      '[]',
      '[]',
      '[]',
      '# Today Pilot meeting prep',
      '{}',
      '{}',
      'prep-hash-ai-sharing',
      current,
      current + 12 * 3600,
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/day-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generated).toBe(true);
    expect(body.brief.cards.length).toBeGreaterThanOrEqual(3);
    expect(body.brief.cards.length).toBeLessThanOrEqual(7);

    const titles = body.brief.cards.map((card: any) => card.title).join('\n');
    expect(titles).toContain('Webpage-MCP / Codex 插件配置整理');
    expect(titles).toContain('AI Notes 重复 GeneratedNotes 消费');
    expect(titles).not.toContain('New AI Meetings Desktop Client');
    expect(titles).not.toContain('个事项需要你拍板');
    expect(titles).not.toContain('个动作正在等待处理');
    expect(titles).not.toContain('RCVSDK Daily Sync');

    for (const card of body.brief.cards) {
      expect(card.evidenceRefs.length).toBeGreaterThan(0);
      expect(card.nextBestAction).toBeTruthy();
      expect(card.whyNow).toBeTruthy();
    }
    expect(body.brief.sourceStats.messages.scanned).toBeGreaterThan(0);
    expect(body.brief.sourceStats.calendar.upcoming).toBeGreaterThan(0);
    expect(body.brief.attentionBudget.maxInterruptions).toBe(3);
    expect(
      body.brief.attentionBudget.plannedInterruptions.length,
    ).toBeLessThanOrEqual(3);
    const alias = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=false`,
    });
    expect(alias.statusCode).toBe(200);
    expect(alias.json().brief.id).toBe(body.brief.id);
  });

  it('filters high-importance messages without a concrete today action', async () => {
    const current = Math.floor(Date.now() / 1000);
    const localDate = new Date(current * 1000).toISOString().slice(0, 10);

    db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, sender, group_id, group_name,
         timestamp, entities_json, matched_projects_json, importance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-fyi-only',
      'The team shared the office lunch photo album and a retrospective note for awareness only.',
      'Team shared an office lunch photo album for awareness.',
      'glip',
      'Taylor',
      'group-social',
      'Office Social',
      current - 900,
      JSON.stringify([{ type: 'Person', name: 'Taylor' }]),
      JSON.stringify([{ name: 'Office Social' }]),
      0.96,
      current - 900,
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.brief.sourceStats.messages.scanned).toBe(1);
    expect(body.brief.cards).toHaveLength(0);
    expect(body.brief.summary).toContain('暂未发现');
  });

  it('does not promote generic relationship radar context without a follow-up signal', async () => {
    const current = Math.floor(Date.now() / 1000);
    const localDate = new Date(current * 1000).toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO entities
        (id, type, name, importance, created_at, updated_at)
       VALUES (?, 'Person', ?, 0.9, ?, ?)`,
    ).run('person-generic-radar', 'Generic Radar Person', current, current);
    db.prepare(
      `INSERT INTO relationship_radar_people
        (entity_id, radar_state, data_quality, projection_source, score,
         interaction_count, active_days, last_interaction_at,
         evidence_refs_json, summary, generated_at, updated_at)
       VALUES (?, 'core', 'generated', 'background', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'person-generic-radar',
      0.96,
      24,
      9,
      current - 1800,
      '[]',
      'Generic Radar Person：24 次交互，9 个活跃日；最近今天；质量：后台整理',
      current,
      current,
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.brief.sourceStats.relationships.highFrequencyPeople).toBe(1);
    expect(body.brief.sourceStats.relationships.scanned).toBe(0);
    expect(
      body.brief.cards.some(
        (card: any) => card.cardType === 'relationship_ping',
      ),
    ).toBe(false);
  });

  it('keeps relationship radar items that contain a concrete follow-up signal', async () => {
    const current = Math.floor(Date.now() / 1000);
    const localDate = new Date(current * 1000).toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO entities
        (id, type, name, importance, created_at, updated_at)
       VALUES (?, 'Person', ?, 0.9, ?, ?)`,
    ).run('person-followup-radar', 'Maya Chen', current, current);
    db.prepare(
      `INSERT INTO relationship_radar_people
        (entity_id, radar_state, data_quality, projection_source, score,
         interaction_count, active_days, last_interaction_at,
         evidence_refs_json, summary, generated_at, updated_at)
       VALUES (?, 'active', 'generated', 'background', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'person-followup-radar',
      0.86,
      11,
      5,
      current - 2400,
      JSON.stringify([
        {
          sourceKind: 'message',
          sourceId: 'msg-maya-followup',
          title: 'Customer thread',
          snippet:
            'Maya 承诺今天补预算 owner，需要 follow-up 确认是否已有下一步。',
          timestamp: current - 2400,
        },
      ]),
      'Maya Chen：11 次交互，5 个活跃日；1 个可能 follow-up；承诺今天补预算 owner。',
      current,
      current,
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const relationshipCard = body.brief.cards.find(
      (card: any) => card.cardType === 'relationship_ping',
    );
    expect(body.brief.sourceStats.relationships.highFrequencyPeople).toBe(1);
    expect(body.brief.sourceStats.relationships.scanned).toBe(1);
    expect(relationshipCard).toBeTruthy();
    expect(relationshipCard.title).toContain('关系 follow-up：Maya Chen');
    expect(relationshipCard.nextBestAction).toContain('follow-up');
    expect(relationshipCard.whyNow).toContain('关系雷达');
  });

  it('links cached meeting prep into meeting prepare cards', async () => {
    const current = Math.floor(Date.now() / 1000);
    const localDate = new Date(current * 1000).toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO calendar_events
        (id, source_system, external_id, series_key, title, description_preview,
         start_at, end_at, organizer_json, attendees_json, cancelled, content_hash,
         metadata_json, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      'cal-prep-link',
      'ringcentral_indexeddb',
      'event-prep-link',
      'series-prep-link',
      'Codex MCP 会前准备 owner review',
      '确认 Codex MCP owner、risk、decision 和下一步。',
      current + 600,
      current + 2400,
      JSON.stringify({ name: 'Sophia' }),
      JSON.stringify([{ name: 'Esone' }]),
      'hash-prep-link',
      '{}',
      current,
      current,
      current,
    );
    db.prepare(
      `INSERT INTO today_meeting_preps
        (id, user_id, local_date, timezone, event_external_id, event_series_key,
         event_title, start_at, goal_hash, status, generated_mode, summary_md,
         cue_cards_json, questions_json, evidence_refs_json, context_pack_md,
         redaction_json, llm_usage_json, source_hash, generated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'ready', 'nightly_llm', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'prep-link-card',
      'test',
      localDate,
      'Asia/Shanghai',
      'event-prep-link',
      'series-prep-link',
      'Codex MCP 会前准备 owner review',
      current + 600,
      'Codex MCP 会前准备',
      '[]',
      '[]',
      '[]',
      '# Today Pilot meeting prep',
      '{}',
      '{}',
      'hash-prep-link-record',
      current,
      current + 12 * 3600,
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });

    expect(res.statusCode).toBe(200);
    const meetingCard = res
      .json()
      .brief.cards.find((card: any) => card.cardType === 'meeting_prepare');
    expect(meetingCard).toBeTruthy();
    expect(meetingCard.contextPack.prepId).toBe('prep-link-card');
  });

  it('records feedback and hides done/later/muted cards from today', async () => {
    const { localDate, current } = seedDayPilotData();
    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/day-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });
    const cards = first.json().brief.cards;
    expect(cards.length).toBeGreaterThanOrEqual(3);

    const doneCard = cards[0];
    const laterCard = cards[1];
    const muteCard = cards[2];

    for (const [card, payload] of [
      [doneCard, { action: 'done' }],
      [laterCard, { action: 'later', snoozeUntil: current + 3600 }],
      [muteCard, { action: 'mute', muteKey: muteCard.sourceHash }],
    ] as Array<[any, Record<string, unknown>]>) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/day-pilot/cards/${card.id}/feedback`,
        payload,
      });
      expect(res.statusCode).toBe(200);
    }

    const next = await app.inject({
      method: 'GET',
      url: `/api/v1/day-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=false`,
    });
    const nextIds = new Set(
      next.json().brief.cards.map((card: any) => card.id),
    );
    expect(nextIds.has(doneCard.id)).toBe(false);
    expect(nextIds.has(laterCard.id)).toBe(false);
    expect(nextIds.has(muteCard.id)).toBe(false);
  });

  it('defaults later feedback to a six-hour snooze when omitted by the client', async () => {
    const { localDate } = seedDayPilotData();
    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });
    const card = first.json().brief.cards[0];
    expect(card).toBeTruthy();

    const beforeFeedback = Math.floor(Date.now() / 1000);
    const feedback = await app.inject({
      method: 'POST',
      url: `/api/v1/today-pilot/cards/${card.id}/feedback`,
      payload: {
        action: 'later',
      },
    });

    expect(feedback.statusCode).toBe(200);
    const feedbackRow = db
      .prepare(
        `SELECT snooze_until
         FROM day_brief_feedback
         WHERE card_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(card.id) as { snooze_until: number } | undefined;
    expect(feedbackRow?.snooze_until).toBeGreaterThanOrEqual(
      beforeFeedback + 6 * 3600 - 1,
    );

    const reloaded = await app.inject({
      method: 'GET',
      url: `/api/v1/today-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=false`,
    });
    const visibleIds = new Set(
      reloaded.json().brief.cards.map((item: any) => item.id),
    );
    expect(visibleIds.has(card.id)).toBe(false);
  });

  it('renders deterministic context packs from mission evidence', async () => {
    const { localDate } = seedDayPilotData();
    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/day-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });
    const card = first
      .json()
      .brief.cards.find((item: any) =>
        String(item.title).includes('Webpage-MCP'),
      );
    expect(card).toBeTruthy();

    const pack = await app.inject({
      method: 'POST',
      url: `/api/v1/day-pilot/missions/${card.missionId}/context-pack`,
      payload: {
        tokenBudget: 900,
        targetProvider: 'codex',
      },
    });

    expect(pack.statusCode).toBe(200);
    const body = pack.json();
    expect(body.providerProfile.id).toBe('codex');
    expect(body.bodyMd).toContain('Codex Brief');
    expect(body.bodyMd).toContain('Webpage-MCP');
    expect(body.bodyMd).toContain('Next Best Action');
    expect(body.evidenceRefs.length).toBeGreaterThan(0);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.redactionApplied).toBe(true);
    expect(body.redactionPreview.length).toBeGreaterThan(0);
    expect(body.evidenceRefs.every((ref: any) => !ref.sourceUrl)).toBe(true);
  });

  it('uses feedback signals when regenerating ranked cards', async () => {
    const { localDate } = seedDayPilotData();
    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/day-pilot/today?date=${localDate}&timezone=Asia/Shanghai&autoGenerate=true`,
    });
    const webCard = first
      .json()
      .brief.cards.find((item: any) =>
        String(item.title).includes('Webpage-MCP'),
      );
    expect(webCard).toBeTruthy();

    const wrong = await app.inject({
      method: 'POST',
      url: `/api/v1/day-pilot/cards/${webCard.id}/feedback`,
      payload: {
        action: 'wrong',
        muteKey: webCard.sourceHash,
      },
    });
    expect(wrong.statusCode).toBe(200);

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/day-pilot/refresh',
      payload: {
        date: localDate,
        timezone: 'Asia/Shanghai',
        mode: 'full',
      },
    });
    expect(refreshed.statusCode).toBe(200);
    const nextWebCard = refreshed
      .json()
      .brief.cards.find((item: any) => item.sourceHash === webCard.sourceHash);
    expect(nextWebCard).toBeTruthy();
    expect(nextWebCard.score).toBeLessThan(webCard.score);
    expect(nextWebCard.contextPack.feedback.wrongCount).toBe(1);
  });

  it('rejects feedback and context pack access for another user brief', () => {
    const current = Math.floor(Date.now() / 1000);
    const localDate = new Date(current * 1000).toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO day_briefs
        (id, user_id, local_date, timezone, generated_at, horizon_from,
         horizon_to, status, summary, attention_budget_json, source_stats_json,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?)`,
    ).run(
      'foreign-brief',
      'owner-a',
      localDate,
      'Asia/Shanghai',
      current,
      current - 3600,
      current + 86400,
      'foreign brief',
      JSON.stringify({
        maxInterruptions: 3,
        usedInterruptions: 0,
        quietWindows: [],
      }),
      JSON.stringify({
        messages: { scanned: 1, totalRecent: 1 },
        calendar: { scanned: 0, upcoming: 0 },
        notifications: { scanned: 0, pending: 0 },
        actions: { scanned: 0, queued: 0 },
        reflections: { scanned: 0, active: 0 },
        skills: { scanned: 0, suggestions: 0 },
        relationships: { scanned: 0, highFrequencyPeople: 0 },
      }),
      current,
      current,
    );
    db.prepare(
      `INSERT INTO day_missions
        (id, brief_id, mission_key, title, status, source_kinds_json,
         time_window_json, related_refs_json, current_state, desired_outcome,
         next_actions_json, score, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'foreign-mission',
      'foreign-brief',
      'foreign:key',
      'Foreign mission',
      JSON.stringify(['message']),
      JSON.stringify({ from: current, to: current }),
      JSON.stringify({ sources: ['message:foreign-message'] }),
      'Foreign state',
      'Foreign action',
      JSON.stringify([{ title: 'Foreign action', desc: 'Foreign desc' }]),
      0.8,
      current,
      current,
    );
    db.prepare(
      `INSERT INTO day_brief_cards
        (id, brief_id, mission_id, card_type, title, priority, state, why_now,
         next_best_action, people_json, projects_json, evidence_refs_json,
         open_questions_json, trust_json, context_pack_json, source_hash, score,
         created_at, updated_at)
       VALUES (?, ?, ?, 'thread_followup', ?, 'high', 'now', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'foreign-card',
      'foreign-brief',
      'foreign-mission',
      'Foreign card',
      'Foreign why',
      'Foreign next',
      '[]',
      '[]',
      JSON.stringify([
        {
          sourceKind: 'message',
          sourceId: 'foreign-message',
          title: 'Foreign evidence',
          snippet: 'Foreign private snippet',
          timestamp: current,
        },
      ]),
      '[]',
      JSON.stringify({
        confidence: 0.8,
        riskLevel: 'low',
        staleEvidenceCount: 0,
        sensitiveEvidenceCount: 0,
      }),
      '{}',
      'foreign-source-hash',
      0.8,
      current,
      current,
    );

    const foreignService = new DayPilotService(db, 'owner-b');
    expect(() =>
      foreignService.recordCardFeedback('foreign-card', { action: 'done' }),
    ).toThrow('Day Pilot card not found');
    expect(() =>
      foreignService.renderMissionContextPack('foreign-mission'),
    ).toThrow('Day Pilot mission not found');

    const ownerService = new DayPilotService(db, 'owner-a');
    const feedback = ownerService.recordCardFeedback('foreign-card', {
      action: 'done',
    });
    expect(feedback.brief.userId).toBe('owner-a');
    expect(
      feedback.brief.cards.some((card: any) => card.id === 'foreign-card'),
    ).toBe(false);
  });
});
