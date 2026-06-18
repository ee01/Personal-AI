/**
 * Tests for P1-7 AnticipationService: deterministic subject collection, brief
 * generation with an injected synthesizer, and findPrior consume/expiry.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { AnticipationService, type AnticipationSubject } from '../core/AnticipationService.js';
import { now } from '../utils/time.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeAll(() => {
  db = getTestDb();
});
afterAll(() => {
  cleanupTestDb();
});
beforeEach(() => {
  db.prepare('DELETE FROM anticipation_briefs').run();
  try {
    db.prepare('DELETE FROM calendar_events').run();
  } catch {
    /* ignore */
  }
  try {
    db.prepare('DELETE FROM reflection_threads').run();
  } catch {
    /* ignore */
  }
});

const stubSynth = async (s: AnticipationSubject): Promise<string> =>
  `预答（${s.kind}）：关于「${s.subjectKey}」的要点……`;

describe('AnticipationService', () => {
  it('collects upcoming meetings and open reflection topics as subjects', () => {
    const ts = now();
    db.prepare(
      `INSERT INTO calendar_events (id, source_system, external_id, title, start_at, content_hash, synced_at, created_at, updated_at)
       VALUES ('ev1', 'gcal', 'x1', 'Q3 Planning standup', ?, 'h1', ?, ?, ?)`,
    ).run(ts + 3600, ts, ts, ts);

    const svc = new AnticipationService(db, stubSynth);
    const subjects = svc.collectSubjects(ts);
    expect(subjects.some((s) => s.kind === 'meeting' && s.subjectKey.includes('Q3 Planning'))).toBe(true);
  });

  it('generates briefs and findPrior matches + consumes once', async () => {
    const ts = now();
    db.prepare(
      `INSERT INTO calendar_events (id, source_system, external_id, title, start_at, content_hash, synced_at, created_at, updated_at)
       VALUES ('ev2', 'gcal', 'x2', 'XLSX 导出回归评审', ?, 'h2', ?, ?, ?)`,
    ).run(ts + 7200, ts, ts, ts);

    const svc = new AnticipationService(db, stubSynth);
    const written = await svc.generate({ nowTs: ts });
    expect(written).toBeGreaterThanOrEqual(1);

    // A question whose subject overlaps the brief's subject key.
    const prior = svc.findPrior(['XLSX 导出回归评审'], ts + 60);
    expect(prior).not.toBeNull();
    expect(prior!.briefMd).toContain('预答');

    // Consumed: a second lookup returns null.
    const second = svc.findPrior(['XLSX 导出回归评审'], ts + 120);
    expect(second).toBeNull();
  });

  it('does not return expired briefs and prunes them', async () => {
    const ts = now();
    db.prepare(
      `INSERT INTO anticipation_briefs (id, kind, subject_key, brief_md, valid_until, created_at)
       VALUES ('b-exp', 'topic', 'old topic', 'stale', ?, ?)`,
    ).run(ts - 10, ts - 100);

    const svc = new AnticipationService(db);
    expect(svc.findPrior(['old topic'], ts)).toBeNull();
    expect(svc.pruneExpired(ts)).toBe(1);
  });
});
