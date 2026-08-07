# Selection Source Memory Save Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `选中文字保存为资料记忆`.
- Feature owner/capability: Memory Capture.
- Source document: `docs/features/memory_capture.md`.
- `docs/progressing/to-verify.md` currently says `暂无`.
- EventKit Reminders check found `Personal AI` with 4 total reminders and 0 incomplete reminders; no local feedback item can be incorporated or marked done.
- The worktree has many unrelated dirty files from prior runs. Treat pre-existing changes as user/automation-owned and do not revert them.

## Code And UX Findings

- `docs/features/memory_capture.md` is current for the selected-text save flow: right-edge `+ 记住`, pre-review no-write receipt, inline review panel, cancel/no-write behavior, failure no-write receipt, successful `writeReceipt`, duplicate receipt, and direct source-memory detail handoff are all documented.
- Source path: `src/contentScriptWebIntelligence.ts` builds selected-text payloads, requests Memory Lens selected-text recall, scores Memory Capture candidates, renders the right-edge selection dock, opens `showSelectedTextCaptureReview()`, and submits through `submitSelectedTextCapture()`.
- Existing E2E path: `desktop-app/scripts/webpage-memory-detection-check.mjs` already covers selected-text dock placement, no-write title/aria, review panel source/scope receipt, cancel no-write, failed save, successful save, source-memory detail handoff, and note refresh.
- UX gap: the selection review panel shows the selected text preview but does not explicitly label it as the exact snapshot that will be saved. Given the note textarea receives focus, users may think save will rescan the current page selection or latest page state. The low-risk fix is a small snapshot receipt in the panel, not a backend change or stricter selection-state model.

## External Reference Findings

- Readwise Reader docs describe the browser extension as both saving full documents and optionally highlighting the open web, with highlight/tag/note actions layered onto the saved reading workflow: https://docs.readwise.io/reader/docs/saving-content and https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes
- Obsidian Web Clipper docs explicitly separate clipping pages from Highlighter mode, where users select important passages or elements before saving: https://obsidian.md/help/web-clipper
- Hypothesis annotation docs require an account to create annotations and expose public/private/group scoping, reinforcing that capture scope and visibility should be explicit: https://web.hypothes.is/help/annotation-basics/ and https://web.hypothes.is/help/annotating-with-groups/
- `Keeping found things found on the web` frames web saving as keeping and re-finding useful information for reuse; the important UX implication is preserving why/what was saved, not only the URL: https://dl.acm.org/doi/10.1145/502585.502607
- IBM/ACM RAG trust/transparency work and the RAG trustworthiness survey both point to source transparency, control, accountability, and privacy as trust dimensions. For Memory Capture, selected-text saves should surface the exact saved snapshot and no-side-effect boundary before users rely on it downstream: https://dl.acm.org/doi/10.1145/3706599.3719985 and https://arxiv.org/html/2409.10102v1
