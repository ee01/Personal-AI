# Compose Assist AI Prompt Review

## Goal

Determine whether Compose Assist supports enriching an existing prompt on ChatGPT-like AI pages, where that capability is documented and implemented, how it is triggered, whether it behaves like a professional prompt engineer, and what improvements or system prompt are warranted.

## Scope

- Read-only product/code review plus a recommended system prompt sample.
- Inspect the user-provided ChatGPT conversation through the existing signed-in Chrome session.
- Do not implement code changes unless the user separately approves them.

## Phases

1. [complete] Inspect canonical docs and adjacent progressing plans.
2. [complete] Trace implementation, trigger events, routing, context inputs, and generation prompts.
3. [complete] Inspect the referenced ChatGPT conversation and compare the target workflow.
4. [complete] Synthesize current behavior, gaps, and a concrete system prompt sample.
5. [complete] Verify evidence references and deliver the review.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Chrome extension browser binding unavailable | 1 | Followed repository preference and used the already-open ChatGPT tab through `webpage-mcp`. |
