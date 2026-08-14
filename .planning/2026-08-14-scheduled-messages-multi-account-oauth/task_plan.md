# Scheduled Messages Multi-Account OAuth Repair

Goal: keep Scheduled Messages bound to the Google account that owns its grant, avoid false reauthorization prompts, and only evict cached tokens for confirmed credential failures.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Inspect current OAuth helpers, Chrome account APIs, recovery classification, and existing tests |
| 2 | complete | Implement multi-account token discovery and persisted account affinity |
| 3 | complete | Make initialization recovery retry/account-aware and narrow 401 cache eviction |
| 4 | complete | Add multi-account and false-reauth regression coverage |
| 5 | complete | Run targeted checks, dev build, and review the final scoped diff |

## Decisions

- Preserve all unrelated dirty-worktree changes.
- Store only the opaque Chrome account id; never store access tokens.
- Prefer an already-pinned account, then silently probe available Chrome accounts, and use account-less interactive selection only when no working account is known.
- Do not alter Google account-side grants during recovery.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root-level planning files belong to an older completed task | Planning setup | Use this isolated planning directory without changing the existing active-plan pointer |
| Existing verifier deep-equality rejected a newly recorded `accountId: undefined` field | First targeted test run | Keep absent account ids omitted from the request receipt |
| Node ESM could not resolve the newly imported test target without an extension | First targeted test run | Use the explicit `.ts` import for this direct TypeScript test |
| Multi-account harness storage mock treated a key array as a Map object key | Second targeted test run | Normalize storage reads to a string-key array, matching Chrome storage behavior |
| Direct service import exposed unrelated extensionless transitive imports under Node ESM | Second targeted test run | Move the pure credential classifier into a dependency-free module with the repo's `.js` ESM specifier convention |
| `git diff --no-index --check` returned 1 for a clean new file | Final whitespace check | Treat exit 1 as the documented “files differ” result; only output would indicate whitespace errors |
