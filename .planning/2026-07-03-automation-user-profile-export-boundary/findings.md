# Findings & Decisions

## Requirements
- Recurring automation asks for a random docs/features target, code/doc freshness check, external product/paper scan, Reminder check, plan-first implementation, and as-complete-as-practical verification.
- Repository rule requires AGENT.md validation policy: runtime source changes need targeted verification plus npm start first successful compile; user-visible extension changes should get E2E where practical.
- Selected feature: `用户画像导出` in `docs/features/user_profile_system.md`.

## Research Findings
- Reminders: AppleScript listed local Reminders without `Personal AI`; EventKit fallback found `Personal AI` with 4 items, all completed historical Doubao/digest/test feedback. No open or feature-related Reminder item was incorporated.
- Current docs already say export re-fetches `status=all`, writes JSON + manifest, includes inactive audit items, downgrades diagnostics to warnings, and has no restore/delete/sync/send side effect.
- Current E2E already covers preflight, paginated `status=all` export, manifest fingerprint, partial diagnostics warnings, export request failure, explicit profile creation, influence calibration, confirm/retract/restore paths.
- UX gap: after generating a Blob and calling an anchor download, the page says `画像已导出` / `下载完成后` language even though the UI can only know that the export file was generated and the browser download was requested. It cannot verify that the user saved the file to disk or did not cancel/block the download.
- OpenAI's ChatGPT export flow separates requesting data, readiness notification, and the later download link; this supports avoiding overclaiming local possession.
- Claude memory import/export is explicitly backup/migration-oriented and lets users review memory edits after import; this supports keeping backup/export distinct from import/restore.
- Google Takeout separates archive creation from delivery/download method and warns that exports may not include changes after the request point; this supports snapshot and delivery-boundary wording.
- Portable Agent Memory proposes JSON-first memory serialization with provenance and integrity checks; this aligns with Personal AI's manifest/fingerprint design.
- Privacy-control walkthrough research observes that platforms expose different controllable data units for chat history, memory, and customization objects; this reinforces making export scope and unit boundaries explicit.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Change receipt/status wording from completed export to generated/download-requested | Matches what the browser page can actually prove after Blob generation and anchor click. |
| Preserve export JSON schema and manifest version | This is a UX trust correction, not a portability contract change. |
| Add E2E assertions for browser-download requested / disk-save unverified copy | Prevents regression back to overclaiming successful local save. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| AppleScript list scan missed `Personal AI` | EventKit fallback provided the decisive local Reminder state. |
| Current worktree is broadly dirty | Keep ownership scoped to User Profile export files plus this planning folder and automation memory. |

## Resources
- https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data
- https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude
- https://support.google.com/accounts/answer/3024190
- https://arxiv.org/abs/2605.11032
- https://arxiv.org/html/2602.10684v1
