# User Profile Influence Preview Receipt

## Target

- Selected feature: `用户画像快速增强/降低影响`
- Source doc: `docs/features/user_profile_system.md`
- Runtime surface: `memory-exploring.html#/user-profile`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- AppleScript Reminders list enumeration did not show `Personal AI`; EventKit did show it, but all visible `Personal AI` items were already completed and about Doubao/test feedback, not User Profile influence calibration.
- Existing code already separates pending, success, failed, and partial-confirmation receipts for profile calibration.

## External Scan

- ChatGPT Memory now exposes memory summaries, sources, correction, prioritization/deprioritization, deletion, and restore-history controls.
- Claude supports memory import/export and a view/edit path, but its import docs still warn that memory import is experimental and may not incorporate every item.
- Gemini personalization is based on past-chat memory, connected app activity, and response instructions, with account/availability boundaries.
- Response-Aware User Memory Selection argues that memory selection should optimize response utility rather than only semantic similarity.
- Mem0 and MemoryBank support selective persistent memory, reinforcement, and forgetting as core long-term memory mechanisms.

## Plan

1. Keep backend semantics unchanged: `SET_EXPLICIT_IMPORTANCE` still updates `confidence/salience`; `设为重点` may confirm, `降低影响` does not auto-confirm.
2. Improve pre-action UX: the row-level and star-level calibration receipt should show current influence, target influence/actions, evidence retention, confirmation behavior, and no external/writeback side effects.
3. Update the User Profile feature doc with the current-vs-target preview behavior.
4. Extend the existing User Profile E2E to assert the new current-influence and future-only boundary copy.
5. Verify with targeted scripts, one successful `npm start` compile, User Profile E2E, and scoped whitespace checks.

## Expected Boundary

This is a presentation-layer trust fix. It should not change profile API contracts, persisted score formulas, USER_CORE rendering, provider context eligibility, or Reminder state.
