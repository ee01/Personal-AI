# Google Slides Analyzer confirmed writeback receipt plan

## Target

- Random feature: `Slides partial success skipped reasons`
- Canonical doc: `docs/features/google_slides_analyzer.md`
- Main UI: `src/modals/slides-analysis.tsx`
- Existing proof path: `verify:google-slides-analyzer`, `verify:google-slides-analyzer:e2e`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- Automation memory for `automation` was missing at the start of this run.
- Local Reminders are reachable, but there is no `Personal AI` list, so no Reminder item can be folded in or completed.
- The worktree is already heavily dirty. Keep this run scoped to Slides Analyzer files and this planning folder.

## External signals

- Google Slides API `presentations.batchUpdate` validates every request before applying it. If any request is invalid, the whole batch fails; successful atomic application should not be conflated with local precheck skips.
- PowerPoint Copilot rewrite keeps generated edits in a review/keep/regenerate flow before the document is changed; this supports preserving a clear review and recovery receipt around AI edits.
- Human-AI interaction guidelines and human-centered AI literature emphasize user control, recoverability, and monitoring near misses; skipped field writebacks should be visible and actionable, not hidden inside a success count.

## Gap

The result page already keeps skipped reasons, target-cell matching, failure receipts, and copyable handoff checklists. The remaining weak point is the partial-success success panel: it lists every originally selected field as "submitted" under the completed receipt and summarizes the atomic batch using all selected fields. In the real content-script path, local precheck skipped fields never enter the Google Slides `batchUpdate` request, so the completion panel can make the confirmed batch look larger than it was.

## Plan

1. Derive confirmed writeback fields from the last apply result by excluding matched local skipped items.
2. Change the success panel copy from generic submitted fields to "Google Slides confirmed fields", with a separate precheck skip boundary.
3. Update the skipped handoff copy packet so it includes both confirmed batch scope and originally selected scope.
4. Extend the Slides Analyzer E2E partial-success fixture to simulate `updatedCount = 2` for 3 selected fields with 1 local skipped field.
5. Update `docs/features/google_slides_analyzer.md` with a concise current-behavior note.
6. Verify with targeted Slides checks, first successful `npm start` compile, Slides Analyzer E2E, and scoped `git diff --check`.
