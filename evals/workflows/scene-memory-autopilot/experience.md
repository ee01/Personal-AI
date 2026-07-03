# Scene Memory Autopilot Experience Workflow

## Goal

验证 `/context-recall` 展示前的 Scene Memory Autopilot 是否能减少 Memory Lens 的 review 成本：弱语义、跨域噪音、低信息会议壳和重复来源应该静默；真正展示的强相关候选必须带 `whyRelevant` 场景锚点。

## Steps

1. Load cases from `evals/cases/scene-memory-autopilot/cases.jsonl`.
2. For each case, create an in-memory memory-service DB and insert the case memories/chunks. Cases can mix real snapshots, readable webpage/doc excerpts, and synthetic fixtures; each case should record `sourceProvenance` when the source matters.
3. Run local `ContextRecallService.recall()` with `debug=true`.
4. Judge returned matches, `topMatch`, `displayPriority`, `whyRelevant`, `autopilot.mode`, `quietReasons`, `quietedCount`, and `duplicateMergedCount`.
5. Save raw request/response and produce an HTML report.

## Pass Criteria

- Strong `p1` matches include `whyRelevant` anchors.
- Off-domain or weak semantic-only matches are not returned as visible Lens candidates.
- Empty RingCentral Video shell contexts return `mode=silent` with a concrete quiet reason.
- Same meeting/group/source duplicates are merged and counted in `duplicateMergedCount`; the visible representative can be any member of the merged cluster.
- The report can explain whether the system chose `silent`, `chip`, `card`, or `context_pack`.
- Hidden candidates count as quieted/suppressed for `mustSuppressIds`; the eval should fail only when a forbidden candidate remains visible to Memory Lens.

## Report Requirements

- Show the scene request, source provenance, source provenance audit, and memories being evaluated.
- Show visible matches and top match.
- Show Autopilot decision fields: mode, summary, quiet reasons, quieted/hidden/low-information/source-excluded/duplicate counts, gates, and scene anchors.
- Show user-facing verdict, score breakdown, and improvement suggestions.

## Local Run

```bash
npm run eval:run -- --suite scene-memory-autopilot --no-repair
```
