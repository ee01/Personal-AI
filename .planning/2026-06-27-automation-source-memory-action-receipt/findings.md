# Findings

## Repo

- `docs/progressing/to-verify.md` has no carry-over items.
- `docs/features/memory_capture.md` already documents `writeReceipt`, duplicate-save receipts, distillation receipts, safe source links, and source-memory detail behavior.
- `SourceMemoryCaptureService` already records source-memory events for `saved`, `resaved`, `duplicate_save`, `note_updated`, `dismissed`, and distillation lifecycle events.
- `getCapsule()` currently returns state, metadata, anchors, takeaways, triggers, and `writeReceipt`, but not a user-visible receipt for the latest operation event.
- Source Memory detail shows recall boundary and distillation boundary, but not the last save/update/dismiss operation once the initial toast is gone.

## External Scan

- Notion Web Clipper presents clipping as a visible save-to-workspace flow with destination selection and later editing.
- Mem's clipper markets one-click save plus summarized/organized notes without leaving the page.
- Readwise API supports creating, fetching, and updating highlights, which reinforces that capture APIs need durable create/update state rather than only current item content.
- PIM research stresses saving, maintaining, retrieving, and reusing information across many forms; the practical implication here is to keep purpose and operation state recoverable after capture.
