# Findings

## Initial State

- The worktree contains existing uncommitted Compose Assist changes in backend types, `ContextAssistService`, and the extension client types.
- Existing behavior already sends scene and audience hints and injects structured writing-style/profile rows for generated RingCentral/Jira text.
- Web AI deterministic context-pack/prompt-patch and precompiled cue branches bypass some personalization behavior.
- The existing progressing plan and demo are tracked and will be revised in place rather than duplicated.
- Current `.planning/.active_plan` belongs to another automation task and must remain untouched.

## Compose Assist Baseline

- `ContextAssistService` has additional uncommitted Web Prompt Compiler work: Web AI can now return `context_pack`, `prompt_patch`, or `rewrite_prompt`, with `append_patch`/`replace_draft` insertion modes. Persona projection must integrate with this current pipeline rather than restoring the older deterministic-only flow.
- Non-Web compose still has three output paths after recall: a precompiled `draft_hint` cue, LLM-generated RingCentral/Jira text, or unavailable.
- The frontend already derives locked review from `previewRequired`, `riskLevel=high`, or Rehearsal evidence, and preserves the pre-review editor selection.
- Current UI has a `.pai-composer-guard-review-note` location suitable for one conditional projection boundary line; ordinary hover remains正文-only.
- Existing direct-insert and ambient-calibration E2E harnesses are the stable Compose Assist proof paths.
- The current profile loader still reads raw `USER_CORE` plus broad confirmed fact/preference/constraint rows, so filtering must occur before prompt construction.

## Implementation Decisions

- Add public summary types to the shared backend/client contracts, while keeping profile values only in the internal projection object.
- `ComposerAudienceResolver` will use active confirmed `social_edges` with exact normalized name/alias matching. Recognized `relationshipHint` remains a lower-confidence compatibility fallback.
- Projection slots are split into control-only style/language/format instructions, speakable relevant facts, soft pending style, and blocked candidates.
- Web deterministic prompt patches receive no profile slots. Context-pack/rewrite outputs may append only directly relevant projected constraints/facts after the compiler result is known.
- Every output branch runs the same post-generation validator against credential patterns and blocked candidate values.
- Existing `previewRequired` logic remains authoritative and is OR-ed with projection review requirements.
- Shared `social_edges` already stores confirmed relation type, confidence, validity, and a target Person entity with aliases; no migration is needed for audience resolution.
- Existing Composer API types now include `rewrite_prompt` and `insertMode`, so projection summary must be added without narrowing those concurrent changes.
- Passing only the request's raw `relationshipHint` into generation would have let a low-confidence hint contradict a confirmed social edge. Generation now receives the projection's resolved audience type/source and explicit audience policy instead.
- A precompiled cue can bypass writing-style or audience controls even when its output is value-safe. Direct cue insertion is therefore allowed only for a non-degraded, zero-slot, `draft_only + write_as_user` projection.
- The current full Compose eval also exercises concurrent Prompt Compiler work. In this local environment the compiler is enabled but has no valid generator result, so legacy context-pack/prompt-patch cases fail independently of the deterministic persona fixtures.
