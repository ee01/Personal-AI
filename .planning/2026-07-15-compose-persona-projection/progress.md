# Progress

## 2026-07-15

- Read `AGENT.md`, the planning skill, relevant memory registry entries, and scoped worktree status.
- Created an isolated implementation record without changing the active planning pointer.
- Started Phase 1: inspect current Compose Assist code and dirty diffs before implementation.
- Confirmed concurrent Web Prompt Compiler changes and mapped all current output branches.
- Confirmed the existing review-mode trigger and conditional review-note UI insertion point.
- Defined the transient projection contract, audience-resolution precedence, branch integration order, and fail-closed behavior.
- Baseline verification passed before feature edits: 30 memory-service Compose tests and 12 ComposerGuard unit tests.
- Completed Phase 1 inspection without overwriting the concurrent Web Prompt Compiler work.
- Completed Phase 2: added public projection types, `ComposerAudienceResolver`, `PersonaProjectionService`, and eight focused unit tests.
- Projection unit tests pass (8/8) and the memory-service TypeScript build succeeds.
- Started Phase 3: route every current Compose output branch through projection and final-output validation.
- Completed Phase 3: all current non-Web and Web output paths now attach a projection summary and pass final-output validation.
- Removed raw `user_core` from all Compose recall allowlists and deleted the legacy full-profile prompt loader.
- Updated scenario inference so existing RingCentral requests without an explicit scenario keep their matching style controls.
- Focused backend regression suite now passes: 38/38 tests across projection, API, and Compose eval files.
- Completed Phase 4: projection-required review participates in the actual click gate, blocked responses cannot render an insert affordance, and review-only boundary copy distinguishes omitted items from scene-only review.
- Removed `user_core` from RingCentral, Jira, Web AI, and generic Compose source lists in the extension.
- Frontend ComposerGuard and site-adapter tests pass (19/19); expanded backend branch coverage now passes (39/39).
- Started Phase 5: update the durable Compose Assist contract, the existing progressing plan, the demo, and no-LLM eval fixtures.
- Completed Phase 5: revised the existing plan and canonical Compose Assist docs, rebuilt the embedded Chinese RingCentral/Jira/ChatGPT demo, and added three deterministic persona eval fixtures.
- Demo Playwright checks cover peer direct insert, manager/Jira/Web review, Web profile trimming, and mobile overflow; desktop and mobile visual inspection passed.
- Added a production-content-script E2E for peer direct insert, manager review-only copy, and blocked icon suppression; it passes.
- Added authoritative resolved-audience generation controls so confirmed social edges cannot be overridden by raw relationship hints.
- Gated direct precompiled cues to non-degraded `draft_only + write_as_user` projections with zero used profile slots; other cues are regenerated under projection controls.
- Expanded relation/profile tests for `reports_to`, heterogeneous `mixed`, expired, sensitive, scope-mismatched, and common secret assignment output.
- Focused backend regression suite passes 43/43; frontend regression suite passes 19/19; memory-service TypeScript build passes.
- All three persona projection eval cases pass and the eval registry validates. The complete no-LLM suite still reports two unrelated Prompt Compiler failures and two warnings because no compiler generator is available in this local run.
- Started Phase 6 final build, scoped diff review, and latest-product E2E rerun.
- Completed Phase 6: final memory-service build passed; focused backend tests pass 43/43; frontend tests pass 19/19; production persona projection E2E passes; webpack reached its first successful compile; Demo mobile smoke and scoped whitespace checks pass.
- Final persona eval reports pass for peer/manager, Jira unconfirmed duty, and Web AI explicit constraints. The exact full-suite command was rerun against the final build; `.eval-runs/20260715T042222Z-compose-assist-dx5ecz/report.html` records the same unrelated Prompt Compiler failures while all three persona cases pass.
