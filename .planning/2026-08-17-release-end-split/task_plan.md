# Task Plan: Release 结束分割节点

## Goal
把发布时间表标尺的 ⚑/`splitPhase` 从「本列 Sprint 起点」改成「本 release 结束、切到下一 release 的展示节点」，并同步文案、indicator、demo 与 feature docs。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm current `relSegments` is start-owned: `[本班 split, 下一班 split)`
- [x] Confirm desired end-owned: `[上一班 split, 本班 split)`；首列无上一班时向前兜底
- **Status:** complete

### Phase 2: Core logic + tests
- [x] Flip `relSegments` in `useReleaseRuler.ts`
- [x] Strengthen vitest assertions on start/end ownership
- **Status:** complete

### Phase 3: UI copy + indicator/icon
- [x] `JqlModal.vue` tips / foot / chip button / toast
- [x] `GanttPanel.vue` legend + sprint tip
- [x] Mirror finish-oriented icon (end flag)
- **Status:** complete

### Phase 4: Docs + demo
- [x] `docs/features/personal_roadmap.md` key logic
- [x] `docs/demo/roadmap-demo.html` `relSegments` + copy/icon
- **Status:** complete

### Phase 5: Verify
- [x] Run scoped vitest for useReleaseRuler
- **Status:** complete

## Key Questions
1. First segment with no previous anchor → use `rel.start` if before split, else `split - 4d`
2. Half-open `[start, end)` keeps split day as switch into next column

## Decisions
| Decision | Rationale |
|----------|-----------|
| End-owned segments | User: split = release 结束切换点 |
| Mirror flag SVG +「结束」chip label | Visual cue that marker closes the band |
| Keep `splitPhase` field name | Storage contract unchanged; only semantics/copy change |
