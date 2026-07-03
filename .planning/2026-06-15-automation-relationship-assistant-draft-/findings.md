# Relationship Assistant Draft Findings

## Requirements

- Randomly selected feature: `人脉关系 Assistant Draft`.
- Source doc: `docs/features/relationship_radar.md`.
- Related code: `memory-service/src/core/RelationshipRadarService.ts`, `memory-service/src/routes/relationships.ts`, `src/modals/components/RelationshipRadarPage.vue`, `src/services/MemoryServiceClient.ts`.
- Reminder state: local Reminders lists are readable, but there is no visible `Personal AI` list.
- Carry-over state: `docs/progressing/to-verify.md` says `暂无。`.

## Research Findings

- Microsoft Outlook Copilot drafting keeps a review/edit step before send, supports tone/length adjustment, and notes sensitivity-level changes. This supports treating generated relationship drafts as editable drafts, not final sent messages.
- Google Workspace announced Gmail Help me write contextualization and tone/style personalization from Gmail/Drive. This supports surfacing what context entered a draft and what context did not.
- Salesforce Einstein Copilot emphasizes grounding responses in trusted business data with governance; Einstein Relationship Insights surfaces relationship networks and evidence documents to support relevant conversations. This supports an evidence/source receipt for relationship-aware drafting.
- Smart Reply research frames short response generation as high-throughput assistance, but the current feature has a higher trust boundary because it uses personal relationship memory and may represent the user in a live relationship.
- AI-mediated communication research warns that AI-generated interpersonal messages affect authenticity and trust; the UI should keep user agency, review status, and non-send/writeback boundaries explicit.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Add `draftReceipt` to `RelationshipAssistantDraft` | Makes source/privacy/review/action boundaries visible immediately after generation |
| Include rows for source quality, draft scope, usable material, and external action | These are the practical questions a user needs before copying a relationship-aware reply |
| Keep copy receipt separate | Copy receipt answers what happened to the clipboard; generation receipt answers what the draft is based on |
| Extend API and E2E tests | The receipt is a user-facing contract and should not rely on visual/manual inspection only |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Existing Relationship Radar files already contain unrelated diffs from prior automation runs | Work with current file contents and keep new edits scoped |
| Assistant draft context card used `relationship_assistant`, while the readable label map used `relationship_assistant_draft` | Normalize to `relationship_assistant_draft` in the draft service path |

## Resources

- Microsoft Support: Draft an email message with Copilot in Outlook.
- Google Workspace Updates: Improvements to Help me write in Gmail.
- Salesforce: Einstein Copilot announcement and Einstein Relationship Insights Trailhead.
- Kannan et al. 2016: Smart Reply.
- Hancock et al. 2020: AI-Mediated Communication research agenda.
