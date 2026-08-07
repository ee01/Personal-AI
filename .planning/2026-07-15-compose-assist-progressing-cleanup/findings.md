# Compose Assist Documentation Cleanup Findings

## Initial State

- The worktree contains many unrelated modified and untracked files from parallel tasks; all changes outside the Compose Assist scope must be preserved.
- The existing root planning files and `.planning/.active_plan` belong to unrelated work and remain untouched.
- Relevant prior Compose Assist context points to `ComposerGuardController.ts`, `assistPreviewPolicy.ts`, the direct-insert E2E, memory-service composer-assist tests, and the compose-assist eval suite as the stable verification surface.
- Current canonical documentation already has uncommitted Compose Assist edits, so the final update must merge with the existing content rather than replace it.
- Repository policy requires targeted tests and the first successful `npm start` compile for runtime source changes; user-visible content-script behavior calls for the existing extension E2E, and generation/recall quality calls for the registered eval suite.

## Progressing And Canonical Docs

- `docs/features/assist.md` already documents the current product boundary, host surfaces, trigger lifecycle, icon/display gates, append-vs-replace modes, stale-draft protection, preview-only-body rule, feedback/calibration behavior, Web AI compiler logic, Jira estimate fallback, and Persona Projection contract.
- The repository's documentation policy says an implemented progressing capability must be summarized in canonical `docs/features`, then its planning notes removed; associated HTML demos should be moved to `docs/demo` rather than deleted when they remain useful.
- Broad text search finds many adjacent future plans that merely consume Compose Assist. Those are not deletion candidates. Candidate ownership must be determined from the exact original capability title/content, not from any incidental Compose Assist mention.
- `persona-projection-contract-plan.md` explicitly separated implemented P0 from P1-P3 expansion ideas. Before deleting it, retain those expansion boundaries in the canonical Compose Assist doc so no future constraint is lost.

## Scope Resolution

- Automation memory identifies the original completed capability as `Prompt Context Compiler / 提问上下文编译器`, with planned files `prompt-context-compiler-plan.md` and `prompt-context-compiler-demo.html`.
- Those two Prompt Context Compiler artifacts are already absent from the worktree and have no Git history, so there is nothing further to delete or move for that original plan.
- The adjacent `Persona Projection Contract (Compose Assist v1)` P0 is also fully implemented and verified according to its isolated implementation record. Its P1-P3 bullets are cross-module future expansion boundaries, not missing Compose Assist P0 work.
- Canonical `docs/features/assist.md` already contains the detailed Prompt Compiler and Persona Projection contracts, but it lacks the requested near-top plain-language decision summary. Add that concise summary before cleanup.
- The Persona Projection plan should be retired from `docs/progressing` after its P0 logic and future expansion boundaries are retained in the canonical Compose Assist doc. Its demo should move to `docs/demo` per repository policy.

## Implementation Trace

- The current service creates a projection before normal reply/cue generation, deterministic Web prompt patches, compiler outputs, and compiler-disabled context-pack fallback. Every `available=true` branch in the inspected flow includes `personaProjection` and a server-derived insertion mode.
- Final output validation can convert a candidate into an unavailable blocked response before the extension receives an insert affordance.
- The extension click gate includes `personaProjection.requiresPreview`; `representationMode='blocked'` is separately rejected from display.
- Prompt patches are explicitly excluded from projected profile slots, while rewrites/context packs may receive only the already-filtered external projection.
- The only `user_core` occurrence near the service's source constants is in the separate `MEETING_PREP_SOURCES` list; verify its call sites before concluding the Compose allowlist is clean.
- Existing tests and E2E fixtures cover audience differences, raw `USER_CORE` exclusion, profile-slot filtering, prompt patches, rewrite/append modes, projection-required preview, blocked icon suppression, and正文-only hover behavior.
- `MEETING_PREP_SOURCES` is consumed by the separate meeting-prep request builder, while composer requests go through `normalizeComposerSourceTypes`; this occurrence does not by itself violate the Compose raw-profile exclusion contract.
- The Persona Projection demo is an embedded host-surface simulation and its own assumptions already state that hover contains draft text only and projection copy appears only in locked review. It remains useful as a durable interaction reference and should be moved, not discarded.

## Documentation Handoff

- Added a near-top plain-language decision flow and explicit input/source priority to `docs/features/assist.md`.
- Added source-of-truth files, focused test/eval entrypoints, the current Compose Persona Projection P0 boundary, and concise cross-module expansion constraints.
- Corrected older interaction-reference prose that conflicted with the current正文-only hover and locked full-rewrite preview contracts.
- Removed the completed Persona Projection plan from `docs/progressing` and moved its demo to `docs/demo/persona-projection-contract.html`.

## Validation Gap Found

- The Jira estimate eval case still told manual testers to inspect `来源路由` and `草稿回执`, which contradicts the now-durable正文-only hover contract. Update this structured manual verification data before rerunning the eval so future reports do not teach the removed UI.
- After that fix, the Jira estimate eval report correctly includes the new manual guidance, but the case warns because the real `10.32.56.212` response lacks local `insertMode` and `personaProjection`. Content, required sections, risk, preview, and confidence all match. The deployed Memory Service contract is stale and must be selectively aligned before final completion.
- Selective runtime deployment plus the two narrow dependency contracts rebuilt successfully after one transient Docker EOF. The rerun passed and the raw remote response now contains `insertMode='append_patch'` plus `personaProjection(scene='web_ai_prompt_patch', external, context_pack_copyable, never_speak_as_user, requiresPreview=true)`.
