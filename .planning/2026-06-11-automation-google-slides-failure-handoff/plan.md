# Google Slides Analyzer Failure Handoff Plan

## Context

- Selected feature: Google Slides Analyzer writeback preview / review path.
- Reminder check: attempted local Reminders probe; `Personal AI` list check needs a macOS-compatible AppleScript wrapper because GNU `timeout` is unavailable.
- External reference direction: Google Slides `batchUpdate` is atomic, while Gemini/Copilot/Slide4N-style presentation assistance keeps generated or modified deck content reviewable and user-controlled.

## Plan

1. Add a failure-state handoff receipt for whole-batch writeback errors and timeouts.
2. Reuse submitted field preview data so the receipt carries project, field, target, evidence, reason, and next step without changing the backend contract.
3. Add a copy action for the failure handoff checklist.
4. Update the Google Slides Analyzer E2E fixture to assert visible failure handoff content and copied checklist text.
5. Update the feature doc with the new failure recovery behavior.
6. Validate with the focused verifier, dev webpack compile, E2E, and diff checks.
