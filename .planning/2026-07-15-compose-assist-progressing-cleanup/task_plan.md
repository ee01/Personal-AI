# Compose Assist Documentation Cleanup Plan

Goal: verify the Compose Assist capability is implemented and covered by the repository's real validation paths, preserve its key product and implementation contracts in `docs/features`, then remove only the superseded Compose Assist planning artifacts from `docs/progressing`.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repository instructions, prior Compose Assist context, current feature docs, progressing artifacts, and dirty worktree state |
| 2 | completed | Map every progressing requirement to implementation, canonical docs, and tests; identify any genuine gaps |
| 3 | completed | Fill missing canonical documentation or narrow implementation/test gaps without disturbing unrelated changes |
| 4 | in_progress | Run the required targeted tests, first successful `npm start` compile when runtime code changes, E2E/eval as applicable, and scoped diff checks |
| 5 | pending | Delete only superseded Compose Assist progressing docs/demo and verify no stale references remain |

## Decisions

- The existing `.planning/.active_plan` and root planning files belong to unrelated work and will not be modified.
- Deletion is allowed only after each progressing requirement is confirmed in code, tests, or canonical feature documentation.
- Preserve all unrelated dirty-worktree changes.
- The Prompt Context Compiler progressing artifacts were already absent. Retire the completed Persona Projection P0 plan, preserve its demo under `docs/demo`, and keep P1-P3 as explicit expansion boundaries in the canonical Compose Assist doc.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Structured JSONL update tried to parse the leading `#` comment as JSON | 1 | Preserve comment/blank lines and parse only data lines on retry |
| Real Jira estimate eval returned WARN because remote response omitted `insertMode` | 1 | Selectively deploy the four Compose Persona/Compiler runtime files, rebuild only memory-service, and rerun the case |
| First container build command was accidentally targeted at the local worktree instead of the remote host | 1 | Do not reuse it; invoke remote Docker explicitly over SSH with absolute compose/project paths |
| Remote non-login SSH shell could not find `docker` | 2 | Resolve Docker from the remote login shell, then invoke that absolute binary path for the third build attempt |
| Remote image build reached TypeScript but failed on stale `LLMOptions.reasoningEffort` and `RecallContextExpansionInput.preferredTopicTitle` contracts | 3 | Audit the exact local/remote dependency files; sync only if they are narrow contract dependencies, otherwise stop deployment and validate against a local branch server |
| Build retry after narrow contract sync lost the remote Docker RPC stream with EOF | 1 | Treat as OrbStack/Docker transport failure, verify daemon health, then retry only after the daemon responds |
