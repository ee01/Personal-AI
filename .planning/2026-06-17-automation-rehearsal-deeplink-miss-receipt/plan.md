# Rehearsal deep-link miss receipt

## Target

Feature: Rehearsal 管理页 (`memory-exploring.html#/rehearsals`).

Random source: `docs/features/index.md` -> `Rehearsal 管理页`.

## Plan

1. Inspect the current feature doc, page implementation, API route, service lifecycle code, and existing E2E.
2. Check local Reminders for a `Personal AI` list and include related user feedback if available.
3. Review current reminder / memory-management references for cue/action/source visibility.
4. Fix a focused UX gap: failed `?rehearsalId=` deep links currently fall back to the list without a visible receipt.
5. Update the feature doc and E2E so the boundary stays durable.

## Findings

- Local Reminders was readable, but there was no `Personal AI` list.
- The page already had recent work for action receipts, no-cue diagnostics, and activation diagnostics.
- A missing or failed deep-link target was still ambiguous: users could land on a fallback item and mistake it for the requested Rehearsal.

## Change

- Add a `深链目标未确认` receipt when a deep-linked Rehearsal cannot be loaded.
- Keep list browsing available, but state that the fallback list is not proof the target was deleted, archived, or marked irrelevant.
- Offer `重试目标` and `查看 All` recovery paths.

## Validation

- `npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts`
- `npm start` first successful dev compile, then stop watch
- `node tools/verify-rehearsals-page-e2e.mjs`
- `git diff --check`
