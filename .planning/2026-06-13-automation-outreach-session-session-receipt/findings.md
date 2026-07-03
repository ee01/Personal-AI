# Outreach Session Receipt Findings

## Initial Context

- `docs/progressing/to-verify.md` currently says `暂无。`; there is no carry-over validation task to resume.
- Automation memory fallback path `/Users/Esone/.codex/automations/automation/memory.md` shows the freshest completed runs were Quick Ask status-card priority receipt and Meeting Pilot embedded-frame boundary.
- Random feature chosen from `docs/features/index.md`: `主动询问` / `主动询问会话管理`.
- Local Reminders list names are visible, but there is no `Personal AI` list: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- Worktree was already broadly dirty before this run; preserve unrelated changes.

## Code And UX Findings

- Canonical doc: `docs/features/memory_system.md`, Outreach section.
- Main UI: `src/modals/components/OutreachSessions.vue`.
- Current E2E: `tools/verify-outreach-sessions-e2e.mjs`.
- Already implemented from prior runs: list-level `会话推进回执` for real sessions, terminal retry from history cards, message-reaction original-message links, failure banner with retry, and preserved stale data after refresh failures.
- Remaining gap: `待触发计划` template cards only show raw target/timing/sync metadata. A synced future template can still read like a concrete sent session, and the user has to infer that it has not sent yet, the next fire time is just a trigger window, and recovery goes through the source scheduled plan/latest session rather than immediate send.

## External Reference Findings

- Slack Workflow Builder describes workflows as trigger/step automations and exposes workflow activity for in-progress/completed/error states; that supports making template activity and not-yet-sent state visible on the list card.
- Microsoft Copilot Studio separates AI actions, human-in-the-loop actions, control flow, and connectors, and its request-information action explicitly pauses execution to collect human input before subsequent steps; that supports keeping target confirmation and no-auto-send boundaries explicit.
- SIGIR 2024 “Towards Human-centered Proactive Conversational Agents” argues proactive agents need restraint around timing, autonomy, control, and user expectations; a recurring Outreach template should therefore name when it will act and what it will not do immediately.
- CHI 2025 “Proactive Conversational Agents with Inner Thoughts” frames proactive participation as trigger, retrieval, thought formation, evaluation, then participation; Outreach’s template card should show the trigger/planning stage separately from actual participation/sending.

## Implementation Findings

- Added template-level `计划推进回执` to `待触发计划` cards.
- The receipt uses existing runtime-status fields: template schedule, target, sync state, and latest session.
- It explicitly says the card is a not-yet-sent plan, refreshing the list does not send, next dispatch is when a session will be generated, and recovery is through the previous run or scheduled plan edits.
- The E2E fixture must use a terminal latest session for the template to be visible; active latest sessions intentionally hide the template because the active session owns the next user action.
