/**
 * ConsolidationEngine — daily memory consolidation triggered by CronScheduler at 23:00.
 *
 * Runs a 7-phase nightly process:
 *   1.   Compress  — generate a daily summary from raw messages
 *   2.   Denoise   — merge near-duplicate messages
 *   3.   Structure — update watched-project summaries
 *   3.5  Profile   — consolidate user profile items & rebuild USER_CORE.md
 *   4.   Clean     — run the forgetting cycle (decay + archive)
 *   5.   Reindex   — rebuild chunk index for changed markdown files
 *   6.   Reflect   — generate a daily reflection artifact
 *
 * Each phase is wrapped in its own try/catch so that a failure in one
 * phase never blocks the others.
 */

import type Database from 'better-sqlite3';

import { ForgettingEngine } from './ForgettingEngine.js';
import { MarkdownManager } from './MarkdownManager.js';
import { getLLMClient } from '../llm/LLMClient.js';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { contentHash } from '../utils/hashing.js';
import { now, formatDate } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsolidationResult {
  summarized: number;
  merged: number;
  structured: number;
  profileConsolidated: number;
  cleaned: number;
  reflected: number;
  reindexed: number;
}

interface MessageRow {
  id: string;
  content: string;
  sender: string | null;
  timestamp: number;
  source_type: string;
  content_hash?: string;
}

interface WatchedProjectRow {
  id: string;
  entity_id: string | null;
  name: string;
  description: string | null;
  is_active: number;
}

interface ChunkRow {
  chunk_id: number;
  file_path: string;
  content: string;
  content_hash: string;
  created_at: number;
}

interface MemoryMetadataRow {
  id: number;
  target_type: string;
  target_id: string;
  salience_score: number;
}

interface ProfileItemRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  evidence_refs: string | null;
  source_kind: string;
  confidence: number;
  user_confirmed: number;
  status: string;
  salience_score: number;
  mention_count: number;
  last_seen: number;
  created_at: number;
  updated_at: number;
}

interface SocialEdgeRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
  evidence_refs: string | null;
  confidence: number;
  user_confirmed: number;
  entity_name: string;
}

// ---------------------------------------------------------------------------
// ConsolidationEngine
// ---------------------------------------------------------------------------

export class ConsolidationEngine {
  private db: Database.Database;
  private userDataManager?: UserDataManager;
  private markdownManager?: MarkdownManager;

  constructor(db: Database.Database, userDataManager?: UserDataManager) {
    this.db = db;
    this.userDataManager = userDataManager;
    this.markdownManager = userDataManager?.isInitialized
      ? new MarkdownManager(db, userDataManager.rootDir)
      : undefined;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Execute the full 6-phase daily consolidation.
   * Individual phase failures are logged but do not abort the overall run.
   */
  async runDailyConsolidation(): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      summarized: 0,
      merged: 0,
      structured: 0,
      profileConsolidated: 0,
      cleaned: 0,
      reflected: 0,
      reindexed: 0,
    };

    console.log('[ConsolidationEngine] Starting daily consolidation...');
    const startMs = Date.now();

