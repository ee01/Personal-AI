# Relationship Context Card Freshness Plan

## Target

- Random feature: `人脉关系 Context Card` under `docs/features/relationship_radar.md`.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`.
- Reminder check: local Reminders is readable, but there is no `Personal AI` list, so no Reminder item is incorporated or completed in this run.

## External Signals

- Salesforce Einstein Relationship Insights and Microsoft Dynamics relationship intelligence both keep relationship insights inside the seller workflow and expose recommendations, activity history, and relationship-health context rather than raw contact lists.
- Microsoft Copilot record summaries show summaries in-place and expose related records / suggested actions; this reinforces that Context Card receipts should describe exactly what record/context state is being reused.
- Mixed-initiative context and human-centered XAI research both argue that context should be a manageable object with provenance and user control. For Relationship Radar, the practical product gap is not another review queue; it is making reused context cards honest about whether they now rely on confirmed facts or have newer interactions pending.

## Current Gap

Stored relationship context cards are reused for later `/relationships/context-card` calls. The service updates the top-level surface/token budget before rebuilding markdown, but the stored card's nested `person.dataQuality` / `projectionSource` can remain stale. That means the visible `上下文卡回执` can keep saying `后台整理 · 后台生成` after the user has confirmed a relationship fact, or after newer interactions make the stored card stale.

## Plan

1. Hydrate stored context cards with the current person projection before rebuilding privacy, receipt, and markdown.
2. If a user-confirmed `relationship_context` property was written after the stored card was generated, skip the stored card so the Context Card immediately includes the confirmed fact.
3. Add API assertions for both cases:
   - confirmed relationship context invalidates a generated stored card and appears in the returned card/markdown;
   - newer interaction after consolidation marks a reused stored card as stale and carries the refresh warning.
4. Update `docs/features/relationship_radar.md` with the stored-card freshness behavior.
5. Validate with Relationship Radar API tests, dev compile, Relationship Radar E2E, and `git diff --check`.
