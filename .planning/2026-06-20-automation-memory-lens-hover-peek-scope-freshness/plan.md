# Memory Lens Hover Peek Scope/Freshness Plan

## Target

- Random feature: `记忆提示 Hover Peek`
- Feature family: Memory Lens
- Source doc: `docs/features/memory_lens.md`

## Context Checks

- `AGENT.md` read.
- `docs/progressing/to-verify.md` has no carry-over items.
- Automation memory was checked; recent exact targets were excluded before selecting this feature.
- Local Reminders is reachable, but no `Personal AI` list exists on this machine, so there are no related Reminder items to complete.

## External Signals

- Slack AI Search and Notion Enterprise Search both emphasize source/citation visibility and permission-scoped answers.
- ChatGPT Memory and Microsoft Edge Copilot controls emphasize user control over memory/page-context use.
- RAG trust/transparency and context-aware recommendation research point away from confidence-only UI and toward visible provenance, scope, and user control.

## Improvement Plan

1. Keep the change scoped to Hover Peek, not the backend recall contract.
2. Extend the shared Hover Peek metadata helper so the footer can show source, memory scope, timestamp, stale-evidence review warning, and source title/match role.
3. Update the Memory Lens doc to state that Hover Peek now surfaces scope/freshness before the user opens Expanded Card.
4. Extend helper verification and the existing Playwright E2E to cover normal work memory, personal memory, and stale evidence paths.
5. Run the standard proof ladder: targeted helper check, first successful `npm start` compile, Memory Lens E2E, scoped `git diff --check`, watcher cleanup.
