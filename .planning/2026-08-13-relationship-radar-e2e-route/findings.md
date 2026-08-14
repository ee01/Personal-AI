# Findings & Decisions

## Requirements
- Continue the empty to-verify queue, randomly experience a documented feature, and repair real UX or verification defects with strong proof.
- Preserve the dirty worktree and avoid any real relationship-data writes.

## Research Findings
- Random selection chose Relationship Radar. It is presented through `memory-exploring.html#/entity/Person` and its current user-visible design supplies read-only receipts before any high-responsibility action.
- `npm run verify:relationship-radar` passes 16 server tests.
- `npm run verify:relationship-radar:e2e` times out before the first spotlight assertion. The script intercepts only `http://localhost:3210/api/v1/**`; `.env.development` builds the extension with a different Memory Service base URL, so requests miss the fixture route.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Intercept the `/api/v1/` path in the E2E | Keeps the test independent of developer-specific service addresses and prevents real HTTP use. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Existing E2E does not observe its mocks after dev build | Update its route matcher to follow the bundled service URL. |
| Browser control cannot create or claim Chrome internal/extension tabs | Do not overstate live-page proof; retain fixture E2E as the reproducible user-journey evidence. |

## Resources
-
