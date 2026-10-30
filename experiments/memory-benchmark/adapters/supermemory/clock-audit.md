# Scheme D virtual clock audit

| Operation | Clock group | Notes |
|---|---|---|
| `ingest` → sidecar envelope / ACL | `virtual_harness` | `observed_at_ms` stored; visibility at recall |
| `ingest` → Supermemory add/patch + poll `done` | `native_supermemory_api` | Queued pipeline; wall-clock poll |
| `consolidate` day boundary + OpenRouter main digest | `virtual_harness` | One row per virtual UTC day |
| `recall` `as_of` filter | `virtual_harness` | Drops future `observed_at` |
| `recall` → `POST .../search` | `native_supermemory_api` | Embedding + index on server |
| `delete` / `revoke` | both | API delete + sidecar tombstone / epoch bump |

Recorded in `export().clock_audit`.
