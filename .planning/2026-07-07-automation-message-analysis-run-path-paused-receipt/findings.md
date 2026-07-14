# Findings

## Repo State

- `docs/progressing/to-verify.md` says `暂无`.
- The worktree is already broadly dirty from prior automation runs. This run should only own the Message Analysis run-path receipt, matching E2E assertions, docs/index copy, and this planning directory.

## Reminder State

- AppleScript did not list `Personal AI`.
- EventKit found `Personal AI` with 4 total reminders and 0 incomplete reminders.
- No open Reminder item is related to Message Analysis, manual concern rules, silent capture, notifications, auto reply, digest, follow-thread, or RuntimeAction planning.

## Current Code

- `src/modals/topic-rule-safety.ts` already has `getRuleRunPreviewReceipt`, including the paused state for `isSilentAnalysisEnabled === false`.
- `src/modals/topic-modal.tsx` currently renders delivery and effect boundary receipts, but does not render the run-preview receipt in the new/edit forms or saved rule cards.
- The top page banner warns that silent analysis is disabled, but individual rules can still look active after the user scrolls or focuses on a specific saved rule.

## External Scan

- Slack keyword workflows require channels plus keyword conditions before the workflow starts, supporting explicit trigger/scope display.
- Zapier filters only continue when data meets the configured condition, supporting visible condition gates.
- Trigger-action programming research emphasizes that users misread trigger/action timing and need interface help to build accurate mental models.
- Attention-sensitive alerting research supports exposing notification/interruption cost, not just whether a notification channel exists.

## UX Decision

Reuse the existing deterministic run-preview helper as a first-screen receipt. When silent analysis is off, the receipt should say the rule is saved locally but will not automatically capture future messages, and saving/viewing does not replay history, write memory, send notifications, create RuntimeActions, or execute external actions.
