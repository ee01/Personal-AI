import type Database from 'better-sqlite3';

import { IngestionPipeline } from '../../core/IngestionPipeline.js';
import type { UserDataManager } from '../../storage/UserDataManager.js';
import { now } from '../../utils/time.js';
import { RingCentralWebhookRepository } from './RingCentralWebhookRepository.js';
import {
  extractTeamMessagingNotification,
  notificationToIngestPayload,
  readValidationToken,
} from './teamMessagingWebhookParse.js';
import type { ParsedTeamMessagingNotification } from './teamMessagingWebhookTypes.js';

export interface WebhookProcessResult {
  kind: 'validation' | 'duplicate' | 'ingested' | 'updated' | 'revoked' | 'ignored';
  postId?: string;
  messageId?: string;
  reason?: string;
}

export class TeamMessagingWebhookService {
  private readonly repo: RingCentralWebhookRepository;

  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager: UserDataManager | undefined,
    private readonly userId: string,
  ) {
    this.repo = new RingCentralWebhookRepository(db);
  }

  handleValidation(
    headers: Record<string, string | string[] | undefined>,
  ): { ok: true; validationToken: string } | { ok: false; reason: string } {
    const token = readValidationToken(headers);
    if (!token) {
      return { ok: false, reason: 'missing_validation_token' };
    }
    return { ok: true, validationToken: token };
  }

  async processNotification(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookProcessResult> {
    const note = extractTeamMessagingNotification(body, headers);
    if (!note) {
      return { kind: 'ignored', reason: 'unrecognized_payload' };
    }

    if (!this.repo.rememberDelivery(note.deliveryKey, note.eventType, note.postId)) {
      return { kind: 'duplicate', postId: note.postId };
    }

    if (note.eventType === 'PostRemoved') {
      return this.revokePost(note);
    }
    if (note.eventType === 'PostChanged') {
      return this.updatePost(note);
    }
    if (note.eventType === 'PostAdded' || note.eventType === 'Unknown') {
      return this.ingestPost(note);
    }
    return { kind: 'ignored', postId: note.postId, reason: note.eventType };
  }

  private pipeline(): IngestionPipeline {
    return new IngestionPipeline(this.db, this.userDataManager, this.userId);
  }

  async ingestFromParsedNote(
    note: ParsedTeamMessagingNotification,
    capturePath: 'webhook' | 'backfill',
  ): Promise<WebhookProcessResult> {
    const payload = notificationToIngestPayload(note, { capturePath });
    const result = await this.pipeline().ingest(payload);
    return {
      kind: result.status === 'duplicate' ? 'duplicate' : 'ingested',
      postId: note.postId,
      messageId: result.id,
    };
  }

  private async ingestPost(
    note: ParsedTeamMessagingNotification,
  ): Promise<WebhookProcessResult> {
    return this.ingestFromParsedNote(note, 'webhook');
  }

  private async updatePost(
    note: ParsedTeamMessagingNotification,
  ): Promise<WebhookProcessResult> {
    const existing = this.findMessageIdByPostId(note.postId, note.groupId);
    if (!existing) {
      return this.ingestPost(note);
    }

    const payload = notificationToIngestPayload(note, { capturePath: 'webhook' });
    const metadata = {
      ...(JSON.parse(
        (
          this.db
            .prepare(`SELECT metadata_json FROM messages_raw WHERE id = ?`)
            .get(existing) as { metadata_json: string | null } | undefined
        )?.metadata_json || '{}',
      ) as Record<string, unknown>),
      ...payload.metadata,
      rcLastChangedAt: note.modifiedTime ?? note.creationTime,
    };

    this.db
      .prepare(
        `UPDATE messages_raw
         SET content = ?, metadata_json = ?, updated_at = ?, timestamp = ?
         WHERE id = ?`,
      )
      .run(
        payload.content,
        JSON.stringify(metadata),
        now(),
        payload.timestamp ?? now(),
        existing,
      );

    return { kind: 'updated', postId: note.postId, messageId: existing };
  }

  private revokePost(
    note: ParsedTeamMessagingNotification,
  ): Promise<WebhookProcessResult> {
    const existing = this.findMessageIdByPostId(note.postId, note.groupId);
    if (!existing) {
      return Promise.resolve({
        kind: 'ignored',
        postId: note.postId,
        reason: 'post_not_found',
      });
    }

    const row = this.db
      .prepare(`SELECT metadata_json FROM messages_raw WHERE id = ?`)
      .get(existing) as { metadata_json: string | null };
    const metadata = {
      ...(JSON.parse(row?.metadata_json || '{}') as Record<string, unknown>),
      accessRevoked: true,
      revokedAt: new Date().toISOString(),
      revokeReason: 'glip_post_removed',
      rcEventType: 'PostRemoved',
    };
    const ts = now();
    this.db
      .prepare(
        `UPDATE messages_raw SET metadata_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(metadata), ts, existing);

    this.db
      .prepare(
        `INSERT INTO memory_metadata
           (target_type, target_id, retrieval_tier, consolidation_level, archived_at,
            archive_reason, created_at, updated_at, lifecycle_updated_at)
         VALUES ('message', ?, 'archive_only', 'archived', ?, 'glip_post_removed', ?, ?, ?)
         ON CONFLICT(target_type, target_id) DO UPDATE SET
           retrieval_tier = 'archive_only',
           consolidation_level = 'archived',
           archived_at = excluded.archived_at,
           archive_reason = 'glip_post_removed',
           updated_at = excluded.updated_at,
           lifecycle_updated_at = excluded.lifecycle_updated_at`,
      )
      .run(existing, ts, ts, ts, ts);

    const chunkIds = this.db
      .prepare(`SELECT chunk_id FROM chunks WHERE related_entity_id = ?`)
      .all(existing) as Array<{ chunk_id: number }>;
    const downgrade = this.db.prepare(
      `INSERT INTO memory_metadata
         (target_type, target_id, retrieval_tier, consolidation_level, archived_at,
          archive_reason, created_at, updated_at, lifecycle_updated_at)
       VALUES ('chunk', ?, 'archive_only', 'archived', ?, 'glip_post_removed', ?, ?, ?)
       ON CONFLICT(target_type, target_id) DO UPDATE SET
         retrieval_tier = 'archive_only',
         consolidation_level = 'archived',
         archived_at = excluded.archived_at,
         archive_reason = 'glip_post_removed',
         updated_at = excluded.updated_at,
         lifecycle_updated_at = excluded.lifecycle_updated_at`,
    );
    for (const chunk of chunkIds) {
      downgrade.run(String(chunk.chunk_id), ts, ts, ts, ts);
    }

    return Promise.resolve({
      kind: 'revoked',
      postId: note.postId,
      messageId: existing,
    });
  }

  private findMessageIdByPostId(postId: string, groupId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT id FROM messages_raw
         WHERE source_type = 'glip'
           AND COALESCE(group_id, source, '') = ?
           AND json_extract(metadata_json, '$.postId') = ?
         LIMIT 1`,
      )
      .get(groupId, postId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  getRepository(): RingCentralWebhookRepository {
    return this.repo;
  }
}
