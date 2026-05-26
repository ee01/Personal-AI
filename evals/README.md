# Personal AI Evals

This folder stores file-first experience evals for Personal AI.

## Vocabulary

- Eval Case: one sample with input context, expected anchors, banned topics, and expected behavior.
- Eval Workflow: human-readable steps for collection, scoring, reporting, and optional repair.
- Eval Suite: a group of cases with one workflow and one repair policy.
- Eval Run: one execution stored under `.eval-runs/<runId>/`.
- Repair Attempt: an optional agent run triggered by a failed eval.

## Commands

```bash
npm run eval:list
npm run eval:run -- --suite context-recall
npm run eval:run -- --case rc-coach-codex-token
npm run eval:run -- --scheduled --repair=auto
```

Run artifacts are ignored by git because they can contain private memory and RingCentral context.

## Configuration

- `registry.yaml` lists suites, case paths, schedule mode, judge mode, and repair policy.
- `agents.yaml` configures pluggable repair runners. Codex is the default.
- `cases/*/*.jsonl` stores versioned cases.
- `workflows/*/*.md` stores human-readable workflow instructions.
- `judges/*.md` stores LLM-as-judge rubrics.
