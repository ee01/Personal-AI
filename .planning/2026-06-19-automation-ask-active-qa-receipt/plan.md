# Ask 主动问答改进计划

## Goal

随机抽中的功能是 `Ask 主动问答`。本轮目标是在不扩大范围的前提下，核对文档和代码，结合业内产品/论文参考，找出一个用户体验或信任边界缺口，完成实现、文档更新和端到端验证。

## Scope

- Feature row: `Ask 主动问答`
- Capability: `Memory Service`
- Source doc: `docs/features/ask.md`
- Likely code area: `memory-service` Ask route / prompt assembly plus any extension Ask UI or E2E harness discovered during inspection.

## Plan

1. [complete] Inspect current Ask documentation, implementation files, and existing verify/E2E scripts.
2. [complete] Run a small product and paper scan for comparable memory-backed active Q&A / answer grounding patterns.
3. [complete] Add a bounded Search Result UI improvement: a compact `Ask 本轮状态` strip before the answer body, summarizing answer completeness, current/prior evidence, external-check state, and non-effect boundaries.
4. [complete] Implement the strip in `src/modals/components/SearchResultPage.vue` using existing Ask response fields; no backend schema change is planned.
5. [complete] Extend the existing Ask E2E fixture to prove the status strip appears before the answer and carries the partial/deferred boundary.
6. [complete] Update `docs/features/ask.md` and `docs/features/index.md` only if behavior or summary changes.
7. [complete] Verify with targeted Ask checks, first successful `npm start` compile, relevant E2E/browser proof, and scoped `git diff --check`.
8. [in_progress] Update automation memory and attempt thread archive through the available Codex thread tool.

## Notes

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders is reachable but has no list named `Personal AI`; no Reminder item can be completed.
- Recent automation memory excludes Message Analysis, Message Reaction, Task Scheduler, Agent Workflow, Native Join, Memory Capture, Decision Center, Jira Import/Design Links, Memory Coverage Map, Relationship Radar, Memory Lens, Skill Foundry, Quick Ask, Project Dashboard, Rehearsal, Scheduled Messages, Meeting Pilot, Compose Assist, Google Slides Analyzer, and Notification Center where possible.
- First random sample was `外部 AI 历史基础录入`, but it was rerolled because Memory Coverage Map was recently touched.

## Errors

| Error | Attempt | Resolution |
|---|---|---|
| `ruby: invalid option -M` | Random sampler required `securerandom` with `-M` | Switched to supported `-rsecurerandom` |
| `undefined method filter_map` | Ruby on this host is old | Rewrote sampler with `each` and explicit array appends |
| `sed: src/modals/SearchResultPage.vue: No such file or directory` | Used stale Search Result path | Switched to `src/modals/components/SearchResultPage.vue` |
