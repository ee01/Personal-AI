# Prompt Config Action Button Boundaries

## Context

- `docs/progressing/to-verify.md` has no pending item.
- Random sampling selected `docs/features/custom_prompts.md` after skipping the freshest exact automation surfaces.
- The feature is a Chrome extension page, so `webpage-mcp` can inspect current HTTP(S) tabs but cannot directly exercise `prompt-config.html`; the practical proof path is the existing Playwright unpacked-extension harness.

## Real User Persona

I am a cautious user tuning long-lived AI preferences before letting them affect real message and project analysis. I care less about raw configuration power and more about knowing exactly when a click changes only the current page draft, when it writes local config, when it backs up to memory service, and when it mutates the user profile.

## Improvement Plan

1. Add button-level `title` / `aria-label` boundaries for Prompt Config's primary action buttons: reload, save, fusion, and reset.
2. Make the boundary text state-aware for loading, save/fusion pending, unconfirmed safety hints, unsaved drafts, and no-draft re-save cases.
3. Extend `tools/verify-custom-prompts-e2e.mjs` to assert those button boundaries before and after draft, save, reset, safety-block, and fusion states.
4. Update `docs/features/custom_prompts.md` so the canonical docs include the main action button boundary contract.
5. Verify with targeted Custom Prompts checks, first successful dev compile, E2E, and scoped whitespace checks.
