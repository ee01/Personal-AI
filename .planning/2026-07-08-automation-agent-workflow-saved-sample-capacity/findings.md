# Findings

## Repo State

- `docs/progressing/to-verify.md` currently says there are no pending verification items.
- Worktree was already broadly dirty before this run, including many previous automation files. This run will only own the new planning directory plus the narrow Agent Workflow saved-sample capacity changes.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No Reminder item is available to incorporate or mark done.

## Current Feature Behavior

- Agent Workflow Options has a strong local testing flow: built-in examples, recent Memory Service replay samples, saved samples, baselines, batch regression, evidence packets, and no-side-effect receipts.
- Saved scenarios are normalized and capped by `AGENT_WORKFLOW_SAVED_SCENARIO_LIMIT = 12`.
- `handleSaveWorkflowScenario` prepends the new snapshot, removes duplicate input, then slices to the limit. When the cap is full and the current input is new, the oldest saved scenario is removed silently from the local regression set.

## External Scan

- Zapier Agents separates testing from publish activation; unpublished/test runs should not be mistaken for live automation.
- LangSmith evaluations use curated datasets to compare versions and catch regressions before shipping.
- The 2026 structural-coverage paper argues that agent workflow tests should show whether declared agents, tools, and paths were exercised, not only final success.
- OpenTelemetry GenAI conventions reinforce structured agent/tool/run metadata and privacy-aware observability.

## UX Gap

Saved-sample capacity affects whether a local batch regression still covers previous cases. A user should see the 12-item cap and possible oldest-sample eviction before clicking `保存当前用例`, and the post-save status should confirm what changed locally.

