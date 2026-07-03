# Scene Memory Autopilot Provenance Audit

## Selected Feature

- Feature index row: `场景记忆自动驾驶 eval`
- Capability: Memory Lens / Compose Assist
- Source doc: `docs/features/memory_lens.md`
- Reminder state: local Reminders was readable, but no `Personal AI` list exists in this run. No Reminder item is used or marked done.

## Research Signals

- Product patterns: ChatGPT Memory, Microsoft 365 Copilot Semantic Index, Notion AI Enterprise Search, and Slack AI Search all emphasize permissioned retrieval, source visibility, and user-inspectable provenance.
- Research patterns: context-aware recommendation and notification literature points to the same tradeoff: relevance explanations help trust, but the user must be able to tell whether the supporting evidence is current, blocked, synthetic, or actually used.

## Problem

`scene-memory-autopilot` already shows `sourceProvenance` in the reader report, but the heuristic result does not score or summarize source reliability. A case can pass on display/suppression behavior while leaving the report reader to manually infer whether the case was grounded in used, blocked, stale, synthetic, or unknown sources.

## Plan

1. Add a machine-readable source provenance audit to `tools/eval-scene-memory-autopilot.ts`.
2. Keep blocked sources visible without penalizing mixed cases where at least one trusted source was used.
3. Warn and reduce the provenance score only when provenance is missing, all sources are blocked/unverified, or stale/unverified sources are present.
4. Render the audit summary in `tools/eval-run.mjs` next to the existing sample source list.
5. Update `docs/features/memory_lens.md` so the validation contract requires source provenance reliability, not just source listing.
6. Validate with `eval:validate`, the focused `scene-memory-autopilot` suite, syntax checks, and scoped whitespace checks.
