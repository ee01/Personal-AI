# Task Plan: Agent Thinking Trace Step Button Boundaries

## Goal
Improve Agent Thinking Options trace navigation so every step-locator control exposes the same hover and screen-reader boundary: it only expands/focuses the current page trace step and does not approve, copy, rerun, send, write, delete, or execute external actions.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, `docs/index.md`, current automation memory, and Agent Thinking docs/source/E2E.
- [x] Check `docs/progressing/to-verify.md`.
- [x] Check local Reminders through AppleScript and EventKit.
- [x] Gather external references for agent trace/HITL UX.
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Select the first randomized non-recent feature: `Agent Thinking 分析编排`.
- [x] Scope to presentation/accessibility boundaries for step-locator buttons.
- **Status:** complete

### Phase 3: Implementation
- [x] Add shared `title` / `aria-label` boundaries to uncovered step-locator buttons in `src/agent-visualizer.tsx`.
- [x] Update `tools/verify-agent-thinking-options-e2e.mjs` to assert the new boundaries.
- [x] Update `docs/features/agent_thinking.md` and `docs/index.md` concisely.
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run `node --check tools/verify-agent-thinking-options-e2e.mjs`.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run `node tools/verify-agent-thinking-options-e2e.mjs`.
- [x] Run scoped `git diff --check`.
- [x] Check for leftover watcher/E2E processes.
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory.
- [x] Mark Reminder items done only if a related incomplete item was used.
- [x] Summarize owned files, validation, Reminder outcome, and boundaries.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `Agent Thinking 分析编排` | First valid randomized sample not in the freshest exact feature list. |
| Do a presentation/accessibility fix only | The code already has strong trace and approval data contracts; uncovered hover/read-screen button boundaries are a user-visible gap with low backend risk. |
| Do not implement persistent HITL checkpointing | That is a larger product decision already documented as future work; this run should not change run-state semantics. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Initial feature sampler printed index head instead of randomized rows | Reran the sampler with `shuffle <>` before selecting the target. |
| E2E assertion expected a shorter approval-queue reason | Matched stable fragments from the actual richer copy instead. |
| E2E assertion expected a "prepare call" flow-node reason | Matched the actual approval-required state summary instead. |
