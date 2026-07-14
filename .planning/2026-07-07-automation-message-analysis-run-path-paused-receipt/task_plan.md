# Message Analysis Run Path Paused Receipt

## Goal

Improve the manual Message Analysis rule UX so users can see, at the rule-creation and saved-rule level, when a rule is only saved locally because background silent message analysis is off.

## Selected Feature

- Feature: `手动关注项规则`
- Capability: Message Analysis
- Source doc: `docs/features/message_analysis.md`
- Primary UI: `src/modals/topic-modal.tsx`
- Existing proof: `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`

## Plan

1. Completed: read automation memory, `AGENT.md`, `docs/progressing/to-verify.md`, feature index, Message Analysis doc, current UI code, existing tests, Reminder state, and external product/research references.
2. Completed: wire the existing `getRuleRunPreviewReceipt` helper into the actual rule UI.
3. Completed: add E2E assertions for the paused background-capture state.
4. Completed: update concise feature docs and index wording.
5. Completed: run targeted helper test, dev compile, E2E, and scoped whitespace check.
6. Completed: update automation memory with the exact outcome.

## Non-Goals

- Do not change rule matching, final scope validation, message ingestion, notification dispatch, auto reply, digest, follow-thread, RuntimeAction planning, OpenClaw execution, storage schema, or Memory Service APIs.
- Do not mark any Reminder done unless an incomplete related item exists.

## Verification Target

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/modals/__tests__/topicRuleSafety.test.ts`
- `npm start -- --progress` until first successful compile, then stop.
- `node tools/verify-message-analysis-rule-diagnostics-e2e.mjs`
- `git diff --check -- .planning/.active_plan .planning/2026-07-07-automation-message-analysis-run-path-paused-receipt src/modals/topic-modal.tsx tools/verify-message-analysis-rule-diagnostics-e2e.mjs docs/features/message_analysis.md docs/features/index.md`
