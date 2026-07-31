# Compose Assist Documentation Cleanup Progress

## 2026-07-15

- Created an isolated planning record without changing the repository's existing active-plan pointer.
- Read the planning skill, restored existing planning context, inspected the dirty worktree, and performed the quick memory lookup for prior Compose Assist decisions and validation paths.
- Read `AGENT.md` in full and inspected the canonical Compose Assist doc plus broad `docs/progressing` references.
- Identified the original Prompt Context Compiler artifacts as already removed, and isolated the completed Persona Projection P0 plan/demo as the remaining Compose Assist-specific progressing artifacts to retire.
- Traced the implemented projection through each service output branch, shared response types, extension display gates, and focused tests/E2E fixtures.
- Confirmed the remaining `user_core` source constant is meeting-prep-only, and confirmed the Persona Projection demo reflects the current正文-only hover contract.
- Updated the canonical Compose Assist doc, retired the completed Persona Projection plan, and moved the demo into `docs/demo`.
- Confirmed only the intended docs paths changed, no canonical docs retain stale progressing links, the moved demo still resolves the root icon path, and its inline JavaScript parses successfully.
- Validation passed: 43/43 focused memory-service tests, 19/19 frontend controller/adapter tests, and `npm run eval:validate` (14 suites; only expected empty-suite warnings).
- `npm start` reached a successful development webpack compile; watch was then stopped cleanly with Ctrl-C. A second incremental compile also completed successfully before shutdown.
- Extension E2E passed for Persona Projection, direct insert/正文-only preview, draft staleness/blur scheduling, and ambient calibration.
- Inspected the Compose eval fixtures and found one stale manual-verification instruction for the removed source-route/draft-receipt hover UI.
- First structured JSONL update failed before writing because the file begins with a comment line; recorded the error and will retry while preserving non-data lines.
- Updated the Jira estimate eval's manual-verification payload with the current real-blur trigger,正文-only hover, explicit append confirmation, no-submit boundary, and post-insert undo receipt.
- Reran evals: all three Persona Projection cases passed; Jira estimate prompt patch returned WARN only because the remote service omitted `insertMode`/`personaProjection`. The report does contain the corrected manual guidance.
- Remote checksum check confirmed both Persona runtime files were missing and the service/types files were stale. Selective rsync succeeded. An initial build command was mistakenly local; recorded and corrected to an explicit remote SSH invocation.
- The first explicit remote build reached the host but its non-login shell lacked Docker on PATH; will resolve the absolute Docker binary before the next attempt.
- The absolute Docker path worked and the build reached `tsc`, but stopped before producing an image because two existing remote source contracts are older than the selectively synced ContextAssistService. The running old container was not replaced.
- Audited and selectively synced the two narrow dependency contracts. The next build passed source copy and entered TypeScript compilation, then the remote Docker RPC stream ended with EOF before a result; no container update occurred.
- OrbStack/Docker health recovered; the retry built image `36c358a...`, recreated memory-service, and the Jira estimate eval then passed. Report: `.eval-runs/20260715T043550Z-compose-assist-d1uip0/report.html`.
