# Message Analysis Manual Analysis Completion

## Plan

1. Treat `docs/features/message_analysis.md` as the selected feature after confirming `docs/progressing/to-verify.md` has no pending carry-over work.
2. Experience the rules page as a RingCentral user who clicks `立即分析最近 ... 小时消息` and expects the button/result state to distinguish in-progress, completed, and failed runs.
3. Fix the completion path so successful manual analysis resets the loading state and shows a receipt that points users to `本轮分发回执` and downstream queues for actual side-effect status.
4. Extend the existing Message Analysis E2E to cover both the successful completion receipt and the existing RingCentral-read failure receipt.
5. Update the canonical feature doc and verify with the targeted script, first successful dev compile, E2E, and scoped whitespace check.
