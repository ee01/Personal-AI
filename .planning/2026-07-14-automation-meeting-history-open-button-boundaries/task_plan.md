# Task Plan: Meeting History Open Button Boundaries

## Goal
Improve the Meeting Pilot meeting-history archive so Panorama/PDF card actions expose exact pre-click boundaries on the controls themselves, with docs and E2E proof.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, `docs/features/index.md`, `docs/progressing/to-verify.md`, and current worktree state.
- [x] Randomly sample feature-index candidates and select `会议历史归档` while avoiding the freshest exact/family automation targets.
- [x] Inspect `docs/features/meeting_pilot.md`, `src/modals/components/MeetingHistoryPage.vue`, `desktop-app/scripts/meeting-pilot-history-check.mjs`, and related package scripts.
- [x] Check local Reminders with AppleScript and EventKit.
- [x] Gather product/paper references for meeting recap/archive UX.
- **Status:** complete

### Phase 2: Plan & UX Scope
- [x] Identify the bounded improvement.
- [x] Record external research and Reminder findings.
- [x] Choose verification path.
- **Status:** complete

### Phase 3: Implementation
- [x] Add Meeting History Panorama/PDF button `title` and `aria-label` helpers.
- [x] Extend history E2E assertions for button-level boundaries.
- [x] Update canonical docs and index row.
- **Status:** complete

### Phase 4: Verification
- [x] Run syntax checks for changed JS/Vue-facing files where available.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run `npm run test:meeting-pilot-history`.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory with selected feature, Reminder state, research, implementation, and validation.
- [x] Report outcome and cite used memory/web sources.
- **Status:** complete

## Key Questions
1. Does the document still match current implementation? Mostly yes; it describes the history read/completion/open receipts, but not button-level pre-click title/ARIA boundaries.
2. Is there a low-decision unfinished piece to implement? Yes: the action-scope copy exists near the buttons, but the actual `打开 Panorama` and `打开 PDF` controls do not carry the boundary for hover/screen-reader users.
3. Is Reminder feedback relevant? No. EventKit found `Personal AI`, but it has 0 incomplete items and no meeting-history feedback.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Scope to Meeting History card action controls | It is user-visible, low-risk, and reinforces the actual click consequence without changing backend behavior. |
| Keep implementation presentation-only | The existing `openPanorama`, `openPdf`, PDF safety, and receipt behavior are already correct; the gap is pre-click affordance. |
| Use existing `test:meeting-pilot-history` | It already drives the built extension page with realistic fixture states and covers open/PDF actions. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `sed /Users/Esone/.codex/skills/planning-with-files/SKILL.md` missing | 1 | Re-read the skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`, which is the actual listed root. |
| `rg ... tools/verify-meeting-history*` failed in zsh due unmatched glob | 1 | Re-ran exploration with explicit paths and `rg` patterns rather than unquoted absent globs. |

## Notes
- The worktree was already broadly dirty before this run; only touch the selected feature files and this planning directory.
- Node/npm may require `$HOME/.nvm/versions/node/v24.13.0/bin` on PATH.
