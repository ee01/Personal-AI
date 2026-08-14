# Progress Log

## Session: 2026-08-06

### Current Status
- **Phase:** Complete
- **Started:** 2026-08-06

### Actions Taken
- Read repository instructions, restored unrelated root planning context, and created an isolated plan.
- Located direct `/recall` clients, `ActiveRecallService` users, and indirect recall services.
- Confirmed that no extension direct caller passes `blockTypes`, and that `analysisMode` is currently unused.
- Confirmed `blockTypes` also changes retrieval breadth/over-fetch, not only response rendering, which complicates caller intent.
- Parsed all 84 capture bodies without exposing query contents; mapped their request signatures and exact-duplicate groups.
- Classified every direct `/recall` caller and the services that use `RecallEngine`/`ContextRecallService` behind other APIs.
- Drafted an explicit evidence-vs-synthesis routing contract, product-surface recommendations, and validation requirements.

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Repository search for production `blockTypes: summary` callers | Find intentional consumers or prove none | No production or test caller found | pass |
| Capture body parse | Classify all 84 Recall calls | 84/84 parsed; 0 summary, 0 analysisMode | pass |
| Caller inventory | Cover direct and indirect recall users | All source call sites classified | pass |

### Errors
| Error | Resolution |
|-------|------------|

## Session: 2026-08-12 Implementation

### Current Status
- **Phase:** Complete
- **Started:** 2026-08-12

### Actions Taken
- Re-read the planning skill and current `AGENT.md`.
- Confirmed the worktree contains broad unrelated changes, including some files this task must touch; implementation will use narrow patches and inspect current diffs before editing.
- Re-opened the completed Recall audit and added implementation phases rather than creating a disconnected plan.
- Added the separated backend/client Recall contract, grounded synthesis receipts, cache/single-flight, and initial targeted tests.
- Added a three-evidence minimum that prevents unnecessary LLM calls.
- Added the explicit Memory Exploring summary request/response path and user-facing synthesis card.
- Removed the dead Dashboard Recall, repaired workflow replay's invalid empty query, migrated `/ask`, and clarified Provider Context labeling.
- Built the extension successfully and passed the Memory Search static verifier.
- Extended the deterministic browser harness to cover explicit user-triggered synthesis, request parameters, grounded receipt rendering, and host-independent API interception; the E2E passes.
- Registered the deterministic Recall synthesis suite in the shared eval runner with Reader Proof claims and honest synthetic/live-quality boundaries.
- Added per-user database cache namespacing after final privacy review and verified separate databases cannot reuse each other's synthesis.
- Audited the scoped diff and intentionally did not deploy, stage, commit, or push because the overlapping worktree contains extensive unrelated user changes.

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Active Recall + Recall API + performance tests | Grounding, failure, cache, multi-user isolation, schema, latency pass | 34/34 passed | pass |
| `npm --prefix memory-service run build` | TypeScript build succeeds | succeeded | pass |
| `npm run verify:memory-search-results` | Static Memory Search contract passes | succeeded | pass |
| `npm start` first compilation | Extension compiles | webpack compiled successfully | pass |
| `npm run verify:memory-search-scope:e2e` | Explicit summary flow works end to end | succeeded after host-neutral interception fix | pass |
| `git diff --check` | No whitespace errors in the dirty worktree | no output | pass |
| `npm run eval:recall-synthesis-contract` | Default no-LLM, evidence gate, grounding rejection, cache reuse | 4/4 passed after isolating each in-memory corpus | pass |
| `npm run eval:validate` | Repository eval configuration remains valid | 25 suites valid; only existing planned-suite no-case warnings | pass |
| `npm run eval:run -- --suite recall-synthesis-contract --no-repair` | Unified report and Reader Proof pass | 4/4 pass, 3/3 claims proved, report contract pass | pass |
| Final Memory Search static + E2E rerun | Compiled UI contract and explicit click flow remain correct | both passed | pass |

### Errors
| Error | Resolution |
|-------|------------|
| Active Recall test transform failed because a Markdown backtick inside `ANALYSIS_SYSTEM_PROMPT` terminated the template literal | Removed the unescaped backticks before rerunning the targeted test |
| Memory-service build found deterministic `/ask` analysis objects without `evidenceItemIds` | Kept the new grounding field optional at the shared `RecallAnalysis` level; Active Recall summary still requires and returns it before marking synthesis successful |
| Follow-up TypeScript build flagged optional `analysis.evidenceItemIds` inside the strict Active Recall parser | Validate the local required `evidenceItemIds` variable before returning the analysis object |
| Combined Active Recall + API test run made the hybrid diagnostics case report `fts,time` instead of the expected isolated `time` | Confirmed the fixture contains the exact query phrase; updated the stale test to expect the truthful FTS and time hits without changing production recall behavior |
| Memory Search E2E timed out before the first result because the dev build points at `10.32.56.212` while the harness intercepted only `localhost:3210` | Made the existing harness intercept the API path independent of configured host, preserving deterministic mocked responses |
| The first multi-file eval patch did not match the current README line wrapping | Split the patch and target the README's current exact paragraphs |
| First Recall synthesis contract eval passed 2/4: evidence from earlier cases remained in the shared in-memory DB, defeating the minimum-evidence fixture; the repeated successful request also called the stub twice | Isolate database evidence before each case and inspect the cache key/lookup path before rerunning; do not loosen the assertions |
| The first documentation insertion matched only the visible/truncated portion of an unusually long existing paragraph | Insert the dated contract note at the next stable dated paragraph boundary instead of replacing the long line |
