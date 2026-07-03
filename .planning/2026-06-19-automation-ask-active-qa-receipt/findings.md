# Findings

## Repo Context

- Target feature: `Ask 主动问答`.
- Reminder state: local Reminders has no `Personal AI` list.

## External Research

- OpenAI ChatGPT Memory FAQ describes Memory Sources as the place users can see what information influenced a response. Product implication: memory-backed answers need source/context provenance near the answer, not hidden in diagnostics.
- Anthropic Claude support says chat search uses RAG and appears as tool calls during conversations. Product implication: recall/search state should be visible as a process boundary, especially when the result is partial or depends on searched prior chats.
- Raycast AI Chat now documents automatic memory when Memory is enabled and separates quick, unobtrusive Quick AI from deeper AI Chat. Product implication: Ask should keep a lightweight surface, but the top row must be clear about whether this is a complete answer, a partial answer, or a follow-up state.
- CONQRR and QReCC / Apple question rewriting research both support converting contextual follow-up questions into standalone retrieval queries, but QReCC-style context completion can mislead when the topic is ambiguous. Product implication: the candidate confirmation boundary should remain prominent.
- Recent agent-memory survey and memory-vs-RAG discussions distinguish persistent memory from current retrieved evidence. Product implication: Ask should visually separate old active-answer prior from this turn's current evidence and should not let the prose answer look final before the evidence/writeback boundary is visible.

## Code / UX Findings

- `docs/features/ask.md` is current through 2026-06-17 and already documents topic locking,活答案 receipt, authority gating, follow-up gap receipts, and candidate confirmation.
- `memory-service/src/routes/ask.ts` implements candidate-number continuation, context title extraction, progressive evidence assembly, and answer-memory diagnostics.
- `src/modals/components/SearchResultPage.vue` renders Ask receipts, but the answer body appears before scope,活答案, and follow-up/gap receipts. As a user, the first visible row can read like a final answer even when `resolutionState` is `partial`, `insufficient`, or `deferred`, or when old prior is only a recall hint.
- Existing browser proof `tools/verify-ask-clarification-e2e.mjs` covers ambiguous candidate buttons, but not the ordering/status-first boundary for partial/deferred Ask answers.
- Tooling hiccup: attempted stale path `src/modals/SearchResultPage.vue`; actual file is `src/modals/components/SearchResultPage.vue`.
