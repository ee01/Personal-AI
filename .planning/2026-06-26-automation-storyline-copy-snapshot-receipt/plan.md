# Automation Plan: Storyline Draft Copy Snapshot Receipt

## Target

- Feature: Memory Storyline Builder / Storyline Draft 页面
- Source doc: `docs/features/memory_storyline_builder.md`
- Main UI: `src/modals/components/StorylineDraftPage.vue`
- Verification: `tools/verify-storyline-draft-page-e2e.mjs`

## Inputs Checked

- `AGENT.md`: post-change extension UI validation should include `npm start` first compile and focused E2E.
- `docs/progressing/to-verify.md`: no carry-over items.
- Automation memory: latest runs covered Action Queue, Task Scheduler, Message Reaction, Agent Thinking, Today Pilot, Scheduled Messages, Coverage Map, Skill Foundry, Memory Exploring, Agent Workflow, Meeting Pilot, Project Dashboard, Notification, Jira, Native Join, Message Analysis, Prompt Config, Relationship Radar, Rehearsal, User Profile, Memory Capture, Topic Messages, Quick Ask, Compose Assist, Memory Lens, Doubao, and backup/import surfaces.
- Local Reminders: list names were readable, but there is no `Personal AI` list, so no Reminder item is available for this run.

## Research Signals

- Microsoft Teams Intelligent Recap exposes meeting notes, recommended tasks, timeline markers, topics/chapters, and audio/video recaps as post-meeting artifacts, reinforcing that generated meeting narratives should keep source and action boundaries visible.
- Google NotebookLM positions generated outputs as source-grounded research artifacts, supporting explicit source/citation receipts around copied Storyline text.
- Granola emphasizes notes/action items/follow-ups and pre-meeting briefs, suggesting Storyline's handoff value is strongest when the final artifact state is obvious.
- Generative Agents and Reflexion both support memory/reflection as reusable reasoning input, but copied Storyline text still needs a user-visible boundary because narrative generation can feel more authoritative than its evidence supports.
- Recent personal-memory research frames LLM memory as co-produced narrative artifacts, so Personal AI should keep the user in control of copied narrative snapshots and external writeback.

## UX Gap

Current Storyline Draft blocks copy until gaps/risk/grounding review is acknowledged, but after copy it only changes the button label to `已复制`. A real user can miss:

- which output format and draft snapshot was copied,
- whether the copied text included Evidence refs / Evidence key,
- that copy did not write to Slides, Docs, RingCentral, Memory Service, or long-term Storyline history,
- that switching target format or regenerating makes the clipboard contain an older snapshot.

## Implementation Plan

1. Add a page-level `copyReceipt` model to Storyline Draft.
2. After successful copy, show `复制回执` with target artifact, draft title, cited refs, returned evidence detail count, gaps/risks/grounding review counts, and the no-write/no-send boundary.
3. Keep the receipt after target changes; if the current draft no longer matches the copied snapshot, render it as `旧复制回执` and tell the user to copy again before handoff.
4. Reset only volatile error/copied button state on draft reload; keep the receipt as history until the next successful copy replaces it.
5. Extend the Storyline Draft E2E to assert the current copy receipt, then switch output format and assert the stale-copy receipt.
6. Update the feature doc with the copy receipt behavior.

## Validation Plan

- `node --check tools/verify-storyline-draft-page-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/api-storylines.test.ts`
- `npm start` until first successful dev compile, then stop.
- `node tools/verify-storyline-draft-page-e2e.mjs`
- Scoped `git diff --check`.
