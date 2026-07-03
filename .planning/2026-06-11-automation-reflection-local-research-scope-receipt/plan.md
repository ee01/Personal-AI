# Reflection local research scope receipt plan

## Goal

Random feature selected from `docs/features/index.md`: `反思本地研究补查` under Memory Service (`docs/features/memory_system.md`).

This run will improve one bounded UX gap: local reflection research already records query / hit / empty / failed states, but when the LLM planner asks for unsupported source types, users only see the sanitized source list. The UI should expose that the query scope was safely clipped to Personal AI-supported local sources, without treating it as an error or adding a user review queue.

## Context

- `docs/progressing/to-verify.md`: `暂无。`
- Reminder check: local Reminders were readable, but there is no `Personal AI` list, so no Reminder item is incorporated or marked done.
- Existing implementation:
  - `ReflectionResearcher` plans queries and sanitizes source types.
  - `ReflectionThreadService.executeResearchQueries` records hit / empty / failed attempts and channel-failure warnings.
  - `ReflectionThreadDetail.vue` displays research attempt status, filters, failures, and evidence refs.

## External references

- Slack / Notion / Microsoft Copilot enterprise search all emphasize permission-scoped grounding/search.
- OpenAI / LangGraph memory docs emphasize background memory updates with visible controls and scope.
- Generative Agents and Reflexion support reflection-memory loops, but the product needs inspectable evidence, scope, and failure traces.

## Plan

1. Extend local research planning to preserve requested source types, supported source types, and rejected source types separately.
2. Store a non-error `scopeNotice` on `reflection_research_attempts`.
3. Render the scope notice in Reflection Thread detail as a `研究范围回执`, separate from failed/partial recall errors.
4. Update the reflection E2E fixture/assertions and focused researcher tests.
5. Update `docs/features/memory_system.md` with the new scope clipping receipt.
6. Validate with focused memory-service tests, `npm start` first compile, reflection E2E, and `git diff --check`.

## Progress

- 2026-06-11T06:04:25+08:00: Selected feature, checked `to-verify`, automation memory, Reminder state, existing docs/code, and external references. Plan ready for implementation.
- 2026-06-11T06:07:54+08:00: Implemented source-type scope preservation, repository storage, UI scope notice, focused tests, and feature doc update.
- 2026-06-11T06:10:30+08:00: Validation passed: focused memory-service tests, first successful `npm start` compile, `npm run verify:reflection-research:e2e`, `npm --prefix memory-service run build`, scoped and full `git diff --check`, and watcher/process check.
