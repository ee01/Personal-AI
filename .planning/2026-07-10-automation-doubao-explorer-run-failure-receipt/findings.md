# Findings And Decisions

## Requirements
- Pick one random feature from `docs/index.md`.
- Check code and docs freshness.
- Search comparable products and papers for constructive improvement ideas.
- Implement unfinished or low-decision improvements when feasible.
- Improve UX path and presentation, then verify as completely as practical.
- Check the local `Personal AI` Reminders list and mark completed source ideas done only if applicable.

## Research Findings
- Selected feature: `Doubao / ChatGPT explorer 输入链路` in `docs/features/doubao_bridge.md`.
- `docs/progressing/to-verify.md` says there are no pending carry-over items.
- AppleScript listed many Reminder lists but missed `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 open items. Completed historical Doubao feedback was unrelated to the current explorer input failure-path gap, so no Reminder item should be changed.
- OpenAI Memory FAQ and data export docs emphasize memory sources, editable/deletable memories, and account-level data export boundaries.
- Claude memory import/export is now an explicit cross-provider memory portability product path.
- Mem0 and LongMemEval reinforce extracting structured long-term memory from conversations and retaining enough provenance/time/source context for reliable recall and evaluation.

## Technical Findings
- `formatExplorerRunRequestReceipt` already states whether pending settings will be saved, scope, lookback, ChatGPT max conversations, transport preference, cache/cursor pending state, and no delete/no writeback boundary.
- Doubao and ChatGPT manual fetch handlers show this receipt before `explorerApi.runNow`, but their catch blocks replace it with only the error text.
- Losing the request snapshot is a UX trust gap: after a failure the user cannot tell which source/scope/transport was attempted or whether a prior silent save changed the attempted run.
- Existing E2E already covers request and success receipts; it can be extended to force a failed `runNow` response and assert the failure keeps the request boundary.

## Resources
- Feature doc: `docs/features/doubao_bridge.md`
- Runtime UI: `desktop-app/app/renderer.js`
- E2E: `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`
- Product references: OpenAI Memory FAQ, OpenAI data export, Claude memory import/export
- Paper references: Mem0, LongMemEval, machine unlearning verification

## Decision
Implement a presentation-only failure receipt that prepends the failed source and error to the same run-request context, then verify through the existing Desktop App explorer harness.
