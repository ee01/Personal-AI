# Project Dashboard Source Check Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over verification item.
- Random selection initially hit Jira Design Links, but that family was too recent; the run continued with the next random non-fresh target: `项目数据源检查`.
- Local Reminders lists returned `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`; no `Personal AI` list is present.
- The worktree has many unrelated pre-existing dirty files. Preserve them and only edit this run's scoped files.

## Code And UX Findings

- Project Dashboard already has a strong data-source panel: `sourceScope` shows read / unavailable / skipped sources, and `localEvidence` shows project count, active task count, ETA/source coverage, missing plan projects, and repair actions.
- UX gap: `handleSyncData()` still rendered the top `dashboard-status` as success for Memory Service `unavailable` and for successful reads that still left local evidence in `attention` / `empty`. A user could see a green success before reading the panel and assume the project state was trustworthy.
- Implementation slice: add `buildProjectSyncActionStatus()` and a `warning` dashboard status tone. Source read limits or local evidence gaps now bubble to the first visible action status.

## External Reference Findings

- GitHub Projects insights builds charts from project items as source data and excludes archived/deleted items, reinforcing that project dashboards should name their data scope.
- Linear Project Graph generates only after enough project issue data exists, and its docs state graph statistics update hourly, reinforcing data sufficiency/freshness boundaries before predictions.
- Linear project updates combine health indicators with structured status context, supporting a first-screen warning when the local health/status basis is weak.
- Data provenance dashboard research argues reliability depends on visible metadata about data origin and changes over time; this supports surfacing read limits and local evidence gaps in the top status, not only in expanded details.
