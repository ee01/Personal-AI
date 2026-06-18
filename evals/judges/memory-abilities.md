# Judge Rubric — Memory Abilities Benchmark (P0-1)

This suite is judged by a **deterministic heuristic**, not an LLM. The
"benchmark wars" (Mem0 vs Zep vs Letta) showed that swapping the judge model
moves LoCoMo scores by ~10 points; we sidestep that by pinning the judge to
golden facts grounded in the real online data, with zero model variance.

Runner: `tools/eval-memory-abilities.ts` (standalone; hits a live
`/ask` endpoint with real user data).

## Abilities

Six abilities, LongMemEval-style five plus prospective:

| ability | what it checks |
| --- | --- |
| `extraction` | single-topic fact retrieval surfaces the real grounded facts |
| `multi_session` | cross-conversation synthesis pulls facts from multiple sources |
| `temporal` | the answer carries the durable fact plus a time anchor |
| `knowledge_update` | the answer reflects the latest state (current policy/value) |
| `abstention` | for an absent topic, the answer must NOT fabricate a specific |
| `prospective` | surfaces what still needs following up |

## Scoring

Each case carries a `judge` block. The haystack is the answer text plus all
returned evidence content, lowercased.

- **grounded** (`type: "grounded"`):
  - `mustMention` is an array of OR-groups. A group passes if any alternative is
    a substring of the haystack. `score = groupsHit / groupsTotal`.
  - `mustNotMention` literals must be absent (any hit fails the case).
  - Pass when `score >= passThreshold` (default 0.7) and no forbidden literal.
- **abstain** (`type: "abstain"`):
  - `forbidPatterns` (regex) are matched against the **answer only** (evidence
    may legitimately carry unrelated times). Any match = fabrication = fail.
  - Pass (score 1.0) when no forbidden pattern matches.

## Live-recall variance & attempts

The judge is deterministic, but the **subject** is a live server: recall ordering
plus the LLM-timeout deterministic-summary return a slightly different evidence
set per call, so a golden keyword can occasionally fall outside the returned
set. To stop that from spuriously failing the gate, the runner takes
`--attempts` (default 2) per case:

- **grounded** cases keep the **best** score across attempts (tolerate a
  transient recall miss);
- **abstention** keeps the **worst** score across attempts (never tolerate even
  an intermittent fabrication).

A persistent drop (failing every attempt) still regresses the gate.

## Baseline & regression

`evals/.baseline/memory-abilities.json` stores `overall` + per-ability scores.
A run fails (exit 1) if any ability drops more than 0.05 below baseline. Re-run
after any recall- or write-path change (PPR, behavior affinity, merge/evolution)
and before shipping.

## Known boundary (a real finding)

The precise bitemporal values in `entity_properties` (TruthMaintainer) — e.g. a
Jira DEV Estimate that changed 3 → 3.01 — are **not surfaced by `/ask`'s recall
channels**. So `temporal`/`knowledge_update` here are grounded on message-level
evolving facts, not the bitemporal layer. Exercising the bitemporal layer
end-to-end is future work (see `docs/progressing/memory-merge-evolution-ttl-plan.md`).
