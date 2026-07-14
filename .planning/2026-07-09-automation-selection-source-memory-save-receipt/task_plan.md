# Selection Source Memory Save Improvement Plan

Goal: improve the selected `选中文字保存为资料记忆` feature by checking docs/code freshness, scanning comparable products and research, then implementing one focused UX/trust-boundary improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, root planning state, and local Reminders state |
| 2 | completed | Inspect Memory Capture docs, selection-save code paths, verifier coverage, and current dirty-file scope |
| 3 | completed | Search current product and research references for web clipping, highlighted-source capture, and personal memory trust boundaries |
| 4 | completed | Write the concrete improvement plan and select the smallest low-decision implementation slice |
| 5 | completed | Implement selected code/docs/test changes while preserving unrelated dirty files |
| 6 | completed | Run targeted verifier, dev extension compile, and E2E where available |
| 7 | completed | Update Reminders if applicable, append automation memory, and summarize outcome |

## Decisions

- Selected feature: `选中文字保存为资料记忆`.
- Source doc: `docs/features/memory_capture.md`.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items, so no Reminder item is related or completable this run.
- Existing dirty worktree is broad and mostly unrelated. Keep edits scoped to Memory Capture selection-save UX, matching verifier/E2E assertions, docs/index notes, and this planning directory.
- Concrete implementation slice: add a selected-text snapshot receipt inside the selection-save review panel. The receipt must say the panel saves the text preview captured when the panel opened, note edits do not rescan the page, and changing the page/selection requires reselecting before save. This is a presentation/trust-boundary fix only.
- Reminder closeout: no incomplete `Personal AI` Reminder items existed, so nothing was marked done.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `shuf` unavailable | Feature randomization | Re-ran the feature sampler with Perl `List::Util=shuffle` |
