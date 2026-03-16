/**
 * Ingestion pipeline — Phase 2.
 *
 * Flow:
 *   1. Accept IngestPayload
 *   2. Dedup check (content + source_type + sender)
 *   3. LLM entity extraction (entities, importance, sentiment, summary)
 *   4. Compute salience score via SalienceScorer
 *   5. Store in messages_raw (with extracted entities, importance, sentiment, summary)
 *   6. Generate embedding -> store in messages_vec
 *   7. If salience >= 0.3: create entities, relationships, chunks, memory_metadata
 *   8. Match against watched_projects
 *   9. Append to daily markdown log
 *  10. Return IngestResult
 */

import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

import type { IngestPayload, IngestResult, EntityType, ProfileCandidate } from '../types/index.js';
import { SalienceScorer } from './SalienceScorer.js';
import { TruthMaintainer } from './TruthMaintainer.js';
import { getLLMClient } from '../llm/LLMClient.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { chunkText } from '../utils/chunking.js';
import { contentHash } from '../utils/hashing.js';
import { normalizeContentForDedup } from '../utils/contentNormalize.js';
import { toSlug } from '../utils/slug.js';
import { now, formatDate } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by the LLM entity-extraction prompt. */
interface LLMExtraction {
  entities: {
    people: string[];
    projects: string[];
    topics: string[];
    technologies: string[];
    organizations: string[];
  };
  properties?: Array<{
    entity_name: string;
    entity_type: string;
    key: string;
    value: string;
    action_type: string;
    confidence: number;
    context: string;
  }>;
  importance: number;
  sentiment: string;
  summary: string;
  is_decision: boolean;
  is_action_item: boolean;
  profile_candidates?: Array<{
    item_type: string;
    item_key: string;
    item_value: string;
  }>;
  profileCandidates?: ProfileCandidate[];
}

/** Entity type label to EntityType mapping. */
const ENTITY_CATEGORY_MAP: Record<string, EntityType> = {
  people: 'Person',
  projects: 'Project',
  topics: 'Topic',
  technologies: 'Technology',
  organizations: 'Organization',
};

/** Salience threshold — entities and chunks are only created above this value. */
const STORAGE_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// IngestionPipeline
// ---------------------------------------------------------------------------

export class IngestionPipeline {
  private db: Database.Database;
  private scorer: SalienceScorer;
  private truthMaintainer: TruthMaintainer;
  private userDataManager?: UserDataManager;

  constructor(db: Database.Database, userDataManager?: UserDataManager, userId?: string) {
    this.db = db;
    this.userDataManager = userDataManager;
    this.scorer = new SalienceScorer(db);
    this.truthMaintainer = new TruthMaintainer(db, userId);
  }

