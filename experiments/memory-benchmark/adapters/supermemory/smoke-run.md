# Scheme D synthetic-mini 跑通记录（2026-10-31）

命令：

```bash
cd experiments/memory-benchmark
npm run run -- --fixture synthetic-mini --scheme D --out ./out
```

结果（本机，`run-1793381231916`）：

- `events_ingested`: 4
- `consolidations`: 3（虚拟日 2026-01-15 / 16 / 17）
- `probes_run`: 3，`probes_passed`: 3
- `mean_composite`: 94.44
- `cost.total_usd`: 0（harness ledger 未接 OpenRouter usage 回写；server 侧抽取见 OpenRouter 账单）
- 隔离：每 scope 独立 namespace `bm-d-{runKey}-{scope}`；sidecar 在 `.local/supermemory-data/`（gitignore）
- 前置：`supermemory-server` 0.0.9 @ `127.0.0.1:6767`，OpenRouter `z-ai/glm-5.3-flash` + local `Xenova/bge-m3`

可移植性门：

```bash
npm run gates:d
```

见 `gate-results.json`（2026-10-30 本机 **六门全过**，`swap_to_graphiti: false`）。

报告产物：`out/D-run-1793381231916.json` / `.md`
