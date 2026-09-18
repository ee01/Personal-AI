# Task Plan: Rename Task Scheduler → Background Jobs

## Goal
把 Chrome 扩展里的 Task Scheduler（`scheduled_task_*` 内务闹钟）改名为「后台作业 / BackgroundJobs」，避免和任务中心混淆。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm naming: 后台作业 / BackgroundJobs
- [x] Inventory code, docs, storage, alarms, messages
- **Status:** complete

### Phase 2: Compatibility decisions
- [x] Storage: new `backgroundJobStates`, still read `taskSchedulerStates`
- [x] Alarms: create `background_job_*`, still handle `scheduled_task_*`, clear legacy when creating new
- [x] Messages: new types, accept legacy `GET_TASK_SCHEDULER_STATUS` / `CONTROL_TASK`
- [x] Skip historical `.planning/2026-06*` / `2026-07*` automation notes
- [x] Do not touch unrelated `ScheduledTask` (ProactiveNotificationService, node-cron)
- **Status:** complete

### Phase 3: Implementation
- [x] Git-mv core files and update identifiers
- [x] UI / i18n 后台任务 → 后台作业
- [x] Canonical docs + redirect stub
- [x] Verifiers and package.json scripts
- **Status:** complete

### Phase 4: Testing & Verification
- [x] `npm run verify:background-jobs-api`
- [x] `npm run verify:background-job-status-filters`
- [x] webpack compile
- [x] popup e2e: dismiss help onboarding; stub SW fetch; English copy uses background job
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize rename map and compatibility for the user
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Class name `BackgroundJobs` | Matches agreed option A |
| Keep method names like `toggleTask` | Reduces risk in a 2k-line class; class/file/docs/UI carry the new name |
| Analytics key `background_jobs`; keep `task_scheduler` as deprecated label alias | Avoid splitting historical usage rows |
| `/agent-tasks` stays mapped to `task_scheduler` alias | That route was AgentTask telemetry, not Chrome alarms; remapping now would silently rebucket dashboards |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| popup e2e blocked by help onboarding mask | 1 | Seed `helpCenterOnboardingSeen` and click dismiss if the overlay still appears |
