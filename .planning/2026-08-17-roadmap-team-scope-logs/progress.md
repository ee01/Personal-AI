# Progress Log

## Session: 2026-08-17

### Current Status
- **Phase:** 5 - Delivery
- **Started:** 2026-08-17

### Actions Taken
- Confirmed activity API is per-team; team catalog was global
- Queried production: both ruler logs are Nova brandy silent sheet refresh
- Server `listTeams(ids)` + `GET /api/v1/teams?ids=`
- Client `roadmap-known-teams` localStorage, eye icon, activity scoped to current team
- Ticker skips silent `update_release_sheet`
- Docs + demo updated
- `npx vitest run` in roadmap-service: 117 passed

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| TeamService.listTeams | empty without ids; filter+order | pass | pass |
| knownTeams localStorage | seed from tokens; remember | pass | pass |
| pickTickerEntry team/sheet | skip other team + silent refresh | pass | pass |
| full roadmap-service vitest | 117 passed | 117 passed | pass |

### Errors
| Error | Resolution |
|-------|------------|
