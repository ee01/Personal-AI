# Scheme A synthetic-mini 跑通记录（2026-10-30）

命令（仓库根目录）：

```bash
cd experiments/memory-benchmark
npm run run -- --fixture synthetic-mini --scheme A --out ./out
```

结果（本机一次跑通）：

- `events_ingested`: 4
- `consolidations`: 3（虚拟日 2026-01-15 / 16 / 17）
- `probes_run`: 3，`probes_passed`: 3
- `mean_composite`: 94.44
- `cost.total_usd`: 0（合成 fixture，`skipExtraction` + 无 LLM judge）
- 隔离用户：`benchmark-scheme-a`，数据目录 `experiments/memory-benchmark/.local/baseline-data/`（gitignore）

单元测试：

```bash
cd memory-service
npm test -- --run src/__tests__/baselineHarnessAdapter.test.ts
```

覆盖：`ingest` / `consolidate` / `recall` / `decide` / `export` / `delete` / `revoke` 与 `SleepReconciliation.finished_at` 业务时钟断言。
