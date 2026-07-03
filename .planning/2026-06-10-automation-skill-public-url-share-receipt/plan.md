# Public Skill URL share receipt plan

## Target

- Feature: `Public Skill URL` under Skill Foundry.
- Canonical doc: `docs/features/personal_skill_foundry.md`.
- Main UI: `src/modals/components/PersonalSkillsPage.vue`.
- Existing proof path: `npm --prefix memory-service test -- --run src/__tests__/api-skills.test.ts`, `npm start` first compile, `node tools/verify-personal-skill-foundry-e2e.mjs`, `git diff --check`.

## Current findings

- Skill detail fetch creates a fresh live token for active skills; old copied tokens remain valid until revoked.
- Public routes are read-only and serve HTML preview, `SKILL.md`, `package.json`, and `files/*` behind the token.
- Secret-like skill content blocks share generation and returns `shareError`.
- The Binding tab shows a display short link and says copy/open use the token URL, but it does not show an explicit share receipt with bearer-token scope, no-write boundary, version/hash, file coverage, and revocation limitation.
- Local Reminders could not be read in this session because the Reminders automation probe hung; no Reminder item was incorporated.

## Research direction

- Claude Agent Skills package instructions, metadata, and optional resources; this matches the need to show whether `files/*` resources are in the shared package.
- OpenAI GPT Actions authentication docs separate unauthenticated reads from API key/OAuth actions; Public Skill URL should stay read-only and not imply execution or sync authority.
- W3C capability URL guidance treats token URLs as sensitive access grants that can leak through browser/referrer/history paths and should have visible scope/revocation expectations.
- Agent procedural-memory work frames skills as reusable procedural knowledge with update/refinement loops, supporting a version/hash receipt instead of a bare URL.

## Implementation steps

1. Add a `分享回执` block to the Skill Foundry Binding tab.
2. Derive rows from existing `selectedSkill.share`, `selectedSkill.shareError`, and `activeVersion`.
3. Make active token shares state: read-only pull scope, copied URL includes token, version/hash/file count, no write/execute/sync authority, and old tokens remain valid until revoke.
4. Make blocked shares state: secret scan stopped token generation and short links are not accessible.
5. Update the E2E fixture assertions for active skill Binding tab.
6. Update `docs/features/personal_skill_foundry.md` without over-specifying UI details.
