# Findings & Decisions

## Requirements
- User asked for a random feature sweep from `docs/index.md`: verify docs vs code, research comparable products/papers, inspect Reminders, plan first, implement, update docs, and run the strongest practical validation.
- `docs/progressing/to-verify.md` says there is no carry-over work.
- Worktree is broadly dirty from prior automation/user work; this run should only own Memory Coverage backup button boundaries, docs/index updates, planning files, and automation memory.

## Research Findings
- Selected feature: `记忆导入/导出/备份` under Memory Service, source doc `docs/memory_system.md`.
- Reminder findings: AppleScript listed local Reminder lists but missed `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items. No Reminder feedback applies or should be marked done.
- Current docs accurately describe `/export`, `/import`, manifest size/SHA checks, dry-run, merge/replace, cross-user confirmation, and Coverage failure receipts.
- Current Memory Coverage UI already shows pre-action, pending, success, failure, dry-run, write confirmation, restore failure, and post-restore receipts.
- UX gap: the top-level `记忆备份` button and drawer `备份 zip` mode button do not carry `title` / `aria-label` boundary copy, so the exact click consequence is less visible to keyboard/screen-reader users and hover users than surrounding receipts.
- OpenAI ChatGPT data export is a Data Controls action with explicit confirmation and delayed download, reinforcing that export is a request for a copy, not a restore/write action.
- Google Takeout lets users choose included data and creates a downloadable archive; Google's third-party copy flow explicitly says it creates a copy, does not delete original data, and the user controls scope and duration.
- GDPR Article 20 frames portability around structured, commonly used, machine-readable personal data transfer where technically feasible; this supports manifest-backed backup ZIPs with machine-checkable fingerprints.
- CHI 2025 data-loss recovery research reports many users recover from outdated/incomplete backups; this supports making backup freshness, archive fingerprint, and preview-vs-write boundaries visible at control points.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add computed copy rather than hard-coded strings in markup | The backup button state changes between idle and exporting; the drawer button depends on selected mode and detected backup state. |
| Reuse existing E2E fixture | `tools/verify-memory-coverage-e2e.mjs` already covers export, ordinary import, backup zip dry-run, replace confirmation, and restore receipts. |
| No backend changes | The server already returns manifest headers, archive SHA, dry-run/import receipts, and validation errors. |
| No Reminder completion | There are no incomplete Reminder items. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Root `task_plan.md` is stale from a June Scheduled Messages run | Created `.planning/2026-07-12-memory-backup-button-boundaries/` and set it active. |

## Resources
- OpenAI Help: https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data
- Google Account Help: https://support.google.com/accounts/answer/3024190
- Google third-party data copy help: https://support.google.com/accounts/answer/14452558
- GDPR Article 20: https://gdpr.eu/article-20-right-to-data-portability/
- CHI 2025 paper entry: https://dl.acm.org/doi/10.1145/3706598.3714202
