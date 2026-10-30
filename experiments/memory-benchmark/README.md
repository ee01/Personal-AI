# Memory benchmark harness (E-144 / E-158)

Shared evaluation framework for E-141 parallel memory schemes **A–E**. All scheme-specific code implements `MemoryBenchmarkAdapter`; this package owns replay, probes, scoring, cost tracking, and reports.

## Layout

```
experiments/memory-benchmark/
├── adapters/          # stub + future scheme adapters (A–E live in sibling tasks)
├── fixtures/          # synthetic smoke data (production JSONL stays local-only)
├── src/
│   ├── clock/         # virtual time, replay, authority fixtures
│   ├── data/          # Phase 1 JSONL + storyline index loaders
│   ├── scene/         # adapter-visible decide/recall inputs (golden isolated)
│   ├── scoring/       # probe runner + S=100×(0.30F+0.25E+0.25D+0.10N+0.10L)
│   ├── cost/          # LLM usage + $50 cap
│   ├── gates/         # delete/revoke/export acceptance (incl. derived + cache)
│   ├── report/        # Markdown + JSON, storyline bootstrap 95% CI
│   └── cli/           # entrypoint
└── tests/
```

## Adapter contract

```ts
interface MemoryBenchmarkAdapter {
  schemeId: string;
  ingest(event): Promise<void>;
  consolidate(virtualNow): Promise<ConsolidateResult>;
  recall(query, asOf, scope): Promise<RecallResult>;
  decide(input): Promise<DecideResult>; // scene/as_of/scope + scene_input only
  export(): Promise<Record<string, unknown>>;
  delete(eventId): Promise<void>;
  revoke(scope): Promise<void>;
}
```

**Golden isolation:** `ProbePoint` carries rubric fields (`required_facts`, `visible_evidence_ids`, …) for the scorer only. `buildAdapterDecideInput` / `buildAdapterRecallQuery` pass `scene_input` (allowlisted scene fields) — adapters must not read golden.

## Virtual clock replay

- Events play in `observed_at` order; visibility uses `observed_at ≤ virtual_now` (no wall-clock mutation).
- **At most one** `consolidate(virtualNow)` per virtual UTC day, after that day’s events, with pre/post consolidation checkpoints.
- **Probes run at checkpoints during replay** (not after a full pass). Each probe’s `as_of` must be ≤ the checkpoint’s `virtual_now`. Set per-probe `checkpoint`: `pre_consolidation` | `post_consolidation` (default `post_consolidation`).
- Authority lookups use `fixtures/.../authority.json` (status changes by virtual day — no live ticket APIs).
- Notifications go to `NotificationSink` (record-only).

## Scoring

- **Composite**: `S = 100 × (0.30F + 0.25E + 0.25D + 0.10N + 0.10L)` per Memory 顾问设计.
- **Hard gates** (instant fail): future evidence, revoked/deleted content still returned, forbidden assertions, disallowed actions.
- Deterministic checks here; frozen-rubric blind review is a separate human pass (E-147+).

## Delete / revoke gates

`runDeleteRevokeGate` warms recall + consolidation, then checks recall, **export derived snippets**, **recall cache**, and in-flight consolidation — not just primary event storage.

## Cost & modes

- `CostTracker` records calls, tokens, USD, p50/p95/p99 latency; separates **cached replay** vs **live inference**.
- Default budget **$50** per scheme run (`--budget-usd`).
- `mode: quality | capacity` — quality waits for real inference; capacity is for throughput experiments (same report fields).

## Run (synthetic smoke)

```bash
cd experiments/memory-benchmark
npm install
npm run demo
# or
npm run run -- --fixture synthetic-mini --scheme stub --out ./out
```

### Production Phase 1 dataset (local paths only)

```bash
npm run run -- \
  --events ../../memory-service/evals/personal-memory-dataset/raw-only/events.jsonl \
  --probes ./fixtures/synthetic-mini/probes.jsonl \
  --authority ./fixtures/synthetic-mini/authority.json \
  --scheme stub \
  --out ./out
```

(`events.jsonl` is gitignored — export via `memory-service` `export:eval-dataset-phase1`.)

Committed smoke sample (no production text): `memory-service/evals/personal-memory-dataset/synthetic-sample-events.jsonl` — validated in tests.

## Tests

```bash
npm test
npm run typecheck
```

## Related

- Dataset schema: `memory-service/evals/personal-memory-dataset/schema.json`
- Parent decision: E-141 / `docs/progressing/e141-memory-core-decision-demo.html`
