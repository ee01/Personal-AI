# Relationship Context Card copy receipt

## Target

- Feature: `人脉关系 Context Card`
- Doc: `docs/features/relationship_radar.md`
- UI: `src/modals/components/RelationshipRadarPage.vue`
- Verification: `npm run verify:relationship-radar`, `npm start`, `npm run verify:relationship-radar:e2e`

## External signals

- Microsoft Dynamics relationship intelligence and who-knows-whom keep relationship health, relationship evidence, and next steps visible before users act.
- Salesforce Einstein Relationship Insights exposes relationship recommendations with evidence rather than asking users to trust a hidden inference.
- Mixed-initiative / human-centered XAI research supports making context an inspectable object with user-visible bounds before automation or handoff.

## UX gap

The Context Card already shows request, privacy, and refresh-failure receipts. After copying, however, the lasting page state is only the card itself plus a short toast. A user who is about to paste the card into another AI can lose the precise boundary of what was copied: default hidden scope vs sensitive scope vs stale retained snapshot.

## Plan

1. Add a persistent `上下文复制回执` after successful context-copy.
2. Include copied person, snapshot freshness, privacy scope, hidden-sensitive count, content counts, and non-effects.
3. Clear the receipt when a new card request/person switch invalidates the copied snapshot.
4. Update the Relationship Radar E2E to assert stale/default and sensitive copy receipts.
5. Update the feature doc with concise current behavior.
