# Jira Design Links Updated-Time Basis Plan

## Target

- Random feature: `设计链接更新时间展示` under Jira Design Links.
- Goal: make the visible `Updated YYYY-MM-DD` tag explain its metadata basis without adding a heavy summary header or changing link detection.

## Plan

1. Keep existing latest-date, missing-date, filtered-link, and read-only recovery behavior unchanged.
2. Add a compact chip beside visible updated dates: status time/date, object time/date, remote-link time/date, or metadata time/date.
3. Keep the chip read-only: it only explains timestamp provenance and does not refresh Figma, edit Jira, or confirm review.
4. Update targeted verifier and Playwright extension E2E to assert the visible chip and boundary tooltip.
5. Update the feature doc and index row with the new timestamp-basis behavior and current reference scan.

## External Scan

- Figma for Jira exposes real-time design status and linked design update context inside Jira.
- Atlassian Automation has separate design triggers for linked design updates and linked design status changes.
- Jira JQL supports design search properties including `design[lastUpdated]`, so update timestamps are an explicit searchable design signal.
- Recent traceability reviews emphasize that artifact links and auxiliary metadata need role-readable provenance because automated recovery and source evidence can be fragmented.
