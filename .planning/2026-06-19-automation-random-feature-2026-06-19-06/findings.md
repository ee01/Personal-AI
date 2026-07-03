# Findings & Decisions

## Requirements
- Pick one random feature from `docs/features/index.md`, inspect docs and code, research comparable products/papers, check Reminders, produce a plan, implement, update docs, verify thoroughly, and archive the Codex session.
- Target selected: `自动答复 / Reply` under Message Reaction, documented in `docs/features/message_reaction.md`.

## Research Findings
- Reminders: local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be matched or completed.
- Repo state: the worktree already has many unrelated modified/untracked files; keep this run scoped and use path-scoped diff checks.
- Current code already distinguishes toolbar `Reply` click from actual sending: `buildAutoReplyConfigLaunchReceipt()` says the click opens config only.
- Current config receipt distinguishes `immediate`, `delayed`, and `manual`, but it does not put rule scope, queue-row creation timing, and non-effects in one visible in-form receipt.
- Existing Scheduled Messages PendingReview rows already explain approve/reject behavior and have E2E assertions.
- External: Google Agent Assist Smart Reply surfaces suggestions to human agents rather than sending automatically; Outlook suggested replies require user selection/send and mobile can be edited before send; Fin Procedures emphasize deterministic controls for automated customer workflows; automation-bias research warns that AI suggestions can anchor human judgment.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a presentation helper in `src/message-reaction/autoReplyPresentation.ts` | Keeps copy and testable contract near existing auto reply receipt helpers. |
| Render the new receipt inside the new/edit auto reply config panels | This puts the boundary at the point of decision, before saving the rule. |
| Do not touch queue creation semantics | Existing backend and Scheduled Messages review behavior already match docs; issue is pre-save comprehension. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Reminder branch unavailable | Report exact `NO_PERSONAL_AI_LIST` state and do not claim completion. |

## Resources
- Google Cloud Agent Assist Smart Reply: https://docs.cloud.google.com/agent-assist/docs/smart-reply
- Microsoft Outlook suggested replies: https://support.microsoft.com/en-US/Outlook/use-suggested-replies-in-outlook
- Fin Procedures guide: https://fin.ai/learn/fin-procedures-guide
- Bias in the Loop, Harvard Data Science Review: https://hdsr.mitpress.mit.edu/pub/nrcn4h7d
