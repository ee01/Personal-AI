/**
 * v3 ExtractionWorker (memory-foundation plan §6.1/§6.4, §11.6):
 * shadow dual-write pipeline for new episodes.
 *
 *   episode persisted → ingest_jobs(queued)  [MEMORY_WRITE_V3_SHADOW]
 *   claim (conditional UPDATE on queued/expired lease)
 *   → LLM extract (strict contract)
 *   → freeze batch into ingest_extraction_results (result_hash)
 *   → integrate each candidate via UnitTruthMaintainer with
 *     work_unit_key = job_id + result_hash + ordinal (I5 idempotent)
 *   → extracted_zero (terminal success) | integrated | dead_letter
 *
 * Failure states are explicit and visible: LLM/parse failures are
 * retryable up to MAX_ATTEMPTS, then dead_letter — never a fabricated
 * unit and never a silent skip (plan §6.4).
 */

import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';

import { getLLMClient } from '../../llm/LLMClient.js';
import { EpisodeRepository } from './EpisodeRepository.js';
import { UnitTruthMaintainer, type UnitEvidenceClass } from './UnitTruthMaintainer.js';
import {
  EXTRACTION_CONTRACT_VERSION,
  extractionPrompt,
  parseExtractionBatch,
} from './ExtractionContract.js';

export const MAX_EXTRACTION_ATTEMPTS = 3;
const RETRY_DELAY_SECONDS = [60, 300, 900];
const LEASE_SECONDS = 120;

export interface WorkerStats {
  claimed: number;
  integrated: number;
  zeroFact: number;
  retryable: number;
  deadLettered: number;
}