  /**
   * Ingest a single payload through the full pipeline.
   */
  async ingest(payload: IngestPayload): Promise<IngestResult> {
    const id = uuidv4();
    let ts = payload.timestamp ?? now();
    // Normalize: if timestamp > 1e12, treat as milliseconds (JS Date.getTime())
    if (ts > 1e12) {
      ts = Math.floor(ts / 1000);
    }

    // ---- 1. Dedup check ----
    const postId = payload.metadata?.postId != null ? String(payload.metadata.postId) : null;
    let existing: { id: string } | undefined;

    if (postId) {
      // Glip 等有 post_id 的消息：直接用 post_id 去重
      existing = this.db
        .prepare(
          `SELECT id FROM messages_raw
           WHERE source_type = ? AND json_extract(metadata_json, '$.postId') = ?
           LIMIT 1`,
        )
        .get(payload.sourceType, postId) as { id: string } | undefined;
    } else {
      // 无 post_id 时回退到 content + source_type + sender
      const contentNormalized = normalizeContentForDedup(payload.content);
      existing = this.db
        .prepare(
          `SELECT id FROM messages_raw
           WHERE content = ? AND source_type = ? AND sender = ?
           LIMIT 1`,
        )
        .get(contentNormalized, payload.sourceType, payload.sender ?? null) as
        | { id: string }
        | undefined;
    }

    if (existing) {
      return { id: existing.id, status: 'duplicate' };
    }

    const contentNormalized = postId
      ? payload.content
      : normalizeContentForDedup(payload.content);

    // ---- 2. LLM entity extraction (non-blocking on failure) ----
    let extraction: LLMExtraction | null = null;
    const skip = payload.skipExtraction === true;

    if (!skip) {
      try {
        extraction = await this.extractEntities(
          { ...payload, content: contentNormalized },
          ts,
        );
      } catch (err) {
        console.warn(
          '[IngestionPipeline] LLM extraction failed, proceeding without entities:',
          (err as Error).message,
        );
      }
    }

    const importance = extraction?.importance ?? (payload.metadata?.importance ?? 0.5);
    const sentiment = extraction?.sentiment ?? (payload.metadata?.sentiment ?? 'neutral');
    const summary = extraction?.summary ?? (payload.metadata?.summary ?? null);

    // Build entities array for the messages_raw JSON column
    const entitiesList = extraction ? this.flattenEntities(extraction) : [];

    // ---- 3. Compute salience score ----
    let salienceScore = 0.5;
    if (!skip) {
      try {
        const salienceResult = await this.scorer.scoreMessage(
          contentNormalized,
          importance,
          sentiment,
          ts,
        );
        salienceScore = salienceResult.score;
      } catch (err) {
        console.warn(
          '[IngestionPipeline] Salience scoring failed, using default:',
          (err as Error).message,
        );
      }
    }

    // ---- 4. Store in messages_raw ----
    try {
      this.db
        .prepare(
          `INSERT INTO messages_raw
            (id, content, summary, source_type, source_url, source_title,
             sender, group_id, group_name, timestamp,
             entities_json, matched_projects_json,
             importance, sentiment, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          contentNormalized,
          summary,
          payload.sourceType,
          payload.sourceUrl ?? null,
          payload.sourceTitle ?? null,
          payload.sender ?? null,
          payload.groupId ?? null,
          payload.groupName ?? null,
          ts,
          entitiesList.length > 0 ? JSON.stringify(entitiesList) : null,
          null, // matched_projects_json — filled below
          importance,
          sentiment,
          payload.metadata ? JSON.stringify(payload.metadata) : null,
          now(),
        );
    } catch (err) {
      console.error('[IngestionPipeline] Failed to insert message:', err);
      return { id, status: 'error' };
    }

    // ---- 5. Generate embedding & store in messages_vec ----
    try {
      const client = await EmbeddingClient.getInstance();
      const embedding = await client.embed(contentNormalized);
      this.db
        .prepare(
          `INSERT INTO messages_vec (message_id, embedding)
           VALUES (?, ?)`,
        )
        .run(id, JSON.stringify(embedding));
    } catch (err) {
      console.warn(
        '[IngestionPipeline] Embedding skipped (model may not be loaded):',
        (err as Error).message,
      );
    }

    // ---- 6. High-salience processing: entities, relationships, chunks ----
    if (salienceScore >= STORAGE_THRESHOLD && extraction) {
      try {
        this.processEntities(extraction, id, ts);
      } catch (err) {
        console.warn(
          '[IngestionPipeline] Entity processing failed:',
          (err as Error).message,
        );
      }

      try {
        this.processChunks(contentNormalized, id, payload.sourceType, ts);
      } catch (err) {
        console.warn(
          '[IngestionPipeline] Chunk processing failed:',
          (err as Error).message,
        );
      }

      try {
        this.scorer.ensureMetadata('message', id, salienceScore);
      } catch (err) {
        console.warn(
          '[IngestionPipeline] Metadata update failed:',
          (err as Error).message,
        );
      }
    }

    // ---- 6b. Profile candidate extraction ----
    if (extraction?.profileCandidates?.length) {
      try {
        this.processProfileCandidates(extraction.profileCandidates, id, ts);
      } catch (err) {
        console.warn('[IngestionPipeline] Profile extraction failed:', (err as Error).message);
      }
    }

    // ---- 6c. Opinion candidate extraction from sentiment-laden messages ----
    if (extraction) {
      try {
        this.processOpinionCandidates(extraction, id, ts);
      } catch (err) {
        console.warn('[IngestionPipeline] Opinion extraction failed:', (err as Error).message);
      }
    }

    // ---- 7. Match against watched_projects ----
    let matchedProjects: string[] = [];
    try {
      matchedProjects = this.matchWatchedProjects(contentNormalized, entitiesList);
      if (matchedProjects.length > 0) {
        this.db
          .prepare(
            `UPDATE messages_raw SET matched_projects_json = ? WHERE id = ?`,
          )
          .run(JSON.stringify(matchedProjects), id);
      }
    } catch (err) {
      console.warn(
        '[IngestionPipeline] Watched project matching failed:',
        (err as Error).message,
      );
    }

    // ---- 8. Append to daily markdown log ----
    try {
      const udm = this.userDataManager;
      if (udm?.isInitialized) {
        const dateStr = formatDate(ts);
        const logPath = udm.getDailyLogPath(new Date(ts * 1000));
        const header = `# Daily Log — ${dateStr}\n\n`;
        const time = new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
        const sender = payload.sender ?? 'unknown';
        const group = payload.groupName ? ` in ${payload.groupName}` : '';
        const line = `- **${time}** [${sender}${group}]: ${summary ?? contentNormalized.slice(0, 200)}\n`;
        udm.appendToFile(logPath, line, header);
      }
    } catch (err) {
      console.warn(
        '[IngestionPipeline] Daily log append failed:',
        (err as Error).message,
      );
    }

    // ---- 9. Return result ----
    return {
      id,
      status: 'created',
      entitiesExtracted: entitiesList.length,
      matchedProjects,
    };
  }

