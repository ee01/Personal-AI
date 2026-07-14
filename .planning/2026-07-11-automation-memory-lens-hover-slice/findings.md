# Findings & Decisions

## Requirements
- Randomly choose one feature from `docs/features/index.md`.
- Ensure the feature doc still matches current code at a useful level of detail.
- Search current industry products and research papers for similar functionality.
- Implement low-decision improvements, update docs, and test according to `AGENT.md`.
- Check local Reminders list `Personal AI`; mark related completed ideas done only if used.

## Research Findings
- `docs/progressing/to-verify.md` is empty.
- EventKit found Reminders list `Personal AI` with 4 total items and 0 incomplete items. No Reminder feedback was related to this feature and nothing needs marking done.
- Selected feature: `记忆提示 Hover Peek` under Memory Lens (`docs/features/memory_lens.md`).
- The Memory Lens doc is current for source/freshness/cache semantics. It already says Hover Peek shows provenance, recall basis, and the read-only boundary.
- Code in `src/contentScriptWebIntelligence.ts` already renders Hover Peek footer, recall basis, and read-only boundary, and `tools/verify-webpage-memory-detection.ts` asserts those contracts.
- UX gap: when `matches.length > 1`, Hover Peek still previews only `matches[currentIndex]` without saying it is `1/N` of the visible recall candidates. Expanded Card has pagination, but the first hover state can be misread as the full visible set.
- Industry scan: Slack AI answers include citations and allow hovering citations to preview sources; this supports previewing the exact slice/source rather than hiding source context.
- Industry scan: Notion AI security practices emphasize permission-respecting answers; Memory Lens should keep scope visible when previewing personal/work memories.
- Industry scan: Microsoft Edge Copilot Context Clues distinguishes page-context access and explains when browsing data is used; Memory Lens should likewise explain when the current page recall is current vs cached.
- Research scan: CHI 2025 / IBM RAG trust and transparency work reports that source transparency and user controls matter more than confidence alone; Hover Peek should avoid relying on a single relevance label.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a compact `.pai-context-peek-slice` line | It can sit between provenance footer and recall basis without changing card layout or backend data. |
| Include the same slice in the collapsed bubble receipt | The user can see the slice boundary from hover/focus tooltip before the peek opens. |
| Only show slice text when more than one match is displayable | Single-candidate recall already matches the visible preview. |
| Assert by source-pattern verifier | Existing Memory Lens verifier mostly locks source contracts with deterministic source assertions; this change fits that style. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The repo has broad unrelated dirty state | Keep edits to content script, verifier, docs, planning files, and automation memory only. |

## Resources
- [Slack AI guide](https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack)
- [Notion AI security practices](https://www.notion.com/help/notion-ai-security-practices)
- [Microsoft Edge Copilot Context Clues](https://support.microsoft.com/en-us/microsoft-copilot/how-context-clues-work-copilot-edge)
- [Exploring Trust and Transparency in Retrieval-Augmented Generation for Domain Experts](https://research.ibm.com/publications/exploring-trust-and-transparency-in-retrieval-augmented-generation-for-domain-experts)
