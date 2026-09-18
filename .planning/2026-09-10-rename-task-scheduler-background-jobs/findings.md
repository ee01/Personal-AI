# Findings: Task Scheduler rename

## What it is
Chrome MV3 Service Worker alarm manager for extension housekeeping: memory_sync, message_analysis, digest_queue_process, health checks. Not Task Center.

## Canonical files
- `src/services/TaskScheduler.ts` → `BackgroundJobs.ts`
- `src/services/taskSchedulerDefinitions.ts` → `backgroundJobDefinitions.ts`
- `src/services/taskSchedulerStatusFilters.ts` → `backgroundJobStatusFilters.ts`
- `docs/features/task_scheduler_api.md` → `background_jobs.md` (old path is a short redirect)
- Popup: 「后台作业」 / `Background Jobs`

## Persistence that must stay compatible
- Read `backgroundJobStates` then fall back to `taskSchedulerStates`; write the new key and remove the old one
- Create `background_job_*` alarms; still recognize `scheduled_task_*` and migrate
- New messages `GET_BACKGROUND_JOBS_STATUS` / `CONTROL_BACKGROUND_JOB`; accept legacy `GET_TASK_SCHEDULER_STATUS` / `CONTROL_TASK`

## Leave alone
- `src/proactive-notifications/ProactiveNotificationService.ts` `ScheduledTask`
- `memory-service/src/types/node-cron.d.ts`
- `memory-service` dashboard copy 「后台任务今日 Token 异常」
- Historical `.planning/2026-06*` / `2026-07*` automation notes
- `isScheduledTask` (manual vs scheduled message analysis)
- `/agent-tasks` analytics mapping stays `task_scheduler`

## Verifiers
- `tools/verify-background-jobs-api.ts`
- `tools/verify-background-job-status-filters.ts`
- `tools/verify-background-jobs-popup-e2e.mjs`
- Old npm scripts still alias to the new ones
