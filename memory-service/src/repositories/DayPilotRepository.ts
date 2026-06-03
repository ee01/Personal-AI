import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

const OPEN_ACTION_STATUSES = new Set(['queued', 'failed']);

export type DayPilotPriority = 'critical' | 'high' | 'medium' | 'low';
export type DayPilotState = 'prepare' | 'now' | 'waiting' | 'done' | 'muted';
export type DayPilotCardType =
  | 'meeting_prepare'
  | 'thread_followup'
  | 'decision_check'
  | 'ai_tool_shift'
  | 'project_risk'
  | 'relationship_ping'
  | 'rehearsal_prompt'
  | 'skill_opportunity'
  | 'memory_quality';
export type DayPilotFeedbackAction =
  | 'done'
  | 'later'
  | 'mute'
  | 'wrong'
  | 'useful';

export interface DayPilotEvidenceRef {
  sourceKind: string;
  sourceId: string;
  title?: string;
  snippet: string;
  timestamp?: number;
  sourceUrl?: string;
  exploreLink?: string;
}

export interface DayPilotTrust {
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  staleEvidenceCount: number;
  sensitiveEvidenceCount: number;
}

export interface DayPilotAttentionBudget {
  maxInterruptions: number;
  usedInterruptions: number;
  quietWindows: Array<{ from: number; to: number; reason?: string }>;
  plannedInterruptions?: Array<{ cardId: string; reason: string }>;
  boardOnlyCardIds?: string[];
}

export interface DayPilotSourceStats {
  messages: { scanned: number; totalRecent: number };
  calendar: { scanned: number; upcoming: number };
  notifications: { scanned: number; pending: number };
  actions: { scanned: number; queued: number };
  reflections: { scanned: number; active: number };
  rehearsals: { scanned: number; active: number };
  skills: { scanned: number; suggestions: number };
  relationships: { scanned: number; highFrequencyPeople: number };
}

export interface DayPilotMission {
  id: string;
  briefId: string;
  missionKey: string;
  title: string;
  status: 'active' | 'waiting' | 'done' | 'muted';
  sourceKinds: string[];
  timeWindow: { from?: number; to?: number };
  relatedRefs: Record<string, unknown>;
  currentState?: string;
  desiredOutcome?: string;
  nextActions: Array<{ title: string; desc: string }>;
  score: number;
  createdAt: number;
  updatedAt: number;
}

export interface DayPilotCard {
  id: string;
  briefId: string;
  missionId?: string;
  cardType: DayPilotCardType;
  title: string;
  priority: DayPilotPriority;
  state: DayPilotState;
  whyNow: string;
  nextBestAction: string;
  dueAt?: number;
  people: Array<{ id?: string; name: string; type?: string }>;
  projects: Array<{ id?: string; name: string; type?: string }>;
  evidenceRefs: DayPilotEvidenceRef[];
  openQuestions: string[];
  trust: DayPilotTrust;
  contextPack: Record<string, unknown>;
  sourceHash: string;
  score: number;
  createdAt: number;
  updatedAt: number;
}

export interface DayPilotBrief {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  generatedAt: number;
  horizon: { from: number; to: number };
  status: 'draft' | 'ready' | 'stale' | 'archived';
  summary: string;
  attentionBudget: DayPilotAttentionBudget;
  sourceStats: DayPilotSourceStats;
  cards: DayPilotCard[];
  missions: DayPilotMission[];
  createdAt: number;
  updatedAt: number;
}

export interface DayPilotGenerationInput {
  id?: string;
  userId: string;
  localDate: string;
  timezone: string;
  generatedAt: number;
  horizonFrom: number;
  horizonTo: number;
  status?: DayPilotBrief['status'];
  summary: string;
  attentionBudget: DayPilotAttentionBudget;
  sourceStats: DayPilotSourceStats;
  missions: Array<Omit<DayPilotMission, 'briefId' | 'createdAt' | 'updatedAt'>>;
  cards: Array<Omit<DayPilotCard, 'briefId' | 'createdAt' | 'updatedAt'>>;
}

