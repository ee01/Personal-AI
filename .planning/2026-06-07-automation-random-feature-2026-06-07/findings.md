# Meeting Pilot History Archive Findings

## Initial Context

- Randomly selected feature: `会议历史归档`.
- Capability: Meeting Pilot.
- Source document: `docs/features/meeting_pilot.md`.
- Feature index row: `MeetingHistoryPage.vue`.
- Carry-over check: `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no local Reminder feedback can be incorporated or completed in this run.
- Worktree is already broadly dirty. Treat unrelated changes as pre-existing and avoid reverting or staging them.

## Research Findings

- Zoom transcript management lets users/admins search meeting-summary transcripts by meeting ID, host, topic, keyword, status, and date range. This supports keeping Meeting Pilot archive search broad and status-aware.
- Microsoft Teams Intelligent Recap makes prerequisites explicit: transcription is required, recording unlocks the fuller recap experience, and recap exposes notes, tasks, markers, speakers, topics, and chapters. This supports making missing/blocked artifacts visible instead of hiding them behind a generic archive card.
- The CSCW 2024 LLM meeting recap paper argues for complementary recap views such as highlights and structured hierarchical minutes, plus organizational artifacts and personalization. Meeting Pilot should keep Panorama recoverable even when PDF generation fails.
- ACIS 2023 meeting-assistant work frames AI meeting assistants as making voice conversations visible, traceable, and searchable in organizations. That reinforces explicit audit/status labels for archive records.

## Code And UX Findings

- `docs/features/meeting_pilot.md` is mostly current for meeting history pagination, server-side search/status filtering, safe PDF links, and Panorama detail hydration.
- `memory-service/src/routes/meetings.ts` filters by status before pagination, but `getArchiveStatus()` does not classify a non-empty unsafe PDF URL as `attention` unless the digest is already failed or completed-without-safe-PDF. That conflicts with the doc phrase `PDF 链接不可安全打开`.
- `src/modals/memory-exploring-messageHandler.ts` repeats the same status classifier for E2E fixtures, so the fixture path can hide the same mismatch.
- `src/modals/components/MeetingHistoryPage.vue` disables unsafe PDF open actions and explains the PDF status, but cards do not yet expose a compact "what should I do next" recovery hint for failed/missing/blocked PDF states.
- `desktop-app/scripts/meeting-pilot-history-check.mjs` already verifies pagination, search, status filters, unsafe PDF blocking, and Panorama open actions; it can be extended to cover unsafe-link attention classification and the new recovery copy.

## Technical Decisions

| Decision | Rationale |
| --- | --- |
| Avoid recent automation targets | Reduces duplicate improvements across recurring runs |

## Issues Encountered

| Issue | Resolution |
| --- | --- |
| Root `task_plan.md` was for Scheduled Messages | Use isolated plan directory for this run |
| First E2E expectation assumed only failed and unsafe-link records would match `attention` | Kept existing fixture semantics and filtered by keyword `Security` plus `attention` to prove unsafe-link classification |

## Validation Findings

- `npm --prefix memory-service test -- --run src/__tests__/api-meetings.test.ts` passed.
- `npm start` compiled the development extension successfully and the watcher was stopped with Ctrl-C after first compile.
- `npm run test:meeting-pilot-history` passed after correcting the E2E expectation; screenshot directory reported by the passing run: `/var/folders/bd/rh2dy5vx5qg79lf986z_0bgc0000gq/T/meeting-pilot-history-check-iSako2`.
- `git diff --check` passed for the full dirty worktree.
- Exploratory `npx vue-tsc --noEmit --pretty false --skipLibCheck` was not counted as validation because the repo-level TS 6 deprecation settings stopped it at `tsconfig.json`.
