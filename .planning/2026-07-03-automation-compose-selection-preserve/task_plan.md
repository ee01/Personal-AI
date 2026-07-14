# Compose Assist Selection Preserve Plan

## Goal

Improve `回复助手直接插入` so a user-selected range in a contenteditable composer is preserved when the Compose Assist review/confirm controls take focus before insertion.

## Target

- Feature: `回复助手直接插入`
- Capability: Compose Assist
- Source doc: `docs/features/compose_assist.md`
- Primary files: `src/composer-guard/siteContextAdapters.ts`, `src/composer-guard/ComposerGuardController.ts`, `tools/verify-compose-assist-direct-insert-e2e.mjs`

## Plan

1. Context and target selection - complete
2. External scan and Reminder check - complete
3. Add a small selection snapshot/restore path for confirm insert - complete
4. Extend direct-insert E2E with the focus-lost selection replacement case - complete
5. Update canonical feature docs - complete
6. Run focused verification: targeted unit/E2E, `npm start` first compile, direct-insert E2E, scoped `git diff --check` - complete

## Decisions

- Keep the fix presentation/client-side only. Do not change composer generation, recall, thresholds, feedback contracts, or background APIs.
- Restore the captured selection only for the same target/context at insertion time; if the draft changed, the existing stale-draft gate still blocks insertion.
- Do not touch Reminder items because EventKit found only completed Doubao / digest / sync items unrelated to Compose Assist.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| AppleScript did not show `Personal AI` list | Reminder list probe | EventKit fallback found the list and confirmed all four items were completed and unrelated |
| `node` was missing from the default shell PATH | Initial verification | Re-ran checks with `$HOME/.nvm/versions/node/v24.13.0/bin` |