  // ---- Private helpers ----------------------------------------------------

  /**
   * Call the LLM to extract structured entity information from the payload.
   */
  private async extractEntities(
    payload: IngestPayload,
    ts: number,
  ): Promise<LLMExtraction> {
    const llm = getLLMClient();

    const prompt = `Given the following message content and context, extract structured information.

Message: "${payload.content}"
Sender: ${payload.sender ?? 'unknown'}
Group: ${payload.groupName ?? 'unknown'}
Time: ${new Date(ts * 1000).toISOString()}

Return JSON:
{
  "entities": {
    "people": ["name1", "name2"],
    "projects": ["project name"],
    "topics": ["topic"],
    "technologies": ["tech term"],
    "organizations": ["org name"]
  },
  "properties": [
    {
      "entity_name": "name",
      "entity_type": "Project",
      "key": "property_name",
      "value": "property_value",
      "action_type": "set",
      "confidence": 0.8,
      "context": "why this property was extracted"
    }
  ],
  "importance": 0.7,
  "sentiment": "neutral",
  "summary": "one-line summary",
  "is_decision": false,
  "is_action_item": false,
  "profile_candidates": [
    {"item_type": "interest|preference|fact|habit", "item_key": "string", "item_value": "string"}
  ]
}

Rules:
- importance is 0-1 (0 = trivial chat, 1 = critical decision)
- sentiment is one of: positive, negative, neutral, mixed
- Only include entities that are clearly referenced
- profile_candidates: extract any personal traits, preferences, facts, habits, or interests about the sender
  - item_type must be one of: interest, preference, fact, habit
  - Examples:
    - Timezone mentioned → {"item_type": "fact", "item_key": "timezone", "item_value": "GMT+8"}
    - User focuses on a project → {"item_type": "interest", "item_key": "focus_project", "item_value": "Apollo"}
    - Communication preference → {"item_type": "preference", "item_key": "communication_style", "item_value": "async"}
  - Only include profile_candidates when there is clear evidence in the message
- Return ONLY valid JSON, no extra text`;

    const raw = await llm.generateJSON<LLMExtraction>(prompt, {
      temperature: 0.2,
      maxTokens: 1500,
      systemPrompt: 'You are an entity extraction assistant. Return only valid JSON.',
    });

    // Map snake_case profile_candidates from LLM to camelCase profileCandidates
    if (raw.profile_candidates && raw.profile_candidates.length > 0) {
      raw.profileCandidates = raw.profile_candidates.map((pc) => ({
        itemType: pc.item_type as ProfileCandidate['itemType'],
        itemKey: pc.item_key,
        itemValue: pc.item_value,
      }));
    }

    return raw;
  }

  /**
   * Flatten the categorized entities from the LLM extraction into a
   * uniform array of { type, name } objects.
   */
  private flattenEntities(
    extraction: LLMExtraction,
  ): Array<{ type: EntityType; name: string }> {
    const result: Array<{ type: EntityType; name: string }> = [];

    for (const [category, names] of Object.entries(extraction.entities)) {
      const entityType = ENTITY_CATEGORY_MAP[category];
      if (!entityType || !Array.isArray(names)) continue;

      for (const name of names) {
        if (typeof name === 'string' && name.trim().length > 0) {
          result.push({ type: entityType, name: name.trim() });
        }
      }
    }

    return result;
  }

