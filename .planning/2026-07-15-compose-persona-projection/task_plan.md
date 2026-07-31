# Compose Assist Persona Projection Implementation

## Goal

Implement Persona Projection Contract v1 for Compose Assist so scene, audience,
confirmed profile facts, and writing style are filtered before every output
branch, while preserving the low-friction insert experience for ordinary drafts.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Inspect current dirty Compose Assist code, contracts, tests, docs, and demo |
| 2 | completed | Implement audience resolution and projection contract with focused unit tests |
| 3 | completed | Integrate projection into LLM, cue, context-pack, and prompt-patch paths |
| 4 | completed | Add frontend review boundary behavior and regression coverage |
| 5 | completed | Update feature docs, progressing plan, demo, and eval fixtures |
| 6 | completed | Run focused tests, eval, dev compile, E2E, and scoped diff checks |

## Decisions

- Preserve all unrelated dirty worktree changes and merge with current Compose Assist edits.
- Do not modify `.planning/.active_plan`; this task uses its own isolated directory.
- P0 is transient and does not add database tables or a standalone projection API.
- Raw `USER_CORE` must not enter Compose generation; structured profile items are projected instead.
- Projection failures omit personalization and use neutral audience behavior; they never restore legacy raw profile injection.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| E2E fixture used draft `slotCounts` fields | 1 | Aligned the fixture with the implemented public summary (`blockedCount`, `usedSlotKinds`, `audienceConfidence`); production review note then passed. |
| Full compose-assist no-LLM suite failed in concurrent Prompt Compiler cases | 1 | Confirmed all three persona fixtures pass; recorded the two existing compiler failures and two warnings instead of changing unrelated scoring or compiler behavior. |
