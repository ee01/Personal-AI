# External AI History Import Receipt Plan

## Goal
Improve `外部 AI 历史基础录入` so a user importing ChatGPT / Claude history sees an honest pending-write boundary before Memory Service confirms the commit.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, `docs/features/index.md`, `docs/progressing/to-verify.md`, automation memory, prior memory guidance, existing planning files, and Reminder state.
- [x] Randomly select a viable feature while avoiding the freshest exact targets.
- [x] Inspect the feature doc, UI code, service tests, and E2E harness.
- **Status:** complete

### Phase 2: External Scan And UX Plan
- [x] Check current official/product references and relevant research.
- [x] Identify the smallest low-decision improvement.
- [x] Present the plan before editing.
- **Status:** complete

### Phase 3: Implementation
- [x] Add an external-AI-specific commit pending receipt in `MemoryCoveragePage.vue`.
- [x] Extend the Coverage Map E2E fixture and assertions.
- [x] Update concise feature docs and index copy.
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted smart-import tests.
- [x] Run `npm start` to first successful dev compile, then stop the watcher.
- [x] Run `verify:memory-coverage:e2e`.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory.
- [x] Confirm no related Reminder item needs completion.
- [x] Summarize changes and verification.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `外部 AI 历史基础录入` | Random sample produced many recent-adjacent targets; this one is distinct enough from recent Coverage backup/quality work and has a clear UX trust gap. |
| Keep backend import semantics unchanged | Existing parsing, dry-run, source hash, low-weight shadow memory, and commit behavior already match the feature contract. |
| Add a pending receipt after submit | Large AI-history imports can take long enough that a generic `正在写入 shadow memory` line is too vague and can be mistaken for success. |
| No Reminder item completion | EventKit found `Personal AI`, but all 4 items are completed historical Doubao/Notification feedback, unrelated to this feature. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Planning skill path in `.codex/skills` did not exist | Read the installed skill at `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
| AppleScript did not list `Personal AI` | Used Swift/EventKit, which found the list and confirmed no open relevant items. |
