import { v4 as uuidv4 } from 'uuid';
import type BetterSqlite3 from 'better-sqlite3';

import type { MemoryScope } from '../types/index.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { chunkText } from '../utils/chunking.js';
import { contentHash } from '../utils/hashing.js';
import { now, formatDate } from '../utils/time.js';

export type SourceMemorySourceKind =
  | 'webpage'
  | 'visual_memory'
  | 'selection'
  | 'jira_comment'
  | 'message_reply'
  | 'web_ai_prompt'
  | 'manual';

export type SourceMemoryCaptureMode = 'auto' | 'suggested' | 'manual';
export type SourceMemoryPrivacyLevel =
  | 'private'
  | 'work'
  | 'shareable_summary'
  | 'needs_review';

export interface SourceMemoryInteractionSignals {
  dwellMs?: number;
  activeMs?: number;
  scrollDepth?: number;
  selectedText?: boolean;
  copiedText?: boolean;
  repeatVisit?: boolean;
  ownerAuthored?: boolean;
  manualClick?: boolean;
  openedFromMemory?: boolean;
}

export interface SourceMemoryCandidateInput {
  sourceKind?: SourceMemorySourceKind;
  sourceUrl?: string;
  sourceTitle?: string;
  text?: string;
  selectedText?: string;
  nearbyText?: string;
  entityHints?: Array<{ kind: string; value: string }>;
  interactions?: SourceMemoryInteractionSignals;
  scope?: MemoryScope;
  metadata?: Record<string, unknown>;
}

export interface SourceMemoryCandidateResult {
  eligible: boolean;
  score: number;
  suggestedAction: 'auto_save' | 'suggest' | 'ignore' | 'blocked';
  reasons: string[];
  blockedReason?: string;
  captureMode: SourceMemoryCaptureMode;
}

export interface SourceMemoryCreateInput extends SourceMemoryCandidateInput {
  captureMode?: SourceMemoryCaptureMode;
  captureReason?: string;
  note?: string;
  privacyLevel?: SourceMemoryPrivacyLevel;
  metadata?: Record<string, unknown>;
}

export interface SourceMemoryCapsule {
  id: string;
  sourceKind: string;
  sourceUrl?: string;
  sourceTitle: string;
  sourceHost?: string;
  captureMode: SourceMemoryCaptureMode;
  captureReason: string;
  status: string;
  scope: MemoryScope;
  privacyLevel: SourceMemoryPrivacyLevel;
  summary: string;
  contentPreview: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  savedAt?: number;
  duplicate?: boolean;
  anchors: SourceMemoryAnchor[];
  takeaways: SourceMemoryTakeaway[];
  triggers: SourceMemoryTrigger[];
}

interface SourceMemoryAnchor {
  id: string;
  anchorKind: string;
  locator?: string;
  quoteOrPreview: string;
  sensitivity: string;
  confidence: number;
}

interface SourceMemoryTakeaway {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceAnchorIds: string[];
  confidence: number;
  status: string;
}

interface SourceMemoryTrigger {
  id: string;
  triggerKind: string;
  description: string;
  matcher: Record<string, unknown>;
  defaultBehavior: string;
}

interface SourceMemoryRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  source_host: string | null;
  capture_mode: SourceMemoryCaptureMode;
  capture_reason: string;
  status: string;
  scope: MemoryScope;
  privacy_level: SourceMemoryPrivacyLevel;
  summary: string | null;
  content_preview: string | null;
  message_id: string | null;
  metadata_json: string | null;
  created_at: number;
  updated_at: number;
  saved_at: number | null;
}

interface SourceMemoryAnchorRow {
  id: string;
  anchor_kind: string;
  locator: string | null;
  quote_or_preview: string;
  sensitivity: string;
  confidence: number;
}

interface SourceMemoryTakeawayRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidence_anchor_ids_json: string;
  confidence: number;
  status: string;
}

interface SourceMemoryTriggerRow {
  id: string;
  trigger_kind: string;
  description: string;
  matcher_json: string;
  default_behavior: string;
}

export class SourceMemoryCaptureValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'SourceMemoryCaptureValidationError';
  }
}

