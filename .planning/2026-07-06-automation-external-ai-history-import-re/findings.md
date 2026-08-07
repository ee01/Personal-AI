# External AI History Import Findings

## Requirements
- Start from `docs/index.md`, select one feature, verify docs/code, research comparable products and papers, check Reminders, plan first, implement a bounded improvement, test as completely as practical, and update automation memory.

## Selected Feature
- Feature: `外部 AI 历史基础录入`
- Capability: Memory Coverage Map
- Source doc: `docs/features/memory_coverage_map.md`
- Main UI: `src/modals/components/MemoryCoveragePage.vue`
- Main verifier: `tools/verify-memory-coverage-e2e.mjs`
- Backend contract: `memory-service/src/core/SmartMemoryImportService.ts`, `memory-service/src/routes/import.ts`, `memory-service/src/__tests__/api-smart-import.test.ts`

## Repo Findings
- The doc is broadly current: external AI history import requires user-uploaded ChatGPT / Claude `conversations.json` zip, dry-run first, low-weight `manual` shadow memory on commit, source hash dedupe, and visible truncation / skipped non-text / ignored file stats.
- The UI already has `智能录入范围回执`, `外部 AI 导入范围`, and `提交前会发生什么`.
- UX gap: after clicking `提交录入`, the drawer only showed generic `正在写入 shadow memory...`. During a large external-AI import, the user could not see that the server had not confirmed success yet or which dry-run scope was currently being submitted.
- Low-risk fix: add a pending receipt that appears only during external-AI commit flight and disappears when a success or failure state replaces it.

## Reminder Findings
- AppleScript listed local Reminder lists without `Personal AI`.
- Swift/EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- All 4 were completed historical Doubao / Notification feedback and unrelated to ChatGPT / Claude history import, `conversations.json`, Coverage Map import, source hash, or shadow memory. No Reminder item should be marked done.

## External Reference Findings
- OpenAI Help Center documents ChatGPT data export through Privacy Portal or ChatGPT settings and current availability constraints; exported conversations are a user-requested data copy, not an automatic connector.
- OpenAI's exported-conversation transfer doc says uploading exported conversation files is reference use, not a full account migration or restored sidebar. This supports explicit non-migration copy in Personal AI.
- Anthropic's Claude export doc describes a user-initiated export from Settings > Privacy on web/desktop, again matching an upload-first flow.
- Google Takeout docs frame exports as selected download archives, reinforcing that an archive does not imply automatic restore/import.
- LongMemEval separates indexing, retrieval, and reading for long-term assistant memory, which supports preserving source/truncation metadata before later recall or promotion.
- Data portability research reports practical migration hurdles and control expectations, supporting visible scope, omissions, and pending/success boundaries.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use a front-end pending receipt only | The backend already returns the necessary dry-run and commit data; the gap is presentation during the async commit. |
| Compute pending text from `importInspect.summary` | That is the user's last confirmed dry-run scope and contains conversations, included/total messages, omissions, and source path. |
| Keep external-AI copy separate from generic document import | External chat-history imports carry stronger source/platform/migration assumptions than ordinary documents. |
| Extend existing Coverage E2E | It already covers external AI dry-run, so adding delayed commit proof there avoids a new harness. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Many touched files already dirty | Scoped changes to the selected feature and will report that the worktree had broad pre-existing changes. |
