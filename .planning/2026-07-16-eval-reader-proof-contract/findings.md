# Findings

- The current report visibly presents generic Reader Contract/report-format statements as if they were feature proof.
- The desired architecture must let each suite declare user-facing capability claims and map them to actual executed evidence.
- The worktree contains concurrent changes in `tools/eval-run.mjs` and `evals/registry.yaml`; edits must remain narrowly scoped.
- `buildReaderProved()` currently falls back to sample counts and Reader Contract completeness; `buildReaderNotProved()` falls back to three generic caveats.
- `reader-report.json` already has per-case proof checks and user conclusions, so suite claims can map to real case results without a suite-specific HTML renderer.
- The continuity suite exposes deterministic 0-3 scores for `continuity_contract`, `evidence_refresh`, `topic_alignment`, `topic_selection`, `context_isolation`, and `answer_quality`.
- The existing passing run can be safely re-rendered offline; rerunning the live suite would create unnecessary answer-memory side effects.
