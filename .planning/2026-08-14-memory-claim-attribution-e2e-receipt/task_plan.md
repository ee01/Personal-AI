# Memory Claim Attribution E2E Receipt Fix

Goal: restore the correction receipt in the claim-attribution extension journey without weakening the raw-message or correction boundaries.

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Reproduce the E2E failure after a fresh development build and record the failing assertion. |
| 2 | completed | Trace the Ask correction state and its test fixture request path to identify the missing receipt. |
| 3 | completed | Cover every configured Memory Service host in the fixture route and retain a diagnostic assertion for correction status. |
| 4 | completed | Rebuilt the extension, ran targeted tests and evals, passed the extension E2E, and checked scoped whitespace. |

## Error record

`npm run verify:memory-claim-attribution:e2e` times out waiting for `已更新派生归属；原始消息未修改。` after the Ask receipt correction action.

Root cause: the extension service worker can initialize its Memory Service client before fixture storage is seeded, leaving a configured remote base URL. The old localhost-only route then permitted the correction request to escape the fixture and return 404.

## Safety boundary

The fix must retain optimistic revision and idempotency behavior, keep `rawSourceChanged: false`, and must not cause the real RingCentral evaluation to submit a correction.
