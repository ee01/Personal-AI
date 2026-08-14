# Findings & Decisions

## Requirements
- Explain why all 84 captured `/recall` requests omitted `blockTypes: ['summary']`.
- Find every direct and indirect recall caller and classify whether LLM synthesis is appropriate.
- Distinguish “fast evidence retrieval” from “unused LLM feature” and from downstream interfaces that already generate with an LLM.
- Recommend a clearer routing contract and rollout plan; do not implement in this turn.

## Research Findings
- Direct `/recall` callers found in extension: Agent Thinking history search, dashboard integration, proactive notification processors, Options, memory-exploring search/timeline, and agent workflow.
- Server-side `/ask` constructs an `ActiveRecallService` request with deterministic `evidence_list`, `timeline`, and `media`, then explicitly skips recall synthesis because Ask performs its own answer-generation stage.
- Passive `/context-recall`, Composer Assist, Today Pilot, provider context, outreach, reflection, and replay use `RecallEngine` or `ContextRecallService` rather than the public `/recall` LLM-summary switch; several have their own downstream composition/generation logic.
- `ActiveRecallService` has three coupled modes: no `blockTypes` means FTS-only by default, no metadata over-fetch, no blocks, and no LLM; any non-empty `blockTypes` enables broader default recall plus 1.5x over-fetch and metadata; only inclusion of `summary` adds the LLM analysis stage.
- `analysisMode` is declared in client/server types and accepted by `/recall`, but no runtime code reads it. It is currently dead routing metadata.
- None of the extension's direct `MemoryServiceClient.recall()` callers pass `blockTypes`. They all consume raw `items`: Agent Thinking history search, dashboard project suggestion warm-up, proactive processors, workflow replay, Memory Exploring search/timeline, Agent Workflow history, and MCP memory search/context brief.
- Several direct recall callers immediately run their own `IntelligentAgent` synthesis after retrieving items, notably proactive collaboration analysis and daily summary. Adding recall `summary` there would double-generate without removing the downstream Agent call.
- `/ask` deliberately requests deterministic blocks without `summary` and sets `skipAnalysis: true`; it builds its own evidence gates and later generates the final answer. This is a correct no-double-LLM boundary.
- Repository-wide search found no production or test caller that actually passes `blockTypes: ['summary']`; the capability is documented in the public route/client types but is currently unwired in product code.
- Production `/recall` safe mode forces `channels: ['fts']` and caps `topK`, but it does not disable `summary`; an explicit summary request would therefore still call the LLM over lexical-only evidence unless slow channels are enabled.
- `blockTypes` currently couples three independent concerns: selecting broader retrieval defaults, building deterministic presentation blocks, and opting into LLM synthesis. This makes a UI layout request capable of changing retrieval cost/behavior and is worth separating.
- The LLM analysis path catches errors and silently returns `analysis: undefined`; there is no response receipt saying requested/skipped/failed, and the reported `queryTimeMs` spans both retrieval and generation when synthesis is enabled.
- Tests cover evidence-only Recall and deterministic blocks without summary, including latency budgets (<250 ms and <350 ms median respectively), but no test exercises `blockTypes: ['summary']` or validates its prompt/output/failure behavior. This reinforces that summary is an exposed but operationally unproven path.
- `parseAnalysisJson` validates JSON shape only loosely: it requires a non-empty summary but does not validate evidence references, cap finding counts, or verify that claims are supported by returned item IDs.
- A robust parse of all 84 captured Recall bodies succeeded: 0 had `blockTypes`, 0 had `analysisMode`; 73 were `{topK:5, channels:['vector','fts']}`, 8 added a time range, and only 3 used another topK (10, 10+time range, 3). This signature matches the `historySearch` tools in `agentThinking.ts`/`agentWorkflow.ts`, whose default is topK 5 over vector+FTS.
- The 84 calls contain 78 unique query texts; repeated query groups had frequencies 5, 2, and 2. Therefore most calls were distinct tool invocations from repeated webpage analysis cycles, not exact duplicate Recall requests, although one query was repeated five times.
- `historySearch` intentionally returns raw item summaries/content to the outer Agent Thinking loop. The outer LLM decides the next action and later synthesizes context, so enabling Recall summary without removing that outer synthesis would create an extra LLM hop for every history search.
- Passive `ContextRecallService` explicitly targets <250 ms p50 / <500 ms p95 and states “no LLM in the path”; this is a product correctness boundary as well as a speed optimization because its few evidence cards feed passive UI/composer safety logic.
- Proactive project extraction, dependency extraction, collaboration analysis, and daily summary all retrieve raw Recall items and then invoke `IntelligentAgent` with a task-specific schema/prompt. Generic Recall summary should not be added; if cost is a concern, optimize or replace the downstream task-specific generation rather than stack two models.
- Memory Exploring search and timeline are direct human-facing evidence/list surfaces with no downstream LLM. Search is a reasonable place for an explicit optional “summarize these results” action; timeline should stay deterministic because chronological completeness/order matters more than prose synthesis.
- Agent Workflow replay asks `/recall` with an empty query even though the public route schema requires at least one character. It needs ordered samples, not LLM synthesis; the contract should be repaired with a dedicated recent-items API or a valid deterministic time query.
- Dashboard `suggestProjects()` awaits Recall but discards its result before ranking Project entities. This call should be removed as dead cost rather than upgraded to LLM summary.
- MCP `memory_search` and `memory_context_brief` intentionally return redacted/budgeted evidence to an external agent/model. A Recall-side summary would hide evidence selection and duplicate the consuming model; `memory_ask` already exists for callers that explicitly want a generated answer.
- Composer Assist recalls evidence first, then applies filtering/cohesion/attribution and, only for supported compose modes, runs specialized prompt-generation LLMs. Generic Recall summary would happen before those safety gates and is therefore not just redundant but placed at the wrong trust boundary.
- Today Pilot Meeting Prep similarly recalls evidence through `ContextRecallService`, then invokes a meeting-specific JSON generator constrained to that evidence. Keep Recall non-LLM and preserve the specialized generator.
- Provider `query_answer_card` is injected into a provider-native mobile context thread. Although its title says “answer,” its body is evidence plus diagnostics for the downstream provider model; generic Recall summary would duplicate that model. Rename it to evidence/context card for contract honesty, or synthesize only if the card is ever shown directly to a human without another model.
- Generative Replay, Reflection Threads, and Outreach answer resolution all use raw `RecallEngine` evidence followed by their own specialized generation or decision stage. They should not route through Active Recall summary.
- The public client documentation correctly says summary is opt-in, but the route accepts `table` and `chart` even though `ActiveRecallService` implements only `evidence_list`, `timeline`, `media`, and `summary`. This is another sign that the structured-response contract was exposed ahead of complete product wiring.
- Exact-body aggregation of the capture found 79 unique bodies across 84 calls: two repeated-body groups (5 calls and 2 calls), i.e. 5 extra exact calls. Query-shape analysis found 56 default `agentThinking` history-search queries and 28 custom queries; the rest of the repetition is mostly distinct searches caused by repeated analysis cycles.
- Git history shows Active Recall summary was introduced with the broader Meeting Pilot recall layer, but current repository search finds no later production wiring. The accurate conclusion is: the endpoint has implemented LLM support, but the product currently does not use that specific summary path.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add new explicit request fields while retaining legacy `blockTypes` | Decouples behavior without breaking unknown external clients |
| Keep passive, tool, workflow, and specialized-generation paths evidence-only | Avoids hidden token use and double generation |
| Put manual synthesis on entity-mode Memory Exploring search | It is the only direct human-facing raw-result surface identified in the audit |
| Cache by normalized query plus returned evidence identity/content | Reuse is safe only when both the question and evidence snapshot are unchanged |
| Use module-level single-flight/cache in the service process | Route handlers construct a new `ActiveRecallService` per request, so instance-local state would not deduplicate concurrent requests |

