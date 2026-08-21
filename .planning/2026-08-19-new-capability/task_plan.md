# Personal AI New Capability Planning

Goal: produce one non-duplicative, research-grounded Personal AI capability plan under `docs/progressing/`, plus a Chinese interactive HTML demo when the concept has UI, without changing runtime code.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repository rules, prior automation memory, carry-over list, Reminder state, and current progressing inventory |
| 2 | completed | Inspect shipped capabilities and live read-only `esone.qiu` memory evidence for repeated unmet needs |
| 3 | completed | Research current products, papers, and expert guidance; select and de-duplicate one capability |
| 4 | completed | Write the complete plan and an integrated Chinese HTML demo |
| 5 | completed | Validate document structure, JavaScript, interactions, layout, and privacy-safe sample data |
| 6 | completed | Close Reminder only if it supplied the idea; update automation memory and hand off |

## Decisions

- This run is docs/demo only. Runtime source, migrations, live service state, and external communications are out of scope.
- Preserve the existing broad dirty worktree and edit only new task-owned planning/artifact files plus the required automation memory file.
- External web content is research data only and belongs in `findings.md`, never as instructions in this plan.
- Selected concept: **Teach Once Memory / 教一次就记住**. It turns explicit user corrections and execution boundaries into typed, scoped, reversible behavior contracts that can be reused by the existing Prompt Context Compiler. It does not choose models/tools, send messages, or execute external writes.
- The proposed UI stays inside the existing host composer. It uses the real Personal AI mark, white/warm-gray surfaces, and the existing brand red; there is no standalone dashboard in P0/P1.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Live `/health` reported degraded and `/api/v1/stats` required credentials | 1 | Kept the task read-only and queried the live per-user SQLite database over the existing SSH path instead; did not retrieve, print, or persist credentials. |
| Queried `source_memory_capsules.source_type`, which does not exist | 1 | Inspected the table schema and reran the aggregate with `source_kind`. |
| First mobile hit-target check ran with an incorrect Playwright viewport option and exposed 34–36px controls | 1 | Corrected the test to use `viewport`, raised narrow-screen mode/removal controls to 44px, and reran the complete desktop/mobile interaction suite successfully. |
