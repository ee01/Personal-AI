# Findings

## Canonical documentation

- `docs/features/compose_assist.md` explicitly owns ChatGPT, Doubao, Claude, and Gemini input-box assistance under `compose_to_ai`; this is not documented as a separate feature.
- Web AI draft text is intentionally an enrichment signal and part of the context key. RingCentral/Jira draft text is not the primary recall query.
- The documented trigger is input focus plus a recognized compose scene. After focus, draft changes immediately invalidate the old suggestion and schedule a debounced request; it is not documented as blur-only.
- Web AI can return either a context pack or `suggestionType='prompt_patch'`. Prompt patch is selected for a clear task that lacks slots such as data source, output format, writeback boundary, validation, or failure receipts.
- The existing deterministic prompt-patch coverage is narrow: Jira roadmap/release-risk, Jira estimate, and AI Service automation. This is materially different from a general prompt-engineering agent that rewrites any prompt for fair multidimensional analysis, web research, expert evidence, personalized recommendation, and a stronger downstream model.

## Initial implementation map

- Frontend event handling: `src/composer-guard/ComposerGuardController.ts` registers capture-phase `focusin` and `input` listeners and contains debounce/stale-draft handling.
- Web AI scene routing: `src/composer-guard/siteContextAdapters.ts` emits `scenario='compose_to_ai'` and `sceneType='web_ai_prompt_composing'`.
- Backend deterministic prompt patch: `memory-service/src/core/ContextAssistService.ts` selects and constructs `prompt_patch`.
- Backend LLM generation: the same service exports `buildComposerGenerationPrompt()` and supplies a compact system prompt to the LLM client.

## Trigger and generation implementation

- `ComposerGuardController.start()` registers capture-phase `focusin` and `input`; `handleInput()` invalidates the current assist and calls `scheduleAssistRequest()` whenever the active draft changes.
- `REQUEST_DEBOUNCE_MS` is 700ms. The timer is reset on each input, so generation starts roughly 700ms after typing pauses. Blur is not the generation trigger; focus leaving is mainly UI/session cleanup.
- Web AI uses the current draft in the request/context key and sends `scenario='compose_to_ai'`, `sceneType='web_ai_prompt_composing'`.
- For `web_agent_prompt`, `buildComposerInsertText()` does not call `generateSendableComposerText()`. It returns either a deterministic prompt patch or a deterministic context pack.
- Therefore the current LLM system prompt (`write only exact insertable text`) applies to RingCentral/Jira sendable text, not to Web AI prompt engineering.
- General Web AI prompt-patch behavior is not model-driven. `buildPromptContextPatch()` recognizes exactly three intent kinds: `codex_sites_dashboard`, `jira_estimate_analysis`, and `ai_service_auto_run`.

## Referenced ChatGPT conversation

- The target conversation asks ChatGPT not to answer the childcare question yet, but to produce a stronger prompt for a later Pro model / Deep Research run.
- Required qualities are: neutral multidimensional analysis, a conclusion, professional papers/expert/book evidence, and a personalized recommendation using the child's developmental history.
- This is a meta-prompt compilation task. It requires transforming the user's existing prompt into a downstream research brief, not merely appending recalled memory or one of the three current deterministic task patches.
- The already-open signed-in ChatGPT tab was inspected through `webpage-mcp`; no new tab was opened.
- The generated ChatGPT prompt demonstrates the target compiler shape: expert role, evidence hierarchy, correlation/causation constraints, term definitions, minimum source expectations, multidimensional analysis, decision matrix, structured child-development interpretation, actionable recommendation, uncertainty/questions, and a fixed output contract.

## Product decision

- This belongs in `Compose Assist`, specifically `compose_to_ai`; it should not become a separate feature document.
- The current implementation is real but only partial. It supports draft-driven context enrichment, not general professional prompt compilation.
- The linked childcare example would most likely classify as `source_research` and receive a context pack/tool-fit hint. It cannot produce the observed full research brief because there is no general Web AI compiler call.

## Highest-priority gaps

