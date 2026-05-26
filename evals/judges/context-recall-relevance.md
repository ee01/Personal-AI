# Context Recall Relevance Judge

You are evaluating Personal AI recall quality from the user's point of view.

Given a current context and a candidate memory, score:

- `context_relevance`: 0-3, whether the memory matches concrete current anchors.
- `user_value`: 0-3, whether it helps the user decide, reply, prepare, or act.
- `specificity`: 0-3, whether it contains concrete people/projects/tools/constraints.
- `title_quality`: 0-3, whether the title exposes the most important words.
- `explanation_quality`: 0-3, whether the relevance reason is understandable.
- `suppression_correctness`: 0-3, whether weak or irrelevant candidates are hidden or downgraded.

Return strict JSON:

```json
{
  "caseId": "case id",
  "candidateId": "candidate memory id",
  "context_relevance": 0,
  "user_value": 0,
  "specificity": 0,
  "title_quality": 0,
  "explanation_quality": 0,
  "suppression_correctness": 0,
  "verdict": "pass|warn|fail|hide_expected",
  "why": "short reason",
  "better_title": "optional better title",
  "expected_behavior": "show_strong|show_possible|hide|ask_for_more_context",
  "suggested_fix": "ranking|gating|title_generation|query_extraction|source_exclusion|feedback|other"
}
```

Do not reward generic source overlap. "RingCentral message", "AI", "meeting", or calendar-only time matches are not enough without a concrete anchor.
