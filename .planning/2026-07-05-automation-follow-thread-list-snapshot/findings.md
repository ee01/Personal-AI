# Follow Thread List Snapshot Findings

## Current Behavior

- `docs/features/message_reaction.md` is current for Watch: opening configuration does not start monitoring, saving creates a local manual rule, original-message indexing can be confirmed or degraded, and the management page shows per-rule status receipts.
- `FollowThreads.vue` filters `chrome.storage.local.concernedItems` down to manual Watch rules, hides system/internal watch items, and reacts to local storage changes.
- Each item has a `监听状态回执`, but the page-level list lacks a first-screen receipt explaining the current read snapshot, hidden system count, current filter/sort, and no-side-effect boundary.
- Existing E2E `tools/verify-follow-threads-management-e2e.mjs` already seeds one manual rule plus one hidden system watch item, making it a good place to prove the hidden-count and snapshot receipt.

## UX Gap

When a user opens the Watch management page, summary pills show counts but do not say whether those counts came from a fresh local read, whether system watch rules were intentionally hidden, or whether changing filter/sort re-queries remote services or changes notification state.

## Chosen Fix

Add a page-level `列表快照回执` below the summary row. It should state the local source, visible/manual total, hidden system/internal Watch count, current filter and sort, read time, and that the page read does not cancel, extend, backfill, resend, reindex, write long-term memory, or query remote history.

## Non-Goals

- No change to Watch rule matching.
- No change to notification cadence or delivery.
- No change to original-message indexing.
- No change to cancel/extend persistence.
- No new backend route.
