# User Profile Export Improvement Plan

Goal: improve the randomly selected `用户画像导出` feature by checking current docs/code, using current product and research references, implementing one bounded UX/code improvement, updating docs, and validating with the strongest practical repo harness.

## Target

- Feature: `用户画像导出`
- Area: User Profile
- Source doc: `docs/features/user_profile_system.md`
- Primary verifier noted in index: `tools/verify-user-profile-export-e2e.mjs`

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, memory guidance, feature index, worktree state, and Reminders list names |
| 2 | completed | Inspect User Profile export docs, source files, tests, and current UX path |
| 3 | completed | Search current product references and research on personal-data/memory export transparency |
| 4 | completed | Decide the smallest constructive implementation slice and write the concrete plan before editing runtime files |
| 5 | completed | Implement scoped code/docs/test changes without touching unrelated dirty worktree files |
| 6 | completed | Run targeted verifier, first successful `npm start` compile, relevant E2E, scoped `git diff --check`, and watcher cleanup |
| 7 | in_progress | Update automation memory, handle Reminder completion if applicable, archive thread if tool is available, and summarize |

## Initial Decisions

- `docs/progressing/to-verify.md` currently says there are no pending carry-over items.
- Local Reminders is reachable but has no `Personal AI` list, so no Reminder item can be incorporated or marked done in this run.
- The worktree has broad pre-existing dirty changes. This run must keep edits limited to User Profile export, matching docs/tests, and this planning directory.
- Random sampling first surfaced recently adjacent Memory Capture / Agent Thinking / Meeting / Today candidates; `用户画像导出` was accepted as the bounded target.
- The implementation slice is a visible pre-export checklist in `UserProfilePage.vue`, plus E2E/docs updates. It should state format/integrity, all-status scope, diagnostic warning behavior, and no restore/delete/sync/send side effects before the click.
- No backend export contract change is needed; existing `exportInfo.manifest`, `profileAudit`, pagination, warnings, and post-download receipt already cover the durable data contract.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root `task_plan.md` describes an old Scheduled Messages run | Planning restore | Created this isolated `.planning/2026-06-21-automation-user-profile-export-receipt/` plan instead of reusing root files |
| Ruby random sampler used `filter_map`, unavailable in this host Ruby | Feature selection | Retried with a compatible `each` / push parser |
| No `Personal AI` Reminders list | AppleScript list scan | Stop Reminder branch and report absence honestly |

## Validation

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts` passed.
- `npm --prefix memory-service test -- --run src/__tests__/api-profile.test.ts src/__tests__/api-ingest-profile.test.ts` passed.
- `npm start` reached first successful webpack dev compile and was stopped.
- `node tools/verify-user-profile-export-e2e.mjs` passed.
- Scoped `git diff --check` passed for touched files and this planning directory.
- Watcher cleanup check found no remaining `npm start` / `webpack --watch` process.
