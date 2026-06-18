import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

/**
 * CatchUpService (P1-7 catch-up brief). After the user is away (>=90 min or a
 * meeting just ended), the desktop client asks for a read-only brief of what was
 * captured while they were gone, ranked by importance/salience (and behavioral
 * affinity when available). Strictly read-only: it never marks anything read,
 * never reorders the user's inbox — the book's "已读恐怖主义" red line.
 *
 * Day-close (晚间收尾) reuses the same window query with a since=startOfDay.
 */

export interface CatchUpItem {
  messageId: string;
  source: string;
  title: string;
  preview: string;
  timestamp: number;
  importance: number;
  salience: number;
  waiting: boolean;
}

export interface CatchUpBrief {
  sinceTs: number;
  nowTs: number;
  total: number;
  highPriority: CatchUpItem[];
  waiting: CatchUpItem[];
}

const HIGH_LIMIT = 5;
const WAITING_PATTERN = /[?？]|@|帮我|麻烦|请问|能否|可以吗|什么时候|等你|回复/u;

export class CatchUpService {
  constructor(
    private db: Database.Database,
    private userId?: string,
  ) {}

  buildCatchUp(sinceTs: number, nowTs: number = now()): CatchUpBrief {
    const rows = this.db
      .prepare(
        `SELECT m.id AS id, m.source_type AS source, m.source_title AS title,
                m.content AS content, m.timestamp AS timestamp,
                COALESCE(m.importance, 0.5) AS importance,
                COALESCE(mm.effective_salience, mm.salience_score, 0) AS salience,
                COALESCE(mm.retrieval_tier, 'active') AS tier
           FROM messages_raw m
           LEFT JOIN memory_metadata mm
             ON mm.target_type = 'message' AND mm.target_id = m.id
          WHERE m.timestamp >= ? AND m.timestamp <= ?
          ORDER BY m.timestamp DESC
          LIMIT 200`,
      )
      .all(sinceTs, nowTs) as Array<{
      id: string;
      source: string | null;
      title: string | null;
      content: string;
      timestamp: number;
      importance: number;
      salience: number;
      tier: string;
    }>;

    const items: CatchUpItem[] = rows
      .filter((r) => r.tier !== 'forgotten' && r.tier !== 'archive_only')
      .map((r) => ({
        messageId: r.id,
        source: r.source ?? 'unknown',
        title: r.title || (r.content ?? '').slice(0, 40),
        preview: (r.content ?? '').slice(0, 160),
        timestamp: r.timestamp,
        importance: r.importance,
        salience: r.salience,
        waiting: WAITING_PATTERN.test(r.content ?? ''),
      }));

    // Rank by a combined importance+salience score (descending).
    const ranked = [...items].sort(
      (a, b) => b.importance + b.salience - (a.importance + a.salience),
    );

    return {
      sinceTs,
      nowTs,
      total: items.length,
      highPriority: ranked.slice(0, HIGH_LIMIT),
      waiting: items.filter((i) => i.waiting).slice(0, HIGH_LIMIT),
    };
  }
}
