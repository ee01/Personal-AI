# Sleep-time Reconciliation

Production readonly baseline: `phase0.json` (no text or source ids).

Deterministic boundary suite: `npm run eval:run -- --suite sleep-time-reconciliation --no-repair`. Five required groups execute 67 checks; the complete test file has 89 checks, including real nightly wiring, provenance/ACL, source independence, rollback, live qualification, parent/child gift recall and expired leases.

Actual configured model: `memory-service/node_modules/.bin/tsx memory-service/evals/sleep-time-reconciliation/quality.ts`. `quality-report.json` contains 50 controlled anonymous fixtures grounded in the issue scenarios, not a representative human-labeled production sample. Latest accuracy 1, both-valid false-positive 0, authority violations 0, agreement .98. It does not qualify a production user for live B/C.

`abilities-report.json` is a content-free summary of the six-ability benchmark against a local branch service with a private readonly production snapshot. All six scores are 1, no regression. Local answer timeout was 60 seconds; this does not establish production p95 at the default 9-second budget. The temporary server was stopped and its private snapshot removed.

Live requires explicit flags and current-model labels for 50 distinct pairs per owner/tenant; C additionally needs 15 both-valid pairs <=10% false positives. Known reviewed mismatches are not applied. Operator label/revert CLI: `memory-service/tools/review-sleep-reconciliation.ts`.
