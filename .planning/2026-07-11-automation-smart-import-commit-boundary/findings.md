# Findings & Decisions

## Requirements
- Automation request: randomly pick one `docs/features/index.md` feature, verify docs/code freshness, do industry/paper research, plan first, implement, update docs, test thoroughly, and close related Reminders if any.
- Selected feature: `智能资料录入` under Memory Coverage Map (`docs/features/memory_coverage_map.md`).
- Reminder result: EventKit found `Personal AI` with 4 total items and 0 incomplete items; all completed items are historical Doubao / notification feedback and unrelated to smart import.

## Research Findings
- OpenAI ChatGPT data export and transfer docs show user-controlled exported conversation archives are now a normal AI-memory portability path; import UX should treat uploaded histories as user-selected evidence, not automatically confirmed facts.
- Claude memory import/export docs make memory migration a first-class user flow; this supports keeping import scope and post-import review boundaries visible before commit.
- Notion import docs expose import progress/status, and Notion Enterprise Search / AI connectors emphasize permission-respecting source boundaries.
- Microsoft 365 Copilot connectors distinguish synced indexing, federated retrieval, indexed-content validation, partially indexed items, crawl status, and error reports; Coverage smart import should keep dry-run, partial inspection, commit, and repair paths separate.
- LongMemEval and LongMemEval-V2 separate long-term memory quality into indexing, retrieval, reading, temporal reasoning, updates, and abstention; imported data should remain low-weight source evidence until later recall/promotion gates prove usefulness.
- Opal private memory research highlights privacy/access-pattern risk in personal AI memory stores; smart import should default to explicit user action, low-weight storage, and visible no-egress boundaries.

## Code Findings
- `SmartMemoryImportService` already enforces no write during `/import/inspect`, duplicate source-hash protection, high-risk confirmation, low-weight `manual` shadow memory, and source audit metadata.
- `MemoryCoveragePage.vue` already shows `智能录入范围回执`, duplicate receipt, document recovery receipt, external AI decision/pending receipt, and completion receipt.
- Gap: the shared drawer primary button has no `title` / `aria-label`, so screen readers and hover users do not get the click consequence at the exact control point.
- Gap: external AI imports show a detailed pending receipt while ordinary paste/document/zip commits only show `正在写入 shadow memory...`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a non-external smart-import pending receipt | Mirrors the existing external AI pending pattern for ordinary paste/document/zip commits. |
| Add `primaryImportActionBoundary` as the single source for button `title` / `aria-label` | Avoids scattering copy and keeps label aligned with disabled / busy / backup / duplicate states. |
| Keep backend and storage unchanged | The service already enforces the important write gates. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| AppleScript did not show `Personal AI` | EventKit fallback found it and confirmed there were no incomplete related items. |

## Resources
- https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data
- https://help.openai.com/en/articles/9106926-transfer-exported-conversations-between-chatgpt-accounts
- https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude
- https://www.notion.com/help/import-data-into-notion
- https://www.notion.com/help/enterprise-search
- https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview
- https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/indexed-content
- https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/error-responses
- https://arxiv.org/abs/2410.10813
- https://arxiv.org/html/2605.12493v1
- https://arxiv.org/abs/2604.02522
