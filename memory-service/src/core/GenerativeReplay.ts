/**
 * GenerativeReplay — weekly "dreaming" engine triggered by CronScheduler
 * on Sundays at 03:00.
 *
 * Selects the most salient topics from the past 30 days, recalls related
 * memories for each, and asks the LLM to weave them into a coherent
 * narrative.  The process can discover new implicit relationships between
 * entities and flag potential risks or hypotheses.
 *
 * Discovered relationships are inserted with low confidence (0.3) and
 * source='generative_replay'.  Recalled memories are reinforced to slow
 * their decay.
 */

import type Database from 'better-sqlite3';

import { RecallEngine } from './RecallEngine.js';
import { ForgettingEngine } from './ForgettingEngine.js';
import { MarkdownManager } from './MarkdownManager.js';
import { ReflectionThreadService } from './ReflectionThreadService.js';
import { listFocusProjects } from './FocusProjectSyncService.js';
import { buildFocusSeedContext } from './FocusProjectContextBuilder.js';
import { getLLMClient } from '../llm/LLMClient.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import type { RecallItem } from '../types/index.js';
import { toSlug } from '../utils/slug.js';
import { now, formatDate } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DreamOutput {
  topic: string;
  content: string;
  discoveries: {
    newRelationships: Array<{
      from: string;
      to: string;
      type: string;
      context: string;
    }>;
    insights: string[];
    risks: string[];
  };
  memoriesReinforced: number;
}

export interface DreamResult {
  dreams: DreamOutput[];
  totalTopics: number;
}

interface SalientEntityRow {
  target_id: string;
  target_type: string;
  salience_score: number;
  entity_name: string | null;
  entity_type: string | null;
}

interface RelationshipRow {
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
  context: string | null;
}

interface EntityRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface DreamLLMResponse {
  narrative: string;
  newRelationships: Array<{
    from: string;
    to: string;
    type: string;
    context: string;
  }>;
  insights: string[];
  risks: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DREAM_RELATIONSHIP_CONFIDENCE = 0.3;
const DREAM_RELATIONSHIP_SOURCE = 'generative_replay';
const TOP_SALIENT_LIMIT = 5;
const RECALL_TOP_K = 8;
const LOOKBACK_DAYS = 30;
const GROUNDING_SNIPPET_LIMIT = 5;
const GROUNDING_SNIPPET_LENGTH = 180;

// ---------------------------------------------------------------------------
// GenerativeReplay
// ---------------------------------------------------------------------------

export class GenerativeReplay {
  private db: Database.Database;
  private userDataManager?: UserDataManager;
  private markdownManager?: MarkdownManager;
  private reflectionService: ReflectionThreadService;

