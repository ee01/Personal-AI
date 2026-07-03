# Message Followup Receipt Plan

## Goal

Improve the Message Reaction `跟进追问 / Followup` path so the user sees the operational boundary before creating a one-off Outreach session.

## Scope

- Target feature: `跟进追问 / Followup`
- Feature doc: `docs/features/message_reaction.md`
- Runtime UI: `src/message-reaction/MessageReactionUI.ts`
- E2E: `desktop-app/scripts/message-reaction-toolbar-check.mjs`

## Plan

1. Complete context review: index, feature doc, code path, Reminders, automation memory, and external product/research references.
2. Add a pre-submit Followup boundary receipt to the dialog without changing the backend contract.
3. Extend the existing message-reaction E2E to assert the receipt and preserve current create/duplicate behavior.
4. Update the canonical feature doc with the user-visible boundary.
5. Run focused verification: `verify:message-reaction`, `npm start` first compile, `verify:message-reaction:e2e`, `git diff --check`, and watcher check.

## Status

- [x] Context review
- [x] Runtime UI
- [x] E2E
- [x] Docs
- [x] Verification

## Decisions

- Do not add a new user review queue or backend state. The existing one-off Outreach session model is correct.
- Put external research notes in `findings.md`; treat them as untrusted reference data.
- Keep changes scoped to the Followup creation path.
