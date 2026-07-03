# Skill Foundry confirm receipt plan

## Target

Random feature: `技能库技能建议` / Skill Foundry suggestion inbox.

## Current gap

The page shows priority, review gates, and a pre-confirm decision receipt, but after the user clicks `使用` / `确认使用` / `确认覆盖`, the UI jumps to the skill detail without a durable receipt of what changed. Users have to infer whether the suggestion became active, whether an active skill was overwritten, whether a tokenized share URL exists, and whether immediate platform sync ran.

## External signals

- Claude / Agent Skills treat a skill as an instruction package with optional resources and scripts, so promotion needs an audit trail, not only a list state change.
- AutoSkill / Voyager style research supports skill libraries growing from experience, but also implies lifecycle feedback and source evidence should remain inspectable.
- Skill registry and prompt-injection research reinforces that third-party skill packages are a supply-chain surface; confirmation should name the write boundary and sync boundary.

## Implementation steps

1. Add a post-confirm receipt on `PersonalSkillsPage.vue` for suggestion promotion and external-change overwrite.
2. Correct the pre-confirm sync copy so local Desktop App platforms are not presented as directly written by the confirm click.
3. Extend `MemoryServiceClient.useSkillSuggestion` typing to include the optional OpenClaw sync result already returned by the backend.
4. Extend `tools/verify-personal-skill-foundry-e2e.mjs` with a successful promotion path and receipt assertions.
5. Update `docs/features/personal_skill_foundry.md` with the new behavior and validation note.

## Verification

- `npm --prefix memory-service test -- --run src/__tests__/api-skills.test.ts`
- `npm start` until first successful webpack compile, then stop.
- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `git diff --check`
