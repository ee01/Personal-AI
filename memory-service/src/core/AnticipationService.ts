import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import { getLLMClient } from '../llm/LLMClient.js';

/**
 * AnticipationService (P1-7: sleep-time compute). The nightly consolidation
 * "Anticipation" phase precomputes answers to tomorrow's likely questions from
 * deterministic signals (no intent guessing):
 *   - upcoming calendar events (meeting briefs)
 *   - open reflection-thread questions (topic briefs)
 *   - near-due deadlines on watched projects
 *
 * Briefs are a derived cache, never a fact layer: each expires at next-day 23:00
 * and is consumed once. /ask consults findPrior() to short-circuit the full
 * retrieval+synthesis chain when a fresh brief matches the question's subject.
 */

export type BriefKind = 'meeting' | 'topic' | 'project' | 'deadline';

export interface AnticipationBrief {
  id: string;
  kind: BriefKind;
  subjectKey: string;
  briefMd: string;
  evidenceRefs: string[];
  validUntil: number;
}

export interface AnticipationSubject {
  kind: BriefKind;
  subjectKey: string;
  prompt: string;
}

/** Synthesize a brief body for a subject. Injectable for tests. */
export type BriefSynthesizer = (subject: AnticipationSubject) => Promise<string>;

const DEFAULT_BUDGET = 8;

export class AnticipationService {
  constructor(
    private db: Database.Database,
    private synthesize: BriefSynthesizer = defaultSynthesizer,
  ) {}

  private hasTable(): boolean {
    return !!this.db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='anticipation_briefs'`)
      .get();
  }

  /** Collect deterministic subjects worth precomputing (bounded). */
  collectSubjects(nowTs: number = now(), limit = DEFAULT_BUDGET): AnticipationSubject[] {
    const subjects: AnticipationSubject[] = [];

    // Upcoming calendar events in the next 36h -> meeting briefs.
    try {
      const horizon = nowTs + 36 * 3600;
      const events = this.db
        .prepare(
          `SELECT title, start_at FROM calendar_events
            WHERE start_at BETWEEN ? AND ? ORDER BY start_at LIMIT ?`,
        )
        .all(nowTs, horizon, limit) as Array<{ title: string; start_at: number }>;
      for (const e of events) {
        if (!e.title) continue;
        subjects.push({
          kind: 'meeting',
          subjectKey: e.title,
          prompt: `明天的会议「${e.title}」我需要提前知道什么？给出预答与依据。`,
        });
      }
    } catch {
      /* calendar table absent */
    }

    // Open reflection-thread questions -> topic briefs.
    try {
      const threads = this.db
        .prepare(
          `SELECT title FROM reflection_threads
            WHERE status NOT IN ('closed', 'resolved', 'archived')
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .all(limit) as Array<{ title: string }>;
      for (const t of threads) {
        if (!t.title) continue;
        subjects.push({
          kind: 'topic',
          subjectKey: t.title,
          prompt: `关于「${t.title}」，我明天可能会问到什么？给出预答与依据。`,
        });
      }
    } catch {
      /* reflection_threads absent */
    }

    // Dedupe by subjectKey and cap to the nightly budget.
    const seen = new Set<string>();
    const deduped: AnticipationSubject[] = [];
    for (const s of subjects) {
      const k = `${s.kind}:${s.subjectKey}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(s);
      if (deduped.length >= limit) break;
    }
    return deduped;
  }

  /** Generate and persist briefs. Returns the count written. */
  async generate(options: { nowTs?: number; budget?: number } = {}): Promise<number> {
    if (!this.hasTable()) return 0;
    const nowTs = options.nowTs ?? now();
    const budget = options.budget ?? DEFAULT_BUDGET;
    const subjects = this.collectSubjects(nowTs, budget);
    if (subjects.length === 0) return 0;

    // valid_until = next day 23:00 local-ish (24h+ window kept simple).
    const validUntil = nowTs + 24 * 3600;
    const insert = this.db.prepare(
      `INSERT INTO anticipation_briefs
         (id, kind, subject_key, brief_md, evidence_refs_json, weave_json, valid_until, consumed_at, created_at)
       VALUES (?, ?, ?, ?, '[]', NULL, ?, NULL, ?)`,
    );
    let written = 0;
    for (const s of subjects) {
      let body: string;
      try {
        body = await this.synthesize(s);
      } catch {
        continue;
      }
      if (!body || !body.trim()) continue;
      insert.run(`brief-${nowTs}-${written}`, s.kind, s.subjectKey, body.slice(0, 4000), validUntil, nowTs);
      written += 1;
    }
    return written;
  }

  /**
   * Find a fresh brief whose subject matches any of the given keys (case/format
   * tolerant). Marks it consumed and returns it, or null.
   */
  findPrior(subjectKeys: string[], nowTs: number = now()): AnticipationBrief | null {
    if (!this.hasTable() || subjectKeys.length === 0) return null;
    const normalized = subjectKeys.map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (normalized.length === 0) return null;

    const rows = this.db
      .prepare(
        `SELECT id, kind, subject_key, brief_md, evidence_refs_json, valid_until
           FROM anticipation_briefs
          WHERE valid_until > ? AND consumed_at IS NULL
          ORDER BY created_at DESC LIMIT 50`,
      )
      .all(nowTs) as Array<{
      id: string;
      kind: BriefKind;
      subject_key: string;
      brief_md: string;
      evidence_refs_json: string;
      valid_until: number;
    }>;

    for (const r of rows) {
      const sk = r.subject_key.toLowerCase();
      const match = normalized.some((k) => sk.includes(k) || k.includes(sk));
      if (!match) continue;
      this.db
        .prepare(`UPDATE anticipation_briefs SET consumed_at = ? WHERE id = ?`)
        .run(nowTs, r.id);
      let evidenceRefs: string[] = [];
      try {
        const parsed = JSON.parse(r.evidence_refs_json);
        if (Array.isArray(parsed)) evidenceRefs = parsed;
      } catch {
        /* ignore */
      }
      return {
        id: r.id,
        kind: r.kind,
        subjectKey: r.subject_key,
        briefMd: r.brief_md,
        evidenceRefs,
        validUntil: r.valid_until,
      };
    }
    return null;
  }

  /** Drop expired briefs (housekeeping). */
  pruneExpired(nowTs: number = now()): number {
    if (!this.hasTable()) return 0;
    const info = this.db
      .prepare(`DELETE FROM anticipation_briefs WHERE valid_until <= ?`)
      .run(nowTs);
    return info.changes;
  }
}

const defaultSynthesizer: BriefSynthesizer = async (subject) => {
  const llm = getLLMClient();
  const resp = await llm.generate(subject.prompt, { maxTokens: 350 });
  return resp.content?.trim() ?? '';
};
