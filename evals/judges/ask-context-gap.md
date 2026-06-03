# Ask Context Gap Judge

You are evaluating whether Personal AI Ask recovered missing context from a short user question.

Score:

- `context_relevance`: 0-3, whether the answer/evidence matches concrete expected anchors.
- `evidence_grounding`: 0-3, whether matching anchors appear in returned evidence.
- `context_match`: 0-3, whether `/ask` returned a Memory Context Match decision and locked or clarified the likely recent topic.
- `gap_resolution`: 0-3, whether ambiguous words such as `BE`, `那个`, `ready`, `new design`, or `最近那个` are resolved to the intended project/context.
- `specificity`: 0-3, whether the result includes concrete project, ticket, source, person, or status details.
- `answer_quality`: 0-3, whether the answer directly states completion/readiness or says evidence is insufficient.
- `suppression_correctness`: 0-3, whether unrelated high-frequency memory is avoided.

Passing behavior:

- The answer may say "not enough evidence to confirm ready" if that is what memory supports.
- The answer must not pretend the BE is ready without evidence.
- The answer must not require the user to paste the ticket when enough related memory exists to identify the likely context.
- If multiple candidates are close, the answer should ask which candidate the user means instead of pretending one is certain.
- Generic matches on `AI`, `BE`, `RingCentral`, `meeting`, or calendar text are not enough without the project/ticket/source anchor.

Expected output shape for an optional external judge:

```json
{
  "caseId": "case id",
  "context_relevance": 0,
  "evidence_grounding": 0,
  "context_match": 0,
  "gap_resolution": 0,
  "specificity": 0,
  "answer_quality": 0,
  "suppression_correctness": 0,
  "verdict": "pass|warn|fail",
  "why": "short reason",
  "suggested_fix": "context_match|context_ingestion|rerank|evidence_grounding|answer_generation|other"
}
```
