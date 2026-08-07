# Findings

## Repo and Reminder State

- `AGENT.md` requires `npm start` after runtime source changes, stopping after the first successful compile, plus focused verifier/E2E coverage.
- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent runs focused on Rehearsal, Jira Automation Import, User Profile, Memory Coverage Map, Agent Workflow, Topic Messages, Scheduled Messages, Project Dashboard, Doubao Bridge, Native Join, Notification Center, Message Reaction, Message Analysis, Memory Capture, Relationship Radar, Meeting Pilot, Today Pilot, and Skill Foundry.
- AppleScript did not list `Personal AI`; EventKit did list it and reported 4 total items with 0 incomplete items.

## Current Implementation

- `docs/memory_system.md` already documents scope semantics: default active recall is `work`; `personal` is opt-in; `all`/`both` reads both work and personal; passive context recall defaults broader.
- `src/modals/memory-exploring.vue` renders the shared search header and scope segmented controls.
- `src/modals/components/SearchResultPage.vue` already shows search scope intent, loading scope receipt, result scope breakdown, scope boundary notice, Ask scope receipt, empty result receipt, and batch receipt.
- `tools/verify-memory-search-scope-e2e.mjs` already covers work/all/personal scope requests and result receipts. It does not yet assert button-level pre-click title/ARIA boundaries for the scope controls.

## External Scan

- OpenAI ChatGPT Memory docs emphasize user-visible saved memories, reference chat history, and controls for what memory can affect.
- Claude chat search/memory docs distinguish searchable chat types and workspace/project boundaries.
- Microsoft 365 Copilot semantic index docs place semantic retrieval inside Microsoft Graph and tenant/RBAC boundaries.
- Notion admin content search docs frame enterprise search around workspace permissions and discoverability.
- Personal Information Management research frames finding information across work, personal, and multi-role contexts rather than as one flat corpus.

## Product Judgment

The current feature is structurally sound. The constructive improvement is to move the already-rendered scope receipt down to the actual scope buttons so the pre-click action point is explicit for mouse, keyboard, and screen-reader users. This is lower risk than changing recall behavior and matches the repo's recurring trust-boundary product direction.
