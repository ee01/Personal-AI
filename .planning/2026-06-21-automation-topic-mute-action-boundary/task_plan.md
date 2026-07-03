# Topic Mute Action Boundary Plan

## Goal

Improve Topic Messages `主题静音` so the main list-level mute path is as clear as the detail page: muting is local attention filtering, unread state is retained, and nothing is synced or written to the original chat platform.

## Plan

1. Inspect current docs, implementation, Reminder state, and recent automation memory.
2. Compare with product/research references for mute, unread triage, and notification deferral.
3. Add a list-card pre-action mute boundary and post-action receipt wording.
4. Update canonical feature docs and targeted verifier/E2E assertions.
5. Run targeted Topic verifier, dev webpack compile, Topic E2E, and scoped diff checks.

## Status

- [x] Context, Reminder, and recent automation memory checked.
- [x] Target selected: `主题静音` under Topic Messages.
- [x] Product/research scan completed.
- [x] Code/docs/tests patched.
- [x] Validation completed.

## Notes

- Reminders: local Reminders is reachable, but no `Personal AI` list exists.
- Worktree is very dirty; keep changes scoped to Topic Messages files and this plan.
- Validation passed: `npm run verify:topic-based-messages`, `npm start` first successful compile, `npm run verify:topic-based-messages:e2e`, scoped `git diff --check`, new-plan whitespace checks, and no lingering webpack watcher.
