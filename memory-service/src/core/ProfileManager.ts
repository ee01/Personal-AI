/**
 * ProfileManager — Manages AI agent persona profiles (identity, soul, policy)
 * and renders the USER_CORE.md from user profile items.
 *
 * Responsibilities:
 * - Seed initial IDENTITY.md / SOUL.md / AGENTS.md content
 * - CRUD for agent_profile_versions (versioned Markdown)
 * - Render USER_CORE.md from user_profile_items + social_edges
 * - Track profile sync state (dirty flag)
 */

import type Database from 'better-sqlite3';
import { v4 } from 'uuid';

import type { AgentProfileVersion, ProfileSyncState } from '../types/index.js';
import { now, daysAgo } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Row interfaces
// ---------------------------------------------------------------------------

interface AgentProfileVersionRow {
  id: string;
  kind: string;
  content_md: string;
  author: string;
  rationale: string | null;
  is_active: number;
  created_at: number;
}

interface ProfileItemRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  salience_score: number;
  last_seen: number;
  user_confirmed: number;
}

interface SocialEdgeRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
}

interface SyncStateRow {
  profile_dirty: number;
  last_snapshot_at: number;
  last_full_rebuild_at: number;
}

// ---------------------------------------------------------------------------
// Seed content
// ---------------------------------------------------------------------------

const SEED_IDENTITY = `# Identity

- **Name**: Personal AI Assistant
- **Tone**: Friendly, concise, professional
- **Language**: Match user's language (Chinese/English)
- **Style**: Information-dense, prefer bullet points over paragraphs
`;

const SEED_SOUL = `# Soul

## Values
- User privacy is paramount — never share or expose personal data
- Accuracy over speed — verify before asserting
- Transparency — always explain reasoning when asked

## Boundaries
- External actions require user confirmation
- Never inject private memories into group chat contexts
- Opinions about people are never stated as facts
- SOUL changes must be communicated to the user

## Communication
- Be proactive but not intrusive
- Respect quiet hours and user preferences
- Admit uncertainty rather than fabricate
`;

