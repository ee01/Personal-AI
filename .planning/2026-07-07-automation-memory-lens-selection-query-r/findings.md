# Memory Lens Selection Query Receipt Findings

## Requirements

- Randomly choose one feature from `docs/index.md`.
- Confirm docs are current against code and update concise docs if behavior changes.
- Search comparable industry products and research papers for constructive ideas.
- Inspect local `Personal AI` Reminders and incorporate related open feedback.
- Plan first, then implement fully with the highest practical verification tier from `AGENT.md`.

## Selection And Local State

- Chosen feature: `划词查找关联记忆` (`Memory Lens`, `docs/features/memory_lens.md`).
- `docs/progressing/to-verify.md` is empty.
- EventKit found the `Personal AI` Reminders list: 4 total items, 0 incomplete. Items are completed historical Doubao/Notification/test feedback, not related to Memory Lens selection search.
- AppleScript list enumeration still misses `Personal AI`; EventKit is the reliable source for this run.
- Current worktree has broad unrelated dirty state. Avoid reverting or broad formatting.

## Code And UX Findings

- Implementation is primarily in `src/contentScriptWebIntelligence.ts`.
- Static verifier: `npm run verify:webpage-memory-detection`.
- E2E verifier: `npm run verify:webpage-memory-detection:e2e` / `desktop-app/scripts/webpage-memory-detection-check.mjs`.
- Existing behavior already separates selected-text primary query from page-title/nearby-text background context, blocks secrets and sensitive pages, avoids passive site controls in selection mode, and prevents passive recall from replacing an open selection card.
- Existing E2E already checks high-match, no-match, background-only match, generic Codex noise, same selected text in different paragraphs, selecting Memory Lens UI itself, credential selection, and delayed sensitive-page transitions.
- UX gap: after the user clicks the selection icon, the card says query/background/threshold/safety, but it does not explicitly say the click opened an already matched candidate set and did not trigger another recall or mutation. The E2E asserts this behavior, but the user cannot see it.
- Implemented fix: Selection Memory Search cards now add `打开` and `候选` rows before the existing query/background rows. The rows show already-matched candidate semantics, no second recall, no write/insert/send/external-AI boundary, candidate count/current position, and the selected-text anchor for the current candidate.

## External Reference Findings

- Chrome `activeTab` documentation frames page access as temporary and user-invoked; this supports treating selection search as an explicit user action with a visible scope boundary.
- Microsoft Edge Copilot Context Clues separates prompt, current page, open tabs, history, and settings; this supports keeping selected text as primary query and page context as background.
- Slack AI search answers include citations to source messages/files; Notion Enterprise Search and Notion AI security docs emphasize permission-aware connected-app search.
- CHI EA 2025 RAG trust/transparency work reports that source transparency and user control improve understanding more than confidence alone.
- Constructive idea for this feature: make the selected-text result card expose the click/open semantics and candidate count, not only the query/background semantics.

## Verification Findings

- `node --check desktop-app/scripts/webpage-memory-detection-check.mjs` passed with local nvm Node.
- `npm run verify:webpage-memory-detection` passed.
- `npm start -- --progress` compiled successfully in 14765 ms and was stopped after the first successful compile.
- `npm run verify:webpage-memory-detection:e2e` passed after correcting an assertion to account for the real two-candidate fixture.
- Scoped `git diff --check` passed for owned code/docs/planning files.
- Process cleanup found no remaining webpack watcher, webpage-memory E2E, Playwright, or Chromium process.

## Resources

- `docs/features/memory_lens.md`
- `src/contentScriptWebIntelligence.ts`
- `tools/verify-webpage-memory-detection.ts`
- `desktop-app/scripts/webpage-memory-detection-check.mjs`
- Chrome activeTab docs: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Microsoft Edge Copilot Context Clues: https://support.microsoft.com/en-us/microsoft-copilot/how-context-clues-work-copilot-edge
- Slack AI guide: https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack
- Notion AI security: https://www.notion.com/help/notion-ai-security-practices
- IBM/CHI EA 2025 RAG trust/transparency: https://research.ibm.com/publications/exploring-trust-and-transparency-in-retrieval-augmented-generation-for-domain-experts
