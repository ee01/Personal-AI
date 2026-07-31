# Ask Conversation Continuity Judge

This suite uses a deterministic heuristic judge because its critical behavior is structural and source-grounded.

Score each case from 0 to 3:

- `continuity_contract`: the receipt is present only when a local resume hint was sent, with exact source/local-only/hint/re-retrieval fields.
- `evidence_refresh`: a resumed Ask returns current evidence and the evidence contains the expected real-memory anchors.
- `topic_alignment`: the answer, evidence, or context match resolves to the expected topic.
- `topic_selection`: when a local topic hint is present, `contextMatch.selectedTopic.label` itself matches the expected resumed topic.
- `context_isolation`: no banned prior topic leaks into a clean new question, and no unexpected receipt appears.
- `answer_quality`: the endpoint returns a readable answer rather than only metadata.

Hard pass requirements:

- Receipt presence matches the request.
- Every expected receipt field is exact.
- Cases marked `requireFreshEvidence` have grounded evidence.
- Expected topic hit count reaches the case threshold.
- Cases with `expectedSelectedTopics` lock the selected topic itself to one of those labels; related evidence elsewhere is not enough.
- No `mustNotReturnTopics` anchor appears.
- The answer is non-empty.

The previous answer summary may help disambiguate retrieval but must never count as evidence. Database non-persistence is judged by the API route test, not inferred from an HTTP response.