  /**
   * Create or update entities in the database, and create relationships
   * between co-occurring entities.
   */
  private processEntities(
    extraction: LLMExtraction,
    messageId: string,
    ts: number,
  ): void {
    const entitiesList = this.flattenEntities(extraction);
    const entityIds: string[] = [];

    for (const entity of entitiesList) {
      const slug = toSlug(entity.name);
      const entityId = `${entity.type.toLowerCase()}_${slug}`;

      // Check if entity exists by id or by name (case-insensitive)
      const existing = this.db
        .prepare(
          `SELECT id, mention_count FROM entities
           WHERE id = ? OR (LOWER(name) = LOWER(?) AND type = ?)
           LIMIT 1`,
        )
        .get(entityId, entity.name, entity.type) as
        | { id: string; mention_count: number }
        | undefined;

      if (existing) {
        // Update existing entity
        this.db
          .prepare(
            `UPDATE entities
             SET last_seen = ?,
                 mention_count = mention_count + 1,
                 updated_at = ?
             WHERE id = ?`,
          )
          .run(ts, now(), existing.id);
        entityIds.push(existing.id);
      } else {
        // Insert new entity
        this.db
          .prepare(
            `INSERT INTO entities
              (id, type, name, importance, access_count, first_seen, last_seen,
               mention_count, status, created_at, updated_at)
             VALUES (?, ?, ?, 0.5, 0, ?, ?, 1, 'active', ?, ?)`,
          )
          .run(entityId, entity.type, entity.name, ts, ts, now(), now());
        entityIds.push(entityId);
      }
    }

    // Create relationships between co-occurring entities
    if (entityIds.length >= 2) {
      for (let i = 0; i < entityIds.length; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          this.upsertRelationship(entityIds[i], entityIds[j], 'co_occurs', messageId, ts);
        }
      }
    }

