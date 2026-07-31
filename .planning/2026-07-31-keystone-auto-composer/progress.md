# Progress

## 2026-07-31

- Confirmed product decisions: automatic generation, no user action, and passive first-screen priority `Keystone Brief > Change Ledger`.
- Read repository workflow and planning-with-files instructions.
- Inspected current live behavior, deployed brief inventory, key service/renderer call sites, and canonical docs.
- Created this isolated plan without modifying the existing active-plan pointer.
- Implemented the first backend slice: reflection-seeded, source-grounded automatic composer; brief-key lookup; bounded heartbeat integration; unchanged/protected brief guards; existing-memory backfill behavior.
- Added automatic composer tests covering ready generation, idempotence, and protection of user-hidden briefs; targeted backend tests pass 7/7 and TypeScript build passes.
- Locked the UI contract to `Selection/Rehearsal > ready or partial Brief > Change Ledger > ordinary memory`; added a combined Brief + Ledger browser fixture that verifies the brief owns the first screen and the ledger remains available under evidence.
- Updated `memory_lens.md`, `memory_system.md`, `change_memory_ledger.md`, and the feature index so UI presentation details live in the Lens document and system docs retain lifecycle/data-flow boundaries.
- Extended the Keystone eval with a reflection-plus-two-sources automatic generation case. Eval registry validation passed and the 7-case suite passed with report `.eval-runs/20260731T095605Z-keystone-memory-briefs-zoudmg/report.html`.
- Ran `npm start` through a successful webpack compile, the source verifier, and the full webpage-memory browser E2E successfully.
- Moved automatic composition to an independent startup-plus-15-minute maintenance loop after confirming the production proactive scheduler is disabled.
- Added a Keystone-only context-recall fallback for deployments where ordinary passive search is disabled; it remains read-only and returns no ordinary recall candidates.
- Deployed the final memory-service build. Automatic backfill produced 9 briefs for `esone.qiu` (7 ready, 2 stale, 0 failed), including ready briefs for `NOVA-13680`, WhatsApp, and RingCX.
- Verified the real RingCentral context for group `160443817990`: live `/context-recall` returned `jira:NOVA-13680` as the primary brief with 6 sources while retaining `passive_fast_search_disabled` for the ordinary search path.
- Re-ran targeted backend coverage (38/38), TypeScript build, extension verifier/E2E, the 7-case Keystone eval, and the live Memory Abilities benchmark (6/6 abilities, overall 1, no baseline regression).
- Browser-side validation remains a user-session step because the available browser controller had no connected logged-in Chrome Canary tab; production API behavior and the exact page-context payload were verified live.
