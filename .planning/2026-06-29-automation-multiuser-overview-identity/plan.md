# Multi-user Overview Identity Receipt

## Target

- Feature: `多用户隔离` in `docs/features/index.md`.
- Surface: Memory Exploring / Today Pilot overview header.
- Current state: Memory Service already resolves `X-User-Id`, blocks fallback writes, returns identity metadata from `/stats`, and the Explorer sidebar shows the current memory user.

## External reference scan

- ChatGPT Memory and Claude Memory put memory visibility and controls in the user's normal path instead of hiding it behind backend state.
- Notion Enterprise Search documents query-time permission checks and user/workspace scoped access as part of search trust.
- Recent governed/shared memory and local-first memory research frames scoped retrieval, provenance, and isolation as user-visible trust boundaries, not only storage layout.

## User problem

Today Pilot's overview header can show memory/source counts from `/stats`, but the header itself does not say which memory user space those counts belong to. As a user, seeing `消息 / 片段 / 关系 / 待提醒` without the identity context can make a default fallback look like real account data.

## Plan

1. Add a compact identity receipt to `OverviewPage.vue` based on `stats.user`.
2. Use normal tone for explicit `X-User-Id` and warning tone for `default_fallback`.
3. State the storage key and boundary: overview stats and missions are read from that per-user SQLite space; fallback is read-only compatibility and writes/import/restore remain blocked.
4. Extend `tools/verify-memory-user-identity-e2e.mjs` to cover explicit and fallback overview receipts.
5. Update `docs/features/memory_system.md` to document the overview receipt.

## Validation

- `npm --prefix memory-service test -- --run src/__tests__/api-health.test.ts`
- `npm start -- --progress` until first successful compile, then stop.
- `npm run verify:memory-user-identity:e2e`
- `npm run verify:i18n`
- Scoped `git diff --check`.
