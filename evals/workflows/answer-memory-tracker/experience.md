# Answer Memory Tracker Workflow

## Goal

Evaluate whether `/api/v1/ask` can silently learn durable answer needs from repeated user questions. The key behavior is bottom-layer accuracy improvement, not a new UI: the Ask answer should still be grounded by current evidence, while the optional `answerMemory` diagnostic shows observation, promotion, and prior reuse.

## Steps

1. Load cases from `evals/cases/answer-memory-tracker/cases.jsonl`.
2. Execute each case's `steps` in order against `/api/v1/ask`.
3. Save every request and raw response into the run artifact folder.
4. Check `answerMemory.state` for the expected progression:
   - first locked, evidenced Ask: `observed`
   - second canonical Ask in the 90-day window: `promoted`
   - later Ask against the same canonical key: `priorHit` or `updated`
5. Reuse the Ask context-gap heuristic on the last response to verify topic lock and evidence grounding still work.

## Pass Criteria

- Each step returns the expected `answerMemory.state`.
- The final response has `contextMatch.state = locked` for the intended topic.
- The final response includes evidence that matches the expected project/role/source anchors.
- The answer does not rely on the prior alone; it still cites or returns current evidence.
- No visible UI-only field is required. `answerMemory` is diagnostic and may be ignored by existing clients.

## Report Requirements

- Show each step's query, supplied context, raw `answerMemory` diagnostic, context match state, answer excerpt, evidence count, and request duration.
- Show the expected diagnostic progression and the actual progression.
- Show whether the final answer still has current evidence and expected topic anchors.
- Make service errors and timeouts explicit; do not present a partial sequence as a successful promotion.

## Run Examples

```bash
cd /Users/Esone/git/personal-ai
npm run eval:run -- --suite answer-memory-tracker --no-repair
EVAL_ASK_TIMEOUT_MS=15000 npm run eval:run -- --suite answer-memory-tracker --no-repair
```
