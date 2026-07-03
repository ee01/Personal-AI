# Ask active-answer authority receipt

Run time: 2026-06-10T02:04:07+08:00

## Selected feature

- Random index pick: `Ask 活答案记忆`
- Canonical doc: `docs/features/ask.md`

## Carry-over and reminders

- `docs/progressing/to-verify.md`: `暂无。`
- Local Reminders: Reminders is accessible, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.

## Research signals

- Product memory controls in ChatGPT and Claude emphasize visible memory use, user control, and boundaries.
- Conversational QA/query rewriting work supports resolving short/deictic questions before retrieval.
- Recent stale-memory work highlights that systems can retrieve new evidence but still act on outdated state; visible update authority is useful.

## Improvement plan

1. Keep the existing AnswerMemory backend gate unchanged.
2. Expose `answerMemory.authority` in the extension client type.
3. Render the authority decision and evidence role counts inside the Search Result Ask answer receipt.
4. Extend the search feedback E2E fixture to assert the authority receipt.
5. Update `docs/features/ask.md` with the user-visible behavior and run focused validation.
