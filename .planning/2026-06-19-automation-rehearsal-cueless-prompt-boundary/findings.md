# Findings

## Repo State

- `docs/progressing/to-verify.md` says there are no carry-over verification items.
- The automation memory shows the last three random targets were Compose Assist ambient calibration, Meeting Pilot side panel, and Scheduled Messages health triage, so this run avoided those families.
- Reminders list names are available, but there is no `Personal AI` list.
- The worktree already contains many unrelated modified and untracked files; this run must keep changes scoped.

## Target Feature

- Random selection produced several candidates; this run locked `Rehearsal 管理页`.
- The canonical doc already describes deep-link failure receipts, action receipts, write-failure receipts, no-cue diagnostics, and activation diagnostics.
- The current page and E2E already implement those major receipt items.
- Real UX gap found: an Active legacy Rehearsal with empty `activationCues` shows the no-cue warning, but the next-step banner and prompt eligibility copy still say it will participate in scene triggers. That conflicts with the Rehearsal contract that cue-less records are not reliable future-scene prompts.

## External Research

- Apple Reminders supports time, location, and messaging-person cues, reinforcing that reminder eligibility depends on trigger conditions, not just a task status.
- Microsoft To Do flagged email preserves source-mail context as a task list, reinforcing source/trigger provenance in management views.
- The 2026 context-aware reminder authoring paper argues that natural-language reminder intent needs structured time, activity, sensor, and state conditions before execution.
- Implementation-intention research frames prospective memory as an if-then cue/action binding; without a cue, the action script should not be presented as reliably triggerable.

## Planned Improvement

- Make prompt eligibility cue-aware, not status-only.
- Add a lifecycle fact row for现场提示 so the user can see whether this record can actually enter scene matching.
- Keep action receipts honest after operations on cue-less records.
- Extend the existing Rehearsal page E2E fixture to assert the cue-less Active path.
