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
   - if the live remote DB already has the canonical answer thread before this eval starts, `priorHit` or `updated` is acceptable for earlier steps too, as long as all steps keep the same locked topic and the final answer still has current evidence.
5. When a case defines `expectedAuthorityDecision` or `expectedAuthorityDecisions`, check `answerMemory.authority.decision` as the reason the bottom layer allowed or suppressed an update:
   - `authorized_change`: current authority evidence can create, promote, or update the live answer.
   - `same_meaning_no_change`: same authority evidence and same stance; a wording change should not create a new version.
   - `wait_for_authority_source`: the generated answer tries to flip state without a new authority source.
   - `supporting_only`: the evidence is derived/supporting and cannot rewrite the answer.
6. Reuse the Ask context-gap heuristic on the last response to verify topic lock and evidence grounding still work.

## Pass Criteria

- Each step returns the expected `answerMemory.state`, or an already-learned equivalent (`priorHit` / `updated`) when the canonical thread preexists in live data.
- If configured, each step returns the expected authority decision so the report explains not just what happened, but why the memory layer wrote or refused to write.
- The final response has `contextMatch.state = locked` for the intended topic.
- The final response includes evidence that matches the expected project/role/source anchors.
- The answer does not rely on the prior alone; it still cites or returns current evidence.
- No visible UI-only field is required. `answerMemory` is diagnostic and may be ignored by existing clients.

## Report Requirements

- Show each step's query, supplied context, raw `answerMemory` diagnostic, authority decision, context match state, answer excerpt, evidence count, and request duration.
- Show the expected diagnostic progression and the actual progression.
- Show whether the final answer still has current evidence and expected topic anchors.
- Make service errors and timeouts explicit; do not present a partial sequence as a successful promotion.

## Run Examples

```bash
cd /Users/Esone/git/personal-ai
npm run eval:run -- --suite answer-memory-tracker --no-repair
EVAL_ASK_TIMEOUT_MS=15000 npm run eval:run -- --suite answer-memory-tracker --no-repair
```
