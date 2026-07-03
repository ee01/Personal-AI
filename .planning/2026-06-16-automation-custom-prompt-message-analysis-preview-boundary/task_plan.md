# Prompt Config Message Analysis Preview Boundary Plan

Goal: improve the randomly selected `自定义消息分析提示词` feature by checking current docs/code, using external references, folding in local Reminder feedback if available, then implementing one bounded UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo workflow, automation memory, feature index, carry-over file, worktree state, and Reminder list names |
| 2 | completed | Inspect Prompt Config docs, source files, storage contracts, and existing verifiers |
| 3 | completed | Research comparable product and paper guidance for custom prompt/config transparency |
| 4 | completed | Finalize the smallest useful implementation slice and document the stepwise plan |
| 5 | completed | Implement scoped code, tests, and doc updates |
| 6 | completed | Run targeted verification, first webpack compile, E2E/browser proof where practical, and diff checks |
| 7 | completed | Update automation memory, handle Reminder completion if applicable, and archive the Codex session if a real mechanism is available |

## Decisions

- Selected feature: `自定义消息分析提示词`.
- Source doc: `docs/features/custom_prompts.md`.
- Avoided freshly touched automation feature families, including Meeting Pilot, Message Analysis, Skill Foundry, Message Reaction, Storyline, Ask, Project Dashboard, User Profile, Native Join, Memory Timeline, Agent Thinking, Topic Messages, Agent Workflow, Rehearsal, Doubao, Coverage, Relationship Radar, Scheduled Messages, and Task Scheduler.
- Local Reminders is readable, but no list named `Personal AI` is visible, so no Reminder feedback can be incorporated or completed in this run.
- The worktree has broad pre-existing dirty changes. Keep edits scoped to Prompt Config and this plan directory unless the code inspection proves another file is necessary.

## Candidate UX Concern

- Prompt Config is trust-sensitive: users need to know whether they are editing a draft, viewing active runtime config, previewing context, or applying a setting that changes future message analysis. Prefer receipts that separate preview/read-only state from effective runtime state.

## Implementation Plan

1. Add a persistent history-restore draft receipt to `src/modals/prompt-config.tsx`.
2. Show the restored version time, version summary, change summary, current preview scope, and the boundary that this restored version is only loaded into the editor until saved.
3. Clear the receipt after manual edits, reset, reload, or successful save, so it cannot describe a draft that has drifted away from the restored version.
4. Extend `tools/verify-custom-prompts-e2e.mjs` around the existing history restore path.
5. Add source-level assertions in `tools/verify-custom-prompts.ts` and update `docs/features/custom_prompts.md`.
6. Validate with `npm run verify:custom-prompts`, `npm start` first successful compile, `npm run verify:custom-prompts:e2e`, and scoped `git diff --check`.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` and `.planning/.active_plan` already reflect other runs | Planning setup | Created an isolated `.planning/2026-06-16-automation-custom-prompt-message-analysis-preview-boundary/` plan instead of reusing or overwriting them |
| Initial random pick hit today's User Profile family | Feature selection | Rerolled after excluding recent automation-memory feature families |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and stop the Reminder branch for this run |

## Validation

- `npm run verify:custom-prompts`
- `npm start` first successful webpack dev compile, then stopped watch with Ctrl-C
- `npm run verify:custom-prompts:e2e`
- `git diff --check -- src/modals/prompt-config.tsx tools/verify-custom-prompts.ts tools/verify-custom-prompts-e2e.mjs docs/features/custom_prompts.md .planning/2026-06-16-automation-custom-prompt-message-analysis-preview-boundary/task_plan.md .planning/2026-06-16-automation-custom-prompt-message-analysis-preview-boundary/findings.md .planning/2026-06-16-automation-custom-prompt-message-analysis-preview-boundary/progress.md`
- `codex archive 019ecdf2-1533-7fa1-8dcf-0ee6363aa669`
