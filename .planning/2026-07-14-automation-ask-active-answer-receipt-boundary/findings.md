# Ask Active Answer Receipt Boundary Findings

## Repo And Reminder Findings

- `docs/progressing/to-verify.md` is empty.
- Randomized eligible candidates from `docs/index.md` included `Ask 活答案记忆`; it was selected after avoiding the freshest exact targets from automation memory such as Topic source links, User Profile influence controls, Reflection research controls, Coverage quality score, Meeting ASR, Snooze, Timeline, Skill Foundry, Relationship Radar, Message Analysis, Memory Capture, Jira Import, Scheduled Messages, Today Pilot, and AR Data.
- The worktree is broadly dirty from prior automation/user work. This run should own only the Ask/Search Result files, Ask docs/index rows, planning directory, `.planning/.active_plan`, and automation memory.
- AppleScript listed Reminder lists but not `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items. No open Reminder feedback relates to Ask active answers.

## Code And UX Findings

- `memory-service/src/core/AnswerMemoryService.ts` already carries `lastVerifiedAt` / `staleAfter` in `answerMemory.receipt` and distinguishes `priorHit`, `updated`, `promoted`, `observed`, `no_evidence`, and AuthorityGate decisions.
- `src/modals/components/SearchResultPage.vue` already renders `Ask 本轮状态`, `Ask 话题锁定回执`, `Ask 证据来源回执`, `Ask 证据守望回执`, and the visible active-answer receipt metrics.
- Gap: the detailed active-answer receipt card has visible text and `role="note"`, but no dedicated `aria-label` or hover `title`. Other Ask receipts expose named labels, so the active-answer card itself is weaker as an accessibility/control point.
- Low-decision fix: derive one compact boundary string from the active-answer receipt, AuthorityGate view, and review-time metrics, then bind it to the receipt card `title` and `aria-label`.
- Expected behavior remains presentation-only: no backend writes, no answer memory state changes, no external action execution, no Memory Service deployment.

## External Reference Findings

- OpenAI Memory FAQ says Memory Sources show which information informed a personalized response and let users view/edit/delete or mark relevance; it also notes sources may not show every factor. This supports clear answer-adjacent memory provenance without overclaiming full coverage.
- Slack AI search places AI answers at the top of search results and includes citations to source messages/files, with hover/click review. This supports keeping source/receipt boundaries near the answer and accessible through hover/read-screen affordances.
- Notion Enterprise Search always cites workspace/connected-app sources and lets users change the search scope. This supports visible scope/source boundaries for personal-memory answers.
- Claude chat search/memory exposes prior-chat search as tool calls and preserves project/search boundaries. This supports showing when past context is being used, not silently blending it into the answer.
- STALE (arXiv:2605.06527, submitted 2026-05-07) identifies stale personalized memories and implicit conflicts as a major failure mode; the paper reports a gap between retrieving updated evidence and acting on it. This supports explicit state-adjudication receipts like current evidence vs old prior and AuthorityGate outcome.

