# Findings & Decisions

## Requirements
- Pick a random feature from `docs/index.md`, avoiding the freshest repeated targets where possible.
- Ensure docs are current enough, scan code for defects or unreasonable UX, and implement low-decision improvements.
- Check local Reminders `Personal AI` list and include related feedback if present.
- Search current products and papers for constructive guidance.
- Plan first, implement step by step, and run focused end-to-end verification.

## Research Findings
- Selected target: `Coverage 质量分` under Memory Coverage Map (`docs/features/memory_coverage_map.md`).
- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory shows the freshest exact targets were self-reflection, action queue, evidence watch, Native Join, Ask, Agent Workflow, Skill Foundry, Slides, Glip, Today, Notification, Scheduled Messages, Rehearsal, and similar trust-receipt surfaces. Coverage quality score is not one of the latest exact targets.
- AppleScript listed Reminder lists without `Personal AI`; EventKit found `Personal AI` with 4 items. All were already completed historical Doubao / Notification feedback and none related to Coverage Map quality score.
- Microsoft 365 Copilot connector docs expose index browser, item status, ACL, error counts, and log download separately; this supports making Coverage's score/sort/error boundaries explicit instead of relying on one opaque score.
- Notion Enterprise Search documents query-time permission filtering and connector permission sync; this supports excluding optional inactive channels from current-fault sorting until they are enabled or fail.
- Data quality literature repeatedly treats completeness, accuracy, timeliness, consistency, and relevance as distinct dimensions; Coverage quality score should keep saying it is a coverage/health score, not content truth or task fitness.
- Personal information management research highlights fragmentation across apps/devices; Coverage Map's value is quickly showing where Personal AI can actually see recent signals.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a `lowScoreSortReceiptItems` computed list | Keeps the receipt data-driven and testable without changing platform sorting logic. |
| Render the receipt only when `platformSortMode === 'lowScore'` | Default mode needs no extra chrome; the receipt appears exactly when the user's action changes ordering. |
| Count active/derived sorted platforms and excluded inactive/system platforms | Makes the current-snapshot slice and exclusion boundary visible. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `planning-with-files` skill path was under `/Users/Esone/.agents/skills`, not `/Users/Esone/.codex/skills` | Read the correct skill file and used an isolated `.planning` directory. |
| `rg scripts ...` returned an error because repo has no `scripts` directory | Continued with direct EventKit probe and target source reads. |

## Resources
- `docs/features/memory_coverage_map.md`
- `src/modals/components/MemoryCoveragePage.vue`
- `tools/verify-memory-coverage-e2e.mjs`
- Microsoft connector indexed content: https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/indexed-content
- Microsoft connector errors: https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/error-responses
- Notion Enterprise Search security/privacy: https://www.notion.com/help/enterprise-search-security-and-privacy-practices
- Data quality overview: https://pmc.ncbi.nlm.nih.gov/articles/PMC9912223/
- Wand and Wang data quality dimensions PDF: https://web.mit.edu/tdqm/www/tdqmpub/WandWangCACMNov96.pdf

## Visual/Browser Findings
- Web scan confirmed current enterprise-search products separate indexing, ACL, error, and refresh semantics; the Coverage UI should do the same for quality-score sorting.
