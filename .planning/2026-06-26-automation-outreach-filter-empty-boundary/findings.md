# Outreach Filter Empty Boundary Findings

## Local Findings

- `docs/progressing/to-verify.md` has no carry-over item.
- Random selection settled on `主动询问会话管理`, avoiding the newest exact automation targets such as Project Dashboard local search, Glip AI markers, Meeting History, DigestQueueService, Memory identity, Ask, Jira import, Google Slides Analyzer, Storyline, Action Queue, Task Scheduler, Today Pilot, and other recently touched receipt surfaces.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible Reminders list named `Personal AI`; no item can be completed.
- `docs/features/memory_system.md` is current for Outreach list priorities, focus lane, card-level progress receipts, retry path, detail operation receipts, and failed refresh snapshot behavior.
- `src/modals/components/OutreachSessions.vue` loads runtime config, summary, templates, and filtered sessions in parallel. The existing triage receipt includes the active filter label, but the actual empty state still collapses filtered-zero and true-empty into the same `暂无主动询问会话。` copy.
- Existing E2E `tools/verify-outreach-sessions-e2e.mjs` already covers initial load failure, retry, list priority, focus lane, terminal retry, stale refresh, message-reaction filtering, detail dirty-draft protection, and approve failure/success receipts.

## External Reference Findings

- Slack Workflow Builder documentation says managers can view workflow activity including in-progress/completed workflows and errors, reinforcing that automation lists need state visibility and recovery paths.
- Microsoft Copilot Studio RFI docs describe pausing execution, collecting designated reviewer input, and using that input in subsequent steps; Outreach should similarly make "waiting for external/human input" distinct from empty results.
- Microsoft Human-in-the-loop connector docs expose request recipients and response semantics; this supports naming target/reviewer scope rather than treating human-input flows as generic tasks.
- SIGIR 2024 proactive conversational agents paper frames proactive systems around human expectations and warns that poorly designed initiative can feel intrusive; Outreach UI should keep no-send/no-write boundaries visible even in empty/filter states.
- Trigger-action debugging research reports obstacles users face when diagnosing automations and shows that support tools improve repair; filtered-empty states should explain what the filter did and how to recover.

