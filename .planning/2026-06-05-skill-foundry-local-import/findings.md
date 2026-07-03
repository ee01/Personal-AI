# Findings

## Reminder

- Local Reminders does not contain a `Personal AI` list, so this run has no Reminder-derived Skill Foundry items to complete.

## Initial Feature Selection

- Random feature sample included `Skill Foundry` local agent import suggestions and suggestion state management.
- Selected target: local agent skill import suggestions because it is less covered by the latest automation memory than Ask, Today Pilot, Meeting Pilot, Notification Center, Compose Assist, and Jira import.

## Code Findings

- `SkillLibraryService` already review-gates external agent suggestions, high-risk suggestions, partial evidence, workflow tool calls, extra package files, and ignored unsafe local resource paths.
- Local platform sync sanitizes unsafe file paths and recomputes the package hash when filtering occurs.
- Current review reasons treat executable scripts as generic extra files and do not flag `SKILL.md` dependency/install/download instructions, even though those materially change the import risk.
- `PersonalSkillsPage.vue` already renders review reasons in the Inbox card and audit gate, so backend review reasons are the cleanest UX lever.

## External Research

- Anthropic Claude Skills documentation describes skills as progressively disclosed packages and says skills may include scripts, dependencies, tools, and multi-file resources.
- Anthropic's security guidance says downloaded skills should be reviewed before enabling, with special attention to package code, scripts, bundled resources, dependencies, and external network instructions.
- OpenAI Agents SDK human-in-the-loop docs show approval gates for tool calls, nested agent tools, shell tools, apply_patch tools, and local MCP servers.
- ReAct argues that reasoning traces plus actions improve interpretability and trust, which supports making imported skill actions visible before promotion.
- Toolformer frames tool use as deciding which APIs to call, when to call them, and how to use results, which supports recording tool/dependency signals as import review facts.

## Implementation Plan

- Add static review checks for executable bundled files and install/download/MCP-style external runtime instructions in `SKILL.md`.
- Preserve the existing state machine and confirmation flow; only enrich `reviewReasons`.
- Update API tests and Foundry E2E fixture/assertions to make the new reasons contractual.
- Update `docs/features/personal_skill_foundry.md` with a concise status note.
