# Memory Capture Duplicate Receipt Findings

## Requirements

- Pick a random shipped feature from `docs/index.md`.
- Ensure the feature doc matches current code without over-detailing.
- Search current industry products and relevant research before shaping the improvement.
- Implement a low-decision unfinished or UX improvement if available.
- Check local Reminders `Personal AI` items and mark completed related items done when possible.
- Verify as completely as practical under `AGENT.md`.

## Initial Findings

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over item.
- Corrected random pick: `整页资料保存 | Memory Capture | docs/features/memory_capture.md`.
- Local Reminders lists are `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`; there is no visible `Personal AI` list.
- The worktree is already heavily dirty. Current edits should not revert or normalize unrelated prior changes.

## Code And UX Findings

- `docs/features/memory_capture.md` is broadly current for whole-page capture: right-side `+ 记住`, inline review, no-write failures, auto-save toast, inspect/undo, API `writeReceipt`, distillation receipt, and source-memory detail boundary are all documented.
- Main implementation path is `src/contentScriptWebIntelligence.ts`; backend capsule state and write receipts are in `memory-service/src/core/SourceMemoryCaptureService.ts`.
- Existing browser-level verifier is `desktop-app/scripts/webpage-memory-detection-check.mjs`; targeted source checks are in `tools/verify-webpage-memory-detection.ts`; backend API tests are in `memory-service/src/__tests__/api-source-memory.test.ts`.
- UX gap: duplicate saves with no note can show a backend write receipt that says the capsule/search signal is active, but the user-facing current action did not create a new capsule or update content. This is especially confusing for whole-page auto-save because the toast is low-attention and should be precise about what happened.
- Safer fix: use duplicate-specific toast detail text for duplicate/no-note paths. If the duplicate includes a note, keep saying the existing capsule and web signal were updated.

## External Reference Findings

- Notion Web Clipper positions page save as an explicit action with destination and notes/tags, supporting clear post-action receipt wording.
- Readwise Reader's extension saves a readable version into the Reader inbox, reinforcing a "saved document for later" mental model where duplicate and inbox state should be understandable.
- Zotero Connector docs emphasize saving webpages and snapshots as library items users later open; duplicate confusion is harmful because users need to know whether a new item/snapshot was created.
- Keeping Found Things Found research frames saved web information as material users keep for later re-finding; receipts should preserve what changed now and how to recover it later.

## Resources

- https://www.notion.com/web-clipper
- https://docs.readwise.io/reader/docs/faqs/adding-new-content
- https://www.zotero.org/support/adding_items_to_zotero
- https://dl.acm.org/doi/10.1145/502585.502607

