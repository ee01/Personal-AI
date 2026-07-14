# Prompt Config Operation Receipt Plan

Goal: improve the selected `自定义消息分析提示词` / Prompt Config feature by aligning docs with code, checking external product and paper patterns, and implementing one focused UX trust fix around save/fusion in-flight state.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, `docs/progressing/to-verify.md`, feature index, prior planning files, and Reminder state |
| 2 | completed | Randomly choose a non-recent feature and inspect Prompt Config docs, source, and verification scripts |
| 3 | completed | Research comparable memory/custom-instruction/prompt-management product patterns and personalization/prompt-injection papers |
| 4 | completed | Implement a bounded operation-state receipt for save vs user-profile fusion |
| 5 | completed | Update feature docs and targeted verification scripts |
| 6 | completed | Run targeted verifier, dev compile, E2E, and scoped diff checks |
| 7 | completed | Update automation memory and close Reminder branch honestly |

## Selected Feature

- Feature index row: `自定义消息分析提示词`
- Source doc: `docs/features/custom_prompts.md`
- Main source: `src/modals/prompt-config.tsx`
- Verification anchors: `tools/verify-custom-prompts.ts`, `tools/verify-custom-prompts-e2e.mjs`

## Improvement Plan

1. Keep the real data contract unchanged: no change to `STORE_INDEPENDENT_USER_CONFIG`, `FUSE_USER_CONTEXT_CONFIG`, memory-service profile items, or analysis prompt injection.
2. Split the UI's generic saving state into a named pending operation so the page distinguishes `保存配置` from `融合到用户画像`.
3. Add a first-screen operation receipt while save/fusion is in flight. The receipt must say what is pending and what has not happened yet, especially that fusion-in-progress is not a completed user-profile write.
4. Make button copy align with the operation: the save button should not say only `保存中...` while a fusion request is running, and the fusion button should show `融合中...`.
5. Extend verifier/E2E coverage to assert the new source strings and prove the delayed successful fusion path shows the pending receipt before completion.
6. Update `docs/features/custom_prompts.md` with a concise current-behavior note.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| AppleScript did not list `Personal AI` Reminders | Reminder list probe | EventKit fallback found the list; all 4 items were already completed and unrelated to Prompt Config |
| Opening prior web-search result refs failed | Source inspection | Reopened the official/product/paper URLs directly and used those current pages |
| E2E initially missed the fusion pending receipt | First delayed-fusion assertion | Split validation from pending state and waited for a paint frame before sending save/fusion requests |
| E2E read an old save toast as if the next save finished | History assertion after save | Waited directly for storage history length instead of relying only on the transient toast |
| Service-worker memory fetch was not routeable for fusion success | Fusion success E2E | Mocked only `FUSE_USER_CONTEXT_CONFIG` in the page so the test remains focused on Prompt Config UI state |
