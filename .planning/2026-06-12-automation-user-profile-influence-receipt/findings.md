# Findings

## Product And Research Signals

- ChatGPT memory controls expose manage/delete boundaries; deleting chat alone does not delete saved memory. Relevant product lesson: user-facing memory/profile changes need precise state receipts and scope boundaries.
- Claude memory import/export exposes migration and backup paths. Relevant product lesson: profile calibration should state what changed locally and what does not automatically sync, restore, or migrate.
- RUMS / Response-Aware User Memory Selection argues memory/profile candidates should be selected by response utility, not only similarity. Relevant local lesson: changing profile influence is meaningful because it affects later selection, so the receipt must accurately report whether the user raised, lowered, or just adjusted influence.
- Mem0 emphasizes selective extraction, consolidation, and retrieval for long-term memory. Relevant local lesson: calibration feedback should preserve evidence and not imply all profile data enters every prompt.

## Code Findings

- `src/modals/components/UserProfilePage.vue` has strong pre-action impact copy for list and prediction rows.
- `setImportance` captures the target item before optimistic update, so the previous importance is available to receipt builders.
- `buildInfluenceReceipt` currently labels `importance < 0.85` as `已降低影响`, which is correct for the explicit 25% quick action but wrong for intermediate star-rating changes such as raising an item to 80%.
- Existing E2E covers explicit lower actions and partial confirmation failure, but not an intermediate star-rating path.

