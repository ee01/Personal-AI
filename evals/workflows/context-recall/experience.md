# Context Recall Experience Workflow

## Goal

Evaluate whether the shared `/context-recall` path returns memories that are useful in the user's current working context, and whether Scene Memory Autopilot keeps weak memories quiet. This workflow is intentionally product-facing: a mechanically valid response can still fail if the user cannot understand why it is relevant.

## Steps

1. Load the case from `evals/cases/context-recall/real-ringcentral-groups.jsonl`.
2. Collect context from the live page when `--live` is provided; otherwise use the case `sampleContext` snapshot.
3. Build a `POST /api/v1/context-recall` payload with `sourceContext` and `exclude` for the current RingCentral conversation.
4. Save the request and raw response into the run artifact folder.
5. Inspect `autopilot` / `debug.autopilot`: scene anchors, quiet reasons, shown count, hidden count, low-information count, source exclusions, and duplicate merges.
6. Run the heuristic judge and, when configured, the optional external LLM judge.
7. Mark the case as `pass`, `warn`, `fail`, `hide_expected`, or `error`.
8. If the suite fails and `--repair=auto` is set, call the configured agent with the report and allowed paths.

## Pass Criteria

- Top visible memory shares concrete anchors with the current case.
- Strong matches include a user-understandable relevance reason.
- Source-only titles such as "RingCentral 消息" are downgraded.
- No high-confidence result is shown when only generic or banned topics match.
- The response includes an Autopilot summary that explains whether the current scene gets `card`, `chip`, `context_pack`, or `silent`.
- Quieted candidates are attributable to concrete reasons such as low information, source self-echo, weak semantic-only match, off-domain tool context, broadcast without anchor, or duplicate source cluster.

## Report Requirements

- Show the current page or conversation sample that was evaluated.
- Show expected anchors, banned topics, and source/exclude context.
- Show the top visible Memory Lens result, title, source, priority, and relevance reasons.
- Show the Autopilot decision, scene anchors, quiet reasons, hidden/quieted counts, and duplicate merges.
- Show user-facing verdict, score breakdown, and improvement suggestions for recall, title, explanation, or suppression quality.

## Cron Example

```bash
cd /Users/Esone/git/personal-ai && npm run eval:run -- --scheduled --repair=auto
```
