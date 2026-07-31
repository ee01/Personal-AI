# Evidence Cohesion Gate Implementation

## Goal

Implement Evidence Cohesion Gate incrementally across Personal AI consumption paths, prove that it improves evidence selection without rewriting stored memories, and finish with focused tests, experience evals, regression evidence, and canonical documentation.

## Scope

- P0: shared deterministic-first gate, `/ask`, Reflection Worker / external delegation boundary.
- P1: `context-recall` silent filtering and diagnostic receipt.
- Follow-up surfaces in this delivery: Compose Assist, Context Pack, and Web AI prompt patch where the current architecture exposes a shared evidence boundary.
- No raw-memory reclassification or duplicate storage. Persist only lightweight trace/receipt data if an existing trace path supports it.

## Phases

| Phase | Status | Outcome |
|---|---|---|
| 1. Audit current architecture and overlapping diffs | complete | Identified candidate types, existing gates, route contracts, and safe edit boundaries |
| 2. Implement shared EvidenceCohesionGateService | complete | Deterministic clustering, states, receipts, and focused unit tests |
| 3. Integrate P0 `/ask` | complete | Gate before answer prompt assembly; expose non-disruptive receipt and split behavior |
| 4. Integrate P0 Reflection Worker | complete | Gate before external delegation/confirm creation; fail closed on cross-topic evidence |
| 5. Build and run cohesion eval suite | complete | 6/6 deterministic cases passed; zero gated leaks, 100% required-evidence retention, Reader Contract passed |
| 6. Integrate P1 `context-recall` | complete | Final-display Gate, silent receipt, explicit-authority boundary, 37/37 focused tests passed |
| 7. Integrate Compose / Context Pack / Web AI | complete | Second consumption Gate protects recall bypasses, prompt compilation, context packs, and draft generation; 25/25 tests passed |
| 8. Canonical docs and progressing cleanup | complete | Added shared contract doc, updated entrypoint docs/index, moved demo, removed completed plan |
| 9. Final verification | in_progress | Targeted tests, build, eval validation/run, and diff checks passed; six-ability regression awaits an isolated runtime with current user data |

## Decisions

- Gate runs after candidate recall and before prompt/card/action consumption.
- Normal cohesive results are UI-light; split, insufficient, conflict, and external-action boundaries are explicit.
- P0 does not rewrite or permanently classify source memories.
- Existing user changes in the dirty worktree are preserved.
- Deterministic anchors and claim slots drive decisions; LLM judgment is optional and must not be required for the safe default.
- User-facing product wording is `证据对齐`; internal `EvidenceCohesionGate` and `cohesionReceipt` identifiers remain stable compatibility contracts.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Field tokens such as `attachment_id` merged unrelated subjects | Core service test run 1 | Treat claim/property tokens as generic for subject clustering |
| Weak unanchored candidates were reduced to the top item | Core service test run 1 | Preserve all evidence when the gate cannot prove multiple anchored subjects |
| Common word `the` created a false score margin and claim slots disappeared | Core service test run 2 | Expanded stopwords and separated claim-slot normalization from topic filtering |
| Ask cohesion type guard narrowed every passing result to `never` | Ask compile run 1 | Narrow only the three blocking cohesion states |
| Latent recall-expansion anchors blocked broad scope and historical Ask queries | Ask test run 1 | Pass scene anchors to Cohesion only for a locked topic or explicit user surface context |
| Unanchored historical Ask dropped a later change when the score margin was high | Ask focused test run 2 | Make Ask's unanchored `preserve` policy unconditional |
| Planning status patch used progress text as task-plan context | Planning update 1 | Split task-plan and progress edits and reapply against current content |
| New eval cases lacked the generic top-level input-context field | Eval validation run 1 | Copied each production request's `questionOrTask` into top-level `query` for registry/report validation |
| Partial JSONL `apply_patch` could not match a whole-line case | Eval fixture fix 1 | Used a structured Node JSONL rewrite to add the same field without hand-editing six long records |
| Context Recall blocking check did not narrow an optional Gate result | P1 compile run 1 | Converted the helper to a type predicate for the three fail-closed states |
| Inferred Context Expansion topic overrode a valid Cursor budget association | P1 full test run 1 | Restricted deletion authority to structured issue/project/source-topic/group/meeting anchors; inferred locked topics remain recall hints only |
| `GPT-5` matched the broad Jira-key regex and created a false query identity | P1 regression diagnosis | Excluded common AI model-version prefixes in the shared identifier extractor and added a focused Gate regression |
| Six Composer paths were suppressed by free-text `sourceContext.topic` | Compose baseline after P1 | Removed free-text topic from deletion authority; it remains available to recall expansion/ranking while only structured IDs can authorize Gate exclusion |
| Composer still lost cross-group, short slash-token, and unknown-scope evidence | Compose baseline run 2 | Made source anchors conditional on a candidate match, excluded two-character slash terms such as `Dev/QA` from repo IDs, and preserved absent scope instead of coercing it to `unknown` |
| Recall-level filtering could be bypassed by change projections and locked-context fallback | Compose architecture audit | Added a second Gate immediately before prompt patches, prompt compilation, context-pack rendering, and draft generation |
