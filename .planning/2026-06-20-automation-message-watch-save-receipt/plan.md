# Message Reaction Watch Save Receipt Plan

## Target

- Random feature: `关注后续 / Watch`
- Source doc: `docs/features/message_reaction.md`
- Main surfaces: RingCentral Message Reaction toolbar, `topic-modal.html` pending Watch prefill, Watch rule save receipt

## Current State

- Toolbar click opens Watch config and shows that the message is not watched until saving.
- Topic modal prefill clears sender scope, keeps group scope, and shows a creation-boundary receipt.
- Saving a Watch rule stores the rule and then attempts to index the original message through `STORE_FOLLOWED_MESSAGE`, but the UI does not distinguish confirmed original-message indexing from a failed/unconfirmed index response.

## External Scan

- Microsoft Teams followed threads expose manual/automatic follow state and a Followed threads view, so Watch should explain where later state will be managed.
- Slack message reminders stay anchored to the original message and make time/notification semantics explicit.
- Context-aware thread detection research shows multi-party chat follow-up matching depends on reply/thread/context signals, so the UI should name matching routes instead of implying a simple sender filter.
- AI-powered reminders research reinforces that follow-up reminders should separate extracted commitment, reminder delivery, and actual task completion.

## Improvement Plan

1. Expand the Watch creation-boundary receipt with listening lifetime and matching-route copy.
2. Add a Watch save-result receipt that says whether the original message was indexed successfully for semantic matching.
3. Preserve rule creation even if original-message indexing fails, but surface the degraded semantic-match state instead of showing a generic success.
4. Update targeted tests and the Message Reaction E2E expectations for the new receipt contract.
5. Update the canonical feature doc with the current Watch behavior.

## Verification

- `npm run verify:message-reaction`
- `npm start` until first successful compile, then stop
- `npm run verify:message-reaction:e2e`
- Scoped `git diff --check`
