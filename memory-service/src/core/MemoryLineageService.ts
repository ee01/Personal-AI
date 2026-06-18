import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

/**
 * MemoryLineageService (P2-10: cascade deletion & true deletability).
 *
 * When a user explicitly deletes source messages, the existing DELETE path only
 * cleared chunks/vec/metadata — leaving orphan entity_properties, dirty
 * relationship evidence arrays, and reflection/dream summaries that keep
 * re-surfacing the deleted information (Agentic Unlearning re-pollution).
 *
 * applyCascade() closes those gaps inside the caller's transaction and returns
 * an auditable receipt. It NEVER triggers on the ForgettingEngine's automatic
 * decay — only on explicit user deletion (automatic forgetting != user intent).
 */

export interface CascadeReceipt {
  entityProperties: number;
  evidenceTrims: { relationships: number; profileItems: number };
  orphansArchived: { entities: number; relationships: number };
  recompute: { reflectionsRedacted: number; reflectionsRetracted: number; profileDemoted: number };
}

const PROFILE_PROMOTION_MIN_EVIDENCE = 3;

export class MemoryLineageService {
  constructor(private db: Database.Database) {}

  private hasColumn(table: string, column: string): boolean {
    try {
      return (this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
        (c) => c.name === column,
      );
    } catch {
      return false;
    }
  }

