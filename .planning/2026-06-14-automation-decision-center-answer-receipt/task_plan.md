# Decision Center Answer Receipt

## Target

- Feature: `决策中心` in `docs/features/memory_system.md`
- Surface: `memory-exploring.html#/decisions`
- Random index row: `决策中心 | Memory Service | memory_system.md | DecisionCenter.vue / confirm_requests`

## Research Notes

- Zapier Human in the Loop pauses workflow runs so a human can approve, decline, or change data before the workflow continues.
- Microsoft Copilot Studio Request for information pauses agent flows to collect human input and then resumes with that response.
- GitHub Copilot coding agent keeps generated work in PRs and review gates before downstream automation.
- Automation-bias research supports showing actual action consequences, not only generic evidence, so users can maintain calibrated control.

## Plan

1. Keep the existing Decision Center queue split, action-boundary receipts, and watch-item behavior.
2. Expose the service's `answer` side-effect fields in the extension client type.
3. Render answer receipts that distinguish OpenClaw retry, skip-once, stop, missing action result, and ordinary answers.
4. Extend the Decision Center E2E fixture to cover an OpenClaw retry answer receipt and action-queue deep link.
5. Update the canonical Memory System feature doc.
6. Verify with the confirm-request API tests, first successful dev compile, Decision Center E2E, and scoped diff checks.

## Result

- Implemented action-specific answer receipts in `DecisionCenter.vue`.
- Updated `ConfirmRequestAnswerResponse` in `MemoryServiceClient.ts`.
- Extended `tools/verify-decision-center-e2e.mjs` with the retry receipt path.
- Updated `docs/features/memory_system.md`.

## Validation

- `npm --prefix memory-service test -- --run src/__tests__/confirmRequestsApi.test.ts`
- `npm start` first webpack compile, then stopped
- `npm run verify:decision-center:e2e`
- `git diff --check -- src/services/MemoryServiceClient.ts src/modals/components/DecisionCenter.vue tools/verify-decision-center-e2e.mjs docs/features/memory_system.md`