export interface DayPilotFeedbackInput {
  action: DayPilotFeedbackAction;
  reason?: string;
  note?: string;
  snoozeUntil?: number;
  muteKey?: string;
}

export interface DayPilotFeedbackSignal {
  usefulCount: number;
  wrongCount: number;
  laterCount: number;
  doneCount: number;
  muteCount: number;
  latestAction?: DayPilotFeedbackAction;
  latestAt?: number;
}

interface DayBriefRow {
  id: string;
  user_id: string;
  local_date: string;
  timezone: string;
  generated_at: number;
  horizon_from: number;
  horizon_to: number;
  status: DayPilotBrief['status'];
  summary: string | null;
  attention_budget_json: string;
  source_stats_json: string;
  created_at: number;
  updated_at: number;
}

interface DayMissionRow {
  id: string;
  brief_id: string;
  mission_key: string;
  title: string;
  status: DayPilotMission['status'];
  source_kinds_json: string;
  time_window_json: string;
  related_refs_json: string;
  current_state: string | null;
  desired_outcome: string | null;
  next_actions_json: string;
  score: number;
  created_at: number;
  updated_at: number;
}

interface DayCardRow {
  id: string;
  brief_id: string;
  mission_id: string | null;
  card_type: DayPilotCardType;
  title: string;
  priority: DayPilotPriority;
  state: DayPilotState;
  why_now: string;
  next_best_action: string;
  due_at: number | null;
  people_json: string;
  projects_json: string;
  evidence_refs_json: string;
  open_questions_json: string;
  trust_json: string;
  context_pack_json: string;
  source_hash: string;
  score: number;
  created_at: number;
  updated_at: number;
}