const MAX_CAPTURE_TEXT_CHARS = 16_000;
const MAX_PREVIEW_CHARS = 900;
const MIN_SIGNAL_CHARS = 18;
const MIN_CJK_SIGNAL_CHARS = 8;
const AUTO_SAVE_THRESHOLD = 0.78;
const SUGGEST_THRESHOLD = 0.48;

const SECRET_PATTERN =
  /(?:-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|\b(?:sk|rk|pk|org|proj)-[A-Za-z0-9_-]{20,}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bxox[abprs]-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|(?:api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|client[_\s-]?secret|id[_\s-]?token|password|passcode|credential|credentials)\s*[:=]\s*['"]?[A-Za-z0-9._~+/=-]{8,})/i;

function getCaptureModeMessageImportance(captureMode: SourceMemoryCaptureMode): number {
  if (captureMode === 'manual') return 0.72;
  if (captureMode === 'auto') return 0.58;
  return 0.64;
}
const SENSITIVE_URL_PATTERN =
  /(?:^|[/?#._-])(login|sign[-_]?in|auth|oauth|password|reset[-_]?password|checkout|payment|billing|mfa|2fa|verification|verify|otp)(?:$|[/?#._-])/i;
const LOW_INFORMATION_PATTERN =
  /^(ok|yes|no|thanks|thank you|sure|好的|可以|收到|谢谢|测试|test|hello|hi)[.!。！\s]*$/i;
const SENTENCE_SPLIT_PATTERN = /(?<=[.!?。！？])\s+/;

export class SourceMemoryCaptureService {
  constructor(
    private readonly db: BetterSqlite3.Database,
    private readonly userDataManager?: UserDataManager | null,
  ) {}

  scoreCandidate(input: SourceMemoryCandidateInput): SourceMemoryCandidateResult {
    const text = this.getSignalText(input);
    const sourceUrl = normalizeUrl(input.sourceUrl);
    const sourceTitle = normalizeText(input.sourceTitle).slice(0, 240);
    const blockedReason = this.getBlockedReason(text, sourceUrl);

    if (blockedReason) {
      return {
        eligible: false,
        score: 0,
        suggestedAction: 'blocked',
        reasons: [],
        blockedReason,
        captureMode: 'suggested',
      };
    }

    if (!hasEnoughSignal(text)) {
      return {
        eligible: false,
        score: 0,
        suggestedAction: 'ignore',
        reasons: ['文本信息量不足'],
        captureMode: 'suggested',
      };
    }

    const reasons: string[] = [];
    let score = 0;

    const sourceKind = input.sourceKind ?? 'webpage';
    const interactions = input.interactions ?? {};
    if (sourceUrl) {
      score += 0.12;
      reasons.push('有来源 URL');
    }
    if (sourceTitle) {
      score += 0.08;
      reasons.push('有页面标题');
    }
    if (sourceKind !== 'webpage') {
      score += 0.06;
      reasons.push(`来源类型明确：${sourceKind}`);
    }

    const lengthScore = Math.min(0.2, text.length / 1200);
    score += lengthScore;
    if (text.length >= 120) reasons.push('文本片段足够完整');

    if (interactions.ownerAuthored) {
      score += 0.28;
      reasons.push('用户对外输入内容');
    }
    if (interactions.manualClick) {
      score += 0.22;
      reasons.push('用户主动点击记住');
    }
    if (input.selectedText || interactions.selectedText) {
      score += 0.16;
      reasons.push('用户选中了文本');
    }
    if (interactions.copiedText) {
      score += 0.12;
      reasons.push('用户复制了内容');
    }
    if ((interactions.dwellMs ?? 0) >= 90_000) {
      score += 0.1;
      reasons.push('停留时间较长');
    }
    if ((interactions.scrollDepth ?? 0) >= 0.6) {
      score += 0.08;
      reasons.push('阅读深度较高');
    }
    if (interactions.repeatVisit) {
      score += 0.08;
      reasons.push('重复访问');
    }
    if (interactions.openedFromMemory) {
      score += 0.06;
      reasons.push('从已有记忆进入');
    }
    if ((input.entityHints ?? []).length > 0) {
      score += Math.min(0.1, (input.entityHints ?? []).length * 0.03);
      reasons.push('命中页面实体线索');
    }

    score = roundScore(Math.min(1, score));
    const hasStrongIntent =
      interactions.ownerAuthored ||
      interactions.manualClick ||
      interactions.copiedText ||
      (Boolean(input.selectedText) && text.length >= 120);
    const suggestedAction =
      score >= AUTO_SAVE_THRESHOLD && hasStrongIntent
        ? 'auto_save'
        : score >= SUGGEST_THRESHOLD
          ? 'suggest'
          : 'ignore';

    return {
      eligible: suggestedAction !== 'ignore',
      score,
      suggestedAction,
      reasons,
      captureMode: suggestedAction === 'auto_save' ? 'auto' : 'suggested',
    };
  }

  createCapsule(input: SourceMemoryCreateInput): SourceMemoryCapsule {
    const candidate = this.scoreCandidate({
      ...input,
      interactions: {
        ...(input.interactions ?? {}),
        manualClick: input.captureMode === 'manual' || input.interactions?.manualClick,
      },
    });
    if (candidate.blockedReason) {
      throw new SourceMemoryCaptureValidationError(candidate.blockedReason);
    }

    const text = clipText(this.getSignalText(input), MAX_CAPTURE_TEXT_CHARS);
    if (!hasEnoughSignal(text)) {
      throw new SourceMemoryCaptureValidationError('Capture text is too short or low signal.');
    }

    const ts = now();
    const sourceUrl = normalizeUrl(input.sourceUrl);
    const sourceHost = sourceUrl ? getHost(sourceUrl) : null;
    const sourceTitle =
      normalizeText(input.sourceTitle).slice(0, 240) ||
      (sourceHost ? `网页资料 · ${sourceHost}` : '资料记忆');
    const sourceKind = input.sourceKind ?? (input.selectedText ? 'selection' : 'webpage');
    const captureMode = input.captureMode ?? candidate.captureMode;
    const captureReason =
      normalizeText(input.captureReason) ||
      candidate.reasons.slice(0, 3).join('；') ||
      '用户关注的资料内容';
    const scope = input.scope ?? 'work';
    const privacyLevel = input.privacyLevel ?? 'work';
    const note = normalizeText(input.note).slice(0, 800);
    const summary = note || summarizeText(text, sourceTitle);
    const contentPreview = clipText(text, MAX_PREVIEW_CHARS);
    const sourceFingerprint = contentHash(
      [
        sourceKind,
        sourceUrl || sourceTitle,
        normalizeText(input.selectedText || input.text || text).slice(0, 4000),
      ].join('\n'),
    );
    const fullContent = buildStoredContent({
      sourceTitle,
      note,
      summary,
      text,
      sourceUrl,
    });
    const metadata = {
      ...(input.metadata ?? {}),
      candidateScore: candidate.score,
      candidateReasons: candidate.reasons,
      captureMode,
      interactions: input.interactions ?? {},
      sourceHost,
      sourceKind,
    };

    const existing = this.findCapsuleByFingerprint(sourceFingerprint);
    if (existing) {
      if (existing.status === 'dismissed') {
        const messageId = existing.message_id || uuidv4();
        const transaction = this.db.transaction(() => {
          this.db
            .prepare(
              `UPDATE source_memory_capsules
               SET source_kind = ?,
                   source_url = ?,
                   source_title = ?,
                   source_host = ?,
                   status = 'saved',
                   capture_mode = ?,
                   capture_reason = ?,
                   scope = ?,
                   privacy_level = ?,
                   summary = ?,
                   content_preview = ?,
                   message_id = ?,
                   metadata_json = ?,
                   updated_at = ?,
                   saved_at = ?,
                   dismissed_at = NULL
               WHERE id = ?`,
            )
            .run(
              sourceKind,
              sourceUrl,
              sourceTitle,
              sourceHost,
              captureMode,
              captureReason,
              scope,
              privacyLevel,
              summary,
              contentPreview,
              messageId,
              JSON.stringify(metadata),
              ts,
              ts,
              existing.id,
            );
          this.removeLinkedMemorySignal(existing.message_id);
          this.insertMessageAndChunks({
            messageId,
            capsuleId: existing.id,
            content: fullContent,
            summary,
            scope,
            sourceUrl,
            sourceTitle,
            sourceHost,
            captureMode,
            metadata,
            ts,
          });
          this.insertEvent(existing.id, 'resaved', 'strong', sourceUrl, {
            captureMode,
            captureReason,
          });
        });
        transaction();
      } else {
        const existingMetadata = parseObject(existing.metadata_json ?? '{}');
        if (hasVisualMetadataUpgrade(existingMetadata, metadata)) {
          this.db
            .prepare(
              `UPDATE source_memory_capsules
               SET metadata_json = ?,
                   updated_at = ?
               WHERE id = ?`,
            )
            .run(JSON.stringify(metadata), ts, existing.id);
        }
        this.insertEvent(existing.id, 'duplicate_save', 'medium', sourceUrl, {
          captureMode,
          captureReason,
        });
      }
      return { ...this.getCapsule(existing.id), duplicate: true };
    }

    const capsuleId = uuidv4();
    const anchorId = uuidv4();
    const messageId = uuidv4();
    const anchorKind = sourceKind === 'visual_memory'
      ? 'visual_region'
      : input.selectedText
        ? 'text_selection'
        : 'page_excerpt';
    const takeaways = buildTakeaways(text, anchorId);
    const triggers = buildTriggers(sourceTitle, sourceUrl, input.entityHints);

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO source_memory_capsules (
             id, source_kind, source_url, source_title, source_host,
             source_fingerprint, capture_mode, capture_reason, status, scope,
             privacy_level, summary, content_preview, message_id, metadata_json,
             created_at, updated_at, saved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          capsuleId,
          sourceKind,
          sourceUrl,
          sourceTitle,
          sourceHost,
          sourceFingerprint,
          captureMode,
          captureReason,
          scope,
          privacyLevel,
          summary,
          contentPreview,
          messageId,
          JSON.stringify(metadata),
          ts,
          ts,
          ts,
        );

      this.db
        .prepare(
          `INSERT INTO source_memory_anchors (
             id, capsule_id, anchor_kind, locator, quote_or_preview,
             sensitivity, confidence, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          anchorId,
          capsuleId,
          anchorKind,
          sourceUrl,
          contentPreview,
          privacyLevel === 'needs_review' ? 'internal' : 'normal',
          0.78,
          ts,
        );

      const takeawayStmt = this.db.prepare(
        `INSERT INTO source_memory_takeaways (
           id, capsule_id, kind, title, body, evidence_anchor_ids_json,
           confidence, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      );
      for (const takeaway of takeaways) {
        takeawayStmt.run(
          takeaway.id,
          capsuleId,
          takeaway.kind,
          takeaway.title,
          takeaway.body,
          JSON.stringify(takeaway.evidenceAnchorIds),
          takeaway.confidence,
          ts,
        );
      }

      const triggerStmt = this.db.prepare(
        `INSERT INTO source_memory_triggers (
           id, capsule_id, trigger_kind, description, matcher_json,
           default_behavior, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const trigger of triggers) {
        triggerStmt.run(
          trigger.id,
          capsuleId,
          trigger.triggerKind,
          trigger.description,
          JSON.stringify(trigger.matcher),
          trigger.defaultBehavior,
          ts,
        );
      }

      this.insertMessageAndChunks({
        messageId,
        capsuleId,
        content: fullContent,
        summary,
        scope,
        sourceUrl,
        sourceTitle,
        sourceHost,
        captureMode,
        metadata,
        ts,
      });

      this.insertEvent(capsuleId, 'saved', captureMode === 'manual' ? 'strong' : 'medium', sourceUrl, {
        captureMode,
        captureReason,
      });
    });

    transaction();
    this.writeMarkdownSnapshot(capsuleId, fullContent, ts);

    return this.getCapsule(capsuleId);
  }

  updateCapsuleNote(id: string, note?: string): SourceMemoryCapsule {
    const existing = this.findCapsule(id);
    if (!existing) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }
    if (existing.status !== 'saved') {
      throw new SourceMemoryCaptureValidationError('Only saved source memory capsules can be annotated.');
    }

    const ts = now();
    const normalizedNote = normalizeText(note).slice(0, 800);
    const existingMessage = existing.message_id
      ? (this.db
          .prepare(`SELECT content FROM messages_raw WHERE id = ?`)
          .get(existing.message_id) as { content: string } | undefined)
      : undefined;
    const text = clipText(
      extractStoredEvidenceText(existingMessage?.content) ||
        existing.content_preview ||
        existing.source_title,
      MAX_CAPTURE_TEXT_CHARS,
    );
    const summary = normalizedNote || summarizeText(text, existing.source_title);
    const metadata = {
      ...parseObject(existing.metadata_json ?? '{}'),
      userNote: normalizedNote || undefined,
      noteUpdatedAt: ts,
    };
    const sourceUrl = existing.source_url ?? undefined;
    const fullContent = buildStoredContent({
      sourceTitle: existing.source_title,
      note: normalizedNote,
      summary,
      text,
      sourceUrl,
    });
    const messageId = existing.message_id || uuidv4();

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE source_memory_capsules
           SET summary = ?,
               message_id = ?,
               metadata_json = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(summary, messageId, JSON.stringify(metadata), ts, id);

      this.removeLinkedMemorySignal(existing.message_id);
      this.insertMessageAndChunks({
        messageId,
        capsuleId: id,
        content: fullContent,
        summary,
        scope: existing.scope,
        sourceUrl,
        sourceTitle: existing.source_title,
        sourceHost: existing.source_host,
        captureMode: existing.capture_mode,
        metadata,
        ts,
      });
      this.insertEvent(id, 'note_updated', 'medium', sourceUrl, {
        hasNote: Boolean(normalizedNote),
      });
    });

    transaction();
    this.writeMarkdownSnapshot(id, fullContent, ts);
    return this.getCapsule(id);
  }

  dismissCapsule(id: string, reason?: string): SourceMemoryCapsule {
    const ts = now();
    const existing = this.findCapsule(id);
    if (!existing) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE source_memory_capsules
           SET status = 'dismissed', updated_at = ?, dismissed_at = ?
           WHERE id = ?`,
        )
        .run(ts, ts, id);
      this.removeLinkedMemorySignal(existing.message_id);
      this.insertEvent(id, 'dismissed', 'strong', existing.source_url ?? undefined, {
        reason: normalizeText(reason).slice(0, 500),
      });
    });

    transaction();
    return this.getCapsule(id);
  }

  getCapsule(id: string): SourceMemoryCapsule {
    const row = this.findCapsule(id);
    if (!row) {
      throw new SourceMemoryCaptureValidationError('Source memory capsule not found.', 404);
    }

    const anchors = this.db
      .prepare(
        `SELECT id, anchor_kind, locator, quote_or_preview, sensitivity, confidence
         FROM source_memory_anchors
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryAnchorRow[];
    const takeaways = this.db
      .prepare(
        `SELECT id, kind, title, body, evidence_anchor_ids_json, confidence, status
         FROM source_memory_takeaways
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryTakeawayRow[];
    const triggers = this.db
      .prepare(
        `SELECT id, trigger_kind, description, matcher_json, default_behavior
         FROM source_memory_triggers
         WHERE capsule_id = ?
         ORDER BY created_at ASC`,
      )
      .all(id) as SourceMemoryTriggerRow[];

    return {
      id: row.id,
      sourceKind: row.source_kind,
      sourceUrl: row.source_url ?? undefined,
      sourceTitle: row.source_title,
      sourceHost: row.source_host ?? undefined,
      captureMode: row.capture_mode,
      captureReason: row.capture_reason,
      status: row.status,
      scope: row.scope,
      privacyLevel: row.privacy_level,
      summary: row.summary ?? '',
      contentPreview: row.content_preview ?? '',
      messageId: row.message_id ?? undefined,
      metadata: parseObject(row.metadata_json ?? '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      savedAt: row.saved_at ?? undefined,
      anchors: anchors.map((anchor) => ({
        id: anchor.id,
        anchorKind: anchor.anchor_kind,
        locator: anchor.locator ?? undefined,
        quoteOrPreview: anchor.quote_or_preview,
        sensitivity: anchor.sensitivity,
        confidence: anchor.confidence,
      })),
      takeaways: takeaways.map((takeaway) => ({
        id: takeaway.id,
        kind: takeaway.kind,
        title: takeaway.title,
        body: takeaway.body,
        evidenceAnchorIds: parseStringArray(takeaway.evidence_anchor_ids_json),
        confidence: takeaway.confidence,
        status: takeaway.status,
      })),
      triggers: triggers.map((trigger) => ({
        id: trigger.id,
        triggerKind: trigger.trigger_kind,
        description: trigger.description,
        matcher: parseObject(trigger.matcher_json),
        defaultBehavior: trigger.default_behavior,
      })),
    };
  }

  private insertMessageAndChunks(input: {
    messageId: string;
    capsuleId: string;
    content: string;
    summary: string;
    scope: MemoryScope;
    sourceUrl?: string;
    sourceTitle: string;
    sourceHost: string | null;
    captureMode: SourceMemoryCaptureMode;
    metadata: Record<string, unknown>;
    ts: number;
  }): void {
    const messageImportance = getCaptureModeMessageImportance(input.captureMode);
    const chunkImportance = Math.max(0.45, messageImportance - 0.04);
    this.db
      .prepare(
        `INSERT INTO messages_raw (
           id, content, summary, scope, source, source_type, source_url,
           source_title, sender, group_id, group_name, timestamp,
           importance, sentiment, metadata_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'web', ?, ?, ?, ?, ?, ?, ?, 'neutral', ?, ?, ?)`,
      )
      .run(
        input.messageId,
        input.content,
        input.summary,
        input.scope,
        `source-memory:${input.capsuleId}`,
        input.sourceUrl ?? null,
        input.sourceTitle,
        'Memory Capture',
        input.sourceHost,
        input.sourceHost,
        input.ts,
        messageImportance,
        JSON.stringify({
          ...input.metadata,
          sourceMemoryCapsuleId: input.capsuleId,
          captureLayer: 'memory_capture',
        }),
        input.ts,
        input.ts,
      );

    const chunks = chunkText(input.content, 220, 40);
    const chunkStmt = this.db.prepare(
      `INSERT INTO chunks (
         file_path, line_start, line_end, content, content_hash, scope, source,
         source_type, related_entity_id, token_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?, ?, ?, ?)`,
    );
    const metadataStmt = this.db.prepare(
      `INSERT INTO memory_metadata (
         target_type, target_id, salience_score, importance,
         consolidation_level, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(target_type, target_id) DO UPDATE SET
         salience_score = excluded.salience_score,
         importance = excluded.importance,
         consolidation_level = excluded.consolidation_level,
         updated_at = excluded.updated_at`,
    );

    metadataStmt.run('message', input.messageId, messageImportance, messageImportance, 'working', input.ts, input.ts);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const result = chunkStmt.run(
        `source-memory/${input.capsuleId}.md`,
        chunk.lineStart,
        chunk.lineEnd,
        chunk.content,
        contentHash(`${input.capsuleId}:${index}:${chunk.content}`),
        input.scope,
        `source-memory:${input.capsuleId}`,
        input.messageId,
        chunk.tokenCount,
        input.ts,
        input.ts,
      );
      metadataStmt.run('chunk', String(result.lastInsertRowid), chunkImportance, chunkImportance, 'working', input.ts, input.ts);
    }
  }

  private removeLinkedMemorySignal(messageId?: string | null): void {
    const normalizedMessageId = normalizeText(messageId);
    if (!normalizedMessageId) return;

    const chunkRows = this.db
      .prepare(`SELECT chunk_id FROM chunks WHERE related_entity_id = ?`)
      .all(normalizedMessageId) as Array<{ chunk_id: number }>;
    const chunkIds = chunkRows.map((row) => String(row.chunk_id));

    this.db
      .prepare(`DELETE FROM memory_metadata WHERE target_type = 'message' AND target_id = ?`)
      .run(normalizedMessageId);

    const deleteChunkMetadata = this.db.prepare(
      `DELETE FROM memory_metadata WHERE target_type = 'chunk' AND target_id = ?`,
    );
    for (const chunkId of chunkIds) {
      deleteChunkMetadata.run(chunkId);
    }

    this.db.prepare(`DELETE FROM chunks WHERE related_entity_id = ?`).run(normalizedMessageId);
    this.db.prepare(`DELETE FROM messages_raw WHERE id = ?`).run(normalizedMessageId);
  }

  private insertEvent(
    capsuleId: string | null,
    eventType: string,
    eventStrength: string,
    sourceUrl?: string | null,
    metadata: Record<string, unknown> = {},
  ): void {
    this.db
      .prepare(
        `INSERT INTO source_memory_events (
           id, capsule_id, event_type, event_strength, source_url,
           metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        capsuleId,
        eventType,
        eventStrength,
        sourceUrl ?? null,
        JSON.stringify(metadata),
        now(),
      );
  }

  private writeMarkdownSnapshot(capsuleId: string, content: string, ts: number): void {
    try {
      if (!this.userDataManager?.isInitialized) return;
      const dateStr = formatDate(ts);
      this.userDataManager.appendToFile(
        `daily/${dateStr}.md`,
        `\n\n## Memory Capture\n\n${content}\n`,
        `# Daily Log — ${dateStr}\n\n`,
      );
      this.userDataManager.writeFile(`source-memory/${capsuleId}.md`, content);
    } catch (err) {
      console.warn('[SourceMemoryCaptureService] Markdown snapshot skipped:', err);
    }
  }

  private getSignalText(input: SourceMemoryCandidateInput): string {
    return clipText(
      normalizeText(
        input.selectedText ||
          input.text ||
          [input.sourceTitle, input.nearbyText].filter(Boolean).join('\n'),
      ),
      MAX_CAPTURE_TEXT_CHARS,
    );
  }

  private getBlockedReason(text: string, sourceUrl?: string): string | undefined {
    if (sourceUrl && SENSITIVE_URL_PATTERN.test(sourceUrl)) {
      return 'Sensitive URL is not eligible for Memory Capture.';
    }
    if (SECRET_PATTERN.test(text)) {
      return 'Selected text appears to contain secrets or credentials.';
    }
    if (LOW_INFORMATION_PATTERN.test(text)) {
      return 'Selected text is too low-signal for Memory Capture.';
    }
    return undefined;
  }

  private findCapsule(id: string): SourceMemoryRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, source_kind, source_url, source_title, source_host,
                  capture_mode, capture_reason, status, scope, privacy_level,
                  summary, content_preview, message_id, metadata_json,
                  created_at, updated_at, saved_at
           FROM source_memory_capsules
           WHERE id = ?`,
        )
        .get(id) as SourceMemoryRow | undefined) ?? null
    );
  }

  private findCapsuleByFingerprint(fingerprint: string): SourceMemoryRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, source_kind, source_url, source_title, source_host,
                  capture_mode, capture_reason, status, scope, privacy_level,
                  summary, content_preview, message_id, metadata_json,
                  created_at, updated_at, saved_at
           FROM source_memory_capsules
           WHERE source_fingerprint = ?`,
        )
        .get(fingerprint) as SourceMemoryRow | undefined) ?? null
    );
  }
}

