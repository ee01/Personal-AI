# Message Analysis Expired Rule Boundary Findings

## Findings

- `buildManualWatchRules(...)` currently maps all manual `concernedItems` into runtime rules without checking `expiredAt`.
- `background.ts` cleans expired manual rules during startup, but a rule can expire while the extension stays open, leaving stale storage that runtime analysis can still read.
- The rule card shows `已过期`, but the delivery and side-effect receipts still describe what will happen "命中后", which makes the inactive state easy to misread.
- This is low-decision work: expired rules should not run, and the UI should say so directly.

## Chosen Slice

- Runtime: filter expired manual rules at the shared builder so all analysis paths inherit the same boundary.
- UX: add a rule-card-only inactive receipt for expired rules. New/edit previews still describe the future saved rule because they are form previews.
- Verification: targeted message-flow verifier plus the existing topic-modal E2E.

