# Meeting Outcome Binder Implementation Plan

Goal: implement the adjusted meeting outcome lifecycle as an enhancement across existing product boundaries: Today Pilot owns pre-meeting agenda/goal preparation, Meeting Pilot owns in-meeting tracking and post-meeting Panorama binding, and Ask remains a read-only consumer.

## Product Boundary

- Do not introduce a third standalone meeting product or a new top-level page.
- Today Pilot / Video Home owns `planned` outcome previews and recurring-meeting carry-over.
- Meeting Pilot owns in-meeting mention state and post-meeting outcome binding from transcript, decisions, and action items.
- Memory Service owns the shared derived `MeetingOutcomeBinder` contract and persistence.
- Ask may read and cite a binder but must not mutate it.
- P0 does not write Calendar, Jira, RingCentral, tasks, or messages.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Inspect current Today Pilot, Meeting Pilot, Memory Service, Ask, migrations, tests, and dirty-worktree overlap |
| 2 | completed | Finalize a repo-native P0 contract and implementation map; add focused tests before runtime edits where practical |
| 3 | completed | Implement Memory Service schema, repository/service, preview/bind/read APIs, and meeting-prep integration |
| 4 | completed | Implement Today Pilot / Video Home `本场要闭环` preview and handoff fields |
| 5 | completed | Implement Meeting Pilot side-panel tracking and post-meeting Panorama result binding |
| 6 | completed | Implement read-only Ask source consumption and receipts |
| 7 | completed | Add the required eval suite, canonical feature documentation, and move/remove progressing artifacts per repository policy |
| 8 | completed | Run targeted unit/API checks, eval validation/report, first successful `npm start` compile, Meeting Pilot/Today Pilot E2E, and scoped diff checks |
| 9 | completed | Validate an end-to-end experience path and provide exact user instructions |

## Decisions

- Use the existing `meeting prep -> local handoff -> Meeting Pilot session -> Panorama` path instead of a new UI shell.
- Keep `mentioned` separate from `resolved`; transcript mention alone cannot close an agenda slot.
- Treat incomplete evidence as a first-class `partial` or `blocked_by_missing_evidence` state.
- Build with the current dirty worktree as the source of truth and avoid unrelated cleanup.
- Because slot extraction/matching quality depends on LLM judgment and recall evidence, implementation must include a `meeting-outcome-binder` eval suite and one generated report.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root planning files belong to a completed Scheduled Messages task and `.planning/.active_plan` points to another implementation | Initial planning restore | Created an isolated plan directory without changing the shared active-plan pointer |
| Worktree contains broad overlapping changes from other tasks | Initial status review | Read every overlapping file before patching; stage/commit is out of scope unless later requested |
| New binder API tests returned 404 | First targeted test run | Confirmed the route was registered; test fixtures used `default` while raw-db test apps assign `request.userId = test`, so fixtures were corrected to the real test identity |
| Existing Storyline-positive fixture fell below its newer three-evidence threshold | First targeted test run | Kept the product assertion and strengthened the positive fixture to three distinct memory records; explicit one-record and calendar-only negative cases remain unchanged |
| Scene 1 expected a binder status diagnostic attribute that the live section did not expose | First Meeting Pilot Scene 1 run | Added read-only `data-meeting-outcome-status`; rebuilt `dist` and reran Scene 1 successfully |
| Six-ability benchmark reported Temporal 0.67 because `Cursor 30%` was absent | Local branch benchmark | Confirmed no matching binder was injected, the local `esone.qiu` database contains no `Cursor + 30%` fact, and the current online Ask endpoint also misses it; recorded as stale benchmark/data drift rather than a Meeting Outcome regression |
| Post-meeting coverage receipt omitted partial/blocked slots from “still needs work” | Final code review | Count all partially resolved, unresolved, carried-over, and missing-evidence slots; added an API assertion for `1 closed, 2 continuing` and reran tests/eval |
