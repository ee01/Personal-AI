# Findings

## Requirements
- Explain why RCV-141220 is missing on MTR-141170 Backend Progress
- Completely hide Cancelled tickets in BE dates and Design Links

## Research Findings
- Panel cap is `JIRA_CONTEXT_PANEL_ITEM_LIMIT = 5`
- Channel order: linked/story > epic > parent_impact_layer > parent_child
- Parent channels prefer closed/done; `isClosedJiraStatus` treats cancelled as closed
- Screenshot of MTR-141170 shows 5 rows: 2 FIJI impact-layer + RCV-152284 (Cancelled) + RCV-151775 (Cancelled) + RCV-154386
- RCV-141220 is therefore truncated after cancelled tickets take parent_child slots
- Design Links e2e currently asserts UX-100 Cancelled is visible; must change

## Technical Decisions
- Filter by `getUXEpicStatusTone === 'cancelled'` (Cancelled/Canceled/Won't Do/Rejected/Duplicate)
- Filter in `prepareDesignDisplayItems` and `prepareBackendProgressItems` before sort+slice
- Also skip cancelled before detail/DORA fetches
- Keep Closed/Done prefer for remaining tickets
