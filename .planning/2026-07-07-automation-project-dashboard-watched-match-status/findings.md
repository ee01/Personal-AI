# Findings

## Repo Context

- `docs/progressing/to-verify.md` is empty.
- EventKit can read the local `Personal AI` Reminders list. It contains 4 total items and 0 open items; all completed items are Doubao / Notification / test feedback, not Project Dashboard watched-project feedback.
- Existing Project Dashboard code already renders Memory Service source-card highlights such as `新增：...` and `已匹配：...`, but the first dashboard status line still foregrounds counts. Users must expand the data-source panel to see the concrete matched/created project names.

## External Scan

- GitHub Projects Insights states charts use items added to the project as source data and distinguishes current and historical charts. Product implication: status summaries should expose the source slice, not only a high-level count.
- Linear Project Graph only autogenerates after a project starts and enough issue data exists; it updates hourly. Product implication: project-status UI should state whether enough concrete issue/project evidence exists.
- GitHub project status updates and Linear project updates both make health/status plus written context visible in the project surface. Product implication: a first-screen Project Dashboard status should name the affected projects before users dig into diagnostics.
- Provenance and data-quality dashboard research emphasizes linking quality issues to source data points and showing completeness/timeliness/consistency dimensions. Product implication: the watched-project sync receipt should name created/matched source projects and keep the local-only boundary clear.

## Proposed UX

- Add a compact top-level watched-project status detail to the sync success warning/success message.
- Include created and matched project previews in the first visible status receipt.
- Preserve existing source-card highlights and diagnostics for full details.
