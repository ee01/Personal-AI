# Findings

## Initial checks

- `docs/progressing/to-verify.md` shows no pending carry-over item.
- EventKit can read the `Personal AI` Reminders list. It has 4 total items, all completed, and none are related to Outreach / 主动询问.
- AppleScript list enumeration did not include `Personal AI`, matching prior automation-memory warnings that AppleScript can miss this list.

## Code/doc inspection

- Canonical doc section `docs/features/memory_system.md` says Outreach is for missing information from a known external person/group, with RingCentral target resolution, pending approval, scheduling, waiting, retry, cancel, and detail editing.
- `src/modals/components/OutreachSessions.vue` already has page triage, focus lane, filter scope, filtered-empty, session/template handoff, list operation pending/success/failure, and list pre-dispatch review receipts.
- `src/modals/components/OutreachSessionDetail.vue` already has operation scope, pre-dispatch review, unsaved draft, operation pending/success/failure, and target search safeguards.
- UX gap: several actual high-impact buttons do not carry the same action boundary in their own `title` / `aria-label`. Detail buttons (`批准发送`, `编辑目标与时间`, `重试`, `取消`, edit save/cancel, directory refresh/search) and list `取消` / terminal `重试` rely on nearby receipts, but hover/reader users do not get the exact click boundary at the control itself.

## External scan

- Microsoft Copilot Studio Request for Information frames missing-info workflows as pause/request/resume steps with a named human reviewer.
- OpenAI Agents SDK HITL docs describe sensitive tool calls as interruptions that must be approved/rejected before continuing from saved run state.
- Slack Workflow Builder docs emphasize connector/action steps, permissions, configuration, and user-controlled workflow construction.
- Human-centered proactive conversational-agent research emphasizes user expectations, interruption cost, and human/social implications rather than capability-only autonomy.
- ProACT (July 2026) frames proactive multi-user agents around breakdown detection, non-interruptiveness, conciseness, and appropriateness.

## Planned improvement

- Add reusable Outreach button boundary helpers so high-impact controls expose the same boundary through `title` and `aria-label` before click.
- Keep behavior unchanged: no API, storage, RingCentral, target resolution, retry, cancel, approve, schedule, or evidence logic changes.
- Update E2E to assert representative button labels, then update docs/index concisely.
