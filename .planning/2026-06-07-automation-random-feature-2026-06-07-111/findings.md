# Storyline Draft Findings

## Requirements
- Pick a random feature from `docs/index.md`, inspect code and docs, research similar product/paper patterns, plan first, implement a bounded improvement, update docs, and verify thoroughly.
- Check local Reminders `Personal AI` feedback before implementation and mark done only if a real related item exists.

## Selected Feature
- Feature row: `Storyline Draft API`.
- Capability: Memory Storyline Builder.
- Source doc: `docs/features/memory_storyline_builder.md`.
- Main implementation: `memory-service/src/core/StorylineDraftService.ts`, `memory-service/src/routes/storylines.ts`, `src/modals/components/StorylineDraftPage.vue`.
- Main verification: `memory-service/src/__tests__/api-storylines.test.ts`, `tools/verify-storyline-draft-page-e2e.mjs`, `tools/verify-storyline-video-home-e2e.mjs`.

## Local Reminder Findings
- Reminders list names visible locally: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No `Personal AI` list is present, so no Reminder item can be incorporated or marked done in this run.

## Research Findings
- NotebookLM positions source-grounded output around seeing the source, not just the answer; that supports making cited evidence visible and inspectable in the draft page.
- Microsoft 365 Copilot grounds work output in data the user can access and exposes citations in Teams chat answers; this supports keeping Storyline limited to user-owned prep/evidence and manual copy.
- Traceable Text reports that linking generated summary passages to source passages improves correctness especially when summaries contain hallucinations; this supports segment-level grounding receipts.
- GenProve argues citations alone are insufficient because users need to verify how a source supports a generated claim; this supports distinguishing cited refs from returned source details.
- Microsoft Research meeting recap work emphasizes different recap needs and user edit/delete behavior; this supports treating Storyline as a human-review surface rather than automatic publication.

## Code And UX Findings
- `StorylineDraftService` already rejects unsupported source kinds, blocks preps with zero evidence refs, ignores model-provided `artifactText`, and re-renders copyable output from normalized segments.
- Existing code falls back when fewer than three valid model segments remain, but it can accept three segments that all cite the same evidence even when the prep has more usable evidence.
- `StorylineDraftPage.vue` currently counts `draft.evidence.length` as `Evidence refs` when evidence details are returned. That can overstate grounding because the draft may cite only a subset of returned evidence.
- Existing E2E already verifies source gating, stale request protection, safe evidence links, review-before-copy, and clipboard fallback.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add distinct cited-evidence fallback in the service | Keeps grounding protection server-side and prevents plausible but narrow model output from passing as fully grounded |
| Keep fallback risk note wording | It already explains that the model output was replaced with cue-card grounded content |
| Change page metrics to cited refs and returned details | Clarifies what the draft actually uses without hiding available source details |
| Update existing tests instead of creating a new harness | Storyline already has targeted API and page E2E coverage |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Worktree is broadly dirty from prior runs | Keep edits scoped and avoid staging/reverting unrelated changes |
