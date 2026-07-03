# Memory Lens positive feedback receipt

## Target

- Random feature: `Memory Lens / 记忆提示 Expanded Card`
- Source of truth: `docs/features/memory_lens.md`
- Reminder check: local Reminders did not contain a `Personal AI` list, so no item-level feedback was available to apply or mark done.

## External scan

- OpenAI ChatGPT Business memory sources expose referenced memories, past chats, custom instructions, and a not-relevant control. The UX direction is that memory use and relevance feedback should be visible at the point of use.
- Gemini personal context / Gemini Enterprise memory controls emphasize connected-source visibility and user-managed memory or source controls.
- Memento proactive-memory research supports low-interruption surfacing of contextual memories, but the prompt still needs enough visible provenance and user control to avoid over-trusting a proactive hint.

## Improvement Plan

1. Inspect Memory Lens Expanded Card implementation, docs, and existing verify/E2E harness.
2. Add a card-local positive feedback receipt with pending, confirmed, and failed states.
3. Keep feedback state keyed by match id so paging between cards does not leak receipts.
4. Update docs to clarify confirmed writeback versus local optimistic UI.
5. Verify with static checks, first successful dev compile, and the existing Playwright extension E2E.

## Implementation Notes

- The change is presentation-only. It does not alter `/context-recall`, ranking, source filtering, feedback payload shape, or Memory Service write behavior.
- Pending state says the feedback is not learned until service confirmation.
- Confirmed state locks both feedback buttons to prevent duplicate or contradictory votes.
- Failed state keeps the card open, unlocks the buttons, and says this attempt did not learn successfully.

## Verification

- `node --check desktop-app/scripts/webpage-memory-detection-check.mjs`
- `npm run verify:webpage-memory-detection`
- `npm start` until first successful webpack compile, then stop.
- `npm run verify:webpage-memory-detection:e2e`
- Scoped `git diff --check`
