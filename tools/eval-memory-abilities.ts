/**
 * Memory-abilities benchmark runner (P0-1).
 *
 * Hits a live memory-service /ask endpoint with real user data and scores the
 * answers across six abilities (LongMemEval-style five + prospective):
 * extraction / multi_session / temporal / knowledge_update / abstention /
 * prospective.
 *
 * The judge is a DETERMINISTIC heuristic (keyword groups + forbidden patterns)
 * keyed on golden facts that were grounded in the real online data. There is no
 * judge-model variance — the basis-of-truth problem flagged by the LongMemEval
 * "benchmark wars" is sidestepped by pinning the judge to the data, not an LLM.
 *
 * Usage (from repo root):
 *   memory-service/node_modules/.bin/tsx tools/eval-memory-abilities.ts \
 *     --endpoint http://10.32.56.212:3210/api/v1/ask --user esone.qiu \
 *     [--cases evals/cases/memory-abilities/cases.jsonl] \
 *     [--out .eval-runs/memory-abilities] [--update-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';

import { parseArgs, readJsonlFile, ensureDir } from './eval-lib.mjs';

interface JudgeSpec {
  type: 'grounded' | 'abstain';
  mustMention?: string[][];
  mustNotMention?: string[];
  forbidPatterns?: string[];
  passThreshold?: number;
}
interface AbilityCase {
  id: string;
  ability: string;
  question: string;
  context?: string;
  scope?: string;
  judge: JudgeSpec;
  note?: string;
}
interface AskEvidence {
  content?: string;
  source?: string;
  sourceTitle?: string;
}
interface AskResponse {
  answer?: string;
  evidence?: AskEvidence[];
  contextMatch?: { state?: string };
}
interface CaseResult {
  id: string;
  ability: string;
  question: string;
  ok: boolean;
  verdict: 'pass' | 'fail' | 'error';
  score: number;
  groupsHit?: number;
  groupsTotal?: number;
  forbiddenHit?: boolean;
  answerPreview: string;
  evidenceCount: number;
  proofChecks: string[];
  error?: string;
}

const args = parseArgs();
const ENDPOINT = String(args.endpoint || 'http://10.32.56.212:3210/api/v1/ask');
const USER = String(args.user || 'esone.qiu');
const CASES = String(args.cases || 'evals/cases/memory-abilities/cases.jsonl');
const OUT = String(args.out || '.eval-runs/memory-abilities');
const BASELINE = String(args.baseline || 'evals/.baseline/memory-abilities.json');
const TIMEOUT_MS = Number(args.timeout || 70_000);
const UPDATE_BASELINE = Boolean(args.updateBaseline);
const ATTEMPTS = Math.max(1, Number(args.attempts || 2));
const REGRESSION_DELTA = 0.05;

function lc(s: string): string {
  return (s || '').toLowerCase();
}

async function ask(c: AbilityCase): Promise<AskResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': USER },
      body: JSON.stringify({
        query: c.question,
        context: c.context,
        scope: c.scope || 'all',
        includeEvidence: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as AskResponse;
  } finally {
    clearTimeout(timer);
  }
}

function judge(c: AbilityCase, resp: AskResponse): CaseResult {
  const answer = resp.answer || '';
  const evidence = resp.evidence || [];
  const haystack = lc(answer + '\n' + evidence.map((e) => e.content || '').join('\n'));
  const j = c.judge;
  const proofChecks: string[] = [];
  const base = {
    id: c.id,
    ability: c.ability,
    question: c.question,
    ok: true,
    answerPreview: answer.slice(0, 220).replace(/\s+/g, ' '),
    evidenceCount: evidence.length,
  };

  if (j.type === 'abstain') {
    const patterns = j.forbidPatterns || [];
    const matched = patterns.filter((p) => new RegExp(p, 'i').test(answer));
    const forbiddenHit = matched.length > 0;
    proofChecks.push(
      forbiddenHit
        ? `✗ answer fabricated a forbidden specific: ${matched.join(', ')}`
        : `✓ answer did not fabricate any absent specific (${patterns.length} patterns clean)`,
    );
    return {
      ...base,
      verdict: forbiddenHit ? 'fail' : 'pass',
      score: forbiddenHit ? 0 : 1,
      forbiddenHit,
      proofChecks,
    };
  }

  // grounded
  const groups = j.mustMention || [];
  const hits = groups.map((g) => ({
    group: g,
    hit: g.find((alt) => haystack.includes(lc(alt))) || null,
  }));
  const groupsHit = hits.filter((h) => h.hit).length;
  const score = groups.length ? groupsHit / groups.length : 0;
  const forbidden = (j.mustNotMention || []).filter((x) => haystack.includes(lc(x)));
  const forbiddenHit = forbidden.length > 0;
  const threshold = j.passThreshold ?? 0.7;
  const pass = score >= threshold && !forbiddenHit;
  for (const h of hits) {
    proofChecks.push(
      h.hit
        ? `✓ surfaced [${h.group.slice(0, 3).join(' | ')}…] via "${h.hit}"`
        : `✗ missing any of [${h.group.slice(0, 4).join(' | ')}…]`,
    );
  }
  if (forbiddenHit) proofChecks.push(`✗ contained forbidden: ${forbidden.join(', ')}`);
  return {
    ...base,
    verdict: pass ? 'pass' : 'fail',
    score,
    groupsHit,
    groupsTotal: groups.length,
    forbiddenHit,
    proofChecks,
  };
}

async function main(): Promise<void> {
  const cases = (await readJsonlFile(CASES)) as AbilityCase[];
  const runId = `mem-abilities-${process.env.EVAL_RUN_STAMP || 'local'}`;
  const runDir = path.join(OUT, runId);
  await ensureDir(runDir);

  const results: CaseResult[] = [];
  for (const c of cases) {
    // Live recall has run-to-run variance (recall ordering + LLM-timeout
    // deterministic summary returns a slightly different evidence set each
    // call), so a single transient miss should not fail the gate. Grounded
    // cases take best-of-N (tolerate a transient recall miss); abstention takes
    // worst-of-N (never tolerate even an intermittent fabrication).
    const attemptResults: CaseResult[] = [];
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const resp = await ask(c);
        attemptResults.push(judge(c, resp));
        fs.appendFileSync(
          path.join(runDir, 'responses.jsonl'),
          JSON.stringify({ id: c.id, attempt, answer: resp.answer, evidenceCount: (resp.evidence || []).length }) + '\n',
        );
      } catch (err) {
        attemptResults.push({
          id: c.id,
          ability: c.ability,
          question: c.question,
          ok: false,
          verdict: 'error',
          score: 0,
          answerPreview: '',
          evidenceCount: 0,
          proofChecks: [`✗ request failed: ${(err as Error).message}`],
          error: (err as Error).message,
        });
      }
    }
    // abstention: keep the worst (min score); grounded: keep the best (max).
    const pick =
      c.judge.type === 'abstain'
        ? attemptResults.reduce((a, b) => (b.score < a.score ? b : a))
        : attemptResults.reduce((a, b) => (b.score > a.score ? b : a));
    if (ATTEMPTS > 1) {
      pick.proofChecks = [
        ...pick.proofChecks,
        `(best of ${ATTEMPTS} attempts; scores: ${attemptResults.map((r) => r.score.toFixed(2)).join(', ')})`,
      ];
    }
    results.push(pick);
  }

  const byAbility: Record<string, number> = {};
  for (const r of results) byAbility[r.ability] = Number(r.score.toFixed(3));
  const overall = Number(
    (results.reduce((s, r) => s + r.score, 0) / (results.length || 1)).toFixed(3),
  );
  const passCount = results.filter((r) => r.verdict === 'pass').length;

  // Baseline diff
  let baselineNote = 'no baseline (first run)';
  const regressions: string[] = [];
  if (fs.existsSync(BASELINE)) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as {
      overall: number;
      byAbility: Record<string, number>;
    };
    for (const r of results) {
      const prev = base.byAbility?.[r.ability];
      if (typeof prev === 'number' && prev - r.score > REGRESSION_DELTA) {
        regressions.push(`${r.ability}: ${prev.toFixed(2)} → ${r.score.toFixed(2)}`);
      }
    }
    baselineNote =
      regressions.length > 0
        ? `REGRESSIONS: ${regressions.join('; ')}`
        : `no regression vs baseline (overall ${base.overall} → ${overall})`;
  }

  const readerReport = {
    summary: {
      title: 'Memory Abilities Benchmark',
      headline: `${passCount}/${results.length} abilities passed · overall ${overall} · ${baselineNote}`,
      proved: results.filter((r) => r.verdict === 'pass').map((r) => `${r.ability}: ${r.question}`),
      notProved: results
        .filter((r) => r.verdict !== 'pass')
        .map((r) => `${r.ability} (${r.verdict}, score ${r.score.toFixed(2)})`),
      keyStats: [
        `endpoint=${ENDPOINT}`,
        `user=${USER}`,
        `overall=${overall}`,
        ...Object.entries(byAbility).map(([k, v]) => `${k}=${v}`),
      ],
      nextSteps: regressions.length
        ? ['Investigate regressed abilities before shipping recall/write changes.']
        : ['Baseline healthy; re-run after any recall/write-path change.'],
    },
    cases: results.map((r) => ({
      kindLabel: r.ability,
      caseGoal: r.question,
      inputSummary: r.question,
      expectedSummary:
        r.ability === 'abstention'
          ? 'must not fabricate the absent specific'
          : 'must surface the real grounded facts',
      actualSummary: r.answerPreview || `(error: ${r.error})`,
      proofChecks: r.proofChecks,
      outcomeSignals: [`score=${r.score.toFixed(2)}`, `evidence=${r.evidenceCount}`],
      conclusion: r.verdict,
      nextSteps: r.verdict === 'pass' ? [] : ['Review whether recall surfaced the grounding evidence.'],
    })),
  };

  await ensureDir(runDir);
  fs.writeFileSync(path.join(runDir, 'reader-report.json'), JSON.stringify(readerReport, null, 2));
  fs.writeFileSync(path.join(runDir, 'case-results.json'), JSON.stringify(results, null, 2));

  if (UPDATE_BASELINE) {
    await ensureDir(path.dirname(BASELINE));
    fs.writeFileSync(BASELINE, JSON.stringify({ overall, byAbility, updatedAt: new Date().toISOString() }, null, 2));
  }

  // Console summary
  console.log('\n=== Memory Abilities Benchmark ===');
  console.log(`endpoint: ${ENDPOINT}  user: ${USER}`);
  for (const r of results) {
    const mark = r.verdict === 'pass' ? 'PASS' : r.verdict === 'error' ? 'ERR ' : 'FAIL';
    console.log(`[${mark}] ${r.ability.padEnd(16)} score=${r.score.toFixed(2)}  ${r.id}`);
    for (const p of r.proofChecks) console.log(`        ${p}`);
  }
  console.log(`\noverall=${overall}  passed=${passCount}/${results.length}`);
  console.log(baselineNote);
  console.log(`report: ${path.join(runDir, 'reader-report.json')}`);

  if (regressions.length > 0) process.exitCode = 1;
}

await main();
