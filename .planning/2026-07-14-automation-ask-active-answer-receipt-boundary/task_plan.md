# Ask Active Answer Receipt Boundary Plan

Goal: improve the selected `Ask 活答案记忆` feature from `docs/index.md` by checking docs/code freshness, using current product and research references, incorporating local Reminder feedback when applicable, and implementing one focused UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, feature index, prior memory hints, current dirty worktree state, and `docs/progressing/to-verify.md` |
| 2 | completed | Check local Reminders via AppleScript and EventKit |
| 3 | completed | Inspect Ask docs, Search Result UI, AnswerMemory service logic, tests, and available verifier scripts |
| 4 | completed | Search current product references and papers for answer memory, citations, stale-memory, and source transparency patterns |
| 5 | completed | Implement the active-answer receipt card accessibility/hover boundary |
| 6 | completed | Update concise docs/index descriptions |
| 7 | completed | Run targeted verification, dev build, E2E, and scoped diff checks |
| 8 | completed | Update automation memory and close out |

## Decisions

- Selected feature: `Ask 活答案记忆` under Memory Service.
- Source doc: `docs/features/ask.md`.
- Scope is presentation/accessibility for the Search Result active-answer receipt card, not backend recall, `AnswerMemoryService` write semantics, AuthorityGate, live memory deployment, or eval scoring.
- The concrete implementation slice is to add a dynamic `title` / `aria-label` boundary to the active-answer receipt card so hover and screen-reader users can inspect the same consequence boundary as the visible first-screen receipts.
- Reminder result: AppleScript did not list `Personal AI`, but EventKit found the local `Personal AI` list with 4 total items and 0 incomplete items. None relate to Ask active answers, so no Reminder item will be changed.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `web.open` by search ref id returned no useful page content | Open search result refs directly | Reopened the same sources by URL and used line-level findings |
| `rg` included nonexistent `tools/evals` path | Broad verifier/eval search | Treat as harmless search-scope typo; used existing `evals/` and feature-specific files instead |
