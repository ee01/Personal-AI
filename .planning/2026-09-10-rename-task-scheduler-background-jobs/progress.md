# Progress

## 2026-09-10
- Confirmed option A and inventoried call sites.
- Git-mv + identifier rename with storage/alarm/message aliases.
- Canonical docs now use 后台作业; `task_scheduler_api.md` is a redirect stub.
- Popup e2e was blocked by help onboarding after `storage.local.clear()`, and GET status hung on unstubbed Service Worker fetch to `memory.local`. Seeded `helpCenterOnboardingSeen`, stubbed SW fetch, and aligned English header icon titles.
- English digest/loading copy now says background job, matching the Chinese product name.
