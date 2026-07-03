# Ask Candidate Follow-up Locale Plan

Goal: improve the selected `Ask 短问句话题锁定` feature by keeping the docs current, applying product/research guidance, and shipping one focused UX robustness fix with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo workflow, automation memory, feature index, Ask docs, relevant code/tests, Reminder list state, and external references |
| 2 | completed | Implement a focused Ask clarification follow-up improvement |
| 3 | completed | Update Ask feature docs |
| 4 | completed | Run targeted tests, dev compile, E2E/browser-level proof, and whitespace checks |
| 5 | completed | Update automation memory, attempt archive, and summarize |

## Decisions

- Selected feature: `Ask 短问句话题锁定`.
- Source doc: `docs/features/ask.md`.
- Primary code path: `memory-service/src/routes/ask.ts`.
- Existing Quick Ask UI already renders ambiguous-topic candidate buttons; the remaining gap is making the service-side follow-up parser robust when candidate blocks or user replies are in English.
- Local Reminders was readable, but there is no visible `Personal AI` list, so no Reminder item can be incorporated or marked done.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `rg` included a stale path `src/modals/SearchResultPage.vue` | Initial Ask surface scan | Re-ran focused searches against the actual desktop Quick Ask and memory-service paths |