    // Process extracted properties
    if (extraction.properties && extraction.properties.length > 0) {
      for (const prop of extraction.properties) {
        const slug = toSlug(prop.entity_name);
        const entityId = `${prop.entity_type.toLowerCase()}_${slug}`;

        try {
          this.db
            .prepare(
              `INSERT INTO entity_properties
                (entity_id, property_key, property_value, value_type,
                 source_message_id, source_authority, source_context,
                 tx_start, confidence, status, action_type)
               VALUES (?, ?, ?, 'string', ?, 'inferred', ?, ?, ?, 'active', ?)`,
            )
            .run(
              entityId,
              prop.key,
              prop.value,
              messageId,
              prop.context,
              now(),
              prop.confidence,
              prop.action_type,
            );
        } catch (err) {
          // Entity may not exist yet if it came from properties but not entities list
          console.warn(
            `[IngestionPipeline] Property insert failed for ${entityId}:`,
            (err as Error).message,
          );
        }
      }
    }
  }

  /**
   * Process profile candidates extracted by the LLM.
   * For each candidate, either insert a new user_profile_items row or
   * reinforce an existing one (bump mention_count, recalculate salience).
   */
  private processProfileCandidates(
    candidates: ProfileCandidate[],
    messageId: string,
    timestamp: number,
  ): void {
    for (const candidate of candidates) {
      const key = candidate.itemKey;
      const value = candidate.itemValue.toLowerCase().trim();
      const fingerprint = contentHash(key + ':' + value);
      const confidence = candidate.confidence ?? 0.6;

      const existing = this.db
        .prepare(
          `SELECT id, mention_count, evidence_refs_json, salience_score
           FROM user_profile_items
           WHERE fingerprint = ?
           LIMIT 1`,
        )
        .get(fingerprint) as
        | { id: string; mention_count: number; evidence_refs_json: string | null; salience_score: number }
        | undefined;

      if (existing) {
        // Reinforce existing profile item
        const newMentionCount = existing.mention_count + 1;
        const evidenceRefs: Array<{ messageId: string; ts: number }> = existing.evidence_refs_json
          ? JSON.parse(existing.evidence_refs_json)
          : [];
        evidenceRefs.push({ messageId, ts: timestamp });

        // Recalculate salience with updated frequency and recency
        const frequencyNorm = Math.min(newMentionCount / 10, 1.0);
        const recency = 1.0; // just seen
        const confirmationBonus = 0.1; // reinforced at least once
        const salience =
          0.4 * confidence +
          0.3 * frequencyNorm +
          0.2 * recency +
          0.1 * confirmationBonus;

        this.db
          .prepare(
            `UPDATE user_profile_items
             SET mention_count = ?,
                 last_seen = ?,
                 salience_score = ?,
                 evidence_refs_json = ?,
                 updated_at = ?
             WHERE id = ?`,
          )
          .run(
            newMentionCount,
            timestamp,
            salience,
            JSON.stringify(evidenceRefs),
            now(),
            existing.id,
          );
      } else {
        // Before inserting, check for conflicts with existing items sharing the same key
        const conflictRequest = this.truthMaintainer.detectProfileConflict(
          { itemKey: key, itemValue: candidate.itemValue, confidence },
          this.db,
        );

        // Insert new profile item
        const id = uuidv4();
        const frequencyNorm = 1 / 10; // first mention
        const recency = 1.0;
        const confirmationBonus = 0;
        const salience =
          0.4 * confidence +
          0.3 * frequencyNorm +
          0.2 * recency +
          0.1 * confirmationBonus;

        const evidenceRefs = JSON.stringify([{ messageId, ts: timestamp }]);

        // If a conflict was detected, insert as pending_confirm instead of active
        const status = conflictRequest ? 'pending_confirm' : 'active';

        this.db
          .prepare(
            `INSERT INTO user_profile_items
              (id, item_type, item_key, item_value, fingerprint,
               source_kind, confidence, salience_score,
               mention_count, last_seen, evidence_refs_json,
               user_confirmed, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'inferred', ?, ?, 1, ?, ?, 0, ?, ?, ?)`,
          )
          .run(
            id,
            candidate.itemType,
            key,
            candidate.itemValue,
            fingerprint,
            confidence,
            salience,
            timestamp,
            evidenceRefs,
            status,
            now(),
            now(),
          );
      }

      // Mark profile as dirty so snapshot rebuild picks it up
      try {
        this.db
          .prepare(
            `UPDATE profile_sync_state SET profile_dirty = 1`,
          )
          .run();
      } catch {
        // Table may not exist yet — safe to ignore
      }
    }
  }

  /**
   * Detect sentiment-laden statements about people and create opinion_items.
   *
   * When the extracted sentiment is not 'neutral' and the extraction includes
   * Person entities, we insert an opinion_item with status 'pending_confirm'
   * so the user can accept or reject the inferred opinion.
   */
  private processOpinionCandidates(
    extraction: LLMExtraction,
    messageId: string,
    timestamp: number,
  ): void {
    // Only process when sentiment is clearly non-neutral
    const sentiment = extraction.sentiment;
    if (!sentiment || sentiment === 'neutral') return;

    const people = extraction.entities?.people;
    if (!people || people.length === 0) return;

    // Map sentiment to dimension and valence
    const isPositive = sentiment === 'positive';
    const isNegative = sentiment === 'negative';
    // 'mixed' sentiment is ambiguous — skip creating opinion items for it
    if (!isPositive && !isNegative) return;

    const dimension = isPositive ? 'trust' : 'risk';
    const valence = isPositive ? 0.5 : -0.5;

    for (const personName of people) {
      if (typeof personName !== 'string' || personName.trim().length === 0) continue;

      const slug = toSlug(personName);
      const targetEntityId = `person_${slug}`;

      // Check if the entity actually exists in our graph
      const entityExists = this.db
        .prepare(`SELECT id FROM entities WHERE id = ? LIMIT 1`)
        .get(targetEntityId) as { id: string } | undefined;

      if (!entityExists) continue;

      // Check for duplicate opinion: same target + dimension + pending
      const existingOpinion = this.db
        .prepare(
          `SELECT id FROM opinion_items
           WHERE target_entity_id = ? AND dimension = ? AND status = 'pending_confirm'
           LIMIT 1`,
        )
        .get(targetEntityId, dimension) as { id: string } | undefined;

      if (existingOpinion) continue; // Avoid spamming duplicate pending opinions

      const id = uuidv4();
      const evidenceRefs = JSON.stringify([{ messageId, ts: timestamp }]);
      const rationale = `Inferred from ${sentiment} sentiment in message about ${personName}`;
      const currentTime = now();

      this.db
        .prepare(
          `INSERT INTO opinion_items
            (id, target_entity_id, dimension, valence, intensity,
             rationale, evidence_refs, confidence, user_confirmed,
             status, valid_from, valid_to, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0.5, ?, ?, 0.4, 0, 'pending_confirm', ?, NULL, ?, ?)`,
        )
        .run(
          id,
          targetEntityId,
          dimension,
          valence,
          rationale,
          evidenceRefs,
          timestamp,
          currentTime,
          currentTime,
        );
    }
  }

  /**
   * Upsert a relationship between two entities.
   * If the relationship already exists, increment co_occurrence_count.
   */
  private upsertRelationship(
    fromId: string,
    toId: string,
    relationType: string,
    messageId: string,
    ts: number,
  ): void {
    const existing = this.db
      .prepare(
        `SELECT id, co_occurrence_count, evidence_message_ids_json
         FROM relationships
         WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = ?
         LIMIT 1`,
      )
      .get(fromId, toId, relationType) as
      | { id: number; co_occurrence_count: number; evidence_message_ids_json: string | null }
      | undefined;

    if (existing) {
      const evidenceIds: string[] = existing.evidence_message_ids_json
        ? JSON.parse(existing.evidence_message_ids_json)
        : [];
      if (!evidenceIds.includes(messageId)) {
        evidenceIds.push(messageId);
      }

      this.db
        .prepare(
          `UPDATE relationships
           SET co_occurrence_count = ?,
               evidence_message_ids_json = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(
          existing.co_occurrence_count + 1,
          JSON.stringify(evidenceIds),
          now(),
          existing.id,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO relationships
            (from_entity_id, to_entity_id, relation_type, strength,
             co_occurrence_count, evidence_message_ids_json, created_at, updated_at)
           VALUES (?, ?, ?, 0.5, 1, ?, ?, ?)`,
        )
        .run(fromId, toId, relationType, JSON.stringify([messageId]), now(), now());
    }
  }

  /**
   * Chunk the content and store in chunks table + chunks_vec.
   */
  private processChunks(
    content: string,
    messageId: string,
    sourceType: string,
    ts: number,
  ): void {
    const chunks = chunkText(content);
    if (chunks.length === 0) return;

    const insertChunk = this.db.prepare(
      `INSERT INTO chunks
        (file_path, line_start, line_end, content, content_hash,
         source_type, related_entity_id, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const chunk of chunks) {
      const hash = contentHash(chunk.content);
      const filePath = `messages/${messageId}`;

      const result = insertChunk.run(
        filePath,
        chunk.lineStart,
        chunk.lineEnd,
        chunk.content,
        hash,
        sourceType,
        messageId,
        chunk.tokenCount,
        now(),
      );

      // Store embedding for the chunk in chunks_vec
      const chunkId = result.lastInsertRowid;
      this.embedChunkAsync(Number(chunkId), chunk.content);
    }
  }

  /**
   * Asynchronously embed a chunk and store in chunks_vec.
   * Failures are logged but do not propagate.
   */
  private embedChunkAsync(chunkId: number, content: string): void {
    EmbeddingClient.getInstance()
      .then((client) => client.embed(content))
      .then((embedding) => {
        this.db
          .prepare(
            `INSERT INTO chunks_vec (chunk_id, embedding)
             VALUES (CAST(? AS INTEGER), ?)`,
          )
          .run(chunkId, JSON.stringify(embedding));
      })
      .catch((err) => {
        console.warn(
          `[IngestionPipeline] Chunk embedding failed for chunk ${chunkId}:`,
          (err as Error).message,
        );
      });
  }

  /**
   * Match content and entity names against watched_projects.
   * Returns an array of matched project names.
   */
  private matchWatchedProjects(
    content: string,
    entities: Array<{ type: EntityType; name: string }>,
  ): string[] {
    const projects = this.db
      .prepare(
        `SELECT id, name, aliases_json FROM watched_projects WHERE is_active = 1`,
      )
      .all() as Array<{ id: string; name: string; aliases_json: string | null }>;

    if (projects.length === 0) return [];

    const contentLower = content.toLowerCase();
    const entityNames = entities.map((e) => e.name.toLowerCase());
    const matched: string[] = [];

    for (const project of projects) {
      const keywords: string[] = [project.name.toLowerCase()];

      if (project.aliases_json) {
        try {
          const aliases = JSON.parse(project.aliases_json) as string[];
          keywords.push(...aliases.map((a) => a.toLowerCase()));
        } catch {
          // Ignore malformed aliases
        }
      }

      const isMatch = keywords.some(
        (kw) =>
          contentLower.includes(kw) ||
          entityNames.some((en) => en.includes(kw) || kw.includes(en)),
      );

      if (isMatch) {
        matched.push(project.name);
      }
    }

    return matched;
  }
}
