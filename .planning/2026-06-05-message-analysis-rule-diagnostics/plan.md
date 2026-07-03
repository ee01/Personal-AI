# Message Analysis Manual Rule Diagnostics Plan

Goal: improve `Message Analysis / 手动关注项规则` by making manual memory-entry rules easier to debug when the model claims a rule matched but the deterministic sender/group guard rejects it.

## Plan

1. Inspect current rule docs, runtime matching, UI, and verification scripts.
2. Check local Reminders for a `Personal AI` list and incorporate relevant items if present.
3. Review current product/paper signals for trigger/action rule comprehensibility and debugging.
4. Add deterministic scope-rejection diagnostics to the runtime without changing matching semantics.
5. Surface recent per-rule diagnostics in the Memory Entry Rules UI.
6. Update focused tests, docs, and run the strongest practical validation ladder.

## Decisions

- Selected feature: `手动关注项规则` under Message Analysis.
- Reminder result: local Reminders is accessible but has no visible `Personal AI` list.
- Carry-over: `docs/progressing/to-verify.md` still has Ask remote revalidation, but it depends on deploying unrelated dirty memory-service work; this run does not mix that blocked item into Message Analysis.
- Implementation slice: persist a capped local diagnostic entry only when a claimed manual rule match is rejected by final scope validation, then show that diagnostic on the rule card.
- No new review queue: diagnostics explain internal judgment and scope mismatch; they do not ask the user to approve routine model decisions.

## Validation Target

- Existing runtime guard tests.
- Manual message-entry flow with the new diagnostic assertion.
- Topic rule helper tests.
- First successful `npm start` compile, then stop watch.
- E2E or built-page proof for the rule-card diagnostic surface if practical.
- Scoped `git diff --check`.
