# Memory Lens Site Control Operation Receipts

## Context

- Selected feature: `站点静默/屏蔽/白名单` under Memory Lens.
- `docs/progressing/to-verify.md` has no carry-over item.
- EventKit found the local `Personal AI` Reminders list, but all 4 items are already completed historical Doubao / Notification feedback and none relate to Memory Lens, site controls, passive recall, allowlists, or selection search.
- External scan supports explicit page-context permission, extension permission mental models, and browser-assistant privacy transparency.

## Plan

1. Compare `docs/features/memory_lens.md` with the current Options/content-script implementation.
2. Improve Options site-control action results so they explain whether passive Lens will actually resume or remain quiet under allowlist mode.
3. Keep the active selection-search boundary visible in the same action result.
4. Update focused verifier and E2E assertions.
5. Update the canonical Memory Lens docs and feature index.
6. Run targeted verifier, dev webpack compile, E2E, and scoped diff checks.

## Implementation Notes

- The runtime change is presentation-only in `src/options.tsx`.
- Storage keys, context recall behavior, content-script site-control enforcement, selection search, memory-service APIs, and source-memory capture logic are unchanged.
- The main UX bug fixed here is false confidence after restoring/removing a site-control rule while allowlist mode still blocks passive prompts.