  /**
   * Apply the full cascade for the given deleted message ids. Must run inside the
   * caller's deletion transaction (after the messages/chunks are removed or about
   * to be). Returns a receipt for the response.
   */
  applyCascade(messageIds: string[]): CascadeReceipt {
    const receipt: CascadeReceipt = {
      entityProperties: 0,
      evidenceTrims: { relationships: 0, profileItems: 0 },
      orphansArchived: { entities: 0, relationships: 0 },
      recompute: { reflectionsRedacted: 0, reflectionsRetracted: 0, profileDemoted: 0 },
    };
    if (messageIds.length === 0) return receipt;
    const deleted = new Set(messageIds);
    const nowTs = now();
    const ph = messageIds.map(() => '?').join(', ');

    // Track entities whose evidence we touched, to re-check for orphan status.
    const touchedEntities = new Set<string>();

    // 1. entity_properties sourced from deleted messages -> delete (orphan props).
    try {
      const props = this.db
        .prepare(`SELECT id, entity_id FROM entity_properties WHERE source_message_id IN (${ph})`)
        .all(...messageIds) as Array<{ id: number; entity_id: string }>;
      for (const p of props) touchedEntities.add(p.entity_id);
      const info = this.db
        .prepare(`DELETE FROM entity_properties WHERE source_message_id IN (${ph})`)
        .run(...messageIds);
      receipt.entityProperties = info.changes;
    } catch {
      /* table shape differences */
    }

    // 2. relationships: trim evidence arrays; delete those left with no evidence.
    try {
      const rels = this.db
        .prepare(
          `SELECT id, from_entity_id, to_entity_id, evidence_message_ids_json
             FROM relationships
            WHERE evidence_message_ids_json IS NOT NULL`,
        )
        .all() as Array<{
        id: number;
        from_entity_id: string;
        to_entity_id: string;
        evidence_message_ids_json: string;
      }>;
      const trim = this.db.prepare(
        `UPDATE relationships SET evidence_message_ids_json = ?, updated_at = ? WHERE id = ?`,
      );
      const del = this.db.prepare(`DELETE FROM relationships WHERE id = ?`);
      for (const r of rels) {
        let ids: unknown[];
        try {
          ids = JSON.parse(r.evidence_message_ids_json);
        } catch {
          continue;
        }
        if (!Array.isArray(ids)) continue;
        const kept = ids.filter((x) => !deleted.has(String(x)));
        if (kept.length === ids.length) continue; // untouched
        touchedEntities.add(r.from_entity_id);
        touchedEntities.add(r.to_entity_id);
        if (kept.length === 0) {
          del.run(r.id);
          receipt.orphansArchived.relationships += 1;
        } else {
          trim.run(JSON.stringify(kept), nowTs, r.id);
          receipt.evidenceTrims.relationships += 1;
        }
      }
    } catch {
      /* ignore */
    }

    // 3. Orphan entities: those with no remaining properties and no relationships
    //    and zero mentions -> archive (the name may live in other sources).
    try {
      for (const eid of touchedEntities) {
        const propCount = (
          this.db
            .prepare(`SELECT COUNT(*) AS c FROM entity_properties WHERE entity_id = ?`)
            .get(eid) as { c: number }
        ).c;
        const relCount = (
          this.db
            .prepare(
              `SELECT COUNT(*) AS c FROM relationships WHERE from_entity_id = ? OR to_entity_id = ?`,
            )
            .get(eid, eid) as { c: number }
        ).c;
        if (propCount === 0 && relCount === 0) {
          const info = this.db
            .prepare(
              `UPDATE entities SET status = 'archived', updated_at = ?
                WHERE id = ? AND status = 'active'`,
            )
            .run(nowTs, eid);
          receipt.orphansArchived.entities += info.changes;
        }
      }
    } catch {
      /* ignore */
    }

    // 4. user_profile_items: trim evidence_refs; demote when below promotion floor.
    try {
      const items = this.db
        .prepare(
          `SELECT id, evidence_refs, status, user_confirmed FROM user_profile_items
            WHERE evidence_refs IS NOT NULL`,
        )
        .all() as Array<{
        id: string;
        evidence_refs: string;
        status: string;
        user_confirmed: number;
      }>;
      const upd = this.db.prepare(
        `UPDATE user_profile_items SET evidence_refs = ?, status = ?, updated_at = ? WHERE id = ?`,
      );
      for (const it of items) {
        let refs: unknown[];
        try {
          refs = JSON.parse(it.evidence_refs);
        } catch {
          continue;
        }
        if (!Array.isArray(refs)) continue;
        const kept = refs.filter((r) => {
          const mid =
            r && typeof r === 'object'
              ? String((r as Record<string, unknown>).message_id ?? (r as Record<string, unknown>).messageId ?? '')
              : String(r);
          return !deleted.has(mid);
        });
        if (kept.length === refs.length) continue;
        let status = it.status;
        // Only auto-demote inferred items the user did not confirm.
        if (!it.user_confirmed && status === 'active' && kept.length < PROFILE_PROMOTION_MIN_EVIDENCE) {
          status = kept.length === 0 ? 'archived' : 'candidate';
          receipt.recompute.profileDemoted += 1;
        }
        upd.run(JSON.stringify(kept), status, nowTs, it.id);
        receipt.evidenceTrims.profileItems += 1;
      }
    } catch {
      /* ignore */
    }

    // 5. reflection_artifacts: redact / retract those citing deleted messages.
    if (this.hasColumn('reflection_artifacts', 'evidence_redacted')) {
      try {
        const arts = this.db
          .prepare(
            `SELECT id, source_message_ids_json FROM reflection_artifacts
              WHERE source_message_ids_json IS NOT NULL AND retracted = 0`,
          )
          .all() as Array<{ id: string; source_message_ids_json: string }>;
        const redact = this.db.prepare(
          `UPDATE reflection_artifacts SET evidence_redacted = 1 WHERE id = ?`,
        );
        const retract = this.db.prepare(
          `UPDATE reflection_artifacts SET evidence_redacted = 1, retracted = 1 WHERE id = ?`,
        );
        for (const a of arts) {
          let ids: unknown[];
          try {
            ids = JSON.parse(a.source_message_ids_json);
          } catch {
            continue;
          }
          if (!Array.isArray(ids) || ids.length === 0) continue;
          const remaining = ids.filter((x) => !deleted.has(String(x)));
          if (remaining.length === ids.length) continue;
          if (remaining.length === 0) {
            retract.run(a.id);
            receipt.recompute.reflectionsRetracted += 1;
          } else {
            redact.run(a.id);
            receipt.recompute.reflectionsRedacted += 1;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return receipt;
  }

  /**
   * Integrity reconcile: count residual orphans/dirty arrays (used by the
   * memory-integrity-check tool). Read-only.
   */
  integrityScan(): {
    orphanEntityProperties: number;
    dirtyRelationshipEvidence: number;
    vecOrphans: number;
  } {
    const orphanEntityProperties = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS c FROM entity_properties ep
            WHERE ep.source_message_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM messages_raw m WHERE m.id = ep.source_message_id)`,
        )
        .get() as { c: number }
    ).c;

    let dirtyRelationshipEvidence = 0;
    try {
      const rels = this.db
        .prepare(
          `SELECT evidence_message_ids_json FROM relationships WHERE evidence_message_ids_json IS NOT NULL`,
        )
        .all() as Array<{ evidence_message_ids_json: string }>;
      for (const r of rels) {
        let ids: unknown[];
        try {
          ids = JSON.parse(r.evidence_message_ids_json);
        } catch {
          continue;
        }
        if (!Array.isArray(ids)) continue;
        for (const id of ids) {
          const exists = this.db
            .prepare(`SELECT 1 FROM messages_raw WHERE id = ?`)
            .get(String(id));
          if (!exists) {
            dirtyRelationshipEvidence += 1;
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }

    let vecOrphans = 0;
    try {
      vecOrphans = (
        this.db
          .prepare(
            `SELECT COUNT(*) AS c FROM chunks_vec v
              WHERE NOT EXISTS (SELECT 1 FROM chunks c WHERE c.chunk_id = v.chunk_id)`,
          )
          .get() as { c: number }
      ).c;
    } catch {
      /* vec absent */
    }

    return { orphanEntityProperties, dirtyRelationshipEvidence, vecOrphans };
  }
}
