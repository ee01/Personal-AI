# Findings & Decisions

## Requirements
- Fix the reported silent message analysis crash.
- Confirm whether it stops subsequent groups: yes, it aborts before the first LLM call and exits the group loop.
- Preserve unrelated dirty worktree changes.

## Research Findings
- `buildRuntimeWatchRules` merges manual, outreach, and Focus Project rules.
- `buildRuleText` only special-cases outreach and treats every other sourced rule as manual.
- A `ProjectWatchRule` has no `manualItem`, so recursive formatting passes `undefined` and reproduces the exact reported TypeError.
- `analyzeMessages` catches that error and calls DOM-only `showToast` from the background service worker, replacing it with `document is not defined`.
- If the toast were merely guarded and the catch still returned `undefined`, `summarizeMessageAnalysisTaskRun` would currently report success; the original error must be rethrown.
- Existing roadmap focus tests validate generated `rule.text`, but do not pass the rule through the message-filter prompt builder.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Extend the existing Roadmap Focus contract test with the integrated prompt and error checks | Keeps the regression in the existing `verify:roadmap-focus-contract` gate |
| Keep `showToast` unchanged and guard its call site | Avoids changing global UI utility behavior for unrelated callers |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `src/utils.ts` already has unrelated user changes | Do not edit it; fix background behavior in `messageDealing.ts` only |

## Resources
- `src/utils/ruleTextBuilder.ts`
- `src/prompts/messageAnalysis.ts`
- `src/watchRules.ts`
- `src/messageDealing.ts`
- `src/services/TaskScheduler.ts`
