# Message Followup Outreach Boundary Findings

## Requirements

- Randomly pick one feature from `docs/index.md`.
- Check code and keep the feature doc current without over-detailing.
- Search similar industry products and research papers before locking the improvement.
- Implement unfinished or low-decision improvements directly.
- Review the feature as a UX path, including bugs, blockers, and unreasonable states.
- Check local Reminders `Personal AI` list and include related items if present.
- Plan first, then fully implement and verify.

## Initial Findings

- Selected feature: `跟进追问 / Followup`.
- Capability: Message Reaction.
- Source document: `docs/features/message_reaction.md`.
- Index description: `自己发出的消息创建一次性 Outreach session`.
- Reminder result: `NO_PERSONAL_AI_LIST`, so no Reminder item is available for this run.
- `docs/progressing/to-verify.md` currently says `暂无。`.
- The worktree contains many unrelated existing changes; this run must stay tightly scoped.

## Research Findings

- Boomerang response tracking is built around a conditional no-reply path: if no reply arrives, the message returns/reminds the user; only separate automation may send a scheduled follow-up. The UX takeaway is to make conditional checking distinct from immediate send.
- Superhuman Auto Reminders detect outgoing messages that need follow-up when no reply has been received, while Auto Drafts create editable follow-up drafts before the reminder returns. The UX takeaway is to keep reminder/session creation, draft generation, and final sending visibly separate.
- Microsoft Teams Recap / Facilitator surfaces follow-up tasks and action items in recap/notes paths. The useful pattern is anchoring follow-up work to the original conversation artifact and keeping it reviewable.
- `Proactive Conversational Agents with Inner Thoughts` frames proactivity as seeking the right moment to contribute, not simply acting at every opportunity.
- `Towards Human-centered Proactive Conversational Agents` emphasizes timing sensitivity, patience, boundary respect, and non-intrusiveness. For Followup, the submitting state should state that Personal AI is creating/checking a session, not sending a new message immediately.

## Technical Decisions

| Decision | Rationale |
| --- | --- |
| Focus first on visible boundary copy and verifiable state | The highest-risk user misunderstanding is whether clicking Followup already sent an external question or only staged an Outreach session. |
| Add a submitting-state receipt | The pre-submit and success receipts are clear, but the in-between `创建中...` state is the moment users are most likely to wonder whether an external message was already sent. |

## Resources

- `docs/index.md`
- `docs/features/message_reaction.md`
- Boomerang for Gmail follow-up response tracking: https://www.boomeranggmail.com/l/follow-up-email-no-response.html
- Superhuman Auto Reminders & Auto Drafts: https://help.superhuman.com/hc/en-us/articles/46005658551053-Auto-Reminders-Auto-Drafts
- Microsoft Teams Recap: https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams
- Proactive Conversational Agents with Inner Thoughts: https://arxiv.org/abs/2501.00383
- Towards Human-centered Proactive Conversational Agents: https://liziliao.github.io/papers/SIGIR24_HPC.pdf
