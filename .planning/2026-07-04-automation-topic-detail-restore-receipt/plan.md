# Topic Detail Restore Receipt Plan

## User stance

I am using Topic Messages as a triage inbox. I often defer a noisy topic or mute it, then restore it from the detail page after deciding it belongs back in the unread flow. I care that a restore click is visibly local-only and does not imply Memory Service sync, platform writeback, or read-state mutation.

## Problem

The detail page already explains the boundaries before setting `稍后处理` or `静音`, and it shows persistent header state after the local filter is applied. However, clicking `恢复未读` or `取消静音` only removes the header state. There is no positive receipt explaining what was actually restored and what did not happen.

## Plan

1. Add a detail-page restore receipt for local defer recovery and local mute recovery.
2. Reuse the existing detail-page toast pattern, but make the copy explicitly say the action only removed local browser filtering.
3. Show the same receipt for the persistent header restore buttons and the immediate undo buttons.
4. Extend `verify-topic-based-messages-e2e.mjs` to assert both restore receipts after defer and mute recovery.
5. Update `docs/features/topic_based_messages.md` so the restore receipt is part of the canonical behavior.

## Verification

- `npm run verify:topic-based-messages`
- `npm start` first successful compile, then stop the watcher
- `npm run verify:topic-based-messages:e2e`
- `git diff --check` scoped to touched files
