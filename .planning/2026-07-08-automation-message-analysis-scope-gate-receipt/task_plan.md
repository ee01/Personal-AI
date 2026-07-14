# Message Analysis Scope Gate Receipt Plan

## Goal

Improve the `规则范围校验` UX for Message Analysis without changing matching semantics: users should understand what a `范围拦截` count means, where the evidence came from, and what to inspect next.

## Selected Feature

- Feature: `规则范围校验`
- Capability: Message Analysis
- Doc: `docs/features/message_analysis.md`
- Main UI: `src/modals/topic-modal.tsx`
- Existing proof: `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`, `tools/verify-memory-entry-message-flow.ts`

## Plan

1. Context and reminders: read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index/doc, related source/tests, and local Reminders.
2. Research: compare automation products and trigger-action papers for how they explain gates, conditions, and blocked actions.
3. UX change: add an aggregate scope-gate receipt under the Message Analysis delivery summary when `scopeRejected > 0`.
4. Tests: update E2E assertions so the receipt proves meaning, source, recovery path, and no-side-effect boundary.
5. Docs: update the feature doc and index row concisely.
6. Verify: run targeted syntax/static checks, `npm start` first compile, feature E2E, and scoped `git diff --check`.

## Non-Goals

- Do not change LLM prompts, rule matching, `resolveMatchedWatchRules`, diagnostics storage, storage schema, notifications, memory ingestion, auto reply, follow thread, digest, RuntimeAction, or OpenClaw behavior.
- Do not mark any Reminder done unless an incomplete `Personal AI` item directly drove the change.

## Status

- [x] Context and Reminders checked.
- [x] External references gathered.
- [x] UX/code update.
- [x] Docs update.
- [x] Verification.
- [x] Automation memory update.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| AppleScript did not list `Personal AI` Reminders | Initial Reminder list probe | Used EventKit fallback; list exists with 4 total and 0 incomplete items. |