    // Phase 1: Compress — daily summary
    try {
      result.summarized = await this.phaseCompress();
      console.log(`[ConsolidationEngine] Phase 1 (Compress): summarized ${result.summarized} messages`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 1 (Compress) failed:', err);
    }

    // Phase 2: Denoise — merge duplicates
    try {
      result.merged = await this.phaseDenoise();
      console.log(`[ConsolidationEngine] Phase 2 (Denoise): merged ${result.merged} duplicates`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 2 (Denoise) failed:', err);
    }

    // Phase 3: Structure — update project summaries
    try {
      result.structured = await this.phaseStructure();
      console.log(`[ConsolidationEngine] Phase 3 (Structure): updated ${result.structured} projects`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 3 (Structure) failed:', err);
    }

    // Phase 3.5: Profile consolidation
    try {
      result.profileConsolidated = await this.phaseProfileConsolidate();
      console.log(`[ConsolidationEngine] Phase 3.5 (Profile): consolidated ${result.profileConsolidated} profile items`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 3.5 (Profile) failed:', err);
    }

    // Phase 4: Clean — run forgetting cycle
    try {
      result.cleaned = await this.phaseClean();
      console.log(`[ConsolidationEngine] Phase 4 (Clean): processed ${result.cleaned} memories`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 4 (Clean) failed:', err);
    }

    // Phase 5: Reindex — rebuild chunk index for changed files
    try {
      result.reindexed = await this.phaseReindex();
      console.log(`[ConsolidationEngine] Phase 5 (Reindex): reindexed ${result.reindexed} files`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 5 (Reindex) failed:', err);
    }

    // Phase 6: Reflect — daily reflection
    try {
      result.reflected = await this.phaseReflect();
      console.log(`[ConsolidationEngine] Phase 6 (Reflect): generated ${result.reflected} reflection`);
    } catch (err) {
      console.error('[ConsolidationEngine] Phase 6 (Reflect) failed:', err);
    }

    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[ConsolidationEngine] Daily consolidation complete in ${elapsedSec}s`, result);

    return result;
  }

  // =========================================================================
  // Phase 1: Compress — Generate daily summary
  // =========================================================================

  private async phaseCompress(): Promise<number> {
    const currentTime = now();
    const todayDate = new Date(currentTime * 1000);
    todayDate.setHours(0, 0, 0, 0);
    const startOfDay = Math.floor(todayDate.getTime() / 1000);
    const endOfDay = startOfDay + 86400 - 1;

    const messages = this.db
      .prepare(
        `SELECT id, content, sender, timestamp, source_type
         FROM messages_raw
         WHERE timestamp BETWEEN ? AND ?
         ORDER BY timestamp ASC`,
      )
      .all(startOfDay, endOfDay) as MessageRow[];

    if (messages.length === 0) {
      return 0;
    }

    const formattedMessages = messages
      .map((m) => `- [${m.sender ?? 'unknown'}] ${m.content}`)
      .join('\n');

    const prompt = `You are a memory consolidation assistant. Summarize the following messages into a concise daily memory log.

Requirements:
1. Group by topic/project
2. Highlight important decisions, changes, action items
3. Note key people involved
4. Use Markdown format with ## headings per topic
5. Keep under 500 words

Today's messages (${messages.length}):
${formattedMessages}`;

    const llm = getLLMClient();
    const response = await llm.generate(prompt, { maxTokens: 1500 });

    const dateStr = formatDate(currentTime);
    const dailyPath = `daily/${dateStr}.md`;
    const header = `# Daily Summary — ${dateStr}\n\n`;
    const udm = this.userDataManager;
    if (!udm) throw new Error('UserDataManager not available');
    udm.writeFile(dailyPath, header + response.content);
    await this.markdownManager?.reindexFile(dailyPath);

    return messages.length;
  }

  // =========================================================================
  // Phase 2: Denoise — Merge near-duplicate messages
  // =========================================================================

  private async phaseDenoise(): Promise<number> {
    let merged = 0;
    const currentTime = now();

    // Strategy: find messages from today with identical or near-identical content
    const todayDate = new Date(currentTime * 1000);
    todayDate.setHours(0, 0, 0, 0);
    const startOfDay = Math.floor(todayDate.getTime() / 1000);

    const messages = this.db
      .prepare(
        `SELECT id, content, sender, timestamp, source_type
         FROM messages_raw
         WHERE timestamp >= ?
         ORDER BY timestamp ASC`,
      )
      .all(startOfDay) as MessageRow[];

    if (messages.length < 2) {
      return 0;
    }

    // Build content hashes for quick duplicate detection
    const hashGroups = new Map<string, MessageRow[]>();
    for (const msg of messages) {
      const hash = contentHash(msg.content.trim().toLowerCase());
      const group = hashGroups.get(hash) ?? [];
      group.push(msg);
      hashGroups.set(hash, group);
    }

    const archiveStmt = this.db.prepare(
      `INSERT INTO memory_metadata (target_type, target_id, salience_score, consolidation_level, created_at, updated_at)
       VALUES ('message', ?, 0, 'archived', ?, ?)
       ON CONFLICT(target_type, target_id) DO UPDATE SET
         consolidation_level = 'archived',
         updated_at = ?`,
    );

    // Archive exact duplicates (keep the one with the longest content / earliest)
    for (const [, group] of hashGroups) {
      if (group.length < 2) continue;

      // Sort: longest content first, then earliest timestamp
      group.sort((a, b) => {
        const lenDiff = b.content.length - a.content.length;
        return lenDiff !== 0 ? lenDiff : a.timestamp - b.timestamp;
      });

      // Keep the first, archive the rest
      for (let i = 1; i < group.length; i++) {
        archiveStmt.run(group[i].id, currentTime, currentTime, currentTime);
        merged++;
      }
    }

    // High cosine similarity check (>0.92) via embedding comparison
    // Only run if we have embedding support and a manageable set
    if (messages.length <= 200) {
      try {
        const embeddingClient = await EmbeddingClient.getInstance();
        const alreadyArchived = new Set<string>();

        // Collect IDs archived above
        for (const [, group] of hashGroups) {
          if (group.length < 2) continue;
          for (let i = 1; i < group.length; i++) {
            alreadyArchived.add(group[i].id);
          }
        }

        const remaining = messages.filter((m) => !alreadyArchived.has(m.id));
        if (remaining.length >= 2) {
          const texts = remaining.map((m) => m.content);
          const embeddings = await embeddingClient.embedBatch(texts);

          for (let i = 0; i < remaining.length; i++) {
            if (alreadyArchived.has(remaining[i].id)) continue;

            for (let j = i + 1; j < remaining.length; j++) {
              if (alreadyArchived.has(remaining[j].id)) continue;

              const sim = cosineSimilarity(embeddings[i], embeddings[j]);
              if (sim > 0.92) {
                // Keep the longer / earlier message
                const keep = remaining[i].content.length >= remaining[j].content.length
                  ? remaining[i]
                  : remaining[j];
                const archive = keep === remaining[i] ? remaining[j] : remaining[i];

                archiveStmt.run(archive.id, currentTime, currentTime, currentTime);
                alreadyArchived.add(archive.id);
                merged++;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[ConsolidationEngine] Embedding-based dedup skipped:', err);
      }
    }

    return merged;
  }

  // =========================================================================
  // Phase 3: Structure — Update watched project summaries
  // =========================================================================

  private async phaseStructure(): Promise<number> {
    let structured = 0;
    const currentTime = now();
    const oneDayAgo = currentTime - 86400;

    const projects = this.db
      .prepare(
        `SELECT id, entity_id, name, description, is_active
         FROM watched_projects
         WHERE is_active = 1`,
      )
      .all() as WatchedProjectRow[];

    if (projects.length === 0) {
      return 0;
    }

    const llm = getLLMClient();
    const udm = this.userDataManager;
    if (!udm) throw new Error('UserDataManager not available');

    for (const project of projects) {
      try {
        // Find recent messages matching this project
        const messages = this.db
          .prepare(
            `SELECT id, content, sender, timestamp
             FROM messages_raw
             WHERE timestamp >= ?
               AND (matched_projects_json LIKE ? OR content LIKE ?)
             ORDER BY timestamp ASC`,
          )
          .all(
            oneDayAgo,
            `%"${project.id}"%`,
            `%${project.name}%`,
          ) as MessageRow[];

        if (messages.length === 0) continue;

        const formattedMessages = messages
          .map((m) => `- [${m.sender ?? 'unknown'}] ${m.content}`)
          .join('\n');

        const prompt = `You are a project tracking assistant. Generate a structured project status update for "${project.name}".

Based on these recent messages:
${formattedMessages}

Provide a Markdown update with:
## Status
Brief current status

## Recent Changes
- Change 1
- Change 2

## Decisions Made
- Decision 1

## Action Items
- [ ] Action 1

## Key People
- Person and their role

## Open Questions
- Question 1`;

        const response = await llm.generate(prompt, { maxTokens: 1000 });

        const slug = project.name
          .toLowerCase()
          .replace(/[\s_]+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-{2,}/g, '-')
          .replace(/^-+|-+$/g, '');

        const projectPath = `projects/${slug}.md`;
        const dateStr = formatDate(currentTime);
        const header = `# ${project.name}\n\n_Last updated: ${dateStr}_\n\n`;
        udm.writeFile(projectPath, header + response.content);
        await this.markdownManager?.reindexFile(projectPath);

        // Append to entity timeline if entity_id is linked
        if (project.entity_id) {
          try {
            const props = this.db
              .prepare(
                `SELECT id, property_key, property_value, tx_start
                 FROM entity_properties
                 WHERE entity_id = ?
                   AND tx_start >= ?
                 ORDER BY tx_start ASC`,
              )
              .all(project.entity_id, oneDayAgo) as Array<{
              id: number;
              property_key: string;
              property_value: string;
              tx_start: number;
            }>;

            if (props.length > 0) {
              const timelineEntries = props
                .map((p) => `- **${p.property_key}**: ${p.property_value} (${formatDate(p.tx_start)})`)
                .join('\n');

              udm.appendToFile(
                projectPath,
                `\n\n## Property Timeline\n\n${timelineEntries}\n`,
              );
            }
          } catch (err) {
            console.warn(`[ConsolidationEngine] Timeline append failed for ${project.name}:`, err);
          }
        }

        structured++;
      } catch (err) {
        console.error(`[ConsolidationEngine] Structure phase failed for project "${project.name}":`, err);
      }
    }

    return structured;
  }

  // =========================================================================
  // Phase 3.5: Profile — Consolidate user profile items & rebuild USER_CORE.md
  // =========================================================================

  private async phaseProfileConsolidate(): Promise<number> {
    const currentTime = now();
    let itemsProcessed = 0;

    // Step 1 — Decay active items with slower decay for confirmed stable facts
    // and faster decay for ephemeral focus/context items.
    const decayResult = this.db
      .prepare(
        `UPDATE user_profile_items
         SET salience_score = salience_score * CASE
               WHEN user_confirmed = 1
                    AND item_type = 'fact'
                    AND item_key IN ('name', 'role', 'organization', 'timezone')
                 THEN 0.995
               WHEN user_confirmed = 1 AND item_type = 'preference'
                 THEN 0.99
               WHEN last_seen >= ?
                 THEN 0.97
               ELSE 0.96
             END,
             updated_at = ?
         WHERE status = 'active'`,
      )
      .run(currentTime - 7 * 86400, currentTime);
    itemsProcessed += decayResult.changes;

    // Step 2 — Merge semantic duplicates within the same item_key
    const activeItems = this.db
      .prepare(
        `SELECT id, item_type, item_key, item_value, evidence_refs,
                source_kind, confidence, user_confirmed, status,
                salience_score, mention_count, last_seen, created_at, updated_at
         FROM user_profile_items
         WHERE status = 'active'
         ORDER BY item_key, salience_score DESC`,
      )
      .all() as ProfileItemRow[];

    // Group by item_key
    const keyGroups = new Map<string, ProfileItemRow[]>();
    for (const item of activeItems) {
      const group = keyGroups.get(item.item_key) ?? [];
      group.push(item);
      keyGroups.set(item.item_key, group);
    }

    const updateWinnerStmt = this.db.prepare(
      `UPDATE user_profile_items
       SET mention_count = ?, evidence_refs = ?, updated_at = ?
       WHERE id = ?`,
    );

    const supersedeStmt = this.db.prepare(
      `UPDATE user_profile_items
       SET status = 'superseded', updated_at = ?
       WHERE id = ?`,
    );

    for (const [, group] of keyGroups) {
      if (group.length < 2) continue;

      // Compare each pair within the same item_key for duplicate values
      const superseded = new Set<string>();

      for (let i = 0; i < group.length; i++) {
        if (superseded.has(group[i].id)) continue;

        for (let j = i + 1; j < group.length; j++) {
          if (superseded.has(group[j].id)) continue;

          const valA = group[i].item_value.toLowerCase().trim();
          const valB = group[j].item_value.toLowerCase().trim();

          if (valA === valB) {
            // Items are sorted by salience DESC, so group[i] has higher salience
            const winner = group[i];
            const loser = group[j];

            // Merge mention_count
            const mergedMentionCount = winner.mention_count + loser.mention_count;

            // Merge evidence_refs arrays
            let winnerRefs: Array<{ messageId: string; snippet?: string; ts: number }> = [];
            let loserRefs: Array<{ messageId: string; snippet?: string; ts: number }> = [];
            try {
              winnerRefs = winner.evidence_refs ? JSON.parse(winner.evidence_refs) : [];
            } catch { /* ignore parse errors */ }
            try {
              loserRefs = loser.evidence_refs ? JSON.parse(loser.evidence_refs) : [];
            } catch { /* ignore parse errors */ }

            const mergedRefs = [...winnerRefs, ...loserRefs];

            updateWinnerStmt.run(
              mergedMentionCount,
              JSON.stringify(mergedRefs),
              currentTime,
              winner.id,
            );

            supersedeStmt.run(currentTime, loser.id);
            superseded.add(loser.id);
            itemsProcessed++;
          }
        }
      }
    }

    // Step 3 — Prune stale items (salience below threshold)
    const pruneResult = this.db
      .prepare(
        `UPDATE user_profile_items
         SET status = 'archived',
             updated_at = ?
         WHERE status = 'active' AND salience_score < 0.1`,
      )
      .run(currentTime);
    itemsProcessed += pruneResult.changes;

    // Step 4 — Rebuild USER_CORE.md
    const sevenDaysAgo = currentTime - 7 * 86400;

    // Top-20 active profile items by salience
    const topItems = this.db
      .prepare(
        `SELECT id, item_type, item_key, item_value, evidence_refs,
                source_kind, confidence, user_confirmed, status,
                salience_score, mention_count, last_seen, created_at, updated_at
         FROM user_profile_items
         WHERE status = 'active'
           AND user_confirmed = 1
           AND salience_score >= 0.1
         ORDER BY salience_score DESC
         LIMIT 20`,
      )
      .all() as ProfileItemRow[];

    // Social edges with entity names
    const socialEdges = this.db
      .prepare(
        `SELECT se.id, se.from_entity_id, se.to_entity_id, se.relation_type,
                se.strength, se.evidence_refs, se.confidence, se.user_confirmed,
                e.name as entity_name
         FROM social_edges se
         JOIN entities e ON se.to_entity_id = e.id
         WHERE se.user_confirmed = 1
         ORDER BY se.strength DESC
         LIMIT 10`,
      )
      .all() as SocialEdgeRow[];

    // Build markdown sections
    const lines: string[] = [];
    lines.push('# USER_CORE');
    lines.push('');
    lines.push(`> Auto-generated by ConsolidationEngine at ${formatDate(currentTime)}`);
    lines.push('');

    // Current Focus — items where last_seen is within 7 days AND top 5 by salience
    const currentFocus = topItems
      .filter((item) => item.last_seen >= sevenDaysAgo)
      .slice(0, 5);

    lines.push('## Current Focus');
    lines.push('');
    if (currentFocus.length > 0) {
      for (const item of currentFocus) {
        lines.push(`- **${item.item_key}**: ${item.item_value} (salience: ${item.salience_score.toFixed(2)})`);
      }
    } else {
      lines.push('- (no recent focus items)');
    }
    lines.push('');

    // Ongoing Interests — item_type='interest', next 10 by salience
    const interests = topItems
      .filter((item) => item.item_type === 'interest')
      .slice(0, 10);

    lines.push('## Ongoing Interests');
    lines.push('');
    if (interests.length > 0) {
      for (const item of interests) {
        lines.push(`- **${item.item_key}**: ${item.item_value}`);
      }
    } else {
      lines.push('- (no interests recorded)');
    }
    lines.push('');

    // Key People — from social_edges
    lines.push('## Key People');
    lines.push('');
    if (socialEdges.length > 0) {
      for (const edge of socialEdges) {
        const strengthIndicator = edge.strength >= 0.8
          ? '(strong)'
          : edge.strength >= 0.5
            ? '(moderate)'
            : '(weak)';
        lines.push(`- **${edge.entity_name}** — ${edge.relation_type} ${strengthIndicator}`);
      }
    } else {
      lines.push('- (no social connections recorded)');
    }
    lines.push('');

    // Preferences — item_type='preference' AND user_confirmed=1
    const preferences = topItems.filter(
      (item) => item.item_type === 'preference' && item.user_confirmed === 1,
    );

    lines.push('## Preferences');
    lines.push('');
    if (preferences.length > 0) {
      for (const item of preferences) {
        lines.push(`- **${item.item_key}**: ${item.item_value}`);
      }
    } else {
      lines.push('- (no confirmed preferences)');
    }
    lines.push('');

    // Identity — item_type='fact' AND item_key IN ('name','role','organization','timezone')
    const identityKeys = new Set(['name', 'role', 'organization', 'timezone']);
    const identityItems = topItems.filter(
      (item) => item.item_type === 'fact' && identityKeys.has(item.item_key),
    );

    lines.push('## Identity');
    lines.push('');
    if (identityItems.length > 0) {
      for (const item of identityItems) {
        lines.push(`- **${item.item_key}**: ${item.item_value}`);
      }
    } else {
      lines.push('- (no identity facts recorded)');
    }
    lines.push('');

    // Write USER_CORE.md (per-user via UserDataManager)
    this.userDataManager?.writeFile('USER_CORE.md', lines.join('\n'));
    await this.markdownManager?.reindexFile('USER_CORE.md');

    // Step 5 — Update sync state
    this.db
      .prepare(
        `UPDATE profile_sync_state
         SET profile_dirty = 0, last_full_rebuild_at = ?, last_snapshot_at = ?
         WHERE id = 'singleton'`,
      )
      .run(currentTime, currentTime);

    return itemsProcessed;
  }

  // =========================================================================
  // Phase 4: Clean — Run forgetting cycle
  // =========================================================================

  private async phaseClean(): Promise<number> {
    const engine = new ForgettingEngine(this.db);
    const result = await engine.runForgettingCycle();
    return result.totalProcessed;
  }

  // =========================================================================
  // Phase 5: Reindex — Rebuild chunk index for changed files
  // =========================================================================

  private async phaseReindex(): Promise<number> {
    let reindexed = 0;
    const currentTime = now();
    const startOfDay = currentTime - 86400;

    const udm = this.userDataManager;
    if (!udm?.isInitialized) {
      return 0;
    }

    // Find all markdown files modified today by scanning known directories
    const directories = ['daily', 'projects', 'reflections', 'dreams'];
    const modifiedFiles: string[] = [];

    for (const dir of directories) {
      const files = udm.listFiles(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const relativePath = `${dir}/${file}`;

        // Check if the file's corresponding chunks were created/updated today
        const existingChunk = this.db
          .prepare(
            `SELECT chunk_id FROM chunks
             WHERE file_path = ? AND (created_at >= ? OR updated_at >= ?)
             LIMIT 1`,
          )
          .get(relativePath, startOfDay, startOfDay) as { chunk_id: number } | undefined;

        // Also check if file has no chunks at all (new file)
        const anyChunk = this.db
          .prepare(`SELECT chunk_id FROM chunks WHERE file_path = ? LIMIT 1`)
          .get(relativePath) as { chunk_id: number } | undefined;

        if (existingChunk || !anyChunk) {
          modifiedFiles.push(relativePath);
        }
      }
    }

    if (modifiedFiles.length === 0) {
      return 0;
    }

    for (const relativePath of modifiedFiles) {
      try {
        const content = udm.readFile(relativePath);
        if (!content || content.trim().length === 0) continue;
        await this.markdownManager?.reindexFile(relativePath);
        reindexed++;
      } catch (err) {
        console.warn(`[ConsolidationEngine] Reindex failed for ${relativePath}:`, err);
      }
    }

    return reindexed;
  }

  // =========================================================================
  // Phase 6: Reflect — Generate daily reflection
  // =========================================================================

  private async phaseReflect(): Promise<number> {
    const currentTime = now();
    const dateStr = formatDate(currentTime);

    // Gather today's activity stats
    const todayDate = new Date(currentTime * 1000);
    todayDate.setHours(0, 0, 0, 0);
    const startOfDay = Math.floor(todayDate.getTime() / 1000);

    const messageCount = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM messages_raw WHERE timestamp BETWEEN ? AND ?`,
      )
      .get(startOfDay, startOfDay + 86400 - 1) as { count: number };

    // Read the daily summary if it was generated
    const udm = this.userDataManager;
    const dailySummary = udm?.readFile(`daily/${dateStr}.md`) ?? 'No daily summary available.';

    const prompt = `Based on today's activities, provide a brief reflection:
1. What were the key themes?
2. Any lessons learned?
3. Open questions that need follow-up?
4. Interesting discoveries or patterns?

Today's summary:
${dailySummary.slice(0, 2000)}

Messages processed today: ${messageCount.count}

Return JSON: { "summary": "...", "lessons": [...], "openQuestions": [...], "discoveries": [...] }`;

    const llm = getLLMClient();
    const reflectionData = await llm.generateJSON<{
      summary: string;
      lessons: string[];
      openQuestions: string[];
      discoveries: string[];
    }>(prompt, { maxTokens: 1000 });

    // Store in reflection_artifacts table
    const reflectionId = `reflection-daily-${dateStr}`;
    const markdownPath = `reflections/${dateStr}.md`;

    this.db
      .prepare(
        `INSERT OR REPLACE INTO reflection_artifacts
          (id, scope, scope_ref, summary, lessons_json, open_questions_json,
           discoveries_json, markdown_path, created_at)
         VALUES (?, 'daily', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        reflectionId,
        dateStr,
        reflectionData.summary,
        JSON.stringify(reflectionData.lessons ?? []),
        JSON.stringify(reflectionData.openQuestions ?? []),
        JSON.stringify(reflectionData.discoveries ?? []),
        markdownPath,
        currentTime,
      );

    // Write reflection markdown
    const reflectionMd = `# Daily Reflection — ${dateStr}

## Summary
${reflectionData.summary}

## Lessons Learned
${(reflectionData.lessons ?? []).map((l) => `- ${l}`).join('\n') || '- None identified'}

## Open Questions
${(reflectionData.openQuestions ?? []).map((q) => `- ${q}`).join('\n') || '- None'}

## Discoveries
${(reflectionData.discoveries ?? []).map((d) => `- ${d}`).join('\n') || '- None'}
`;

    udm?.writeFile(markdownPath, reflectionMd);
    await this.markdownManager?.reindexFile(markdownPath);

    return 1;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two equal-length vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
