# Skill Foundry Local Scan Receipt Findings

## Selected Feature

- Random viable target: `本地 agent skill 导入建议` (`docs/features/personal_skill_foundry.md`).
- Nearby fresh automation targets avoided: Agent Thinking run orchestration, Memory Search keyboard open, Prompt Config history restore, Today popup overflow, Message Analysis paused rules, Coverage visible slice, Google Slides handoff, Compose direct insert, Ask topic lock, Timeline feedback, and Meeting Pilot capture consent.

## Repo Findings

- `PersonalSkillsPage.vue` already receives local Desktop App import metadata in `binding.metadata`: `sourceDirectory`, `skillMdPath`, `sourceRoot`, `fileCount`, `totalByteSize`, `rejectedFileCount`, `rejectedFilePaths`, `validationFileCount`, and `validationFilePaths`.
- Detail-level receipts already explain that confirmation writes only the scanned package snapshot into Personal AI active truth and does not modify local directories, run scripts, install dependencies, connect MCP, or execute the skill.
- The first-screen suggestion card has a generic `建议处理回执`, but its structured rows do not yet include the local package scan and validation boundary. The same facts are visible as review-preview pills, but not as a stable receipt row.
- The focused E2E fixture already has a local import with missing validation lines. It can be extended with a second local import that has `validationFilePaths` to prove both branches.

## External Scan

- Anthropic Agent Skills docs and engineering notes frame skills as filesystem directories with metadata, instructions, scripts, and resources loaded through progressive disclosure. This supports showing source directory and package-size facts before confirmation.
- Anthropic security guidance says less-trusted skills should be audited before use, especially bundled files, code dependencies, scripts, and external network instructions.
- OpenAI guardrails / human-review docs distinguish automatic checks from human approval before side-effecting actions. For Foundry, local import confirmation is an approval boundary, while card review remains read-only.
- The 2026 SKILL.md semantic supply-chain paper argues that skill metadata/instructions affect discovery, selection, and governance, so local imports should expose source and validation facts before the agent or user trusts them.
- Agent-skill evaluation literature emphasizes execution feedback and validation evidence; a lightweight validation-line receipt is useful without adding a heavyweight eval panel.

## UX Gap

Users can see that a card needs review, but the card receipt should answer: "What exactly did Desktop App scan, what was ignored, did it find validation clues, and what will not happen if I merely view this card?"

## Chosen Slice

Add local-only receipt rows to suggestion cards:

- `本机扫描`: source directory, package size, rejected path preview, and "来自 Desktop App 扫描快照".
- `验证`: validation clues or missing validation, plus "只作审核事实; 页面不会运行验证 or still not verified".

This stays presentation-only.
