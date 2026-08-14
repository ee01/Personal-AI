# Task Plan: Automation 2 New Capability · 2026-08-12

## Goal
Choose one genuinely new Personal AI capability from an eligible Reminder or, if none exists, from de-duplicated repo/live-memory/research evidence; deliver a complete Chinese plan and contextual interactive demo under `docs/progressing/` without runtime implementation.

## Current Phase
Complete

## Phases

### Phase 1: Requirements, history, and Reminder discovery
- [x] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, repository status, and prior working files
- [x] Read the complete `Personal AI` Reminder list through bounded AppleScript/EventKit checks
- [x] Separate all-new ideas from feedback/small improvements and randomly choose one if eligible
- **Status:** complete

### Phase 2: Repository de-dup and real-memory grounding
- [x] Inventory active/shelved `docs/progressing` plans and shipped feature docs
- [x] Query read-only `esone.qiu` memory-service evidence from `10.32.56.212`
- [x] Name one capability with a crisp non-overlap boundary
- **Status:** complete

### Phase 3: Current product, paper, and expert research
- [x] Search current primary/official product references, research papers, and relevant expert guidance
- [x] Compare UX patterns, technical feasibility, and known limitations
- [x] Record all web-derived claims only in `findings.md`
- **Status:** complete

### Phase 4: Plan and contextual demo creation
- [x] Write `docs/progressing/<slug>-plan.md` with scenarios first, product/UX/contracts/phases/evals/docs handoff
- [x] Build a Chinese host-surface HTML demo using real Personal AI assets and realistic, privacy-safe evidence
- [x] Include interaction states and visible privacy/authority/writeback boundaries
- **Status:** complete

### Phase 5: Validation, Reminder closeout, and delivery
- [x] Run path-scoped whitespace/section/link/inline-JS checks
- [x] Run Playwright desktop/mobile rendering and interaction checks with no page errors/overflow
- [x] If Reminder-sourced, write plan/demo summary to the item note and mark it done (not applicable: no eligible Reminder source)
- [x] Update automation memory with the run time and exact outcome
- [x] Deliver the copyable title plus plan/demo links
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Docs/demo only | The user explicitly reserved implementation approval for a later decision. |
| Isolated `.planning` workspace | Existing root planning files belong to another completed task and must stay untouched. |
| Preserve broad dirty worktree | All pre-existing modifications are user/other-task owned; this run will scope edits to its own plan/demo/working records. |
| No Reminder-derived idea | EventKit found `Personal AI` with four total items and zero incomplete items; all four are completed historical feedback, not selectable new ideas. |
| Selected concept: `Common Ground Memory / 共同上下文记忆` | It models what evidence was shared with a specific human audience and compiles only the missing delta before a chat or meeting; this fills a high-frequency collaboration gap without another dashboard or task queue. |
| Use conservative audience states | A sent message proves `shared_by_me`, not that every recipient read, understood, or agreed; stronger states require quoted/replied/action evidence and otherwise remain `unknown`. |
| Use Compose-native visual placement | The verified Personal AI UI already uses a red assistant entry beside the host composer, so the demo adds an evidence ribbon and inline expansion instead of inventing a separate dashboard. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial `planning-with-files` path was checked under `.codex/skills` | Resolved the advertised root alias to `/Users/Esone/.agents/skills` and read the skill there. |
| AppleScript did not enumerate `Personal AI` | Used EventKit read-only access, which found the list and returned the complete current state. |
| A search pattern beginning with `--` was parsed as an `rg` option | Re-ran repository searches with explicit patterns/options and did not use the failed output as evidence. |
| The first whitespace-check loop assigned zsh's read-only `status` variable | Renamed it to `check_status` and re-ran the same path-scoped checks. |
