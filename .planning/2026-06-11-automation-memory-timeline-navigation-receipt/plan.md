# Memory Timeline Navigation Receipt Plan

## Target

- Selected feature: `时间轴/搜索安全跳转` under Memory Exploring.
- Source of truth: `docs/memory_system.md`.
- Code surface: `src/modals/components/TimelinePage.vue`, `src/modals/timelinePresentation.ts`, timeline verifiers.

## Context

- `docs/progressing/to-verify.md` says no carry-over validation is pending.
- Local Reminders are readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or completed.
- Prior timeline work already exposes scope, range, source filtering, focused memories, and hidden unsafe links.
- External signals from Microsoft Recall, Google My Activity, PIM/refinding research, and timeline-based memory-agent papers all point toward visible range/source/control receipts when users re-find personal memory.

## Improvement

Add a visible timeline navigation receipt after users click a timeline card or link action:

- Safe memory route opens should state the in-app route path and that no external source was opened.
- Safe external source opens should state the destination host and that the source tab is separate from Memory Service reads.
- Blocked links should state the blocked reason and the recovery path: use the visible card context, adjust filters, or open a safe source when present.
- Cards with no safe target should not silently do nothing.

## Validation

1. `npm run verify:memory-timeline`
2. `npm start` first successful compile, then stop the watcher
3. `npm run verify:memory-timeline:e2e`
4. `git diff --check`
5. Confirm no `npm start` / `webpack --watch` process remains
