# Decision Center button-boundary plan

## Target

- Selected feature: `决策中心` from `docs/features/index.md`.
- Source of truth: `docs/features/memory_system.md`.
- Runtime surface: `src/modals/components/DecisionCenter.vue`.
- Verifier: `tools/verify-decision-center-e2e.mjs`.

## Current state

- `docs/progressing/to-verify.md` is empty, so this run picks a fresh index item.
- Automation memory shows the freshest exact/family targets were Scheduled Messages, Ask, Native Join, Memory Lens, Meeting Panorama, search/timeline safe links, Rehearsal, and Message Analysis; Decision Center was chosen from a rerolled random eligible sample.
- AppleScript did not list `Personal AI`; EventKit did. EventKit found 4 total items and 0 incomplete items, so no open Reminder feedback is related or needs completion.

## External scan

- Zapier Human in the Loop pauses automations for human review and logs approvals/rejections, which reinforces that review actions need clear audit and continuation boundaries.
- Microsoft Copilot Studio Request information explicitly pauses execution, collects reviewer input, and uses it in later steps, so Personal AI should keep refresh/restore/copy separate from actual decision submission.
- Human-AI reliance research distinguishes appropriate reliance from mere trust or agreement; controls should help the user contest, own, and verify decisions instead of treating AI recommendations as already correct.
- Overreliance research suggests explanations help most when they reduce verification cost, so button-level labels should expose the exact consequence at the click point.

## Improvement plan

1. Add compact `title` / `aria-label` boundary helpers for Decision Center refresh/retry, copy-review, answer, state-transition, watch-transition, and visibility toggles.
2. Convert the `添加备注` clickable `div` into a real button while preserving visual styling and behavior.
3. Extend the existing Decision Center E2E to assert the new pre-click boundaries before approving, copying, snoozing, restoring, retrying, rule-improvement handling, and watch actions.
4. Update `docs/features/memory_system.md` and `docs/features/index.md` with the concise current behavior.
5. Verify with `node --check`, `npm start` first compile, the Decision Center E2E, and scoped `git diff --check`.

