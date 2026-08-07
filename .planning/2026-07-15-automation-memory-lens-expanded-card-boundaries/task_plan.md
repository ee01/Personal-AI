# Memory Lens Expanded Card Improvement Plan

Goal: improve the selected `记忆提示 Expanded Card` feature by checking that docs match the current code, incorporating current product/research references and local Reminder state, then implementing a focused UX/code improvement with strong verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/index.md`, `docs/progressing/to-verify.md`, automation memory, memory hints, stale planning state, dirty worktree, and local `Personal AI` Reminder state |
| 2 | completed | Inspect Memory Lens docs, expanded-card code, current tests/verifiers, and nearby implementation gaps |
| 3 | completed | Search current industry products and research papers for comparable contextual-memory card and source-feedback patterns |
| 4 | completed | Lock a low-decision improvement plan and document findings before editing runtime files |
| 5 | completed | Implement the selected scoped code/docs/test changes without reverting unrelated dirty files |
| 6 | completed | Run targeted verification plus `npm start` first successful compile and scoped whitespace checks |
| 7 | completed | Update automation memory, close any completed Reminder item if applicable, and summarize evidence |

## Decisions

- Selected feature: `记忆提示 Expanded Card`.
- Capability: Memory Lens.
- Source doc: `docs/features/memory_lens.md`.
- Selection method: first valid item from a randomized `docs/index.md` sample after avoiding the freshest exact/family targets in automation memory.
- Reminder state: EventKit found the local `Personal AI` list with 4 total items and 0 incomplete items; no Reminder feedback is currently available to incorporate or mark done.
- Existing worktree is broadly dirty from prior automation runs. This run will only own Memory Lens expanded-card files, matching docs/tests, this planning directory, `.planning/.active_plan`, and automation memory.
- Implementation slice: add pre-click `title` / `aria-label` boundaries to ordinary original-source links and positive/negative feedback controls in the Expanded Card, without changing recall ranking, feedback API semantics, source opening, or site-control behavior.

## Improvement Hypothesis

Expanded contextual-memory cards already need to be trusted at a glance: the user should know whether opening sources, giving feedback, or dismissing a card is only local/UI state, a service write, or a jump to external evidence. If code already has the backend truth, the likely best slice is to push the boundary onto the actual card controls instead of changing recall ranking.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` is stale Scheduled Messages data | Planning restore | Treat root planning files as historical data and use this isolated `.planning/` run |
| `.planning/.active_plan` pointed to an unrelated Ask run | Planning restore | Replace it with this run's plan pointer |
| `verify:webpage-memory-detection:e2e` expected short feedback aria labels | First E2E run | Updated E2E assertions to match the new pre-click boundary contract and reran successfully |
