# Outreach Detail Operation Scope Findings

## Repo And Reminder Findings

- `docs/progressing/to-verify.md` says there are no pending verification items.
- Randomly selected feature: `主动询问` / Memory Service / `docs/memory_system.md`.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` Reminders list exists, so this run has no Reminder item to complete.
- Worktree is already broadly dirty. Preserve unrelated changes.

## Code And UX Findings

- `docs/memory_system.md` already documents the Outreach engine, target resolution, list priority receipt, session handoff receipt, terminal retry path, and list failure recovery.
- Main implementation files inspected:
  - `memory-service/src/core/OutreachEngine.ts`
  - `memory-service/src/routes/outreach.ts`
  - `src/modals/components/OutreachSessions.vue`
  - `src/modals/components/OutreachSessionDetail.vue`
  - `tools/verify-outreach-sessions-e2e.mjs`
- The list page already surfaces `本页优先级` and per-card `会话推进回执`.
- Detail page currently puts action buttons in the top bar and then shows hero/status/details, but it lacks a first-screen action-scope receipt explaining what approve, retry, cancel, edit, wait, and message-reaction inspection do or do not do.
- This is a trust-boundary gap because approving a pending session can trigger an external RingCentral message, while retry resets terminal sessions and cancel only changes session state.

## External Reference Findings

- RingCentral Team Messaging API and event docs confirm apps can send messages and react to Team Messaging events, so Outreach approval/send must be treated as an external side-effect boundary.
- Slack Workflow Builder and Slack developer workflow examples frame automations as trigger/action flows with approval/interactivity and response steps, supporting visible stage and wait-state copy.
- Microsoft Teams proactive messaging docs treat proactive bot messages as a specific bot capability, reinforcing that proactive outreach should not be hidden behind generic status text.
- Human-centered proactive conversational agents research argues that proactive agents should optimize for human needs, expectations, and social/ethical implications, not just autonomous capability.
- HITL review literature emphasizes contextual human intervention points for higher-risk autonomous actions; Outreach detail approval is one of those points.
