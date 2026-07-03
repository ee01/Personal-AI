# Jira Issue Key Recovery Scope Plan

Goal: improve the randomly selected `Jira issue key 解析` feature in Jira Design Links by checking docs/code freshness, incorporating current product/research references, and implementing a focused no-decision UX/code improvement with real verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo rules, automation memory, feature index, planning context, local Reminders state, and memory hints |
| 2 | completed | Inspect Jira Design Links docs, source helpers, renderer, verifier, and E2E coverage |
| 3 | completed | Search current industry/product references and traceability research relevant to issue-link recovery |
| 4 | completed | Choose and implement the smallest useful UX/code fix without broad refactor |
| 5 | completed | Update docs and targeted tests/E2E assertions |
| 6 | completed | Run targeted verifier, development compile, extension E2E, scoped diff checks, and process cleanup |
| 7 | completed | Update automation memory and close out Reminder state honestly |

## Decisions

- Random target: `Jira issue key 解析` under Jira Design Links.
- Source doc: `docs/features/jira_design_links.md`.
- Recent automation memory covered Agent Thinking, Storyline, Meeting Pilot, Notification Center, Rehearsal, Scheduled Messages, Memory Capture/Lens, Native Join, Jira Automation Import, Message Reaction, Decision Center, and Task Scheduler; Jira Design Links was accepted from the sampled candidates because it is not one of the newest same-day targets.
- Local Reminders returned `NO_PERSONAL_AI_LIST`, so there are no `Personal AI` Reminder items to incorporate or mark done in this run.
- Worktree is broadly dirty from prior runs; only touch files directly needed for this Jira Design Links improvement and the new planning directory.

## Candidate Improvement

- Add a compact panel-level `恢复范围` receipt when one or more visible UX ticket rows came from non-standard key recovery.
- The receipt should show the recovered-candidate count and say those keys came from page metadata/text, are kept only because they match the configured design project, and are read-only candidates rather than Jira writes or canonical issue-link proof.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| None yet | - | - |
