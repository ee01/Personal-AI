# Compose Assist Direct Insert Undo Window Plan

Goal: improve `回复助手直接插入` by making the post-insert undo window explicit, without changing insertion, sending, recall, or calibration semantics.

## Selected Feature

- Feature row: `回复助手直接插入`
- Capability: Compose Assist
- Source document: `docs/features/compose_assist.md`
- Reminder state: EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No open Reminder item is related to Compose Assist direct insert, undo, draft insertion, or writing-assistant feedback.

## External Reference Findings

- Gmail Smart Compose keeps writing assistance inline, lets users accept a suggestion while typing, and exposes Smart Compose / personalization controls. It also warns that suggestions are not guaranteed to be factually correct.
- Microsoft Copilot in Outlook keeps generated drafts behind review, keep/discard/regenerate, selection-edit, and final manual send steps.
- Gmail Smart Compose research frames assisted writing as real-time interactive suggestions, not autonomous sending.
- Interaction-Required Suggestions argues for co-writing designs that require human involvement to preserve control, ownership, and awareness.

## Improvement Plan

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, carry-over docs, automation memory, index, Reminders, current Compose Assist docs/code/verifier |
| 2 | completed | Research comparable product and paper patterns for direct-insert writing assistants |
| 3 | completed | Add a visible undo-window duration to the post-insert receipt and focused assertions |
| 4 | completed | Update `docs/features/compose_assist.md` and `docs/features/index.md` concisely |
| 5 | completed | Run focused unit/E2E verification, `npm start` first compile, and scoped whitespace checks |
| 6 | completed | Update automation memory with current runtime and Reminder outcome |

## Decisions

- Keep the change presentation-first: no change to `/composer/assist`, source routing, insert mechanics, accepted feedback, ambient calibration, Rehearsal feedback, or auto-send behavior.
- The direct user pain is temporal ambiguity: the UI says `撤销`, but the visible receipt does not say the window is only about 10 seconds.
- The receipt should say `约 10 秒内可撤销`; after expiry the existing `草稿保留已确认` receipt remains the authority for accepted/calibration status.
- Existing broad dirty worktree is not owned by this run; this run owns only the undo-window wording, focused tests, concise docs/index update, active-plan pointer, and this plan.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `.planning/.active_plan` pointed to the completed Ask topic-lock run | Planning restore | Created this isolated dated planning directory and switched the active-plan pointer |
| Repository has broad unrelated dirty state before edits | Git status review | Keep edits scoped and avoid staging/reverting unrelated files |

## Verification

- `node --check tools/verify-compose-assist-direct-insert-e2e.mjs` passed.
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/composer-guard/__tests__/ComposerGuardController.test.ts` passed 12/12.
- `npm start -- --progress` compiled successfully in 14663 ms and was stopped after the first successful compile.
- `node tools/verify-compose-assist-direct-insert-e2e.mjs` passed.
- Scoped `git diff --check` passed for the files touched by this run.
- Process cleanup check found no remaining webpack watcher, Compose Assist verifier, Playwright, Chromium, or temporary profile process.
