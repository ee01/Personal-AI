# User Profile Influence Receipt Plan

## Selected Feature

- Feature: `画像快速增强/降低影响`
- Capability: User Profile
- Source doc: `docs/features/user_profile_system.md`
- Start time: 2026-06-12T03:02:34+08:00

## Context

- `docs/progressing/to-verify.md` is clear: `暂无。`
- Automation memory shows the freshest exact targets were Relationship Context Card, Doubao manual run, Message Reaction AutoReply, Skill Foundry sync, Decision Center, Jira Automation Import, Memory Timeline, Compose Assist route, Notification Center delivery receipt, and Message Reaction followup.
- Reminder direct query failed due AppleScript syntax, then the simple Reminders list probe hung until the guard killed it. The local Reminder branch is blocked for this run; do not invent related items or mark anything done.
- External research direction: ChatGPT, Claude, RUMS, and Mem0 all point toward explicit user control and selective profile/memory use. The actionable local gap is making profile calibration receipts describe the actual effect of the user's action.

## Problem

The User Profile page already shows impact receipts for quick boost/lower actions, but the shared `buildInfluenceReceipt` helper treats every importance value below `0.85` as `已降低影响`. The star-rating path can set intermediate values such as `0.8`, so raising a profile from a low score to 4 stars may still produce a demotion receipt.

## Implementation Plan

1. Update `buildInfluenceReceipt` to compare previous score with the new score when the action is not the explicit 95% boost or 25% lower action.
2. Keep quick action wording stable: `0.95` remains `已设为重点`, `0.25` remains `已降低影响`.
3. Use neutral/directional copy for intermediate star scores: raise, lower, or adjust.
4. Extend the User Profile E2E fixture to click a 4-star rating from a lower current score and assert the receipt is not mislabeled as lowered.
5. Update `docs/features/user_profile_system.md` with the corrected star-rating receipt boundary.
6. Run the existing User Profile proof ladder and `git diff --check`.

## Validation Target

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `npm --prefix memory-service test -- --run src/__tests__/api-profile.test.ts src/__tests__/api-ingest-profile.test.ts`
- `npm start` first successful compile, then stop watch
- `node tools/verify-user-profile-export-e2e.mjs`
- `git diff --check`

## Outcome

- Complete.
- Star-rating calibration now distinguishes `已提高影响`, `已降低影响`, and `已调整影响` for intermediate values by comparing the target importance with the previous score.
- Explicit quick actions keep stable wording: 95% remains `已设为重点`, 25% remains `已降低影响`.
- The feature doc now states the star-rating receipt boundary.
- Validation passed as listed below in `progress.md`.
