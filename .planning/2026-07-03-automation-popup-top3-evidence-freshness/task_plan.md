# Popup Top 3 Evidence Freshness Plan

Goal: improve the selected `Popup Top 3` feature by making the Today Pilot popup snapshot basis clear, keeping docs current, and verifying the user-visible behavior through the existing extension E2E path.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, feature index, automation memory, existing planning context, and Reminders state |
| 2 | completed | Select `Popup Top 3`, inspect Today Pilot docs, popup source, Memory Service types, and existing Today Pilot verifiers |
| 3 | completed | Research comparable daily brief / AI reminder products and papers for UX constraints |
| 4 | completed | Implement a compact snapshot-basis receipt in the popup Top 3 scope receipt and update docs/E2E |
| 5 | completed | Run targeted verifier, `npm start` first successful compile, Today Pilot E2E, scoped diff checks |
| 6 | completed | Update automation memory and summarize Reminder handling and validation evidence |

## Decisions Made

| Decision | Rationale |
| --- | --- |
| Selected feature: `Popup Top 3` | Chosen from a random eligible `docs/index.md` sample while avoiding the freshest exact automation targets |
| Improvement slice: snapshot-basis receipt | The popup already says Top 3 is non-executing, but it does not expose generated/read freshness; this is a low-decision trust/UX improvement |
| No Reminder item to close | EventKit found `Personal AI`, but all 4 items are completed historical Doubao / digest / sync feedback and unrelated to Popup Top 3 |

## Errors Encountered

| Error | Resolution |
| --- | --- |
| Planning skill path under `.codex` was absent | Used the installed script under `/Users/Esone/.agents/skills/planning-with-files/scripts/` |
| AppleScript missed `Personal AI` Reminders | Used EventKit fallback, which found only completed unrelated items |
