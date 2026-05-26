import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  ConversationArtifactRecord,
  ExplorerConversationSummary,
  RawMessageRecord,
  RawMessageStoreStats,
  SourceId,
} from '../types.js';

type CountRow = {
  message_count?: number;
  pending_extract_count?: number;
  conversation_count?: number;
  artifact_count?: number;
};

type RawMessageRow = {
  source: SourceId;
  conversation_id: string;
  message_id: string;
  ts: string | null;
  role: string;
  content_hash: string;
  content: string;
  extracted_at: string | null;
};

type ArtifactRow = {
  source: SourceId;
  conversation_id: string;
  extracted_at: string;
  kind: 'fact' | 'preference' | 'event' | 'plan';
  text: string;
  source_quote: string;
  conversation_ref: string;
};

type ConversationRow = {
  source: SourceId;
  conversation_id: string;
  latest_ts: string | null;
  message_count?: number;
  pending_message_count?: number;
  extracted_message_count?: number;
  artifact_count?: number;
  latest_message_preview?: string | null;
};

export class RawMessageStore {
  private readonly db: DatabaseSync;

  constructor(private readonly dbFile: string) {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    this.db = new DatabaseSync(dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS raw_messages (
        source TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        ts TEXT,
        role TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        content TEXT NOT NULL,
        extracted_at TEXT,
        PRIMARY KEY (source, conversation_id, message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_raw_messages_source_ts
        ON raw_messages (source, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_raw_messages_pending_extract
        ON raw_messages (source, extracted_at);
      CREATE TABLE IF NOT EXISTS conversation_artifacts (
        source TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        extracted_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        source_quote TEXT NOT NULL,
        conversation_ref TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_artifacts_source_conversation
        ON conversation_artifacts (source, conversation_id, extracted_at DESC);
    `);
  }

  get filePath(): string {
    return this.dbFile;
  }

  insertMany(messages: RawMessageRecord[]): number {
    if (messages.length === 0) return 0;

    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO raw_messages (
        source,
        conversation_id,
        message_id,
        ts,
        role,
        content_hash,
        content,
        extracted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    this.db.exec('BEGIN');
    try {
      for (const message of messages) {
        const result = statement.run(
          message.source,
          message.conversationId,
          message.messageId,
          message.ts ?? null,
          message.role,
          message.contentHash,
          message.content,
          message.extractedAt ?? null,
        );
        inserted += Number(result.changes ?? 0);
      }
      this.db.exec('COMMIT');
      return inserted;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getStats(source: SourceId): RawMessageStoreStats {
    const row = this.db
      .prepare(
        `
          SELECT
            COUNT(*) AS message_count,
            COUNT(DISTINCT conversation_id) AS conversation_count,
            SUM(CASE WHEN extracted_at IS NULL THEN 1 ELSE 0 END) AS pending_extract_count,
            (
              SELECT COUNT(*)
              FROM conversation_artifacts AS ca
              WHERE ca.source = ?
            ) AS artifact_count
          FROM raw_messages
          WHERE source = ?
        `,
      )
      .get(source, source) as CountRow | undefined;

    return {
      messageCount: Number(row?.message_count ?? 0),
      pendingExtractCount: Number(row?.pending_extract_count ?? 0),
      conversationCount: Number(row?.conversation_count ?? 0),
      artifactCount: Number(row?.artifact_count ?? 0),
    };
  }

  listMessages(options: {
    source: SourceId;
    conversationId?: string;
    limit?: number;
  }): RawMessageRecord[] {
    const limit = Math.max(1, options.limit ?? 50);
    const rows = options.conversationId
      ? ((this.db
          .prepare(
            `
              SELECT source, conversation_id, message_id, ts, role, content_hash, content, extracted_at
              FROM raw_messages
              WHERE source = ? AND conversation_id = ?
              ORDER BY COALESCE(ts, '') DESC, message_id DESC
              LIMIT ?
            `,
          )
          .all(
            options.source,
            options.conversationId,
            limit,
          ) as RawMessageRow[]) ?? [])
      : ((this.db
          .prepare(
            `
              SELECT source, conversation_id, message_id, ts, role, content_hash, content, extracted_at
              FROM raw_messages
              WHERE source = ?
              ORDER BY COALESCE(ts, '') DESC, message_id DESC
              LIMIT ?
            `,
          )
          .all(options.source, limit) as RawMessageRow[]) ?? []);

    return rows.map((row) => ({
      source: row.source,
      conversationId: row.conversation_id,
      messageId: row.message_id,
      ts: row.ts ?? undefined,
      role: row.role,
      contentHash: row.content_hash,
      content: row.content,
      extractedAt: row.extracted_at ?? undefined,
    }));
  }

  listPendingMessages(options: {
    source: SourceId;
    conversationId?: string;
    limit?: number;
  }): RawMessageRecord[] {
    const rows = options.conversationId
      ? ((this.db
          .prepare(
            `
              SELECT source, conversation_id, message_id, ts, role, content_hash, content, extracted_at
              FROM raw_messages
              WHERE source = ? AND conversation_id = ? AND extracted_at IS NULL
              ORDER BY COALESCE(ts, '') ASC, message_id ASC
              LIMIT COALESCE(?, -1)
            `,
          )
          .all(
            options.source,
            options.conversationId,
            options.limit ?? null,
          ) as RawMessageRow[]) ?? [])
      : ((this.db
          .prepare(
            `
              SELECT source, conversation_id, message_id, ts, role, content_hash, content, extracted_at
              FROM raw_messages
              WHERE source = ? AND extracted_at IS NULL
              ORDER BY conversation_id ASC, COALESCE(ts, '') ASC, message_id ASC
              LIMIT COALESCE(?, -1)
            `,
          )
          .all(options.source, options.limit ?? null) as RawMessageRow[]) ??
        []);

    return rows.map((row) => ({
      source: row.source,
      conversationId: row.conversation_id,
      messageId: row.message_id,
      ts: row.ts ?? undefined,
      role: row.role,
      contentHash: row.content_hash,
      content: row.content,
      extractedAt: row.extracted_at ?? undefined,
    }));
  }

  listConversations(options: {
    source: SourceId;
    limit?: number;
  }): ExplorerConversationSummary[] {
    const limit = Math.max(1, options.limit ?? 100);
    const rows =
      (this.db
        .prepare(
          `
            SELECT
              rm.source AS source,
              rm.conversation_id AS conversation_id,
              MAX(COALESCE(rm.ts, '')) AS latest_ts,
              COUNT(*) AS message_count,
              SUM(CASE WHEN rm.extracted_at IS NULL THEN 1 ELSE 0 END) AS pending_message_count,
              SUM(CASE WHEN rm.extracted_at IS NOT NULL THEN 1 ELSE 0 END) AS extracted_message_count,
              COALESCE((
                SELECT COUNT(*)
                FROM conversation_artifacts AS ca
                WHERE ca.source = rm.source AND ca.conversation_id = rm.conversation_id
              ), 0) AS artifact_count,
              (
                SELECT rm2.content
                FROM raw_messages AS rm2
                WHERE rm2.source = rm.source AND rm2.conversation_id = rm.conversation_id
                ORDER BY COALESCE(rm2.ts, '') DESC, rm2.message_id DESC
                LIMIT 1
              ) AS latest_message_preview
            FROM raw_messages AS rm
            WHERE rm.source = ?
            GROUP BY rm.source, rm.conversation_id
            ORDER BY MAX(COALESCE(rm.ts, '')) DESC, rm.conversation_id ASC
            LIMIT ?
          `,
        )
        .all(options.source, limit) as ConversationRow[]) ?? [];

    return rows.map((row) => ({
      source: row.source,
      conversationId: row.conversation_id,
      latestTs: row.latest_ts || undefined,
      messageCount: Number(row.message_count ?? 0),
      pendingMessageCount: Number(row.pending_message_count ?? 0),
      extractedMessageCount: Number(row.extracted_message_count ?? 0),
      artifactCount: Number(row.artifact_count ?? 0),
      latestMessagePreview: row.latest_message_preview || undefined,
    }));
  }

  markExtracted(
    messages: Array<
      Pick<RawMessageRecord, 'source' | 'conversationId' | 'messageId'>
    >,
    extractedAt = new Date().toISOString(),
  ): number {
    if (messages.length === 0) return 0;

    const statement = this.db.prepare(`
      UPDATE raw_messages
      SET extracted_at = ?
      WHERE source = ? AND conversation_id = ? AND message_id = ?
    `);

    let updated = 0;
    this.db.exec('BEGIN');
    try {
      for (const message of messages) {
        const result = statement.run(
          extractedAt,
          message.source,
          message.conversationId,
          message.messageId,
        );
        updated += Number(result.changes ?? 0);
      }
      this.db.exec('COMMIT');
      return updated;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  replaceConversationArtifacts(options: {
    source: SourceId;
    conversationId: string;
    extractedAt?: string;
    artifacts: Array<{
      kind: 'fact' | 'preference' | 'event' | 'plan';
      text: string;
      sourceQuote: string;
      conversationRef: string;
    }>;
  }): number {
    const extractedAt = options.extractedAt ?? new Date().toISOString();
    const deleteStatement = this.db.prepare(
      'DELETE FROM conversation_artifacts WHERE source = ? AND conversation_id = ?',
    );
    const insertStatement = this.db.prepare(`
      INSERT INTO conversation_artifacts (
        source,
        conversation_id,
        extracted_at,
        kind,
        text,
        source_quote,
        conversation_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.exec('BEGIN');
    try {
      deleteStatement.run(options.source, options.conversationId);
      let inserted = 0;
      for (const artifact of options.artifacts) {
        const result = insertStatement.run(
          options.source,
          options.conversationId,
          extractedAt,
          artifact.kind,
          artifact.text,
          artifact.sourceQuote,
          artifact.conversationRef,
        );
        inserted += Number(result.changes ?? 0);
      }
      this.db.exec('COMMIT');
      return inserted;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Returns artifacts across all sources, newest first. Supports optional
   * source filter, free-text search and pagination. Used by the
   * "Explored Memories" window so the user can browse what has already
   * been ingested into Memory Service in a single flat list.
   *
   * `query` does a case-insensitive substring match against
   * `text` and `source_quote` (so the user can search either the
   * extracted statement or the original quote).
   */
  listAllArtifacts(options: {
    source?: SourceId;
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): ConversationArtifactRecord[] {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
    const offset = Math.max(0, options.offset ?? 0);
    const wheres: string[] = [];
    const params: Array<string | number> = [];

    if (options.source) {
      wheres.push('source = ?');
      params.push(options.source);
    }

    if (options.query && options.query.trim()) {
      const needle = `%${options.query.trim().toLowerCase()}%`;
      wheres.push('(LOWER(text) LIKE ? OR LOWER(source_quote) LIKE ?)');
      params.push(needle, needle);
    }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const rows = (this.db
      .prepare(
        `
          SELECT source, conversation_id, extracted_at, kind, text, source_quote, conversation_ref
          FROM conversation_artifacts
          ${whereClause}
          ORDER BY extracted_at DESC, rowid DESC
          LIMIT ? OFFSET ?
        `,
      )
      .all(...params, limit, offset) as ArtifactRow[]) ?? [];

    return rows.map((row) => ({
      source: row.source,
      conversationId: row.conversation_id,
      extractedAt: row.extracted_at,
      kind: row.kind,
      text: row.text,
      sourceQuote: row.source_quote,
      conversationRef: row.conversation_ref,
    }));
  }

  /**
   * Total artifact count under the same filter as `listAllArtifacts`.
   * Used to decide whether to show the "Load more" affordance.
   */
  countAllArtifacts(
    options: { source?: SourceId; query?: string } = {},
  ): number {
    const wheres: string[] = [];
    const params: Array<string | number> = [];

    if (options.source) {
      wheres.push('source = ?');
      params.push(options.source);
    }

    if (options.query && options.query.trim()) {
      const needle = `%${options.query.trim().toLowerCase()}%`;
      wheres.push('(LOWER(text) LIKE ? OR LOWER(source_quote) LIKE ?)');
      params.push(needle, needle);
    }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS total FROM conversation_artifacts ${whereClause}`,
      )
      .get(...params) as { total?: number } | undefined;
    return Number(row?.total ?? 0);
  }

  listConversationArtifacts(options: {
    source: SourceId;
    conversationId?: string;
    limit?: number;
  }): ConversationArtifactRecord[] {
    const limit = Math.max(1, options.limit ?? 50);
    const rows = options.conversationId
      ? ((this.db
          .prepare(
            `
              SELECT source, conversation_id, extracted_at, kind, text, source_quote, conversation_ref
              FROM conversation_artifacts
              WHERE source = ? AND conversation_id = ?
              ORDER BY extracted_at DESC, rowid DESC
              LIMIT ?
            `,
          )
          .all(
            options.source,
            options.conversationId,
            limit,
          ) as ArtifactRow[]) ?? [])
      : ((this.db
          .prepare(
            `
              SELECT source, conversation_id, extracted_at, kind, text, source_quote, conversation_ref
              FROM conversation_artifacts
              WHERE source = ?
              ORDER BY extracted_at DESC, rowid DESC
              LIMIT ?
            `,
          )
          .all(options.source, limit) as ArtifactRow[]) ?? []);

    return rows.map((row) => ({
      source: row.source,
      conversationId: row.conversation_id,
      extractedAt: row.extracted_at,
      kind: row.kind,
      text: row.text,
      sourceQuote: row.source_quote,
      conversationRef: row.conversation_ref,
    }));
  }

  reset(source: SourceId, conversationId?: string): number {
    const deleteMessages = conversationId
      ? this.db.prepare(
          'DELETE FROM raw_messages WHERE source = ? AND conversation_id = ?',
        )
      : this.db.prepare('DELETE FROM raw_messages WHERE source = ?');
    const deleteArtifacts = conversationId
      ? this.db.prepare(
          'DELETE FROM conversation_artifacts WHERE source = ? AND conversation_id = ?',
        )
      : this.db.prepare('DELETE FROM conversation_artifacts WHERE source = ?');

    this.db.exec('BEGIN');
    try {
      const result = conversationId
        ? deleteMessages.run(source, conversationId)
        : deleteMessages.run(source);
      conversationId
        ? deleteArtifacts.run(source, conversationId)
        : deleteArtifacts.run(source);
      this.db.exec('COMMIT');
      return Number(result.changes ?? 0);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
