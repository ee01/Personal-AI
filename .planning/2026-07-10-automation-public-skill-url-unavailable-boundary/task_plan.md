# Public Skill URL unavailable boundary

## Goal

Improve the Skill Foundry Public Skill URL UX for the state where no accessible token URL is available, without changing backend sharing semantics.

## Target Feature

- Feature: `Public Skill URL`
- Docs: `docs/features/personal_skill_foundry.md`
- UI: `src/modals/components/PersonalSkillsPage.vue`
- Browser proof: `tools/verify-personal-skill-foundry-e2e.mjs`

## Plan

1. [completed] Read repo workflow, feature index, feature docs, existing code, automation memory, and Reminder state.
2. [completed] Research comparable product/security patterns for skill sharing and capability URLs.
3. [completed] Add pre-click disabled-state explanation for missing/blocked Public Skill URL actions.
4. [completed] Extend Skill Foundry E2E assertions for blocked/missing share action boundaries.
5. [completed] Update the feature doc and run targeted verification.

## Decisions

- Keep the change presentation-only: no new token, revoke, share generation, public route, clipboard, or platform-sync behavior.
- Treat `shareError` as a high-signal block reason and expose it before the user tries to copy or preview.
- Keep Reminder branch read-only because EventKit found no open Public Skill URL related items.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