1. Web AI prompt generation is gated on recalled evidence. A strong draft with all necessary facts but no memory hit exits as unavailable; prompt compilation should be allowed with draft-only context.
2. `buildPromptContextPatch()` only recognizes three hard-coded work intents. There is no general gap analysis for role, evidence policy, dimensions, output schema, uncertainty, decision criteria, or target-model capability.
3. Web AI bypasses the LLM generation path, so the existing composer system prompt is not a prompt-engineering prompt at all.
4. Current insertion semantics are append/selection-oriented. A full compiled prompt needs an explicit `replace_draft` mode with preview and undo, while small patches keep `append_patch`.
5. Risk is derived mainly from evidence source labels. Sensitive content already typed in the draft, especially a minor's developmental/health history, should independently raise risk and force preview.
6. Running a costly compiler after every 700ms pause would churn. Keep the existing fast recall debounce, but add a stable-draft compiler stage (for example 1200–1500ms, minimum meaningful length, draft-hash cache, cancellation on input).

## Recommended response contract

```ts
type WebPromptAssistMode = 'context_pack' | 'slot_patch' | 'rewrite_prompt';
type InsertMode = 'append_patch' | 'replace_draft';

interface WebPromptCompileResult {
  mode: WebPromptAssistMode;
  insertMode: InsertMode;
  insertText: string;
  confidence: number;
  detectedIntent: string;
  gaps: string[];
  memoryUsed: Array<{ ref: string; purpose: string }>;
  riskLevel: 'low' | 'medium' | 'high';
  previewRequired: true;
}
```

## Recommended compiler system prompt sample

```text
You are Personal AI's Prompt Compiler. Your only job is to transform the user's current draft into a stronger prompt for the target AI. Do not answer the underlying task.

Inputs may include: current draft, visible conversation, target provider/model or mode, current page context, and privacy-filtered Personal AI memory summaries.

First decide internally whether the user needs:
1. context_pack: add only missing personal/project context;
2. slot_patch: append a small set of missing constraints;
3. rewrite_prompt: replace the draft with a complete professional prompt.

Preserve the user's real objective and all concrete facts. Never invent facts, citations, diagnoses, preferences, or constraints. Treat recalled memory as user context, not verified external evidence. Use memory only when it is directly relevant; omit stale, duplicate, private, or unnecessary details. Never output secrets, internal links, raw private messages, or source metadata.

For rewrite_prompt, compile only the sections that materially improve the task: expert role, objective, definitions/scope, evidence and research method, neutrality and counterarguments, decision criteria, personalization inputs, uncertainty and missing-information handling, output structure, verification/citation requirements, and target-model/tool instructions. Do not add ceremonial sections or arbitrary source quotas unless they improve the decision.

For research and recommendation tasks, require primary or authoritative sources where possible, distinguish correlation from causation, expose uncertainty and conflicting evidence, and separate the general evidence conclusion from the personalized recommendation. Do not manufacture references; instruct the target model to verify and cite them.

If the draft contains health, child, family, identity, employment, financial, or other sensitive data, minimize repetition and mark the result high risk. The caller will require preview before insertion.

Return JSON only:
{
  "mode": "context_pack|slot_patch|rewrite_prompt",
  "insertMode": "append_patch|replace_draft",
  "insertText": "the exact text to insert; no explanation or wrapper",
  "detectedIntent": "short description",
  "gaps": ["missing prompt slots"],
  "memoryUsed": [{"ref":"safe reference","purpose":"why it was needed"}],
  "riskLevel": "low|medium|high",
  "confidence": 0.0
}
```

## Validation needed before implementation is considered complete

- General research prompt rewrite matching the linked childcare flow.
- Same flow with no memory hits still produces a useful rewrite.
- Relevant memory adds only missing context and does not overwrite explicit draft facts.
- Minor/health/personal-data draft becomes high risk and preview-only.
- `replace_draft` preserves the original through the existing undo contract.
- Continuous typing cancels stale compiler responses and does not call the LLM every 700ms.
- Existing Jira estimate/Sites/automation deterministic patches remain stable.
