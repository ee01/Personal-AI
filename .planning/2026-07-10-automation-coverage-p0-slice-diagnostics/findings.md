# Findings: Coverage P0 Slice Diagnostics

## Repo Findings

- `docs/progressing/to-verify.md` says `暂无。`, so no carry-over item blocks a fresh random feature.
- Random sample included `覆盖聚合 API`; recent automation memory covered Agent Thinking, AR Data, Topic Messages, Message Analysis, Relationship Radar, Rehearsal, Notification/Digest, Doubao, Outreach, Project Dashboard, and Meeting Pilot handoff, so `覆盖聚合 API` is a reasonable non-fresh target.
- `memory-service/src/routes/coverage.ts` already exposes P0 slice endpoints with structured receipts:
  - `/coverage/messages-by-source`
  - `/coverage/pressure`
  - `/coverage/provider-jobs/recent`
  - `/coverage/skills-sync`
- `memory-service/src/__tests__/api-coverage.test.ts` already checks the slice receipt contract.
- `src/modals/components/MemoryCoveragePage.vue` renders the main `/coverage/map` receipt, quality score receipts, refresh receipts, timeline slice receipt, import/backup receipts, and restore receipts. It does not currently expose the P0 slice API receipts as a user-facing diagnostic path.

## External Scan

- Google My Activity centralizes activity controls, filters, deletion, and download paths, reinforcing that coverage/diagnostic surfaces should separate what was read from what can be deleted or exported.
- OpenAI Memory FAQ highlights user control, memory summaries, source visibility, correction, and deletion limits; this supports making P0 slice source/boundary receipts visible instead of burying them in raw API responses.
- Microsoft 365 Copilot connector docs expose connector error codes, counts, downloadable logs, indexed item status, ACL checks, and refresh caveats; Coverage Map should keep API slice diagnostics separate from actual sync/crawl/ACL repair.
- Notion Enterprise Search documents permission-aware connected search, permission synchronization, progress monitoring, retries, and audit trails; this supports showing no-sync/no-write boundaries when presenting connector-style diagnostics.
- Provenance explanation research notes that provenance is often too detailed and not contextualized for users; the UI should summarize each slice's source, count, freshness, and boundary instead of dumping raw rows.

## Improvement Decision

Expose a compact `P0 只读诊断切片` panel near the Coverage snapshot. It should:

- Fetch all four slice endpoints after the main map loads and on manual refresh.
- Show generated time, slice source, summary count/freshness/failure/enabled fields, and the slice boundary.
- Make loading/failure states explicit without replacing the main coverage map.
- State that the panel only reads diagnostic slices and does not write memory, rerun provider sync, fix config, mark read, send notifications, or update external platforms.

## Scope Boundary

Do not change `MemoryCoverageService` scoring, platform state, repair action logic, smart import, backup export/restore, provider sync, or real memory data.
