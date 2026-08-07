# Findings & Decisions

## Requirements
- Pick a random feature from `docs/index.md`.
- Check docs against implementation, external products/papers, Reminders, bugs, UX, and unfinished work.
- Produce a plan first, then implement completely and verify as far as practical.

## Repository Findings
- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over item.
- Random sample first eligible target: `记忆提示 Hover Peek` under Memory Lens.
- Worktree already has broad unrelated dirty state, including existing AR Data edits inside `src/contentScriptWebIntelligence.ts` and `docs/features/memory_lens.md`; this run must avoid reverting or owning that work.
- Memory Lens Hover Peek already shows source/freshness/footer and read-only boundary, but cached passive recall is rendered through the same path as fresh recall without a visible cache-basis receipt.
- Existing verifier anchor: `npm run verify:webpage-memory-detection`; existing E2E anchor: `npm run verify:webpage-memory-detection:e2e`.

## Reminder Findings
- AppleScript listed Reminders lists but did not show `Personal AI`.
- EventKit fallback found `Personal AI` with 4 items; all are already completed and historical Doubao / Weekly Dream Digest / notification sync feedback.
- No open or target-related Reminder item should be marked done.

## External Research Findings
- OpenAI Memory sources expose which sources personalized a response and allow corrections or "do not mention" controls.
- Slack AI search answers include citations; users can hover/click citations to inspect source messages/files.
- Notion Enterprise Search emphasizes permission-aware query-time filtering, no sensitive-content caching, and deletion/permission sync boundaries.
- IBM CHI 2025 RAG trust work found source attribution and document-section highlighting improved trust more than confidence scores alone.
- HCINLP 2025 trustworthy LLM design survey argues users need enough transparency to assess system decisions before acting.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `recallBasis` to `ContextBubbleOptions` | The cache path already knows cache age; passing a string keeps the UI explicit without changing backend contracts. |
| Surface basis in Hover Peek footer and Rest aria/title | Users encounter these before expanded card, including keyboard focus users. |
| Do not change cache TTL or animation semantics | This pass targets comprehension of the existing state, not recall freshness policy. |

## Resources
- `src/contentScriptWebIntelligence.ts`
- `tools/verify-webpage-memory-detection.ts`
- `docs/features/memory_lens.md`
- OpenAI Memory FAQ: https://help.openai.com/en/articles/8590148-memory-faq
- Slack AI features/search guide: https://slack.com/intl/en-gb/help/articles/25076892548883-Guide-to-AI-features-in-Slack
- Notion Enterprise Search security: https://www.notion.com/help/enterprise-search-security-and-privacy-practices
- IBM CHI 2025 RAG trust/transparency: https://research.ibm.com/publications/exploring-trust-and-transparency-in-retrieval-augmented-generation-for-domain-experts
- HCINLP 2025 user control paper: https://aclanthology.org/2025.hcinlp-1.3.pdf

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| AppleScript missed `Personal AI` Reminders list | Used EventKit fallback and treated its completed-only results as the Reminder truth for this run. |
