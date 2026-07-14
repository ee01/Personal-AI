# Today Pilot Home Snapshot Basis Plan

Goal: improve the selected `今天排序与噪声控制` feature by making the Today Pilot home filtering summary show the current brief snapshot basis without changing ranking, feedback writes, or external actions.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, `docs/progressing/to-verify.md`, feature index, prior planning files, current worktree, and Reminder state |
| 2 | completed | Select Today Pilot after random sampling and recent-target reroll, then inspect docs/source/verifiers |
| 3 | completed | Do a small outside product and paper scan for daily brief, prioritization, and notification batching patterns |
| 4 | completed | Implement homepage snapshot-basis receipt, update docs, and extend Today Pilot verifiers |
| 5 | completed | Run targeted verification, first successful `npm start` compile, Today Pilot E2E, and scoped diff checks |
| 6 | completed | Update automation memory and summarize Reminder state |

## Decisions

- Selected feature: `今天排序与噪声控制` under Today Pilot (`docs/features/today_pilot.md`).
- Random sample initially surfaced AR Data and Jira Automation Import, but those areas have very fresh dirty/recent work. This run selected the next viable sample, Today Pilot sorting/noise control.
- Reminder state: AppleScript did not list `Personal AI`; EventKit found the list with four completed historical Doubao / Weekly Dream Digest items. No open Today Pilot-related Reminder item is incorporated or markable.
- Implementation slice: surface an `首页快照基准` note in the existing homepage `筛选口径`, using the API response's `generated` / `stale` status plus `brief.generatedAt` and `brief.status`.
- Non-goals: no ranking formula changes, no source scanning changes, no feedback semantics changes, no popup rewrite, and no external writes.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Perl random sampler had a quote/brace error | Initial random sample command | Replaced it with a simpler `awk` + Perl shuffle pipeline |
| Swift EventKit inline command had string escaping error | Initial Reminder fallback | Re-ran EventKit with a stdin Swift script |
| `node` missing from PATH | package script inspection | Used `$HOME/.nvm/versions/node/v24.13.0/bin/node` and will prepend that path for validation |