## 2026-08-12 Re-baseline Findings
- The relevant backend Recall files are currently clean except `memory-service/src/types/index.ts`, whose only existing diff is unrelated Fastify authentication metadata at the end of the file.
- `MemoryServiceClient.ts` has unrelated device-key authentication work near request transport, but the Recall types/method section is unchanged and can be patched narrowly.
- `options.tsx` has broad unrelated changes; the workflow replay call itself is unchanged, so only the empty query literal should be touched there.
- Memory Exploring entity search currently sends `SEARCH_ENTITIES`, stores only mapped result items, and exposes no synthesis state. The message handler is the narrow boundary where an explicit summary request can call Recall with synthesis enabled.
- SearchResultPage already has a large AI-answer area for overview `/ask`, but entity-mode raw search needs a separate small synthesis card/button so the two contracts are not conflated.
- Current Recall types duplicate the contract in backend and extension client. Both must evolve together; the backend file's unrelated auth diff is outside the Recall section and can be preserved.
- Active Recall currently creates a fresh `LLMClient` on every service instance and reports one combined `queryTimeMs`. New module-level cache/single-flight plus explicit retrieval/synthesis timings can be added without changing `RecallEngine`.
- The route schema still accepts dead `analysisMode`, `table`, and `chart`. The migration should deprecate but continue accepting `analysisMode` for compatibility, while removing unsupported `table`/`chart` from the accepted block enum/type rather than pretending they work.
- Entity-search UI already carries scope, query, type filter, result batch receipts, and read-only boundaries. The synthesis control should sit beside the result summary, reset on query/scope/type changes, and state that clicking starts an LLM request but does not write memory or contact external systems.
- Implemented contract direction: `retrievalMode` selects `fast|balanced|deep`, `presentationBlocks` contains only deterministic supported blocks, and `synthesis` explicitly opts into `summary`; legacy `blockTypes` maps to the new behavior.
- Unsupported `table` and `chart` were removed from accepted Recall types/schema instead of returning empty blocks silently.
- Grounded synthesis now requires `summaryEvidence` and evidence indexes on every finding. Indexes are converted to returned item IDs; invalid or ungrounded output receives `invalid_output` rather than being presented as a successful summary.
- Summary cache/single-flight keys include normalized query, scope, max token budget, and the returned evidence IDs/content/timestamps, preventing cross-snapshot reuse.
- The route now exposes whether safe FTS policy was effective, while separate retrieval and synthesis timings stop `queryTimeMs` from masquerading as retrieval-only latency.
- Memory Exploring now has a dedicated `SUMMARIZE_SEARCH_RESULTS` message rather than overloading normal search. It reuses the same query/scope/entity filters, requires at least three returned items, and opts in with `trigger: user` and a 500-token cap.
- The UI compares the evidence result-key snapshot used for synthesis with the currently displayed snapshot. If retrieval changed after the click, it refreshes the visible result list before showing the summary and marks that boundary.
- The new control is unavailable below three visible results and explicitly says clicking spends an LLM request while remaining read-only with respect to memory and external systems.
- Other repaired callers remain deterministic: Dashboard no longer makes a discarded Recall, replay uses a legal query, `/ask` uses explicit deep retrieval plus deterministic blocks, and provider output is labeled as an evidence card/receipt rather than a generated answer.
- The development extension is configured against `10.32.56.212`, so the deterministic E2E harness must intercept `/api/v1/**` independently of host. This keeps the test local while still validating the actual compiled configuration.
- The Memory Exploring E2E now proves the summary is not requested during ordinary search, is requested only after the button click, carries the explicit user/minimum-evidence/token-budget contract, and renders the grounding/timing/cache receipt.
- The hybrid diagnostics fixture contains the exact lexical phrase `Q2 planning review`; an FTS hit alongside the time-channel hit is the truthful current result. The old `time`-only assertion is stale and should be repaired rather than weakening production FTS behavior.
- The shared eval runner dispatches by hard-coded suite IDs; an unregistered new suite would be marked `suite_runner_not_implemented`. A small standalone deterministic contract eval, following the existing passive-webpage-analysis precedent, is the lower-risk way to exercise Recall synthesis routing without calling a live service or judge model.
- The standalone eval can execute the actual `ActiveRecallService` against the repository's in-memory migrated SQLite fixture, while injecting only the model output. This validates retrieval routing, call count, parser grounding, receipts, and cache behavior without production writes or token spend.
- Eval cases must isolate their in-memory evidence corpus: otherwise earlier rows can legitimately satisfy a later case's minimum-evidence gate. With per-case cleanup, all four routing/grounding/cache cases pass.
- Canonical memory-system documentation already centralizes the Memory Exploring search-result contract, so the new routing/cache/grounding behavior belongs there and in the docs index rather than in a disconnected feature file.
- Repository-wide caller search after migration shows only intentional legacy coverage remains: the compatibility unit tests and one performance fixture. Production callers now either use explicit `presentationBlocks`/`synthesis` or raw evidence retrieval, and `table`/`chart` survive only as a negative schema test.
- The worktree still contains many unrelated user edits in files that overlap this task (`package.json`, docs, client auth, Options). Final delivery must describe the scoped Recall changes and avoid staging, committing, or deploying the entire dirty tree.
- UI review confirms the entity-search summary path is separately messaged and does not alter ordinary `SEARCH_ENTITIES`: it re-runs the same query/scope/entity filters only after the click, compares stable result keys, refreshes changed evidence before rendering, and uses Vue text interpolation for model prose.
- Final cache review found and closed a multi-user isolation edge: the process-level cache key now includes a WeakMap-backed database-instance namespace plus prompt-relevant source metadata, so identical-looking evidence in separate per-user databases cannot share a synthesis entry.
- The new registered suite passes all four cases and its Reader Proof marks all three claims proved with an explicit synthetic/live-quality boundary. The first generated reader card still labels its generic actual-summary quote empty even though structured details exist, so the runner adapter should expose a concise human-readable actual output before closeout.

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
