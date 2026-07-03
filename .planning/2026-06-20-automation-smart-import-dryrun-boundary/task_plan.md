# Smart Import Dry-run Boundary Plan

Goal: improve `智能资料录入` under Memory Coverage Map by checking the current docs and code, comparing against current product/research patterns, then implementing one focused UX/code/doc improvement with targeted validation.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo workflow, automation memory, feature index, existing planning files, and Reminder list state |
| 2 | completed | Inspect Smart Import docs, UI, Memory Service routes, data contracts, and verifiers |
| 3 | completed | Research comparable import/knowledge-capture products and relevant papers |
| 4 | completed | Write the concrete improvement plan and choose the smallest no-extra-decision implementation slice |
| 5 | completed | Implement code, UX, and docs while preserving unrelated dirty files |
| 6 | completed | Run targeted tests, first successful `npm start` compile, E2E if applicable, and scoped diff checks |
| 7 | in_progress | Update automation memory, complete related Reminders if any, and archive the thread if tooling exists |

## Decisions

- Selected feature: `智能资料录入`.
- Capability: Memory Coverage Map.
- Source doc: `docs/features/memory_coverage_map.md`.
- Initial UX hypothesis: after paste/document/zip dry-run, the page should make the dry-run vs write boundary visible before user action and after import, especially for shadow memory side effects.
- Reminder check: local Reminders is reachable, but current list names do not include `Personal AI`; no Reminder item can be incorporated or completed in this run.
- Existing dirty worktree is broad. Keep edits scoped to Memory Coverage Map / smart import files, docs, verifier, planning, and automation memory.
- Implementation slice: add a first-row `智能录入范围回执` to the import drawer for ordinary smart imports. It should be visible before dry-run, remain visible during preview, and disappear after the concrete completion receipt replaces it. The receipt must state that `查看 dry-run` is read-only, later commit writes only ready entries as low-weight manual shadow memory, and zip/external-AI omissions are not automatically backfilled.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `/tmp/check-personal-ai-reminders.applescript` missing | First Reminder probe used a non-existent temp script | Retried with bounded inline multi-line AppleScript and confirmed no `Personal AI` list |
