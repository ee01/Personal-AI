# Findings

## Requirements
- Scope collaboration ticker + activity drawer to the currently selected team
- Team dropdown: only "my" teams, not the global catalog
- Read-only teams in the list get a small eye icon
- Investigate two logs on 08/14 (patricia.li 14:03, sophia.lin 13:37)

## Current behavior
- `GET /api/v1/teams` returns **all** teams (5 on prod: Nova brandy, Milo, Phone, two VoIP)
- Edit permission is `localStorage['roadmap-edit-token:' + teamId]` on the **page**, not the Chrome extension. Same for users with/without the extension. **Not cross-device.**
- Activity API is already `WHERE team_id = ?`. SSE also filters by teamId **if** eventTeamId is set (`if (eventTeamId && eventTeamId !== teamId)` — missing teamId would leak).
- Frontend prepends SSE activity without checking `entry.teamId`.

## The two ruler logs (production)
Both on team **Nova brandy** (`Sp1CSuq7w70L`), op `update_release_sheet`:

| Time (CST) | Actor | clientId | source | summary |
|---|---|---|---|---|
| 08/14 13:37 | sophia.lin | c_0bthmdziqh06mss7xdsk | extension | cleared:false, splitPhase:ff, showPhases:["ff"], rowCount:499 |
| 08/14 14:03 | patricia.li | c_74uocgs8z7pmsr718v0 | extension | same |

This op is written by `GanttPanel.silentRefreshReleaseSheet`: any editor opening the page after `RELEASE_SHEET_TTL_MS` (6h) re-fetches the Google Sheet and saves cached rows. They did **not** change JQL / split / shown phases. Manual ruler config save goes through `update_jql` ("更新了团队 JQL"). Clearing uses the same op with `cleared:true` ("清除了发布时间表标尺").

Same pattern repeats many times (esone.qiu, sophia.lin 08:40, Guest, Jimmie Yang, …) with identical summary.

## Token storage advice
- Keep localStorage (already the product’s membership key).
- Also persist `roadmap-known-teams` (ids you’ve created, opened via `?team=` / share link, or that already have an edit token).
- Cross-device would need login or `chrome.storage.sync` (extension-only, page still couldn’t read it without a bridge). Not worth it without accounts.
