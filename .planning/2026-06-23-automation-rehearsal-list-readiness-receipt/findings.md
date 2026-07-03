# Findings

## Repo And Product

- `AGENT.md` requires code changes to run targeted checks, `npm start` to first successful compile, relevant E2E, and `git diff --check`.
- `docs/progressing/to-verify.md` currently says `暂无。`.
- The worktree is already broadly dirty; this run must only edit Rehearsal-owned files.
- Reminders list names are available, but `Personal AI` is absent.

## Rehearsal Current State

- `src/modals/components/RehearsalsPage.vue` already has detail-level `场景资格总览`, `命中诊断`, action success/failure receipts, no-cue diagnostics, and deep-link failure recovery.
- The list card only shows status, confidence, title, summary/content, scenario, activation count, and expiry. Users cannot see whether a row is prompt-eligible, weak-only, inactive, or cue-less without selecting it.
- `tools/verify-rehearsals-page-e2e.mjs` already fixtures active, stale, cue-less, missing deep-link, failed pause, and reactivation paths, so it is the right E2E to extend.

## External Scan

- Apple Reminders supports time, location, messaging-person, and app-link cues; this supports showing cue coverage before asking the user to trust a rehearsal.
- ChatGPT Tasks exposes scheduled/monitoring tasks and paused states; this supports explicit inactive/weak/not-executing boundaries.
- Context-aware reminder research shows natural-language reminders need structured executable conditions; list rows should not hide whether a future cue exists.
- Implementation-intention research centers on if-cue-then-action plans; Rehearsal should keep cue-action binding visible at scan level.
