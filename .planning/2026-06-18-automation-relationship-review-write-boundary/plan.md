# Relationship Radar Review Queue Improvement Plan

Goal: improve the randomly selected `人脉关系 Review Queue` feature by checking current docs/code, incorporating external product and research references, implementing one bounded UX/code improvement, updating docs, and validating it end to end.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, `docs/progressing/to-verify.md`, feature index, dirty worktree state, and local Reminders list names |
| 2 | completed | Select `人脉关系 Review Queue` and inspect Relationship Radar docs, UI, service, route, tests, and E2E |
| 3 | completed | Research comparable relationship/contact suggestion queues, relationship intelligence products, AI suggestion review bias, and snooze/deferral research |
| 4 | completed | Implement a scoped Review Queue write-boundary UX change |
| 5 | completed | Update feature documentation and E2E assertions |
| 6 | completed | Run targeted verification, dev compile, E2E, scoped diff checks, automation memory update, and archive attempt |

## Findings

- Local Reminders are readable, but no visible list named `Personal AI` exists, so no Reminder item can be incorporated or completed.
- The worktree is already broadly dirty, including Relationship Radar files. This run must preserve existing changes and keep edits scoped.
- The main Review Queue card already lets the user inspect evidence, edit the proposed value, add a note, then confirm / snooze / reject.
- The right-side `确认队列` preview still exposes a one-click `确认` action that writes the relationship fact from a compact sidebar with only proposed value, confidence, and evidence count. That is too easy to rubber-stamp for a durable relationship/profile fact.
- External references support a stricter pre-write boundary: Google Contacts keeps suggestions in a repair/review flow, Salesforce Einstein Relationship Insights emphasizes evidence-backed recommendations, AI suggestion review research warns that suggestions can bias human review, and snooze research supports explicit deferral/return semantics.

## Implementation Slice

1. Add a compact `校准影响预览` block to each full Review Queue card, stating what confirm, snooze, and reject will or will not write.
2. Replace the sidebar one-click `确认` with `进入复核`, which opens the full Review Queue, focuses the item, and does not call the write endpoint.
3. Keep sidebar `稍后 7 天` because it does not write profile facts, while the resulting receipt still states the return boundary.
4. Add a focused visual highlight for the review item opened from the sidebar.
5. Update docs and E2E so the contract is proven instead of implied.

## Validation

- `PATH=/Users/Esone/.nvm/versions/node/v24.13.0/bin:$PATH npm run verify:relationship-radar` passed after the first direct npm attempt failed with `env: node: No such file or directory`.
- `PATH=/Users/Esone/.nvm/versions/node/v24.13.0/bin:$PATH npm start` reached the first successful webpack compile and was stopped with Ctrl-C.
- `PATH=/Users/Esone/.nvm/versions/node/v24.13.0/bin:$PATH npm run verify:relationship-radar:e2e` passed.
- Scoped `git diff --check` passed for the touched Relationship Radar files and this planning file.
- No `webpack --watch` / `webpack.dev.cjs` process remained after validation.
