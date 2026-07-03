# Source Memory Distiller Policy Receipt Findings

## Initial Context

- Selected feature from `docs/features/index.md`: `Source Memory 蒸馏器`.
- Feature owner/capability: Memory Capture.
- Source document: `docs/features/memory_capture.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has many unrelated dirty files from prior work. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/memory_capture.md` is current about the backend distillation contract: saved or note-updated capsules get `metadata.distillation` with `oneLineCue`, `compactMemo`, `policyReceipt`, source reliability, downstream use, input hash, evidence anchors, and ready / partial / blocked status.
- Current backend implementation in `memory-service/src/core/SourceMemoryCaptureService.ts` already builds the deterministic distillation receipt, updates takeaway status, enriches trigger matchers, writes low-side-effect `source_memory_links`, and records `distillation_started` plus terminal events.
- Current API coverage in `memory-service/src/__tests__/api-source-memory.test.ts` already asserts ready distillation metadata and context recall metadata.
- Current Source Memory detail UI shows saved/dismissed recall boundaries, evidence anchors, draft takeaways, future triggers, and source-link safety, but does not expose `metadata.distillation.policyReceipt`, `compactMemo`, source reliability, or downstream allowed/blocked uses. Users cannot tell from the detail page whether a capsule is ready, partial, or blocked, nor what the distillation is allowed to feed.
- Low-decision implementation slice: add a first-screen `资料蒸馏回执` panel to `src/modals/components/SourceMemoryDetailPage.vue` and extend `tools/verify-source-memory-capsule-e2e.mjs` fixture/assertions.

## External Reference Findings

- Readwise Reader's browser extension saves rendered article content rather than only a URL, and exposes document notes for the context of why a document was saved. This supports showing the distillation result next to the source detail, not hiding it in metadata.
- Obsidian Web Clipper supports page capture, highlighting, templates, variables, filters, and local-vault privacy. This supports explicit source metadata and local/non-external boundary copy in the detail view.
- NotebookLM source management separates selecting/importing sources from using them in generated outputs, shows source summaries, and states inaccessible sources will not be referenced. This supports separating source capsule saved state from downstream eligibility.
- PIM / KFTF research frames keeping information as organizing it for later need, repeated reuse, privacy, and maintenance. The detail page should therefore explain what the saved source can be reused for and what it will not do automatically.
