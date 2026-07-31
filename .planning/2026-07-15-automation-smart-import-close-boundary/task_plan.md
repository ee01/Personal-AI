# Automation Smart Import Close Boundary

## Target

- Feature: `智能资料录入`
- Capability: Memory Coverage Map
- Docs: `docs/features/memory_coverage_map.md`, `docs/features/index.md`
- UI: `src/modals/components/MemoryCoveragePage.vue`
- Browser proof: `tools/verify-memory-coverage-e2e.mjs`

## Current State

- `docs/progressing/to-verify.md` is empty.
- Randomized index sample picked `智能资料录入` as the first viable non-recent target.
- AppleScript did not list `Personal AI`; EventKit found the list with 4 total items and 0 incomplete items. Existing completed items are historical Doubao / Notification feedback and unrelated to Smart Import.
- The docs are current on dry-run, low-weight shadow memory, high-risk confirmation, duplicate receipts, external AI omissions, backup restore dry-run, and input/source/scope locking.

## External Scan

- [Notion Enterprise Search security & privacy practices](https://www.notion.com/help/enterprise-search-security-and-privacy-practices) emphasizes query-time permissions, permission sync, deletion timelines, progress monitoring, and audit trails for connected knowledge.
- [Microsoft 365 Copilot connector index browser](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/indexed-content) exposes indexed item status, refresh time, properties, ACLs, and user-access checks for troubleshooting.
- [OpenAI ChatGPT data export](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data) is a user-initiated export/import flow for conversation files, matching the product expectation that archived AI history is explicitly selected by the user.
- [Opal: Private Memory for Personal AI](https://arxiv.org/html/2604.02522v1) frames personal AI memory as sensitive long-term data where retrieval/access patterns matter, reinforcing visible boundaries around ingestion and persistence.

## UX Gap

Smart Import already locks source, file picker, scope, and text during dry-run/commit. The close affordances are weaker:

- Top `录入` entry has no hover/reader boundary, so it does not state that it only opens the local drawer.
- Drawer close, cancel, and backdrop click can hide an in-flight dry-run/commit even though the request continues. A user can reasonably misread that as cancellation.

## Plan

1. Add a `smartImportEntryActionBoundary` for the top `录入` button.
2. Add an `importCloseActionBoundary` shared by the `X`, `取消`, and busy backdrop handling.
3. Keep the drawer open while `importBusy` is true; if the user tries to close it, show a status receipt instead of hiding the in-flight request.
4. Update Memory Coverage E2E to assert the entry boundary and busy close/cancel/backdrop behavior.
5. Update docs and index wording to record that close/cancel is locked while dry-run/write is in flight.
6. Verify with targeted backend tests, dev webpack compile, Coverage E2E, and scoped whitespace checks.
