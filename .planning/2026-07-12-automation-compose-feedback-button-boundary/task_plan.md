# Compose Assist Feedback Button Boundary Plan

## Goal

Random feature sweep target: `回复助手阈值与反馈` in `docs/features/compose_assist.md`.

Improve the user-visible pre-click boundary on the Compose Assist thumb-down control so the button itself explains what clicking does before the feedback receipt appears.

## Plan

1. [complete] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, `docs/features/index.md`, and Reminder state.
2. [complete] Select a less-recent random feature candidate and inspect current docs/source/E2E coverage.
3. [complete] Research comparable writing-assistant feedback/product patterns.
4. [complete] Implement a narrow `title` / `aria-label` boundary for the Compose Assist reject button.
5. [complete] Extend the existing Compose Assist E2E assertions for the button boundary.
6. [complete] Update `docs/features/compose_assist.md` and `docs/features/index.md`.
7. [complete] Verify with targeted checks, first successful `npm start`, E2E, and scoped `git diff --check`.

## Decisions

- Keep the change presentation/accessibility-only. Do not change threshold math, context keys, ambient calibration payloads, feedback writes, or Rehearsal feedback semantics.
- The feedback receipt already explains result states after click. The gap is the control point before click.
- No Reminder item is incorporated this run: EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- Implementation adds dynamic pre-click copy to the reject button only; feedback writes and thresholds remain unchanged.

## Verification

- `node --check tools/verify-compose-assist-ambient-calibration-e2e.mjs` passed.
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/composer-guard/__tests__/ComposerGuardController.test.ts` passed 12/12.
- `npm start -- --progress` compiled successfully in 16861 ms, then the watcher was stopped.
- `node tools/verify-compose-assist-ambient-calibration-e2e.mjs` passed against rebuilt `dist/contentScriptWebIntelligence.js`.
- Scoped `git diff --check` passed for owned tracked files.
- Planning file trailing-whitespace check passed.
- Process check found no remaining webpack watcher or Compose Assist E2E process from this run.

## Risks

- Existing worktree is broadly dirty. Only touch the selected Compose Assist files, index/doc rows, this planning directory, active-plan pointer, and automation memory.
- E2E depends on `dist/contentScriptWebIntelligence.js`, so run `npm start` before the browser-level verifier.
