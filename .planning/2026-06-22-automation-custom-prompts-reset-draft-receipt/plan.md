# Custom Prompts Reset Draft Receipt Plan

## Context

- Feature: `docs/features/custom_prompts.md`
- Surface: `prompt-config.html`
- User persona: a cautious prompt/config owner who experiments with long-lived analysis preferences but wants to know exactly when a change affects real message/project analysis.

## UX Gap

`重置默认` currently uses a native confirm that says the action is irreversible. In practice it only resets the current page draft and preserves the saved baseline until the user clicks save. That wording overstates the write boundary and leaves no persistent in-page receipt after the reset.

## Plan

1. Change the reset confirmation copy so it explains the draft-only boundary before the user proceeds.
2. Add a persistent `重置草稿` receipt after reset, including preserved identity fields and the fact that real analysis, local storage, Memory Service backup, and profile fusion are unchanged until save.
3. Clear the reset receipt on save, reload, manual edits, or restoring a history version so stale reset context does not sit beside later actions.
4. Extend the existing Custom Prompts E2E to assert the reset receipt and verify the saved baseline remains visible until save.
5. Update `docs/features/custom_prompts.md` to make the reset-draft boundary part of the canonical behavior.

## Validation

- `npm run verify:custom-prompts`
- first successful `npm start` compile, then stop watch
- `npm run verify:custom-prompts:e2e`
- scoped `git diff --check`
