# Dream Replay Scope Receipt Findings

## Repo And Reminder Findings

- `docs/progressing/to-verify.md` has no carry-over items.
- Automation memory shows the latest run targeted `Ask 主动问答`; recent runs also touched Message Analysis, Message Reaction, Task Scheduler, Agent Workflow, Native Join, Memory Capture, Decision Center, Jira Import, Memory Coverage, Memory Lens, Relationship Radar, Skill Foundry, Project Dashboard, Rehearsal, Scheduled Messages, Meeting Pilot, Compose Assist, Google Slides Analyzer, and Notification Center.
- The Reminders app is reachable, but visible list names do not include `Personal AI`; no Reminder feedback can be applied or completed this run.
- The worktree is broadly dirty from existing user/automation changes; keep edits scoped to Dream Replay files and this planning directory.

## Code Findings

- `docs/features/index.md` lists `梦境重放` under Memory Service, documented in `docs/features/memory_system.md`.
- `src/modals/components/DreamInsights.vue` already parses `dreams/*.md`, loads up to 10 recent files plus an explicit notification deep-link target, surfaces skipped files, evidence readiness, triage, and reflection handoff.
- Existing UX gap: the page has card-level processing receipts but no first-row receipt saying the page is a bounded local view of recent/readable dream files, not the full dream archive or a writeback action.
- Existing E2E `tools/verify-memory-dreams-e2e.mjs` already stubs list/read file APIs and checks deep-link handling, skipped file warnings, grounding receipts, and reflection route handoff. It is the right place to assert the new scope receipt.

## External Research Findings

- OpenAI Dreaming describes background memory synthesis that keeps context more current; the user-facing implication is to show the synthesis scope and keep management/review visible.
- OpenAI Memory FAQ and release notes emphasize reviewable memory sources/summaries, which maps to explicit evidence and scope receipts in Dream Replay.
- Microsoft Copilot grounding docs state answer grounding depends on accessible account/source context; Dream Replay should similarly avoid implying more source coverage than the current readable dream files provide.
- Generative Agents uses observation, reflection, and retrieval to produce long-term coherence; generated reflection is valuable when it remains connected to observations.
- Reflective Memory Management argues long-term dialogue memory needs forward/backward reflection and retrieval refinement; this supports reflection handoff over direct fact promotion.
- Biological/artificial replay papers support offline replay for consolidation, but the product should keep consolidation distinct from external execution authority.

