# Findings

## Initial State

- The deployed `esone.qiu` service has raw memory data but zero Keystone brief rows.
- `KeystoneBriefService.upsertComposedCandidate()` is only called by the internal `/keystone-briefs/mine` route; no automatic producer exists.
- `memory_system.md` explicitly says automatic discovery/composition is outside the current path, which does not meet the intended no-manual-operation product experience.
- Current renderer already returns from `renderKeystoneBriefCard()` before ordinary/change-ledger rendering, but the docs do not define the combined Brief + Change Ledger experience clearly.
- `memory_system.md` contains stale UI-level Autopilot placement copy that conflicts with `memory_lens.md`.
- The worktree is broadly dirty. Preserve all unrelated changes and edit only scoped files after reading their current contents carefully.

## Automatic Composer Design

- Keep `/context-recall` read-only and fast. Composition belongs to the existing heartbeat maintenance lifecycle.
- Seed candidate subjects from active reflection threads, but return to original message/Jira/web rows for every source and claim. Reflection text can identify a topic; it cannot be the sole authority.
- Prefer stable Jira keys, explicit estimate phrases, and concrete technology/workflow names. Do not summarize an entire chat group as one brief.
- Generate at most two briefs per heartbeat, skip unchanged source signatures, preserve manual briefs, and never automatically reactivate hidden or user-reported-inaccurate briefs.
- Existing memory is backfilled because every heartbeat scans bounded high-priority reflection subjects, not only newly ingested messages.
- Generated facts carry exact source refs. The auto composer is deterministic and uses existing grounded summaries/snippets, so a failed or unavailable LLM cannot block brief availability.
