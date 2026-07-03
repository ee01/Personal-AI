# Ask Candidate Follow-up Locale Findings

## Initial Findings

- `docs/progressing/to-verify.md` says `暂无。`; no carry-over item blocks a fresh feature selection.
- Recent automation memory covered Project Dashboard, User Profile, Native Join, Memory Timeline, Agent Thinking, Topic Messages, Agent Workflow, Rehearsal, Doubao, Action Queue, Coverage, Relationship Radar, Scheduled Messages, and Task Scheduler. The run skipped the first random hit because it was Rehearsal-adjacent, then selected Ask short-question topic locking.
- Reminder list scan returned `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; no `Personal AI` list is visible.
- The worktree is broadly dirty. Keep edits scoped to Ask code/tests/docs plus this planning folder.

## Code And UX Findings

- `docs/features/ask.md` is mostly current: it describes contextMatch topic locking, ambiguous-topic clarification, candidate buttons in Quick Ask, answer memory receipts, and stream behavior.
- Server implementation in `memory-service/src/routes/ask.ts` resolves numeric Chinese follow-up replies (`2`, `选 2`, `第二个`) by parsing the previous assistant answer's `候选话题：` block from `userContext`.
- Desktop Quick Ask already renders structured `.ask-candidate-choice` buttons from `contextMatch.candidates`, sends the numeric candidate index as the actual query, and displays `选择话题：<label>` to the user.
- Gap: service-side follow-up recovery is tied to the Chinese marker `候选话题：`. If a caller stores an English candidate block such as `Candidate topics:` or a user replies `candidate 2`, the selection can be missed and the service may treat the reply as a new Ask rather than continuing the clarified topic.

## External Reference Findings

- ChatGPT and Claude memory/product docs emphasize visible source and memory boundaries, so Ask should keep clarification visible and reversible rather than silently guessing among close topics.
- Raycast-style quick AI surfaces support short follow-ups, which fits candidate-number continuation instead of forcing a full restated query.
- Conversational query rewriting research such as QReCC and CONQRR supports resolving context-dependent short turns into standalone retrieval queries before search.
- The constructive direction is not a new page; it is a more robust conversation-turn contract around candidate lists and follow-up selection.
