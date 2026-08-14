# Findings

## Requirements
- Do not merge Prompt 创建 into a single Agent request.
- Per-Epic AgentTask, parallel with concurrency 2.
- Artifact may be partial: `{ partial, mappings: [{draftId, jiraKey|error}] }`.
- Failed/timeout AgentTask that still has jiraKeys must resolve those rows.
- Direct API path stays sequential (already per-row resolve).

## Research Findings
- `AiCreateModal.start()` currently `for await` each draft group — 5 epics = 5 serial Agent waits.
- `handleAgentCreateJira` throws on non-succeeded before applying mappings, wiping partial successes in the modal catch.
- `parseAgentMappings` already kept jiraKey-only rows; it dropped `error` rows and the caller treated empty parse as fatal.
- `useExtensionBridge` Agent timeout was still 11 minutes vs content-script 30 minutes.
- `fullAgentPrompt` listed ALL drafts in every per-Epic execute — parallel would multiply create risk. Slice prompt per group.

## Technical Decisions
| Decision | Rationale |
|---|---|
| Concurrency 2 | OpenClaw / Chrome bridge contention; shared readiness scope `roadmap_create_jira` |
| Never throw after an Agent run if any jiraKey parsed | Modal catch would mark the whole Epic failed |
| Per-group prompt | Isolation: each agent only sees that Epic's drafts |
| Keep one AgentTask per Epic | Failed epic retries only remaining drafts; succeeded epics already resolved |
| No background `runtime-status` after tab close | Poll lives in the content script; SW continuing would need chrome.alarms (not done) |
| Resume on next Roadmap inject | `chrome.storage.local` ledger written at execute-accepted; next handshake polls and `resolve_*` |
