# Memory Capture Receipt Path Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `记忆捕捉`.
- Capability: Memory Capture.
- Source document: `docs/features/memory_capture.md`.
- `docs/progressing/to-verify.md`: `暂无。`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no reminder-derived items can be included or completed.
- The worktree is broadly dirty from prior runs. Treat pre-existing changes as user/automation-owned.

## Code And UX Findings

- `docs/features/memory_capture.md` is mostly current for the latest selected-text dock, whole-page review, visual evidence, policy receipt, duplicate-note refresh, source-memory card, and source URL privacy behavior.
- Whole-page review already renders `formatMemoryCaptureSourceBoundaryReceipt(...)`, but selected-text review only shows the selected text and candidate reasons. Users do not see before saving that selection capture writes both a source-memory capsule and a `web` search signal.
- Selected-text, whole-page, and visual manual save failures currently expose raw `保存失败` messages. They do not explicitly say that no source-memory capsule or web/visual search signal was created, and they do not turn the preserved retry entry into a user-readable recovery path.
- Existing `desktop-app/scripts/webpage-memory-detection-check.mjs` already covers selected-text save, cancel, success detail deep link, whole-page review, cancel, site-control suppression, and success, so the improvement can be verified by extending that E2E rather than adding a new harness.

## External Reference Findings

- Notion Web Clipper, Readwise Reader, Zotero Connector, and Obsidian Web Clipper all center the save action around explicit capture into a chosen library/inbox/vault with source metadata or later reading/editing. This supports exposing the write destination before confirmation, not only after success.
- Zotero's connector docs emphasize saving from the primary source page to retain richer metadata and snapshots/PDFs when possible. This maps to Memory Capture's need to preserve source URL/title and explain source-memory plus web-search side effects.
- PIM / Keeping Found Things Found research frames saving as a future re-finding act. A failed save should therefore not be a generic error; it should preserve the user's mental model of what was not stored and how to retry.
- Trigger-action debugging research shows end users need observable cause/effect and recovery when automation-like actions fail. Memory Capture write failures should name the no-write boundary and next action rather than merely surfacing a transport error.
