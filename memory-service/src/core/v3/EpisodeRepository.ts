/**
 * v3 EpisodeRepository (memory-foundation plan §5.1): thin wrapper so the
 * physical `messages_raw` table can be addressed as the Episode plane
 * without leaking its name/shape into v3 code. Read-only helper; episode
 * persistence continues to happen through the existing ingest path.
 */

import type Database from 'better-sqlite3';

export interface EpisodeRecord {
  id: string;
  content: string;
  summary: string | null;
  scope: string | null;
  sourceType: string;
  sourceUrl: string | null;
  sender: string | null;
  groupId: string | null;
  groupName: string | null;
  timestamp: number;
  trustClass: string | null;
  createdAt: number;
}

export class EpisodeRepository {
  constructor(private readonly db: Database.Database) {}

  get(id: string): EpisodeRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, content, summary, scope, source_type, source_url,
                sender, group_id, group_name, timestamp, trust_class, created_at
         FROM messages_raw WHERE id = ?`,
      )
      .get(id) as EpisodeRecord | undefined;
    return row ?? null;
  }

  /**
   * Return the persisted body's span text for [start, end) (byte,
   * half-open, plan §5.3). Throws when the range is invalid.
   */
  getSpan(id: string, spanStart: number, spanEnd: number): string {
    const episode = this.get(id);
    if (!episode) throw new Error(`episode not found: ${id}`);
    const buf = Buffer.from(episode.content, 'utf8');
    if (spanStart < 0 || spanEnd > buf.length || spanStart >= spanEnd) {
      throw new Error(
        `span out of range for ${id}: ${spanStart}-${spanEnd} (len ${buf.length})`,
      );
    }
    return buf.subarray(spanStart, spanEnd).toString('utf8');
  }

  /**
   * Validate a byte half-open span [start, end) against the episode's
   * actual persisted body and its sha256 hash (plan §5.3: span offsets must
   * not drift — the stored span_text_hash is checked at replay/display).
   */
  validateSpan(
    id: string,
    spanStart: number,
    spanEnd: number,
    spanTextHash: string,
  ): { ok: true; spanText: string } | { ok: false; reason: string } {
    const episode = this.get(id);
    if (!episode) return { ok: false, reason: 'episode_not_found' };
    try {
      const spanText = this.getSpan(id, spanStart, spanEnd);
      if (spanTextHashOf(spanText) !== spanTextHash) {
        return { ok: false, reason: 'span_hash_mismatch' };
      }
      return { ok: true, spanText };
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
  }
}

import { createHash } from 'node:crypto';

export function spanTextHashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
