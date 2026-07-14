# Findings

## Initial Context

- `AGENT.md` requires docs/features sweeps to read `docs/progressing/to-verify.md`, automation memory, Reminders, feature docs, implementation, and verifier/E2E files before editing.
- `docs/progressing/to-verify.md` currently says no pending verification items.
- Automation memory shows recent exact surfaces include Google Slides partial success reselect, Message Reaction toolbar settings, Scheduled Messages health recovery, Agent Thinking handoff, Doubao revoke, Ask evidence-source, and other July 9 receipt work; avoid those exact surfaces.
- Worktree is already broadly dirty; this run should own only the new evidence-watch planning directory plus target feature files.

## Reminder Check

- AppleScript listed local reminder lists but did not include `Personal AI`.
- EventKit fallback returned `Personal AI` with 4 total items and 0 incomplete items.
- The completed items are historical Doubao / test / Notification feedback, unrelated to Evidence Watch Contracts, authority-source rechecks, duplicate suppression, or Ask watch receipts. Nothing should be marked done for this run.

## External Research

- OpenAI Scheduled Tasks docs say monitoring tasks periodically check for changes, remember previous runs, and notify only when there is something worth reporting; the UI also has task management, pause/resume/edit/delete boundaries. Design implication: established watch and a completed current check must remain separate.
- Google Alerts lets users tune frequency, source types, region/language, result volume, and delivery account, and sends emails when matching search results are found. Design implication: an alert/watch object is not proof that a source was just re-read.
- FreshLLMs / FreshQA focuses on fast-changing knowledge and false premises, and shows that retrieved up-to-date evidence order/count affects answer correctness. Design implication: old answer memory must stay historical until a current authority source check occurs.
- Doyle's Truth Maintenance System records and maintains reasons for beliefs so assumptions can be revised when contradicted. Design implication: Evidence Watch receipts should expose the run reason/state, not only the contract state.

## Code/Doc Inspection

- `docs/features/evidence_watch_contracts.md` is already updated to describe contract subject keys, dedupe keys, list read receipts, invalid state blocking, and the rule that `created` / `skipped_duplicate` do not update `lastCheckedAt`.
- `EvidenceWatchContractService` already returns list receipts and keeps `skipped_duplicate` from changing state or `lastCheckedAt`.
- Gap found: when Ask reuses an existing Evidence Watch action, the service detail says no duplicate action was created, and the UI shows `有本轮 run` / duplicate count, but it does not explicitly name the current run as a duplicate-suppression lifecycle receipt or say that no authority source was touched in this Ask turn.