function buildStoredContent(input: {
  sourceTitle: string;
  note: string;
  summary: string;
  text: string;
  sourceUrl?: string;
}): string {
  const lines = [`# ${input.sourceTitle}`, '', `Summary: ${input.summary}`];
  if (input.note) {
    lines.push('', `User note: ${input.note}`);
  }
  if (input.sourceUrl) {
    lines.push('', `Source: ${input.sourceUrl}`);
  }
  lines.push('', '## Evidence', '', input.text);
  return lines.join('\n');
}

function extractStoredEvidenceText(content?: string | null): string {
  const raw = content || '';
  const marker = '\n## Evidence\n';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    return normalizeText(raw);
  }
  return raw.slice(markerIndex + marker.length).trim();
}

function buildTakeaways(text: string, anchorId: string): SourceMemoryTakeaway[] {
  const sentences = normalizeText(text)
    .split(SENTENCE_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter((item) => item.length >= 18)
    .slice(0, 3);
  const seed = sentences.length > 0 ? sentences : [clipText(text, 220)];

  return seed.map((sentence, index) => ({
    id: uuidv4(),
    kind: inferTakeawayKind(sentence),
    title: clipText(sentence, 64),
    body: clipText(sentence, 320),
    evidenceAnchorIds: [anchorId],
    confidence: 0.62 - index * 0.04,
    status: 'draft',
  }));
}

function buildTriggers(
  sourceTitle: string,
  sourceUrl?: string,
  entityHints?: Array<{ kind: string; value: string }>,
): SourceMemoryTrigger[] {
  const triggers: SourceMemoryTrigger[] = [];
  const host = sourceUrl ? getHost(sourceUrl) : '';
  if (host) {
    triggers.push({
      id: uuidv4(),
      triggerKind: 'source',
      description: `再次遇到 ${host} 相关资料时安静匹配`,
      matcher: { host },
      defaultBehavior: 'quiet_match',
    });
  }
  for (const hint of (entityHints ?? []).slice(0, 4)) {
    const value = normalizeText(hint.value);
    if (!value) continue;
    triggers.push({
      id: uuidv4(),
      triggerKind: 'entity',
      description: `遇到 ${value} 时可关联这份资料`,
      matcher: { kind: hint.kind, value },
      defaultBehavior: 'quiet_match',
    });
  }
  if (triggers.length === 0) {
    triggers.push({
      id: uuidv4(),
      triggerKind: 'search',
      description: `搜索 ${clipText(sourceTitle, 60)} 时召回`,
      matcher: { title: sourceTitle },
      defaultBehavior: 'quiet_match',
    });
  }
  return triggers;
}

function inferTakeawayKind(text: string): string {
  if (/risk|风险|block|阻塞|issue|问题/i.test(text)) return 'risk';
  if (/workflow|流程|步骤|how to|怎么|如何/i.test(text)) return 'workflow';
  if (/decision|决定|结论|approved|确认/i.test(text)) return 'decision_input';
  if (/tool|capability|能力|工具|feature|功能/i.test(text)) return 'tool_capability';
  return 'concept';
}

function hasEnoughSignal(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length >= MIN_SIGNAL_CHARS && /[A-Za-z0-9]/.test(normalized)) {
    return true;
  }
  const cjkCount = (normalized.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjkCount >= MIN_CJK_SIGNAL_CHARS;
}

function summarizeText(text: string, fallbackTitle: string): string {
  const firstSentence = normalizeText(text).split(SENTENCE_SPLIT_PATTERN)[0] ?? '';
  return clipText(firstSentence || fallbackTitle, 180);
}

function normalizeText(text?: string | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function clipText(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 1))}…`
    : normalized;
}

function normalizeUrl(value?: string): string | undefined {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function getHost(sourceUrl?: string): string {
  if (!sourceUrl) return '';
  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

function parseStringArray(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasVisualMetadataUpgrade(
  existingMetadata: Record<string, unknown>,
  nextMetadata: Record<string, unknown>,
): boolean {
  const existingVisual = asRecord(existingMetadata.visualMemory);
  const nextVisual = asRecord(nextMetadata.visualMemory);
  if (!Object.keys(nextVisual).length) {
    return false;
  }

  const existingSvg = asRecord(existingVisual.svg);
  const nextSvg = asRecord(nextVisual.svg);
  if (!existingSvg.markup && typeof nextSvg.markup === 'string' && nextSvg.markup.trim()) {
    return true;
  }

  const existingTable = asRecord(existingVisual.table);
  const nextTable = asRecord(nextVisual.table);
  if (
    !Array.isArray(existingTable.rows) &&
    Array.isArray(nextTable.rows) &&
    nextTable.rows.length > 0
  ) {
    return true;
  }

  return false;
}
