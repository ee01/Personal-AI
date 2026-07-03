# Relationship Radar Review Queue Empty Receipt Plan

## Goal

Improve `人脉关系 Review Queue` so empty filter states explain the current queue scope and recovery path instead of looking like a failed read or completed queue.

## Plan

1. Inspect current docs/code/tests and confirm Review Queue semantics.
2. Check local Reminders and external product/research references.
3. Implement a presentation-only empty-state receipt for Review Queue filters.
4. Update the Relationship Radar feature doc.
5. Verify with relationship tests, first successful `npm start` compile, E2E, i18n, and scoped diff checks.

## Scope

- Target feature: `人脉关系 Review Queue` in `docs/features/relationship_radar.md`.
- Primary UI: `src/modals/components/RelationshipRadarPage.vue`.
- Existing E2E: `tools/verify-relationship-radar-e2e.mjs`.
- No backend schema, action semantics, or confirmation write contract changes planned.

## Status

- Step 1: complete.
- Step 2: complete.
- Step 3: complete.
- Step 4: complete.
- Step 5: complete.
