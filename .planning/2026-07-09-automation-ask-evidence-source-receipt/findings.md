# Findings

- `docs/progressing/to-verify.md` is empty, so this run can choose a fresh feature.
- Automation memory shows recent exact runs on Memory Lens, Action Queue, Task Scheduler, Notification Center, backup restore, Jira Import, Today, Storyline, Meeting, Reflection, Watch, and Quick Ask surfaces; Ask was not one of the freshest exact targets.
- AppleScript did not expose `Personal AI`, but EventKit found the `Personal AI` Reminders list with 4 total items and 0 incomplete items. No Reminder item needs to be incorporated or marked done.
- External scan: Slack AI search answers expose citations near answers; Notion Enterprise Search answers cite selected sources; CONQRR/QReCC-style conversational query rewriting research supports making context anchoring explicit; RAG trust/transparency research supports source transparency and user control over opaque confidence-only displays.
- Current Ask UI already has `Ask 本轮状态`, topic-lock, continuation, Evidence Watch, answer-memory, scope, and follow-up receipts. The remaining first-screen gap is that the user does not see a compact evidence-source basis before the answer body.
- Recommended bounded fix: add `Ask 证据来源回执` before the answer body, computed only from the current `askResult.evidence` array.

