# Relationship Context Card Item Boundary Findings

## Repository Findings

- Randomized feature sample selected `人脉关系 Context Card` from `docs/features/index.md` after avoiding recent exact/family targets such as Agent Thinking, Ask, Memory scope, Rehearsal, Jira Import, User Profile, Coverage, Topic, and Reflection.
- `docs/progressing/to-verify.md` is empty.
- `docs/features/relationship_radar.md` is generally current for Context Card: it documents default sensitive hiding, context receipt, copy receipt, request/failure receipts, copy/sensitive/evidence button boundaries, stored-card staleness, and validation commands.
- Existing UI already has strong boundaries on copy, sensitive toggle, evidence buttons, request receipts, refresh failure receipts, and copy receipts.
- UX gap: the content items that users inspect before copying a Context Card, especially "现在建议", facts, relationship hints, retrieval boost chips, and do-not-assume notes, are visible but do not carry item-level hover/read-screen boundaries. That leaves a subtle ambiguity: users can read a suggestion or fact as if it were a confirmed action/fact without adjacent no-write/no-send/no-confirmation language.

## Reminder Findings

- AppleScript lists local Reminder lists but does not expose `Personal AI`.
- EventKit read access is granted. It found the `Personal AI` list with 4 total items and 0 incomplete items.
- Existing completed items are historical Doubao / notification / test feedback and unrelated to Relationship Radar Context Card, so this run has no Reminder item to incorporate or mark done.

## External References

- Microsoft Copilot for Sales meeting preparation cards and recap sales insights are source/context-dependent and tied to CRM/Graph matching, supporting explicit source and applicability receipts before using relationship context.
- Salesforce Einstein Relationship Insights and Trailhead docs emphasize recommended relationships plus evidence documents for relationship recommendations, supporting evidence-adjacent relationship suggestions rather than opaque facts.
- Research on AI-mediated communication and smart replies shows AI-suggested relational text can affect social perception and trust, so relationship context should preserve human review and avoid implying automatic sending or confirmation.
- Human-centered XAI surveys and transparency studies support user-facing explanations that match the user's task and decision point, which here is reading/copying per-item relationship context.

## Chosen Improvement

Add item-level boundary helpers to `RelationshipRadarPage.vue`:

- action suggestion cards: state suggestion tone, reason, evidence availability, current privacy scope, and no confirm/write/send/task effects.
- known-fact rows: distinguish confirmed vs pending facts and say viewing the row does not write/reconfirm/reject facts.
- relationship hints: state target, relation type, strength, and no relationship-graph/profile writes.
- retrieval boost chips: state they are copy/context hints only and do not rerun recall/search or alter ranking.
- do-not-assume notes: state the note is a caution guardrail, not a deletion or profile write.
