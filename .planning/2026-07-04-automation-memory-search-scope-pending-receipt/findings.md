# Findings & Decisions

## Requirements
- Pick a random feature from `docs/features/index.md`.
- Check docs against implementation, external products/papers, Reminders, bugs, UX, and unfinished work.
- Produce a plan first, then implement completely and verify as far as practical.

## Repository Findings
- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over item.
- Random sample first eligible target: `工作/个人/全部范围语义` under Memory Service.
- Source doc: `docs/features/memory_system.md`.
- Main UI path: `src/modals/components/SearchResultPage.vue`.
- Presentation helper path: `src/modals/searchResultPresentation.ts`.
- Verification anchors: `npm run verify:memory-search-results` and `npm run verify:memory-search-scope:e2e`.
- Existing code already sends `scope=work|personal|all`, normalizes legacy `both` to `all`, shows scope intent, result breakdown, exposure/boundary notices, empty-result receipts, and recall channel receipts.
- UX gap: when the user switches scope with existing results on screen, the old results can remain visible while the new request is pending. The scope caption and intent can already move to the requested scope, but there is no explicit pending receipt that says the visible cards are still the prior scope snapshot until Memory Service returns.
- Worktree already has broad unrelated dirty state, including pre-existing changes in `docs/features/memory_system.md`; do not revert or claim unrelated diffs.

## Reminder Findings
- AppleScript listed local Reminders lists but did not include `Personal AI`.
- EventKit fallback found `Personal AI` with 4 items.
- All 4 items are already completed historical Doubao / Weekly Dream Digest / notification sync feedback.
- No open or target-related Reminder item should be marked done.

## External Research Findings
- OpenAI Memory docs emphasize that users can inspect, search, sort, prioritize/deprioritize, restore history, and delete saved memories; memory use should stay visible and user-controllable.
- Claude Code memory docs expose loaded memory files and auto memory as plain editable files, supporting auditability over hidden personalization.
- Notion Enterprise Search documents query-time permission filtering and no sensitive-content caching, supporting scope receipts at search time instead of only after results appear.
- IBM CHI 2025 RAG trust work reports source attribution and document-section transparency improved trust more than confidence scores alone, and users wanted control over source documents.
- A RAG trustworthiness survey frames transparency, accountability, and privacy as core RAG dimensions, reinforcing explicit scope boundaries during retrieval.

## Technical Decision
Add a compact `搜索范围请求中` receipt that appears only when a new scoped search is loading while previously returned cards still exist. It should name the requested scope, the previous visible snapshot scope/count, and the no-write/no-delete/no-sync boundary.

## Resources
- `src/modals/components/SearchResultPage.vue`
- `src/modals/searchResultPresentation.ts`
- `tools/verify-memory-search-results.ts`
- `tools/verify-memory-search-scope-e2e.mjs`
- `docs/features/memory_system.md`
- OpenAI Memory FAQ: https://help.openai.com/en/articles/8590148-memory-faq
- Claude Code memory docs: https://code.claude.com/docs/en/memory
- Notion Enterprise Search security: https://www.notion.com/help/enterprise-search-security-and-privacy-practices
- IBM CHI 2025 RAG transparency paper: https://research.ibm.com/publications/exploring-trust-and-transparency-in-retrieval-augmented-generation-for-domain-experts
- Trustworthiness in RAG survey: https://arxiv.org/html/2409.10102v1
