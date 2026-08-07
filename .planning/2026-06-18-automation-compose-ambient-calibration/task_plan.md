# Compose Assist Ambient Calibration Sweep

## Goal
Improve the Compose Assist ambient calibration path so natural feedback remains low-friction, privacy-safe, and honest about whether calibration actually reached the backend.

## Plan

1. [completed] Gather repo workflow, carry-over, automation memory, Reminders, and random feature target.
2. [completed] Inspect Compose Assist docs, ambient calibration code, existing tests, and outside product/research references.
3. [completed] Implement a bounded UX/logic fix for ambient calibration delivery honesty.
4. [completed] Update feature docs only where current behavior changes.
5. [completed] Run targeted verification, dev build first compile, E2E, and diff checks.
6. [in_progress] Update automation memory and attempt thread archive closeout.

## Decisions

- Target feature: `回复助手无感校准` from `docs/index.md`.
- Reminder branch: local Reminders has no `Personal AI` list, so no item can be marked complete.
- Scope: keep Compose Assist calibration low-friction; do not add a new feedback form or review queue.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Initial random sampling printed index order | Used Perl without assigning `shuffle()` result | Re-ran with explicit `@b=shuffle(@a)` |
| Ad hoc file-level `tsc` reported downlevel iteration errors | Ran `tsc` without repo tsconfig target | Treated as invalid check; used repo test/build/E2E harness instead |
