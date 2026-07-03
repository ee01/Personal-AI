# 2026-06-09 Automation: Today Rehearsal Cue

## Goal

Improve one bounded UX/code gap for `今日预演提示` under Today Pilot / Rehearsal, update the canonical feature doc, and verify the changed behavior through the strongest practical local path.

## Current Phase

Phase 6 - Complete

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Read repo instructions, automation memory, carry-over, Reminders, feature index, and selected feature docs/code |
| 2 | complete | Research adjacent product/paper guidance and identify one low-decision improvement |
| 3 | complete | State the concrete implementation plan before editing |
| 4 | complete | Implement scoped code/test/doc updates without touching unrelated dirty work |
| 5 | complete | Run focused tests, dev build, feature E2E/browser proof where practical, and diff checks |
| 6 | complete | Update automation memory, Reminder state if applicable, and summarize outcome |

## Decisions

| Decision | Rationale |
| --- | --- |
| Selected `今日预演提示` from `docs/features/index.md` | Random sampler picked this feature after excluding the freshest target docs from recent automation runs |
| Keep Reminder branch closed unless a `Personal AI` list appears | Local Reminders is reachable but the visible list names do not include `Personal AI` |
| Use `.planning/2026-06-09-automation-today-rehearsal-cue/` | Avoids overwriting root planning files and prior automation plans |
| Implement a Today Pilot `rehearsalCueReceipt` | The gap is not missing Rehearsal data, but missing cue/status/script/boundary visibility before the user opens details |

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Ruby `Array#filter_map` unavailable | Initial random feature sampler | Re-ran with Ruby `map...compact` for macOS/older Ruby compatibility |
