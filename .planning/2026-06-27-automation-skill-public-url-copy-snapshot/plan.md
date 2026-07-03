# Public Skill URL Copy Snapshot Plan

## Target

- Feature: `Skill Foundry / Public Skill URL`
- Source docs: `docs/features/index.md` -> `docs/features/personal_skill_foundry.md`
- Entry point: `memory-exploring.html#/skills`, Binding tab

## Current State

- The feature already shows a share receipt for tokenized read-only URLs.
- Copy actions already distinguish full token URL / install instruction from the display short link.
- The gap is after a same-skill detail refresh: the detail endpoint may return a new live token, but the retained copy receipt does not say whether the clipboard still matches the current token/version snapshot.
- Local Reminders are readable, but there is no `Personal AI` list in this macOS Reminders account, so there is no Reminder item to merge or complete.

## External Scan

- Anthropic Claude Skills and OpenAI GPTs both frame reusable skills/knowledge as installable, shareable artifacts rather than implicit execution.
- W3C capability URL guidance treats bearer URLs as sensitive capabilities and recommends visible HTTPS, expiry/revocation, and user education around exposure.
- RFC 7009 token revocation reinforces that token lifecycle and invalidation are separate actions from issuing or copying a token.
- Macaroons research supports attenuated, scoped bearer credentials; for this product, the near-term UI implication is to make the copied credential snapshot and revocation boundary legible.

## Plan

1. Preserve the copied share snapshot in the copy receipt: skill id, display URL, token URL, active version, short sha, token tail, copy kind, platform, and copy time.
2. Derive the visible receipt from current selected skill state. If the same skill refreshes and the token URL, version, or sha no longer matches, show `旧复制回执` with old/current credential facts.
3. Keep behavior presentation-only: no Memory Service share-token contract, revoke model, platform sync, or install command semantics change.
4. Extend the existing Personal Skill Foundry E2E to rotate the fixture share token after a same-skill refresh and assert the stale receipt.
5. Update the feature doc to describe the snapshot/stale-copy boundary.

## Validation

- `node --check tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start` until the first successful webpack development compile, then stop the watcher
- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/2026-06-27-automation-skill-public-url-copy-snapshot/plan.md`