export function isV3ShadowWriteEnabled(): boolean {
  const raw = process.env.MEMORY_WRITE_V3_SHADOW?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export class ExtractionWorker {
  private readonly episodes: EpisodeRepository;
  private readonly truth: UnitTruthMaintainer;

  constructor(
    private readonly db: Database.Database,
    private readonly userId: string,
  ) {
    this.episodes = new EpisodeRepository(db);
    this.truth = new UnitTruthMaintainer(db, this.episodes);
  }

  /** Enqueue a shadow job for a freshly persisted episode. No-op without flag. */
  enqueueEpisode(episodeId: string): string | null {
    if (!isV3ShadowWriteEnabled()) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const jobId = `job-${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO ingest_jobs
          (job_id, episode_id, contract_version, status, attempts, next_attempt_at,
           leased_by, leased_until, last_error_class, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', 0, NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(jobId, episodeId, EXTRACTION_CONTRACT_VERSION, nowSec, nowSec);
    return jobId;
  }

  /** Process up to `limit` due jobs. Returns visible counters (never silent). */
  async processDueJobs(limit = 5): Promise<WorkerStats> {
    const stats: WorkerStats = {
      claimed: 0, integrated: 0, zeroFact: 0, retryable: 0, deadLettered: 0,
    };
    for (let i = 0; i < limit; i += 1) {
      const job = this.claimJob();
      if (!job) break;
      stats.claimed += 1;
      const outcome = await this.processJob(job);
      if (outcome === 'integrated') stats.integrated += 1;
      else if (outcome === 'zero') stats.zeroFact += 1;
      else if (outcome === 'retryable') stats.retryable += 1;
      else if (outcome === 'dead_letter') stats.deadLettered += 1;
    }
    return stats;
  }

  private claimJob():
    | { jobId: string; episodeId: string; attempts: number }
    | null {
    const nowSec = Math.floor(Date.now() / 1000);
    const due = this.db
      .prepare(
        `SELECT job_id, episode_id, attempts FROM ingest_jobs
         WHERE status IN ('queued', 'failed_retryable')
           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         ORDER BY created_at ASC LIMIT 1`,
      )
      .get(nowSec) as { job_id: string; episode_id: string; attempts: number } | undefined;
    if (!due) return null;
    const leasedBy = `worker-${this.userId}`;
    const claimed = this.db
      .prepare(
        `UPDATE ingest_jobs
         SET status = 'claimed', leased_by = ?, leased_until = ?,
             attempts = attempts + 1, updated_at = ?
         WHERE job_id = ? AND status IN ('queued', 'failed_retryable')
           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
      )
      .run(leasedBy, nowSec + LEASE_SECONDS, nowSec, due.job_id, nowSec);
    if (claimed.changes !== 1) return null; // raced with another worker
    return { jobId: due.job_id, episodeId: due.episode_id, attempts: due.attempts + 1 };
  }

  private async processJob(
    job: { jobId: string; episodeId: string; attempts: number },
  ): Promise<'integrated' | 'zero' | 'retryable' | 'dead_letter'> {
    const episode = this.episodes.get(job.episodeId);
    if (!episode) {
      this.finishJob(job.jobId, 'dead_letter', 'episode_missing');
      return 'dead_letter';
    }

    // Frozen-batch replay (plan §6.4): integration retries read the already
    // frozen candidate batch; they must NOT re-sample the model.
    const frozen = this.db
      .prepare(
        `SELECT candidate_batch_json FROM ingest_extraction_results WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(job.jobId) as { candidate_batch_json: string } | undefined;

    let batchRaw: unknown;
    if (frozen) {
      batchRaw = JSON.parse(frozen.candidate_batch_json);
    } else {
      try {
        const llm = getLLMClient();
        const response = await llm.generate(extractionPrompt({
          content: episode.content,
          sender: episode.sender,
          groupName: episode.groupName,
          sourceType: episode.sourceType,
          timestamp: episode.timestamp,
        }));
        batchRaw = this.parseJsonLoose(response.content);
      } catch (err) {
        return this.handleRetryable(job, 'llm_error', (err as Error).message);
      }
    }

    const parsed = parseExtractionBatch(
      batchRaw,
      Buffer.byteLength(episode.content, 'utf8'),
    );
    if (!parsed.ok) {
      return this.handleRetryable(job, 'contract_violation', parsed.reason);
    }

    // Freeze the parsed batch: integration retries must NOT re-sample the
    // model (plan §6.4) — they replay this exact candidate set.
    const batchJson = JSON.stringify({
      contractVersion: parsed.batch.contractVersion,
      candidates: parsed.batch.candidates,
      skipReason: parsed.batch.skipReason ?? null,
    });
    const resultHash = createHash('sha256').update(batchJson, 'utf8').digest('hex');
    this.db
      .prepare(
        `INSERT OR REPLACE INTO ingest_extraction_results
          (job_id, result_hash, contract_version, candidate_batch_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(job.jobId, resultHash, EXTRACTION_CONTRACT_VERSION, batchJson, Math.floor(Date.now() / 1000));

    if (parsed.batch.candidates.length === 0) {
      // Zero facts is a terminal SUCCESS with a visible reason.
      this.finishJob(job.jobId, 'extracted_zero', parsed.batch.skipReason ?? 'no_durable_memory');
      return 'zero';
    }

    let integrated = 0;
    for (const [ordinal, candidate] of parsed.batch.candidates.entries()) {
      const workUnitKey = `${job.jobId}:${resultHash}:${ordinal}`;
      const evidenceClass = this.deriveEvidenceClass(episode);
      const result = this.truth.propose(
        {
          memoryForm: candidate.memoryForm,
          kind: candidate.kind,
          subjectKey: candidate.subjectKey,
          predicateKey: candidate.predicateKey,
          text: candidate.text,
          language: candidate.language,
          observedAt: candidate.observedAt ?? episode.timestamp,
          scopeLocator: episode.scope ?? undefined,
          sensitivity: episode.trustClass === 'untrusted' ? 'private' : 'internal',
        },
        [
          {
            episodeId: job.episodeId,
            spanStart: candidate.spanStart,
            spanEnd: candidate.spanEnd,
            sourceRole: 'extraction',
            evidenceKey: `${job.episodeId}:${candidate.spanStart}-${candidate.spanEnd}`,
            provenanceFamily: job.episodeId,
            originType: episode.sourceType,
            evidenceClass,
          },
        ],
        {
          actorType: 'llm',
          actorId: 'v3-extraction-worker',
          userId: this.userId,
        },
        workUnitKey,
      );
      void result;
      integrated += 1;
    }

    this.finishJob(job.jobId, 'integrated', `${integrated} units`);
    return 'integrated';
  }

  /**
   * Deterministic evidence_class from the authenticated source envelope —
   * never from LLM output (plan §6.4: policy can only be inherited or
   * tightened, never upgraded by inference).
   */
  private deriveEvidenceClass(episode: {
    sourceType: string; sender: string | null;
  }): UnitEvidenceClass {
    if (episode.sourceType === 'calendar' || episode.sourceType === 'jira') {
      return 'first_party_record';
    }
    if (episode.sourceType === 'web') return 'third_party_report';
    if (episode.sourceType === 'manual') return 'self_statement';
    return episode.sender ? 'self_statement' : 'third_party_report';
  }

  private handleRetryable(
    job: { jobId: string; episodeId: string; attempts: number },
    errorClass: string,
    detail: string,
  ): 'retryable' | 'dead_letter' {
    const nowSec = Math.floor(Date.now() / 1000);
    if (job.attempts >= MAX_EXTRACTION_ATTEMPTS) {
      this.db
        .prepare(
          `UPDATE ingest_jobs
           SET status = 'dead_letter', last_error_class = ?, next_attempt_at = NULL, updated_at = ?
           WHERE job_id = ?`,
        )
        .run(`${errorClass}: ${detail.slice(0, 200)}`, nowSec, job.jobId);
      return 'dead_letter';
    }
    const delay = RETRY_DELAY_SECONDS[Math.min(job.attempts - 1, RETRY_DELAY_SECONDS.length - 1)];
    this.db
      .prepare(
        `UPDATE ingest_jobs
         SET status = 'failed_retryable', last_error_class = ?,
             next_attempt_at = ?, updated_at = ?
         WHERE job_id = ?`,
      )
      .run(`${errorClass}: ${detail.slice(0, 200)}`, nowSec + delay, nowSec, job.jobId);
    return 'retryable';
  }

  private finishJob(jobId: string, status: string, detail: string): void {
    this.db
      .prepare(
        `UPDATE ingest_jobs
         SET status = ?, last_error_class = COALESCE(?, last_error_class),
             leased_by = NULL, leased_until = NULL, next_attempt_at = NULL, updated_at = ?
         WHERE job_id = ?`,
      )
      .run(status, status === 'extracted_zero' || status === 'integrated' ? detail : null,
        Math.floor(Date.now() / 1000), jobId);
  }

  private parseJsonLoose(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('no JSON object found in extraction output');
    }
  }
}
