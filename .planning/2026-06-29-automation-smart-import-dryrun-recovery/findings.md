# Smart Import Dry-Run Recovery Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `智能资料录入`.
- Capability: Memory Coverage Map.
- Source document: `docs/features/memory_coverage_map.md`.
- Local Reminders lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be incorporated in this run.
- Recent automation memory covered User Profile, notification snooze, Decision Center, Doubao/ChatGPT Explorer, Project Dashboard search, Memory Capture whole-page, Relationship Radar Context Card, Topic Messages empty batch, Google Slides skipped rows, and other nearby receipt surfaces. This run should avoid those exact slices.

## Code And UX Findings

- `docs/features/memory_coverage_map.md` is current for the selected feature at a useful level. It already covers mandatory dry-run, no write on inspect, blocked/unsupported entries, high-risk confirmation, source-hash dedupe, external AI history path/limits, and backup zip restore switching.
- Main UI path: `src/modals/components/MemoryCoveragePage.vue`. The drawer already shows `智能录入范围回执`, high-risk confirmation, duplicate receipts, document precheck counts, external AI decision receipts, backup target receipts, and final import receipts.
- Backend path: `memory-service/src/core/SmartMemoryImportService.ts` and `memory-service/src/routes/import.ts`. The service parses text/document/pdf/ordinary zip/external AI/backup zip; commit re-parses, dedupes by `sourceHash`, rejects backup zips, rejects empty ready sets, and requires `confirmHighRisk` when high-risk signals are present.
- Existing proof path: `memory-service/src/__tests__/api-smart-import.test.ts` plus `tools/verify-memory-coverage-e2e.mjs`; package script `verify:memory-coverage:e2e` drives the extension page against mocked Coverage/import APIs.
- UX gap: ordinary document/zip dry-run currently gives counts in `资料预检回执` and lists the first entries, but it does not provide an explicit next-step/recovery receipt after omissions. Users can see “2 blocked / 5 uninspected” but must infer that submitting now writes only ready entries, and that the fix is to split the archive or correct unsupported/empty files and rerun dry-run.
- Low-risk fix: add a `资料录入恢复回执` only for non-backup, non-external-AI inspections. It should name the commit-now scope, the no-write boundary for blocked/uninspected entries, and recovery actions. No service contract change is needed.

## External Reference Findings

- OpenAI ChatGPT export docs show exported data is user-requested and delivered as a downloadable ZIP; exports can take time and links expire, supporting a user-controlled import flow rather than background scraping: https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data
- OpenAI's exported-conversation transfer doc says uploaded export files are only used as reference in a new conversation and do not recreate old chat history, settings, memories, GPTs, files, or workspace access. This supports keeping Personal AI imports as shadow memory with explicit non-migration boundaries: https://help.openai.com/en/articles/9106926-transfer-exported-conversations-between-chatgpt-accounts
- Claude's memory help says memory import/export is experimental and intended for backup/migration, while file upload docs list supported formats and limits. This supports showing accepted formats, limits, and omissions before commit: https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context and https://support.claude.com/en/articles/8241126-upload-files-to-claude
- Microsoft 365 Copilot connector troubleshooting distinguishes missing indexed items, transient failures, service availability, and operation status. For smart import, the analogous UI should distinguish ready, blocked, uninspected, duplicate, and actually committed items: https://learn.microsoft.com/en-us/graph/custom-connector-sdk-troubleshooting
- Notion import/export docs emphasize supported import formats, splitting large CSVs, ZIP exports, and lossy/cleanup-prone migrations. This supports giving a recovery path for oversized or partially supported archives: https://www.notion.com/help/import-data-into-notion and https://www.notion.com/help/export-your-content
- LongMemEval frames long-term memory quality as indexing, retrieval, and reading stages, not just successful upload. LongMemEval-V2 adds environment gotchas and premise awareness. This supports storing imports as low-weight evidence first, then letting later retrieval/promotion decide usefulness: https://arxiv.org/abs/2410.10813 and https://arxiv.org/abs/2605.12493
- PIM work by William Jones highlights fragmented personal information and the need for the right information in the right form and completeness. Coverage Map's role is to make coverage and omissions visible before users trust the memory layer: https://digital.lib.washington.edu/server/api/core/bitstreams/1842f30b-1e59-4637-bf46-28407323424a/content
