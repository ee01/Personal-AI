# Memory Capture Detail Control Boundaries

## Scope

- Selected feature: `Memory Capture API` in `docs/index.md`.
- Source doc: `docs/features/memory_capture.md`.
- Code surface: `src/modals/components/SourceMemoryDetailPage.vue` and `tools/verify-source-memory-capsule-e2e.mjs`.
- Boundary: presentation/accessibility-only for source-memory detail controls. Do not change candidate scoring, save/note/dismiss APIs, linked `web` signal semantics, distillation, source URL safety, or Memory Service deployment.

## Reminder Check

- AppleScript did not list `Personal AI`.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 open items.
- Existing completed items were historical Doubao / Notification feedback, unrelated to Memory Capture API. No Reminder item was incorporated or marked done.

## External Scan

- Notion Web Clipper keeps clipping as an explicit save flow, asks for destination, then offers `Open in Notion`; it also stores the original URL property for clipped pages.
- Readwise Reader separates manually curated Library saves from Feed content, supports browser-extension saving, and says extension capture is robust because it can access rendered page content rather than only the URL.
- KFTF / PIM research frames web keeping as a user intervention for later refinding, with context, persistence, currency, and reminding as important reasons people choose a keeping method.
- IBM CHI 2025 RAG trust work found that source transparency and user controls improved understanding more than confidence alone.
- RAG trustworthiness survey frames transparency, accountability, and privacy as core RAG concerns; source-memory detail controls should keep these boundaries visible at the exact click point.

## Improvement Plan

1. Add dynamic `title` / `aria-label` boundaries to source-memory detail controls:
   - `打开来源`: new-tab source review only; no memory write, fact confirmation, send, insert, or sync.
   - `查看关联记忆`: read-only jump to the returned linked `web` signal; no rerun, write, restore, send, or sync.
   - Note submit: service-confirmed note / recall-signal / distillation refresh, with pending-state boundary.
   - Note reset: local input reset only.
   - `撤销资料记忆`: removes linked recall signal, but not original page, external system content, or review record.
2. Update the source-memory E2E verifier to assert these control-level boundaries.
3. Update `memory_capture.md` and the index row with concise current behavior.
4. Validate with targeted source-memory API tests, dev compile, source-memory E2E, and scoped diff checks.
