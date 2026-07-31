# Findings

## Repo Context

- `docs/progressing/to-verify.md` has no pending carry-over work.
- Recent automation memory covered Memory Coverage Map, Agent Workflow, Topic Messages, Scheduled Messages, Project Dashboard, Doubao Bridge, Native Join, Notification Center, Message Reaction, Message Analysis, Memory Capture, Jira Design Links, Google Slides Analyzer, Relationship Radar, Meeting Pilot, Today Pilot, and Skill Foundry. This run selected User Profile to avoid repeating the freshest families.
- The worktree already contains unrelated dirty changes from previous automation runs. This run should own only User Profile files plus this planning directory and automation memory.

## Reminder Check

- AppleScript list names did not include `Personal AI`.
- EventKit read-only fallback succeeded: `Personal AI total=4 incomplete=0`.
- Existing completed items are historical Doubao / Notification / test feedback, not related to User Profile confirmation, exclusion, restoration, or influence calibration. No Reminder item should be marked done for this run.

## External Scan

- OpenAI Memory FAQ: saved memories are managed separately from chat history, and users need explicit manage/delete controls.
- Claude memory docs: Claude exposes a "View and edit memory" path where users can inspect and change remembered information.
- Google Gemini personal context / Saved info: comparable product surface separates user-provided saved information from ordinary chats.
- Response-Aware User Memory Selection (2026): memory items should be selected by response utility, not just semantic similarity; this supports keeping profile inclusion gated by confirmation and action-specific consequences.
- Mem0 / MemoryBank: long-term user memory benefits from selective extraction, update, reinforcement, and forgetting; UI calibration should expose what affects future personalization rather than pretending a click changed all past answers.
- Trustworthy memory search papers in 2026 frame memory admission as a trust boundary, which supports pre-click clarity for profile actions that admit or remove profile items from USER_CORE / recall candidates.

## Code Findings

- `src/modals/components/UserProfilePage.vue` already has strong receipts after confirm, influence update, partial confirm failure, retract, restore, load-all, export, and retracted audit operations.
- `设为重点` / `降低影响` buttons already have button-level `title` / `aria-label` via `getProfileInfluenceActionBoundary`.
- `确认`, `排除`, and `恢复` buttons currently rely on visible surrounding receipts and post-click receipts but do not expose their own pre-click boundary. This is inconsistent with the adjacent influence controls and leaves the most destructive action (`排除`) less explicit.
- `tools/verify-user-profile-export-e2e.mjs` already exercises confirm, retract, restore, and retracted audit flows, so it is the right E2E anchor for button-level assertions.

