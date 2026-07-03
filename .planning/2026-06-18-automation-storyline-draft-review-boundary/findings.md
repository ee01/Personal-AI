# Findings: Storyline Draft Review Boundary

## Local context

- `docs/features/memory_storyline_builder.md` is current on the major contracts: Today Pilot is the P0 trigger, Draft API is `POST /api/v1/storylines/draft`, the page keeps target format locked, caches per source/target/audience, filters unsafe links, shows cited vs returned evidence, and gates copy when there are global gaps/risk notes.
- `src/modals/components/StorylineDraftPage.vue` already computes the selected segment grounding state, but that warning is local to the currently selected segment. There is no all-draft grounding receipt, so a user can acknowledge only the global gaps/risks while missing that other segments are single-ref, missing detail, or ungrounded.
- Existing E2E (`tools/verify-storyline-draft-page-e2e.mjs`) has a fixture with three single-ref segments and already validates copy gating, stale-request protection, safe links, and unsupported source handling. It is the right place to assert the new review receipt.
- Reminders was readable, but visible lists were: We, Next actions, Moives, Shopping List, 家庭, 人名记忆, 宝宝需要办理, 吃吃看, 出门前检查, 装修待办, Reading, 菜头, Tasks. No `Personal AI` list was visible, so no Reminder item was incorporated or completed.

## External scan

- Google NotebookLM positions itself as a source-grounded research assistant with clear inline citations for accuracy, transparency, and trust. Its chat docs say citations can be hovered or opened in context, and that responses use selected sources.
- Microsoft 365 Copilot Pages turns AI responses into editable/shareable pages, but its docs also call out data-source scope, permissions, and limitations around sparse/poorly structured content.
- MIRAGE / Model Internals-based Answer Attribution argues that verifiability is a fundamental RAG challenge and that self-citations may point to non-existent or unfaithful sources.
- `Correctness is not Faithfulness in Retrieval Augmented Generation Attributions` distinguishes correctness of an answer from whether the cited documents genuinely contributed to it.
- Narrative-scaffolding research flags analytical-integrity risks when algorithmic decisions and narrative framing become invisible to users.

## Locked improvement

Add a draft-level `段落证据复核` receipt that lists every segment whose grounding is weak: no refs, only ref ids, missing evidence details, or single-ref/single-source support. The copy gate should mention and require acknowledgement of those segment-level evidence boundaries alongside global gaps and risk notes. This is presentation-layer only: no new Storyline API fields, no Memory Service write, no external writeback, and no new review queue.
