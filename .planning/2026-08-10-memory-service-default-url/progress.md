# Memory Service Default URL Progress

## 2026-08-10

- Read repository instructions and diagnosed the split default without modifying runtime code.
- Confirmed relevant runtime lines are not part of the pre-existing uncommitted hunks in the same dirty files.
- Chosen fix: a shared build-time default URL constant, a focused client regression test, and accurate Options helper copy.
- Added `src/memoryServiceConfig.ts` and reused it from both `defaultEnvConfig` and `MemoryServiceClient`.
- Updated Options helper copy and the canonical Message Reaction feature document.
- Added regression tests for missing storage and an explicit stored override.
- `npm run verify:message-reaction` passed 98/98 tests.
- The first focused client-test attempt stopped before assertions because Node 24/ts-node rejected `MemoryServiceClient`'s existing directory import `../i18n`; changed it to the equivalent explicit `../i18n/index` path for the rerun.
- The second attempt required the repository's `.js` ESM specifier convention; updated the import to `../i18n/index.js` before the next run.
- The third loader failure identified the same missing `.js` convention on the newly added shared-config imports; corrected both import sites.
- Focused client tests then passed 2/2.
- `npm start` produced a successful development build in 38.7 seconds and the watch process was stopped cleanly.
- The broad Message Reaction E2E timed out on the unrelated Watch-rule form before it exercised this request path; added a narrow built-extension E2E that compares the Options value with the captured background `from-message` request and rejects localhost fallback.
- `npm run verify:memory-service-default-url:e2e` passed against the rebuilt extension: Options displayed `10.32.56.212` and the background POST used that same base with no localhost request.
- Final focused client tests passed 2/2 and Message Reaction unit tests passed 98/98.
- Final focused E2E rerun passed; Prettier checks for all new code and scoped whitespace checks passed.
