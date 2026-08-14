# AgentTask Dify failure writeback

## Goal

Make the Jira AgentTask bridge distinguish Dify workflow transport success from downstream business acceptance, and write rejected executions back to Sheet as failures.

## Phases

- [complete] Update Jira rule template with accepted/rejected callbacks and bump rule version.
- [complete] Add regression coverage for Dify output routing and failure details.
- [complete] Update canonical Scheduled Messages documentation.
- [complete] Run targeted tests, development compile, and scoped diff checks.

## Constraints

- Preserve unrelated dirty-worktree changes.
- Do not modify Dify credentials or deploy live Jira/Dify configuration.
- Keep Apps Script callbacks as GET requests.

## Errors

- webpage-mcp native bridge unavailable during diagnosis; used supplied screenshot and repository evidence instead.
- First targeted test run found one stale `1.7.0` assertion after the rule bump; updated it to `1.7.1` and reran successfully.
