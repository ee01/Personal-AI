# Compose Assist AI Prompt Review

## Goal

Determine whether Compose Assist supports enriching an existing prompt on ChatGPT-like AI pages, where that capability is documented and implemented, how it is triggered, whether it behaves like a professional prompt engineer, and what improvements or system prompt are warranted.

## Scope

- Implement the approved blur-triggered Compose Assist flow and professional Web AI prompt compiler.
- Preserve existing deterministic prompt patches, preview-only-before-write behavior, undo, calibration, and no-send boundaries.
- Extend targeted tests, Compose Assist evals, canonical docs, and real Chrome verification.

## Phases

1. [complete] Inspect canonical docs and adjacent progressing plans.
2. [complete] Trace implementation, trigger events, routing, context inputs, and generation prompts.
3. [complete] Inspect the referenced ChatGPT conversation and compare the target workflow.
4. [complete] Synthesize current behavior, gaps, and a concrete system prompt sample.
5. [complete] Verify evidence references and deliver the review.
6. [complete] Implement the backend prompt compiler, evidence sanitation, language/risk validation, and response contract.
7. [complete] Implement blur-only request scheduling, full-draft replacement, and mode-aware preview/receipts.
8. [complete] Extend API, unit, E2E, and experience-eval coverage.
9. [complete] Update the canonical Compose Assist documentation.
10. [in_progress] Run the development compile, focused tests, eval, and real Chrome Canary verification. All Compose Assist checks are complete; the live Chrome step is waiting for the ChatGPT Chrome Extension, and the latest repo-wide validator is independently blocked by unfinished concurrent `action-readiness-contracts` fixtures.

## Locked implementation decisions

- All Compose Assist surfaces request only after a real blur; focus/input only maintain and invalidate draft state.
- `rewrite_prompt` always uses `replace_draft`; `prompt_patch` and `context_pack` use `append_patch`.
- The Web AI compiler may operate without recalled memory and must emit the draft's dominant language.
- Invalid, duplicate, placeholder, or off-topic memory is removed before compilation; the old generic context-pack boilerplate is not a fallback.
- Web AI suggestions remain preview-first and never submit the host composer.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Chrome extension browser binding unavailable | 1 | Followed repository preference and used the already-open ChatGPT tab through `webpage-mcp`. |
| Backend compile: non-Web branch still compared `contextType` with `web_agent_prompt`; optional `agentContext` dereferenced | 1 | Remove the impossible comparison after the early Web return and keep Web debug/context reads optional. |
| Existing Web AI API tests returned unavailable | 1 | Expected after introducing `generateJSON`; update the test LLM mock and replace obsolete generic context-pack assertions with the new compiler contract. |
| Real compiler exceeded the 5.5s interaction timeout | 1 | Measured the GPT-5 path, set `reasoning_effort=none`, and require a compact structured result; the childcare and English probes then completed within budget. |
| Locked context had evidence ids but visible recall matches were empty | 1 | Resolve up to six selected-topic message ids, then pass them through the same Web evidence sanitation and three-item cap. |
| Composer text containing “不发送” was misclassified as a send control | 1 | Restrict send detection so the composer element and draft text cannot masquerade as a Send/Submit button. |
| Ambient-calibration fixture lost an already-dwelled observation after input invalidation | 1 | Preserve the redacted observed trace while invalidating the visible suggestion and any undwelled candidate. |
| Compose eval reflection seed used an invalid source type | 1 | Use the supported `manual` source type and keep sensitivity driven by content, not the generic project-memory label. |
| Chrome control extension is absent from the selected Chrome profile | 1 | Completed read-only diagnostics; native host is valid, but browser automation cannot proceed until the ChatGPT Chrome Extension is installed/enabled. Do not bypass this with AppleScript or shell browser automation. |
| A final repo-wide `eval:validate` began failing after concurrent action-readiness fixtures appeared | 1 | Confirmed the five failing cases live in untracked `action-readiness-contracts` files outside this task. Preserve them; rely on the earlier passing validation and the passing Compose Assist report, and report the current external failure explicitly. |
