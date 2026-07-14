# Scheduled Config AgentTask Read-Only Open Boundary

## User stance

I am using Scheduled Messages as an operator who trusts Sheet Config as the cross-device source of truth. Opening the manager page should not silently mutate Config, especially when I only wanted to inspect or sync state.

## Gap

The Config sync E2E showed that opening the initialized manager page could trigger extra Config reads through AgentTask webhook auto-fill. That weakens the manual sync single-flight promise and makes page open look more mutating than the UI says.

## Plan

1. Keep pending `docs/progressing/to-verify.md` empty; continue with the random `Scheduled Messages / Config sync` target.
2. Replace manager-page AgentTask webhook auto-fill on open with a read-only readiness receipt based on local Config and the current Messages snapshot.
3. Preserve explicit write paths: manual sync, save AgentTask, AR repeated AgentTask creation, and schema/update flows.
4. Extend config-sync E2E to prove page open does not read/write Sheet Config for AgentTask webhook readiness and manual sync remains single-flight.
5. Update `docs/features/scheduled_messages_manager.md` with the new page-open boundary.
