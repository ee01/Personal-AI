# Relationship Radar Route Receipt

## Target

- Random feature: `人脉关系人物雷达`
- Source doc: `docs/features/relationship_radar.md`
- UI entry: `memory-exploring.html#/entity/Person`

## Research Notes

- Microsoft Dynamics 365 relationship intelligence foregrounds relationship health and who-knows-whom so users can decide which customer relationships need attention: https://learn.microsoft.com/en-us/dynamics365/sales/enable-ri
- Affinity relationship intelligence uses recency/frequency relationship strength and follow-up triggers to prioritize relationship maintenance: https://www.affinity.co/product/relationship-intelligence
- Salesforce Einstein Relationship Insights combines page-local evidence, relationship maps, and explicit CRM update actions: https://www.salesforce.com/news/stories/salesforces-new-ai-agent-identifies-business-connections-to-build-relationships-for-salespeople/
- AI-mediated communication and LLM transparency research point to showing AI involvement, uncertainty, and agency boundaries before communication actions.

## Plan

1. Add a first-visible Relationship Radar route receipt above the people cards.
2. Include current filter scope, spotlight priority reason, data quality mix, and pending review count.
3. State the exact action boundary: viewing/searching/filtering/copy readiness is read-only; consolidation refresh only writes radar projections/context cards; profile writes require Review Queue confirmation.
4. Update the feature doc and feature index.
5. Extend the existing Relationship Radar E2E to assert the receipt on initial load and after person search.

## Validation

- `npm run verify:relationship-radar`
- `npm start` first successful compile, then stop watcher
- `npm run verify:relationship-radar:e2e`
- scoped `git diff --check`
