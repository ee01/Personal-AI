import type Database from "better-sqlite3";
import { bumpAclEpoch, getMeta } from "./db.js";

const MAX_KNOWN_TO = 9223372036854775807;

export interface FactCandidate {
  subject: string;
  predicate: string;
  object: string;
  class: string;
  observedAtMs: number;
  scope: string;
  evidenceEventId: string;
  evidenceSourceVersion: string;
}

/** Spec-aligned facade: CAS revisions, supersede, retract on delete/revoke, cache epoch bumps. */
export class NewCoreTruthMaintainer {
  constructor(private db: Database.Database) {}

  appendFact(candidate: FactCandidate): { fact_id: string; revision: number; decision: string } {
    const factId = `${candidate.subject}:${candidate.predicate}`;
    const active = this.db
      .prepare(
        `SELECT revision, object_text, status FROM fact_revisions
         WHERE fact_id=? AND known_to_ms=? AND status IN ('active','candidate')
         ORDER BY revision DESC LIMIT 1`,
      )
      .get(factId, MAX_KNOWN_TO) as
      | { revision: number; object_text: string; status: string }
      | undefined;

    if (active && active.object_text.trim() === candidate.object.trim()) {
      return { fact_id: factId, revision: active.revision, decision: "corroborated" };
    }

    if (active && active.object_text.trim() !== candidate.object.trim()) {
      this.db
        .prepare(
          `UPDATE fact_revisions SET status='superseded', known_to_ms=?
           WHERE fact_id=? AND revision=?`,
        )
        .run(candidate.observedAtMs, factId, active.revision);
    }

    const revRow = this.db
      .prepare("SELECT MAX(revision) AS r FROM fact_revisions WHERE fact_id = ?")
      .get(factId) as { r: number | null };
    const revision = (revRow.r ?? 0) + 1;
    this.db
      .prepare(
        `INSERT INTO fact_revisions (
        fact_id, revision, subject, predicate, object_text, status, assertion_class,
        observed_at_ms, known_from_ms, known_to_ms, scope, evidence_event_id, evidence_source_version
      ) VALUES (?,?,?,?,?,'active',?,?,?,?,?,?,?)`,
      )
      .run(
        factId,
        revision,
        candidate.subject,
        candidate.predicate,
        candidate.object,
        candidate.class,
        candidate.observedAtMs,
        candidate.observedAtMs,
        MAX_KNOWN_TO,
        candidate.scope,
        candidate.evidenceEventId,
        candidate.evidenceSourceVersion,
      );
    return { fact_id: factId, revision, decision: active ? "superseded" : "created" };
  }

  retractEvidence(eventId: string, atMs: number): void {
    this.db
      .prepare(
        `UPDATE fact_revisions SET status='retracted', known_to_ms=MIN(known_to_ms, ?)
         WHERE evidence_event_id=? AND status IN ('active','candidate')`,
      )
      .run(atMs, eventId);
    this.db
      .prepare(
        `UPDATE artifacts SET status='retracted', known_to_ms=MIN(known_to_ms, ?)
         WHERE evidence_refs_json LIKE ? AND status='active'`,
      )
      .run(atMs, `%${eventId}%`);
    bumpAclEpoch(this.db);
  }

  retractScope(scope: string, atMs: number): void {
    this.db
      .prepare(
        `UPDATE fact_revisions SET status='retracted', known_to_ms=MIN(known_to_ms, ?)
         WHERE scope=? AND status IN ('active','candidate')`,
      )
      .run(atMs, scope);
    this.db
      .prepare(
        `UPDATE artifacts SET status='retracted', known_to_ms=MIN(known_to_ms, ?)
         WHERE scope=? AND status='active'`,
      )
      .run(atMs, scope);
    bumpAclEpoch(this.db);
  }

  aclEpoch(): number {
    return Number(getMeta(this.db, "acl_epoch")) || 0;
  }
}
