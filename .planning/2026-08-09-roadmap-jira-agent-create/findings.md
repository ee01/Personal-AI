# Findings — Roadmap 双路径创建 Jira

## Shipped
- P1: `fixVersions` in `jiraCreateMeta` (exact → unique suffix → warning drop); payload + contentScript pass-through; AiCreateModal `catchRelease` chips.
- P2: Prompt-gated dual mode UI; bridge `agent-create` / `agent-executors` / `open-options`; content script task assembly + execute/poll + resolve; OpenClaw fallback list.
- Docs: `docs/features/personal_roadmap.md` + `docs/index.md`; deleted `docs/progressing/roadmap-jira-agent-create-plan.md`. Demo kept at `docs/demo/roadmap-demo.html`.

## Notes
- roadmap-service server unchanged (as planned).
- Agent executor registry UI (Block H) not required; fallback is `openClawEnabled ? [openclaw] : []`.
- `jiraCreateMeta` lazily imports `./jira.js` so field unit tests stay free of chrome/env graphs.
