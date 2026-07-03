# Task Plan: Rehearsal Memory Lens Receipt

## Goal
Improve the selected `记忆提示预演提醒 / Memory Lens` path so a user can immediately tell why a Rehearsal cue appeared, what its status is, how to review it, and that negative feedback applies to a future-scene script rather than a normal fact memory.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, and random-loop memory notes
- [x] Check Reminders list names
- [x] Select a non-fresh random feature from `docs/features/index.md`
- **Status:** completed

### Phase 2: Planning & Structure
- [x] Inspect Rehearsal and Memory Lens docs/code/verifiers
- [x] Scan current product and research references
- [x] Define a bounded implementation slice
- **Status:** completed

### Phase 3: Implementation
- [x] Add Rehearsal-specific Lens receipt content and feedback drawer wording
- [x] Update E2E/static verifier assertions
- [x] Update concise feature docs
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run `npm run verify:webpage-memory-detection`
- [x] Run `npm start` until first successful compile, then stop it
- [x] Run `node desktop-app/scripts/webpage-memory-detection-check.mjs`
- [x] Run scoped `git diff --check`
- **Status:** completed

### Phase 5: Delivery
- [ ] Update automation memory
- [ ] Summarize changed files, verification, and Reminder result
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `记忆提示预演提醒 / Memory Lens` | Randomly selected from the feature index after avoiding the freshest exact automation targets. |
| Skip Reminder item incorporation | Local Reminders lists did not include `Personal AI`, so there are no target-feature feedback items to complete. |
| Keep the implementation front-end scoped | The backend already returns Rehearsal summary/content/status/cues; the user-facing gap is presentation and feedback wording. |
| Use the existing Playwright extension harness | Memory Lens is a content-script UI and the repo already has a focused desktop-app E2E fixture for the Rehearsal Lens path. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Root `task_plan.md` exists from an older Scheduled Messages run | Created an isolated dated plan under `.planning/2026-06-25-automation-rehearsal-lens-receipt/`. |
| First Rehearsal E2E missed `预演回执` in visible text | Added a visible receipt title instead of relying only on `aria-label`. |
| E2E later hit stale ordinary Lens copy assertions | Updated the same script to current `可提取信息` / `建议动作` wording. |
