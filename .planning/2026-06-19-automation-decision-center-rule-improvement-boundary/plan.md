# Decision Center Rule Improvement Boundary Plan

## Target

- Feature index row: `决策中心`
- Source of truth: `docs/memory_system.md`
- Primary UI: `src/modals/components/DecisionCenter.vue`

## Research Direction

- Zapier Human in the Loop and Microsoft Copilot Studio RFI both pause automation for human review before continuation.
- GitHub Copilot cloud agent keeps autonomous work reviewable before PR handoff.
- Human-in-the-loop and automation-bias research points to explicit decision ownership, low-cost evidence review, and clear separation between suggested action and completed action.

## Improvement Plan

1. Keep the change scoped to `message_rule_improvement` confirm requests in Decision Center.
2. Make the action labels match the actual flow: opening only pre-fills a rule edit; saving in the rule editor applies the suggestion.
3. Make the review context and copied review package show the same handling options and boundary as the card.
4. Extend the Decision Center E2E to cover the rule-improvement path.
5. Update `memory_system.md` at a product-behavior level.

## Validation Plan

- `npm run verify:decision-center:e2e`
- `npm start` until first successful development compile, then stop the watcher.
- `git diff --check` scoped to the changed files.
