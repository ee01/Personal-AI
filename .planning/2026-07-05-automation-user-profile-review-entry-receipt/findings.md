# User Profile Review Entry Receipt Findings

## Selection And Reminder State

- `docs/progressing/to-verify.md` says `暂无`, so this run uses a fresh random feature from `docs/index.md`.
- The random sample included several very recent families such as Project Dashboard, Message Analysis, Meeting Pilot, Memory Timeline, Watch, Memory Capture, Jira Design Links, Prompt Config, Topic, Storyline, Jira Automation, and Compose Assist. I selected `画像快速增强/降低影响` because it is narrow, user-visible, and less fresh.
- AppleScript listed Reminders without `Personal AI`, but EventKit found `Personal AI` with 4 items. All 4 were already completed historical Doubao / Notification feedback items, none related to User Profile, profile calibration, memory personalization, or influence weighting.

## Code And UX Findings

- `docs/features/user_profile_system.md` is current for quick influence calibration: boost and star calibration may confirm a profile item; lowering influence does not auto-confirm pending items; partial update/confirm failures are surfaced.
- `src/modals/components/UserProfilePage.vue` already has profile calibration receipts, pending states, evidence receipts, export receipts, and action-impact receipts.
- Existing E2E coverage in `tools/verify-user-profile-export-e2e.mjs` asserts boost success, pending-state retention, partial confirm failure, update failure, lower-without-confirm, lower confirmed, retract, restore, retracted audit, and export receipts.
- Gap: the first-screen health cards (`处理`, `查看`, `核对`) only scroll to sections. They do not say whether the counts are from the current loaded slice, whether a filter was applied, or that navigation itself has no profile write/export/provider side effect.
- Low-decision implementation slice: add a `校准入口回执` when those cards are clicked; for `处理`, set the review queue filter to pending; for `查看`, reset item filters to all/priority; for `核对`, apply the `withoutEvidence` item filter.

## External Reference Findings

- OpenAI ChatGPT memory controls expose on/off, manage/delete, prioritization/deprioritization, search/sort, and restore history. This supports making "priority" and "not top of mind" state explicit before users infer a profile item is permanently changed.
- Gemini memory controls let users turn memory on/off, ask whether past chats were used, and require deleting both chats and connected-app data in some cases. This supports visible source/scope boundaries for calibration navigation.
- Claude memory import/export shows memory as editable/migratable, experimental in import, and focused on work-related details. This supports receipts that distinguish local inspection from actual durable memory edits.
- Microsoft Research's RUMS paper argues memory selection should use response utility rather than query similarity alone. For User Profile, the actionable UX implication is to avoid treating "high weight" or "current slice" as proof a profile item will always enter context.
- The ACL 2026 PAMU paper argues preference memory should adapt to abrupt and gradual user preference changes. For this feature, quick lowering/boosting should keep pending vs confirmed and write-completion state visible.