  constructor(db: Database.Database, userDataManager?: UserDataManager) {
    this.db = db;
    this.userDataManager = userDataManager;
    this.markdownManager = userDataManager?.isInitialized
      ? new MarkdownManager(db, userDataManager.rootDir)
      : undefined;
    this.reflectionService = new ReflectionThreadService(db, userDataManager);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Execute the weekly dreaming process.
   *
   * 1. Select the top salient topics from the past 30 days.
   * 2. For each topic, recall related memories and entities.
   * 3. Ask the LLM to weave a coherent dream narrative.
   * 4. Persist discovered relationships and reinforce memories.
   * 5. Write dream narratives as markdown files.
   */
  async runWeeklyDreaming(): Promise<DreamResult> {
    console.log('[GenerativeReplay] Starting weekly dreaming...');
    const startMs = Date.now();

    const topics = this.selectSalientTopics();
    const dreams: DreamOutput[] = [];

    for (const topic of topics) {
      try {
        const dream = await this.dreamAboutTopic(topic);
        dreams.push(dream);
      } catch (err) {
        console.error(
          `[GenerativeReplay] Dream failed for topic "${topic.entity_name}":`,
          err,
        );
      }
    }

    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(
      `[GenerativeReplay] Weekly dreaming complete in ${elapsedSec}s — ` +
        `${dreams.length}/${topics.length} topics processed`,
    );

    return {
      dreams,
      totalTopics: topics.length,
    };
  }

  // =========================================================================
  // Step 1: Select top salient topics
  // =========================================================================

  private selectSalientTopics(): SalientEntityRow[] {
    const currentTime = now();
    const cutoff = currentTime - LOOKBACK_DAYS * 86400;

    // Dreaming should only select entity-level memories as topics.
    // If we LIMIT before filtering, high-salience messages can crowd out
    // all entities and weekly dreaming degenerates to zero topics.
    const rows = this.db
      .prepare(
        `SELECT
           mm.target_id,
           mm.target_type,
           mm.salience_score,
           e.name AS entity_name,
           e.type AS entity_type
         FROM memory_metadata mm
         INNER JOIN entities e ON mm.target_id = e.id
         WHERE mm.consolidation_level NOT IN ('forgotten', 'archived')
           AND mm.target_type = 'entity'
           AND mm.updated_at >= ?
           AND mm.salience_score > 0
         ORDER BY mm.salience_score DESC
         LIMIT ?`,
      )
      .all(cutoff, TOP_SALIENT_LIMIT) as SalientEntityRow[];

    const salient = rows.filter(
      (r) => r.entity_name != null && r.entity_name.length > 0,
    );

    // Reserve focus-project entity seeds so dreaming stays anchored to Gantt focus.
    try {
      const seeds = buildFocusSeedContext(listFocusProjects(this.db), {
        maxTotal: Math.min(3, TOP_SALIENT_LIMIT),
        perTeamFloor: 1,
      });
      const byId = new Map(salient.map((row) => [row.target_id, row]));
      for (const seed of seeds) {
        if (byId.has(seed.entityId)) continue;
        const entity = this.db
          .prepare(`SELECT id, name, type FROM entities WHERE id = ?`)
          .get(seed.entityId) as
          | { id: string; name: string; type: string }
          | undefined;
        if (!entity?.name) continue;
        byId.set(seed.entityId, {
          target_id: entity.id,
          target_type: 'entity',
          salience_score: 0.99,
          entity_name: entity.name,
          entity_type: entity.type,
        });
      }
      return Array.from(byId.values()).slice(0, TOP_SALIENT_LIMIT);
    } catch {
      return salient;
    }
  }

  // =========================================================================
  // Step 2-7: Dream about a single topic
  // =========================================================================

  private async dreamAboutTopic(topic: SalientEntityRow): Promise<DreamOutput> {
    const topicName = topic.entity_name!;
    const currentTime = now();
    const dateStr = formatDate(currentTime);

    // 2a. Recall related memories
    const recallEngine = new RecallEngine(this.db);
    const recallResult = await recallEngine.recall(
      {
        query: topicName,
        topK: RECALL_TOP_K,
        sourceTypes: ['glip', 'jira', 'web', 'manual', 'system'],
      },
      { reinforceAccess: false },
    );

    const memories = recallResult.items;
    const memoriesBullets = memories
      .map((m) => `- ${m.content.slice(0, 300)}`)
      .join('\n');

    // 2b. Get related entities from relationships table
    const relatedEntities = this.getRelatedEntities(topic.target_id);
    const entitiesList = relatedEntities
      .map(
        (e) =>
          `- ${e.name} (${e.type})${e.description ? ': ' + e.description : ''}`,
      )
      .join('\n');

    // 2c. Build dream prompt
    const prompt = `You are a memory review assistant. Weave the following memory fragments about "${topicName}" into a coherent review narrative.

Requirements:
1. Naturally connect all memory points
2. If you find potential causal relationships or contradictions, point them out
3. Speculate on potentially missing information or upcoming events
4. End with "Discoveries": new relationships, potential risks, hypotheses to verify

Related memories:
${memoriesBullets || '- No memories recalled'}

Related people/entities:
${entitiesList || '- None found'}

Return JSON: {
  "narrative": "the dream narrative text",
  "newRelationships": [{"from": "entity1", "to": "entity2", "type": "relationship_type", "context": "why"}],
  "insights": ["insight1", "insight2"],
  "risks": ["risk1"]
}`;

    // 2d. Parse LLM response
    const llm = getLLMClient();
    const dreamData = await llm.generateJSON<DreamLLMResponse>(prompt, {
      maxTokens: 2000,
      temperature: 0.7,
      // Long-form narrative generation regularly exceeds the 60s default.
      timeoutMs: 120_000,
    });

    // 2e. Write narrative to dreams/{topic-slug}-{date}.md
    const slug = toSlug(topicName);
    const dreamPath = `dreams/${slug}-${dateStr}.md`;
    const udm = this.userDataManager;
    if (!udm) throw new Error('UserDataManager not available');
    const groundingReceipt = this.buildGroundingReceipt(
      memories,
      recallResult.channels,
    );

    const dreamMd = `# Dream: ${topicName}

_Generated: ${dateStr}_

## Narrative
${dreamData.narrative}

## Insights
${(dreamData.insights ?? []).map((i) => `- ${i}`).join('\n') || '- None'}

## Risks
${(dreamData.risks ?? []).map((r) => `- ${r}`).join('\n') || '- None'}

## Discovered Relationships
${(dreamData.newRelationships ?? []).map((r) => `- **${r.from}** --[${r.type}]--> **${r.to}**: ${r.context}`).join('\n') || '- None'}

${groundingReceipt}
`;

    udm.writeFile(dreamPath, dreamMd);
    await this.markdownManager?.reindexFile(dreamPath);

    // 2f. Insert discovered relationships with low confidence
    const newRelationships = dreamData.newRelationships ?? [];
    for (const rel of newRelationships) {
      try {
        this.insertDreamRelationship(rel, currentTime);
      } catch (err) {
        console.warn(
          `[GenerativeReplay] Failed to insert relationship ${rel.from} -> ${rel.to}:`,
          err,
        );
      }
    }

    // 2g. Reinforce recalled memories
    const forgettingEngine = new ForgettingEngine(this.db);
    let reinforced = 0;

    for (const memory of memories) {
      try {
        forgettingEngine.reinforceMemory(memory.type, memory.id);
        reinforced++;
      } catch (err) {
        console.warn(
          `[GenerativeReplay] Failed to reinforce memory ${memory.id}:`,
          err,
        );
      }
    }

    this.reflectionService.recordDreamRun({
      sourceType: topic.target_type,
      sourceRefId: topic.target_id,
      title: topicName,
      summary: dreamData.narrative.slice(0, 400),
      insights: dreamData.insights ?? [],
      risks: dreamData.risks ?? [],
      relationships: newRelationships as Array<Record<string, unknown>>,
      markdownPath: dreamPath,
    });

    return {
      topic: topicName,
      content: dreamData.narrative,
      discoveries: {
        newRelationships,
        insights: dreamData.insights ?? [],
        risks: dreamData.risks ?? [],
      },
      memoriesReinforced: reinforced,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private buildGroundingReceipt(
    memories: RecallItem[],
    checkedChannels: string[],
  ): string {
    const typeCounts = this.countBy(memories.map((memory) => memory.type));
    const hitChannels = new Set<string>();
    for (const memory of memories) {
      const channels = memory.metadata?.channels;
      if (!Array.isArray(channels)) continue;
      for (const channel of channels) {
        if (typeof channel === 'string' && channel.trim()) {
          hitChannels.add(channel.trim());
        }
      }
    }

    return `## Grounding Receipt
- Recalled memories: ${memories.length}
- Recall result types: ${this.formatCounts(typeCounts)}
- Recall hit channels: ${this.formatList(Array.from(hitChannels))}
- Recall checked channels: ${this.formatList(checkedChannels)}

## Grounding Snippets
${this.formatGroundingSnippets(memories)}`;
  }

  private formatGroundingSnippets(memories: RecallItem[]): string {
    if (memories.length === 0) {
      return '- No recalled memory snippets; treat this replay as an ungrounded hypothesis until reflection finds evidence.';
    }

    return memories
      .slice(0, GROUNDING_SNIPPET_LIMIT)
      .map((memory) => {
        const identity = `${memory.type}:${memory.id}`;
        return `- ${identity} — ${this.cleanMarkdownListText(memory.content, GROUNDING_SNIPPET_LENGTH)}`;
      })
      .join('\n');
  }

  private countBy(values: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const value of values) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }

  private formatCounts(counts: Record<string, number>): string {
    const entries = Object.entries(counts);
    if (entries.length === 0) return 'none';
    return entries.map(([type, count]) => `${type} ${count}`).join(', ');
  }

  private formatList(values: string[]): string {
    const cleaned = values
      .map((value) => value.trim())
      .filter((value, index, list) => value && list.indexOf(value) === index);
    return cleaned.length > 0 ? cleaned.join(', ') : 'none';
  }

  private cleanMarkdownListText(text: string, maxLength: number): string {
    const cleaned = text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\|/g, '/')
      .trim();
    const truncated =
      cleaned.length > maxLength
        ? `${cleaned.slice(0, Math.max(0, maxLength - 3))}...`
        : cleaned;
    return truncated || '(empty memory content)';
  }

  /**
   * Get entities related to a given entity ID via the relationships table.
   */
  private getRelatedEntities(entityId: string): EntityRow[] {
    try {
      const relRows = this.db
        .prepare(
          `SELECT from_entity_id, to_entity_id, relation_type, strength, context
           FROM relationships
           WHERE from_entity_id = ? OR to_entity_id = ?
           ORDER BY strength DESC
           LIMIT 10`,
        )
        .all(entityId, entityId) as RelationshipRow[];

      const relatedIds = new Set<string>();
      for (const rel of relRows) {
        const otherId =
          rel.from_entity_id === entityId
            ? rel.to_entity_id
            : rel.from_entity_id;
        relatedIds.add(otherId);
      }

      if (relatedIds.size === 0) return [];

      const ids = Array.from(relatedIds);
      const ph = ids.map(() => '?').join(', ');

      return this.db
        .prepare(
          `SELECT id, name, type, description
           FROM entities
           WHERE id IN (${ph}) AND status = 'active'`,
        )
        .all(...ids) as EntityRow[];
    } catch (err) {
      console.warn('[GenerativeReplay] Failed to fetch related entities:', err);
      return [];
    }
  }

  /**
   * Insert a dream-discovered relationship with low confidence.
   * Uses entity name matching to resolve entity IDs.
   */
  private insertDreamRelationship(
    rel: { from: string; to: string; type: string; context: string },
    currentTime: number,
  ): void {
    // Resolve entity IDs by name (case-insensitive)
    const fromEntity = this.db
      .prepare(
        `SELECT id FROM entities WHERE LOWER(name) = LOWER(?) AND status = 'active' LIMIT 1`,
      )
      .get(rel.from) as { id: string } | undefined;

    const toEntity = this.db
      .prepare(
        `SELECT id FROM entities WHERE LOWER(name) = LOWER(?) AND status = 'active' LIMIT 1`,
      )
      .get(rel.to) as { id: string } | undefined;

    if (!fromEntity || !toEntity) {
      console.warn(
        `[GenerativeReplay] Cannot resolve entities for relationship: "${rel.from}" -> "${rel.to}"`,
      );
      return;
    }

    // Check if this relationship already exists
    const existing = this.db
      .prepare(
        `SELECT id FROM relationships
         WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = ?
         LIMIT 1`,
      )
      .get(fromEntity.id, toEntity.id, rel.type) as { id: number } | undefined;

    if (existing) {
      // Update context and bump co_occurrence_count
      this.db
        .prepare(
          `UPDATE relationships
           SET co_occurrence_count = co_occurrence_count + 1,
               context = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(rel.context, currentTime, existing.id);
    } else {
      // Insert new relationship with low confidence strength
      this.db
        .prepare(
          `INSERT INTO relationships
            (from_entity_id, to_entity_id, relation_type, strength,
             co_occurrence_count, context, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        )
        .run(
          fromEntity.id,
          toEntity.id,
          rel.type,
          DREAM_RELATIONSHIP_CONFIDENCE,
          rel.context,
          currentTime,
          currentTime,
        );
    }
  }
}
