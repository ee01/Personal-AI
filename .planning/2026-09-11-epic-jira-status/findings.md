# Findings

## Requirements
- Epic bars should read Jira status and restyle for Closed / Resolved (same as tasks)
- Explain when the status read happens

## Research Findings
- Sub status lives in `subs.status` (migration `013_subs_status`)
- `applyRefreshFromJira` already extracts `jiraStatusName(fields.status)` but only writes it on **subs** and **dep markers**, never on **items**
- Frontend silent refresh (`GanttPanel.silentRefreshFromJira`) already includes scheduled item `jiraKey`s (up to 50 with subs) and already sends `status` in the intent payload
- Trigger: watch `[hasExtension, editable, team.id]` → 2s timer → fetch Jira via extension → `refresh_from_jira`. Team TTL 10 minutes. Read-only links skip. Dragging/editing/in-flight Target keys skipped
- `isDoneStatus()` + `.sbar.done` / `.res-bar.done` already exist; epic main bars use `.bar` + `colorCls` only
- `items` table has no `status` column

## Architecture Notes
Fetch path is already shared. Gap is persist (`items.status`) + snapshot (`mapItem`) + Gantt class (`.bar.done`) + ✓ prefix + tooltip.

## Resources
- `roadmap-service/src/core/TeamService.ts` `applyRefreshFromJira`
- `roadmap-service/web/src/components/GanttPanel.vue` `silentRefreshFromJira`
- `roadmap-service/web/src/composables/useRoadmapContract.ts` `isDoneStatus`
- `docs/features/personal_roadmap.md` 「已完成任务的配色」「打开静默刷新 Jira」
