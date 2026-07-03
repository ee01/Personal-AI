# Meeting Pilot Layered ASR Improvement Plan

Goal: improve the selected `分层 ASR` feature by checking current docs/code, grounding a bounded UX improvement in related product and research references, then implementing and validating the change without touching unrelated dirty worktree files.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo guidance, automation memory, carry-over queue, feature index, Reminders list state, and prior planning context |
| 2 | completed | Inspect Meeting Pilot ASR docs, implementation files, tests, and current user journey |
| 3 | completed | Research comparable product ASR/fallback/status UX and related meeting/transcription reliability papers |
| 4 | completed | Write the concrete improvement plan and choose one low-decision implementation slice |
| 5 | completed | Implement the scoped code/docs/test changes |
| 6 | completed | Run targeted checks, first successful `npm start`, feature E2E/browser proof where practical, and scoped `git diff --check` |
| 7 | completed | Update automation memory, complete related Reminder items if any, and archive the Codex session if possible |

## Decisions

- Carry-over: `docs/progressing/to-verify.md` says `暂无。`; no unfinished verification item supersedes a fresh random selection.
- Reminder branch: local Reminders are readable, but the visible lists do not include `Personal AI`; no Reminder item can be incorporated or marked done unless another source appears.
- Selected feature: `分层 ASR` under Meeting Pilot.
- Existing dirty worktree is broad and unrelated; keep edits scoped to Meeting Pilot ASR files, docs, targeted verifiers, this planning directory, and automation memory.
- Current docs already describe `ASR 链路回执`, local final-only delay, and chunk stream fallback; the remaining bounded UX gap is cloud ASR specificity.
- Implementation slice: preserve tier transition reason separately from provider status detail, then show Cloud ASR endpoint style, model, language, and upload/size boundary in the Speech panel receipt.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Direct `ts-node/esm` ASR tests could not resolve extensionless imports such as `../cloudASRProvider` and `../../utils` | First focused unit-test run | Updated the touched ASR test/source import chain to the repo's `.js` ESM style and reran the same tests successfully |
