# Message Analysis Rule Diagnostics Plan

## Goal

Improve `消息入库与通知分发` so users can understand why a manual Message Analysis rule did not actually store or notify after the model claimed a match.

## Scope

- Target feature: `消息入库与通知分发` in `docs/features/index.md`.
- Canonical doc: `docs/features/message_analysis.md`.
- Runtime surfaces: normal filter, Agent Thinking, Agent Workflow, rule-card UI, and local diagnostics storage.
- Reminder source: checked local Reminders; no visible `Personal AI` list exists.

## Plan

1. [complete] Restore context and confirm no `docs/progressing/to-verify.md` carry-over.
2. [complete] Inspect Message Analysis docs, runtime matching code, rule UI, and existing verification scripts.
3. [complete] Review comparable product and research references for workflow conditions, filter testing, trigger-action debugging, and alert interruption cost.
4. [complete] Implement local, capped manual-rule scope rejection diagnostics and show the latest diagnostic on the corresponding rule card.
5. [complete] Re-run focused validation after the resumed automation turn and fix any regression found.
6. [complete] Update automation memory with current run result and final verification evidence.

## Verification Target

- `tools/verify-memory-entry-runtime.ts`
- `tools/verify-memory-entry-message-flow.ts`
- `tools/verify-memory-entry-manual-flow.ts`
- `src/modals/__tests__/topicRuleSafety.test.ts`
- `npm start` first successful compile
- `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`
- `git diff --check` for touched files and new files

## Errors

- AppleScript Reminders delimiter formatting failed once; retried with a simpler list-name read and confirmed no `Personal AI` list.
