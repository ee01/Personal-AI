# Relationship Assistant Draft Receipt Plan

## Goal
Improve the randomly selected `人脉关系 Assistant Draft` feature by making the generated relationship-aware draft visibly source-, privacy-, review-, and action-bounded before the user copies or sends it elsewhere.

## Current Phase
Completed

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo instructions, automation memory, workflow memory, stale planning files, feature index, `to-verify`, Reminders list state, and current worktree |
| 2 | completed | Inspect Relationship Radar docs, assistant draft API/service, UI, client types, and existing API/E2E tests |
| 3 | completed | Research comparable AI email/CRM drafting products and communication-assistant papers |
| 4 | completed | Write the concrete improvement plan before editing runtime files |
| 5 | completed | Implement a bounded assistant-draft generation receipt and docs/tests updates |
| 6 | completed | Run Relationship Radar API test, E2E, first successful `npm start` compile, and scoped diff checks |
| 7 | completed | Update automation memory, Reminder state if applicable, and attempt session archive |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Selected feature: `人脉关系 Assistant Draft` | Random sample from `docs/features/index.md`; avoids the freshest Scheduled Messages and Task Scheduler runs |
| No Reminder item incorporated | Reminders is readable, but no visible list named `Personal AI` exists |
| Implement a generation receipt, not a new review queue | Low-decision UX gap: the draft panel shows metrics, but the source/privacy/action boundary is only clear after copy |
| Normalize assistant context surface to `relationship_assistant_draft` | The service already has a readable label for this surface; current call used `relationship_assistant`, which could leak a raw label into receipts |
| Preserve unrelated dirty worktree changes | The repo has broad pre-existing modifications; this run only owns Relationship Radar files plus this plan and automation memory |

## Errors Encountered

| Error | Resolution |
|-------|------------|
| `$CODEX_HOME/automations/automation/memory.md` read looked missing when `$CODEX_HOME` was unset | Re-read the fallback `/Users/Esone/.codex/automations/automation/memory.md` |
| Root `task_plan.md` is stale Scheduled Messages data | Created this isolated `.planning/2026-06-15-automation-relationship-assistant-draft-/` plan |
| No visible `Personal AI` Reminders list | Record absence and do not mark any Reminder done |
| First API verifier rerun failed on too-narrow source-quality expectations | Split context-card and assistant-draft assertions by their actual fixture state |
| First E2E reruns hit strict-mode duplicate text after adding the new receipt | Scoped assertions to exact text or the copy-receipt container |
