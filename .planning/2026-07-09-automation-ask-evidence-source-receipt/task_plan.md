# Ask Evidence Source Receipt Plan

## Target

- Feature: `Ask 主动问答` / `Ask 活答案记忆`
- Docs: `docs/features/ask.md`, `docs/index.md`
- Primary UI: `src/modals/components/SearchResultPage.vue`
- Verification: `tools/verify-ask-clarification-e2e.mjs`

## Plan

1. Keep the change presentation-only: do not alter `/ask`, recall, AnswerMemory, Evidence Watch, or write paths.
2. Add an answer-before-body receipt that summarizes the currently returned Ask evidence basis: evidence count, source types, source titles, and recall channels when present.
3. State the boundary in the receipt: it is only the visible returned evidence slice, not full-store coverage, fact confirmation, answer-memory write, external action, or user-representing send.
4. Extend the Ask E2E fixture to assert the receipt appears before the answer body for both ambiguous-followup and direct locked Ask paths.
5. Update the Ask feature doc and index row concisely.
6. Run targeted Ask verification, dev compile, E2E, and scoped diff checks.

