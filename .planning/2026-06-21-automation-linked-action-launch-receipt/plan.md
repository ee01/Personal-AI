# Message Reaction Linked Action Launch Receipt Plan

## Target

- Random feature: `联动操作 / Openclaw`
- Source doc: `docs/features/message_reaction.md`
- Main surfaces: RingCentral Message Reaction toolbar, `topic-modal.html` linked-action prefill, toolbar launch toast

## Current State

- Watch and Reply toolbar entries already show launch receipts that distinguish opening configuration from creating a live rule.
- Linked Action opens the same configuration surface, but its toolbar success toast only said it was opening configuration.
- As a user, that makes the riskiest action feel less explicit: the click could be mistaken for creating a RuntimeAction or invoking OpenClaw.

## Improvement Plan

1. Add a dedicated linked-action launch receipt in the Message Reaction presentation layer.
2. Use that receipt after `OPEN_LINKED_ACTION_CONFIG` succeeds from the toolbar.
3. Extend unit coverage so the receipt must name the non-effects: no RuntimeAction, no OpenClaw call, no history replay.
4. Extend the RingCentral fixture E2E to click the real toolbar button, verify the launch receipt, and confirm the config page still receives the original message context.
5. Update the canonical Message Reaction doc with the launch boundary.

## Verification

- `npm run verify:message-reaction`
- `npm start` until first successful compile, then stop
- `npm run verify:message-reaction:e2e`
- Scoped `git diff --check`
