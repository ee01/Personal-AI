# Task Plan: Skill Foundry Platform Sync Control Boundaries

## Goal
Improve the Personal Skill Foundry platform-sync UX so users can understand each sync entry point's scope before clicking, while keeping existing sync behavior unchanged.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, `docs/features/index.md`, feature docs, source, and E2E.
- [x] Check local Reminders with AppleScript and EventKit.
- [x] Run a small product/paper scan for agent skills, publishing, approval, and automation debugging patterns.
- **Status:** complete

### Phase 2: Plan
- [x] Select `平台同步` under Skill Foundry as the target feature.
- [x] Scope the improvement to button/switch title and aria-label copy for the sync dialog and sync dialog entry buttons.
- [x] Update `findings.md` and `progress.md`.
- **Status:** complete

### Phase 3: Implementation
- [x] Add reusable control-boundary helpers in `PersonalSkillsPage.vue`.
- [x] Wire helpers into the header/binding sync-dialog entry buttons, dialog close button, OpenClaw sync button, Desktop App sync buttons, and platform switches.
- [x] Update the Skill Foundry E2E assertions.
- [x] Update `docs/features/personal_skill_foundry.md` and `docs/features/index.md` concisely.
- **Status:** complete

### Phase 4: Verification
- [x] Run syntax checks for changed E2E/source where practical.
- [x] Run the targeted Skill Foundry E2E.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update automation memory with selected feature, Reminder outcome, research, implementation, verification, and dirty-worktree note.
- [x] Report the outcome with sources and any validation caveats.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `平台同步 / Skill Foundry` | Random candidate from `docs/features/index.md`; avoids the freshest exact targets in automation memory. |
| Do a presentation/accessibility-only change | The code already shows post-click receipts; the remaining user-risk is pre-click ambiguity on the actual controls. |
| Keep sync semantics unchanged | No user decision is needed for a scoped UX boundary fix, and changing backend sync would increase risk unnecessarily. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial planning skill path was wrong | Re-read the registered `.agents/skills/planning-with-files/SKILL.md` path and initialized a dedicated plan directory. |
| First `npm start` compile failed on `vue/no-ref-as-operand` | Changed `syncRunning` checks in helpers to `syncRunning.value`; the watcher rebuilt successfully. |
