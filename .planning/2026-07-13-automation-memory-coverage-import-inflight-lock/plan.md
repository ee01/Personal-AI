# Memory Coverage Import In-Flight Lock Plan

## Scenario

A cautious user pastes sensitive project notes into Memory Coverage smart import, runs dry-run, confirms high-risk import, and clicks submit. While the service is still writing the original request, they edit the textarea or switch scope to prepare the next import.

## Problem

The page already shows pending and completion receipts, but the source controls remain editable while inspect/commit requests are in flight. That can make an old response appear next to a newer input, so the screen no longer clearly identifies what was actually inspected or submitted.

## Plan

1. Lock smart import source chips, file picker buttons, scope selector, and paste textarea while an import request is in flight.
2. Add state-aware title / aria labels to explain that the current request is using the snapshot captured at click time, and that changing source/scope/text requires waiting for the request to finish.
3. Extend the existing Memory Coverage E2E pending-commit case to assert the controls are disabled and expose the boundary.
4. Update `docs/features/memory_coverage_map.md` with the canonical in-flight lock behavior.
5. Validate with the Memory Coverage targeted unit/API tests, first successful `npm start` compile, E2E, and scoped `git diff --check`.
