# Dream Replay Review Triage

## Target

- Randomly selected feature: `梦境重放` / Dream replay from `docs/features/index.md`.
- Source of truth: `docs/features/memory_system.md`.
- Main surface: `src/modals/components/DreamInsights.vue`.

## Context

- `docs/progressing/to-verify.md` was `暂无。`, so no carry-over item blocked a fresh random pick.
- Local Reminders was readable, but no `Personal AI` list was present, so no Reminder feedback item was incorporated or completed.
- Existing Dream replay behavior already showed evidence receipts, missing-file warnings, notification deep-link preservation, and reflection-thread handoff.
- The remaining UX gap was that a user could see counts for risks, relationships, and missing evidence but still had to infer what to do first.

## External Signals

- OpenAI Dreaming and Memory controls point toward background memory synthesis with visible summaries and user control.
- Microsoft 365 Copilot grounding emphasizes that available answers depend on source and account boundaries.
- Generative Agents and Reflective Memory Management support periodic reflection/replay as a way to synthesize memory into future retrieval and planning cues.
- SSGM argues that evolving memory should remain separated from execution and governance decisions.

## Plan

1. Add a per-dream review triage receipt that classifies cards into risk, relationship, evidence, insight, or quiet review paths.
2. Make risk and relationship dreams visible as priority review items when they have grounding evidence.
3. Keep missing-evidence dreams explicitly non-actionable until raw evidence is recovered or checked elsewhere.
4. Update the Dream replay E2E to assert the new triage receipts on both grounded-risk and ungrounded cards.
5. Update the canonical feature doc with the new review-path boundary.

## Implementation

- Added `DreamReviewTriage` and deterministic triage helpers in `DreamInsights.vue`.
- Added a top-level `优先复核` metric plus per-card triage chips and `处理回执`.
- The receipt explains the next step and the boundary: no automatic notification, task dispatch, external writeback, profile write, Rehearsal creation, or fact confirmation.
- Extended `tools/verify-memory-dreams-e2e.mjs` to check grounded risk triage and ungrounded evidence triage.
- Updated `docs/features/memory_system.md` to keep the Dream replay behavior current without over-documenting implementation details.

## Validation

- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm --prefix memory-service test -- --run src/__tests__/generativeReplay.test.ts src/__tests__/heartbeatLoopDreamDigest.test.ts`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start` reached the first successful webpack development compile and was stopped.
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm run verify:memory-dreams:e2e`
- `git diff --check -- src/modals/components/DreamInsights.vue tools/verify-memory-dreams-e2e.mjs docs/features/memory_system.md`
- Process check confirmed no `webpack --watch` / `npm start` process remained.
