# Memory Lens Page Recall Receipt Findings

## Local State

- Selected feature: `记忆提示右下角关联记忆` (`Memory Lens`, `docs/features/memory_lens.md`).
- `docs/progressing/to-verify.md` is empty.
- AppleScript did not expose the `Personal AI` Reminders list; EventKit found it with 4 total items and 0 incomplete items.
- The Reminder items are completed historical Doubao / Notification / test feedback, so no open Memory Lens item was incorporated or marked done.
- The worktree had broad unrelated dirty state before this run. Keep edits scoped and do not revert unrelated files.

## Code And UX Findings

- Main passive Memory Lens implementation is `src/contentScriptWebIntelligence.ts`.
- Existing browser-level verifier is `npm run verify:webpage-memory-detection:e2e` via `desktop-app/scripts/webpage-memory-detection-check.mjs`.
- Existing behavior already shows Rest tooltip/ARIA, Hover Peek basis, source status, source-open receipt, site-control receipts, and action-boundary footer.
- UX gap: if a user directly clicks the right-bottom icon, the Expanded Card explains the matched memory but does not show the page/scene signal that triggered the passive recall. The user has to infer it from the page or Hover Peek.
- Proposed fix: show a compact `页面召回回执` in passive Expanded Card with the current context type, page title/host, current-vs-cached basis, and no-write/no-send boundary.

## External Reference Findings

- Chrome `activeTab` frames tab access as temporary and tied to user invocation, supporting explicit current-page scope language: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Microsoft Edge Copilot Context Clues separates current page, open tabs, history, and setting state, supporting visible page-context basis: https://support.microsoft.com/en-us/microsoft-copilot/how-context-clues-work-copilot-edge
- Slack AI search answers include citations to source messages/files, supporting source review on AI memory/search surfaces: https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack
- Notion AI security practices and AI Connectors emphasize honoring existing permissions, supporting permission-bounded recall wording: https://www.notion.com/help/notion-ai-security-practices
- IBM CHI 2025 RAG trust/transparency work found source transparency and user control mattered more than confidence scores alone: https://research.ibm.com/publications/exploring-trust-and-transparency-in-retrieval-augmented-generation-for-domain-experts

## Implementation Notes

- Do not change `/context-recall`, `ContextRecallService`, match selection, Autopilot filtering, feedback APIs, source links, site control storage, or compose/Lens mutual exclusion.
- The receipt should not appear for Selection Memory Search because that variant already has a dedicated selected-text receipt.
