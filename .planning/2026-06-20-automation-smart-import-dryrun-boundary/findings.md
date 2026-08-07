# Smart Import Dry-run Boundary Findings

## Initial Context

- `AGENT.md` requires targeted validation plus `npm start` first successful compile after runtime source changes.
- `docs/progressing/to-verify.md` currently has no pending items.
- Automation memory shows recent runs covered Jira Design Links, Notification Center digest, Outreach Sessions, Memory Search safety jump, Today Pilot meeting prep, Reflection Threads, Prompt Config, User Profile, Ask, Dream Replay, Message Analysis, Message Reaction, Task Scheduler, Agent Workflow, Native Join, Memory Capture, and Decision Center.
- Random selection chose `智能资料录入` from `docs/index.md`.
- Reminders list names are visible, but there is no list named `Personal AI`.

## Research Notes

- OpenAI's ChatGPT export flow and transfer guidance revolve around a user-requested zip containing `conversations.json` plus other files, so Personal AI should not imply automatic platform sync when reading those archives.
- Anthropic Claude export is also user-initiated from Settings / Privacy and returns chat history for the user to download; this reinforces an explicit uploaded-source boundary.
- Notion's import help calls out source file formats and splitting large CSVs to reduce errors, which matches keeping ordinary zip inspection limits visible.
- 2024 data-portability user research reports that inspecting exported personal data can improve privacy attitudes, but migration is still limited by usability and scope. For Smart Import, that argues for a visible preview boundary before write.
- POPETS GDPR data-portability analysis highlights that transfer between services is not automatically effective just because export exists; the UI should distinguish readable export, previewed import, and committed Personal AI memory.

## Code Notes

- `SmartMemoryImportService.inspect()` parses text/files/zips, returns ready/blocked/duplicate/backup status, and does not write `messages_raw` rows.
- `SmartMemoryImportService.commit()` reparses, dedupes by committed source hash, requires `confirmHighRisk` for high-risk content, then writes `memory_import_batches`, `messages_raw`, `chunks`, and low-weight `memory_metadata`.
- `MemoryCoveragePage.vue` already has post-dry-run warnings, external-AI decision receipts, duplicate receipts, backup restore target receipts, high-risk confirmation, and post-commit receipts.
- UX gap: before clicking `查看 dry-run`, the first visible row is a generic dropzone hint/status rather than a structured receipt that says the next action is read-only and that commit writes only ready entries as low-weight shadow memory.
