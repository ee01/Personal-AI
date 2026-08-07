# Dream Replay Scope Receipt Plan

Goal: improve the randomly selected `梦境重放` feature by confirming docs and code are current, using outside product and research references, then shipping one focused UX improvement with targeted verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo workflow, feature index, carry-over docs, automation memory, memory registry, current dirty state, and Reminders list state |
| 2 | completed | Randomly select and reroll away from recent feature families, landing on `梦境重放` |
| 3 | completed | Inspect Dream Replay docs, UI, service code, and existing E2E coverage |
| 4 | completed | Search comparable product and paper references for memory dreaming, grounding, reflection, and replay |
| 5 | completed | Implement a small Dream Replay scope/authority receipt in UI, docs, and E2E |
| 6 | completed | Run targeted Dream Replay E2E, dev compile, scoped diff checks, and watcher cleanup |
| 7 | in_progress | Update automation memory, mark Reminder items only if applicable, and archive the Codex thread if the app tool is available |

## Decisions

- Selected feature: `梦境重放` in `docs/index.md`.
- Source doc: `docs/memory_system.md`.
- Main UI file: `src/modals/components/DreamInsights.vue`.
- Existing E2E: `tools/verify-memory-dreams-e2e.mjs`.
- Local Reminders is reachable, but no `Personal AI` list exists, so there are no related Reminder items to incorporate or complete.
- Improvement slice: add a first visible “本页范围” receipt above the metrics, clarifying visible dream count, evidence-ready count, skipped file count, notification deep-link state, generation schedule, and non-effects.

## External Reference Takeaways

- OpenAI Dreaming and Memory FAQ favor background synthesis with visible source/manageability controls.
- Microsoft Copilot grounding docs reinforce that memory-grounded views need source and account/scope boundaries.
- Generative Agents and Reflective Memory Management support observation/reflection/retrieval loops, but not treating generated reflections as settled facts.
- Replay literature supports offline consolidation as a useful mechanism while keeping it separate from execution authority.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence; do not mark any Reminder item done |
| Initial random sample included recently touched families | Seeded index sample | Rerolled away from recent automation memory targets and selected `梦境重放` |
| Dream Replay E2E strict text collision | First `verify:memory-dreams:e2e` run | New receipt reused `可带证据复核`; changed the metric assertion to exact text and reran |