const SEED_POLICY = `# Operating Policy

## Proactive Behavior
- Heartbeat check every 15 minutes
- Only notify when utility > cost threshold
- Maximum 3 unsolicited notifications per hour
- Never interrupt during quiet hours unless critical

## Confirmation Rules
- Inferred facts: auto-accept if confidence > 0.8
- Inferred preferences: auto-accept if mentioned 3+ times
- Opinions about people: always require user confirmation
- Entity property conflicts: create confirm request

## Memory Management
- Daily consolidation at 23:00
- Weekly dreaming on Sunday 03:00
- Archive memories below salience 0.1
- Never permanently delete — only soft-delete
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAgentProfileVersion(row: AgentProfileVersionRow): AgentProfileVersion {
  return {
    id: row.id,
    kind: row.kind as AgentProfileVersion['kind'],
    contentMd: row.content_md,
    author: row.author,
    rationale: row.rationale ?? undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// ProfileManager
// ---------------------------------------------------------------------------

export class ProfileManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ========================================================================
  // Seed profiles
  // ========================================================================

  /**
   * Ensure that at least one active agent profile version exists for each
   * kind (identity, soul, policy). If none exist, insert the seed content.
   *
   * @returns The number of profiles that were seeded.
   */
  ensureSeedProfiles(): number {
    const existing = this.db
      .prepare('SELECT COUNT(*) AS count FROM agent_profile_versions WHERE is_active = 1')
      .get() as { count: number };

    if (existing.count > 0) {
      return 0;
    }

    const seeds: Array<{ kind: string; content: string }> = [
      { kind: 'identity', content: SEED_IDENTITY },
      { kind: 'soul', content: SEED_SOUL },
      { kind: 'policy', content: SEED_POLICY },
    ];

    const currentTime = now();

    const insertStmt = this.db.prepare(
      `INSERT INTO agent_profile_versions (id, kind, content_md, author, rationale, is_active, created_at)
       VALUES (?, ?, ?, 'system', 'Initial seed', 1, ?)`,
    );

    let seeded = 0;
    for (const seed of seeds) {
      insertStmt.run(v4(), seed.kind, seed.content, currentTime);
      seeded++;
    }

    return seeded;
  }

  // ========================================================================
  // Agent profile CRUD
  // ========================================================================

  /**
   * Get the active profile content for a given kind.
   */
  getActiveProfile(kind: 'identity' | 'soul' | 'policy'): string | null {
    const row = this.db
      .prepare(
        'SELECT content_md FROM agent_profile_versions WHERE kind = ? AND is_active = 1',
      )
      .get(kind) as { content_md: string } | undefined;

    return row?.content_md ?? null;
  }

  /**
   * Update a profile by deactivating the current active version and inserting
   * a new one.
   *
   * @returns The ID of the newly created version.
   */
  updateProfile(
    kind: 'identity' | 'soul' | 'policy',
    contentMd: string,
    author: string,
    rationale?: string,
  ): string {
    const currentTime = now();
    const newId = v4();

    // Deactivate current active version for this kind
    this.db
      .prepare(
        'UPDATE agent_profile_versions SET is_active = 0 WHERE kind = ? AND is_active = 1',
      )
      .run(kind);

    // Insert new version as active
    this.db
      .prepare(
        `INSERT INTO agent_profile_versions (id, kind, content_md, author, rationale, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(newId, kind, contentMd, author, rationale ?? null, currentTime);

    return newId;
  }

  /**
   * Get version history for a given kind, ordered by most recent first.
   */
  getProfileHistory(kind: 'identity' | 'soul' | 'policy', limit = 20): AgentProfileVersion[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM agent_profile_versions
         WHERE kind = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(kind, limit) as AgentProfileVersionRow[];

    return rows.map(formatAgentProfileVersion);
  }

  // ========================================================================
  // USER_CORE.md rendering
  // ========================================================================

  /**
   * Render the USER_CORE.md content from the database.
   *
   * Sections:
   * - Current Focus (last_seen within 7 days, top 5)
   * - Ongoing Interests (item_type='interest', next 10)
   * - Key People (from social_edges by strength)
   * - Preferences (item_type='preference' and user_confirmed=1)
   * - Identity (item_type='fact' and key in name/role/organization/timezone)
   */
  renderUserCore(topK: number): string {
    const sections: string[] = [];
    sections.push('# USER_CORE\n');

    // --- Identity ---
    const identityKeys = ['name', 'role', 'organization', 'timezone'];
    const placeholders = identityKeys.map(() => '?').join(',');
    const identityRows = this.db
      .prepare(
        `SELECT * FROM user_profile_items
         WHERE status = 'active'
           AND user_confirmed = 1
           AND item_type = 'fact'
           AND item_key IN (${placeholders})
         ORDER BY salience_score DESC
         LIMIT ?`,
      )
      .all(...identityKeys, topK) as ProfileItemRow[];

    if (identityRows.length > 0) {
      sections.push('## Identity\n');
      for (const row of identityRows) {
        sections.push(`- **${row.item_key}**: ${row.item_value}`);
      }
      sections.push('');
    }

    // --- Current Focus (last_seen within 7 days, top 5) ---
    const sevenDaysAgo = daysAgo(7);
    const focusRows = this.db
      .prepare(
        `SELECT * FROM user_profile_items
         WHERE status = 'active'
           AND user_confirmed = 1
           AND last_seen >= ?
         ORDER BY salience_score DESC
         LIMIT 5`,
      )
      .all(sevenDaysAgo) as ProfileItemRow[];

    if (focusRows.length > 0) {
      sections.push('## Current Focus\n');
      for (const row of focusRows) {
        sections.push(`- **${row.item_key}**: ${row.item_value}`);
      }
      sections.push('');
    }

    // --- Ongoing Interests (item_type='interest', next 10) ---
    const interestRows = this.db
      .prepare(
        `SELECT * FROM user_profile_items
         WHERE status = 'active'
           AND user_confirmed = 1
           AND item_type = 'interest'
         ORDER BY salience_score DESC
         LIMIT 10`,
      )
      .all() as ProfileItemRow[];

    if (interestRows.length > 0) {
      sections.push('## Ongoing Interests\n');
      for (const row of interestRows) {
        sections.push(`- ${row.item_value}`);
      }
      sections.push('');
    }

    // --- Key People (from social_edges by strength) ---
    const socialRows = this.db
      .prepare(
        `SELECT se.*, e.name AS entity_name
         FROM social_edges se
         LEFT JOIN entities e ON e.id = se.to_entity_id
         WHERE se.user_confirmed = 1
         ORDER BY se.strength DESC
         LIMIT 10`,
      )
      .all() as Array<SocialEdgeRow & { entity_name?: string }>;

    if (socialRows.length > 0) {
      sections.push('## Key People\n');
      for (const row of socialRows) {
        const name = (row as { entity_name?: string }).entity_name ?? row.to_entity_id;
        sections.push(`- **${name}** (${row.relation_type}, strength: ${row.strength.toFixed(2)})`);
      }
      sections.push('');
    }

    // --- Preferences (item_type='preference' and user_confirmed=1) ---
    const prefRows = this.db
      .prepare(
        `SELECT * FROM user_profile_items
         WHERE status = 'active' AND item_type = 'preference' AND user_confirmed = 1
         ORDER BY salience_score DESC
         LIMIT ?`,
      )
      .all(topK) as ProfileItemRow[];

    if (prefRows.length > 0) {
      sections.push('## Preferences\n');
      for (const row of prefRows) {
        sections.push(`- **${row.item_key}**: ${row.item_value}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  // ========================================================================
  // Profile sync state
  // ========================================================================

  /**
   * Get the current profile sync state.
   */
  getProfileSyncState(): ProfileSyncState {
    const row = this.db
      .prepare("SELECT * FROM profile_sync_state WHERE id = 'singleton'")
      .get() as SyncStateRow | undefined;

    if (!row) {
      return {
        profileDirty: false,
        lastSnapshotAt: 0,
        lastFullRebuildAt: 0,
      };
    }

    return {
      profileDirty: row.profile_dirty === 1,
      lastSnapshotAt: row.last_snapshot_at,
      lastFullRebuildAt: row.last_full_rebuild_at,
    };
  }

  /**
   * Set the profile dirty flag.
   */
  setProfileDirty(dirty: boolean): void {
    this.db
      .prepare(
        "UPDATE profile_sync_state SET profile_dirty = ? WHERE id = 'singleton'",
      )
      .run(dirty ? 1 : 0);
  }
}