interface FeedbackRow {
  card_id: string | null;
  mission_id: string | null;
  action: DayPilotFeedbackAction;
  snooze_until: number | null;
  mute_key: string | null;
  created_at: number;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class DayPilotRepository {
  constructor(private readonly db: Database.Database) {}

  getBriefByDate(
    userId: string,
    localDate: string,
    currentTime = now(),
  ): DayPilotBrief | null {
    const briefRow = this.db
      .prepare(
        `SELECT *
         FROM day_briefs
         WHERE user_id = ? AND local_date = ?
         LIMIT 1`,
      )
      .get(userId, localDate) as DayBriefRow | undefined;

    if (!briefRow) return null;
    return this.buildBrief(briefRow, currentTime);
  }

  getBriefById(briefId: string, currentTime = now()): DayPilotBrief | null {
    const briefRow = this.db
      .prepare(`SELECT * FROM day_briefs WHERE id = ? LIMIT 1`)
      .get(briefId) as DayBriefRow | undefined;
    if (!briefRow) return null;
    return this.buildBrief(briefRow, currentTime);
  }

  storeGeneratedBrief(input: DayPilotGenerationInput): DayPilotBrief {
    const currentTime = input.generatedAt || now();
    const existing = this.db
      .prepare(
        `SELECT id
         FROM day_briefs
         WHERE user_id = ? AND local_date = ?
         LIMIT 1`,
      )
      .get(input.userId, input.localDate) as { id: string } | undefined;
    const briefId = existing?.id ?? input.id ?? randomUUID();

    const write = this.db.transaction(() => {
      if (existing) {
        this.db
          .prepare(`DELETE FROM day_brief_cards WHERE brief_id = ?`)
          .run(briefId);
        this.db
          .prepare(`DELETE FROM day_missions WHERE brief_id = ?`)
          .run(briefId);
        this.db
          .prepare(
            `UPDATE day_briefs
             SET timezone = ?,
                 generated_at = ?,
                 horizon_from = ?,
                 horizon_to = ?,
                 status = ?,
                 summary = ?,
                 attention_budget_json = ?,
                 source_stats_json = ?,
                 updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.timezone,
            currentTime,
            input.horizonFrom,
            input.horizonTo,
            input.status ?? 'ready',
            input.summary,
            JSON.stringify(input.attentionBudget),
            JSON.stringify(input.sourceStats),
            currentTime,
            briefId,
          );
      } else {
        this.db
          .prepare(
            `INSERT INTO day_briefs
              (id, user_id, local_date, timezone, generated_at, horizon_from, horizon_to,
               status, summary, attention_budget_json, source_stats_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            briefId,
            input.userId,
            input.localDate,
            input.timezone,
            currentTime,
            input.horizonFrom,
            input.horizonTo,
            input.status ?? 'ready',
            input.summary,
            JSON.stringify(input.attentionBudget),
            JSON.stringify(input.sourceStats),
            currentTime,
            currentTime,
          );
      }

      for (const mission of input.missions) {
        this.db
          .prepare(
            `INSERT INTO day_missions
              (id, brief_id, mission_key, title, status, source_kinds_json, time_window_json,
               related_refs_json, current_state, desired_outcome, next_actions_json, score,
               created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            mission.id,
            briefId,
            mission.missionKey,
            mission.title,
            mission.status,
            JSON.stringify(mission.sourceKinds),
            JSON.stringify(mission.timeWindow),
            JSON.stringify(mission.relatedRefs),
            mission.currentState ?? null,
            mission.desiredOutcome ?? null,
            JSON.stringify(mission.nextActions),
            mission.score,
            currentTime,
            currentTime,
          );
      }

      for (const card of input.cards) {
        this.db
          .prepare(
            `INSERT INTO day_brief_cards
              (id, brief_id, mission_id, card_type, title, priority, state, why_now,
               next_best_action, due_at, people_json, projects_json, evidence_refs_json,
               open_questions_json, trust_json, context_pack_json, source_hash, score,
               created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            card.id,
            briefId,
            card.missionId ?? null,
            card.cardType,
            card.title,
            card.priority,
            card.state,
            card.whyNow,
            card.nextBestAction,
            card.dueAt ?? null,
            JSON.stringify(card.people),
            JSON.stringify(card.projects),
            JSON.stringify(card.evidenceRefs),
            JSON.stringify(card.openQuestions),
            JSON.stringify(card.trust),
            JSON.stringify(card.contextPack),
            card.sourceHash,
            card.score,
            currentTime,
            currentTime,
          );
      }
    });

    write();
    const brief = this.getBriefById(briefId, currentTime);
    if (!brief) {
      throw new Error('Failed to load generated Day Pilot brief');
    }
    return brief;
  }

  insertFeedback(
    briefId: string,
    card: DayPilotCard | null,
    input: DayPilotFeedbackInput,
    currentTime = now(),
  ): void {
    const feedbackKey = input.muteKey ?? card?.sourceHash ?? null;
    this.db
      .prepare(
        `INSERT INTO day_brief_feedback
          (id, brief_id, card_id, mission_id, action, reason, note, snooze_until, mute_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        briefId,
        card?.id ?? null,
        card?.missionId ?? null,
        input.action,
        input.reason ?? null,
        input.note ?? null,
        input.snoozeUntil ?? null,
        feedbackKey,
        currentTime,
      );

    if (card && (input.action === 'done' || input.action === 'mute')) {
      this.db
        .prepare(
          `UPDATE day_brief_cards
           SET state = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(input.action === 'done' ? 'done' : 'muted', currentTime, card.id);
    }
  }

  getFeedbackSignal(
    userId: string,
    sourceHash: string,
    since = now() - 30 * 86400,
  ): DayPilotFeedbackSignal {
    const rows = this.db
      .prepare(
        `SELECT f.action, f.created_at
         FROM day_brief_feedback f
         JOIN day_briefs b ON b.id = f.brief_id
         WHERE b.user_id = ?
           AND f.mute_key = ?
           AND f.created_at >= ?
         ORDER BY f.created_at DESC`,
      )
      .all(userId, sourceHash, since) as Array<{
      action: DayPilotFeedbackAction;
      created_at: number;
    }>;

    const signal: DayPilotFeedbackSignal = {
      usefulCount: 0,
      wrongCount: 0,
      laterCount: 0,
      doneCount: 0,
      muteCount: 0,
      latestAction: rows[0]?.action,
      latestAt: rows[0]?.created_at,
    };

    for (const row of rows) {
      if (row.action === 'useful') signal.usefulCount += 1;
      if (row.action === 'wrong') signal.wrongCount += 1;
      if (row.action === 'later') signal.laterCount += 1;
      if (row.action === 'done') signal.doneCount += 1;
      if (row.action === 'mute') signal.muteCount += 1;
    }

    return signal;
  }

  findCardById(cardId: string): DayPilotCard | null {
    const row = this.db
      .prepare(`SELECT * FROM day_brief_cards WHERE id = ? LIMIT 1`)
      .get(cardId) as DayCardRow | undefined;
    return row ? this.rowToCard(row) : null;
  }

  findBriefForCard(cardId: string): DayPilotBrief | null {
    const row = this.db
      .prepare(
        `SELECT b.*
         FROM day_briefs b
         JOIN day_brief_cards c ON c.brief_id = b.id
         WHERE c.id = ?
         LIMIT 1`,
      )
      .get(cardId) as DayBriefRow | undefined;
    return row ? this.buildBrief(row) : null;
  }

  findMissionById(missionId: string): DayPilotMission | null {
    const row = this.db
      .prepare(`SELECT * FROM day_missions WHERE id = ? LIMIT 1`)
      .get(missionId) as DayMissionRow | undefined;
    return row ? this.rowToMission(row) : null;
  }

  findCardByMissionId(missionId: string): DayPilotCard | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM day_brief_cards
         WHERE mission_id = ?
         ORDER BY score DESC
         LIMIT 1`,
      )
      .get(missionId) as DayCardRow | undefined;
    return row ? this.rowToCard(row) : null;
  }

  getMessageEvidence(id: string): DayPilotEvidenceRef | null {
    const row = this.db
      .prepare(
        `SELECT id, summary, content, source_type, source_url, source_title, sender, group_name, timestamp
         FROM messages_raw
         WHERE id = ?
         LIMIT 1`,
      )
      .get(id) as
      | {
          id: string;
          summary: string | null;
          content: string;
          source_type: string;
          source_url: string | null;
          source_title: string | null;
          sender: string | null;
          group_name: string | null;
          timestamp: number;
        }
      | undefined;
    if (!row) return null;
    return {
      sourceKind: row.source_type || 'message',
      sourceId: row.id,
      title:
        row.source_title ?? row.group_name ?? row.sender ?? row.source_type,
      snippet: row.summary || row.content,
      timestamp: row.timestamp,
      sourceUrl: row.source_url ?? undefined,
    };
  }

  private buildBrief(row: DayBriefRow, currentTime = now()): DayPilotBrief {
    const missions = this.db
      .prepare(
        `SELECT *
         FROM day_missions
         WHERE brief_id = ?
         ORDER BY score DESC`,
      )
      .all(row.id) as DayMissionRow[];
    const cards = this.db
      .prepare(
        `SELECT *
         FROM day_brief_cards
         WHERE brief_id = ?
         ORDER BY score DESC`,
      )
      .all(row.id) as DayCardRow[];

    const feedbackRows = this.db
      .prepare(
        `SELECT card_id, mission_id, action, snooze_until, mute_key, created_at
         FROM day_brief_feedback
         WHERE brief_id = ?
         ORDER BY created_at DESC`,
      )
      .all(row.id) as FeedbackRow[];

    const visibleCards = cards
      .map((cardRow) => this.rowToCard(cardRow))
      .filter((card) => this.isCardVisible(card, feedbackRows, currentTime));

    return {
      id: row.id,
      userId: row.user_id,
      localDate: row.local_date,
      timezone: row.timezone,
      generatedAt: row.generated_at,
      horizon: { from: row.horizon_from, to: row.horizon_to },
      status: row.status,
      summary: row.summary ?? '',
      attentionBudget: safeJsonParse<DayPilotAttentionBudget>(
        row.attention_budget_json,
        { maxInterruptions: 3, usedInterruptions: 0, quietWindows: [] },
      ),
      sourceStats: safeJsonParse<DayPilotSourceStats>(
        row.source_stats_json,
        this.emptySourceStats(),
      ),
      missions: missions.map((missionRow) => this.rowToMission(missionRow)),
      cards: visibleCards,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private isCardVisible(
    card: DayPilotCard,
    feedbackRows: FeedbackRow[],
    currentTime: number,
  ): boolean {
    if (card.state === 'done' || card.state === 'muted') return false;
    if (!this.areActionEvidenceRefsStillOpen(card)) return false;
    for (const feedback of feedbackRows) {
      const sameCard = feedback.card_id === card.id;
      const sameMission =
        feedback.mission_id && feedback.mission_id === card.missionId;
      const sameMuteKey =
        feedback.mute_key && feedback.mute_key === card.sourceHash;
      if (!sameCard && !sameMission && !sameMuteKey) continue;
      if (feedback.action === 'done' || feedback.action === 'mute') {
        return false;
      }
      if (
        feedback.action === 'later' &&
        feedback.snooze_until &&
        feedback.snooze_until > currentTime
      ) {
        return false;
      }
    }
    return true;
  }

  private areActionEvidenceRefsStillOpen(card: DayPilotCard): boolean {
    const actionRefs = card.evidenceRefs.filter(
      (ref) => ref.sourceKind === 'action' && ref.sourceId,
    );
    if (actionRefs.length === 0) return true;

    return actionRefs.some((ref) => {
      const row = this.db
        .prepare(
          `SELECT queue_status
           FROM proposed_actions
           WHERE id = ?
           LIMIT 1`,
        )
        .get(ref.sourceId) as { queue_status: string | null } | undefined;
      return OPEN_ACTION_STATUSES.has(row?.queue_status ?? '');
    });
  }

  private rowToMission(row: DayMissionRow): DayPilotMission {
    return {
      id: row.id,
      briefId: row.brief_id,
      missionKey: row.mission_key,
      title: row.title,
      status: row.status,
      sourceKinds: safeJsonParse<string[]>(row.source_kinds_json, []),
      timeWindow: safeJsonParse<{ from?: number; to?: number }>(
        row.time_window_json,
        {},
      ),
      relatedRefs: safeJsonParse<Record<string, unknown>>(
        row.related_refs_json,
        {},
      ),
      currentState: row.current_state ?? undefined,
      desiredOutcome: row.desired_outcome ?? undefined,
      nextActions: safeJsonParse<Array<{ title: string; desc: string }>>(
        row.next_actions_json,
        [],
      ),
      score: row.score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToCard(row: DayCardRow): DayPilotCard {
    return {
      id: row.id,
      briefId: row.brief_id,
      missionId: row.mission_id ?? undefined,
      cardType: row.card_type,
      title: row.title,
      priority: row.priority,
      state: row.state,
      whyNow: row.why_now,
      nextBestAction: row.next_best_action,
      dueAt: row.due_at ?? undefined,
      people: safeJsonParse<
        Array<{ id?: string; name: string; type?: string }>
      >(row.people_json, []),
      projects: safeJsonParse<
        Array<{ id?: string; name: string; type?: string }>
      >(row.projects_json, []),
      evidenceRefs: safeJsonParse<DayPilotEvidenceRef[]>(
        row.evidence_refs_json,
        [],
      ),
      openQuestions: safeJsonParse<string[]>(row.open_questions_json, []),
      trust: safeJsonParse<DayPilotTrust>(row.trust_json, {
        confidence: 0.6,
        riskLevel: 'medium',
        staleEvidenceCount: 0,
        sensitiveEvidenceCount: 0,
      }),
      contextPack: safeJsonParse<Record<string, unknown>>(
        row.context_pack_json,
        {},
      ),
      sourceHash: row.source_hash,
      score: row.score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private emptySourceStats(): DayPilotSourceStats {
    return {
      messages: { scanned: 0, totalRecent: 0 },
      calendar: { scanned: 0, upcoming: 0 },
      notifications: { scanned: 0, pending: 0 },
      actions: { scanned: 0, queued: 0 },
      reflections: { scanned: 0, active: 0 },
      rehearsals: { scanned: 0, active: 0 },
      skills: { scanned: 0, suggestions: 0 },
      relationships: { scanned: 0, highFrequencyPeople: 0 },
    };
  }
}
