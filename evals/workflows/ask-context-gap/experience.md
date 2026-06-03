# Ask Context Gap Workflow

## Goal

Evaluate whether `/api/v1/ask` can answer a real user-style short question when the user does not paste the relevant ticket, sheet, slide, or message thread. The key product behavior is not just semantic search; Ask should recover the missing context from recent memory and then answer with evidence.

## Latest Memory Basis

The initial cases were generated from a read-only probe of `esone.qiu` memory on `10.32.56.212` on 2026-05-26:

- Recent 7-day memory had `MTR-141852: AI Custom VBG` activity.
- `conversation_context_frames` included an `AI VBG` frame with role `backend` and anchor `MTR-141852`.
- Entity descriptions for the same topic mention `RCV BE` and `new design`.

This makes `AI VBG 的 BE 部分完成情况如何？`, `那个 BE ready 了吗？`, and `那个新 design 定了吗？` good context-loss samples: they are plausible user questions, but the exact project/ticket evidence must come from memory.

## Steps

1. Load cases from `evals/cases/ask-context-gap/cases.jsonl`.
2. Build a `POST /api/v1/ask` payload with `query`, optional minimal `context`, `scope`, and `includeEvidence: true`.
3. Save request and raw response into the run artifact folder.
4. Run the heuristic judge against `contextMatch`, the answer, evidence, structured answer, and blocks.
5. Mark the case as `pass`, `warn`, `fail`, or `error`.
6. If repair is requested, route work to Ask recall/context-expansion paths only.

## Pass Criteria

- The response includes `contextMatch`; for solvable cases it should lock to a recent concrete topic before evidence recall.
- The response hits at least two expected context anchors such as `AI VBG`, `MTR-141852`, `RCV BE`, `backend`, or `new design`.
- At least one expected anchor appears in returned `evidence`, not only in generated answer prose.
- The answer states a useful readiness/completion stance: completed, not completed, unclear, or evidence insufficient.
- The response avoids high-frequency noise such as generic calendar events, RingCentral Video participant captures, token-cost discussions, or unrelated backend frames.

## Report Requirements

- Show the user question, minimal supplied context, memory basis, and the missing-context problem being tested.
- Show the expected extraction: project, role, source anchor, and readiness/status intent.
- Show the actual Ask answer or request error, `contextMatch` state, selected topic, candidate scores/reasons, evidence count, evidence snippets, and structured-answer summary when available.
- Show matched context anchors, matched evidence anchors, banned-topic hits, context-gap recovery scores, verdict, user-facing conclusion, and concrete improvement suggestions.
- Make timeout or service errors explicit instead of rendering a successful-looking report.

## Run Examples

```bash
cd /Users/Esone/git/personal-ai
npm run eval:run -- --suite ask-context-gap --no-repair
EVAL_ASK_TIMEOUT_MS=15000 npm run eval:run -- --case ask-ringcentral-deictic-be-ready --no-repair
```
