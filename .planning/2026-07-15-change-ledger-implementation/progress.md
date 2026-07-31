# Progress Log

## Session: 2026-07-15

### Current Status
- **Phase:** Complete
- **Started:** 2026-07-15
- **Completed:** 2026-07-15

### Actions Taken
- Read `AGENT.md`, the retained plan/demo, the relevant memory registry entry, and the `planning-with-files` workflow.
- Inspected the worktree and existing planning state; found unrelated root planning files and an active plan for another automation.
- Created isolated plan `.planning/2026-07-15-change-ledger-implementation/`.
- Confirmed the product boundary: generic evidence-backed state changes, contextual UI, conservative current-state projection, and required eval coverage.
- Located the migration sequence, core services, API routes, and existing API test suites that own Source Memory, Context Recall, Ask, and Compose Assist.
- Confirmed migrations are transactionally applied and Source Memory already persists metadata receipts suitable for extraction status while dedicated event/chain tables remain queryable.
- Finished interface mapping across the extension cache/UI, desktop client mirror, custom eval dispatcher, and in-memory migration-backed test harness.
- Confirmed the required shared files are already dirty; the implementation will keep new behavior in owned files and use optional contracts at shared construction sites.
- Froze the core split between immutable evidence events and conservative current projections, including read-time reconciliation against visible page fields.
- Selected explicit structured changes plus deterministic bilingual old/new patterns as the initial extraction boundary; ambiguous prose remains out of scope until a separately evaluated extractor exists.
- Completed the P0 contract: typed values, immutable evidence events, generic source references, evidence-derived chains, projection authority states, extraction receipts, and visible-page reconciliation.
- Integrated ledger context into Ask and Compose Assist; all existing backend regression slices remain green.
- Began client/UI integration, selecting the existing Source Memory trust-panel grammar and a read-only synthetic Lens presentation for change-only results.
- Added extension and desktop client contracts plus the Source Memory detail receipt/current/history interaction.
- Integrated Memory Lens response selection, cache persistence, mixed-card section, chain-only read-only presentation, and dedicated compact styles.
- Added and registered the deterministic `change-memory-ledger` eval suite with 8 release, Goal, reversal, conflict, noise, isolation, Compose, and blocked-subject cases.
- Corrected the report-contract gap and unsafe conflicted-current presentation; unresolved conflicts now expose no arbitrary current value.
- Added an API lifecycle test covering Source Memory save, ledger receipt, Context Recall projection, dismissal, and historical-only behavior.
- Added a dedicated browser verifier for chain-only Lens, mixed ordinary memory plus ledger, Source Memory conflict rendering, and mobile geometry.
- Added canonical `docs/features/change_memory_ledger.md` documentation and linked the contract from Memory Capture, Memory Lens, Ask, Compose Assist, Memory System, and the feature index.
- Replaced the progressing artifacts with an interactive Chinese demo under `docs/demo/`; verified all three scenarios, tabs, Lens state, Compose insertion boundary, and desktop/mobile overflow.
- Ran the required temporal-memory evals and the six-ability regression gate, then completed the owned-diff and whitespace checks.

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `memoryChangeLedgerService.test.ts` | All extraction, chain, conflict, dismissal, and reconciliation cases pass | 8/8 passed | PASS |
| `api-change-memory-ledger.test.ts` | Source Memory lifecycle and Context Recall integration remain correct | 1/1 passed | PASS |
| `npm --prefix memory-service run build` | Strict TypeScript compilation succeeds | Final build succeeded | PASS |
| Source Memory + Context Recall regression slice | Existing suites stay green after optional ledger integration | 56/56 passed across 3 files | PASS |
| Ask + Compose integration regression slice | Existing prompt and assist behavior remains green | 110/110 passed across 5 files | PASS |
| `npm start` first watch compile | Extension, Vue detail page, and client mirrors compile from current `dist/` inputs | Final webpack compile succeeded in 17.6s; watch then stopped | PASS |
| `npm run eval:validate` | Registry, cases, workflow, and runner contracts validate | 20 suites validated; only unrelated existing empty-suite warnings | PASS |
| Final `change-memory-ledger` eval | Business cases and reader report contract pass | 8/8, average 100, report contract checked 8 cases with 0 issues; `.eval-runs/20260715T052418Z-change-memory-ledger-ypakr3/report.html` | PASS |
| Memory abilities regression gate | Ask prompt change does not regress six core memory abilities | 6/6, overall 1, baseline 1 -> 1; `.eval-runs/memory-abilities-change-ledger/mem-abilities-final/reader-report.json` | PASS |
| `verify-change-memory-ledger-e2e.mjs` | Compiled Lens and Source Memory UI preserve trust and geometry contracts | Chain-only, mixed, conflict, and mobile checks passed | PASS |
| Standalone demo Playwright QA | Desktop/mobile layout and all interactive states work without page errors or overflow | 1440x900 and 390x844 passed | PASS |
| Owned whitespace/diff checks | No whitespace errors or accidental owned-path churn | `git diff --check` and untracked trailing-whitespace scan passed | PASS |

### Errors
| Error | Resolution |
|-------|------------|
| Root planning files and `.planning/.active_plan` were unrelated | Preserved them and initialized a dedicated plan directory for this implementation |
| Focused ledger test: 3 of 7 failed | Fixed reversal baseline, historical projection after source deactivation, and line-preserving noise extraction; rerun passed 7/7 |
| Source Memory integration build rejected `unknown` entity hints | Routed the existing metadata value through `normalizeEntityHints` before passing it to the typed ledger input |
| Concurrent tasks created `052_open_question_exit_contracts.sql` and `053_keystone_memory_briefs.sql` | Renumbered the owned ledger migration from `052` to `054` |
| Conflicted projection still surfaced the last inserted candidate as a current value | Changed unresolved conflicts to expose no current value and added an explicit unknown-current Ask boundary |
| Reader report could not summarize custom ledger output | Added extraction, projection, Ask, and Compose rows to the shared report adapter only for this suite |
| Conflict unit test showed candidate display order could swap for equal timestamps | Sort unique conflict candidates before rendering so UI and eval evidence remain deterministic |
| First browser E2E timed out clicking a native `<summary>` inside the fixed Lens scroll region | Trigger the same native summary click in-page, then assert the expanded evidence content and geometry |
| First two standalone demo QA runs asserted wording that was not present | Updated the test-only expectations to the actual conflict wording, then passed the full desktop/mobile run |
