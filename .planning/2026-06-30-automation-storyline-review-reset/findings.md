# Findings

## Repository

- Selected feature: `Storyline Draft API` / Memory Storyline Builder.
- Source doc: `docs/features/memory_storyline_builder.md`.
- Main page: `src/modals/components/StorylineDraftPage.vue`.
- Existing E2E: `tools/verify-storyline-draft-page-e2e.mjs`.

## Reminder State

- The first broad JavaScript Reminders probe timed out under alarm.
- A narrower list-name AppleScript probe succeeded.
- Lists present: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No `Personal AI` list exists, so no Reminder item can be incorporated or marked done.

## Prior Memory

- Recent Storyline sweeps already handled source-open receipts, copy snapshot/stale state, and LLM failure fallback.
- Current change should avoid those surfaces and focus on the next trust boundary.

## External Scan

- Microsoft Teams recap keeps recordings, transcripts, shared content, AI notes, and access controls close to recap review.
- Google Meet notes emphasize host controls and consent before automated notes are produced.
- PowerPoint Copilot speaker notes are generated, then the user reviews and chooses whether to keep or discard them.
- Evidence-based text-generation research frames attribution, citation, and quotation around traceability and verifiability, which supports resetting review gates whenever the grounded artifact changes.

## Implementation

- Copy is now blocked while Storyline draft is loading, when generation failed, or when the source is unsupported.
- The header exposes `正在生成，暂不能复制` / `生成失败，未复制旧草稿` instead of leaving a stale hidden draft copyable.
- The E2E now proves target changes invalidate the previous review acknowledgement and failed loads cannot copy the hidden previous draft.
