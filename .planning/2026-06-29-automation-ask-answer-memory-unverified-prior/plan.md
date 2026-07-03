# Ask Answer Memory Unverified Prior Plan

Goal: improve `Ask 活答案记忆` by making stale or unverified prior-answer boundaries visible before the answer body, while preserving current retrieval, authority-gate, and write behavior.

## Scope

- Selected feature: `Ask 活答案记忆`
- Source doc: `docs/features/ask.md`
- Main code surfaces:
  - `src/modals/components/SearchResultPage.vue`
  - `tools/verify-memory-search-feedback-e2e.mjs`
  - `docs/features/ask.md`
- Reminder state: local Reminders lists are readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.

## Plan

| Step | Status | Work |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, repo planning state, feature index, Ask docs, and Reminder list state |
| 2 | completed | Scan related products and papers for memory sources, conversational search, and stale-memory risks |
| 3 | completed | Inspect Ask answer-memory backend, Search Result UI, and existing verifiers |
| 4 | completed | Implement a focused UI receipt change for prior-hit-with-no-current-evidence |
| 5 | completed | Update Ask docs and focused E2E expectations |
| 6 | completed | Run targeted tests, `npm start` first compile, i18n if needed, and scoped `git diff --check` |
| 7 | completed | Update automation memory and summarize |

## Planned Improvement

When Ask hits an existing active-answer prior but this run finds no current evidence, the status rail should say that the prior was not reverified before the answer body. Today the lower active-answer receipt can say `活答案未复核`, but the first `Ask 本轮状态` line is the strongest user-facing trust boundary. It should explicitly say:

- the old answer was only a prior hint;
- this run has no current evidence;
- the display does not confirm the old answer, write a new version, send messages, or run external actions.

This is presentation-layer only. It should not change `/ask`, active-answer storage, authority decisions, recall, external action creation, or evidence-watch behavior.

## Validation Targets

- `npm run verify:memory-search-feedback:e2e`
- `npm start` until first successful webpack compile, then stop
- `npm run verify:i18n`
- scoped `git diff --check`

## Errors

| Error | Resolution |
| --- | --- |
| Local Reminders has no `Personal AI` list | Stop Reminder branch honestly; no item marked done |
