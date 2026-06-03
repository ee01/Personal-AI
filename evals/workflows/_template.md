# <Suite Name> Experience Workflow

## Goal

Describe what user experience this suite evaluates. Write this as a product-facing behavior, not only an implementation detail.

## Steps

1. Load cases from `evals/cases/<suite>/cases.jsonl`.
2. Collect or construct the target context.
3. Call the relevant API, UI helper, or deterministic judge.
4. Save request, response, and judge evidence in the run artifact folder.
5. Mark each case as `pass`, `warn`, `fail`, `hide_expected`, `skipped`, or `error`.

## Pass Criteria

- The output matches the user's current intent or context.
- Returned/generated content is grounded in the expected evidence.
- Banned topics, privacy leaks, or unsupported actions are suppressed.
- The user can understand why the result is relevant or why the system stayed quiet.

## Expected Case Inputs

- stable `id`, `kind`, and `title`
- input context, for example `sampleContext`, `query`, `context`, or `url`
- expected behavior, anchors, or allowed facts
- banned topics or must-not-use facts
- privacy and owner metadata

## Report Requirements

- Show what data or target this case evaluated.
- Show expected behavior next to actual system output.
- Show the generated/returned AI content, or the explicit error/hide decision.
- Show score, user-facing verdict, and why the judge made that call.
- Show concrete improvement suggestions.

## Run Examples

```bash
npm run eval:validate
npm run eval:run -- --suite <suite-id> --no-repair
npm run eval:run -- --case <case-id> --no-repair
```
