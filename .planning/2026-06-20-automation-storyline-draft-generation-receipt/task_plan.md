# Storyline Draft Generation Receipt Plan

Goal: improve the selected `Storyline Draft API` feature by making server-owned generation/fallback/evidence scope visible in the API contract and first-screen UX, while keeping the feature manual-copy-only.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo workflow, feature index, automation memory, existing planning state, and local Reminder list |
| 2 | completed | Randomly sample a feature and inspect Storyline docs, API service, client types, page UI, and E2E coverage |
| 3 | completed | Scan current industry product and research references for meeting/storyline draft generation and evidence grounding |
| 4 | completed | Implement the focused backend/client/UI/doc/E2E generation receipt |
| 5 | completed | Run Storyline API tests, extension compile, Storyline draft E2E, scoped whitespace check, and watcher cleanup |
| 6 | in_progress | Update automation memory, handle Reminder completion if applicable, and close/archive the Codex session |

## Decisions

- Selected feature: `Storyline Draft API` under Memory Storyline Builder.
- Source doc: `docs/features/memory_storyline_builder.md`.
- Reminder state: local Reminders is reachable, but there is no list named `Personal AI`; no Reminder items can be incorporated or marked done.
- Recent automation targets around Jira Design Links, Notification Center, Outreach, Memory Search, Today Pilot, Reflection, Prompt Config, User Profile, Ask, Dream, Message Analysis, Message Reaction, Task Scheduler, Agent Workflow, Native Join, Memory Capture, Decision Center, and Memory Coverage were avoided.
- Improvement slice: add a server-owned `generationReceipt` to `StorylineDraftResponse`, then render it above the draft workbench so users can see whether the draft is LLM-generated or fallback, how many source/cited refs are involved, and what the action does not write/send.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No `Personal AI` Reminders list | AppleScript Reminder scan | Record absence; do not mark Reminder items done |
| Existing root `task_plan.md` belongs to an old Scheduled Messages run | Planning restore | Use isolated `.planning/2026-06-20-automation-storyline-draft-generation-receipt/` files and switch active plan |
| Normal Storyline API fixture unexpectedly produced fallback receipt | First API test run | Updated the normal-generation fixture to use allowed evidence aliases; fallback remains covered by dedicated tests |
| New planning files had EOF blank-line warnings | New-file whitespace check | Removed trailing blank lines and reran checks |
