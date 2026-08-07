# Task Plan: Today Pilot Meeting Prep Boundary Sweep

## Goal
Improve the selected `会前准备` feature from `docs/index.md` with one bounded, code-backed UX/trust fix, keep docs current, and verify through the repo's real Today Pilot meeting-prep harness.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, `docs/index.md`, `docs/progressing/to-verify.md`, automation memory, and Reminder state
- [x] Randomly select `会前准备` under Today Pilot from the feature index while avoiding the freshest exact targets where practical
- [x] Document initial repo and Reminder context in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Inspect Today Pilot meeting-prep docs, source, and existing verifier shape
- [x] Research comparable product/research patterns
- [x] Decide exact code/docs/test edit scope before touching runtime files
- **Status:** complete

### Phase 3: Implementation
- [x] Add pre-click boundaries to selected meeting-prep controls/links
- [x] Update focused verifier assertions
- [x] Update concise feature docs/index text
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run static/source verifier for Today Pilot Video Home
- [x] Run `npm start` until first successful compile, then stop it
- [x] Run rebuilt meeting-prep E2E verifier
- [x] Run scoped `git diff --check`
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with selected feature, Reminder result, research, implementation, docs, and verification
- [x] Report owned files and any verification limits
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `会前准备` as the selected feature | It was the first random eligible candidate after recent exact targets were filtered; this run scopes to meeting-prep Video Home / handoff behavior, not broader Today Pilot homepage work. |
| Treat Reminders as no-op this run | EventKit found `Personal AI` with 4 total items and 0 incomplete items. |
| Prefer control-level boundary copy over backend redesign | Docs and code already contain the core cache/backfill/handoff behavior; external scan reinforces source/control transparency for meeting AI. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Planning skill path under `.codex/skills` was missing | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` instead. |
| Static verifier failed on the phrase `重新生成` in new link-boundary copy | Reworded the evidence-link boundary to `另行生成` to preserve the existing no-on-demand-generation guard. |
| E2E memory-link assertion failed because fixture `exploreLink` was `?chunkId=...` | Updated the fixture to allowed `#/timeline?focus=memory-1`, matching `sanitizeExploreRoute`. |
