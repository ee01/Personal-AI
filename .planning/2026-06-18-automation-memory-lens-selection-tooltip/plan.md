# Memory Lens Selection Tooltip Plan

## Target

- Feature: `Memory Lens / 划词查找关联记忆`
- Doc: `docs/features/memory_lens.md`
- Scope: selected-text recall affordance on webpages.

## Findings

- `docs/progressing/to-verify.md` is `暂无。`.
- Local Reminders is readable, but there is no `Personal AI` list.
- The selected-text request path already keeps selected text as `primaryText` and page title / nearby paragraph as `secondaryTexts`.
- The result card already shows the `检索范围` receipt, but the initial selected-text icon is only the Personal AI logo plus a browser title tooltip.
- When both Selection Memory Search and selection capture are available, a user can see the selection icon and the right-edge `记住` dock at once. The card later explains the boundary, but the first click target does not visibly say it only checks existing memory.

## Plan

1. Add a compact hover/focus tooltip to the selection recall icon that names the action as `查已有记忆` and says it will not save, insert, send, or call external AI.
2. Keep the memory-capture `记住` dock as a separate surface; do not merge the two actions.
3. Extend the existing webpage Memory Lens E2E to assert the tooltip appears on hover and includes the boundary text.
4. Update `docs/features/memory_lens.md` with the selected-text icon tooltip behavior.
5. Validate with the targeted helper, dev extension compile, E2E, and scoped diff checks.
