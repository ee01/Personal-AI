# Ask Receipt Card Boundary Findings

## Initial Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the freshest exact/family targets were Memory scope semantics, Rehearsal management, Jira Import secret create boundary, User Profile action boundaries, Coverage Smart Import, Agent Workflow, Topic Messages, Scheduled Messages, Project Dashboard, Doubao Bridge, Native Join, Notification Center, Message Reaction, Message Analysis, Memory Capture, Relationship Radar, Meeting Pilot, Today Pilot, and Skill Foundry.
- Randomized feature-index sampling surfaced `Ask 主动问答` as the first viable non-recent target.
- Worktree already has broad unrelated dirty state. Keep edits scoped and do not revert unrelated files.

## Code And UX Findings

- `docs/features/ask.md` is current and already describes Ask 本轮状态, 话题锁定, 候选承接, 证据守望, 证据来源, 活答案, 查证/缺口回执, plus verification expectations.
- `src/modals/components/SearchResultPage.vue` renders these Ask receipts before the answer body.
- The detailed active-answer receipt already has dynamic `title` / `aria-label` via `answerMemoryReceiptBoundary`.
- The other top Ask receipt cards use generic static `aria-label` values and no hover title, even though their visible detail already carries important boundaries. This leaves a small but real trust gap for keyboard/screen-reader users and for users hovering the card rather than reading every metric.
- Low-decision implementation slice: add shared dynamic boundary text helpers for Ask status rail, topic lock, continuation, evidence watch, evidence basis, scope, and follow-up receipts; attach them as `title` and `aria-label`; extend the existing Ask E2E to assert these boundaries.

## Reminder Findings

- AppleScript listed local Reminders lists without `Personal AI`.
- EventKit fallback found `Personal AI` with 4 total items and 0 incomplete items.
- Completed items are historical Doubao sync / Notification Center feedback and unrelated to Ask. No Reminder item should be marked done in this run.

## External Reference Findings

- Slack AI search answers appear at the top of search results, use information the user can access in Slack, and include citations that can be hovered or opened. This supports keeping Ask receipts adjacent to the answer body and making hover/reader source boundaries concrete.
- Notion Enterprise Search answers across workspace and connected apps, cites sources, and lets users change search scope. This supports Ask's scope/evidence receipts and making the card itself say whether it is only the current response slice.
- IBM CHI 2025 RAG trust/transparency research found source attribution, highlighted evidence sections, and source-control mechanisms improved trust and understanding more than confidence scores alone. This supports control-point source/scope/side-effect clarity over adding another generic confidence badge.
- Apple Question Rewriting and CONQRR both frame conversational QA as needing ambiguous questions to be reformulated or resolved against context before retrieval. This supports Ask's topic-lock and candidate-continuation receipts, and suggests those receipts should remain inspectable as part of the answer proof.
