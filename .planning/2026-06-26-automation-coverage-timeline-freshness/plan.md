# Coverage Map timeline freshness receipt

## Target

- Random feature: `Memory Coverage Map / 记忆覆盖地图`
- User-facing surface: `memory-exploring.html#/coverage`
- Narrow scope: make the `最近覆盖信号` panel explicit about freshness, empty state, and read-only boundaries.

## External signals

- Microsoft 365 Copilot connectors expose indexed-content validation, connector crawl state, ACL delay, and error report concepts.
- Notion Enterprise Search stresses connector permission sync and source-system access boundaries.
- PIM research supports helping users see where personal information is stored and whether it can be found again.
- Data quality literature treats freshness/timeliness and completeness as separate dimensions; a timeline should not be read as full content quality.

## Plan

1. Add a timeline receipt that states how many `lastSeenAt` events the current Coverage API snapshot returned, whether any event is older than the stale window, and that the panel is read-only.
2. Add an explicit empty state when the timeline is empty, so users do not misread silence as healthy coverage.
3. Update the Coverage Map feature doc to describe the new receipt.
4. Extend the existing Coverage Map E2E fixture to assert both populated and empty timeline behavior.
5. Run targeted E2E, `npm start` first successful compile, scoped whitespace check, and relevant service tests/build if time allows.

