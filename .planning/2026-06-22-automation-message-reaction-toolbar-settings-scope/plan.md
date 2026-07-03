# Message Reaction Toolbar Settings Scope Plan

## Target

- Feature: `消息交互工具栏`
- Source doc: `docs/features/message_reaction.md`
- Code surface: `src/message-reaction/MessageReactionUI.ts`
- Verification: `npm run verify:message-reaction`, `npm start`, `npm run verify:message-reaction:e2e`, scoped `git diff --check`

## Context Checked

- `AGENT.md`
- `docs/features/index.md`
- `docs/features/message_reaction.md`
- `docs/progressing/to-verify.md` (`暂无。`)
- Automation memory at `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
- Reminders: local app reachable, but no `Personal AI` list exists

## External Scan

- Gmail hover actions expose quick actions on message hover and let users disable hover actions in settings: https://support.google.com/mail/answer/2473038
- Microsoft Teams creates tasks/workflows from a message through message actions, then asks the user to fill target details before anything durable is created: https://support.microsoft.com/en-us/teams/platform/create-a-task-from-a-teams-message and https://support.microsoft.com/en-us/workflows/use-workflows-from-a-message-in-teams
- Slack documents keyboard/message action paths for common message actions, reinforcing that message-level actions should remain discoverable without becoming accidental execution: https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts
- Microsoft Human-AI interaction guidelines emphasize status feedback, user control, cautious adaptation, and recoverability: https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/
- Notification snooze research shows users need deferral and recovery paths, not just one-off controls: https://dl.acm.org/doi/10.1145/3229434.3229436

## UX Issue

The toolbar already handles deliberate hover, keyboard focus, and action-specific boundary receipts well. The remaining weak point is the long-hover settings gear:

- It is always Chinese even when the toolbar itself is localized to English.
- The settings popup says only that disabled buttons will disappear, but does not state the important non-effect: disabling a toolbar entry does not cancel existing Snooze reminders, Watch rules, Followup sessions, auto-reply rules, or linked-action rules.
- Save success toasts are generic, so a user could mistake a local display switch for a cleanup or cancellation action.

## Implementation Plan

1. Add a compact first-row scope receipt to the settings popup explaining that these are local toolbar display switches.
2. Localize the settings title, labels, hint, save state, failure copy, and success receipts through existing `ui()` / `staticTranslations`.
3. Change settings save success copy so all-off and partial-save states both preserve the no-cancel/no-delete boundary.
4. Extend the existing Message Reaction E2E to assert the settings scope receipt in Chinese and English.
5. Update `docs/features/message_reaction.md` and the feature index row.

## Non-Goals

- Do not change the 4-second hover delay, Snooze menu, action creation, or background execution semantics.
- Do not alter existing Snooze / Watch / Followup / Reply / Openclaw data contracts.
