# Findings

## Repo State

- Automation memory did not exist at the provided path, so this run creates the first automation record.
- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders has no `Personal AI` list, so no reminder feedback items are available for this run.
- The worktree is already broadly dirty. Keep edits scoped to Message Reaction Snooze files and this isolated planning directory.

## Product And Research Notes

- Slack Later keeps saved items in a visible Later area and lets users set or edit reminders from that surface.
- Gmail Snooze gives snoozed messages a dedicated Snoozed view, so the management route is part of the core recovery model.
- MobileHCI 2018 Snooze research frames snooze as manual deferral to a user-chosen later point; this raises the importance of a reliable route back to review or change that deferral.

## Code Notes

- Quick reminder creation already sets the menu `aria-busy`, disables menu items, and restores focus on failure.
- The manage menu item currently sends `OPEN_SCHEDULED_MESSAGES` directly and then hides UI, with no busy state or single-flight guard.
- This can duplicate management tabs if the user double-clicks or presses activation twice before the first runtime response finishes.
