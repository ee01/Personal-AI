# Decision Center Action Boundary Receipt

## Target

- Feature: `决策中心` in `docs/memory_system.md`
- Surface: `memory-exploring.html#/decisions`

## Research Notes

- Zapier Human in the Loop and Microsoft Copilot Studio RFI/approvals pause automation so a human can review before the workflow continues.
- GitHub Copilot cloud agent keeps agent output reviewable before users merge or trigger downstream delivery gates.
- Automation-bias research supports showing action consequences and keeping human judgment space clear, not just exposing evidence.

## Plan

1. Add a compact action-boundary receipt to pending decision cards.
2. Add lane-specific receipt copy for deferred decisions and watch items.
3. Fix the pending watch-item `立即查证` blocker so the rendered action matches the API contract and repeated clicks reuse the same queued action.
4. Extend the existing Decision Center E2E and confirm-request API tests to assert the new receipt/action behavior.
5. Update the Memory System feature doc.
6. Verify with the Decision Center E2E, first successful dev compile, confirm-request API tests, and diff checks.
