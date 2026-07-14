# Findings

## Selected Feature

- Feature index row: `Revoke ingested memory` under Doubao Bridge.
- Source doc: `docs/features/doubao_bridge.md`.
- Primary implementation: `desktop-app/app/renderer.js`, `desktop-app/app/index.html`, `desktop-app/app/app.css`.
- Existing browser proof: `desktop-app/scripts/doubao-source-toggle-gating-check.mjs` through `npm --prefix desktop-app run test:source-toggle-gating`.

## Repo State

- `docs/progressing/to-verify.md` says `暂无`.
- Worktree was already broadly dirty before this run. Keep edits scoped and report only files owned by this run.

## Reminder State

- AppleScript list read did not include `Personal AI`.
- EventKit fallback succeeded and found `Personal AI`.
- `Personal AI` totals: 4 reminders, 0 incomplete.
- No Reminder item is related to Doubao revoke, Explorer source deletion, imported memory deletion, or source scope.

## Current Behavior

- Source cards show a danger-zone revoke panel.
- Revoke disabled state explains Memory Service disconnected, Explorer missing, or source running.
- Ready state says the saved default scope, other-scope boundary, original chat non-deletion, active artifact count, legacy unscoped count, revoked audit count, and remote cleanup request.
- Confirm dialog includes saved scope, local artifact count, legacy note, Memory Service deletion boundary, and source chat non-deletion.
- Pending request copy says no deletion or local audit marking has been proven yet.
- Result copy separates Memory Service deleted messages/chunks from local artifact marking and warns for local-only / remote-only / empty results.

## Gap

The destructive operation correctly captures `scope`, `localArtifacts`, and `legacyArtifacts` before calling the API, but the result copy does not explicitly label those values as the click snapshot. If source settings or Explorer counts change while the request is pending, the user must infer that the result still belongs to the earlier saved-scope batch.

## Product / Research Scan

- OpenAI Memory FAQ separates saved memory deletion from chat deletion; this supports saying revoke deletes Personal AI memory layer, not source chat history.
- Gemini Privacy Hub and activity deletion docs separate activity retention, auto-delete, connected app use, and reviewer retention; this supports naming which layer changed.
- Claude memory import/export makes cross-provider memory movement a first-class flow; migration/deletion flows need portable provenance.
- Machine unlearning verification and surveys argue deletion requests need evidence of completion or explicit limits of proof; here the UI can provide verifiable counts for service deletion and local audit marking without claiming remote chat deletion.

## Implementation Direction

Add a compact clicked-snapshot clause to pending and result messages:

- source label and saved scope
- local active artifact count from the pre-confirm preview
- legacy unscoped audit count from the pre-confirm preview
- boundary that the snapshot is not a refreshed Explorer count and does not delete source chats, previews, cache, or cursor

No backend route changes are needed.
