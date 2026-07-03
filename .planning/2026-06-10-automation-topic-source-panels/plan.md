# Topic Source Panels Safety Receipts

## Scope

Random feature: `Topic 来源链接安全展示` in `docs/features/topic_based_messages.md`.

Prior automation already added visible destination hosts for conversation source links. This pass focuses on the remaining Topic Detail source surfaces: related resources and webpage records.

## Plan

1. Reuse one external-link presentation contract for safe host chips and hidden-source explanations.
2. Apply that contract to conversation source links, resource cards, and webpage records.
3. Avoid rendering credentialed or otherwise blocked webpage URLs in clear text.
4. Update the Topic Messages feature doc with the current behavior.
5. Validate with the topic verifier, extension dev compile, Topic Messages E2E, and diff whitespace checks.

## Research Notes

- Slack and Zulip treat message/topic/resource links as traceable context anchors.
- Microsoft Defender Safe Links covers Teams links at click time, reinforcing that communication-source links need visible safety boundaries.
- URL reading and inspection research shows that full URLs and hover-only tooltips do not reliably help users identify the real destination.
