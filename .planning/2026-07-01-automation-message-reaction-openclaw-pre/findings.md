# Findings & Decisions

## Requirements
- Automation request: choose a random feature from `docs/features/index.md`, reconcile docs and code, search related products and papers, implement incomplete/low-decision improvements, inspect UX/bugs/blockers, check Reminders feedback, plan first, then implement and verify as fully as practical.
- Selected feature: `联动操作 / Openclaw`.
- Capability: Message Reaction.
- Source document: `docs/features/message_reaction.md`.

## Research Findings
- `docs/progressing/to-verify.md` currently says `暂无。`.
- Recent automation memory already covered Skill Foundry health, Coverage aggregate receipt, DigestQueueService local summary, Auto Reply readiness, Rehearsal empty filters, selected-text capture pre-review, Compose Assist stale drafts, Project Dashboard source diagnostics, and Memory Lens site controls; this run avoids those exact surfaces.
- Local Reminders lists visible in this session: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible Reminders list named `Personal AI`; no Reminder feedback was incorporated and there is nothing to mark done.
- The worktree is broadly dirty before this run. Treat pre-existing modifications as user/automation-owned and keep this sweep scoped.
- External scan: Slack Workflow Builder separates trigger, variables, steps, buttons, and permission controls; Zapier trigger setup emphasizes testing a representative trigger sample; Copilot Studio Request for Information formalizes human-in-the-loop pause/review; TAP research shows users confuse trigger/action semantics without explicit mental-model support.
- Code finding: `topic-modal.tsx` already lets users run a dry-run preview through `previewMessageRuleAutomation`, but the result panel primarily showed action family, candidate actions, warnings, and suggested prompt. It did not first summarize the sample, candidate/warning counts, no-side-effect boundary, and next execution lane as a stable receipt.
- Implementation slice: add a frontend-only `预演结果回执` for linked-action dry-runs. It uses existing preview response fields and the existing trigger/rule context, so it needs no service contract, storage, or OpenClaw behavior change.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use `.planning/2026-07-01-automation-message-reaction-openclaw-pre/` for this run | Avoids overwriting older root `task_plan.md`, `findings.md`, and `progress.md` |
| Do not change `MessageRuleAutomationPlanner` | Preview already returns the needed fields and tests confirm preview does not write actions |
| Cover both new and edit flows | New rules use the pending message context; editing existing rules uses the saved rule sender/group/text as the preview sample |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Reminders probe did not return immediately | Stopped after output was available and recorded the absence of `Personal AI` |

## Resources
- `AGENT.md`
- `docs/features/index.md`
- `docs/features/message_reaction.md`
- `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
- Slack Workflow Builder, Zapier trigger setup, Microsoft Copilot Studio Request for Information, and Huang/Cakmak TAP mental-model paper
