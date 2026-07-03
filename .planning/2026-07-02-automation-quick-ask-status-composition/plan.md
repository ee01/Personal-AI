# Quick Ask Status Composition Plan

## Target

- Feature: `Quick Ask 状态卡`
- Source doc: `docs/features/doubao_bridge.md`
- Main files: `desktop-app/app/quick-ask.js`, `desktop-app/app/quick-ask.css`, `desktop-app/scripts/quick-ask-status-card-check.mjs`

## Context

- Random selection produced several feature candidates; this run selected `Quick Ask 状态卡` because it was not the latest exact automation target.
- AppleScript did not show a `Personal AI` Reminders list, but EventKit did. EventKit found four `Personal AI` items, all already completed. The relevant historical item is the Doubao sync-failure feedback, which supports keeping sync status visible before the user has to inspect local logs.
- External references support low-friction desktop AI entry points plus clear status/control boundaries:
  - Raycast Quick AI: one-window quick ask with follow-ups and handoff.
  - ChatGPT desktop: shortcut-driven prompt window around current work.
  - Mixed-initiative context and Human-AI interaction guidelines: explicit, manipulable context and scoped user authority.
  - Notification/task-management research: status signals can reduce anxiety when they summarize current state without unnecessary context switching.

## Improvement

The current status card shows snapshot age and total item count, but it does not summarize the kind mix when multiple status categories coexist. Compact mode can say `+N`, yet expanded mode lacks a first-glance composition receipt.

Implement a compact `状态构成` summary:

1. Aggregate `runtime.items` by status kind.
2. Use `item.count` when present, falling back to one item.
3. Render a small receipt under the snapshot meta.
4. State that the summary is only the current snapshot composition and does not execute, retry, send, cancel, archive, approve, or write.
5. Hide the receipt when there are no current items.

## Verification

1. `node --check desktop-app/app/quick-ask.js`
2. `node --check desktop-app/scripts/quick-ask-status-card-check.mjs`
3. `npm --prefix desktop-app run test:quick-ask-status-card`
4. `npm start -- --progress`, stop after first successful compile
5. Scoped `git diff --check`
