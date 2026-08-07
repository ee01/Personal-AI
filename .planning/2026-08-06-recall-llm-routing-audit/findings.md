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

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
