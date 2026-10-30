# Scheme E synthetic-mini 跑通记录（2026-10-31）

命令：

```bash
cd experiments/memory-benchmark
npm run run -- --fixture synthetic-mini --scheme E --out ./out
```

结果（本机，Letta App Server @ `ws://127.0.0.1:4500`，`run-1793381542215`）：

- `events_ingested`: 4
- `consolidations`: 3（虚拟日 2026-01-15 / 16 / 17）
- `probes_run`: 3，`probes_passed`: 3
- `mean_composite`: 67.22
- `cost.total_usd`: 0（harness ledger 未接 OpenRouter usage 回写；MemFS ingest 无 LLM；dream 本 run 为 best-effort）
- 隔离：每 scope 独立 unpinned agent + sidecar `.local/letta-data/E-{runId}.sqlite`
- MemFS：bootstrap `MEMORY.md` 索引链 + `benchmark/ev/{event_id}.md`（v2 frontmatter 仅 `name`/`description`；harness 元数据在正文）

可移植性门：

```bash
npm run gates:e
```

见 `gate-results.json`（2026-10-31 本机 **五门全过**）。

报告产物：`out/E-run-1793381542215.json` / `.md`
