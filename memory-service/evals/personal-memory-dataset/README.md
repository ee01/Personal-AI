# Personal memory eval dataset (Phase 0 / T0)

Read-only inventory manifests for E-141 parallel memory benchmarks. **No message text** is exported at this phase.

## Run

```bash
cd memory-service
npm run inventory:eval-dataset -- --user esone.qiu --db /path/to/memory.db [--user-data-dir /path/to/user/dir] [--out evals/personal-memory-dataset/out.json]

# Production host (read-only sqlite3 over SSH):
npm run inventory:eval-dataset -- --user esone.qiu \
  --ssh rcadmin@10.32.56.212 \
  --db /Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db \
  --out evals/personal-memory-dataset/phase0-prod-esone.qiu-2026-10-30.json
```

Phase 1 JSONL export (T3, local-only body) — see `schema.json` and `tools/export-eval-dataset-phase1.mts`.

```bash
cd memory-service
npm run export:eval-dataset-phase1 -- \
  --user esone.qiu \
  --ssh rcadmin@10.32.56.212 \
  --db /Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db \
  --user-data-dir /Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu \
  --phase0 evals/personal-memory-dataset/phase0-prod-esone.qiu-2026-10-30.json
```

Writes `raw-only/` and `include-derived/` manifests (events JSONL gitignored; manifest + hashes + REPORT committed after export).
