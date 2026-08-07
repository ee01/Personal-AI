# Evidence Watch run write receipt plan

## Selected feature

- Feature: `证据守望契约`
- Capability: Memory Service
- Source doc: `docs/features/evidence_watch_contracts.md`
- Index row: `docs/index.md`

## Context checks

- `AGENT.md` read for the automation workflow and verification ladder.
- `docs/progressing/to-verify.md` is empty.
- Automation memory showed recent sweeps on Notification Center, Today Pilot, Agent Thinking, Ask, scope semantics, Rehearsal, Jira Import, User Profile, Coverage, Relationship Radar, Scheduled Messages, Project Dashboard, Doubao, Native Join, Agent Workflow, Topic, Meeting Pilot, Reflection, Message Reaction, Skill Foundry, Memory Capture, AR Data, Message Analysis, Google Slides, Jira Design Links, and Quick Ask. Evidence Watch itself was not the freshest direct target.
- AppleScript did not list `Personal AI`, but EventKit did. EventKit found 4 total Reminder items, 0 incomplete; none were Evidence Watch related.

## External scan

- ChatGPT Scheduled Tasks and Google Alerts support a monitor/recurring-check mental model, but they do not by themselves prove a source was rechecked on every read or duplicate trigger.
- FreshLLMs / FreshQA highlights the risk of changing-world and false-premise answers, so Evidence Watch should keep old conclusions historically scoped until a real check happens.
- Truth Maintenance System work supports preserving reasons and update receipts, not just the latest belief.

## Improvement plan

1. Add a typed `证据守望运行写入回执` for POST run writes.
2. Return it from `POST /api/v1/evidence-watch-contracts/:id/runs`.
3. Include whether the run counts as a real evidence check, state before/after, lastCheckedAt before/after, nextCheckAt, checked source count, suppressed action count, and patch count.
4. Assert that `blocked` advances `lastCheckedAt` and that `skipped_duplicate` does not.
5. Update canonical docs and the feature index with concise behavior notes.
6. Verify with memory-service tests, Evidence Watch eval, memory-service build, and scoped whitespace checks.

## Non-goals

- Do not change EvidenceResolutionPlanner routing.
- Do not change Ask answer generation, recall/ranking, or Answer Memory writes.
- Do not create a user-facing Evidence Watch page.
- Do not execute external checks, send notifications, write authority sources, or deploy Memory Service.
