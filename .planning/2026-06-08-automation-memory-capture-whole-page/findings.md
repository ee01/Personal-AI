# Findings

## Repository Context

- `docs/progressing/to-verify.md` currently says `暂无。`; there is no carry-over validation item.
- Automation memory's latest entries cover User Profile, Doubao Bridge, Message Reaction, Topic Messages, Task Scheduler, Notification Center, Coverage Map, Relationship Radar, Compose/Rehearsal, Scheduled Messages, Project Dashboard, and Today Pilot. This run selected a different exact feature: Memory Capture `整页资料保存`.
- The worktree was already broadly dirty before this run. Changes must stay narrowly scoped.

## Reminders

- Local Reminders is accessible.
- Existing lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- There is no `Personal AI` list, so no Reminder item can be merged or marked done in this run.

## Selected Feature Doc

- `docs/features/memory_capture.md` says whole-page save uses right-edge `+ 入库`, an inline review panel, high-confidence auto-save, a compact 5 second toast, hover/focus pause, and undo that dismisses the capsule.
- The doc already emphasizes confirmation, source provenance, user notes, duplicate handling, and `policyReceipt`.

## Implementation Inspection

- `src/contentScriptWebIntelligence.ts` renders the whole-page `+ 入库` chip, review panel, auto-save toast, and undo.
- `memory-service/src/core/SourceMemoryCaptureService.ts` already returns `policyReceipt`, stores `captureMode`, dedupes by fingerprint, refreshes dismissed/duplicate saves, and supports dismiss.
- `desktop-app/scripts/webpage-memory-detection-check.mjs` already covers whole-page review open/cancel/save and source-memory detail navigation.
- Gap: the whole-page review panel shows title, preview, and candidate reasons, but not the source host, memory scope, or that this writes a source-memory capsule plus `web` search signal. The auto-save detail also names the reason but not the source/scope boundary.

## External Research

- Notion Web Clipper asks users where the web page should be saved, preserves the original URL, and allows comments/properties after clipping.
- Readwise Reader saves rendered web content through the browser extension, exposes tags/move destination, and provides document notes for context.
- Keeping Found Things Found and refinding research both emphasize that source address, saved context, and user annotations help people understand why something was kept and find it later.

## Chosen Improvement

Add a compact `保存范围` receipt to the whole-page review panel and auto-save hover detail. It should mention current page/source host, `工作记忆`, and that the save writes source-memory plus `web` search signal.
