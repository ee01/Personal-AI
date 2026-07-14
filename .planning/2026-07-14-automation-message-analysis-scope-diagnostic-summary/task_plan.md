# Message Analysis Scope Diagnostic Summary

## Target

- Selected feature: `规则范围校验` in `docs/features/message_analysis.md`.
- Scope: make scope-gate diagnostics easier to find from the rule list after a run reports `范围拦截`.
- Non-goals: do not change rule matching, final gate semantics, memory writes, notification delivery, digest routing, auto reply, follow-thread, RuntimeAction planning, OpenClaw execution, or Reminder state.

## Inputs

- `docs/progressing/to-verify.md`: no carry-over items.
- Automation memory: recent exact/family targets skipped before selecting Message Analysis.
- Reminder: EventKit found `Personal AI` with 4 total items and 0 incomplete items; no related feedback to incorporate.
- External scan:
  - Slack Workflow Builder keyword workflows expose channel and keyword conditions before the workflow can run.
  - Zapier Filters/Paths use explicit pass/fail conditions before later steps continue.
  - Trigger-action debugging research emphasizes showing why rules fired, did not fire, or produced unexpected effects.

## Plan

1. Keep the existing fail-closed runtime logic unchanged.
2. Add a folded-list affordance for rules with a latest `scope_rejected` diagnostic.
3. Include latest reason/context in `title` and `aria-label`, while keeping full details inside the expanded card.
4. Extend the existing Message Analysis E2E fixture to assert the collapsed row.
5. Update concise feature docs and index wording.
6. Verify with targeted script, dev compile, E2E, and scoped diff check.

